# Fieldia

**Fieldia is a form engine and form builder for JavaScript: one JSON page format, rendered in Angular, React, Vue or plain JavaScript, from a simple survey to a full ERP screen.**

> Early days. The page format is being designed; nothing is published to npm yet.

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
| `@fieldia/core` | Headless. The page format, modifiers, validation, record state, the data-source interface. **No DOM.** | built, not on npm yet |
| `@fieldia/widgets` | The field inputs, in plain DOM, with two skins (`underline`, `outlined`) | built, not on npm yet |
| `@fieldia/viewer` | Framework-neutral mount — render a saved page and fill it in | built, not on npm yet |
| `@fieldia/designer` | Authoring: an editing model with undo and versions, the survey editor, and the screen editor — a canvas on [Grafloria](https://grafloria.com) boards | built, not on npm yet |
| `@fieldia/angular` · `react` · `vue` | Thin bindings over the viewer | built, not on npm yet |

### The screen editor

Each section of a screen is a Grafloria board; drag a card to reorder, pull
its edge to widen it. Grafloria is passed in rather than bundled, so a
survey-only app never loads it and the app picks the version:

```ts
import * as grafloria from '@grafloria/element';
import { blankPage, createDesigner, mountScreenEditor } from '@fieldia/designer';

const designer = createDesigner({ page: blankPage('screen', 'Site visit') });
mountScreenEditor(document.getElementById('app')!, { designer, grafloria });
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
npx nx run-many -t build -p angular viewer && node tools/build-demos.mjs && npx playwright test   # browser gates, every framework demo
```

CI runs exactly these lines — [`.github/workflows/ci.yml`](.github/workflows/ci.yml) is the gate list.
The demos live in [`demos/`](demos); `node tools/serve.mjs dist/demos 4321` serves them after a build.

## License

MIT
