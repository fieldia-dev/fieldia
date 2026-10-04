import { defineConfig, devices } from '@playwright/test';

/**
 * Browser gates. The demos are built first (node tools/build-demos.mjs) and
 * served as static files, so these tests drive exactly what a person would
 * open. Screenshots land in test-results/screens for a human look.
 *
 * Two copies of the repo can run their browser gates side by side: each picks
 * its own ports (FIELDIA_DEMO_PORT, FIELDIA_SITE_PORT), so neither tests the
 * other's build through a server it happened to find already running.
 */
const demoPort = Number(process.env['FIELDIA_DEMO_PORT'] ?? 4321);
const sitePort = Number(process.env['FIELDIA_SITE_PORT'] ?? 4322);
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: 0,
  reporter: process.env['CI'] ? [['list'], ['github']] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${demoPort}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: `node tools/serve.mjs dist/demos ${demoPort}`,
      url: `http://127.0.0.1:${demoPort}/plain/`,
      reuseExistingServer: !process.env['CI'],
    },
    {
      // fieldia.dev, built by tools/build-site.mjs.
      command: `node tools/serve.mjs dist/site ${sitePort}`,
      url: `http://127.0.0.1:${sitePort}/`,
      reuseExistingServer: !process.env['CI'],
    },
  ],
});
