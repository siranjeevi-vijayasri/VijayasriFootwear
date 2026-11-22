(() => {
  const modal = document.getElementById("footMeasureModal");
  const openButton = document.getElementById("openFootMeasure");
  const closeButton = document.getElementById("closeFootMeasure");
  const startButton = document.getElementById("startFootCamera");
  const captureButton = document.getElementById("captureFootPhoto");
  const undoButton = document.getElementById("undoFootPoint");
  const retakeButton = document.getElementById("retakeFootPhoto");
  const shareButton = document.getElementById("shareFootMeasurements");
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

  if (!modal || !openButton || !video || !canvas) return;

  const pointsForMeasurement = [
    "Tap the LEFT end of the A4 sheet's TOP short edge (the edge is 210 mm wide).",
    "Tap the RIGHT end of that same top edge.",
    "Tap the back of your heel.",
    "Tap the tip of your longest toe.",
    "Tap one side of your foot at its widest point.",
    "Tap the opposite side at the same widest point."
  ];

  let stream = null;
  let photo = null;
  let points = [];
  let measurement = null;

  const distance = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);

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
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showError("Camera access is not available here. Open the website over HTTPS and allow camera permission, or use a ruler and contact the shop.");
      return;
    }
    try {
      stopCamera();
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } }
      });
      video.srcObject = stream;
      await video.play();
      showStage("camera");
      cameraHelp.textContent = "Measure one foot. Keep the entire A4 sheet and your foot visible.";
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
  }

  function finishMeasurement() {
    const paperWidthPixels = distance(points[0], points[1]);
    if (!paperWidthPixels || paperWidthPixels < 60) {
      showError("The paper edge was too small or unclear. Retake the photo with the A4 sheet closer and fully visible.");
      points = [];
      drawPhoto();
      instruction.textContent = pointsForMeasurement[0];
      return;
    }
    const millimetresPerPixel = 210 / paperWidthPixels;
    const lengthCm = distance(points[2], points[3]) * millimetresPerPixel / 10;
    const widthCm = distance(points[4], points[5]) * millimetresPerPixel / 10;
    if (lengthCm < 8 || lengthCm > 33 || widthCm < 3 || widthCm > 16) {
      showError("The marked points produced an unusual measurement. Check the paper-edge and foot points, then try again.");
      points = [];
      drawPhoto();
      instruction.textContent = pointsForMeasurement[0];
      return;
    }
    measurement = {
      length: Math.round(lengthCm * 10) / 10,
      width: Math.round(widthCm * 10) / 10
    };
    renderResult();
    showStage("result");
  }

  function renderResult() {
    resultCards.innerHTML =
      '<article class="foot-measure-result-card"><span>Foot measurement</span><strong>' +
      measurement.length.toFixed(1) + ' cm</strong><small>Length · ' +
      measurement.width.toFixed(1) + ' cm wide</small></article>';
    shareButton.textContent = "Share measurement on WhatsApp";
  }

  function shareMeasurement() {
    if (!measurement) return;
    const message = "Hello Vijayasri Footwear. I measured one foot using the website camera tool:\n" +
      "Foot: " + measurement.length.toFixed(1) + " cm long, " +
      measurement.width.toFixed(1) + " cm wide" +
      "\nPlease help me choose the suitable size for the footwear style I am interested in.";
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
    points.pop();
    drawPhoto();
    instruction.textContent = pointsForMeasurement[points.length] || "All points marked. Calculating measurement…";
    showError("");
  });
  retakeButton?.addEventListener("click", startCamera);
  shareButton?.addEventListener("click", shareMeasurement);
  canvas.addEventListener("pointerdown", event => {
    if (!photo || points.length >= pointsForMeasurement.length) return;
    const rect = canvas.getBoundingClientRect();
    const point = {
      x: (event.clientX - rect.left) * canvas.width / rect.width,
      y: (event.clientY - rect.top) * canvas.height / rect.height
    };
    points.push(point);
    drawPhoto();
    showError("");
    if (points.length < pointsForMeasurement.length) {
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
