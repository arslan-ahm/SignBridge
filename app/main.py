"""SignBridge live demo: webcam -> recognized signs -> AI sentence -> speech.

Run with:
    python app/main.py

Then open the local URL Gradio prints. Requires a trained model at
model/saved/sign_model.pkl (run model/collect_landmarks.py then
model/train.py first).
"""
import json
import os
import sys
import time

import gradio as gr
import joblib
import numpy as np

sys.path.append(os.path.join(os.path.dirname(__file__), "..", "model"))
import hand_landmarker as hl  # noqa: E402
from features import landmarks_to_vector  # noqa: E402

from sentence_builder import build_sentence  # noqa: E402

MODEL_PATH = os.path.join(os.path.dirname(__file__), "..", "model", "saved", "sign_model.pkl")
LABELS_PATH = os.path.join(os.path.dirname(__file__), "..", "model", "saved", "labels.json")

STABILITY_FRAMES = 12  # ~0.4s at typical webcam stream rate — must hold a sign this long before it "counts"
CONFIDENCE_THRESHOLD = 0.6

_model = None
_labels = None
if os.path.exists(MODEL_PATH):
    _model = joblib.load(MODEL_PATH)
if os.path.exists(LABELS_PATH):
    with open(LABELS_PATH) as f:
        _labels = json.load(f)

_detector = hl.create_video_detector(max_hands=2, min_detection_confidence=0.6)
_stream_start = time.time()
_last_timestamp_ms = -1


def _next_timestamp_ms():
    global _last_timestamp_ms
    ts = int((time.time() - _stream_start) * 1000)
    if ts <= _last_timestamp_ms:
        ts = _last_timestamp_ms + 1  # VIDEO mode requires strictly increasing timestamps
    _last_timestamp_ms = ts
    return ts


def _predict(vector):
    if _model is None:
        return None, 0.0
    proba = _model.predict_proba([vector])[0]
    best_idx = int(np.argmax(proba))
    return _model.classes_[best_idx], float(proba[best_idx])


def process_frame(frame, state):
    if state is None:
        state = {"last_label": None, "stable_count": 0, "words": []}

    if frame is None:
        return frame, "", ", ".join(state["words"]), state

    # Gradio's webcam Image (type="numpy") already delivers RGB frames, which is
    # what the HandLandmarker expects — no color conversion needed here.
    hand_landmarks_list, handedness_list = hl.detect_in_video_frame(_detector, frame, _next_timestamp_ms())

    annotated = frame.copy()
    live_label = "..."

    if hand_landmarks_list:
        hl.draw_landmarks(annotated, hand_landmarks_list)

        if _model is not None:
            vector = landmarks_to_vector(hand_landmarks_list, handedness_list)
            label, confidence = _predict(vector)

            if label and confidence >= CONFIDENCE_THRESHOLD:
                live_label = f"{label} ({confidence:.0%})"
                if label == state["last_label"]:
                    state["stable_count"] += 1
                else:
                    state["last_label"] = label
                    state["stable_count"] = 1

                already_last_word = state["words"] and state["words"][-1] == label
                if state["stable_count"] == STABILITY_FRAMES and not already_last_word:
                    state["words"].append(label)
            else:
                state["last_label"] = None
                state["stable_count"] = 0
        else:
            live_label = "no trained model yet"
    else:
        state["last_label"] = None
        state["stable_count"] = 0

    return annotated, live_label, ", ".join(state["words"]), state


def clear_words(state):
    return {"last_label": None, "stable_count": 0, "words": []}, "", ""


def make_sentence(words_text):
    words = [w.strip() for w in words_text.split(",") if w.strip()]
    return build_sentence(words)


SPEAK_JS = """
(sentence) => {
    if (!sentence) return sentence;
    const utterance = new SpeechSynthesisUtterance(sentence);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    return sentence;
}
"""

with gr.Blocks(title="SignBridge") as demo:
    gr.Markdown("# 🤟 SignBridge — live sign language translator")
    if _model is None:
        gr.Markdown(
            "⚠️ **No trained model found.** Run `model/collect_landmarks.py` to record signs, "
            "then `model/train.py` to train, then restart this app."
        )

    state = gr.State({"last_label": None, "stable_count": 0, "words": []})

    with gr.Row():
        webcam = gr.Image(sources=["webcam"], streaming=True, type="numpy", label="Camera")
        annotated_out = gr.Image(label="Tracked hands")

    live_label_out = gr.Textbox(label="Currently seeing", interactive=False)
    words_out = gr.Textbox(label="Recognized signs (in order)", interactive=False)

    webcam.stream(
        fn=process_frame,
        inputs=[webcam, state],
        outputs=[annotated_out, live_label_out, words_out, state],
    )

    with gr.Row():
        build_btn = gr.Button("✍️ Build sentence", variant="primary")
        speak_btn = gr.Button("🔊 Speak it")
        clear_btn = gr.Button("🗑️ Clear")

    sentence_out = gr.Textbox(label="Sentence", interactive=False)

    build_btn.click(fn=make_sentence, inputs=[words_out], outputs=[sentence_out])
    speak_btn.click(fn=None, inputs=[sentence_out], outputs=[sentence_out], js=SPEAK_JS)
    clear_btn.click(fn=clear_words, inputs=[state], outputs=[state, words_out, sentence_out])


if __name__ == "__main__":
    # share=True needs Gradio's frpc tunnel binary, which can be slow/unreliable
    # to auto-download on some networks. Local URL works fine since the app
    # runs right on the machine with the webcam anyway; set SIGNBRIDGE_SHARE=1
    # to opt into a public tunnel link if you need to test from another device.
    demo.launch(share=os.getenv("SIGNBRIDGE_SHARE") == "1")
