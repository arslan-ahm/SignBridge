/**
 * SignBridge API service layer.
 *
 * The backend is a FastAPI service on Render (see ../../backend/api). Two
 * different endpoints, two different reliability stories:
 *
 * - POST /sentence is real and reliable -- it delegates to a Render Workflow
 *   task (../../backend/workflow) and we've verified it end to end.
 * - POST /predict needs mediapipe + OpenCV + scikit-learn loaded in the same
 *   512MB-RAM free-tier process, which is more memory than that combination
 *   fits in -- it OOM-crashes the whole service every time it's actually
 *   called. Fixing this for real means paying for a bigger instance, which
 *   wasn't worth it for this deadline, so camera recognition stays mocked
 *   (IS_PREDICT_MOCK) while sentence-building is genuinely live
 *   (IS_SENTENCE_MOCK). Flip IS_PREDICT_MOCK once /predict has a large-enough
 *   instance behind it.
 */

export const API_BASE_URL = 'https://signbridge-api-bruo.onrender.com';

export const IS_PREDICT_MOCK = true;
export const IS_SENTENCE_MOCK = false;

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
  if (IS_PREDICT_MOCK) {
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
  if (IS_SENTENCE_MOCK) {
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
