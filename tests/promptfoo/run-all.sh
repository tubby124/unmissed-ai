#!/usr/bin/env bash
# Run all promptfoo pre-deploy tests for unmissed.ai clients
# Usage: ./tests/promptfoo/run-all.sh [client]
#   client: urban-vibe | windshield-hub | hasan-sharif | all (default)
# Requires: OPENROUTER_API_KEY env var (already exported in ~/.zshrc)
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLIENT="${1:-all}"
PASS=0
FAIL=0

run_test() {
  local slug="$1"
  echo ""
  echo "=== $slug ==="
  if promptfoo eval -c "$SCRIPT_DIR/$slug.yaml" --no-progress-bar; then
    echo "PASS: $slug"
    PASS=$((PASS + 1))
  else
    echo "FAIL: $slug"
    FAIL=$((FAIL + 1))
  fi
}

if [ "$CLIENT" = "all" ]; then
  for yaml in "$SCRIPT_DIR"/*.yaml; do
    slug=$(basename "$yaml" .yaml)
    run_test "$slug"
  done
else
  run_test "$CLIENT"
fi

echo ""
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
