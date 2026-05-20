#!/usr/bin/env python3
"""
Seed approved Zara demo knowledge for unmissed-demo.

Usage:
  source ~/.secrets && python3 scripts/seed-demo-knowledge.py
"""

import json
import os
import sys
from datetime import datetime, timezone

import requests

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY")
SUPABASE_URL = "https://qwhvblomlgeapzhnuwlb.supabase.co"
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY")

if not OPENAI_API_KEY and not OPENROUTER_API_KEY:
    print("ERROR: OPENAI_API_KEY or OPENROUTER_API_KEY not set")
    sys.exit(1)
if not SUPABASE_KEY:
    print("ERROR: SUPABASE_SERVICE_KEY not set")
    sys.exit(1)

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
}

client_res = requests.get(
    f"{SUPABASE_URL}/rest/v1/clients?slug=eq.unmissed-demo&select=id",
    headers=HEADERS,
    timeout=20,
)
client_res.raise_for_status()
clients = client_res.json()
if not clients:
    print("ERROR: unmissed-demo client not found")
    sys.exit(1)

CLIENT_ID = clients[0]["id"]
print(f"Client ID: {CLIENT_ID}")

SOURCE = "zara_demo_product_truth"
SOURCE_RUN_ID = f"zara-v14-knowledge-seed-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}"

CHUNKS = [
    {
        "chunk_type": "qa",
        "content": "Q: What does unmissed.ai cost?\nA: Pro is $119/month and includes 250 minutes. Trial is $29/month and includes 50 minutes. The trial is a low-friction way to test the voice, SMS, booking, and knowledge behavior before committing to Pro.",
    },
    {
        "chunk_type": "qa",
        "content": "Q: Can I start small?\nA: Yes. Start with the $29/month trial. It includes 50 minutes so a business owner can test calls, hear the voice, send demo texts, try booking, and decide if the system fits. Pro is $119/month for 250 minutes when the business wants it running seriously.",
    },
    {
        "chunk_type": "qa",
        "content": "Q: What happens when someone calls my business?\nA: The agent answers missed or after-hours calls, asks what the caller needs, qualifies the lead, captures useful details, answers approved questions, books when calendar is connected, sends texts when available, and alerts the owner with a concise call summary.",
    },
    {
        "chunk_type": "qa",
        "content": "Q: Can it text people during the call?\nA: Yes, when the caller phone number and SMS tool are available. The agent can send a setup link, booking confirmation, quote link, or follow-up while the caller is still on the phone. If SMS is not available in that call path, the agent should not claim it sent a text.",
    },
    {
        "chunk_type": "qa",
        "content": "Q: Can it book appointments?\nA: Yes, when Google Calendar booking is connected. The triage agent collects the caller name and request, then moves into the booking stage. The booking stage checks availability, creates the calendar event, and can send the caller a confirmation text.",
    },
    {
        "chunk_type": "qa",
        "content": "Q: What does the owner receive after a call?\nA: The owner can receive a concise call summary with caller name, phone, reason for calling, lead quality, next step, booking details, and transcript or recording links when enabled. Delivery can be email, SMS, or Telegram depending on that client's setup.",
    },
    {
        "chunk_type": "fact",
        "content": "For the current unmissed-demo row, owner email and caller SMS behavior are confirmed. Telegram should be described as available when configured because the demo row has no telegram_bot_token.",
    },
    {
        "chunk_type": "qa",
        "content": "Q: How does the knowledge base work?\nA: Each client can have approved knowledge chunks for services, hours, pricing, policies, objections, setup details, and niche-specific questions. When a caller asks for detail, the agent searches the approved knowledge and answers naturally. If nothing reliable is found, it should say it is not sure and offer follow-up instead of guessing.",
    },
    {
        "chunk_type": "qa",
        "content": "Q: Does the agent improve over time?\nA: Yes. Calls can produce knowledge gaps, prompt lessons, and scorecards. Repeated unanswered questions become candidates for approved knowledge updates, while robotic wording or bad closes become prompt fixes.",
    },
    {
        "chunk_type": "fact",
        "content": "Private customer examples must stay anonymous unless the customer is public and approved. Safe wording: property managers use it for after-hours maintenance, auto glass shops use it for quote calls, real estate agents use it for showing and buyer inquiries, restaurants use it for reservations or catering inquiries, and service businesses use it for urgent calls.",
    },
    {
        "chunk_type": "qa",
        "content": "Q: Is this just voicemail?\nA: No. Voicemail waits until the caller gives up. unmissed.ai answers, asks useful questions, sends texts, books appointments when connected, and alerts the owner with context so the lead can be handled quickly.",
    },
    {
        "chunk_type": "qa",
        "content": "Q: What if the agent does not know the answer?\nA: It should not make anything up. It should say it is not sure on that specific detail, capture the question as a knowledge gap, and offer to have Hasan or the business owner follow up.",
    },
    {
        "chunk_type": "qa",
        "content": "Q: How does this help an auto glass shop?\nA: Auto glass shops miss quote calls while technicians are driving, installing glass, or closed after hours. The agent can capture vehicle details, damage type, insurance status, timing, and contact info so the shop can respond before the caller books somewhere else.",
    },
    {
        "chunk_type": "qa",
        "content": "Q: How does this help a property manager?\nA: Property managers get tenant issues, rental inquiries, and urgent maintenance calls at awkward times. The agent can triage whether the issue is urgent, collect the address or unit context when appropriate, and alert the owner with a clear summary.",
    },
    {
        "chunk_type": "qa",
        "content": "Q: How does this help a real estate agent?\nA: Real estate agents miss buyer calls while driving, showing homes, or meeting clients. The agent can capture what the buyer wants, timeline, budget range if volunteered, and whether they want a showing or callback.",
    },
    {
        "chunk_type": "qa",
        "content": "Q: How should Zara explain the trial versus Pro?\nA: Trial is for testing: $29/month, 50 minutes. Pro is for running the system seriously: $119/month, 250 minutes. Zara should match the plan to call volume and missed-call cost instead of discounting.",
    },
    {
        "chunk_type": "qa",
        "content": "Q: Does this replace the owner?\nA: No. It catches calls, handles repetitive questions, books or texts when connected, and routes hot leads so the owner spends time on calls that actually need human judgment.",
    },
]


def reject_stale_demo_pricing_chunks():
    stale_terms = ["$20", "$29 founding", "$49 regular", "FOUNDING29"]
    for term in stale_terms:
        res = requests.get(
            f"{SUPABASE_URL}/rest/v1/knowledge_chunks"
            f"?client_id=eq.{CLIENT_ID}&status=eq.approved&select=id,content",
            headers=HEADERS,
            timeout=20,
        )
        res.raise_for_status()
        stale_ids = [
            row["id"]
            for row in res.json()
            if term.lower() in (row.get("content") or "").lower()
        ]
        if not stale_ids:
            continue
        patch_res = requests.patch(
            f"{SUPABASE_URL}/rest/v1/knowledge_chunks?id=in.({','.join(stale_ids)})",
            headers={**HEADERS, "Content-Type": "application/json", "Prefer": "return=minimal"},
            json={"status": "rejected", "updated_at": datetime.now(timezone.utc).isoformat()},
            timeout=20,
        )
        if patch_res.status_code not in (200, 204):
            print(f"  Stale chunk rejection warning for {term}: {patch_res.status_code} {patch_res.text[:200]}")
        else:
            print(f"  Rejected {len(stale_ids)} stale approved chunks containing {term}")


def embed(text):
    providers = []
    if OPENAI_API_KEY:
        providers.append((
            "openai",
            "https://api.openai.com/v1/embeddings",
            {"Authorization": f"Bearer {OPENAI_API_KEY}", "Content-Type": "application/json"},
            {"model": "text-embedding-3-small", "input": text},
        ))
    if OPENROUTER_API_KEY:
        providers.append((
            "openrouter",
            "https://openrouter.ai/api/v1/embeddings",
            {"Authorization": f"Bearer {OPENROUTER_API_KEY}", "Content-Type": "application/json"},
            {"model": "openai/text-embedding-3-small", "input": text},
        ))

    for label, url, headers, body in providers:
        res = requests.post(url, headers=headers, json=body, timeout=30)
        if res.status_code == 200:
            data = res.json()
            return data["data"][0]["embedding"]
        print(f"  {label} embedding error: {res.status_code} {res.text[:200]}")
    return None


def insert_chunk(chunk):
    embedding = embed(chunk["content"])
    if not embedding:
        return False

    row = {
        "client_id": CLIENT_ID,
        "content": chunk["content"],
        "chunk_type": chunk["chunk_type"],
        "source": SOURCE,
        "source_run_id": SOURCE_RUN_ID,
        "metadata": json.dumps({"version": "zara_v14"}),
        "embedding": json.dumps(embedding),
        "status": "approved",
        "trust_tier": "high",
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    res = requests.post(
        f"{SUPABASE_URL}/rest/v1/knowledge_chunks",
        headers={**HEADERS, "Content-Type": "application/json", "Prefer": "return=minimal"},
        json=row,
        timeout=30,
    )
    if res.status_code not in (200, 201):
        print(f"  Insert error: {res.status_code} {res.text[:200]}")
        return False
    return True


if __name__ == "__main__":
    print(f"Seeding {len(CHUNKS)} Zara v14 knowledge chunks for unmissed-demo...")
    print(f"Run ID: {SOURCE_RUN_ID}")
    reject_stale_demo_pricing_chunks()
    stored = 0
    failed = 0
    for i, chunk in enumerate(CHUNKS, 1):
        preview = chunk["content"][:80].replace("\n", " ")
        print(f"  [{i}/{len(CHUNKS)}] {preview}...")
        if insert_chunk(chunk):
            stored += 1
            print("    OK")
        else:
            failed += 1
            print("    FAILED")
    print(f"\nDone. Stored: {stored}, Failed: {failed}")
