# 🎬 SignBridge — Video Script & Storyboard

**Target length: ~4 minutes** (fits comfortably in the 3–5 minute requirement)
**Total narration: ~525 words** — read at a normal, relaxed pace this lands right around 4 minutes once you add pauses for the demo to actually respond.

This is written so you can basically read it out loud while you record, or memorize it a section at a time. It's split into two columns per beat: **SHOW** (what's on screen / what you're doing with your hands) and **SAY** (the actual line to speak).

---

## ✅ Pre-Recording Checklist (do this BEFORE you hit record)

1. **Wake up the Streamlit app first.** Open [signbridge-asl.streamlit.app](https://signbridge-asl.streamlit.app/) about 5–10 minutes before you record and click around in it. Free-tier apps like this fall asleep after inactivity and can take 30–60+ seconds to wake back up — you do not want that dead-air moment while the camera's rolling.
2. **Check your lighting.** Sit facing a window or lamp (light on your hand, not behind you), plain background if possible, no heavy shadows across your fingers. The model relies on MediaPipe seeing your hand clearly.
3. **Memorize 2–3 signs so you don't fumble.** Something short like spelling **H-I** or **H-E-L-L-O** works great. The model now covers the full A–Z alphabet, but J and Z are motion signs squeezed into a still-photo model, so they're a little less reliable live — stick to any of the other 24 letters for your demo so the take goes smoothly.
4. **Do a dry run against the live app first** (off camera) so you know it's responding, how long recognition takes, and what the confidence numbers look like. Don't let the first time you sign on camera also be the first time you've tested it that day.
5. **Quiet room, muted phone, test your mic levels.** A lot of this script only works if your "the computer just spoke!" moment is actually audible.
6. **If you're showing the mobile app**, have Expo Go already running on your phone before you hit record, and be ready to say clearly (not awkwardly hide) that it's currently running on placeholder data — see the mobile beat below for exact wording.
7. **Have your screen-recording software tested with audio** — you'll be cutting between your webcam/face, a screen recording of the browser demo, and a couple of quick file/diagram cuts for the technical section. Know how you're capturing each before recording for real.
8. **Know who says the closing line** if more than one teammate is on camera.
9. **Time yourself once** with this script out loud before the real take — trim or stretch slightly to land inside 3–5 minutes.

---

## 🎥 Storyboard

### 0:00–0:10 — Hook (cold open)

| SHOW | SAY |
|---|---|
| Don't start talking. Open straight on your webcam feed already running in the app (hand landmark dots visible), and just sign **H‑I** silently. The app recognizes it and speaks "Hi" out loud through your speakers. | *(after the app speaks)* "Yeah — that's my hand talking. Let me show you how." |

*(~10 words)*

---

### 0:10–0:35 — The Problem

| SHOW | SAY |
|---|---|
| Cut to you on camera, talking directly to viewer. | "Millions of people communicate in American Sign Language, but most hearing people never learn it — so there's this gap. If someone doesn't know ASL, a deaf or hard-of-hearing signer can't always get their message across right away. We wanted to close that gap in real time, using nothing but a regular laptop camera. That's SignBridge." |

*(~62 words)*

---

### 0:35–2:00 — Live Demo (the core of the video)

| SHOW | SAY |
|---|---|
| Screen-record the live site, [signbridge-asl.streamlit.app](https://signbridge-asl.streamlit.app/), already awake, webcam view on. Hold your hand up and spell **H‑E‑L‑L‑O** one letter at a time, pausing briefly on each so the app can catch it — let the on-screen predicted letter and confidence number actually show. Then click "build sentence," let the LLM turn the letters into a sentence, and let it speak the result out loud. | "This is our live web app — no install, works in any browser. I'm going to spell a word one letter at a time." *(sign H‑E‑L‑L‑O)* "See it catching each letter, live, off just my hand and a webcam? Under the hood, a tool called MediaPipe finds 21 points on my hand, turns them into numbers, and a model we trained guesses the letter — it recognizes the full alphabet and it's about 98% accurate on signs it's never seen before. Once I've spelled everything out, I hit 'build sentence,' and an AI turns those raw letters into an actual sentence instead of just spitting back 'H-E-L-L-O.'" *(click, short pause, audio plays)* "And there it is — my computer just read my sign language out loud." |

*(~160 words — this is your longest, most important beat; let the demo breathe, don't rush the actual recognition moments)*

---

### 2:00–2:30 — Mobile App (quick, honest mention)

| SHOW | SAY |
|---|---|
| Screen-mirror or point the camera at your phone running the Expo app: show the home screen, tap into "Understand Sign," then "Speak with Sign" with its sign-card word list. | "We also started building a mobile version in Expo and React Native, with two modes — one that watches your hands and speaks for you, and one that turns typed words into sign cards. Right now it's running on placeholder data while we finish wiring it up to our real backend, but the whole interface and camera flow already works end to end." |

*(~62 words — say the "placeholder data" part plainly and confidently, it's not a weakness to hide)*

---

### 2:30–3:30 — How It's Built (technical beat)

| SHOW | SAY |
|---|---|
| Quick cuts: `model/README.md`'s model comparison table (or just say it over your face on camera), then the backend architecture — either the Render dashboard showing your two services, or the mermaid diagram in `backend/README.md`. | "So how'd we actually build this? For the hand model, we first raced five different machine learning models against each other to find the best algorithm, and Random Forest won by a clear margin. Then a teammate rebuilt our dataset to cover the full A-through-Z alphabet — over 60,000 hand examples — and we retrained Random Forest on that bigger pile of data. It's now about 98% accurate. J and Z are technically included too, but since those two are motion signs squeezed into a still-photo model, they're a little less reliable live than the rest, which we're upfront about. For the sentence-building step, we didn't want a slow or flaky AI call to ever break the app, so we used Render's new Workflows product to handle that step — it runs the AI call as a durable background task with automatic retries built in. Our backend's actually two real services on Render: a FastAPI service that handles instant letter predictions, and a Render Workflow that handles sentence-building reliably." |

*(~165 words — this is the beat that explicitly earns the Best Use of Render track, don't rush the Workflows sentence)*

---

### 3:30–4:00 — Closing

| SHOW | SAY |
|---|---|
| Back on camera, whole team if possible, maybe a friendly wave or a sign for "thank you." GitHub repo link and/or project name on screen. | "SignBridge was built in about a day and a half by [team member names] for STEMist Hacks IV. We wanted to show that accessibility tech doesn't need a huge budget — just a webcam, some math, and a weekend. Thanks so much for watching, and thanks to the judges for checking out our project!" |

*(~55 words)*

---

## ⏱️ Timing Summary

| Beat | Duration | Running total |
|---|---|---|
| Hook | 0:00–0:10 | 0:10 |
| Problem | 0:10–0:35 | 0:35 |
| Live demo | 0:35–2:00 | 2:00 |
| Mobile app | 2:00–2:30 | 2:30 |
| How it's built | 2:30–3:30 | 3:30 |
| Closing | 3:30–4:00 | 4:00 |

**Total: ~4 minutes**, ~525 words of narration — safely inside the 3–5 minute window even after accounting for the live demo needing a few real seconds for the model to actually recognize signs.

---

## 📝 Note for the submission (not spoken in the video)

This script is built to naturally cover all four target tracks without reciting them like a list:
- **Best Overall** — the full demo end to end.
- **Best AI/LLM Hack** — the sentence-building LLM step.
- **Best Vision & Hardware Hack** — the MediaPipe hand-tracking + trained model.
- **Best Use of Render** — explicitly named and explained in the "How It's Built" beat (the Render Workflow handling `/sentence` with retries).

If you want to make the Render angle even more unmissable for judges, you can optionally add one extra on-screen caption during that beat that just says "Sentence-building runs on a Render Workflow" while you're talking.
