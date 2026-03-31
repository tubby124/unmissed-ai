---
type: research
status: done
tags: [phase2, slots, architecture, shadow-testing]
related: [[Prompt Architecture Refactor Plan]], [[D274]], [[D285]]
updated: 2026-03-31
---

# Research: Phase 2 — Slot Architecture & Shadow Testing

Sonar Pro research for Phase 2 of the prompt architecture refactor (named slots + shadow testing).

---

## Query 1: TypeScript Template Composition with Typed Slot Registries

### Key Findings

**1. Builder pattern with compile-time slot completeness checking.**
The strongest pattern uses a generic `PromptBuilder<Provided>` class where each `.register(key, builder)` call narrows the type. The `.build()` method returns `never` unless all required slots are provided. This gives compile-time guarantees that no slot is missing.

```typescript
class PromptBuilder<Provided extends Partial<PromptSlots> = {}> {
  register<K extends SlotKey>(key: K, builder: SlotBuilder<K>):
    PromptBuilder<Provided & Record<K, SlotBuilder<K>>> { ... }
  build(): Provided extends PromptSlots ? string : never { ... }
}
```

**2. Each slot is a typed builder function, not a raw string.**
`SlotBuilder<K> = (input: SlotInput<K>) => string` — each slot has its own input shape. The identity slot needs `agent_name`, the safety slot needs `niche`, the hours slot needs `business_hours_weekday/weekend`. This maps directly to our `clients` row fields.

**3. Template literal types for structured keys.**
Using `type SlotKey = 'SAFETY_RULES' | 'IDENTITY' | 'VOICE_STYLE' | ...` with mapped types ensures the registry is exhaustive. Adding a new slot to the union forces all consumers to handle it.

**4. Generic extensibility per agent type.**
`type AgentSlots<TNiche extends string>` pattern allows niche-specific slot registries. A `real_estate` agent could have slots that `auto_glass` doesn't, with type safety enforcing the difference.

### Takeaways for D274 (Named Slots)

- Our current `buildPrompt()` returns a flat string. The refactor should introduce a `SlotRegistry` where each slot is a typed builder function.
- The builder pattern with progressive type narrowing fits perfectly — we can enforce at compile time that all required slots are filled.
- Slot builders should accept a typed subset of the `clients` row, not the full row. This makes dependencies explicit.
- The `build()` method assembles slots in sandwich order (top bread -> filling -> bottom bread) and returns the final prompt string.
- **No conflict with our existing approach.** This is a cleaner version of what `buildPrompt()` already does implicitly.

### Risk: Over-engineering
The Sonar results show heavily generic patterns. For our use case, we likely need 8-12 fixed slots, not an arbitrarily extensible system. Keep the registry simple — a record of `SlotKey -> BuilderFn` with a fixed key union, not a fully generic type-narrowing builder class.

---

## Query 2: Shadow Testing for Byte-Identical Output Migration

### Key Findings

**1. Dual-path execution with automated comparison.**
The core pattern: route identical inputs to both old and new implementations, capture both outputs, assert byte-identical results. This is exactly what our golden tests already do partially — but shadow testing extends it to ALL inputs, not just test fixtures.

**2. Incremental validation is critical.**
Don't validate the entire refactored system at once. Test one slot at a time:
- Phase 2a: Shadow test SAFETY_RULES slot only (old builder vs new slot builder)
- Phase 2b: Add IDENTITY slot, compare full output
- Phase 2c: Continue until all slots are shadowed
- Phase 2d: Full shadow — new system produces entire prompt, compare against old

**3. Environment parity matters.**
Both old and new paths must receive identical `clients` row data. Any transformation or normalization differences will produce false mismatches.

**4. Whitespace and encoding are the #1 source of false failures.**
For text/string output systems specifically:
- Normalize line endings (CRLF vs LF)
- Be explicit about trailing whitespace
- Watch for different template engines handling empty variables differently (empty string vs missing section)

**5. Log-based comparison catches subtle regressions.**
Beyond byte-identical output, capture execution metadata: which slots were filled, which were skipped, what conditional branches were taken. This helps debug mismatches.

### Takeaways for Our Shadow Testing Strategy

- **Golden tests are our foundation.** `prompt-builder-golden.test.ts` already captures expected outputs. Phase 2 extends this with a shadow comparator.
- **Shadow wrapper pattern:** Create a `buildPromptShadow(clientRow)` that calls both `buildPrompt()` (old) and `composeFromSlots()` (new), asserts equality, returns the old result. Deploy this in test/dev only.
- **Incremental slot migration:** Don't rewrite all slots at once. Migrate one slot, shadow test, confirm byte-equal, move to next.
- **Whitespace normalization layer:** Add a `normalizePromptWhitespace()` step before comparison to avoid false failures from trailing newlines or double-spacing differences.
- **No conflict with our approach.** Shadow testing validates our plan to run old/new in parallel before switching.

### Risk: Test-only divergence
Shadow testing in test suites doesn't catch production-only edge cases (unusual client configs, extreme field lengths, Unicode in business names). Consider running shadow mode on real client data in a non-destructive way (e.g., a cron job that builds prompts for all clients via both paths and logs mismatches).

---

## Cross-Query Synthesis

The two findings reinforce each other:
1. **Typed slot registry** (Q1) gives us the new implementation
2. **Shadow testing** (Q2) gives us the migration safety net
3. Together: build typed slots incrementally, shadow test each one, only switch when 100% byte-equal

**No conflicts with our existing execution plan.** The Sonar research validates the Phase 2 approach in `docs/architecture/prompt-architecture-execution-plan.md`.
