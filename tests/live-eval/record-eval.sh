#!/usr/bin/env bash
# Record live eval results for voice agent regression testing
# Usage:
#   ./tests/live-eval/record-eval.sh <scenario-id> <call-id> <pass|fail> ["notes"]
#   ./tests/live-eval/record-eval.sh --stats                 # show pass/fail summary
#   ./tests/live-eval/record-eval.sh --stats <date>          # filter by date (YYYY-MM-DD)
#   ./tests/live-eval/record-eval.sh --client windshield-hub <scenario-id> <call-id> <pass|fail> ["notes"]
#
# Results are appended to tests/live-eval/results.csv
# See EVAL_MATRIX.md for scenario definitions

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RESULTS_FILE="$SCRIPT_DIR/results.csv"

# Valid scenario IDs
VALID_SCENARIOS="M1 M2 M3 M4 B1 B2 B3 B4 AH1 AH2 AH3 E1 E2 E3 U1 U2 U3 U4 A1 A2 A3 A4 A5 A6 A7 PM1 PM2 PM3 PM4 PM5"

# Default client (canary)
CLIENT="hasan-sharif"

# Ensure CSV exists with header
if [ ! -f "$RESULTS_FILE" ]; then
  echo "date,client,scenario_id,call_id,result,notes" > "$RESULTS_FILE"
fi

# Parse --client flag
if [ "${1:-}" = "--client" ]; then
  CLIENT="$2"
  shift 2
fi

# Handle --stats
if [ "${1:-}" = "--stats" ]; then
  DATE_FILTER="${2:-}"
  if [ ! -f "$RESULTS_FILE" ] || [ "$(wc -l < "$RESULTS_FILE")" -le 1 ]; then
    echo "No results recorded yet."
    exit 0
  fi

  if [ -n "$DATE_FILTER" ]; then
    DATA=$(tail -n +2 "$RESULTS_FILE" | grep "^$DATE_FILTER")
  else
    DATA=$(tail -n +2 "$RESULTS_FILE")
  fi

  if [ -z "$DATA" ]; then
    echo "No results found${DATE_FILTER:+ for $DATE_FILTER}."
    exit 0
  fi

  TOTAL=$(echo "$DATA" | wc -l | tr -d ' ')
  PASS=$(echo "$DATA" | grep -c ',pass,' || true)
  FAIL=$(echo "$DATA" | grep -c ',fail,' || true)

  echo "=== Live Eval Results${DATE_FILTER:+ ($DATE_FILTER)} ==="
  echo "  Pass: $PASS"
  echo "  Fail: $FAIL"
  echo "  Total: $TOTAL"
  echo ""

  if [ "$FAIL" -gt 0 ]; then
    echo "Failed scenarios:"
    echo "$DATA" | grep ',fail,' | while IFS=, read -r date client scenario call_id result notes; do
      echo "  $scenario ($client) — call: $call_id — $notes"
    done
    echo ""
    echo "Run /review-call <call-id> for each failure."
  fi

  exit 0
fi

# Validate arguments
if [ $# -lt 3 ]; then
  echo "Usage: $0 [--client <slug>] <scenario-id> <call-id> <pass|fail> [\"notes\"]"
  echo ""
  echo "Scenario IDs: $VALID_SCENARIOS"
  echo "Default client: hasan-sharif (override with --client)"
  exit 1
fi

SCENARIO="$1"
CALL_ID="$2"
RESULT="$3"
NOTES="${4:-}"
DATE=$(date +%Y-%m-%d)

# Validate scenario ID
if ! echo "$VALID_SCENARIOS" | grep -qw "$SCENARIO"; then
  echo "ERROR: Unknown scenario '$SCENARIO'"
  echo "Valid IDs: $VALID_SCENARIOS"
  exit 1
fi

# Validate call ID is not empty
if [ -z "$CALL_ID" ]; then
  echo "ERROR: call-id cannot be empty"
  exit 1
fi

# Validate result
if [ "$RESULT" != "pass" ] && [ "$RESULT" != "fail" ]; then
  echo "ERROR: Result must be 'pass' or 'fail', got '$RESULT'"
  exit 1
fi

# Escape notes (replace commas with semicolons for CSV safety)
NOTES_SAFE=$(echo "$NOTES" | tr ',' ';')

# Append to CSV
echo "$DATE,$CLIENT,$SCENARIO,$CALL_ID,$RESULT,$NOTES_SAFE" >> "$RESULTS_FILE"

echo "Recorded: $SCENARIO ($CLIENT) — $RESULT"

# Show current session stats
TOTAL=$(tail -n +2 "$RESULTS_FILE" | grep "^$DATE" | wc -l | tr -d ' ')
PASS=$(tail -n +2 "$RESULTS_FILE" | grep "^$DATE" | grep -c ',pass,' || true)
FAIL=$(tail -n +2 "$RESULTS_FILE" | grep "^$DATE" | grep -c ',fail,' || true)
echo "Today: $PASS pass / $FAIL fail / $TOTAL total"

# Remind about /review-call on failure
if [ "$RESULT" = "fail" ]; then
  echo ""
  echo ">>> FAILURE recorded. Run: /review-call $CALL_ID"
fi
