import { request } from '@playwright/test';
import { MongoClient } from 'mongodb';
import * as fs from 'fs';
import * as path from 'path';

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:3000';
const MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/mobilehub_e2e';
const ADMIN_STATE_PATH = path.join(__dirname, '.auth', 'admin.json');
const HEALTH_TIMEOUT_MS = 30_000;

async function waitForHealth(): Promise<void> {
  const deadline = Date.now() + HEALTH_TIMEOUT_MS;
  const ctx = await request.newContext();
  try {
    while (Date.now() < deadline) {
      try {
        const res = await ctx.get(`${API_BASE_URL}/health`, { timeout: 2000 });
        if (res.ok()) return;
      } catch {
        // not up yet, keep polling
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
    throw new Error(
      `mobile-hub backend at ${API_BASE_URL} never responded to GET /health within ${HEALTH_TIMEOUT_MS}ms. ` +
        `Start it first (see README.md) - this suite does not manage its lifecycle.`,
    );
  } finally {
    await ctx.dispose();
  }
}

/**
 * Wipes the E2E test database so the suite runs against deterministic
 * state every time - most importantly, so the admin user registered below
 * is genuinely the first user (mobile-hub's real, and only, admin policy).
 * MONGODB_URI must point at a dedicated test database, never dev/prod data.
 */
async function resetDatabase(): Promise<void> {
  if (!MONGODB_URI.includes('mobilehub_e2e') && !MONGODB_URI.includes('test')) {
    throw new Error(
      `Refusing to drop database at MONGODB_URI="${MONGODB_URI}" - it doesn't look like a dedicated test database ` +
        `(expected the name to contain "mobilehub_e2e" or "test"). Set MONGODB_URI explicitly to avoid wiping real data.`,
    );
  }
  const client = new MongoClient(MONGODB_URI);
  try {
    await client.connect();
    await client.db().dropDatabase();
  } finally {
    await client.close();
  }
}

async function registerAdminUser(): Promise<void> {
  const ctx = await request.newContext({ baseURL: API_BASE_URL });
  try {
    const res = await ctx.post('/api/auth/register', {
      data: { email: 'e2e-admin@example.com', name: 'E2E Admin', password: 'e2e-admin-password-123' },
    });
    if (!res.ok()) {
      throw new Error(`Failed to register the E2E admin user: ${res.status()} ${await res.text()}`);
    }
    const body = (await res.json()) as { token: string; user: { id: string; role: string } };
    if (body.user.role !== 'admin') {
      throw new Error(
        `Expected the first user registered after a DB reset to be 'admin', got '${body.user.role}' - ` +
          `the database reset probably didn't actually run, or something registered a user before this.`,
      );
    }
    fs.mkdirSync(path.dirname(ADMIN_STATE_PATH), { recursive: true });
    fs.writeFileSync(ADMIN_STATE_PATH, JSON.stringify({ token: body.token, userId: body.user.id }, null, 2));
  } finally {
    await ctx.dispose();
  }
}

export default async function globalSetup(): Promise<void> {
  await waitForHealth();
  await resetDatabase();
  await registerAdminUser();
}
