"""Train a baseline sign classifier from collected landmark data.

This is the fast baseline to get the demo working end-to-end today.
model/compare_models.py (run separately) tries several algorithms against
the same dataset and can produce a better model to drop in here.

Usage:
    python model/train.py
"""
import json
import os

import joblib
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report
from sklearn.model_selection import train_test_split

from features import feature_columns

DATA_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "landmarks", "dataset.csv")
MODEL_PATH = os.path.join(os.path.dirname(__file__), "saved", "sign_model.pkl")
LABELS_PATH = os.path.join(os.path.dirname(__file__), "saved", "labels.json")


def main():
    if not os.path.exists(DATA_PATH) or os.path.getsize(DATA_PATH) == 0:
        raise SystemExit(
            f"No data found at {DATA_PATH}. Run model/collect_landmarks.py first to record some signs."
        )

    df = pd.read_csv(DATA_PATH)
    if df["label"].nunique() < 2:
        raise SystemExit("Need at least 2 different signs recorded before training.")

    X = df[feature_columns()]
    y = df["label"]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y if df["label"].value_counts().min() > 1 else None
    )

    model = RandomForestClassifier(n_estimators=200, random_state=42)
    model.fit(X_train, y_train)

    preds = model.predict(X_test)
    accuracy = accuracy_score(y_test, preds)
    print(f"Test accuracy: {accuracy:.2%}")
    print(classification_report(y_test, preds))

    os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
    joblib.dump(model, MODEL_PATH)
    with open(LABELS_PATH, "w") as f:
        json.dump(sorted(y.unique().tolist()), f, indent=2)

    print(f"Saved model to {MODEL_PATH}")
    print(f"Saved label list to {LABELS_PATH}")


if __name__ == "__main__":
    main()
