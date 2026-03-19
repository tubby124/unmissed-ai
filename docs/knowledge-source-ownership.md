# Knowledge Source Ownership

Which field owns what data, with examples and anti-patterns.

---

## Fields

### Business Facts (`business_facts`)
**Purpose:** Core business info your agent always knows — hours, location, team members, services.
**Injected as:** `businessFacts` context parameter on every call.

**Good examples:**
- "Open Mon-Fri 8am-5pm, Sat 9am-1pm. Closed Sundays."
- "Our lead tech is Ryan. Ask for him by name for windshield calibrations."
- "Free parking out front. We're next to the Walmart on 22nd St."

**Anti-patterns (don't put here):**
- Pricing tables or inventory lists (use Context Data)
- Full Q&A pairs (use Extra Q&A)
- Entire policy documents (use Knowledge Base section in prompt, or upload to corpus)

---

### Extra Q&A (`extra_qa`)
**Purpose:** Common questions and answers. Your agent uses these to answer caller questions directly.
**Injected as:** `extraQa` context parameter — formatted as Q/A pairs.

**Good examples:**
- Q: "Do you do mobile service?" A: "Yes, we come to you anywhere in Saskatoon for an extra $25."
- Q: "What forms of payment do you accept?" A: "Cash, debit, Visa, Mastercard, and e-transfer."
- Q: "Do I need an appointment?" A: "Walk-ins are welcome but appointments are recommended to guarantee a time slot."

**Anti-patterns (don't put here):**
- Long narrative answers (keep each answer under 2 sentences)
- Data that changes frequently like pricing or inventory (use Context Data)
- Business hours or location (use Business Facts)

---

### Context Data (`context_data`)
**Purpose:** Reference data like pricing tables, inventory, or schedules. Your agent looks up specific details here.
**Injected as:** `contextData` parameter — supports markdown tables and free text. Max 32,000 chars.
**Label:** Set `context_data_label` so the agent knows what it's looking at (e.g. "Tenant List", "Price Sheet").

**Good examples:**
- A CSV/markdown table of tenants with unit numbers, names, and rent amounts
- A pricing menu with services and costs
- An inventory list with stock status

**Anti-patterns (don't put here):**
- Static facts that never change (use Business Facts)
- Q&A formatted content (use Extra Q&A)
- Documents longer than 32K chars (upload to Knowledge Base corpus)

---

### Knowledge Base (prompt section `knowledge`)
**Purpose:** Services, pricing, and FAQs embedded directly in the system prompt.
**Lives in:** The `## KNOWLEDGE BASE` section of the system prompt (edited via the Knowledge Base section editor).

**Good examples:**
- A summary of all services offered with brief descriptions
- Key policies the agent must know verbatim (return policy, warranty terms)
- Short FAQ content that should be in the prompt at all times

**Anti-patterns (don't put here):**
- Large data tables (use Context Data — keeps prompt size manageable)
- Content that changes weekly or more often (use Context Data or Business Facts, which are easier to update without touching the prompt)

---

## Decision Matrix

| Question | Use This Field |
|----------|---------------|
| Is it a fact the agent should always know? | Business Facts |
| Is it a question callers ask frequently? | Extra Q&A |
| Is it tabular data the agent looks up? | Context Data |
| Is it a policy or service description? | Knowledge Base (prompt) |
| Is it longer than 32K chars? | Corpus upload (when available) |
| Does it change more than monthly? | Context Data (easiest to update) |
