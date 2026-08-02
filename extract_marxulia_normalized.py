"""Extract landmarks from the full Marxulia v03 dataset (a genuinely
different source than the current training data) using the exact
production pipeline, apply wrist-relative/scale normalization, and save.
This gets merged with the existing normalized training data to give the
model exposure to more than one dataset's framing/lighting/hand-shape
conventions -- the standard fix for a domain-gap generalization problem."""
import io
import sys

import numpy as np
import pandas as pd
from PIL import Image

sys.path.insert(0, "model")
import hand_landmarker as hl  # noqa: E402

from retrain_normalized import normalize_row  # noqa: E402

PARQUET_PATH = r"C:\Users\arsla\.cache\huggingface\hub\datasets--Marxulia--asl_sign_languages_alphabets_v03\snapshots\1adf43b2d31eb9d7aea5855edaeac0231d8a2757\data\train-00000-of-00001.parquet"
LABEL_NAMES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N',
               'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z']

detector = hl.create_image_detector(max_hands=1, min_detection_confidence=0.5)

df = pd.read_parquet(PARQUET_PATH)
df["label"] = df["label"].apply(lambda i: LABEL_NAMES[int(i)])

rows = []
no_hand = 0
for i, (_, row) in enumerate(df.iterrows()):
    if i % 1000 == 0:
        print(f"{i}/{len(df)} processed, {len(rows)} with hand detected, {no_hand} no-hand")
    raw_bytes = row["image"]["bytes"] if isinstance(row["image"], dict) else row["image"]
    pil_img = Image.open(io.BytesIO(raw_bytes)).convert("RGB")
    rgb = np.array(pil_img)

    hands, _ = hl.detect_in_image(detector, rgb)
    if not hands:
        no_hand += 1
        continue

    hand = hands[0]
    raw_vector = np.array([c for lm in hand for c in (lm.x, lm.y)], dtype=np.float64)
    normalized = normalize_row(raw_vector)
    rows.append(list(normalized) + [row["label"]])

cols = []
for j in range(21):
    cols.extend([f"x{j}", f"y{j}"])
cols.append("label")

out_df = pd.DataFrame(rows, columns=cols)
out_df.to_csv("data/landmarks/marxulia_normalized.csv", index=False)
print(f"\nDone. {len(out_df)} rows saved ({no_hand} images had no detected hand).")
print(out_df["label"].value_counts())
