# The input rules — every box, every way a value is committed

The sweep of round 4 for 0.20.1 (branch `inputs`, fixed on `inputs-fix4`). It lists every kind of box Fieldia
draws — the registry in `libs/widgets/src/lib/widgets.ts` (`builtInWidgets`), the parts loaded on first use, and the
add-ons (`@fieldia/map`, `@fieldia/code`, `@fieldia/monaco`, `@fieldia/grid`, `@fieldia/designer`) — against every way
a value is committed. Each pair either reads the typed text through its reader, or keeps it unread with the reason
(`FormState.unread`) so the commit refuses. The next review checks this table against the code.

**The rules.** Refuse what can never be valid, and say why. Accept every right way to write a value. Never change a
value silently. Never lose what was typed. Enter and Ctrl+Enter behave as they did in 0.20. Hide, never disable. Words in
en, ar, fr and de (the designer speaks en and ar).

---

## 1. One choke point: `readTyped`

Every commit of a record or a response goes through `readTyped()` in `libs/core/src/lib/record/form.ts` before it checks
or writes anything. There is no other way to save.

| Way a value is committed | Where it starts | How it reaches `readTyped` | Waits for a name looked up |
|---|---|---|---|
| Enter in a one-line box | the browser's implicit submission → `submitOrSave` (viewer.ts) | `form.save()` → `saving()` | yes (`await readTyped()`) |
| Ctrl+Enter / ⌘+Enter | viewer.ts `keydown` (not in a grid, not in a slot) → `wizardForward` or `submitOrSave` | `save()` or `next()` | yes |
| Save / Submit button | a click: the box is left first (its blur and change read it), then the submit | `save()` | yes |
| A button's key (Alt+…) | viewer.ts `onHotkey` → the button's own path | `save()`, `next()` or a run of steps | yes |
| Autosave | `scheduleAutosave` (form.ts) | waits while a box is typed in (`typingNow()`); then `save()` | yes |
| Pager, Done, leaving a record | viewer.ts `leave()` and the edit switch | `form.settle()` (awaited while `reading()`), then `save()` | yes |
| Wizard Next, the step list | viewer.ts `wizardForward`, the step buttons | `next()` / `goTo()`; refused while `reading()`, then `settle()` and asked again | yes |
| Steps: `save`, `check`, `goTo` | run.ts `createRunner` | `saving()`, `check()`, `goToStep()` | yes |
| A line's dialog: Save & Close | dialog.ts | `form.settle()` awaited, then its check | yes |
| A saved form placed on the page | the page round it | `readTyped` settles every attached inner form | yes |
| The app: `form.save()`, `form.next()`, `form.goTo()` | the host | as above | yes |
| The app: `form.validate()` | the host | `readTyped()`; it cannot wait | no: a name still looked up is refused with "still looking for …"; `await form.settle()` first to wait |
| The designer: Publish | publish-ui.ts (a dialog: the box is left first) or the app's `designer.publish()` | `designer.settling` readers (chrome.ts) | — (no lookups) |

`readTyped` runs two kinds of reader (`form.settling(read, typing?)`):

- **The viewer's** (`commitTyping`, viewer.ts): a `change` sent to the box that has the focus (an `INPUT` that is typed
  in, or a `TEXTAREA`). Every box reads on `change` exactly as it reads when it is left.
- **The box's own**, for a reading that is not on the focused box or that waits: a link's, a path's or a choice's name
  (relations.ts, path-picker.ts, choice-tags.ts) and a place being found (place.ts, address-suggest.ts). A reader that
  waits keeps the text unread at once ("still looking for …") and returns the wait. A save waits for it. A check refuses
  meanwhile.

`typing` says a box is still being typed in, that is, typed in since it last read. Autosave waits while any box says so.
It never reads text under the person's keys: not "12." of "12.5", not "Office " of "Office Park", not a name half typed.
The viewer tracks this for every box (an `input` since the last `change` or focusout). The name boxes track it for hosts
without the viewer.

## 2. Every box × every commit

The letters in the table:

- **R**: read through its reader before the commit (the viewer's `change`, which the box reads as it reads leaving).
  The value is taken, or the text is kept unread with why and the commit refuses.
- **W**: the box's own reader, which a save waits for. The record or option named is taken, or the text is kept unread
  with why ("nothing is called …", "still looking for …").
- **L**: the box is left first (focus moves to the button), and leaving reads it as R does.
- **T**: written as typed. Every key is the value, so there is nothing to read. Text that is not a value (JSON that does
  not parse) is kept unread with where it breaks.
- **P**: autosave waits while the box is typed in. Once the box is left, or Enter commits it, autosave saves as R does.
- **own**: the key belongs to the box, as in 0.20, and is described.
- **—**: no typed text. A press, a pick or a drag is the value.

Columns: **Enter** · **Ctrl+Enter** · **Save** (the button) · **Auto** (autosave) · **Leave** (pager, Done, leaving) · **Next** (wizard Next, a step) · **Steps** (save, check and goTo steps) · **App** (`form.save()`, `next()`, `goTo()`; `validate()` as noted in §1).

| Box | Widget (file) | Reads into the value | Text that does not read | Hold | Enter | Ctrl+Enter | Save | Auto | Leave | Next | Steps | App |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Whole number, decimal | `integer`, `float` (widgets.ts `numberWidget`) | `read()` on change / blur; on the way, only what reads and fits | unread, the value as the box was entered | yes | R | R | L | P | R | R | R | R |
| Money | `monetary`, its currency picker (widgets.ts) | as numbers, in its currency's places | unread | yes | R | R | L | P | R | R | R | R |
| Hours, per cent | `float.duration`, `float.percentage` (duration.ts) | `read()` on change / blur | unread ("6:3" names 6:03 and 6:30) | yes | R | R | L | P | R | R | R | R |
| Date, date and time | `date`, `datetime` (date-box.ts, date part) | `settle()` on Enter keydown, change, blur | unread, the value as entered; a time left out is said | yes | R | R | L | P | R | R | R | R |
| Time of day | `char.time` (date-box.ts) | as dates | unread ("14.5" names each time) | yes | R | R | L | P | R | R | R | R |
| Range of dates | `date.daterange`, `datetime.daterange` (date-range.ts) | two date boxes | unread, by each box's field | yes | R | R | L | P | R | R | R | R |
| Plain date box (before the date part comes) | date-text.ts `plainDateWidget` | change | unread; a time left out is said under the box | no guard (by design) | R | R | L | P | R | R | R | R |
| Text line, password | `char`, `char.password` (text-box.ts) | T; held keys and the trim on change / blur | the field's check (most characters, pattern) | yes | R | R | L | P | R | R | R | R |
| Phone, email, web address | `char.phone`, `char.email`, `char.url` (text-box.ts) | T; digits as 0-9, marks and ends stripped on change / blur | the field's check, with its words | yes | R | R | L | P | R | R | R | R |
| Paragraph | `text` (text-box.ts) | T; held keys on change / blur | the field's check | yes | own: a new line | R | L | P | R | R | R | R |
| Tags typed as words | `char.tags` (relations.ts `charTagsWidget`) | change / blur adds them | unread: tags past the most wait for room | guard, no refused keys | own: adds the tags | R | L | P | R | R | R | R |
| Colour code | `char.color`, `integer.color` (colour.ts) | a whole code as typed; change / blur reads | unread, the colour as entered | yes | R | R | L | P | R | R | R | R |
| Link, reference | `many2one`, `reference` (relations.ts `combobox`) | W: the exact name (the last list's at once, else looked up) | unread: "nothing is called …" / "still looking for …" | no (free words) | own: the only match or the exact name | W (Enter's reading, then the save waits) | L, then W | P | W | W | W | W |
| Tags of links | `many2many`, `many2many.tags`, `many2many.links` (relations.ts `tagsWidget`) | W | unread | no | own: adds the match | W | L, then W | P | W | W | W | W |
| Path picker | `many2one.path` (path-picker.ts, path part) | W: a whole path, or a name only it has | unread: none or several called so | no | own: the match | W | L, then W | P | W | W | W | W |
| Choice typed by name | `selection` with a search, `selection.tags` (choice-tags.ts) | its own reader, at once (options are here) | unread: "nothing is called …" | no | own: the only match | R | L | P | R | R | R | R |
| "Other" answer | `selection.radio`, `selection.checkboxes` (widgets.ts `choiceGroup`) | change / blur: trimmed; naming an option ticks it | — | no | R | R | L | P | R | R | R | R |
| Own list | `selection` with `list: 'own'` (own-list.ts) | — (a letter reaches an option; Enter or Space picks it) | — | — | own: picks | own: picks, then saves | — | — | — | — | — | — |
| Distribution | `json.distribution` (distribution.ts) | shares: change / blur; accounts: W (a link per line) | unread on the field: the share's or the account's | shares yes | R / own | R / W | L, then W | P | R / W | R / W | R / W | R / W |
| Tax totals | `json.tax-totals` (tax-totals.ts) | change / blur | unread on the field | yes | R | R | L | P | R | R | R | R |
| Address | `json.address` (address.ts) | T; trim and the postcode's digits on change / blur | the field's check | no | R | R | L | P | R | R | R | R |
| Map address search | `@fieldia/map` address-suggest.ts | T; typed over, the place picked lets go (change / blur); a place picked is found, W | the field's check | no | own: picks a suggestion | R, then W | L, then W | P | R, then W | R, then W | R, then W | R, then W |
| Place's coordinates | `@fieldia/map` place.ts | change and Enter: `typed()` | unread on the place's field (the latitude's, for two fields): never a place saved half new | yes | own: reads the place | R | L | P | R | R | R | R |
| Place's search | place.ts (`search`) | a place picked is found, W | said in the map's note | no | own: picks | W | W | P | W | W | W | W |
| Properties | `properties` (properties.ts) | each row is the box of its kind, on the field | as its kind | as its kind | as its kind | as its kind | L | P | as its kind | as its kind | as its kind | as its kind |
| JSON | `json` (extras.ts) | T | unread with where it breaks | no | own: a new line | R | L | P | R | R | R | R |
| Code editors | `@fieldia/code`, `@fieldia/monaco` | T | unread with where it breaks (JSON) | no | own: a new line (one line: as text) | T | L | T (CodeMirror), P (Monaco's box) | T | T | T | T |
| Formatted text | `html`, the text part's rich and Markdown editors | T | — | no | own: a new line; the link row: applies | T (from the link row: applies, then saves) | L | T (rich), P (Markdown) | T | T | T | T |
| Web page, copy | `char.embed`, `char.copy`, `text.copy` | T | the field's check | no | R | R | L | P | R | R | R | R |
| Table of lines, cards | `one2many`, `one2many.cards` (lines.ts, cards.ts) | each cell is its kind's box (`lineForm`); its reader leaves with its line | as its kind, by the cell's path | as its kind | as its kind | as its kind | L | P | as its kind | as its kind | as its kind | as its kind |
| Grid cells | `@fieldia/grid` (`FieldiaCellEditor`) | the kind's box in the cell's editor | as its kind | as its kind | own: the grid's (the cell, the next row) | own: the grid's (a note's end) | L (the editor closes as its cell loses the focus) | P | R | R | R | R |
| Grid paste on chosen cells | grid.ts `pasteBlock`, cell-paste.ts | each cell read as its column reads | not pasted, named **with why** (as its box says it) | — | — | — | — | — | — | — | — | — |
| Slider, rating, scale, yes/no, priority, state dot, status bar, checkboxes, radios, ranking, pictures, matrix, files, image, signature, timer, link checkboxes, link table | widgets.ts and their files | — | — | — | — | — | — | — | — | — | — | — |

In the **Next** column for a wizard, Next reads like a check: it refuses while a name is still being looked up. The
viewer then waits (`settle()`) and asks again.

### The designer's settings

The designer saves no record. Its commit is a setting kept in the page, and then a version published.

| Box | File | Enter | Leaving (Tab, a click) | Publish (its dialog) | `designer.publish()` by the app | Drafts |
|---|---|---|---|---|---|---|
| Number settings | number-box.ts | reads | reads | L | read first (`designer.settling`, chrome.ts) | saved after each change kept; a live preview's value passed on the way goes back as the box is left |
| Date settings | date-setting.ts | reads | reads | L | read first | as above; a date the designer refuses is never refused in silence |
| Formula | rules-formula-box.ts | reads | reads | L | read first | "not in force yet" until it reads |
| Words (title, labels, options) | chrome.ts, kind-settings.ts | — (T) | — | — | — | T |
| The page's JSON | json-code.ts | own: a new line; Ctrl+Enter applies | kept in the editor | not applied: never published unapplied, and kept | as Publish | — |

A setting that does not fit keeps what it held. The box shows that value and says why under it ("Height is a whole
number, 120 or more. It stays 600."). This is the designer's rule since 0.19.

### Not a value: filters and searches

The custom filter's value (custom-filter.ts) is read when Apply is pressed. A number keeps its keys held after a refused
one, with why. A date reads in the page's order, and a day and time says the time it would leave out before it is taken.
The search bar, the filter bar, the map's search box and a chatter's composer are not saved with the record.

## 3. The hold: every way text arrives

A box with the shared guard (`libs/widgets/src/lib/input-rules.ts` `guard`, `rules.hold`) holds the keys typed after a
refused one, with the same words, however the text arrives:

| How text arrives | What happens where keys are held | Where |
|---|---|---|
| Typing | held with them, the words said again | `onBeforeInput` (`typing`) |
| Paste (Ctrl+V, the menu) | joins them, the words said again: never lands beside the text typed before the refused key | `take()` (`held && holding()`) |
| Drop | as a paste | `take()` |
| IME (composition) | what it makes is put back and held with them | `onCompositionStart` / `onCompositionEnd` |
| Autocorrect, a spelling's correction (`insertReplacementText`) | refused while keys are held, the words said | `onBeforeInput` |
| A phone keyboard's keys (not cancelable) | put back once they land, and held | `onBeforeInput` / `onInput` |
| Backspace | takes back the last key held | `deleteContentBackward` |
| A word's or line's deletion, Undo | all held keys go | `letGoHeld()` |
| A deletion after the caret | lands; the keys stay held where they wait | `rebase` |
| Moving the caret | lets them go | `holding()` |
| Enter in a one-line box | never judged, held or stopped | `insertLineBreak` / `insertParagraph` |

Every guard holds: numbers, money, hours, per cents, shares, tax amounts, dates, times, ranges, every text kind, the
colour code, a place's coordinates, the designer's number and date settings, and the filter's number. The guard of
typed tags refuses no keys. A box with no guard reads whole words when it is left or saved: link, path and choice names,
the plain date box, the code and JSON editors, formatted text, and the filter's date. Held keys are part of what was
typed. Leaving and every save in §1 take them into the box and read all of it.

## 4. Where each pair is tested

| What | Unit | Browser (en, ar rtl, fr; React once) |
|---|---|---|
| A save, a check, a step and a step jump wait for a name looked up | core `settle.spec.ts` | `e2e/input-commit.spec.ts` |
| Autosave waits while a box is typed in | core `settle.spec.ts`, viewer `typing-save.spec.ts`, widgets `names-save.spec.ts` | — (autosave has no demo switch) |
| Link, tags, reference, path, choice, distribution names on every save | widgets `names-save.spec.ts`, viewer `typing-names.spec.ts` | `e2e/input-commit.spec.ts` |
| A line taken away takes its cell's reading with it | widgets `names-save.spec.ts` | — |
| The hold: paste, drop, IME, correction | widgets `input-hold.spec.ts` | `e2e/input-commit.spec.ts` (paste) |
| Text and an address settle the same whichever key saved | widgets `input-rules-save.spec.ts` | `e2e/input-keys.spec.ts` |
| A coordinate that does not read stops a save | map `place.spec.ts`, `address-search.spec.ts` | `e2e/input-commit.spec.ts` |
| JSON that does not read stops a save | code `code.spec.ts`, monaco `monaco.spec.ts` | `e2e/code-editors.spec.ts` |
| Enter and Ctrl+Enter as in 0.20 | viewer `typing-save.spec.ts` | `e2e/input-keys.spec.ts`, `e2e/keys.spec.ts` |
| A paste into the grid says why a cell was left | grid `cell-paste.spec.ts`, `grid-input-rules.spec.ts` | `e2e/input-tables.spec.ts` |
| The designer reads a setting before a publish; a refused date is said | designer `input-settings.spec.ts`, `date-setting.spec.ts` | — |
| A day and time where a day goes says the time left out | widgets `plain-date.spec.ts`, viewer `custom-filter.spec.ts` | `e2e/input-keys.spec.ts` (the date box) |

## 5. Known limits

- **A host with no viewer.** A host that uses `createForm` and `createWidget` without the viewer has the boxes' own
  readers (names, places). Every other box is read when it is left: the viewer's `change` to the focused box is the
  viewer's. Such a host calls `form.settle()` after it moves the focus off the box.
- **`form.validate()` is synchronous.** A name still being looked up is refused with "still looking for …". The viewer
  and the steps wait (`settle()`) and ask again.
- **Autosave and long notes.** Autosave waits while the focus stays in a box typed in. A long note is saved once its box
  is left, never mid-word.
- **The grid's own keys.** Ctrl+Enter inside the grid is the grid's (a note's end), as in 0.20, and saves nothing. The
  Save button leaves the cell first.
