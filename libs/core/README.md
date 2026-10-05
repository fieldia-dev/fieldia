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

## A saved form placed in another

A block made once — an address, a contact person, a consent — is a page of its
own, placed in any other by its id with a `form` part:

```json
{ "type": "form", "id": "home", "page": "address", "name": "home_address", "title": "Home address" }
{ "type": "form", "id": "billing", "page": "address", "version": 2, "name": "billing_address" }
```

- `page` is the saved page's id; `version` keeps to one published version, and
  left out means the latest.
- `name` is where its answers go: the values hold them under it as an object,
  `{ "home_address": { "street": "12 Nile Street", "city": "Cairo" } }`, so two
  copies of one form never mix. It must not be a field of the page, nor another
  copy's name.
- `title` is the words over it: the saved page's own title when left out, none
  when empty. `colspan`, `invisible` and `readonly` work as on a section.

Only a page of `sections` or `tabs` can be placed; a page cannot be placed in
itself. The page's own conditions cannot read inside a saved form's answers.

A form is given the saved page once the app has found it —
`form.embed(partId, page)`, as the viewer does — and returns the inner form.
From then the saved page's own required fields, answer rules, conditions and
worked-out values hold inside it: the outer form refuses to save or send while
one fails (the error under `home_address.street`, shown on the inner form beside
its field), sends only the copies on show, tells `home_address` as changed when
anything inside changes, and loads, puts back and saves the nested answers. A
data source sees each copy's answers as one JSON value under its name.

To show a page, use [`@fieldia/viewer`](https://www.npmjs.com/package/@fieldia/viewer)
or a framework binding. MIT licensed.
