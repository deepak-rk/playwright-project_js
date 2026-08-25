import { test, expect } from '@playwright/test';
import { seedDevice, signUpThroughUi } from './helpers/ui';

test.describe('devices', () => {
  test('a synced device appears in the grid with its status', async ({ page, request }) => {
    const device = await seedDevice(request);
    await page.goto('/devices');

    const card = page.locator('a', { hasText: device.name }).first();
    await expect(card).toBeVisible();
    await expect(page.getByText(device.udid)).toBeVisible();
    await expect(page.getByText('Idle', { exact: true }).first()).toBeVisible();
  });

  test('the device detail page shows its metadata and lock state', async ({ page, request }) => {
    const device = await seedDevice(request);
    await page.goto(`/devices/${device.udid}`);

    await expect(page.getByRole('heading', { level: 1, name: device.name })).toBeVisible();
    await expect(page.getByText(device.machineId)).toBeVisible();
    await expect(page.getByText(/no one is holding this device/i)).toBeVisible();
  });

  test('locking is offered only once signed in, and round-trips', async ({ page, request }) => {
    const device = await seedDevice(request);

    await page.goto(`/devices/${device.udid}`);
    await expect(page.getByRole('button', { name: /Lock device/i })).toBeHidden();
    await expect(page.getByText(/to lock this device/i)).toBeVisible();

    await signUpThroughUi(page);
    await page.goto(`/devices/${device.udid}`);

    await page.getByRole('button', { name: /Lock device/i }).click();
    await expect(page.getByRole('button', { name: /Release lock/i })).toBeVisible();
    // Own lock must read as "You", never as a raw user id.
    await expect(page.getByText('You', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: /Release lock/i }).click();
    await expect(page.getByRole('button', { name: /Lock device/i })).toBeVisible();
  });

  test('a device locked by someone else offers no release to a non-admin', async ({ page, request }) => {
    const device = await seedDevice(request);

    // Lock it as the E2E admin, out of band.
    const admin = JSON.parse(
      require('fs').readFileSync(require('path').join(__dirname, '..', '..', '.auth', 'admin.json'), 'utf8'),
    ) as { token: string };
    const apiBase = process.env.API_BASE_URL ?? 'http://localhost:3000';
    await request.post(`${apiBase}/api/devices/${device.udid}/lock`, {
      headers: { Authorization: `Bearer ${admin.token}` },
    });

    await signUpThroughUi(page); // a viewer
    await page.goto(`/devices/${device.udid}`);

    await expect(page.getByText(/Locked by someone else/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Release lock|Force unlock/i })).toBeHidden();
  });
});
