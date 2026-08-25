import { test, expect } from '@playwright/test';
import WebSocket from 'ws';
import { agentHeaders, authHeaders, getAdminAuth, registerUser, uniqueDevice } from './helpers/auth';
import { pollExecutionRunUntilDone } from './helpers/poll';

async function syncOneDevice(request: import('@playwright/test').APIRequestContext, machineId: string, udid: string) {
  return request.post('/api/devices/sync', {
    headers: agentHeaders(),
    data: {
      machineId,
      devices: [
        { udid, platform: 'android', name: 'Pixel 7', osVersion: '14', model: 'Pixel 7', connectionType: 'emulator' },
      ],
    },
  });
}

test.describe('execution', () => {
  test('trigger requires operator/admin role', async ({ request }) => {
    const viewer = await registerUser(request);
    const res = await request.post('/api/execution', {
      headers: authHeaders(viewer.token),
      data: {
        machineId: 'x',
        deviceUdid: 'x',
        project: 'e2e',
        branch: 'main',
        suite: 'smoke',
        run: { command: 'node', args: ['-e', 'process.exit(0)'] },
      },
    });
    expect(res.status()).toBe(403);
  });

  test('a passing run locks the device, runs setup+execute, then releases the lock', async ({ request }) => {
    const { machineId, udid } = uniqueDevice();
    const admin = getAdminAuth();
    await syncOneDevice(request, machineId, udid);

    const trigger = await request.post('/api/execution', {
      headers: authHeaders(admin.token),
      data: {
        machineId,
        deviceUdid: udid,
        project: 'e2e-app',
        branch: 'main',
        suite: 'smoke',
        setup: { command: 'node', args: ['-e', 'console.log("setup ok")'] },
        run: { command: 'node', args: ['-e', 'console.log("test ok"); process.exit(0)'] },
      },
    });
    expect(trigger.ok()).toBeTruthy();
    const { _id: runId } = await trigger.json();

    const finished = await pollExecutionRunUntilDone(request, runId);
    expect(finished.status).toBe('passed');
    expect((finished.stages as { name: string; status: string }[]).find((s) => s.name === 'execute')?.status).toBe(
      'done',
    );

    const device = await (await request.get(`/api/devices/${udid}`)).json();
    expect(device.status).toBe('idle');
    expect(device.lock).toBeNull();
  });

  test('a failing run (nonzero exit) is recorded as failed and still releases the lock', async ({ request }) => {
    const { machineId, udid } = uniqueDevice();
    const admin = getAdminAuth();
    await syncOneDevice(request, machineId, udid);

    const trigger = await request.post('/api/execution', {
      headers: authHeaders(admin.token),
      data: {
        machineId,
        deviceUdid: udid,
        project: 'e2e-app',
        branch: 'main',
        suite: 'smoke',
        run: { command: 'node', args: ['-e', 'console.error("boom"); process.exit(1)'] },
      },
    });
    const { _id: runId } = await trigger.json();

    const finished = await pollExecutionRunUntilDone(request, runId);
    expect(finished.status).toBe('failed');
    const executeStage = (finished.stages as { name: string; status: string; error: string | null }[]).find(
      (s) => s.name === 'execute',
    );
    expect(executeStage?.status).toBe('error');
    expect(executeStage?.error).toContain('1');

    const device = await (await request.get(`/api/devices/${udid}`)).json();
    expect(device.lock).toBeNull();
  });

  test('triggering against an already-locked device returns 409', async ({ request }) => {
    const { machineId, udid } = uniqueDevice();
    const admin = getAdminAuth();
    await syncOneDevice(request, machineId, udid);

    const slow = await request.post('/api/execution', {
      headers: authHeaders(admin.token),
      data: {
        machineId,
        deviceUdid: udid,
        project: 'e2e-app',
        branch: 'main',
        suite: 'smoke',
        run: { command: 'node', args: ['-e', 'setTimeout(() => process.exit(0), 3000)'] },
      },
    });
    expect(slow.ok()).toBeTruthy();
    const { _id: slowRunId } = await slow.json();

    const second = await request.post('/api/execution', {
      headers: authHeaders(admin.token),
      data: {
        machineId,
        deviceUdid: udid,
        project: 'e2e-app',
        branch: 'main',
        suite: 'smoke2',
        run: { command: 'node', args: ['-e', 'process.exit(0)'] },
      },
    });
    expect(second.status()).toBe(409);

    await pollExecutionRunUntilDone(request, slowRunId); // let it finish so it doesn't leak into other tests
  });

  test('cancelling a run kills the process and releases the lock', async ({ request }) => {
    const { machineId, udid } = uniqueDevice();
    const admin = getAdminAuth();
    await syncOneDevice(request, machineId, udid);

    const trigger = await request.post('/api/execution', {
      headers: authHeaders(admin.token),
      data: {
        machineId,
        deviceUdid: udid,
        project: 'e2e-app',
        branch: 'main',
        suite: 'smoke',
        run: { command: 'node', args: ['-e', 'setTimeout(() => process.exit(0), 10000)'] },
      },
    });
    const { _id: runId } = await trigger.json();

    const cancel = await request.post(`/api/execution/${runId}/cancel`, { headers: authHeaders(admin.token) });
    expect(cancel.ok()).toBeTruthy();

    const finished = await pollExecutionRunUntilDone(request, runId);
    expect(finished.status).toBe('cancelled');

    const device = await (await request.get(`/api/devices/${udid}`)).json();
    expect(device.lock).toBeNull();
  });

  test('the WS event stream delivers live stage/status/log events, and rejects a bad token', async ({
    request,
    baseURL,
  }) => {
    const { machineId, udid } = uniqueDevice();
    const admin = getAdminAuth();
    await syncOneDevice(request, machineId, udid);

    const trigger = await request.post('/api/execution', {
      headers: authHeaders(admin.token),
      data: {
        machineId,
        deviceUdid: udid,
        project: 'e2e-app',
        branch: 'main',
        suite: 'ws-test',
        run: { command: 'node', args: ['-e', 'console.log("running"); setTimeout(() => process.exit(0), 1500)'] },
      },
    });
    const { _id: runId } = await trigger.json();

    const wsBase = (baseURL ?? 'http://localhost:3000').replace(/^http/, 'ws');

    // Bad token: connection should close immediately with no events.
    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(`${wsBase}/api/execution/${runId}/stream?token=not-a-real-token`);
      ws.on('message', () => reject(new Error('should not have received an event with a bad token')));
      ws.on('close', (code) => {
        expect(code).toBe(4001);
        resolve();
      });
      ws.on('error', reject);
    });

    // Valid token: should see real events arrive before the run finishes.
    const events: unknown[] = [];
    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(`${wsBase}/api/execution/${runId}/stream?token=${admin.token}`);
      ws.on('message', (data) => {
        events.push(JSON.parse(data.toString()));
        const parsed = JSON.parse(data.toString()) as { type: string; status?: string };
        if (parsed.type === 'status' && (parsed.status === 'passed' || parsed.status === 'failed')) {
          ws.close();
          resolve();
        }
      });
      ws.on('error', reject);
      setTimeout(() => reject(new Error('WS test timed out waiting for terminal status event')), 5000);
    });

    expect(events.length).toBeGreaterThan(0);
    expect(events.some((e) => (e as { type: string }).type === 'log')).toBeTruthy();
  });
});
