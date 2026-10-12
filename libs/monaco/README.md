# @fieldia/monaco

[Fieldia](https://fieldia.dev) text, one-line and JSON fields in VS Code's
editor, [Monaco](https://microsoft.github.io/monaco-editor/): find and
replace, folding, several cursors, moving lines, VS Code's keys — coloured in
the language a page names, and wearing the form's theme.

```sh
npm install @fieldia/monaco
```

```ts
import { mountViewer } from '@fieldia/viewer';
import { monacoWidgets } from '@fieldia/monaco';

mountViewer(host, { page, dataSource, widgets: monacoWidgets });
```

A node opts in with `"widget": "monaco"`:

```json
{ "type": "field", "field": "script", "widget": "monaco", "options": { "language": "python" } }
```

- `text.monaco`: a `text` field, in the language `options.language` names —
  every name `@fieldia/code` takes (`python`, `sql`, `typescript`, `bash`…)
  and Monaco's other grammars besides (GraphQL, SCSS, Elixir, F#, HCL…):
  `MONACO_LANGUAGES` lists them. One Monaco has no grammar for is plain text.
- `char.monaco`: a `char` field, one line of code in the language
  `options.language` names, such as a condition:
  `order.total > 100 && !order.paid`. See [One line](#one-line).
- `json.monaco`: a `json` field, edited as JSON. Valid JSON reaches the form
  as it is typed; text that is not valid is said so, and the last good value
  stays.

Monaco is large (about 3 MB, 800 KB gzipped, with its editing features), so
it loads only when a page has such a field, and each language's grammar only
when a field uses it. Until it has loaded the field is a plain text box that
works as one — and stays one if Monaco cannot be loaded.

## Your bundler

The widgets import `monaco-editor`'s ES modules, which import their own CSS.
Vite takes them as they are; webpack needs `style-loader` and `css-loader`
for `.css` (and `asset/resource` for `.ttf`); esbuild writes the CSS beside
your bundle, for your page to link, and needs `loader: { '.ttf': 'file' }`.
Build with code splitting (ES modules) so Monaco is a file of its own.

## Language services (workers)

With nothing more, code is coloured and no worker is started. For JSON
checked as it is typed, and suggestions and checks for TypeScript,
JavaScript, CSS and HTML, give the widgets workers as Monaco asks for them:

```ts
import { createMonacoWidgets } from '@fieldia/monaco';
// Vite: each worker is a module of monaco-editor's own.
import EditorWorker from 'monaco-editor/editor/editor.worker?worker';
import JsonWorker from 'monaco-editor/languages/features/json/json.worker?worker';
import TsWorker from 'monaco-editor/languages/features/typescript/ts.worker?worker';

const widgets = createMonacoWidgets({
  getWorker: (_id, label) => {
    if (label === 'json') return new JsonWorker();
    if (label === 'typescript' || label === 'javascript') return new TsWorker();
    return new EditorWorker();
  },
  // The services these workers are for; CSS's and HTML's fields ask for none.
  services: ['json', 'typescript'],
});
```

(`css.worker` and `html.worker` sit beside `json.worker`, under
`languages/features/css` and `languages/features/html`.) The function becomes
`MonacoEnvironment.getWorker`, unless your app has set a `MonacoEnvironment`
of its own, which is kept.

Each field turns on the service of its language, for every service Monaco
has. When you give workers for some of them only, name those, so the others'
fields ask for none: `createMonacoWidgets({ getWorker, services: ['json'] })`
(`json`, `typescript` — JavaScript's too —, `css` — SCSS's and Less's too —
and `html`).

## One line

A `char` field's editor is one line, as `@fieldia/code`'s is:

- As tall as a text box, in a frame drawn as the form's text boxes are, in
  either skin and in the dark: no line numbers, no minimap, no folding. A
  long line scrolls sideways with the caret.
- Enter adds no line, with Shift, Alt or Ctrl either. Ctrl+Enter (Cmd+Enter
  on a Mac) saves, as from any field; with the viewer's
  `keys: { enterMovesToNext: true }`, Enter moves on to the next field, as
  from a text box. Otherwise Enter does nothing.
- Pasted lines become one line, as a text box joins them; a paste of line
  breaks alone adds nothing. A line break that gets in another way — a line
  copied down, a suggestion of several lines — is joined at once, and Undo
  takes the join back with it. A value set from elsewhere is shown whole.
- Ctrl+F opens the browser's find, as in a text box: VS Code's find has no
  room in one line.
- The node's `placeholder` shows while it is empty. Its input says it is one
  line (`aria-multiline="false"`).

## Every editor

- Tab moves to the next field, as in every field; Ctrl+] and Ctrl+[ indent.
- Read-only when the field is; required, invalid and its messages said on
  the editor's input, which the field's label names and points at.
- Text and JSON grow with their text, from a few lines to a screenful; the
  page scrolls past them under the mouse wheel.
- Its theme is made from Fieldia's tokens as the page has them (theme,
  scheme, accent), and made again when they change. Code is coloured as in
  `@fieldia/code`, light or dark with the page, readable on every theme's
  surface; set your own with the `--fd-code-*` tokens. Monaco has one theme
  per page: two forms in different looks share the last one drawn.
- Code reads left to right, on an Arabic page too.

MIT. Monaco is MIT too.
