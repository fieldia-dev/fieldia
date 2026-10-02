import { c, code } from '../layout.mjs';

const ROWS = [
  ['char', 'One line of text', 'email, phone, url, password', 'size, pattern'],
  ['text', 'Several lines of text', '', 'size'],
  ['html', 'Formatted text, cleaned of scripts on every change', '', ''],
  ['integer', 'A whole number', 'rating (stars), scale (1 to 10 buttons)', 'min, max'],
  ['float', 'A decimal number', '', 'min, max, digits'],
  ['monetary', 'An amount of money', '', 'currencyField or currency, min, max, digits'],
  ['boolean', 'Yes or no', 'toggle', ''],
  ['date', 'A date', '', ''],
  ['datetime', 'A date and a time', '', ''],
  ['selection', 'One choice from a list, or several with multiple', 'radio, checkboxes', 'options, multiple'],
  ['many2one', 'A link to one record of another model, found by typing', '', 'relation, filter'],
  ['many2many', 'Links to several records', 'tags, checkboxes', 'relation, filter'],
  ['one2many', 'A table of lines that belong to this record', '', 'relation, fields; columns on the node'],
  ['reference', 'A link to a record of one of several models', '', 'models'],
  ['binary', 'A file, uploaded or dropped', '', 'accept, maxSize'],
  ['image', 'An image, with a preview', '', 'maxSize'],
  ['json', 'Structured data, checked as it is typed', '', ''],
  ['properties', 'Extra values shown read-only', '', ''],
];

/** "currencyField or currency" → both names as code; "columns on the node" → the name as code. */
const optionText = (text) => text.replace(/\b(?!or\b|on\b|the\b|node\b)([a-zA-Z]+)\b/g, (name) => c(name));

export default {
  path: '/fields/',
  title: 'Fields',
  description: 'The eighteen Fieldia field types, how each can be shown, and how to add your own widget.',
  wide: true,
  body: `
<p class="lead">Every field has a ${c('type')}: what kind of value it holds. A field node can pick a ${c('widget')}: how that value is shown. Leave the widget out and the type's own is used.</p>

<div class="table-scroll">
<table class="fields">
  <thead><tr><th>Type</th><th>Holds</th><th>Widgets</th><th>Options of its own</th></tr></thead>
  <tbody>
${ROWS.map(([type, holds, widgets, options]) => `    <tr><td>${c(type)}</td><td>${holds}</td><td>${widgets ? widgets.split(', ').map((w) => w.replace(/^\w+/, (name) => c(name))).join(', ') : '—'}</td><td>${options ? options.split(/, |; /).map(optionText).join(', ') : '—'}</td></tr>`).join('\n')}
  </tbody>
</table>
</div>
<p>Every type also takes ${c('label')}, ${c('help')}, ${c('required')}, ${c('readonly')} and ${c('default')}.</p>

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
