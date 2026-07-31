/**
 * Known-vocabulary list for the "Speak with Sign" flow.
 *
 * This is intentionally a single small file so the team can drop in the
 * final trained sign list (and swap emoji placeholders for real original
 * illustrations) without touching any screen code.
 *
 * `illustration` is a plain emoji placeholder standing in for original
 * artwork — no copyrighted/scraped sign-language images are used here.
 */
export interface VocabEntry {
  /** Canonical lowercase word this entry matches against user input. */
  word: string;
  /** Emoji/placeholder glyph shown on the sign card. */
  illustration: string;
}

export const VOCABULARY: VocabEntry[] = [
  { word: 'hello', illustration: '👋' },
  { word: 'hi', illustration: '👋' },
  { word: 'thank', illustration: '🙏' },
  { word: 'thanks', illustration: '🙏' },
  { word: 'you', illustration: '🫵' },
  { word: 'please', illustration: '🤲' },
  { word: 'yes', illustration: '👍' },
  { word: 'no', illustration: '👎' },
  { word: 'help', illustration: '🆘' },
  { word: 'name', illustration: '📛' },
  { word: 'friend', illustration: '🤝' },
  { word: 'love', illustration: '❤️' },
  { word: 'good', illustration: '😊' },
  { word: 'bad', illustration: '☹️' },
  { word: 'sorry', illustration: '🙇' },
  { word: 'water', illustration: '💧' },
  { word: 'eat', illustration: '🍽️' },
  { word: 'more', illustration: '➕' },
  { word: 'stop', illustration: '✋' },
  { word: 'go', illustration: '➡️' },
  { word: 'family', illustration: '👪' },
  { word: 'me', illustration: '🫱' },
  { word: 'i', illustration: '🫱' },
  { word: 'want', illustration: '🙋' },
  { word: 'understand', illustration: '💡' },
];

const VOCAB_INDEX: Record<string, VocabEntry> = Object.fromEntries(
  VOCABULARY.map((entry) => [entry.word, entry])
);

/** Strips surrounding punctuation and lowercases a raw input token. */
export function normalizeWord(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z']/g, '');
}

/** Looks up a sign for a word, returning undefined if not yet supported. */
export function lookupSign(rawWord: string): VocabEntry | undefined {
  return VOCAB_INDEX[normalizeWord(rawWord)];
}
