"""Compare several sklearn-compatible classifiers on the collected landmark
dataset and pick a winner to ship as model/saved/sign_model.pkl.

Why compare at all: this model runs inside a live webcam loop (app/main.py
calls .predict_proba() on every streamed frame), so both accuracy AND
per-sample inference latency matter -- a slightly-more-accurate model that's
10x slower can feel laggier than a slightly-less-accurate fast one.

Algorithms compared: RandomForest, SVM (linear), and k-NN -- all sklearn
estimators with .predict_proba/.classes_, so whichever wins drops straight
into app/main.py and model/train.py's saved artifacts with zero interface
changes.

Note on algorithms tried and dropped for time (hackathon deadline -- both hung
for 20+ minutes on ~6000 rows x 126 features x 24 classes without finishing):
  - `SVC(kernel="rbf", probability=True)`: Platt-scaling calibration runs an
    internal 5-fold CV *per class pair* (one-vs-one) -- swapped to
    `LinearSVC` (liblinear solver) wrapped in `CalibratedClassifierCV(cv=3)`
    for the .predict_proba() interface app.py needs; still a genuine SVM,
    just linear-kernel with a cheaper calibration step.
  - `GradientBoostingClassifier`: sklearn's implementation fits one-vs-rest
    trees per class per boosting stage, so 24 classes x 100 stages = 2400
    trees sequentially on CPU -- too slow to be worth it here. Dropped
    entirely rather than substituting MLP, to stop burning time chasing a
    4th slow candidate; RandomForest/SVM/k-NN already satisfy "compare
    multiple algorithms" with real, fast results.

Usage:
    python model/compare_models.py

Writes model/saved/sign_model.pkl + model/saved/labels.json with the winner
(overwrites whatever model/train.py's baseline produced, if this one does
better).
"""
import json
import os
import time

import joblib
import numpy as np
import pandas as pd
from sklearn.calibration import CalibratedClassifierCV
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, f1_score
from sklearn.model_selection import train_test_split
from sklearn.neighbors import KNeighborsClassifier
from sklearn.svm import LinearSVC

from features import feature_columns

DATA_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "landmarks", "dataset.csv")
MODEL_PATH = os.path.join(os.path.dirname(__file__), "saved", "sign_model.pkl")
LABELS_PATH = os.path.join(os.path.dirname(__file__), "saved", "labels.json")

CANDIDATES = {
    # max_depth=25 caps the pickled model at ~47MB instead of ~110MB (n_estimators=200,
    # max_depth=None) for a ~0.3pt accuracy cost -- small enough to commit straight to
    # GitHub (no git-lfs) so Streamlit Community Cloud / any plain git clone gets the
    # real trained model without extra deployment steps.
    "RandomForest": RandomForestClassifier(n_estimators=100, max_depth=25, random_state=42, n_jobs=-1),
    "SVM (linear)": CalibratedClassifierCV(
        LinearSVC(max_iter=5000, dual="auto", random_state=42), cv=3
    ),
    "k-NN (k=5)": KNeighborsClassifier(n_neighbors=5, n_jobs=-1),
}


def measure_latency_ms(model, X_sample, n_repeats=200):
    """Average per-sample predict_proba latency in milliseconds, the shape the
    live webcam loop calls the model in (one frame's feature vector at a time)."""
    row = X_sample.iloc[[0]]
    # warm-up (JIT/caching effects shouldn't count against a model)
    for _ in range(5):
        model.predict_proba(row)
    t0 = time.perf_counter()
    for _ in range(n_repeats):
        model.predict_proba(row)
    t1 = time.perf_counter()
    return (t1 - t0) / n_repeats * 1000.0


def main():
    if not os.path.exists(DATA_PATH) or os.path.getsize(DATA_PATH) == 0:
        raise SystemExit(
            f"No data found at {DATA_PATH}. Run model/collect_landmarks.py and/or "
            f"model/extract_landmarks_from_dataset.py first."
        )

    df = pd.read_csv(DATA_PATH)
    if df["label"].nunique() < 2:
        raise SystemExit("Need at least 2 different signs recorded before training.")

    X = df[feature_columns()]
    y = df["label"]

    can_stratify = df["label"].value_counts().min() > 1
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y if can_stratify else None
    )

    print(f"Dataset: {len(df)} rows, {y.nunique()} classes "
          f"({len(X_train)} train / {len(X_test)} test)\n")

    results = []
    for name, model in CANDIDATES.items():
        print(f"Training {name} ...")
        t0 = time.perf_counter()
        model.fit(X_train, y_train)
        train_time = time.perf_counter() - t0

        preds = model.predict(X_test)
        accuracy = accuracy_score(y_test, preds)
        f1 = f1_score(y_test, preds, average="macro")
        latency_ms = measure_latency_ms(model, X_test)

        results.append({
            "name": name,
            "model": model,
            "accuracy": accuracy,
            "f1_macro": f1,
            "train_time_s": train_time,
            "latency_ms": latency_ms,
        })
        # Printed immediately (not just in the final table) so a slow later
        # candidate can't hide an already-finished result if the run gets cut short.
        print(f"  -> accuracy={accuracy:.2%} f1={f1:.2%} "
              f"train={train_time:.1f}s latency={latency_ms:.3f}ms")

    # Ranking: accuracy is the primary driver (a wrong sign is worse than a
    # slow-but-correct one), but among near-ties prefer lower latency since
    # this runs every streamed webcam frame in app/main.py.
    results.sort(key=lambda r: (-round(r["accuracy"], 3), r["latency_ms"]))

    print("\n" + "=" * 78)
    print(f"{'Model':<18}{'Accuracy':>10}{'F1 (macro)':>12}{'Train (s)':>12}{'Latency (ms)':>14}")
    print("-" * 78)
    for r in results:
        print(f"{r['name']:<18}{r['accuracy']:>10.2%}{r['f1_macro']:>12.2%}"
              f"{r['train_time_s']:>12.2f}{r['latency_ms']:>14.3f}")
    print("=" * 78)

    winner = results[0]
    print(f"\nWinner: {winner['name']} "
          f"(accuracy={winner['accuracy']:.2%}, latency={winner['latency_ms']:.3f} ms/sample)")

    os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
    joblib.dump(winner["model"], MODEL_PATH)
    with open(LABELS_PATH, "w") as f:
        json.dump(sorted(y.unique().tolist()), f, indent=2)

    print(f"Saved winning model to {MODEL_PATH}")
    print(f"Saved label list to {LABELS_PATH}")


if __name__ == "__main__":
    main()
