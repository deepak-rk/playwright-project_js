import { test, expect } from '@playwright/test';
import { agentHeaders, authHeaders, registerUser, uniqueDevice } from './helpers/auth';

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

test.describe('devices', () => {
  test('sync creates a device, lock/unlock requires auth and round-trips correctly', async ({ request }) => {
    const { machineId, udid } = uniqueDevice();
    const user = await registerUser(request);

    const sync = await syncOneDevice(request, machineId, udid);
    expect(sync.ok()).toBeTruthy();
    expect((await sync.json()).upserted).toBe(1);

    const lockUnauthed = await request.post(`/api/devices/${udid}/lock`, { data: { reason: 'e2e' } });
    expect(lockUnauthed.status()).toBe(401);

    const lock = await request.post(`/api/devices/${udid}/lock`, {
      headers: authHeaders(user.token),
      data: { reason: 'e2e test' },
    });
    expect(lock.ok()).toBeTruthy();
    const locked = await lock.json();
    expect(locked.status).toBe('in-use');
    expect(locked.lock.heldBy).toBe(user.userId);

    const unlock = await request.post(`/api/devices/${udid}/unlock`, { headers: authHeaders(user.token) });
    expect(unlock.ok()).toBeTruthy();
    const unlocked = await unlock.json();
    expect(unlocked.status).toBe('idle');
    expect(unlocked.lock).toBeNull();
  });

  test('locking an already-locked device fails with 409', async ({ request }) => {
    const { machineId, udid } = uniqueDevice();
    const userA = await registerUser(request);
    const userB = await registerUser(request);
    await syncOneDevice(request, machineId, udid);

    const first = await request.post(`/api/devices/${udid}/lock`, { headers: authHeaders(userA.token) });
    expect(first.ok()).toBeTruthy();

    const second = await request.post(`/api/devices/${udid}/lock`, { headers: authHeaders(userB.token) });
    expect(second.status()).toBe(409);
  });

  test('re-syncing a locked device preserves its lock (regression: sync must not clobber status)', async ({
    request,
  }) => {
    const { machineId, udid } = uniqueDevice();
    const user = await registerUser(request);
    await syncOneDevice(request, machineId, udid);
    await request.post(`/api/devices/${udid}/lock`, { headers: authHeaders(user.token) });

    const resync = await syncOneDevice(request, machineId, udid);
    expect(resync.ok()).toBeTruthy();

    const get = await request.get(`/api/devices/${udid}`);
    const device = await get.json();
    expect(device.status).toBe('in-use');
    expect(device.lock).not.toBeNull();
  });

  test('a host dropping a device releases its lock and marks it offline', async ({ request }) => {
    const { machineId, udid } = uniqueDevice();
    const user = await registerUser(request);
    await syncOneDevice(request, machineId, udid);
    await request.post(`/api/devices/${udid}/lock`, { headers: authHeaders(user.token) });

    const emptySync = await request.post('/api/devices/sync', {
      headers: agentHeaders(),
      data: { machineId, devices: [] },
    });
    expect(emptySync.ok()).toBeTruthy();

    const get = await request.get(`/api/devices/${udid}`);
    const device = await get.json();
    expect(device.status).toBe('offline');
    expect(device.lock).toBeNull();
  });
});
