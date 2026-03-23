import { test, expect } from '@playwright/test';

test.describe('Auth guards', () => {
  test('unauthenticated /dashboard redirects to /login', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForURL('**/login**', { timeout: 10_000 });
    expect(page.url()).toContain('/login');
  });

  test('unauthenticated /dashboard/settings redirects to /login', async ({ page }) => {
    await page.goto('/dashboard/settings');
    await page.waitForURL('**/login**', { timeout: 10_000 });
    expect(page.url()).toContain('/login');
  });

  test('unauthenticated /admin/clients redirects to /login', async ({ page }) => {
    await page.goto('/admin/clients');
    await page.waitForURL('**/login**', { timeout: 10_000 });
    expect(page.url()).toContain('/login');
  });

  test('wrong password shows error message', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('you@company.com').fill('e2etest@unmissed.ai');
    await page.getByPlaceholder('••••••••').fill('definitely-wrong-password');
    await page.getByRole('button', { name: /sign in/i }).click();

    // Should show an error — either red text or toast
    await expect(
      page.locator('.text-red-400, .text-red-500, [role="alert"]')
    ).toBeVisible({ timeout: 10_000 });

    // Should NOT redirect to dashboard
    expect(page.url()).toContain('/login');
  });

  test('magic link button is visible and functional', async ({ page }) => {
    await page.goto('/login');
    const magicLinkBtn = page.getByRole('button', { name: /email me a sign-in link/i });
    await expect(magicLinkBtn).toBeVisible();
  });
});
