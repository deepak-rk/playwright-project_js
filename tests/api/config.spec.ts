import { test, expect } from '@playwright/test';
import { authHeaders, getAdminAuth, registerUser } from './helpers/auth';

test.describe('config', () => {
  test('GET /api/config requires auth and admin role', async ({ request }) => {
    const unauthed = await request.get('/api/config');
    expect(unauthed.status()).toBe(401);

    const viewer = await registerUser(request); // never admin - admin is only the global-setup user
    const asViewer = await request.get('/api/config', { headers: authHeaders(viewer.token) });
    expect(asViewer.status()).toBe(403);

    const admin = getAdminAuth();
    const asAdmin = await request.get('/api/config', { headers: authHeaders(admin.token) });
    expect(asAdmin.ok()).toBeTruthy();
    const body = await asAdmin.json();
    expect(body.features).toBeTruthy();
    expect(body.build).toBeTruthy();
    expect(body.automation).toBeTruthy();
  });
});
