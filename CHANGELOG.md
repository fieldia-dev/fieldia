# Changelog

What changed in each release of Fieldia, newest first, in plain words. Every
package (`@fieldia/core`, `widgets`, `viewer`, `grid`, `code`, `monaco`, `map`,
`calendar`, `chatter`, `react`, `vue`, `angular`, `designer`) is released
together at one version, so one entry covers them all.

**Before 1.0**, a minor version (0.19 → 0.20) may change what an app writes.
Each such change is listed under **Upgrading** in its release. A page saved by
an older Fieldia keeps working: its format version (`"fieldia"`) says which
shape it has, and the viewer and the designer bring it up to date as they read
it (see `upgradePage` in the docs' page format page).

Each release's section is written in the commit that sets its version.
`node tools/release.mjs check` refuses a version that has no section here, and
`publish` prints the section with the git tag and the GitHub release commands.

## 0.26.0 — 2026-10-18

**A page names its records, a column moved by its header, a record's footer
under every sheet, and the business owner's walk of 0.25 mended** — and the
look on paper in a part of its own, loaded when a person means to print. The
page format is 0.5; a page of 0.1, 0.2, 0.3 or 0.4 is read as it is.

**A page names its records.** `records: { one, other, a? }` says what a page's
records are called — `{ "one": "invoice", "other": "invoices", "a": "an invoice"
}` (the article written by the page: it is never guessed) — and Fieldia's
sentences use it: the pager ("1–10 of 1,284 contacts"), nothing found, Select
all, Export, Edit, Print's count, Import's report and Undo, the questions before
Archive, Delete and letting changes go, why a run stopped, a record's crumb and
pager ("Next customer"), the gear's This invoice, someone else's save, a related
list's "New invoice", "View all invoices" and "No invoices yet" (in its model
page's words), possible duplicates ("A customer with this phone already exists",
"It's a new customer"), Merge, a calendar's New and a slot's count, a list's
map, the chatter and its history. Without it, every sentence reads as in 0.25.
German and French say the sentences they can round a page's words (none whose
words must agree with the noun), Arabic its pager's; elsewhere a language says
its own plain sentence. `lowerLabels: true` (page level) writes a field's label
small wherever it stands inside a sentence ("Choose at least 2 for interests",
"A customer with this phone…") but never at a sentence's start, a name ("IBAN",
"WhatsApp"), or in German or a right-to-left language; a line's own dialog and a
list's Edit dialog follow the page they are part of. `recordSentence` and
`labelAt` are the one rule, exported. In the designer: a screen's panel says
what its records are called and whether labels go small. The demos' customers,
invoices, contacts, properties and homes name theirs.

**A column moved by dragging its header.** In a list with `optionalColumns`, a
header pressed and carried sideways moves its column: a ghost of the header
under the pointer, the other columns sliding aside, a line where it goes, the
table scrolled at its edges, kept in the person's `preferences` as the Columns
menu's order is; Escape puts it back, a press that moves less than 5px still
sorts, a header's edge still sizes, a finger resting 500 ms lifts it (a swipe
scrolls), mirrored right to left, and its new place said ("Phone moved to place
2 of 8") — the menu's moves too. The list's name column, the page's first,
stays first and held in view; the others move after it. A table of lines drawn
as a grid moves its columns alike: Escape puts back and keeps nothing, a drag
out of the grid never hides a column, a finger's long press lifts, its move
said. Escape out of the Columns menu leaves the table where it was scrolled,
and the Columns button is held in sight at the header's end. The contacts demo
shows it.

**A record on paper, sheet after sheet.** A page's `print.footer` stands under
every sheet of a record in Chromium and Firefox (Safari's once, after it); a
tab's name, a group's title, a table's header and a step's title go to the next
sheet with the start of what follows them; groups side by side as the page sets
them at the sheet's width, a row of them never over the next; a group that fits
stays whole, and one that does not fit the room left starts the next sheet; a
long table breaks between its lines with its header again. Over it, the
record's own name — or, before it has one, what the page calls its records and
its stage ("Invoice · Draft"), never the model's title. A header or footer line
whose `{field}` is empty is left out whole; a required field's star never
prints; numbers, amounts, days and phone numbers never wrap inside a cell. A
field, group, tab or related list may say `"print": false` (the designer's On
paper). A list printed follows the person's columns in their order, with no
Columns cell; a grid's table of lines on paper follows the order its columns
are seen in, and one in a tab never opened prints as a table too. A work item's
title prints as its words, wrapped. A tab's count is the screen's alone.

**On paper when a person means it.** The whole look on paper comes in a part of
its own, `fieldia.print.js` (about 5 KB gzipped), loaded when a person means to
print: Ctrl+P (⌘P) on a page with a form is Fieldia's — the first time it waits
for the part, then prints at once — every Print waits for it, and it is fetched
ahead as the gear menu with Print opens, as a pointer rests on a Print button or
the keyboard reaches it, and when the browser is idle on a page meant for paper
(its own `print` words, or a list with `"print": true`). A page no one prints
never loads it. `printPart.load()` (or `loadParts()`) at an app's start gives
the whole look from the first print of the browser's own menu.

**Smaller things a page may say:**

- **A tab counts a related list in it** (`"count": { "related": "quotations"
  }`): asked of the source as the record is shown — whether the tab is open or
  not, never another record's — its list's own count after New, a delete or a
  row's button, hidden while unknown or before the first save. The tab's count
  pill is drawn on every page (a count outside a work item's head showed
  "Links0").
- **A related list's rows and New the app's own way** (`"open": "app"`): through
  the app's `onOpen` (or its host's `open`) with the page it gives for the
  model, New filling this record in through the request's `values`; else a
  dialog, as before.
- **View all says what its list is kept to**, as chips a person may take away
  ("Customer: Nile Traders", the related list's own filter by its title):
  `OpenRequest.search`, `ViewerOptions.listSearch`.
- **A key over a list's rows** says what their tones and bold mean: a row tone's
  `label` and a list's `rowBoldLabel`, drawn as swatches over the rows and read
  out as "Key to the rows"; without them nothing shows. The contacts demo says
  "Your own contacts".

**The business owner's walk of 0.25, mended:**

- **Every dialog and side panel holding a record asks before Escape or × lets
  typing go** — a related list's New and row, a calendar's New, an `open` step's
  dialog or panel — and so does Back on a page an `open` step shows in place;
  Cancel has the focus, Enter keeps.
- **Rows pasted from a spreadsheet each go on their own line**, in a plain table
  of lines and a grid alike: a link's name read through the source's search as
  typing reads it, a row whose name matches nothing or several refused whole
  with why (nothing called so, or more than one), never half laid on another
  line; a block
  pasted into a cell open for typing spreads as it does from a chosen cell.
- **"It's someone new" lets that record be** for this record whatever field
  matches it next.
- **A calendar's New takes the next free time from now** on its clock, rounded
  to its slot; a slot a person presses is still theirs, past or not.
- **A card never breaks an amount, a day or a phone number** inside, and its
  call links wrap together, in every theme.
- **Import says when a file's characters look wrong** and which character set
  reads it; a CSV with only its header says "no rows under the header" and
  offers no Check; the rows to fix are written as the file had them — yes and
  no, real dates — under the matched fields' labels, so the fixed file imports
  by itself.
- **A work item's head title wraps** whole where it is too long for its line —
  one line all the same, Enter saves it — and every title wraps whole words
  (`hyphens: manual`).
- **An empty grid's "No lines yet"** sits in its body, clear of its totals row.
- The memory source numbers new lines after every line it was given; the
  designer's Try it shows no Problems tab while it has nothing to say.
- fieldia.dev's demos: saved work stays while the tab is open (with Start over),
  a press the app shows nothing for says what the app was given, steps link
  their files and settings (no address bar needed), below 1,744px only the menu
  opens by itself and About is a "?" in the header, the address follows the
  record shown, more lists are cards on a phone (none scrolls sideways at 390px
  unless it says why), dialog demos say what happens next in plain words; the
  demos' notes and terms are formatted text and an order's date has its time.
- `release-notes --history` finds `chore: release x.y.z` commits too.

**And:** the page format is **0.5** (`FORMAT_VERSION`): it only added — a page's
`records` and `lowerLabels`, a tab's related count, a related list's `open`,
`print: false`, a tone's `label`, `rowBoldLabel` — so a 0.1 to 0.4 page is read
as it is, and `upgradePage` writes 0.5 in it.

**Upgrading** — what an app that uses none of the new things sees change:

- Ctrl+P (⌘P) on a page with a form is Fieldia's, unless the app's own keydown
  calls `preventDefault()` first. The browser's own menu, before the print part
  has come, prints a plain look (no buttons, bars, record bar, side panel or
  hints, light colours) and loads the part: every print after is whole. The
  whole-look rules moved out of `FIELDIA_CSS` into the part's sheet
  (`fieldia-print-styles`, `PART_RANK.print = 0`, right after the main sheet);
  the printout head's title and day are filled as printing begins. An app that
  serves `fieldia.js` itself serves `fieldia.print.js` beside it (the
  package's `bundle` folder has it).
- On paper: the footer is `.fd-print-foot` inside `.fd-print-end`, the last
  child of `.fd-content` (`PrintLook.foot` is that wrapper); every grid carries
  `data-columns`; while printing, boxes carry inline `--fd-print-keep` and
  `--fd-print-whole`, and the form `data-fd-measure` for a moment at
  `beforeprint`; groups sit side by side by a media query on the sheet's width;
  a list leaves out the column after its fields (row buttons, the Columns
  cell); @fieldia/grid shows its paper table while measured, and a grid drawn
  for paper carries `data-fd-paper` (`fd-paper`).
- Every dialog or side panel holding a record with a person's edits asks before
  Escape or × closes it.
- In a list with `optionalColumns`, a header pressed and moved 5px or more drags
  its column instead of sorting, and its words are not selectable; the name
  column stays first, and an order kept with it elsewhere is read with it put
  back first.
  @fieldia/grid sets `suppressDragLeaveHidesColumns`, its headers `touch-action:
  manipulation`, and its `headerTooltip` is a callback.
- View all opens its list with its conditions as chips a person may take away
  (0.25 kept them fixed and unseen); an `open` step with a `filter` and no
  `search` stays fixed, as before.
- A work item's head title is a one-line `textarea`
  (`[data-node="#title"] textarea`), where it was an `input`.
- `TabNode.count` is `string | TabCount`; `form.searchLine` takes `null`;
  `createMemoryDataSource` numbers new lines after the highest line id it was
  given; the workbook writer takes yes or no cells (`{ b }`).
- New exports: `recordSentence`, `labelAt`, `PageRecords`, `PageRecordsSchema`,
  `TabCount`, `relatedInTab` (core); `keepsWhole` (widgets); `printPart`,
  `PrintPart` (viewer). The list part gives `relatedCount`;
  `relatedListPage(page, node, records?)`; `RecordBarContext.locale?`,
  `RelatedContext.recordsOf?`, `ColumnChoices.movable`,
  `ColumnsContext.widgetLabels?`; `WidgetDialogs.openRecord` and `editValues`
  take `lowerLabels?`; the designer's `setRecords` and `setLowerLabels`.
- An app that gives the viewer a whole `labels` object adds `importNoRowsUnder`,
  `importMisread` and `rowsKey`; one that gives the widgets a whole `labels`
  object adds `pasteRowRefused`, `pasteNoMatch`, `pasteSeveralCalled` and
  `pasteNotLookedUp`. The `…Noun` sentences (ViewerLabels, Messages,
  CalendarLabels, ChatterLabels, ListMapLabels) are optional. `addLanguage`
  fills any left out from English.
- The quiet look's hint keeps "WhatsApp number" whole (0.25 wrote "whatsApp").
- A page the designer saves says `"fieldia": "0.5"`: Fieldia 0.25 refuses it as
  newer than it reads. An app that keeps pages for older Fieldias keeps them in
  0.4 (nothing 0.5 adds is in them).

**Size:** `fieldia.js` 503.4 KB, 162.9 gzipped (0.25: 501.0, 161.1) — the look
on paper moved out to `fieldia.print.js` (16.0 KB, 5.2 gzipped), loaded only
when a person means to print. Of the parts, the columns' grew with dragging
(6.9 KB gzipped, from 4.1), the list's with named records, tab counts, View
all's chips and the key over its rows (35.2, from 33.5), the lines' with rows
pasted each on their line (14.0, from 12.9), Import's (14.8, from 14.3). A
language's add-on is 10.4 to 11.8 KB gzipped (0.25: 9.9 to 11.7).

## 0.25.0 — 2026-10-17

**Records listed inside a record, lists people read on a phone and shape
themselves, a customer's data brought in, every page on paper, possible
duplicates merged** — a smaller main script, and the business owner's walk of
0.24 mended. The page format is 0.4; a page of 0.1, 0.2 or 0.3 is read as it
is.

**A related list inside a record.** A record's page may list another model's
records that point at it — a customer's invoices, a property's viewings — in a
group, a tab or straight in the sheet (`"type": "related"`: its `model`, their
link `field`, their own `fields` and `columns`, and `cells`, `filter`, `sort`,
`limit` (1–100), `searchFields`, `viewAll` and `create`). It asks the data
source's `list` for them — nothing new to write — a page at a time (5 unless
said), searched, sorted and counted, their totals under them, drawn by the list
part's own table; its title says how many there are. A row opens its record in
a dialog of the page your app gives for the model; **New** makes one there with
its link filled in; **View all** opens your list of them kept to this record's,
in a dialog, a side panel or this page's place, or your app's own way
(`onOpen`). Before the record's first save it says nothing points at it yet.
On a phone its rows are cards (`card`), as a list's; its rows take `rowTones`,
`rowBold` and `rowButtons` as a list's do, each read on the row's own record —
its fields, `id`, `user`, `context` — a row's button run with that one record
(`recordIds`); on paper, its rows as shown and "5 of 23" where they run past a
page. `form.relatedFilter(id)` gives what it asks for. In the designer: a
Related list among a record's toolbox, its panel's records, link, columns,
cards, row tones and buttons, rows a page, New and View all. New demos: a
customer with its invoices and quotations, a property with its viewings.

**Lists people read anywhere and shape themselves.**

- **Cards on a phone** (`card`): where a list is 520px wide or less, each row is
  a card — its title, a picture or a person's initials, a few lines and its
  status as a pill, each by field (`{}` takes them from the columns) — ticked,
  opened, toned and pressed as its row is, under its Group By heading, the
  totals in sight under the cards as they scroll.
- **A gallery** (`gallery`: `opens`, `size`): the same cards side by side on any
  width, their pictures large, a press away on the list's switcher.
- **Richer cells**: `badge` (a pill in its tones), `tags` (links as chips),
  `image` and `avatar`, `progressbar`, `percentage`, `duration`, and `phone`
  with `options.links` (a call, and WhatsApp where the number can be a mobile).
- **Rows' own rules**: a row's tone while a condition on its record holds
  (`rowTones`), its bold (`rowBold`) and its own buttons (`rowButtons`, each
  shown by its `invisible` on the row's record, pressed with that record
  alone) — conditions reading the person (`user`) and the app's `context` as a
  form's do (`form.recordReads`).
- **Columns people shape** (`optionalColumns`: each `show` or `hide` at first):
  a Columns menu to show, hide and order them, a header's edge to size them,
  the header and the first column in view as the rows scroll, kept for each
  person in the viewer's `preferences` (`<page>.<list>.columns`). Export and
  Print write the columns shown, in their order.

The cards and the columns come in parts of their own (`fieldia.cards.js`,
`fieldia.columns.js`), only where a list asks. In the designer: a list's Rows,
Cards and gallery, and a column's ways of drawing. New demo: homes for sale as
a gallery; the contacts shaped, with avatars, phone links and cards; invoices
as cards on a phone.

**Getting a customer's data in.** A list may offer **Import** (`"import":
true`, or the fields): records made from an Excel workbook (.xlsx) or a CSV
file, chosen or dropped and read in the browser with no library — a workbook's
zip opened with the browser's DecompressionStream, its days, numbers and yes or
no kept as it keeps them, its sheet picked; a CSV file's encoding (UTF-8 with
or without its mark, UTF-16, a language's Windows code page such as Arabic's
Windows-1256) and separator guessed, and changed by the person where wrong. Its
columns are matched to the page's fields by name or label in any of the page's
languages; every row is checked by the page's own rules before anything is
written — numbers in any script, days in the page's order, money in its
record's currency, yes or no and choices by their labels, links by name through
the source's search, phones the world over, required, most, least, places — the
rows refused named with why and downloadable as a file to fix. Then written by
the source's new optional `createMany` (`CreateManyRequest`,
`CreateManyResult`), or a save per row (`newRecordSave`), with progress and
Stop, and **Undo the import** deletes what it made. At most 50,000 rows in the
browser; the source's `importRecords` (`ImportRequest`) takes a bigger file on
the server. `importFields(page, list)`, `IMPORT_KINDS`, `importable`. It comes
in a part of its own, `fieldia.import.js`, loaded the first time Import is
pressed. In the designer: a list's Import.

**Rows pasted into a table of lines.** A block copied from a spreadsheet and
pasted in a cell of a table of lines fills across and down from it, each cell
read as its column reads what is typed, as the grid takes one; rows past the
last line add lines, as many as `max` allows, and one note says what went in
and what did not, with why. The cells' readers (`blockOf`, `readPastedCell`,
`whyNotPasted`) moved from @fieldia/grid into the lines part; the grid's Add and
a line's copy hide at the table's most lines, and ⌘V pastes on a grid cell in
Safari.

**Every page on paper.** Ctrl+P, the browser's menu or the page's own Print
prints a clean page by Fieldia's `@media print` rules, in every page's sheet:
every tab under its name, every folded group open, no buttons or bars, each box
as the words a person reads in it, a table of lines whole with its header on
each sheet, light colours, and over it the record's title and the day it was
printed. A page's `print` (`header`, `footer`, `logo`, each `{field}` showing
its value) puts the app's logo and words over it and words under it. With a
dialog or a panel open, its form prints alone. **This record alone**: the gear
menu's built-in `print`, a `{ "do": "print" }` step, or `viewer.print()`.
**The app's own PDF**: an action's answer may carry a `file` (`ActionFile`:
`name`, `type`, `url`, `data` or `bytes`, `show`), shown over the record in the
browser's own viewer with Download, or saved (`ActionHost.print`,
`ActionHost.file`). **A list's Print** (`"print": true`): every record the
search finds, asked a page at a time as Export asks, in the columns shown,
under its Group By headings with their sums, the totals under them, its
filters said in words, its footer at the foot of every sheet; a list shown as
cards prints as a table. In the designer: a page's printout words and logo, a
list's Print, the built-in Print.

**Possible duplicates, and Merge.** A record's page may name the fields records
like it are found by (`"duplicates": { "fields": [...], "on": "type" | "save"
}`): the data source's new optional `duplicates` (`DuplicatesRequest`,
`DuplicatesResult`, `DuplicateMatch`) is asked a moment after typing rests in
one of them, as a saved record opens and as it is saved, and each match is said
under the field it matched on, with Open it, "It's someone new" and — with the
source's `merge` (`MergeRequest`, `MergeResult`) — **Merge**: the two side by
side, a value picked for each field they hold apart. Never in the way of a
save. The form's `canFindDuplicates`, `findDuplicates`, `canMerge`,
`readRecord` and `merge`; the memory source's `duplicates` option
(`alikeRecords()`, the full `@fieldia/core`) and its `merge`. It comes in a part
of its own, `fieldia.duplicates.js`, never waited for. In the designer: a
record screen's possible duplicates. New demo: a customer typed twice.

**A smaller main script.** What only some pages use comes the first time a
page uses it:

- a link to other records — a many2one's and a reference's box, a many2many's
  tags and checkboxes, a char field's tags — in a part of its own,
  `fieldia.relations.js` (`relationsPart`); a choice's tags and a long choice's
  searched list (over 15 options) in the choice part; a one2many's cards in the
  lines part; a value to copy and a live timer in the business part. Each is
  drawn plainly until its part comes, keeping what is typed in it.
- The English words only a part shows are in that part (`tools/part-words.mjs`
  says which), added to every language's tables as it comes, never over a word
  a table has; the viewer reads its words as it draws them.

`partWith`, `partsOf` (an analytic distribution needs the business and the
relations parts together), `floatUnder` and `FloatPlace` are new exports, and
`PartFactory.partOf(node, page, field?)` takes the field.

**@fieldia/calendar on its page's clock.** A calendar places its events on its
start field's time zone, else the page's `timeZone`, else the browser's, in
every view; the zone's short name stands after the span where it is not the
reader's own, and a record moved keeps its real length across a change of the
clocks. New demo: the Berlin showroom's week of test drives.

**A business owner's walk of 0.24, mended:**

- **A value worked out from lines waits for a line that does not read**: a
  page's `compute` reading lines, a read-only number, amount or JSON on a record
  whose source has an onchange, and a line's own dialog show a dash with why
  ("Fix line 1 of Order lines to see Untaxed amount") until it reads
  (`form.waitsFor(field)`, `WaitsFor`).
- **A list drops open only when a person asks** — a click, a word typed,
  Alt+Down — in a link's box, a many2many's tags, a reference and a choice's
  tags; never for a focus the program puts there or Tab. The grid opens a
  cell's list on a press.
- **A double-click on a booking's time never books the one that slid under the
  pointer**, and the zone's note names it all year ("Times are Central European
  Time").
- **Totals over several currencies say so** — "Several currencies" in the cell,
  on a card and on a Group By heading, the sentence as its title — and a
  heading's sums are written in full.
- **A CSV file holds what a spreadsheet adds up**: numbers plain (a decimal
  comma where the file's values are kept apart by semicolons), an amount's
  currency in a column of its own or in its header, days and times as ISO writes
  them on the clock the list shows; a workbook's times are on that clock too.
- **On a phone a record's labels stand above their values**, in every theme;
  its title wraps whole.
- **A phone number's letters are said**, and WhatsApp offered only where the
  number can be a mobile (`canBeMobile`, the phone part; its table regenerated
  from libphonenumber-js 1.12.7 with each country's mobile prefixes).
- **A button pressed takes away what earlier presses said** (its toasts); steps
  the app runs itself still add theirs.
- The map's legend says what a round mark with a number counts; the phone box
  keeps the page's autofill purpose, and its empty Country reads on Apple's
  dark fill.
- The designer: a survey from nothing opens blank, its check neutral; Try it
  leaves out "Problems" when there are none; a step's check never names `id`,
  `user`, `editing` or `context` as missing fields.
- A hidden button in a dialog's foot is hidden (a read-only record's dialog
  showed Save & Close); a list page in a dialog closes with Close alone.

**And:**

- fieldia.dev's gallery in plain words, each demo found by what it does and its
  common words, slips of the keys forgiven, its headings counting what a
  search keeps; under every demo's name, the first thing to try, all its steps
  and its source on GitHub. The purchase order and invoice templates follow
  their real steps; phones by country on the sign-up, the test drive and
  contact us; "Someone else books 10:00" on the test drive.
- The page format is **0.4** (`FORMAT_VERSION`): it only added, so a 0.1, 0.2
  or 0.3 page is read as it is, and `upgradePage` writes 0.4 in it.

**Upgrading** — what an app that uses none of the new things sees change:

- Ctrl+P prints the print look of any page (Fieldia's `@media print` rules): no
  bars or buttons, every tab, each box as words. Every form carries a hidden
  `.fd-print-head`; tab panels carry `data-fd-tab` and `data-off`;
  @fieldia/grid listens to the window's `beforeprint` and `afterprint`.
- A link's box, a many2many's tags, a reference and a choice's tags no longer
  open their list when they take the focus — by Tab or a program's `focus()` —
  only for a click, typing, Alt+Down or the arrows.
- On a form 520px wide or less (a phone), labels stand above their values in
  every theme (`@container fd-form`).
- A button's press clears the toasts earlier presses left.
- A total over several currencies says "Several currencies" where it was blank;
  a Group By heading's sums are written in full.
- A CSV export writes numbers, amounts and days as a spreadsheet reads them
  (`250000.00`, `2026-10-15 14:30`), an amount's currency in a column of its own
  or its header, where it wrote them as the list shows them; a workbook writes
  a date and time on the clock the list shows (it wrote the stored UTC clock).
- WhatsApp is offered only for a number that can be a mobile.
- `onOpenRecord` (a list's) is given the row's name as its second argument.
- The widgets' `slotsZone` words drop "({mark})": the note names the zone all
  year.
- An app that gives the viewer a whole `labels` object adds the words of a
  related list (`related…`), a gallery and columns (`viewGallery`, `columns`,
  `moveColumnUp`, `moveColumnDown`, `resetColumns`, `resizeColumn`,
  `rowActions`), Import (`import…`), Print (`print…`), possible duplicates and
  Merge (`duplicate…`, `merge…`), several currencies (`totalMixedShort`) and a
  CSV file's currency column (`exportCurrency`); one that gives the widgets a
  whole `labels` object adds `pasteAddedLines`, `pasteAddedLinesOne` and
  `phoneLetters`. `addLanguage` fills any left out from English.
- In the script bundle, `Fieldia.VIEWER_LABELS`, `WIDGET_LABELS` and `MESSAGES`
  hold a part's English words only once that part has come (the npm packages'
  tables are complete, as before); a language given again after a page mounts
  shows on the next redraw.
- `PART_RANK` (`@fieldia/widgets`) gains `import` and `duplicates` before the
  themes — the ranks from the themes' on move on by two — and `cards` (a table
  of lines drawn as cards) last.
- A page the designer saves says `"fieldia": "0.4"`: Fieldia 0.24 refuses it as
  newer than it reads. An app that keeps pages for older Fieldias keeps them in
  0.3 (nothing 0.4 adds is in them).
- An app that serves `fieldia.js` itself serves the new `fieldia.relations.js`,
  `fieldia.cards.js`, `fieldia.columns.js`, `fieldia.import.js` and
  `fieldia.duplicates.js` beside it: the package's `bundle` folder has them all.
  A CDN already does.
- @fieldia/grid reads a pasted block with the lines part's readers (its own
  `cell-paste` module is gone), and loads the lines part for the first block
  pasted.
- `MemoryDataSource` has `createMany` and `merge`, and `duplicates` through its
  option; it leaves `importRecords` out as it leaves `exportRecords`.
- `@fieldia/calendar` places its events on its start field's or its page's
  time zone, where it used the browser's clock.

**Size:** `fieldia.js` 501.0 KB, 161.1 gzipped (0.24: 512.8, 167.1). Its parts
are 2.2 to 33.5 KB gzipped: the list's grew with related lists, richer rows,
Print and its own words (33.5, from 23.7); the relations' (7.5), cards' (3.7),
columns' (4.1), Import's (14.3) and possible duplicates' (6.2) are new and
loaded only where a page uses them. A language's add-on is 9.9 to 11.7 KB
gzipped (0.24: 8.3 to 9.7).

## 0.24.0 — 2026-10-16

**Time zones, phones the world over, booking slots, lists that add up and go
out in bulk, a browser's autofill and a public form's bot check** — and save
safety, the input rules and a business owner's walk of 0.23, each held to one
rule. The page format is 0.3; a page of 0.1 or 0.2 is read as it is.

**A page's time zone.** A page may name the time zone its dates and times are
in (`"timeZone": "Africa/Cairo"`, by its IANA name), and a date and time field
its own. A date and time is kept as the instant it is, as before, and shown
and typed on that zone's clock wherever the person is, its short name beside
the box and after the time in words where the browser's zone is another ("15
Oct 2026, 14:30 CEST"), which a paste reads back. Today is the zone's day: a
date's default `"today"`, its earliest and latest, a rule's past and future, a
list's periods, `form.today()`. A zone the browser does not know is refused by
the checks. `zonedPage(page)` writes the page's zone into each date and time
field that names none; `wallTime`, `instantsAt`, `dayIn`, `zoneOffset` and
`clocksSkip` are the clock arithmetic every reader and writer uses. In the
designer: the screen's Time zone, and a date and time's.

**Booking slots.** `"widget": "slots"` on a date and time books a time from
those free: a month whose days are shaded by how they are booked — free times
left, fully booked, closed, a holiday by its name — beside the chosen day's
free times as chips, asked of the data source's optional `slots(request)`
(`SlotsRequest`, `SlotsResult`), again when a field in `options.dependsOn`
changes, and once more for the day of a time picked, so a time someone else
booked meanwhile is said and never booked. `options` (`SlotsOptions`): the
`schedule`, a booking's `length` and the minutes `between` two, its
`endField`. `form.canFindSlots()` and `form.findSlots(field, { from, to })`
for a widget of your own; `scheduleSlots(schedules)` answers from booking
schedules for demos and tests (the full `@fieldia/core`, not the script
bundle). Without `slots` in the source, it is the date and time box. It comes
in a part of its own, `fieldia.slots.js`, with the date part.

**Phone numbers the world over.** A page's `"phone": { "country": "EG",
"shown": "national" }` — or a phone field's own `options.country` and
`shown` — makes its phone fields (`"widget": "phone"`) one number the world
over: its country picked before the number (its flag and dialling code) or
typed with its +, checked by its country (how long, how it starts), kept as
E.164 (`"+201012345678"`), shown at rest at home's way or abroad's, with a
call and a WhatsApp link. A number that does not read stays as typed with why,
and the save refuses it; no country is ever assumed. A list's phone column
and a table's phone cells are written the same way; a table drawn as cards
draws each cell with its column's widget, and a line's dialog reads phones as
its page does. The country table, made from libphonenumber's metadata
(`tools/phone-table.mjs`; its notice in `@fieldia/widgets`'
THIRD_PARTY_NOTICES.md), comes in a part of its own, `fieldia.phone.js` (15.2
KB gzipped), only where a page reads phones so. In the designer: the screen's
Phone numbers, and a phone field's Country and Shown.

**Lists that add up, and filter by time.** A column may total
(`"cells": { "amount": { "total": "sum" } }`: `sum`, `avg`, `min`, `max`,
`count`): a totals row under the list, the sums on each Group By heading and
the ticked rows' totals, asked of the source's optional `totals`
(`TotalsRequest`, `TotalsResult`). An amount whose currency each record keeps
is totalled in one currency only (`TotalsRequest.currencies`): over several,
the total is blank, its reason said on hover — never a wrong number. A named
filter may be a period a date falls in (`ListFilter.period`: today, this week,
last month, the last 30 days, overdue…), counted from the viewer's `now` in
the page's time zone, and a person's own filter offers "in the period". A date
in `groupBy` groups by its year, quarter, month, week or day (`GroupInterval`:
`interval`, `weekStart`, `timeZone`, on `groups` and `totals`); the memory
source does it all (`spanStart`, `dayStarts`, `addDays`).

**Lists people take away and change in bulk.** With every row on show ticked,
**Select all 1,284 that match** (the source's `allIds`, or its pages read
through) — never called "all" where the source stopped short. **Export**
(`"export": true`) writes the rows ticked, or every record the search finds,
as an Excel workbook or a CSV file, in the browser with no library, or on your
server (`exportRecords`). **Edit** (`"bulkEdit": true`, or the fields) sets one
field to one value on the records chosen, after a question, by the source's
`writeMany` or a save per record, each record's permissions and version kept,
and names what it could not change and why. Both are off unless the list asks
for them; in the designer, a list's Export and Edit.

**What the browser fills in, and a public form's bot check.** A field node's
`autocomplete` (a purpose from the HTML standard's list) and `inputmode` over
its kind's own; a value the browser fills in is read as typed. A page of
responses may take a `botCheck`: a hidden box only bots fill (`honeypot`), the
fewest seconds a person takes (`minSeconds`), and a slot for the app's own
captcha (`captcha`); `form.botCheck(…)` and the `bot` report sent with the
answers (`SubmitRequest.bot`) — the app decides. In the designer: a field's
autofill purpose and keyboard, the screen's Bot check.

**Save safety: every late answer kept to its record.** An answer that comes
once the record it was asked for is gone — an onchange, a name a box looks up, a
record made from a link, a line's dialog, Archive, Duplicate or Delete, Keep
mine's read — is laid on no other record, as a save's already was
(`form.recordShown()`; `whileShown` for a part of your own).

- A line edited after a save stays at risk when a step adds another line; a
  value the page's `change` steps tidy as it is typed stays the person's.
- A save refused for a conflict, waiting for Reload or Keep mine, is asked
  about before a way out lets it go (only a source with versions has one).
- A dialog that saved, then let a later change go, hands back the record as
  saved: Discard puts the person's changes no save took back as last saved.
- The pager on a record its own save locked asks to let what was typed go,
  instead of trying the save again; a dialog's Discard stops a file on its way.
- A line's own dialog asks before Escape or × let a change in it go.
- `warnOnLeave` (viewer, React, Vue, Angular): the browser's Back, Reload or a
  closed tab ask first while a change is not saved. Off unless set.

**The input rules held for names, tables and ways out.** A check of 0.21's
input rules on 0.23.0 found values handed on, saved or let go over what the
person typed; each way is now one rule:

- **A run of steps reads what is typed first.** A button's steps, its key's,
  a line's button's and the app's `form.run` read every box — waiting while a
  name is looked up — before the first step that reads the form or hands its
  values on (a `call`, `set`, an `open` with values, a `when`…), and stop on
  text that does not read, said under its box: "1.5" in a whole number is
  never handed to the app as 1, nor a customer's name typed as the one before.
  A moment's run (`on.change`, `afterSave`) takes the values as they are.
- **Text that does not read is the person's work.** After a save, a way out
  asks about "12a" as it asks about "12" (`workAtRisk`); a conflict's Reload
  keeps it in its box beside the changes it sets aside.
- **A name typed is taken as the person meant it** — by a link, its tags, a
  reference, a path and a choice typed by name. Words that name none, or
  several, stay as typed when the box is left, kept unread with why: a save is
  refused in words, never made with the record the box held, however fast the
  source answers; Escape puts that back. Two records of one name are said
  ("more than one is called …"), never the first taken; a record of exactly
  the name typed is taken whatever row the list reached; a path's Ctrl+Enter
  reads the words as a save does, however soon it is pressed; a name past the
  search's limit is asked for exactly; a tag already chosen, typed again, is
  said to be there.
- **In a table**: a grid cell left with a name of none keeps its words,
  marked, with why; a line's dialog opened while a name is looked up waits for
  it; `confirmDelete` asks over a line holding only text typed; tags waiting
  for room are taken by a save once there is room; a reference's name found
  after its model changed is let go.
- The Enter an IME takes its word with is the IME's: never a name box's, a
  list's or the grid's.
- A grid paste reads a spreadsheet's quoted cells (line breaks, tabs, quotes
  inside) as one cell, names an amount in another currency as its box does,
  and leaves words past a column's most, saying by how much.
- A list's custom filter says the time a day leaves out when it is written
  the page's way too ("15/10/2026 14:30"); and a press of a button just after
  a refused paste is the button's: words said or unsaid as a press leaves a box
  wait for the release, so nothing under the pointer moves.
- `SearchRequest.exact` (optional): only the records named exactly the query.
  A box asks so for a typed name a search's first answers did not hold; a
  source that leaves it out still works.

**Every box reads what was typed, and never rewrites what was not** (0.21's
input rules checked again on 0.23).

- **Typing while a box's part comes** (an app that draws without
  `loadParts`): the part's box takes the text as typed, its caret and the
  focus, in every engine — a per cent's "2." stays "2.", never 25 % a key
  later; hours' "1." is never 01:00. A links box reads the words typed before
  it came; a slider leaves the box being typed in beside it until it is left.
  `Widget.takeTyped`, for a part widget of an app's own.
- Hours and a per cent entered and left with nothing typed keep their value:
  0.123456 is never 0.1235, 6.51 hours never 6.5167. Hours typed are kept to
  the field's places ("6:20" with digits [16, 2] is 6.33, still 06:20), and a
  per cent's `digits` count the per cent shown (12.5 % with [5, 2]).
  Hours with a point, "6.45", stay Flectra's decimal hours, 06:27 — and the
  box now says so. A per cent drawn plainly keeps to its places too.
- **Money is read again when its currency changes**: 12.345 typed in dinars is
  refused in pounds, with why; "12.345" refused in pounds is taken in dinars.
  An amount with its own currency as people write it is read ("LE 1,500",
  "JD 12.345", "12 usd"), and a box's own unit ("12 kg").
- A number's digits [precision, scale] are counted as its check counts them:
  Floor area [10, 1] takes nine digits before the point, and says so.
- **Dates**: an instant on a day its month lacks (2026-02-31T10:00Z) is
  refused, never 3 March. A date and time the clocks skip for summer time is
  refused, saying what the clocks do ("there is no 02:30 on 29 Mar 2026 in
  Central European Time: the clocks go from 02:00 to 03:00"); one they pass
  twice is refused naming both offsets ("write 02:30 +02:00 or 02:30 +01:00"),
  and taken once either offset, or the zone's short name ("02:30 CEST"), is
  written after it. The reader takes a time zone (`DateReader.zone`,
  `readDate(text, { zone })`; the page's or the field's `timeZone`), the
  computer's when left out — one set of zone functions, core's (`wallTime`,
  `instantsAt`, `zoneOffset`, `clocksSkip`), for every reader and writer.
  Full-width marks read ("１５／１０／２０２６ １４：３０", hours "６：３０"). A pasted date that does not read says why; one pasted after a
  refused key joins the keys held. A day-first date on a year-first page
  points to the page's order. Escape in the quiet look puts back a date typed
  that did not read.
- An email's domain has no ";", ",", ":" or ">": "ali@example.com;" no
  longer passes, and those marks are refused as typed after the @.
- JSON numbers JSON.parse would change (an id of 20 digits, 1e400) are kept
  unread with where they are, in the JSON box and both code editors
  (`readJson`, `keptExactly`).
- A place's coordinates typed keep their places (30.0444567 is never rounded
  to six), and a pair pasted into either box ("30.0444, 31.2357") fills both.
- A colour code written by autofill without the focus keeps the colour; Ctrl+Z
  after the guard puts back an IME's or a phone keyboard's edit still takes
  back the keys typed before it. In Firefox, a key refused in a table's cell no
  longer empties the box ("1x5" is held, as everywhere else).

**A business owner's walk of 0.23, mended**, for every page of the shape they
met it in:

- **A record's button that moves its status saves the record first**, as
  Flectra's does. Confirm on an invoice with no customer says "Customer is
  required" and stays Draft, the customer still open to fill; Register payment
  never makes an unsaved invoice Paid. Steps that act and then save (a `set`, a
  `call` … then `save`) save a new or changed record before they run; refused,
  none of them runs. And a run that saves is one piece of work: when its save,
  or a check before it, is refused, what its own steps wrote since its last
  save is put back. A change made meanwhile by anyone else stays.
- **A double-click on Save saves, and only saves.** Save hides as it saves and
  the next button slides under the pointer: the second click of a double or a
  triple click (the browser counts them) is not taken by a bar's button that
  was not where its first click landed — it goes nowhere, and the focus stays
  where it was. A finger's double tap the same. A single click is always
  taken, a key or an app's `click()` is never refused, and nothing is
  disabled. A form dialog's own buttons the same; a line's × in a table is no
  bar's, so lines deleted one after another still go.
- **A question opens on Cancel**: a button's `confirm`, an `ask` step,
  Archive and Delete, as "Discard your changes?" did. Enter never answers Yes
  by itself.
- **The first tap on Submit counts.** A box left for a press elsewhere shows
  its problem once that press has ended, its click handled first: nothing
  moves under the finger, and the press lands where it began. Left with Tab,
  at once, as before. The same in a table's cell, a grid's, a property's row
  and a range's end.
- **Block on the customer page blocks**: asked first, then the customer is
  Blocked and saved, and it says so; Activate brings them back. Its statusbar
  shows where the customer stands, and Block, which asks, is the way there.
- **Lines are numbered as people count them**: the first product under a
  heading is line 1. Sections and notes are no lines — in a table's messages,
  its waiting totals, a line's tick and copy button, a pasted block's notes.
  A pasted cell on a heading's row is named by the heading.
- **A number a line works out waits with its line**: while the line's
  Quantity does not read, its Subtotal is a dash said in words ("Fix Quantity
  to see this line’s Subtotal"), and the totals that add it wait too — never
  an amount for a quantity the line no longer shows.
- **The currency sign has one place**: where the page's language writes it
  for that currency, in every box, cell and total. A box's own `symbol` no
  longer moves it in that box alone; a field's money look (`money.at`) still
  moves it everywhere the field is written.
- **Dark, Apple, Ant and shadcn sit on the page** in their systems' raised
  greys (#1c1c1e, #141414, #121214), never a black slab in a grey page; their
  cards stand off them, lighter.
- **A record's title wraps on a phone**, read from its start: a long name runs
  onto a second line, a size smaller on a phone so its words stay whole, never
  "Patien…" or only its end. It is one line all the
  same: Enter saves, a line break pasted into it is a space, and it says it is
  one line (`aria-multiline="false"`). Its subtitle the same.
- **A paste past a field's most is one message, said once**: the count stays
  a count ("2401 / 500", in the error colour), and the field says at once,
  under its box, "… is 1901 characters too long: shorten it to 500", in Arabic,
  German and French too. Nothing beside the count says it again.

**And:**

- The designer's Try it says the required questions not answered yet apart
  from problems, neutrally — "5 to answer" — its red count kept for real
  problems.
- A grid paste past a column's most says it in the words Save uses ("Code is 3
  characters too long: shorten it to 5"), as the field's own box does.
- A date range's end field counts as on the page in the designer; booking
  slots on a source without `slots` draw the date box from the date part.
- fieldia.dev: the front page opens with a business line and its business
  areas; the gallery groups the demos by business area, with a search and a By
  feature switch; sizes and counts are read from the build and the code
  (`site/facts.mjs`); the phone bar folds under Menu; templates open titled,
  every check clear; dialog demos have Done and Start over; demo titles are in
  a visitor's words. New demos: invoices that add up, 1,284 contacts to export
  and edit in bulk, a test drive booked from the times free on Berlin's clock,
  phones the world over on the contact page and the customers list.
- The page format is **0.3** (`FORMAT_VERSION`): it only added, so a 0.1 or
  0.2 page is read as it is, and `upgradePage` writes 0.3 in it.

**Upgrading** — what an app that uses none of the new things sees change:

- Save safety: a line's dialog asks before Escape drops a change, and the
  `save` event's `values` are the record as that save left it — a change typed
  while it was on its way is no longer among them.
- A button's or `form.run`'s steps stop (reason `check`) over text that does
  not read, where they ran with the value under it; and words that name
  nothing, left in a link, tags, a reference, a path or a choice typed by
  name, stay in the box (unread) instead of the old record coming back — a
  save is refused until they are put right or Escape puts back what the box
  held.
- A button whose steps act and then save saves a new or changed record before
  them: its data source sees that save, then the steps' own. When the steps'
  save is refused, what they wrote is put back.
- Every question — a button's `confirm`, an `ask` step, Archive, Delete —
  opens on Cancel: Enter no longer answers Yes by itself.
- A double-click's later clicks are not taken by a bar's button that slid under
  the pointer (Save hides as it saves): a single click, a key or an app's
  `click()` always is.
- A sheet's title and subtitle box is a `textarea` that wraps, no longer an
  `input`: a test that finds it as `[data-node="#title"] input` finds it as
  `textarea`, or by its role (textbox) and its name. (A work item's head's
  title is still an `input`.)
- A field box's `options.symbol` is no longer read: the currency sign stands
  where the page's language writes it; a field's `money.at` still moves it
  everywhere the field is written.
- A table cell's or a read-only value's date and time is written as the instant
  it is, on the browser's clock where nothing names a zone (0.23 wrote the clock
  it was stored with: `12:30Z` is 15:30 to a person in Cairo).
- A password box's `autocomplete` is `new-password` (was `off`), so a browser
  offers to make and keep one.
- A list's pager and its count of rows chosen group thousands ("1–10 / 1,284",
  "1,284 selected"); a date in `groupBy` offers its spans in the Group By menu;
  `ListFilter.filter` is optional (a `period` may stand in its place).
- A text pasted past its most is one message under the field, "… is 1901
  characters too long: shorten it to 500" (the messages `overBy` and
  `overByOne`), the counter beside it a count alone.
- An app that gives the form a whole `messages` object adds `wholeDigits`. One
  that gives the widgets a whole `labels` object adds `emailDomainChar`,
  `jsonNumber`, `dateOrder`, `hoursDecimal`, `cellWaits`, `cellOfHeading`,
  `timeSkipped`, `timeTwice`, `notThisZone`, and the phone's (`phone…`) and
  booking slots' (`slot…`, `slots…`) words, and loses `charactersOver` and
  `charactersOverOne`; a whole viewer `labels` object adds `leaveEmpty` and the
  words of a list's totals, periods, Group By spans, Select all, Export and
  Edit. `addLanguage` fills any left out from English.
- A page the designer saves says `"fieldia": "0.3"`: Fieldia 0.23 refuses it
  as newer than it reads. An app that keeps pages for older Fieldias keeps
  them in 0.2 (nothing 0.3 adds is in them).
- An app that serves `fieldia.js` itself serves the new `fieldia.phone.js` and
  `fieldia.slots.js` beside it (and THIRD_PARTY_NOTICES.md): the package's
  `bundle` folder has them all. A CDN already does.
- `PART_RANK` (`@fieldia/widgets`) gains `phone` and `slots`, before the
  themes; the ranks after them move on by two.
- `@fieldia/calendar` still places its events on the browser's clock, not a
  page's time zone.

**Size:** `fieldia.js` 512.8 KB, 167.1 gzipped (0.23: 474.3, 153.6). Its
parts are 2.2 to 23.7 KB gzipped: the list's grew with its totals, periods,
Export and Edit (23.7, from 12.7); the phone's (15.2) and booking slots' (5.6)
are new and loaded only where a page uses them. A language's add-on is 8.3 to
9.7 KB gzipped (0.23: 7.1 to 8.2).

## 0.23.0 — 2026-10-16

**A smaller main script: what a page uses now and then comes the first time it
is used.** `fieldia.js` is 153.6 KB gzipped, from 197.2 at 0.22 (and 157.9 at
0.20). Six groups moved out of it into parts beside it, each loaded the first
time a page uses one and waited for before the page is drawn, as the date box
and the work item's head already were:

- the list screen (`fieldia.list.js`, 12.7 KB gzipped);
- a table of lines and a many2many's table of records (`fieldia.lines.js`, 7.9);
- the business widgets: a statusbar, priority stars, hours and per cent boxes,
  an analytic distribution, tax totals, payments (`fieldia.business.js`, 9.5);
- file, picture, signature and PDF fields (`fieldia.files.js`, 11.2);
- the survey kinds: a ranking, a matrix, a slider, pictures to choose from, a
  colour, properties, an address, a progress bar (`fieldia.survey.js`, 12.1);
- the eight themes (`fieldia.themes.js`, 3.8) and the quiet look
  (`fieldia.quiet.js`, 2.2).

A plain form downloads 154 KB; a page that uses every group about what it did
in 0.22. An app's bundler splits the same parts into chunks of their own.

- Each part's stylesheet goes in where its rules stood in Fieldia's own, so
  nothing looks different.
- An app that draws a page without waiting for its parts (`loadParts`) sees
  each such field's value plainly — in words, or in a plain box that reads and
  writes the same value — until its part comes and takes its place, keeping
  the value, what was typed and the focus.
- A sheet's avatar asks for its picture's part, as a placed field does.
- A page that waits for its parts keeps its save status where the page put it
  (`saveStatus` "bar" or "toast").

**Upgrading:**

- An app that serves `fieldia.js` itself serves the `fieldia.*.js` files beside
  it: the package's `bundle` folder has them all. A CDN already does.
- `@fieldia/widgets` no longer exports `goingItem`, `goingWords`, `shrinkFor`
  and `shrinkable`, helpers of the file widgets: they are the files part's,
  `(await filesPart.load()).shrinkFor`. `binaryWidget`, `imageWidget`,
  `statusbarWidget`, `progressbarWidget`, `propertiesWidget` and `linesWidget`
  stay, each loading its part the first time it draws.
- A theme the app gives (`theme`, `setTheme`) is worn once its part has come:
  the page is drawn at once, in its skin's own look, and wears the theme a
  moment later. A theme the page itself names is waited for, as before.

**Size:** `fieldia.js` 153.6 KB gzipped (0.22: 197.2); its parts 2.2 to 18.2.

## 0.22.0 — 2026-10-15

**Files, conflicts, permissions and a calendar: what an app with real users
needs from its data source.** Every new data source member is optional: an app
that adds none of them behaves as in 0.21, apart from the one change under
**Upgrading**. The contract is in `docs/plans/wave1-contract.md`.

- **Files stored as they are picked** (`upload`): three at a time, each photo
  made smaller first, each with a bar, × and Retry; Save waits for them and says
  why. `uploadTo` covers a plain endpoint or a signed address. A signature's
  uploaded picture goes the same way.
- **Someone else changed this record**: a load or save can carry a version
  (`RecordVersion`), and a save refused for an older one (`ConflictError`)
  shows who changed what and when, with **Reload** (the person's changes set
  aside, each to put back) or **Keep mine**.
- **What a person may do** (`RecordPermissions`, `can`): fields locked or
  hidden, a record only to read, Archive, Duplicate and Delete hidden where the
  source says no.
- **A calendar for any list** (new package `@fieldia/calendar`,
  `calendarListViews`): day, week, month and agenda; a click on an empty slot,
  or a drag across slots, opens a new record with its start and end; and a
  list's switcher between its views.
- **Saving that cannot lose work**: one save at a time, each carrying the
  version the last got back; a way out of a record (another record, a reload, a
  close, a breadcrumb, a dialog's Escape) goes through one check, `form.leave()`,
  that asks "Discard your changes?" only when the person's work is at risk; an
  answer that comes back after its record was replaced is not laid over the
  one shown (its words are still said).
- **A part that fails stays in its box**: a widget, a slot or a map that throws
  shows a box naming it and tells `onError`; the rest of the form goes on.
- **Page format 0.2**: a page says which Fieldia shape it has (`"fieldia"`),
  and `upgradePage` brings an older one up to date. 0.2 only adds (a list's
  `calendar`, a date's order, a pattern's hint, a photo's `shrink`), so a 0.1
  page is read as it is; the designer writes 0.2. A Fieldia older than 0.22
  may refuse a 0.2 page.
- Tested in Firefox and WebKit as well as Chromium, on every change.
- **Renamed from 0.21:** `form.leave(path)`, which told the form a box was left,
  is now `form.boxLeft(path)`; `form.leave()` is the check above.

**Upgrading:** a way out of a record — another record, a reload, a close, a
breadcrumb, a dialog's Escape, × or Discard — taken while a save is on its way
now waits for that save before it goes, the page saying what it waits for. For
an app that uses none of 0.22's new data source members this is the one
deliberate change: it keeps the save's answer from landing on whatever record
the form shows by then, which wrote one record's values over another's. The
same race is why a run of steps whose record is replaced by anything but its
own steps (an `onAction` that opens another record itself, say) now stops
before its next step: answer `{ record }` instead, and the steps after it go on
with that record. With no save on its way, a way out goes at once, as in 0.20,
unless the person's work is at risk: a change of theirs that the record's last
save did not send (typed while it was on its way, while the steps after it ran,
or since), a file on its way, changes set aside. Then it asks "Discard your
changes?". Before a record's first save nothing typed is at risk, so a way out
lets a change not saved go, as in 0.21.

**Size:** `fieldia.js` is 197.2 KB gzipped (0.21: 176.9). A size pass is
planned for the next release.

## 0.21.0 — 2026-10-15

### Changed

- **A field's `pattern` now covers the whole answer.** It is checked as
  `^(?:pattern)$`, read with Unicode (`u`), as an answer rule's pattern and the
  browser's own `pattern` attribute are. Before, it was a substring test:
  `"[0-9]{5}"` let `"ab12345cd"` through. It is tested on the answer trimmed,
  with Arabic-Indic, Persian and fullwidth digits read as 0-9 and direction
  marks dropped, and a field with a pattern keeps its answer that way once
  its box is left (`"١١٥١١"` is kept as `"11511"`).
  - A pattern written to match part of an answer, such as `"@acme\\.com"`,
    must now say so: `".*@acme\\.com"`.
  - A pattern that only reads without Unicode (an escaped `\-` outside a
    class) is still read as it was written.
  - A pattern that does not read at all is reported by `checkPage`
    (`fields.<name>.pattern`), and the page is not shown; Save never fails on
    it.
- **`patternHint`**: a char field may say why an answer does not fit its
  pattern, in words (`"{label}: two letters, two digits, then the account"`),
  in place of "not in the expected format". It is translated with the page.
- **A number is never made of what was typed by dropping a key.** The keys
  typed after a refused one wait with it, its words staying under the box;
  Backspace takes them back. Left so, the box keeps all that was typed,
  marked, with why ("1.5" in a whole number is never 15, "-3" never 3,
  "1e5" never 15), and the field keeps what it held. The same in a table's
  cell, a list's filter, the designer's number settings and a map's
  coordinates.
- **Numbers are read as people write them, typed or pasted.** A 0 never
  leads a group ("0,500" and German "0.500" are a half, never 500); a
  number written the other way round can be typed key by key, as it could be
  pasted ("1.234,56" on an English page); trailing zeros are no places, so
  "12.50" pastes into a box of one place and "1,200.00" into a whole number.
- **A tax amount has its currency's places**: three for the Kuwaiti,
  Bahraini, Omani and Jordanian dinars and rials, shown as they are.
- **The designer's typed numbers use the shared reader**: a value set when
  ("Set to") is the designer's number box, never the browser's ("1,5" is 1.5,
  "٥٠" 50); a link's "has the value" reads Arabic and Persian digits, and
  keeps "0x10" and "1e3" as the words they are; a setting refused because of
  another ("From is not less than To") is said under its own box. A map's
  coordinates read Persian digits and drop direction marks, and a formula's
  list reads its numbers as the formula does (`qty in [٣, ٤]`).
- **A year of two digits is no longer read as 20xx.** "15/3/85" could be 1985
  or 2085, so a date box, a table's cell, a pasted block and a list's filter
  keep it unread and say both ("“85” could be 1985 or 2085; write the year in
  full"), in English, Arabic, French and German. Write the year in full.
- **A date written as Fieldia shows it at rest is read back**: its month in
  words in any of Fieldia's four languages ("15 Oct 2026", "15 أكتوبر 2026",
  "15 oct. 2026", "15. Okt. 2026", "Oct 15, 2026", with ", 14:30" for a date
  and time), and an instant with its zone ("2026-10-15T14:30:00Z"). Copied
  from a list, a read-only view or another box, a date now pastes.
  A date's box takes an instant's day; a date and time's keeps to the minute,
  so one with seconds is refused and says why, never cut short.
- **An email address has no ":", ";" or "," before its @.** A pasted
  "mailto:" link is taken as the address it links to, and zero-width
  characters a paste brings are dropped; a ":" typed before the @ is refused
  with words. An address saved with one of these marks before its @ no longer
  passes the email check.
- **Fieldia's own date box comes in a part of its own.** A date, a date and
  time, a time of day and a range of dates are drawn by the date part, loaded
  the first time a page shows one — `fieldia.date.js` beside `fieldia.js`, or
  a chunk an app's bundler makes — so a page with no date never downloads the
  box, its calendar or a range's (7 KB gzipped). The viewer waits for it
  before it draws a page with a date, a table whose lines have one, or
  properties, as it waits for 0.20's parts: nothing moves as it comes. A
  saved form placed in a page waits for its own parts the same way, under its
  placeholder. React's and Vue's `<FieldiaForm>` render their fields and
  slots when such a page is drawn after the component mounted (Vue's left
  them out). The reader stays in the main script for every box that reads a
  date (`readDateText`, `dateOrderOf`, `dateShape`, `dateExample`,
  `isoWeek`), and a date drawn before its part came is a plain box on that
  reader (`plainDateWidget`). `withCalendar` now comes from the part:
  `(await datePart.load()).withCalendar(…)`.
- **The designer's dates and times are Fieldia's own box**, never the
  browser's date or time box: a date's earliest or latest day, a time's
  earliest and latest, and the value a rule sets a date or a date and time to
  ("Set to") are typed in the page's order (15/10/2026), Arabic and Persian
  digits read, am and pm too. What does not read (31/02) keeps the setting and
  says why under its box; at rest a day shows in words (15 Oct 2026). A day
  and time set by a rule is still kept as the browser's box kept it,
  2026-10-15T14:30. The date box's input rules are the date part's
  `dateRules`, for any box a date is typed into, and `typingText` and
  `restingText` write a date as a box shows it while typed and at rest.
- **A date is never made of the keys around a refused one.** In a date, a
  date and time or a time box — a field's, a table's cell, a designer's
  setting — the keys typed after a refused letter wait with it, as a
  number's do: "1x5/10/2026" is never 15 October. Backspace takes them back;
  left so, the box keeps all that was typed, marked, with why, and the field
  keeps its day.
- **Enter saves from every one-line box again, as in 0.20.** The input
  rules took Enter in a number, an email or a box at its most characters for
  a typed line break: it was refused with false words ("several were
  pasted", "no spaces", "at most 120 characters") and the form was not sent.
  Enter in one line is now never judged, held or stopped: it sends the form,
  or moves to the next field where the page asks.
- **A save reads what is still typed first.** Ctrl+Enter, a button's key,
  the app's own `form.save()`, a check, a wizard's step forward and the
  record pager read the box being typed in before anything is saved, as
  leaving it would: a number, hours or a per cent passed on the way ("1" of
  "1.5", 12.3 of "12.34") is never saved; what does not read is refused with
  its words under its box. Every form has `settling(read)`, for a box that
  reads its text as it is left to say how to read it now, and `settle()`.
- **Every way a value is committed reads every kind of box.** A link, tags
  of links, a reference, a path and a choice typed by name are read by
  Ctrl+Enter, Save, a step, the pager and the app's own save while their
  name is still being looked up: the save waits for it and saves the record
  it names, or refuses with "nothing is called …", never saving the one it
  was replacing. A place's coordinate that does not read stops the save
  (never a place saved half new), and so does JSON in a code editor that does
  not parse. A reader may return what it waits for: `settle()` resolves once
  it ends, and `reading()` says it still waits. The whole table is
  docs/plans/input-rules.md.
- **Autosave never reads a box under the person's keys.** It waits while a
  box is still being typed in, and saves once it is left or Enter is pressed:
  "12." on its way to "12.5" is never refused mid-number, "Office " never
  trimmed before "Park". `settling(read, typing)` takes whether a box is
  still typed in.
- **A paste or a drop where keys wait after a refused one joins them**, the
  words said again: "ahmed " then a pasted "ali@example.com" is never
  "ahmedali@example.com". An IME's text, a phone keyboard's keys and an
  autocorrection wait with them too.
- **The designer reads a setting still typed before it publishes**, and a
  date it refuses is never refused in silence.
- **A paste into the grid names why a cell was left**, in its box's words
  ("Hours, line 1 (“6:3” could be 6:03 or 6:30; …)"); one character over its
  most is said as one; a language added with `addLanguage` says a count of one
  in its own words; a date filter and the plain date box say the time a day
  leaves out.
- **A phone number, an email and a colour's code hold the keys typed after a
  refused one**, as numbers and dates do: "+20 1oo 123 4567" is never the
  number "+20 1 123 4567", "ahmed ali@example.com" never
  "ahmedali@example.com", "#1x23" never #112233. Left so, all that was typed
  stays, and the field says why.
- **A time's one-digit minute is never quietly :03.** "14:3" could be 14:03
  or 14:30, and "14.5" 14:05, half past two or 14:50: a time, a date and
  time, hours and a pasted cell keep it unread and name each time it could be
  ("“14:3” could be 14:03 or 14:30; write the minutes with two digits"),
  joined as the page's language offers a choice. "14:7" can only be 14:07,
  and is read.
- **A date and time pasted into a date says its time was left out**, and a
  pasted cell of a date never takes an instant's day in silence.
- **A block pasted into a per cent or hours column keeps to its places and
  least**, as its box does: "12.555" in a column of two places is not pasted,
  never shown as 12.56 %. "Pasted into 1 cell", "1 character too many": a
  count of one is said in the singular, by the language's own rules.

## 0.20.0 — 2026-10-13

**A work item in a popup, as Azure DevOps draws it.** Built from twelve
screenshots of an Azure DevOps bug and compared side by side until no
difference a person notices at a glance remained. New demo: "Work item in a
popup" (`/demos/backlog/`), a backlog that opens a bug in that popup.

- **A record head** (`SheetNode.head`): the kind as a strip and a badge, the
  number and the title, a row of fields and links, its actions (a split "Save
  and Close" with a menu, Follow as a toggle, refresh, undo, "…"), "Updated by
  …", and tabs in the head with icons and counts. Buttons gain `menu`,
  `iconOnly`, `pressed` and `primaryWhenChanged`.
- **The inset dialog**: `openFormDialog(…, { size: 'inset', backdrop, maximise, resizable })`.
  Escape and × ask before throwing changes away.
- **A path picker** (`many2one.path`) for "Area\Branch" paths: the latest picks
  first, then the tree folded to the current branch.
- **Text that stays out of the way**: "Click to add …" at rest, the toolbar only
  on focus, @people and #records linked as typed, a Markdown mode with Preview.
- **The Discussion** placed in a column, and **History**: the State Graph and
  the changes grouped by age, each with its before and after.
- A list drawn as a backlog, with a filter bar and nested rows.
- Field access keys (`hotkey`), the lock at the value (`look.lockAt`), and
  head bands with their own column tracks.
- Each new part loads the first time a page uses it, before that page is drawn,
  so nothing shifts: `fieldia.head.js`, `fieldia.text.js`, `fieldia.path.js`,
  `fieldia.choice.js` and `fieldia.filters.js` beside `fieldia.js` in the
  script bundle, and chunks an app's bundler splits in the npm packages.

**Size:** `fieldia.js` is 157.9 KB gzipped (0.19: 142.7).

## 0.19.1 — 2026-10-13

**Address search checked live on Azure Maps and Google Places**, in English and
Arabic, across Egypt, Saudi Arabia, the UAE and Jordan.

- Azure: a search with no point to be near no longer fails; a picked suggestion
  is located by its own address, so a street stays in its own district; a pick
  that is only near the address says so (`precise: false`). On 158 hand-checked
  live cases, 130 are right in every way (0.19.0: 3 of 139).
- Google: Egyptian streets get their city, street and number come in the right
  order, plus codes no longer replace names, and UAE lines are no longer cut.
  One session per address, and the same words are never asked twice.
- Every provider: Escape, Tab and a pick drop a search still on its way, so no
  list reopens by itself and nothing is paid for words already dismissed.
  Emptying an address drops the place its pick wrote.

## 0.19.0 — 2026-10-12

**A map in any page, money looks, an address that suggests, and the quiet look.**

- **`mountListMap`**: a site gets just a list's map inside a page of its own,
  with its own scoped styles, `height`, `gestures: 'all'`, `fitZoom`, a
  starting view and `onViewChange`.
- **Cards and pins**: card options `labels: false`, `lead`, `href`,
  `choose: false`; each text keeps its own direction on an Arabic card.
- **Money** (`money` on a monetary field): the currency by code or symbol,
  before or after, short ("13.9M"), the home currency left unsaid, "/month"
  while a condition holds. Lists, fields, cards and pins all use it.
- **An address with suggestions** (`address-search`): one line of text that
  suggests addresses from the map service as people type, and can fill a
  place field and an address in parts. With no service it is a plain text field.
- **The quiet look** (`look.skin: 'quiet'`, or `quiet` on a section or a
  field): values read as plain words until pointed at or entered; Escape puts
  the value back; a field locked by a rule shows a lock and says why
  (`readonlyReason`).

**Size:** the main script is 142.7 KB gzipped (0.18: 138.8), most of it the
quiet look's styles.

## 0.18.0 — 2026-10-12

- **Crowded pins on a form's map** gather into a bubble with their count; a
  moving place is never hidden under them.
- **Traffic** (`tools: ["traffic"]`) on Azure Maps, Google and Mapbox.
- **VS Code's editor for one-line fields** (`char.monaco`): as tall as a text
  box, Enter adds no line, a paste is joined into one line.
- fieldia.dev and the demos follow the reader's light or dark setting.
- The demos' Code drawer shows the code each demo really needs.
- Tests never reach a real map server.

## 0.17.0 — 2026-10-12

**Maps, phase 4: areas by colour, reach, fences, map tools.**

- **Areas by colour**: districts or zones shaded from the page's accent, with a
  legend, from GeoJSON the app gives (`regions`). On a list's map each area is
  shaded by its records; on a form's map a press chooses it into a field.
  Every area can be reached by keyboard.
- A **heat map** from afar on a list's map; **nearest first**
  (`SortOrder.near`); **reachable areas** (`reachable`) from Azure or Mapbox.
- **Fences** (`fences`) run the page's steps when a moving place goes into or
  out of an area.
- Map tools: satellite, full screen, measuring a way by mouse or keys.
- The designer sets areas, reach, tools and fences.

## 0.16.0 — 2026-10-12

**Maps, phase 3: a map on a form** (`type: "map"`, with `mapParts`): the
record's places as layers, a place for each line, routes along the roads, and
the reader's own place.

- Moving places glide to each new position, turn grey when their news is old,
  and are followed until the map is moved.
- Routes from Azure Maps, Google, Mapbox, OSRM or the app's own; the time and
  distance left are written into the record.
- The designer has a Map block with its layers and routes.

## 0.15.0 — 2026-10-12

**Maps, phase 2: a list's records on a map.** A list page with `map` shows its
records as pins (a price, an icon, a photo or a dot, coloured by condition),
with bubbles where pins crowd, a card for each record, "Search this area", and
an area drawn on the map as a search of its own (`within`). A pin lights its
row and a row its pin. The designer sets a list's map in its panel.

## 0.14.1 — 2026-10-12

- Place fields suggest addresses as people type, on Azure and Google, nearest
  first.
- A map provider's refusal is shown in its own words.
- A JSON code field says where the JSON breaks.

## 0.14.0 — 2026-10-11

- **`@fieldia/code`**: text and one-line fields as code in 44 languages, each
  language loaded the first time a page shows it.
- **`@fieldia/monaco`** (new package): text and JSON fields in VS Code's editor.
- **`@fieldia/map`** (new package): Place and Area fields on Azure Maps, Google,
  Mapbox or OpenStreetMap, also in the designer's toolbox.

## 0.13.1 — 2026-10-10

- A table's column can be drawn by the app's own widget.
- fieldia.dev gained feature pages for forms, rules, lists, looks and backends.

## 0.13.0 — 2026-10-09

**A host's own colours, and eight themes.**

- **`tokens`** (viewer, React, Vue, Angular): the host app's colours, corners
  and font, worn by the form and its dialogs and changeable while shown. They
  sit in a cascade layer, so a host's colours win whole.
- **Eight themes** (`look.theme`) in the style of known design systems, light
  and dark, also on the designer's Look tab.
- **Nineteen ready pages** (templates), each in one of the themes.
- Many table, number and label alignment fixes found on the real pages.

## 0.12.0 — 2026-10-07

**The real pages' gaps closed.** Some forty screens from Sherkety ERP (sales,
accounting, CRM, people, operations, legal) were rebuilt as Fieldia pages, and
everything they needed was added:

- A record's bar: gear menu, pager, breadcrumbs, attachments; ribbons, alerts
  with values and buttons, stat buttons with units, a page's own footer buttons.
- Tables: their own rules for cells, columns and row buttons; chosen lines with
  buttons; money in the record's currency; lines as cards on a phone; a line
  that opens its own form or its record's page; a many2many as a table.
- New widgets: tax totals, payments, analytic distribution, properties from a
  linked record, PDF and web page inline, a live timer, a date range, copy,
  colour, state dot, priority stars, hours and per cent, badges.
- Conditions read the app's context, the record's id, the person and their
  roles; `hideOn` hides a part at some widths; `setWhen` works as Flectra's
  onchange; help under a field, behind a (?), or both.
- Tabs are drawn when first shown.

## 0.11.0 — 2026-10-06

**The designer published too, under the MIT licence.**

- **Steps** (`on`, and a button's steps): what a press, a change or a page's
  moment runs, as data — open a page, say something, ask, show a tab, save.
  The viewer hosts them, and React, Vue and Angular hear the form's events.
- **`openFormPanel`**: a page in a side panel, from any side.
- **Saved forms placed in a page** by their id (`type: "form"`), their answers
  kept under their own name; the viewer finds them through **`pages`**.
- A look for each kind of part (`look.parts`), and looks saved by name.
- The designer in Arabic, end to end.
- Files as cards, with a switch between cards and a list.

**Upgrading:** the viewer's `pages` option is the new way to give it other
pages. `relatedPages` is still read.

## 0.10.0 — 2026-10-05

**The designer grows up, and surveys get every kind of question.**

- **The designer**: a canvas drawn as the viewer draws, edited in place; a
  Simple and an Advanced mode; an outline tree; Find anything (⌘K); Checks and
  "what changed" before publishing; versions; Try it at a phone's width or
  right to left; a JSON view; a Translations view with CSV; copy and paste
  between designers; templates; the app's own assistant; the app's own kinds.
- **Layout**: groups in twelfths, side-by-side groups, columns per screen
  size, dividers, spacers and pictures.
- **New kinds of question**: ranking, image choice, slider, signature, matrix,
  NPS scale, ratings, tags from a list, yes/no, address in parts, repeating
  group, "Other", several files.
- **Rules**: values worked out from others, answer rules with warnings,
  setting a value when a condition starts to hold, arithmetic and functions in
  expressions, choices from the app's lists, quiz scores.
- **Languages**: a page keeps its own translations and is shown in any of
  them, right to left where so; `addLanguage` adds the viewer's words for a
  language, one file per language.

## 0.9.2 — 2026-10-03

- The statusbar fills the current stage and leaves its words alone.

## 0.9.1 — 2026-10-03

- The designer's editors as React, Vue and Angular components.
- Drag a field into another section or onto a tab; record sheets with a title
  and tabs in the screen editor; links, tables of lines and business fields in
  the palette.
- A demo gallery with thumbnails.

## 0.9.0 — 2026-10-03

**Lists.** A list page (`layout.type: "list"`) sorts, pages, chooses and opens
records; it has a search bar with filters, Group By and favourites, and groups
that open. Data sources gain `list` and `groups`. Every binding and demo has
lists.

## 0.8.0 — 2026-10-02

**`@fieldia/chatter`**: messages, notes and tracked changes with a composer;
reactions, replies and @mentions; attachments with previews; activities;
followers. `chatterSlot` follows the form's record beside a sheet.

## 0.7.0 — 2026-10-02

- **`translate`**: the app's own translator for every word of a page, in all
  three bindings.
- **A whole form locked**, with an Edit and Done switch.
- **A refused save says why** (fields, a rule, the network), where it belongs,
  with Retry; the save's status as a toast or a bar.
- A ✓ by a field filled in right; Ctrl+Enter saves; Enter can move to the next
  field.
- Filters with "any" and "all" groups, "starts with", "is set", "between".
- The script bundle shrank from 81 to 50 KB: the viewer checks pages without
  the validation library.

## 0.6.0 — 2026-10-02

- Badges, closable alerts, fields beside the title, header groups.
- A wizard's step list, Skip for an optional step, its own button words.
- A page's width, and Save at the top or the foot.
- Icons on sections, tabs and buttons; columns per screen width.
- A read-only section makes every field in it read-only.

## 0.5.0 — 2026-10-02

- **`openFormDialog`**: a page in a dialog that saves.
- Link fields gain Search more…, Create and edit… and an open button;
  `relatedPages` names the pages those dialogs show.
- A line of a table opens in a dialog with all of its fields, and follows its
  onchange live.

## 0.4.0 — 2026-10-02

- **`@fieldia/code`**: a JSON field in a code editor, offline.
- Create "…" in link fields and tags, from what was typed.
- Properties edited one by one; formatted text with a toolbar; a calendar with
  week numbers; money that picks its currency; a statusbar anywhere; free-text
  tags; a progress bar; numbers written the page's language's way.

## 0.3.0 — 2026-10-02

**`@fieldia/grid`**: a table of lines on AG Grid with Fieldia's editors —
spreadsheet keys, lines dragged into order, section and note rows, a totals
row, columns chosen, resized and moved (and remembered), long tables that draw
only the rows in view, and a whole line edited at once (`editMode: 'row'`).

## 0.2.0 — 2026-10-02

- Sections that fold from their title.
- An onchange warning shown under the field that changed.
- A demo page with every field, in all four frameworks.
- Fixes for wide tables and columns on a phone.

## 0.1.0 — 2026-10-02

**The first release.** The page format (`fieldia: "0.1"`) with its JSON Schema
and validation; conditions in Flectra's modifier language; a form's record
state with drafts, autosave and wizards; the data source interface with an
in-memory source; plain-DOM inputs for every simple field type, links, tables
of lines, files and images, in the underline and outlined skins; the viewer;
React, Vue and Angular bindings; the survey editor and the screen editor;
messages in English, Arabic, German and French; and a script-tag bundle that
sets the global `Fieldia`.
