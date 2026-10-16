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

/**
 * Firefox and WebKit (Safari's engine: every browser on an iPhone) run a smoke set, not the whole suite: what a person
 * meets first — forms drawn and filled, their behaviour and layout, lists, dialogs, the quiet look, a place on a map,
 * right to left, and a part that fails kept to itself — in the plain demo alone, as the frameworks' bindings draw the
 * same DOM — and where the keyboard lands after save safety's buttons hide themselves, which each engine moves its own
 * way; and what a phone's finger meets — a press that lands where it began, a title that wraps. Chromium runs everything. `npx playwright test --project=firefox` (or webkit) runs one engine.
 */
const SMOKE = ['render', 'form-behaviour', 'behaviour', 'layout', 'lists', 'dialogs', 'quiet-look', 'map-place', 'contain', 'save-safety-focus', 'steady-press', 'pressed-error', 'phone-titles'];
const smoke = {
  testMatch: SMOKE.map((name) => `${name}.spec.ts`),
  // Each spec runs every framework's demo (its title starts "react: …", "vue · …" or "angular › …"); here, the plain one.
  grepInvert: /(^|\s)(react|vue|angular)(:|\s)/,
};
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
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'firefox',
      // Headless Firefox says it has no pointer, so `(hover: hover)` never holds there; a desktop's Firefox has a mouse.
      // These say so: a fine pointer that hovers (2 + 4), as the quiet look's hover rules expect of a desktop.
      use: { ...devices['Desktop Firefox'], launchOptions: { firefoxUserPrefs: { 'ui.primaryPointerCapabilities': 6, 'ui.allPointerCapabilities': 6 } } },
      ...smoke,
    },
    { name: 'webkit', use: { ...devices['Desktop Safari'] }, ...smoke },
  ],
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
