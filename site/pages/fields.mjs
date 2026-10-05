import { c, code } from '../layout.mjs';

const ROWS = [
  ['char', 'One line of text', 'email, phone, url, password, tags (free text), time (HH:MM)', 'size, pattern'],
  ['text', 'Several lines of text', '', 'size'],
  ['html', 'Formatted text with a toolbar, cleaned of scripts on every change', '', ''],
  ['integer', 'A whole number', 'rating (stars), scale (1 to 10 buttons), progressbar, label', 'min, max'],
  ['float', 'A decimal number', 'progressbar, label', 'min, max, digits'],
  ['monetary', 'An amount of money', 'progressbar, label', 'currencyField or currency, min, max, digits'],
  ['boolean', 'Yes or no', 'toggle', ''],
  ['date', 'A date', '', 'min, max, days'],
  ['datetime', 'A date and a time', '', 'min, max, days'],
  ['selection', 'One choice from a list, or several with multiple', 'radio, checkboxes, statusbar', 'options, multiple'],
  ['many2one', 'A link to one record of another model, found by typing', 'statusbar', 'relation, filter'],
  ['many2many', 'Links to several records', 'tags, checkboxes', 'relation, filter'],
  ['one2many', 'A table of lines that belong to this record', '', 'relation, fields; columns on the node'],
  ['reference', 'A link to a record of one of several models', '', 'models'],
  ['binary', 'A file, uploaded or dropped', '', 'accept, maxSize'],
  ['image', 'An image, with a preview', '', 'maxSize'],
  ['json', 'Structured data, checked as it is typed', 'code (with @fieldia/code)', ''],
  ['properties', 'Extra values, each edited with the field for its type', '', 'definitions'],
];

/** "currencyField or currency" → both names as code; "columns on the node" → the name as code. */
const optionText = (text) => text.replace(/\b(?!or\b|on\b|the\b|node\b)([a-zA-Z]+)\b/g, (name) => c(name));

export default {
  path: '/fields/',
  title: 'Fields',
  description: 'The eighteen Fieldia field types, how each can be shown, and how to add your own widget.',
  wide: true,
  body: `
<p class="lead">Every field has a ${c('type')}: what kind of value it holds. A field node can pick a ${c('widget')}, how that value is shown, and give it ${c('options')}. Leave the widget out and the type's own is used.</p>

<div class="table-scroll">
<table class="fields">
  <thead><tr><th>Type</th><th>Holds</th><th>Widgets</th><th>Options of its own</th></tr></thead>
  <tbody>
${ROWS.map(([type, holds, widgets, options]) => `    <tr><td>${c(type)}</td><td>${holds}</td><td>${widgets ? widgets.split(', ').map((w) => w.replace(/^\w+/, (name) => c(name))).join(', ') : '—'}</td><td>${options ? options.split(/, |; /).map(optionText).join(', ') : '—'}</td></tr>`).join('\n')}
  </tbody>
</table>
</div>
<p>Every type also takes ${c('label')}, ${c('help')}, ${c('required')}, ${c('readonly')} and ${c('default')}. To see them all at once, open <a href="/demos/plain/?page=fields&amp;skin=outlined">the every-field demo</a>.</p>
<p>A date's ${c('min')} and ${c('max')} are its earliest and latest day: a day, ${c('"2026-03-02"')}, or one counted from the day the form is opened, ${c('"today"')}, ${c('"today+30"')}, ${c('"today-7"')}; a date and time keeps them by the day it falls on. ${c('days')} are the days of the week it may fall on, ISO numbers from 1, Monday, to 7, Sunday: ${c('[1, 2, 3, 4, 5]')} refuses a weekend of Saturday and Sunday, ${c('[7, 1, 2, 3, 4]')} one of Friday and Saturday. A date's ${c('default')} may be ${c('"today"')}. A field with the widget ${c('email')}, ${c('url')}, ${c('phone')} or ${c('time')} is checked as one, and says what to type.</p>

<h2 id="options">Widget options</h2>
<p>A node's ${c('options')} tune its widget. An option whose name ends in ${c('Field')} names another field of the page, and the format checks that it exists.</p>
${code(
  'json',
  `
{
  "type": "field", "id": "f-spent", "field": "spent",
  "widget": "progressbar",
  "options": { "maxField": "budget" }
}`
)}
<div class="table-scroll">
<table>
  <thead><tr><th>Widget</th><th>Options</th></tr></thead>
  <tbody>
    <tr><td>${c('progressbar')}</td><td>${c('max')} (the field's own, else 100), ${c('maxField')}, ${c('color')} (${c('auto')}: red under 30 %, yellow under 70 %, green from there; or a fixed ${c('success')}, ${c('warning')}, ${c('danger')}, ${c('info')}), ${c('showPercent')}, ${c('editable')} (a box beside the bar)</td></tr>
    <tr><td>${c('label')}</td><td>${c('prefix')}, ${c('suffix')}, or ${c('prefixField')}, ${c('suffixField')} to take them from another field: “240.0 m”, “370,000.00 EGP”</td></tr>
    <tr><td>${c('tags')} on a ${c('char')}</td><td>${c('suggestions')} (a list of words), ${c('separator')} (${c('","')}), ${c('max')} (at most so many). Kept as ${c('"oak, glass"')}</td></tr>
    <tr><td>a ${c('char')} or ${c('text')} with a ${c('size')}</td><td>A count of characters under the box, ${c('"12 / 100"')}. A ${c('text')} takes ${c('rows')} (3) and grows as it is typed in unless ${c('autoGrow')} is ${c('false')}</td></tr>
    <tr><td>an ${c('integer')} or ${c('float')}</td><td>${c('prefix')}, ${c('suffix')}: a unit inside the box, before or after the number: ${c('"kg"')}, ${c('"°C"')}, ${c('"%"')}</td></tr>
    <tr><td>${c('rating')}</td><td>${c('icon')}: ${c('"heart"')}, ${c('"thumb"')} or ${c('"number"')} instead of stars; ${c('startLabel')}, ${c('endLabel')}: words at each end</td></tr>
    <tr><td>${c('scale')}</td><td>${c('startLabel')}, ${c('endLabel')}; ${c('nps')}: ${c('true')} colours a 0 to 10 scale as NPS, 0–6, 7–8 and 9–10 apart</td></tr>
    <tr><td>${c('slider')}</td><td>${c('step')} (1), ${c('startLabel')}, ${c('endLabel')}</td></tr>
    <tr><td>${c('time')} on a ${c('char')}</td><td>${c('min')}, ${c('max')} (${c('"09:00"')}), ${c('step')} in minutes</td></tr>
    <tr><td>${c('statusbar')}</td><td>${c('clickable')}, ${c('visibleStates')}. On a ${c('many2one')} its steps are the records the link may point to</td></tr>
    <tr><td>a ${c('monetary')} field</td><td>The currency's symbol inside the box, where the page's language writes it; ${c('symbol')}: ${c('"before"')} or ${c('"after"')} puts it there instead; ${c('pickCurrency')}: a currency box beside the amount</td></tr>
    <tr><td>a ${c('date')} or ${c('datetime')}</td><td>${c('weekNumbers')}: a calendar beside the date, with ISO week numbers; on a ${c('datetime')}, ${c('step')} in minutes</td></tr>
    <tr><td>an ${c('html')} field</td><td>${c('toolbar')}: ${c('false')} leaves the formatting toolbar off</td></tr>
    <tr><td>a ${c('many2one')} or ${c('many2many')}</td><td>${c('create')}: ${c('false')} never offers to make a record from what was typed</td></tr>
  </tbody>
</table>
</div>

<h2 id="numbers">Numbers in the reader's language</h2>
<p>Numbers are written grouped, with the field's ${c('digits')} (two for money and decimals by default), the way readers of the page's ${c('locale')} write them: ${c('1,850,000.00')} in English, ${c('1.850.000,00')} in German, ${c('1 850 000,00')} in French, in Latin digits in Arabic. What is typed is read the same way, Arabic-Indic digits included.</p>

<h2 id="relations">Links to other records</h2>
<p>${c('many2one')}, ${c('many2many')} and ${c('reference')} find records through your data source's ${c('search')}. A ${c('filter')} limits what can be picked, and ${c('valueFrom')} follows another field — here, the regions of the chosen country:</p>
${code(
  'json',
  `
"state_id": {
  "type": "many2one",
  "label": "Region",
  "relation": "country.region",
  "filter": [{ "field": "country_id", "op": "=", "valueFrom": "country_id" }]
}`
)}

<p>A filter's items all hold together; a group of ${c('any')} holds when one of its items does, and ${c('all')} groups nest inside it. Besides ${c('=')} ${c('!=')} ${c('<')} ${c('>')} ${c('<=')} ${c('>=')} ${c('in')} ${c('not in')}, a condition can find text with ${c('like')} (as typed), ${c('ilike')}, ${c('startswith')} or ${c('endswith')} (whatever the case), ask whether a field is ${c('set')} or ${c('notset')}, or take a value ${c('between')} two:</p>
${code(
  'json',
  `
"approver_id": {
  "type": "many2one",
  "label": "Signs off the design",
  "relation": "employee",
  "filter": [
    { "field": "active", "op": "set" },
    { "any": [
      { "field": "job", "op": "startswith", "value": "Head of" },
      { "field": "job", "op": "endswith", "value": "manager" }
    ] }
  ]
}`
)}

<p>When nothing found has the name that was typed, the list ends with <em>Create “…”</em>: it makes the record through the data source's ${c('create')} and links to it. It is offered only when the data source can create, and never on a node with ${c('"create": false')}.</p>

<h2 id="dialogs">Records in dialogs</h2>
<p>Give the viewer the pages that edit your related records, keyed by model, and a link field opens them in a dialog without leaving the page:</p>
${code(
  'ts',
  `
mountViewer(host, {
  page: projectPage,
  dataSource,
  relatedPages: { partner: customerPage },   // or (model) => page | null
});`
)}
<p>In React pass ${c('relatedPages={…}')}, in Vue ${c(':related-pages="…"')}, in Angular ${c('[relatedPages]="…"')}. A link to one of those models then offers:</p>
<ul>
  <li><strong>↗ beside the link</strong> opens the linked record in a large dialog. Save &amp; Close saves it through the data source, and the link follows a new name.</li>
  <li><strong>Create and edit…</strong> after a name is typed opens the related page with that name filled in. Save &amp; Close makes the record and links to it.</li>
</ul>
<p>Every link, with or without a related page, ends its list with <strong>Search more…</strong> when more records match than the list shows (eight). It opens every match in a dialog with its own search box; a click or Enter picks one.</p>
<p>A dialog takes the focus to its first field, keeps Tab inside, and gives the focus back where it came from when it closes. Escape closes a list open inside it first, then the dialog, keeping nothing. The page's own Save and Discard give way to the dialog's Discard and Save &amp; Close.</p>
<h3 id="your-dialogs">Your own dialogs</h3>
${code(
  'ts',
  `
import { openFormDialog, openSearchDialog } from '@fieldia/viewer';

const { saved, recordId, values } = await openFormDialog({
  page: taskPage, dataSource, recordId: null,
  title: 'New task',
  size: 'medium',          // 'small' | 'medium' | 'large' | 'full'
});

// "values" mode only checks the form and hands its values back: nothing is saved.
const line = await openFormDialog({ page: linePage, values, title: 'Line', mode: 'values' });

const picked = await openSearchDialog({ title: 'Customer', search: (query, limit) => mySearch(query, limit) });`
)}
<p>${c('openFormDialog')} takes every option ${c('mountViewer')} does. In ${c('"values"')} mode a ${c('recompute(values)')} option recalculates the values as they change, and the dialog shows what comes back.</p>

<h2 id="lines">Tables of lines</h2>
<p>A ${c('one2many')} declares the fields of each line; the node's ${c('columns')} says which show as columns. Lines are added, edited and removed in place, and saved as ${c('create')}, ${c('update')} and ${c('delete')} operations — see <a href="/data/#changes">what a save sends</a>.</p>
${code(
  'json',
  `
"child_ids": {
  "type": "one2many",
  "label": "Contacts",
  "relation": "partner",
  "fields": {
    "name":  { "type": "char", "label": "Name", "required": true },
    "email": { "type": "char", "label": "Email" }
  }
}`
)}

<h3 id="sections-notes">Sections and notes</h3>
<p>Lines can be headings and remarks between the items, the way a quotation is laid out. ${c('lineKinds')} names the line field that says what a line is and the field that holds its text. A section or note runs across the row, and it is never asked for what an item needs, such as a product.</p>
${code(
  'json',
  `
"line_ids": {
  "type": "one2many",
  "label": "Order lines",
  "relation": "sale.order.line",
  "lineKinds": { "field": "display_type", "text": "name", "section": "line_section", "note": "line_note" },
  "sequenceField": "sequence",
  "fields": { ... }
}`
)}
<p>${c('section')} and ${c('note')} are the values that mark each kind; they default to ${c('"section"')} and ${c('"note"')}. With a ${c('sequenceField')} (an integer line field) lines can be moved, and only the lines that moved are numbered again. Neither field shows as a column.</p>

<h3 id="table-node">On the node</h3>
<p>The node that shows the table can add up number columns in a row under the lines, and let people hide or show some columns:</p>
${code(
  'json',
  `
{
  "type": "field", "id": "f-lines", "field": "line_ids",
  "widget": "grid",
  "totals": ["qty", "subtotal"],
  "optionalColumns": { "discount": "show", "lead_days": "hide" }
}`
)}
<p>${c('"hide"')} starts a column hidden. Sections and notes stay out of the totals.</p>

<h2 id="grid">The grid</h2>
<p>For orders, invoices and timesheets, ${c('@fieldia/grid')} shows a table of lines as a spreadsheet on <a href="https://www.ag-grid.com/">AG Grid</a>, with Fieldia's own fields in the cells. It is a separate package, so simple forms never load it:</p>
${code(
  'sh',
  `
npm install @fieldia/grid ag-grid-community`
)}
${code(
  'ts',
  `
import { gridWidgets } from '@fieldia/grid';

mountViewer(host, { page, dataSource, widgets: gridWidgets });
// a one2many node with "widget": "grid" now shows the grid`
)}
<p>In React pass ${c('widgets={gridWidgets}')}, in Vue ${c(':widgets="gridWidgets"')}, in Angular ${c('[widgets]="gridWidgets"')}. A node without ${c('"widget": "grid"')} keeps the plain table.</p>
<ul>
  <li><strong>Keys.</strong> A click edits a cell. Enter keeps it and moves down; Tab moves across, skipping cells that cannot be edited; Shift+Tab goes back. Tab or Enter at the very end starts a new line. Escape puts the cell back, and takes away a line added a moment ago. Space ticks a yes/no cell. Alt+Up and Alt+Down move a line.</li>
  <li><strong>Every keystroke reaches the form</strong>, so totals and other computed values follow while a cell is still being typed.</li>
  <li><strong>Sections and notes</strong> run across the row. A note grows as it is typed; Enter starts a new line of it, Ctrl+Enter (Cmd+Enter) finishes it.</li>
  <li><strong>Moving lines.</strong> With a ${c('sequenceField')}, each line has a handle to drag it by.</li>
  <li><strong>Columns.</strong> People resize them and drag them into another order; the button at the end of the header hides and shows the optional ones. Their choices are kept for the next visit, in the browser unless you pass your own ${c('preferences')} store to the viewer.</li>
  <li><strong>A refused save</strong> marks the wrong cells, lists the problems under the table and opens the first one.</li>
  <li><strong>Long tables</strong> stop growing at 15 lines and scroll inside, drawing only the rows in view.</li>
  <li><strong>A whole line at once.</strong> ${c('"editMode": "row"')} on the node opens every cell of a line together, as an editable list does.</li>
  <li><strong>A line in a dialog.</strong> ↗ at the end of a line opens all of its fields, the hidden columns too, in a dialog. Its links search the page's data source, and the page's ${c('onchange')} runs as it is edited, so a subtotal follows its quantity there. Save &amp; Close writes the line back; Discard leaves it as it was.</li>
</ul>

<h2 id="code">JSON in a code editor</h2>
<p>${c('@fieldia/code')} shows a ${c('json')} field in CodeMirror, bundled with the package, so it works offline and loads only where it is used. Valid JSON reaches the form as it is typed; text that is not valid is said so, and the last good value stays.</p>
${code(
  'ts',
  `
import { codeWidgets } from '@fieldia/code';

mountViewer(host, { page, dataSource, widgets: { ...gridWidgets, ...codeWidgets } });
// a json node with "widget": "code" now shows the editor`
)}

<h2 id="custom">Your own widget</h2>
<p>A widget is a function that gets the field and returns an element, an ${c('update')} that receives the current value, and a ${c('focus')}. Register it under a type, or under ${c('type.widget')} to offer it as a choice:</p>
${code(
  'ts',
  `
import type { WidgetFactory } from '@fieldia/widgets';

const colour: WidgetFactory = ({ form, name, id, document }) => {
  const input = document.createElement('input');
  input.type = 'color';
  input.id = id;
  input.addEventListener('input', () => form.setValue(name, input.value));
  return {
    element: input,
    focus: () => input.focus(),
    update: ({ value, readonly }) => {
      input.value = String(value ?? '#000000');
      input.disabled = readonly;
    },
  };
};

mountViewer(host, { page, dataSource, widgets: { 'char.colour': colour } });
// a node with "widget": "colour" on a char field now uses it`
)}
<p>In React, Vue and Angular a custom field can be a component of that framework instead — pass it as ${c('fieldTypes')}.</p>
`,
};
