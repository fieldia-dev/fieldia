# @fieldia/viewer

Show a [Fieldia](https://fieldia.dev) page and let people fill it in. Plain DOM,
no framework: sections, tabs and wizards, the statusbar, stat buttons, drafts,
lists of records with a search bar, right-to-left layout, and messages in
English, Arabic, German and French.

```sh
npm install @fieldia/viewer
```

```ts
import { mountViewer } from '@fieldia/viewer';
import { createMemoryDataSource } from '@fieldia/core';
import page from './signup.page.json';

const viewer = mountViewer(document.getElementById('app')!, {
  page,
  dataSource: createMemoryDataSource(),   // or your own DataSource
  skin: 'outlined',                       // or 'underline', or 'quiet': values as words until wanted
  locale: 'en',                           // 'ar' lays the form out right to left
});
// later: viewer.destroy()
```

## A part that fails

A widget (yours, or one of Fieldia's given what it cannot draw), a slot's content,
a map or any other part that throws as it is drawn or brought up to date shows a
small box in its place — "This field could not be shown: Price", "This part could
not be shown" — and the rest of the form goes on working, saving included. The
console is told, and so is `onError`, with where:

```ts
mountViewer(host, {
  page,
  dataSource,
  onError(error, where) {
    // { stage: 'update', part: 'field', field: 'price', node: 'f-price', widget: 'monetary.tag' }
    // { stage: 'draw', part: 'slot', name: 'planner', node: 'n-planner' }
    report(error, where);
  },
});
```

A slot's renderer is given `fail(error)` too, for content that fails after it was
drawn: the slot then shows its box.

## A public form: autofill and a bot check

Every box tells the browser what it may fill it in with and a phone which
keyboard to show (the field node's `autocomplete` and `inputmode`, or its
kind's own). What the browser fills in is the person's own: read as typed, and
a box filled from a pick in another one is read at once, as one left, its
problem said there.

A page of responses with a `botCheck` gets a box no person sees, reaches with
Tab or hears read out — inert, so no browser fills it either — and each send
tells the app what was seen (`submit({ pageId, values, bot })`, and the `send`
event). The app's captcha goes in a slot of the page, named by
`botCheck.captcha`, and hands its token to the form:

```ts
mountViewer(host, {
  page,            // "botCheck": { "minSeconds": 3, "captcha": "captcha" }, a { "type": "slot", "name": "captcha" } placed
  dataSource,      // its submit gets bot: { honeypot, tooFast, seconds, captcha }
  slots: {
    captcha: (element, { form }) => {
      const id = turnstile.render(element, {
        sitekey,
        callback: (token) => form.botCheck({ captcha: token }),
        'expired-callback': () => form.botCheck({ captcha: null }),
      });
      // A token is spent once sent: a fresh one for the next response.
      const spent = form.on('send', () => turnstile.reset(id));
      return () => (spent(), turnstile.remove(id));
    },
  },
});
```

Nothing is refused on the page for what the check saw: the app decides.

## Saved forms placed in a page

A page may place another saved page in it by its id — an address made once,
placed twice (see `@fieldia/core`'s `form` part). The viewer draws it where it
stands, from the page `pages` gives for its id, its fields checked by its own
rules and its answers nested under the part's name in `form.getState().values`
and what is sent:

```ts
mountViewer(element, {
  page,                     // places { "type": "form", "page": "address", "name": "home_address", … }
  dataSource,
  // The app's pages: a record by key, or a function asked for each, which may answer with a promise.
  pages: async (request) => {
    if ('model' in request) return customerPage;                      // a link's record, in a dialog
    const reply = await fetch(`/api/forms/${request.id}?version=${request.version ?? 'latest'}`);
    return reply.ok ? reply.json() : null;                           // a saved form, by id and version
  },
});
```

`pages` is one option for every part that shows another page: a saved form is
asked for by `{ id, version }` (a record of pages is read by `id`, or
`id@version` for a version kept to), and a link's record in a dialog by
`{ model }` (the older `relatedPages`, by model only, is still read after it).
While a saved form comes, its place shows a quiet "Loading…"; one that cannot
be found, would be placed inside itself, or is not a page of sections or tabs
says so in its place, in the page's language. The React, Vue and Angular
bindings take `pages` too.

## Pages in dialogs and side panels

`openFormDialog` opens a page over the one shown — a new related record, a
line to edit — and `openFormPanel` opens one in a side panel: full height at
the inline-end edge (the left, right to left) unless its `side` names another,
the page behind dimmed but in sight, the whole screen on a phone. Both take
`mountViewer`'s options and hand back `{ saved, recordId, values }`:

```ts
import { openFormDialog, openFormPanel } from '@fieldia/viewer';

const task = await openFormDialog({ page: taskPage, dataSource, title: 'New task', size: 'medium' });

const call = await openFormPanel({
  page: callPage,
  dataSource,
  title: 'Log a call',
  width: 'medium',        // 'narrow' | 'medium' | 'wide': about 420, 560 or 720 pixels
  look: page.look,        // the opener's look, worn by the panel and the page in it
});
if (call.saved) console.log(call.recordId, call.values);

// From another edge: the whole width along the top, 40 in a hundred of the screen tall.
await openFormPanel({ page: callPage, dataSource, title: 'Log a call', side: 'top', height: 'short' });
```

A record opened over its list, as a work tracker opens a bug over its backlog:

```ts
await openFormDialog({
  page: bugPage, dataSource, recordId: 4127, title: 'Bug',
  size: 'inset',        // 96px in from the window's sides, 46px from its top and bottom; the whole window under 760px
  backdrop: 'clear',    // the list behind left as it is, not dimmed
  maximise: true,       // ⤢ beside ×: the whole window, and Restore
  resizable: true,      // a grip at the end-bottom corner, dragged or moved by the arrow keys
});
```

A page whose sheet has a `head` (a work item's: its kind's strip and badge,
the title line, Save and Close, Follow, the band of fields and the tabs) is
the dialog's own head and foot: the dialog draws neither, its ⤢ and × sit at
the end of the head's badge row, and Escape and × ask before changes go. A
head button whose steps save and then close resolves with `saved: true`.

`side` is where it comes from: `'end'` (the default: the end of the line, the
right, or the left right to left) or `'start'`, as the page reads; or
`'left'`, `'right'`, `'top'` or `'bottom'` of the screen, whatever the page's
direction. At the left or right `width` is how deep it is; at the top or
bottom it runs the whole width and `height` says how tall — `'short'`,
`'medium'` (the default) or `'tall'`, about 40, 60 or 85 in a hundred of the
screen. On a phone every side fills the screen: the top slides down from
above, the rest up from below.

`mode: 'values'` checks the form and hands its values back without saving
(the panel's button then says Done). Each keeps Tab inside it, gives the focus
back where it came from, and closes on Escape — a panel asks "Discard your
changes?" first when something was changed. A dialog opened from inside a
panel sits above it; a panel opened from a panel stacks over it, the older one
stepped back from its own edge. A panel slides in from its edge only when the
reader's system welcomes motion.

## What a page's steps ask of the screen

A page's buttons and moments run steps (see `@fieldia/core`'s “What a press or
a moment does”). The viewer is their host: it draws what they ask for.

- **A page opened** is found through `pages` by `{ id, version }` and opened in
  a dialog, a side panel (from the step's `side`), or this form's place with
  Back over it — with the same
  data source, pages, language, skin, look and `onAction`. Saved, its record
  comes back (named by its page's title field, else `name`) for the step's
  `into` and `then`; closed unsaved — Discard, ×, Escape, Back — the steps after
  it stop. Once a save in it went through, it comes back saved however it is
  closed. A page opened in place gives way back to the form once saved; Back
  returns to the form as it was. A page your `pages` has none of stops the
  steps with “The page “…” cannot be found.”, said as a toast. Each page opened
  has a host of its own, so its steps run there, and a `close` step closes it.
  Every way out of it — and of the record: the pager, the breadcrumbs (your
  own too, inside a page opened in place: they leave the record under it as
  well), a reload — goes through its form's one check (`form.leave()`). It
  first waits for a save on its way and files on theirs, saying what it waits
  for where “Saving…” would be (at a dialog's foot), then asks “Discard your
  changes?”, the focus on Cancel, only when the person's work is at risk: a
  change of theirs the last save did not send, a file on its way or not saved
  yet, changes set aside, a save refused for a conflict still waiting for
  Reload or Keep mine. A dialog's Discard waits for a save on its way too, and
  asks nothing; it stops a file on its way at once. A dialog of values — a
  line's own form — asks before Escape or × let a change in it go, as a panel
  does: nothing else saves what it holds. An answer that comes once the record
  it was asked for is gone — a name looked up, a record made from a link, a
  line's dialog closed, an onchange, a step's Archive, Duplicate or Delete —
  is laid on no other record (`form.recordShown()`).
- **The browser's own ways out** — Back, Reload, a tab closed — ask first
  ("Leave site?") while the person's work is at risk, every change not saved
  counting, with `warnOnLeave: true`. Off unless set, as in 0.20.
- **Words said** are toasts at the foot of the screen, in their tone: one over
  another, read out by a polite live region, going after a few seconds (not
  while pointed at or focused), or with their ×. Your app's `stop` words come
  as a warning; a step that cannot run here, or your `onAction` throwing, is
  said too.
- **A question** is the viewer's own box (Cancel, OK) or your `confirm`. A
  button's `confirm` is asked once, by the form. Escape answers No and leaves
  a dialog or panel under it open. Your own `host.ask` gets every question,
  and the one check's “Discard your changes?” comes with `{ discard: true }`
  (a panel's Escape and × among them): word its Yes as Discard and put the
  focus on Cancel, as the viewer's own box does.
- **A tab** a `goTo` names is shown, and `form.shown(tab)` runs its `show`
  steps — as for a tab a person picks.
- **A button** whose steps run is busy (`aria-busy`, a turning ring) and is not
  run twice; a `check` or `save` that stops it takes the focus to the first
  problem, as Save does.

Do any of it your own way; what you leave out stays the viewer's:

```ts
const viewer = mountViewer(element, {
  page,
  dataSource,
  pages,
  onAction: async ({ action, values }) => {
    if (action === 'check_stock') return { values: { price: await priceOf(values.product) }, say: 'In stock' };
  },
  host: { say: (message, tone) => myToasts.show(message, tone) },   // a Partial<ActionHost>
  onOpen: (request) => (request.as === 'page' ? router.open(request) : undefined), // undefined: the viewer opens it
});

viewer.on('change', ({ field, value, by }) => {});   // and save, send, action, run, step, open
viewer.setValues({ price: 380 });                    // the app's change: no change steps run for it
await viewer.run([{ do: 'check' }, { do: 'save' }]); // steps, as a button would run them
```

A form made elsewhere and handed in as `form` keeps the host it was made with
(`createForm({ host })`): the viewer gives its own only to a form it makes.

## Two people, one record

When a save is refused because someone else saved the record first (the data
source throws `ConflictError`, see `@fieldia/core`), the viewer says so over
the record — “Mona changed this record at 10:42”, what she changed and what
you both changed — with **Reload**, which shows her version and lists your
changes to put back, and **Keep mine**, which saves yours over hers. Nothing is
lost without a word. Where the source says the person may only read the record
(`can.edit: false`) there is no Edit, Save or Save & Close and a line over the
record says why; fields it locks show a lock with the reason, fields it hides
are gone, and the gear menu's Archive, Duplicate or Delete it does not allow
are hidden, its foot saying why — in English, Arabic, French or German. See
[versions and conflicts](https://fieldia.dev/data/#versions).

## Possible duplicates, and Merge

A record's page with `duplicates` (`{ "fields": ["name", "phone", "email"] }`)
and a data source with `duplicates` says the records like the one typed: a
moment after the person stops typing in one of those fields — and as a saved
record opens, and as it is saved — each match is said under the field it
matched on, "A record with this Phone already exists: Nile Traders", and said
once, politely, to a screen reader. Its ways: **Open it** (the record found, in
this one's place, once the person said Discard to what they typed), **It's
someone new** (let be for those values, remembered for the record in the
viewer's `preferences`), and, on a saved record where the source has `merge`,
**Merge…**: the two side by side, the record kept picked over its column and a
radio for each field they hold apart, what will happen said before Merge. Typing
on leaves an answer on its way unheard; an answer for a record no longer shown
is laid nowhere; Save is never kept waiting. It comes in a part of its own
(`duplicatesPart`, `fieldia.duplicates.js`), loaded only where a page and its
source both ask, never waited for. Its words are the viewer's labels
(`duplicateWith`, `openDuplicate`, `mergeTitle`, …). See
[possible duplicates](https://fieldia.dev/data/#duplicates).

## Lists

A page whose layout is a `list` shows its records as a table: pages, sorting,
a search bar with suggestions, filters, group by and favourites. Your data
source answers `list` and `groups`; a row opens through `onOpenRecord`, and the
page's buttons reach `onAction` with the chosen `recordIds`. See
[lists and search](https://fieldia.dev/lists/).

Other ways of showing a list's records come from `listViews`, by name: a
list's `map` (`mapListViews` from `@fieldia/map`), its `calendar`
(`calendarListViews` from `@fieldia/calendar`), or an app's own view. The list
offers each on its switcher when it has the page option of its name, or where
the view's own `offers(node)` says, in the view's words (`label(locale)`). A
view that makes a record (a calendar's empty slot) asks `onNewRecord(values)`;
without it the record's page from `pages` opens in a dialog with the values
filled in.

### Lists that add up, and filter by time

A column may total: `"cells": { "amount": { "total": "sum" } }` — `sum`,
`avg`, `min` and `max` of a number, `count` of any column. The list shows a
totals row under it, the sums on each Group By heading (`Cairo (12) · EGP
4.3M`) and, while rows are ticked, their totals, all asked of the data
source's optional `totals`: without it, none shows. An amount whose currency
each record keeps is totalled in one currency only: over several, no total
is shown rather than a wrong one.

A named filter may be a period a date falls in, counted from today —
`{ "id": "overdue", "label": "Overdue", "period": { "field": "due_date", "is": "overdue" } }`
— and a person's own filter offers "in the period" for a date: today,
yesterday, this week or last, this month or last, this year, the last 7 or
30 days, overdue. A week starts on the language's first day (Saturday in
Arabic, Monday elsewhere); days are the page's time zone's (`timeZone`), else
the browser's; the clock is the viewer's `now`. They reach the data source as
plain conditions. A date in `groupBy` groups by its year, quarter, month,
week or day, asked of `groups` with `interval`. See
[lists that add up](https://fieldia.dev/lists/#totals).

### Taking records away, changing many

A list takes its records away and changes them in bulk. With every row on
show ticked it offers **Select all 1,284 that match** (the source's `allIds`,
or its pages read through); its buttons then get every id. **Export**, in its
bar, writes the rows ticked — or, none ticked, every record the search finds —
as an Excel workbook or a CSV file, in the browser (no library: the workbook is
written in the list's part) or on your server (`exportRecords`), offered with
`"export": true`. With `"bulkEdit": true` (or the fields) **Edit** sets one field
to one value on the records chosen, after a question, by `writeMany` or a save
per record, each record's `can` kept, and names what it could not change and
why. See [taking records away, changing many](https://fieldia.dev/lists/#bulk).

## With no build step

This package carries a `<script>` bundle that sets the global `Fieldia`
(core, widgets and viewer; about 167 KB gzipped). What a page uses beyond
plain fields — a list's screen, a table of lines, a date's box, a phone, a
theme, possible duplicates… — comes in 16 parts beside it (`fieldia.list.js`, `fieldia.date.js`, …),
each loaded from the same folder the first time a page uses it:

```html
<script src="https://cdn.jsdelivr.net/npm/@fieldia/viewer/bundle/fieldia.js"></script>
<script>
  Fieldia.mountViewer(document.getElementById('app'), {
    page,
    dataSource: Fieldia.createMemoryDataSource(),
  });
</script>
```

Its own words are English. For Arabic, German or French, add that language's
script after it (about 8–10 KB gzipped each), then pass `locale`:

```html
<script src="https://cdn.jsdelivr.net/npm/@fieldia/viewer/bundle/fieldia.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@fieldia/viewer/bundle/fieldia.ar.js"></script>
<!-- or fieldia.de.js, fieldia.fr.js; one per language the page is shown in -->
<script>
  Fieldia.mountViewer(element, { page, dataSource, locale: 'ar' });
</script>
```

Load both from the same version. A page set to a language whose script is
missing shows Fieldia's words in English, and the console names the script to
add. Installed from npm, `@fieldia/viewer` (and `@fieldia/core`,
`@fieldia/widgets` and the React, Vue and Angular bindings) has all four
languages with no extra import; `addLanguage(locale, { messages, widgets,
viewer })` replaces a language's words in either.

For React, Vue and Angular, use `@fieldia/react`, `@fieldia/vue` or
`@fieldia/angular` — thin shells over this viewer. MIT licensed.
