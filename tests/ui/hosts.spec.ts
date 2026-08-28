import { test, expect } from '@playwright/test';
import { seedDevice, signUpThroughUi } from './helpers/ui';

/**
 * Hosts (renamed from "Servers" — the old page just re-rendered Devices'
 * host column under a label implying Appium server orchestration mobile-hub
 * doesn't have). Per-host agent-credential health is admin-only, same
 * restriction agent-credentials.spec.ts already exercises for that page.
 */
async function signInAsAdmin(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill('e2e-admin@example.com');
  await page.getByLabel('Password').fill('e2e-admin-password-123');
  await page.getByRole('button', { name: /^Sign in$/i }).click();
  await expect(page.getByRole('button', { name: /Sign out/i })).toBeVisible();
}

test.describe('hosts', () => {
  test('a synced host appears with its real fields, not fabricated ones', async ({ page, request }) => {
    const device = await seedDevice(request);

    await page.goto('/hosts');
    const card = page.locator('.rdk-card', { hasText: device.machineId });
    await expect(card).toBeVisible();
    await expect(card).toContainText(device.machineId);
    await expect(card).toContainText('Online');
    await expect(card).toContainText('Linux');
    await expect(card).toContainText('agent 1.0.0');
    await expect(card).toContainText('Android');
  });

  test('a non-admin sees no credential-health row', async ({ page, request }) => {
    const device = await seedDevice(request);
    await signUpThroughUi(page); // a plain viewer

    await page.goto('/hosts');
    const card = page.locator('.rdk-card', { hasText: device.machineId });
    await expect(card).toBeVisible();
    await expect(card).not.toContainText('Shared token');
    await expect(card).not.toContainText('dedicated credential');
  });

  test('an admin sees the credential-health row — shared token, since this host has no dedicated one', async ({
    page,
    request,
  }) => {
    const device = await seedDevice(request);
    await signInAsAdmin(page);

    await page.goto('/hosts');
    const card = page.locator('.rdk-card', { hasText: device.machineId });
    await expect(card).toBeVisible();
    await expect(card).toContainText('Shared token (no dedicated credential)');
  });
});
