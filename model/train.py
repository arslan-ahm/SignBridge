import pandas as pd
import joblib
import os
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score

CSV_PATH = "data/landmarks/hand_landmarks.csv"
MODEL_PATH = "model/sign_model.pkl"

print("Loading landmarks dataset...")
df = pd.read_csv(CSV_PATH)

x = df.drop("label", axis=1)
y = df["label"]

x_train, x_test, y_train, y_test = train_test_split(x, y, test_size=0.2, random_state=42)

print("Training Random Forest Model...")
model = RandomForestClassifier(n_estimators=100, random_state=42)
model.fit(x_train, y_train)

y_pred = model.predict(x_test)
accuracy = accuracy_score(y_test, y_pred)
print(f"\nModel Accuracy: {accuracy * 100:.2f}%")

os.makedirs("model", exist_ok=True)
joblib.dump(model, MODEL_PATH, compress=3)
print(f"Model saved successfully to '{MODEL_PATH}'!")