# @fieldia/designer

Build [Fieldia](https://fieldia.dev) pages without writing JSON: an editing model
with undo and published versions, a survey editor (questions as cards, pages
shown or questions asked only for some answers, a live preview), and a screen
editor (the page drawn as the viewer draws it and edited where it stands:
sections or a record sheet with a title and tabs; a toolbox of icons with the
backend model's fields first; a field's label, help and options typed in place
and the rest set from a bar on it; fields dragged within and between sections
and into tabs).

Not published to npm yet.

```ts
import { blankPage, createDesigner, createMemoryPageStore, mountScreenEditor, mountSurveyEditor } from '@fieldia/designer';

const store = createMemoryPageStore();   // or your own PageStore
const survey = createDesigner({ page: blankPage('survey', 'Event feedback'), store });
mountSurveyEditor(document.getElementById('survey')!, { designer: survey });

// The backend's fields, offered first; each keeps what it holds.
const model = { email: { type: 'char', label: 'Email' } } as const;
const screen = createDesigner({ page: blankPage('screen', 'Site visit'), store, model });
mountScreenEditor(document.getElementById('screen')!, { designer: screen });
```

The editors are components too: `@fieldia/designer/react`, `@fieldia/designer/vue`
and `@fieldia/designer/angular` each give a survey editor and a screen editor.

```tsx
import { ScreenEditor, SurveyEditor } from '@fieldia/designer/react';

<SurveyEditor designer={survey} />
<ScreenEditor designer={screen} />
```

In Vue they are `SurveyEditor` and `ScreenEditor` too; in Angular,
`<fieldia-survey-editor [designer]>` and `<fieldia-screen-editor [designer]>`.

## Laying a screen out

The screen editor opens in Simple mode, which keeps the panel to what most
forms need and the layout as it is. Advanced lays the page out by dragging,
as Grafloria's split board does: a line shows where a part will go, and a chip
says it in words before it is let go.

- Beside a part — its edge, or the gap to the next — the part joins that row. A group's rows divide in twelfths, each its
  own way: a group of one to four columns is divided in twelfths the first time
  a drop or a divider needs it, nothing moving as it is, and a part dropped
  into a row shares it out equally (halves, thirds, quarters; four to a row).
  Only that row changes.
- Under or above a part, or between two rows: a new row.
- In a group's padding at either side of its rows: a new column inside the
  group, beside all its rows — the rows go into a column of their own, the
  part beside it, the two in halves (a group of one row is simply joined).
- Within a few pixels of a group's border: beside or under the whole group.
- The divider between two parts of a row trades width a twelfth at a time,
  said as percentages ("58% · 42%"), by the pointer or the arrow keys.
- A group keeps each row full (the default): when a part leaves, the rest of
  its row widens to fill it. Set **Rows → Allow gaps** in its Layout tab and a
  part keeps its width instead; its far edge can then be pulled in.

The page stores `columns: 12` on such a group, each part's `colspan` in
twelfths, and `rows: 'gaps'` when set. A form draws the widths as stored: a
tablet keeps a row's proportions, a phone puts its parts one under another.

Between the canvas's Desktop · Tablet · Phone steps, drag its end edge (the
left one, right to left) to any width from a phone's 320px to the stage's
whole — or focus it and use ← / → (10px, Shift 100px), Home and End. A chip
says the width and the size the form takes it for by its own widths (a form
up to 520px wide is a phone's, up to 760px a tablet's), and each group shows
the columns it has there; a double-click goes back to the size's own width.
The width is kept in this browser.

## Trying a field's rules

Under a field's answer rules — on the panel's Rules tab, and in a survey
question's open card — **Try a value** draws the field by its own widget (the
one the form and the canvas use, the app's own among them) and says, as you
type or pick, what the form would say: *Passes*, each rule that stops sending
with its message, each warning marked *Still sends*. The form's own checks say
it, on a form made of the page, so it is what people will see; it says it
again at once when a rule is added, edited or removed. A field a rule reads —
across fields, or in its *Only when* — gets a box of its own; one that cannot
take a value there (worked out from other answers, an app's records, files)
is named, with Try it beside it. Where the page keeps translations, *Words in*
says the messages in one of its languages, right to left where it is written
so. Nothing typed there is kept in the page or makes an undo step, and it
lasts while the field stays picked. A field with no rules shows no sample:
Add a rule is the invitation.

## What an app adds

### Kinds of its own

An app adds kinds of field beside Fieldia's: each is the field a new one starts
as, the widget that draws it, and — if it likes — an icon, a toolbox group,
settings of its own and how a closed survey card reads. It shows in the toolbox
(under "Your kinds" unless it names a group), in "Shown as" wherever it fits,
with its settings on the picked field and on the panel's Content tab, and the
app's widget draws it on the canvas, on the cards and in Try it. A field made as
one is known again by its widget, so a kind whose id is one of Fieldia's, or
whose widget another kind uses, is refused when the designer is made.

```ts
import type { AppKind } from '@fieldia/designer';

const iban: AppKind = {
  id: 'iban',
  label: 'IBAN',
  icon: '<path d="M3 9.5L12 4l9 5.5M5 10v7M19 10v7M3 20h18"/>', // SVG on a 24-unit grid
  field: (label) => ({ type: 'char', label }),
  // widget: 'iban' — its id unless it says; fits(field) — where "Shown as" offers it
  settings: ({ document, set }) => {
    const country = document.createElement('select');
    country.setAttribute('aria-label', 'Country');
    country.append(new Option('Any country', ''), new Option('Germany', 'DE'), new Option('Egypt', 'EG'));
    country.addEventListener('change', () => set({ country: country.value || null })); // kept on node.options
    return { element: country, refresh: (_page, node) => (country.value = String(node.options?.['country'] ?? '')) };
  },
};

const designer = createDesigner({ page, kinds: [iban] });
// The app's widget, registered as the viewer takes them: under `type.widget`.
mountSurveyEditor(host, { designer, widgets: { 'char.iban': ibanWidget } });
mountViewer(form, { page: designer.getPage(), widgets: { 'char.iban': ibanWidget } });
```

### Templates

A blank survey or screen offers "Start from a template": a few of Fieldia's
(a survey: feedback, event registration, a job application; a screen: a
contact, an order request) and the app's own after them. Picking one puts it in
place as one edit, keeping the page's id and where its answers go; Undo brings
the blank page back. A template is a whole page, as the viewer takes it.

```ts
const designer = createDesigner({
  page: blankPage('screen', 'Supplier'),
  templates: [{ id: 'site-check', title: 'Site check', description: 'What an inspector notes on a visit.', page: siteCheckPage }],
});
// Or for one editor: mountScreenEditor(host, { designer, templates: [...] }).
designer.replacePage(siteCheckPage); // the same, from code: one edit, refused in words if it is not a page
```

### The app's own assistant

Fieldia ships no AI. An app that has an assistant hands it over: a box to
describe the form then sits in a blank page's empty state, and "Ask the
assistant…" is in Find anything once the page has parts. Its answer is checked
as any page is (`checkPage`, `validatePage`), put in place as one edit, and
what changed is said with Undo beside it; a wait can be cancelled, and an answer
after that is let go. Without an assistant, nothing about one shows.

```ts
const assistant: DesignerAssistant = {
  name: 'Acme assistant',               // shown beside its box
  note: 'Uses your workspace’s model.', // a line under it
  async describe({ prompt, page, signal }) {
    const reply = await fetch('/api/forms/describe', { method: 'POST', body: JSON.stringify({ prompt, page }), signal });
    if (!reply.ok) throw new Error('The form service is busy, try again in a minute'); // said in the editor
    return reply.json(); // a whole page: a new one, or `page` changed
  },
};
createDesigner({ page, assistant }); // or mountSurveyEditor(host, { designer, assistant })
```

### Looks of your own

The Look tab (the Look sheet, in the survey editor) starts with Fieldia's
presets. Once a look is your own, "Save this look…" names it in a box on the
page, and it shows under "Your looks", to put on any other page as a preset is:
its accent, font, spacing, corners and colours, as one undo step. Where labels
sit is the layout's, so a look never carries it. Each look is renamed or
removed from the menu on its tile; a removal leaves Undo at hand.

Without a store of the app's, looks are kept in this browser
(`createBrowserLookStore`), so they are offered again after a reload, and every
editor on the page shares them. An app keeps them for a whole workspace with a
`LookStore` of its own; renaming saves the same id under its new name. A store
that rejects is said in the editor, in its error's words.

```ts
import { createDesigner, type LookStore } from '@fieldia/designer';

const looks: LookStore = {
  async list() {
    const reply = await fetch('/api/workspace/looks');
    if (!reply.ok) throw new Error('The looks could not be fetched'); // said in the editor
    return reply.json(); // [{ id, name, look: { accent, font, density, corners, scheme } }]
  },
  async save(look) {
    const reply = await fetch(`/api/workspace/looks/${look.id}`, { method: 'PUT', body: JSON.stringify(look) });
    if (!reply.ok) throw new Error('The workspace is read-only for you');
  },
  async remove(id) {
    await fetch(`/api/workspace/looks/${id}`, { method: 'DELETE' });
  },
};
createDesigner({ page, looks }); // the same store for every designer, so they offer the same looks
```

`createMemoryLookStore()` keeps them for as long as the page is open, as for a test.

## The designer in Arabic

The designer speaks English unless it is given a language: `locale: 'ar'` (any
Arabic tag, `ar-EG` too) puts every word of its own in Arabic — the bar, the
toolbox, the panel and its settings, the checks and their fixes, the outline,
Try it, the JSON view, Translations, Rules, every menu, dialog, refusal and
line read aloud. Numbers stay in Latin digits, as Arabic business software
writes them. A language it has no words for is English.

```ts
const designer = createDesigner({ page: blankPage('survey', 'رأي الحضور', { locale: 'ar' }), store, locale: 'ar' });
mountSurveyEditor(host, { designer });
// Opened again from the store, the same way:
await createDesigner.open(id, store, { locale: 'ar' });
```

Given a language, the editor runs that language's way — Arabic right to left on
a page left to right, English left to right on a page right to left, so its
sentences end where they should. What draws the page — the canvas, the cards,
Try it and the form — keeps the direction of the page around the editor, as the
form will have it. Given no language, everything takes the page's direction, as
before.

The page's own words are never translated: labels, help, options, titles, and
what the app names (its kinds, lists and assistant) show as they were written.
`blankPage(kind, title, { locale: 'ar' })` names its first page or section in
Arabic and writes the page in Arabic (`language: 'ar'`), so the widgets drawn on
the canvas, Try it and the form speak Arabic and run right to left. Fieldia's
templates are offered in the designer's language, their answers stored under
the same values in every language.

`designer.words` is the table the editors say things from; `DESIGNER_WORDS`
holds English and Arabic, typed against the English one (`DesignerWords`), so a
word missing from a language fails to compile. The demos show it:
`/designer/?locale=ar&dir=rtl` and `/screen/?locale=ar&dir=rtl` (with
`&start=list`, `&start=sheet` or `&start=blank`); `?locale=en&dir=rtl` is the
English designer on a page right to left.

MIT licensed.
