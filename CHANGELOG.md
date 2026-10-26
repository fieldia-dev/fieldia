# Changelog

What changed in each release of Fieldia, newest first, in plain words. Every
package (`@fieldia/core`, `widgets`, `viewer`, `grid`, `code`, `monaco`, `map`,
`calendar`, `gantt`, `chatter`, `react`, `vue`, `angular`, `designer`, `testing`)
is released together at one version, so one entry covers them all.

**Before 1.0**, a minor version (0.19 → 0.20) may change what an app writes.
Each such change is listed under **Upgrading** in its release. A page saved by
an older Fieldia keeps working: its format version (`"fieldia"`) says which
shape it has, and the viewer and the designer bring it up to date as they read
it (see `upgradePage` in the docs' page format page).

Each release's section is written in the commit that sets its version.
`node tools/release.mjs check` refuses a version that has no section here, and
`publish` prints the section with the git tag and the GitHub release commands.
A patch (0.34.**1**) holds fixes alone, with no Upgrading part: `release.mjs`
refuses one that has.

## 0.35.2 — 2026-10-26

**A page's words can quote a brace.** Since 0.27 a `{name}` in any of a page's
words shows that field's value, and the page check refuses a name that is no
field. Words that quote braces — a step studio's help, "{list} is a setting in
words", a template's `{{customer}}` — could not be written. Now a backslash
before a brace keeps it as written, everywhere a page's words are shown, through
one reader.

**Fixes:**

- **A page's words can show a literal `{name}`: write `\{name}`** (in JSON,
  `"\\{name}"`). `\{method:value}` shows "{method:value}", `\{\{customer}}`
  shows "{{customer}}", and the page check refuses none of them. A run of
  backslashes before a brace shows half of them, and an odd run leaves the
  brace as written: `\\{name}` is a backslash, then the value. A backslash
  anywhere else is as written, and words with no backslash before a brace read
  as they did in 0.35.1. One reader reads every word a page shows, value or
  none: a label and its help, a box's placeholder, a choice, a page's, a
  section's and a tab's title, a counter, a ribbon, a badge, an alert, a button,
  its menu and its question, a toast, an ending, a quiz's feedback, a review, a
  payment, the page on paper, a list, its filters and its cards, a related list,
  a map, the designer's previews. A page's translations find their words as
  written.
- **`literalWords(text)` writes any text so that every reader shows it exactly**
  as it is, with no value and nothing for the page check to refuse: each brace
  escaped, each run of backslashes before one doubled. An app that puts words it
  did not write into a page calls it at one place. It is on `window.Fieldia` too.
  **`literalPage(page)`** writes every word a person reads in a page so — the
  words `translatePage` goes through, and the page's translations — and leaves
  names, ids, choice values, conditions, addresses and data as they are.
- Fieldia's sentences that name a page's records ("12 customers selected") fill
  in their numbers and the page's words for its records in one pass: a brace in
  those words is kept. 0.35.1 dropped any `{word}` from them.
- A quiz question's `feedback` and a picture's `alt` in a pins widget's settings
  are words `translatePage` and `pageWords` go through, translated with the rest.
- **Ctrl+Enter pressed twice while a save is on its way is one save**, even
  when an `onchange` answer that changed nothing lands between the presses.
  0.34–0.35.1 took that answer for a change and sent a second save once the
  first answered, moving the record's version.
- Dependencies, patch releases only: zod 4.6.7, and the code editor's
  `@codemirror/language` 6.13.1, `@codemirror/legacy-modes` 6.5.5 and
  `@codemirror/view` 6.43.14.

Behaviour you may notice in an app's own tests:

- A backslash already right before a brace now escapes it: `C:\files\{name}`
  shows "C:\files{name}". Write `C:\files\\{name}` for a backslash, then the
  value. No example page or template has one.
- A widget is given its field and its part (`context.field`, `context.node`)
  with their words read: where a word escapes a brace, a copy with the brace in
  its place; otherwise the very objects, as before. An app's own widget too.
- A `say` step's and an `ask` step's words, a press's question (`confirm`) and
  its Yes reach the host's `say` and `ask` read: an escaped brace a brace.
- `WidgetDialogs.editValues` is given its `title` as a person reads it, and its
  fields and layout as the page writes them.
- `recordSentence` takes a sentence's own values as a fifth argument and fills
  them in the same pass as the page's words for its records.
- New in `@fieldia/core`: `literalWords`, `literalPage`, and the reader's parts
  the packages draw with — `plainWords`, `plainPart`, `wordsRead`, `writtenPart`,
  `READ_WORDS`.

**Size:** `fieldia.js` 578.3 KB, 193.6 gzipped (0.35.1: 576.6, 192.9): the one
reader, and every word read once where it is drawn, +1.6 KB, +0.62 gzipped; a
save on its way joined by what its values hold +0.06, +0.06. Of
the parts, raw: answers 4.41 (4.35), head 42.42 (42.35), import 38.94 (38.89),
pay 7.83 (7.80), print 16.52 (16.49), evidence 9.21 (9.18); the rest within
0.05 KB.

## 0.35.1 — 2026-10-26

**The owner's walk of 0.35.0.** A business owner walked fieldia.dev's 0.35
demos as a customer would, on a desktop, a phone and a slow network. What was
slow, could not be undone or said nothing is fixed here, at its cause, for
every page it could happen on. The page format stays 0.13: nothing a page says
changes.

**Fixes:**

- **A key in a 200-line invoice costs what one in 3 lines does.** A key in
  the header or in a line took 146–185 ms on a desktop and 0.66–0.92 s on a
  slower phone; it now takes 27–29 ms and 67–115 ms. A line's rules, checks
  and waits are worked out again only for the line that changed. An onchange's
  answer keeps the lines it did not change. A line's phone card is drawn again
  only when its line changed. The styles no longer re-match the whole form at
  every key with `:has()`: Fieldia marks the elements itself.
- **A payment step or code check that could not load: Retry works, and Reload
  keeps the typing.** Retry asks for the part's file again where the browser
  names it, with the integrity the page gave it. A code check's missing part
  is said at once under the mobile, with its Retry. Where the browser names no
  file, the words ask for a reload: what was typed is kept in the tab and
  offered back after it — never a password box's value or a field marked
  `secret`, as drafts keep none.
- **The designer's "Open a web address" takes an address typed as it is**
  (`https://…`). An address it may not open is refused in plain words — "Only
  a web, mail or phone address, or a page of this site, can open here" — and
  what was typed is kept.
- **A list's row pointed at whose record has no place on the map lights the
  note that says so**, beside the map.
- **Back to a long list finds it where it was left.** Open an entry far down
  a list, press Back, and the list has the rows it had loaded, the same row at
  the same height, and the keyboard on the entry that was opened. This holds
  for every list that opens its rows on a page of their own. A list opened anew
  starts at its top.
- A link in formatted text refused for its address (`javascript:`, say) says
  why under its box.
- A save that failed in the source's own words is said as not done: "Not
  saved. The server did not answer this once."
- A record that could not be opened from a list is named by its row: "Couldn't
  open customer Horus Foods", not "customer 32". `form.openRecord(id, name)`
  and `onOpenRecord(id, name)` carry the name.
- A list's map whose code is still coming holds its place with one block the
  size of the map. 0.35 drew a bar across its top, then the block.
- A person search that fails, said in a toast, closes its empty list. 0.35
  left an empty dropdown frame open over the form.
- A table of lines' analytic column starts narrower, so a draft invoice's
  last column ("Tax excl.") shows whole at 1440 px.
- A record's draft offer speaks of changes: "You have unsaved changes from …".
  A form's still speaks of answers. The new word is in all 8 languages.
- A file named as a picture that is not one says so: "This file is not a
  picture, though its name says so: it is not shown".
- The Gantt's Days view shows a link a drag broke, as the Weeks view did.
- A rating's five stars stay on one line in a column a third of a form wide.
- "Saved, but not all your changes." is said only when a save left a change
  out. 0.35 also said it after Reset to Draft's save once the person typed.
- The demos: a contact's Email is checked as an email; an activity log's entry
  reads as words; the embed page about unit B-12 fills its Unit; the long
  intake offers its answers back after a reload; a demo's place holds a quiet
  shape while its own script comes.

Behaviour you may notice in an app's own tests:

- A save the source refused with its own message starts "Not saved. " (or
  "Not sent. "), in the status and in what is announced. Fieldia's own
  sentences that already say so are left as they are.
- After a save, typing again clears "Saved" from the status line. It no longer
  turns into "Saved, but not all your changes."
- On a record's page the draft offer reads "You have unsaved changes from …".
  The new label is `draftFoundRecord`. An app's own `draftFound`, given without
  it, is still used on a record's page.
- A list that opens a row on a page of its own keeps its place in that page's
  `history.state`, under `fieldia:lists`, merged beside what the app or its
  router keeps there (written in place, never a new entry). Back, a reload or a
  router's popstate opens the list there, asking the source for as many rows
  as it had loaded.
- `onOpenRecord` is called with the row's name as its second argument.
- In an app bundled as modules, a part that could not come is offered again
  where the browser's error names its module (Chromium, Firefox): Retry, or the
  signature's Try again ("Not signed yet: the signing could not load. Try
  again"), asks for its file at `?fd-again=1` (`2`, …). Before, the words asked
  for a reload. WebKit names no module, so it still asks for a reload.
- With `drafts` off, a page whose guarding part could not come keeps what was
  typed in the tab's sessionStorage (`fieldia:draft:…`) until it is sent, so
  the reload its words ask for brings it back. It is kept by drafts' own rule:
  never a password box's value or a field marked `secret`, and let go once the
  answers are sent.
- A code check's missing part is said under each field that asks for a code
  (`.fd-error.fd-join-missing`) as soon as the part could not come, not first
  on Send.
- A search that fails with its words in a toast closes its list
  (`aria-expanded="false"`).
- Fieldia sets three attributes of its own: `data-fd-open` on a field whose
  list is open during a wait, `data-lock-shown` on a head's lock, and
  `data-fd-printing` on a table of lines while it prints.
- An onchange's answer that returns a line equal to the one held keeps the
  held line object.

**Size:** `fieldia.js` 576.6 KB, 192.9 gzipped (0.35.0: 568.4, 189.8): a key in
a long table +1.44 KB gzipped, a guarding part's Retry and the typing kept
+1.23, a save's, a draft's and an open's words +0.48. Of the parts, gzipped:

- list 50.50 (49.88): Back finds a list where it was left;
- text 24.64 (24.58): a refused link's address said why; files 18.90 (18.82):
  a file named as a picture that is none said so; relations 8.01 (7.99): a
  failed search closes its empty list;
- the language add-ons 0.04–0.07 more each: a record's draft and a file that
  is no picture in their words;
- `@fieldia/map` with a list's map and a form's 13,630 bytes (13,584), a list's
  map 22,342 (22,174): one block the size of the map while its code comes, a
  placeless row's note lit.

## 0.35.0 — 2026-10-25

**Fast at scale: long lists, big forms, tables of lines, the Gantt, smaller
npm apps — and the tick-box tokens hosts asked for.** A key typed works out
only what reads the field: on a page of 500 fields it brings 16 of its parts up
to date, not every one, in 3.9–6.9 ms on a desktop. Past 100 rows a list keeps
only the rows near the view in the page, so 5,000 rows hold some 1,600 DOM
nodes and a tick, a Tab or a fold costs what it did at 100. A table of 200
lines draws again only the lines a change touches; a Gantt of 500 tasks moves a
bar and changes its scale in place; the designer copies only what an edit
writes. An app built from the npm packages fetches a fifth less before its
first paint — every language but the page's, zod and the map's code come as
they are needed. Each of these is held to the plain way it replaces by a test
that compares the two on generated pages, and CI's new perf job counts the work
(parts brought up to date, rows and elements in the page, cells written,
bytes) against budgets that fail the build. The page format stays 0.13: no
merge changed its shape.

**New:**

- **Tick-box tokens for a design system's box:** the tick, the dot and the dash
  scale with `--fd-tick-size` (the same as before at the default 18 px), a new
  `--fd-tick-radius` sets the box's corner, and the press target stays 24 px at
  the least at any size. The viewer's `tokens` takes `tick-size`, `tick-line`,
  `tick-edge` and `tick-radius`; the site documents all four with a "match your
  design system's box" example (14 px, a 1.5 px line, an ink edge, 3 px corners).
- `@fieldia/core/schema` — `validatePage`, `PageSchema`, `FieldSchema` — in a
  file of its own with zod inside, for where pages are made.
- `workCounts`, which counts the conditions read, values worked out, fields
  checked and parts brought up to date (also on the one-tag `Fieldia` global);
  `recomputeInFull(true)`, which makes the forms and viewers made after it work
  every change out in full, as before 0.35 — for tests to compare against;
  `form.nodeReads(id)`, the fields a part's state reads; `Widget.reads`, the
  values a widget draws from besides its own (text, number and money, date,
  tick box, select, radios and checkboxes without Other, rating and scale
  declare it).
- `wordsVersion()` and `onWordsCame(listener)` in `@fieldia/core`: words that
  come in a chunk of their own are an input of what was worked out or drawn in
  them.
- In a list long enough to keep only the rows near the view, Ctrl/⌘+F goes to
  the list's own search and says why — the browser's find sees only the rows in
  the page; pressed again, it opens the browser's find.
- CI's perf job — an app's first load from the npm packages
  (`tools/npm-first-load.mjs`), then the counts at scale, the leak gate, a long
  list's layouts and the timings, on a desktop (`perf`) and a mid-range phone
  (`perf-phone`: 412 px, CPU 4× slower), one worker.

**Fixes:**

- **A key works out only what reads it.** Conditions are read again only once a
  value they read changed, values are worked out again and fields checked only
  where what they read changed, and a part is brought up to date only once what
  it shows changed. On the 500-field example page a key brings 16 parts up to
  date and reads no condition again (0.34: 533 parts, every condition): on a
  desktop 11.5 → 6.9 ms, on a mid-range phone 49 → 36 ms; on a 500-field form
  7.6 → 3.9 ms and 34 → 17 ms.
- **Long lists keep only the rows near the view in the page** — endless and
  editable lists, rows' details, related lists, trees drawn in one page — once
  more than 100 rows are shown, the rest a gap as tall as them. Screen readers
  hear every row counted (`aria-rowcount`, `aria-rowindex`); ↓ past the last
  drawn row draws the next; the focus and a row being edited stay; "Select all",
  a paste and Undo reach rows not drawn; an open row's details come back under
  it; reading stays in place as rows come and go above (WebKit has no scroll
  anchoring: the list keeps it); paper prints every loaded row. At 5,000 rows an
  endless list holds 2,349 nodes, not 130,343; a phone's worst frame scrolling
  1.28 → 0.11 s; a tick at 5,000 rows 117 → 4.5 ms on a desktop, a fold of a
  10,000-row tree 1,260 → 16 ms. Cards and the gallery draw every card, as
  before.
- **A table of lines draws again only the lines whose inputs changed**,
  numbered once a change: at 200 lines a key in the header draws no cell (1,000
  before), a key in a line its own (31.9 → 8.1 ms and 37 → 15 ms on a desktop).
  A line whose money takes its currency from the record (`parent.`), whose rules
  read the record, or whose column is one of the app's own widgets is drawn
  again as the record changes.
- **Smaller npm apps.** In the packages, every language but the page's — Arabic,
  German and French too now —, the designer's words, zod and `@fieldia/map`'s
  own code each come in chunks of their own, and the stylesheets are minified as
  the one-tag script's are. With the page, a record form's app is 298.2 → 237.5
  KB gzipped (−20%), a list's 297.5 → 236.7, the screen designer's 832.2 →
  583.2 (−30%); to usable, 374.0 → 310.3, 367.6 → 305.2 and 942.5 → 796.0. A
  page's first paint is in its own language, never English and then swapped.
- **The designer at 500 fields** copies only what an edit writes, never the page
  whole, and makes no whole-page form per key: a label key 32.7 → 15.7 ms on a
  desktop, about 149 → 82 ms on a phone. It opens on the 500-field page sooner
  too — from the navigation to its first paint 967 → 821 ms on a desktop and
  3.5 → 2.7 s on a phone, the format's schemas fetched beside it as it opens.
- **The Gantt moves a bar and changes its scale in place**, keeping every row,
  name and bar: at 500 tasks a drop puts 31 elements in the page (8,799 before)
  and lays out once (17 before), 198 → 30 ms on a desktop; a change of scale 91
  elements (4,101), 89 → 53 ms.
- **Pointing at a row lights its pin on the map** moving only the pins whose
  light changes: 2 a hover, whatever the pins (458 at 500 pins before).
- **Words that come late are said in their language everywhere.** A language's
  words that came after a page drew without them (their chunk past its 30 s
  wait) are an input of every problem kept and every part left alone: the
  form's problems and warnings are said again in them, every part is drawn
  again, and what a wait said to a screen reader meanwhile is said in them too.
- The designer: a label typed back to what was published makes the draft the
  version published again (the page's whole check wrote a field's keys in its
  own order, and "unpublished" stayed).
- A calendar visit's "⋯" is a button beside the visit's own, not inside it
  (axe: nested interactive), by pointer and by its M key alike.
- A dialog in a language fetched later is named in that language from the
  start; a file being imported reads yes and no in all 8 languages.
- A ring or words over a place taller than the window stay in the middle of
  what of it is in view as the place takes its size under them: a form whose
  parts came after its wait began left its ring in the middle of the whole pane
  (WebKit, one load in two once the npm chunks split further).
- A Gantt bar's busy mark goes once its save answers (0.34 left it).
- Page checks read each layout and each field once.
- The site said Fieldia speaks 4 languages; it speaks 8.

**Upgrading** — grouped by who it touches:

- *Page authors:* nothing changes. No setting was added, and pages stay in
  format 0.13.
- *App code:*
  - In the npm packages Arabic, German and French come in chunks of their own,
    as Turkish, Persian, Urdu and Spanish did: `VIEWER_LABELS`, `WIDGET_LABELS`,
    `MESSAGES` and the other tables hold English until a language is asked for.
    `mountViewer`, a dialog, `mountChatter`, a map's parts and the address
    suggestions wait for their words; anything drawn without waiting shows
    English until `await wordsReady('ar')` — `createWidget`, a headless
    `createForm` or `checkSubmission` on a server, and `createDesigner({ locale:
    'ar' })` (use `designerWordsReady`, or `createDesigner.open`). What a form
    shows — its problems and warnings — is said again in a language's words as
    they come.
  - The designer holds edits to `checkPage` until its schema chunk arrives, and
    `publish()` waits for it. Importing `validatePage` from `@fieldia/core`
    beside the designer carries the schemas twice: take it from
    `@fieldia/core/schema`.
  - A map's field is drawn once its part has come; a list's or a form's map
    holds its place while its code comes; `mountListMap` returns at once and
    draws when its code arrives.
  - `form.node(id)` returns the same object while the part is unchanged: don't
    mutate it. The `Form` interface gains `nodeReads`: a fake adds it. A custom
    widget that spreads a built-in copies its `reads`: set `reads: undefined`
    where it draws from more.
  - Designer edits run on a draft: what an edit reads are drafts until it ends,
    and one kept past it throws when read. After Publish, `versions[].page` is
    the page object itself.
  - In a list past 100 rows shown, rows out of view are not in the DOM: code
    reading `.fd-list-row` sees those near the view. Ctrl/⌘+F there is the
    list's (its default prevented); Tab moves through the rows in the page, the
    arrows through every row; a tree drawn in one page has its folded rows
    absent rather than hidden.
  - A table of lines' cell drawn by one of the app's own widgets is still
    updated at every change of the record; a built-in widget in a cell has
    `update` called only when its inputs change.
- *Tests and CSS:*
  - Parts are drawn again only when what they show changed: DOM written behind
    the viewer's back is no longer reset by an unrelated change.
  - Wait for a long list by its `aria-rowcount` (rows + 1 + totals rows), then
    scroll to a row or search for it. Windowed tables carry `aria-rowcount` and
    `aria-rowindex`, gap rows `tr.fd-list-gap` (`aria-hidden`, `data-aside`;
    `tbody tr:last-child` may be one), and `p.fd-list-find[role=status]` after
    Ctrl/⌘+F; a row's `aria-selected` is set as it is drawn; `beforeprint` draws
    every loaded row and `afterprint` goes back to the window.
  - Gantt rows, bars and names are the same elements across moves and changes
    of scale; arrows follow the bars' order, and bars tied on start, end and
    title are ordered by id. The map sets a marker's z-index offset only when
    its light changes. A designer canvas card's widget is not drawn again for a
    label or help.
  - A movable calendar visit's "⋯" is the block's next sibling, or sits with it
    inside `.fd-cal-visit` in day and all-day cells: `.fd-cal-day >
    .fd-cal-event` selectors need changing. A list's or a form's map is wrapped
    in `.fd-map-holder`.
  - The packages ship minified CSS text. `--project=chromium` no longer runs
    the perf, leak or list-contain specs: they run in the `perf` projects.
  - `recomputeInFull(true)` makes a table of lines draw every line at every
    change too.
- *Self-hosters:* the one-tag script's parts and language add-ons are where they
  were; `fieldia.js` is 3.3 KB gzipped larger, the list part 3.9, the lines part
  1.0 (below).

**Size:** `fieldia.js` 568.4 KB, 189.8 gzipped (0.34.1: 560.1, 186.5): 3.3 KB
gzipped, all of it what every page runs. In merge order: perf-bytes 0.14 (the
tick, dot and dash drawn to any size on every page with a radio or a tick box;
a part's own words and a dialog's waited for), perf-lists 0 (its window and its
lines are in their parts), perf-form 2.95 (the quick way every form and viewer
works a key out: the form 2.8 KB minified, the viewer 2.0, values set as
conditions start to hold 1.0, worked-out values 0.7), the merge 0.16 (words
that come late an input of what is kept; the packages' redraw as they come is
left out of this script, whose languages are its add-ons). Over 180 KB, as the
owner accepts up to about 200. Of the parts, gzipped:

- list 49.88 (45.99): the window — a view's height of rows round the view, the
  rest as data — and Ctrl/⌘+F's note; rows 7.35 (7.30);
- lines 16.04 (15.08): a line drawn again only as its inputs change;
- loading 3.06 (2.98): a ring kept centred as its place grows;
- every other part within 0.03; the language add-ons by 0.04–0.06 each (the
  list's note; Arabic 21.54 from 21.49).

From the npm packages, an app's first load (KB gzipped, with the page / to
usable, bundled by esbuild): a record form 298.2 → 237.5 / 374.0 → 310.3; in
Arabic 298.2 → 237.5 / 374.1 → 332.5 (its words' three chunks); a list 297.5 →
236.7 / 367.6 → 305.2; the screen designer 832.2 → 583.2 / 942.5 → 796.0.
`@fieldia/map` with the page: a place and an area 27,389 → 11,931 bytes, every
kind 49,478 → 13,583, a list's map in a page of its own 33,763 → 10,860; its
parts come later (a list's map 22,079 bytes, a form's 19,826, its fields
18,416; Leaflet 46.0 KB as before). `@fieldia/calendar` with the page 849 → 764
bytes, its calendar 19,569 → 17,830; `@fieldia/gantt` with the page 865 → 765,
its timeline 15,834 → 15,320. A server's first paint's styles 29.8 → 16.7 KB.

## 0.34.1 — 2026-10-25

**The owner's walk of 0.33.0: every wait seen where a person looks.** A
business owner walked fieldia.dev's 0.33 demos on a slow network, as a
customer would. What waited out of sight, waited twice or said a failure as
plain words is mended here, each where it began, for every place it could
happen. The page format stays 0.13: nothing a page says changes.

**Fixes:**

- **A wait drawn the first time shows no empty boxes and no words before its
  shapes.** Until its loader is drawn, a form's boxes are out of sight under
  their labels (else all the place holds), and a quick answer is drawn whole. A
  wait drawn from the loading part waits for the part rather than saying
  "Loading…" and then swapping to its skeleton — 0.33's map went grey box,
  "Loading…", skeleton, pins — and says it in words only where the part
  cannot come or the wait turns slow. `loadParts(page)` loads the loading part
  where the viewer would wait for it with the page's parts, and a viewer whose
  parts are in already asks for it as it mounts.
- **A record opened in another's place shows none of the other's related
  rows**: they and their count go at once, a skeleton in their place, until
  the record has come and its own are asked for; a record that could not be
  opened lists none.
- **A list's timeline or calendar whose code is still coming shows its
  skeleton**, never an empty space under the list's search; the timeline's own
  first wait goes on from it.
- **Save stays where it was pressed while it saves, busy** — its ring past the
  wait's delay — Discard stepping aside; 0.33 hid both behind "Saving…". A save
  that failed says so under the buttons, Save and Discard kept together (0.33
  put Save on a line of its own under Discard).
- **A failure said in its place reads as a failure**: the error's colour and a
  mark at its start, light and dark, in every theme; forced colours keep the
  mark. The app's own drawing of it (`error: "custom"`) keeps its own look.
- **A failure said in a toast names what failed**, one of a page's forms among
  others: a list's own sentence ("Could not load the customers. …"), a field's
  label before its search's failure ("Account manager: Couldn't search. …").
- A record that could not be loaded again (a reload, Retry) is said once, in
  its place with its Retry — no toast besides.
- A ring or words over a place taller than the window stand in the middle of
  what of it is in view, never at its foot below the fold.
- A select under a record's skeleton is a shape like the other boxes (WebKit
  drew its own dropdown through it).
- A place's few skeleton bars run from its top, the first as wide as the place
  (0.33 drew two short bars in its middle, the first unseen).
- A link's search that fails says so in its list, as wide as its box, never
  wider.
- "Nothing is called …" said under a link's, a tags' or a path's box goes as
  another record is shown, the record is loaded again or Discarded: it is that
  record's.
- On a page right to left whose words are left in English, a list's "1–24 of 60
  customers" and a box's placeholder read as written — never "of 60 customers
  24–1" or "…Search".
- A phone's country sheet is headed "Country"; it is still named for its field
  ("Country of Phone").
- The designer's While it waits: the looks' and a failure's buttons show
  Fieldia's default as chosen where the page says none, and its times are
  asked in seconds.

Behaviour you may notice in an app's own tests:

- Save stays visible, and busy, while a record saves, rather than hiding as the
  save starts; it hides once the record is saved, as before.
- A list's failure said in a toast (and an app's own drawing of it) names the
  list — "Could not load the customers. …" in place of "Couldn't load. …" — and
  a field's search failure in a toast starts with its label.
- `loadParts(page)` also fetches the loading part (`fieldia.loading.js`, the
  loading chunk) where the page waits for its data.
- A reload that fails raises no toast: its failure is said in its place.
- The designer asks a wait's times in seconds (0.15, not 150); the page still
  keeps them in milliseconds.

**Size:** `fieldia.js` 560.1 KB, 186.5 gzipped (0.34.0: 558.3, 186.1): 0.5 KB
gzipped for what every page that waits needs before any part can come — a
first wait's boxes out of sight and its drawing waiting for the loading part,
a failure's colour and mark, a toast naming what failed, Save busy in place
and its failure under it, placeholders in their own direction, the loading
part asked for as a page mounts, a reload's failure said once. Of the parts,
gzipped:

- loading 2.98 (2.75): a ring centred in what is in view, a place's bars from
  its top;
- list 45.99 (45.83): no other record's related rows while one opens, a list
  named in its toast, its range read in its own direction;
- choice 4.75 (4.71), path 8.23 (8.20), relations 7.99 (7.96): what is said
  under a box goes with its record; phone 19.25 (19.22): the sheet's heading;
- `@fieldia/gantt` with the page 865 bytes (816), its timeline 15,834
  (15,799); `@fieldia/calendar` with the page 849 (793), the calendar 19,569
  (19,554): their place's skeleton while their code comes.

## 0.34.0 — 2026-10-25

**Forms you can trust: safe links and files, data never lost or sent twice,
faster lists and Gantt, verifiable releases.** Every address Fieldia puts on a
link, a picture, a player or a frame goes through one check, and a file is shown
in place only in a format Fieldia lists, from bytes that match it. What a person
types is never lost — not while a record loads, not as a form is taken away —
and never sent twice: each send carries one key from its first try, a part that
guards a send and cannot come refuses it in words, every request has a
deadline, and drafts and kept sends are the person's own. Lists, cells, the
Gantt and the designer do less work for the same result, and a page's parts
come beside `fieldia.js`. Each part is checked against the hash it was built
with, and every script tag in the docs names a version and its hash. The page
format is 0.13 — a field's `secret` is new — and a page of 0.1 to 0.12 is read
as it is.

**Security:**

- **One check for every address (`safeUrl`)**: a link, a picture, a player, a
  frame, a page opened — read with the URL parser as the browser reads it, its
  scheme one the place allows. `openUrl` and a map card can no longer run
  `javascript:`, however it is written; an `openUrl` that gives another address
  opens nothing and says why, and the page checks refuse one written in the
  page.
- **Files shown in place by their format**: pdf, pictures, films and sounds
  Fieldia lists, their bytes checked against the format and shown from a blob
  typed from it, never from the type a file says. An uploader's HTML never runs
  in the app's site; an SVG is drawn as a picture alone, never framed or opened
  in a tab; a download is plain bytes.
- **CSV exports keep a formula's start as words** (`'` before `=`, `+`, `-`,
  `@`, a tab or a return), and import reads them back.
- **Nothing takes seconds on an answer**: a page's pattern that could is
  refused by `checkPage` and `validatePage`, an answer over 1,000 characters
  fails its pattern untried, long typed text is never read as a date at length,
  worked-out values are held to their most, and imports open at most 100 MB a
  file, 200 MB in all, a cell of 32,767 characters.
- A framed form tells only the sites its `allowed-origins` names (and its own);
  AI help never writes a field the page does not draw; the embed widget runs a
  page of the app's own site with no origin; expressions read own properties
  alone, and `constructor`, `__proto__` and `prototype` are refused as field
  names.
- **Each part is checked before it runs**: `fieldia.js` carries the sha256 of
  every part it was built with and asks for a part with `integrity` and
  `crossorigin="anonymous"`. A part that is not that file never runs: what
  needed it says it could not be loaded, and where it guards a send, the send is
  refused. One value per part everywhere — the built-in hash,
  `Fieldia.partTags(page)` and the docs' tags all name the file's sha256.
- **Script tags in the docs name a version and carry its hash**, written by
  `tools/script-tags.mjs`, never by hand; source maps carry relative paths only;
  the release check audits what an app installs (`npm audit --omit=dev`, high
  and critical refused); the workflows' actions are pinned by commit, with
  Dependabot and a `SECURITY.md`; publishing from CI by npm's trusted
  publishing, with provenance, is prepared — off until the owner switches it on
  (`TRUSTED_PUBLISHING`, the last step of docs/maintainers/publishing.md).
- **Drafts, kept sends and preferences are a person's own**: keyed by the
  signed-in person (or the tab), a record's draft holding only the changes; a
  password box's value and a field marked `secret` are never kept;
  `drafts.clear()` and `outbox.clear()` let a person's go at sign-out.
- **`checkSubmission(page, values, context)`** runs a page's checks again where
  its answers arrive — required, patterns, sizes, options, a code proved, a
  payment worked out on the server and paid in full. A page its own checks
  refuse takes no answers there either, its patterns checked by the browser's
  own function. The payment docs work the amount out on the server, and page
  checks warn where a field filled from the link is the amount.

**Fixes:**

- **A part that guards a send fails closed** — a payment, a code check, a time
  limit's clock, a link's fields, approvals, options by condition, languages,
  limits: the send waits, asks for it once more, then says "The payment step
  could not load, so nothing was sent. Try again." with Retry, the typing kept.
- **One load boundary**: a record's values are read as their fields hold them
  (decimals as text, Odoo's `false`, link tuples); one that cannot be read is
  said under its field and never sent back over the source's. Until a record's
  first load ends well its fields are inert, what is typed meanwhile is kept
  over it, and a save of it is refused; `save()` never throws.
- **A record that could not be loaded is said once, in its place**: at the top
  of the form, in its own words ("This customer could not be loaded: …"), with
  one Retry, which loads it. It is the record's wait's failure (0.33's), reading
  core's `state.loadProblem`; no banner over the page besides.
- **A record opened in another's place never shows the other's values** (the
  owner's walk of 0.33.0): while it loads, its own boxes stand as its skeleton,
  holding none of the last record's values and taking no typing; one that could
  not be opened is named — "Couldn't open customer 32: …" — with Retry, which
  opens it. 0.33 left the previous customer on screen, editable, under a line
  that named none.
- **Next rows that could not come stay said** (the same walk): "Couldn't load.
  … Retry" where they would have come, and the list's end in sight asks nothing
  by itself until the person presses Retry or Show more; 0.33 said it for one
  frame, then asked again. A tree's next children and a group's Show more ask
  only when pressed, as before.
- **One send discipline**: one key from a send's first try, reused by Retry and
  by a kept copy; a second save with nothing changed is the first; a response's
  same answers never go twice; a new record answered with no id is refused in
  words; kept saves go before a live one; claims are renewed while a send goes;
  without IndexedDB the outbox says so.
- **Nothing waits for ever**: every request Fieldia makes of its source — a
  record's load, a list's rows and groups, a save, a send, an onchange, a
  search, a list's options — ends at its deadline (`timeout`, 30 s unless the
  app says) as the network's problem, with Retry. The deadline ends the request;
  a wait's `loading.timeout` ends its loader; where both are set the sooner ends
  the wait, said once, never a loader left running. A Discard wins over a stuck
  save; a part or a language's words that stall settle after 30 s.
- **A form taken away keeps its draft**: typed a moment before the viewer is
  destroyed, or before a dialog closes with it, what was not kept yet is kept,
  as the draft's rules say.
- **Faster:** every `Intl` formatter is made once (`intlFormat`), and a date's
  calendar builds its names when it first opens (an editable list of 1,000 rows
  first drawn 3.2 → 2.3 s on a phone, a Gantt of 500 tasks 2.5 → 1.1 s); a key
  in a list's cell lays out its box alone (341 → 191 ms on a phone); a list
  asks for its first page beside its part (usable 21% sooner on a phone over
  4G); part tags written into a page are never fetched twice; the designer asks
  for its canvas's parts at once; the tab strip, Tab between cells, a Gantt drop
  and a designer pick force no extra layouts, and a Gantt drop is drawn once.
- **Endless card lists skip no card unseen**: `content-visibility` made them
  scroll far worse on a phone (the median frame 17 → 167 ms at 3,000 cards, 17
  → 33 as they grow), as plain card lists did; they now scroll as those do.
- **`destroy()` takes away what the viewer opened** — its dialogs, panels,
  pages in its place, Search more… lists, as not saved — and the outbox shares
  one IndexedDB connection; the designer's guides, Undo (the last 200 edits),
  menus and its "While it waits" previews let go with it (a designer opened
  again kept every preview before it).
- `partFiles(page)` names `fieldia.loading.js` too where the viewer asks for it
  with the page's parts, so a page's written tags cover them all.
- `release.mjs publish` refuses a tree with changes, a HEAD not on
  `origin/main`, a HEAD with no tag of its version, and a patch whose section has
  an Upgrading part, each in words; it prints the tag's push and the GitHub
  release's command only once every package is on npm. The console's hint for a
  missing language names the running version.
- A date and time box on another zone's clock names the zone as it is now by
  the form's clock (`now`), as its today is — not the computer's (a test pinned
  to 16 October said CET on the day the clocks went back).
- An embed field asks its frame only for the sandbox tokens the browser knows
  (WebKit has no `allow-presentation`, and said so in the console for every
  frame).
- The demos: a record page opened without `record=` opens its model's first
  sample record, never "Couldn't load"; a demo page shown in an embed field
  draws in its opaque origin.

**New:**

- `@fieldia/core`: `safeUrl` with `LINK_URL`, `PICTURE_URL`, `MEDIA_URL` and
  `DOWNLOAD_URL`; `csvCell` and `csvWords`; `patternRisk`, `rulePattern`,
  `PATTERN_MOST`, `DATE_TEXT_MOST` and `COMPUTED_MOST`; `checkSubmission`;
  `valuesFromSource`; `drafts`, `outbox` and `ownerOf`; `withDeadlines` and
  `SEND_TIMEOUT_MS`; `intlFormat`; a field's `secret`; `FormOptions.timeout`;
  `state.loadProblem`, `state.loaded`, `state.unreadable` and
  `state.outbox.lasting`; requests' `key` and `signal`.
- `@fieldia/viewer`: the viewer's `timeout`; `partFiles(page)` (also from
  `@fieldia/viewer/server`); in the one-tag script `Fieldia.partTags(page)`;
  `<fieldia-form allowed-origins>`; the files part's `fileShown`, `formatOf` and
  `shownFile`, with `FileFormat`, `Shown` and `ShownKind`.
- `@fieldia/widgets`: `Widget.focus(options)` takes FocusOptions.
- The designer: "Never kept in a draft" on a field's Rules tab.
- `docs/maintainers/publishing.md`, `.github/workflows/publish.yml`,
  `SECURITY.md`, `.github/dependabot.yml`.

**Upgrading** — grouped by who it touches:

- *Page authors:*
  - Pages are written in format 0.13 (`FORMAT_VERSION`): 0.13 only added a
    field's `secret`, so a 0.12 page is read as it is; an older Fieldia refuses
    a 0.13 page, saying to update.
  - `openUrl` opens only http, https, mailto, tel or a path of the site.
  - A pattern that could take seconds, and a field named `constructor`,
    `__proto__` or `prototype`, are refused by `checkPage` and `validatePage`;
    an answer over 1,000 characters fails its pattern; worked-out values over
    their most become empty; `name.constructor` reads as nothing.
  - Page checks warn where the payment's amount is a field filled from the link.
- *App code:*
  - A send whose guarding part cannot load is refused, in words.
  - Every request carries a non-enumerable `signal`, and a save or send its
    `key`: dedupe by `key` on the server. Every request — a record's load and a
    list's rows too — ends after 30 s unless `timeout` says otherwise (0 for
    none); 0.33 gave a list's request a signal only where a `timeout` was set.
  - A record that could not be loaded is said at the top of the form in
    `state.loadProblem`'s words ("This … could not be loaded: …", or "Couldn't
    open … 32: …" for one `openRecord` opened in another's place), where 0.33
    said "Couldn't load." before the source's words. `openRecord(id)` empties the
    form's values until the record has loaded, and its first wait is a `first`
    (a skeleton of the form's boxes), no longer a `refresh` over the last
    record. `state.loaded` is false
    until a record's first load ends well, its fields inert; a save of it is
    refused; `loadedRecordOf` throws on a list or `null`; a value that cannot be
    read is left out of a whole-record save.
  - A second `save()` with nothing changed is the first; a response's same
    answers return false — call `form.reset()` for another response; a new
    record answered with no id is refused.
  - Drafts are re-keyed by person: 0.33's drafts are not offered. An anonymous
    person's drafts and kept sends are the tab's; a signed-in person's
    preferences start afresh once.
  - `destroy()` closes the viewer's dialogs, panels and pages in its place as
    not saved, and keeps the draft their typing had not kept yet.
  - A list page whose part has not come asks `source.list` early; where the
    list's own first request differs, a second follows.
  - `fileShown` is the files part's: `(await filesPart.load()).fileShown(doc,
    file)`. Previews show only listed formats whose bytes match; a PDF at the
    app's own address is fetched (a GET with cookies) and checked first.
    Chatter's pictures open the file dialog.
  - A framed form needs `allowed-origins` for another site to hear its events;
    AI proposals for fields not drawn are left out; CSV export adds `'` to
    formula-like words; imports refuse oversized archives and cells; the embed
    widget sandboxes a same-site page fully.
  - `Widget.focus(options?)` takes FocusOptions; the designer's Undo keeps 200
    edits.
  - An app's whole `messages` add `openFailed` (and its English `openFailedNoun`);
    the new words in the seven other languages are unreviewed.
- *Tests and CSS:*
  - The `.fd-load-problem` banner is not drawn: a record's load failure is
    `.fd-loader[data-way="failed"]` at the top of `.fd-content`. Fields are
    inert while a record first loads.
  - Requests compared with `toEqual` include `key`; a double Ctrl+Enter saves
    once.
  - Preview fixtures need real file headers; `.fd-attachment-image` is a
    button.
  - The tab strip's `data-more` and its reveal land a frame later; a text input
    in an open list cell gets `contain: size layout; vertical-align: top`; the
    Gantt's `--fd-gantt-axis` is set on its edge signs; endless card rows have
    no `content-visibility`.
  - The console's hint for a missing language names the running version.
- *Self-hosters:*
  - Parts are fetched with `crossorigin="anonymous"` and their `integrity`:
    served from another origin than the page's, they need
    `Access-Control-Allow-Origin`; a part changed after it was built (by a
    proxy, a minifier, a patch) is refused; only parts of the same build as
    `fieldia.js` load.
  - Part tags written into a page — `<script async>` or `<link rel="preload"
    as="script">` — carry exactly what `Fieldia.partTags(page)` gives, and come
    from the folder `fieldia.js` comes from; `partFiles(page)` may now name
    `fieldia.loading.js`.
  - The docs' script tags carry sha256 hashes (0.32's carried sha384): take
    every tag from this release's README.
  - A PDF preview at your own address needs `connect-src 'self'`; the embed
    script frames only http(s) addresses.
  - A page of your own site shown in an embed field runs in an opaque origin
    (framed without `allow-same-origin`), so its scripts are fetched from origin
    `null` and need `Access-Control-Allow-Origin` from your server — as GitHub
    Pages and most CDNs send. Its own code must not assume it can read
    `localStorage` or `sessionStorage` there.
  - Maintainers: a release is tagged locally first, published, then its tag is
    pushed (docs/maintainers/publishing.md). A patch holds fixes alone, with no
    Upgrading part; `release.mjs` refuses one.

**Size:** `fieldia.js` 558.1 KB, 186.0 gzipped (0.33.0: 535.1, 175.9): 10.1
KB gzipped, every part of it what every page needs before any part can come.
In merge order: harden-release 2.8 (the 53 parts' hashes 2.1 of it — a hash
does not compress — the check and its words 0.2), harden-edges 2.1 (patterns
bounded 1.0, `safeUrl` 0.4, CSV cells 0.2), harden-data 4.1 (the record reader
`valuesFromSource` 1.0, the deadline 0.8, drafts kept by person 0.5, the load
boundary and the send discipline in the form, the guards' words), harden-perf
0.9 (the early list request 0.5, closing what a viewer opened, adopting a part's
written tag), the merge's own jobs 0.2 (one deadline for every request, a
record's failure said once and named, next rows' failure left said, a draft
kept as a form is taken away). Over 180 KB, as the owner accepts up to about
200. Of the parts, gzipped:

- files 18.82 (17.33): the formats shown in place and their bytes checked;
- outbox 4.67 (3.98): kept saves first, claims renewed, the person's own, one
  connection;
- import 15.25 (14.89): archives and cells held to their most, the workbook
  read once through;
- editable 12.63 (12.32), date 9.27 (9.18): one cell laid out alone, a
  calendar's names when it opens, a zone named by the form's clock;
- list 45.82 (45.61), memory 9.11 (9.03), pay 3.45 (3.29), element 2.59
  (2.38): addresses through `safeUrl`, the memory source's keys, the payment's
  warning, a framed form's origins;
- cards 3.77 (3.79): no card skipped unseen; every other part within 0.05;
- the language add-ons by 0.5–0.7 each (the lanes' words; Arabic 21.49 from
  20.76); `fieldia-embed.js` 0.91 (0.88);
- `@fieldia/map` with a list's map 49,478 bytes (49,375), in a page of its own
  33,763 (33,663); `@fieldia/gantt`'s timeline 15,799 (15,611).

## 0.33.0 — 2026-10-24

**Loading, as you choose it: every control waits for its answer the same way —
a record, a list, a map, a related list, a link's search, a button — and how it
looks while it waits is the app's, the page's or the part's to say.** Drawn the
first time, a skeleton shaped like what comes; asked again, what is shown stays
under a thin bar; the next rows, "Loading more…" where they come; a search,
"Searching…" in its list; a save, the button busy. A quick answer shows nothing
at all, a loader that shows never flickers off, and a failure says why in its
place, with Retry. The page format is 0.12 — `loading` is a new setting — and a
page of 0.1 to 0.11 is read as it is.

**New:**

- **One loading model for every control**, by moment, each with its default
  and its other ways:
  - `first` — a form's record, a list, its cards, a map, a related list, a saved
    form placed, what a list's row opens to, a form's limits being counted:
    `skeleton` (the list's rows in its own columns, cards on a phone, the form's
    boxes under their labels, the page's layout while its parts come), or
    `spinner`, `progress`, `text`, `none`, `custom`;
  - `refresh` — a list searched, filtered, sorted or paged (a related list's
    pager, a calendar's next week or month), a record reloaded: `keep` (what is
    shown stays, a thin bar over it), or `dim`, `skeleton`, `spinner`, `none`,
    `custom`;
  - `more` — rows put under those shown (endless scroll, Show more, a tree's
    children): `row` ("Loading more…"), or `spinner`, `skeleton`, `none`,
    `custom`;
  - `search` — a link's suggestions, choices from the app's lists, a filter's
    values, a menu's items the app gives: `inline` ("Searching…"), or `spinner`,
    `none`, `custom`;
  - `action` — a save, a send, a button's steps: `button` (the pressed button
    busy), or `bar`, `overlay`, `none`, `custom`.
- **Set where it belongs**, the most specific winning setting by setting: the
  viewer's `loading` option (the app's), the page's `loading`, a list's, a
  related list's or a map's `loading`, a field's `options.loading` — in the
  types, the checks, the JSON Schema and the designer.
- **Looks:** a skeleton's `shimmer` (default), `pulse` or `static`; a spinner's
  `ring` (default) or `dots`; a progress bar along the `top` (default) or
  `inline`. **Timing:** `delay` (150 ms: a quick answer never flashes a loader),
  `minShown` (300 ms), `slowAfter` (5 s, "Still loading…" said once),
  `timeout` (none unless set: the wait ends as failed and the request is told
  to stop).
- **Failures:** `error: "inline"` (default) says it in place — "Could not load
  the customers. The archive is offline. Retry", the source's own words after
  Fieldia's — `toast` keeps what is shown and says it in a toast with Retry,
  `custom` is the app's to draw. Retry asks the same thing again. Never an empty
  place.
- **`loading.custom(drawing)`** draws a moment set to `custom` the app's own
  way: `{ moment, part, container, signal, slow, failed, error, retry }`, and it
  may hand back its own clean-up; Fieldia keeps the time, `aria-busy`, what is
  said and the clean-up.
- **Events** `loadingstart` and `loadingend` (`{ moment, part, duration,
  failed }`) on the viewer's handle, for an app's own indicator; React's
  `onLoadingStart`/`onLoadingEnd`, Vue's `loading` prop and `loadingstart`/
  `loadingend`, Angular's `loading` input and `loadingStart`/`loadingEnd`.
- **Every theme's tokens**, light and dark: `--fd-skeleton`,
  `--fd-skeleton-shine`, `--fd-shimmer`, `--fd-spinner`, `--fd-bar`.
- **Always, whatever the way:** `aria-busy` on what waits and one polite
  announcement (never one per row); reduced motion stills every shimmer, ring
  and bar; forced colours draw them in the system's colours; right to left
  mirrors them; nothing shows on paper.
- **What a person has open stays theirs:** a part asked again with a popup open
  in it (a date's calendar, a box's list, a menu) keeps what is shown under a
  bar, whatever its way; a popup opened while a part waits is over the wait and
  takes its presses.
- **The designer's Look tab: "While it waits"**, each moment's way, the looks,
  the times and a failure's way, with a live preview of each — no JSON needed.
- **A new demo, "Loading, as you like it":** a wholesaler's customers beside a
  customer, on a network as slow as you like, with "Fail the next answer" and a
  panel that changes each moment's way live — and the same customer under two
  themes.
- From `@fieldia/widgets`: `startLoading`, `loadingSettings`, `loadingOver`,
  `loadingWay`, `asksLoadingPart`, `letFailureGo` and `loadingPart`, with their
  types; from `@fieldia/core`: `LOADING_MOMENTS`, `LOADING_TECHNIQUES`,
  `LOADING_VARIANTS`, `LOADING_ERRORS`, `LOADING_DEFAULTS` and
  `PageLoadingSchema`.

**Fixes:**

- **Every "Loading…" Fieldia drew its own way now waits the one way:** what a
  list's row opens to (its failure now says the source's words, as a list's
  does), a menu's items from the app (`menuFrom`: no flash on a quick answer), a
  form's limits while they are counted, and a list whose part could not come at
  first and is asked for again.
- The designer's new settings are named in Turkish, Persian, Urdu and Spanish
  too, as the panel's search finds them.

**Upgrading** — what an app that uses none of the new things sees change:

- A record, list, related list, map or saved form shows a skeleton the first
  time it loads, where it said "Loading…": set `first: "text"` to keep the old
  words. The status line no longer says "Loading…".
- A list asked again keeps its rows under a thin bar, where it dimmed them
  through `aria-busy`: set `refresh: "dim"` to keep the old look.
- A list that fails to load, and what a list's row opens to, add the source's
  own words before Retry.
- A button's busy ring, and "Loading choices…", show only after 150 ms.
- An endless list's failure is said in place, under its rows, not in a toast.
- A menu's items from the app and a form's limits being counted wait after the
  delay, as the page's `search` and `first` ways say: the `.fd-menu-waiting` and
  `.fd-list-waiting` elements are gone, and what a list's row opens to is busy on
  its box (`.fd-list-detail-box`), not on its table.
- A calendar's next week or month and a related list's next page are a
  `refresh` (what is shown kept), never `more`, which is only for rows put under
  those shown.
- Pages that wait for parts also fetch `fieldia.loading.js` (2.7 KB gzipped):
  an app that serves `fieldia.js` itself serves it beside the other parts.
- `ListRequest.signal` is given where a `timeout` is set; a source that honours
  it stops sooner, one that ignores it loses nothing.
- Pages are written in format 0.12 (`FORMAT_VERSION`). 0.12 only added, so a
  0.11 page is read as it is; an older Fieldia refuses a 0.12 page, saying to
  update.
- An app that passes whole `labels` or designer words adds the new keys:
  widgets `loadingMore`, `searching`, `stillLoading`, `cantLoad`, `cantSearch`,
  `tookTooLong`, `loadRetry`; designer `loadingLook`. The new words in Arabic,
  German, French, Turkish, Persian, Urdu and Spanish are unreviewed.

**Size:** `fieldia.js` 535.1 KB, 175.9 gzipped (0.32.0: 525.2, 172.1): 3.86 KB
gzipped for what every page that waits needs — its record, a list, a search, a
button — before any part can come: the timing machine (about 2.4: the delay,
the minimum, "Still loading…", the timeout, `aria-busy` and what is said, a
failure and Retry, the events), the viewer's waiting (0.8), the words and looks
drawn before the loading part comes (0.5), the app's own drawing kept here so it
never waits for a part (0.1), and a popup kept clear of a wait (0.1). No part's
code is in it. Of the parts, gzipped:

- loading 2.75 KB (new): the skeletons, the bars, the spinners, the overlay and
  their tokens, asked for alongside a page's parts where it waits for any, and
  never by a page of plain parts whose source answers quickly;
- list 45.61 (45.15), filters 7.86 (7.78), rows 7.30 (7.11), cards 3.79 (3.71):
  a list's records, next rows, a filter's values and what a row opens to waiting
  the one way, its skeleton rows in its own columns or as cards;
- relations 7.95 (7.73): a link's "Searching…" and its failure with Retry;
- themes 3.93 (3.64): every theme's skeleton, shimmer, spinner and bar, light
  and dark;
- limits 4.75 (4.69), head 12.90 (12.88): a form's limits counted and a menu's
  items from the app waiting the one way;
- the language add-ons by 0.06–0.09 each (the seven new words; Arabic 128.2,
  20.76 from 127.5, 20.67);
- `@fieldia/map` with a list's map 48.2 (47.9), in a page of its own 32.9
  (32.6): a map's skeleton block, its places asked again under a bar, a failure
  with Retry; `@fieldia/gantt`'s timeline 15.24 (15.16), the same for its bars.

## 0.32.0 — 2026-10-24

**What the owner saw on the demos, mended: radios and tick boxes that looked like
the browser's, a phone's country found only by scrolling a list of some 240, a
question the survey designer seemed unable to delete, and the screen designer's
bar over a section's title.** Each is fixed where it began, for every place it
could happen. The page format is 0.11 — a phone's country list is a new setting
— and a page of 0.1 to 0.10 is read as it is.

**Fixes:**

- **Radios and tick boxes are Fieldia's own**, in every look and theme: a
  field's tick box, a group's options and its "Other", a survey's matrix, a
  table's tick cells, a list's rows, a dialog's, the designers' settings. Each is
  18 px with a 24 px press target, the theme's accent when chosen (a dash for
  "some"), a focus ring, and grey when it cannot be changed. Their words read in
  the body's colour — the quiet look's tick box too, its lines light. On paper a
  chosen one prints as chosen; in Windows High Contrast the system's own control
  shows. The native input is kept underneath, for forms, keys and screen readers.
- **A phone's country is found by typing** — its name in the page's language or
  in English, its code ("ae") or its dialling code ("+971", "20", "0020"), the
  best first — in place of the browser's list of every country. Each row has its
  flag and code; the page's country and the reader's region come first. It works
  by the keys (typing on the flag opens it, the arrows, Enter, Escape), opens as
  a sheet from the foot of a phone's screen — in the page's scheme, dark on a dark
  page — and reads right to left. On by default (`countries`, below).
- **A phone number is the record's as it is typed, once it reads**, as a text's
  and an amount's are: Save shows while the person is still in the box (it
  showed only once the box was left). A part of a number waits for the box to be
  left, which says why it does not read; the field keeps what it held.
- **Delete in the designers is easy to find, and asks nothing.** A picked
  question's bin says "Delete question" (the bin alone on a phone, still named for
  screen readers); a question not picked shows a ⋮ on hover and focus with
  Duplicate, Delete question, Move up and Move down; a picked page's bin says
  "Delete page". Each delete — by a bin, a panel, the Delete key, a header part, a
  list's column or action — says what went in a toast with Undo ("Question
  deleted · Undo"), which brings it back, picked.
- **The bar of the part picked sits beside it.** In the screen designer, just
  above the part (lined up with its end edge, its start edge right to left), or
  below it with room made where above would cover a group's name or another
  part's words — never over them. Placed again as the window is resized or zoomed
  and as the part changes size. One rule for a header part's bar and a list
  column's, whose bar shows again (0.31.1 hid it under its header). Placed only
  when its part or the canvas moved, keeping clear of its neighbours' words alone:
  picking, adding and undoing on a page of 500 fields is as quick as in 0.31.1.
- **A popup opened from a box near the window's foot opens over it**, where there
  is not room under it and more over it, and stays inside the window, scrolling
  within where neither side holds it whole: Fieldia's own list, the country list,
  a date's, a range's, a month's and a year's calendar, a filter's menu, the
  search's suggestions, the colour palette, a state's menu, a payment's details —
  as a link's list already did. On a phone, a sheet as before.
- **The featured demos show the phone's country list where the owner looked**:
  the Customer record's Phone and Every field's Site phone are read the world over
  (their pages now say their phones' country), each with a how-to step to try it.
- **Ctrl+Z is the record's from the first keystroke.** Pressed while the page was
  still fetching its Undo (a slow network, a busy phone), the key went to the
  browser, whose own undo took back the last typing on the page — part of it, in
  the box just left. The keys are now heard as a person first enters the form,
  each decided as it is pressed; the change is taken back as Undo arrives.

**New:**

- `countries: "list" | "native"` on a page's `phone` and on a phone field's
  `options`: Fieldia's own list found by typing (the default), or the browser's
  own list for an app that prefers the system's picker. In the types, the checks,
  the JSON Schema and the designer's field and page panels. The page format grows
  to 0.11.
- `removeWithUndo(designer, id)` from `@fieldia/designer`: the designers' delete
  with its toast and Undo, for an app's own tools.
- The `--fd-tick-size` custom property: a tick box's and a radio's size.
- `openToRoom(popup, box)` and `roomFor(box, height, gap, view)` from
  `@fieldia/widgets`: the one rule for where a popup opened from a box goes.

**Upgrading** — what an app that uses none of the new things sees change:

- Every checkbox and radio inside a form or a Fieldia dialog is drawn by Fieldia,
  an app's own widgets' included: set `appearance: auto` on one to keep the
  browser's. They are 18 px, where they were 16 or 17.
- A phone field's country is a button that opens a list, not a `<select>`: a
  test that picked from the select picks from the list (or the page sets
  `countries: "native"`).
- A phone field writes a number that reads as it is typed, not only as its box
  is left: its `change` event and the page's `on.change` steps for it come then,
  as a text box's do.
- An unpicked survey card is no longer a button itself; its words are
  (`.fd-q-open`).
- The screen designer bar's `fd-bar-below` and `fd-bar-over-name` classes and its
  `--fd-name-room` and `--fd-bar-nudge` properties are gone: the bar takes an
  inline top and left, and a field may take a bottom margin to make room for it.
- Pages are written in format 0.11 (`FORMAT_VERSION`). 0.11 only added, so a 0.10
  page is read as it is; an older Fieldia refuses a 0.11 page, saying to update.
- An app that passes whole `labels` or designer words adds the new keys: widgets
  `phoneFindCountry`, `phoneCountries`, `phoneNoCountryFound`; designer `deleted`,
  `deleteQuestion`, `questionTools`, `phoneCountries`, `phoneCountriesAs`.
- An app that serves `fieldia.js` itself serves the same parts as before; the
  undo part (`fieldia.undo.js`) now holds the record's step, its keys being in
  `fieldia.js`.
- A popup opened over its box carries `data-up`, and one kept shorter than it
  would be `data-cut` with an inline `max-height`: an app's own rules that place
  these popups (`.fd-calendar`, `.fd-filter-menu`, `.fd-search-suggestions`, the
  lists `popup` floats) meet them.

**Release safety** — how this release is made, not what it ships:

- The release's checks — the packs and their peers installed into an empty
  project, node and tsc run over them — run without the npm token or any npm
  setting that carries one, and the install runs no package's install scripts;
  the token reaches `npm publish` alone (`tools/release.mjs`,
  `tools/release-env.mjs`).
- fieldia.dev deploys only a CI run of a push to this repository's main: a fork's
  pull request from a branch it named main no longer passes the site workflow's
  filter. Its build runs with read access alone, Pages and the OIDC token being
  the deploy job's; CI as a whole runs with read access unless a job says more.

**Size:** `fieldia.js` 525.2 KB, 172.1 gzipped (0.31.1: 520.0, 170.9): 0.41 KB
gzipped for the radios and tick boxes, which every form draws — in the main
sheet, as a part's would come after the first paint, showing the browser's grey
circles until it came — 0.45 for the undo keys, heard as a person first enters a
form, so no key waits for a part, and 0.30 for the one rule a popup opened from a
box opens by. Of the parts, gzipped:

- phone 19.2 KB (from 16.2): the country list, its rows drawn the first time it
  opens, and a number taken as it is typed;
- undo 3.0 (3.5): its keys gone to `fieldia.js`;
- quiet 2.06 (2.04): a tick box's words in the body's colour, its lines light;
- survey 12.51 (12.52), duplicates 6.36 (6.41), path 8.21 (8.20): their own tick
  styles given up for the one rule in the main sheet;
- list 45.15 (45.08), filters 7.78 (7.72), date 9.18 (9.13): the same, and their
  popups opened over their box where there is no room under it;
- the language add-ons by 0.02–0.05 each (the phone list's words);
- `@fieldia/map` with a list's map 47.9 (47.8): a card's tick box the size
  every tick box is.

## 0.31.1 — 2026-10-23

**The owner's walk of 0.31, mended.** A business owner walked fieldia.dev's
0.31 demos as a customer would, following each demo's own steps with the
mouse. What it met broken or confusing is fixed here, each where it began, for
every place it could happen. How Arabic writes money, the designer's dark
scheme and the floating + bar passing over text wait for a later release. The
page format stays 0.10: nothing a page says changes.

**Fixes:**

- **A time limit survives a reload, and never resets.** A timed page keeps its
  answers and its clock's start in its draft — in the tab's own store
  (`sessionStorage`) where the app keeps no drafts. A reload goes on with the
  time left; past the end, it says the time is up and sends or locks as the
  page says. Once the answers are sent, a reload starts a new response: one
  response per person is the app's `limits.onePerPerson`, as on any page of
  responses.
- **Nothing moves under the pointer as a box is left.** What a box adds under
  itself as it is left — a proof's Send a code, a phone's Call and WhatsApp, an
  amount's shorthand line, a possible duplicate's note — waits for the press
  to end, so the click lands where it was aimed ("Book a viewing" after the
  mobile). So does a field or a group a condition shows or hides meanwhile: a
  country typed and left shows Region under it only once the press on Tags has
  ended.
- **Masks and one-time code boxes keep what is typed.** After a refused key,
  the keys that follow go in where they fit: "10a2345" shows "1 023 45", saying
  a digit goes there, not "a". A paste with words around the value gives the one
  value in it ("ID 1023456789", "IBAN: SA03 …", a whole SMS into a code's
  boxes); else it is refused, saying why — never dropped silently.
- **A code's value is said as what it is.** A barcode's value is an identifier,
  never grouped: "20261105", not "20,261,105". A QR code shows its payload by
  its summary — a link with parameters by its address, a contact card or a
  network by its name — or nothing, and is named "QR code: Summit desk". On
  paper, no raw "BEGIN:VCARD" over the code.
- **A short group prints whole on one sheet.** A titled group up to half a
  sheet is carried whole to the next sheet where it does not fit, never broken
  over two: the ticket's "Your ticket" kept its badge.
- **Right to left, every value a person typed reads in its own direction** —
  in boxes, a table's line cells, notes and sections, grid cells and line
  cards: an English note on an Arabic page keeps its full stop at its end.
- **Weekday heads in the language's own script.** Where a language's narrow
  letters are Latin (Urdu's "S" and "T"), the whole week takes its short names:
  date and range calendars, booking slots, the timeline's day letters.
- **The Gantt opens on the plan**, from its first task (today in view where it
  fits). Bars past either edge are signed ("‹ 3", "7 ›"); pressing a sign moves
  to them. Ctrl+Z and Ctrl+Shift+Z (or Ctrl+Y) undo and redo its moves, as the
  toast's Undo does.
- **A save starts the record's Undo afresh**: Ctrl+Z right after Save says
  "Nothing to undo since it was saved" instead of bringing the old value back
  as an unsaved change (not on pages that save themselves).
- **A menu over a box gives way.** The search bar's saved-views menu closes as
  its box is pressed or typed in, its suggestions in its place; a filter bar's
  list closes as another part of the bar takes the focus.
- **Changes on the way to approval are kept by who and what.** A record
  changed while it waits for a decision, or after a rejection, has a `changed`
  entry in its approval history — "Omar Said changed it — Amount: E£ 4,850.00
  → E£ 9,999.00" — and a tracked change in its conversation. Contract §20 says
  what Fieldia records and what the app must (record it on its server, return
  it in the history); the memory source does it as an engine would.
- **An expense claim is its employee's alone to change.** In "An expense
  rejected, with why", Omar's manager and Finance read it whole — what he
  changed after the rejection with it — and decide it, told "Only Omar Said,
  whose claim it is, can change it."; a save of theirs is refused.
- **Saving a template under a name already kept asks first**: "Replace “Botox
  package”?", Replace or Cancel (which asks for the name again).
- **Small words:** Edit on a survey's review offers Back to review at once; a
  photo made the cover says "Photo 2 of 5 moved to the cover"; Start from a
  schema with nothing pasted says "Paste a schema or choose a file first."
- **The demos keep what was saved while the tab is open** — records,
  templates, saved views, properties added in place, responses sent,
  conversations, the backlog — so "Start a new course" no longer loses the
  template just saved; Start over clears it all. The in-memory data source and
  chatter number new templates, views, messages, to-dos and followers after
  the ones they were given.
- **A card's sheet on a phone draws each field the way its column does**, so a
  per cent is typed as one.
- **Demos:** a new deal stage is asked its chance and days, and goes before
  Won; the clinic branch page is marked Egyptian English (en-EG), its hours and
  booking calendar both starting on Saturday; the viewing report opens again
  with no signal, through a service worker of its own, and the outbox docs show
  how an app does the same (Fieldia's outbox keeps the sends; opening the page
  offline is the app's service worker).
- **fieldia.dev:** a page under a strict Content-Security-Policy, at
  /demos/csp/, linked from /start/#csp, with a gallery card; the gallery finds
  the new languages and the developer features ("urdu", "persian", "csp",
  "json schema", "openapi", "year only", "lot number", …), and on a phone a
  search's results come first.

**Upgrading** — what an app that uses none of the new things sees change:

- A timed page with no drafts store keeps its draft in `sessionStorage`, and a
  draft whose clock started is laid at once, even with `drafts.restore: "ask"`.
- After a save (except on autosave pages), Ctrl+Z and `form.undo()` find
  nothing to undo.
- A field, group or badge a condition shows or hides as a box is left by a
  press (its value taken as it is left) changes once the press has ended, a
  moment after the click's own handlers. A press is over as its click comes:
  what the click itself changes still shows at once.
- The search bar's menu closes when its box is focused or typed in: a test
  that reads counts in it opens it again.
- Masks and one-time code boxes no longer hold keys after a refused one;
  Backspace after a refused key deletes the last character shown. New
  `InputRules.stay`.
- A titled group up to half a sheet prints whole, carried to the next sheet
  where it does not fit: a printout may break between sheets at a different
  place.
- `ApprovalEntry.decision` gains `'changed'`, with `changes`, and the new type
  `ApprovalChange` (`{ field, label?, from, to }`). The chatter's
  `approvalEntries` takes a value formatter.
- A QR code's accessible name is "QR code: {summary}" or "QR code". The codes
  part exports `codeSummary`. An integer shown as a barcode is not grouped in
  its box either.
- The Gantt opens at its first task, not at today.
- The memory source numbers a new template, view or message after the ids it
  was given, never reusing one.
- An app that passes whole `labels`, `messages` or designer words adds the new
  keys: viewer `nothingSinceSave`, `templateReplaceAsk`, `templateReplace`,
  `approvalChangedEntry`; widgets `qrCode`; designer `schema.empty`; gantt
  `edgeBefore`, `edgeAfter`. The words of `coverNow` changed.

**Size:** `fieldia.js` 520.0 KB, 170.9 gzipped (0.31.0: 519.6, 170.8): 0.14 KB
gzipped for what every page needs — where a timed page's drafts are kept (known
as the form is made), a save starting the changes afresh, a code's box written
at rest as typed, text boxes reading in their own direction, the template
question handed to its part, the input rules' `stay`, and a condition's part
waiting for a press. Of the parts, gzipped:

- memory 9.0 KB (from 8.7): changes kept on the way to approval, ids numbered
  after the given ones;
- typed 6.0 (5.7): keys after a refused one, the value in a paste;
- approvals 6.9 (6.7) and codes 5.5 (5.2): the `changed` entry; a code's
  summary;
- list 45.1 (45.0) and filters 7.7 (7.7): a menu giving way;
- surveyflow 12.3 (12.3), date 9.1 (9.1), undo 3.5 (3.4), verify 4.8 (4.7),
  templates 3.0 (2.9), lines 15.1 (15.0), print 5.2 (5.2), phone 16.2 (16.2),
  duplicates 6.4 (6.4): the walk's fixes; slots 5.8 (5.9), its weekday heads
  now the date part's;
- the language add-ons by 0.05–0.07 each (the new words); the Gantt's timeline
  15.2 (14.1): its edge signs, Ctrl+Z and its words in every language.

## 0.31.0 — 2026-10-22

**The study's "nice to have" list, done: lists people work in all day and a
Gantt timeline, boxes for the values people type, surveys that behave like the
tools people know, films, sounds, codes and pins, forms on the open web, a
record's daily comforts, and Fieldia for the developers who adopt it — under a
strict Content-Security-Policy, tested with its own kit, first painted on a
server, started from a schema.** Turkish, Persian, Urdu and Spanish join
English, Arabic, German and French — machine-assisted, not yet reviewed by a
native speaker. The page format is 0.10; a page of 0.1 to 0.9 is read as it is.

**Lists people work in all day.** Shift and a header's press adds its column to
the order — each column in it numbered (1, 2, 3) and said ("sorted 2 of 3,
descending"), Shift with Enter or Space from the keys. **Saved views on your
server, shared with the team** (`views`, `saveView`, `deleteView`): the search
bar's menu lists the person's own and the team's ("Shared by Mona Adel"), each
putting back its search, order and columns; Save takes a name, Use by default
and Share with the team; the list opens on the person's default, else the
team's; without the members, the 0.20 favourites are kept in the browser as
before. **A row opened in place** (`detail`) to its lines or to the records
pointing at it, a page at a time, by the arrow before its name or Right and
Left. **Rows re-ranked by hand** (`sequenceField`): a grip, or Alt and an arrow,
the fewest ranks written through `writeMany`, each move said. **Rows loaded as
the list is scrolled** (`endless`), its count kept ("1–60 of 1,284"), Show 30
more at the end for the keys. **A tree too big for a page** (`loadChildren`): a
parent's children asked as it opens, counted by `groups`, a search's matches
named under their parent. The views come in `fieldia.views.js`, the rows opened,
ranked and loaded in `fieldia.rows.js`. In the designer: a list's Rows people
work in. Demos: orders reviewed in place, a clinic's waiting room, an activity
log, a chart of accounts; the customers' Shift-sorting and the sales team's
shared views.

**A Gantt timeline** (@fieldia/gantt). A list with `gantt` offers Timeline on
its view switcher, beside the table, the calendar and the map: each record a bar
on an axis of days, weeks or months, grouped under headings that fold away
(`group`), coloured (`colour`), an arrow from each record it waits for
(`dependsOn`, finish to start) — red and dashed where a bar starts too soon — a
line for today and Today. A bar is dragged, or stretched by either end, by whole
days, Escape putting it back; from the keys ↑↓ reach a bar, ←→ move it a day,
Shift with them its end, Enter opens it — a run of presses saved once they rest,
one save, one Undo. Each move saves only the fields it changed (`partial`, with
the row's version); a record the source locks stays still and says why. On the
page's clock, right to left, the whole plan on paper. It loads in a chunk of its
own (`ganttListViews()`). In the designer: a list's Timeline. Demo: a café's
fit-out.

**Boxes for the values people type.** A date of a month alone or a year alone
(`precision`), and Hijri (Umm al-Qura) days shown and typed beside the Gregorian
day kept (`hijri`), in the months part. **Masks as you type** (`options.mask`: a
national ID, an IBAN, a plate — a wrong key refused with why, a paste laid out,
nothing typed lost) and **a one-time code's boxes** (`"widget":
"one-time-code"`: a box per character, a pasted code across them, the phone's
autofill), in the typed part. **Amounts in shorthand** (`options.shorthand`:
"3.5m", "500k", "٣٫٥ مليون", said as typed). **Options with a second line, an
icon or a colour** (`caption`, `icon`, `color`) on radios, checkboxes and
Fieldia's own lists — a dropdown whose options have any is Fieldia's own list —
and a link's suggestions with each record's picture or colour, details and
aside; an option is named by its words alone. **A checkbox tree** (`"widget":
"tree"` on a many2many): branches ticked whole or in part, search, the keys of a
tree, `keeps` all, top or leaves. Demos: a flat let in Riyadh; a lead's areas
wanted.

**Surveys that behave like the tools people know.** **Quiz results** (`quiz`): a
score, each question marked right, wrong or not answered with its points and
feedback, the right answer to one missed, or "results after review" — your
server may mark it (`SubmitResult.quiz`). **A review before sending**
(`review`): every answer by step, each with Edit, then Send. **One question at a
time** (`flow: "one"`): a screen each, a pick moving on by itself, letters to
pick, Enter and the arrows, "Question 3 of 7". **Random order and N of M**
(`order: "random"`, `draw`, `fixed`), drawn per respondent (`seed`), kept in
drafts and sent as `order`. **Time limits** (`timeLimit`) for a form or a step:
Start, a countdown, one warning, then sent as they stood or locked — the page
says which. They come in `fieldia.surveyflow.js`, so a page of a slider or a
ranking alone never downloads them. In the designer: the Rules tab, each
question's settings, and a page's order, draw and minutes under its title — on a
phone once the page is picked, or where it uses them. Demos: a clinic's staff
training check; a home search one question at a time.

**Films, sounds, codes and pins.** A film among a field's files shows its poster
(`FileValue.poster`, else the frame at half a second) and plays in the dialog; a
sound plays in place in a list. **A voice note or a short video recorded on the
page** (`options.record`, `maxSeconds`): the microphone or the camera asked for,
a refusal said with Try again, the time against the limit, played back, kept as
a picked file is, asked before it is let go — in `fieldia.record.js`, loaded as
Record is pressed. **A value shown as a QR code or a Code 128 barcode**
(`"widget": "qrcode"` / `"barcode"`; `level`, `size`, `showValue`), drawn as SVG
by Fieldia's own encoders, black on white, named — in `fieldia.codes.js`. **Pins
with notes on a picture** (`"widget": "pins"`: `image` or `imageField`, `alt`,
`maxPins`, `noteLabel`) — a face chart, a floor plan — placed by pointer or
keyboard, listed for screen readers, in `fieldia.pins.js`. Demos: a site visit,
an event ticket, a face chart.

**Forms on the open web.** **Fields a page's link fills** (`prefill.fromUrl`):
campaign and agent codes in hidden fields, sent with the answers, never over
what the person typed. **Proof of an email or a phone by a code**
(`options.verify`, your source's `sendCode` and `checkCode`): the ways you
offer, expiry, tries left, Send again after its wait, nothing sent unconfirmed.
**A payment the answers wait for** (`payment`, your source's `pay`): the amount
and its currency, your own checkout opened or embedded, paid, failed or
cancelled said, nothing sent unpaid — your checkout handed the values as the
send will carry them, those a link filled among them; Fieldia holds no keys and
no provider's code. **`<fieldia-form>` and `fieldia-embed.js`**: a form on any
page with one script tag, and a frame on another site that grows with its form
and tells its events. **An offline outbox** (`outbox`): saves, sends and photos
kept on the device without signal, in IndexedDB, sent in order when it is back,
never lost on a reload, a refusal kept to try again or discard. Each in a part
of its own (`fieldia.prefill.js`, `verify`, `pay`, `element`, `outbox`). React,
Vue and Angular take `url`. Demos: a unit's enquiry from a broker's link; a
viewing report with no signal; a form embedded.

**A record's daily comforts.** **Undo and Redo while filling**: Ctrl+Z (⌘Z)
takes back the record's last change — a field, a cell, a line added, removed or
moved; typing on in one box is one change until it is left — Ctrl+Shift+Z or
Ctrl+Y makes it again; inside a box typed in the browser's own undo comes first,
a formatted text keeps its own; `form.undo()`, `redo()`, `history()`,
`keys.undo: false`. **Undo on the toast after a one-tap press** (a button's or a
menu item's `undo`): its words with Undo for a few seconds in place of asking
first. **Record templates** (`templates`): Save as template…, a new record from
one, Delete templates… — through your source's `templates`, `saveTemplate`,
`deleteTemplate`, else the viewer's preferences. **A repeat field** (`"widget":
"repeat"`: an iCalendar RRULE said in words, in lists too) and **a week's
opening hours** (`"widget": "hours"`: shifts, breaks, closed days, Copy to all
days — what booking slots read), in `fieldia.schedule.js`. **Who else is here,
and changes arriving live** (your source's `presence` and `subscribe`): a change
made elsewhere laid on the record and said ("Mona Adel changed Price."), the
0.22 conflict after a change of the person's; the chatter's `subscribe` and the
record's can be one function of your app's, each taking its own kind of change.
Demos: a treatment course with its sessions and templates; a branch's opening
hours.

**For the developers who adopt it.** **A strict Content-Security-Policy**: every
`<style>` Fieldia adds carries the page's nonce (the `nonce` option on the
viewer, the components and the designer; else `<meta property="csp-nonce">`; the
one-tag script its own tag's); no style attribute written; no code made from
text; a formatted text keeps its looks under a policy — and every feature of
0.29 and 0.31 that colours or places what it draws passes the strict test page
in three engines. **@fieldia/testing**: `fill`, `pick`, `check`, `press`,
`errorsOf`, `valueOf` for Testing Library and Playwright, and `fieldia-check`
for stored pages in CI. **A server's first paint** (`@fieldia/viewer/server`'s
`firstPaint`, `firstPaint` on React and Vue): the form as plain HTML with its
values before any script runs, `mountViewer` mounting over it without a flash or
lost typing. **`pageFromSchema`** and the designer's Start from a schema…: a
JSON Schema, an OpenAPI operation or a model's fields made a page, what was kept
with a change and what was left out said.

**Four more languages, not yet reviewed.** Turkish, Persian, Urdu and Spanish
(`tr`, `fa`, `ur`, `es`): every word Fieldia says — the viewer's, the widgets',
the messages', the designer's, the chatter's, the map's, the calendar's and the
timeline's — machine-assisted, each table marked so, not yet reviewed by a
native speaker. Persian and Urdu run right to left and their digits (۰–۹, ٫ ٬)
are read as numbers; both list with the Arabic comma, Persian quotes «…»,
Turkish dates are typed with dots. **Fetched where they are spoken**: in the
packages each language's words come in chunks of their own — `wordsReady(tag)`
fetches every package's; `mountViewer`, the chatter and a list's map wait for
them and draw in the language from the first paint, never English first;
`designerWordsReady` for the designer; the calendar and the timeline fetch
theirs with their view. In the one-tag script they are add-ons, as Arabic's,
German's and French's are: `fieldia.tr.js`, `fieldia.fa.js`, `fieldia.ur.js`,
`fieldia.es.js`. **Days on the Gregorian calendar everywhere** (`dayTag`):
Persian's own calendar in a browser is the Solar Hijri, under which a date
showed as "23 Mehr 1405" and never read back. **A week starts where its reader
is** (`firstWeekday(language, page?, readers?)`): the page's region (`en-GB`),
else the reader's where their browser asks for the page's language with one,
else the region CLDR has the language most spoken in — for every week Fieldia
draws: a list's periods and week groups, the calendar and the timeline, a date's
and a range's calendar, booking slots, a week's hours, a repeat's days, a
chatter's history. Demos and the site's live form offer the four, marked
unreviewed.

**Smaller things:**

- **A list prints the view it shows** — its table, its gallery, its calendar,
  its map, its timeline, or its table and its map side by side — and leaves the
  others off paper: a calendar shown alone printed a blank page.
- **One Undo for an accepted proposal**: AI help's own Undo and Ctrl+Z each take
  it back, whichever is pressed first, and the other has nothing of it left; a
  photo set's move is a change Ctrl+Z takes back; a list's cell saved as its row
  is left is a save of its own, which Ctrl+Z leaves — a list's paste is taken
  back by its own Undo and Ctrl+Z for a few seconds after (0.30.1), never by the
  form's.
- **A text kept in several languages is typed as words**: a mask or shorthand on
  it, or `prefill` naming it, is refused with why; a record template keeps it
  whole; `pageFromSchema` keeps the languages Fieldia's own fields name and says
  a backend's `translate: true` is typed in one.
- **A saved view keeps the filters AI help read from words**, and putting it on
  never asks the model again.
- **Every pill tone reads at 4.5:1** over a row at rest, under the pointer or
  ticked, in every skin, theme and scheme.
- **`tools/serve.mjs` answers byte ranges**, as Safari needs to play and seek.
- **Parts join a form through one registry and one kit** (`formJoins`,
  `FormInner`): the fields a link fills, proof by a code, a payment, an outbox,
  a survey's flow, a record's approvals and the record made live each answer at
  their moments through one hook (`FormJoin`); a page's limits and Undo take the
  same kit at moments of their own.
- **Smaller one-tag script**: `uploadTo`'s work comes in the files part; an
  option's mark and second line in the choice part; the parts take the main
  script's names by their place in a table, never by their words (every part a
  little smaller too).

**Fixes:** the presence band, empty while nobody else is here, is hidden; the
outbox's kept photos are made files through the files part (0.29 moved where
they are made); in WebKit (Safari) the screen designer's bar said a
ResizeObserver loop as it opened (0.30.1 too) — its room is measured in the next
frame.

**And:** the page format is **0.10** (`FORMAT_VERSION`): it only added — a
list's `detail`, `sequenceField`, `endless`, `loadChildren` and `gantt`; a
date's `precision` and `hijri`; an option's `caption`, `icon` and `color`; a
field's `quiz`; a page's `quiz`, `review`, `flow`, `timeLimit`, `prefill`,
`payment`, `outbox` and `templates`; a step's and a group's `order`, `draw` and
`fixed`; a button's `undo` — so a 0.1 to 0.9 page is read as it is, and
`upgradePage` writes 0.10 in it. Format versions are compared as numbers: 0.10
is newer than 0.9.

**Not done yet** (each feature's docs say it): rows of an endless list are not
virtualised, and a tree's match under a search names its parent alone; the
timeline's other link kinds, moving what waits, progress and the critical path;
a month date's stand-in reads whole days, Import and grid paste read neither
months nor shorthand; a quiz's pass mark, a saved form placed in a step in the
review; the attachment preview of films, recording in a table line's cell, pins
of kinds or colours; Angular's `firstPaint`; Monaco's sheets under a policy.

**Upgrading** — what an app that uses none of the new things sees change:

- An app that serves `fieldia.js` itself serves the new parts beside it:
  `fieldia.views.js`, `fieldia.rows.js`, `fieldia.months.js`,
  `fieldia.typed.js`, `fieldia.surveyflow.js`, `fieldia.record.js`,
  `fieldia.codes.js`, `fieldia.pins.js`, `fieldia.prefill.js`,
  `fieldia.verify.js`, `fieldia.pay.js`, `fieldia.element.js`,
  `fieldia.outbox.js`, `fieldia.undo.js`, `fieldia.templates.js`,
  `fieldia.schedule.js` and `fieldia.live.js`, and `fieldia-embed.js` for a
  frame on another site. `uploadTo`'s work is in `fieldia.files.js`.
- `PART_RANK`, one order: print 0, lines 1, business 2, survey 3 (and a survey's
  flow), files 4, evidence 5, phone 6, slots 7, import 8, duplicates 9, limits
  10, approvals 11, assist 12, photos 13, languages 14, months 15, typed 16,
  record 17, codes 18, pins 19, verify 20, pay 21, outbox 22, schedule 23,
  themes 24, quiet 25, picker 26, head 27, groups 28, text 29, surveyLooks 30,
  cards 31, scan 32. A list's views' and rows' sheets go right after the list's
  own.
- Shift and a header's press adds a key to a list's order instead of replacing
  it; a header carries `data-sort`, and only the first key's `aria-sort`.
- Ctrl+Z, Ctrl+Shift+Z and Ctrl+Y on a form are Fieldia's outside a box typed
  in, unless `keys.undo` is false; the undo part is asked for at the first focus
  into a form. `form.undo()` waits for it.
- A video or audio file shows a film's picture or a sound's player where 0.30
  showed an icon. A dropdown whose options have a `caption`, `icon` or `color`
  is Fieldia's own list.
- Fieldia builds its zod schemas in zod's `jitless` mode, given back as it was
  once they are made.
- New optional data source members: `views`, `saveView`, `deleteView`,
  `sendCode`, `checkCode`, `pay`, `templates`, `saveTemplate`, `deleteTemplate`,
  `subscribe`, `presence`. Requests gain `verified`, `payment`, `queued`,
  `order`, `started`, `timeUp`; `SubmitResult` gains `quiz`; `FileValue` gains
  `poster`; `ActionHost.say` takes `{ undo }` and gains `pay`; `ActionResult`
  gains `undo`.
- `FormState` gains `order`, `timers`, `timeUp`, `verified`, `paid`, `outbox`,
  `present`; `FormEvents` `arrived`; `Form` gains `joined`, `validate(within?)`,
  `startTimer`, `countdown`, `undo`, `redo`, `history`; `FormOptions` `seed`,
  `url` and `outbox`.
- `MemoryDataSource` has its view members only with `views`, its template
  members only with `templates`, and `subscribe`, `presence`, `arrive` and
  `leave` only with `live`.
- A week starts where its reader is, where 0.30 started it on Saturday for
  Arabic and on Monday for every other language (a date's and a range's calendar
  and booking slots on Monday always; a chatter's history where the browser
  said): the page's own region if its `language` names one (`en-GB`: Monday),
  else the reader's if their browser asks for the page's language with a region,
  else CLDR's. So an `en` page now starts its weeks on Sunday in New York or for
  a reader with no region, on Monday in London, on Saturday in Cairo; an `ar`
  page on Saturday as before, on Sunday for a reader in Riyadh; `de` and `fr` on
  Monday as before. It moves a list's "this week" and its week groups, the
  calendar (unless `firstDay`), a date's and a range's calendar, booking slots
  and a chatter's history. A date's calendar with `weekNumbers: true` keeps ISO
  rows, Monday first. A page that wants 0.30's Monday names its region
  (`"language": "en-GB"`), or its calendar's `firstDay: 1`.
- `Locale` gains `tr`, `fa`, `ur` and `es`: an app's own `Record<Locale, …>`
  names them. In the packages their words come in chunks of their own:
  `MESSAGES.tr`, `WIDGET_LABELS.tr` and the like hold English's words until
  `wordsReady('tr')` has settled (`mountViewer` awaits it; an app that draws
  with them itself awaits it first). An app that serves `fieldia.js` itself
  serves `fieldia.tr.js`, `fieldia.fa.js`, `fieldia.ur.js` and `fieldia.es.js`
  where its pages speak them.
- Days are written on the Gregorian calendar whatever the language's tag says
  (`dayTag`): a full tag like `ar-SA` on save-safety's time words was Umm
  al-Qura (the browser's default there) and is now Gregorian.
- New exports: @fieldia/core's `formJoins`, `pageFromSchema`, `schemaChoices`,
  `schemaNoteWords`, `quizResults`, `drawOrder`, `surveyFlow`, `formSurveyPart`,
  `pressUndoPart`, `recordLivePart`, `linkParams`, `linkValue`, `linkValues`,
  `indexedOutbox`, `memoryOutbox`, `monthNamed`, `monthWords`, `hijriWords`,
  `precisionOf`, `dayTag`, `listComma`, `firstWeekday`, `wordsReady`,
  `wordsInChunks`, `tableInChunks`, `wordsComing`, `wordsNotYet`,
  `ListDetailSchema`, `ListGanttSchema`, `MaskOptionsSchema`,
  `OneTimeCodeOptionsSchema`, `ShorthandOptionsSchema`,
  `CheckTreeOptionsSchema`, `CodeOptionsSchema`, `PinsOptionsSchema`,
  `RecordOptionsSchema`, `PagePrefillSchema`, `PagePaymentSchema`,
  `PageQuizSchema`, `QuizQuestionSchema`, `PageReviewSchema`, `TimeLimitSchema`
  and their types (`FormInner` and `FormJoin` among them); @fieldia/widgets'
  `monthsPart`, `typedPart`, `recordPart`, `codesPart`, `pinsPart`,
  `schedulePart`, `fieldiaStyle`, `styleNonce`, `useStyleNonce`,
  `FIELDIA_STYLE_SHEETS`, `showHtml` and `PART_CELL_WORDS`; @fieldia/viewer's
  `viewsPart`, `rowsPart`, `surveyFlowPart`, `templatesPart`, `livePart`,
  `elementPart` and `defineFieldiaForm`, and `@fieldia/viewer/server`'s
  `firstPaint` and `firstPaintStyles`; @fieldia/designer's `designerWordsReady`.
- New packages, at 0.31.0 with the others: **@fieldia/gantt** (`ganttListViews`,
  the timeline in a chunk of its own) and **@fieldia/testing** (`fieldia`,
  `readField`, `matchFields`, `labelsOf`; `@fieldia/testing/playwright`;
  `@fieldia/testing/pages`' `checkPageFiles`, `pageFiles`, `runCheck`,
  `resultLines`, and the `fieldia-check` command).
- A page the designer saves says `"fieldia": "0.10"`: Fieldia 0.30 refuses it as
  newer than it reads. An app that keeps pages for older Fieldias keeps them in
  0.9 (nothing 0.10 adds is in them).
- An app that gives a whole `labels` object adds the new words (`addLanguage`
  fills them from English).

**Size:** `fieldia.js` 519.6 KB, 170.8 gzipped (0.30.1: 511.6, 167.9). The eight
features merged measured 525.5, 173.2; the parts joining a form through one kit,
an option's mark and `uploadTo`'s work in the parts that use them, and the parts
reading the main script's names by their place in a table took 2.95 KB gzipped
off (every part a little smaller for it), and the four languages and 0.30.1's
fixes put 0.48 back. New parts, gzipped: `fieldia.views.js` 2.4 KB, `rows` 7.1,
`months` 5.6, `typed` 5.7, `surveyflow` 12.3, `record` 4.4, `codes` 5.2, `pins`
4.0, `prefill` 2.0, `verify` 4.7, `pay` 3.3, `element` 2.4, `outbox` 4.0,
`templates` 2.9, `schedule` 7.9, `live` 2.2, `undo` 3.4; and `fieldia-embed.js`
0.9 for a frame on another site. Of the parts, the list's grew with several sort
keys, the views' and rows' hooks and the week's first day (45.0 KB gzipped, from
42.4), the files' with a film's poster and player and `uploadTo`'s work (17.3,
from 14.9), the path's with the checkbox tree (8.2, from 6.3), the date's with
the week's first day (9.1, from 8.4), the memory source's with views, templates
and live changes (8.7, from 7.4), the choice part's with an option's mark and
second line (4.7, from 4.6); the rest are 0.1 to 0.6 smaller, the relations' as
it was. A language's add-on is 17.5 to 22.3 KB gzipped (0.30.1: 14.1 to 16.2),
the four new ones among them. @fieldia/gantt is 0.8 KB gzipped with the page and
14.1 for its timeline, in a chunk of its own; in the packages, each new
language's words are chunks of their own (18 to 23 KB gzipped for the viewer's),
fetched where it is spoken.

## 0.30.1 — 2026-10-22

**The owner's walk of 0.29, mended.** A business owner walked fieldia.dev's
0.29 demos as a customer would, following each demo's own steps with the
mouse. What it met broken or confusing is fixed here, each where it began, for
every place it could happen; how Arabic writes money and the designer's dark
scheme wait for a later release. The page format stays 0.9: nothing a page
says changes.

**Fixes:**

- **A list's cell opened by a press or Enter chooses its whole value**, so what
  is typed replaces it, as a spreadsheet does. A second press, or F2, puts the
  caret in it to change within it. One rule for every kind a cell opens as:
  following the price list's first step with the mouse saved Hydrafacial's
  price as E£ 28,003,000, staff hours read "00:009:30", a stage "7,065%".
- **A row added opens at the first cell a new record needs**: the first
  required, empty and changeable one in the person's order of columns, else the
  first changeable one. "Add a stage" lands on its name, never on Order. A
  blank card is titled "New stage".
- **A row no one may change shows a lock at its start**, and a press on it says
  why: the record's `can.reason`, else "This row can’t be changed here". It does
  this on a desktop and on a phone.
- **A paste of more than one row asks first**: "Paste 40 rows: change 7 and add
  33?", answered Paste 40 rows or Cancel. Undo, and Ctrl+Z, take it back for a
  few seconds after: the rows it changed are put back and saved again, and the
  rows it added are taken away. Rows refused for one reason are said once ("33
  rows not saved: Service is required.", with Remove them), each still marked.
- **A question's Yes says what it does**, never a bare OK:
  - a button's question, and its `ask` steps, by the button's own words (Block,
    Send newsletter);
  - Archive and Delete by Archive and Delete;
  - a `beforeSave` question by the form's own Save or Submit;
  - Edit's question by Update, and Undo the import's by Delete;
  - a paste by "Paste 40 rows".
- **Approvals in the memory source:**
  - the person who asked for a round never decides a level of it ("Karim Fathy
    asked for this approval, so may not decide it");
  - a record whose rules ask no level moves on at once, with "No approval
    needed" in its history and its band;
  - the words read "Say why you reject it (Finance)" and "Karim Fathy approved
    (Manager)".

  Contract §20 recommends this routing to a server, and the Flowyard mapping
  follows it. In "An expense rejected, with why", only the employee is offered
  Submit for approval: the page's own rule for its button.
- **Scanning:**
  - a code that holds nothing the field takes says so in the sheet ("This code
    has no Lot in it. Scan the code on the pack."), and a code of another kind
    is said too;
  - a scanner gun's code typed in a scanned field's box, and in a table's cell,
    is read as the camera's is, on Enter or as the box is left: a link found by
    its code, GS1 parts, `fills`;
  - the stock count's sheet takes a typed code ("Or type the code", Count).
- **A record's status strip on a phone** scrolls the step it is in into view
  and rests on a step. Where it is cut, its edge fades with a ‹ or › sign that
  it scrolls, and no step is cut mid-word.
- **An empty Send or Propose values says what to do beside it**: "Type a
  message first", "Type a note first", "Paste or add what to fill from". The
  words go as soon as you type.
- **Photos are named by their caption, else their place** ("photo 2 of 5"),
  never by their file, in their buttons and messages.
- **Every dialog holding changes asks before Escape or × lets them go**: the
  crop dialog, Reject's reason, Fill from text and the import, as a record's
  dialog does ("Discard your changes?", Discard or Keep editing). Cancel leaves
  without asking.
- **The stand-in AI** reads "<25m", "<=" and ">". It matches "apartments",
  "flat", "apt" and "store" to their options. Polish keeps the capitals of
  names the record already writes with capitals.
- **A formatted text's table pasted with its header row among its rows** (as
  office apps copy one) keeps that row in the table's head, so a printout
  repeats it on every sheet.
- **The designers on a phone:**
  - the bar is one row of title, Publish and More (⋮), with everything else
    under More;
  - where the toolbox can't sit beside the page (a survey editor 900px wide or
    less, a screen editor 1000px or less), it waits behind a + and opens as a
    sheet with its Add, Outline and Data tabs, so the form starts near the top
    (the first question about 615px down, where it was about 2,100);
  - title boxes wrap instead of being cut: the bar's title, the form's heading
    and description, page titles, a question's words and description, the
    screen's field labels and group titles;
  - a page's buttons go under its title when the row has no room, and endings
    and conditions fit a phone.
- **The gallery finds the designers.** The survey designer and The screen
  designer are found by "designer", "form builder", "survey designer", "drag
  and drop" and "no code". They open in the demo frame with Try this, their
  source, and a Code drawer that shows the page being built and how to mount
  the designer.

**Upgrading** — what an app that uses none of the new things sees change:

- A list's cell opened by a press selects its value: a test that pressed a cell
  and typed to add to its value presses it again, or presses F2, first.
- A paste of more than one row in a list whose app can ask (`ask`) asks first,
  its Yes "Paste {n} rows".
- A question's Yes has its own words: a test that pressed OK on a button's
  question, Archive's, Delete's, Edit's or a paste's presses the named Yes
  (Block, Archive, Update, Paste 3 rows). A notice keeps its OK. Your own
  `confirm` (`FormOptions`, `ViewerOptions`, the React, Vue and Angular
  components' `confirm`) and `host.ask` are given those words as a second
  argument's `yes`.
  - `AskHow` gains `yes`, and `RunContext` gains `yes` (an `ask` step's Yes).
  - `form.save(how?)` takes `{ yes }`: the words of what set the save off.
- The memory source never lists a round's requester as one of its approvers,
  and a route that asks no level is approved at once. A server following §20
  does the same. `ApprovalEntry.decision` gains `'notNeeded'`.
- The status strip is a `div.fd-statusbar-frame` holding `ol.fd-statusbar` and
  two `span.fd-statusbar-sign`: CSS that targeted the list right under the head
  allows for the frame.
- Photo words' `{name}` is the caption or the photo's place, not the file name.
- An app that passes whole `labels`, `messages` or designer words adds the
  new keys:
  - viewer: `rowLocked`, `rowLockedNoun`, `pasteAsk`, `pasteAskChange`,
    `pasteAskAdd`, `pasteYes`, `pasteUndo`, `pasteUndone`, `rowsNotSaved`,
    `rowsNotSavedOne`, `rowsDrop`, `rowsPutBack`, `approvalNotNeeded`,
    `approvalKeepEditing`, `assistKeepEditing`, `importKeepEditing`,
    `assistFillEmpty`, `assistFillEmptyText`, `assistFillEmptyFiles`;
  - widgets: the scan words (`scanTypeCode`, `scanTypeCount`), the photos'
    place words (`photoAt`, `photoAtStart`, `photoAlone`, `photoAloneStart`,
    `photoCoverAt`) and the crop's (`cropLetGoAsk`, `cropLetGo`,
    `cropKeepEditing`);
  - chatter: `approvalNotNeeded`, `typeMessageFirst`, `typeNoteFirst`;
  - core messages: `archiveYes`, `deleteYes`;
  - designer: `bar.more`, `bar.moreTitle`, `toolbox.openToolbox`,
    `toolbox.closeToolbox`.
- Widgets export `askFirst(make, { yes, no })`. `codeReaderFor(formats, doc,
  also)` gives an app's own reader every format, and the combobox gains a
  `code` option. `polishText(text, names?)` takes the names to keep.
- The designer on a phone (620px wide or less) puts the bar's tools under More,
  and keeps the toolbox in a sheet behind + wherever it can't sit beside the
  page. Its title boxes are one-row `textarea`s that grow (`.fd-growing`)
  where they were `input`s: a test or style that found them as `input` finds
  them by their class.

**Size:** `fieldia.js` 511.6 KB, 167.9 gzipped (0.30.0: 511.2, 167.75). The
walk's fixes added 0.03 KB gzipped: a muted pill's shade, asking first in place,
and what the parts now take from the main script. A question's Yes naming what
it does added 0.12: what Yes does, carried from what set the run off to the
question. Of the parts, gzipped:

- editable 12.6 KB (from 10.7): a press choosing the value, the lock, the
  paste's question and its Undo;
- business 12.5 (11.5): the phone's status strip;
- scan 8.8 (7.9) and relations 7.7 (7.6): the typed code and a code that holds
  no part;
- memory 7.4 (7.1) and approvals 7.0 (6.8): the routing and "No approval
  needed";
- photos 12.0 (11.6), assist 12.6 (12.4), import 15.2 (15.0): names by place
  and dialogs that ask before letting work go;
- text 24.9 (24.8): a pasted table's header row.

Files and lines grew by a few dozen bytes each for the word Remove, which they
now carry themselves; list and head for a question's Yes. The rest are as they
were. A language's add-on is 14.1 to
16.2 KB gzipped (13.8 to 15.9 in 0.30.0), with the new words.

## 0.30.0 — 2026-10-21

**A work item as a work tracker draws one: tags inline in its head's row,
menus inside its menus with lines between their items, and its formatted text
read first, edited from its Edit.** The page format is 0.9; a page of 0.1 to
0.8 is read as it is.

**Tags in a record head's row.** A tags field in `head.meta` sits in the row
itself: its chips after the comments' link, what adds one — Add Tag
(`"adder": "button"`), or the box typed in, its words still showing — after
the last chip. The row's other parts keep its first line; out of room, the
chips wrap in a slot of their own (never narrower than 200 pixels), so the row
is as tall with two tags as with none and grows only by the lines its chips
take. Nothing to set: it is how a head draws tags. On a phone the row's parts
stand each on their own line, as before.

**Lines between a menu's items, and menus inside it.** An item of the record's
menu (`toolbar.menu`, ⋮ in a head) or of a button's own `menu` may be a line
between items — `{ "type": "divider", "id": … }`, left out where nothing shows
on one side of it — or open a `menu` of its own beside it, shown with ›:
pointed at, pressed, or with Enter, Space or → (← right to left); ← and Escape
close it, the focus back on its item. It stands beside the menu on the side
with room, on the screen and over everything — under its item where neither
side has room, as on a phone — and its items run as the menu's own do. With
`menuFrom`, your app gives more items as the menu opens — a bug's templates,
which depend on the bug: its `onAction` is asked with that action's name, the
item's `params`, the record and its values, and answers `{ menu: [...] }`; each
of those runs its steps, then its action, asking its `confirm` first, and an
answer for a record no longer shown is dropped. An item whose menu has nothing
to show is not shown. They come in the head part. In the designer: the gear
menu's A menu of its own (its items, and the app's action that gives more) and
A line between items; a button's menu keeps both as its other choices are
changed, and adds a divider.

**A formatted text read first** (`options.edit: "button"`). A rich text shows
its text formatted — links that open in a tab of their own, pictures in place
— with Edit (✎, named "Edit Description") in its group's heading beside ⤢ and
^, or in its own box where it is not alone in a titled group. Edit, Enter on
the text or a press on its words opens the editor, its toolbar where
`toolbarAt` says and the focus in it; Done (✓), or a press or the focus
outside it, keeps what was typed, Escape puts back what it held — the record
changed only where the text is, ⤢ working while it is edited. Empty, it is its
editor at rest, its placeholder saying what to add; read-only, its text with no
Edit. In the designer: Read first, changed from its Edit. Demos: the backlog's
bug, its ⋮ as a work tracker's — New linked work item to Customize, Templates ›
with the bug's own — its tags in its row and its System Info read first; and a
bug's tags, menus and texts on their own (`?page=wi-more`), mounted and in the
inset dialog.

**Smaller things:**

- **A menu's built-in Archive and Unarchive follow the record wherever the menu
  stands** — inside a menu of the gear menu's, or a button's — as the gear
  menu's own do.

**And:** the page format is **0.9** (`FORMAT_VERSION`): it only added — a menu
item's `type: "divider"`, its own `menu` and `menuFrom` — so a 0.1 to 0.8 page
is read as it is, and `upgradePage` writes 0.9 in it.

**Upgrading** — what an app that uses none of the new things sees change:

- A record head's row, and its people and links, stand on its first line
  (`align-items: flex-start`), where they were centred; a link in `head.meta`
  has 6px above and below it, the middle of the row's 32px line.
- In a quiet head, a tags box is 32px tall, as the row's other boxes are (36
  with no Add Tag button), its lines of chips 30px; the box typed in shows its
  words ("Add Tag") after the chips too, where the quiet look hid them.
- An item of `toolbar.menu` or of a button's `menu` may be a divider, with no
  words, or open a menu (`menu`, `menuFrom`): code that reads a page's menus
  takes both. The check of an item that does nothing says "a menu item needs
  steps, an action, a built-in, or a menu of its own".
- `ActionResult` gains `menu`. The head part gives `submenus`, and core's head
  checks `checkMenuOpener` (in the one-tag script, owed to the head part by a
  page whose menus have a divider or a menu inside them). From the viewer's
  record bar: `MenuEntry`, `MenuTree`, `Submenus`, `SubmenuMaker`,
  `menuEntries`, `opensMenu`; `RecordBarContext.submenus?`.
- A Markdown text's `.fd-md-field` carries `data-editor`, as a rich text read
  first does.
- A page the designer saves says `"fieldia": "0.9"`: Fieldia 0.29 refuses it as
  newer than it reads. An app that keeps pages for older Fieldias keeps them in
  0.8 (nothing 0.9 adds is in them).

**Size:** `fieldia.js` 511.2 KB, 167.8 gzipped (0.29.0: 510.6, 167.4): a menu's
hooks for its lines and the menus inside it, the head part asked for and its
checks owed. Of the parts, the head's grew with the menus inside a menu, their
checks and tags in a head's row (13.2 KB gzipped, from 10.8), the text part's
with a rich text read first (24.8, from 24.6); the rest are as they were. A
language's add-on is 13.8 to 15.9 KB gzipped, as in 0.29.

## 0.29.0 — 2026-10-21

**What apps need as they move over: a conversation that knows its channels,
approvals on a record, a list whose cells change in place, one text in two
languages typed by people, AI help through your own model, photo sets, codes
scanned with the camera, and thousands of records on a map counted by your
server.** The page format is 0.8; a page of 0.1 to 0.7 is read as it is.

**A conversation that knows its channels** (@fieldia/chatter). Give the chatter
your app's `channels` — WhatsApp, e-mail, SMS, the team's notes — each with your
own icon and words: each message says its channel, and what went out shows its
ticks (a clock on its way, one tick sent, two delivered, two in the accent
colour read); a failed one says why under it ("Not delivered: This number does
not take text messages"), with **Retry** where your source has `resend`. A
reply goes by the customer's last channel by default, ↩ by the channel of the
message answered; a channel the record cannot use is hidden
(`replyChannels`), and who it goes to is said ("To +20 10 0482 1937"). New
messages and delivery changes arrive live — pushed by `subscribe`, else a polite
poll every 15 seconds, on where the chatter has channels, never while the page is
out of sight or offline — laid in place, announced politely, never disturbing a
reply being typed; what arrives for a record no longer shown is dropped.
**Follow-ups at an hour** on the page's clock ("Today at 15:30", "Overdue since
11:00"), and Schedule activity has a Time box. They come in a part of the
chatter's own (`channels`, 3.5 KB gzipped). Demo: a buyer's enquiry with
WhatsApp, e-mail, a failed SMS and team notes.

**Approvals on a record.** A record page with `approval` says over the record
where its approval stands — "Waiting for Finance: Mona Adel or Hany Lotfy",
"Needs approval from Finance, then CFO", "Approved", "Rejected by Mona Adel
(Finance)" with the reason quoted — its levels in order, and **Approve** and
**Reject** (Reject asks why) for those who may decide. While it waits, every
field is locked but those `approval.open` names, each lock saying why. The
history (who asked, who decided at which level, when and why) is folded under
the band, and told among the chatter's messages, written as the chatter writes
a time. Through the optional `approvals` and `decide` members: your app, or an
approval engine such as Flowyard's approval step, decides the routing — the
docs say how such a step answers them. It comes in `fieldia.approvals.js`. In
the designer: the Rules tab's Approvals. Demos: a purchase order over its limit
waiting for Finance then the CFO; an expense rejected with a reason.

**A list whose cells change in place** (`editable`). A press, Enter or a key
typed opens a cell in its field's own box with its rules; Tab and Shift+Tab go
from cell to cell, Enter goes down its column, Escape puts back. Each row is
saved as it is left — the fields it changed alone (`partial: true`), with the
version it was listed at; one refused stays as typed, why said under it, with
Put back; someone else's save first is said as a record's page says it, with
Reload and Keep mine. Computed columns follow the cells and wait where one does
not read. **Add a line** adds a row at the end; a block pasted from a spreadsheet
goes across and down the rows (rows given the same change in one `writeMany`);
on a phone a card is changed in a sheet. It comes in `fieldia.editable.js`. In
the designer: a list's Change cells in place. Demos: a clinic's price list, a
week of staff hours, a pipeline's stages.

**One text in several languages, typed by people.** A line, a paragraph or
formatted text with `translate: ["ar", "en"]` keeps its value as `{ ar, en }`: a
switch over its box (the reader's language first, each named in itself), Arabic
written right to left on any page, `required` in every language or `requiredIn`
some ("Title is required in Arabic", the save taking you to it), lists and cards
showing the reader's language — another's marked "EN" where it has none — and a
search finding either. Fieldia never translates it, and never offers to. It
comes in `fieldia.languages.js`. In the designer: Typed in several languages,
Required in. Demos: a listing in Arabic and English; a clinic's services named
in both.

**AI help, through your app's own model.** Fieldia ships no model and no keys:
a page's `suggest` draws **Fill from text** (words pasted, files picked, or a
text the record holds, `fromField`), a text field's `options.rewrite` **Draft**
and **Polish**, a list's `searchToFilter` a ✦ that reads "villas in New Cairo
under 15M" as the list's own filters — through the optional `suggest`,
`rewrite` and `searchToFilter` members. Every value proposed is shown on its
field first — the old one struck through, the new one, Accept and Reject, Accept
all — nothing kept until accepted, Undo after; a field typed in meanwhile keeps
what was typed ("Left as you typed: Email"); a proposal for a record no longer
shown is dropped. A text in two languages is filled in the one language the
person is looking at, said so ("Proposed in English"), never the other.
`handle.propose(values, { why })` shows your agent's values the same way. It
comes in `fieldia.assist.js`. `assistStandIn()` answers for demos and tests,
labelled "Stand-in AI, no model". Demos: a customer filled from an e-mail
signature; an enquiry's reply drafted and polished; homes searched in plain
words.

**Photo sets.** A picture field of several photos drawn as `"widget":
"photos"`: tiles in the order a person puts them (dragged, a finger resting a
moment on a phone, or Alt and an arrow key, each move said), the first the
cover — what a list's card and a map's pin show — each cropped and turned in a
dialog, the picture made stored through your `upload` and the original kept
beside it (Put back the original), captions, the field's `maxFiles`. It comes in
`fieldia.photos.js`, with the files part. In the designer: a Photo set kind.
Demos: a listing's photos with the agent's covers; a clinic's before and after.

**A code scanned with the camera** (`options.scan`): a Scan button at the end of
a field's box — a line of text, a paragraph, a link found by its code (`by`), a
table's column, a table that counts what is scanned — the camera in a sheet, the
back one on a phone; QR, DataMatrix, EAN-13/8, UPC and Code 128/39; a medicine's
GS1 code read in parts (`part`, `fills`: a lot, its expiry, its product). The
browser's own reader where it has one, else ZXing's readers in a part of their
own (`fieldia.decode.js`), loaded only as Scan is pressed; a camera refused or
missing says so, and a scanner gun types as before. It comes in
`fieldia.scan.js`. In the designer: Scan with the camera, Code kept in. Demos: an
injectable's lot scanned into a clinic's treatment; a shelf counted by its
barcodes; codes to scan, printed or on another screen.

**Thousands on a map, counted by your server** (@fieldia/map). A data source's
optional `clusters` gives a list's map the bubbles of the view it shows — each
with its count and the box its records lie in — in place of loading at most 500
records: asked as the search changes and a moment after the map stops (the last
ask wins), a bubble on one spot listing its records, a record standing alone with
its pin and card, "Search this area" counting from the bubbles. Without it, or
where it answers `false`, the map loads and gathers as before. `gridClusters()`
answers it from a memory source. Demo: 20,000 homes across Egypt.

**Smaller things:**

- **Fill from text asks only for what it fills**: words, numbers, money, yes or
  no, a choice, a day, links, a table's lines — never a file, a picture or a
  photo set.
- **A list's cell never opens a text in two languages**: its languages are typed
  under their switch, on the record's page; a page naming one in
  `editable.fields` is refused, with why.
- **Smaller main script**: the uploads' work — a file made ready and sent, its
  link put in its field — moved into the files part, which a page with a file
  field loads anyway (core's `formUploadsPart`).

**Fixes:** a number's total under a plain table lines up under its column (it
read from the left); the tender's lots test reads the days the demo counts from
today, and runs on two other days' clocks as well (it held on 20 Oct alone). On
a phone, a bar kept at the foot of the screen — the survey editor's add bar, Try
it's drawer — never hides what is worked on: a question picked is scrolled so
its controls end above the bar, and a control reached by Tab stops above it; a
field's settings on its card go under their words in a narrow column, never over
the field beside it.

**And:** the page format is **0.8** (`FORMAT_VERSION`): it only added — a
record's `approval`, a list's `editable` and `searchToFilter`, a text's
`translate` and `requiredIn`, a page's `suggest`, a text field's
`options.rewrite`, a photo set's options and a field's `options.scan` — so a 0.1
to 0.7 page is read as it is, and `upgradePage` writes 0.8 in it.

**Not done yet** (each feature's docs say it): an editable list's own `on` steps
in a row's form, a link among `startValues`; two languages in a table's line,
in `matchesFilter`, Export and Import; a photo set in a table line's cell; ZXing's
trimmed readers for an app's own bundler (it gets the library's whole index,
about 120 KB gzipped, lazily); ids in a server's bubbles.

**Upgrading** — what an app that uses none of the new things sees change:

- An app that serves `fieldia.js` itself serves the new parts beside it:
  `fieldia.approvals.js`, `fieldia.editable.js`, `fieldia.languages.js`,
  `fieldia.assist.js`, `fieldia.photos.js`, `fieldia.scan.js` and
  `fieldia.decode.js` (the package's `bundle` folder has them, with
  `THIRD_PARTY_NOTICES.md`, which the decode part's banner names). The uploads'
  work is in `fieldia.files.js` now: a form that sends a file loads it, as a page
  with a file field always did. An app's own bundler makes the files part two
  chunks, `files-part` from @fieldia/widgets and from @fieldia/core (the uploads'
  work, `formUploadsPart`), both asked for by a page with a file field.
- **The conversation writes a time one way**: a message's time and a follow-up's
  day as the page's date boxes write them — "1 Oct 2026, 10:00" (0.28: "Oct 1,
  2026, 10:00 AM"), "Due 22 Oct 2026" (0.28: "Due Oct 22, 2026") — and, inside a
  slot, on the page's clock (`timeZone`) and with the form's today. An approval's
  history in the conversation is written so too. A refresh updates the list in
  place. The poll is on only where the chatter has channels or `live` is set.
- `PART_RANK`, one order: print 0, lines 1, business 2, survey 3, files 4,
  evidence 5, phone 6, slots 7, import 8, duplicates 9, limits 10, approvals 11,
  assist 12, photos 13, languages 14, themes 15, quiet 16, picker 17, head 18,
  groups 19, text 20, surveyLooks 21, cards 22, scan 23. The editable list's sheet
  goes right after the list's own, as the cards' and the columns' do.
- @fieldia/widgets depends on `@zxing/library` 0.23.0 (Apache-2.0, noticed in
  `THIRD_PARTY_NOTICES.md`), loaded only by the decode part.
- New optional data source members: `approvals`, `decide`, `suggest`, `rewrite`,
  `searchToFilter`, `clusters`; the chatter's source `replyChannels`,
  `subscribe`, `resend`. `SuggestRequest` carries `languages` for a text in two
  languages; `SearchOptions` gains `field`; `FileValue` gains `caption`,
  `original` and `edit`, `UploadHow` `replaces`. `ChatterMessage` gains `channel`,
  `direction`, `delivery` and `failure`; `ChatterOptions` gains `channels`,
  `live`, `timeZone`, `dateOrder`, `recordShown` and `entries`; `ChatterHandle`
  gains `setEntries`; `chatterSlot` takes `approvals: false`.
- `FormState` gains `approval`; `Form` gains `refreshApprovals`, `decide` and
  `approvalLock`; `ViewerHandle` gains `propose`; a list context gains `newForm`,
  `drawField`, `dialogs` and `letGo`; the list's `Cells` gain `text()`; the search
  bar and the filter bar give `input`, `current()` and `take()`.
- `MemoryDataSource` has the AI members only where its `assist` option answers
  them, and `clusters` only with its option; new options `approvals`,
  `approvalHistory`, `language`, `assist` and `clusters`.
- New exports: @fieldia/core's `formUploadsPart`, `formLanguagesPart`,
  `hasLanguages`, `languagesOf`, `checkTranslated`, `languageName`,
  `languagesAtFault`, `textIn`, `textOf`, `LanguageTagSchema`, `editableColumns`,
  `cellChangeable`, `EDIT_KINDS`, `assistStandIn`, `gridClusters`,
  `PhotosOptionsSchema`, `SCAN_FORMATS`, `ScanOptionSchema`, `ScanSettingsSchema`,
  `ScanFillSchema` and their types; @fieldia/widgets' `languagesPart`,
  `photosPart`, `scanPart`, `decodePart`, `loadDecodePart` and `scans`; the files
  part's `takeFiles`, `preview` and `readPicture`; @fieldia/viewer's
  `approvalsPart`, `editablePart` and `assistPart`; @fieldia/chatter's
  `approvalEntries`; the designer's `setApproval`, `setSuggest`, `setLanguages`
  and `setRequiredIn`.
- A file's dialog uses its caption as its title; a stored file keeps the words
  beside its bytes as they stand when it lands.
- An app that gives the viewer a whole `labels` object adds the `approval…`,
  `assist…` (`assistProposedIn` among them) and `row…` words; the widgets' adds
  `languageSwitch`, `languageEmpty`, `languageNeeded`, `inLanguage` and the
  `photo…`, `crop…`, `turn…` and `scan…` words; the chatter's the 18 words of its
  channels and hours (`sendBy` … `dueTime`, `retry`) and `approvalAsked`,
  `approvalApproved`, `approvalRejected`; the map's list `crowdMore`; whole
  `messages` add `approvalLocked`, `approvalReasonNeeded`, `approvalNotYours`,
  `languagesNeeded` and `languagesNeededQuestion`. `addLanguage` fills any left
  out from English.
- A page the designer saves says `"fieldia": "0.8"`: Fieldia 0.28 refuses it as
  newer than it reads. An app that keeps pages for older Fieldias keeps them in
  0.7 (nothing 0.8 adds is in them).

**Size:** `fieldia.js` 510.6 KB, 167.4 gzipped (0.28.0: 506.8, 166.2; the lanes
merged, before the uploads' work moved to the files part, measured 512.4,
168.2). New parts: `fieldia.approvals.js` 6.8 KB gzipped, `fieldia.editable.js`
10.7, `fieldia.languages.js` 4.5, `fieldia.assist.js` 12.4, `fieldia.photos.js`
11.6, `fieldia.scan.js` 7.9, `fieldia.decode.js` 38.9 (only where the browser
reads no codes). Of the parts, the files part grew with the uploads' work and a
photo set's helpers (14.9 KB gzipped, from 13.6), the list's with the editable
list's hooks, a text's languages and the ✦ (42.4, from 41.6), the memory
source's with approvals, languages, AI help and clusters (7.1, from 5.7, the
one-tag script alone), the filters' (7.9, from 7.8); the rest are as they were.
A language's add-on is 13.8 to 15.9 KB gzipped (0.28: 11.6 to 13.3). The
chatter's main chunk is 14.5 KB gzipped (from 11.7), its `channels` part 3.5;
@fieldia/map 47.4 with a list's map (from 46.4), 32.1 for a list's map in a page
of its own (from 31.1), its `server-clusters` chunk 1.1.

## 0.28.0 — 2026-10-20

**Everything a business owner's walk of 0.27 found, mended** — values worked
out from an answer the form refuses wait for it, notes go once they are no
longer true, a table of lines reads whole on a phone, the booking template books
only free times, and fieldia.dev's front page stays still while you read it. The
page format is 0.7; a page of 0.1 to 0.6 is read as it is.

**The business owner's walk of 0.27, mended:**

- **A value worked out from an answer the form refuses waits** for it, as one
  worked out from text that does not read: "Fix Area (m²) to see Price per m²",
  never −120,000.00. An area under its `min`, a day past its `max` of `today`, a
  pattern not met, an answer rule's error — on the record or in a line's cell —
  hold back the page's own formula, Fieldia's functions (`years(built_on,
  today())`) and your app's alike. An empty answer is none, and one no one is
  shown is never refused.
- **"X is no longer offered, so it was taken out" goes once it is untrue**: the
  value written again, or what it names offered again (Villa picked again, the
  treatment ticked again above, the app's list asked again offering it); one of
  several offered again leaves it naming the rest.
- **A grid's cell says what a line's change took out of it** under its value, its
  row as tall as the words, as a plain table's cell does — and aloud, as before.
- **A consent's "Not signed yet" follows the answers.** Once nothing is left to
  put right it says "Your answers are ready to sign." with **Sign now**, which
  signs the drawing kept on the pad: never a second drawing.
- **A table of lines on a phone is cards**, a plain table and a grid alike: at
  520px or less each line is a card, each value whole beside its column's label,
  where a table's boxes and a grid's cells cut their words ("Send an ema", "A f").
  A grid's card opens its line in its own form; where the app gives the viewer
  no dialogs to open one in, the grid stays a grid. `"cards": "never"` keeps rows
  at every width, `"always"` cards at every width.
- **A card's line of two fields gives each its label beside its value** — "Next
  follow-up 30 Sept 2026 · Agent Mona Adel", never the two labels and then the two
  values — a part moving whole to the next row where it does not fit.
- **A printout's head names the record** by its name field — its sheet's title
  field, else its `name`, else its first line of text, on a page of sections
  too: "SA-2026-014", not "Agreement".
- **A label that is a question is quoted where a message names it**: "Please
  answer “How was your visit to Riverside?”" (`requiredQuestion`), in the
  language's quotation marks, wherever a message names a field by its label.
- **A day a message names is written as the page's date boxes write it**: "This
  form closed on 20 Nov 2026.", "can't be after 20 Oct 2026" — in the page's
  `look.dateOrder` and language, a time after it on the page's clock (`dayWords`).
- **An unanswered slider shows no knob**: a hollow ring at the start of an empty
  track and "Not answered" beside it, where 0.27 put the knob halfway beside "–";
  a press or a key that leaves it at its least answers it.
- **A list under a filter bar says how many records it finds** — "42 homes", in
  the page's words for its records — in its filter bar's row, in the table, the
  gallery and on a map; nothing while none is found, none for a list in a record.
- **The appointment-booking template books from the times the clinic has free**,
  with booking slots as the test drive does: never a day gone by, never a time
  already booked. A page of responses' slots ask for their free times again once
  a response is sent, so Book another is never offered the time just booked; the
  ending still says "Your booking is B-1043…". The templates' dates refuse the
  past or the future where neither makes sense (a date of birth, a move-in day).
- **A page that takes one response from each person** offers no other from its
  ending's own button either.
- **Sign-ups end naming what was kept**: the event sign-up names the session kept
  and where the ticket goes, the event registration template the ticket, its
  price and the workshops picked.
- fieldia.dev: the front page's stage keeps one height while it plays, its panes
  scrolling inside, on a phone too, and the tour waits while the stage is out of
  view; a tab played to its end rests 9 seconds, seen, before the next; the
  screen is veiled, lighter, only while a step's typing lasts long enough to read
  as work (700 ms), its chip in the stage's bar, never over the record. The
  gallery's search finds the words owners use — dentist, tenant, lease, WhatsApp,
  payroll, gym, hotel, membership — and prefers whole words to one-letter-off
  ones ("lease" no longer finds time off). The demos say "The app was asked to
  share 12 properties with a buyer: …", write days as their boxes do (time off's
  "25 Oct 2026 - 27 Oct 2026", one way with the core's `dayWords`), link the
  record a step opens, and the backlog counts "17 work items".

**And:** the page format is **0.7** (`FORMAT_VERSION`): it only added — a table
of lines' `cards: "never"` — so a 0.1 to 0.6 page is read as it is, and
`upgradePage` writes 0.7 in it.

**Upgrading** — what an app that uses none of the new things sees change:

- A table of lines — a plain one or a grid — is cards on a phone (a form 520px
  wide or less) where its node says nothing: 0.27 kept rows unless it said
  `"cards": "narrow"`. `"cards": "never"` keeps rows.
- A message naming a label that is a question quotes it, and its required
  message is "Please answer “…”" (`messages.requiredQuestion`), where 0.27 wrote
  "How was your visit? is required".
- A message naming a day writes it as the page's date boxes do: "20 Nov 2026"
  (0.27: "November 20, 2026"), "1 Nov 2026, 09:00" (0.27: "November 1, 2026 at
  09:00"), month first where `look.dateOrder` is `mdy`, as stored where `ymd`.
  `whenWords` takes the order as a fifth argument; `Messages` gains `dateOrder?`,
  which the form sets (never a language's table).
- A list card's line is a `div` holding a `dl` of its parts, each a
  `div[data-part]` with its own `dt` and `dd`, in a `div.fd-list-card-lines`
  (0.27: one `dt` of the labels joined and one `dd`, in a `dl`).
- An unanswered slider's output says "Not answered" (0.27: "–") and its range
  stands at its least (0.27: halfway).
- A list under a filter bar shows its count, `.fd-list-found` (a polite status).
- A page of responses' booking slots ask the data source's `slots` again after
  each response sent.
- An app that gives the widgets a whole `labels` object adds `readyToSign` and
  `signNow`; whole `messages` add `requiredQuestion`. `addLanguage` fills any left
  out from English.
- @fieldia/core exports `dayWords`, `isQuestion` and `quotedLabel`
  (`quotedLabel` is on the script's global too).
- A page the designer saves says `"fieldia": "0.7"`: Fieldia 0.27 refuses it as
  newer than it reads. An app that keeps pages for older Fieldias keeps them in
  0.6 (nothing 0.7 adds is in them).

**Size:** `fieldia.js` 506.8 KB, 166.2 gzipped (0.27.0: 504.8, 165.4): a value
worked out from a refused answer waiting, a note of options taken out said only
while true, a question's label quoted, a day written as the date boxes write it.
Of the parts, the survey kinds' grew with the unanswered slider (13.0 KB gzipped,
from 12.7), the list's with its count (41.6, from 41.4), the evidence's with
Sign now (4.4, from 4.2), the cards' with each label beside its value (3.8), the
limits' (5.0, from 4.9); the rest are as they were. A language's add-on is 11.6
to 13.3 KB gzipped.

## 0.27.0 — 2026-10-20

**Forms that finish well: endings chosen by the answers, answers in a page's own
words, more functions and the app's own, options that follow the answers, a
form that opens, closes and counts its places, Continue later on another device,
a signature that signs the answers** — and lists filtered as buyers and sales
teams expect, tables in formatted text, a table line's choices from the app's
lists. The page format is 0.6; a page of 0.1 to 0.5 is read as it is.

**Endings, and the answers in a page's own words.** A page of responses'
`endings` say what it shows once its answers are sent: the first whose `when`
holds on the answers as sent — with what the data source answered, the id it
gave the response and the values it added (`SubmitResult.values`) — else the one
with no `when`, its title, its words (a paragraph a line, `[words](https://…)`
links) and its button to start again, its own words or none. `{id}` in them is
that reference: "Your booking is B-1043". `form.getState().sent` keeps what was
sent until `reset()`; `form.ending()` and `form.endingWords(text)` read it. A
`{field}` shows an answer in a field's label and help, a choice's words, a
step's title and words, a wizard's and a button's words — not only in a text or
an alert — as people read it (a choice by its label, money with its currency, a
day in the page's order) and follows it as it changes; the form's messages name
the field so ("How was your visit to Zamalek? is required"). After a bar, what is
said while the answer is empty: `{branch|this branch}`. A `{name}` naming no
field is refused by the page's check. The endings and the answers in words come
in a part of their own, `fieldia.answers.js`. In the designer: **Once it is
sent** lists a form's endings, each shown by rules on the answers, and a **{ }**
button beside every box where a page's words are typed puts an answer in at the
caret, with **When empty**. The booking demo ends with its reference; a clinic's
feedback asks "How was your visit to {branch}?".

**Sixteen more functions, and your app's own.** `age`, `years`, `months`,
`addDays`, `addMonths`, `addYears` on dates (on the page's clock; a shorter
month's last day kept), `contains`, `startsWith`, `endsWith`, `upper`, `lower`,
`join` on words, `average` and `roundMoney` (to the currency's places) on
numbers, `empty` and `firstOf` to choose — in `compute`, `setWhen`, every
condition and an ending's `when`. An unknown function or a wrong number of
values is refused by the checks; a value of a kind a function does not take is a
**warning**, never a refusal: `validatePage` gives `warnings` beside the page,
`pageWarnings(page)` alone, and the designer says it as a fix to make. `functions`
on `createForm`, the viewer, the designer and the React, Vue and Angular
components gives a page your app's own — a plain function, or `{ call, takes,
values, gives, tip }` — and one that asks your server gives a promise: what is
worked out from it waits, an ellipsis said in words ("Working out Total…"),
asked once for the same values for the record shown, a save waiting for every
answer and asking a failed one again. Their bodies, and the calls of the app's
own, come in `fieldia.functions.js`.

**Options that follow the answers.** An option shows only while a condition
holds (`options[].invisible`: "Garden" only for a villa); a choice may offer the
options picked in an earlier question (`optionsFrom: { field, picked? }`), its
own after them; a table line's options take conditions too, read on the line's
own values and the record it is on (`parent.`). A chosen option a change no
longer offers is taken out of the answer and said — "Garden is no longer
offered, so it was taken out", the same words for one an app's list no longer
offers, under the field, under a line's cell, aloud in a grid
(`form.getState().takenOut`, by path) — and one a record held as it was opened
stays, said to be no longer offered. `form.offered(path)` gives the options
offered now. In the designer: **Show when…** in each option's row, a table's
Choice column's too, and **Picked in another question**. They come in
`fieldia.options.js`. Demos: a listing by its type, a clinic's feedback that
follows the treatments ticked.

**A table line's choices from the app's lists.** A line's choice may take its
options from one of the app's lists (`optionsFrom: { list, dependsOn }`, the
same `optionsFrom` as a page's own choice) by that line's own columns, or the
record's fields as `parent.` and a field: asked through `options` with the line's
values and the record as `parent` (`OptionsRequest.parent`), once for lines
alike, again as a column it changes with changes on that line. A plain table, a
grid, cards, a line's own form and a block pasted all read it; Import reads a
choice that follows another field by each row's own values; rows pasted on a
dropdown cell spread as on a text cell, in every engine. In the
designer: a table's **Choice** column, its options written there or one of the
app's lists with what it changes with. Demo: an AI agent's tools, each line's
from its connection.

**A form that opens, closes and counts its places.** A page of responses'
`limits` — `opens` and `closes` on the page's clock, `maxResponses`,
`onePerPerson`, a `message` of its own — and an option's `seats`: a closed or
full form says so as it opens, in place of its questions, never after it is
filled; each option's places left show beside its words ("3 left", "Full") in
radios, checkboxes, the browser's list, picture cards, Fieldia's own list, a
list that searches and tags; a full option is shown and refused when picked, and
one that filled up meanwhile stops the send. Counts come from the data source's
new optional `limits` member; without it, the dates alone. In the designer: the
Rules tab's Opens, Closes, Most responses, One per person and Words, and a
choice's **Limit places**. Demo: an event's sign-up.

**Continue later, on another device.** A page with `continueLater` keeps its
answers on your server as they are typed and as a wizard's step is entered —
the data source's new `saveDraft` and `loadDraft` — with the step, the steps
skipped and any text typed that does not read yet; **Continue later** shows the
link your app makes, with Copy, and `resume` (the key in that link: the viewer's
and the components' option) opens the draft at its step. Without the two
members, drafts stay in the browser, now with their wizard step. A send carries
the draft's key (`SubmitRequest.draft`, `SaveRequest.draft`). Demo: a long
clinic intake continued from its link.

**A signature that signs the answers.** A signature whose node says `signs`
(`"form"`, or the fields) and `signerField` keeps beside its picture who signed,
when and the SHA-256 of the answers in a stated canonical form,
`fieldia-signature/1` (`FileValue.signed`), so an app can check it again on its
server; the form locks the answers it names, "Signed by Mona Adel, 19 Oct 2026,
11:42" and whether the answers are still as signed show under it, and **Change
answers**, asked first, takes it away to sign again. It comes in
`fieldia.evidence.js`, only for a signature that signs answers; where that part
cannot come, the signature says so — with Try again where asking again can
bring it, else "Reload the page to sign" — and a save refuses the picture
unsigned. Demo: a clinic's consent, signed, then changed in the clinic's system.

**Filters a buyer and a sales team expect.** `filterCounts: true` counts each of
a filter bar's values among the rest of the search ("Villa 5", read as "Villa, 5
homes"), and in the search bar's menu each named filter and favourite ("Late
5"); a number's or a date's field filters by its range as one chip
(`filterRanges`, with a press for each least value: "Bedrooms: 2+"), and a custom
filter takes "is between"; `filterSheet: true` puts the fields in one sheet on a
phone with "Show 37 homes". A choice from the app's list is listed by its
records' values. Demos: homes to buy, a sales queue with "Late 5".

**Tables in formatted text.** A table pasted from Word, Excel, Google Docs or
Sheets into a formatted text is kept, cleaned to plain table markup (cells,
spans, a header row, alignment — no styles, no widths); the work item's editor
gets a table tool where a field names `table` among its `tools`: a size picked
on an 8 by 8 grid, rows and columns added and taken away, a header row, Tab from
cell to cell; GitHub's tables in Markdown both ways; on paper a table is whole
where it fits, else broken between its rows with its header row again. Every
HTML paste into formatted text is made plain in its field's own look — Word's
lists lists again, fonts and colours left behind — and what a Fieldia editor
copies keeps its colours, highlights and sizes (`data-fieldia-copy`). Demo: a
contract's fees pasted as a table.

**Smaller things:**

- **"It's someone new" kept on your server**, every device, where the source has
  `notDuplicates` and `markNotDuplicate`; else in the browser, as before.
- **A table of lines' date column** is as wide as its longest day, beside its
  calendar button: the tender's dates are no longer cut at 1280–1920px.
- fieldia.dev's hero: its list fits beside its JSON from 1180px, and its lines
  never end on a word alone.
- **Smaller main script**: what most pages never use came out of `fieldia.js` —
  the functions beyond the plain ones, options by condition, a form's limits,
  and each feature's page checks (carried by the part that draws it, run before
  the page is drawn); a map's checks in `fieldia.mapchecks.js`, the memory
  source's members in `fieldia.memory.js` (the one-tag script alone).

**Fixes:** a long table's last rows kept on paper in Chromium (a field's overflow
clipped in Firefox only); Google Docs' bold wrapper read; a counted filter named
with its count; two flaky browser tests fixed at their cause (a courier's next
place, a full-page screenshot putting the page back).

**And:** the page format is **0.6** (`FORMAT_VERSION`): it only added — `endings`,
`limits`, `continueLater`, an option's `seats` and `invisible`, `optionsFrom`
from a question and on a line, a signature's `signs` and `signerField`, a list's
`filterRanges`, `filterCounts` and `filterSheet` — so a 0.1 to 0.5 page is read as
it is, and `upgradePage` writes 0.6 in it.

**Upgrading** — what an app that uses none of the new things sees change:

- An app that serves `fieldia.js` itself serves the new parts beside it:
  `fieldia.answers.js`, `fieldia.evidence.js`, `fieldia.limits.js`,
  `fieldia.functions.js`, `fieldia.options.js`, `fieldia.mapchecks.js` and
  `fieldia.memory.js` (the package's `bundle` folder has them).
- In the one-tag script, `checkPage` may say checks it owes a part not come yet
  (`PageValidation.later`): the viewer asks for those parts and runs them before
  drawing, and a mistake found then draws nothing and rejects `drawn`. The
  packages' `checkPage` and `validatePage` stay whole and synchronous.
  `takingWords` and `whenWords` are no longer on the script's global (still
  exported from @fieldia/core).
- In @fieldia/core, the functions beyond the plain ones, options by condition and
  a form's limits load as parts the form asks for itself; code that evaluates an
  expression outside a form awaits `functionsPart.load()` first.
- `lazyPart`, `partsOf`, `settleParts` and `partsComeByScriptTag` are @fieldia/core's
  (@fieldia/widgets still exports them).
- A page's choice from the app's list with `dependsOn`: a value the new answer
  does not offer is taken out after a change, and said (0.26 kept it, said as no
  longer offered); a record that comes in with one keeps it, as before.
- `PART_RANK`: `evidence` is 5 and `limits` 10; the phone's and every rank after
  moved on (themes 11, quiet 12, picker 13, head 14, groups 15, text 16,
  surveyLooks 17, cards 18).
- A formatted text's sanitizer keeps tables (`table`, `thead`, `tbody`, `tr`,
  `th`, `td`, spans, a header's scope, alignment), and every HTML paste into one
  is cleaned, where 0.26 left it to the browser.
- `OptionsFrom` is `OptionsFromList | OptionsFromField`: code reading
  `optionsFrom.list` reads it through `optionsList()`. A page's choice's options
  are `SelectionOption`s (with `invisible`). `PageValidation` gains `warnings?`
  and `later?`.
- `FormState` gains `sent`, `asked`, `takenOut`, `limits` and `resume`; `Form`
  gains `words`, `ending`, `endingWords`, `offered`, `offersChange`,
  `lineChoices`, `continueLater`, `canContinueLater`, `refreshLimits`,
  `keepsNotDuplicates`, `notDuplicates`, `markNotDuplicate`, `now`, `user`,
  `shownFields`, and a line's cell form `line`; `FormOptions` gains `functions`,
  `valueWords` and `resume`. A form's `draft` event tells each draft kept
  (`onDraft`, `@draft`, `(draft)` in the components).
- The memory source's `submitted`, `limits`, `drafts`, `draftLink` and
  `notDuplicatePairs` options, and `answeredElsewhere`.
- An app that gives the viewer a whole `labels` object adds `opBetween`,
  `valueAsking`, `valueNotWorkedOut`, `rangeFrom`, `rangeTo`, `rangeAny`,
  `rangeBetween`, `rangeOrMore`, `rangeUpTo`, `rangeSince`, `rangeUntil`,
  `rangeOrder`, `rangeOrderDate`, `filtersOn`, `filtersClearAll`, `showResults`,
  `showResultsOne`, `showResultsSome`, `signedAnswer`, `closedTyped` and the
  `later…` words and `resumeMissing`; one that gives the widgets a whole `labels`
  object adds the `table…` words, the signature's (`signedByName`, `signedAt`,
  `answersAsSigned`, `answersChanged`, `changeAnswers`, `changeAnswersAsk`,
  `signatureTakenAway`, `notSignedYet`, `notSignedNoPart`, `signingNoPart`,
  `signingRetry`, `notSignedReload`, `signingNoPartReload`) and `seatsLeft`,
  `seatsLeftOne`, `seatsFull`; whole `messages` add `stillWorkedOut`,
  `notWorkedOut`, `notOfferedNow`, `notOfferedNowMany`, `formOpens`,
  `formClosed`, `formFull`, `formSent`, `choiceFull` and `choiceFilled`.
  `addLanguage` fills any left out from English.
- A page the designer saves says `"fieldia": "0.6"`: Fieldia 0.26 refuses it as
  newer than it reads. An app that keeps pages for older Fieldias keeps them in
  0.5 (nothing 0.6 adds is in them).

**Size:** `fieldia.js` 504.8 KB, 165.4 gzipped (0.26.1: 503.4, 162.9; the lanes
merged, before what most pages never use moved to parts, measured 547.6, 178.2).
New parts: `fieldia.evidence.js` 4.2 KB gzipped, `fieldia.answers.js` 2.3,
`fieldia.limits.js` 4.9, `fieldia.functions.js` 2.3, `fieldia.options.js` 2.2,
`fieldia.mapchecks.js` 2.6, `fieldia.memory.js` 5.7 (the one-tag script alone).
Of the parts, the text part grew with tables and the paste cleaner (24.6 KB
gzipped, from 18.8), the list's with ranges, counts and a list's own checks
(41.4, from 35.5), the filters' with counts, ranges and the phone's sheet (7.8,
from 4.2), the lines' with a line's choices and a table's checks (15.5, from
14.0), the files' with a signature's signing (13.6, from 12.3), the head's (10.8,
from 10.0), the business widgets' (11.5, from 11.1), the choice part's places
(4.6, from 4.3), the slots' (6.1, from 5.9). A language's add-on is 11.6 to 13.2
KB gzipped (0.26: 10.4 to 11.8).

## 0.26.1 — 2026-10-19

**Two accessibility fixes**, found by checking fieldia.dev's new front page with
axe in every engine. Nothing an app writes changes.

- **A grouped list is a table whose rows claim no tree.** Its group rows no
  longer carry `aria-level`, which only a treegrid's rows may, and a parent's row
  in a list of records under their parents no longer carries `aria-expanded`;
  its toggle says open or closed. A group's heading is a button named with its
  count in words and its sums ("Cairo, 12 invoices, EGP 4,312,550.00"), in the
  page's own word for its records. The arrow keys cross a heading as they move
  between rows; Right opens it and Left closes it, reversed right to left.
- **A map's credits are targets a finger can press.** Each credit link, and a
  provider's mark where it is a link, is at least 24px tall in the same small
  type (WCAG 2.2, 2.5.8), since a pin can come too close for spacing to excuse a
  smaller one. The credits' strip is 24px tall.

**Upgrading.** An app that passes a whole viewer `labels` object adds
`groupCount`, `groupCountOne`, `groupCountNoun` and `groupCountNounOne`. A test
that found a group row by `aria-level`, or a parent row by `aria-expanded`, finds
the heading's button instead.

**Size.** `fieldia.js` unchanged (162.9 KB gzipped); the list part 35.5 KB.

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
