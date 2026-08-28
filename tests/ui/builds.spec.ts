import { test, expect } from '@playwright/test';
import { getAdminAuth, authHeaders } from '../api/helpers/auth';
import { startFixtureArtifactServer, FixtureArtifactServer } from '../api/helpers/fixture-artifact-server';

const apiBase = process.env.API_BASE_URL ?? 'http://localhost:3000';

let artifactServer: FixtureArtifactServer;

test.beforeAll(async () => {
  artifactServer = await startFixtureArtifactServer();
});
test.afterAll(async () => {
  await artifactServer.close();
});

/**
 * Catalog (by project) → per-project version table → detail dialog. "View"
 * only — mobile-hub has no install pipeline, so there is deliberately no
 * Install button anywhere in this flow to assert its *absence* of, too.
 */
test.describe('builds', () => {
  test('a fetched build appears in its project catalog card, then drills down to its detail', async ({
    page,
    request,
  }) => {
    const admin = getAdminAuth();
    const project = `e2e-catalog-app-${Date.now()}`;
    const version = `1.0.${Date.now()}`;

    const trigger = await request.post(`${apiBase}/api/builds`, {
      headers: authHeaders(admin.token),
      data: { project, platform: 'android', version, artifactUrl: artifactServer.url },
    });
    expect(trigger.ok()).toBeTruthy();
    const build = (await trigger.json()) as { checksum: string };

    await page.goto('/builds');
    const card = page.locator('.rdk-card', { hasText: project });
    await expect(card).toBeVisible();
    await expect(card).toContainText('1 build');
    await expect(card).toContainText('1 on disk');

    // Drill into the project's own version table.
    await card.getByRole('button', { name: project }).click();
    await expect(page).toHaveURL(new RegExp(`project=${project}`));
    const row = page.locator('table tbody tr', { hasText: version });
    await expect(row).toBeVisible();
    await expect(row.getByText('Ready', { exact: true })).toBeVisible();

    // No Install button anywhere on this page — mobile-hub doesn't have one.
    await expect(page.getByRole('button', { name: /^Install$/i })).toHaveCount(0);

    // View opens the detail dialog with the real, full metadata.
    await row.getByRole('button', { name: 'View' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText(`${project} · ${version}`)).toBeVisible();
    await expect(dialog.getByText(build.checksum)).toBeVisible();
    await expect(dialog.getByRole('button', { name: /^Install$/i })).toHaveCount(0);

    // Two "Close"-named controls exist (the dialog's own aria-label="Close"
    // ×, and the actions-row text button) — scope to the real button.
    await dialog.locator('button.rdk-button', { hasText: 'Close' }).click();
    await expect(dialog).toBeHidden();

    await page.getByRole('button', { name: 'Back to all projects' }).click();
    await expect(page).toHaveURL(/\/builds$/);
  });
});
