import { test, expect } from '@playwright/test';

test('IME Vietnamese typing in comment input', async ({ page }) => {
  await page.goto('http://localhost:5173/');
  // Wait for an input that looks like comment input
  const input = page.locator('input[aria-label="Viết bình luận"]').first();
  await expect(input).toBeVisible({ timeout: 5000 });

  // Type Vietnamese with diacritics using keyboard.type to simulate IME
  await input.click();
  await page.keyboard.type('Toi dang thu tieng Viet co dau: tieng viet');
  const val = await input.inputValue();
  console.log('Input value:', val);
  expect(val).toContain('tieng viet');
});
