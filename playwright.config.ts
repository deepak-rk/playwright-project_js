import { defineConfig } from '@playwright/test';

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:3000';

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
  use: {
    baseURL: API_BASE_URL,
  },
  projects: [{ name: 'api', testMatch: /tests\/api\/.*\.spec\.ts/ }],
});
