# Writing Fieldia pages: a guide for AI agents

A Fieldia page is one JSON document that describes a form, a survey or a record screen. An app stores it, and
Fieldia draws it in the browser — in React, Vue, Angular or plain JavaScript. This guide is for an AI agent (or a
person) who writes pages: what a page holds, how to check one before it is stored, the mistakes the checks catch, and
a worked example.

## What a page is

A page is data, never code: no functions, no components, no scripts. It has five parts.

```json
{
  "fieldia": "0.13",
  "id": "contact",
  "data": { "kind": "responses" },
  "fields": {
    "name": { "type": "char", "label": "Your name", "required": true }
  },
  "layout": {
    "type": "sections",
    "id": "root",
    "children": [{ "type": "field", "id": "f-name", "field": "name" }]
  }
}
```

- `fieldia` is the format the page is written in, as a string. A page made now says the lowest format its settings
  need: `stampPage(page)` writes it.
- `id` is the page's own name.
- `data` says where the values go: `{ "kind": "responses" }` sends one new response each time, as a survey does;
  `{ "kind": "record", "model": "res.partner" }` loads and saves records of a model through the app's data source.
- `fields` holds each value by its name: its `type` (`char`, `text`, `integer`, `float`, `monetary`, `boolean`,
  `date`, `datetime`, `selection`, `many2one`, `one2many`, …), its `label`, and its rules (`required`, `min`, `max`,
  `pattern`, `default`, `compute`).
- `layout` places them: `sheet`, `sections`, `tabs` or `wizard`, with `children` — each part with an `id` unique in
  the page — or a `list` of records with its `columns`.

Conditions — when a part shows, locks or is required — are expressions over the values, written as Odoo writes them:
`"invisible": "topic != 'sales'"`, with `==`, `!=`, `and`, `or`, `not`, and words in single quotes.

Every setting is described in the JSON Schema: `@fieldia/core/page.schema.json` (draft 2020-12). An editor or a
model can read each setting's words there.

## How to check a page

Check every page before it is stored. `validatePage` decides; a viewer gives its verdict in two steps:

| Where | What to call | What it does |
| --- | --- | --- |
| Where pages are made | `validatePage(page)` from `@fieldia/core/schema` | The whole check: every key and value, every name a part or a condition uses, every expression. Its answer lists each problem by its path, and warnings beside it. |
| In CI | `npx fieldia-check pages/` from `@fieldia/testing` | `validatePage` over every `.json` file, one line per problem; `--strict` fails on warnings too. |
| In the browser, before the draw | `checkPage(page)`, as every viewer runs it | What 0.35's viewer refused: the outline, every name a part or a condition uses, every expression. A page it refuses is never drawn: the form's place says "This form cannot be shown", with what is wrong under it; the app's `onError` hears it with `stage: "draw"`. |
| In the browser, as soon as the page is drawn | `await checkPageWhole(page)`, as every viewer runs it | The same verdict as `validatePage`, without the validation library, a part of its own. From 0.37 a page it refuses is taken down (0.36 left it drawn and said it): it may show for a moment, then the same words replace it, `onError` hears `stage: "check"`, and nothing is written through it. |
| Before storing | `stampPage(page)` | The page stamped with the lowest format its settings need, so a viewer of an older Fieldia reads it. |

```ts
import { stampPage, validatePage } from '@fieldia/core/schema';

const checked = validatePage(page);
if (!checked.ok) for (const issue of checked.issues) console.log(`${issue.path}: ${issue.message}`);
else await store.put(page.id, stampPage(checked.page));
```

The JSON Schema checks the shape alone. `validatePage` also checks references (a field a part names, a condition's
fields, an id used twice) and expressions. Use the schema for completion and quick feedback, and `validatePage` to
decide.

The browser's checks help the person filling the form. They are not a security boundary: the app's server checks
what it is sent again, with `checkSubmission(page, values)` (see [What Fieldia promises](promises.md)).

## The mistakes the checks catch

Each row is a mistake agents make, with the words `validatePage` says, what a viewer does with it, and how to fix it.
`checkPageWhole` refuses every one, as `validatePage` does, and from 0.37 so does every viewer: some before it draws
the page, as 0.35's viewer did; the rest as its whole check runs, once the page is drawn, taking it down (0.36 drew
those, and said them in the console and to `onError`).

| Mistake | What the check says | A 0.37 viewer | Write instead |
| --- | --- | --- | --- |
| A field typed `email` | `fields.email.type: "type" is not one of the kinds allowed here` | refuses it, as 0.35 did | `"type": "char"`, with `"pattern"` or a node's `"widget": "email"` |
| `"required": "yes"` | `fields.name.required: Invalid input: expected boolean, received string` | takes it down (0.36 drew it) | `"required": true` |
| Options as plain words | `fields.topic.options[0]: Invalid input: expected object, received string` | takes it down (0.36 drew it) | `[{ "value": "sales", "label": "Sales" }]` |
| A step `setValue` | `on.change.topic[0].do: "do" is not one of the kinds allowed here` | takes it down (0.36 drew it) | `{ "do": "set", "field": "seats", "value": "1" }` |
| A key the format does not have | `fields.name: Unrecognized key: "read-only"` | takes it down (0.36 drew it) | `"readonly": true` |
| A part with no `id` | `layout.children[0].id: Invalid input: expected string, received undefined` | takes it down (0.36 drew it) | an `id` on every part, unique in the page |
| One `id` twice | `layout.children[1]: duplicate id "f-name", also used at layout.children[0]` | refuses it, as 0.35 did | another id |
| A part naming a field the page lacks | `layout.children[4].field: no field "phone"` | refuses it, as 0.35 did | the field in `fields` first |
| A condition reading a field the page lacks | `layout.children[3].invisible: "kind != 'sales'" reads "kind", which is not a field of this page` | refuses it, as 0.35 did | a field of the page |
| `===` or `&&` in a condition | `cannot read "topic === 'sales'": Unexpected "=" at character 9` | refuses it, as 0.35 did | `==`, `and`, `or` |
| Words in a value not quoted | `on.change.topic[0].value: cannot read "hello world": Unexpected token at position 1` | refuses it, as 0.35 did | `"value": "'hello world'"` |
| A function that is not one | `fields.seats.compute: cannot read "lenght(name)": no function "lenght": the functions are round, abs, min, max, len, …` | refuses it, as 0.35 did | one of the functions listed |
| Its least more than its most | `fields.seats.min: the least (10) is more than the most (5): no value could be given` | takes it down (0.36 drew it) | `min` no more than `max` |
| A first value of another kind | `fields.seats.default: "five" is not a whole number: an integer field's first value is one, written as a number` | takes it down (0.36 drew it) | `"default": 5` |
| A first value that is not a choice | `fields.topic.default: "billing" is not one of the field's options: its first value is one of "sales", "support"` | takes it down (0.36 drew it) | one of the option values |
| An option's value twice | `fields.topic.options[2].value: "sales" is the value of an option before it: each option's value once` | takes it down (0.36 drew it) | each value once |
| A list's column twice | `layout.columns[1]: "name" is a column before it: each column once` | takes it down (0.36 drew it) | each column once |
| A widget's option the format refuses | `layout.children[1].options.countries: countries is "list" (Fieldia’s own, found by typing) or "native" (the browser’s own list)` | takes it down (0.36 drew it) | one of the values listed |
| No `fieldia` | `fieldia: "fieldia" says which format the page is written in: "0.14" for this Fieldia` | refuses it, as 0.35 did | `"fieldia": "0.14"`, or `stampPage(page)` |
| A format newer than the reader | `fieldia: this page is in format 0.99, newer than this Fieldia reads (0.14): update Fieldia to show it` | refuses it, as 0.35 did | a format Fieldia has had |

One more is refused, from 0.37 (0.36 warned of it): a setting that came in a later format than the page says —
`"fieldia": "0.10"` with a field's `secret`, which came in 0.13. An older Fieldia would read the page without it. Write
`stampPage(page)`.

One is a warning: `validatePage` says it, and the page is still drawn. A field marked required that no part of the page
shows: the form asks only for what it shows, so nothing ever asks for it. Place it, or leave `required` out.

## What a copy keeps, and filters in groups

Two settings a person who knows Odoo looks for. Both came in format 0.14 (Fieldia 0.37): a page that uses one says
`"fieldia": "0.14"` — `stampPage` writes it — and an older viewer refuses it with
`this page is in format 0.14, newer than this Fieldia reads (0.13): update Fieldia to show it`. A page that uses one
but still says `"fieldia": "0.13"` is refused as stamped older than a setting it uses, by `validatePage` and by every
viewer as its whole check runs.

- **A field a copy does not keep**, as Odoo's `copy=False`: `"copy": false` on a record's status or its number. The
  record's Duplicate makes a copy whose field starts as a new record's does — its `default` (or `defaultFrom`), else
  empty — so a posted bill's copy is a draft: `"state": { "type": "selection", …, "default": "draft", "copy": false }`.
  On a table's line field, a line's own copy starts it so too. The app's data source makes the copy and applies it
  (its `copy`, given the page's fields): the memory source does, and Odoo's server has its own `copy=False`. A field
  is copied unless it says false, a status bar's field too.
- **Filters in groups**, as Odoo's filters between `<separator/>`s: a list's named filter says `"group": "when"`.
  Filters of one group that are on find what any of them finds ("Late or Today"); groups find what each finds
  ("Overdue", and "This year"). Filters that name no group are one group, so a list whose filters name none finds what
  any filter on finds, as before. A group is one word: `"group": "due date"` is refused with
  `layout.filters[0].group: a filter’s group is named by one word, such as "when"`.

## A worked example

An agent is asked for a contact form: a name and an email, both required, a topic, and the number of seats asked
only when the topic is sales. Its first page has three mistakes:

```json
{
  "fieldia": "0.13",
  "id": "contact",
  "title": "Contact us",
  "data": { "kind": "responses" },
  "fields": {
    "name": { "type": "char", "label": "Your name", "required": "yes" },
    "email": { "type": "email", "label": "Email", "required": true },
    "topic": { "type": "selection", "label": "Topic", "options": ["sales", "support"] },
    "seats": { "type": "integer", "label": "Seats", "min": 1, "max": 50 }
  },
  "layout": {
    "type": "sections",
    "id": "root",
    "children": [
      { "type": "field", "id": "f-name", "field": "name" },
      { "type": "field", "id": "f-email", "field": "email" },
      { "type": "field", "id": "f-topic", "field": "topic" },
      { "type": "field", "id": "f-seats", "field": "seats", "invisible": "topic != 'sales'" }
    ]
  }
}
```

`validatePage` answers:

```text
fields.name.required: Invalid input: expected boolean, received string
fields.email.type: "type" is not one of the kinds allowed here
fields.topic.options[0]: Invalid input: expected object, received string
fields.topic.options[1]: Invalid input: expected object, received string
```

The agent fixes each one where its path points. It writes `true`. It makes the email a `char` with a pattern, and
asks the browser to fill it in as an email. It writes each option as a value and a label:

```json
{
  "fieldia": "0.13",
  "id": "contact",
  "title": "Contact us",
  "data": { "kind": "responses" },
  "fields": {
    "name": { "type": "char", "label": "Your name", "required": true },
    "email": { "type": "char", "label": "Email", "required": true, "pattern": "^[^@\\s]+@[^@\\s]+$" },
    "topic": {
      "type": "selection",
      "label": "Topic",
      "options": [
        { "value": "sales", "label": "Sales" },
        { "value": "support", "label": "Support" }
      ]
    },
    "seats": { "type": "integer", "label": "Seats", "min": 1, "max": 50 }
  },
  "layout": {
    "type": "sections",
    "id": "root",
    "children": [
      { "type": "field", "id": "f-name", "field": "name" },
      { "type": "field", "id": "f-email", "field": "email", "autocomplete": "email" },
      { "type": "field", "id": "f-topic", "field": "topic" },
      { "type": "field", "id": "f-seats", "field": "seats", "invisible": "topic != 'sales'" }
    ]
  }
}
```

`validatePage` now says `ok: true`. `stampPage` stamps the page `"0.3"`, the format the box's `autocomplete` came
in, so every Fieldia from 0.24 reads it. The app stores it, and a viewer draws it:

```ts
import { mountViewer } from '@fieldia/viewer';

mountViewer(document.getElementById('form')!, { page, dataSource, onError: (error) => report(error) });
```

Had the agent stored the first page, the viewer would have refused it before drawing it: its email field is of no
kind Fieldia knows. The form's place would say "This form cannot be shown: its page has mistakes", with
`fields.email: a field needs a type Fieldia knows and a label` under "What is wrong", and the app's `onError` would hear
it. In React, Vue and Angular the app around it stays. Had the agent fixed that alone, the viewer would draw it, then
take it down as its whole check ran, for its other three mistakes (`onError` hears `stage: "check"`), nothing sent
through it meanwhile; 0.36 left such a page drawn and said them.

## Where to read more

- The page format, every setting with an example: [fieldia.dev/pages](https://fieldia.dev/pages/).
- Each setting's words, as a JSON Schema: `@fieldia/core/page.schema.json`.
- What Fieldia guarantees, and what the app's server must still check: [What Fieldia promises](promises.md).
