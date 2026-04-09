---
type: operations
status: partial — github push blocked
tags: [obsidian, github, vps, sync, launchagent]
related: [[Cron Jobs]], [[Deployment]]
updated: 2026-04-07
---

# Second Brain — Vault Sync Architecture

This note documents the auto-sync pipeline that keeps the Obsidian vault (`~/Downloads/Obsidian Vault`) backed up to GitHub and mirrored on the VPS.

---

## What Was Set Up

### 1. GitHub Repo
- **Repo:** `tubby124/second-brain` (private)
- **Remote URL:** `https://x-access-token:<GH_TOKEN>@github.com/tubby124/second-brain.git`
- **Token source:** Extracted from True Color Pricing repo remote URL at setup time
- **Status (2026-04-07):** Repo created (HTTP 201 confirmed during first run). Remote configured correctly on local vault. **Push has NOT landed** — GitHub is unreachable due to ProtonVPN blocking GitHub IPs (140.82.x.x).

### 2. LaunchAgent (macOS Auto-Sync)
- **Plist:** `/Users/owner/Library/LaunchAgents/com.hasan.wiki-auto-update.plist`
- **Script:** `/Users/owner/.claude/scripts/wiki-startup-check.sh`
- **Triggers:** On every login/startup + every hour (StartInterval=3600)
- **Throttle:** 60s delay after login before first run
- **Logs:**
  - stdout → `~/.claude/logs/wiki-launchd.log`
  - stderr → `~/.claude/logs/wiki-launchd-error.log`
- **Status (2026-04-07):** Loaded ✅ (`launchctl load` confirmed)

### 3. What the LaunchAgent Does Each Hour
1. `git pull --rebase --autostash origin main` — pulls any VPS-pushed wiki changes
2. Checks if wiki update already ran today (marker file `wiki-update-ran-YYYYMMDD.marker`)
3. If not: runs `/Users/owner/.claude/scripts/wiki-nightly-update.py`
4. Pushes vault back to GitHub via `sync-vault.sh`

### 4. VPS Sync (NOT YET CONFIGURED)
- **Target:** `root@5.181.218.166`
- **SSH key:** `~/.ssh/zarabot_vps` (no passphrase)
- **Plan:** Clone `second-brain` repo → set up cron to pull + push on schedule
- **Status (2026-04-07):** SSH to VPS also timing out (same ProtonVPN block). **Step 5 of setup script never ran.**

---

## Current State (2026-04-07)

| Component | Status |
|-----------|--------|
| GitHub repo `tubby124/second-brain` | Created ✅ (API call succeeded step 1) |
| Local vault remote configured | ✅ |
| LaunchAgent loaded | ✅ |
| Vault pushed to GitHub | ❌ — network blocked |
| VPS configured | ❌ — SSH blocked |

### Blocker: ProtonVPN
GitHub's IP range (140.82.x.x) is completely unreachable — ping shows 100% packet loss. `curl`, `git push`, `gh cli`, and SSH to github.com all time out. The ProtonVPN service is listed in `networksetup -listallnetworkservices` — likely active and routing through a server that blocks GitHub.

**Fix:** Disable ProtonVPN (or enable split-tunnel excluding GitHub) then run:
```bash
bash /Users/owner/.claude/scripts/full-github-vps-setup.sh
```

Or manually just push the vault:
```bash
cd ~/Downloads/Obsidian\ Vault && git push -u origin main
```

---

## Setup Script Location

```
/Users/owner/.claude/scripts/full-github-vps-setup.sh
```

The script is idempotent — safe to re-run. Steps 1-4 will skip gracefully if already done. Steps 3 and 5 will retry.

---

## File Map

| File | Purpose |
|------|---------|
| `~/.claude/scripts/full-github-vps-setup.sh` | One-shot setup: create repo + push + VPS config |
| `~/.claude/scripts/wiki-startup-check.sh` | Called hourly by LaunchAgent: pull → update → push |
| `~/.claude/scripts/wiki-nightly-update.py` | Python script that generates wiki content from project repos |
| `~/Downloads/Obsidian Vault/sync-vault.sh` | Git add/commit/push for the vault |
| `~/Library/LaunchAgents/com.hasan.wiki-auto-update.plist` | macOS LaunchAgent definition |

---

## Logs

```bash
tail -f ~/.claude/logs/wiki-launchd.log
tail -f ~/.claude/logs/wiki-launchd-error.log
cat ~/.claude/logs/github-vps-setup.log
```

---

## Next Steps

- [ ] Disable ProtonVPN (or use split tunnel) and run `git push` on the vault
- [ ] Re-run full setup script once GitHub is reachable — Steps 3 (push) and 5 (VPS) will complete
- [ ] Verify VPS cron is pulling hourly after setup
- [ ] Test the full loop: make a vault change → confirm it appears on VPS within 1 hour
