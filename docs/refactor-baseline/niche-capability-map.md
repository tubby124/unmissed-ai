# Niche Capability Map
_Phase 1A — Created 2026-03-18_

Source of truth: `agent-app/src/lib/niche-capabilities.ts`
Test coverage: `agent-app/src/lib/__tests__/capabilities.test.ts` (17 tests, all pass)

---

## Capability Model

```ts
type AgentCapabilities = {
  takeMessages: boolean         // Agent can collect a message for callback
  bookAppointments: boolean     // Agent can take appointment booking requests
  transferCalls: boolean        // Agent can perform a live call transfer
  useKnowledgeLookup: boolean   // Agent can answer from injected business knowledge
  usePropertyLookup: boolean    // Agent can look up property info (real estate)
  useTenantLookup: boolean      // Agent can look up tenant records (PM)
  updateTenantRequests: boolean // Agent can write structured tenant requests (Phase 7)
  emergencyRouting: boolean     // Niche-specific emergency routing beyond global 911
}
```

---

## Niche-to-Capability Matrix

| Niche | takeMsg | book | transfer | knowledge | propLookup | tenantLookup | updateReqs | emergency |
|-------|---------|------|----------|-----------|-----------|--------------|------------|-----------|
| auto_glass | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| hvac | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| plumbing | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| dental | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| legal | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| salon | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| real_estate | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| property_management | ✅ | ❌ | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ |
| outbound_isa_realtor | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| voicemail | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| print_shop | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| barbershop | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| restaurant | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| other | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## Key Decision Notes

### bookAppointments = true
Niches where appointment booking is a PRIMARY purpose, and the agent may use calendar tools (`checkCalendarAvailability`, `bookAppointment`):
- `dental` — new patient + cleaning bookings
- `salon` — explicit calendar tools in FORBIDDEN_EXTRA
- `real_estate` — property showings
- `barbershop` — explicit calendar tools in FORBIDDEN_EXTRA
- `outbound_isa_realtor` — setting up agent callback call IS the booking

All other niches collect "preferred timing" as part of message-taking, not as a true calendar booking. This distinction matters for Phase 2 prompt assembly.

### transferCalls = false (explicit reasons)
- `property_management`: NICHE_DEFAULTS FORBIDDEN_EXTRA explicitly states "NEVER pretend to transfer or put someone on hold. This is a callback-only service."
- `outbound_isa_realtor`: Outbound ISA — no inbound transfer path
- `voicemail`: Voicemail-only service — no live routing
- `restaurant`: No transfer flow in the restaurant niche template

### emergencyRouting = true (niche-specific beyond global 911)
These niches have additional emergency routing logic in their triage scripts:
- `hvac`: No heat in winter → [URGENT] flag; gas smell → redirect to gas company
- `plumbing`: Flooding / burst pipe → [URGENT] + shut-off valve instructions
- `property_management`: Flooding, gas, no heat → [URGENT] + 911 routing

Note: ALL niches have the global LIFE SAFETY EMERGENCY OVERRIDE (call 911 → hangUp). `emergencyRouting=true` only flags niches with ADDITIONAL emergency routing logic in their niche-specific triage.

### updateTenantRequests = false (all niches)
Phase 7 concern. Will be enabled for `property_management` when structured ops are implemented. Must remain false until then — this is asserted by test.

---

## Usage (Phase 1B and beyond)

```ts
import { getCapabilities, hasCapability } from '@/lib/niche-capabilities'

// Get all capabilities for a niche
const caps = getCapabilities('real_estate')
// → { takeMessages: true, bookAppointments: true, usePropertyLookup: true, ... }

// Check a single capability
if (hasCapability(niche, 'bookAppointments')) {
  // inject booking instructions into prompt
}
```

These flags will gate prompt assembly in Phase 2 so unsupported capabilities never appear in the prompt text.

---

## Test Gate (Phase 1A)

Run: `cd agent-app && npm run test:capabilities`

17 tests across 8 suites:
- NICHE_CAPABILITIES registry (all niches registered, all 8 fields present)
- Runbook-specified invariants (voicemail, real_estate, property_management)
- Disabled capability guards (voicemail transfer=false, PM transfer=false, updateTenantRequests=false)
- Booking capability (bookable vs non-bookable niche sets)
- Emergency routing (which niches have niche-specific emergency behavior)
- getCapabilities() unknown niche fallback
- hasCapability() helper
- Universal invariant (every niche takes messages)
