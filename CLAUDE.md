# mobile-hub-e2e — Project Guide

End-to-end tests for [mobile-hub](https://github.com/deepak-rk/mobile-hub) using Playwright. See `README.md` for how to run it; this file is for working on the suite itself.

**Status:** 51 tests passing — 29 API (auth, hosts, devices, config, builds, execution + its WS stream) and 22 UI driving the real frontend in a browser.

## Repo layout

```
mobile-hub-e2e/
  tests/
    api/
      helpers/          auth.ts, poll.ts, fixture-artifact-server.ts
      *.spec.ts          one file per mobile-hub backend module (plus agent-auth)
    ui/
      helpers/ui.ts        seedDevice() via the API, signUpThroughUi()
      *.spec.ts             shell, auth, devices, execution, streaming, device-stream
  global-setup.ts        waits for backend + frontend, wipes the test DB, mints the shared admin user
  playwright.config.ts
  README.md               usage docs (human-facing)
  CLAUDE.md                you are here (agent-facing)
```

Only `CLAUDE.md` and `README.md` live at repo root. Anything else documentation-shaped goes in `docs/`.

## Core principles

- **This suite does not manage mobile-hub's lifecycle.** No `webServer` auto-spawn, no cross-repo hardcoded paths. mobile-hub is a separate repo on a separate release cadence — tests target whatever `API_BASE_URL` points at, and `global-setup.ts` fails fast with a clear message if nothing's listening, rather than producing confusing connection-refused errors scattered across every test.
- **The test database is disposable and gets wiped every run** — by deleting every document, deliberately *not* by dropping the database: dropping also destroys the indexes, which the already-running backend never rebuilds, silently turning duplicate-email 409s into 201s. `global-setup.ts` refuses to wipe anything whose `MONGODB_URI` doesn't look like a test database (name contains "mobilehub_e2e" or "test") — a guardrail against ever pointing this at real data. Don't remove either safeguard to "make it more convenient."; it also asserts the `users.email` unique index survived, so a missing index fails loudly instead of as a nonsense assertion three tests later.
- **Tests run serially on purpose.** They share backend state (one admin user, device records keyed by machineId/udid). Use `uniqueDevice()` from `helpers/auth.ts` for any test creating device/host state, so tests can't collide with each other even though they share a database - but don't try to parallelize the suite without first giving every test fully isolated state, not just unique device ids.
- **Test what mobile-hub actually promises, not implementation details.** These are black-box HTTP/WS/browser tests against the real contract - no reaching into mobile-hub's source, no mocking its internals.
- **UI specs assert on what a user can see and do**, queried by role/label/text rather than CSS classes, so a restyle doesn't break them but a broken flow does. Their *fixtures* come from the API (`seedDevice`), not by clicking through setup screens - otherwise one broken page fails every unrelated spec.
- **Assert eventually-consistent server state with `expect.poll`, not a single sample** — viewer counts and run statuses settle asynchronously, and React StrictMode double-invokes effects in dev so sockets briefly overlap. But give the poll a real timeout before relaxing an assertion: a count that stays wrong for 15s is a leak, not flakiness. That distinction is exactly how the stream viewer leak was found rather than papered over.
- **The `ui` project depends on `api`** (`dependencies: ['api']` in the config), so a backend regression fails in the cheaper, more precise suite first instead of surfacing as a confusing UI failure.

## Do this, not that

- **Do** add a new `helpers/` function when three-plus tests would otherwise duplicate the same setup (registering a user, syncing a device, polling a run to completion) - matches root-level "three similar lines beats a premature helper" from mobile-hub's own conventions, applied here too.
- **Do** use `getAdminAuth()` for anything gated by `requireRole`, and `registerUser()` for anything that just needs *a* logged-in user. Never try to promote a `registerUser()` result to admin - there's no API for that, by design (mobile-hub's own gap, tracked in its `docs/TODO.md`, not this repo's problem to work around).
- **Not** hardcode a wait/sleep to "let the backend catch up" - `pollExecutionRunUntilDone` and `global-setup.ts`'s health-check loop exist so tests wait on real state, not a guessed duration.
- **Not** assume test order - even though the suite runs serially, each test should set up everything it needs (its own device, its own user) rather than depending on a previous test's leftover state.

## Dev loop

```
npm install
npx playwright install --with-deps   # once
npm test
npm run test:ui                       # interactive debugging
npm run report                         # HTML report from the last run
```

Needs mobile-hub's backend + a dedicated test MongoDB running first - see README.md. No unit tests for this repo's own helper code yet (small enough that the E2E tests themselves are the coverage); revisit if `helpers/` grows real logic worth testing in isolation.

## Locked decisions

- Package manager: **npm**
- Test framework: **Playwright** (`@playwright/test`)
- Language: **TypeScript**
- Test DB access: **`mongodb` driver**, used only in `global-setup.ts` for the reset - tests themselves never touch the database directly, only through mobile-hub's HTTP/WS API
- License: **MIT**
