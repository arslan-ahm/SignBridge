"""Retrain the sign-recognition model to survive realistic live-webcam
landmark jitter, not just the pixel-perfect coordinates in the training
datasets.

Diagnosis (see scratchpad noise-robustness benchmark): the previously
deployed model (retrain_merged.py's output) scores ~98% on clean held-out
landmarks but collapses to ~49% correct / 44% abstained once a modest
amount of gaussian noise (std=0.05, well within the jitter a real moving
hand under a webcam produces vs a static training photo) is added to the
same rows. That gap -- not the model's clean-data accuracy -- is what
made the live demo barely recognize anything.

Fix: same merged dataset and same RandomForest budget (n_estimators=100,
max_depth=20 -- kept identical so the pickle size doesn't regress past
Render's free-tier memory limit, which previously crash-looped the service
at a bigger forest) as retrain_merged.py, but each training row is expanded
into several noisy copies (std sampled across the range real jitter falls
in) before fitting, so the trees learn decision boundaries that hold up
under noise instead of memorizing exact clean coordinates. The held-out
test set stays clean+separately-noised for evaluation, never augmented, so
the reported numbers are an honest comparison against the old model.
"""
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report
from sklearn.model_selection import train_test_split

from retrain_normalized import normalize_row

TEAMMATE_CSV = "data/landmarks/hand_landmarks.csv"
MARXULIA_CSV = "data/landmarks/marxulia_normalized.csv"

AUGMENTATIONS_PER_ROW = 4
NOISE_STDS = (0.01, 0.02, 0.03, 0.04)

rng = np.random.default_rng(42)


def augment(X, y):
    """Expand each row into itself + AUGMENTATIONS_PER_ROW noisy copies."""
    parts_X = [X]
    parts_y = [y]
    for std in NOISE_STDS[:AUGMENTATIONS_PER_ROW]:
        noisy = X + rng.normal(0, std, size=X.shape)
        parts_X.append(noisy)
        parts_y.append(y)
    return np.vstack(parts_X), np.concatenate(parts_y)


def evaluate_noise_robustness(model, X_clean, y, label):
    print(f"\n--- noise-robustness sweep: {label} ({len(y)} rows) ---")
    for noise_std in (0.0, 0.02, 0.03, 0.05, 0.08):
        noisy = X_clean if noise_std == 0 else X_clean + rng.normal(0, noise_std, size=X_clean.shape)
        proba = model.predict_proba(noisy)
        best_idx = np.argmax(proba, axis=1)
        conf = proba[np.arange(len(proba)), best_idx]
        pred = model.classes_[best_idx]
        abstained = conf < 0.35
        correct = (~abstained) & (pred == y)
        wrong = (~abstained) & (pred != y)
        total = len(y)
        print(
            f"  noise_std={noise_std:<5} correct={correct.sum()/total:.3f}  "
            f"wrong={wrong.sum()/total:.3f}  abstained={abstained.sum()/total:.3f}"
        )


def main():
    teammate = pd.read_csv(TEAMMATE_CSV)
    feature_cols = [c for c in teammate.columns if c != "label"]
    raw = teammate[feature_cols].to_numpy(dtype=np.float64)
    normalized = np.apply_along_axis(normalize_row, 1, raw)
    teammate_norm = pd.DataFrame(normalized, columns=feature_cols)
    teammate_norm["label"] = teammate["label"].values
    teammate_norm["source"] = "teammate"

    marxulia = pd.read_csv(MARXULIA_CSV)
    marxulia["source"] = "marxulia"

    print(f"Teammate dataset: {len(teammate_norm)} rows")
    print(f"Marxulia dataset:  {len(marxulia)} rows")

    merged = pd.concat([teammate_norm, marxulia[feature_cols + ["label", "source"]]], ignore_index=True)
    print(f"Merged: {len(merged)} rows")

    train_parts, test_parts = [], []
    for source, group in merged.groupby("source"):
        X = group[feature_cols].to_numpy(dtype=np.float64)
        y = group["label"].to_numpy()
        can_stratify = pd.Series(y).value_counts().min() > 1
        X_tr, X_te, y_tr, y_te = train_test_split(
            X, y, test_size=0.2, random_state=42, stratify=y if can_stratify else None
        )
        train_parts.append((X_tr, y_tr))
        test_parts.append((X_te, y_te, source))

    X_train = np.vstack([p[0] for p in train_parts])
    y_train = np.concatenate([p[1] for p in train_parts])
    print(f"\nClean training rows: {len(y_train)}")

    X_train_aug, y_train_aug = augment(X_train, y_train)
    print(f"Augmented training rows: {len(y_train_aug)} ({AUGMENTATIONS_PER_ROW}x noisy copies + originals)")

    print("\nTraining RandomForest on noise-augmented normalized dataset...")
    # max_depth=20 + n_estimators=100 (the previous script's budget) produced
    # a 46MB pickle here -- 5x the noise-augmented training rows means trees
    # actually fill out their depth budget instead of hitting pure leaves
    # early, unlike the un-augmented model that pickle size was tuned against.
    # min_samples_leaf=4 forces coarser (and few-KB-per-tree) leaves, which
    # also happens to be exactly what noise robustness wants: a leaf that's
    # only reachable by one exact noisy point is the overfitting this whole
    # exercise is trying to avoid. Shallower depth trims the rest back down
    # towards the previously-safe ~14.5MB pickle Render's free tier handled.
    model = RandomForestClassifier(
        n_estimators=90, max_depth=14, min_samples_leaf=4, random_state=42, n_jobs=-1
    )
    model.fit(X_train_aug, y_train_aug)

    print("\n" + "=" * 70)
    print("PER-SOURCE HELD-OUT ACCURACY ON CLEAN DATA (sanity check, not the fix target)")
    print("=" * 70)
    for X_te, y_te, source in test_parts:
        preds = model.predict(X_te)
        acc = accuracy_score(y_te, preds)
        print(f"--- {source} clean held-out ({len(X_te)} samples): {acc:.4f} ---")

    X_test_all = np.vstack([p[0] for p in test_parts])
    y_test_all = np.concatenate([p[1] for p in test_parts])
    preds_all = model.predict(X_test_all)
    print(f"\nCOMBINED clean held-out accuracy: {accuracy_score(y_test_all, preds_all):.4f}")

    evaluate_noise_robustness(model, X_test_all, y_test_all, "combined held-out, THE ACTUAL FIX TARGET")

    import os

    import joblib
    joblib.dump(model, "model/sign_model_robust.pkl", compress=3)
    size_mb = os.path.getsize("model/sign_model_robust.pkl") / (1024 * 1024)
    print(f"\nSaved model/sign_model_robust.pkl ({size_mb:.1f} MB)")


if __name__ == "__main__":
    main()
