import { test, expect } from '@playwright/test';
import { signUpThroughUi } from './helpers/ui';

test.describe('authentication', () => {
  test('signed out, the app is readable but offers sign-in instead of actions', async ({ page }) => {
    await page.goto('/devices');
    await expect(page.getByRole('heading', { level: 1, name: 'Devices' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Sign in/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Sign out/i })).toBeHidden();
  });

  test('registering signs the user in and shows their name and role', async ({ page }) => {
    const { name } = await signUpThroughUi(page);
    await expect(page.getByText(name)).toBeVisible();
    // Only the very first user on a clean database is admin; the E2E admin
    // already took that slot in global setup, so anyone after is a viewer.
    await expect(page.getByText('viewer', { exact: true })).toBeVisible();
  });

  test('the session survives a reload, and sign-out clears it', async ({ page }) => {
    await signUpThroughUi(page);

    await page.reload();
    await expect(page.getByRole('button', { name: /Sign out/i })).toBeVisible();

    await page.getByRole('button', { name: /Sign out/i }).click();
    await expect(page.getByRole('link', { name: /Sign in/i })).toBeVisible();

    await page.reload();
    await expect(page.getByRole('link', { name: /Sign in/i })).toBeVisible();
  });

  test('a bad password is reported without signing the user in', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('e2e-admin@example.com');
    await page.getByLabel('Password').fill('definitely-the-wrong-password');
    await page.getByRole('button', { name: /^Sign in$/i }).click();

    await expect(page.getByRole('alert')).toContainText(/invalid/i);
    await expect(page).toHaveURL(/\/login/);
  });

  test('a stale token is discarded rather than leaving a half-signed-in UI', async ({ page }) => {
    await page.goto('/devices');
    await page.evaluate(() => localStorage.setItem('mh_token', 'not-a-real-jwt'));
    await page.reload();

    // /me rejects it, so the app must fall back to signed-out cleanly.
    await expect(page.getByRole('link', { name: /Sign in/i })).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('mh_token'))).toBeNull();
  });
});
