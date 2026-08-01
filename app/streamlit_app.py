"""SignBridge live demo (Streamlit Community Cloud build).

Gradio's continuous webcam streaming doesn't map onto Streamlit directly, so
this uses streamlit-webrtc instead: video_frame_callback runs in its own
thread per incoming frame, independent of Streamlit's script reruns, so a
small thread-safe SessionState object is used to hand data back to the main
UI thread.

Run locally with:
    streamlit run app/streamlit_app.py

Deploy on https://share.streamlit.io by connecting this GitHub repo and
pointing it at this file.
"""
import json
import os
import sys
import threading
import time

import joblib
import numpy as np
import streamlit as st
import streamlit.components.v1 as components
from streamlit_webrtc import webrtc_streamer

sys.path.append(os.path.join(os.path.dirname(__file__), "..", "model"))
import hand_landmarker as hl  # noqa: E402
from features import landmarks_to_vector  # noqa: E402

from sentence_builder import build_sentence  # noqa: E402

MODEL_PATH = os.path.join(os.path.dirname(__file__), "..", "model", "sign_model.pkl")
LABELS_PATH = os.path.join(os.path.dirname(__file__), "..", "model", "labels.json")

STABILITY_FRAMES = 12
CONFIDENCE_THRESHOLD = 0.6


@st.cache_resource
def load_model():
    model = joblib.load(MODEL_PATH) if os.path.exists(MODEL_PATH) else None
    labels = json.load(open(LABELS_PATH)) if os.path.exists(LABELS_PATH) else None
    return model, labels


@st.cache_resource
def load_detector():
    return hl.create_video_detector(max_hands=1, min_detection_confidence=0.6)


class SharedState:
    """Written by the WebRTC callback thread, read by the main Streamlit thread."""

    def __init__(self):
        self.lock = threading.Lock()
        self.live_label = "..."
        self.words = []
        self.last_label = None
        self.stable_count = 0

    def clear(self):
        with self.lock:
            self.words = []
            self.last_label = None
            self.stable_count = 0
            self.live_label = "..."

    def snapshot_words(self):
        with self.lock:
            return list(self.words)


@st.cache_resource
def get_shared_state():
    return SharedState()


def make_video_frame_callback(model, labels, detector, state, stream_start):
    def _predict(vector):
        proba = model.predict_proba([vector])[0]
        best_idx = int(np.argmax(proba))
        return model.classes_[best_idx], float(proba[best_idx])

    def callback(frame):
        img = frame.to_ndarray(format="rgb24")
        timestamp_ms = int((time.time() - stream_start) * 1000)
        hand_landmarks_list, handedness_list = hl.detect_in_video_frame(detector, img, timestamp_ms)

        if hand_landmarks_list:
            hl.draw_landmarks(img, hand_landmarks_list)

            if model is not None:
                vector = landmarks_to_vector(hand_landmarks_list, handedness_list)
                label, confidence = _predict(vector)

                with state.lock:
                    if label and confidence >= CONFIDENCE_THRESHOLD:
                        state.live_label = f"{label} ({confidence:.0%})"
                        if label == state.last_label:
                            state.stable_count += 1
                        else:
                            state.last_label = label
                            state.stable_count = 1

                        already_last = state.words and state.words[-1] == label
                        if state.stable_count == STABILITY_FRAMES and not already_last:
                            state.words.append(label)
                    else:
                        state.last_label = None
                        state.stable_count = 0
        else:
            with state.lock:
                state.last_label = None
                state.stable_count = 0
                state.live_label = "..."

        import av

        return av.VideoFrame.from_ndarray(img, format="rgb24")

    return callback


def speak_js(sentence):
    safe = json.dumps(sentence)
    components.html(
        f"""
        <script>
          const utterance = new SpeechSynthesisUtterance({safe});
          window.speechSynthesis.cancel();
          window.speechSynthesis.speak(utterance);
        </script>
        """,
        height=0,
    )


def main():
    st.set_page_config(page_title="SignBridge", page_icon="🤟")
    st.title("🤟 SignBridge — live sign language translator")

    model, labels = load_model()
    if model is None:
        st.warning(
            "No trained model found. Run `extract_landmarks.py` then `model/train.py` "
            "locally, commit `model/sign_model.pkl` + `model/labels.json`, and redeploy."
        )

    detector = load_detector()
    state = get_shared_state()

    if "stream_start" not in st.session_state:
        st.session_state.stream_start = time.time()

    webrtc_streamer(
        key="signbridge",
        video_frame_callback=make_video_frame_callback(model, labels, detector, state, st.session_state.stream_start),
        media_stream_constraints={"video": True, "audio": False},
    )

    st.text_input("Currently seeing", value=state.live_label, disabled=True)

    words = state.snapshot_words()
    words_text = ", ".join(words)
    st.text_input("Recognized signs (in order)", value=words_text, disabled=True)

    col1, col2, col3 = st.columns(3)
    with col1:
        build_clicked = st.button("✍️ Build sentence", type="primary")
    with col2:
        speak_clicked = st.button("🔊 Speak it")
    with col3:
        if st.button("🗑️ Clear"):
            state.clear()
            st.rerun()

    if "sentence" not in st.session_state:
        st.session_state.sentence = ""

    if build_clicked:
        st.session_state.sentence = build_sentence(words)

    st.text_input("Sentence", value=st.session_state.sentence, disabled=True)

    if speak_clicked and st.session_state.sentence:
        speak_js(st.session_state.sentence)

    st.caption("Refresh the page or click a button to pull in the latest recognized signs — "
               "the camera callback runs in a background thread independent of this page's reruns.")


if __name__ == "__main__":
    main()
