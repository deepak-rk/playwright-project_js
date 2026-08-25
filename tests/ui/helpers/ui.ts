import { Page, APIRequestContext, expect } from '@playwright/test';
import { randomUUID } from 'crypto';

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:3000';

/** Agent-token headers; empty when the hub runs in its development open mode. */
function agentHeaders(): Record<string, string> {
  const token = process.env.AGENT_TOKEN;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface SeededDevice {
  machineId: string;
  udid: string;
  name: string;
}

/**
 * Seeds a host + device straight through the API. UI specs assert on what the
 * app *shows*, so their fixtures come from the real API rather than the UI -
 * otherwise a broken sync page would make unrelated specs fail confusingly.
 */
export async function seedDevice(request: APIRequestContext, overrides: Partial<SeededDevice> = {}): Promise<SeededDevice> {
  const id = randomUUID().slice(0, 8);
  const device: SeededDevice = {
    machineId: overrides.machineId ?? `ui-host-${id}`,
    udid: overrides.udid ?? `ui-device-${id}`,
    name: overrides.name ?? `Test Device ${id}`,
  };

  await request.post(`${API_BASE_URL}/api/hosts/heartbeat`, {
    headers: agentHeaders(),
    data: {
      machineId: device.machineId,
      hostname: device.machineId,
      os: 'linux',
      agentVersion: '1.0.0',
      capabilities: { maxDevices: 4, androidSupport: true, iosSupport: false },
    },
  });
  await request.post(`${API_BASE_URL}/api/devices/sync`, {
    headers: agentHeaders(),
    data: {
      machineId: device.machineId,
      devices: [
        {
          udid: device.udid,
          platform: 'android',
          name: device.name,
          osVersion: '14',
          model: 'Pixel 7',
          connectionType: 'emulator',
        },
      ],
    },
  });
  return device;
}

/** Registers a brand-new user through the UI and lands back on the app. */
export async function signUpThroughUi(page: Page): Promise<{ email: string; name: string }> {
  const email = `ui-${randomUUID()}@example.com`;
  const name = 'UI Test User';

  await page.goto('/login');
  await page.getByRole('button', { name: /Create one/i }).click();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Name').fill(name);
  await page.getByLabel('Password').fill('ui-password-123');
  await page.getByRole('button', { name: /Create account/i }).click();
  await expect(page.getByRole('button', { name: /Sign out/i })).toBeVisible();

  return { email, name };
}
