import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { findPlaceholderPhone, validateOutboundVmScript } from '../outbound-safety'

describe('outbound-safety', () => {
  it('allows null or real callback numbers', () => {
    assert.equal(validateOutboundVmScript(null).ok, true)
    assert.equal(validateOutboundVmScript('Call us back at 403-808-9705.').ok, true)
    assert.equal(findPlaceholderPhone('Call the same number you received this call from.'), null)
  })

  it('blocks common fake callback numbers', () => {
    assert.equal(findPlaceholderPhone('Call back at 555-123-4567'), '555-123-4567')
    assert.equal(validateOutboundVmScript('Please call 555-123-4567.').ok, false)
    assert.equal(validateOutboundVmScript('Reach me at +1 (555) 123-4567').ok, false)
    assert.equal(validateOutboundVmScript('Callback: 123-456-7890').ok, false)
  })
})
