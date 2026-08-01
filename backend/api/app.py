"""SignBridge backend API (FastAPI).

Implements the contract mobile/services/api.ts expects:
    POST /predict  {image_base64} -> {label, confidence}
    POST /sentence {words}        -> {sentence}

/predict runs synchronously here since it needs to feel instant while
someone holds up a sign. /sentence hands off to a Render Workflow task --
an LLM call with retries is exactly what Workflows is for -- and falls back
to running the same logic in-process if the workflow isn't configured (e.g.
local dev) or the trigger fails, so the endpoint never just breaks.

mediapipe + OpenCV + scikit-learn together need more RAM than Render's free
tier gives a web service, so importing them (and loading the model) is
deferred until the first /predict call instead of happening at module import
-- that at least lets the service boot and serve /health and /sentence
(which don't need any of that) instead of OOM-crashing before it can accept
a single request.
"""
import base64
import json
import os
import threading
from typing import List, Optional

import numpy as np
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from features import VECTOR_LENGTH
from sentence_builder import build_sentence

load_dotenv()

RENDER_API_KEY = os.getenv("RENDER_API_KEY")
RENDER_SENTENCE_TASK_SLUG = os.getenv(
    "RENDER_SENTENCE_TASK_SLUG", "signbridge-sentence-workflow/build_sentence"
)

_workflows_client = None
if RENDER_API_KEY:
    from render_sdk import Render

    _workflows_client = Render(token=RENDER_API_KEY).workflows

MODEL_PATH = os.path.join(os.path.dirname(__file__), "sign_model.pkl")
LABELS_PATH = os.path.join(os.path.dirname(__file__), "labels.json")

_model = None
_labels = None
_detector = None
_hl = None
_landmarks_to_vector = None
_load_lock = threading.Lock()

# The lightweight model-only path (used by /predict-vector) is kept separate
# from the full mediapipe+OpenCV path (used by /predict) because features.py
# has zero mediapipe dependency -- it's pure list/number math -- so a client
# that already has the 42-number feature vector (e.g. the website, which runs
# MediaPipe's WASM build in-browser) never needs mediapipe/OpenCV loaded on
# the server at all, which is what actually blew past Render's 512MB limit.
_vector_model = None
_vector_labels = None
_vector_load_lock = threading.Lock()


def _ensure_vector_model_loaded():
    global _vector_model, _vector_labels
    if _vector_model is not None:
        return

    with _vector_load_lock:
        if _vector_model is not None:
            return

        import joblib

        model = joblib.load(MODEL_PATH)
        with open(LABELS_PATH) as f:
            labels = json.load(f)

        _vector_labels = labels
        _vector_model = model


def _ensure_predict_deps_loaded():
    global _model, _labels, _detector, _hl, _landmarks_to_vector
    if _model is not None:
        return

    with _load_lock:
        if _model is not None:  # another thread finished loading while we waited
            return

        import joblib

        import hand_landmarker as hl
        from features import landmarks_to_vector

        model = joblib.load(MODEL_PATH)
        with open(LABELS_PATH) as f:
            labels = json.load(f)
        detector = hl.create_image_detector(max_hands=1, min_detection_confidence=0.5)

        _hl = hl
        _landmarks_to_vector = landmarks_to_vector
        _labels = labels
        _detector = detector
        _model = model  # set last: this is the readiness flag other threads check


app = FastAPI(title="SignBridge API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class PredictRequest(BaseModel):
    image_base64: str


class PredictResponse(BaseModel):
    label: Optional[str]
    confidence: float


class PredictVectorRequest(BaseModel):
    vector: List[float]


class SentenceRequest(BaseModel):
    words: List[str]


class SentenceResponse(BaseModel):
    sentence: str


@app.get("/health")
def health():
    return {"status": "ok", "predict_deps_loaded": _model is not None}


def _decode_image(image_base64: str) -> np.ndarray:
    import cv2

    if image_base64.strip().startswith("data:") and "," in image_base64:
        image_base64 = image_base64.split(",", 1)[1]
    try:
        raw = base64.b64decode(image_base64)
    except Exception:
        raise HTTPException(status_code=400, detail="image_base64 is not valid base64")

    arr = np.frombuffer(raw, dtype=np.uint8)
    bgr = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if bgr is None:
        raise HTTPException(status_code=400, detail="Could not decode image")
    return cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)


@app.post("/predict", response_model=PredictResponse)
def predict(req: PredictRequest):
    _ensure_predict_deps_loaded()
    rgb = _decode_image(req.image_base64)
    hand_landmarks_list, handedness_list = _hl.detect_in_image(_detector, rgb)

    if not hand_landmarks_list:
        return PredictResponse(label=None, confidence=0.0)

    vector = _landmarks_to_vector(hand_landmarks_list, handedness_list)
    proba = _model.predict_proba([vector])[0]
    best_idx = int(np.argmax(proba))
    return PredictResponse(label=str(_model.classes_[best_idx]), confidence=float(proba[best_idx]))


@app.post("/predict-vector", response_model=PredictResponse)
def predict_vector(req: PredictVectorRequest):
    """Same recognition as /predict, but takes an already-computed 42-number
    feature vector instead of an image -- meant for callers that already ran
    hand-landmark detection themselves (e.g. the website, using MediaPipe's
    in-browser WASM build). This never loads mediapipe/OpenCV server-side,
    so it stays well within Render's free-tier memory limit."""
    if len(req.vector) != VECTOR_LENGTH:
        raise HTTPException(
            status_code=400,
            detail=f"vector must have exactly {VECTOR_LENGTH} numbers, got {len(req.vector)}",
        )

    _ensure_vector_model_loaded()
    proba = _vector_model.predict_proba([req.vector])[0]
    best_idx = int(np.argmax(proba))
    confidence = float(proba[best_idx])
    if confidence < 0.5:
        return PredictResponse(label=None, confidence=confidence)
    return PredictResponse(label=str(_vector_model.classes_[best_idx]), confidence=confidence)


@app.post("/sentence", response_model=SentenceResponse)
def sentence(req: SentenceRequest):
    words = [w for w in req.words if w]
    if not words:
        return SentenceResponse(sentence="")

    if _workflows_client is not None:
        try:
            run = _workflows_client.run_task(RENDER_SENTENCE_TASK_SLUG, [words])
            if not run.error and run.results:
                return SentenceResponse(sentence=run.results[0])
        except Exception:
            pass  # Workflow unreachable/misconfigured -- fall back below rather than 500ing

    return SentenceResponse(sentence=build_sentence(words))


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", 8000)))
