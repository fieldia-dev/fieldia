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

`validatePage` and the format's schemas carry zod (about 105 KB gzipped with
them); `checkPage`, which every viewer draws a page with, carries none, and an
app that only shows forms never bundles zod. Where pages are made, they come on
their own too — `@fieldia/core/schema` (`validatePage`, `PageSchema`,
`FieldSchema`), one file with zod inside, which a bundler gives a chunk of its
own — for an app to fetch when it needs them, as the designer does as it opens:

```ts
const { validatePage } = await import('@fieldia/core/schema');
```

Importing `validatePage` from `@fieldia/core` as well carries the schemas twice:
once at once, once in that chunk.

A page says which format it is written in (`"fieldia": "0.13"`, `FORMAT_VERSION`; a page in 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.10 or 0.11 is read as it is).
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

The validation messages (`MESSAGES`) come in English, Arabic, German and French,
and in Turkish (`tr`), Persian (`fa`), Urdu (`ur`) and Spanish (`es`); English is
there at once, and every other language comes in a chunk of its own, fetched by
`await wordsReady(locale)` — which `mountViewer` does before it draws — so an app
never carries a language it does not show (0.35: Arabic, German and French came
at once before). Turkish, Persian, Urdu and Spanish are
**machine-assisted, not yet reviewed by a native speaker**: every message
English has, with its blanks, not yet read by a native speaker (corrections
welcome). Persian and Urdu are written right to left; `readNumber` reads their
digits (۰–۹) and marks (٫ ٬) as it reads Arabic-Indic ones; a day a message
names is written by Intl on the Gregorian calendar a value is kept in
(`dayTag`: Intl's own for Persian is the Solar Hijri — Fieldia shows the
Gregorian day, in Latin digits, in Persian too, for now). `listComma` gives the
Arabic comma in Arabic, Persian and Urdu.

`firstWeekday(language, page?)` is the week's first day, `0` Sunday to `6`
Saturday — the one every week Fieldia draws starts on: a list's "this week" and
its weeks, a calendar's and a timeline's, a date's and a range's month, booking
slots' month, a week's hours, a repeat's days, a chatter's history. CLDR's day
for a region, which is decided in this order:

1. the region of the language's own tag: the page's (`"language": "en-GB"`,
   where the page is shown in its own language) or the one given (`en-GB`);
2. else the reader's, where the browser asks for the same language with a
   region (`navigator.languages`, the first that does): an `en` page read in
   `en-EG` starts on Saturday, in `en-GB` on Monday, in `en-US` on Sunday;
3. else the region CLDR has the language most spoken in: the United States'
   for `en` (Sunday), Egypt's for `ar` and Iran's for `fa` (Saturday),
   Pakistan's for `ur` (Sunday), Germany's, France's, Turkey's and Spain's
   (Monday).

The day is the engine's own `Intl.Locale` week info, else CLDR's table (Firefox
has none). A third argument gives the reader's languages instead of the
browser's, for a server or a test. In the one-tag script it comes with the parts
that draw a week (`fieldia.list.js`, `fieldia.date.js`), not with `fieldia.js`:
`Fieldia.firstWeekday` answers once one has come — `await
Fieldia.datePart.load()` first where your own code calls it on a page that has
drawn no week.

Those four come in a chunk each of their own, so an app never carries the words
of a language it does not show: each package says how it fetches its words
(`wordsInChunks(tableInChunks(table, { tr: () => import('./tr') … }))`), and
`wordsReady(tag)` fetches every package's for a language, once — the viewer, a
map and a chatter wait for it before they draw. Asked for, a package's table for
the language is there at once, English's words, and filled in place as its chunk
comes; `wordsComing(tag)` says whether it has yet. Something that reads them
without waiting gets English, and the console says once what to await.

```ts
import { wordsReady, createForm, MESSAGES } from '@fieldia/core';
await wordsReady('tr');
const form = createForm({ page, messages: MESSAGES.tr });
```

Words that come after something was worked out or drawn in their place — a
chunk that came past its 30 s wait, say — are an input of it: `wordsVersion()`
grows each time a table is filled, and `onWordsCame(listener)` is told (it gives
back a function that stops it). A form says its problems and warnings again in
them as they come, and the viewer draws its parts again, however quick the way
a change is worked out.

## What a page and its values cannot make Fieldia do

A page may be written by an admin, an AI agent or an imported schema, and its
values by anyone; neither can make a form run script or take seconds:

- **Addresses.** Every address a link, a picture, a player, a frame or a page
  sent elsewhere is given goes through `safeUrl(value, allowed, base?)`: read
  with the browser's own URL parser (tabs, line breaks and control characters
  dropped, the scheme in any case), and kept only when its scheme is one the
  place allows — `LINK_URL` (http, https, mailto, tel, a path of this site),
  `PICTURE_URL` (and a blob the page made, a picture written as data),
  `MEDIA_URL`, `DOWNLOAD_URL`. An `openUrl` step that gives any other opens
  nothing and says so ("This address was not opened: …"); `checkPage` and
  `validatePage` refuse one the page writes (`'javascript:…'`).
- **Patterns.** A field's `pattern` and an answer rule's are refused —
  `checkPage` and `validatePage` name them, an answer is never tried on them —
  where they could backtrack for seconds: a part that repeats holding a repeat
  that can take what its next round starts with (`([a-z]+\s?)*`, `(a+)+`), one
  that may match nothing (`(a?)*`) or whose choices start alike (`(a|ab)*`), or
  two repeats without end side by side, only optional parts between them
  (`\d+\d+`, `\w+\s*\w+`). Every pattern whose repeats each start with what
  the one before cannot take is fine — `(-[A-Za-z0-9]{2,8})*`,
  `[^@\s]+@[^@\s]+\.[^@\s]+`. An answer longer than `PATTERN_MOST` (1,000)
  characters is not of its pattern. On your server, check answers with the same
  `checkValue`, or run a page's patterns under RE2 or with a time limit.
- **Sizes.** Text read as a date is at most `DATE_TEXT_MOST` (100) characters;
  a value the page works out (`compute`, `set`, `setWhen`) at most
  `COMPUTED_MOST` — 100,000 characters, 10,000 items — or none.
- **Names.** A field is never named `constructor`, `__proto__` or `prototype`,
  and an expression reads a value's own properties alone.

## A starting page from a schema

`pageFromSchema(input, options)` makes a page from what an app already has: a
**JSON Schema**, an **OpenAPI** document (a component's schema, or an
operation's request body and parameters — `schema: 'POST /enquiries'`, an
`operationId`, or a component's name; `schemaChoices(doc)` lists them), or a
**model's fields** — Fieldia's own, or a backend's field list such as
Flectra's `fields_get` (`string`, `selection` pairs, `relation`). Each property
becomes a field of its kind, with its label (`title`, else its name in words),
help (`description`), required, read-only, limits (`minimum`, `maximum`,
`maxLength`, `multipleOf` as decimals), pattern (found anywhere, as JSON Schema
reads it), choices (`enum`, a union of `const`s) and default; `format` picks the
box (`date`, `date-time`, `email`, `uri`, `time`, a phone, a password, a
colour, a file); a list of choices is several picked, a list of files several
files, a list of objects a table of lines; an object's properties are fields of
their own in a section of its name. `$ref`s inside the document are followed,
`allOf` merged, `null` set aside.

```ts
import { pageFromSchema, validatePage } from '@fieldia/core';

const { page, notes, unmapped } = pageFromSchema(openApi, { schema: 'POST /enquiries', kind: 'screen' });
validatePage(page).ok; // true: a page Fieldia reads, to edit in the designer
```

Nothing is dropped quietly: what is kept with a change is in `notes` (a name a
field cannot have, renamed; an object's properties flattened; a value of a kind
no field holds — a list of text, a union of kinds — kept as JSON; a limit no
setting holds, such as `minLength`, left to your server), and what is left out
in `unmapped` (a `$ref` outside the document, a property of no kind). Each has a
`code` and the property's path; `schemaNoteWords(note)` says it in English. A
survey (`kind: 'survey'`) is a step for the page and one for each object, sent
as responses; a screen keeps a record of `model` (its title's words joined by
dots unless given). A schema that gives no page throws `SchemaRefused`, its
`code` saying why. In the designer: **Start from a schema…** on a blank page.

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
starts are kept in drafts (`StoredDraft.timers`) with the answers, so a page
opened again goes on counting: a reload is never a way round a limit. A clock's
start is kept the moment it starts, and a draft whose clock started is laid at
once — never offered to be let go, even with `drafts.restore: "ask"`. Where the
app keeps no drafts (no `drafts`, no `saveDraft`), a timed page keeps them in
the tab's own store (`sessionStorage`): a reload goes on with the time left, or
— past its end — says the time is up and sends or locks as the page says. Sent,
or started again (`form.reset()`), the draft is let go: the next response is a
new one, with its own clock. The send tells `started` and `timeUp`. The clock is
the browser's, and another tab or device starts afresh: a server that must be
sure keeps its own (it has `started`), and takes one response per person
(`limits.onePerPerson`).

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
`uploadTo`'s work comes in the files part (0.31), asked for as its first file
goes — a page with a file field has it already; one with none never downloads it.

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

## Fields filled from the link

A page may fill fields from the link it is opened with — a campaign's, a
broker's, a unit's — with no code of the app's:

```json
{
  "prefill": { "fromUrl": ["utm_source", "utm_campaign", { "param": "agent", "field": "agent_code" }, "unit"] },
  "fields": { "utm_source": { "type": "char", "label": "Source" }, "agent_code": { "type": "char", "label": "Agent" }, "unit": { "type": "char", "label": "Unit" } }
}
```

`https://homes.example/enquiry?utm_source=whatsapp&agent=mona&unit=B-12` starts
the form with those values: each parameter named fills the field of its name, or
the `field` it names, as a new record or response starts — and again after
Submit another. A field the page fills so and places nowhere is a hidden field:
sent with the answers (a page of responses otherwise sends only what its
questions show), seen by no one. One placed on the page shows the value, for the
person to keep or change. Words are read as the field reads them — a number as a
number, `yes`/`no`/`1`/`0` for a yes or no, a choice by one of its options'
values, a day as 2026-10-20, a day and time with its offset — and one that does
not read so, or that the field's own checks would refuse (its most characters,
its pattern, its least and most), is left out: a hidden field no one can put
right never stops a send. The link never writes over an answer: a draft opened
over it, and what the person types, are theirs; a stored record opened is never
filled. The form reads `url` (the address, its `?…` part, or the parameters by
name), else the page's own address (`location.href`) — an app rendered on a
server, or embedded, gives the one it knows (the React, Vue and Angular
wrappers' `url`) — and `linkValues(page, url)` is the reading, exported. The page's checks refuse a
field it has not, a link's field, one worked out, a choice of the app's own
list, and a field filled twice.

## Proof of an email or a phone

A field drawn as an email or a phone may ask the person to prove it is theirs
before the answers go — `"options": { "verify": true }`, or `{ "by":
["whatsapp", "sms"] }` for the ways a code may be sent — where the data source
has `sendCode({ pageId, model, recordId, field, value, kind, by, language })`
(answering `{ id, expiresAt, retryAfter, length, message }`) and
`checkCode({ …, value, code, id })` (answering `{ ok, proof }`, or `{ ok:
false, triesLeft, expired }`). Fieldia sends nothing and holds no keys: the app
sends the code its own way. `form.joined('verify')?.mark(field, { value, proof
})` keeps a proof while the field holds that value (`state.verified`); a send is refused
while a shown field asking for a code holds a value not proved ("Mobile is not
confirmed: send a code and type it in"), and every send carries `verified` — by
field, the value and the proof. Anyone can call `mark()` in their own browser:
the server trusts a value only by a proof it signed itself (`checkSubmission`
checks each is there, for the value sent).
`form.joined('verify')?.asks(field)` says whether a field asks for one: never
where the source lacks either member.
The memory source sends and checks codes as a service would (its `codes`
option), each kept in `codes`.

## A payment the answers wait for

A page may take a payment before its answers go — a reservation fee, a deposit
— through the app's own provider: `"payment": { "label": "Reservation fee",
"amount": 10000, "currency": "EGP", "when": "visit == 'reserve'" }` (the amount
a number or a number or money field's name, the currency a code or a field's,
else a money field's own). Where the data source has `pay(request)` (answering
`{ status: 'paid' | 'failed' | 'cancelled', reference, message }`), a send
checks the answers, then waits for the payment — through the host's payment
step (the viewer's, else `ActionHost.pay`), else the source's `pay` itself — and
sends nothing unpaid; paid, the send carries `payment` (`{ amount, currency,
key, reference }`). `request.key` is the same for every try of one response's
payment: the provider's idempotency key. A send that failed after paying is
sent again without paying twice. `form.joined('pay')?.due()` says what is due
now, `state.paid` what was taken. A new payment in the designer asks 100 USD
until its amount and currency are set. Fieldia holds no keys and no provider's code. The
memory source answers paid unless its `pay` option says otherwise.

What the browser works out as due is the person's to change — in their own
devtools, or in the address where a link fills the amount (the page's checks
warn of that). The app's server works out what is due itself, from the page it
keeps and the answers it was sent — `(await checkSubmission(page, values)).due`
— and its checkout charges that, never an amount the browser hands it; once
the answers arrive, `checkSubmission(page, values, { payment })` refuses a
payment short or in another currency. Check its `reference` with your provider.

## Sends kept without signal

A page with `"outbox": true` keeps a send that finds no network — a site
visit's report in a compound, a delivery's proof — on the device and sends it
when the signal comes back. The form goes on as though it went: a response ends
"Kept on this device" (`state.outbox.kept`), and `state.outbox` says how many
wait (`{ waiting, sending, offline, kept, refused }`). The items are kept in the browser's
IndexedDB (`indexedOutbox()`: never lost on a reload, shared by a site's tabs),
or the store given as `outbox` (`memoryOutbox()` for tests). A photo the network
could not take stays in its field as its bytes and is stored through `upload`
just before its send goes. `form.joined('outbox')` sends what waits in order —
each item claimed by one sender (the claim renewed while its send goes, so a
long upload is never taken by a second tab), sent with the key of its first try
(`key`, and `queued: { key, at }`) so a server keeps it once — and keeps a refusal
to `retry` or `discard`. Kept sends go in the order they were kept; a save of a
record with kept saves sends them first and goes after them (still without
signal, it is kept behind them), each at the version the one before left. A new
record saved twice without signal is saved once, and the form takes its id when
it went. Where the browser keeps nothing past the page (no IndexedDB), sends wait
in memory and `state.outbox.lasting` is false: the viewer says to keep the page
open, never "Kept on this device". The memory source's `offline` option fails as
a network does.

Every save and send carries one idempotency key from its first try (`key`):
a Retry after an answer lost on the way, and an outbox's copy, carry the same,
until it went — a new record's until it has its id, a response's until the form
starts another. A server that kept a send with that key keeps no second: it
stores the values over that one's and answers as it did (the memory source
does). `form.save()` asked again while a save is on its way, nothing changed
since, is that save once it went (stopped or refused, it is asked anew); a
response's answers once sent are never sent again as
they were (`form.reset()` starts another); a new record whose source answers
with no id is not taken as saved.

## Parts that join a form

The four above are parts of their own, asked for as a page needs them
(`formJoins(page)`): the form knows only that its page asks for one, and each
joins it by one hook into its send (`FormJoin`) — `before` the send, once the
form's own checks ran (a field not proved added to what they found; a payment
not taken, nothing sent), `around` the send itself (what it carries added, or
kept on the device), and `reset` as another response or record starts. Their
state, their words and their checks come with them. `form.joined(name)` is a
part's side of the form once it came — null before, and on a page that asks for
none; a send made before it came waits for it.

A part that guards a send fails closed: a payment, a code check, a time limit's
clock, a link's hidden fields, a record's approvals — and the form's own options
by condition, texts in several languages and limits. Where one cannot come
(offline, a deploy that removed its file, a cached `fieldia.js` beside a part of
another version), the send waits for it, asks for it once more, and then sends
nothing: its save problem says which (`{ kind: 'other', message: "The payment
step could not load, so nothing was sent. Try again." }` — "Reload the page and
try again." where the part comes by `import()`, which a page keeps failed), the
viewer shows it with Retry, and what was typed stays. An outbox and a record made
live guard nothing: without them a send goes as it would have.

## Nothing waits for ever

Each request a person waits on — a record's load, a list's rows, a save, a
send, an onchange, a search, a list's options — answers within the form's (or
the viewer's) `timeout` (milliseconds, 30 000 unless said; 0 for none) or ends
as the network's problem ("The server did not answer in time"), said where it
was asked, with Retry; its `signal` (an AbortSignal, on the
request) aborts then, and a late answer is dropped. A Retry carries the first
try's key, so a server keeps it once. A Discard waits for a save on its way at
most 5 s, then ends it — the person's choice never waits behind a stuck save. A part or a
language's chunk that does not come within 30 s settles as failed: the page is
drawn without it (one that guards a send then refuses it), the language in
English until its words come.

## A change costs what reads it

A form works out only what reads what changed (0.35): a condition is read again
once a value it reads changed, a value worked out again once one it is worked
out from did, a field checked again once its answer or what its rules read did —
and the viewer brings a part up to date only once what it shows changed. A key
typed on a page of 500 fields reads no condition again where nothing reads that
field, and brings a handful of parts up to date, not 560. `form.node(id)` gives
the same object while nothing of a part's state changed, and `form.nodeReads(id)`
the fields that state is worked out from (null where it cannot say: a condition
calling `today()` or the app's own function).

`workCounts` counts that work since the page opened — `conditions`, `computes`,
`checks`, `updaters` — the same on any machine, for tests that bound it.
`recomputeInFull(true)` makes the forms and viewers made after it work every
change out in full, as before 0.35: the oracle Fieldia's own tests compare the
quick way with on pages made at random. An app never needs it; its tests may.

```js
import { recomputeInFull, workCounts } from '@fieldia/core';
const before = workCounts.updaters;
input.dispatchEvent(new Event('input', { bubbles: true }));
expect(workCounts.updaters - before).toBeLessThan(20);
```

## What Fieldia keeps in the browser

Everything Fieldia keeps on a device is a person's, kept by whose it is — the
signed-in person's (`user.id`: `u:<id>`), else the tab's it was typed in (an id
the tab keeps in `sessionStorage` as `fieldia:tab`: a reload keeps it, another
tab or person never sees it) — so the next person on a shared device is never
offered the last one's typing, nor sends it under their own session:

| What | Where | Holds |
|---|---|---|
| Drafts | the app's `drafts.store` (localStorage fits), key `fieldia:draft:<owner>:<page>:<record \| new>`; a timed page's without one, `sessionStorage`; on the app's server (`saveDraft`), the store keeps only `{ savedAt, key }` | a record's: the fields changed, the version they were typed against and each one's value then; a response's: its answers — never a secret field's (a password box, a field with `"secret": true`); the step, steps skipped, text that does not read yet, a draw, a time limit's starts |
| The tab's id | `sessionStorage` `fieldia:tab` | an id, while the tab is open |
| Sends kept without signal | IndexedDB `fieldia-outbox`, store `items` (memory where the browser has none: said so, never "kept on this device") | each send as it would have gone — its answers, photos' bytes (base64), its key — with its owner; sent by its owner's forms alone |
| Preferences | the viewer's `preferences`, by default localStorage `fieldia:<key>` — a signed-in person's `fieldia:u:<id>:<key>` | a list's columns (`<page>.<list>.columns`), a grid's, a filter bar's filters shown (`filters:<page>:<list>`), favourites (`favourites:<page>`), saved record templates (`templates:<page>`: values), records picked last (`recent:<model>`: their names), duplicates told apart (`duplicates.<model>`), a files field's view |
| The designer | localStorage `fieldia.designer.mode`, `fieldia.designer.size` and its width, `fieldia.designer.looks` | how its canvas is shown, looks saved |

At sign-out, let a person's go: `drafts.clear({ user })` and `await
outbox.clear({ user })` (from `@fieldia/core`; with no `user`, every one —
drafts in the given `store`, else the browser's local and tab stores, which list
their keys; sends in the given `store`, else IndexedDB). Sends let go never go.
Preferences under `fieldia:u:<id>:` are yours to remove. A draft of 0.33 or
before, kept by page alone, is never offered again; `drafts.clear()` removes it.

## The server is the final gate

Everything a page checks — required, patterns, sizes, options, a code proved, a
payment taken, a time limit, one response each — runs in the person's browser,
and a request made by hand passes none of it. `checkSubmission(page, values,
context)` runs the page's checks again where the answers arrive (Node, or any
server that runs JavaScript), from the page as the server keeps it:

```ts
import { checkSubmission } from '@fieldia/core';

const { ok, errors, problems, values, due } = await checkSubmission(page, request.values, {
  verified: request.verified, // each proof present for the value sent — then check the proof is yours
  payment: request.payment, // paid in full, in its currency, for what the page asks for these answers
  order: request.order, // a question not drawn for this respondent is not required
  user: { id: session.userId, roles: session.roles }, // as the server knows them, never the browser
});
if (!ok) throw saveRefused({ kind: 'fields', message: problems[0] ?? 'Check the answers', fields: errors });
await store(values); // values worked out here: what it computes, computed again
```

It answers `{ ok, errors, problems, values, due }`: each field's problem in the
page's words, what else is wrong (answers over `maxBytes` — 1 MB unless said —
a field the page has not, a payment missing or short), the answers as the
page's rules leave them, and what is due. A page its own checks refuse —
`checkPage`'s, as the browser runs them: a pattern that could take seconds on
an answer, a field named `constructor` — takes no answers here either, and its
patterns are checked by the browser's own function (an answer over 1,000
characters fails its pattern, never tried). The parts its checks need are loaded
first; one that cannot be is a problem, never a check skipped. What it cannot
know is the server's: a proof's signature, a payment's reference with the
provider, when the page was served (for a time limit), and how many responses
each person sent.

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

## Undo and Redo while filling

A form keeps the person's changes to the record shown, for `form.undo()` and
`form.redo()` (the viewer's Ctrl+Z and Ctrl+Shift+Z): each field written
(`setValue`), each cell typed in (`updateLine`), each line added, taken away or
moved — typing on in one box is one change until the box is left
(`boxLeft`). Each returns what it took (`{ field, line? }`), or null when
nothing is left; `form.history()` names the next of each without taking it.
A save starts them afresh, as a change saved is none to take back — but on a
page with `autosave`, whose changes are taken back across its saves, and where
a change made while it saved goes on past it. The changes are noted from the first; walking them is the undo part's
(`pressUndoPart`), asked for with the first change — in by the time a person
presses Ctrl+Z, and in at once where an app loads it first (`await
pressUndoPart.load()`): until it has come, `undo` and `redo` take nothing.

```ts
form.setValue('price', 1200);
form.boxLeft('price');
form.undo();        // { field: 'price' }: back to what it held, as the person's own change back
form.redo();        // { field: 'price' }: 1200 again
```

A box's own undo and redo — the browser's, through the typing in the box the
person is in — are told to the form around the change they write
(`form.boxHistory('undo' | 'redo')`, then `null`; the viewer does so for its
boxes): what the box's own undo took back is then a change `redo` makes again,
the box left or not, its undos since its last typing one change as that typing
is one, and `undo` passes over it.

What it writes is the person's own change back: the page's `change` steps and
the source's onchange run as for any, and what is worked out from it follows. A
step's, a rule's or the app's writes are never a change to take back, and a
change whose field one of them wrote since — or that is locked now — is passed
over, never written over theirs. Another record shown, a reload, or `reset()`
starts with nothing to take back; a form not being edited takes nothing back.

## Changes pushed as they happen, and who else is here

Two optional data source members make an open record live. `subscribe(record,
push) → stop` is asked as a record is shown and stopped as another is; push
`{ type: 'record', version?, values?, by?, at? }` as someone else saves it, or
`{ type: 'deleted', by? }`. Where the person changed nothing, their values are
laid on the record as stored (`arrived` is told, `conflict: false`); after a
change of theirs it waits as the conflict a save would meet (`state.conflict`,
with Reload and Keep mine), their typing untouched. A change without `values`
is read with `load`; one carrying this form's own version is let go.
`presence(request, push) → stop` is asked with the form's `user` and whether
they have changes not saved (`editing`), asked again as that turns; what it
pushes — the others with the record open — is `state.present`. Both are the
same call as @fieldia/chatter's `subscribe`, with types that never meet: one
function may serve both. It comes in a part of its own (`recordLivePart`),
asked for as a form is made where the source has either member, and never
where it has neither. The memory source does both with `live: true`
(`changeElsewhere`, `arrive`, `leave`), and has none of them without.

## Record templates

A record page's `templates` (`true`, or `{ fields }`) keeps a record's values
by a name, to start new records from. The data source's `templates`,
`saveTemplate` and `deleteTemplate` keep them on your server
(`RecordTemplate`: `{ id, name, values, by? }`); the viewer keeps them in its
`preferences` without them. The memory source has them where its `templates`
option is given (`{}` for none yet), kept by page id.

## A record as it loads

`form.load()` is the one way a record's values come in. Its source's `load`
answers one record's values (or `loadedRecord(values, { version, can })`):
anything else — nothing, a list (Odoo's `read()` answers one: give its first),
a REST envelope round the record (`{ data: { … } }`) — is refused as a failed
load, never read as a record whose every field is empty. Each value is read as
its field holds one (`valuesFromSource`): a number sent as text ("1200.50", as
Django REST and Postgres send decimals) as a number, Odoo's `false` as empty, a
link as `{ id, label }` from Odoo's `[7, "Nile Traders"]` or a REST `{ id, name
}`, a table's records as its lines. One that cannot be read is named in
`state.unreadable` (by field, with why), shown empty, said under its field
("Tags is stored in a way this page cannot show: it is kept as it is"), and left
out of the `values` a save sends — the source keeps what it holds — unless the
person writes the field.

A load that fails is said in words in `state.loadProblem` ("This record could
not be loaded: Gateway Timeout"), with a Retry of its own (`form.load()` again;
the viewer draws it over the page), never as a save's problem. Until a record's
first load ends well, `state.loaded` is false: the viewer draws its fields
inert, and a save is refused ("This record has not loaded yet, so nothing was
saved") — a whole-record save would empty it. What is typed while it loads is
the person's: laid over the record as it lands, as changes to save. A record an
app hands the form with its `values` and never asks to load is the app's to
vouch for, and saves as ever.

A value the source holds that its field's own checks would not take — 1.005 in
a field of 2 places, an option since retired, an email of another shape — is
said under the field as a warning while the person leaves it, never refusing a
save that does not touch it; changed, it is checked as any change is. Required
still asks, and a table's cells, a matrix's rows and a text's languages are
checked as ever. `form.save()` never throws: a save that breaks on its way is
a save problem in words ("Something went wrong, so nothing was saved: …").

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
while one is on its way — something changed since — waits for it and carries the
version it got back; nothing changed, it is the first.
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

### Undo after a one-tap press

A button or a gear menu item with `"undo": true` offers Undo in place of
asking first: once its press has run whole, the words it said — its last `say`,
or the app's — are given to the host's `say` with a third argument, `{ undo }`
(else "Done: {label}", the built-in Archive's "Archived."); the words before
them are said plainly. `undo()` takes the press back and resolves to a
`RunResult`: the app's own undos (an answer's `undo`, latest first, each
answered as a call is), the record archived brought back (or the reverse), and
the values its steps and answers wrote put back — each only while it holds what
they left — saved again where the press saved. It is offered only where all of
it can be taken back: a copy, a delete, a post, a page opened, an address, a
form put back or closed, or a call answered without `undo` say plainly. Steps in
place of `true` are what Undo runs instead. A call's answer with `undo` offers it
by itself, for what the app did:

```ts
onAction: async ({ action, recordId }) => {
  if (action === 'mark_done') {
    await api.done(recordId);
    return { say: { message: 'Follow-up marked done', tone: 'success' }, undo: () => api.reopen(recordId).then(() => ({ reload: true })) };
  }
},
```

Undo's run is told as `run` with the press's id and `.undo` after it
(`b-done.undo`); a built-in Archive or Delete with `undo` asks nothing first
unless it says `confirm`. Saying it with Undo and taking it back come in a part
of their own (`pressUndoPart`, `fieldia.undo.js`): asked for with a page whose
buttons offer Undo, else as an answer first brings one.

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
