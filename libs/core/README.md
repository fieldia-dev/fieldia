# @fieldia/core

The headless half of [Fieldia](https://fieldia.dev): the page format, modifiers
(`invisible`, `readonly`, `required`), validation, and a form's record state. It
never touches the DOM, so it runs the same in a browser, in Node, and on a server
that generates pages.

```sh
npm install @fieldia/core
```

```ts
import { validatePage, createForm, createMemoryDataSource } from '@fieldia/core';

const checked = validatePage(json);            // { ok, page } or { ok: false, issues }
if (!checked.ok) throw new Error(checked.issues.map((i) => `${i.path}: ${i.message}`).join('\n'));

const form = createForm({ page: checked.page, dataSource: createMemoryDataSource() });
form.setValue('email', 'sara@example.com');
form.subscribe((state) => console.log(state.values, state.errors));
```

Fieldia knows no backend. Records load and save through a `DataSource` — `load`,
`save`, `onchange`, `search`, `create`, `submit`, and `list` and `groups` for a
list of records — that your app implements;
`createMemoryDataSource` implements all of it in memory, for tests and demos.

The page format is also a JSON Schema, for editors and other languages:
`@fieldia/core/page.schema.json`.

A page says which format it is written in (`"fieldia": "0.9"`, `FORMAT_VERSION`; a page in 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7 or 0.8 is read as it is).
One in an older format is brought up to date as it is read — by `checkPage`,
`validatePage` and `createForm`, so by the viewer and the designer too — and
`upgradePage` does it for the pages your app keeps. One newer than this Fieldia
is refused with words that say so ("this page is in format 0.2, newer than this
Fieldia reads (0.1): update Fieldia to show it"):

```ts
import { upgradePage } from '@fieldia/core';

const page = upgradePage(stored);   // the same object when it is already current; a copy brought up step by step if not
if (page !== stored) await save(page);
```

A release that renames or reshapes a setting adds a step to `PAGE_UPGRADES`,
with a page before and after it that the tests run. What each release changed is
in the [changelog](https://github.com/fieldia-dev/fieldia/blob/main/CHANGELOG.md).

A page's `look` sets its accent, font, spacing, corners, labels and light or
dark scheme, and, under `parts`, a look for each kind of part over it — the
settings each kind has are `PART_LOOKS`:

```json
"look": {
  "accent": "#1f7a4d",
  "parts": {
    "inputs":  { "background": "#fff7e6", "border": "#c4320a", "corners": "round", "textSize": "large", "accent": "#c4320a" },
    "choices": { "accent": "#1f7a4d", "background": "#f0f7ff", "border": "#1677ff", "corners": "soft", "textSize": "small" },
    "groups":  { "background": "#fbfaf7", "border": "#d6cfc2", "corners": "round" },
    "buttons": { "accent": "#6941c6", "corners": "round", "textSize": "large" },
    "tables":  { "background": "#eef2f7", "border": "#9aa3ad", "textSize": "small" }
  }
}
```

## Values that wait for a line

A value worked out from others waits while one of them holds text that does
not read — "abc" in a line's Quantity — as the table's own total does, so it is
never shown counting the value that text replaced. Who works it out does not
matter: the page (a `compute`, such as `sum(lines, 'subtotal')`, and what is
worked out from that in turn) or your app (an amount or totals kept whole, read
only, which a source with an `onchange` works out as the lines change — a sales
order's Untaxed, Taxes and Total, Flectra's `tax_totals`). `form.waitsFor(field)`
says what it waits for — `{ field: 'line_ids', line: 1, column: 'qty' }`, the line
as people count lines, or `{ field: 'rate' }` for a field of the record's own —
and null when it shows its value; the viewer draws it as a dash, said in words
("Fix line 1 of Order lines to see Untaxed amount"). An answer your onchange
gives meanwhile is kept, and shown once the line reads.

It waits the same for an answer the form refuses: one shown that holds a value
its checks do not take — an area of −50 under its `min` of 0, a day past its
`max` of `today`, a pattern not met, an answer rule's error — on the record or
in a line's cell, whether the value is the page's own formula, one of
Fieldia's functions (`years(built_on, today())`) or your app's: "Fix Area (m²)
to see Price per m²", never −120,000.00. An empty answer is none, required or
not, and one no one is shown is never refused. What waits for an answer is told
before what is asked of your app's server for it.

## Functions, and your app's own

A value worked out (`compute`), a value set by a condition (`setWhen`) and every
condition call functions by name. Fieldia's own: `round`, `roundMoney`, `min`,
`max`, `abs`, `sum`, `count`, `average` on numbers; `today`, `days`, `age`,
`years`, `months`, `addDays`, `addMonths`, `addYears` on dates; `contains`,
`startsWith`, `endsWith`, `upper`, `lower`, `join`, `len` on words; `if`,
`empty`, `firstOf` to choose.

```json
"age":        { "type": "integer",  "label": "Age",            "compute": "age(birth_date)" },
"second_due": { "type": "date",     "label": "Second payment", "compute": "addMonths(first_due, 1)" },
"per_meter":  { "type": "monetary", "label": "Price per m²",   "compute": "roundMoney(price / area, currency_id)", "currencyField": "currency_id" },
"code":       { "type": "char",     "label": "Code",           "compute": "upper(join('-', city, firstOf(nickname, name)))" }
```

- `age(birth, on?)` counts whole years to today on the page's clock (its `timeZone`),
  or to a day given; `years(from, to)` and `months(from, to)` count whole ones,
  negative when the second day comes first.
- `addMonths(day, n)` ends on a shorter month's last day — 31 January and a month
  is 28 February — and `months` counts the same way, so the two agree. A date and
  time keeps its time. `addYears` moves 29 February to the 28th.
- `contains`, `startsWith` and `endsWith` read text whatever its case; `contains`
  also finds a value in a list (choices ticked, links).
- `join(between, values…)` joins the values — lists opened — with the words given
  first, leaving the empty ones out: `join(' ', first_name, last_name)`.
- `average` takes values or a list, or a field of the lines where a condition holds,
  as `sum` does: `average(lines, 'price', "qty > 0")`.
- `roundMoney(amount, currency)` rounds to the currency's places — three for a
  Jordanian dinar, none for a yen — the currency a code (`'JOD'`) or a link to one,
  read by its name.
- `empty(value)` holds for nothing, words of only spaces, an empty list; zero and
  no are values. `firstOf(a, b, …)` is the first that is not empty.

Each is read as the page is. **Refused**, by `validatePage`, `checkPage` and so as a
form is made: a function there is not, or one given too many or too few values.
**A warning**, never a refusal: a value of a kind a function does not take —
`age(notes)`: "age takes a date as its first value; "notes" is text". `validatePage`
passes such a page and says it in `warnings` beside it (`pageWarnings(page)` gives
them alone; `kindProblems` to your own tools); the designer says it as a fix to make;
the viewer runs the page as it always did, the call giving nothing — a function given
a value it cannot use gives nothing, never an error. A page that passed before still
passes.

**Your app's own.** Give the form `functions` — the viewer and the React, Vue and
Angular components take the same option — and a page calls them by name, beside
Fieldia's. A plain function will do; say what it takes and gives, and the page's
checks and the designer read it:

```ts
createForm({
  page,
  functions: {
    vatRate: { takes: [1, 1], values: ['text'], gives: 'number', tip: 'The VAT rate of a country: vatRate(country)', call: (country) => RATES[country] ?? 0 },
    // One that asks your server: a promise.
    districtPrice: { asks: true, call: (district) => api.get(`/districts/${district}/price`).then((r) => r.perMeter) },
  },
});
```

A number one gives is tidied as Fieldia's own arithmetic tidies one — `price * 1.1`
of 100 is 110, never 110.00000000000001 — and one that is no number (NaN, Infinity) is
nothing. A function that asks your server gives a promise. What is worked out from it waits
while it is asked — empty meanwhile, `form.getState().asked` says so by field
(`{ total: {} }`), `form.waitsFor('total')` gives `{ field: 'total', asking: true }`,
and the viewer shows an ellipsis, said in words ("Working out Total…") — then its
answer is worked into everything after it. It is asked once for the same values,
for the record shown: another record shown, its answer is laid on none. A save waits
for every answer; one that failed (`{ failed: 'why' }`) is asked again as the person
saves, and stops the save under its field when it fails again ("Total could not be
worked out: …"). A condition calling one does not hold while it is asked. A name a
page cannot call — Fieldia's own, a word of the language — is refused as the form is
made. `validatePage(page, { functions })` and `checkPage(page, { functions })` read
pages that call them.

## Options that follow the answers

An option of a choice may show only while a condition holds, written as a part's
`invisible`; and a choice may offer the options picked in an earlier one
(`optionsFrom: { "field": … }`), its own options after them:

```json
"features": { "type": "selection", "label": "Features", "multiple": true, "options": [
  { "value": "garden", "label": "Garden",  "invisible": "unit_type != 'villa'" },
  { "value": "lift",   "label": "Lift",    "invisible": "unit_type == 'villa'" },
  { "value": "security", "label": "24-hour security" }
] },
"again": { "type": "selection", "label": "Which would you have again?",
  "options": [{ "value": "none", "label": "None of them" }],
  "optionsFrom": { "field": "treatments" } },
"try_next": { "type": "selection", "label": "Which would you like to try?", "multiple": true,
  "options": [], "optionsFrom": { "field": "treatments", "picked": false } }
```

`form.offered(field)` gives the options a choice offers now: its own — or those its
app's list gave, or those picked where they are carried from (`picked: false`: those
left unpicked; a "None of these" is never carried) — less those whose condition hides
them. A chosen option a change no longer offers is taken out of the answer, never
silently kept: `form.getState().takenOut` says so by path ("Garden is no longer
offered, so it was taken out"), while it is true: it goes once the value is written
again, or once what it names is offered again (Villa picked again, the treatment
ticked again above, the list asked again offering it); one of several offered again
leaves it naming the rest. The same words for a choice its app's list no longer
offers, a page's or a line's. One a record held
as it was opened stays chosen, and the choice says it is no longer offered. The
page's checks read each option's condition and refuse a choice carried from itself,
from a field that is no choice, or round a circle.

A table line's choice takes conditions on its options too, read on the line's own
values and the record it is on (`parent.`): a room's "Garden room" only on the
ground floor, a "Pool house" only for a villa. `form.offered("rooms.k1.use")` gives
a line's by its cell's path; an option a change of the line, or of the record, hides
is taken out and said by that path (`takenOut["rooms.k1.use"]`). A line's choice
carries no options from a question: its own, or one of the app's lists — the same
`optionsFrom` as a page's own choice (`{ list, dependsOn }`, its `dependsOn` naming
the line's columns or `parent.` and a field).

## One text in several languages

A line, a paragraph or formatted text may keep its text in several languages, each
typed by a person — Fieldia never translates it (`translate`), and `requiredIn` says
which a required answer is typed in (every one when left out):

```json
"title": { "type": "char", "label": "Title", "translate": ["ar", "en"], "required": true, "size": 80 },
"description": { "type": "text", "label": "Description", "translate": ["ar", "en"], "required": true, "requiredIn": ["en"] }
```

Its value is an object of each language's text by its tag — `{ "ar": "شقة…", "en":
"Nile-view flat" }` — a language not typed yet left out, none typed `null`; a plain
text loaded for it is read as its first language's. The form checks it in each
language: "Title is required in Arabic" while it is typed in some (`languagesNeeded`,
or `languagesNeededQuestion` for a label that asks), "Title is required" in none;
each language held to the field's `size` and `pattern`, named in the problem ("Title
(English) is 4 characters too long: shorten it to 80"). `textIn(value, reader,
languages)` reads it as a reader of a language does — theirs where typed, else the
field's first typed, said to be another's — `languageName(tag, locale)` names a
language, `checkTranslated` and `languagesAtFault` check it. They come in the
languages part (`formLanguagesPart`), which a form with such a field asks for as it
is made and a save waits for; `languagesOf(field)` and `hasLanguages(page)` say
whether a page has one. A table's line keeps one language. The memory source finds
such a text by a search in any of its languages, and reads one text — a link's
name, a list's order — in its `language` option's.

## A public form's bot check

A page of responses anyone may send — a sign-up, a contact form — can check that
a person sent it (`botCheck`): a box no person sees or reaches, which a bot
filling every box fills (`honeypot`, on unless `false`); the fewest seconds a
person takes from the page shown to its send (`minSeconds`, 3 unless said; 0
tells none); and the slot the app draws its own captcha in (`captcha`: a slot's
name — Turnstile, reCAPTCHA, hCaptcha):

```json
"layout": { "type": "sections", "id": "signup", "children": [
  …,
  { "type": "slot", "id": "s-captcha", "name": "captcha" }
] },
"botCheck": { "minSeconds": 3, "captcha": "captcha" }
```

Nothing is refused for it on the page: each send tells the app what it saw,
beside the answers (`submit({ pageId, values, bot })`, and the `send` event), and
the app decides — keep the response aside, check the token with its service, or
refuse it:

```ts
async submit({ pageId, values, bot }) {
  // bot: { honeypot: false, tooFast: false, seconds: 41.2, captcha: '0.Zx…' }
  if (bot?.honeypot || bot?.tooFast) return keepAside(pageId, values);
  if (bot && !(await verifyTurnstile(bot.captcha))) throw saveRefused({ kind: 'rule', message: 'Tick “I am human” first' });
  return store(pageId, values);
}
```

The app's captcha widget hands its token to the form, `form.botCheck({ captcha: token })`
(null once it expires); a token goes once it is sent, as a captcha's is spent. The
viewer draws the hidden box and tells the form when it is filled
(`form.botCheck({ honeypot: true })`). A page without `botCheck` sends what it
always did.

## What a page says once it is sent, and answers in its words

A page of responses' `endings` say what it shows once its answers are sent: the
first whose `when` holds on the answers as they were sent — with what the data
source answered, the id it gave the response and the values it added — else the
one with no `when`, shown otherwise, which comes last. `{id}` in its words is
that reference:

```json
"endings": [
  { "when": "overall <= 2", "title": "We are sorry, {name}", "text": "{branch} will call you today.", "again": false },
  { "title": "Thank you, {name}", "text": "Your booking is {id}.", "again": "Book another" }
]
```

```ts
async submit({ pageId, values }) {
  const kept = await store(pageId, values);
  return { id: kept.reference, values: { confirmed_at: kept.confirmedAt } };   // what the ending reads
}
form.getState().sent;          // { id: 'B-1043', values: { …the answers sent, confirmed_at } } until reset()
form.ending();                 // the ending for them, or null
form.endingWords('Your booking is {id}.');   // "Your booking is B-1043."
```

`{field}` shows an answer in the page's own words too — a field's label and
help, each choice's words, a step's title and words, a wizard's and a button's
words — as in a text's and an alert's: `form.words('How was your visit to
{branch}?')` is "How was your visit to Zamalek?", and the form's messages name
the field so ("Please answer “How was your visit to Zamalek?”": a label that is
a question — ending with a question mark, or an ellipsis the answer completes —
is quoted in the language's marks wherever a sentence names it, `isQuestion` and
`quotedLabel`, and its required message is `requiredQuestion`). How a value reads
there is the viewer's (`valueWords` in `createForm`'s options: a choice by its
label, money with its currency, a day in the page's order); without one, a
choice's label, a link's name, Yes or No, anything else as held. After a bar,
the words said while the answer is empty — `{branch|this branch}` reads "this
branch" until one is chosen, translated with the page's other words; without
them an empty answer says nothing. A `{name}` that is no field of the page is
refused by the page check. `createMemoryDataSource`
answers each response as a server would with ``submitted: (request, count) =>
({ id: `B-${1042 + count}` })``.

## A quiz's results

A page of responses with `quiz` shows the person their results once the answers
are sent: their score, each question marked right or wrong, the right answer to
one missed and the question's own feedback. A choice's right answers are its
options marked `correct`; a question typed — a word, a number — names the
answers it takes (`quiz.answers`: words whatever their case and spaces, a number
by its value). A right answer earns its question's `quiz.points`, else the
page's, else 1; a choice whose options carry points (`score`) earns those, as
before, marked neither right nor wrong. With several answers, right is exactly
the right ones.

```json
"quiz": { "results": "now", "points": 1, "rightAnswers": true },
"fields": {
  "reversible": { "type": "selection", "label": "Which filler can be dissolved?",
    "options": [{ "value": "ha", "label": "Hyaluronic acid", "correct": true }, { "value": "caha", "label": "Calcium hydroxylapatite" }],
    "quiz": { "feedback": { "right": "Yes: hyaluronidase dissolves it.", "wrong": "Only hyaluronic acid can be dissolved." } } },
  "enzyme": { "type": "char", "label": "Which enzyme dissolves it?", "quiz": { "answers": ["Hyaluronidase"] } }
}
```

The form marks the answers as they go — `form.getState().sent.quiz` is
`{ score, max, questions: [{ field, points, max, right, answered, rightAnswer?,
feedback? }] }`, in the order they were asked — with the survey flow's part
(`formSurveyPart`, asked for as the form opens). `results: "later"` says the
results come once you have reviewed them, and shows none; `rightAnswers: false`
keeps the right answers back. The right answers travel in the page, where
anyone who reads its JSON finds them: a test where that matters keeps them out
of the page, marks the answers on your server and answers the send with them —
`submit` returns `{ quiz: { score, max, questions } }`, shown in place of the
page's. `quizResults(page, values, asked?)` marks answers the page's way for
your own code. A quiz has no pass mark of its own yet: your server may answer
the send with a value of its own (`values: { passed: true }`), which an
ending's `when` reads.

## A review before sending

`review` on a page of responses shows every answer before it is sent — by step
on a wizard, by titled group on a page of sections — each with Edit back to its
question, then Send: `true` in Fieldia's words ("Check your answers"), or
`{ "title": "Before you send", "text": "Press Edit to change one." }` in the
page's. The viewer draws it (the survey flow's part); the answers are checked as a
step's are before they show. `form.validate(within)` checks the answers inside
one part alone — a step, a question — as the review and one question at a time
do.

## One question at a time

`"flow": "one"` on a page of responses asks one question at a time (the
viewer's survey part draws it): each question on a screen of its own, Enter or
OK going on once its answer is checked (`form.validate(within)`, the question's
part alone), a choice picked going on by itself. A wizard's steps are entered,
checked and kept as ever. A record's sheet, and a list, are refused it.

## Questions in an order drawn, and N of M

On a page of responses, a wizard's `"order": "random"` shows its steps in an
order drawn for each respondent — a step `"fixed": true` keeps its place (a
welcome first, a page about you last) — and a step's or a group's shows its
questions so: words and pictures, and a question `fixed`, keep their places.
`"draw": 5` asks 5 of its questions, drawn, the rest never asked (nor
required, nor sent). The draw is seeded — `createForm`'s `seed` (an
invitation's code, a candidate's id), else the person's `user.id`, else one of
the browser's for each response — so the same seed draws the same in every
engine. The form keeps it as `state.order` (by part, its parts' ids in the
order shown), in its drafts — a page opened again shows the same questions —
and sends it with the answers (`SubmitRequest.order`). A quiz's results follow
the order shown. The draw comes in the survey flow's part (`formSurveyPart`, asked for
as the form opens; a form made before it came draws once it has).

## A time limit

`"timeLimit": { "minutes": 20, "warn": 2, "then": "send" }` on a page of
responses, or on one of its steps. A page's clock starts with
`form.startTimer()` (the viewer's Start), a step's as it is first entered; each
runs on the form's clock (`now`, `scheduler`) and runs out on time
(`state.timeUp`, by scope: `#form`, or the step's id). Its answers are then
locked, and their checks refuse nothing: they go as they stood — a required
answer not given goes empty. `then: "send"` (a page's default) leaves the send
to the viewer, at once; a headless app calls `form.save()` as `timeUp` changes.
`lock` (a step's default) keeps them for the person to send; a step's that
locks gives way to the next step. `form.countdown()` is the countdown showing
now (`{ scope, left, ends, stage: 'running' | 'warning' | 'up', … }`). Their
starts are kept in drafts (`StoredDraft.timers`), so a page opened again goes on
counting; the send tells `started` and `timeUp`. The clock is the browser's: a
server that must be sure keeps its own.

## Files stored as they are picked

Give the data source `upload(file, request)` and a file or picture field sends
each file to your store as soon as it is picked; the record keeps only the link
it returns — `{ url, name, size, type, fileId }`. `form.upload(field, files)`
does it for a widget of your own: `state.uploads` shows each on its way (its
`status` and the bytes `sent` of `total`), three at a time, in the order picked,
and `form.uploading(field)` gives one field's own;
`form.cancelUpload(id)` and `form.retryUpload(id)` stop one and send a failed
one again. A file picked in a table's cell goes as its line's (`request.line`). `form.save()` waits for those still going, stops under the field for
one that failed, and stores bytes still in the record (a signature drawn) first.
A saved form placed in a record keeps to the same: its files are stored for the
record (`model` and `recordId` are the record's, `field` is where it sits:
`consent.deed`), and the record's save waits for them. A file picked while a save
is on its way stays a change, to save next. A draft never keeps a file's bytes
where the source has `upload`; without it, a draft keeps them, as before.
The sending itself — each file made ready and sent, its link put in its field —
is a part of its own (`formUploadsPart`), which comes with @fieldia/widgets'
files part, or the first time a form sends a file: `form.upload` gives its ids
at once, each file waiting its turn until the part is in.

```ts
import { uploadTo } from '@fieldia/core';

// A POST of a form with the file under `file`; its link from the answer's JSON `url`.
const dataSource = { ...yourDataSource, upload: uploadTo({ url: '/api/files', headers: { 'X-CSRF-Token': token } }) };
// Or a PUT to an address your server signs (Azure Blob's SAS): the link kept without the signature.
const toAzure = uploadTo({ method: 'PUT', url: (file) => signedAddress(file.name), headers: { 'x-ms-blob-type': 'BlockBlob' } });
```

To refuse a file, throw `saveRefused({ kind: 'rule', message })`: the field shows
your words and offers no Retry; any other error offers Retry. Stop with an
`AbortError` when `request.signal` aborts. `createMemoryDataSource({ storage:
{ bytesPerSecond, fails } })` is a store as slow, or as unreliable, as a real
one. Without `upload`, files travel inside the record as base64, as before.
See [files stored as they are picked](https://fieldia.dev/data/#upload).

A photo set (`"widget": "photos"`, @fieldia/widgets' README) keeps everything in
the field's value, so any source that keeps a file value keeps it: the photos in
the order a person put them (the first the cover), a photo's `caption`, and for a
photo cropped or turned the photo as it was (`original`, a file value of its
own) and what was done to it (`edit`: `{ turn: 90, crop: { x, y, width, height }
}`, fractions of the turned original). A photo cropped is stored at once —
`form.upload(field, [file], { replaces })`: its link takes the place of the
bytes the field holds for it, with whatever stands beside them by then (a
caption typed meanwhile).

## Lists that add up, and filter by time

A list asks its source's optional `totals({ model, filter, totals, groupBy?,
interval?, currencies? })` for a column's sum, average, lowest, highest or
count — over the search, under each group, or the rows ticked (`id in` their
ids) — and its `groups` for a date by the span it falls in (`interval`: `day`,
`week`, `month`, `quarter` or `year`, with `weekStart` and `timeZone`), each
group's value its span's first day. An amount named in `currencies` (by the
field holding each record's currency) is totalled within one currency only:
over several, its sum is `null`, and `currencies` in the answer names the one
it is in. A period a list's filter names ("This month", "Overdue") arrives as
plain conditions. `spanStart(value, interval, { weekStart, timeZone })` finds
the span a value falls in as the list counts it, and `dayIn` and `dayStarts`
a day in a time zone; `createMemoryDataSource` does it all. See
[lists that add up](https://fieldia.dev/lists/#totals).

## A map's records counted where they crowd

A list's map (@fieldia/map) asks its source's optional `clusters({ model,
filter, field, longitude?, bbox, zoom, radius, fields, weight?, signal })` for
the view's bubbles — `{ clusters: [{ lat, lng, count, bbox?, weight? }],
points?: [{ id, values }], unplaced? }` — instead of loading at most 500 records
and gathering them itself: every record a search finds, however many, a record
standing alone with its values for its pin and its card. Answer `false` to let
the map load the search's records, as it does without the member. The memory
source has it where its `clusters` option says how it answers:
`createMemoryDataSource({ records, clusters: gridClusters({ models: ['home'] }) })`
gathers its records by a grid of squares fixed to the world, as a server does.
See [lists on a map](https://fieldia.dev/lists/#map).

## Time zones and booking slots

A page may name the time zone its dates and times are in, by its IANA name —
a branch's, a clinic's — and a date and time field may name its own:

```json
{ "timeZone": "Europe/Berlin", "fields": { "flight": { "type": "datetime", "label": "Departs", "timeZone": "Africa/Cairo" } } }
```

A date and time is still kept as an instant, as before (`2026-10-15T12:30:00.000Z`;
one written with its offset is read the same). It is shown and typed on the
zone's clock wherever the person is, with the zone's short name beside it where
the browser's zone is another ("14:30 CEST"). Today is the zone's day: a date's
default `"today"`, its earliest and latest counted from today, `today()`, a
rule's past and future, and `form.today()`. A time the clocks skip, or repeat, on
a change day is said, never moved. `zonedPage(page)` writes the page's zone into
each date and time field that names none, as the form and the viewer read it;
`wallTime`, `instantsAt`, `dayIn` and `clocksSkip` are the clock arithmetic
they use. `checkPage` and `validatePage` refuse a zone the browser does not know.
Without `timeZone`, the browser's own zone, as before.

A selection's choices may come from the app's own lists (`optionsFrom: { list,
dependsOn }`), through the data source's `options({ list, values })`, asked again
when a field in `dependsOn` changes — by the person, a step or the app: a choice
the new answer does not offer is then taken out and said (`state.takenOut`, as a
condition's is, until its value changes again); a record that comes in with one
keeps it, and its save says why. On a table's line they are that line's:
asked with the line's values and the record it is on as `parent`
(`dependsOn` naming the line's columns, or `parent.` and a field), shared by the
lines whose columns hold the same values, and kept by the cell's path in
`state.choices` (`form.loadChoices("tool_ids.k1.tool")`), taken out and said the
same way, by the cell's path, as a column they change with changes on that line. `form.lineChoices(field, key, column,
values)` asks a line's for a row about to be pasted on it. The memory source's
`lists` functions take the request after the values.

A date and time drawn as booking slots (`"widget": "slots"`) asks the data
source's `slots(request)` for its free times: the days asked (`from`, `to`, in
`timeZone`), the schedule its node names (`options.schedule`), the booking's
`length` and the minutes `between` two as the page says, the record and its
values. It answers each day's state — `open`, `full`, `closed`, `holiday` with a
`note` — and the times free, as instants, and may say the booking's `length`.
`form.findSlots(field, { from, to })` asks it for a widget of your own;
`form.canFindSlots()` says whether the source can. Without `slots`, the field is
the plain date and time box. For demos and tests, `scheduleSlots(schedules)`
answers from booking schedules — hours by the day of the week on a zone's clock,
a booking's length, the minutes kept free after one, holidays, and the records
the bookings are:

```ts
import { createMemoryDataSource, scheduleSlots } from '@fieldia/core';

const weekday: [string, string][] = [['09:00', '13:00'], ['14:00', '18:00']];
const dataSource = createMemoryDataSource({
  records,
  slots: scheduleSlots({
    showroom: {
      timeZone: 'Europe/Berlin',
      hours: { 1: weekday, 2: weekday, 3: weekday, 4: weekday, 5: weekday, 6: [['10:00', '14:00']] },
      length: 45,
      between: 15,
      holidays: { '2026-12-25': 'Christmas Day' },
      bookings: { model: 'drive.booking', field: 'start', endField: 'stop', same: ['car'] },
    },
  }),
});
```

## Possible duplicates and Merge

A record's page may name the fields records like the one typed are found by —
the same phone, email or tax id, a name close enough:

```json
{ "duplicates": { "fields": ["name", "phone", "email", "vat"], "on": "type" } }
```

The data source's `duplicates({ model, recordId, values, fields })` is asked
with the fields named that hold a value (none: nothing is asked), every value of
the form and the record typed (null while new), and answers with the records
like it — `{ matches: [{ id, name, why: ['phone'], score? }] }`, `why` naming
the fields each matched on. `on: "type"` (the default) asks as those fields are
typed in, as a saved record opens and as it is saved; `"save"` only as it is
saved. Nothing is in the way of a save. `merge({ model, keepId, mergeIds,
values, fields })` keeps `keepId` with the value picked for each field and takes
`mergeIds` away; moving what was theirs (messages, activities, links) is the
source's work, and `saveRefused({ kind: 'rule', message })` refuses it.
`form.findDuplicates()`, `form.readRecord(id)` and `form.merge(…)` ask the
source for a screen of your own, `form.canFindDuplicates()` and
`form.canMerge()` say whether it can; the viewer says each match under the field
it matched on, with Open it, "It's someone new" and Merge (`@fieldia/viewer`).
"It's someone new" is kept on the app's server where the source has both
`notDuplicates({ model, recordId }) → ids` (asked as a saved record is shown,
before its matches are said) and `markNotDuplicate({ model, recordId, matchId })`
(as it is pressed on a saved record, or a new one is saved after it): a pair,
answered from either side, so another device lets that record be too; without
both, the person's browser keeps it (the viewer's `preferences`), as before.
`form.keepsNotDuplicates()`, `form.notDuplicates()` and
`form.markNotDuplicate(matchId)` reach them.
`checkPage` and `validatePage` refuse a field the page has not, one named twice,
and one of a kind records are not compared by (`DUPLICATE_KINDS`). Without
`duplicates` in the source, nothing is asked. For demos and tests,
`alikeRecords()` answers from the memory source's records — the same value as
people write them apart (a phone's spaces, an email's case, a link's record) or,
in the name field, a name close enough (`nameLikeness`) — its `merge`
merges as a backend would, and its `notDuplicates` and `markNotDuplicate` keep
what was let be as pairs (`notDuplicatePairs`, an option to start from):

```ts
import { alikeRecords, createMemoryDataSource } from '@fieldia/core';

const dataSource = createMemoryDataSource({ records, duplicates: alikeRecords() });
```

## A signature that signs the answers

A signature (`"widget": "signature"` on a binary field) may sign answers: `signs`
names them — `"form"`, every answer shown on the page, or the fields by name —
and `signerField` the field holding the signer's name (a text, or a link's
record; left out, the name typed on the pad, else the form's `user`):

```json
{ "type": "field", "id": "f-signature", "field": "signature", "widget": "signature",
  "options": { "signs": ["patient", "treatment", "areas", "risks_read"], "signerField": "patient" } }
```

Signed, it keeps beside its picture who, when and a fingerprint of the answers
(`FileValue.signed`, a `SignatureEvidence`), once what is typed in them is read
— an answer still to give, or text that does not read, is said, and nothing is
signed:

```json
{ "name": "signature.png", "type": "image/png", "size": 5120, "data": "iVBOR…",
  "signed": { "format": "fieldia-signature/1", "by": "Mona Adel", "at": "2026-10-19T08:42:00.000Z",
              "fields": ["patient", "treatment", "areas", "risks_read"],
              "sha256": "2e3b5fa2ca4b2012eeb1fe7895af5c05dda2c3f5a76246b78fff3b530dbae16d" } }
```

While a signature with evidence is kept, the form locks the answers it names —
whatever the page's conditions say (`form.node(id).readonly`,
`form.fieldReadonly(name)`) — until the person takes it away with Change
answers, asked first, and signs again. `signedBy(fields, values)` says which
signature locks which answer; `evidenceOf(value)` reads one. The evidence
travels in the value: a store that keeps a signature as bytes keeps `signed`
beside them (a save storing the picture keeps it, as it keeps a typed name's
`text`). `form.now()`, `form.user()` and `form.shownFields()` are what a
signature reads — the clock, the person, the answers shown.

**The canonical form, `fieldia-signature/1`.** The fingerprint is the SHA-256,
in small hexadecimal letters, of the UTF-8 bytes of this JSON, written as
RFC 8785 (JCS) writes JSON — no spaces, each object's keys in the order of their
UTF-16 code units, numbers as JavaScript writes them:

```json
{"answers":{"areas":["forehead"],"patient":"Mona Adel","risks_read":true,"treatment":"botox"},"at":"2026-10-19T08:42:00.000Z","by":"Mona Adel","field":"signature","format":"fieldia-signature/1","page":"clinic-consent"}
```

— the text of the evidence above, whose SHA-256 is its `sha256`.

`answers` holds each field the evidence names, as the person saw it as they
signed: nothing (null, an empty text, no choice) is `null`; yes and no `true`
and `false`; a number itself; a text, a choice's value, a date and a time their
text as kept; a date and time kept with its zone, its instant in UTC with
milliseconds; a link its record's id (several, their ids in order); a reference
`{ "id", "model" }`; a file `{ "name", "size", "type" }`; a table's lines an
array of each line's own fields; anything else its JSON by these rules. `by` is
left out when no one is named; `page` is the page's id and `field` the
signature's. So an app checks a record it keeps in any language — or with the
evidence part's own functions (@fieldia/widgets' `evidencePart`, the part a
page whose signature signs answers loads), in a browser or on a server:

```ts
import { evidencePart } from '@fieldia/widgets';

const { answersMatch, signatureText, sha256Hex } = await evidencePart.load();
const same = await answersMatch(record.signature.signed, page, 'signature', record);   // true while no signed answer changed
```

Only a signature the page has sign answers locks them (`signsAnswers(node)`):
a page whose signature no longer says `signs` treats it as a picture, whatever
its value carries.

`checkPage` and `validatePage` refuse `signs` that is neither `"form"` nor a
list of the page's fields, a signature signing itself, and a `signerField` that
holds no name. Two people signing in turn is the app's (a flow's) to order: each
signature signs its answers.

## Opening, closing and limiting a form

A page of responses may say when it takes answers, and how many; any choice's
options may say how many may pick each:

```json
{
  "limits": { "opens": "2026-11-01T09:00", "closes": "2026-11-20", "maxResponses": 200, "onePerPerson": true, "message": "See you in December." },
  "fields": { "session": { "type": "selection", "label": "Session", "options": [{ "value": "am", "label": "Morning", "seats": 30 }] } }
}
```

`opens` and `closes` are read on the page's clock (`timeZone`): a day and a
time, or a day alone — opening at its first minute, closing at its end. The
data source's `limits({ pageId, model, recordId, fields, user })` answers
`{ responses, mine, perChoice }`: the responses sent so far, this person's, and
for each choice field asked how many hold each option (the record edited not
counted). The form asks it as it opens — `state.limits.state` is `asking`
meanwhile where the page counts responses — after a record loads, after every
send, as it starts again, and just before its answers go. `state.limits` tells
whether it takes answers now (`open`, `soon`, `closed`, `full`, `sent`), when it
opens and closes, the responses it takes still, and each choice's places
(`seats[field][value]`: `{ seats, taken, left }`); `takingWords(page, limits,
messages)` says why it takes none ("This form closed on 20 Nov 2026."). Every
message that names a day writes it as the page's date boxes do — its
`look.dateOrder` (the form puts it on its messages, `messages.dateOrder`), its
language, a time on its clock: "can’t be after 20 Oct 2026", "Oct 20, 2026"
month first; `dayWords(day, messages, order?)` is that rule (a time after it: `whenWords`). A full option the person picks is refused,
said under its field ("Afternoon workshop is full"); one that filled up while
held, or a page closed since it was opened, stops the send. The app's own
`setValues` is never refused: the check says it. Without `limits` in the
source, the page keeps to its dates alone. The memory source counts its own
responses over its `limits` option's starting counts, and
`answeredElsewhere(pageId, values)` takes one as someone else would.

## Save and resume on another device

A page with `continueLater` keeps its answers on the app's server as they are
typed — and as a wizard's step is entered — through the data source's
`saveDraft({ pageId, model, recordId, key, draft, later })`, which answers with
the draft's key (and, on Continue later, the `link` to carry on from and words
of its own); `loadDraft({ pageId, key })` gives the draft back. A draft keeps
the answers, the wizard's step and the steps passed over, text typed that does
not read (`unread`, as typed, with why) and the fields answered. The form's
`resume` (the key from the link) opens it — at its step, or the nearest before
it that still applies, its unread text said again — and a key that names none
leaves `state.resume.missing`. `form.continueLater()` reads what is typed and
keeps the draft (`later: true`); `form.canContinueLater()` says whether the
page and its source can; the `draft` event tells each draft kept. A send
carries the draft's key (`SubmitRequest.draft`, `SaveRequest.draft`). Without
the two members, drafts stay in the browser's store (`drafts.store`), as before
— with their wizard step now; with them, that store keeps only the key.

```ts
const form = createForm({ page, dataSource, resume: new URLSearchParams(location.search).get('resume') ?? undefined });
form.on('draft', ({ key, later, saved }) => later && console.log('Continue from', saved.link));
```

## Approvals on a record

A record's page may say its records wait for approval:

```json
{ "approval": { "open": ["notes"] } }
```

The data source tells where a record stands, `approvals({ model, recordId,
user })` answering `{ levels, history, mine, together, why }` — each level its
`id`, `name`, `approvers` (each `{ id, name, decision, at }` in the round asked
now), `needs` (`any`, the default, or `all`) and `state` (`waiting`, `later`,
`approved`, `rejected`, `skipped`); `history` oldest first (`{ decision:
'requested' | 'approved' | 'rejected', level, by, at, reason }`); `mine` the
levels this person may decide now — and takes the decisions, `decide({ model,
recordId, level, decision, reason, user })`, a rejection always with why. Who is
asked, and in what order, is the app's, or its approval engine's: Fieldia never
works it out. The form asks as a saved record is shown, after each save and each
decision, keeping what it told in `state.approval` (`status`: `none`, `needed`,
`waiting`, `approved`, `rejected`); an answer for a record no longer shown is
laid on none. While it waits, every field is read-only but those `open` names
(`form.node(id).readonly`, `form.fieldReadonly`), `form.approvalLock(name)`
saying why; `"lock": false` locks none. `form.decide(level, decision, reason?)`
reads and saves what is typed first, then decides, then loads the record again;
it refuses a level not this person's and a rejection with no reason, in words.
The memory source's `approvals` option routes records as an engine would (in
turn or together, any or all, a rejection ending the round), keeping each
decision; `approvalHistory` is what it starts from.

```ts
await form.decide('finance', 'rejected', 'Over the quarter’s budget');
form.getState().approval?.status; // 'rejected'
```

## AI help: values proposed, words written, a search read

Three optional members answer with the app's own model — Fieldia ships no model
and no keys. `suggest({ page, values, fields, from: { text?, files? } })` gives
values for a form (a page's `suggest`: `fields`, `label`, `from`, `fromField`),
a table's lines to add among them; `rewrite({ field, how, text, values })` a
text field's words (its node's `options.rewrite`: `"draft"`, `"polish"`, or
`{ "how", "label" }`); `searchToFilter({ text, fields })` a list's conditions
(its `searchToFilter`). The viewer shows each value on its field to accept or
reject first, and Undo after; `checkPage` and `validatePage` check the settings.
The memory source has each member only where its `assist` option answers it;
`assistStandIn({ drafts })` is a stand-in for demos and tests — no model, words
read by their patterns, every answer saying so ("Stand-in AI, no model: …"):

```ts
import { assistStandIn, createMemoryDataSource } from '@fieldia/core';

const dataSource = createMemoryDataSource({ records, assist: assistStandIn({ drafts: { 'enquiry.reply': (values) => `Dear ${values.partner_name},` } }) });
```

## What a page's records are called

A page may say what its records are, so Fieldia's own sentences name them as
the business does — "A customer with this phone already exists", "17 customers
imported", "Are you sure you want to delete this customer?", "New customer" —
where they said "record", or no noun at all:

```json
{ "records": { "one": "customer", "other": "customers", "a": "a customer" }, "lowerLabels": true }
```

`one` and `other` are the words for one record and for more, as they stand
inside a sentence; a sentence that counts picks one of them as its language does
for the number. `a` is one with its article, where the language puts one before
it ("an invoice", "une facture"): Fieldia never guesses an article, so a
sentence that needs one says "A record …" until it is given.

The page's own `lowerLabels`, beside `records` (label casing is no part of what
records are called), writes a field's label with a small first letter wherever one of
Fieldia's sentences puts it after a word of it — the form's messages ("Choose at
least 2 for interests", "End date can’t be before start date"), a refused save's
"Not saved. Check: email", a value that waits ("Fix tax rate to see total"), a
help's, a lock's and a link's × names, a possible duplicate ("A customer with
this phone already exists"), a conflict ("They changed: phone."), a column's
grip, a filter's menu, a search's suggestion, a history's "changed status to …"
— while a label that begins its sentence keeps its capital: "Phone is
required", and a heading's place, "Status: nothing is called …" (an import's
refusals, an input's). Off unless said, since only the page knows whether that
is right: a label whose first word is a name ("IBAN", "VAT number", "WhatsApp",
"E-mail") stays as written, its first letter alone ever changes ("found in
Build"), and every label stays as written in a language that writes its nouns
with a capital (German) or has none (Arabic). One rule says it, `labelAt(template,
key, lower, locale)`; the form's messages carry the page's ask as
`messages.lowerLabels` (`fillMessage`). A page asks it with its records named or
not, a survey too. A line's own dialog says its labels as its record's page asks — a part
of the same record — unless the line's own page (`lineOpens: "record"`) says
otherwise; a list's Edit dialog as the list's page asks. Other languages come through the
page's `translations`, as its other words do (`"customer": "عميل"`), and
`pageWords` lists them for a translator.

The form's own sentences say them — what it asks before the gear menu's Archive
and Delete, why a person may not change, archive, copy or delete one, why a run
of steps stopped, what letting changes go asks — and the viewer's (a list's, a
record's, possible duplicates', a related list's in its model page's words: see
`@fieldia/viewer`). Each such sentence is a message of its own beside the plain
one (`deleteConfirmNoun`: "Are you sure you want to delete this {record}?",
with `{record}`, `{records}` and `{aRecord}`); `recordSentence(records, named,
plain, locale)` says one. A language, or an app's own `messages`, that has no
such sentence says its plain one: a page that names no records reads as before.
`checkPage` and `validatePage` refuse a word for one or for more left out.

## Two people, one record

A source that keeps versions returns each record with its version, and what this
person may do with it, through `loadedRecord`. The form sends the version back
with each save; a source that finds the record changed since throws a
`ConflictError` naming who changed it and when:

```ts
import { ConflictError, loadedRecord } from '@fieldia/core';

async load({ model, id }) {
  const row = await api.read(model, id);
  return loadedRecord(row.values, {
    version: { token: row.etag, by: row.changedBy, at: row.changedAt },
    can: { edit: row.isMine, delete: false, readonlyFields: ['commission'], reason: 'Only Mona can change it.' },
  });
},
async save({ model, id, changes, version }) {
  const response = await api.write(model, id, changes.values, { ifMatch: version?.token });
  if (response.status === 409) throw new ConflictError({ version: response.body.version, theirs: response.body.values });
  return { id, version: response.body.version };
},
```

The form keeps it in its state — `version`, `can`, and after a refused save
`conflict` (who, when, the fields they changed and those both changed) — and
offers the two ways on: `form.reloadTheirs()` loads the record as they left it
and sets this person's changes aside in `setAside`, each put back with
`form.putBack(field)`; `form.keepMine()` saves them over the record as it is
now, their values kept wherever this person changed nothing (read again first
when the conflict did not carry the record, so `values` never wipes theirs; when
it cannot be read, nothing is saved and `conflict.unread` says so). A second save
while one is on its way waits for it and carries the version it got back.
Every way a form's values go — `openRecord` (the pager, an action's answer
naming a record, Duplicate's copy), a reload (the step, an answer's
`reload: true`, `form.load()` again), a `reset` step, the host's `close` (yours
too: the form takes it once, where it is made) — goes through one check,
`form.leave()`. It first waits for a save on its way and files on theirs
(`state.leaving` meanwhile, so the page can say so; a second way out joins that
wait), then looks at the record as it is now. A save's answer lands only on the
record it was started for: one shown in its place meanwhile never gets its
values. It asks only about the person's work at risk (`workAtRisk(state)`):
each change of theirs the last finished save of the record did not send —
typed while it was on its way, while the run that saved went on, or since
(`state.unsent`, told against the record as that save left it; a value set by
a step, a rule, a compute or your app is never theirs; text they left since
that does not read, "12a", counts as "12" does) — a file the store holds
that no save sent, files still on their way, and changes Reload set aside. Then
it asks "Discard your changes?" through the host's `ask(message, { discard:
true })`, or `confirm`; Cancel keeps the person where they are, and with
neither to ask with the work is kept. Before a record's first save, every way
out behaves as it did in 0.20: a change not saved goes where a step leaves the
record. `form.leaveNow()` says whether a way out can go at once. Call
`form.leave()` before your app's own ways out — a route change, an unmount —
and `unsavedWork(state)` (any change, file or change set aside) for a browser's
`beforeunload`, or let the viewer keep it (`warnOnLeave`). A save refused for a
conflict, waiting for Reload or Keep mine, is at risk too: the person asked for
it to be saved. Discard lets the changes no save took go back to the record as
the last save left it. Every answer that comes late — an onchange, a step's
Archive, Duplicate or Delete, Keep mine's read, a name a box looks up — is laid
only on the record it was asked for: anything of your own that waits and then
writes on the form asks `form.recordShown()` first (taken as it asks, true
while that record is still shown, as it was). What `can` does
not allow is kept to before any source is asked: fields locked or hidden (and
left out of what a save sends), a save refused with the source's `reason`, the
gear menu's Archive, Duplicate and Delete and the buttons whose steps would do
them hidden. `createMemoryDataSource({ versions: { by: 'Sara' }, can })` does
it all in memory, and `changeElsewhere` changes a record as someone else would.

## Many records at once

A list's "Select all 1,284 that match", its Export and its Edit of many
records read three optional members. `list({ …, allIds: true })` answers with
`allIds`, every matching id in the list's order (fewer than `total` means the
source stopped short, and the list says so). `writeMany({ model, ids, values,
fields, versions })` writes one value in a field of each record and answers
`{ failed: [{ id, message, problem? }] }`; without it the list saves each record
in turn (`save` with `partial: true` and the version it was listed at).
`exportRecords(request)` writes an export on the server: answer with the file
(`{ name, data }`, data a Blob, bytes or text, or `{ name, url }`), with
`{ message }` when it is handed over another way, or with `false` to let the
browser write it. A page offers Edit with its list's `bulkEdit` (`true`, or the
fields), and Export with `"export": true` — each off unless asked; `bulkEditFields(page, list)`
says which fields Edit offers. `createMemoryDataSource` gives `allIds` and
`writeMany` (each record refused as its save would be), and no `exportRecords`.
See [many records at once](https://fieldia.dev/data/#many).

## Records that point at this one

A page's `related` part lists another model's records whose link is this
record — a customer's invoices — inside it (the viewer draws it). Its
`model`, `field` (their many2one to this page's model), `fields` and `columns`
say what it lists; `filter`, `sort`, `limit`, `cells`, `searchFields`,
`viewAll` and `create` the rest. `form.relatedFilter(id)` gives what it asks
the data source's `list` for, as the source gets it: the link to the record
shown, then its own filter with each `valueFrom` read from that record — or null
before the record's first save. No new data source member: `list` answers it.
The page check holds its columns, order, search and cells to its own `fields`,
its link to a many2one of theirs to this model, and it to a record's page. A
tab holding one may count its records (`"count": { "related": "<its id>" }`,
`TabCount`); the check holds that id to a related list inside the tab, and
`relatedInTab(tab, id)` finds it there. `"open": "app"` sends its rows and New
the app's own way first (the viewer's `onOpen`), a dialog where it does not take
them.

A list's Import makes records from a file's rows. `createMany({ model, records,
fields })` makes many at once and answers each in order: `{ id }`, or `{ message,
problem? }` for one it refused; without it the list saves each as a new record,
`save(newRecordSave(model, fields, values))`. `importRecords({ model, file,
columns, rows, fields, locale, dateOrder })` takes the file on the server once
its columns are matched: answer `{ message }`, or `false` to let the browser
import it. A page offers Import with its list's `import` (`true`, or the
fields); `importFields(page, list)` says which fields a file's columns may fill.
`createMemoryDataSource` gives `createMany`. See [many records made at
once](https://fieldia.dev/data/#import).

## A record found by a code a scanner read

A link scanned into with the camera (`options.scan` on a many2one or a table's
link column, drawn by @fieldia/widgets' scan part) finds the record a code names
through the data source's `search`, with no member of its own:
`form.search(field, code, 2, { field: 'barcode' })` asks for the records whose
`barcode` holds the code exactly — the field's own filter kept, the condition
added to it, the query empty — and `form.searchLine(…)` the same for a line's
link. Without a field named, the code is searched as a name, the exact name
first. The page check holds `options.scan` to a kind a code is written into —
a char, a text, a many2one, or a one2many counted by a column (`field`) and a
number (`count`) — and the fields a GS1 code fills (`fills`) to fields of the
page, or of the line, that take a code's part; `ScanOptionSchema`
gives its shape. See [scanning a code](https://fieldia.dev/fields/#scan).

## A saved form placed in another

A block made once — an address, a contact person, a consent — is a page of its
own, placed in any other by its id with a `form` part:

```json
{ "type": "form", "id": "home", "page": "address", "name": "home_address", "title": "Home address" }
{ "type": "form", "id": "billing", "page": "address", "version": 2, "name": "billing_address" }
```

- `page` is the saved page's id; `version` keeps to one published version, and
  left out means the latest.
- `name` is where its answers go: the values hold them under it as an object,
  `{ "home_address": { "street": "12 Nile Street", "city": "Cairo" } }`, so two
  copies of one form never mix. It must not be a field of the page, nor another
  copy's name.
- `title` is the words over it: the saved page's own title when left out, none
  when empty. `colspan`, `invisible` and `readonly` work as on a section.

Only a page of `sections` or `tabs` can be placed; a page cannot be placed in
itself. The page's own conditions cannot read inside a saved form's answers.

A form is given the saved page once the app has found it —
`form.embed(partId, page)`, as the viewer does — and returns the inner form.
From then the saved page's own required fields, answer rules, conditions and
worked-out values hold inside it: the outer form refuses to save or send while
one fails (the error under `home_address.street`, shown on the inner form beside
its field), sends only the copies on show, tells `home_address` as changed when
anything inside changes, and loads, puts back and saves the nested answers. A
data source sees each copy's answers as one JSON value under its name.

## What a press or a moment does

A button — in the body, a record's header, a stat button or a list's actions —
runs `steps`, in order, each plain data and never code; and the page's `on`
runs them at its moments:

```json
{ "type": "button", "id": "new-customer", "label": "New customer", "steps": [
  { "do": "open", "page": "customer", "as": "panel", "values": { "name": "customer_name" },
    "into": { "customer_id": "id" }, "then": [{ "do": "say", "message": "Customer added", "tone": "success" }] }
] }

"on": {
  "change": { "product": [{ "do": "call", "action": "check_stock" }] },
  "beforeSave": [{ "do": "check" }, { "do": "ask", "message": "Send the order?" }],
  "afterSave": [{ "do": "say", "message": "Order sent", "tone": "success" }]
}
```

- `open` another page in a `dialog` (the default), a `panel` beside this form,
  or in its `page`; on a `record` (an expression giving its id) or a new one with
  `values`. A panel comes from its `side`: `end` (the default: the end of the
  line, the right or, right to left, the left) or `start`, as the page reads;
  or `left`, `right`, `top` or `bottom`, whatever its direction — a side on a
  dialog or a page in its place is refused. Once it is saved or sent, `into`
  sets this form's fields from its answers (`id` is the record it saved) and
  `then` runs here.
- `set` a field from an expression, `clear` one, `addLine` to a table of lines.
- `check` the form or some fields, `save` (a page of responses sends), `reset`.
- `goTo` a tab or a wizard step, `say` something in a tone, `ask` Yes or No.
- `call` one of the app's own actions by name, with `params`; `close` the dialog
  or panel the form was opened in.
- `openUrl` a web address an expression gives, in a new tab unless `newTab` is
  false; `reload` the record from the data source after the app changed it —
  an app's answer may ask for that with `reload: true`. An `open` of a list
  page may give a `filter` — `valueFrom` reading this form — so it shows only
  the records related to this one.

Any step may run only `when` a condition holds. A step that fails or is refused
stops the ones after it: a check that finds problems, No to a question, a save
that cannot be made, the app saying stop, a page closed without saving. The
moments are `open`, `change` (by field: a person's change, never a step's or a
rule's), `beforeSave` (a step that stops keeps it unsaved), `afterSave` and
`show` (by tab or wizard step id). A button may still name only an `action`,
handed to the app as before.

### Running steps

A press runs with `form.runAction(id)`: the button's `confirm` asked first,
then its `steps`, then its `action`, when it names one, as a final `call`.
The app runs its own with `form.run(steps, { id })`. Each run ends with a
`RunResult`:

```ts
const result = await form.run([{ do: 'check' }, { do: 'save' }]);
// { done: true }
// { done: false, stoppedAt: 0, step: { do: 'check' }, reason: 'check', message: 'Email is required' }
```

- `reason` is why it stopped: `check` (problems found, and shown), `no` (a
  question answered No), `save` (refused: the first problem, or the backend's
  words), `app` (the app said stop, or threw — `error` holds what), `closed`
  (a page opened and closed without saving), `cannot` (it cannot run here: no
  host to open with, a field the page lacks).
- `stoppedAt` is its place among the steps run — for a step of an `open`'s
  `then`, the open step's; for a button's `action`, one past its steps; none
  when the `confirm` was answered No — and `step` is the step itself.

What the core cannot draw it asks of a host, which the viewer gives:

```ts
const form = createForm({
  page,
  dataSource,
  host: {
    open: (request) => showPage(request), // { page, version?, as, side?, title?, recordId, values? } → { saved, recordId?, values?, label? }
    say: (message, tone) => toast(message, tone),
    ask: (message) => askYesOrNo(message), // Promise<boolean>
    close: () => panel.close(), // the dialog or panel this form was opened in
    show: (tab) => tabs.pick(tab), // and the viewer calls form.shown(tab), as for a tab picked by hand
  },
});
```

Without a host, `say` says nothing, `ask` asks the form's `confirm` option — or
goes on as though answered Yes, so a form run from code is never held by a
question — and `open`, `close` and a `goTo` of a tab stop with `cannot`. The one
exception is "Discard your changes?" (`form.leave()`, with the person's work at
risk): without a host or `confirm`, the work is kept and the way out does not
happen.

An `open` step reads `record` and `values` against this form; a field named
alone goes whole, a link with its name. Once the page is saved, `into` reads
the opened form's values, `id` being the record it saved; a link set to that
record is named by the host's `label` (its page's title field), else the
values' `display_name`, else their `name`, else the id.

### The app's actions

`onAction` gets each `call`: `{ id, action, params, recordId, values, recordIds }`.
`id` is the button's, or the moment's (`on.open`, `on.change.<field>`,
`on.beforeSave`, `on.afterSave`, `on.show.<id>`), or what `form.run` was
given (`run` when nothing); `recordIds` are the records chosen in a list, for
every call of that run. Fieldia waits for the answer, which may be an
`ActionResult`:

```ts
onAction: async ({ action, values }) => {
  if (action === 'price') return { values: { price: await priceOf(values.product_id) }, say: 'Priced' };
  if (action === 'reserve' && !(await inStock(values))) return { stop: 'Out of stock' };
  if (action === 'pick') return { open: { page: 'customer', as: 'panel', into: { customer_id: 'id' } } };
},
```

`values` are set as a `set` step sets them (a link may be given by its id);
`say` is said, as words or `{ message, tone }`; `open` runs as an `open` step;
`stop` stops the steps after it, and its words, if any, are said as a
warning. Nothing answered means go on: an `onAction` that returns nothing
works as it always did.

### The moments

- `open` runs once the form has its values: as soon as a new one is made, and
  after each `load()` of a record.
- `change` runs for a person's change only — `setValue(name, value)`, and a
  table's lines added, edited, moved or removed. `setValue(name, value, { by: 'app' })`,
  `setValues(values)`, steps, worked-out values, `setWhen` and the data
  source's onchange never run it, so steps never chase each other round.
- `beforeSave` runs before the save's own check, so it can fill in what is
  asked for. A stop keeps it unsaved: `save()` gives false; a check's
  problems show as the save's own would; any other stop leaves
  `status: 'error'` and `saveProblem: { kind: 'stopped', reason, message }`.
- `afterSave` runs once saved or sent.
- `show` runs as a wizard's step is entered — the first once `open` has run —
  and as the viewer calls `form.shown(tabId)` for a tab.

Each moment runs one at a time. Set off again while it runs, `open`, `change`
and `show` run once more after it, with the values as they are then, however
often they were set off meanwhile. `beforeSave` and `afterSave` do not run
again: a save made meanwhile — a step of their own, or the app saving inside a
call — goes ahead without them, so nothing waits on itself. A moment set off
by its own run, as a `show` whose `goTo` leads back, does not run.

### Events

```ts
const off = form.on('change', ({ field, value, values, by }) => {}); // by: 'person' | 'step' | 'app'
form.on('save', ({ recordId, values }) => {});
form.on('send', ({ values }) => {}); // a page of responses: the answers sent
form.on('action', ({ request, result }) => {}); // the app answered a call
form.on('run', ({ id, steps, result }) => {}); // a run ended
form.on('step', ({ step }) => {}); // a wizard's step entered
form.on('open', ({ recordId, values }) => {});
off();
```

`subscribe` still hears every change of the form's state; `settled()` now
waits for runs too, a question still unanswered among them.

To show a page, use [`@fieldia/viewer`](https://www.npmjs.com/package/@fieldia/viewer)
or a framework binding. MIT licensed.
