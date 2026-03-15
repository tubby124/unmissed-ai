# unmissed.ai — Build Packages

> **Purpose:** Canonical templates for deploying new AI voice agent clients.
> Fill the intake form → substitute `{{VARIABLES}}` → paste prompt → test → go live.
> Every learning from every client gets added back here — this doc gets smarter with every build.

---

## Available Build Packages

| Package | Agent Type | Use Case | Intake Form | Prompt Template |
|---------|-----------|----------|-------------|-----------------|
| `INBOUND_VOICE_AGENT/` | Inbound receptionist | Customer calls in — agent handles, qualifies, routes | `INTAKE_FORM_INBOUND.md` | `PROMPT_TEMPLATE_INBOUND.md` |
| `OUTBOUND_ISA_AGENT/` | Outbound ISA caller | Agent calls out to leads — collects data, books, qualifies | `INTAKE_FORM_ISA.md` | `PROMPT_TEMPLATE_ISA.md` |

---

## Client Onboarding Flow (Both Types)

```
Step 1 → Pick package (inbound or outbound?)
Step 2 → Fill intake form with client (20-30 min call)
Step 3 → Map answers to {{VARIABLES}} in the prompt template
Step 4 → Replace every {{VARIABLE}} — zero left behind
Step 5 → Write client-specific PRODUCT KNOWLEDGE BASE (8-12 Q&A entries)
Step 6 → Paste completed prompt → Google Sheets → System Prompt → A2
Step 7 → Deploy n8n workflow (see Workflow Reference below)
Step 8 → Test one live call before production launch
Step 9 → Document any new learnings in the relevant template
```

---

## Workflow Reference

| Package | Workflow Architecture | Template Location |
|---------|----------------------|-------------------|
| Inbound | 1-workflow (voice agent + Twilio + Sheets + cron summary) | `WINDSHIELD HUB AUTO GLASS SYSTEM/workflow_change15_cron.json` |
| Outbound ISA | 3-workflow system (outbound dialer + call completion + calendar booking) | `MANZIL REALTY ISA SYSTEM/create_manzil_isa.py` |

---

## Reference Deployments (Completed Clients)

| Package | Client | Status | Docs |
|---------|--------|--------|------|
| Inbound | Windshield Hub Auto Glass (Saskatoon) | ✅ Production — 8,445+ calls | `WINDSHIELD HUB AUTO GLASS SYSTEM/SYSTEM_DOCUMENTATION.md` |
| Outbound ISA | Manzil Realty ISA — Fatima (Saskatoon) | 🧪 TEST MODE — 5 calls, 4/4 fields validated | `MANZIL REALTY ISA SYSTEM/SYSTEM_DOCUMENTATION.md` |

---

## Design Principles

**1. Variables over hardcoding.** Everything client-specific is a `{{VARIABLE}}`. Zero hardcoded client values in templates.

**2. Document every learning.** Every bug, every unexpected model behavior, every prompt fix gets added to the relevant template's "What Changed" section and to DEPLOYMENT_GOTCHAS.md. Future builds don't repeat old mistakes.

**3. FORBIDDEN ACTIONS at the top.** Rules placed in the first 50 lines of a prompt get highest model weight in Llama 3.3 70B. Critical rules — the ones that must NEVER break — go there.

**4. Examples beat abstract rules.** Inline few-shot dialogue examples consistently outperform abstract instructions like "always collect X before closing." Add 2-3 examples per critical behavior.

**5. COMPLETION CHECK before hangUp.** Every template has a mandatory gate: all required fields must be collected before the agent closes the call. This is the single most important rule for data collection agents.

**6. Test before production.** Always fire one real call before switching from test leads to real leads. Check: fields collected, email sent, Telegram received, Sheets updated.

---

## Adding a New Build Package

When a new agent type is built (outbound appointment setter, inbound scheduler, etc.):

1. Create a new folder: `BUILD_PACKAGES/[AGENT_TYPE]/`
2. Copy the closest existing package as starting point
3. Update all sections for the new agent type
4. Add a completed reference client example
5. Add the new row to the table above
6. Update MEMORY.md

---

## Version History

| Date | Change |
|------|--------|
| Feb 24, 2026 | Initial BUILD_PACKAGES structure created. INBOUND v2.0 (Lyra-optimized, 20 variables, generic). OUTBOUND ISA v2.1 (generalized from Manzil v4.4 live-tested). |
