# What Fieldia promises

What an app, a page author and a server can count on from Fieldia: what it guarantees in the browser and what the
app's server must still do, how it changes from one version to the next, how fast it is, and the browsers it runs in.

Each promise names its **gate**: a test in the repository that runs on every pull request, or in the CI job named
beside it, and fails the build when the promise stops being true. Where a promise has no gate, it says so.
`tools/promises.test.mjs` holds this page to its gates: every file it names exists, every test it quotes is in that
file, and every number it gives is the one the code and its budgets hold.

## Security: what Fieldia guarantees in the browser

A page is data. Fieldia draws it and never runs code from a page, a record's value or what a person types.

- **No code made from text, under a strict Content-Security-Policy.** No `eval`, no `new Function`, no style
  attribute and no `<style>` without the page's nonce, in any package; the page check runs with zod's JIT off. Forms,
  records, lists, surveys, every field, the designer and the one-tag script draw and work under a policy of
  `script-src 'nonce-…'`, `style-src 'nonce-…'` and `connect-src 'self'`, nothing refused. **Gates:**
  `tools/csp-source.test.mjs` ("no Fieldia source makes code from text"), `libs/core/src/lib/format/jitless.spec.ts`,
  `e2e/csp.spec.ts` ("under a strict Content-Security-Policy, nothing refused") in Chromium, Firefox and WebKit.
- **No request of its own.** Fieldia asks only the data source the app gives it, and the files the app serves. It
  sends nothing to fieldia.dev or anywhere else, and counts nothing about its use. A map fetches its tiles, places
  and routes from the map provider the app chooses. **Gate:** `e2e/csp.spec.ts`, whose policy (`tools/csp-policy.mjs`)
  says `connect-src 'self'`: a request to any other site is refused, and the spec fails on any refusal.
- **Every address goes through `safeUrl`.** A link, a picture, a film, a download or a page opened from a page's
  setting or a record's value is a web, mail or phone address, or a path of this site. A `javascript:` address, a
  page written as `data:`, and a scheme hidden behind tabs, line breaks, control characters, case or character
  references are refused. A picture may be `data:` only where a picture goes, and a `blob:` only this page's own.
  **Gates:** `libs/core/src/lib/safe-url.spec.ts` ("fuzzed: no control character"), `tools/csp-source.test.mjs`
  ("every address an element or the browser is given goes through safeUrl").
- **Rich text runs nothing.** A formatted text, a pasted table and Markdown are sanitized: no script, event handler,
  style attribute or link to script stays in them. Raw HTML in Markdown shows as written. **Gates:**
  `libs/widgets/src/lib/sanitize-tables.spec.ts` ("runs nothing"), `libs/widgets/src/lib/markdown.spec.ts` ("escapes
  raw HTML"), `libs/widgets/src/lib/strict-csp.spec.ts` ("never hand the browser a style attribute"),
  `e2e/rich-tables.spec.ts`.
- **A file is shown only as what its bytes are.** A file field shows a file in place only in a format Fieldia shows:
  a PDF, a picture, a film or a sound. Its bytes are checked against that format first, and it is shown from a blob
  typed by Fieldia, never by the type the file claims. An SVG is drawn only as a picture, from data. An uploader's
  HTML named `.pdf` is never framed: its words are shown as words. **Gate:** `libs/widgets/src/lib/file-shown.spec.ts`
  ("never shows an uploader’s HTML named .pdf"). These tests run in jsdom; no browser test covers previews yet.
- **A spreadsheet never runs what a person typed.** Every CSV file Fieldia writes — a list's export, a designer's
  translations — keeps a cell a spreadsheet would run as a formula as words, a `'` before it: one that starts with
  `=`, `+`, `-`, `@`, a tab or a line break, or their full-width forms. An imported file reads such a cell back as it
  was written. **Gates:** `libs/core/src/lib/csv.spec.ts`,
  `libs/viewer/src/lib/list-export.spec.ts`, `libs/designer/src/lib/translations-csv.spec.ts`,
  `libs/viewer/src/lib/import-file.spec.ts` ("kept as words").
- **A framed form talks only to the sites it names.** `<fieldia-form>` in another site's page tells only the origins
  its `allowed-origins` names what happens, and never posts the answers to the page that frames it. An embed field
  frames a page of the app's own site with no origin of its own, so its scripts cannot reach the form. **Gates:**
  `e2e/embed.spec.ts` ("a framed form tells only the sites its allowed-origins names"),
  `libs/viewer/src/lib/element.spec.ts`, `libs/widgets/src/lib/embed.spec.ts` ("runs a page of this site’s own with
  no origin").
- **A part that is not the one released never runs.** The one-tag script checks each part it loads against the hash
  it was built with, so the browser refuses a file changed after the release. A send that a part must check — a
  payment, a signature, an approval — is never made without that part: the page says so, keeps what was typed and
  offers Retry. **Gates:** `e2e/script-integrity.spec.ts` ("a part changed after it was built never runs"),
  `e2e/guards-fail-closed.spec.ts` ("a part whose bytes are not those it was built with is refused by the browser"),
  `libs/core/src/lib/record/guards-lazy.spec.ts`, `tools/script-tags.test.mjs` ("each file's hash is the sha256 of
  its bytes").
- **What is kept on the device is the person's own.** A draft is kept per person, and a tab's own when no one is
  signed in. A password box's value and a secret field's value are never kept in a draft. A send kept while there is
  no signal goes only under the person who made it. The kept send is the whole send, secrets included, in the
  browser's IndexedDB until it goes. **Gates:** `libs/core/src/lib/record/kept-by-person.spec.ts` ("a password box’s
  and a secret field’s values are never kept"), `e2e/kept-by-person.spec.ts`.
- **A request that never answers ends.** A record's load, a list's rows and groups, a save, a send, an onchange, a
  search and a list's options end at their deadline (30 s unless the app says) as the network's problem, with Retry.
  A request the app makes itself outside these calls has the deadline the app gives it. **Gate:**
  `libs/core/src/lib/record/deadline.spec.ts` ("ends at its deadline as the network’s problem").
- **A page the checks refuse is never drawn.** Every viewer runs `checkPage`, which refuses what `validatePage`
  refuses. The form's place says why, and React, Vue and Angular apps stay up. **Gates:**
  `libs/core/src/lib/format/shape-parity.spec.ts` ("one verdict on each"), `libs/viewer/src/lib/refused.spec.ts`
  ("says why where the form would be").

### Bounded work

What a page or a person can make Fieldia do has limits:

| What | The most | Gate |
| --- | --- | --- |
| A page's pattern | Nested, overlapping and ambiguous repeats are refused by both page checks. No pattern is tried on an answer longer than 1,000 characters: that answer fails at once. | `libs/core/src/lib/format/pattern-risk.spec.ts` ("tries no pattern on an answer longer than it checks") |
| Text read as a date | 100 characters | `libs/widgets/src/lib/long-text.spec.ts` ("reads no date from text longer than a date is written") |
| A value a page works out | 100,000 characters of text, 10,000 items of a list | `libs/core/src/lib/record/computed-most.spec.ts` |
| An imported file | 50,000 rows, 32,767 characters a cell | `libs/viewer/src/lib/import-file.spec.ts` ("keeps at most so many rows") |
| A workbook's archive, opened | 100 MB a file in it, 200 MB in all | `libs/viewer/src/lib/unzip.spec.ts` ("refuses a file saying it opens to more than the most") |
| Answers `checkSubmission` reads | 1 MB, unless the server says | `libs/core/src/lib/record/submission.spec.ts` ("refuses answers larger than they may be") |

Not bounded: the time a page's own conditions and computed values take. They run as the page writes them. Check a
page from an author you do not trust with `validatePage` before you store it (see [For AI agents](agents.md)). No
gate: this one is the app's.

## Security: what the app's server must still do

The browser's checks help the person filling in the form. They are not a security boundary: anyone can send a request
by hand, and it passes none of them.

- **Check the answers again where they arrive**, with `checkSubmission(page, values, context)` from `@fieldia/core`.
  It runs the browser's checks once more: required fields, patterns, lengths, options, a field the page does not
  have. It checks that a code asked for was proved, with the proof your app gave. It works out what the page asks to
  be paid for these answers and checks the payment covers it, in its currency. And it refuses answers over 1 MB.
  **Gates:** `libs/core/src/lib/record/submission.spec.ts` ("refuses what a request made by hand skips", "works out
  what is due itself").
- **Decide who may see and change what.** A field hidden, read-only or limited by a role, a `can` or a condition is
  hidden or locked in the browser, never protected. Your server decides what each person reads and writes. No gate:
  this one is the app's.
- **Check what only the server can.** A code's proof is your app's own: check its signature. Check a payment's
  reference with your provider. A survey's time limit and its answers per person are the server's to hold. No gate:
  these are the app's.
- **Store only pages that pass.** Run `validatePage` (or `npx fieldia-check`) before you store a page an author or an
  AI agent wrote, and `stampPage` to stamp it. **Gate:** `libs/testing/src/lib/check-pages.spec.ts` ("refuses a
  broken page").

How to report a vulnerability, and the versions that get fixes: [SECURITY.md](../SECURITY.md).

## Stability: how Fieldia changes

Fieldia releases on a train ([docs/maintainers/release-train.md](maintainers/release-train.md)).

- **A patch holds fixes alone.** Nothing an app, a page or a test writes needs to change, so `^0.36.0` takes it
  safely. **Gate:** `tools/release-guards.test.mjs` ("a patch whose section has an Upgrading part is refused").
- **A minor comes every 2–4 weeks**, each change listed under its Upgrading part by who it touches: page authors, app
  code, tests and CSS, self-hosters. From 0.37 no minor comes sooner than 14 days after the one before. **Gate:**
  `tools/release-train.test.mjs` ("none sooner than 14 days after the minor before").
- **A minor's warning comes first.** A setting, an option, a member, a default or a DOM contract that is to change is
  deprecated in one minor and changed in a later one. Where its use can be seen, the console says so once in a page,
  with the minor it changes in. From 0.37 the release check refuses a minor with a change that does not say it was
  deprecated a minor before, only adds, or is a fix. **Gates:** `libs/core/src/lib/deprecations.spec.ts` ("says a
  deprecated use once in a page"), `tools/release-train.test.mjs` ("a change not deprecated a minor before is
  refused").
- **What tests should use.** `@fieldia/testing` finds what a person finds, by roles and labels, and is kept working
  across minors. A `.fd-*` class, a `data-*` attribute or an element's place among its part's changes only after a
  deprecation. **Gates:** `libs/testing/src/lib/dom.spec.ts`, `e2e/testing-kit.spec.ts` in Chromium, Firefox and
  WebKit.

### Deprecations

What is deprecated now, and the minor it changes in. The console's warning links here.

| Id | Since | Changes in | Who | What changes, and what to write instead |
| --- | --- | --- | --- | --- |
| `format.under-stamped` | 0.36 | 0.37 | page authors | A page that says an older format than a setting it uses came in is warned of by `checkPage` and `validatePage`, and refused from 0.37. Stamp the page with `stampPage(page)`, or write the format the warning names. |

**Gate:** `tools/promises.test.mjs` ("every deprecation is in the table") holds this table to the list in
`libs/core/src/lib/deprecations.ts`.

### The page format

- **Formats only add.** A setting is never renamed, reshaped or removed in place. A change that must do so makes a
  new format, with a step that rewrites an older page. **Gates:** `tools/format-shape.mjs`, run by every release
  check, and `libs/core/src/lib/format/upgrade.spec.ts`.
- **A page is stamped with the lowest format it needs**, so every Fieldia that knows its settings reads it: a page
  that uses nothing new reads in 0.30's viewer, and a page with a `secret` field says 0.13. The designer publishes so,
  and `stampPage` stamps so. **Gates:** `libs/core/src/lib/format/stamp.spec.ts` ("is read by the 0.30 viewer"),
  `tools/format-since.test.mjs` ("is read by that format's own schema").
- **A page is read by its stamp.** Where a default changed, a page of an older format keeps the old one, or the
  change is listed with the setting that keeps the old way (the format's docs, "Versions"). **Gate:**
  `libs/core/src/lib/format/default-changes.spec.ts`.

## Performance

0.35.0, measured, on a desktop and on a mid-range phone (412 px wide, its CPU four times slower):

- A key typed on the 500-field example page is worked out in 3.9–6.9 ms on a desktop and 17–36 ms on the phone. It
  brings 16 of its parts up to date, not all 533.
- A list of 5,000 rows keeps some 1,600 DOM nodes in the page, not 130,343. A tick, a Tab or a fold costs what it
  did at 100 rows.
- A table of 200 lines draws again only the lines a change touches. A Gantt of 500 tasks moves a bar in place.

Each release is held to budgets that fail the build. The timings run alone in CI's perf job, one worker, with three
times the budget's slack for a shared runner; the phone's budgets are four times a desktop's. The counts are counted
by the browser, so a slow runner changes none of them.

| What | Desktop | Phone | Gate |
| --- | --- | --- | --- |
| A key typed in a field a rule reads, 500 fields | 16 ms | 64 ms | `e2e/perf.spec.ts` ("type in a field a rule reads") |
| A choice that shows or hides 10 fields | 100 ms | 400 ms | `e2e/perf.spec.ts` ("choose: 10 fields show or hide") |
| A viewer's first paint, 500 fields | 400 ms | 1,600 ms | `e2e/perf.spec.ts` |
| A key's work, 500 fields: parts brought up to date | 17 | 17 | `e2e/perf-scale.spec.ts` ("a key works out only what reads it") |
| A list of 5,000 rows: DOM nodes kept | 1,700 | 2,000 | `e2e/perf-scale.spec.ts` ("the DOM a list keeps") |
| A key in the header of a 200-line table: cells written | 0 | 0 | `e2e/perf-scale.spec.ts` ("a key in the header writes no line") |
| A bar dropped, 500 tasks: elements added | 33 | 33 | `e2e/perf-scale.spec.ts` ("a bar dropped and a change of scale") |

An app's first load from the npm packages, bundled by esbuild, KB gzipped — the page's first paint, then usable:

| App | First paint | Usable | Gate |
| --- | --- | --- | --- |
| A record form | 259.4 KB | 333.7 KB | `tools/npm-first-load.mjs` |
| A list | 258.6 KB | 328.4 KB | `tools/npm-first-load.mjs` |
| The screen designer | 611.7 KB | 827.0 KB | `tools/npm-first-load.mjs` |

The one-tag script, `fieldia.js`, is held to 206.7 KB gzipped, and each part it loads later to its own budget.
**Gate:** `tools/script-bundle.mjs`.

These are budgets, not measurements. A count's budget is what the release counted, with a little room; a timing's is
a frame for a key and a tenth of a second for a click. Each run's measurements are kept with CI's perf job.

## Browsers

Fieldia supports the last two major versions of Chrome and Edge, Firefox and Safari; Safari on iOS (every browser on
an iPhone runs Safari's engine); and Chrome on Android. The npm packages are ES2022, and the one-tag script ES2020.

| Browser | Checked in CI | Not checked in CI |
| --- | --- | --- |
| Chrome, Edge | Chromium 141, Playwright's build: every browser spec, in every framework's demo, and the perf gates | Chrome's and Edge's own builds; the major before |
| Firefox | Firefox 142, Playwright's build: the smoke set (103 specs) in the plain demo | The rest of the specs; the major before |
| Safari | WebKit 26.0, Safari's engine as Playwright builds it: the smoke set (103 specs) in the plain demo | Safari itself; the major before |
| Safari on iOS | WebKit at a phone's size with touch, in the smoke set's phone specs | A real iPhone |
| Chrome on Android | Chromium at a phone's size with touch; the perf gates on a phone's CPU | A real Android phone |

A person checks a real iPhone and a real Android phone by hand at each minor, before it is released: the screens
that matter, from the real-device checklist in the maintainers' docs. No gate: a person runs it.

**Gate:** `tools/promises.test.mjs` ("the browsers CI runs are the ones this page names") holds this table to
`playwright.config.ts`, `.github/workflows/ci.yml` and the browsers Playwright installs.
