# 🤟 SignBridge

A real-time sign-language translator built for STEMist Hacks IV. A camera watches someone sign,
MediaPipe tracks their hand shape, a trained classifier names the sign, Gemini turns the raw
signs into a natural sentence, and the browser speaks it out loud.

Full interactive build plan (steps, checklists, dataset links): open `../index.html` in a browser.

## Current status

- **Model**: RandomForest trained on 24 ASL alphabet letters (A-Y, excluding J and Z since those
  are motion-based signs and this pipeline classifies single still frames). ~82% test accuracy,
  ~85ms/sample inference — see `model/compare_models.py` for the full algorithm comparison table.
  Trained on landmarks extracted from the `Marxulia/asl_sign_languages_alphabets_v03` dataset
  (Hugging Face Hub). Swap in your own recorded signs any time via `model/collect_landmarks.py` —
  same CSV schema, rows just concatenate.
- **Web demo**: working end-to-end (webcam -> MediaPipe hand landmarks -> classifier -> Gemini
  sentence -> browser speech) via `app/main.py`.
- **Mobile app**: Expo/TypeScript app in `mobile/` with "Understand Sign" (live camera) and
  "Speak with Sign" (text -> sign cards) screens, currently running against a mocked backend —
  see `mobile/README.md` to point it at a real deployment.
- **Deployment**: `deployment/huggingface_space/` is ready to push to Hugging Face Spaces (needs
  `git-lfs` for the ~110MB model file — see its README for exact steps).

## Project structure

```
SignBridge/
├── data/
│   ├── raw/                 # (optional) source clips, if you record video instead of live capture
│   └── landmarks/           # dataset.csv — extracted hand-landmark vectors + labels
├── model/
│   ├── hand_landmarker.py   # wraps MediaPipe's Tasks-API HandLandmarker (detection + drawing)
│   ├── features.py          # landmark -> fixed-length feature vector (shared by all scripts)
│   ├── collect_landmarks.py # webcam tool to record your own sign data
│   ├── train.py             # baseline RandomForest training script
│   ├── compare_models.py    # compares multiple algorithms, picks the best one
│   ├── assets/               # hand_landmarker.task model file (auto-downloaded on first run)
│   └── saved/                # sign_model.pkl, labels.json (git-ignored, generated locally)
├── app/
│   ├── main.py               # Gradio live demo: webcam -> sign -> sentence -> speech
│   └── sentence_builder.py  # calls Gemini API to build a natural sentence
├── mobile/                   # Expo React Native app (Understand Sign / Speak with Sign)
├── deployment/
│   └── huggingface_space/   # files for hosting the model + demo on Hugging Face Spaces
├── requirements.txt
└── .env.example
```

> **Note:** the `mediapipe` version that installs here (1.0+) dropped the old `mediapipe.solutions.hands` API you'll see in most tutorials online. This project uses the newer Tasks API (`mediapipe.tasks.python.vision.HandLandmarker`) instead, wrapped in `model/hand_landmarker.py` — don't reintroduce `mp.solutions` calls, they'll crash with `AttributeError`.

## Quick start (web demo)

```bash
cd SignBridge
python -m venv .venv
.venv\Scripts\activate          # Windows
pip install -r requirements.txt

# 1. Record 8-15 signs yourself (fastest, most reliable for a live demo)
python model/collect_landmarks.py

# 2. Train the classifier
python model/train.py

# 3. (optional) copy .env.example to .env and add a free Gemini API key from
#    https://aistudio.google.com/ — without it, sentences are just the words joined together
copy .env.example .env

# 4. Run the live app
python app/main.py
```

## Mobile app

See `mobile/README.md` for Expo setup instructions.

## Deployment

See `deployment/huggingface_space/README.md` for hosting the demo on Hugging Face Spaces (free).
