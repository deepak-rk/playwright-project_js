import { test, expect } from '@playwright/test';
import { seedDevice } from './helpers/ui';

/**
 * Watch several devices' live views at once. Each tile is a genuinely
 * separate viewer on the existing per-device fan-out (streaming.service.ts)
 * — additive on the single-device view, not a new backend concept. The cap
 * (3) matches the backend's own per-host ANDROID_STREAM_CAP default.
 */
test.describe('multi-view', () => {
  test('picking devices renders one tile per selection, in the URL', async ({ page, request }) => {
    const a = await seedDevice(request);
    const b = await seedDevice(request);

    await page.goto('/devices/multi-view');
    await expect(page.getByText('Nothing selected')).toBeVisible();

    await page.getByRole('button', { name: a.name, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`udids=${a.udid}`));
    await expect(page.getByText('Nothing selected')).toBeHidden();

    await page.getByRole('button', { name: b.name, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${a.udid}.*${b.udid}|${b.udid}.*${a.udid}`));

    // Each device's own name appears once as the picker chip and again as
    // its tile's heading — at least two occurrences confirms the tile
    // actually rendered, not just the selection state changing.
    await expect(page.getByText(a.name)).toHaveCount(2);
    await expect(page.getByText(b.name)).toHaveCount(2);
  });

  test('removing a tile drops it from the selection and the URL', async ({ page, request }) => {
    const device = await seedDevice(request);
    await page.goto('/devices/multi-view');
    await page.getByRole('button', { name: device.name, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`udids=${device.udid}`));

    await page.getByRole('button', { name: `Stop watching ${device.name}` }).click();
    await expect(page.getByText('Nothing selected')).toBeVisible();
    await expect(page).not.toHaveURL(new RegExp(`udids=${device.udid}`));
  });

  test('the selection is capped, and picking past it disables the remaining chips', async ({ page, request }) => {
    // MULTI_VIEW_MAX is 3 — seed one more than that.
    const devices = await Promise.all([seedDevice(request), seedDevice(request), seedDevice(request), seedDevice(request)]);

    await page.goto('/devices/multi-view');
    for (const d of devices.slice(0, 3)) {
      await page.getByRole('button', { name: d.name, exact: true }).click();
    }

    const fourth = page.getByRole('button', { name: devices[3].name, exact: true });
    await expect(fourth).toBeDisabled();
  });

  test('"Select all online" fills the grid up to the cap', async ({ page, request }) => {
    // The suite shares a database across tests, so other online devices from
    // earlier tests may already exist — this only asserts the *mechanism*
    // (fills up to MULTI_VIEW_MAX, whichever devices that ends up being),
    // not which specific devices get picked, which isn't controllable here.
    await seedDevice(request);
    await seedDevice(request);

    await page.goto('/devices/multi-view');
    await page.getByRole('button', { name: 'Select all online' }).click();

    await expect(page.getByText('Nothing selected')).toBeHidden();
    const udids = new URL(page.url()).searchParams.get('udids');
    expect(udids?.split(',').length).toBe(3); // MULTI_VIEW_MAX
  });
});
