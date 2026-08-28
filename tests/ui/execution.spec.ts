import { test, expect } from '@playwright/test';
import { seedDevice, signUpThroughUi } from './helpers/ui';

async function signInAsAdmin(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill('e2e-admin@example.com');
  await page.getByLabel('Password').fill('e2e-admin-password-123');
  await page.getByRole('button', { name: /^Sign in$/i }).click();
  await expect(page.getByRole('button', { name: /Sign out/i })).toBeVisible();
}

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

    // The run is a trivial, near-instant process — it can already be
    // terminal by the time the page loads, which moves it off the default
    // "current" tab (non-terminal runs only) onto "history". Wait for the
    // real state instead of guessing which tab it'll land on.
    const inFlight = new Set(['queued', 'preparing', 'running']);
    await expect
      .poll(
        async () => {
          const r = await (await request.get(`${apiBase}/api/execution/${run._id}`)).json();
          return inFlight.has(r.status);
        },
        { timeout: 15000 },
      )
      .toBe(false);

    await page.goto('/execution?tab=history');
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

  test('the Trigger/Current/History tabs switch, and the active one is reflected in the URL', async ({ page }) => {
    await signInAsAdmin(page);
    await page.goto('/execution');

    // Bare /execution defaults to the most actionable tab (a client-side
    // default, not a redirect — the URL itself stays bare until a tab is
    // explicitly picked).
    await expect(page.getByRole('button', { name: /^Current/ })).toHaveAttribute('aria-pressed', 'true');

    await page.getByRole('button', { name: 'Trigger', exact: true }).click();
    await expect(page).toHaveURL(/tab=trigger/);
    await expect(page.getByRole('button', { name: /^Start run/i })).toBeVisible();

    await page.getByRole('button', { name: /^History/ }).click();
    await expect(page).toHaveURL(/tab=history/);
    await expect(page.getByRole('button', { name: /^History/ })).toHaveAttribute('aria-pressed', 'true');
  });

  test('saving and loading a trigger-form preset round-trips the real field values', async ({ page, request }) => {
    const device = await seedDevice(request);
    await signInAsAdmin(page);
    await page.goto('/execution?tab=trigger');

    const presetName = `e2e-preset-${Date.now()}`;
    await page.getByLabel('Project').fill('preset-project');
    await page.getByLabel('Branch').fill('preset-branch');
    await page.getByLabel('Suite').fill('preset-suite');
    await page.getByLabel(/^Device \(/).selectOption({ value: device.udid });
    await page.getByLabel('Run command').fill('echo preset-run');

    await page.getByRole('button', { name: 'Save as preset' }).click();
    await page.getByLabel('Preset name').fill(presetName);
    await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('dialog')).toBeHidden();

    // Clear the form (reload), then load the preset back.
    await page.reload();
    await expect(page.getByLabel('Project')).toHaveValue('');

    // getByLabel('Preset') is ambiguous — the wrapping <label>'s computed
    // accessible name includes the select's own rendered option text, so it
    // never matches just "Preset". It's the form's first <select> (before
    // the Device one), which is a stable enough anchor here.
    await page.locator('form select').first().selectOption({ label: presetName });
    await expect(page.getByLabel('Project')).toHaveValue('preset-project');
    await expect(page.getByLabel('Branch')).toHaveValue('preset-branch');
    await expect(page.getByLabel('Suite')).toHaveValue('preset-suite');
    await expect(page.getByLabel('Run command')).toHaveValue('echo preset-run');

    // Delete it — the "delete selected preset" control only appears once a
    // preset is actually selected.
    await page.getByRole('button', { name: 'Delete selected preset' }).click();
    await expect(page.locator('form select').first()).not.toContainText(presetName);
  });
});
