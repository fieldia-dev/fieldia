# @fieldia/widgets

The field inputs of [Fieldia](https://fieldia.dev), in plain DOM: text, numbers,
choices, ratings and scales, dates, many2one search pickers, tags, tables of
lines, file and image uploads (as a list, thumbnails, or cards with each name
under its picture), formatted text and JSON. Three skins, chosen per
form with `data-fd-skin`:

- `underline` — labels beside values, quiet underlined inputs (a business sheet)
- `outlined` — labels above boxed inputs (Ant Design style)
- `quiet` — the outlined page, each value plain words until pointed at or
  entered (Azure DevOps style); a field the viewer marks `data-quiet` wears it
  in any skin, and `wearsQuiet(field, node)` says which widgets do

```sh
npm install @fieldia/widgets
```

Most apps never import this package directly: [`@fieldia/viewer`](https://www.npmjs.com/package/@fieldia/viewer)
lays a page out with these widgets. Import it to write your own widget — a
`WidgetFactory` returns `{ element, update(state), focus() }` — and register it
with the viewer's `widgets` option under `type` or `type.widget`.

A widget that throws — as it is drawn, brought up to date, focused or taken away —
never takes the page with it: `createWidget` puts a small box in its place ("This
field could not be shown: Price", in the page's language, said to a screen reader
as a status), tells the context's `onError` (the console when there is none), and
leaves the widget alone from then on. A widget that learns of its own failure
later — a framework's component caught by its binding — calls `context.fail(error)`.

Where the data source has `upload`, a file or picture field stores each file as
it is picked and shows it on its way: its picture, a bar that fills, where it
is in words, × to cancel it, Retry when it failed — in a list, on cards and on
thumbnails, right to left and dark. Photos are made smaller first by the field's
`shrink` (`{ maxSide, quality }`, or `false`), their EXIF turn kept;
`shrinkPhoto(file, { maxSide, quality })` does the same for your own code.

MIT licensed.
