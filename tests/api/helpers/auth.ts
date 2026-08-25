import { APIRequestContext } from '@playwright/test';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

export interface AuthedUser {
  token: string;
  userId: string;
  email: string;
}

const ADMIN_STATE_PATH = path.join(__dirname, '..', '..', '..', '.auth', 'admin.json');

/**
 * The single admin user registered once in global-setup.ts (mobile-hub's
 * only admin policy is "first user in an empty DB" - there's no way to
 * mint a second admin via the API, so every test needing admin access
 * shares this one).
 */
export function getAdminAuth(): { token: string; userId: string } {
  const raw = fs.readFileSync(ADMIN_STATE_PATH, 'utf8');
  return JSON.parse(raw) as { token: string; userId: string };
}

/** Registers a fresh, non-admin user - unique email each call, so tests can run repeatedly without colliding. */
export async function registerUser(request: APIRequestContext): Promise<AuthedUser> {
  const email = `e2e-${randomUUID()}@example.com`;
  const res = await request.post('/api/auth/register', {
    data: { email, name: 'E2E Test User', password: 'supersecret123' },
  });
  if (!res.ok()) {
    throw new Error(`Failed to register test user: ${res.status()} ${await res.text()}`);
  }
  const body = (await res.json()) as { token: string; user: { id: string } };
  return { token: body.token, userId: body.user.id, email };
}

export function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

/** A unique machineId/udid pair per test, so parallel or repeated runs never collide on device state. */
export function uniqueDevice(): { machineId: string; udid: string } {
  const id = randomUUID().slice(0, 8);
  return { machineId: `e2e-host-${id}`, udid: `e2e-device-${id}` };
}

/**
 * Headers a device agent must present on /api/hosts/heartbeat and
 * /api/devices/sync. Empty when AGENT_TOKEN is unset, which is the hub's
 * development-only open mode — so the suite works against either, while
 * exercising the authenticated path CI and production actually use.
 */
export function agentHeaders(): Record<string, string> {
  const token = process.env.AGENT_TOKEN;
  return token ? { Authorization: `Bearer ${token}` } : {};
}
