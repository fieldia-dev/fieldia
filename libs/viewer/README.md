# @fieldia/viewer

Show a [Fieldia](https://fieldia.dev) page and let people fill it in. Plain DOM,
no framework: sections, tabs and wizards, the statusbar, stat buttons, drafts,
lists of records with a search bar, right-to-left layout, and messages in
English, Arabic, German and French.

```sh
npm install @fieldia/viewer
```

```ts
import { mountViewer } from '@fieldia/viewer';
import { createMemoryDataSource } from '@fieldia/core';
import page from './signup.page.json';

const viewer = mountViewer(document.getElementById('app')!, {
  page,
  dataSource: createMemoryDataSource(),   // or your own DataSource
  skin: 'outlined',                       // or 'underline', or 'quiet': values as words until wanted
  locale: 'en',                           // 'ar' lays the form out right to left
});
// later: viewer.destroy()
```

## Your app's own functions

`functions` gives a page's formulas your app's own functions, beside Fieldia's —
`compute`, `setWhen` and every condition call them by name (see `@fieldia/core`).
A page calling one is checked with them as it is mounted, and so are its dialogs,
side panels and saved forms placed in it:

```ts
mountViewer(host, {
  page,
  functions: {
    districtPrice: { asks: true, call: (district) => api.average(district) },   // a promise: it asks your server
    vatRate: (country) => RATES[country] ?? 0,
  },
});
```

A value worked out from one that asks shows an ellipsis while it is asked, said in
words ("Working out Total…", `labels.valueAsking`), and its answer when it comes;
one whose answer did not come says why, in sight ("Total could not be worked out:
…. Saving tries again.", `labels.valueNotWorkedOut`). Save waits for every answer.
React, Vue and Angular take the same `functions`; each call reaches the newest
object given (`newestFunctions`), and a name added or taken away mounts the form
again.

A choice whose options follow the other answers — an option's `invisible`, or
`optionsFrom: { "field": … }` — is drawn again as they change, and a chosen option
a change no longer offers is taken out and said under its field ("Garden is no
longer offered, so it was taken out").

## A part that fails

A widget (yours, or one of Fieldia's given what it cannot draw), a slot's content,
a map or any other part that throws as it is drawn or brought up to date shows a
small box in its place — "This field could not be shown: Price", "This part could
not be shown" — and the rest of the form goes on working, saving included. The
console is told, and so is `onError`, with where:

```ts
mountViewer(host, {
  page,
  dataSource,
  onError(error, where) {
    // { stage: 'update', part: 'field', field: 'price', node: 'f-price', widget: 'monetary.tag' }
    // { stage: 'draw', part: 'slot', name: 'planner', node: 'n-planner' }
    report(error, where);
  },
});
```

A slot's renderer is given `fail(error)` too, for content that fails after it was
drawn: the slot then shows its box.

## A public form: autofill and a bot check

Every box tells the browser what it may fill it in with and a phone which
keyboard to show (the field node's `autocomplete` and `inputmode`, or its
kind's own). What the browser fills in is the person's own: read as typed, and
a box filled from a pick in another one is read at once, as one left, its
problem said there.

A page of responses with a `botCheck` gets a box no person sees, reaches with
Tab or hears read out — inert, so no browser fills it either — and each send
tells the app what was seen (`submit({ pageId, values, bot })`, and the `send`
event). The app's captcha goes in a slot of the page, named by
`botCheck.captcha`, and hands its token to the form:

```ts
mountViewer(host, {
  page,            // "botCheck": { "minSeconds": 3, "captcha": "captcha" }, a { "type": "slot", "name": "captcha" } placed
  dataSource,      // its submit gets bot: { honeypot, tooFast, seconds, captcha }
  slots: {
    captcha: (element, { form }) => {
      const id = turnstile.render(element, {
        sitekey,
        callback: (token) => form.botCheck({ captcha: token }),
        'expired-callback': () => form.botCheck({ captcha: null }),
      });
      // A token is spent once sent: a fresh one for the next response.
      const spent = form.on('send', () => turnstile.reset(id));
      return () => (spent(), turnstile.remove(id));
    },
  },
});
```

Nothing is refused on the page for what the check saw: the app decides.

## Saved forms placed in a page

A page may place another saved page in it by its id — an address made once,
placed twice (see `@fieldia/core`'s `form` part). The viewer draws it where it
stands, from the page `pages` gives for its id, its fields checked by its own
rules and its answers nested under the part's name in `form.getState().values`
and what is sent:

```ts
mountViewer(element, {
  page,                     // places { "type": "form", "page": "address", "name": "home_address", … }
  dataSource,
  // The app's pages: a record by key, or a function asked for each, which may answer with a promise.
  pages: async (request) => {
    if ('model' in request) return customerPage;                      // a link's record, in a dialog
    const reply = await fetch(`/api/forms/${request.id}?version=${request.version ?? 'latest'}`);
    return reply.ok ? reply.json() : null;                           // a saved form, by id and version
  },
});
```

`pages` is one option for every part that shows another page: a saved form is
asked for by `{ id, version }` (a record of pages is read by `id`, or
`id@version` for a version kept to), and a link's record in a dialog by
`{ model }` (the older `relatedPages`, by model only, is still read after it).
While a saved form comes, its place shows a quiet "Loading…"; one that cannot
be found, would be placed inside itself, or is not a page of sections or tabs
says so in its place, in the page's language. The React, Vue and Angular
bindings take `pages` too.

## Pages in dialogs and side panels

`openFormDialog` opens a page over the one shown — a new related record, a
line to edit — and `openFormPanel` opens one in a side panel: full height at
the inline-end edge (the left, right to left) unless its `side` names another,
the page behind dimmed but in sight, the whole screen on a phone. Both take
`mountViewer`'s options and hand back `{ saved, recordId, values }`:

```ts
import { openFormDialog, openFormPanel } from '@fieldia/viewer';

const task = await openFormDialog({ page: taskPage, dataSource, title: 'New task', size: 'medium' });

const call = await openFormPanel({
  page: callPage,
  dataSource,
  title: 'Log a call',
  width: 'medium',        // 'narrow' | 'medium' | 'wide': about 420, 560 or 720 pixels
  look: page.look,        // the opener's look, worn by the panel and the page in it
});
if (call.saved) console.log(call.recordId, call.values);

// From another edge: the whole width along the top, 40 in a hundred of the screen tall.
await openFormPanel({ page: callPage, dataSource, title: 'Log a call', side: 'top', height: 'short' });
```

A record opened over its list, as a work tracker opens a bug over its backlog:

```ts
await openFormDialog({
  page: bugPage, dataSource, recordId: 4127, title: 'Bug',
  size: 'inset',        // 96px in from the window's sides, 46px from its top and bottom; the whole window under 760px
  backdrop: 'clear',    // the list behind left as it is, not dimmed
  maximise: true,       // ⤢ beside ×: the whole window, and Restore
  resizable: true,      // a grip at the end-bottom corner, dragged or moved by the arrow keys
});
```

A page whose sheet has a `head` (a work item's: its kind's strip and badge,
the title line, Save and Close, Follow, the band of fields and the tabs) is
the dialog's own head and foot: the dialog draws neither, its ⤢ and × sit at
the end of the head's badge row, and Escape and × ask before changes go. A
head button whose steps save and then close resolves with `saved: true`. The
head's title is one line that wraps where it is too long for its line, as a
sheet's title does: a `textarea` (`aria-multiline="false"`), read from its
start, never cut, its words whole — the browser hyphenates none; only a word
longer than the line (a web address) breaks, at its end or at a soft hyphen the
words carry. Enter adds no line, and a line break pasted is a space.

`side` is where it comes from: `'end'` (the default: the end of the line, the
right, or the left right to left) or `'start'`, as the page reads; or
`'left'`, `'right'`, `'top'` or `'bottom'` of the screen, whatever the page's
direction. At the left or right `width` is how deep it is; at the top or
bottom it runs the whole width and `height` says how tall — `'short'`,
`'medium'` (the default) or `'tall'`, about 40, 60 or 85 in a hundred of the
screen. On a phone every side fills the screen: the top slides down from
above, the rest up from below.

`mode: 'values'` checks the form and hands its values back without saving
(the panel's button then says Done). Each keeps Tab inside it, gives the focus
back where it came from, and closes on Escape — asking "Discard your
changes?" first when something was changed, the focus on Cancel so Enter
keeps it open, as × asks; Discard asks nothing. A dialog opened from inside a
panel sits above it; a panel opened from a panel stacks over it, the older one
stepped back from its own edge. A panel slides in from its edge only when the
reader's system welcomes motion.

## A work item's tags, menus and texts

Three things a work tracker's bug has, in a sheet with a `head`, in
`mountViewer` and in `openFormDialog` alike.

**Tags in the head's row.** A `many2many` of tags in `head.meta` sits inline
in the row: its chips after the comments' link, what adds one — its Add Tag
button (`"adder": "button"`) or the box typed in, its words still showing —
after the last chip. The row's other parts keep its first line: out of room,
the chips wrap in a slot of their own (never narrower than 200 pixels), so
the row is as tall with two tags as with none, and grows only by the lines
its chips take. Nothing to set: it is how a head draws tags.

```json
"meta": [
  { "type": "field", "id": "h-assigned", "field": "assigned_to", "labels": "hidden", "placeholder": "No one selected", "options": { "avatar": true } },
  { "type": "link", "id": "h-comments", "icon": "chat", "field": "comment_count", "words": { "one": "Comment", "other": "Comments" }, "target": "g-discussion" },
  { "type": "field", "id": "h-tags", "field": "tags", "widget": "tags", "labels": "hidden", "placeholder": "Add Tag", "options": { "adder": "button" } }
]
```

**Dividers and menus inside menus.** An item of the record's menu
(`toolbar.menu`, ⋮ in a head) or of a button's own `menu` may be a line
between items — `{ "type": "divider", "id": … }`, left out where nothing
shows on one side of it — or open a `menu` of its own beside it, shown with
›: pointed at, pressed, or with Enter, Space or → (← right to left); ← and
Escape close it, the focus back on its item. It stands beside the menu on the
side with room, on the screen, over everything. Its items run as the menu's
own do. With `menuFrom`, your app gives more items as the menu opens: its
`onAction` is asked with that action's name, the item's `params`, the record
and its values, and answers `{ menu: [...] }` — each of those runs its steps,
then its action, asking its `confirm` first. An item whose menu has nothing to
show is not shown.

```json
"toolbar": {
  "menu": [
    { "id": "m-copy", "label": "Create copy of work item…", "icon": "copy", "builtin": "duplicate" },
    { "id": "m-delete", "label": "Delete", "builtin": "delete" },
    { "id": "m-copy-link", "label": "Copy link", "icon": "link", "action": "copy-link" },
    { "id": "m-rule-1", "type": "divider" },
    { "id": "m-templates", "label": "Templates", "menuFrom": "templates", "params": { "project": "Portal" },
      "menu": [{ "id": "m-capture", "label": "Capture…", "action": "capture-template" }, { "id": "m-rule-t", "type": "divider" }] },
    { "id": "m-rule-2", "type": "divider" },
    { "id": "m-branch", "label": "New branch…", "icon": "branch", "action": "new-branch" }
  ]
}
```

```ts
onAction: async ({ action, params, values }) => {
  if (action === 'templates') return { menu: (await templatesFor(values.work_type, params?.project)).map((t) => ({ id: `tpl-${t.id}`, label: t.name, action: 'apply-template', params: { id: t.id } })) };
  if (action === 'apply-template') return { values: await templateValues(params?.id) };
},
```

**A formatted text read first.** `"edit": "button"` on an `html` field with
the rich editor shows its text formatted — links that open in a tab of their
own, pictures in place — and Edit (✎, named "Edit Description") in its
group's heading, beside ⤢ and ^ (in its own box where it is not alone in a
titled group). Edit, Enter on the text or a press on its words opens the
editor, its toolbar where `toolbarAt` says and the focus in it; Done (✓), a
press or the focus outside it keeps what was typed, Escape puts back what it
held — the record changed only where the text is. Empty, it is its editor at
rest, its placeholder saying what to add; read-only, its text with no Edit.
The Markdown editor (`"editor": "markdown"`) was read first already.

```json
{ "type": "section", "id": "g-description", "title": "Description", "style": "line", "collapsible": true, "foldAt": "end", "maximise": true,
  "children": [{ "type": "field", "id": "f-description", "field": "description", "labels": "hidden", "placeholder": "Click to add Description.",
    "options": { "editor": "rich", "edit": "button", "toolbar": "focus", "toolbarAt": "top", "tools": ["bold", "italic", "link", "image", "mention"], "mention": { "model": "res.users" } } }] }
```

## What a page's steps ask of the screen

A page's buttons and moments run steps (see `@fieldia/core`'s “What a press or
a moment does”). The viewer is their host: it draws what they ask for.

- **A page opened** is found through `pages` by `{ id, version }` and opened in
  a dialog, a side panel (from the step's `side`), or this form's place with
  Back over it — with the same
  data source, pages, language, skin, look and `onAction`. Saved, its record
  comes back (named by its page's title field, else `name`) for the step's
  `into` and `then`; closed unsaved — Discard, ×, Escape, Back — the steps after
  it stop. Once a save in it went through, it comes back saved however it is
  closed. A page opened in place gives way back to the form once saved; Back
  returns to the form as it was. A page your `pages` has none of stops the
  steps with “The page “…” cannot be found.”, said as a toast. Each page opened
  has a host of its own, so its steps run there, and a `close` step closes it.
  Every way out of it — and of the record: the pager, the breadcrumbs (your
  own too, inside a page opened in place: they leave the record under it as
  well), a reload — goes through its form's one check (`form.leave()`). It
  first waits for a save on its way and files on theirs, saying what it waits
  for where “Saving…” would be (at a dialog's foot), then asks “Discard your
  changes?”, the focus on Cancel, only when the person's work is at risk: a
  change of theirs the last save did not send, a file on its way or not saved
  yet, changes set aside, a save refused for a conflict still waiting for
  Reload or Keep mine. A dialog's Discard waits for a save on its way too, and
  asks nothing; it stops a file on its way at once. Every dialog and panel —
  a line's own form, a related list's row and New, a calendar's New, a page an
  `open` step shows — and a page in place's Back ask before they let a change
  in it go, every change not saved counting: nothing else saves what they
  hold. An answer that comes once the record
  it was asked for is gone — a name looked up, a record made from a link, a
  line's dialog closed, an onchange, a step's Archive, Duplicate or Delete —
  is laid on no other record (`form.recordShown()`).
- **The browser's own ways out** — Back, Reload, a tab closed — ask first
  ("Leave site?") while the person's work is at risk, every change not saved
  counting, with `warnOnLeave: true`. Off unless set, as in 0.20.
- **Words said** are toasts at the foot of the screen, in their tone: one over
  another, read out by a polite live region, going after a few seconds (not
  while pointed at or focused), or with their ×. A button pressed takes away
  what earlier presses said: its own words speak for what is done now — never
  "Customer blocked" left over a customer just made active again. Your app's
  `stop` words come as a warning; a step that cannot run here, or your
  `onAction` throwing, is said too.
- **A question** is the viewer's own box (Cancel, OK) or your `confirm`. A
  button's `confirm` is asked once, by the form. Escape answers No and leaves
  a dialog or panel under it open. Your own `host.ask` gets every question,
  and the one check's “Discard your changes?” comes with `{ discard: true }`
  (a dialog's or a panel's Escape and × among them): word its Yes as Discard and put the
  focus on Cancel, as the viewer's own box does.
- **A tab** a `goTo` names is shown, and `form.shown(tab)` runs its `show`
  steps — as for a tab a person picks.
- **A button** whose steps run is busy (`aria-busy`, a turning ring) and is not
  run twice; a `check` or `save` that stops it takes the focus to the first
  problem, as Save does.

Do any of it your own way; what you leave out stays the viewer's:

```ts
const viewer = mountViewer(element, {
  page,
  dataSource,
  pages,
  onAction: async ({ action, values }) => {
    if (action === 'check_stock') return { values: { price: await priceOf(values.product) }, say: 'In stock' };
  },
  host: { say: (message, tone) => myToasts.show(message, tone) },   // a Partial<ActionHost>
  onOpen: (request) => (request.as === 'page' ? router.open(request) : undefined), // undefined: the viewer opens it
});

viewer.on('change', ({ field, value, by }) => {});   // and save, send, action, run, step, open
viewer.setValues({ price: 380 });                    // the app's change: no change steps run for it
await viewer.run([{ do: 'check' }, { do: 'save' }]); // steps, as a button would run them
```

A form made elsewhere and handed in as `form` keeps the host it was made with
(`createForm({ host })`): the viewer gives its own only to a form it makes.

## Two people, one record

When a save is refused because someone else saved the record first (the data
source throws `ConflictError`, see `@fieldia/core`), the viewer says so over
the record — “Mona changed this record at 10:42”, what she changed and what
you both changed — with **Reload**, which shows her version and lists your
changes to put back, and **Keep mine**, which saves yours over hers. Nothing is
lost without a word. Where the source says the person may only read the record
(`can.edit: false`) there is no Edit, Save or Save & Close and a line over the
record says why; fields it locks show a lock with the reason, fields it hides
are gone, and the gear menu's Archive, Duplicate or Delete it does not allow
are hidden, its foot saying why — in English, Arabic, French or German. See
[versions and conflicts](https://fieldia.dev/data/#versions).

## What a page's records are called

A page that names its records (`"records": { "one": "contact", "other":
"contacts", "a": "a contact" }`, see `@fieldia/core`) has the viewer say them
wherever it named records in words: a list's pager ("1–10 of 1,284 contacts"),
nothing found ("No contacts match."), Select all ("Select all 1,284 contacts that
match"), Export ("All 1,284 contacts that match", "1,284 contacts exported."),
Edit ("Edit 3 contacts", "Update 3 contacts? …", "3 contacts updated."),
Import's button, report and Undo ("Import 10 contacts", "10 of 17 contacts
imported", "Delete the 10 contacts this import made?"), a printout's count; over
a record its crumb ("New contact"), its pager's name and buttons ("Next
contact"), the gear's Print ("This contact"), someone else's save, a record only
to be read, the question before changes go; possible duplicates ("A contact with
this phone already exists", "It's a new contact", "Merge two contacts"); a
related list in the words its model's page names them by ("New invoice", "View
all invoices", "No invoices yet.", "5 of 23 invoices") — "all" and "none" kept to
its title where its own `filter` lists only some — and "Nothing here until this
customer is saved." in the record's own. @fieldia/calendar's New and a slot's
count, and @fieldia/map's failure, say them too.

Each is a word of its own beside the plain one, ending in `Noun`
(`exportedNoun: '{n} {records} exported.'`, `exportedNounOne`); English has them
all, German and French those they can say round any noun's gender, Arabic the
pager's name. A language that leaves one out says its own plain sentence, and so
does an app's `labels` that gives the plain one alone (`exported`): never an
English sentence round another language's words. `addLanguage` keeps it so.

With `"lowerLabels": true`, every sentence of the viewer's and the widgets' that
puts a field's label after a word of it writes it with a small first letter, by
the one rule of `@fieldia/core` (`labelAt`): a refused save's "Not saved. Check:
full name, quantity", "Help for tax ID", "Locked: budget", "Fix quantity to see
total", "Clear country", "Add tags", "Country of mobile", "Fix quantity to see
this line's subtotal", "This field could not be shown: price", "They changed:
phone.", "Put back phone", "Resize tax ID", "Filter by status", "Search name for:
…", "The same in both: email." — one that begins its sentence ("Full name is
required", "Status: nothing is called …") as written. The quiet look's "Add story
points" has always been so, and keeps to the same rule. A line's own dialog —
its table's `lineForm`, or its model's page (`lineOpens: "record"`) unless that
page says otherwise — and a list's Edit dialog follow the page they are part of.

## Possible duplicates, and Merge

A record's page with `duplicates` (`{ "fields": ["name", "phone", "email"] }`)
and a data source with `duplicates` says the records like the one typed: a
moment after the person stops typing in one of those fields — and as a saved
record opens, and as it is saved — each match is said under the field it
matched on, "A record with this Phone already exists: Nile Traders", and said
once, politely, to a screen reader. Its ways: **Open it** (the record found, in
this one's place, once the person said Discard to what they typed), **It's
someone new** (the record found let be for this record, whatever field matches
it next, remembered for the record: on the app's server where the source has
`notDuplicates` and `markNotDuplicate`, so every device lets it be, else in the
viewer's `preferences`), and, on a saved record where the source has `merge`,
**Merge…**: the two side by side, the record kept picked over its column and a
radio for each field they hold apart, what will happen said before Merge. Typing
on leaves an answer on its way unheard; an answer for a record no longer shown
is laid nowhere; Save is never kept waiting. It comes in a part of its own
(`duplicatesPart`, `fieldia.duplicates.js`), loaded only where a page and its
source both ask, never waited for. Its words are the viewer's labels
(`duplicateWith`, `openDuplicate`, `mergeTitle`, …). See
[possible duplicates](https://fieldia.dev/data/#duplicates).

## AI help: each value proposed reviewed before it is kept

Through your data source, by your app's own model (Fieldia ships no model and no
keys): a page's `suggest` draws **Fill from text** (among a sheet's buttons, else
over the page) — words pasted, files picked, or a text field's own words
(`suggest.fromField`), read by the source's `suggest`; a text field's
`options.rewrite` draws **Draft** and **Polish** (and the app's own tools) under
its box, asking the source's `rewrite`; a list's `searchToFilter` draws ✦ beside
its search box, asking `searchToFilter`. Every value proposed is shown on its
field — the value it would take the place of struck through, the new one,
**Accept** and **Reject**, a table's lines to add listed — and over the page how
many, the model's why, **Accept all** and **Reject all**. Nothing is written
until it is accepted; **Undo** puts back what was there. A proposal for a record
no longer shown (`form.recordShown()`) is laid nowhere; a field typed in while
it was asked keeps what was typed, and typing in a field with a proposal lets it
go. A value is read as its field holds one (a link by its name, looked for
exactly; a choice among those offered), or not used and said. The app's own
values, an agent's, are shown the same way with `handle.propose(values, { why })`.
It comes in a part of its own (`assistPart`, `fieldia.assist.js`), loaded with a
page that asks for it, as a list's ✦ is pressed, or as the app first proposes;
hidden where the source has no member for it. Its words are the viewer's labels
(`assistFill`, `assistAccept`, `assistUndo`, `assistDraft`, `assistWords`, …).
See [AI help](https://fieldia.dev/data/#ai).

A text kept in several languages (`translate`) is filled in one language alone:
the one its switch shows, else the reader's — `suggest` is told which, by field
(`languages`), and `rewrite` is given that language's words (`language`) — and
the proposal says it ("Proposed in English"); the others stay as they were, each
typed by a person, never translated by a machine. Fill from text asks for the
kinds a proposal fills alone: a file, a picture or a photo set, JSON, properties
and a matrix are never asked nor filled. A field scanned into with the camera
(`options.scan`) takes a proposal as any text does, its Scan button kept beside
it.

```ts
const handle = mountViewer(element, { page, dataSource });
await handle.propose({ city: 'Amman', country_id: 'Jordan' }, { why: 'From the agent’s last call' });
```

## Endings, and the answers in a page's words

A page of responses sent shows its ending (`endings` on the page) in place of
"Thank you. Your answers were sent.": the first whose `when` holds on the
answers as sent, with what the data source answered — "Your booking is
{id}" says the reference `submit` returned — its title, its words a paragraph
a line with their `[words](https://…)` links, and its button to start again,
its own words or none (`again: false`). It takes the focus, so a screen reader
reads it out. A `{field}` in a field's label or help, a choice's words, a
step's title and words, a wizard's or a button's words shows that answer as
people read it — a choice by its label, money with its currency, a day in the
page's order, a yes or no in words — and follows it as it changes; on such a
page a text's and an alert's `{field}`s read so too. `{branch|this branch}`
says "this branch", in the words' own weight, while the branch is empty. They come in a part of
their own (`answersPart`, `fieldia.answers.js`), loaded before a page that has
any is drawn; where it cannot come, the words show each value as its field
does at rest, and a page sent says the plain thanks. See
[endings](https://fieldia.dev/pages/#endings).

## Opening, closing and limiting a form; Continue later

A page of responses with `limits` says, as it opens, when it takes no answers —
"This form opens on 1 November 2026 at 09:00.", "This form closed on 20
November 2026.", full, or this person's one sent — with the page's own words,
under its title and in place of its questions: nothing is typed in a form that
would refuse it, and while its counts are asked of the data source its
questions wait. A form left open as it opens or closes says so then; answers
typed when it closed stay, a banner over them saying they can no longer be
sent. A page of one response from each person offers no Submit another, nor an
ending's own button to start again. A choice's options with `seats` show their places left beside their words ("3
left", "Full") in radios, checkboxes, the browser's list, picture cards,
Fieldia's own list, a list that searches and tags; a full one is never hidden,
and refused when picked, whichever draws it — the choice kept as it was.

A page with `continueLater`, whose source has `saveDraft` and `loadDraft`, has
**Continue later** beside Submit (and a wizard's Next): the answers read and
kept, then "Your answers are saved", the link the app made with Copy, the app's
own words and Keep going. `resume` (the key in that link) opens the draft at its
step; a key that names none says so, and the form starts empty. The screen,
the banner and Continue later come in a part of their own (`limitsPart`,
`fieldia.limits.js`), loaded with the page's parts where it has `limits` or
`continueLater`. Their words are the viewer's labels (`closedTyped`,
`laterButton`, `laterSaved`, …); why a form takes no answers is the form's
messages (`formOpens`, `formClosed`, …). See
[opening, closing and limiting a form](https://fieldia.dev/data/#limits) and
[save and resume](https://fieldia.dev/data/#drafts).

## Approvals on a record

A record's page with `approval`, whose source has `approvals`, says over the
record — under its alerts — where its approval stands: "Waiting for Finance:
Mona Adel or Hany Lotfy" (those still to decide at each level waiting, joined
by "or" where one is enough and "and" where all must), "Needs approval from
Finance, then CFO", "Approved", or "Rejected by Mona Adel (Finance)" with the
reason quoted, and the source's own words of why it needs approval. Its levels
follow in their order, each with its state and who decided there. Those who may
decide now (`mine`, where the source has `decide`) have **Approve** and
**Reject**; Reject asks why in a dialog of its own — none given is refused under
its box, a refusal of the source's said there — and Escape lets it go. While it
waits, every field is locked but those `approval.open` names, each lock saying
"Locked while it waits for approval", and the band says what stays open. Its
history is folded under "Approval history (n)": who asked, who decided at which
level, when, and why. The band and its dialog come in a part of their own
(`approvalsPart`, `fieldia.approvals.js`, with the form's own), loaded with the
page's parts where it has `approval`. Their words are the viewer's labels
(`approvalWaiting`, `approvalApprove`, `approvalReject`, …). See
[approvals on a record](https://fieldia.dev/data/#approvals).

The lock is a record page's. A list whose cells change in place (`editable`)
knows nothing of approvals: a record waiting for one is locked in such a list
only through the `can.edit` your source gives its row — say `edit: false` there
for a record that waits, as your server refuses its save.

## One text in several languages

A field with `translate` (`["ar", "en"]`, @fieldia/core's README) is drawn as a
switch over its box, the page's language first, each language typed by a person;
its page asks for the languages part before it is drawn (`partsFor`), and a list's
cells and cards show the text in the page's language, else another's marked with
it, written its own way. A save refused in a language shows that language and takes
the focus to its box. A related list's or a many2many's records' fields may say
`translate` too: their cells read the same way.

A list whose cells change in place never opens such a field's cell — each language
is typed under its switch, on the record's own page, and a press on its cell opens
the record — and a page naming one in `editable.fields` is refused, with why. AI
help fills the one language the person is looking at (the switch's, else the
reader's), never the others: see AI help above.

Not done yet, for 0.29: a table's line keeps one language (`translate` there is
refused); the exported `matchesFilter` judges one text — only the memory source
finds a record by any of its languages; Export writes the reader's language
alone, and Import reads one text, taken as the first language; the quiet look
leaves the switch's tabs boxed; a map's pins and cards show the reader's
language without the mark.

## Lists

A page whose layout is a `list` shows its records as a table: pages, sorting,
a search bar with suggestions, filters, group by and favourites. Your data
source answers `list` and `groups`; a row opens through `onOpenRecord`, and the
page's buttons reach `onAction` with the chosen `recordIds`. A group's heading
is a button that says open or closed, its name and its count in words ("Cairo,
12 invoices"), the list staying a table; the arrow keys cross it as they move
between rows, Right opens it and Left closes it. See
[lists and search](https://fieldia.dev/lists/).

Other ways of showing a list's records come from `listViews`, by name: a
list's `map` (`mapListViews` from `@fieldia/map`), its `calendar`
(`calendarListViews` from `@fieldia/calendar`), its `gantt` timeline
(`ganttListViews` from `@fieldia/gantt`), or an app's own view. The list
offers each on its switcher when it has the page option of its name, or where
the view's own `offers(node)` says, in the view's words (`label(locale)`). A
view that makes a record (a calendar's empty slot) asks `onNewRecord(values)`;
without it the record's page from `pages` opens in a dialog with the values
filled in.

### Lists that add up, and filter by time

A column may total: `"cells": { "amount": { "total": "sum" } }` — `sum`,
`avg`, `min` and `max` of a number, `count` of any column. The list shows a
totals row under it, the sums on each Group By heading, in full as the totals
row writes them (`Cairo (12) · EGP 4,312,550.00`), and, while rows are ticked,
their totals, all asked of the data source's optional `totals`: without it, none
shows. An amount whose currency each record keeps is totalled in one currency
only: over several, no total is shown rather than a wrong one, and the cell (or
the heading) says why in sight — *Several currencies*, the sentence on pointing
at it, as a phone has no pointer to hover with.

A named filter may be a period a date falls in, counted from today —
`{ "id": "overdue", "label": "Overdue", "period": { "field": "due_date", "is": "overdue" } }`
— and a person's own filter offers "in the period" for a date: today,
yesterday, this week or last, this month or last, this year, the last 7 or
30 days, overdue. A week starts on the language's first day (Saturday in
Arabic, Monday elsewhere); days are the page's time zone's (`timeZone`), else
the browser's; the clock is the viewer's `now`. They reach the data source as
plain conditions. A date in `groupBy` groups by its year, quarter, month,
week or day, asked of `groups` with `interval`. See
[lists that add up](https://fieldia.dev/lists/#totals).

### Filters a buyer and a sales team expect

A filter bar (`"search": "fields"`) says beside it how many records the search
finds — "42 homes", in the page's `records` words, in the table, the gallery and
on a map — as its pager stands under the rows and shows only past a page
(`.fd-list-found`, said politely as it changes; none while nothing is found, nor
for a list in a record). It may also say how many records each of its values
finds among the rest of the search — `"filterCounts": true`: *Villa 5*, read out
as "Villa, 5 homes" — asked of the source's `groups` (a record of links counted
under each of its links); without `groups`, its values and no count. A number's
or a date's field filters by its range, From and To, with a press for each least
value — `"filterRanges": { "bedrooms": { "atLeast": [1, 2, 3, 4] } }` — one chip,
"Price: E£ 5M – E£ 15M", "Bedrooms: 2+"; a decimal, an amount and a date always
do, a whole number where it is named. Its boxes read as every box reads a number
or a day, From past To said and nothing filtered by it. The search bar's own
filter of a number or a date *is between* two, one chip too. A range reaches the
source as `>=` and `<=` (`facetsToFilter`), a date and time's days on the list's
clock. With `filterCounts` the search bar's menu counts each named filter (as if
it were the only one on) and each favourite — *Late 5* — by the source's
`totals` (its `count`), else by its `list`'s total. `"filterSheet": true` puts
the filter bar's fields in a sheet where the bar is 520 pixels wide or less,
behind one Filters button: every field at once, counted as they change, taken
together with "Show 37 homes"; × and Escape let them go. See
[filters](https://fieldia.dev/lists/#filters).

### Taking records away, changing many

A list takes its records away and changes them in bulk. With every row on
show ticked it offers **Select all 1,284 that match** (the source's `allIds`,
or its pages read through); its buttons then get every id. **Export**, in its
bar, writes the rows ticked — or, none ticked, every record the search finds —
as an Excel workbook or a CSV file, in the browser (no library: the workbook is
written in the list's part) or on your server (`exportRecords`), offered with
`"export": true`. A CSV file's numbers and amounts are written as a spreadsheet
adds them — digits and a decimal point, no grouping and no sign (`250000.00`;
a decimal comma where the file is parted by semicolons, as a German or French
spreadsheet reads it) — each amount's currency in a column of its own beside
it (`Lifetime value currency`), or in the header where the field has one
(`Amount (EGP)`), and its days and times as ISO 8601 writes them
(`2026-10-15`, `2026-10-15 14:30`, on the clock the list shows). With `"bulkEdit": true` (or the fields) **Edit** sets one field
to one value on the records chosen, after a question, by `writeMany` or a save
per record, each record's `can` kept, and names what it could not change and
why. See [taking records away, changing many](https://fieldia.dev/lists/#bulk).

With `"import": true` (or the fields) **Import**, in its bar, brings records in
from an Excel workbook or a CSV file, read in the browser with no library (a
CSV file's encoding and separator guessed, an encoding picked that its bytes
say it is not in said with the one that reads it; a file of a header alone
said to hold no rows): its columns matched to the page's fields by name or
label in any of the page's languages, a picker for each; every row checked by
the page's own rules before anything is written — the rows refused named with
why and downloadable as a file to fix, its cells as the file had them under the
labels of the fields they were matched to, so it matches by itself when brought
in again; the first shown as they will be saved — then written by `createMany` or a save per row, with
progress and Stop; and **Undo the import** deletes what it made. Its dialog comes
in a part of its own (`importPart`), the first time it is pressed. At most
50,000 rows in the browser; `importRecords` takes more on your server. See
[bringing records in](https://fieldia.dev/lists/#import).

### Cells changed in place

With `"editable": true` (or `{ "fields": [...] }`), a list's cells are changed
where they stand, as a price list, a week's hours or a pipeline's stages are
kept: a press on a cell, Enter on it or a key typed on it opens it in its
field's own box, with its rules; Tab and Shift+Tab go from cell to cell, in the
order a person put the columns in, and on to the next row; Enter takes a cell
and goes down its column; Escape puts back what it held (on a cell at rest, the
whole row). Each row is saved through your source's `save` as it is left — the
fields changed alone, `partial: true`, with the version it was listed at — and
one refused stays as typed, why said under it, with Put back; someone else's
save first is said under the row with Reload and Keep mine. A worked-out column
follows the cells as they are typed, and waits where one of them does not read
or is refused. **Add a line** adds a row at the end, saved as it is left
(`"add": false` for none); a block pasted from a spreadsheet goes across and
down the rows, each then saved — rows given the same change in one `writeMany`;
on a phone a card is changed in a sheet. `"open": true` gives each row an Open
button where your app opens records. It comes in a part of its own
(`editablePart`, `fieldia.editable.js`), loaded only for such a list; a row is
a form made as the page's own (its words, clock, person and functions). See
[cells changed in place](https://fieldia.dev/lists/#editable).

A text kept in several languages (`translate`) is never changed in a cell: a
cell holds one box, and each language is typed under its switch on the record's
page — with `true` its column is read as ever and a press opens the record;
named in `fields`, the page check refuses it, saying why. A row knows nothing of
approvals: a record waiting for one is locked here only through its `can.edit`,
which your source gives. Not done yet, for 0.29: the list page's own `on` steps
do not run in a row's form; in someone else's save, a worked-out column counts
as "you both changed", as on a record's page; `startValues` fills a new row from
the list's fixed `=` conditions, but not a link.

### A related list inside a record

Another model's records that point at this one — a customer's invoices, a
property's viewings — are listed inside the record with a `related` part, in a
group, a tab or straight in the sheet:

```json
{
  "type": "related", "id": "invoices", "title": "Invoices",
  "model": "invoice", "field": "partner_id",
  "fields": {
    "name": { "type": "char", "label": "Number" },
    "invoice_date": { "type": "date", "label": "Invoice date" },
    "state": { "type": "selection", "label": "Status", "options": [{ "value": "paid", "label": "Paid" }] },
    "amount": { "type": "float", "label": "Amount" }
  },
  "columns": ["name", "invoice_date", "state", "amount"],
  "cells": { "state": { "widget": "dot", "options": { "tones": { "paid": "success" } } } },
  "filter": [{ "field": "state", "op": "!=", "value": "cancel" }],
  "sort": [{ "field": "invoice_date", "desc": true }],
  "limit": 5,
  "viewAll": { "page": "invoices", "as": "page" }
}
```

It asks your data source's `list` for the records whose `field` is this record
(`{ field: 'partner_id', op: '=', value: <its id> }`) and that `filter` lets
through (a `valueFrom` reads this record), `limit` rows a page (5 unless said),
and draws them with the list's own table — its cells, tones, phones and totals
— in the list part. Its title shows how many there are; past a page, its pager
and a search box show. A row opens its record in a dialog of the page `pages`
gives for `model`, **New** makes one there with its link filled in and lists it
once saved (`"create": false` for none), and **View all** opens the page
`viewAll` names showing this record's records alone, as an `open` step opens
one — in a dialog, a side panel or this page's place, or your app's own way
(`onOpen`, with the conditions in `request.filter`). Its list says what it is
kept to as chips over it, which a person may take away — "Customer: Nile
Traders", and the list's own `filter` by its title — given in
`request.search` (`Facet[]`) for a route of your own: hand them to the list
page's viewer as `listSearch`, the search it opens with in place of its
default filters (where `listFilter` keeps conditions fixed and unsaid). Before the record's first
save it says nothing points at it yet, with no New. With `card`, its rows are
cards on a phone, as a list's (each a field of its own `fields`); `rowTones`,
`rowBold` and `rowButtons` tone, bold and give buttons to its rows as a list's,
each read on the row's record (its own fields, `id`, `user`, `context`), a
button run with that one record (`recordIds`) on the record shown; on paper,
its rows as shown and "5 of 23" where they run past a page. Without `list` in the
data source it is not shown. An answer that comes once another record is shown — the
pager pressed, the record loaded again, Discard — is drawn in none
(`form.recordShown()`), and the next record's are asked for. See
[related records](https://fieldia.dev/record/#related).

With `"open": "app"`, a row and New go your app's own way first, as View all
does: your `onOpen` (or your host's `open`) is asked with `{ page, as: 'dialog',
recordId }` for a row and `{ page, as: 'dialog', recordId: null, values }` for
New — this record filled in among the values (`{ partner_id: { id, label } }`) —
`page` being the id of the page `pages` gives for `model`, else the model's
name. Answer with how it ended, or `undefined` for the dialog after all; the list
asks for its records again once it settles. Without `onOpen` or a host's `open`,
the dialog as ever.

A tab holding a related list may count its records: `"count": { "related":
"quotations" }` on the tab, by the list's id, shows "Quotations 4" (read out
"Quotations, 4"). The source's `list` is asked for one record with the list's
own conditions as the record is shown, whether the tab is open or not, and its
`total` is the count; once the list is drawn, its own count after New, a delete
or a row's button stands for it. No count shows until it is known — before the
answer, before the record's first save, while the list is hidden — and never
another record's.

### Lists people read anywhere and shape themselves

**Cards.** With `card`, a list's rows become cards where the list is as narrow
as a phone (520px or less): a title, a picture — or a person's initials — a
few lines and a status pill, each by field; `"card": {}` takes them from the
columns. With `gallery`, the switcher offers **Gallery** on any width: cards
side by side, their pictures large (`"size"`: `small`, `medium`, `large`),
`"opens": "gallery"` to open on it. A card is its row: ticked (Select all,
Export, Edit), opened, toned, its buttons pressed, under its Group By heading,
the totals under the cards and in sight while they scroll.

```json
"card": { "title": "name", "image": "photo", "status": "offer", "lead": true,
          "fields": ["price", ["district", { "field": "bedrooms", "unit": { "one": "bedroom", "other": "bedrooms" } }]] },
"gallery": { "opens": "gallery" }
```

**Richer rows.** A column's cells (`cells.<field>.widget`): `badge` (a pill, by
`options.tones` or `options.colours` by value), `tags` (links as chips),
`image` and `avatar` (a picture, or a person's initials), `progressbar`
(`options.max`), `percentage` and `duration`, and `phone` with
`"options": { "links": true }` (a call and a WhatsApp link). Each row's tone
while a condition on its record holds (`rowTones`), its bold (`rowBold`), and
buttons on each row (`rowButtons`, each shown by its `invisible` read on the
row's record, pressed with that record alone). A tone's `label` and
`rowBoldLabel` ("Your own contacts") say what they mean in a key over the rows —
a swatch, a bold sample — read by a screen reader as a list; without words, no
key.

**Columns people control.** With `optionalColumns` — the columns a person may
hide, each `show` or `hide` at first — the header has a **Columns** menu: show,
hide and order the columns (Move up, Move down, or Alt with an arrow), Reset to
the page's; a header dragged sideways moves its column — its ghost under the
pointer, the other columns sliding aside, a line where it goes; Escape puts it
back, a press that does not move still sorts, a finger's long press lifts it
(a tap sorts, a swipe scrolls), right to left mirrored, and its new place is
said to a screen reader ("Phone moved to place 2 of 8", as the menu's moves
are); a header's edge drags (or its grip takes the arrow keys) to size its
column; the header and the first column stay in view as the rows scroll — the
first is the list's name column (the page's first), which no move or drag
displaces: the others order after it — and the Columns button is
held at the header's end, in sight however wide the table.
The person's columns are kept in the viewer's `preferences`
(`<page>.<list>.columns`; the browser's storage unless the app gives its own).
Export and Print write the columns shown, in their order; on paper a list is
its table in that order — its first column at the table's start, nothing held
in view, no Columns cell — cards and a gallery printed as rows. The cards and
the columns come in parts of their own (`fieldia.cards.js`,
`fieldia.columns.js`), only where a list asks. See
[lists people shape](https://fieldia.dev/lists/#shape).

### Lists people work in all day

**Several orders at once.** A header's press puts its column first; with
Shift held, a press adds its column after those chosen ("by agent, then by
date"), Shift again turns it the other way and a third time takes it away.
Each column in the order shows its place (1, 2, 3) beside its arrow once there
is more than one, a screen reader hearing it after the header's name ("sorted
2 of 3, descending"); the first carries `aria-sort`. The page's `sort` breaks
the ties after them; the source gets them in `sort`, in order.

**Views kept for the team.** Where the data source keeps views (`views`, and
`saveView` and `deleteView` where it saves and deletes them), the search bar's
menu lists them in place of the favourites the browser keeps: the person's own
and those shared with the team ("Shared by Mona Adel"), each put on with a
press — its search, its order and its columns (`optionalColumns`). Save current
search takes a name, Use by default and Share with the team; the list opens on
the person's own default, else the team's, asked before its records. Only the
person's own has its × (a shared one asked first). Without `views`, favourites
as before.

```ts
views?({ pageId, model, list }): Promise<SavedView[]>;
saveView?({ pageId, model, list, view: { id?, name, state: { facets, sort?, columns? }, shared?, isDefault? } }): Promise<SavedView>;
deleteView?({ pageId, model, list, id }): Promise<void>;
```

**A row opened in place.** With `detail`, each row opens under itself to what
its record holds — its lines, a table of lines of the page's (`lines`), loaded
with the record through `load` — or to another model's records pointing at it
(`model`, `field` and their `fields`, as a related list's, asked of `list`), a
page at a time (`limit`, 5 unless said), read only: an arrow before the row's
name (with its words in the card on a phone), Right and Left on the row,
several open at once, each kept open as the list asks again; the row's press
still opens the record. A section's heading or a note among the lines
(`lineKinds`) reads across the row. Without `load` (lines) or `list` (records),
no arrow. It comes in the rows part (`fieldia.rows.js`).

**Rows re-ranked by hand.** With `sequenceField` — a whole number the records
are ranked by, the list's `sort` by it — a grip at each row's start carries the
row to another place (the other rows sliding aside, the page scrolling near its
edge, Escape putting it back; on a phone, the card's grip), and Alt with an
arrow moves the focused row a place, its new place said aloud ("Omar Nabil moved
to place 3 of 12"). Only the records whose rank changes are written — halfway
between its neighbours where their ranks leave room, else one more than the one
before and those after moved on — each through the source's `writeMany` (one
id, its own rank), else `save`; refused, the list says why and asks for its
records again. Shown while the list is in that order (no other header pressed,
no Group By, no rows under parents); a record the person may not change has no
grip. In the rows part too.

**Rows loaded as the list is scrolled.** With `"endless": true` — a phone's
feed, a log — the next page of rows comes as the rows' end comes in sight, put
after those already there, in place of the pager's pages: its count stays
("1–60 of 1,284 entries"), its arrows go, and "Show 30 more" waits at the end
for a hand or the keys (↓ past the last row loads the next and goes on). As the
list asks again (a row's button, a record closed) it keeps every row it held; a
new search or order starts from the first page. On a phone, cards far out of
sight skip their drawing. Not for rows under their parent (`parentField`).

**A tree too big for a page.** Rows nest under their parent (`parentField`) on
their page; with `"loadChildren": true` as well — a chart of accounts, a
project's work, a development's buildings and units — the list's pages are its
records with no parent (`{ field: parent, op: "notset" }`), each parent's
children asked of `list` as it opens (`{ field: parent, op: "=", value: id }`),
a page at a time with "Show 20 more", so a parent's children never split
across pages. How many children each row has is asked of `groups` in one ask
for the rows drawn (`{ op: "in", value: ids }`), so only a row with children
has its toggle; without `groups`, each offers to open, and one with none loses
its toggle as it opens. Right opens a row and Left closes it; Collapse all
closes every one, and Expand all, which would load the whole tree, is not
offered. Those open stay open as the list asks again. Under a search, its
matches whatever their depth, each with its parent named ("in Current
assets"). In the rows part.

```json
"detail": { "lines": "line_ids", "columns": ["product_id", "name", "qty", "price", "subtotal"], "sort": [{ "field": "sequence" }], "limit": 5 }
"detail": { "title": "Invoices", "model": "invoice", "field": "partner_id", "fields": { … }, "columns": ["name", "amount"] }
```

## On paper

Every page prints — Ctrl+P, the browser's menu, or the page's own Print — as a
clean page, by the print part's `@media print` rules (`fieldia.print.js`, a
chunk of its own in an app's bundle, about 5 KB gzipped):

- every tab one after another under its name, every wizard step, every folded
  group open (but what a condition hides);
- no buttons, bars, gear, pager, tabs' strip (a tab's count with it), help or
  locks; each box written as the words a person reads in it — a choice by its
  label, a link by its name, money with its currency, a date as the page writes
  it on its clock — wrapping rather than cut; a choice of several, the one
  picked; a statusbar, the stage the record is in;
- a table of lines whole (a grid's every line and column, in a plain table as
  wide as the sheet, its columns in the order the person sees them), broken
  between its lines with its header again on each sheet; no field, line or
  heading cut across two sheets, and no tab's name, a group's title or a table's
  header left alone at a sheet's foot — each goes to the next sheet with the
  start of what follows it;
- groups and fields side by side as the page sets them at the sheet's width,
  a row of them never laid over the next, in Chromium and Firefox alike; a
  sheet breaks between any two groups, so one that fits stays where it is;
- no required star, in any skin; a number, an amount, a day or a phone number
  in a printed list's or table's cell on one line;
- a part its page marks `"print": false` — a tab, a group, a field or a
  related list — left out, as an invoice leaves out its journal items, and a
  related list with no title of its own no empty band over its rows;
- light colours whatever the screen's scheme, the theme's accent kept for the
  headings; the page's language and direction;
- over it, the record's own name — its sheet's title field, else its `name`,
  else its first line of text, on a page of sections too — with none yet (a
  draft invoice's "/"),
  what the page calls its records and the stage it is in, "Invoice · Draft" —
  and the day it was printed (`now`, on the page's `timeZone`), and — with a
  page's `print` — the app's logo and words over it, and its footer under every
  sheet of it: nothing runs under the footer, and under the last sheet it
  follows the record (in Chromium and Firefox; in Safari, once after the
  record). Each `{field}` shows that field's value; a line whose value is
  empty (or no words, as "/") is left out whole, never "quoting . Thank you";
- with a dialog or a panel open over the page, its form alone: what a person
  printing looks at — never the page behind with the dialog over it.

```json
"print": {
  "header": "Zamalek Office Supplies S.A.E.\n26 July Street, Zamalek, Cairo",
  "footer": "Pay by bank transfer, quoting {name}. Thank you for your business.",
  "logo": "https://example.com/logo.svg"
}
```

What a stylesheet cannot do is done as printing begins (the window's
`beforeprint`) and undone at `afterprint`: each tab not opened yet is drawn,
each box's words written beside it for the paper alone, and the room each
heading keeps under it measured — as tall as the start of what follows it,
with the form laid out for that moment as a sheet is wide.

**The print part comes on intent.** A page no one prints never loads it. It is
loaded, and printing waits for it, as a person prints: **Ctrl+P** (⌘P) is
Fieldia's — held back the first time while the part comes, then the page laid
out whole and the browser's print asked; at once once it is in — and **every
Print** (the gear's built-in, a `print` step, `viewer.print()`, a list's Print)
waits for it. It is fetched, and nothing printed, as soon as a person shows they
may print: the gear opened with Print in it, a pointer resting on a Print button;
and once a page meant for paper is drawn — a page with its own `print` words, a
list with `"print": true` — when the browser is idle. An app's own Ctrl+P (a
keydown it handled first, `preventDefault`) is left to it.

**The browser's own menu** (File › Print) is the one print no page can hold
back, and a part loaded as it begins comes too late. So before the part came,
it prints a plain look the main sheet keeps — the page as the screen shows it,
its buttons, bars, the record's bar, the side panel and hints left out, light
colours — and asks for the part: every print after is whole. A page that
printed or fetched the part once, and every page meant for paper, prints whole
from the browser's menu too. To have it whole from the first moment on every
page, load it as the app starts: `printPart.load()`, or `loadParts()` with no
page, which loads every part.

On paper the record's content is a table and its footer that table's footer
group, which the browser draws again under each sheet's part of it; every grid
is a block, its parts side by side in lines a sheet breaks between. An app's
own stylesheet that sets a form's `display` on paper keeps the footer once,
after the record.

**Print this record alone** — the app's page round it left out — with the gear
menu's built-in item (`{ "id": "m-print", "builtin": "print" }`, under Print as
"This record"), a `{ "do": "print" }` step, or `viewer.print()`; each settles
once the browser's printing is done.

**The app's own PDF.** An item under Print runs your action; answer with its
file and the viewer shows it over the record, in the browser's own viewer with
Download (the files part's), or saves it (`show: "download"`, or a kind no
browser shows):

```ts
onAction: async ({ action, recordId }) => {
  if (action === 'print_invoice') {
    const answer = await fetch(`/report/invoice/${recordId}.pdf`);
    return { file: { name: 'INV_2026_0042.pdf', type: 'application/pdf', bytes: await answer.blob() } };
  }
}
```

`file` takes `url` (your server's address), `data` (base64, as a file field
holds it) or `bytes` (a Blob, an ArrayBuffer, a Uint8Array).

**A list's Print** (`"print": true`, off unless set, as Export is): every record
the search finds — each page of them asked of the data source, as Export's
every match is — the columns as the list shows them (the person's, in their
order), under its Group By headings with their counts and sums, the totals
under them; over them the
list's title, its filters in words, how many and the day; its footer at the
foot of every sheet where the browser keeps room for it there (Chromium,
Firefox), else once after the rows. See
[on paper](https://fieldia.dev/record/#print).

## With no build step

This package carries a `<script>` bundle that sets the global `Fieldia`
(core, widgets and viewer; about 165 KB gzipped). What a page uses beyond
plain fields — a list's screen, a table of lines, a date's box, a link to
another record, a phone, a theme, possible duplicates, a page on paper, the
answers said in a page's words, a form's limits, a record's approvals, the
functions beyond the plain ones… — comes in 29 parts beside it (`fieldia.list.js`, `fieldia.date.js`,
`fieldia.relations.js`, `fieldia.print.js`, …), each loaded from the same
folder the first time a page uses it:

```html
<script src="https://cdn.jsdelivr.net/npm/@fieldia/viewer/bundle/fieldia.js"></script>
<script>
  Fieldia.mountViewer(document.getElementById('app'), {
    page,
    dataSource: Fieldia.createMemoryDataSource(),
  });
</script>
```

Its own words are English. For Arabic, German or French, add that language's
script after it (about 12–13 KB gzipped each), then pass `locale`:

```html
<script src="https://cdn.jsdelivr.net/npm/@fieldia/viewer/bundle/fieldia.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@fieldia/viewer/bundle/fieldia.ar.js"></script>
<!-- or fieldia.de.js, fieldia.fr.js; one per language the page is shown in -->
<script>
  Fieldia.mountViewer(element, { page, dataSource, locale: 'ar' });
</script>
```

Load both from the same version. A page set to a language whose script is
missing shows Fieldia's words in English, and the console names the script to
add. Installed from npm, `@fieldia/viewer` (and `@fieldia/core`,
`@fieldia/widgets` and the React, Vue and Angular bindings) has all four
languages with no extra import; `addLanguage(locale, { messages, widgets,
viewer })` replaces a language's words in either.

The words only a part shows — a list's, Import's, a file's, booking slots'… —
come in that part, in English, and a language's script has all of them: in
the script bundle, `Fieldia.VIEWER_LABELS.en` (and `WIDGET_LABELS`,
`MESSAGES`) holds a part's words once that part has come, and a part never
puts its words over ones a table has (a language's, or your own). The viewer
reads its words as it draws them, so a page mounted before its parts came
shows theirs.

For React, Vue and Angular, use `@fieldia/react`, `@fieldia/vue` or
`@fieldia/angular` — thin shells over this viewer. MIT licensed.
