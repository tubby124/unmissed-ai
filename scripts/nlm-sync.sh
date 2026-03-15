#!/bin/bash
# nlm-sync.sh — Sync all NotebookLM-tracked files to ~/Downloads/unmissed-notebooklm/
# Usage: bash scripts/nlm-sync.sh
#        bash scripts/nlm-sync.sh --check   (dry run — show what changed, don't copy)

PROJECT_ROOT="/Users/owner/Downloads/CALLING AGENTs"
REGISTRY="$PROJECT_ROOT/scripts/nlm-registry.txt"
DEST="$HOME/Downloads/unmissed-notebooklm"
CHECK_ONLY=false
MANIFEST="$DEST/.nlm-manifest"

if [ "${1:-}" = "--check" ]; then CHECK_ONLY=true; fi

# Colors
G='\033[0;32m'; Y='\033[1;33m'; R='\033[0;31m'; C='\033[0;36m'; N='\033[0m'

if [ ! -f "$REGISTRY" ]; then
  printf "${R}Registry not found:${N} %s\n" "$REGISTRY"
  exit 1
fi

mkdir -p "$DEST"

new_count=0; changed_count=0; unchanged_count=0; missing_count=0
new_files=""; changed_files=""

# Lookup previous hash from manifest
prev_hash_for() {
  if [ -f "$MANIFEST" ]; then
    grep "|${1}$" "$MANIFEST" 2>/dev/null | head -1 | cut -d'|' -f1
  fi
}

# Clear tmp manifest
rm -f "$DEST/.nlm-manifest.tmp"

# Process each line in registry
while IFS= read -r line || [ -n "$line" ]; do
  # Split on first pipe
  filepath=$(echo "$line" | cut -d'|' -f1 | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
  description=$(echo "$line" | cut -d'|' -f2- | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')

  # Skip comments and empty lines
  case "$filepath" in ""|\#*) continue;; esac

  # Resolve path
  if echo "$filepath" | grep -q '^/'; then
    resolved="$filepath"
  elif echo "$filepath" | grep -q '^~'; then
    resolved="${HOME}${filepath#\~}"
  else
    resolved="$PROJECT_ROOT/$filepath"
  fi

  if [ ! -f "$resolved" ]; then
    printf "${R}  MISSING${N}  %s\n" "$filepath"
    missing_count=$((missing_count + 1))
    continue
  fi

  # Destination filename
  bname=$(basename "$resolved")
  if [ "$bname" = "notebooklm-ua-context.md" ]; then
    destname="00-MASTER-CONTEXT.md"
  else
    destname="$bname"
  fi

  # Hash comparison
  current_hash=$(md5 -q "$resolved" 2>/dev/null || md5sum "$resolved" | awk '{print $1}')
  prev_hash=$(prev_hash_for "$destname")

  if [ -z "$prev_hash" ]; then
    printf "${G}  NEW${N}      %-45s ${C}%s${N}\n" "$destname" "$description"
    new_files="$new_files$destname|"
    new_count=$((new_count + 1))
  elif [ "$current_hash" != "$prev_hash" ]; then
    printf "${Y}  CHANGED${N}  %-45s ${C}%s${N}\n" "$destname" "$description"
    changed_files="$changed_files$destname|"
    changed_count=$((changed_count + 1))
  else
    unchanged_count=$((unchanged_count + 1))
  fi

  if [ "$CHECK_ONLY" = false ]; then
    cp "$resolved" "$DEST/$destname"
    echo "${current_hash}|${destname}" >> "$DEST/.nlm-manifest.tmp"
  fi

done < "$REGISTRY"

# Finalize manifest
if [ "$CHECK_ONLY" = false ] && [ -f "$DEST/.nlm-manifest.tmp" ]; then
  mv "$DEST/.nlm-manifest.tmp" "$MANIFEST"
fi

# Summary
echo ""
total=$((new_count + changed_count + unchanged_count))
printf "────────────────────────────────────\n"
printf "  ${G}New:${N} %d  ${Y}Changed:${N} %d  Unchanged: %d  ${R}Missing:${N} %d  Total: %d\n" \
  "$new_count" "$changed_count" "$unchanged_count" "$missing_count" "$total"
printf "────────────────────────────────────\n"

if [ $new_count -gt 0 ] || [ $changed_count -gt 0 ]; then
  echo ""
  if [ "$CHECK_ONLY" = true ]; then
    printf "${C}Dry run — no files copied. Run without --check to sync.${N}\n"
  else
    printf "${G}Files synced to:${N} %s\n\n" "$DEST"
    printf "${Y}ACTION REQUIRED — upload these to NotebookLM:${N}\n"

    # Print new files
    IFS='|'
    for f in $new_files; do
      [ -z "$f" ] && continue
      printf "  ${G}+ %s${N}\n" "$f"
    done
    for f in $changed_files; do
      [ -z "$f" ] && continue
      printf "  ${Y}~ %s${N}  (replace existing source)\n" "$f"
    done
    unset IFS
  fi
elif [ $missing_count -eq 0 ]; then
  printf "\n${G}Everything up to date. Nothing to upload.${N}\n"
fi

echo ""
