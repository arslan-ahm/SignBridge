/**
 * SignBridge API service layer.
 *
 * Talks to the sign-recognition backend (a teammate's Hugging Face Space /
 * FastAPI/Gradio server, per the hackathon pipeline in ../app and ../model).
 * That backend is not deployed yet, so this file ships in MOCK MODE by
 * default: it returns plausible fake data with a small delay so the app is
 * fully demoable today. The real `fetch` calls are already written below —
 * flip `IS_MOCK` to `false` and set `API_BASE_URL` once the backend is live.
 */

// TODO(teammate): replace with the real Hugging Face Spaces URL once deployed,
// e.g. "https://your-username-signbridge.hf.space"
export const API_BASE_URL = 'http://localhost:7860';

// TODO(teammate): flip to false once API_BASE_URL points at a real, reachable backend.
export const IS_MOCK = true;

export interface RecognizeResult {
  label: string;
  confidence: number;
}

export interface SentenceResult {
  sentence: string;
}

const MOCK_LABELS = [
  'hello',
  'thank you',
  'please',
  'yes',
  'no',
  'help',
  'name',
  'friend',
  'love',
  'good',
];

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pickMockLabel(): RecognizeResult {
  const label = MOCK_LABELS[Math.floor(Math.random() * MOCK_LABELS.length)];
  const confidence = 0.72 + Math.random() * 0.27;
  return { label, confidence: Math.round(confidence * 100) / 100 };
}

/**
 * Sends a single base64-encoded camera frame to the recognition backend and
 * returns the predicted sign label + confidence.
 *
 * Real contract: POST {API_BASE_URL}/predict  body: { image_base64 }
 */
export async function recognizeFrame(imageBase64: string): Promise<RecognizeResult> {
  if (IS_MOCK) {
    await delay(300 + Math.random() * 300);
    return pickMockLabel();
  }

  const response = await fetch(`${API_BASE_URL}/predict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image_base64: imageBase64 }),
  });

  if (!response.ok) {
    throw new Error(`recognizeFrame failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

function mockSentenceFromWords(words: string[]): string {
  if (words.length === 0) return '';
  const raw = words.join(' ').trim().toLowerCase();
  const capitalized = raw.charAt(0).toUpperCase() + raw.slice(1);
  return /[.?!]$/.test(capitalized) ? capitalized : `${capitalized}.`;
}

/**
 * Sends the accumulated list of recognized sign words to the backend and
 * asks it to assemble them into a natural-sounding sentence.
 *
 * Real contract: POST {API_BASE_URL}/sentence  body: { words }
 */
export async function buildSentence(words: string[]): Promise<SentenceResult> {
  if (IS_MOCK) {
    await delay(400);
    return { sentence: mockSentenceFromWords(words) };
  }

  const response = await fetch(`${API_BASE_URL}/sentence`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ words }),
  });

  if (!response.ok) {
    throw new Error(`buildSentence failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}
