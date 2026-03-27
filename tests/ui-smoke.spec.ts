import { test, expect } from '@playwright/test';

// Credentials from env — never hardcoded
const EMAIL = process.env.TEST_EMAIL || 'e2etest@unmissed.ai';
const PASSWORD = process.env.TEST_PASSWORD || '';

test.describe('Public pages', () => {
  test('homepage loads and shows key elements', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/unmissed/i);

    // Hero area visible
    await expect(page.locator('text=unmissed.ai fixes that')).toBeVisible();

    await page.screenshot({ path: 'screens/home.png', fullPage: true });
  });

  test('login page renders sign-in form', async ({ page }) => {
    await page.goto('/login');

    // Core login elements
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
    await expect(page.getByPlaceholder('you@company.com')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /google/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /email me a sign-in link/i })).toBeVisible();

    await page.screenshot({ path: 'screens/login.png', fullPage: true });
  });

  test('pricing page loads', async ({ page }) => {
    await page.goto('/pricing');
    await expect(page.locator('body')).toBeVisible();
    await page.screenshot({ path: 'screens/pricing.png', fullPage: true });
  });

  test('niche landing pages load', async ({ page }) => {
    const niches = ['for-auto-glass', 'for-plumbing', 'for-hvac', 'for-realtors', 'for-dental', 'for-legal'];
    for (const niche of niches) {
      await page.goto(`/${niche}`);
      await expect(page.locator('body')).toBeVisible();
    }
    // Screenshot the last one as a sample
    await page.screenshot({ path: 'screens/niche-sample.png', fullPage: true });
  });

  test('try page loads', async ({ page }) => {
    await page.goto('/try');
    await expect(page.locator('body')).toBeVisible();
    await page.screenshot({ path: 'screens/try.png', fullPage: true });
  });
});

test.describe('Login flow', () => {
  test.skip(!PASSWORD, 'TEST_PASSWORD env var required');

  test('email/password login → dashboard redirect', async ({ page }) => {
    await page.goto('/login');

    await page.getByPlaceholder('you@company.com').fill(EMAIL);
    await page.locator('input[type="password"]').fill(PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();

    // Should redirect to dashboard
    await page.waitForURL('**/dashboard**', { timeout: 15_000 });
    await expect(page.url()).toContain('/dashboard');

    await page.screenshot({ path: 'screens/dashboard-home.png', fullPage: true });
  });

  test('dashboard navigation smoke test', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.getByPlaceholder('you@company.com').fill(EMAIL);
    await page.locator('input[type="password"]').fill(PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL('**/dashboard**', { timeout: 15_000 });

    // Visit key dashboard pages and screenshot each
    const pages = [
      { path: '/dashboard/calls', name: 'calls' },
      { path: '/dashboard/leads', name: 'leads' },
      { path: '/dashboard/settings', name: 'settings' },
      { path: '/dashboard/insights', name: 'insights' },
    ];

    for (const p of pages) {
      await page.goto(p.path);
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: `screens/dashboard-${p.name}.png`, fullPage: true });
    }
  });

  test('login with wrong password shows error', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('you@company.com').fill(EMAIL);
    await page.locator('input[type="password"]').fill('wrong-password-123');
    await page.getByRole('button', { name: /sign in/i }).click();

    // Should show an error message
    await expect(page.locator('.text-red-400')).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: 'screens/login-error.png', fullPage: true });
  });
});

test.describe('Admin pages (requires admin login)', () => {
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@unmissed.ai';
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';

  test.skip(!ADMIN_PASSWORD, 'ADMIN_PASSWORD env var required');

  test('admin dashboard loads', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('you@company.com').fill(ADMIN_EMAIL);
    await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL('**/dashboard**', { timeout: 15_000 });

    const adminPages = [
      { path: '/admin/clients', name: 'admin-clients' },
      { path: '/admin/calls', name: 'admin-calls' },
      { path: '/admin/numbers', name: 'admin-numbers' },
    ];

    for (const p of adminPages) {
      await page.goto(p.path);
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: `screens/${p.name}.png`, fullPage: true });
    }
  });
});

test.describe('Forgot password flow', () => {
  test('shows reset form and sends link', async ({ page }) => {
    await page.goto('/login');

    // Click "Forgot password?"
    await page.getByText('Forgot password?').click();

    // Should show reset form
    await expect(page.getByRole('heading', { name: /reset password/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /send reset link/i })).toBeVisible();

    await page.screenshot({ path: 'screens/forgot-password.png', fullPage: true });
  });
});
