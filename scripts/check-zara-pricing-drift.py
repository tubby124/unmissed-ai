#!/usr/bin/env python3
import os
import pathlib
import sys

import requests

ROOT = pathlib.Path(__file__).resolve().parents[1]
FILES = [
    ROOT / "clients/unmissed-demo/SYSTEM_PROMPT.txt",
    ROOT / "clients/unmissed-demo/SYSTEM_PROMPT_TEST.txt",
    ROOT / "clients/unmissed-demo/domain-knowledge.md",
    ROOT / "tests/promptfoo/unmissed-demo.yaml",
]
STALE = ["$20", "$29 founding", "$49 regular", "FOUNDING29"]
REQUIRED = ["$119/month", "250 minutes", "$29/month", "50 minutes"]
SUPABASE_URL = "https://qwhvblomlgeapzhnuwlb.supabase.co"
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY")

failed = False

for file_path in FILES:
    try:
        text = file_path.read_text()
    except FileNotFoundError:
        print(f"MISSING drift check file: {file_path}")
        failed = True
        continue

    for stale in STALE:
        if stale.lower() in text.lower():
            print(f"STALE pricing in {file_path}: {stale}")
            failed = True
    for required in REQUIRED:
        if required not in text:
            print(f"MISSING required pricing in {file_path}: {required}")
            failed = True

if SUPABASE_KEY:
    client_res = requests.get(
        f"{SUPABASE_URL}/rest/v1/clients?slug=eq.unmissed-demo&select=id",
        headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"},
        timeout=20,
    )
    client_res.raise_for_status()
    clients = client_res.json()
    if not clients:
        print("MISSING unmissed-demo client in Supabase")
        failed = True
    else:
        client_id = clients[0]["id"]
        chunk_res = requests.get(
            f"{SUPABASE_URL}/rest/v1/knowledge_chunks?client_id=eq.{client_id}&status=eq.approved&select=id,content",
            headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"},
            timeout=20,
        )
        chunk_res.raise_for_status()
        for chunk in chunk_res.json():
            content = chunk.get("content", "")
            for stale in STALE:
                if stale.lower() in content.lower():
                    print(f"STALE approved DB chunk {chunk.get('id')}: {stale}")
                    failed = True
else:
    print("SUPABASE_SERVICE_KEY not set; skipped approved DB chunk drift check")

if failed:
    sys.exit(1)
print("Zara pricing drift check passed")
