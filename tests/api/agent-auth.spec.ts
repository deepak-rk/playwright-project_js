import { test, expect } from '@playwright/test';
import { randomUUID } from 'crypto';
import { agentHeaders } from './helpers/auth';

const heartbeatBody = (machineId: string) => ({
  machineId,
  hostname: 'agent-auth-spec',
  os: 'linux' as const,
  agentVersion: '1.0.0',
  capabilities: { maxDevices: 1, androidSupport: true, iosSupport: false },
});

/**
 * Unauthenticated agent endpoints let anyone register phantom hosts and
 * devices — or claim an existing machineId, report zero devices, and thereby
 * mark a real lab's devices offline and release their locks. That is a
 * one-request denial of service, so it is asserted rather than assumed.
 *
 * Skipped when the hub runs in its development open mode (no AGENT_TOKEN),
 * because there is then nothing to enforce. CI sets one.
 */
test.describe('agent authentication', () => {
  test.skip(!process.env.AGENT_TOKEN, 'hub is running without AGENT_TOKEN (development open mode)');

  test('heartbeat is rejected without a token', async ({ request }) => {
    const res = await request.post('/api/hosts/heartbeat', {
      data: heartbeatBody(`e2e-noauth-${randomUUID().slice(0, 8)}`),
    });
    expect(res.status()).toBe(401);
    expect((await res.json()).code).toBe('AGENT_UNAUTHORIZED');
  });

  test('heartbeat is rejected with a wrong token', async ({ request }) => {
    const res = await request.post('/api/hosts/heartbeat', {
      headers: { Authorization: 'Bearer definitely-not-the-configured-token' },
      data: heartbeatBody(`e2e-badauth-${randomUUID().slice(0, 8)}`),
    });
    expect(res.status()).toBe(401);
  });

  test('device sync is rejected without a token', async ({ request }) => {
    const res = await request.post('/api/devices/sync', {
      data: { machineId: 'e2e-noauth', devices: [] },
    });
    expect(res.status()).toBe(401);
  });

  test('both endpoints succeed with the configured token', async ({ request }) => {
    const machineId = `e2e-auth-${randomUUID().slice(0, 8)}`;

    const hb = await request.post('/api/hosts/heartbeat', {
      headers: agentHeaders(),
      data: heartbeatBody(machineId),
    });
    expect(hb.ok()).toBeTruthy();

    const sync = await request.post('/api/devices/sync', {
      headers: agentHeaders(),
      data: { machineId, devices: [] },
    });
    expect(sync.ok()).toBeTruthy();
  });

  test('reads stay public — only the agent write endpoints are gated', async ({ request }) => {
    expect((await request.get('/api/devices')).ok()).toBeTruthy();
    expect((await request.get('/api/hosts')).ok()).toBeTruthy();
  });
});
