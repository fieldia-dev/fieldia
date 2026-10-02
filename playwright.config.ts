import { defineConfig, devices } from '@playwright/test';

/**
 * Browser gates. The demos are built first (node tools/build-demos.mjs) and
 * served as static files, so these tests drive exactly what a person would
 * open. Screenshots land in test-results/screens for a human look.
 */
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: 0,
  reporter: process.env['CI'] ? [['list'], ['github']] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4321',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'node tools/serve.mjs dist/demos 4321',
    url: 'http://127.0.0.1:4321/plain/',
    reuseExistingServer: !process.env['CI'],
  },
});
