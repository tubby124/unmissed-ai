import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { checkToolSecret } from '../tool-secret'

describe('tool secret guard', () => {
  let originalSecret: string | undefined
  let originalNodeEnv: string | undefined
  let originalRailwayEnv: string | undefined

  beforeEach(() => {
    const mutableEnv = process.env as unknown as Record<string, string | undefined>
    originalSecret = process.env.WEBHOOK_SIGNING_SECRET
    originalNodeEnv = process.env.NODE_ENV
    originalRailwayEnv = process.env.RAILWAY_ENVIRONMENT_NAME
    delete process.env.WEBHOOK_SIGNING_SECRET
    delete process.env.RAILWAY_ENVIRONMENT_NAME
    mutableEnv.NODE_ENV = 'test'
  })

  afterEach(() => {
    const mutableEnv = process.env as unknown as Record<string, string | undefined>
    if (originalSecret === undefined) delete process.env.WEBHOOK_SIGNING_SECRET
    else process.env.WEBHOOK_SIGNING_SECRET = originalSecret

    if (originalNodeEnv === undefined) delete mutableEnv.NODE_ENV
    else mutableEnv.NODE_ENV = originalNodeEnv

    if (originalRailwayEnv === undefined) delete process.env.RAILWAY_ENVIRONMENT_NAME
    else process.env.RAILWAY_ENVIRONMENT_NAME = originalRailwayEnv
  })

  it('allows missing secret outside production for local tool testing', () => {
    assert.equal(checkToolSecret(null), null)
  })

  it('fails closed when production is missing WEBHOOK_SIGNING_SECRET', () => {
    process.env.RAILWAY_ENVIRONMENT_NAME = 'production'
    assert.equal(checkToolSecret(null), 'Tool secret is not configured')
  })

  it('rejects missing or wrong headers when a secret is configured', () => {
    process.env.WEBHOOK_SIGNING_SECRET = 'secret-123'
    assert.equal(checkToolSecret(null), 'Forbidden')
    assert.equal(checkToolSecret('wrong'), 'Forbidden')
  })

  it('accepts the configured secret', () => {
    process.env.WEBHOOK_SIGNING_SECRET = 'secret-123'
    assert.equal(checkToolSecret('secret-123'), null)
  })
})
