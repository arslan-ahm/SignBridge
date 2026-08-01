"""SignBridge backend API (FastAPI).

Implements the contract mobile/services/api.ts expects:
    POST /predict  {image_base64} -> {label, confidence}
    POST /sentence {words}        -> {sentence}

/predict runs synchronously here since it needs to feel instant while
someone holds up a sign. /sentence hands off to a Render Workflow task --
an LLM call with retries is exactly what Workflows is for -- and falls back
to running the same logic in-process if the workflow isn't configured (e.g.
local dev) or the trigger fails, so the endpoint never just breaks.
"""
import base64
import json
import os
from typing import List, Optional

import cv2
import joblib
import numpy as np
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import hand_landmarker as hl
from features import landmarks_to_vector
from sentence_builder import build_sentence

load_dotenv()

RENDER_API_KEY = os.getenv("RENDER_API_KEY")
RENDER_SENTENCE_TASK_SLUG = os.getenv("RENDER_SENTENCE_TASK_SLUG", "build_sentence")

_workflows_client = None
if RENDER_API_KEY:
    from render_sdk import Render

    _workflows_client = Render(token=RENDER_API_KEY).workflows

MODEL_PATH = os.path.join(os.path.dirname(__file__), "sign_model.pkl")
LABELS_PATH = os.path.join(os.path.dirname(__file__), "labels.json")

_model = joblib.load(MODEL_PATH)
with open(LABELS_PATH) as f:
    _labels = json.load(f)

_detector = hl.create_image_detector(max_hands=1, min_detection_confidence=0.5)

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


class SentenceRequest(BaseModel):
    words: List[str]


class SentenceResponse(BaseModel):
    sentence: str


@app.get("/health")
def health():
    return {"status": "ok", "model_loaded": _model is not None, "classes": len(_labels)}


def _decode_image(image_base64: str) -> np.ndarray:
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
    rgb = _decode_image(req.image_base64)
    hand_landmarks_list, handedness_list = hl.detect_in_image(_detector, rgb)

    if not hand_landmarks_list:
        return PredictResponse(label=None, confidence=0.0)

    vector = landmarks_to_vector(hand_landmarks_list, handedness_list)
    proba = _model.predict_proba([vector])[0]
    best_idx = int(np.argmax(proba))
    return PredictResponse(label=str(_model.classes_[best_idx]), confidence=float(proba[best_idx]))


@app.post("/sentence", response_model=SentenceResponse)
def sentence(req: SentenceRequest):
    words = [w for w in req.words if w]
    if not words:
        return SentenceResponse(sentence="")

    if _workflows_client is not None:
        try:
            run = _workflows_client.run_task(RENDER_SENTENCE_TASK_SLUG, {"words": words})
            if not run.error and run.results:
                return SentenceResponse(sentence=run.results[0])
        except Exception:
            pass  # Workflow unreachable/misconfigured -- fall back below rather than 500ing

    return SentenceResponse(sentence=build_sentence(words))


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", 8000)))
