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

A date and time is shown and typed on its time zone's clock — its own
`timeZone`, or its page's — with the zone's short name beside its box where
the browser's zone is another ("CEST"), and after it in words ("15 Oct 2026,
14:30 CEST"), which a paste reads back. A time the clocks skip on a change
day is said, never moved ("there is no 02:30 on 29 Mar 2026 in Central European
Time: the clocks go from 02:00 to 03:00"); one they repeat asks which, read
once its zone's name is typed after it ("02:30 CEST" or "02:30 CET").

`"widget": "slots"` on a date and time books a time from those free: a month
whose days are shaded by how they are booked (free times left, fully booked,
closed, a holiday by its name), beside the chosen day's free times as chips,
asked of the data source's `slots` — a month at a time, again when a field in
`options.dependsOn` changes, and once more for the day of a time picked, so a
time someone else booked meanwhile is said and never booked. The arrows move
across the days, the day's times following, and among the times; Enter books
one. `options.endField` takes the booking's end. It comes in a part of its own,
`fieldia.slots.js` (`slotsPart`), with the date part; without `slots` in the
data source it is the date and time box.

MIT licensed.
