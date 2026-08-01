import {
  HandLandmarker,
  FilesetResolver,
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const API_BASE_URL = "https://signbridge-api-bruo.onrender.com";
const HAND_LANDMARKER_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task";

const PREDICT_INTERVAL_MS = 350; // how often we ask the backend for a letter
const STABILITY_HITS_NEEDED = 3; // consecutive matching predictions before we "commit" a letter
const CONFIDENCE_THRESHOLD = 0.6;

// Standard MediaPipe hand topology (21 landmarks) -- fixed, not exported by the JS package.
const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];

// ---------------------------------------------------------------------------
// DOM
// ---------------------------------------------------------------------------

const video = document.getElementById("video");
const overlay = document.getElementById("overlay");
const overlayCtx = overlay.getContext("2d");
const cameraOverlayMsg = document.getElementById("cameraOverlayMsg");
const startBtn = document.getElementById("startBtn");
const statusMsg = document.getElementById("statusMsg");
const currentLetterEl = document.getElementById("currentLetter");
const currentConfidenceEl = document.getElementById("currentConfidence");
const wordTrail = document.getElementById("wordTrail");
const buildBtn = document.getElementById("buildBtn");
const clearBtn = document.getElementById("clearBtn");
const sentenceOut = document.getElementById("sentenceOut");
const speakBtn = document.getElementById("speakBtn");

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let handLandmarker = null;
let words = [];
let lastPredictedLabel = null;
let stableCount = 0;
let lastPredictTime = 0;
let predictInFlight = false;
let currentSentence = "";

function setStatus(text, isError = false) {
  statusMsg.textContent = text;
  statusMsg.classList.toggle("error", isError);
}

// ---------------------------------------------------------------------------
// MediaPipe setup
// ---------------------------------------------------------------------------

async function initHandLandmarker() {
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
  );
  handLandmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: HAND_LANDMARKER_MODEL_URL, delegate: "GPU" },
    runningMode: "VIDEO",
    numHands: 1,
    minHandDetectionConfidence: 0.6,
  });
}

// ---------------------------------------------------------------------------
// Camera + detection loop
// ---------------------------------------------------------------------------

async function startCamera() {
  startBtn.disabled = true;
  setStatus("Loading hand-tracking model…");

  try {
    if (!handLandmarker) {
      await initHandLandmarker();
    }
  } catch (err) {
    console.error(err);
    setStatus("Couldn't load the hand-tracking model. Check your connection and reload.", true);
    startBtn.disabled = false;
    return;
  }

  setStatus("Requesting camera access…");
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480, facingMode: "user" },
    });
  } catch (err) {
    console.error(err);
    setStatus("Camera access denied. Allow camera permission and try again.", true);
    startBtn.disabled = false;
    return;
  }

  video.srcObject = stream;
  await video.play();

  overlay.width = video.videoWidth || 640;
  overlay.height = video.videoHeight || 480;

  cameraOverlayMsg.classList.add("hidden");
  warmUpBackend();
  requestAnimationFrame(detectLoop);
}

let lastVideoTime = -1;

function detectLoop() {
  if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;
    const result = handLandmarker.detectForVideo(video, performance.now());
    drawLandmarks(result);
    maybePredict(result);
  }
  requestAnimationFrame(detectLoop);
}

function drawLandmarks(result) {
  overlayCtx.clearRect(0, 0, overlay.width, overlay.height);
  if (!result.landmarks || result.landmarks.length === 0) return;

  const hand = result.landmarks[0];
  const w = overlay.width;
  const h = overlay.height;

  overlayCtx.strokeStyle = "rgba(45, 212, 191, 0.9)";
  overlayCtx.lineWidth = 3;
  for (const [a, b] of HAND_CONNECTIONS) {
    overlayCtx.beginPath();
    overlayCtx.moveTo(hand[a].x * w, hand[a].y * h);
    overlayCtx.lineTo(hand[b].x * w, hand[b].y * h);
    overlayCtx.stroke();
  }

  overlayCtx.fillStyle = "#ffffff";
  for (const point of hand) {
    overlayCtx.beginPath();
    overlayCtx.arc(point.x * w, point.y * h, 4, 0, 2 * Math.PI);
    overlayCtx.fill();
  }
}

// ---------------------------------------------------------------------------
// Feature vector (must exactly match backend/api/features.py's landmarks_to_vector)
// ---------------------------------------------------------------------------

function landmarksToVector(hand) {
  const vector = [];
  for (const point of hand) {
    vector.push(point.x, point.y);
  }
  return vector;
}

// ---------------------------------------------------------------------------
// Backend calls
// ---------------------------------------------------------------------------

async function warmUpBackend() {
  // Render's free tier spins down after inactivity; fire a health check early
  // so the ~30-50s cold start happens while the user is still getting their
  // hand positioned, not on their first real prediction.
  try {
    await fetch(`${API_BASE_URL}/health`);
  } catch {
    // ignore -- the real calls below will surface a proper error state
  }
}

function maybePredict(result) {
  const now = performance.now();
  if (predictInFlight || now - lastPredictTime < PREDICT_INTERVAL_MS) return;
  if (!result.landmarks || result.landmarks.length === 0) {
    currentLetterEl.textContent = "—";
    currentConfidenceEl.textContent = "0%";
    stableCount = 0;
    lastPredictedLabel = null;
    return;
  }

  lastPredictTime = now;
  predictInFlight = true;

  const vector = landmarksToVector(result.landmarks[0]);

  fetch(`${API_BASE_URL}/predict-vector`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ vector }),
  })
    .then((res) => {
      if (!res.ok) throw new Error(`predict-vector failed: ${res.status}`);
      return res.json();
    })
    .then((data) => handlePrediction(data))
    .catch((err) => {
      console.error(err);
      setStatus("Lost connection to the recognition server — retrying…", true);
    })
    .finally(() => {
      predictInFlight = false;
    });
}

function handlePrediction({ label, confidence }) {
  if (statusMsg.classList.contains("error")) setStatus("");

  if (!label || confidence < CONFIDENCE_THRESHOLD) {
    currentLetterEl.textContent = label ? label : "—";
    currentConfidenceEl.textContent = `${Math.round((confidence || 0) * 100)}%`;
    stableCount = 0;
    lastPredictedLabel = null;
    return;
  }

  currentLetterEl.textContent = label;
  currentConfidenceEl.textContent = `${Math.round(confidence * 100)}%`;

  if (label === lastPredictedLabel) {
    stableCount += 1;
  } else {
    lastPredictedLabel = label;
    stableCount = 1;
  }

  const alreadyLast = words.length > 0 && words[words.length - 1] === label;
  if (stableCount === STABILITY_HITS_NEEDED && !alreadyLast) {
    commitLetter(label);
  }
}

function commitLetter(label) {
  words.push(label);
  renderWordTrail();
  buildBtn.disabled = words.length === 0;
}

function renderWordTrail() {
  if (words.length === 0) {
    wordTrail.innerHTML = '<span class="placeholder">Letters you sign will appear here…</span>';
    return;
  }
  wordTrail.innerHTML = words
    .map((w) => `<span class="letter-chip">${w}</span>`)
    .join("");
}

async function buildSentence() {
  if (words.length === 0) return;
  buildBtn.disabled = true;
  buildBtn.textContent = "✍️ Building…";
  sentenceOut.textContent = "Thinking…";

  try {
    const res = await fetch(`${API_BASE_URL}/sentence`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ words }),
    });
    if (!res.ok) throw new Error(`sentence failed: ${res.status}`);
    const data = await res.json();
    currentSentence = data.sentence || "";
    sentenceOut.textContent = currentSentence || "(empty sentence)";
    speakBtn.disabled = !currentSentence;
  } catch (err) {
    console.error(err);
    sentenceOut.textContent = "Couldn't reach the sentence-building service. Try again in a moment.";
  } finally {
    buildBtn.disabled = words.length === 0;
    buildBtn.textContent = "✍️ Build Sentence";
  }
}

function clearAll() {
  words = [];
  lastPredictedLabel = null;
  stableCount = 0;
  currentSentence = "";
  renderWordTrail();
  sentenceOut.textContent = 'Sign a few letters, then hit "Build Sentence."';
  buildBtn.disabled = true;
  speakBtn.disabled = true;
}

function speakSentence() {
  if (!currentSentence) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(currentSentence);
  window.speechSynthesis.speak(utterance);
}

// ---------------------------------------------------------------------------
// Wire up
// ---------------------------------------------------------------------------

startBtn.addEventListener("click", startCamera);
buildBtn.addEventListener("click", buildSentence);
clearBtn.addEventListener("click", clearAll);
speakBtn.addEventListener("click", speakSentence);
