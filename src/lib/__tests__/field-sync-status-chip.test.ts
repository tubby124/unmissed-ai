import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import FieldSyncStatusChip, {
  shouldRenderFieldSyncChip,
} from '../../components/dashboard/settings/FieldSyncStatusChip'
import {
  _resetFieldSyncCache,
  recordFieldSyncStatus,
} from '../../components/dashboard/settings/usePatchSettings'

describe('FieldSyncStatusChip', () => {
  test('renders nothing until a field has an error or skipped status', () => {
    assert.equal(shouldRenderFieldSyncChip(null), false)
    assert.equal(shouldRenderFieldSyncChip({ status: 'success' }), false)
    assert.equal(shouldRenderFieldSyncChip({ status: 'error', reason: 'unknown' }), true)
    assert.equal(shouldRenderFieldSyncChip({ status: 'skipped' }), true)
  })

  test('reads the shared field sync cache and renders the existing chip copy', () => {
    _resetFieldSyncCache()
    recordFieldSyncStatus('client-1', 'booking_enabled', {
      status: 'error',
      reason: 'ultravox_5xx',
    })

    const html = renderToStaticMarkup(
      React.createElement(FieldSyncStatusChip, {
        clientId: 'client-1',
        fieldKey: 'booking_enabled',
        currentValue: true,
      }),
    )

    assert.match(html, /Saved, but not yet live on your agent\./)
  })
})
