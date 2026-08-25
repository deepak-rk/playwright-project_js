import { test, expect } from '@playwright/test';
import { seedDevice, signUpThroughUi } from './helpers/ui';

test.describe('execution', () => {
  test('signed out, triggering a run asks the user to sign in', async ({ page }) => {
    await page.goto('/execution/new');
    await expect(page.getByText(/Sign in to trigger a run/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Start run/i })).toBeHidden();
  });

  test('a viewer is told they lack the role rather than shown a form that would 403', async ({ page }) => {
    await signUpThroughUi(page); // registers a viewer
    await page.goto('/execution/new');

    await expect(page.getByText(/Not permitted/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Start run/i })).toBeHidden();
  });

  test('the run list renders and links through to a run detail page', async ({ page, request }) => {
    const device = await seedDevice(request);

    // Trigger a run as the admin so the list has something in it.
    const admin = JSON.parse(
      require('fs').readFileSync(require('path').join(__dirname, '..', '..', '.auth', 'admin.json'), 'utf8'),
    ) as { token: string };
    const apiBase = process.env.API_BASE_URL ?? 'http://localhost:3000';
    const res = await request.post(`${apiBase}/api/execution`, {
      headers: { Authorization: `Bearer ${admin.token}` },
      data: {
        machineId: device.machineId,
        deviceUdid: device.udid,
        project: 'ui-spec-app',
        branch: 'main',
        suite: 'ui-smoke',
        run: { command: 'node', args: ['-e', 'process.exit(0)'] },
      },
    });
    const run = (await res.json()) as { _id: string };

    await page.goto('/execution');
    await expect(page.getByText('ui-spec-app').first()).toBeVisible();

    await page.goto(`/execution/${run._id}`);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('ui-spec-app');
    // The stage pipeline must name each stage, not just colour it.
    await expect(page.getByText('Execute suite')).toBeVisible();
    await expect(page.getByText(device.udid)).toBeVisible();
  });

  test('an unknown run id shows an error state rather than a blank page', async ({ page }) => {
    await page.goto('/execution/000000000000000000000000');
    await expect(page.getByRole('alert')).toBeVisible();
  });
});
