import { test, expect } from '@playwright/test';
import { seedDevice, signUpThroughUi } from './helpers/ui';

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:3000';

/**
 * These need the backend running with STREAM_CAPTURE_SOURCE=synthetic, since
 * no real device is attached in CI. Skipped otherwise rather than failing, so
 * a run against real hardware doesn't report a false negative.
 */
test.describe('device live view', () => {
  test('signed out, the viewer invites sign-in rather than showing nothing', async ({ page, request }) => {
    const device = await seedDevice(request);
    await page.goto(`/devices/${device.udid}`);

    await expect(page.getByText(/Sign in to watch this device/i)).toBeVisible();
    await expect(page.getByText('Sign in to view')).toBeVisible();
  });

  test('signed in, frames stream and the viewer detaches on navigate away', async ({ page, request }) => {
    const device = await seedDevice(request);
    await signUpThroughUi(page);
    await page.goto(`/devices/${device.udid}`);

    // The connection banner is non-negotiable (guidelines §10).
    await expect(page.getByText('Live', { exact: true })).toBeVisible({ timeout: 20000 });

    const frame = page.locator('img[alt$="screen"]');
    await expect(frame).toBeVisible({ timeout: 20000 });

    // Frames must actually keep arriving, not be one still.
    const first = await frame.getAttribute('src');
    await expect
      .poll(async () => frame.getAttribute('src'), { timeout: 10000 })
      .not.toBe(first);

    // Exactly one session, one viewer — the shared-capture invariant.
    // Polled rather than sampled once: React StrictMode double-invokes effects
    // in dev, so a second socket can briefly overlap the first's close and the
    // server-side count is legitimately eventually-consistent.
    await expect
      .poll(
        async () => {
          const s = await (await request.get(`${API_BASE_URL}/api/devices/${device.udid}/stream/status`)).json();
          return { sessions: s.sessions.length, viewers: s.sessions[0]?.viewerCount };
        },
        { timeout: 15000 },
      )
      .toEqual({ sessions: 1, viewers: 1 });

    // Leaving the page must release the viewer, or captures leak.
    await page.goto('/devices');
    await expect
      .poll(
        async () => {
          const s = await (await request.get(`${API_BASE_URL}/api/devices/${device.udid}/stream/status`)).json();
          return s.sessions[0].viewerCount;
        },
        { timeout: 10000 },
      )
      .toBe(0);
  });

  test('two viewers on one device share a single capture', async ({ page, context, request }) => {
    const device = await seedDevice(request);
    await signUpThroughUi(page);
    await page.goto(`/devices/${device.udid}`);
    await expect(page.getByText('Live', { exact: true })).toBeVisible({ timeout: 20000 });

    // A second tab in the same context reuses the session token.
    const second = await context.newPage();
    await second.goto(`/devices/${device.udid}`);
    await expect(second.getByText('Live', { exact: true })).toBeVisible({ timeout: 20000 });

    await expect
      .poll(
        async () => {
          const s = await (await request.get(`${API_BASE_URL}/api/devices/${device.udid}/stream/status`)).json();
          return { sessions: s.sessions.length, viewers: s.sessions[0]?.viewerCount };
        },
        { timeout: 10000 },
      )
      .toEqual({ sessions: 1, viewers: 2 });

    await second.close();
  });
});
