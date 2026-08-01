"""Render Workflow service: a durable task that turns recognized sign words
into a natural sentence via an LLM (Gemini, with a free llm7.io fallback).

This runs as its own Render Workflow service, separate from the fast
synchronous FastAPI service in ../api -- sentence-building means an external
LLM call that can be slow or flaky, which is exactly what Render Workflows'
built-in retry/timeout handling is for.
"""
from render_sdk import Workflows

from sentence_builder import build_sentence

app = Workflows()


@app.task(name="build_sentence")
def build_sentence_task(words: list[str]) -> str:
    return build_sentence(words)


if __name__ == "__main__":
    app.start()
