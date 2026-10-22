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

What a page uses only now and then comes in parts, each loaded the first time a
page shows it (`datePart`, `linesPart`, `choicePart`, …): the viewer waits for a
page's parts before it draws it (`loadParts` in `@fieldia/viewer`). A widget
drawn before its part came is drawn plainly, keeps its value and what is typed
in it, and the part's own takes its place. A link to other records —
`many2oneWidget`, `tagsWidget`, `linkCheckboxesWidget`, `referenceWidget`,
`charTagsWidget` — comes in `relationsPart` (`fieldia.relations.js` beside the
script bundle): meanwhile a many2one is a plain box whose words are handed to
the part's box as typed, or, left first, looked up by their exact name as the
part's box would; a many2many's tags are their names beside a box to add one.
`floatUnder(box, list)` floats a list under its box over everything else, as
the links' and the choices' lists float, for a widget of your own.

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
link beside it, and a WhatsApp link where it may be a mobile — by how its
country's mobiles start (`canBeMobile`): Cairo's 02 2537 4100 is called, its
010… also chatted with; where a country's mobiles cannot be told from its fixed
lines (+1's), any number may be one. A letter is refused and said why; a number
that does not read stays as typed with why ("too short for a +20 number
(Egypt)", or, letters typed, "letters are not allowed in a phone number"), and
the save refuses it. No country is ever assumed: without one, a number is
written with its +. A page that says neither keeps its phone fields as text
boxes. The country table (`phoneCountries`, `readPhone`, `writePhone`,
`shownPhone`) comes in the phone part with the widget,
`(await phonePart.load()).readPhone('010 1234 5678', 'EG')`.

A date and time is shown and typed on its time zone's clock — its own
`timeZone`, or its page's — with the zone's short name beside its box where
the browser's zone is another ("CEST"), and after it in words ("15 Oct 2026,
14:30 CEST"), which a paste reads back. A time the clocks skip on a change
day is said, never moved ("there is no 02:30 on 29 Mar 2026 in Central European
Time: the clocks go from 02:00 to 03:00"); one they repeat asks which, naming
both offsets ("write 02:30 +02:00 or 02:30 +01:00"), and is read once either
offset, or the zone's short name ("02:30 CEST"), is typed after it. A
table's cell, a list's, and a value read-only write a date and time as its box
does: the instant it is, on the browser's clock where nothing names a zone —
never the clock it was written with (`12:30Z` is 15:30 to a person in Cairo).

`"widget": "slots"` on a date and time books a time from those free: a month
whose days are shaded by how they are booked (free times left, fully booked,
closed, a holiday by its name), beside the chosen day's free times as chips,
asked of the data source's `slots` — a month at a time, again when a field in
`options.dependsOn` changes or a page of responses sends one (the next booking
is never offered the time the last one took), and once more for the day of a
time picked, so a time someone else booked meanwhile is said and never booked.
The arrows move
across the days, the day's times following, and among the times; Enter books
one. `options.endField` takes the booking's end. It comes in a part of its own,
`fieldia.slots.js` (`slotsPart`), with the date part; without `slots` in the
data source it is the date and time box.

A line, a paragraph or formatted text kept in several languages (its field's
`translate`) is a switch over its box, one press for each language named in itself
— *English*, *العربية* — the reader's first (the widget's `locale`), and under it that
language's box: the field's own, its rules as typed, written its own way (Arabic
right to left whatever the page's direction). A language not typed yet is marked on
its press, one a required answer still needs more so, and said to a screen reader;
the arrows move along the switch (mirrored right to left), Home and End to its ends;
a problem takes the focus to its language. Where it is read — a list's cell, a card —
`languageWords` draws it in the reader's language, else another's with that
language's code beside it ("AR", said as "in Arabic"), and `displayValue` writes it
in the reader's. It comes in the languages part (`languagesPart`,
`fieldia.languages.js`), with @fieldia/core's form code for it; drawn before it
came, its first text is read until it comes. Nothing is translated by a machine.

What is pasted into a formatted text (`html`) from Word, Excel, Google Docs or
Google Sheets — or copied from any page — comes in plain, in the field's own
look, in either editor: its headings, bold, italic, underlined and struck
words, links, lists (Word's too, which it writes as paragraphs, nested by
their level) and alignment kept; its fonts, sizes, colours, highlights,
classes, widths and Office's own markup left behind. What is copied or cut
from a Fieldia editor is marked as its own (`data-fieldia-copy`), so pasted
back there or in another formatted text it keeps what the editor's tools wrote
— a word's colour, highlight and size — and nothing more. Words alone (no HTML)
are the browser's to paste, as before. The cleaner is the text part's: the classic
editor asks for it as something is pasted, and puts the paste in as soon as it
comes. A formatted text keeps tables: their cells, a cell spanning several
(`colspan`, `rowspan`), a header row and a cell's alignment (an amount at its
end). Everything is cleaned as every value is: no script, no event, no style
but alignment ever reaches the page. The work item's editor
gets a table tool where a field names `table` among its `tools`:

```json
{ "type": "field", "id": "f-fees", "field": "fees", "options": { "tools": ["bold", "italic", "bulletList", "link", "table"] } }
```

Pressed, it puts in a table at a size picked on a grid of 8 by 8 (by the arrow
keys or the pointer, "3 rows by 4 columns"), its header row on and the cursor
in its first cell; with the cursor in a table, it offers Insert row above or
below, Insert column left or right (as the table is drawn: mirrored right to
left), Delete row, Delete column, Header row and Delete table — each one step
the browser's Undo takes back. In a table, Tab goes to the next cell, its words
selected, Shift+Tab back, Tab past the last cell adds a row, and Escape leaves
the table; said once as the cursor first comes into one. In Markdown a table is
GitHub's (`| a | b |` over `| --- | ---: |`), both ways; switching asks first
where a table cannot be written so. On paper a table is whole on a sheet where
it fits, else broken between its rows with its header row again — a header row
pasted among its rows, as Word, Excel and Google Docs copy one, or stored so by
an app, is shown and kept in the table's head, so it repeats too.

Rows copied from a spreadsheet and pasted in a cell of a table of lines — a
dropdown's too, where no browser sends a paste: Ctrl or ⌘ and V on it is caught by
a box of the table's own, out of sight — (or on
a cell of @fieldia/grid, chosen or open for typing) go each on its own line from
that cell, across the columns shown, each cell read as its column reads what is
typed (the page's marks and digits in any script, an amount in its line's
currency, a day in the page's order, a choice by its label, a link by its exact
name through the source's search, as its box reads a name typed), lines added for
the rows past the last as the table's `max` allows. A row whose name reads as no
record — nothing, or more than one, called so — is not pasted at all, never half
laid on a line of another record; what a cell could not take is named with why
under the table. The readers — `blockOf`, `readPastedCell`, `whyNotPasted`, and
`pasteRows`, which the table and the grid paste a block with — come in the lines
part (`(await linesPart.load()).readPastedCell(…)`), which the grid and a list's
Import read cells with too.

A signature whose node says `options.signs` (`"form"`, or the fields by name)
signs those answers: once drawn, typed or uploaded — what is typed in the
answers read first, an answer still to give said instead, the drawing kept on
the pad, the words following the answers until none is left to put right and
**Sign now** signs that drawing — it keeps who signed
(`options.signerField`'s name, the name typed, else the form's `user`), when
(the form's clock) and the SHA-256 of the answers with who and when beside its
picture (`FileValue.signed`). Under it, "Signed by Mona Adel, 19 Oct 2026,
11:42", whether the answers are still as signed — the fingerprint made again
from them — and Change answers, asked in place, which takes it away; the form
locks the answers while it is kept. All of that, and the canonical form
(`fieldia-signature/1`, @fieldia/core's README) with its functions —
`signatureText`, `signedAnswers`, `canonicalJson`, `sha256Hex` (the browser's
SubtleCrypto, else worked out the same where a page is served without https),
`signAnswers`, `answersMatch` — come in a part of their own,
`evidencePart` (`fieldia.evidence.js`), loaded only for a signature that signs
answers: a page with uploads or a plain signature never asks for it. Until it
comes, the files part's pad draws and keeps the picture, and its signing waits
for it — a save waits for that signing: `(await evidencePart.load()).answersMatch(…)`.

A picture field of several photos drawn as `"widget": "photos"` is a **photo
set**: its photos as tiles, in the order a person puts them — dragged with the
mouse, a finger resting on one a moment first on a phone (a swipe still
scrolls), or moved with Alt and an arrow key (Home and End to either end, the
arrows mirrored right to left), each move said aloud, Escape putting a drag
back. The first is the cover, marked so and what a list's card and a map's pin
show (`options.cover: false` marks none: a clinic's before and after); each
other has **Make cover**. Each photo has **Crop and turn**: a dialog drawing it
on a canvas, the part kept dragged, sized by a corner or moved by the arrow keys
(Shift and an arrow to size it), kept to `options.aspect` ("4:3") or a shape
the person picks where it names none, turned a quarter at a time. Applied, the
picture made takes the photo's place — stored at once where the data source
stores files (the form's `upload` with `replaces`, its bar on the tile) — and
the photo as it was is kept beside it (`FileValue.original`, with what was done,
`FileValue.edit`), so a crop again starts from it and **Put back the original**
brings it back; `options.keepOriginal: false` keeps none. `options.captions:
true` puts a caption's box under each photo (`FileValue.caption`), read as the
box is left, the photo named by it everywhere — its tools, its dialog's title;
one with no caption is named by its place, "photo 2 of 5", never by its file's
name. Left by Escape, × or a press outside it with a change made, the crop
dialog asks "Discard your changes?" first, in place, as a record's dialog asks;
Cancel lets the change go unasked. Photos are added as a picture field adds them, made smaller first, up to the
field's `maxFiles`, each on its way a tile with its bar.

```json
{ "type": "field", "id": "f-photos", "field": "photos", "widget": "photos", "options": { "captions": true, "aspect": "4:3", "camera": true } }
```

It comes in `photosPart` (`fieldia.photos.js`) with the files part, whose
taking of photos, files on their way and dialog it draws with; a plain picture
field never asks for it. The crop's geometry is there for an app's own:
`(await photosPart.load()).drawEdited(document, picture, { turn: 90, crop })`.

Not done yet, for 0.29: a photo set inside a table line's cell is untested;
pictures a second crop or Put back the original replaced stay in your store
(the form never deletes a stored file: they are your store's to clean); a photo
stored on another site is cropped only where that store lets the page read it
(CORS) — else the dialog says it cannot be read, with nothing to apply. AI help
never proposes a photo set's photos, as it never proposes a file.

A line's choice from the app's lists (`optionsFrom` on a line's selection, its
`dependsOn` naming a column of the line or `parent.` and a field of the record)
draws each line's own choices: the cell's form (`lineForm`) gives the line's
`choices` and asks its own by its cell's path (`form.loadChoices("tools.k1.tool")`).
A tool its new connection does not offer — or an option its condition hides as
the line changes (`options[].invisible`, read on the line and `parent.`) — is
taken out by the form and said under the cell (`state.takenOut`, by the cell's
path; the cell's form, `lineForm`, gives its line's by column, and `form.line`
the line it is of). `lineColumn(form, field, key, column, def)` gives a
column as its cell reads at rest — its choices those loaded for that line — for a
grid's cells, a printout, cards. A block pasted reads such a cell among its own
line's choices (`PasteTable.choices`, `form.lineChoices`), its links first.

A field whose node says `options.scan` is scanned into with the camera: a char's
or a text's box, a link's (a many2one), a table's column (`cells.<column>.options.scan`)
or a table of lines that counts what is scanned. A **Scan** button at the end of
its box — a line's cell's, its icon alone — opens the camera in a sheet over the
page, the back camera on a phone, with a frame to hold the code in; a code read
fills the field, beeps where the browser lets it and buzzes a phone, and the
sheet closes and stops the camera — as Escape, × and **Type it instead** do. It
reads QR codes, DataMatrix, EAN-13 and EAN-8, UPC-A and UPC-E, Code 128 and Code
39 (`formats` keeps it to some), with the browser's own `BarcodeDetector` where
it reads them all, else with ZXing's readers in the decode part
(`fieldia.decode.js`, about 40 KB gzipped), loaded only as Scan is pressed in a
browser without — Safari, Firefox, a computer's Chrome. Where the camera is not
allowed, there is none, another app holds it, or the page cannot use one, the
field says why beside the button and the cursor goes to its box, to type. A
code of a kind the field takes nothing from (a shelf's barcode held up for a lot)
is said in the sheet — "This code has no Lot in it" — never met with silence. A
scanner gun (a keyboard wedge) types into the box, and what it typed is read as
the camera reads a code once Enter is pressed or the box is left: a link's record
by its code (`by`), a GS1 code's part and the fields it fills — a code longer
than the field's most is read whole — while words a person types stay as typed.
A table counted has a box in its sheet to type a code whose label will not scan.

```json
{ "type": "field", "id": "f-patient", "field": "patient_id", "options": { "scan": { "by": "card" } } }
{ "type": "field", "id": "f-lines", "field": "line_ids",
  "cells": { "lot": { "options": { "scan": { "formats": ["data_matrix"], "part": "10", "fills": { "expiry": "17", "product_id": { "part": "01", "by": "gtin" } } } } } } }
{ "type": "field", "id": "f-count", "field": "line_ids", "options": { "scan": { "field": "product_id", "count": "counted", "by": "barcode" } } }
```

- **Words** take the code as read, one line in a char; a GS1 code taken whole is
  written as its label prints it, `(01)06285096000842(17)281231(10)25A1234`.
- **A link** finds its record by the code through the data source's `search`: by
  the field of its records that holds their codes (`by`: the search's filter asks
  for that field equal to the code, its query empty), else by name — the name
  itself first, then as the source searches names, which may find a product by
  its barcode. A GTIN of 14 digits is found as the 13 or 12 a shop may keep. One
  record is taken; none, or several, is said in the sheet, which reads on.
- **A GS1 code** — a medicine's DataMatrix, a GS1-128 barcode — is read by its
  parts: `part` is the one this field takes, by its Application Identifier (`10`
  a lot, `21` a serial number, `01` a GTIN, `17` an expiry), and `fills` the
  others the same code fills, a line's columns for a cell — a day as the date it
  names (`00` the month's last), a measure with its places, a link by its code.
  A code without the part is said, and the camera reads on.
- **A table counted** (`field` and `count` on a one2many's own node): each code
  read adds one to the line whose `field` — and every column the code fills —
  holds what it names, else adds a line with one; the sheet stays open, saying
  each count ("Hand cream 50 ml: 2 counted"), until Done. An item held still is
  read once; out of sight a moment and back, it is the next.
- `sound: false` keeps it silent. A Scan is hidden while the field is read-only.

The scan part (`scanPart`, `fieldia.scan.js`) draws all of it, loaded with a page
that has a field scanned into; until it comes, the field is its box alone. An
app reads codes its own way — a commercial scanning library, a test's stand-in —
with `(await scanPart.load()).useCodeReader({ detect })`, `detect` handed a
video's frame and answering `[{ rawValue, format }]` as `BarcodeDetector` does.
An app's bundler makes the decode part a chunk of its own, with `@zxing/library`
as its index brings it (about 120 KB gzipped, asked for only as Scan is pressed in
a browser that reads no codes itself).

MIT licensed.
