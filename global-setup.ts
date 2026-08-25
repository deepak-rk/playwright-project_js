import { request } from '@playwright/test';
import { MongoClient } from 'mongodb';
import * as fs from 'fs';
import * as path from 'path';

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:3000';
const UI_BASE_URL = process.env.UI_BASE_URL ?? 'http://localhost:5173';
/** UI specs need the frontend too; set SKIP_UI=1 to run API-only against a bare backend. */
const UI_ENABLED = process.env.SKIP_UI !== '1';
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
 *
 * Deletes every document but deliberately does NOT drop the database:
 * dropping it also destroys the indexes, and the already-running backend's
 * Mongoose connection never rebuilds them. That silently breaks anything
 * depending on a unique index - e.g. duplicate-email registration would
 * start returning 201 instead of 409, because the E11000 that mobile-hub
 * maps to a 409 can't happen without the index.
 */
async function resetDatabase(): Promise<void> {
  if (!MONGODB_URI.includes('mobilehub_e2e') && !MONGODB_URI.includes('test')) {
    throw new Error(
      `Refusing to wipe the database at MONGODB_URI="${MONGODB_URI}" - it doesn't look like a dedicated test database ` +
        `(expected the name to contain "mobilehub_e2e" or "test"). Set MONGODB_URI explicitly to avoid wiping real data.`,
    );
  }
  const client = new MongoClient(MONGODB_URI);
  try {
    await client.connect();
    const collections = await client.db().collections();
    await Promise.all(collections.map((c) => c.deleteMany({})));
    await assertUniqueEmailIndex(client);
  } finally {
    await client.close();
  }
}

/**
 * Guards against a subtle failure mode that otherwise surfaces as a baffling
 * assertion error several tests later: if the `users.email` unique index is
 * missing, mobile-hub silently accepts duplicate registrations (it maps
 * Mongo's E11000 to a 409, and without the index there's no E11000), so the
 * duplicate-email test fails with "expected 409, got 201" and nothing points
 * at the real cause. Mongoose also swallows index-build errors, so a failed
 * build leaves no trace in the backend logs either.
 */
async function assertUniqueEmailIndex(client: MongoClient): Promise<void> {
  const users = client.db().collection('users');
  const exists = await users.indexExists('email_1').catch(() => false);
  if (exists) return;

  // The collection may simply not exist yet on a first-ever run - that's fine,
  // the backend builds indexes when it next touches the model.
  const names = (await client.db().listCollections({ name: 'users' }).toArray()).length;
  if (names === 0) return;

  throw new Error(
    `The 'users.email' unique index is missing from ${MONGODB_URI}.\n` +
      `mobile-hub relies on it to reject duplicate registrations with 409 - without it, duplicates are silently accepted.\n` +
      `This usually means the database was dropped while the backend was running (dropping a DB destroys its indexes, ` +
      `and Mongoose does not rebuild them, nor report the failure). Fix: restart the mobile-hub backend against a ` +
      `clean database so Mongoose rebuilds its indexes, then re-run.`,
  );
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

async function waitForFrontend(): Promise<void> {
  const deadline = Date.now() + HEALTH_TIMEOUT_MS;
  const ctx = await request.newContext();
  try {
    while (Date.now() < deadline) {
      try {
        const res = await ctx.get(UI_BASE_URL, { timeout: 2000 });
        if (res.ok()) return;
      } catch {
        // not up yet, keep polling
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
    throw new Error(
      `The mobile-hub frontend at ${UI_BASE_URL} never responded within ${HEALTH_TIMEOUT_MS}ms. ` +
        `Start it (npm run dev in mobile-hub/frontend), or run with SKIP_UI=1 to skip the UI project.`,
    );
  } finally {
    await ctx.dispose();
  }
}

export default async function globalSetup(): Promise<void> {
  await waitForHealth();
  if (UI_ENABLED) await waitForFrontend();
  await resetDatabase();
  await registerAdminUser();
}
