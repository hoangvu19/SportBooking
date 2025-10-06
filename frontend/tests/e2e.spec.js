import { test, expect } from '@playwright/test';

test.describe('Smoke: core flows', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173/?test=true');
  });

  test('Feed loads and stories visible', async ({ page }) => {
    await expect(page.locator('[data-testid="create-story-card"]')).toBeVisible();
    // Simple check that at least one post exists
    await expect(page.locator('img[alt=""]').first()).toBeVisible();
  });

  test('Open story modal and create a text story', async ({ page }) => {
  await page.click('[data-testid="create-story-card"]');
  // fill the first textarea in the modal (avoid fragile placeholder selector)
  await page.fill('[data-testid="story-textarea"]', 'Playwright verification story');
  await page.click('[data-testid="story-create-button"]');
  });

  test('Create Post form: text only', async ({ page }) => {
    await page.goto('http://localhost:5173/create-post?test=true');
    await page.fill('[data-testid="createpost-textarea"]', 'Automated post for smoke test');
    await page.click('[data-testid="publish-post-button"]');
    // Wait briefly for toast
    await page.waitForTimeout(800);
  });

  test('Navigate to profile and open edit modal if present', async ({ page }) => {
    await page.goto('http://localhost:5173/profile');
    if (await page.locator('text=Edit profile').count()) {
      await page.click('text=Edit profile');
      await expect(page.locator('text=Save')).toBeVisible();
    }
  });
});
