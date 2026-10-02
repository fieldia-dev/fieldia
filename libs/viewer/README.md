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
(core, widgets and viewer; about 60 KB gzipped):

```html
<script src="https://cdn.jsdelivr.net/npm/@fieldia/viewer/bundle/fieldia.js"></script>
<script>
  Fieldia.mountViewer(document.getElementById('app'), {
    page,
    dataSource: Fieldia.createMemoryDataSource(),
  });
</script>
```

For React, Vue and Angular, use `@fieldia/react`, `@fieldia/vue` or
`@fieldia/angular` — thin shells over this viewer. MIT licensed.
