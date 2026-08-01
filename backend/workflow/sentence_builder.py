"""Turns a sequence of raw recognized signs into a natural sentence.

This is the standout feature: "I GO STORE" -> "I'm going to the store."

Provider chain:
  1. Gemini, if GEMINI_API_KEY is set (best quality).
  2. llm7.io, a free/anonymous OpenAI-compatible API with no key required
     (https://llm7.io) -- used automatically when there's no Gemini key, or
     as a fallback if Gemini itself errors out.
  3. If llm7's free-tier rate limit is hit *and* no Gemini key is configured,
     say so plainly rather than silently degrading, since adding a free
     Gemini key is the actual fix.
  4. Plain joined words, so the rest of the demo (recognition, voice output)
     always keeps working no matter what.
"""
import json
import os
import urllib.error
import urllib.request

from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

LLM7_URL = "https://api.llm7.io/v1/chat/completions"
LLM7_MODEL = "default"  # anonymous free tier picks a model for you (currently routes to a Gemini flash variant)

_gemini_model = None
if GEMINI_API_KEY:
    import google.generativeai as genai

    genai.configure(api_key=GEMINI_API_KEY)
    _gemini_model = genai.GenerativeModel("gemini-2.0-flash")

PROMPT_TEMPLATE = (
    "You are helping a sign-language translator app. A user signed these words "
    "in order, without grammar: {words}\n"
    "Rewrite them as one short, natural, grammatically correct English sentence "
    "that preserves their meaning. Reply with only the sentence, no quotes, no explanation."
)


def _plain_fallback(words):
    return " ".join(words).capitalize()


def _via_gemini(prompt):
    response = _gemini_model.generate_content(prompt)
    return (response.text or "").strip()


def _via_llm7(prompt):
    body = json.dumps({
        "model": LLM7_MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.3,
    }).encode("utf-8")
    request = urllib.request.Request(
        LLM7_URL,
        data=body,
        headers={"Content-Type": "application/json", "Authorization": "Bearer unused"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=10) as response:
        payload = json.load(response)
    return payload["choices"][0]["message"]["content"].strip()


def build_sentence(words):
    """words: list[str] of recognized sign labels, e.g. ["I", "GO", "STORE"]."""
    words = [w for w in words if w]
    if not words:
        return ""

    prompt = PROMPT_TEMPLATE.format(words=" ".join(words))
    fallback = _plain_fallback(words)

    if _gemini_model:
        try:
            return _via_gemini(prompt) or fallback
        except Exception:
            pass  # fall through and try the free backup before giving up

    try:
        return _via_llm7(prompt) or fallback
    except Exception:
        if not GEMINI_API_KEY:
            return (
                f"{fallback}  (⚠ Free AI sentence-building limit reached — "
                f"add a free GEMINI_API_KEY to SignBridge/.env for reliable results: "
                f"https://aistudio.google.com/apikey)"
            )
        return fallback
