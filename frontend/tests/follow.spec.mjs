import { test } from '@playwright/test';

const DEFAULT_PORTS = [5173, 5174, 5175];

async function findBaseUrl(page) {
  const env = process.env.BASE_URL;
  if (env) return env.replace(/\/$/, '');
  for (const p of DEFAULT_PORTS) {
    const url = `http://localhost:${p}`;
    try {
      // quick probe
      const resp = await page.request.get(url, { timeout: 2000 });
      // if we get any response, assume server up
      if (resp.ok() || resp.status() === 200 || resp.status() === 204) return url;
    } catch (e) {
      // ignore
    }
  }
  // fallback to 5174
  return 'http://localhost:5173';
}

test('Follow toggle: optimistic UI and API logs', async ({ page }) => {
  const profilePath = '/profile/77';
  const BASE = await findBaseUrl(page);
  const url = `${BASE}${profilePath}`;
  console.log('Visiting', url);

  // Capture page console messages
  page.on('console', msg => console.log('[PAGE]', msg.type(), msg.text()));

  // Capture network requests/responses for follow API
  page.on('request', req => {
    if (req.url().includes('/users/follow')) {
      console.log('[REQ]', req.method(), req.url(), req.postData());
    }
  });
  page.on('response', async resp => {
    if (resp.url().includes('/users/follow')) {
      console.log('[RESP]', resp.status(), resp.url());
      try {
        const body = await resp.json();
        console.log('[RESP-BODY]', JSON.stringify(body));
      } catch (e) {
        console.log('[RESP-BODY] (no-json)');
      }
    }
  });

  await page.goto(url, { waitUntil: 'networkidle' });

  // Wait for the follow button to appear
  const followButton = page.getByRole('button', { name: /Follow|Following/i }).first();
  await followButton.waitFor({ timeout: 8000 });

  // Click it once (follow/unfollow toggle)
  console.log('Clicking follow button...');
  await followButton.click();

  // Wait a moment for optimistic UI and network
  await page.waitForTimeout(1500);

  // Click again to toggle back
  const secondBtn = page.getByRole('button', { name: /Follow|Following/i }).first();
  console.log('Clicking follow button again...');
  await secondBtn.click();

  // Allow network activity
  await page.waitForTimeout(1500);

  console.log('Test finished');
});
