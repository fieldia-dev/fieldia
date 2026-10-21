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

A date of a month alone — a billing period, a card's expiry — is
`"precision": "month"` on its field, and of a year alone — a building's year —
`"precision": "year"`. Its box takes a month as people write one — 10/2026,
10-2026, 2026-10, Oct 2026, أكتوبر ٢٠٢٦, octobre 2026 — or four digits, keeps
its first day (`"2026-10-01"`, `"2026-01-01"`) and shows it at rest in the
page's language ("Oct 2026", "2026"); its button opens a year's twelve months,
or twelve years. A whole day typed or pasted gives its month, and the day it
leaves out is said. Its `min` and `max` are kept by the month or the year: with
`"min": "today"`, this month is still within it. A list's cell and a value
read-only write it the same way.

```json
"first_rent": { "type": "date", "label": "First rent's month", "precision": "month", "min": "today" }
```

A date with `"hijri": true` is shown and typed in the Hijri calendar beside
the Gregorian day it keeps, by Umm al-Qura's reckoning as the browser's Intl
keeps it (`islamic-umalqura`): a second box beside its own reads "2 Jumada I
1448 AH" at rest ("2 جمادى الأولى 1448 هـ" in Arabic) and 02/05/1448 while it
is typed in, in the page's order; a day typed in either box writes the other.
A Hijri month has 29 or 30 days as Umm al-Qura says, and a day past them is
said with the days it has, kept unread in its own box while the field holds the
day it held. Its calendar shows each day's Hijri day under it, and the Hijri
months a month spans in its title; a list's cell writes both days ("13 Oct
2026 · 2 Jumada I 1448 AH"). The value stays the Gregorian day, as every
backend keeps it. Both come in the date part with the date box.

A choice's options may say more than their words — `"caption"`, a second line
under them (a service's length and price), `"icon"`, one of Fieldia's icons by
name (or the app's), and `"color"`, #rrggbb, a dot beside them. Radios and
checkboxes draw them (option-look.ts); a dropdown whose options have any is
Fieldia's own list, never the browser's, which shows one line; a list that
searches draws them too. A link's suggestions draw what the data source gives
of each record: its picture, or its colour as Flectra numbers them, before its
name, its first line of details under it, and its aside at the row's end.

A char field's node may type it to a mask — a national ID, an IBAN, a car
plate: `"options": { "mask": "9 999 999 999" }`, where `9` is a digit (in any
script, kept as 0-9), `a` a letter, `*` a letter or a digit, `\` before a
character that character itself, and `[ ]` round the end of it what may be
left out (an IBAN's last groups, as long as its country's); every other
character is the mask's own, written in as the person types — "2 104 " as the
fifth digit is due — and Backspace over one takes the character before it. A
key no slot takes there is refused with why ("a digit goes here, not “x”"),
the keys after it held (the input rules); a paste is laid out against it or
refused whole, saying why. The field takes the characters typed
(`"2104556789"`) once every slot it needs is filled, or as shown
(`"maskKeeps": "shown"`: `"4821 RKA"`); `"upper": true` writes its letters in
capitals. Left before it is whole, what was typed stays, marked, with how many
are still to type, and the field keeps what it held. A value from outside that
the mask does not fit is shown as it came.

```json
{ "type": "field", "id": "f-iban", "field": "iban", "options": { "mask": "aa99 **** **** **** **** **[** **** **** **]", "upper": true } }
```

A number or an amount whose node says `"options": { "shorthand": true }` is
typed as agents write big amounts: "3.5m", "500k", "1.2bn", "2 million",
"٣٫٥ مليون", "3,5 Mio.", "1,5 Md" — the number read by the number reader in
the page's way, its last word read as the power of ten it names, worked out on
the digits (1.1m is 1,100,000, never 1,100,000.0000000002). The words are the
page's language's own, as Intl writes compact numbers in it — short and long,
each form it uses — and English's, beside the letters people type anywhere:
k, m, mn, b, bn. While it is typed the box says what it reads ("3.5m is
3,500,000.00"), and once left it shows the whole amount. A letter no such word
begins with is refused, saying so; a paste in shorthand is taken as typed. It
comes in the typed part, with masks.

`"widget": "one-time-code"` on a char field draws a box for each of a code's
digits (`options.length`, 4 to 12, 6 unless said; `options.letters` for
letters too) over one text box with `autocomplete="one-time-code"`, so the
phone's autofill of a code sent by SMS fills it whole, a screen reader reads
one box by its label ("6 digits"), and a code pasted with its spaces or dashes
lands across the boxes at once. The field takes the code once it is whole — a
step on its change can send it; left before then, it says how many are still to
type. Both come in the typed part (`typedPart`), the text box meanwhile.

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
it fits, else broken between its rows with its header row again.

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

MIT licensed.
