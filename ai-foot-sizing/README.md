# Vijayasri AI Foot Sizing — Hybrid prototype

An independent, first-party foot segmentation and landmark suggestion pipeline for Vijayasri Footwear. This is not Onefit code, a Onefit integration, or a trained production model.

## Model strategy: transfer learning

We will start from the public Torchvision DeepLabV3-ResNet50 pretrained computer-vision backbone, replace its final classifier with a two-class foot/background head, and fine-tune the network using our own consented and annotated Vijayasri images. This is faster and more practical than training the entire vision model from random initialization with a small retail dataset.

The pretrained weights are a starting point only. The fine-tuned checkpoint and deployed model are specific to this project's foot-silhouette task. No Onefit service or code is used.

## Current scope

1. Fine-tune a foot-silhouette segmentation model using consented, annotated Vijayasri dataset images.
2. Serve the trained TorchScript model through a small FastAPI inference service.
3. Derive provisional toe, heel and widest-side landmark suggestions from the segmented outline.
4. Let the customer review and correct every suggested landmark in the existing camera UI.
5. Keep the A4 calibration points and existing manual six-point fallback.

The website sends a captured image to the AI service only when FOOT_AI_API_URL is explicitly configured in config.js. With the default empty value, the current manual workflow remains available and no image is sent to an AI endpoint.

## Important: model weights are not included

This repository contains the training and inference pipeline, not a trained Vijayasri model. A suitable consented, annotated dataset is required before training. The API returns HTTP 503 until models/foot_segmentation.ts is installed. Do not describe the prototype as accurate or enable it for production sizing until independent tests pass.

## Start small — progressive dataset plan

We do not need to collect 200–500 images before starting. Begin with 20–30 distinct-foot images to verify annotation quality, training and inference. This is only a pipeline pilot. Expand to 50–75, then 100–150 images as we improve diversity and validate errors. Continue toward a few hundred diverse, consented images before making public sizing-accuracy claims. See DATASET.md for subject-level splitting and validation requirements.

## Prepare annotations offline

Open `annotate.html` in a modern browser on your own computer. It runs locally in the browser: select a foot photo, click around the visible foot outline, finish the polygon, and export a black-background/white-foot PNG mask. It does not upload or store the source image. Save each mask under the matching split's `masks/` folder with the exact same filename stem as its image. Review every outline carefully, especially the ankle boundary, heel and toes.

## Train

Python 3.11 is recommended.

    cd ai-foot-sizing
    python -m venv .venv
    source .venv/bin/activate
    pip install -r requirements.txt
    # Prepare dataset/train and dataset/val using DATASET.md
    python train.py --data dataset --epochs 35 --batch-size 4 --output models

The first run downloads the public Torchvision DeepLabV3-ResNet50 backbone weights. The training script replaces the final classifier for two classes (background and foot) and fine-tunes the model on the Vijayasri masks. The exported TorchScript model is models/foot_segmentation.ts.

## Run the API

    FOOT_MODEL_PATH=models/foot_segmentation.ts FOOT_ALLOWED_ORIGINS=https://YOUR-PRODUCTION-DOMAIN,https://YOUR-PREVIEW-DOMAIN uvicorn app:app --host 0.0.0.0 --port 8000

Health: GET /health

Inference: POST /predict with multipart field image containing JPG, PNG or WebP. The response includes a transparent mask overlay, provisional normalized landmark coordinates, model version and mask score.

## API and customer privacy

- The inference handler does not write uploaded photos or masks to disk.
- Configure an explicit CORS allowlist; do not use wildcard origins for a customer-facing deployment.
- Use HTTPS, request-size limits, authentication/rate limits at the hosting edge, and access-controlled model hosting.
- Configure FOOT_AI_API_URL only after deploying and testing the service.
- Customer images must not be retained or used for training without explicit consent.

## Measurement limits

A4 paper calibration still requires the customer to identify the sheet's 210 mm top edge. The current UI asks the customer to confirm/correct AI-proposed foot landmarks before calculating. The segmentation model does not independently guarantee physical scale, camera perspective correction, fit comfort, or a correct shoe-size recommendation.

The first milestone is a reviewable AI-assisted prototype. Before any production claim, validate against ruler/caliper measurements and actual shoe fit across held-out people, devices, lighting, sizes and foot shapes. See DATASET.md.
