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
 * reads; a link's box typed in before its part came, which each engine hands over its own way; a part's own words,
 * put in each language's tables as it comes; a column dragged by its header, each engine's pointer its own; a record's dialog asking before what was typed in it is let go, each engine's keys its own; a signature that signs the answers, drawn with each engine's pointer and fingerprinted by each engine's own SubtleCrypto; a list's filters — a range's boxes read as typed, a count beside each value, a phone's sheet — each engine drawing and reading its own; a table pasted into a formatted text and changed there, which each engine's editing puts in its own way; a page's ending and its answers in words, each engine's Intl writing its days and taking the focus to what it says; rows pasted on a table's dropdown cell, where no engine sends a paste of its own; a choice's boxes drawn again as the answers it follows change, each engine drawing its own; a value waiting for the app's server, its ellipsis and words, each engine's timers its own; and a form's limits — an option's places beside its words, a closed form's words in place of its questions, each engine's Intl writing its day; a conversation that knows its channels, its ticks and its choice of channel drawn by each engine, a follow-up's hour on a named zone's clock read by each engine's Intl and typed in each engine's own time box; a record's approvals — who it waits for, joined by each engine's Intl, Reject's question and its keys, each engine's own; a list's cells changed in place — a cell's box opened, Tab, Escape and Enter, a paste caught, a row left and saved — each engine's keys and focus its own; a text in two languages — its switch, each language's box written its own way, its keys and its names by each engine's Intl; AI help — a value proposed under its field, the old struck through, a dialog the words are pasted in, a list's words read as filters — each engine drawing and focusing its own; a photo set, its photos dragged by each engine's pointer and cropped on each engine's own canvas; and a code scanned with the camera, each engine's camera stream read by the decode part frame by frame; a work item's tags inline in its head's row, the menu inside its ⋮ menu and its text read first, each engine laying out the row, placing the menu and editing the text its own way; a record's status strip on a phone, scrolled to its step and resting on one, each engine scrolling and snapping its own way; the designers on a phone — one row of bar and its More, the toolbox's sheet, a title's box wrapping its words — each engine laying out, sizing and focusing its own way; lists people work in — several headers pressed with Shift, each engine's keys and pointer its own; a list's timeline — a bar dragged with each engine's pointer, its arrows turned over right to left by each engine's :dir(), the plan drawn again for paper; a month alone, a year alone and the Hijri calendar, which each engine's Intl reckons by Umm al-Qura and writes its own way; a box typed to a mask and a one-time code's boxes, whose keys, pastes and autofill each engine sends its own way; amounts typed in shorthand, whose words for thousands and millions each engine's Intl writes; options with a second line, an icon or a colour, each engine laying out its own; a checkbox tree, moved by each engine's keys; a survey's flow — a quiz's results, each engine's Intl writing its score and per cent; its review, one question at a time and its question bank, each engine's keys, focus and drafts their own way, and a time limit, each engine's timers counting down their own way; films and sounds in a file field, each engine's own players playing them (or saying a format it cannot play); a value shown as a QR code or a barcode, each engine drawing its SVG, and pins put on a picture, each engine's pointer and keys moving them; a link's fields read from each engine's own address; a phone proved by a code, its one-time code's box typed in each engine's own way; a payment step, its amount written by each engine's Intl; a form on another site, its frame grown by each engine's ResizeObserver and its messages, and sends kept without signal, in each engine's own IndexedDB; Ctrl+Z through a box's own undo then the record's, each engine's native undo its own; Undo on a toast after a press, and a repeat rule's and a week's hours' boxes, each engine's time boxes and keys its own; and pages under a strict Content-Security-Policy, which each engine enforces its own way; @fieldia/testing's helpers, which an app's tests run in each engine, and a server's first paint mounted over, what was typed in it carried into each engine's own boxes; and pages in Turkish, Persian, Urdu and Spanish — right to left, axe on them, Persian digits read and days written on the Gregorian calendar by each engine's own Intl, each language's add-on script; and a value a person typed read in its own direction on a page right to left — a table's cell, a phone's card, a box — each engine's bidi its own; radios and tick boxes drawn as Fieldia's own over each engine's input, its pseudo-elements, forced colours and paper its own; and a phone's country found by typing, each engine's keys, focus and sheet their own; a designer's Delete and its toast's Undo, and a picked part's bar placed beside its part, each engine laying out the canvas its own way; and a page's waits — a skeleton, a spinner, a bar, a failure and its Retry — each engine's timers, reduced motion and forced colours its own; and each part the one-tag script loads checked against the hash it was built with, which each engine enforces its own way; and a send a part guards, refused when its part cannot come, a record's load and its one Retry, one key per send, drafts and kept sends a person's own and each request's deadline, each engine's timers, storage and IndexedDB their own; and a page's parts written into it, as script tags or preload links carrying each part's hash, each engine matching a preload its own way; and a failure that stays said, the next rows' and a record's opened, each engine's IntersectionObserver its own; and the business widgets, a page of the app's own site drawn in an embed field's frame in an opaque origin, its scripts fetched with CORS by each engine its own way. Chromium runs everything. `npx playwright test --project=firefox` (or webkit) runs one engine.
 */
const SMOKE = ['render', 'form-behaviour', 'behaviour', 'layout', 'lists', 'list-totals', 'lists-bulk', 'lists-import', 'list-cards', 'related-list', 'related-count-open', 'grid-empty', 'dialogs', 'quiet-look', 'map-place', 'contain', 'save-safety-focus', 'autofill', 'phone', 'slots', 'phone-frame', 'steady-press', 'pressed-error', 'phone-titles', 'rules-cell-hold-every-engine', 'rules-number-autofill-keeps-value', 'rules-hours-percent-entered-and-left-keep-value', 'rules-part-swap-keeps-typing', 'duplicates', 'print', 'calendar-zone', 'relations-part', 'phone-labels', 'focus-lists-closed', 'part-words', 'columns-drag', 'record-dialogs-ask', 'signature-evidence', 'list-filters', 'rich-tables', 'endings', 'lines-paste-dropdown', 'option-rules', 'app-functions', 'limits', 'chatter-channels', 'approvals', 'list-editable', 'two-languages', 'ai-help', 'photos', 'scan', 'wi-more', 'statusbar-phone', 'designer-phone', 'list-work', 'gantt', 'dates-hijri-month', 'masks-code', 'shorthand', 'option-looks', 'check-tree', 'survey-quiz', 'survey-review', 'survey-flow-one', 'survey-draw', 'survey-timed', 'media', 'codes', 'pins', 'prefill', 'verify', 'payment', 'embed', 'outbox', 'undo-filling', 'press-undo', 'repeat-field', 'opening-hours', 'csp', 'testing-kit', 'ssr', 'languages-unreviewed', 'typed-direction', 'ticks', 'phone-countries', 'designer-delete', 'designer-bar-place', 'popups-at-foot', 'loading', 'script-integrity', 'guards-fail-closed', 'load-boundary', 'send-discipline', 'kept-by-person', 'deadlines', 'parts-preload', 'load-failures', 'business'];
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
