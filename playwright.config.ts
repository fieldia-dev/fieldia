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
 * meets first — forms drawn and filled, their behaviour and layout, lists, their totals and periods (days counted
 * through each engine's own Intl), what they export and change in bulk and what they import (a file chosen or dropped,
 * read in each engine's own DecompressionStream and TextDecoder, its dialog), their cards on a phone and their columns
 * a person shapes, a record's related lists and a tab's count of one, an empty table of lines' words, dialogs, the quiet look, a place on a map, right to left, and a part that
 * fails kept to itself — in the plain demo alone, as the frameworks' bindings draw the same DOM — where the keyboard
 * lands after save safety's buttons hide themselves, which each engine moves its own way, a box the browser fills in,
 * which each engine writes its own way, a phone read the world over, a box of its own over the browser's list of
 * countries, booking slots and a date and time on a zone's clock, which each engine's Intl writes and each engine's
 * keys move, a phone's frame round a demo, and fieldia.dev's bar and story on a phone (phone-frame), and what a
 * phone's finger meets — a press that lands where it began, a title that wraps, a record's labels above its values;
 * a list that drops open only when a person asks, which each engine focuses its own way; possible duplicates, a note
 * under a box and a merge's screen of radios, each engine drawing its own; a page laid out for paper (print), each
 * engine laying it out its own way; a calendar on a named zone's clock seen from other zones, which each engine's Intl
 * reads; a link's box typed in before its part came, which each engine hands over its own way; and a part's own
 * words, put in each language's tables as it comes. Chromium runs everything. `npx playwright test --project=firefox` (or webkit) runs one engine.
 */
const SMOKE = ['render', 'form-behaviour', 'behaviour', 'layout', 'lists', 'list-totals', 'lists-bulk', 'lists-import', 'list-cards', 'related-list', 'related-count-open', 'grid-empty', 'dialogs', 'quiet-look', 'map-place', 'contain', 'save-safety-focus', 'autofill', 'phone', 'slots', 'phone-frame', 'steady-press', 'pressed-error', 'phone-titles', 'rules-cell-hold-every-engine', 'rules-number-autofill-keeps-value', 'rules-hours-percent-entered-and-left-keep-value', 'rules-part-swap-keeps-typing', 'duplicates', 'print', 'calendar-zone', 'relations-part', 'phone-labels', 'focus-lists-closed', 'part-words'];
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
