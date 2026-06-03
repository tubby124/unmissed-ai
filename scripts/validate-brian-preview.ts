import { config as dotenvConfig } from 'dotenv'
dotenvConfig({ path: '.env.local' })
import * as fs from 'node:fs'
import { validatePrompt } from '../src/lib/prompt-validation'

const dryrun = JSON.parse(fs.readFileSync('CALLINGAGENTS/00-Inbox/recompose-brian-dryrun.json', 'utf8'))
const preview = dryrun.preview as string
const r = validatePrompt(preview)
console.log('preview chars:', preview.length)
console.log('valid:', r.valid)
console.log('errors:', r.errors)
console.log('warnings:', r.warnings.slice(0, 5))
