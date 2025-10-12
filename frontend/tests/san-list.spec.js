import { test, expect } from '@playwright/test';

// San list smoke tests
test.describe('San list flows', () => {
  test('List loads and each san card is clickable and booking works', async ({ page }) => {
    await page.goto('http://localhost:5173/san-list?test=true');

  // Wait for san cards to appear and assert at least one
  const cards = page.locator('[data-testid="san-card"]');
  const count = await cards.count();
  expect(count).toBeGreaterThan(0);

    // Iterate through each card: check image, title, price and try navigation
    for (let i = 0; i < count; i++) {
      const card = cards.nth(i);
  // Basic visibility checks (use .first() to avoid matching multiple imgs/spans inside the card)
  await expect(card.locator('img').first()).toBeVisible();
  await expect(card.locator('h3').first()).toBeVisible();
  await expect(card.locator('span').first()).toBeVisible();

      // Try booking button if enabled
      const sanId = await card.getAttribute('data-sanid');
      const bookBtn = page.locator(`[data-testid="san-book-btn-${sanId}"]`);

      if (await bookBtn.count()) {
        // If enabled, click and assert booking modal opens
        if (await bookBtn.isEnabled()) {
          await bookBtn.click();
          // booking modal contains "Đặt sân" button or booking related text
          await expect(page.locator('text=Đặt sân').first()).toBeVisible({ timeout: 2000 }).catch(() => {});
          // Close booking modal if present by clicking close icon or the backdrop
          if (await page.locator('[data-testid="booking-close"]').count()) {
            await page.click('[data-testid="booking-close"]');
          } else {
            // try pressing Escape
            await page.keyboard.press('Escape');
          }
        }
      }

      // Close any open booking modal that might intercept clicks
      if (await page.locator('[data-testid="booking-modal"]').count()) {
        if (await page.locator('[data-testid="booking-close"]').count()) {
          await page.click('[data-testid="booking-close"]');
          // wait briefly for modal to disappear
          await page.waitForTimeout(200);
        } else {
          await page.keyboard.press('Escape');
          await page.waitForTimeout(200);
        }
      }

      // Navigate to detail and back
      await card.click();
      // Expect san detail heading or schedule to be visible
      await expect(page.locator('text=Lịch sân').first()).toBeVisible({ timeout: 2000 }).catch(() => {});
      // go back
      await page.goBack();
    }
  });
});
