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
| `@fieldia/core` | Headless. The page format, modifiers, validation, record state, the data-source interface. **No DOM.** | in progress |
| `@fieldia/widgets` | The field inputs, in plain DOM, with two skins | planned |
| `@fieldia/viewer` | Framework-neutral mount — render a saved page and fill it in | planned |
| `@fieldia/board` | Page layout on a [Grafloria](https://grafloria.com) board, for canvas-style screens | planned |
| `@fieldia/designer` | Authoring: the survey editor and the canvas designer | planned |
| `@fieldia/angular` · `react` · `vue` | Thin bindings over the viewer | planned |

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
npx nx run-many -t typecheck lint test build
```

CI runs exactly that line — [`.github/workflows/ci.yml`](.github/workflows/ci.yml) is the gate list.

## License

MIT
