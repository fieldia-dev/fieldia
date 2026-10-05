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

## Lists

A page whose layout is a `list` shows its records as a table: pages, sorting,
a search bar with suggestions, filters, group by and favourites. Your data
source answers `list` and `groups`; a row opens through `onOpenRecord`, and the
page's buttons reach `onAction` with the chosen `recordIds`. See
[lists and search](https://fieldia.dev/lists/).

## With no build step

This package carries a `<script>` bundle that sets the global `Fieldia`
(core, widgets and viewer; about 81 KB gzipped):

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
