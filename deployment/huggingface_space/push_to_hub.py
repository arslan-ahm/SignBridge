"""Push this folder to a Hugging Face Space using the huggingface_hub API.

This is an alternative to the git+lfs steps in README.md: upload_folder()
talks to the Hub over HTTP and handles large files (like sign_model.pkl)
automatically, so you don't need git-lfs installed locally.

Usage:
    set HF_TOKEN=hf_xxx        (or put it in SignBridge/.env)
    python deployment/huggingface_space/push_to_hub.py <your-hf-username>/signbridge
"""
import os
import sys

from dotenv import load_dotenv
from huggingface_hub import HfApi

load_dotenv()

HERE = os.path.dirname(__file__)


def main():
    if len(sys.argv) < 2:
        raise SystemExit("Usage: python push_to_hub.py <username>/<space-name>")
    repo_id = sys.argv[1]

    token = os.environ.get("HF_TOKEN")
    if not token:
        raise SystemExit("Set HF_TOKEN (env var or in SignBridge/.env) first.")

    api = HfApi(token=token)
    api.create_repo(repo_id=repo_id, repo_type="space", space_sdk="gradio", exist_ok=True)
    api.upload_folder(
        folder_path=HERE,
        repo_id=repo_id,
        repo_type="space",
        ignore_patterns=["push_to_hub.py", "__pycache__/*"],
    )
    print(f"Pushed. Space URL: https://huggingface.co/spaces/{repo_id}")


if __name__ == "__main__":
    main()
