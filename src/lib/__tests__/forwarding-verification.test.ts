import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import {
  experimentalForwardingVerifyDisabledPayload,
  experimentalForwardingVerifyEnabled,
} from '../forwarding-verification'

describe('experimental forwarding verification guard', () => {
  test('is disabled unless explicitly enabled', () => {
    assert.equal(
      experimentalForwardingVerifyEnabled({ ENABLE_EXPERIMENTAL_FORWARDING_VERIFY: 'false' }),
      false,
    )
    assert.equal(experimentalForwardingVerifyEnabled({}), false)
    assert.equal(
      experimentalForwardingVerifyEnabled({ ENABLE_EXPERIMENTAL_FORWARDING_VERIFY: 'true' }),
      true,
    )
  })

  test('disabled payload tells users the real proof path', () => {
    const payload = experimentalForwardingVerifyDisabledPayload()
    assert.match(payload.proof_required, /normal business number/)
    assert.match(payload.proof_required, /owner summary/)
  })
})
