# SignBridge — Mobile App

Expo (React Native + TypeScript) app for the SignBridge hackathon project.
Two flows from a single home screen:

- **Understand Sign** — live camera view that periodically captures frames,
  sends them to a recognition backend, shows the live-recognized sign,
  accumulates a sentence buffer, builds a natural sentence, and speaks it
  aloud with on-device TTS.
- **Speak with Sign** — type a sentence and see each word rendered as a
  sign card in sequence, with a "sign not available yet" fallback for
  out-of-vocabulary words.

## Running it

```bash
npm install
npx expo start
```

Scan the QR code with Expo Go (iOS/Android) or press `a` / `i` for an
emulator/simulator. Camera features require a physical device or a
simulator with camera support — Expo Go on a real phone is the fastest way
to demo "Understand Sign".

Typecheck: `npx tsc --noEmit` (passes clean as of this commit).

## Backend: mock mode vs. real API

All backend calls live in [`services/api.ts`](./services/api.ts) behind a
single toggle:

```ts
export const API_BASE_URL = 'http://localhost:7860'; // TODO: real HF Spaces URL
export const IS_MOCK = true; // TODO: flip to false once the backend is live
```

**To wire up the real backend:**
1. Set `API_BASE_URL` to the deployed backend URL (e.g. a Hugging Face
   Spaces URL like `https://your-username-signbridge.hf.space`).
2. Set `IS_MOCK = false`.
3. Make sure the backend implements:
   - `POST {API_BASE_URL}/predict` with body `{ image_base64: string }`,
     returning `{ label: string, confidence: number }`.
   - `POST {API_BASE_URL}/sentence` with body `{ words: string[] }`,
     returning `{ sentence: string }`.

No other code needs to change — `recognizeFrame()` and `buildSentence()`
already contain the real `fetch` calls, they're just short-circuited by
`IS_MOCK` today so the app is fully demoable before the backend exists.

## What's implemented vs. stubbed

Implemented:
- Home screen with two large option cards, light/dark theme support
  matching the team's brand palette (teal accent `#0E9C8F` / `#28C4B4`).
- Understand Sign: `expo-camera` live preview, permission handling,
  periodic frame capture + recognition (mocked), running sentence buffer,
  "Build sentence" (`/sentence`, mocked) and "Speak" (`expo-speech`, fully
  real/local — no backend needed).
- Speak with Sign: text input, word-by-word sign card rendering, sequential
  "Play" animation that highlights the active card, graceful fallback for
  unknown words.
- Small, swappable vocabulary list at [`data/vocabulary.ts`](./data/vocabulary.ts) —
  add `{ word, illustration }` entries here once the team finalizes the
  trained sign list. Illustrations are emoji placeholders (deliberately not
  scraped/copyrighted sign images); swap in original artwork later without
  touching screen code.

Stubbed / cut for time (documented, not hidden):
- **Backend calls are mocked** (see above) — real backend doesn't exist yet.
- **Voice-to-text input** on the Speak with Sign screen was cut. Expo has
  no low-friction managed-workflow speech-to-text API without adding a
  native module + config plugin, which was too much risk for the remaining
  time budget. Noted as a fast-follow; text input covers the same flow today.
- Recognized-sign labels from the mock/recognition endpoint are lowercase
  words (e.g. `hello`, `thank you`) chosen to line up with the vocabulary
  list, but the real model's label set may differ — a teammate should
  confirm label strings match (or add a small mapping layer) once the real
  backend is live.

## Project structure

```
mobile/
  App.tsx                  # Navigation container + stack setup, theme wiring
  app.json                 # Expo config (name, camera permissions, plugin)
  navigation/types.ts      # RootStackParamList
  screens/
    HomeScreen.tsx
    UnderstandSignScreen.tsx
    SpeakWithSignScreen.tsx
  components/
    OptionCard.tsx         # Home screen large option card
    SignCard.tsx            # Word -> sign illustration card (+ fallback state)
    PrimaryButton.tsx
  services/api.ts           # API contract + mock/real toggle
  data/vocabulary.ts        # Known-word -> sign illustration list
  theme/theme.ts             # Brand palette, spacing, radius, useThemeColors()
```
