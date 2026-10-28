# Fieldia

**Fieldia is a form engine and form builder for JavaScript: one JSON page format, rendered in Angular, React, Vue or plain JavaScript, from a simple survey to a full ERP screen.**

> **Docs and live demos: [fieldia.dev](https://fieldia.dev).** Fieldia is on npm: `npm install @fieldia/viewer` (or `@fieldia/react`, `@fieldia/vue`, `@fieldia/angular`).

## The idea

A page — a form, a survey, a record screen with tabs and a status bar — is a
JSON document. It contains data only, never code, so it can be stored,
generated, versioned and edited.

Pages come from three places:

- **Generated** by your app — for example from an ERP's own view definitions.
- **Built** in a designer — a question-by-question editor for surveys, a canvas for app screens.
- **Written** by an AI agent — [the guide for agents](docs/agents.md) says what a page is, how to check one
  before it is stored, and the mistakes the checks catch.

Either way, the same viewer renders it. Fieldia knows no backend: records load
and save through a small data-source interface that your app implements.

## Packages

| Package | Role | Status |
|---|---|---|
| `@fieldia/core` | Headless. The page format, modifiers, validation, record state, the data-source interface. **No DOM.** | on npm |
| `@fieldia/widgets` | The field inputs, in plain DOM, with three skins (`underline`, `outlined`, `quiet`) | on npm |
| `@fieldia/viewer` | Framework-neutral mount — render a saved page and fill it in | on npm |
| `@fieldia/designer` | Authoring: an editing model with undo and versions, the survey editor, and the screen editor — the page drawn as the viewer draws it, edited where it stands | on npm |
| `@fieldia/angular` · `react` · `vue` | Thin bindings over the viewer | on npm |
| `@fieldia/testing` | Your app's forms tested as people use them — fill, pick, check, press, `errorsOf`, `valueOf` — for Testing Library and Playwright, and `fieldia-check`, which keeps stored pages valid in CI | on npm from 0.31 |

Building an app with npm's `engine-strict` on needs Node 24 or later: `@zxing/library`, the code reader behind `@fieldia/widgets`' scanner, asks for `node >= 24` (its 0.22 and 0.23 both do). That is the install's only need of Node; the packages themselves run in the browser, in every browser Fieldia supports.

### The screen editor

The screen is drawn the way the viewer draws it, and edited where it stands:
pick a field and type its label and help in place, switch how it is shown from
the bar on it, drag it to another place or section, and drag new ones in from
a toolbox of icons. Given the backend's model, the toolbox lists the model's
fields first, and a field from the model keeps what it holds — it only changes
editor, among those that suit its data:

```ts
import { blankPage, createDesigner, mountScreenEditor } from '@fieldia/designer';

const designer = createDesigner({
  page: blankPage('sheet', 'Customer'),
  model: { email: { type: 'char', label: 'Email' }, credit_limit: { type: 'monetary', label: 'Credit limit', currency: 'EGP' } },
});
mountScreenEditor(document.getElementById('app')!, { designer });
```

## How fast, measured

Measured on each release on a desktop and on a mid-range phone profile (412 px,
CPU four times slower), Chromium, medians; CI's perf job holds the counts —
parts brought up to date, rows and elements in the page, cells written, bytes —
against budgets that fail the build.

- **Typing keeps up at 500 fields on a desktop.** A key works out only what
  reads the field typed in: on a page of 500 fields it brings 16 of its parts up
  to date and reads no condition again, and costs 3.9–6.9 ms on a desktop, under
  the 16 ms of a frame. *Not yet on a mid-range phone on the biggest page*: 17–21
  ms on a 500-field form, up to 36 ms on the 500-field example page, most of it
  the browser's paint.
- **Lists stay flat to 5,000 rows.** Past 100 rows a list keeps only the rows
  near the view in the page: 5,000 rows hold about 1,600 DOM nodes (over
  100,000 in 0.34), and a tick, a Tab, a reload or a fold costs about the same at
  5,000 rows as at 100. A table of 200 lines draws again only the lines a change
  touches.
- **Small from npm.** An app's first load from the packages, bundled by esbuild:
  a record form 248.0 KB gzipped with the page and 339 KB to usable, a list
  247.2 and 335, the screen designer 596 and 826 (`tools/npm-first-load.mjs`,
  a CI budget). The one-tag `fieldia.js` is 198.0 KB gzipped; its larger parts
  come as a page first uses them, and the whole check of a page (17.2 KB) once
  the page is parsed, never waited for.

## Four rules

**1. `core` never touches the DOM.** Its tsconfig omits the `DOM` lib, so a
stray `document` fails to compile rather than fails review — and a spec fails if
anyone widens that.

**2. Fieldia knows no backend.** Pages arrive as JSON, and records load and save
through an interface the app implements. An ERP, a REST API or a survey store is
an adapter that lives in the app, not in Fieldia.

**3. Render once, bind thinly.** Fields render in plain DOM, once. Each framework
binding is a shell around the viewer; behaviour added to a binding belongs in the
viewer, where every framework gets it. A host app can still register its own
field written in its own framework.

**4. A page is data.** No functions, no framework components, no live clients
inside a page. Icons are names, buttons reference actions, and the code a page
needs is handed to the renderer.

## Stability

A patch holds fixes alone; a minor comes every two to four weeks, and anything
an app, a page or a test relies on that is to change is deprecated a minor
first — said once in the console where it is used, and in the changelog. A page
says the format it is written in — the lowest its settings need, so an older
Fieldia that knows every setting it uses reads it — and every later Fieldia
reads it. How it works, and the check that holds each rule:
[the release train](docs/maintainers/release-train.md).

What Fieldia guarantees in the browser and what your server must still check,
the budgets that hold its speed, and the browsers it supports — each promise
with the test that holds it: [What Fieldia promises](docs/promises.md).

## Develop

```sh
npm ci
npx nx run-many -t typecheck lint test build   # unit gates
node tools/release.mjs check                    # the packs, installed into an empty project
npx playwright install chromium
npx nx run-many -t build -p angular viewer && node tools/build-demos.mjs && node tools/build-site.mjs && npx playwright test   # browser gates: every framework demo, and fieldia.dev
```

CI runs exactly these lines — [`.github/workflows/ci.yml`](.github/workflows/ci.yml) is the gate list.
The demos live in [`demos/`](demos); `node tools/serve.mjs dist/demos 4321` serves them after a build.

## License

MIT
