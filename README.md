# mobile-hub-e2e

End-to-end tests for [mobile-hub](https://github.com/deepak-rk/mobile-hub) — **46 tests**: 24 against the API (auth, devices, hosts, config, builds, execution, including the live WebSocket event stream) and 22 driving the real UI in a browser (app shell, authentication, device locking, execution, live log streaming, and the live device view).

## Prerequisites

This suite does **not** manage mobile-hub's lifecycle — start it yourself first:

1. A MongoDB instance reachable at the URI you'll set below. A throwaway container is enough:
   ```bash
   docker run -d -p 27017:27017 mongo:7
   ```
2. mobile-hub's backend, pointed at a **dedicated test database** (never your dev/prod one — `global-setup.ts` wipes it before every run):
   ```bash
   cd path/to/mobile-hub/backend
   MONGODB_URI=mongodb://localhost:27017/mobilehub_e2e \
     JWT_SECRET=<32+ chars> \
     RATE_LIMIT_MAX=100000 \
     STREAM_CAPTURE_SOURCE=synthetic \
     npm run dev
   ```
   `RATE_LIMIT_MAX` is raised because the suite legitimately exceeds the 200/min default in a
   single run, and `STREAM_CAPTURE_SOURCE=synthetic` makes the device-stream specs work with no
   real device attached.

3. mobile-hub's frontend, for the UI project:
   ```bash
   cd path/to/mobile-hub/frontend
   npm run dev     # http://localhost:5173, proxies /api to the backend
   ```
4. Confirm both are up: `curl http://localhost:3000/health` and `curl http://localhost:5173`

## Running the tests

```bash
npm install
npx playwright install --with-deps   # first time only
npm test
```

- `npm run test:ui` — Playwright's UI mode, for writing/debugging tests interactively.
- `npm run report` — opens the HTML report from the last run.

Run one project at a time, or skip the UI entirely when you only have a backend:

```bash
npx playwright test --project=api      # API only
npx playwright test --project=ui       # UI only (still depends on the api project)
SKIP_UI=1 npm test                     # don't even wait for a frontend
```

Override the targets with env vars:

```bash
API_BASE_URL=http://localhost:3000 \
  UI_BASE_URL=http://localhost:5173 \
  MONGODB_URI=mongodb://localhost:27017/mobilehub_e2e \
  npm test
```

## How the suite handles auth

mobile-hub's only admin policy is "the first user registered in an empty database becomes admin" — there's no API to mint a second one. So:

1. `global-setup.ts` waits for the backend (and frontend) to be healthy, **clears every document in the test database** — deliberately not dropping it, which would destroy the indexes the running backend never rebuilds — then registers exactly one admin user and saves its token to `.auth/admin.json` (gitignored).
2. Tests needing admin/operator access read that shared token via `helpers/auth.ts`'s `getAdminAuth()`.
3. Tests needing a plain non-admin user call `registerUser()` (API) or `signUpThroughUi()` (UI), which mint a fresh one with a random email every time — safe to call as many times as needed.

This is also why tests run serially (`workers: 1`, `fullyParallel: false`, see `playwright.config.ts`) — they share backend state (the admin user, and any device/host records), and parallelizing would mean chasing cross-test races instead of testing mobile-hub.

## What's covered / not yet

**API (24)** — `auth`, `hosts`, `devices` (including the sync-while-locked and host-drops-device regression cases mobile-hub itself found and fixed), `config` (admin-only), `builds` (real fetch/checksum against a local fixture artifact server), `execution` (pass/fail/cancel/409-on-locked-device, and the live WS event stream with token auth).

**UI (22)** — nav and routing, theme toggle persistence, a console-error check across every section, sign-up/sign-in/sign-out, stale-token recovery, device grid and detail, lock/release round-trip (including that your own lock reads as "You" and that a non-admin is offered no release on someone else's lock), the role-gating on triggering a run, live WebSocket log streaming (log lines and the terminal status arriving without a reload, plus the signed-out message), and the live device view (frames rendering and updating, the viewer detaching on navigate-away, and two viewers sharing a single capture).

⬜ Not yet: analytics assertions beyond the page rendering, H264 streaming (unbuilt in mobile-hub), and visual-regression snapshots.

## License

MIT
