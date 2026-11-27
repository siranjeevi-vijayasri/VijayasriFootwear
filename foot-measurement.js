(() => {
  const modal = document.getElementById("footMeasureModal");
  const openButton = document.getElementById("openFootMeasure");
  const closeButton = document.getElementById("closeFootMeasure");
  const startButton = document.getElementById("startFootCamera");
  const captureButton = document.getElementById("captureFootPhoto");
  const undoButton = document.getElementById("undoFootPoint");
  const retakeButton = document.getElementById("retakeFootPhoto");
  const shareButton = document.getElementById("shareFootMeasurements");
  const sizeCategorySelect = document.getElementById("footSizeCategory");
  const video = document.getElementById("footCameraVideo");
  const canvas = document.getElementById("footMeasureCanvas");
  const instruction = document.getElementById("footMeasureInstruction");
  const errorBox = document.getElementById("footMeasureError");
  const introStage = document.getElementById("footMeasureIntro");
  const cameraStage = document.getElementById("footCameraStage");
  const photoStage = document.getElementById("footPhotoStage");
  const resultStage = document.getElementById("footResultStage");
  const resultCards = document.getElementById("footMeasurementResults");
  const cameraHelp = document.getElementById("footCameraHelp");
  const aiStatus = document.getElementById("footAiStatus");
  const aiReviewControls = document.getElementById("footAiReviewControls");
  const aiPointSelect = document.getElementById("footAiPointSelect");
  const applyAiPointsButton = document.getElementById("applyFootAiPoints");
  const switchManualButton = document.getElementById("switchFootManual");
  const aiApiUrl = String((window.VJS_CONFIG || {}).FOOT_AI_API_URL || "").trim();

  if (!modal || !openButton || !video || !canvas) return;

  // First test: one foot, length only. A4 short edge = 210 mm.
  const pointsForMeasurement = [
    "Tap the LEFT end of the A4 sheet's top short edge (21 cm).",
    "Tap the RIGHT end of the same short edge.",
    "Tap the tip of your longest toe.",
    "Tap the back of your heel."
  ];

  let stream = null;
  let photo = null;
  let points = [];
  let measurement = null;
  let aiMaskImage = null;
  let aiSuggestions = null;
  let aiReviewMode = false;
  let aiSelectedPoint = 2;

  // ISO 19407:2023 simplified UK grading. India traditionally uses the English/UK scale.
  // Children's sizes use their separate conversion table; adult sizes use the adult formula.
  const childrenSizeRows = [
    [120, 3.5], [123, 4], [127, 4.5], [130, 5], [133, 5.5],
    [138, 6], [142, 6.5], [146, 7], [150, 7.5], [154, 8],
    [157, 8.5], [160, 9], [166, 9.5], [169, 10], [173, 10.5],
    [176, 11], [179, 11.5], [185, 12], [188, 12.5], [192, 13],
    [195, 13.5], [200, 1], [204, 1.5], [210, 2], [213, 2.5],
    [217, 3], [220, 3.5], [226, 4], [230, 4.5], [236, 5]
  ];

  function formatSize(value) {
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
  }

  function estimateUkIndiaSize(lengthCm, category) {
    const lengthMm = lengthCm * 10;
    if (category === "adult") {
      if (lengthMm < 211.7 || lengthMm > 321.8) return null;
      const rawUkSize = ((lengthMm + (2 * 8.47)) / 8.47) - 25;
      return { value: Math.round(rawUkSize * 2) / 2, group: "Adult" };
    }

    if (category === "children") {
      if (lengthMm < childrenSizeRows[0][0] || lengthMm > childrenSizeRows[childrenSizeRows.length - 1][0]) return null;
      const closest = childrenSizeRows.reduce((best, row) =>
        Math.abs(row[0] - lengthMm) < Math.abs(best[0] - lengthMm) ? row : best
      , childrenSizeRows[0]);
      return { value: closest[1], group: "Children's" };
    }

    return null;
  }

  const distance = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);

  function setAiStatus(message, state = "idle") {
    if (!aiStatus) return;
    aiStatus.textContent = message;
    aiStatus.dataset.state = state;
  }

  async function runAiAssist() {
    if (!aiApiUrl || !photo) return;
    setAiStatus("Analysing the foot outline and suggesting measurement points…", "loading");
    try {
      const blob = await new Promise(resolve => photo.toBlob(resolve, "image/jpeg", 0.88));
      if (!blob) throw new Error("Could not prepare the captured image.");
      const form = new FormData();
      form.append("image", blob, "foot-capture.jpg");
      const response = await fetch(aiApiUrl.replace(/\/$/, "") + "/predict", { method: "POST", body: form });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || data.error || "AI measurement service is unavailable.");
      if (!data.suggested_points || !data.mask_png_base64) throw new Error("The AI service returned an incomplete result.");
      aiSuggestions = data.suggested_points;
      aiMaskImage = new Image();
      aiMaskImage.onload = () => {
        drawPhoto();
        setAiStatus("AI has suggested the toe, heel and widest-foot points. Tap the two A4 corners, then review and correct the suggestions.", "ready");
        if (points.length === 2) prepareAiReview();
      };
      aiMaskImage.onerror = () => {
        aiMaskImage = null;
        setAiStatus("AI points were returned, but the visual overlay could not be loaded. Continue manually.", "error");
      };
      aiMaskImage.src = "data:image/png;base64," + data.mask_png_base64;
    } catch (error) {
      aiSuggestions = null;
      aiMaskImage = null;
      setAiStatus((error && error.message ? error.message : "AI analysis failed.") + " You can continue with manual point marking.", "error");
    }
  }

  function normalizedPoint(value) {
    if (!value || !Number.isFinite(value.x) || !Number.isFinite(value.y)) return null;
    return { x: Math.max(0, Math.min(1, value.x)) * photo.width, y: Math.max(0, Math.min(1, value.y)) * photo.height };
  }

  function prepareAiReview() {
    if (!aiSuggestions || points.length !== 2 || !photo) return;
    const toe = normalizedPoint(aiSuggestions.toe);
    const heel = normalizedPoint(aiSuggestions.heel);
    const right = normalizedPoint(aiSuggestions.right_width);
    const left = normalizedPoint(aiSuggestions.left_width);
    if (![toe, heel, right, left].every(Boolean)) {
      setAiStatus("AI could not locate every foot landmark confidently. Please mark all six points manually.", "error");
      aiSuggestions = null;
      return;
    }
    points = [points[0], points[1], toe, heel, right, left];
    aiReviewMode = true;
    aiSelectedPoint = 2;
    if (aiPointSelect) aiPointSelect.value = "2";
    aiReviewControls.hidden = false;
    instruction.textContent = "Review the AI suggestions. Select a numbered point below and tap its correct location if it needs adjustment.";
    drawPhoto();
  }

  function applyAiReview() {
    if (!aiReviewMode || points.length !== 6) return;
    aiReviewControls.hidden = true;
    aiReviewMode = false;
    instruction.textContent = "Calculating your measurement from the confirmed points…";
    finishMeasurement();
  }

  function switchToManualMarking() {
    aiReviewControls.hidden = true;
    aiReviewMode = false;
    aiSuggestions = null;
    aiMaskImage = null;
    points = points.slice(0, 2);
    drawPhoto();
    instruction.textContent = pointsForMeasurement[2];
    setAiStatus("Manual point marking selected. Tap points 3 to 6 on your foot.", "idle");
  }

  function showError(message) {
    if (!errorBox) return;
    errorBox.textContent = message;
    errorBox.hidden = !message;
  }

  function stopCamera() {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      stream = null;
    }
    video.pause();
    video.srcObject = null;
  }

  function showStage(stage) {
    introStage.hidden = stage !== "intro";
    cameraStage.hidden = stage !== "camera";
    photoStage.hidden = stage !== "photo";
    resultStage.hidden = stage !== "result";
  }

  function openModal() {
    measurement = null;
    points = [];
    photo = null;
    resultCards.innerHTML = "";
    aiMaskImage = null;
    aiSuggestions = null;
    aiReviewMode = false;
    aiReviewControls.hidden = true;
    setAiStatus(aiApiUrl ? "AI assistant will analyse this photo when captured." : "AI assistance is not connected yet. You can continue with manual point marking.", "idle");
    shareButton.textContent = "Share measurement on WhatsApp";
    showError("");
    showStage("intro");
    modal.hidden = false;
    document.body.classList.add("foot-measure-open");
  }

  function closeModal() {
    stopCamera();
    modal.hidden = true;
    document.body.classList.remove("foot-measure-open");
  }

  async function startCamera() {
    showError("");
    if (!sizeCategorySelect || !sizeCategorySelect.value) {
      showError("Please choose Adult or Children’s footwear size chart before opening the camera.");
      sizeCategorySelect?.focus();
      return;
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showError("Camera access is not available here. Open the website over HTTPS and allow camera permission, or use a ruler and contact the shop.");
      return;
    }
    try {
      stopCamera();
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 }, aspectRatio: { ideal: 16 / 9 } }
      });
      video.srcObject = stream;
      await video.play();
      showStage("camera");
      cameraHelp.textContent = "Landscape mode only. Place the A4 sheet flat in portrait orientation and one foot beside it, parallel to the long edge. Keep the complete sheet and foot visible in the uncropped camera frame. Tap the two ends of the 21 cm short edge to calibrate.";
    } catch (error) {
      const reason = error && error.name === "NotAllowedError"
        ? "Camera permission was denied. Allow camera access in your browser settings and try again."
        : "The camera could not be started. Check camera permission and make sure no other app is using it.";
      showError(reason);
      showStage("intro");
    }
  }

  function drawPhoto() {
    const context = canvas.getContext("2d");
    if (!context || !photo) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(photo, 0, 0);
    if (aiMaskImage && aiMaskImage.complete && aiMaskImage.naturalWidth) {
      context.save();
      context.globalAlpha = 0.42;
      context.drawImage(aiMaskImage, 0, 0, canvas.width, canvas.height);
      context.restore();
    }
    context.lineWidth = Math.max(3, canvas.width / 500);
    context.strokeStyle = "#d8f36a";
    context.fillStyle = "#4b1424";
    if (points.length >= 1) {
      points.forEach((point, index) => {
        context.beginPath();
        context.arc(point.x, point.y, Math.max(8, canvas.width / 100), 0, Math.PI * 2);
        context.fill();
        context.stroke();
        context.font = "bold " + Math.max(20, canvas.width / 35) + "px system-ui";
        context.fillStyle = "#fff";
        context.fillText(String(index + 1), point.x + canvas.width / 60, point.y - canvas.width / 60);
        context.fillStyle = "#4b1424";
      });
    }
    const drawLine = (a, b) => {
      context.beginPath();
      context.moveTo(a.x, a.y);
      context.lineTo(b.x, b.y);
      context.stroke();
    };
    if (points.length >= 4) drawLine(points[2], points[3]);
    if (points.length >= 6) drawLine(points[4], points[5]);
    if (aiReviewMode && points.length === 6) {
      const selected = points[aiSelectedPoint];
      context.beginPath();
      context.arc(selected.x, selected.y, Math.max(17, canvas.width / 48), 0, Math.PI * 2);
      context.strokeStyle = "#ffb000";
      context.lineWidth = Math.max(5, canvas.width / 260);
      context.stroke();
    }
  }

  function capturePhoto() {
    showError("");
    if (!video.videoWidth || !video.videoHeight) {
      showError("The camera is still starting. Please try again in a moment.");
      return;
    }
    photo = document.createElement("canvas");
    photo.width = video.videoWidth;
    photo.height = video.videoHeight;
    const context = photo.getContext("2d");
    if (!context) {
      showError("This browser could not prepare the photo. Please try another browser.");
      return;
    }
    context.drawImage(video, 0, 0, photo.width, photo.height);
    canvas.width = photo.width;
    canvas.height = photo.height;
    points = [];
    drawPhoto();
    stopCamera();
    showStage("photo");
    instruction.textContent = pointsForMeasurement[0];
    setAiStatus(aiApiUrl ? "AI analysis is running in the background…" : "AI assistance is not connected yet. Continue with the manual six-point method.", aiApiUrl ? "loading" : "idle");
    runAiAssist();
  }

  function finishMeasurement() {
    const paperEdgePixels = distance(points[0], points[1]);
    if (!paperEdgePixels || paperEdgePixels < 40 || points.length < 4) {
      showError("The A4 edge or foot points were unclear. Retake with the full sheet and one foot visible.");
      points = [];
      drawPhoto();
      instruction.textContent = pointsForMeasurement[0];
      return;
    }
    const mmPerPixel = 210 / paperEdgePixels;
    const lengthCm = distance(points[2], points[3]) * mmPerPixel / 10;
    if (lengthCm < 8 || lengthCm > 33) {
      showError("The measured foot length looks unusual. Check the A4 edge, toe and heel points, then try again.");
      points = [];
      drawPhoto();
      instruction.textContent = pointsForMeasurement[0];
      return;
    }
    measurement = {
      length: Math.round(lengthCm * 10) / 10,
      width: null,
      category: sizeCategorySelect.value,
      size: estimateUkIndiaSize(lengthCm, sizeCategorySelect.value)
    };
    renderResult();
    showStage("result");
  }

  function renderResult() {
    const sizeCard = measurement.size
      ? '<article class="foot-measure-result-card foot-size-highlight"><span>Estimated UK / India size · ' +
        measurement.size.group + '</span><strong>' + formatSize(measurement.size.value) +
        '</strong><small>Approximate starting size</small></article>'
      : '<article class="foot-measure-result-card foot-size-highlight"><span>UK / India size</span><strong>Ask our team</strong><small>This measurement is outside the selected size chart range.</small></article>';
    const measurementCard =
      '<article class="foot-measure-result-card"><span>Your foot measurement</span><strong>' +
      measurement.length.toFixed(1) + ' cm</strong><small>Single-foot length · width is not measured in this test</small></article>';
    resultCards.innerHTML = sizeCard + measurementCard;
    shareButton.textContent = "Share measurement on WhatsApp";
  }

  function shareMeasurement() {
    if (!measurement) return;
    const categoryLabel = measurement.category === "children" ? "Children's footwear" : "Adult footwear";
    const sizeLabel = measurement.size
      ? "Estimated UK / India size: " + formatSize(measurement.size.value) + " (approx.)"
      : "UK / India size: Please advise";
    const message = "Hello Vijayasri Footwear. I measured one foot using the website camera tool:\n" +
      "Category: " + categoryLabel + "\n" +
      sizeLabel + "\n" +
      "Foot length: " + measurement.length.toFixed(1) + " cm" +
      "\nPlease confirm the suitable size for the footwear style I am interested in.";
    window.open("https://wa.me/" + "918300029513" + "?text=" + encodeURIComponent(message), "_blank", "noopener");
  }

  openButton.addEventListener("click", openModal);
  closeButton?.addEventListener("click", closeModal);
  modal.addEventListener("click", event => {
    if (event.target === modal) closeModal();
  });
  startButton?.addEventListener("click", startCamera);
  captureButton?.addEventListener("click", capturePhoto);
  undoButton?.addEventListener("click", () => {
    if (aiReviewMode) {
      switchToManualMarking();
      return;
    }
    points.pop();
    drawPhoto();
    instruction.textContent = pointsForMeasurement[points.length] || "All points marked. Calculating measurement…";
    showError("");
  });
  aiPointSelect?.addEventListener("change", () => {
    aiSelectedPoint = Number(aiPointSelect.value);
    drawPhoto();
  });
  applyAiPointsButton?.addEventListener("click", applyAiReview);
  switchManualButton?.addEventListener("click", switchToManualMarking);
  retakeButton?.addEventListener("click", startCamera);
  shareButton?.addEventListener("click", shareMeasurement);
  canvas.addEventListener("pointerdown", event => {
    if (!photo || points.length >= pointsForMeasurement.length) return;
    const rect = canvas.getBoundingClientRect();
    const point = {
      x: (event.clientX - rect.left) * canvas.width / rect.width,
      y: (event.clientY - rect.top) * canvas.height / rect.height
    };
    if (aiReviewMode && points.length === 4) {
      const targetIndex = aiSelectedPoint === 0 ? 2 : aiSelectedPoint === 1 ? 3 : aiSelectedPoint;
      points[targetIndex] = point;
      drawPhoto();
      showError("");
      instruction.textContent = "The selected foot point has been adjusted. Review the other point or confirm.";
      return;
    }
    points.push(point);
    drawPhoto();
    showError("");
    if (points.length === 2 && aiSuggestions) {
      prepareAiReview();
    } else if (points.length < pointsForMeasurement.length) {
      instruction.textContent = pointsForMeasurement[points.length];
    } else {
      instruction.textContent = "Calculating your measurement…";
      finishMeasurement();
    }
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !modal.hidden) closeModal();
  });
})();
