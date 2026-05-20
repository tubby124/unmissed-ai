# Zara Improvement Loop

## Edit Surfaces

- Prompt: `clients/unmissed-demo/SYSTEM_PROMPT.txt`
- Prompt test copy: `clients/unmissed-demo/SYSTEM_PROMPT_TEST.txt`
- Product/RAG source: `clients/unmissed-demo/domain-knowledge.md`
- Knowledge seeding: `scripts/seed-demo-knowledge.py`
- Fault log: `clients/unmissed-demo/ZARA_FAULT_LOG.md`
- Prompt tests: `tests/promptfoo/unmissed-demo.yaml`

## What Goes Where

Prompt changes are for stable behavior: tone, tool rules, pricing anchor, safety, close paths, and what Zara should never do.

Knowledge changes are for evolving truth: features, customer examples, objections, competitor comparisons, roadmap, setup details, and new use cases.

Fault log entries are for call-specific issues and fixes.

Vault updates are only for reusable lessons after the repo change is verified. Do not store secrets, private customer data, raw transcripts, or phone numbers in the vault.

## Update Flow

1. Review call transcript, tool invocations, and demo scorecard.
2. Classify the issue as prompt, knowledge, runtime/tooling, pricing/product truth, voice/VAD, or docs.
3. Add a fault log entry.
4. Patch the smallest surface that fixes the issue.
5. Run prompt contract, demo tool, scorecard, pricing drift, and promptfoo checks.
6. Deploy with `python3 scripts/deploy_prompt.py unmissed-demo "change description"`.
7. Run a live call-me test for SMS, RAG, booking, owner alert truth, and closing.
