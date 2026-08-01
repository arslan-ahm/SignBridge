# SignBridge

**A magic mirror for hands: sign a letter, and your computer says it out loud.**

🔗 **Live demo:** [magenta-concha-e2e893.netlify.app](https://magenta-concha-e2e893.netlify.app/) — no install needed, works in any browser. (Also live on Streamlit: [signbridge-asl.streamlit.app](https://signbridge-asl.streamlit.app/))

---

## Inspiration

Millions of Deaf and hard-of-hearing people communicate fluently in ASL, but most hearing people can't understand a single sign. That gap shows up in everyday moments — ordering coffee, a doctor's visit, a classroom — where a hearing person just shrugs instead of understanding. We wanted to see how far a laptop webcam and an afternoon of machine learning could go toward closing that gap, with zero special hardware: no gloves, no depth camera, no dedicated sensor. Just a camera and a model that already ships on every phone and laptop.

## What it does

SignBridge watches a webcam feed, recognizes ASL fingerspelling letters in real time, and speaks the result out loud:

1. **See** — MediaPipe finds 21 landmark points on your hand every frame.
2. **Understand** — those points are converted into a 42-number feature vector and fed to a trained classifier, which recognizes the full A–Z alphabet.
3. **Compose** — as letters accumulate, an LLM (Google Gemini, or a free `llm7.io` fallback if no API key is configured) turns the raw letter stream into a natural, grammatical sentence instead of a robotic string of letters.
4. **Speak** — the browser's built-in text-to-speech reads the sentence out loud.

Our main live demo is a professionally designed website at [magenta-concha-e2e893.netlify.app](https://magenta-concha-e2e893.netlify.app/), where hand-landmark detection runs **entirely in your browser** (MediaPipe's WASM build) — no video ever leaves your device, only a small array of numbers describing your hand's shape. We also ship the original Streamlit demo at [signbridge-asl.streamlit.app](https://signbridge-asl.streamlit.app/), and a companion **Expo/React Native mobile app** with two flows: **"Understand Sign"** (camera → recognized signs → sentence → speech) for hearing users trying to understand a signer, and **"Speak with Sign"** (type or speak → shown as sign images) for the reverse direction. Underneath all three sits a real **FastAPI backend on Render**, with sentence-building running as an actual **Render Workflow** task — an LLM call with built-in retries, not just a plain API route.

## How we built it

**The model.** We turned hand photos into numbers using MediaPipe's hand-landmark detector (21 points × 2 coordinates per hand = 42 features per frame). Early on, we benchmarked model families against a smaller starter dataset: `model/compare_models.py` raced five classifiers against each other — Random Forest, k-Nearest Neighbors, Linear SVM, RBF-kernel SVM, and Gradient Boosting. The two kernel/boosting methods were disqualified for taking 20+ minutes to train without finishing; among the three that actually completed, **Random Forest** won decisively on accuracy. A teammate then sourced and processed a much larger training set — **60,000+ labeled examples** across the full alphabet — and we retrained the same winning Random Forest architecture on it, which now hits **~98% test accuracy** recognizing all 26 letters.

**The apps.** The web demo is built with **Streamlit** (deployed on Streamlit Community Cloud) with a **Gradio** version for local/offline use. The **mobile app** is Expo + React Native + TypeScript, with a clean mock/real backend toggle (`services/api.ts`) so the UI could be built and demoed before the backend existed.

**The backend.** A **FastAPI** service exposes recognition and sentence-building. `POST /sentence` hands off to a genuine **Render Workflow**: the LLM call to Gemini (or the `llm7.io` fallback) is exactly the kind of slow, occasionally-flaky external call that Workflows' built-in retries exist for. If the workflow isn't configured or fails, the API transparently falls back to running the same sentence-building logic in-process, so `/sentence` never just breaks — it degrades gracefully.

**The website.** Our first backend design ran MediaPipe + OpenCV server-side for `POST /predict`, which needs more RAM than Render's free tier gives a web service — confirmed by repeated live testing, it reliably crashed the whole service. Rather than pay for a bigger instance, we fixed the actual architecture: the website runs MediaPipe's official WASM build directly in the browser, extracts the same 42-number feature vector our Python code computes, and sends only that tiny array to a new `POST /predict-vector` endpoint that loads just `scikit-learn` — no mediapipe, no OpenCV, no memory ceiling. It's plain HTML/CSS/JS (no build step) deployed on Netlify, split into a landing page and a dedicated live-demo page.

**Full stack:** MediaPipe (Python Tasks API + browser WASM build), scikit-learn, Streamlit, Gradio, Netlify, Expo/React Native, FastAPI, Render Workflows, Google Gemini API, llm7.io.

## Challenges we ran into

- **MediaPipe's API changed out from under old tutorials.** Every guide online uses `mediapipe.solutions.hands`, which no longer exists in current MediaPipe. We had to work against the new Tasks API directly and wrap it ourselves in `hand_landmarker.py` so the rest of the codebase never has to care.
- **Two of our five candidate models were too slow to even finish training.** RBF-kernel SVM and Gradient Boosting blew past 20 minutes on the full dataset with a hackathon clock running. We cut them rather than burn our limited time waiting.
- **Hugging Face Spaces wanted a paid "Pro" plan** to host our Python app on free-tier CPU, which we didn't find out until we were partway into deploying there. We pivoted to Streamlit Community Cloud instead, which is what's actually live today — the HF Space config is still in the repo, ready to go if that constraint changes.
- **J and Z don't work as still photos.** Both are motion signs in real ASL (you draw them in the air), but our model only ever sees a single frame. We made the deliberate call to still support the full A–Z label set with the letter classifier, rather than pretend those two letters work the same way as the rest.
- **Render Workflows aren't yet supported by `render.yaml`** (Infrastructure-as-Code), unlike the plain web service. We had to set up the workflow service by hand in the Render dashboard and wire the API to it with a `RENDER_API_KEY`, while keeping an in-process fallback so a misconfigured or missing workflow never takes down the whole `/sentence` endpoint.
- **Our first `/predict` design reliably crashed Render's free tier.** mediapipe + OpenCV + scikit-learn loaded together in one process need more than 512MB RAM — confirmed by repeated live testing, not a guess. Rather than pay for a bigger instance, we moved hand-tracking to the browser (MediaPipe's WASM build) and built a lightweight `/predict-vector` endpoint that never loads mediapipe/OpenCV server-side at all — a better architecture, not just a workaround.
- **The mobile app and the backend were built in parallel by design** — the app shipped first against a mocked API (`IS_MOCK = true`) so we could iterate on UI/UX without waiting on the model pipeline, then we built the real FastAPI contract to match exactly what the mobile app already expected.

## Accomplishments we're proud of

- A real-time, full-alphabet (A–Z) ASL fingerspelling recognizer running at ~98% test accuracy, trained on a 60,000+ example dataset, that runs comfortably on a normal webcam with no special hardware.
- Actually benchmarking multiple model families instead of guessing — and having the discipline to cut two that couldn't finish training in time.
- A genuinely working, publicly accessible live demo with real camera recognition running entirely client-side — not just a local script — at magenta-concha-e2e893.netlify.app.
- A production-shaped backend on Render with a real Workflow doing real work (an LLM call with retries), not a Workflow bolted on just to check a box.
- A second, independent mobile client built against a mocked API contract that dropped in against the real backend with no UI changes needed.

## What we learned

- How MediaPipe's hand-landmark model actually works under the hood, and how quickly "official" tutorials go stale as an API evolves.
- That model selection benefits from just racing several algorithms rather than assuming the fanciest one (SVM/boosting) will win — sometimes the simpler, faster Random Forest is both easier to ship and more accurate for the data you actually have.
- How to structure a system so an unreliable external dependency (an LLM call) is isolated behind a durable, retryable task instead of sitting directly in the request path — and to always have a graceful in-process fallback.
- The practical tradeoffs of hosting choices for student/hackathon budgets — free tiers have real limits (Hugging Face Spaces' CPU hosting, for one), and it's worth checking those before committing to a platform.
- How much easier cross-team collaboration gets when you agree on an API contract (`/predict`, `/sentence`) up front — it let the mobile app and the backend be built almost entirely in parallel.

## What's next

- Bring the same on-device MediaPipe approach to the mobile app (there's a JS/native equivalent) so its camera recognition can go live without hitting the same server-memory ceiling.
- Add support for full ASL words and common phrases, not just fingerspelled letters, using a sequence model that can handle motion (which would also finally bring J and Z into the fold).
- Expand "Speak with Sign" with a fuller sign-image/video vocabulary instead of the current placeholder word list.
- Deploy the Hugging Face Space as an alternate mirror once we can host it on a supported plan.

---

**Try it:** [magenta-concha-e2e893.netlify.app](https://magenta-concha-e2e893.netlify.app/)

**Built with:** Python · MediaPipe (Tasks API + browser WASM) · scikit-learn (Random Forest) · Streamlit · Gradio · Netlify · Expo · React Native · TypeScript · FastAPI · Render · Render Workflows · Google Gemini API · llm7.io
