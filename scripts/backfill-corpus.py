#!/usr/bin/env python3
"""
Backfill existing client_knowledge_docs into the Ultravox corpus.

Reads all docs with corpus_status='local_only' or NULL.
For each doc with content_text, creates an upload + source in Ultravox,
then updates the DB record with corpus IDs and status='indexed'.

Usage:
  ULTRAVOX_API_KEY=xxx ULTRAVOX_CORPUS_ID=xxx \
  SUPABASE_URL=xxx SUPABASE_SERVICE_KEY=xxx \
  python scripts/backfill-corpus.py
"""

import os
import sys
import json
import time
import urllib.request
import urllib.error

ULTRAVOX_BASE = "https://api.ultravox.ai/api"


def require_env(name: str) -> str:
    val = os.environ.get(name)
    if not val:
        print(f"ERROR: {name} env var is required", file=sys.stderr)
        sys.exit(1)
    return val


def supabase_request(url: str, service_key: str, method: str = "GET", data: dict | None = None) -> dict | list:
    headers = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }
    body = json.dumps(data).encode("utf-8") if data else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode("utf-8"))


def ultravox_request(path: str, api_key: str, method: str = "GET", data: dict | None = None):
    headers = {
        "X-API-Key": api_key,
        "Content-Type": "application/json",
    }
    body = json.dumps(data).encode("utf-8") if data else None
    req = urllib.request.Request(f"{ULTRAVOX_BASE}{path}", data=body, headers=headers, method=method)
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode("utf-8"))


def upload_text_to_presigned_url(upload_url: str, content: str):
    body = content.encode("utf-8")
    req = urllib.request.Request(
        upload_url,
        data=body,
        headers={"Content-Type": "text/plain"},
        method="PUT",
    )
    with urllib.request.urlopen(req) as resp:
        return resp.status


def main():
    uv_key = require_env("ULTRAVOX_API_KEY")
    corpus_id = require_env("ULTRAVOX_CORPUS_ID")
    supa_url = require_env("SUPABASE_URL")
    supa_key = require_env("SUPABASE_SERVICE_KEY")

    rest_url = f"{supa_url}/rest/v1"

    print("Fetching docs with corpus_status='local_only' or NULL...")
    docs_url = (
        f"{rest_url}/client_knowledge_docs"
        f"?select=id,client_id,filename,content_text"
        f"&or=(corpus_status.eq.local_only,corpus_status.is.null)"
        f"&order=created_at.asc"
    )
    docs = supabase_request(docs_url, supa_key)
    print(f"Found {len(docs)} docs to backfill.")

    if not docs:
        print("Nothing to do.")
        return

    # Pre-fetch client slugs for source naming
    client_ids = list({d["client_id"] for d in docs if d.get("client_id")})
    slug_map: dict[str, str] = {}
    if client_ids:
        ids_filter = ",".join(f'"{cid}"' for cid in client_ids)
        clients_url = f"{rest_url}/clients?select=id,slug&id=in.({','.join(client_ids)})"
        clients = supabase_request(clients_url, supa_key)
        for c in clients:
            slug_map[c["id"]] = c["slug"]

    success = 0
    failed = 0

    for doc in docs:
        doc_id = doc["id"]
        filename = doc["filename"]
        content = doc.get("content_text") or ""
        client_id = doc.get("client_id")
        slug = slug_map.get(client_id, "unknown") if client_id else "unknown"

        if not content.strip():
            print(f"  SKIP {filename} (id={doc_id}) — no content_text")
            failed += 1
            continue

        print(f"  Processing {filename} (id={doc_id}, client={slug})...")

        try:
            # Step 1: Get presigned upload URL (use text/plain since we're uploading extracted text)
            upload_resp = ultravox_request(
                f"/corpora/{corpus_id}/uploads",
                uv_key,
                method="POST",
                data={"mimeType": "text/plain"},
            )
            upload_url = upload_resp["uploadUrl"]
            document_id = upload_resp["documentId"]

            # Step 2: PUT the content to presigned URL
            upload_text_to_presigned_url(upload_url, content)

            # Step 3: Create source with the document
            source_resp = ultravox_request(
                f"/corpora/{corpus_id}/sources",
                uv_key,
                method="POST",
                data={
                    "documentIds": [document_id],
                    "name": f"client-{slug}-{filename}",
                },
            )
            source_id = source_resp["sourceId"]

            # Step 4: Update DB record
            update_url = f"{rest_url}/client_knowledge_docs?id=eq.{doc_id}"
            supabase_request(
                update_url,
                supa_key,
                method="PATCH",
                data={
                    "corpus_document_id": document_id,
                    "corpus_source_id": source_id,
                    "corpus_status": "indexed",
                },
            )

            print(f"    OK — sourceId={source_id}")
            success += 1

            # Small delay to avoid rate limits
            time.sleep(0.5)

        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", errors="replace")
            print(f"    FAIL — HTTP {e.code}: {body}")
            failed += 1
        except Exception as e:
            print(f"    FAIL — {e}")
            failed += 1

    print(f"\nDone. Success: {success}, Failed: {failed}, Total: {len(docs)}")


if __name__ == "__main__":
    main()
