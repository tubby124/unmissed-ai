import * as fs from 'node:fs'
const calls = JSON.parse(fs.readFileSync('/tmp/brian-audit/baseline-calls.json', 'utf8')) as any[]

// Sample 5 calls — show transcript shape + summary
for (let i = 0; i < Math.min(5, calls.length); i++) {
  const c = calls[i]
  console.log(`\n=== CALL ${i + 1} | ${c.id.slice(0,8)} | ${c.caller_name ?? '?'} | dur=${c.duration_seconds}s | status=${c.call_status} ===`)
  console.log(`summary: ${c.ai_summary?.slice(0, 200) ?? ''}`)
  console.log(`service_type: ${c.service_type} | end_reason: ${c.end_reason}`)
  console.log(`transcript length: ${Array.isArray(c.transcript) ? c.transcript.length : 'N/A'}`)
  if (Array.isArray(c.transcript) && c.transcript.length > 0) {
    console.log(`first turn keys: ${Object.keys(c.transcript[0]).join(',')}`)
    console.log(`first turn full:`)
    console.log(JSON.stringify(c.transcript[0], null, 2).slice(0, 500))
    // Any turn with a tool reference?
    const toolTurns = c.transcript.filter((t: any) => {
      const keys = Object.keys(t).join('|').toLowerCase()
      const blob = JSON.stringify(t).toLowerCase()
      return keys.includes('tool') || blob.includes('queryknowledge') || blob.includes('submitmaintenance') || blob.includes('"tool"') || blob.includes('hangup')
    })
    console.log(`turns referencing tools: ${toolTurns.length}`)
    if (toolTurns.length > 0) {
      console.log(`first tool turn:`)
      console.log(JSON.stringify(toolTurns[0], null, 2).slice(0, 500))
    }
  }
}

// Now check call_state for tool history
console.log('\n\n=== CALL_STATE SHAPES ===')
for (let i = 0; i < Math.min(5, calls.length); i++) {
  const c = calls[i]
  console.log(`\nCall ${i + 1}:`)
  console.log(JSON.stringify(c.call_state, null, 2).slice(0, 400))
}
