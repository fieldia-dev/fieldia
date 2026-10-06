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

## What a press or a moment does

A button — in the body, a record's header, a stat button or a list's actions —
runs `steps`, in order, each plain data and never code; and the page's `on`
runs them at its moments:

```json
{ "type": "button", "id": "new-customer", "label": "New customer", "steps": [
  { "do": "open", "page": "customer", "as": "panel", "values": { "name": "customer_name" },
    "into": { "customer_id": "id" }, "then": [{ "do": "say", "message": "Customer added", "tone": "success" }] }
] }

"on": {
  "change": { "product": [{ "do": "call", "action": "check_stock" }] },
  "beforeSave": [{ "do": "check" }, { "do": "ask", "message": "Send the order?" }],
  "afterSave": [{ "do": "say", "message": "Order sent", "tone": "success" }]
}
```

- `open` another page in a `dialog` (the default), a `panel` beside this form,
  or in its `page`; on a `record` (an expression giving its id) or a new one with
  `values`. Once it is saved or sent, `into` sets this form's fields from its
  answers (`id` is the record it saved) and `then` runs here.
- `set` a field from an expression, `clear` one, `addLine` to a table of lines.
- `check` the form or some fields, `save` (a page of responses sends), `reset`.
- `goTo` a tab or a wizard step, `say` something in a tone, `ask` Yes or No.
- `call` one of the app's own actions by name, with `params`; `close` the dialog
  or panel the form was opened in.

Any step may run only `when` a condition holds. A step that fails or is refused
stops the ones after it: a check that finds problems, No to a question, a save
that cannot be made, the app saying stop, a page closed without saving. The
moments are `open`, `change` (by field: a person's change, never a step's or a
rule's), `beforeSave` (a step that stops keeps it unsaved), `afterSave` and
`show` (by tab or wizard step id). A button may still name only an `action`,
handed to the app as before.

### Running steps

A press runs with `form.runAction(id)`: the button's `confirm` asked first,
then its `steps`, then its `action`, when it names one, as a final `call`.
The app runs its own with `form.run(steps, { id })`. Each run ends with a
`RunResult`:

```ts
const result = await form.run([{ do: 'check' }, { do: 'save' }]);
// { done: true }
// { done: false, stoppedAt: 0, step: { do: 'check' }, reason: 'check', message: 'Email is required' }
```

- `reason` is why it stopped: `check` (problems found, and shown), `no` (a
  question answered No), `save` (refused: the first problem, or the backend's
  words), `app` (the app said stop, or threw — `error` holds what), `closed`
  (a page opened and closed without saving), `cannot` (it cannot run here: no
  host to open with, a field the page lacks).
- `stoppedAt` is its place among the steps run — for a step of an `open`'s
  `then`, the open step's; for a button's `action`, one past its steps; none
  when the `confirm` was answered No — and `step` is the step itself.

What the core cannot draw it asks of a host, which the viewer gives:

```ts
const form = createForm({
  page,
  dataSource,
  host: {
    open: (request) => showPage(request), // { page, version?, as, title?, recordId, values? } → { saved, recordId?, values?, label? }
    say: (message, tone) => toast(message, tone),
    ask: (message) => askYesOrNo(message), // Promise<boolean>
    close: () => panel.close(), // the dialog or panel this form was opened in
    show: (tab) => tabs.pick(tab), // and the viewer calls form.shown(tab), as for a tab picked by hand
  },
});
```

Without a host, `say` says nothing, `ask` asks the form's `confirm` option — or
goes on as though answered Yes, so a form run from code is never held by a
question — and `open`, `close` and a `goTo` of a tab stop with `cannot`.

An `open` step reads `record` and `values` against this form; a field named
alone goes whole, a link with its name. Once the page is saved, `into` reads
the opened form's values, `id` being the record it saved; a link set to that
record is named by the host's `label` (its page's title field), else the
values' `display_name`, else their `name`, else the id.

### The app's actions

`onAction` gets each `call`: `{ id, action, params, recordId, values, recordIds }`.
`id` is the button's, or the moment's (`on.open`, `on.change.<field>`,
`on.beforeSave`, `on.afterSave`, `on.show.<id>`), or what `form.run` was
given (`run` when nothing); `recordIds` are the records chosen in a list, for
every call of that run. Fieldia waits for the answer, which may be an
`ActionResult`:

```ts
onAction: async ({ action, values }) => {
  if (action === 'price') return { values: { price: await priceOf(values.product_id) }, say: 'Priced' };
  if (action === 'reserve' && !(await inStock(values))) return { stop: 'Out of stock' };
  if (action === 'pick') return { open: { page: 'customer', as: 'panel', into: { customer_id: 'id' } } };
},
```

`values` are set as a `set` step sets them (a link may be given by its id);
`say` is said, as words or `{ message, tone }`; `open` runs as an `open` step;
`stop` stops the steps after it, and its words, if any, are said as a
warning. Nothing answered means go on: an `onAction` that returns nothing
works as it always did.

### The moments

- `open` runs once the form has its values: as soon as a new one is made, and
  after each `load()` of a record.
- `change` runs for a person's change only — `setValue(name, value)`, and a
  table's lines added, edited, moved or removed. `setValue(name, value, { by: 'app' })`,
  `setValues(values)`, steps, worked-out values, `setWhen` and the data
  source's onchange never run it, so steps never chase each other round.
- `beforeSave` runs before the save's own check, so it can fill in what is
  asked for. A stop keeps it unsaved: `save()` gives false; a check's
  problems show as the save's own would; any other stop leaves
  `status: 'error'` and `saveProblem: { kind: 'stopped', reason, message }`.
- `afterSave` runs once saved or sent.
- `show` runs as a wizard's step is entered — the first once `open` has run —
  and as the viewer calls `form.shown(tabId)` for a tab.

Each moment runs one at a time. Set off again while it runs, `open`, `change`
and `show` run once more after it, with the values as they are then, however
often they were set off meanwhile. `beforeSave` and `afterSave` do not run
again: a save made meanwhile — a step of their own, or the app saving inside a
call — goes ahead without them, so nothing waits on itself. A moment set off
by its own run, as a `show` whose `goTo` leads back, does not run.

### Events

```ts
const off = form.on('change', ({ field, value, values, by }) => {}); // by: 'person' | 'step' | 'app'
form.on('save', ({ recordId, values }) => {});
form.on('send', ({ values }) => {}); // a page of responses: the answers sent
form.on('action', ({ request, result }) => {}); // the app answered a call
form.on('run', ({ id, steps, result }) => {}); // a run ended
form.on('step', ({ step }) => {}); // a wizard's step entered
form.on('open', ({ recordId, values }) => {});
off();
```

`subscribe` still hears every change of the form's state; `settled()` now
waits for runs too, a question still unanswered among them.

To show a page, use [`@fieldia/viewer`](https://www.npmjs.com/package/@fieldia/viewer)
or a framework binding. MIT licensed.
