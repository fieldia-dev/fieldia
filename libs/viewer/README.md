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
  skin: 'outlined',                       // or 'underline'
  locale: 'en',                           // 'ar' lays the form out right to left
});
// later: viewer.destroy()
```

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
  it stop. A page opened in place gives way back to the form once saved; Back
  returns to the form as it was. A page your `pages` has none of stops the
  steps with “The page “…” cannot be found.”, said as a toast. Each page opened
  has a host of its own, so its steps run there, and a `close` step closes it
  unsaved.
- **Words said** are toasts at the foot of the screen, in their tone: one over
  another, read out by a polite live region, going after a few seconds (not
  while pointed at or focused), or with their ×. Your app's `stop` words come
  as a warning; a step that cannot run here, or your `onAction` throwing, is
  said too.
- **A question** is the viewer's own box (Cancel, OK) or your `confirm`. A
  button's `confirm` is asked once, by the form. Escape answers No and leaves
  a dialog or panel under it open.
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

## Lists

A page whose layout is a `list` shows its records as a table: pages, sorting,
a search bar with suggestions, filters, group by and favourites. Your data
source answers `list` and `groups`; a row opens through `onOpenRecord`, and the
page's buttons reach `onAction` with the chosen `recordIds`. See
[lists and search](https://fieldia.dev/lists/).

## With no build step

This package carries a `<script>` bundle that sets the global `Fieldia`
(core, widgets and viewer; about 90 KB gzipped):

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
script after it (about 3–4 KB gzipped each), then pass `locale`:

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
