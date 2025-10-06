// Playwright config for basic smoke tests (ESM)
import { devices } from '@playwright/test';

/** @type {import('@playwright/test').PlaywrightTestConfig} */
const config = {
  timeout: 30 * 1000,
  testDir: 'tests',
  use: {
    headless: false,
    viewport: { width: 1280, height: 800 },
    actionTimeout: 5 * 1000,
    ignoreHTTPSErrors: true,
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
};

export default config;
