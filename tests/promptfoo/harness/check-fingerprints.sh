#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# check-fingerprints.sh — niche-agnostic sacred-substring regression test
# ─────────────────────────────────────────────────────────────────────────────
# Asserts every line of a niche fingerprint file appears verbatim in a built
# system_prompt snapshot. Designed to gate prompt slim/refactor changes and
# catch silent drop of load-bearing safety / scope / completion rules.
#
# Usage:
#   ./check-fingerprints.sh <snapshot.txt> <fingerprints.txt>
#
# Example (property_management — Brian, post-slim):
#   ./check-fingerprints.sh \
#     tests/promptfoo/snapshots/brian-slimmed-2026-06-02-draft.txt \
#     tests/promptfoo/harness/fingerprints/property_management.txt
#
# Exit codes:
#   0  — all fingerprints found
#   1  — one or more fingerprints missing (slim broke a sacred rule)
#   2  — invocation error (missing file, wrong args)
#
# Why this exists:
#   The May 2026-05-05 prompt trim AND the in-flight Phase 6 slim both target
#   the property_management TRIAGE_DEEP block. The trim accidentally dropped
#   the FHA penalty fingerprint once (caught via in-prod hallucination). This
#   script makes that class of regression impossible to ship.
#
# Reusable per client:
#   • property_management → tests/promptfoo/harness/fingerprints/property_management.txt
#   • real_estate         → tests/promptfoo/harness/fingerprints/real_estate.txt  (TODO)
#   • auto_glass          → tests/promptfoo/harness/fingerprints/auto_glass.txt   (TODO)
#   • ...
# Add a new niche file once, every client of that niche inherits the gate.
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "usage: $0 <snapshot.txt> <fingerprints.txt>" >&2
  exit 2
fi

SNAPSHOT="$1"
FINGERPRINTS="$2"

if [[ ! -f "$SNAPSHOT" ]]; then
  echo "[fingerprint-check] ERROR: snapshot not found: $SNAPSHOT" >&2
  exit 2
fi

if [[ ! -f "$FINGERPRINTS" ]]; then
  echo "[fingerprint-check] ERROR: fingerprint list not found: $FINGERPRINTS" >&2
  exit 2
fi

PASS=0
FAIL=0
MISSING=()

echo "════════════════════════════════════════════════════════════════════"
echo "FINGERPRINT CHECK"
echo "════════════════════════════════════════════════════════════════════"
echo "snapshot:     $SNAPSHOT ($(wc -c < "$SNAPSHOT" | tr -d ' ') chars)"
echo "fingerprints: $FINGERPRINTS"
echo "────────────────────────────────────────────────────────────────────"

while IFS= read -r line || [[ -n "$line" ]]; do
  # Strip leading/trailing whitespace
  trimmed="$(echo "$line" | sed -E 's/^[[:space:]]+|[[:space:]]+$//g')"
  # Skip blank lines and comments
  [[ -z "$trimmed" || "$trimmed" =~ ^# ]] && continue

  if grep -qF -- "$trimmed" "$SNAPSHOT"; then
    PASS=$((PASS + 1))
    printf "  [PASS] %s\n" "$trimmed"
  else
    FAIL=$((FAIL + 1))
    MISSING+=("$trimmed")
    printf "  [FAIL] %s\n" "$trimmed"
  fi
done < "$FINGERPRINTS"

echo "────────────────────────────────────────────────────────────────────"
TOTAL=$((PASS + FAIL))
printf "Result: %d/%d fingerprints found" "$PASS" "$TOTAL"

if [[ $FAIL -eq 0 ]]; then
  echo " — ALL CLEAR"
  exit 0
fi

echo " — $FAIL MISSING"
echo ""
echo "Missing fingerprints (slim dropped these):"
for m in "${MISSING[@]}"; do
  printf "  - %s\n" "$m"
done
exit 1
