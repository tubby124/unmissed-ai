import { config as dotenvConfig } from 'dotenv'
dotenvConfig({ path: '.env.local' })
import { recomposePrompt } from '../src/lib/slot-regenerator'

const CLIENT_ID = '2c186f70-84cc-4253-a3ab-6cd0e9064d39'
const USER_ID = '90c454c6-b756-4ac2-9cfc-20063e932cda'

async function main(): Promise<void> {
  const r: any = await recomposePrompt(CLIENT_ID, USER_ID, true, false)
  console.log('Full result object keys:', Object.keys(r))
  for (const k of Object.keys(r)) {
    const v = r[k]
    if (typeof v === 'string' && v.length > 200) {
      console.log(`${k}: (${v.length} chars) ${v.slice(0, 200)}...`)
    } else {
      console.log(`${k}:`, v)
    }
  }
}
main().catch(e => { console.error(e); process.exit(1) })
