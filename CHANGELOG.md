# Changelog

What changed in each release of Fieldia, newest first, in plain words. Every
package (`@fieldia/core`, `widgets`, `viewer`, `grid`, `code`, `monaco`, `map`,
`chatter`, `react`, `vue`, `angular`, `designer`) is released together at one
version, so one entry covers them all.

**Before 1.0**, a minor version (0.19 → 0.20) may change what an app writes.
Each such change is listed under **Upgrading** in its release. A page saved by
an older Fieldia keeps working: its format version (`"fieldia"`) says which
shape it has, and the viewer and the designer bring it up to date as they read
it (see `upgradePage` in the docs' page format page).

Each release's section is written in the commit that sets its version.
`node tools/release.mjs check` refuses a version that has no section here, and
`publish` prints the section with the git tag and the GitHub release commands.

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
