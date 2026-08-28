import { test, expect } from '@playwright/test';

test.describe('app shell', () => {
  test('every nav section is reachable and renders its own heading', async ({ page }) => {
    await page.goto('/devices');

    for (const [link, heading] of [
      ['Builds', 'Builds'],
      ['Execution', 'Execution'],
      ['Analytics', 'Analytics'],
      ['Hosts', 'Hosts'],
      ['Devices', 'Devices'],
    ] as const) {
      await page.getByRole('link', { name: link, exact: true }).click();
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
    }
  });

  test('the root path redirects to devices', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/devices$/);
  });

  test('the theme toggle switches themes and survives a reload', async ({ page }) => {
    await page.goto('/devices');

    const initial = await page.locator('html').getAttribute('data-theme');
    await page.getByRole('button', { name: /Switch to (light|dark) theme/i }).click();
    const toggled = await page.locator('html').getAttribute('data-theme');
    expect(toggled).not.toBe(initial);

    await page.reload();
    expect(await page.locator('html').getAttribute('data-theme')).toBe(toggled);
  });

  test('renders no console errors on any section', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    page.on('pageerror', (e) => errors.push(`PAGEERROR ${e.message}`));

    for (const route of ['/devices', '/devices/multi-view', '/builds', '/execution', '/analytics', '/hosts']) {
      await page.goto(route, { waitUntil: 'networkidle' });
    }
    expect(errors).toEqual([]);
  });
});
