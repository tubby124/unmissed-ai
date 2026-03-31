---
type: operations
status: active
tags: [operations, railway, deployment, build]
related: [Operations/Cron Jobs, Operations/Environment Variables]
updated: 2026-03-31
---

# Deployment — Railway + Build Process

## Stack
- **Platform:** Railway (Docker, Next.js 15, Node 22)
- **Build command:** `cd agent-app && npm run build`
- **Root:** monorepo — app is in `agent-app/` subdirectory
- **Branch:** `main` → auto-deploys to Railway on push

## Deploy Process
```bash
# From repo root:
cd agent-app && npm run build    # MUST pass locally first
git add [specific files]         # NEVER git add -A (risk of .env)
git commit -m "..."
git push                         # Railway auto-detects main branch push
```

## Known Build Failure Causes
1. **Turbopack `_ssgManifest.js` ENOENT** — stale `.next/` cache. Fix: `rm -rf .next && npm run build`
2. **`next/font/google` network fetch** — Google Fonts unreachable in Railway build environment. Use `next/font/local` or add `NEXT_PUBLIC_FONT_*` env var.
3. **Top-level await in tests** — test files imported at module level break Next.js build. Keep tests out of `src/`.
4. **`prepare` script needs `.git` guard** — Docker build has no `.git` dir. Guard: `if [ -d .git ]; then npm run prepare-husky; fi`

**Rule:** Always run `rm -rf .next && npm run build` locally before pushing. Never push on a failed local build.

## Git Repo
- **agent-app** is in a SEPARATE git repo: `github.com/tubby124/unmissed-ai`
- Commit from `cd agent-app && git ...` — NOT from repo root
- See `memory/agent-app-git-repo.md`

## Environment Variables
- Production env vars set in Railway Dashboard → Service → Variables
- Local: `agent-app/.env.local`
- Critical Railway vars: `SUPABASE_SERVICE_ROLE_KEY`, `TWILIO_AUTH_TOKEN`, `ULTRAVOX_API_KEY`, `WEBHOOK_SIGNING_SECRET`, `ULTRAVOX_WEBHOOK_SECRET`, `CRON_SECRET`
- **CRON_SECRET (D233):** CRITICAL — all 10 cron jobs fail silently without this. Verify in Railway dashboard.
- Callback URL max 200 chars — enforced by `signCallbackUrl()` in `lib/ultravox.ts`

## Zod Version Lock
- Always `zod@3` — NEVER upgrade to zod@4 (Turbopack crash in Next.js 16.1.6)
- `package.json` pinned. Do not run `npm update` without checking zod.

## "DONE" Definition
A change is DONE only when:
1. Committed and pushed to `main`
2. Railway build passes
3. The feature/fix is verified working in production (not just local)
