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

Every box says what the browser may fill it in with and which keyboard a phone
shows for it: the field node's `autocomplete` (a purpose from the HTML
standard's list, such as `given-name`, `work email` or `shipping postal-code`,
or `off`) and `inputmode` (`numeric`, `decimal`, `tel`, `email`, `url`,
`search`, `text`) over its kind's own — an email box `email`, a phone `tel`, a
web address `url`, a password `new-password`, a whole number's digits, an
address's parts each its own after whose it is (`"autocomplete": "shipping"`):

```json
{ "type": "field", "id": "f-code", "field": "code", "autocomplete": "one-time-code" }
```

`boxPurpose(node, own)` gives the same attributes to a widget of your own. A
value the browser fills in is the person's own, read as typed: cleaned as a
paste is, never put back where nobody may be looking, read at once in a box the
person is not in, and saved as any change of theirs.

A phone field (`"widget": "phone"`) is read the world over where its page says
`"phone": { "country": "EG", "shown": "national" }` — or the field itself, with
`"options": { "country": "AE" }` or `"shown"`. Its country is picked before the
number (its flag and dialling code, every country by its name in the page's
language) or typed with it: "010 1234 5678" is read in the country picked,
"+20 10 1234 5678" or "0020…" in Egypt whatever was picked. The number is
checked by its country — how long it is by how it starts, and whether any number
there starts so — kept as E.164 (`"+201012345678"`), and shown at rest abroad's
way (`"+20 10 1234 5678"`, the default) or at home's (`"010 1234 5678"`), a call
and a WhatsApp link beside it. A letter is refused and said why; a number that
does not read stays as typed with why ("too short for a +20 number (Egypt)"),
and the save refuses it. No country is ever assumed: without one, a number is
written with its +. A page that says neither keeps its phone fields as text
boxes. The country table (`phoneCountries`, `readPhone`, `writePhone`,
`shownPhone`) comes in the phone part with the widget,
`(await phonePart.load()).readPhone('010 1234 5678', 'EG')`.

MIT licensed.
