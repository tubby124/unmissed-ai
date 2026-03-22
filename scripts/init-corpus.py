#!/usr/bin/env python3
"""
Create the shared Ultravox corpus for unmissed.ai knowledge base.

Prints the corpus ID — set it as ULTRAVOX_CORPUS_ID env var on Railway.

Usage:
  ULTRAVOX_API_KEY=xxx python scripts/init-corpus.py
"""

import os
import sys
import json
import urllib.request

ULTRAVOX_BASE = "https://api.ultravox.ai/api"
BRAND = os.environ.get("BRAND_NAME", "unmissed.ai")

def main():
    api_key = os.environ.get("ULTRAVOX_API_KEY")
    if not api_key:
        print("ERROR: ULTRAVOX_API_KEY env var is required", file=sys.stderr)
        sys.exit(1)

    corpus_name = f"{BRAND.replace('.', '-')}-shared-corpus"
    payload = json.dumps({
        "name": corpus_name,
        "description": f"Shared knowledge base for all {BRAND} voice agent clients",
    }).encode("utf-8")

    req = urllib.request.Request(
        f"{ULTRAVOX_BASE}/corpora",
        data=payload,
        headers={
            "X-API-Key": api_key,
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            corpus_id = data.get("corpusId")
            if not corpus_id:
                print(f"ERROR: Unexpected response — no corpusId in: {data}", file=sys.stderr)
                sys.exit(1)

            print(f"Corpus created successfully!")
            print(f"  Name: {corpus_name}")
            print(f"  Corpus ID: {corpus_id}")
            print()
            print(f"Set this as a Railway env var:")
            print(f"  ULTRAVOX_CORPUS_ID={corpus_id}")
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        print(f"ERROR: Ultravox API returned {e.code}: {body}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
