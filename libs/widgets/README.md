# @fieldia/widgets

The field inputs of [Fieldia](https://fieldia.dev), in plain DOM: text, numbers,
choices, ratings and scales, dates, many2one search pickers, tags, tables of
lines, file and image uploads (as a list, thumbnails, or cards with each name
under its picture), formatted text and JSON. Two skins, chosen per
form with `data-fd-skin`:

- `underline` — labels beside values, quiet underlined inputs (a business sheet)
- `outlined` — labels above boxed inputs (Ant Design style)

```sh
npm install @fieldia/widgets
```

Most apps never import this package directly: [`@fieldia/viewer`](https://www.npmjs.com/package/@fieldia/viewer)
lays a page out with these widgets. Import it to write your own widget — a
`WidgetFactory` returns `{ element, update(state), focus() }` — and register it
with the viewer's `widgets` option under `type` or `type.widget`.

MIT licensed.
