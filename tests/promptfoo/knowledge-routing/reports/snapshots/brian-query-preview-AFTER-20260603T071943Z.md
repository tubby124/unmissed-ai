════════════════════════════════════════════════════════════════════════
QUERY-PREVIEW (true-path simulation) — calgary-property-leasing
Niche: property_management · 5 scenarios
════════════════════════════════════════════════════════════════════════

[areas-served] ✅ PASS
  Q: "what areas do you serve"
  → results=3 · sim=0.566 · trust=high · rrf=0.0388
  📜 Top chunk: "Q: What areas do you serve?
A: Calgary and Edmonton, Alberta."
  🤖 Agent sees: Found: Q: What areas do you serve?
A: Calgary and Edmonton, Alberta.. Read this back naturally — do not say 'according to our knowledge base' or 'our records show'.

[rent-guarantee] ✅ PASS
  Q: "how does the rent guarantee program work"
  → results=2 · sim=0.779 · trust=high · rrf=0.0392
  📜 Top chunk: "Q: How does the rent guarantee program work?
A: We sign the lease as the tenant on your property and pay you approximately 90% of market rent every month, guaranteed — even if the unit is vacant. We t…"
  🤖 Agent sees: Found: Q: How does the rent guarantee program work?
A: We sign the lease as the tenant on your property and pay you approximately 90% of market rent every month, guaranteed — even if the unit is vacant. We t. Read this back naturally — do n…

[pets-policy] 🔴 EMPTY
  Q: "do you allow pets in your buildings"
  → results=0 · sim=---- · trust=---- · rrf=----
  🤖 Agent sees: No information found. Say you're not sure about that specific question and offer to have someone follow up.

[application-process] ✅ PASS
  Q: "what is the application process to rent from you"
  → results=2 · sim=0.492 · trust=high · rrf=0.0196
  📜 Top chunk: "The company implements a thorough and effective tenant qualification process."
  🤖 Agent sees: Found: The company implements a thorough and effective tenant qualification process.. Read this back naturally — do not say 'according to our knowledge base' or 'our records show'.

[services-offered] ✅ PASS
  Q: "what kind of property management services do you offer"
  → results=4 · sim=0.699 · trust=high · rrf=0.0196
  📜 Top chunk: "Q: What services do you offer?
A: Property management services for residential rental properties, including tenant qualification, rent collection, property maintenance oversight, and tenant dispute re…"
  🤖 Agent sees: Found: Q: What services do you offer?
A: Property management services for residential rental properties, including tenant qualification, rent collection, property maintenance oversight, and tenant dispute re. Read this back naturally — do n…

────────────────────────────────────────────────────────────────────────
SUMMARY: 4/5 scenarios PASS · 1 empty · 0 match-fails
────────────────────────────────────────────────────────────────────────