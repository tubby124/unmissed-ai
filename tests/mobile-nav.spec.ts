import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 375, height: 812 } }); // iPhone X

test.describe('Mobile nav — D50', () => {
  test('hamburger menu opens and shows Agent accordion with subsections', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    await page.getByPlaceholder('you@company.com').fill('fix@windshieldhub.ca');
    await page.getByPlaceholder('Enter your password').fill('qwerty123');
    await page.getByRole('button', { name: /sign in/i }).click();

    await page.waitForURL('**/dashboard**', { timeout: 15_000 });
    await page.waitForLoadState('networkidle');

    // Hamburger top bar should be visible at mobile width
    const topBar = page.locator('div.lg\\:hidden.sticky.top-0');
    await expect(topBar).toBeVisible({ timeout: 5_000 });

    const hamburger = topBar.locator('button');
    await expect(hamburger).toBeVisible();
    await hamburger.click();

    // Slide-out menu
    const slideMenu = page.locator('div.fixed.left-0.top-0.bottom-0');
    await expect(slideMenu).toBeVisible({ timeout: 5_000 });
    await page.screenshot({ path: 'test-results/mobile-nav-open.png' });

    // Agent accordion
    const agentButton = slideMenu.locator('button', { hasText: 'Agent' });
    await expect(agentButton).toBeVisible();
    await agentButton.click();

    // Subsections — inside the accordion's indented border-l container
    const accordion = slideMenu.locator('div.border-l');
    await expect(accordion.getByText('Overview')).toBeVisible({ timeout: 3_000 });
    await expect(accordion.getByText('Knowledge')).toBeVisible();
    await expect(accordion.getByText('Actions')).toBeVisible();
    await expect(accordion.getByText('Voice Library')).toBeVisible();
    await page.screenshot({ path: 'test-results/mobile-nav-accordion-open.png' });

    // Navigate via subsection
    await accordion.getByText('Knowledge').click();
    await page.waitForURL('**/dashboard/knowledge**', { timeout: 10_000 });
  });

  test('top bar visible on mobile, hidden on desktop', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    await page.getByPlaceholder('you@company.com').fill('fix@windshieldhub.ca');
    await page.getByPlaceholder('Enter your password').fill('qwerty123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL('**/dashboard**', { timeout: 15_000 });

    const topBar = page.locator('div.lg\\:hidden.sticky.top-0');
    await expect(topBar).toBeVisible({ timeout: 5_000 });

    // Resize to desktop
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForTimeout(500);
    await expect(topBar).toBeHidden();
  });
});
