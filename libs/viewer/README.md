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
the inline-end edge (the left, right to left), the page behind dimmed but in
sight, the whole screen on a phone. Both take `mountViewer`'s options and hand
back `{ saved, recordId, values }`:

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
```

`mode: 'values'` checks the form and hands its values back without saving
(the panel's button then says Done). Each keeps Tab inside it, gives the focus
back where it came from, and closes on Escape — a panel asks "Discard your
changes?" first when something was changed. A dialog opened from inside a
panel sits above it; a panel opened from a panel stacks over it, the older one
stepped back. A panel slides in only when the reader's system welcomes motion.

## Lists

A page whose layout is a `list` shows its records as a table: pages, sorting,
a search bar with suggestions, filters, group by and favourites. Your data
source answers `list` and `groups`; a row opens through `onOpenRecord`, and the
page's buttons reach `onAction` with the chosen `recordIds`. See
[lists and search](https://fieldia.dev/lists/).

## With no build step

This package carries a `<script>` bundle that sets the global `Fieldia`
(core, widgets and viewer; about 83 KB gzipped):

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
