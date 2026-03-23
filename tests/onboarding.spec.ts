import { test, expect } from '@playwright/test';

test.describe('Onboarding flow (/onboard)', () => {
  test('step 1 renders niche grid and business search', async ({ page }) => {
    await page.goto('/onboard');

    // Niche tiles should be visible as buttons
    await expect(page.getByRole('button', { name: /plumbing/i })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: /auto glass/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /hvac/i })).toBeVisible();

    // Business name search input
    await expect(page.getByPlaceholder(/business name/i)).toBeVisible();

    // Website URL input
    await expect(page.getByPlaceholder(/yourbusiness\.com/i)).toBeVisible();

    await page.screenshot({ path: 'screens/onboard-step1.png', fullPage: true });
  });

  test('selecting a niche highlights it', async ({ page }) => {
    await page.goto('/onboard');
    await page.getByRole('button', { name: /plumbing/i }).click();

    // "Your agent will handle" section should appear with plumbing-specific items
    await expect(page.locator('text=Your agent will handle')).toBeVisible();
    await page.screenshot({ path: 'screens/onboard-niche-selected.png', fullPage: true });
  });

  test('step navigation forward and back', async ({ page }) => {
    await page.goto('/onboard');

    // Select a niche
    await page.getByRole('button', { name: /plumbing/i }).click();

    // Navigate forward
    const continueBtn = page.getByRole('button', { name: /continue/i });
    await expect(continueBtn).toBeEnabled();
    await continueBtn.click();
    await page.waitForTimeout(500);

    // Should be on step 2
    await expect(page.locator('text=2 / 6')).toBeVisible();

    // Navigate back
    const backBtn = page.getByRole('button', { name: /back/i });
    await backBtn.click();
    await page.waitForTimeout(500);

    // Should be back on step 1
    await expect(page.locator('text=1 / 6')).toBeVisible();

    await page.screenshot({ path: 'screens/onboard-back-navigation.png', fullPage: true });
  });

  test('step 2 (voice) renders after continuing from step 1', async ({ page }) => {
    await page.goto('/onboard');
    await page.getByRole('button', { name: /plumbing/i }).click();
    await page.getByRole('button', { name: /continue/i }).click();
    await page.waitForTimeout(500);

    await expect(page.locator('text=2 / 6')).toBeVisible();
    await page.screenshot({ path: 'screens/onboard-step2.png', fullPage: true });
  });

  test('all 6 steps are reachable without errors', async ({ page }) => {
    await page.goto('/onboard');

    // Step 1 — select niche
    await page.getByRole('button', { name: /plumbing/i }).click();
    await page.getByRole('button', { name: /continue/i }).click();
    await expect(page.locator('text=2 / 6')).toBeVisible({ timeout: 5_000 });

    // Step 2 — voice (just continue)
    await page.getByRole('button', { name: /continue/i }).click();
    await expect(page.locator('text=3 / 6')).toBeVisible({ timeout: 5_000 });

    // Step 3 — basics (fill ALL required fields then continue)
    await page.getByPlaceholder('Acme Services').fill('Test Plumbing Co');
    await page.getByPlaceholder('(306) 555-1234').fill('(306) 555-9999');
    await page.getByPlaceholder('you@business.com').fill('test@example.com');
    await page.getByPlaceholder('Saskatoon').fill('Saskatoon');
    await page.getByPlaceholder('Mon-Fri 9am-5pm').fill('Mon-Fri 9am-5pm');
    await page.getByRole('button', { name: /continue/i }).click();
    await expect(page.locator('text=4 / 6')).toBeVisible({ timeout: 5_000 });

    // Step 4 — FAQ (just continue)
    await page.getByRole('button', { name: /continue/i }).click();
    await expect(page.locator('text=5 / 6')).toBeVisible({ timeout: 5_000 });

    // Step 5 — handling (just continue)
    await page.getByRole('button', { name: /continue/i }).click();
    await expect(page.locator('text=6 / 6')).toBeVisible({ timeout: 5_000 });

    await page.screenshot({ path: 'screens/onboard-step6-review.png', fullPage: true });
  });
});
