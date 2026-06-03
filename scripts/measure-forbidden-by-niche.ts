import { buildSlotContext } from '../src/lib/prompt-slots'
const NICHES = ['auto_glass', 'plumbing', 'hvac', 'electrical', 'real_estate', 'property_management', 'dental', 'restaurant', 'legal', 'salon', 'print_shop', 'cleaning', 'roofing']
for (const niche of NICHES) {
  try {
    const ctx = buildSlotContext({
      niche,
      business_name: 'Test',
      agent_name: 'Eric',
      timezone: 'America/Edmonton',
      hours_weekday: '9-5',
      hours_weekend: 'closed',
    } as never)
    const total = ctx.forbiddenExtraRules.join('\n').length
    console.log(`${niche.padEnd(22)} ${ctx.forbiddenExtraRules.length} rules, ${total} chars`)
  } catch (e: any) {
    console.log(`${niche.padEnd(22)} ERR: ${e.message?.slice(0, 60)}`)
  }
}
