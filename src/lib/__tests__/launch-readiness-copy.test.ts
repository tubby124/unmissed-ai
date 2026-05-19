import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '../../..')

function read(path: string): string {
  return readFileSync(resolve(root, path), 'utf8')
}

describe('End Voicemail launch-readiness contracts', () => {
  test('public checkout charges the selected public plan and does not create a paid trial', () => {
    const route = read('src/app/api/stripe/create-public-checkout/route.ts')

    assert.match(route, /PUBLIC_PLANS\.find\(\(p\) => p\.id === planId\)/)
    assert.match(route, /subscriptionPriceId = getPublicCheckoutPriceId\(selectedPlanId\)/)
    assert.doesNotMatch(route, /STRIPE_SUBSCRIPTION_PRICE_ID/)
    assert.doesNotMatch(route, /trial_period_days/)
  })

  test('pricing cards do not expose unsupported annual checkout pricing', () => {
    const cards = read('src/components/PricingCards.tsx')

    assert.match(cards, /Annual plans coming later/)
    assert.doesNotMatch(cards, /Save 20%/)
  })

  test('password reset and magic links use the code callback route', () => {
    const forgot = read('src/app/auth/forgot-password/page.tsx')
    const adminCreate = read('src/app/api/admin/create-client-account/route.ts')
    const login = read('src/app/login/page.tsx')

    assert.match(forgot, /\/auth\/callback\?next=\/auth\/set-password/)
    assert.match(adminCreate, /\/auth\/callback\?next=\/auth\/set-password/)
    assert.match(login, /emailRedirectTo: `\$\{window\.location\.origin\}\/auth\/callback\?next=\/dashboard`/)
  })

  test('Go Live final banner requires a first real proof call', () => {
    const view = read('src/app/dashboard/go-live/GoLiveView.tsx')
    const page = read('src/app/dashboard/go-live/page.tsx')

    assert.match(view, /const isLive = forwardingReady && hasTestCall/)
    assert.match(page, /\.not\('ultravox_call_id', 'is', null\)/)
    assert.match(page, /\.eq\('channel', 'email'\)/)
  })
})
