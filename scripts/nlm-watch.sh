#!/bin/bash
# nlm-watch.sh — Auto-sync tracked files to ~/Downloads/unmissed-notebooklm/ on change
# Runs in background. Started automatically by LaunchAgent on login.
# To start manually: bash scripts/nlm-watch.sh &
# To stop: pkill -f nlm-watch.sh

PROJECT_ROOT="/Users/owner/Downloads/CALLING AGENTs"
SYNC_SCRIPT="$PROJECT_ROOT/scripts/nlm-sync.sh"
LOG="$PROJECT_ROOT/scripts/nlm-watch.log"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] nlm-watch started" >> "$LOG"

# Watch the entire project root + memory folder for changes to .md files
fswatch -o \
  "$PROJECT_ROOT/BUILD_PACKAGES" \
  "$PROJECT_ROOT/memory" \
  "$PROJECT_ROOT/AGENT_APP_ARCHITECTURE.md" \
  "$PROJECT_ROOT/ONBOARDING_LESSONS.md" \
  "/Users/owner/.claude/projects/-Users-owner-Downloads-CALLING-AGENTs/memory/" \
  --include='.*\.md$' --extended --recursive \
| while read -r count; do
    # Debounce: wait 2s so rapid successive saves don't trigger multiple syncs
    sleep 2
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Change detected — syncing..." >> "$LOG"
    bash "$SYNC_SCRIPT" >> "$LOG" 2>&1
done
