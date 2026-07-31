---
title: SignBridge
emoji: 🤟
colorFrom: blue
colorTo: purple
sdk: gradio
sdk_version: 6.22.0
app_file: app.py
pinned: false
---

# SignBridge — Hugging Face Space

Self-contained build of the SignBridge live sign-language-to-speech demo,
ready to push to a Hugging Face Space. Everything the app needs (model
weights, feature/landmark code, the MediaPipe hand-landmarker asset) lives
in this folder so it can be pushed as-is.

## Files in this folder

- `app.py` — the Gradio demo (self-contained copy of `app/main.py`)
- `features.py`, `hand_landmarker.py` — bundled copies of `model/features.py` /
  `model/hand_landmarker.py` (landmark math + MediaPipe Tasks API wrapper)
- `sentence_builder.py` — bundled copy of `app/sentence_builder.py` (Gemini
  sentence smoothing, degrades gracefully with no API key)
- `sign_model.pkl`, `labels.json` — the trained classifier, copied from
  `model/saved/`
- `assets/hand_landmarker.task` — MediaPipe's hand-landmark model asset
  (auto-downloaded on first run if missing, so it doesn't strictly need to be
  committed, but bundling it avoids a cold-start download on Spaces)
- `requirements.txt` — Python deps for the Space

## One-time setup (do this before pushing)

1. **Copy the freshest trained model** (run this from the repo root after
   `model/compare_models.py` or `model/train.py` has produced a model):

   ```
   cp model/saved/sign_model.pkl deployment/huggingface_space/sign_model.pkl
   cp model/saved/labels.json   deployment/huggingface_space/labels.json
   ```

   (Windows PowerShell: `Copy-Item model\saved\sign_model.pkl deployment\huggingface_space\sign_model.pkl`, etc.)

2. **Install the Hugging Face CLI** if you don't have it, and log in:

   ```
   pip install -U huggingface_hub
   huggingface-cli login
   ```

   This asks for an access token — get one from
   https://huggingface.co/settings/tokens (a "write" token).

## Creating and pushing the Space

1. Create a new Space on https://huggingface.co/new-space:
   - Owner: your account/org
   - Space name: e.g. `signbridge`
   - SDK: **Gradio**
   - Hardware: free CPU tier is fine for this model
   - Visibility: your choice

2. Hugging Face gives you a git remote URL, something like
   `https://huggingface.co/spaces/<your-username>/signbridge`. From *this*
   folder (`deployment/huggingface_space/`), initialize git and push:

   ```
   cd deployment/huggingface_space
   git init
   git lfs install
   git lfs track "*.pkl" "*.task"
   git remote add origin https://huggingface.co/spaces/<your-username>/signbridge
   git add .gitattributes
   git add .
   git commit -m "Initial SignBridge Space"
   git push -u origin main
   ```

   The `git lfs track` step matters: `sign_model.pkl` is a RandomForest with
   200 trees and is currently **~110 MB**, well past the point where a plain
   git push works cleanly on Hugging Face's hub (files over ~10 MB need
   LFS). If you don't have `git-lfs` installed, get it from
   https://git-lfs.com first.

   (If the Space's default branch is `master` instead of `main`, push to
   that branch name instead.)

3. **Set the Gemini API key as a Space secret** (don't commit it in a file):
   in the Space's page -> Settings -> "Variables and secrets" -> add a new
   secret named `GEMINI_API_KEY` with your key from
   https://aistudio.google.com/apikey. Without this, sentence-building still
   works but just joins the recognized words instead of using Gemini to
   smooth them into a sentence.

4. The Space will build automatically after the push (watch the "Building"
   logs on the Space page). Once it's live, open it — Gradio's webcam
   component will ask for camera permission in the browser.

## Notes / known limitations

- Spaces' free CPU tier can be slower per-frame than a local machine; if the
  live label feels laggy, that's expected for real-time MediaPipe + sklearn
  inference on CPU.
- The bundled model only recognizes the letters it was trained on (see
  `labels.json` for the exact list) — check `model/compare_models.py`'s
  printed table in the main repo for the current accuracy.
