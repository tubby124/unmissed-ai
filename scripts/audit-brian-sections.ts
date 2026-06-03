import { config as dotenvConfig } from 'dotenv'
dotenvConfig({ path: '.env.local' })
import * as fs from 'node:fs'
import * as path from 'node:path'

const dryrun = JSON.parse(fs.readFileSync('CALLINGAGENTS/00-Inbox/recompose-brian-dryrun.json', 'utf8'))
const current = dryrun._clientRow.system_prompt as string
const preview = dryrun.preview as string

const outDir = '/tmp/brian-audit'
fs.mkdirSync(outDir, { recursive: true })
fs.writeFileSync(path.join(outDir, 'brian-current.md'), current)
fs.writeFileSync(path.join(outDir, 'brian-preview.md'), preview)

function sectionMap(p: string): { name: string; len: number; body: string }[] {
  const sections: { name: string; len: number; body: string }[] = []
  const opens = new Map<string, number>()
  const re = /<!--\s*(\/)?unmissed:([\w-]+)\s*-->/g
  let m: RegExpExecArray | null
  while ((m = re.exec(p)) !== null) {
    const closing = m[1] === '/'
    const name = m[2]
    if (!closing) {
      opens.set(name, m.index)
    } else {
      const start = opens.get(name)
      if (start !== undefined) {
        const end = m.index + m[0].length
        sections.push({ name, len: end - start, body: p.slice(start, end) })
        opens.delete(name)
      }
    }
  }
  return sections
}

const curSec = sectionMap(current)
const prevSec = sectionMap(preview)

const curMap = new Map(curSec.map(s => [s.name, s]))
const prevMap = new Map(prevSec.map(s => [s.name, s]))
const order = Array.from(new Set([...curSec.map(s => s.name), ...prevSec.map(s => s.name)]))

let mdTable = '| Section | Current | Preview | Δ | In sacred? |\n|---|---:|---:|---:|:---:|\n'
const SACRED = new Set(['identity','safety','life_safety_emergency_override','scope','closing_override','tools','tools_block','maintenance','returning_caller_handling'])
let totalCur = 0, totalPrev = 0
for (const name of order) {
  const c = curMap.get(name)?.len ?? 0
  const p = prevMap.get(name)?.len ?? 0
  totalCur += c
  totalPrev += p
  const delta = p - c
  const sacred = SACRED.has(name) ? 'Y' : ''
  mdTable += `| \`${name}\` | ${c} | ${p} | ${delta >= 0 ? '+' : ''}${delta} | ${sacred} |\n`
}
mdTable += `| **TOTAL slotted** | **${totalCur}** | **${totalPrev}** | **${totalPrev - totalCur >= 0 ? '+' : ''}${totalPrev - totalCur}** | |\n`
mdTable += `| **OVERALL prompt** | **${current.length}** | **${preview.length}** | **${preview.length - current.length >= 0 ? '+' : ''}${preview.length - current.length}** | |\n`
mdTable += `| Outside slots | ${current.length - totalCur} | ${preview.length - totalPrev} | | |\n`

console.log(mdTable)

for (const name of order) {
  const dir = path.join(outDir, 'sections')
  fs.mkdirSync(dir, { recursive: true })
  if (curMap.has(name)) fs.writeFileSync(path.join(dir, `${name}.current.md`), curMap.get(name)!.body)
  if (prevMap.has(name)) fs.writeFileSync(path.join(dir, `${name}.preview.md`), prevMap.get(name)!.body)
}
console.log(`\nWrote section files to ${outDir}/sections/`)
