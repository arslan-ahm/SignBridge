"""Fix the real problem found by cross-dataset testing: the shipped model
was trained on RAW, unnormalized (x, y) landmark coordinates, so it learned
this dataset's specific hand framing/size/position instead of actual letter
shapes -- 99.68% held-out accuracy but only ~21% on a genuinely independent
dataset (see test_unseen_generalization.py).

Fix: retrofit wrist-relative + scale-normalized features onto the EXISTING
60,282-row landmark dataset (no need to re-run MediaPipe on raw images --
we already have all 21 raw (x, y) pairs per row) and retrain. This mirrors
the normalization our original design used, specifically to make the model
invariant to where in the frame the hand is and how big it appears.
"""
import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report
from sklearn.model_selection import train_test_split


def normalize_row(row_xy):
    """row_xy: flat array of 42 numbers [x0,y0,x1,y1,...,x20,y20].
    Returns wrist-relative, scale-normalized version, same length."""
    pts = row_xy.reshape(21, 2).astype(np.float64)
    wrist = pts[0].copy()
    pts -= wrist  # translation invariance

    # Scale reference: max distance from wrist to any other landmark.
    # Robust to rotation/pose better than a single fixed bone length.
    dists = np.linalg.norm(pts, axis=1)
    scale = dists.max()
    if scale < 1e-6:
        scale = 1.0
    pts /= scale

    return pts.reshape(-1)


def main():
    df = pd.read_csv("data/landmarks/hand_landmarks.csv")
    feature_cols = [c for c in df.columns if c != "label"]
    print(f"Loaded {len(df)} rows, {len(feature_cols)} raw feature columns")

    raw = df[feature_cols].to_numpy(dtype=np.float64)
    normalized = np.apply_along_axis(normalize_row, 1, raw)

    norm_df = pd.DataFrame(normalized, columns=feature_cols)
    norm_df["label"] = df["label"].values

    X = norm_df[feature_cols]
    y = norm_df["label"]
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    print("Training RandomForest on normalized features...")
    model = RandomForestClassifier(n_estimators=150, max_depth=20, random_state=42, n_jobs=-1)
    model.fit(X_train, y_train)

    preds = model.predict(X_test)
    acc = accuracy_score(y_test, preds)
    print(f"\nHeld-out test accuracy (normalized features): {acc:.4f}")
    print(classification_report(y_test, preds))

    joblib.dump(model, "model/sign_model_normalized.pkl", compress=3)
    norm_df.to_csv("data/landmarks/hand_landmarks_normalized.csv", index=False)
    print("\nSaved model/sign_model_normalized.pkl and data/landmarks/hand_landmarks_normalized.csv")


if __name__ == "__main__":
    main()
