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

const PREDICT_INTERVAL_MS = 150; // how often we ask the backend for a letter
const STABILITY_HITS_NEEDED = 2; // consecutive matching predictions before we "commit" a letter
const CONFIDENCE_THRESHOLD = 0.45; // live webcam frames score lower than the dataset photos the model trained on -- STABILITY_HITS_NEEDED is what filters noise, not this
const AUTO_BUILD_IDLE_MS = 2200; // no hand seen for this long (with letters queued) -> auto-build the sentence

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
const stopBtn = document.getElementById("stopBtn");
const statusMsg = document.getElementById("statusMsg");
const subtitleEl = document.getElementById("subtitle");
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
let handLandmarkerDelegate = "GPU";
let words = [];
let lastPredictedLabel = null;
let stableCount = 0;
let lastPredictTime = 0;
let predictInFlight = false;
let currentSentence = "";
let mediaStream = null;
let isRunning = false;
let animationId = null;
let consecutiveFrameErrors = 0;
let lastHandSeenAt = 0;
let streakCommitted = false; // has the CURRENT continuous same-letter streak already been committed?
let autoBuildTriggered = false; // has this hand-absence episode already auto-built a sentence?
let voiceCache = [];

function setStatus(text, isError = false) {
  statusMsg.textContent = text;
  statusMsg.classList.toggle("error", isError);
}

// ---------------------------------------------------------------------------
// MediaPipe setup
// ---------------------------------------------------------------------------

async function initHandLandmarker(delegate = "GPU") {
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
  );
  handLandmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: HAND_LANDMARKER_MODEL_URL, delegate },
    runningMode: "VIDEO",
    numHands: 1,
    // Lower than the MediaPipe default (0.5) -- a live webcam hand at an
    // awkward angle or partially out of frame should still get picked up;
    // STABILITY_HITS_NEEDED is what filters out noise, not this.
    minHandDetectionConfidence: 0.4,
  });
  handLandmarkerDelegate = delegate;
}

// If the GPU delegate's WebGL context misbehaves on a given device/driver,
// detectForVideo() can throw every frame -- silently freezing hand tracking
// forever, since a throw inside detectLoop would otherwise stop the
// requestAnimationFrame chain from ever rescheduling itself. Re-creating the
// landmarker on the CPU delegate once is a cheap, automatic recovery.
async function fallBackToCpuDelegate() {
  console.warn("Hand tracking kept failing on the GPU delegate -- retrying on CPU.");
  try {
    await initHandLandmarker("CPU");
  } catch (err) {
    console.error("CPU delegate fallback also failed:", err);
  }
}

// ---------------------------------------------------------------------------
// Camera + detection loop
// ---------------------------------------------------------------------------

async function startCamera() {
  startBtn.disabled = true;
  setStatus("Requesting camera access…");

  // Fire the getUserMedia call (which is what triggers the browser's
  // permission dialog) immediately, in parallel with the hand-tracking
  // model download -- previously this awaited the ~1-3s model load first,
  // so the permission prompt didn't even appear until that finished.
  const cameraPromise = navigator.mediaDevices.getUserMedia({
    video: { width: 640, height: 480, facingMode: "user" },
  });

  try {
    if (!handLandmarker) {
      setStatus("Requesting camera access… (loading hand-tracking model too)");
      await initHandLandmarker();
    }
  } catch (err) {
    console.error(err);
    setStatus("Couldn't load the hand-tracking model. Check your connection and reload.", true);
    startBtn.disabled = false;
    cameraPromise.then((s) => s.getTracks().forEach((t) => t.stop())).catch(() => {});
    return;
  }

  let stream;
  try {
    stream = await cameraPromise;
  } catch (err) {
    console.error(err);
    setStatus("Camera access denied. Allow camera permission and try again.", true);
    startBtn.disabled = false;
    return;
  }

  mediaStream = stream;
  video.srcObject = stream;
  await video.play();

  overlay.width = video.videoWidth || 640;
  overlay.height = video.videoHeight || 480;

  cameraOverlayMsg.classList.add("hidden");
  stopBtn.classList.remove("hidden");
  isRunning = true;
  consecutiveFrameErrors = 0;
  lastHandSeenAt = performance.now();
  autoBuildTriggered = false;
  warmUpBackend();
  animationId = requestAnimationFrame(detectLoop);
}

function stopCamera() {
  isRunning = false;
  if (animationId !== null) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
  if (mediaStream) {
    mediaStream.getTracks().forEach((track) => track.stop());
    mediaStream = null;
  }
  video.srcObject = null;
  overlayCtx.clearRect(0, 0, overlay.width, overlay.height);
  subtitleEl.classList.add("hidden");
  subtitleEl.textContent = "";
  currentLetterEl.textContent = "—";
  currentConfidenceEl.textContent = "0%";
  stableCount = 0;
  lastPredictedLabel = null;
  streakCommitted = false;
  autoBuildTriggered = false;
  setStatus("");
  cameraOverlayMsg.classList.remove("hidden");
  stopBtn.classList.add("hidden");
  startBtn.disabled = false;
}

let lastVideoTime = -1;

function detectLoop() {
  if (!isRunning) return;

  if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;
    try {
      const result = handLandmarker.detectForVideo(video, performance.now());
      consecutiveFrameErrors = 0;
      drawLandmarks(result);
      maybePredict(result);

      if (result.landmarks && result.landmarks.length > 0) {
        lastHandSeenAt = performance.now();
        autoBuildTriggered = false; // hand's back -- allow one more auto-build next time it goes away
      } else if (performance.now() - lastHandSeenAt > 5000 && !statusMsg.classList.contains("error")) {
        setStatus("Can't see a hand — move closer and make sure it's well lit.");
      }
    } catch (err) {
      // A single bad frame must never kill the loop below -- that's what
      // used to make tracking silently stop working forever after one
      // WebGL/decoder hiccup. Log it, keep going, and self-heal if it's
      // the GPU delegate that's the problem.
      consecutiveFrameErrors += 1;
      console.error("Hand-tracking frame error:", err);
      if (consecutiveFrameErrors === 1) {
        setStatus("Hand tracking hit a snag, recovering…", true);
      }
      if (consecutiveFrameErrors === 15 && handLandmarkerDelegate === "GPU") {
        fallBackToCpuDelegate();
      }
    }
  }

  // Checked every animation frame (not just on new video frames) so it
  // fires as soon as the idle window elapses, not on the next camera frame.
  if (
    words.length > 0 &&
    !autoBuildTriggered &&
    !buildBtn.disabled &&
    performance.now() - lastHandSeenAt > AUTO_BUILD_IDLE_MS
  ) {
    autoBuildTriggered = true;
    buildSentence();
  }

  animationId = requestAnimationFrame(detectLoop);
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
  // Render's free tier spins down after inactivity, and the model itself is
  // lazy-loaded on first use -- fire both off early so that cost lands while
  // the user is still getting their hand positioned, not on their first real
  // sign (which is what made the very first letter feel slow before).
  try {
    await fetch(`${API_BASE_URL}/health`);
  } catch {
    // ignore -- the real calls below will surface a proper error state
  }
  try {
    await fetch(`${API_BASE_URL}/predict-vector`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vector: new Array(42).fill(0) }),
    });
  } catch {
    // ignore -- same as above
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
    streakCommitted = false; // hand's gone -- the next sign, even a repeat, is a fresh streak
    updateSubtitle(null);
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

function updateSubtitle(label) {
  if (!label) {
    subtitleEl.classList.add("hidden");
    return;
  }
  subtitleEl.textContent = label;
  subtitleEl.classList.remove("hidden");
}

function handlePrediction({ label, confidence }) {
  if (statusMsg.classList.contains("error")) setStatus("");

  if (!label || confidence < CONFIDENCE_THRESHOLD) {
    currentLetterEl.textContent = label ? label : "—";
    currentConfidenceEl.textContent = `${Math.round((confidence || 0) * 100)}%`;
    stableCount = 0;
    lastPredictedLabel = null;
    streakCommitted = false; // confidence dropped -- the next confident read is a fresh streak
    updateSubtitle(null);
    return;
  }

  currentLetterEl.textContent = label;
  currentConfidenceEl.textContent = `${Math.round(confidence * 100)}%`;
  updateSubtitle(label);

  if (label === lastPredictedLabel) {
    stableCount += 1;
  } else {
    lastPredictedLabel = label;
    stableCount = 1;
    streakCommitted = false; // new letter streak -- e.g. the second "L" in "HELLO" after the "E"
  }

  // Gate on "has THIS streak already been committed", not "is this the same
  // letter as last time" -- the old check blocked committing the same
  // letter twice in a row *ever*, which made double letters (the two L's in
  // "HELLO", the two O's in "BALLOON") impossible to type: the first L
  // committed, and the second L's streak was silently dropped forever
  // because it matched the word list's last entry. A streak breaks (and
  // re-arms) whenever the hand drops out or confidence dips, which happens
  // naturally between two signs of the same letter.
  if (stableCount === STABILITY_HITS_NEEDED && !streakCommitted) {
    commitLetter(label);
    streakCommitted = true;
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

    // A built sentence has "consumed" these letters -- leave them in the
    // buffer and every subsequent sign (after any pause, auto-build or not)
    // just keeps appending to the same pile, so the next sentence is built
    // from an ever-growing mix of old and new letters instead of just the
    // new ones. Reset the trail so the next sign starts a fresh word/sentence,
    // exactly like clicking "Clear" would, but automatic.
    words = [];
    lastPredictedLabel = null;
    stableCount = 0;
    streakCommitted = false;
    renderWordTrail();
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
  streakCommitted = false;
  autoBuildTriggered = false;
  currentSentence = "";
  renderWordTrail();
  sentenceOut.textContent = 'Sign a few letters, then hit "Build Sentence."';
  buildBtn.disabled = true;
  speakBtn.disabled = true;
}

// ---------------------------------------------------------------------------
// Voice output
// ---------------------------------------------------------------------------

const FEMALE_VOICE_HINTS = [
  "female", "zira", "samantha", "susan", "karen", "victoria", "moira",
  "tessa", "fiona", "hazel", "aria", "jenny", "libby", "google us english",
  "google uk english female", "microsoft zira", "microsoft aria",
];

function loadVoices() {
  voiceCache = window.speechSynthesis.getVoices();
}
loadVoices();
if ("speechSynthesis" in window) {
  window.speechSynthesis.onvoiceschanged = loadVoices; // Chrome loads voices async
}

function pickSweetVoice() {
  const voices = voiceCache.length ? voiceCache : window.speechSynthesis.getVoices();
  const english = voices.filter((v) => v.lang && v.lang.toLowerCase().startsWith("en"));
  const pool = english.length ? english : voices;
  const match = pool.find((v) =>
    FEMALE_VOICE_HINTS.some((hint) => v.name.toLowerCase().includes(hint))
  );
  return match || pool[0] || null;
}

function speakSentence() {
  if (!currentSentence) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(currentSentence);
  const voice = pickSweetVoice();
  if (voice) utterance.voice = voice;
  utterance.pitch = 1.15; // warmer, sweeter tone
  utterance.rate = 0.95; // slightly relaxed, gentle pace
  window.speechSynthesis.speak(utterance);
}

// ---------------------------------------------------------------------------
// Wire up
// ---------------------------------------------------------------------------

startBtn.addEventListener("click", startCamera);
stopBtn.addEventListener("click", stopCamera);
buildBtn.addEventListener("click", buildSentence);
clearBtn.addEventListener("click", clearAll);
speakBtn.addEventListener("click", speakSentence);
