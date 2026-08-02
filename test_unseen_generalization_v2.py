"""Re-test generalization using the NEW normalized model, same independent
dataset and same MediaPipe pipeline as test_unseen_generalization.py, to
confirm the wrist-relative/scale normalization actually fixes the huge
train/independent-test gap found before (99.68% vs ~21%)."""
import io
import random
import sys
from collections import Counter, defaultdict

import joblib
import numpy as np
import pandas as pd
from PIL import Image

sys.path.insert(0, "model")
import hand_landmarker as hl  # noqa: E402

from retrain_normalized import normalize_row  # noqa: E402

PARQUET_PATH = r"C:\Users\arsla\.cache\huggingface\hub\datasets--Marxulia--asl_sign_languages_alphabets_v03\snapshots\1adf43b2d31eb9d7aea5855edaeac0231d8a2757\data\train-00000-of-00001.parquet"
SAMPLES_PER_LETTER = 15
SEED = 42
LABEL_NAMES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N',
               'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z']

model = joblib.load("model/sign_model_normalized.pkl")
detector = hl.create_image_detector(max_hands=1, min_detection_confidence=0.5)

df = pd.read_parquet(PARQUET_PATH)
label_col = "label"
image_col = "image"
df[label_col] = df[label_col].apply(lambda i: LABEL_NAMES[int(i)])

random.seed(SEED)
by_label = defaultdict(list)
for idx, row in df.iterrows():
    by_label[str(row[label_col]).upper()].append(idx)

no_hand_detected = Counter()
correct = Counter()
total = Counter()
confusions = Counter()

for letter, idxs in sorted(by_label.items()):
    if letter in ("J", "Z", "DEL", "SPACE", "NOTHING"):
        continue
    if letter not in model.classes_:
        continue
    sample_idxs = random.sample(idxs, min(SAMPLES_PER_LETTER, len(idxs)))
    for idx in sample_idxs:
        row = df.loc[idx]
        img_field = row[image_col]
        raw_bytes = img_field["bytes"] if isinstance(img_field, dict) else img_field
        pil_img = Image.open(io.BytesIO(raw_bytes)).convert("RGB")
        rgb = np.array(pil_img)

        hands, handedness = hl.detect_in_image(detector, rgb)
        total[letter] += 1
        if not hands:
            no_hand_detected[letter] += 1
            continue

        hand = hands[0]
        raw_vector = np.array([c for lm in hand for c in (lm.x, lm.y)], dtype=np.float64)
        vector = normalize_row(raw_vector)

        proba = model.predict_proba([vector])[0]
        best_idx = int(np.argmax(proba))
        pred_label = model.classes_[best_idx]

        is_correct = pred_label == letter
        if is_correct:
            correct[letter] += 1
        else:
            confusions[(letter, pred_label)] += 1

print("\n" + "=" * 70)
print("RESULTS ON INDEPENDENT / UNSEEN DATASET (NORMALIZED MODEL)")
print("=" * 70)
total_evaluated = sum(total.values())
total_no_hand = sum(no_hand_detected.values())
total_correct = sum(correct.values())
total_with_hand = total_evaluated - total_no_hand

print(f"Total samples tried: {total_evaluated}")
print(f"No hand detected by MediaPipe: {total_no_hand} ({total_no_hand/total_evaluated:.1%})")
print(f"Correct (of hand-detected): {total_correct}/{total_with_hand} = {total_correct/max(total_with_hand,1):.2%}")
print(f"Correct (of all tried, counting no-detect as wrong): {total_correct}/{total_evaluated} = {total_correct/total_evaluated:.2%}")

print("\nPer-letter breakdown (correct/attempted, no-hand-detected):")
for letter in sorted(total.keys()):
    print(f"  {letter}: {correct[letter]}/{total[letter]}  (no-hand: {no_hand_detected[letter]})")

print("\nTop confusions (true -> predicted: count):")
for (true_l, pred_l), cnt in confusions.most_common(15):
    print(f"  {true_l} -> {pred_l}: {cnt}")
