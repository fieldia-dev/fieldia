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
| A button's key (Alt+…) | viewer.ts `onHotkey` → the button's own path | `save()`, `next()` or a run of steps (below) | yes |
| A run of steps the person or the app set off: a button, its key, a line's button, `form.run` | form.ts `press`, `run` (`RunScope.typed`) | run.ts `typedFirst`, before the run's first step that reads the form or hands its values on — `call`, `set`, `addLine`, `open` with values, a record or a filter, `post`, `openUrl`, any `when`: `form.settle()`, then text that does not read stops the run (`check`), said under its box. One place in the runner, whatever the step. A moment's run (`on.change`, `afterSave`…) takes the values as they are: it never reads a box under the person's keys | yes |
| A signature that signs answers (`options.signs`): a stroke ended, a name typed, a picture picked | signature.ts `sign` (files part) | `form.settle()` before its fingerprint is made: an answer it signs whose text does not read, or still to give, is named under the pad and nothing is signed; one changed while the fingerprint was made is read again. A save waits for a signing on its way (`settling`) | yes |
| Autosave | `scheduleAutosave` (form.ts) | waits while a box is typed in (`typingNow()`); then `save()` | yes |
| Pager, Done, leaving a record | viewer.ts `leave()` and the edit switch | `form.settle()` (awaited while `reading()`), then `save()` | yes |
| Wizard Next, the step list | viewer.ts `wizardForward`, the step buttons | `next()` / `goTo()`; refused while `reading()`, then `settle()` and asked again | yes |
| Steps: `save`, `check`, `goTo` | run.ts `createRunner` | `saving()`, `check()`, `goToStep()` | yes |
| A line's dialog: Save & Close | dialog.ts | `form.settle()` awaited, then its check | yes |
| A line's dialog opened (↗, a card) | lines.ts `openLineDialog` | `form.settle()` awaited first: the dialog shows the line as it reads (a name looked up as its cell was left taken), and Save & Close never writes back what that typing replaced | yes |
| A line's × with `confirmDelete` | lines-table.ts | `form.settle()` awaited: a line holding only text typed (unread) asks first, as one holding a value does | yes |
| A conflict's Reload | form.ts `reloadTheirs` | `readTyped()` awaited; the person's changes set aside, and text that does not read kept unread in its box over their value | yes |
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
  with why ("nothing is called …", "more than one is called …", "still looking for …"). Leaving reads the same way:
  words that name none, or several, stay as typed, unread with why, and the field holds what it held — a save is
  refused in words, never made with it, however fast the source answers. Escape puts back what the box held.
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
| Money | `monetary`, its currency picker (widgets.ts) | as numbers, in its currency's places; what was typed is read again when the currency changes (`readAgain`); its own currency and unit as people write them ("LE 1,500", "12 usd", "12 kg") | unread | yes | R | R | L | P | R | R | R | R |
| Amount in shorthand | `integer`, `float`, `monetary` with `options.shorthand` (widgets.ts `numberBox`, shorthand.ts in the typed part) | as numbers, the text's last word read as the power of ten it names ("3.5m", "٣٫٥ مليون") on the digits; what it reads said under the box as it is typed | unread, the value as entered; a letter no word begins with refused, saying shorthand is taken | yes | R | R | L | P | R | R | R | R |
| Hours, per cent | `float.duration`, `float.percentage` (duration-box.ts) | `read()` on change / blur; passed through with nothing typed, the value stays as it came (its rounded picture never read back); hours typed are kept to the field's places; "6.45" is decimal hours, said under the box | unread ("6:3" names 6:03 and 6:30) | yes | R | R | L | P | R | R | R | R |
| Hours, per cent drawn plainly (before the business part comes) | business-plain.ts `plainNumber` | as the part's box: its limits, its places; change / blur | unread, the value as entered | no guard (by design) | R | R | L | P | R | R | R | R |
| Date, date and time | `date`, `datetime` (date-box.ts, date part) | `settle()` on Enter keydown, change, blur; read in the reader's zone (`DateReader.zone`, the computer's when left out): a time the clocks skip or pass twice is said, never moved; typed back to what it showed, the value as it came | unread, the value as entered; a time left out is said | yes | R | R | L | P | R | R | R | R |
| Time of day | `char.time` (date-box.ts) | as dates | unread ("14.5" names each time) | yes | R | R | L | P | R | R | R | R |
| Range of dates | `date.daterange`, `datetime.daterange` (date-range.ts) | two date boxes | unread, by each box's field | yes | R | R | L | P | R | R | R | R |
| Month alone, year alone | `date` with `precision` (date-box.ts, date-grain.ts, date part) | as dates: a month read whole (10/2026, 2026-10, Oct 2026, أكتوبر ٢٠٢٦) or a year (2026), kept as its first day; a whole day gives its month, the day it leaves out said under the box | unread, the value as entered (months 1 to 12, a year of two digits named both ways) | yes | R | R | L | P | R | R | R | R |
| Hijri day beside a date | `date` with `hijri` (hijri-box.ts, date part) | `settle()` on Enter keydown, change, blur: read in the page's order, its month a number or a name, by Umm al-Qura as Intl keeps it; the Gregorian day written, which the date box shows | unread in its own box, never the date box's ("Jumada I 1448 AH has 29 days"); the field keeps what it held | yes | R | R | L | P | R | R | R | R |
| Repeat rule | `char.repeat` (repeat.ts, schedule part) | its every-how-many and how-many-times are number boxes, its end day a date box, each read as its kind into the rule (`field.interval`, `field.count`, `field.until`); its choices and days are presses | unread: a number under 1 or not whole kept as typed with why, the rule as it was | as its kind | R | R | L | P | R | R | R | R |
| Opening hours | `json.hours` (hours.ts, schedule part) | each shift's from and to is a time box (`char.time`), read as a time into the week (`field.<day>-<shift>-from`); a day opened, closed, copied or split is a press | unread as a time's; a shift ending before it starts or overlapping another is said under its day and kept unread at `field.day-<n>`, so a save is refused until it is put right | yes | R | R | L | P | R | R | R | R |
| Plain date box (before the date part comes) | date-text.ts `plainDateWidget` | change | unread; a time left out is said under the box | no guard (by design) | R | R | L | P | R | R | R | R |
| Text line, password | `char`, `char.password` (text-box.ts) | T; held keys and the trim on change / blur | the field's check (most characters, pattern) | yes | R | R | L | P | R | R | R | R |
| Phone, email, web address | `char.phone`, `char.email`, `char.url` (text-box.ts) | T; digits as 0-9, marks and ends stripped on change / blur | the field's check, with its words | yes | R | R | L | P | R | R | R | R |
| Text typed to a mask | `char` with `options.mask` (mask-box.ts, mask.ts, typed part) | as typed, laid out against the mask: its own characters written in, Backspace over one taking the character before it; taken once every slot it needs is filled — change / blur, Enter, read as left | unread: not whole yet, how many still to type; a character no slot takes there refused, the keys after it taken where they fit | yes | R | R | L | P | R | R | R | R |
| One-time code | `char.one-time-code` (code-box.ts, typed part) | as typed: digits as 0-9, letters in capitals, spaces and dashes let go; taken once whole | unread: how many still to type; a character no code has | yes | R | R | L | P | R | R | R | R |
| Phone read the world over | `char.phone` where the page's `phone` or its options say so (phone-box.ts, phone part; the text box above before it comes) | change / blur: read in the country typed with its + or picked, kept as E.164; a country picked reads it again | unread: no country, no country's code, too short, too long, a start none has; the field keeps what it held | yes | R | R | L | P | R | R | R | R |
| Text in several languages | `char`, `text`, `html` with `translate` (languages-part.ts, languages part) | each language's box is its kind's own (a line, a paragraph, formatted text), its text written into its language's place in the value (`{ ar, en }`); a switch shows one language at a time, and the box left by the switch reads as any box left | as its kind, in its language: "Title (English) is … too long" | as its kind | as its kind | as its kind | L | P | as its kind | as its kind | as its kind | as its kind |
| Paragraph | `text` (text-box.ts) | T; held keys on change / blur | the field's check | yes | own: a new line | R | L | P | R | R | R | R |
| Tags typed as words | `char.tags` (relations.ts `charTagsWidget`) | change / blur adds them; tags waiting for room are taken by a save, a check or leaving once there is room (`settling`) | unread: tags past the most wait for room; another record shown, they go | guard, no refused keys | own: adds the tags | R | L | P | R | R | R | R |
| Colour code | `char.color`, `integer.color` (colour.ts) | a whole code as typed; change / blur reads | unread, the colour as entered | yes | R | R | L | P | R | R | R | R |
| Link, reference | `many2one`, `reference` (relations.ts `combobox`) | W: the exact name, whatever row the list reached (the last list's at once, else looked up; past the search's limit asked for exactly, `SearchRequest.exact`); a reference's name found after its model changed is let go | unread: "nothing is called …" / "more than one is called …" / "still looking for …" | no (free words) | own: the exact name, else the row the arrows reached, else the only match | W (Enter's reading, then the save waits) | L, then W | P | W | W | W | W |
| Tags of links | `many2many`, `many2many.tags`, `many2many.links` (relations.ts `tagsWidget`) | W; a tag already chosen, typed again: the words go, "is already there" | unread | no | own: adds the match | W | L, then W | P | W | W | W | W |
| Path picker | `many2one.path` (path-picker.ts, path part) | W: a whole path, or a name only it has, whatever row is reached | unread: none or several called so | no | own: the exact name, else the row reached | W, however soon: the row reached only when the arrows reached it | L, then W | P | W | W | W | W |
| Choice typed by name | `selection` with a search, `selection.tags` (choice-tags.ts) | its own reader, at once (options are here) | unread: "nothing is called …", the words kept as typed | no | own: the only match | R | L | P | R | R | R | R |
| "Other" answer | `selection.radio`, `selection.checkboxes` (widgets.ts `choiceGroup`) | change / blur: trimmed; naming an option ticks it | — | no | R | R | L | P | R | R | R | R |
| Own list | `selection` with `list: 'own'` (own-list.ts) | — (a letter reaches an option; Enter or Space picks it) | — | — | own: picks | own: picks, then saves | — | — | — | — | — | — |
| Distribution | `json.distribution` (distribution.ts) | shares: change / blur; accounts: W (a link per line) | unread on the field: the share's or the account's | shares yes | R / own | R / W | L, then W | P | R / W | R / W | R / W | R / W |
| Tax totals | `json.tax-totals` (tax-totals.ts) | change / blur | unread on the field | yes | R | R | L | P | R | R | R | R |
| Address | `json.address` (address.ts) | T; trim and the postcode's digits on change / blur | the field's check | no | R | R | L | P | R | R | R | R |
| Map address search | `@fieldia/map` address-suggest.ts | T; typed over, the place picked lets go (change / blur); a place picked is found, W | the field's check | no | own: picks a suggestion | R, then W | L, then W | P | R, then W | R, then W | R, then W | R, then W |
| Place's coordinates | `@fieldia/map` place.ts | change and Enter: `typed()`, as typed (never rounded to six places); a pair pasted into either box fills both | unread on the place's field (the latitude's, for two fields): never a place saved half new | yes | own: reads the place | R | L | P | R | R | R | R |
| Place's search | place.ts (`search`) | a place picked is found, W | said in the map's note | no | own: picks | W | W | P | W | W | W | W |
| Properties | `properties` (properties.ts) | each row is the box of its kind, on the field | as its kind | as its kind | as its kind | as its kind | L | P | as its kind | as its kind | as its kind | as its kind |
| JSON | `json` (extras.ts) | T (`readJson`: a number JSON.parse would change — 20 digits, 1e400 — is not taken) | unread with where it breaks | no | own: a new line | R | L | P | R | R | R | R |
| Code editors | `@fieldia/code`, `@fieldia/monaco` | T | unread with where it breaks (JSON) | no | own: a new line (one line: as text) | T | L | T (CodeMirror), P (Monaco's box) | T | T | T | T |
| Formatted text | `html`, the text part's rich and Markdown editors; HTML pasted in either rich editor (Word's, Docs', a page's) is put in cleaned (pasted-html.ts), as one step Undo takes back; words alone are the browser's | T | — | no | own: a new line; the link row: applies; in a table, Tab (the next cell, a row past the last) and Escape (out of the table) are the table's | T (from the link row: applies, then saves) | L | T (rich), P (Markdown) | T | T | T | T |
| Web page, copy | `char.embed`, `char.copy`, `text.copy` | T | the field's check | no | R | R | L | P | R | R | R | R |
| Table of lines, cards | `one2many`, `one2many.cards` (lines.ts, cards.ts) | each cell is its kind's box (`lineForm`); its reader leaves with its line | as its kind, by the cell's path | as its kind | as its kind | as its kind | L | P | as its kind | as its kind | as its kind | as its kind |
| Grid cells | `@fieldia/grid` (`FieldiaCellEditor`) | the kind's box in the cell's editor; a name read once the editor has closed lands in its cell; an editor taken away without a blur (Firefox, WebKit) has its name box read as leaving reads it | as its kind: the cell shows the words, marked, with why | as its kind | own: the grid's (the cell, the next row) | own: the grid's (a note's end) | L (the editor closes as its cell loses the focus) | P | R | R | R | R |
| Grid paste on chosen cells | grid.ts `pasteBlock`, cell-paste.ts | each cell read as its column reads; a spreadsheet's quoted cell (line breaks, tabs, quotes inside) is one cell | not pasted, named **with why** (as its box says it): another currency named, words past the column's most said by how much | — | — | — | — | — | — | — | — | — |
| Photo set's caption | `image.photos` (photos.ts, photos part) | T; trimmed on change / blur, an empty one takes the caption away; a box typed in is never written over by a change elsewhere (a photo moved, a crop stored), its tile kept in place in the page while it has the focus | — | no | R | R | L | P | R | R | R | R |
| Slider, rating, scale, yes/no, priority, state dot, status bar, checkboxes, radios, ranking, pictures, matrix, files, image, signature, timer, link checkboxes, link table, a photo set's order and crop | widgets.ts and their files | — | — | — | — | — | — | — | — | — | — | — |

In the **Next** column for a wizard, Next reads like a check: it refuses while a name is still being looked up. The
viewer then waits (`settle()`) and asks again.

**A part's box taking its plain stand-in's place** (widget-parts.ts `partWidget`, for an app that draws without
`loadParts`). Text typed in the stand-in's box and not yet read is never read as the box goes (Chromium sends it a
change and a blur; Firefox and Safari none — the stand-in hears neither, in every engine), nor dropped: the part's
widget takes it as typed (`Widget.takeTyped`): its own box, focused, the caret where it was, and what the field held as
the box was entered — "2." stays "2.", never 2 shown as "2" under the next key. A links box, with no box to type in,
reads the words then (the record so called linked, or kept unread with why; a save waits). A widget that cannot take the
text as it stands (a slider, "2." on its way to 2.5) leaves the stand-in's box beside it, focused, until it is left;
it reads what it holds then and goes. Text the stand-in left unread is the form's, and the part's widget shows it marked.

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
one, with why. A date reads in the page's order, and a day and time — written the ISO way or the page's — says the time
it would leave out before it is taken.

### A press is the button's

A box left by a press of the pointer — its focus going to the button pressed — may say or unsay words under itself as it
is left (a refused paste's words going, a name found to be none). Those words wait for the press to end
(`press.ts` `afterPress`, used by every `refusalHint`), so nothing under the pointer moves before the release: the click
is the button's — Apply, Save — never lost on what moved under it.
The search bar, the filter bar, the map's search box and a chatter's composer are not saved with the record.

### A code scanned

A code read with the camera (`options.scan`, the scan part's `scan.ts`) is a pick, not typing: what it names — words,
a GS1 code's part, a link's record found by its code — is written at once (`setValue`, a person's change), the fields
its GS1 code fills first, and text left unread in those boxes goes with it (`setUnread(path, null)`), as a record picked
from a link's list takes the words typed. A code that names none, or several, or holds no part the field takes, writes
nothing: it is said in the camera's sheet, which reads on. An answer for a record no longer shown is laid on none. A
scanner gun is typing: its keys and its Enter are the box's, every row of the table above as it stands.

## 3. The hold: every way text arrives

A box with the shared guard (`libs/widgets/src/lib/input-rules.ts` `guard`, `rules.hold`) holds the keys typed after a
refused one, with the same words, however the text arrives:

| How text arrives | What happens where keys are held | Where |
|---|---|---|
| Typing | held with them, the words said again | `onBeforeInput` (`typing`) |
| Paste (Ctrl+V, the menu) | joins them, the words said again: never lands beside the text typed before the refused key | `take()` (`held && holding()`) |
| Drop | as a paste | `take()` |
| IME (composition) | what it makes is put back and held with them; the Enter that takes its word, and its other keys, are the IME's — never a name box's, a list's or the grid's (`isComposing`, key 229) | `onCompositionStart` / `onCompositionEnd` |
| Autocorrect, a spelling's correction (`insertReplacementText`) | refused while keys are held, the words said | `onBeforeInput` |
| A phone keyboard's keys (not cancelable) | put back once they land, and held | `onBeforeInput` / `onInput` |
| Backspace | takes back the last key held | `deleteContentBackward` |
| A word's or line's deletion, Undo | all held keys go | `letGoHeld()` |
| A deletion after the caret | lands; the keys stay held where they wait | `rebase` |
| Delete on the text chosen (the keys were typed over it) | lands, and the held keys go with it: the box is emptied as asked | `letGoHeld()` |
| Moving the caret | lets them go | `holding()` |
| Enter in a one-line box | never judged, held or stopped | `insertLineBreak` / `insertParagraph` |
| The browser's autofill, a password manager (no beforeinput; Firefox's cannot be stopped) | in a box the person is not in: cleaned as a paste, kept whole, never put back; read at once as a box left (the viewer's change), its problem said. In the box they are in: judged as keys, all of it held when refused, said, taken as the box is left | `onInput` (`autofilled`), viewer.ts |

A mask's text and a one-time code's boxes hold nothing (0.31's walk: "10a2345" showed "1 0" until the box was left): their
guard `stay`s instead — the keys after a refused one go in where they fit, the refusal's words said meanwhile, until a
deletion or the box is left; a paste with words round the value gives the one value in them (`valueIn`), else is refused.
Every other guard holds: numbers, money, hours, per cents, shares, tax amounts, dates, months, years, Hijri days, times, ranges, every text kind (a
phone read the world over among them), the colour code, a place's coordinates, the designer's number and date settings, and the filter's number. The guard of
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
| A coordinate that does not read stops a save; one that reads stays as typed beside it | map `place.spec.ts`, `address-search.spec.ts` | `e2e/input-commit.spec.ts`, `e2e/input-numbers.spec.ts` |
| JSON that does not read stops a save | code `code.spec.ts`, monaco `monaco.spec.ts` | `e2e/code-editors.spec.ts` |
| Enter and Ctrl+Enter as in 0.20 | viewer `typing-save.spec.ts` | `e2e/input-keys.spec.ts`, `e2e/keys.spec.ts` |
| A paste into the grid says why a cell was left | grid `cell-paste.spec.ts`, `grid-input-rules.spec.ts` | `e2e/input-tables.spec.ts` |
| The designer reads a setting before a publish; a refused date is said | designer `input-settings.spec.ts`, `date-setting.spec.ts` | — |
| A day and time where a day goes says the time left out | widgets `plain-date.spec.ts`, viewer `custom-filter.spec.ts`, `rules-custom-filter-day-and-time-in-page-order.spec.ts` | `e2e/input-keys.spec.ts` (the date box) |
| A run of steps reads what is typed first; text unread is work at risk; Reload keeps it | core `typed-first.spec.ts` | `e2e/rules-call-step-reads-typed-first.spec.ts`, `rules-way-out-asks-about-unread-text.spec.ts`, `rules-reload-keeps-unread-text.spec.ts` |
| A name typed taken as meant: none or several kept unread on leaving, an exact name whatever is reached, past the limit, a reference's model, the IME's Enter | widgets `names-taken.spec.ts`, `rules-link-*.spec.ts`, `rules-names-enter-while-composing.spec.ts`, `rules-reference-model-changed-while-looked-up.spec.ts`, `rules-tags-name-already-chosen.spec.ts` | `e2e/rules-link-save-button-name-of-none.spec.ts`, `rules-path-ctrl-enter-same-whatever-the-pace.spec.ts` (three engines) |
| Lines: a cell's name of none said in the grid, a dialog waiting, `confirmDelete` over typed text, tags waiting for room | widgets `lines-typed.spec.ts`, `rules-char-tags-waiting-when-room-made.spec.ts` | `e2e/rules-grid-link-cell-name-of-none-said.spec.ts`, `rules-grid-line-dialog-keeps-name-found.spec.ts`, `rules-lines-confirm-delete-typed-text.spec.ts` |
| A grid paste: quoted cells, another currency, past a column's most | grid `cell-paste.spec.ts`, `rules-paste-*.spec.ts` | — |
| A press is the button's | widgets `press.spec.ts` | `e2e/rules-custom-filter-apply-after-refused-paste.spec.ts` |
| A signature signs the answers as read: typed text read first, one that does not read or is still to give said, a save waiting for it | widgets `signature-signs.spec.ts` | `e2e/signature-evidence.spec.ts` (Chromium, Firefox, WebKit) |
| A part's box takes what was typed in its stand-in | widgets `part-swap-lazy.spec.ts`, `business-lazy.spec.ts` | `e2e/rules-part-swap-keeps-typing.spec.ts` (Chromium, Firefox, WebKit) |
| A code scanned: written as a pick, unread text in its boxes replaced, none or several said, a record gone laid on none | widgets `scan.spec.ts`, `scan-lazy.spec.ts` | `e2e/scan.spec.ts` (Chromium, Firefox, WebKit) |
| Read, never rewritten: hours and a per cent passed through, money's currency changed, JSON numbers, a zone's clocks | widgets `read-not-rewrite.spec.ts`, core `clock-changes.spec.ts` | `e2e/rules-hours-percent-*.spec.ts`, `rules-money-*`, `rules-datetime-clock-change-time-said.spec.ts` |

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
- **Work at risk.** Text left that does not read is the person's work as a change is: after a save, a way out asks
  about it (`workAtRisk`, `state.unsent`); before a record's first save neither is at risk, as in 0.20.
- **Closing the tab or the window.** Fieldia saves nothing as the page goes, so nothing old or half typed is saved. A
  host that wants to ask first does it in its own `beforeunload`: `form.settle()` (it reads what is typed at once; a
  name looked up is kept unread meanwhile), then `form.getState().dirty` and `unread`.
