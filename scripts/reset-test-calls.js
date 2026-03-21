#!/usr/bin/env node
// reset-test-calls.js — Wipe caller context + AI summary so next test starts clean
//
// Usage:
//   node scripts/reset-test-calls.js                     # resets +13068507687 (default)
//   node scripts/reset-test-calls.js +14031234567        # any phone number
//   node scripts/reset-test-calls.js all hasan-sharif    # all calls for a client

const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = 'https://qwhvblomlgeapzhnuwlb.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY

if (!SUPABASE_KEY) {
  console.error('ERROR: SUPABASE_SERVICE_KEY not set. Run: source ~/.secrets')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const arg1 = process.argv[2] || '+13068507687'
const arg2 = process.argv[3] || 'hasan-sharif'

async function run() {
  let query = supabase
    .from('call_logs')
    .update({
      caller_name: null,
      ai_summary: null,
      key_topics: null,
      next_steps: null,
      sentiment: null,
      confidence: null,
      call_status: 'COLD',
    })

  if (arg1 === 'all') {
    // Reset all calls for a client slug — need to resolve client_id first
    const { data: client, error: clientErr } = await supabase
      .from('clients')
      .select('id')
      .eq('slug', arg2)
      .single()

    if (clientErr || !client) {
      console.error(`Client not found: ${arg2}`)
      process.exit(1)
    }
    query = query.eq('client_id', client.id)
    console.log(`Resetting ALL calls for client: ${arg2}`)
  } else {
    query = query.eq('caller_phone', arg1)
    console.log(`Resetting calls from: ${arg1}`)
  }

  const { data, error, count } = await query.select('id')

  if (error) {
    console.error('Error:', error.message)
    process.exit(1)
  }

  console.log(`Done — ${data?.length ?? 0} rows cleared.`)
  console.log('Next call from this number will be treated as a fresh caller.')
}

run()
