"""Merge the teammate's normalized 60k-row dataset with the freshly
extracted+normalized Marxulia v03 dataset (a genuinely different source),
then retrain. Training on more than one dataset's conventions is the
standard fix for the domain-gap generalization problem found by
test_unseen_generalization.py (99.68% same-source vs ~17-21% cross-source).

Evaluation splits BY SOURCE, not just randomly, so the reported numbers
honestly reflect "how well does this do on a dataset-shaped chunk it did
not train on" rather than the same near-duplicate-frame leakage risk as
before.
"""
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report
from sklearn.model_selection import train_test_split

from retrain_normalized import normalize_row

TEAMMATE_CSV = "data/landmarks/hand_landmarks.csv"
MARXULIA_CSV = "data/landmarks/marxulia_normalized.csv"


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

    # Split each source separately, then combine -- guarantees both sources
    # are represented in train AND test, so held-out accuracy reflects
    # genuine within-and-across-source generalization, not just one source.
    train_parts, test_parts = [], []
    for source, group in merged.groupby("source"):
        X = group[feature_cols]
        y = group["label"]
        can_stratify = y.value_counts().min() > 1
        X_tr, X_te, y_tr, y_te = train_test_split(
            X, y, test_size=0.2, random_state=42, stratify=y if can_stratify else None
        )
        train_parts.append((X_tr, y_tr))
        test_parts.append((X_te, y_te, source))

    X_train = pd.concat([p[0] for p in train_parts])
    y_train = pd.concat([p[1] for p in train_parts])

    print("\nTraining RandomForest on merged normalized dataset...")
    model = RandomForestClassifier(n_estimators=200, max_depth=20, random_state=42, n_jobs=-1)
    model.fit(X_train, y_train)

    print("\n" + "=" * 70)
    print("PER-SOURCE HELD-OUT ACCURACY (the honest generalization number)")
    print("=" * 70)
    for X_te, y_te, source in test_parts:
        preds = model.predict(X_te)
        acc = accuracy_score(y_te, preds)
        print(f"\n--- {source} held-out ({len(X_te)} samples): {acc:.4f} ---")

    X_test_all = pd.concat([p[0] for p in test_parts])
    y_test_all = pd.concat([p[1] for p in test_parts])
    preds_all = model.predict(X_test_all)
    print("\n" + "=" * 70)
    print(f"COMBINED held-out accuracy: {accuracy_score(y_test_all, preds_all):.4f}")
    print("=" * 70)
    print(classification_report(y_test_all, preds_all))

    import joblib
    joblib.dump(model, "model/sign_model_merged.pkl", compress=3)
    print("\nSaved model/sign_model_merged.pkl")


if __name__ == "__main__":
    main()
