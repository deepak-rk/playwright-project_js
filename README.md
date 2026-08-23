# mobile-hub-e2e

End-to-end tests for [mobile-hub](https://github.com/deepak-rk/mobile-hub) — API coverage today (auth, devices, hosts, config, builds, execution, including the live WebSocket event stream), UI coverage once mobile-hub's frontend actually typechecks and has real pages to click through.

## Prerequisites

This suite does **not** manage mobile-hub's lifecycle — start it yourself first:

1. A MongoDB instance reachable at the URI you'll set below. A throwaway container is enough:
   ```bash
   docker run -d -p 27017:27017 mongo:7
   ```
2. mobile-hub's backend, pointed at a **dedicated test database** (never your dev/prod one — `global-setup.ts` drops it before every run):
   ```bash
   cd path/to/mobile-hub/backend
   MONGODB_URI=mongodb://localhost:27017/mobilehub_e2e JWT_SECRET=<32+ chars> npm run dev
   ```
3. Confirm it's up: `curl http://localhost:3000/health`

## Running the tests

```bash
npm install
npx playwright install --with-deps   # first time only
npm test
```

- `npm run test:ui` — Playwright's UI mode, for writing/debugging tests interactively.
- `npm run report` — opens the HTML report from the last run.

Override the target backend/database with env vars:

```bash
API_BASE_URL=http://localhost:3000 MONGODB_URI=mongodb://localhost:27017/mobilehub_e2e npm test
```

## How the suite handles auth

mobile-hub's only admin policy is "the first user registered in an empty database becomes admin" — there's no API to mint a second one. So:

1. `global-setup.ts` waits for the backend to be healthy, **drops the test database**, then registers exactly one admin user and saves its token to `.auth/admin.json` (gitignored).
2. Tests needing admin/operator access read that shared token via `helpers/auth.ts`'s `getAdminAuth()`.
3. Tests needing a plain non-admin user call `registerUser()`, which mints a fresh one with a random email every time — safe to call as many times as needed.

This is also why tests run serially (`workers: 1`, `fullyParallel: false`, see `playwright.config.ts`) — they share backend state (the admin user, and any device/host records), and parallelizing would mean chasing cross-test races instead of testing mobile-hub.

## What's covered / not yet

- ✅ `auth`, `hosts`, `devices` (including the sync-while-locked and host-drops-device regression cases mobile-hub itself found and fixed), `config` (admin-only), `builds` (real fetch/checksum against a local fixture artifact server), `execution` (pass/fail/cancel/409-on-locked-device, and the live WS event stream with token auth).
- ⬜ UI tests — blocked on mobile-hub's frontend actually typechecking (`docs/TODO.md` in that repo tracks it).
- ⬜ `streaming`/`analytics` — not started in mobile-hub itself yet.

## License

MIT
