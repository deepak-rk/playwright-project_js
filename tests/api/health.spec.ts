import { test, expect } from '@playwright/test';

test('GET /health reports ok', async ({ request }) => {
  const res = await request.get('/health');
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(body.status).toBe('ok');
  expect(body.ts).toBeTruthy();
});
