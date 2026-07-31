"""Bulk-extract hand landmarks from a downloaded ASL alphabet image dataset and
append them to data/landmarks/dataset.csv in the same schema collect_landmarks.py
produces (label,f0..f125), so a teammate's live-recorded rows can simply be
concatenated with the rows this script produces.

Dataset: Marxulia/asl_sign_languages_alphabets_v03 (Hugging Face Hub).
This is a Kaggle-ASL-Alphabet-style mirror (single cropped hand per image on a
plain background, 26 letter classes, ~380-420 images/class, 10,873 total) that
downloads over the Hugging Face Hub without any auth/API-token friction, unlike
the original Kaggle "ASL Alphabet" dataset which needs a kaggle.json token this
machine doesn't have configured.

J and Z are skipped: in this dataset (and in Kaggle's ASL Alphabet, which it
mirrors the format of) they're photographed as a single static frame of a
motion sign, and that static frame is visually near-identical to another
letter's real static pose (J's frame looks like I; Z's frame looks like a
pointing/D-like pose) -- see the sample crops pulled during dataset review.
Since the whole pipeline here (features.py, the RandomForest/SVM/etc. models,
the live webcam loop) classifies single static frames with no temporal/motion
modeling, keeping J/Z in would just teach the model to confuse those classes.
24 static letters (A-I, K-Y minus J) are used instead.

Usage:
    python model/extract_landmarks_from_dataset.py
"""
import csv
import io
import os
import random
import time

import numpy as np
import pandas as pd
from huggingface_hub import hf_hub_download
from PIL import Image

import hand_landmarker as hl
from features import feature_columns, landmarks_to_vector

REPO_ID = "Marxulia/asl_sign_languages_alphabets_v03"
PARQUET_FILE = "data/train-00000-of-00001.parquet"

LABEL_NAMES = [chr(ord("A") + i) for i in range(26)]  # index -> letter, matches the dataset's class_label order
SKIP_LETTERS = {"J", "Z"}  # motion signs that are ambiguous as a single static frame -- see module docstring

TARGET_PER_CLASS = 250       # how many successful (hand-detected) samples we want per letter
MAX_ATTEMPTS_PER_CLASS = 350  # upper bound on raw images tried per letter, so a bad class can't run forever
MIN_DETECTION_CONFIDENCE = 0.5
RANDOM_SEED = 42

DATA_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "landmarks", "dataset.csv")


def ensure_csv_header():
    os.makedirs(os.path.dirname(DATA_PATH), exist_ok=True)
    if not os.path.exists(DATA_PATH) or os.path.getsize(DATA_PATH) == 0:
        with open(DATA_PATH, "w", newline="") as f:
            csv.writer(f).writerow(["label"] + feature_columns())


def append_rows(rows):
    with open(DATA_PATH, "a", newline="") as f:
        writer = csv.writer(f)
        writer.writerows(rows)


def main():
    random.seed(RANDOM_SEED)
    ensure_csv_header()

    print(f"Downloading/loading dataset {REPO_ID} ...")
    parquet_path = hf_hub_download(repo_id=REPO_ID, filename=PARQUET_FILE, repo_type="dataset")
    df = pd.read_parquet(parquet_path)
    print(f"Loaded {len(df)} images across {df['label'].nunique()} classes.")

    detector = hl.create_image_detector(max_hands=1, min_detection_confidence=MIN_DETECTION_CONFIDENCE)

    total_saved = 0
    total_skipped_no_hand = 0
    per_class_saved = {}

    for label_idx, group in df.groupby("label"):
        letter = LABEL_NAMES[label_idx]
        if letter in SKIP_LETTERS:
            print(f"[{letter}] skipped (motion sign, ambiguous as a static frame)")
            continue

        indices = list(group.index)
        random.shuffle(indices)

        saved = 0
        attempted = 0
        skipped = 0
        rows_buffer = []
        t0 = time.time()

        for idx in indices:
            if saved >= TARGET_PER_CLASS or attempted >= MAX_ATTEMPTS_PER_CLASS:
                break
            attempted += 1

            image_bytes = df.loc[idx, "image"]["bytes"]
            try:
                img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
            except Exception:
                skipped += 1
                continue

            arr = np.array(img)
            hand_landmarks_list, handedness_list = hl.detect_in_image(detector, arr)

            if not hand_landmarks_list:
                skipped += 1
                continue

            vector = landmarks_to_vector(hand_landmarks_list, handedness_list)
            rows_buffer.append([letter] + vector)
            saved += 1

        append_rows(rows_buffer)
        elapsed = time.time() - t0
        per_class_saved[letter] = saved
        total_saved += saved
        total_skipped_no_hand += skipped
        print(f"[{letter}] saved {saved}/{attempted} attempted "
              f"({skipped} no-hand-detected) in {elapsed:.1f}s")

    print()
    print(f"Done. Wrote {total_saved} rows to {os.path.abspath(DATA_PATH)}")
    print(f"Total images with no hand detected (skipped): {total_skipped_no_hand}")
    print("Per-class counts:", per_class_saved)


if __name__ == "__main__":
    main()
