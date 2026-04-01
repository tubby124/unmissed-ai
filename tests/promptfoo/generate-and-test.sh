#!/usr/bin/env bash
# Generate a prompt for a random business via the intelligence pipeline,
# then run promptfoo tests against it.
#
# Usage: ./tests/promptfoo/generate-and-test.sh [business_name] [niche]
#   Defaults: "Red Swan Pizza" restaurant
#
# Requires: OPENROUTER_API_KEY, node, npx promptfoo
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

BUSINESS_NAME="${1:-Red Swan Pizza}"
NICHE="${2:-restaurant}"
AGENT_NAME="${3:-Sofia}"
CITY="${4:-Calgary}"

OUT_DIR="$SCRIPT_DIR/generated"
mkdir -p "$OUT_DIR"

echo "=== Agent Intelligence Pipeline Test ==="
echo "Business: $BUSINESS_NAME ($NICHE)"
echo "Agent: $AGENT_NAME | City: $CITY"
echo ""

# Step 1: Generate agent intelligence seed via Haiku
echo "Step 1: Generating agent intelligence seed..."
SEED=$(curl -s https://openrouter.ai/api/v1/chat/completions \
  -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  -H "Content-Type: application/json" \
  -d "$(cat <<EOJSON
{
  "model": "anthropic/claude-haiku-4-5",
  "max_tokens": 1500,
  "temperature": 0.1,
  "messages": [{
    "role": "user",
    "content": "You are an expert voice agent designer. You configure AI phone answering agents for small businesses.\n\nBUSINESS CONTEXT:\nBusiness: \"$BUSINESS_NAME\" — a $NICHE\nLocation: $CITY\nAgent name: $AGENT_NAME\n\nGenerate 4 fields:\n\nFIELD 1 — TRIAGE_DEEP\nIntent routing blocks. 3-5 intents specific to this business type.\nEach block: INTENT_NAME:\\nAsk: specific question\\nTriggers: 4-6 phrases\\n→ Collect: fields\\n→ Outcome: book/quote/answer/message\nAdd URGENT + SPAM blocks.\n\nFIELD 2 — GREETING_LINE\nOpening line: business name + agent name + 2-3 capabilities + open question.\n\nFIELD 3 — URGENCY_KEYWORDS\n8-12 comma-separated phrases that signal urgency for THIS business.\n\nFIELD 4 — FORBIDDEN_EXTRA\n2-4 NEVER rules specific to this business type.\n\nReturn ONLY valid JSON:\n{\"TRIAGE_DEEP\":\"...\",\"GREETING_LINE\":\"...\",\"URGENCY_KEYWORDS\":\"...\",\"FORBIDDEN_EXTRA\":\"...\"}"
  }]
}
EOJSON
)" | jq -r '.choices[0].message.content')

# Extract JSON from response
SEED_JSON=$(echo "$SEED" | grep -o '{.*}' | head -1)
if [ -z "$SEED_JSON" ]; then
  echo "ERROR: Failed to generate intelligence seed"
  echo "Raw response: $SEED"
  exit 1
fi

echo "Seed generated. Parsing..."
TRIAGE_DEEP=$(echo "$SEED_JSON" | jq -r '.TRIAGE_DEEP // ""')
GREETING_LINE=$(echo "$SEED_JSON" | jq -r '.GREETING_LINE // ""')
URGENCY_KEYWORDS=$(echo "$SEED_JSON" | jq -r '.URGENCY_KEYWORDS // ""')
FORBIDDEN_EXTRA=$(echo "$SEED_JSON" | jq -r '.FORBIDDEN_EXTRA // ""')

echo "  Intents: $(echo "$TRIAGE_DEEP" | grep -c ':' || echo 0) blocks"
echo "  Greeting: ${GREETING_LINE:0:80}..."
echo "  Urgency keywords: $(echo "$URGENCY_KEYWORDS" | tr ',' '\n' | wc -l | tr -d ' ') triggers"
echo ""

# Step 2: Build the full prompt via the TS prompt builder
echo "Step 2: Building full prompt from intake..."
PROMPT=$(cd "$PROJECT_DIR" && node --experimental-specifier-resolution=node -e "
const { buildPromptFromIntake } = require('./src/lib/prompt-builder');

const intake = {
  niche: '$NICHE',
  business_name: $(jq -Rn --arg v "$BUSINESS_NAME" '$v'),
  agent_name: $(jq -Rn --arg v "$AGENT_NAME" '$v'),
  city: $(jq -Rn --arg v "$CITY" '$v'),
  call_handling_mode: 'triage',
  agent_mode: 'lead_capture',
  niche_custom_variables: {
    TRIAGE_DEEP: $(echo "$TRIAGE_DEEP" | jq -Rs .),
    GREETING_LINE: $(echo "$GREETING_LINE" | jq -Rs .),
    URGENCY_KEYWORDS: $(echo "$URGENCY_KEYWORDS" | jq -Rs .),
    FORBIDDEN_EXTRA: $(echo "$FORBIDDEN_EXTRA" | jq -Rs .)
  }
};

try {
  const prompt = buildPromptFromIntake(intake);
  process.stdout.write(prompt);
} catch (e) {
  console.error('Build failed:', e.message);
  process.exit(1);
}
" 2>/dev/null) || true

# Fallback: if TS build doesn't work (common in non-compiled env), use tsx
if [ -z "$PROMPT" ]; then
  echo "  (falling back to tsx runner...)"
  PROMPT=$(cd "$PROJECT_DIR" && npx tsx -e "
import { buildPromptFromIntake } from './src/lib/prompt-builder';

const intake = {
  niche: '$NICHE',
  business_name: $(jq -Rn --arg v "$BUSINESS_NAME" '$v'),
  agent_name: $(jq -Rn --arg v "$AGENT_NAME" '$v'),
  city: $(jq -Rn --arg v "$CITY" '$v'),
  call_handling_mode: 'triage',
  agent_mode: 'lead_capture',
  niche_custom_variables: {
    TRIAGE_DEEP: $(echo "$TRIAGE_DEEP" | jq -Rs .),
    GREETING_LINE: $(echo "$GREETING_LINE" | jq -Rs .),
    URGENCY_KEYWORDS: $(echo "$URGENCY_KEYWORDS" | jq -Rs .),
    FORBIDDEN_EXTRA: $(echo "$FORBIDDEN_EXTRA" | jq -Rs .)
  }
};

const prompt = buildPromptFromIntake(intake);
process.stdout.write(prompt);
" 2>/dev/null) || true
fi

if [ -z "$PROMPT" ]; then
  echo "ERROR: Could not build prompt (TS execution failed)"
  echo "Saving seed to $OUT_DIR/seed.json for manual inspection"
  echo "$SEED_JSON" | jq . > "$OUT_DIR/seed.json"
  exit 1
fi

# Save generated prompt
echo "$PROMPT" > "$OUT_DIR/SYSTEM_PROMPT_GENERATED.txt"
echo "  Prompt saved: $OUT_DIR/SYSTEM_PROMPT_GENERATED.txt ($(echo "$PROMPT" | wc -c | tr -d ' ') chars)"
echo ""

# Also save the seed for inspection
echo "$SEED_JSON" | jq . > "$OUT_DIR/seed.json"

# Step 3: Run promptfoo tests
echo "Step 3: Running promptfoo behavioral tests..."
echo ""

promptfoo eval -c "$SCRIPT_DIR/generated-agent-test.yaml" --no-progress-bar

echo ""
echo "=== Done ==="
echo "Prompt: $OUT_DIR/SYSTEM_PROMPT_GENERATED.txt"
echo "Seed:   $OUT_DIR/seed.json"
echo ""
echo "To view results: promptfoo view"
