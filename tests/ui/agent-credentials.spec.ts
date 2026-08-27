import { test, expect } from '@playwright/test';
import { signUpThroughUi } from './helpers/ui';

/**
 * Unlike hosts/devices, GET /api/agent-credentials is admin-only on the
 * backend (see mobile-hub's agent-credentials.routes.ts) — so this page is
 * gated at the page level, not just its actions, and the nav link itself is
 * hidden from non-admins rather than shown-then-403ing.
 */
async function signInAsAdmin(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill('e2e-admin@example.com');
  await page.getByLabel('Password').fill('e2e-admin-password-123');
  await page.getByRole('button', { name: /^Sign in$/i }).click();
  await expect(page.getByRole('button', { name: /Sign out/i })).toBeVisible();
}

test.describe('agent credentials', () => {
  test('a non-admin never sees the nav link or the page contents', async ({ page }) => {
    await signUpThroughUi(page); // a viewer — global-setup's admin already exists

    await expect(page.getByRole('link', { name: /Agent tokens/i })).toBeHidden();

    await page.goto('/agent-credentials');
    await expect(page.getByText(/Not permitted/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Issue credential/i })).toBeHidden();
  });

  test('signed out, the page asks for a sign-in rather than attempting the admin-only fetch', async ({ page }) => {
    await page.goto('/agent-credentials');
    await expect(page.getByText(/Sign in to manage agent credentials/i)).toBeVisible();
  });

  test('an admin can issue a credential, sees the raw token exactly once, and can revoke it', async ({ page }) => {
    await signInAsAdmin(page);
    await expect(page.getByRole('link', { name: /Agent tokens/i })).toBeVisible();

    await page.goto('/agent-credentials');
    const machineId = `e2e-agent-${Date.now()}`;

    // Both the header and (while the list is empty) the empty-state CTA
    // share this exact label; the header one is first in DOM order. The
    // dialog's own submit button (also this same label) is excluded here
    // since it isn't accessible until the dialog opens.
    await page.getByRole('button', { name: /Issue credential/i }).first().click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Machine ID').fill(machineId);
    await dialog.getByRole('button', { name: /^Issue credential$/i }).click();

    // The reveal dialog shows the actual token once.
    await expect(page.getByText(/only time this token will be shown/i)).toBeVisible();
    const tokenText = await page.locator('dialog[open] .rdk-dialog__body, dialog[open]').first().innerText();
    const rawToken = tokenText.match(/mha_[a-f0-9]+\.[a-f0-9]+/)?.[0];
    expect(rawToken).toBeTruthy();

    await page.getByRole('button', { name: /Done/i }).click();
    // Never shown again, anywhere on the page, after closing.
    await expect(page.getByText(rawToken!)).toHaveCount(0);

    // The row is real, from the actual API, not just optimistic UI.
    const row = page.locator('table tbody tr', { hasText: machineId });
    await expect(row).toBeVisible();
    await expect(row.getByText('Active', { exact: true })).toBeVisible();

    // Revoke, confirmed through the dialog, updates the row and rejects the
    // credential on its very next real use.
    await row.getByRole('button', { name: /Revoke/i }).click();
    const revokeDialog = page.getByRole('dialog');
    await expect(revokeDialog.getByText(/will be rejected on its very next request/i)).toBeVisible();
    await revokeDialog.getByRole('button', { name: /^Revoke$/i }).click();
    await expect(row.getByText('Revoked', { exact: true })).toBeVisible();
    await expect(row.getByRole('button', { name: /Revoke/i })).toBeHidden();

    const apiBase = process.env.API_BASE_URL ?? 'http://localhost:3000';
    const res = await page.request.post(`${apiBase}/api/hosts/heartbeat`, {
      headers: { Authorization: `Bearer ${rawToken}` },
      data: {
        machineId,
        hostname: machineId,
        os: 'linux',
        agentVersion: '1.0.0',
        capabilities: { maxDevices: 1, androidSupport: true, iosSupport: false },
      },
    });
    expect(res.status()).toBe(401);
  });
});
