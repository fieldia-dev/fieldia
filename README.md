# Fieldia

**Fieldia is a form engine and form builder for JavaScript: one JSON page format, rendered in Angular, React, Vue or plain JavaScript, from a simple survey to a full ERP screen.**

> **Docs and live demos: [fieldia.dev](https://fieldia.dev).** Fieldia is on npm: `npm install @fieldia/viewer` (or `@fieldia/react`, `@fieldia/vue`, `@fieldia/angular`).

## The idea

A page — a form, a survey, a record screen with tabs and a status bar — is a
JSON document. It contains data only, never code, so it can be stored,
generated, versioned and edited.

Pages come from two places:

- **Generated** by your app — for example from an ERP's own view definitions.
- **Built** in a designer — a question-by-question editor for surveys, a canvas for app screens.

Either way, the same viewer renders it. Fieldia knows no backend: records load
and save through a small data-source interface that your app implements.

## Packages

| Package | Role | Status |
|---|---|---|
| `@fieldia/core` | Headless. The page format, modifiers, validation, record state, the data-source interface. **No DOM.** | on npm |
| `@fieldia/widgets` | The field inputs, in plain DOM, with two skins (`underline`, `outlined`) | on npm |
| `@fieldia/viewer` | Framework-neutral mount — render a saved page and fill it in | on npm |
| `@fieldia/designer` | Authoring: an editing model with undo and versions, the survey editor, and the screen editor — the page drawn as the viewer draws it, edited where it stands | on npm |
| `@fieldia/angular` · `react` · `vue` | Thin bindings over the viewer | on npm |

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
