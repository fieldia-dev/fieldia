import { c, code } from '../layout.mjs';

export default {
  path: '/pages/',
  title: 'The page format',
  description: 'What a Fieldia page holds: its data, its fields, its layout, and the conditions that show, lock or require a field.',
  body: `
<p class="lead">A page is one JSON document with four parts: what it is about (${c('data')}), what it holds (${c('fields')}), how it is laid out (${c('layout')}), and its name and title. Nothing in it is code, so a page can be stored, sent, generated or edited by a designer.</p>

${code(
  'json',
  `
{
  "fieldia": "0.1",
  "id": "customer",
  "title": "Customer",
  "description": "Optional text under the title",
  "data": { "kind": "record", "model": "partner" },
  "fields": { "...": "..." },
  "layout": { "type": "sheet", "id": "sheet", "children": [] }
}`
)}

<h2 id="data">data: a record or responses</h2>
<ul>
  <li>${c('{ "kind": "record", "model": "partner" }')} — the page edits one record of a model: it loads it, tracks what changed, and saves the changes.</li>
  <li>${c('{ "kind": "responses" }')} — the page collects answers, like a survey or a sign-up: each submit stores one response, and the form starts again.</li>
</ul>
<p>The model is only a name your <a href="/data/">data source</a> understands; Fieldia passes it through.</p>

<h2 id="fields">fields: what the page holds</h2>
<p>Each field is declared once, by name. The layout then points at it, so the same field can be described in one place and placed anywhere.</p>
${code(
  'json',
  `
"fields": {
  "email": {
    "type": "char",
    "label": "Email",
    "help": "We send the joining details here.",
    "required": true,
    "pattern": "^[^@\\\\s]+@[^@\\\\s]+\\\\.[^@\\\\s]+$"
  },
  "country_id": { "type": "many2one", "label": "Country", "relation": "country" }
}`
)}
<p>Every field has a ${c('type')} and a ${c('label')}, and may have ${c('help')}, ${c('required')}, ${c('readonly')} and a ${c('default')}. Each type adds its own options — ${c('options')} for a selection, ${c('relation')} for a link to another record, ${c('min')} and ${c('max')} for a number. <a href="/fields/">Fields</a> lists them all.</p>

<h2 id="layout">layout: how it is arranged</h2>
<p>A page's layout is one of four kinds:</p>
<table>
  <thead><tr><th>Layout</th><th>For</th></tr></thead>
  <tbody>
    <tr><td>${c('sections')}</td><td>A form in titled sections, each with 1 to 4 columns. Sign-ups, settings, simple records.</td></tr>
    <tr><td>${c('sheet')}</td><td>A business record: a title (with an optional photo), a statusbar, buttons, stat buttons, a ribbon, alerts, then sections and tabs, and an optional side panel.</td></tr>
    <tr><td>${c('tabs')}</td><td>Tabs at the top level, each holding sections and fields.</td></tr>
    <tr><td>${c('wizard')}</td><td>Steps, one at a time, with a progress bar. A step whose condition is false is skipped — that is how a survey branches.</td></tr>
  </tbody>
</table>
<p>Inside them, these nodes can be nested freely:</p>
<table>
  <thead><tr><th>Node</th><th>What it is</th></tr></thead>
  <tbody>
    <tr><td>${c('field')}</td><td>A field, by name: ${c('{ "type": "field", "id": "email", "field": "email" }')}. It can override the ${c('label')}, choose a ${c('widget')} (such as ${c('radio')} or ${c('tags')}), set a ${c('placeholder')}, span ${c('colspan')} columns, and carry conditions. A table of lines also takes ${c('columns')}, ${c('totals')}, ${c('optionalColumns')} and ${c('editMode')} — see <a href="/fields/#lines">tables of lines</a>.</td></tr>
    <tr><td>${c('section')}</td><td>A titled group with ${c('columns')} (1–4) and a ${c('description')}. With ${c('collapsible')} its title folds and unfolds it; add ${c('collapsed')} to start folded. A folded section opens by itself when one of its fields stops a save.</td></tr>
    <tr><td>${c('tabs')}</td><td>Tabs, each a ${c('tab')} with a label and children.</td></tr>
    <tr><td>${c('button')}</td><td>A button that names an ${c('action')}. Fieldia hands the press to your app with the record; your app decides what it does. It can ask to ${c('confirm')} first.</td></tr>
    <tr><td>${c('text')}</td><td>A heading, a paragraph or a note.</td></tr>
    <tr><td>${c('slot')}</td><td>A named place your app fills with its own content — an activity feed, a map, a chart.</td></tr>
  </tbody>
</table>
<p>Every node has an ${c('id')}, unique in the page. Ids are what a designer, a test or your app use to find a node.</p>

<h2 id="conditions">Conditions: invisible, readonly, required</h2>
<p>A field node, a section, a tab, a step or a button can be hidden, locked or made required by a condition written in the page. A condition is ${c('true')}, ${c('false')}, or an expression over the record's values:</p>
${code(
  'json',
  `
{ "type": "field", "id": "other_role", "field": "other_role",
  "invisible": "role != 'other'",
  "required": true }

{ "type": "field", "id": "discount", "field": "discount",
  "readonly": "state in ('done', 'cancel') or not is_company" }`
)}
<p>Expressions read like Python: ${c('==')} ${c('!=')} ${c('<')} ${c('>')} ${c('<=')} ${c('>=')}, ${c('in')} and ${c('not in')} with a list, ${c('and')} ${c('or')} ${c('not')}, ${c('True')} ${c('False')} ${c('None')}, numbers and quoted strings. An empty value is false. Conditions are checked again on every change, and a hidden field's value is left out of what is saved or submitted.</p>
<p>A condition that names a field the page does not have is refused when the page is checked, not when someone fills it in.</p>

<h2 id="checking">Checking a page</h2>
${code(
  'ts',
  `
import { validatePage } from '@fieldia/core';

const checked = validatePage(json);
if (!checked.ok) console.log(checked.issues);   // [{ path: 'layout.children[0]...', message: '...' }]`
)}
<p>${c('validatePage')} checks the shape, that every id is unique, that every field a node or a condition names exists, and that every condition parses. The viewer runs it too, and refuses a page that fails with the same list of issues. For editors and other languages the format is also a JSON Schema: ${c('@fieldia/core/page.schema.json')}.</p>
`,
};
