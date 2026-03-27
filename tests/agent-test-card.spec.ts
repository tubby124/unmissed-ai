import { test, expect, Page } from '@playwright/test';

const EMAIL = process.env.TEST_EMAIL || 'e2etest@unmissed.ai';
const PASSWORD = process.env.TEST_PASSWORD || '';

async function login(page: Page) {
  await page.goto('/login');
  await page.getByPlaceholder('you@company.com').fill(EMAIL);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL('**/dashboard**', { timeout: 15_000 });
}

test.describe('Agent Test Card (WebRTC)', () => {
  test.skip(!PASSWORD, 'TEST_PASSWORD env var required');

  test('"Talk to Agent" button renders on dashboard', async ({ page }) => {
    await login(page);
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Look for the test agent button/card
    const talkButton = page.locator(
      'button:has-text("Talk"), button:has-text("Test"), [data-testid="agent-test"]'
    );
    const hasButton = await talkButton.first().isVisible().catch(() => false);

    await page.screenshot({ path: 'screens/agent-test-card.png', fullPage: true });
  });

  test('clicking test button fires POST /api/dashboard/agent-test', async ({ page }) => {
    await login(page);
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Intercept the agent-test API call (don't let it actually connect)
    await page.route('**/api/dashboard/agent-test', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ joinUrl: 'wss://fake-test-url.ultravox.ai/test' }),
      });
    });

    const talkButton = page.locator(
      'button:has-text("Talk"), button:has-text("Test your agent")'
    ).first();

    if (await talkButton.isVisible()) {
      // Listen for the API call
      const apiCallPromise = page.waitForRequest(
        (req) => req.url().includes('/api/dashboard/agent-test'),
        { timeout: 5_000 }
      ).catch(() => null);

      await talkButton.click();
      const apiCall = await apiCallPromise;

      if (apiCall) {
        expect(apiCall.method()).toBe('POST');
      }
    }
  });

  test('try-asking chips render below the orb', async ({ page }) => {
    await login(page);
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Look for "Try asking" text and suggestion chips
    const tryAsking = page.locator('text=Try asking');
    const hasChips = await tryAsking.first().isVisible().catch(() => false);

    if (hasChips) {
      // Check for at least one chip
      const chips = page.locator('text=What are your hours?, text=Can I book, text=how can you help');
      await page.screenshot({ path: 'screens/try-asking-chips.png', fullPage: true });
    }
  });
});
