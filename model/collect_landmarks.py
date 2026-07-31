"""Record your own sign-language training data straight to landmarks.

Skips saving raw video: MediaPipe runs live while you sign, and only the
extracted hand-landmark vector is saved. That's steps 1 and 2 of the build
plan collapsed into one script, which matters when you only have a day
to build this.

Usage:
    python model/collect_landmarks.py

Controls (shown on screen too):
    type a label + ENTER   set the current sign label (e.g. "HELLO")
    SPACE                   capture one sample of the current hand pose
    c                       capture a 2-second burst (~30 samples) instead of one
    q                       quit and save
"""
import csv
import os
import time

import cv2

import hand_landmarker as hl
from features import feature_columns, landmarks_to_vector

DATA_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "landmarks", "dataset.csv")


def ensure_csv_header():
    os.makedirs(os.path.dirname(DATA_PATH), exist_ok=True)
    if not os.path.exists(DATA_PATH) or os.path.getsize(DATA_PATH) == 0:
        with open(DATA_PATH, "w", newline="") as f:
            csv.writer(f).writerow(["label"] + feature_columns())


def append_sample(label, vector):
    with open(DATA_PATH, "a", newline="") as f:
        csv.writer(f).writerow([label] + vector)


def main():
    ensure_csv_header()

    detector = hl.create_video_detector(max_hands=2, min_detection_confidence=0.6)
    start_time = time.time()

    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        raise RuntimeError("Could not open webcam. Check it isn't in use by another app.")

    label = ""
    typing_buffer = ""
    saved_counts = {}
    burst_until = 0

    print("SignBridge data collector — type a label then ENTER, SPACE to capture, 'c' to burst-capture, 'q' to quit.")

    while True:
        ok, frame = cap.read()
        if not ok:
            break
        frame = cv2.flip(frame, 1)
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        timestamp_ms = int((time.time() - start_time) * 1000)
        hand_landmarks_list, handedness_list = hl.detect_in_video_frame(detector, rgb, timestamp_ms)

        hl.draw_landmarks(frame, hand_landmarks_list)

        cv2.rectangle(frame, (0, 0), (frame.shape[1], 70), (30, 30, 30), -1)
        cv2.putText(frame, f"Label: {label or '(none — type then ENTER)'}", (10, 25),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 1)
        cv2.putText(frame, f"Typing: {typing_buffer}   Saved for '{label}': {saved_counts.get(label, 0)}",
                    (10, 50), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 180), 1)

        cv2.imshow("SignBridge — data collection", frame)
        key = cv2.waitKey(1) & 0xFF

        now = time.time()
        should_capture = False

        if key == ord("q"):
            break
        elif key == 13:  # ENTER
            label = typing_buffer.strip().upper()
            typing_buffer = ""
        elif key == 8:  # BACKSPACE
            typing_buffer = typing_buffer[:-1]
        elif key == 32:  # SPACE
            should_capture = True
        elif key == ord("c") and label:
            burst_until = now + 2.0
        elif 32 < key < 127:
            typing_buffer += chr(key)

        if burst_until and now < burst_until:
            should_capture = True
        elif burst_until and now >= burst_until:
            burst_until = 0

        if should_capture and label and hand_landmarks_list:
            vector = landmarks_to_vector(hand_landmarks_list, handedness_list)
            append_sample(label, vector)
            saved_counts[label] = saved_counts.get(label, 0) + 1

    cap.release()
    cv2.destroyAllWindows()
    print(f"Saved dataset to {os.path.abspath(DATA_PATH)}")
    print("Per-label counts:", saved_counts)


if __name__ == "__main__":
    main()
