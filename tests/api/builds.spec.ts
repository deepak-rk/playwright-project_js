import { test, expect } from '@playwright/test';
import { authHeaders, getAdminAuth, registerUser } from './helpers/auth';
import { startFixtureArtifactServer, FixtureArtifactServer } from './helpers/fixture-artifact-server';

let artifactServer: FixtureArtifactServer;

test.beforeAll(async () => {
  artifactServer = await startFixtureArtifactServer();
});
test.afterAll(async () => {
  await artifactServer.close();
});

test.describe('builds', () => {
  test('trigger requires operator/admin role', async ({ request }) => {
    const viewer = await registerUser(request);
    const res = await request.post('/api/builds', {
      headers: authHeaders(viewer.token),
      data: { project: 'e2e-app', platform: 'android', version: '1.0.0', artifactUrl: artifactServer.url },
    });
    expect(res.status()).toBe(403);
  });

  test('trigger with the url provider requires artifactUrl', async ({ request }) => {
    const admin = getAdminAuth();
    const res = await request.post('/api/builds', {
      headers: authHeaders(admin.token),
      data: { project: 'e2e-app', platform: 'android', version: '1.0.0' },
    });
    expect(res.status()).toBe(400);
  });

  test('trigger fetches, checksums, and marks the build ready', async ({ request }) => {
    const admin = getAdminAuth();
    const trigger = await request.post('/api/builds', {
      headers: authHeaders(admin.token),
      data: { project: 'e2e-app', platform: 'android', version: `1.0.${Date.now()}`, artifactUrl: artifactServer.url },
    });
    expect(trigger.ok()).toBeTruthy();
    const build = await trigger.json();
    expect(build.status).toBe('ready');
    expect(build.sizeBytes).toBe(artifactServer.sizeBytes);
    expect(build.checksum).toMatch(/^[0-9a-f]{64}$/);

    const get = await request.get(`/api/builds/${build._id}`);
    expect(get.ok()).toBeTruthy();
    expect((await get.json())._id).toBe(build._id);

    const list = await request.get('/api/builds?project=e2e-app');
    expect(list.ok()).toBeTruthy();
    const builds = await list.json();
    expect(builds.some((b: { _id: string }) => b._id === build._id)).toBeTruthy();
  });

  test('GET on an unknown build id returns 404', async ({ request }) => {
    const res = await request.get('/api/builds/000000000000000000000000');
    expect(res.status()).toBe(404);
  });
});
