import base64
import io
import os
from typing import Optional
import cv2
import numpy as np
import torch
import torch.nn.functional as F
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image, UnidentifiedImageError

MODEL_PATH = os.getenv("FOOT_MODEL_PATH", "models/foot_segmentation.ts")
MAX_IMAGE_BYTES = int(os.getenv("FOOT_MAX_IMAGE_BYTES", str(10 * 1024 * 1024)))
ALLOWED_ORIGINS = [x.strip() for x in os.getenv("FOOT_ALLOWED_ORIGINS", "").split(",") if x.strip()]
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
app = FastAPI(title="Vijayasri Foot Sizing API", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=ALLOWED_ORIGINS, allow_credentials=False,
                   allow_methods=["GET", "POST"], allow_headers=["Content-Type"])
model: Optional[torch.jit.ScriptModule] = None

@app.on_event("startup")
def load_model():
    global model
    if os.path.isfile(MODEL_PATH):
        model = torch.jit.load(MODEL_PATH, map_location=DEVICE).eval()

@app.get("/health")
def health():
    return {"service": "vijayasri-foot-sizing", "version": "0.1.0",
            "model_loaded": model is not None, "device": str(DEVICE)}

def _letterbox(image: Image.Image, size: int = 512):
    image = image.convert("RGB")
    scale = min(size / image.width, size / image.height)
    width, height = max(1, round(image.width * scale)), max(1, round(image.height * scale))
    resized = image.resize((width, height), Image.Resampling.BILINEAR)
    canvas = Image.new("RGB", (size, size), (0, 0, 0))
    left, top = (size - width) // 2, (size - height) // 2
    canvas.paste(resized, (left, top))
    return canvas, (left, top, width, height)

def _suggest_landmarks(mask: np.ndarray):
    contours, _ = cv2.findContours(mask.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        raise ValueError("No foot outline was found.")
    contour = max(contours, key=cv2.contourArea).reshape(-1, 2).astype(np.float32)
    if len(contour) < 30 or cv2.contourArea(contour.astype(np.int32)) < 2500:
        raise ValueError("The detected foot outline is too small or incomplete.")
    center = contour.mean(axis=0)
    centered = contour - center
    eigenvalues, eigenvectors = np.linalg.eigh(np.cov(centered.T))
    axis = eigenvectors[:, int(np.argmax(eigenvalues))]
    # Capture instructions ask the customer to point toes toward the top of portrait A4 paper.
    if axis[1] > 0:
        axis = -axis
    lateral = np.array([-axis[1], axis[0]], dtype=np.float32)
    longitudinal = centered @ axis
    lateral_values = centered @ lateral
    low, high = float(longitudinal.min()), float(longitudinal.max())
    span = high - low
    if span < 40:
        raise ValueError("The detected foot outline is not long enough.")
    toe = contour[int(np.argmax(longitudinal))]
    heel = contour[int(np.argmin(longitudinal))]
    best = None
    for fraction in np.arange(0.25, 0.71, 0.015):
        band = np.abs(longitudinal - (low + span * float(fraction))) <= span * 0.018
        if int(band.sum()) < 5:
            continue
        selected, values = contour[band], lateral_values[band]
        width = float(values.max() - values.min())
        if best is None or width > best[0]:
            best = (width, selected[int(np.argmin(values))], selected[int(np.argmax(values))])
    if best is None or best[0] < 20:
        raise ValueError("The widest part of the foot could not be identified.")
    height, width = mask.shape[:2]
    def norm(point):
        return {"x": float(np.clip(point[0] / width, 0, 1)),
                "y": float(np.clip(point[1] / height, 0, 1))}
    side_a, side_b = best[1], best[2]
    left_point, right_point = (side_a, side_b) if side_a[0] <= side_b[0] else (side_b, side_a)
    return {"toe": norm(toe), "heel": norm(heel),
            "right_width": norm(right_point), "left_width": norm(left_point)}

@app.post("/predict")
async def predict(image: UploadFile = File(...)):
    if model is None:
        raise HTTPException(status_code=503, detail="The Vijayasri foot model has not been trained and installed yet.")
    if image.content_type not in {"image/jpeg", "image/png", "image/webp"}:
        raise HTTPException(status_code=415, detail="Upload a JPG, PNG or WebP foot photo.")
    raw = await image.read(MAX_IMAGE_BYTES + 1)
    if len(raw) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="Image is too large. Maximum size is 10 MB.")
    if not raw:
        raise HTTPException(status_code=400, detail="The uploaded image is empty.")
    try:
        original = Image.open(io.BytesIO(raw)).convert("RGB")
    except (UnidentifiedImageError, OSError):
        raise HTTPException(status_code=400, detail="The uploaded file is not a valid image.")
    original_width, original_height = original.size
    if min(original.size) < 240 or max(original.size) > 6000:
        raise HTTPException(status_code=400, detail="Use a clear photo between 240 and 6000 pixels.")
    prepared, (left, top, resized_width, resized_height) = _letterbox(original)
    array = np.asarray(prepared, dtype=np.float32) / 255.0
    tensor = torch.from_numpy(array).permute(2, 0, 1)
    mean = torch.tensor([0.485, 0.456, 0.406]).view(3, 1, 1)
    std = torch.tensor([0.229, 0.224, 0.225]).view(3, 1, 1)
    tensor = ((tensor - mean) / std).unsqueeze(0).to(DEVICE)
    with torch.inference_mode():
        output = model(tensor)
        if isinstance(output, dict):
            output = output.get("out")
        if isinstance(output, (tuple, list)):
            output = output[0]
        probabilities = torch.softmax(output, dim=1)[0, 1]
        probabilities = F.interpolate(probabilities[None, None], size=(512, 512),
                                      mode="bilinear", align_corners=False)[0, 0].cpu().numpy()
    crop = probabilities[top:top + resized_height, left:left + resized_width]
    probability_original = cv2.resize(crop, (original_width, original_height), interpolation=cv2.INTER_LINEAR)
    mask = (probability_original >= 0.5).astype(np.uint8)
    area_ratio = float(mask.mean())
    if area_ratio < 0.015 or area_ratio > 0.72:
        raise HTTPException(status_code=422, detail="The foot outline was unclear. Retake the photo with the full foot visible.")
    confidence = float(probability_original[mask > 0].mean()) if mask.any() else 0.0
    try:
        suggested_points = _suggest_landmarks(mask)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error))
    rgba = np.zeros((original_height, original_width, 4), dtype=np.uint8)
    rgba[mask > 0] = (117, 220, 77, 105)
    ok, encoded = cv2.imencode(".png", cv2.cvtColor(rgba, cv2.COLOR_RGBA2BGRA))
    if not ok:
        raise HTTPException(status_code=500, detail="Could not prepare the AI overlay.")
    # No uploaded photo or derived mask is written to disk or retained by this request.
    return {"model": "vijayasri-foot-segmentation", "model_version": "0.1.0",
            "confidence": round(confidence, 4), "suggested_points": suggested_points,
            "mask_png_base64": base64.b64encode(encoded.tobytes()).decode("ascii"),
            "image_dimensions": {"width": original_width, "height": original_height},
            "notice": "AI suggestions are provisional. Customer confirmation and A4 calibration are required."}
