import { afterEach, beforeEach, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { updateAgent } from '../ultravox.js'

describe('updateAgent prompt preservation', () => {
  const originalFetch = globalThis.fetch
  const originalKey = process.env.ULTRAVOX_API_KEY

  beforeEach(() => {
    process.env.ULTRAVOX_API_KEY = 'test-ultravox-key'
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    if (originalKey === undefined) delete process.env.ULTRAVOX_API_KEY
    else process.env.ULTRAVOX_API_KEY = originalKey
  })

  test('voice/tool-only updates preserve the live systemPrompt', async () => {
    const calls: Array<{ url: string; method: string; body?: unknown }> = []
    let patchBody: any

    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      const method = init?.method ?? 'GET'
      calls.push({ url: String(url), method, body: init?.body })

      if (method === 'GET') {
        return new Response(JSON.stringify({
          callTemplate: { systemPrompt: 'Existing Urban Vibe prompt' },
        }), { status: 200 })
      }

      patchBody = JSON.parse(String(init?.body))
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    }) as typeof fetch

    await updateAgent('agent-1', {
      voice: 'voice-1',
      slug: 'urban-vibe',
      sms_enabled: false,
    })

    assert.equal(calls.length, 2)
    assert.equal(calls[0].method, 'GET')
    assert.equal(calls[1].method, 'PATCH')
    assert.match(patchBody.callTemplate.systemPrompt, /Existing Urban Vibe prompt/)
    assert.match(patchBody.callTemplate.systemPrompt, /\{\{callerContext\}\}/)
  })

  test('refuses to PATCH when no update prompt and no live prompt exist', async () => {
    const calls: Array<{ method: string }> = []

    globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
      const method = init?.method ?? 'GET'
      calls.push({ method })
      return new Response(JSON.stringify({ callTemplate: {} }), { status: 200 })
    }) as typeof fetch

    await assert.rejects(
      () => updateAgent('agent-1', { slug: 'urban-vibe' }),
      /requires systemPrompt/,
    )
    assert.deepEqual(calls.map(c => c.method), ['GET'])
  })
})
