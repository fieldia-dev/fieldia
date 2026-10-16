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

A page says which format it is written in (`"fieldia": "0.2"`, `FORMAT_VERSION`; a page in 0.1 is read as it is).
One in an older format is brought up to date as it is read — by `checkPage`,
`validatePage` and `createForm`, so by the viewer and the designer too — and
`upgradePage` does it for the pages your app keeps. One newer than this Fieldia
is refused with words that say so ("this page is in format 0.2, newer than this
Fieldia reads (0.1): update Fieldia to show it"):

```ts
import { upgradePage } from '@fieldia/core';

const page = upgradePage(stored);   // the same object when it is already current; a copy brought up step by step if not
if (page !== stored) await save(page);
```

A release that renames or reshapes a setting adds a step to `PAGE_UPGRADES`,
with a page before and after it that the tests run. What each release changed is
in the [changelog](https://github.com/fieldia-dev/fieldia/blob/main/CHANGELOG.md).

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

## Files stored as they are picked

Give the data source `upload(file, request)` and a file or picture field sends
each file to your store as soon as it is picked; the record keeps only the link
it returns — `{ url, name, size, type, fileId }`. `form.upload(field, files)`
does it for a widget of your own: `state.uploads` shows each on its way (its
`status` and the bytes `sent` of `total`), three at a time, in the order picked,
and `form.uploading(field)` gives one field's own;
`form.cancelUpload(id)` and `form.retryUpload(id)` stop one and send a failed
one again. A file picked in a table's cell goes as its line's (`request.line`). `form.save()` waits for those still going, stops under the field for
one that failed, and stores bytes still in the record (a signature drawn) first.
A saved form placed in a record keeps to the same: its files are stored for the
record (`model` and `recordId` are the record's, `field` is where it sits:
`consent.deed`), and the record's save waits for them. A file picked while a save
is on its way stays a change, to save next. A draft never keeps a file's bytes
where the source has `upload`; without it, a draft keeps them, as before.

```ts
import { uploadTo } from '@fieldia/core';

// A POST of a form with the file under `file`; its link from the answer's JSON `url`.
const dataSource = { ...yourDataSource, upload: uploadTo({ url: '/api/files', headers: { 'X-CSRF-Token': token } }) };
// Or a PUT to an address your server signs (Azure Blob's SAS): the link kept without the signature.
const toAzure = uploadTo({ method: 'PUT', url: (file) => signedAddress(file.name), headers: { 'x-ms-blob-type': 'BlockBlob' } });
```

To refuse a file, throw `saveRefused({ kind: 'rule', message })`: the field shows
your words and offers no Retry; any other error offers Retry. Stop with an
`AbortError` when `request.signal` aborts. `createMemoryDataSource({ storage:
{ bytesPerSecond, fails } })` is a store as slow, or as unreliable, as a real
one. Without `upload`, files travel inside the record as base64, as before.
See [files stored as they are picked](https://fieldia.dev/data/#upload).

## Time zones and booking slots

A page may name the time zone its dates and times are in, by its IANA name —
a branch's, a clinic's — and a date and time field may name its own:

```json
{ "timeZone": "Europe/Berlin", "fields": { "flight": { "type": "datetime", "label": "Departs", "timeZone": "Africa/Cairo" } } }
```

A date and time is still kept as an instant, as before (`2026-10-15T12:30:00.000Z`;
one written with its offset is read the same). It is shown and typed on the
zone's clock wherever the person is, with the zone's short name beside it where
the browser's zone is another ("14:30 CEST"). Today is the zone's day: a date's
default `"today"`, its earliest and latest counted from today, `today()`, a
rule's past and future, and `form.today()`. A time the clocks skip, or repeat, on
a change day is said, never moved. `zonedPage(page)` writes the page's zone into
each date and time field that names none, as the form and the viewer read it;
`wallTime`, `instantsAt`, `dayIn` and `clocksSkip` are the clock arithmetic
they use. `checkPage` and `validatePage` refuse a zone the browser does not know.
Without `timeZone`, the browser's own zone, as before.

A date and time drawn as booking slots (`"widget": "slots"`) asks the data
source's `slots(request)` for its free times: the days asked (`from`, `to`, in
`timeZone`), the schedule its node names (`options.schedule`), the booking's
`length` and the minutes `between` two as the page says, the record and its
values. It answers each day's state — `open`, `full`, `closed`, `holiday` with a
`note` — and the times free, as instants, and may say the booking's `length`.
`form.findSlots(field, { from, to })` asks it for a widget of your own;
`form.canFindSlots()` says whether the source can. Without `slots`, the field is
the plain date and time box. For demos and tests, `scheduleSlots(schedules)`
answers from booking schedules — hours by the day of the week on a zone's clock,
a booking's length, the minutes kept free after one, holidays, and the records
the bookings are:

```ts
import { createMemoryDataSource, scheduleSlots } from '@fieldia/core';

const weekday: [string, string][] = [['09:00', '13:00'], ['14:00', '18:00']];
const dataSource = createMemoryDataSource({
  records,
  slots: scheduleSlots({
    showroom: {
      timeZone: 'Europe/Berlin',
      hours: { 1: weekday, 2: weekday, 3: weekday, 4: weekday, 5: weekday, 6: [['10:00', '14:00']] },
      length: 45,
      between: 15,
      holidays: { '2026-12-25': 'Christmas Day' },
      bookings: { model: 'drive.booking', field: 'start', endField: 'stop', same: ['car'] },
    },
  }),
});
```

## Two people, one record

A source that keeps versions returns each record with its version, and what this
person may do with it, through `loadedRecord`. The form sends the version back
with each save; a source that finds the record changed since throws a
`ConflictError` naming who changed it and when:

```ts
import { ConflictError, loadedRecord } from '@fieldia/core';

async load({ model, id }) {
  const row = await api.read(model, id);
  return loadedRecord(row.values, {
    version: { token: row.etag, by: row.changedBy, at: row.changedAt },
    can: { edit: row.isMine, delete: false, readonlyFields: ['commission'], reason: 'Only Mona can change it.' },
  });
},
async save({ model, id, changes, version }) {
  const response = await api.write(model, id, changes.values, { ifMatch: version?.token });
  if (response.status === 409) throw new ConflictError({ version: response.body.version, theirs: response.body.values });
  return { id, version: response.body.version };
},
```

The form keeps it in its state — `version`, `can`, and after a refused save
`conflict` (who, when, the fields they changed and those both changed) — and
offers the two ways on: `form.reloadTheirs()` loads the record as they left it
and sets this person's changes aside in `setAside`, each put back with
`form.putBack(field)`; `form.keepMine()` saves them over the record as it is
now, their values kept wherever this person changed nothing (read again first
when the conflict did not carry the record, so `values` never wipes theirs; when
it cannot be read, nothing is saved and `conflict.unread` says so). A second save
while one is on its way waits for it and carries the version it got back.
Every way a form's values go — `openRecord` (the pager, an action's answer
naming a record, Duplicate's copy), a reload (the step, an answer's
`reload: true`, `form.load()` again), a `reset` step, the host's `close` (yours
too: the form takes it once, where it is made) — goes through one check,
`form.leave()`. It first waits for a save on its way and files on theirs
(`state.leaving` meanwhile, so the page can say so; a second way out joins that
wait), then looks at the record as it is now. A save's answer lands only on the
record it was started for: one shown in its place meanwhile never gets its
values. It asks only about the person's work at risk (`workAtRisk(state)`):
each change of theirs the last finished save of the record did not send —
typed while it was on its way, while the run that saved went on, or since
(`state.unsent`, told against the record as that save left it; a value set by
a step, a rule, a compute or your app is never theirs) — a file the store holds
that no save sent, files still on their way, and changes Reload set aside. Then
it asks "Discard your changes?" through the host's `ask(message, { discard:
true })`, or `confirm`; Cancel keeps the person where they are, and with
neither to ask with the work is kept. Before a record's first save, every way
out behaves as it did in 0.20: a change not saved goes where a step leaves the
record. `form.leaveNow()` says whether a way out can go at once. Call
`form.leave()` before your app's own ways out — a route change, an unmount —
and `unsavedWork(state)` (any change, file or change set aside) for a browser's
`beforeunload`. What `can` does
not allow is kept to before any source is asked: fields locked or hidden (and
left out of what a save sends), a save refused with the source's `reason`, the
gear menu's Archive, Duplicate and Delete and the buttons whose steps would do
them hidden. `createMemoryDataSource({ versions: { by: 'Sara' }, can })` does
it all in memory, and `changeElsewhere` changes a record as someone else would.

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
  `values`. A panel comes from its `side`: `end` (the default: the end of the
  line, the right or, right to left, the left) or `start`, as the page reads;
  or `left`, `right`, `top` or `bottom`, whatever its direction — a side on a
  dialog or a page in its place is refused. Once it is saved or sent, `into`
  sets this form's fields from its answers (`id` is the record it saved) and
  `then` runs here.
- `set` a field from an expression, `clear` one, `addLine` to a table of lines.
- `check` the form or some fields, `save` (a page of responses sends), `reset`.
- `goTo` a tab or a wizard step, `say` something in a tone, `ask` Yes or No.
- `call` one of the app's own actions by name, with `params`; `close` the dialog
  or panel the form was opened in.
- `openUrl` a web address an expression gives, in a new tab unless `newTab` is
  false; `reload` the record from the data source after the app changed it —
  an app's answer may ask for that with `reload: true`. An `open` of a list
  page may give a `filter` — `valueFrom` reading this form — so it shows only
  the records related to this one.

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
    open: (request) => showPage(request), // { page, version?, as, side?, title?, recordId, values? } → { saved, recordId?, values?, label? }
    say: (message, tone) => toast(message, tone),
    ask: (message) => askYesOrNo(message), // Promise<boolean>
    close: () => panel.close(), // the dialog or panel this form was opened in
    show: (tab) => tabs.pick(tab), // and the viewer calls form.shown(tab), as for a tab picked by hand
  },
});
```

Without a host, `say` says nothing, `ask` asks the form's `confirm` option — or
goes on as though answered Yes, so a form run from code is never held by a
question — and `open`, `close` and a `goTo` of a tab stop with `cannot`. The one
exception is "Discard your changes?" (`form.leave()`, with the person's work at
risk): without a host or `confirm`, the work is kept and the way out does not
happen.

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
