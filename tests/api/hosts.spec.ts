import { test, expect } from '@playwright/test';
import { randomUUID } from 'crypto';

test.describe('hosts', () => {
  test('heartbeat creates/updates a host, GET reflects it', async ({ request }) => {
    const machineId = `e2e-host-${randomUUID().slice(0, 8)}`;

    const heartbeat = await request.post('/api/hosts/heartbeat', {
      data: {
        machineId,
        hostname: 'e2e-test-host',
        os: 'linux',
        agentVersion: '1.0.0',
        capabilities: { maxDevices: 5, androidSupport: true, iosSupport: false },
      },
    });
    expect(heartbeat.ok()).toBeTruthy();
    const body = await heartbeat.json();
    expect(body.status).toBe('online');

    const get = await request.get(`/api/hosts/${machineId}`);
    expect(get.ok()).toBeTruthy();
    expect((await get.json()).machineId).toBe(machineId);
  });

  test('GET /api/hosts lists hosts', async ({ request }) => {
    const list = await request.get('/api/hosts');
    expect(list.ok()).toBeTruthy();
    expect(Array.isArray(await list.json())).toBeTruthy();
  });

  test('GET on an unknown machineId returns 404', async ({ request }) => {
    const res = await request.get('/api/hosts/does-not-exist-xyz');
    expect(res.status()).toBe(404);
  });
});
