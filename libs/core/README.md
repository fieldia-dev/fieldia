# @fieldia/core

The headless half of [Fieldia](https://fieldia.dev): the page format, modifiers
(`invisible`, `readonly`, `required`), validation, and a form's record state. It
never touches the DOM, so it runs the same in a browser, in Node, and on a server
that generates pages.

```sh
npm install @fieldia/core
```

```ts
import { validatePage, createForm, createMemoryDataSource } from '@fieldia/core';

const checked = validatePage(json);            // { ok, page } or { ok: false, issues }
if (!checked.ok) throw new Error(checked.issues.map((i) => `${i.path}: ${i.message}`).join('\n'));

const form = createForm({ page: checked.page, dataSource: createMemoryDataSource() });
form.setValue('email', 'sara@example.com');
form.subscribe((state) => console.log(state.values, state.errors));
```

Fieldia knows no backend. Records load and save through a `DataSource` — `load`,
`save`, `onchange`, `search`, `create`, `submit`, and `list` and `groups` for a
list of records — that your app implements;
`createMemoryDataSource` implements all of it in memory, for tests and demos.

The page format is also a JSON Schema, for editors and other languages:
`@fieldia/core/page.schema.json`.

A page's `look` sets its accent, font, spacing, corners, labels and light or
dark scheme, and, under `parts`, a look for each kind of part over it — the
settings each kind has are `PART_LOOKS`:

```json
"look": {
  "accent": "#1f7a4d",
  "parts": {
    "inputs":  { "background": "#fff7e6", "border": "#c4320a", "corners": "round", "textSize": "large", "accent": "#c4320a" },
    "choices": { "accent": "#1f7a4d", "background": "#f0f7ff", "border": "#1677ff", "corners": "soft", "textSize": "small" },
    "groups":  { "background": "#fbfaf7", "border": "#d6cfc2", "corners": "round" },
    "buttons": { "accent": "#6941c6", "corners": "round", "textSize": "large" },
    "tables":  { "background": "#eef2f7", "border": "#9aa3ad", "textSize": "small" }
  }
}
```

To show a page, use [`@fieldia/viewer`](https://www.npmjs.com/package/@fieldia/viewer)
or a framework binding. MIT licensed.
