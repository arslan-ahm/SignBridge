"""Thin wrapper around MediaPipe's Tasks-API HandLandmarker.

mediapipe>=1.0 removed the old `mediapipe.solutions.hands` API entirely (only
`mp.Image`, `mp.ImageFormat`, and `mp.tasks` remain). This module is the one
place that talks to the new Tasks API so the rest of the codebase doesn't
need to know the details.
"""
import os
import urllib.request

import cv2
import mediapipe as mp
from mediapipe.tasks.python import vision
from mediapipe.tasks.python.core.base_options import BaseOptions
from mediapipe.tasks.python.vision.hand_landmarker import HandLandmarksConnections

MODEL_PATH = os.path.join(os.path.dirname(__file__), "hand_landmarker.task")
MODEL_URL = (
    "https://storage.googleapis.com/mediapipe-models/hand_landmarker/"
    "hand_landmarker/float16/latest/hand_landmarker.task"
)
HAND_CONNECTIONS = HandLandmarksConnections.HAND_CONNECTIONS


def ensure_model_downloaded():
    if os.path.exists(MODEL_PATH) and os.path.getsize(MODEL_PATH) > 0:
        return
    os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
    urllib.request.urlretrieve(MODEL_URL, MODEL_PATH)


def create_image_detector(max_hands=1, min_detection_confidence=0.5):
    """For processing standalone images (e.g. one uploaded camera frame), one at a time."""
    ensure_model_downloaded()
    options = vision.HandLandmarkerOptions(
        base_options=BaseOptions(model_asset_path=MODEL_PATH),
        running_mode=vision.RunningMode.IMAGE,
        num_hands=max_hands,
        min_hand_detection_confidence=min_detection_confidence,
    )
    return vision.HandLandmarker.create_from_options(options)


def frame_to_mp_image(rgb_frame):
    """rgb_frame: HxWx3 uint8 numpy array in RGB order."""
    return mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)


def detect_in_image(detector, rgb_frame):
    """Static-image detection. Returns (hand_landmarks_list, handedness_list)."""
    result = detector.detect(frame_to_mp_image(rgb_frame))
    return result.hand_landmarks, result.handedness


def draw_landmarks(frame, hand_landmarks_list, color=(0, 255, 180), point_color=(255, 255, 255)):
    """Draws hand skeleton onto `frame` (numpy array, modified in place) using plain OpenCV,
    since mediapipe.solutions.drawing_utils no longer exists."""
    if not hand_landmarks_list:
        return frame

    height, width = frame.shape[:2]
    for hand_landmarks in hand_landmarks_list:
        points = [(int(p.x * width), int(p.y * height)) for p in hand_landmarks]
        for connection in HAND_CONNECTIONS:
            cv2.line(frame, points[connection.start], points[connection.end], color, 2)
        for x, y in points:
            cv2.circle(frame, (x, y), 3, point_color, -1)
    return frame
