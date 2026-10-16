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

## Unreleased

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

**Upgrading:** for an app with none of 0.22's data source members, two things
are new: a line's dialog asks before Escape drops a change, and the `save`
event's `values` are the record as that save left it — a change typed while it
was on its way is no longer among them.

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
