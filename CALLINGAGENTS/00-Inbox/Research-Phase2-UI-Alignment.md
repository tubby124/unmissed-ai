---
type: research
status: done
tags: [phase2, ui, ownership-model, agent-brain, onboarding]
related: [[Prompt Architecture Refactor Plan]], [[D278]], [[D280]], [[D283]]
updated: 2026-03-31
---

# Research: Phase 2 — UI Alignment & Agent Brain

Sonar Pro research for how the dashboard UX should surface the prompt sandwich ownership model and agent knowledge visualization.

---

## Query 3: Voice Agent SaaS Onboarding UX & Progressive Disclosure

### Key Findings

**1. Visual layered editor distinguishing platform vs user content.**
Color-code platform-owned sections (safety, voice, flow) as gray/locked and user-editable sections (FAQs, services, hours) as vibrant/unlocked. Labels like "Platform Default (Protected)" vs "Your Business Info" make the ownership model explicit.

**2. First-value onboarding beats feature tours.**
Skip setup tours. Jump to the "aha moment" — after entering hours/services, auto-generate a sample call and play it. Users hear value in under 2 minutes. This aligns with our existing wow-first philosophy (`memory/voice-naturalness.md`).

**3. Action-driven checklists with progressive unlock.**
Linear steps with progress bars. Unlock next only after prior completion:
1. Business basics (hours/FAQs)
2. Preview assembled prompt
3. Test live call
4. Advanced overrides

**4. Decide-for-me defaults for 80% of users.**
User enters "Italian Restaurant, open 11AM-10PM" and AI fills the entire prompt sandwich with industry-tailored defaults. One-click "Use This" button. Power users get a "Customize Everything" toggle that unlocks prompt editing with risk disclaimers.

**5. Role/niche branching at signup loads pre-filled defaults.**
Post-signup question ("Restaurant or Clinic?") loads niche-specific defaults. This maps directly to our niche registry — the niche selection should pre-fill not just the prompt but all dashboard defaults.

### Takeaways for D280 (UI-Driven Prompt Composition) and D278 (Agent Brain)

- **The sandwich model maps naturally to a card-based UI.** Platform bread = collapsed read-only cards at top/bottom. User filling = expandable editable cards in the middle. This is already close to our 19-card settings architecture.
- **Progressive disclosure solves the "too many settings" problem.** New users see 3-4 essential filling cards. Power users unlock the full 19-card view. This avoids the current flat list of settings cards.
- **Decide-for-me is our niche registry.** When a user selects `plumber`, the system should pre-fill FAQs, services, hours patterns, and triage rules from the niche template. The user edits, not creates from scratch.
- **Test call as the gate between steps.** After filling in business content, force a test call before considering setup "complete." This validates the sandwich output, not just the inputs.

### Conflict Check
- **Minor tension with D283 (all variables visible).** Progressive disclosure hides variables from new users, but D283 wants all variables visible and editable. Resolution: all variables ARE accessible, but grouped into "Essential" (always visible) and "Advanced" (collapsed by default). D283 is satisfied because nothing is hidden — just progressively disclosed.
- **No conflict with our sandwich model.** The research validates bread/filling separation in the UI.

---

## Query 4: AI Agent Knowledge Dashboards & "What Your Agent Knows"

### Key Findings

**1. No dominant pattern exists yet in the market.**
Sonar found no specific public examples from Intercom, Ada, Voiceflow, Retell, Bland, or Vapi showing "what your agent knows" dashboards. This is a **greenfield opportunity** — our Agent Brain (D278) would be differentiated.

**2. Visual brain maps / hierarchical node UIs.**
Expandable tree structures for categories like "FAQs > Booking > Rules" with inline editing and AI suggestions. Think of it as a mind-map where each node is an editable knowledge chunk.

**3. Natural language editing makes it feel like teaching.**
Instead of forms, let users say "My salon closes at 7 PM — update agent." The system parses this into the correct knowledge field. For voice agent SaaS, this is especially fitting — users who buy a voice product are comfortable with voice/text input.

**4. Proactive gap detection.**
AI analyzes agent interactions to highlight gaps: "Low accuracy on hours — add details?" and "Agent was asked about pricing 12 times but has no pricing info." This maps directly to our knowledge gap bridge (D270, D252).

**5. Multimodal previews for voice agents.**
Play audio samples of how the agent uses each knowledge chunk. Users hear the agent say their hours, then edit if it sounds wrong. This is a powerful feedback loop.

**6. Niche-contextual categories.**
Knowledge should be organized by niche-relevant categories, not generic buckets. A plumber sees "Services | Emergency Rates | Service Area | Hours" while a salon sees "Services | Stylists | Booking Rules | Hours." This maps to D279 (niche-contextual knowledge editing).

### Takeaways for D278 (Agent Brain Dashboard)

- **We're building something novel.** No competitor has a unified "what your agent knows" view. This is a real differentiator.
- **Category structure should come from the niche registry.** Each niche defines its knowledge categories. The Agent Brain dashboard renders those categories as expandable sections with the actual knowledge chunks inside.
- **Gap detection is the killer feature.** Show "Your agent was asked X but didn't know the answer" alongside the knowledge editor. Users fill gaps naturally.
- **Audio preview of knowledge in action.** After editing a FAQ, let the user hear a simulated call snippet where the agent uses that FAQ. This closes the teaching loop.
- **Inline editing, not separate forms.** Click on any knowledge chunk to edit it in place. No navigation to a separate page.

### Conflict Check
- **Potential tension with knowledge_chunks as source of truth.** The Agent Brain UI would show a unified view, but our backend has knowledge split across `clients.extra_qa`, `clients.business_facts`, `clients.context_data`, and `knowledge_chunks` table. The UI must abstract over this fragmentation. This is a backend concern for Phase 4+, not a Phase 2 blocker.
- **No conflict with our architecture.** The research validates the Agent Brain concept and adds the gap-detection and audio-preview ideas as enhancements.

---

## Cross-Query Synthesis

| Research Finding | Our D-Item | Alignment |
|-----------------|-----------|-----------|
| Typed slot registry with compile-time safety | D274 (Named Slots) | VALIDATES approach |
| Shadow testing with incremental slot migration | D285 (Sandwich Framework) | VALIDATES approach |
| Layered card UI with platform vs user ownership | D280 (UI-Driven Composition) | VALIDATES approach |
| Decide-for-me defaults from niche | D273 (Collect What Matters) | VALIDATES approach |
| Progressive disclosure for settings | D283 (Variable Visibility) | MINOR TENSION — resolved via essential/advanced grouping |
| Agent Brain as unified knowledge view | D278 (Agent Brain) | VALIDATES — greenfield opportunity |
| Niche-contextual knowledge categories | D279 (Niche Knowledge Editing) | VALIDATES approach |
| Gap detection from call data | D270 (Frequent KB Query Promotion) | VALIDATES approach |
| Audio preview of knowledge | NEW — not in tracker | ENHANCEMENT — add to D278 scope |

### Key Insight
The market has no dominant "agent brain" dashboard pattern. We have a chance to define this category. The combination of niche-contextual categories + gap detection + audio preview + inline editing would be a genuine differentiator for unmissed.ai.

### No Blocking Conflicts
All 4 Sonar queries validate our existing execution plan. The only tension (progressive disclosure vs all-variables-visible) is resolved by grouping, not hiding.
