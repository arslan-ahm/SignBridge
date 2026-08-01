import os
import cv2
import pandas as pd
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision

base_options = python.BaseOptions(model_asset_path="hand_landmarker.task")
options = vision.HandLandmarkerOptions(
    base_options=base_options,
    num_hands=1,
    min_hand_detection_confidence=0.5
)

detector = vision.HandLandmarker.create_from_options(options)

DATASET_PATH = "data/raw"
OUTPUT_CSV = "data/landmarks/hand_landmarks.csv"

data = []

print("Extracting hand landmarks via MediaPipe Tasks API...")

for label in os.listdir(DATASET_PATH):
    folder_path = os.path.join(DATASET_PATH, label)
    if not os.path.isdir(folder_path):
        continue

    print(f"Processing folder: '{label}'...")

    for img_name in os.listdir(folder_path):
        img_path = os.path.join(folder_path, img_name)
        image = cv2.imread(img_path)
        
        if image is None:
            continue

        image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=image_rgb)

        result = detector.detect(mp_image)

        if result.hand_landmarks:
            for hand_landmarks in result.hand_landmarks:
                landmarks = []
                for lm in hand_landmarks:
                    landmarks.extend([lm.x, lm.y])
                
                landmarks.append(label)
                data.append(landmarks)

columns = []
for i in range(21):
    columns.extend([f"x{i}", f"y{i}"])
columns.append("label")

os.makedirs("data/landmarks", exist_ok=True)
df = pd.DataFrame(data, columns=columns)
df.to_csv(OUTPUT_CSV, index=False)

print(f"\nDone! A total of {len(df)} images were processed and saved to '{OUTPUT_CSV}'.")