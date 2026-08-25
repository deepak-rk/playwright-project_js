import { defineConfig } from '@playwright/test';

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:3000';
const UI_BASE_URL = process.env.UI_BASE_URL ?? 'http://localhost:5173';

export default defineConfig({
  testDir: './tests',
  globalSetup: require.resolve('./global-setup'),
  // Tests share backend state (a single admin user, devices keyed by
  // machineId/udid) - serial execution keeps that state deterministic
  // instead of chasing cross-test races. Revisit if the suite grows large
  // enough that serial runtime becomes the bottleneck.
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: 'html',
  projects: [
    {
      name: 'api',
      testMatch: /tests[\\/]api[\\/].*\.spec\.ts/,
      use: { baseURL: API_BASE_URL },
    },
    {
      // UI specs drive the real frontend, which talks to the same backend
      // through its dev-server proxy. They run after the API project so a
      // backend regression fails in the cheaper, more precise suite first.
      name: 'ui',
      testMatch: /tests[\\/]ui[\\/].*\.spec\.ts/,
      dependencies: ['api'],
      use: {
        baseURL: UI_BASE_URL,
        viewport: { width: 1440, height: 900 },
        screenshot: 'only-on-failure',
        trace: 'retain-on-failure',
      },
    },
  ],
});
