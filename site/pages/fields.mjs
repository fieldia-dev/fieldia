import { c, code } from '../layout.mjs';

const ROWS = [
  ['char', 'One line of text', 'email, phone, url, password, tags (free text), time (HH:MM), color (#rrggbb), copy, embed (a page shown inline)', 'size, pattern'],
  ['text', 'Several lines of text', 'copy', 'size'],
  ['html', 'Formatted text with a toolbar, cleaned of scripts on every change', '', ''],
  ['integer', 'A whole number', 'rating (stars), scale (1 to 10 buttons), progressbar, label, color (a tag colour, 0 to 11)', 'min, max'],
  ['float', 'A decimal number', 'progressbar, label, duration (HH:MM), percentage, timer', 'min, max, digits'],
  ['monetary', 'An amount of money', 'progressbar, label', 'currencyField or currency, min, max, digits'],
  ['boolean', 'Yes or no', 'toggle, priority (one star)', ''],
  ['date', 'A date', 'daterange', 'min, max, days'],
  ['datetime', 'A date and a time', 'daterange, timer', 'min, max, days'],
  ['selection', 'One choice from a list, or several with multiple', 'radio, checkboxes, statusbar, priority (stars), dot (a state’s dot)', 'options, multiple'],
  ['many2one', 'A link to one record of another model, found by typing', 'statusbar', 'relation, filter'],
  ['many2many', 'Links to several records', 'tags, checkboxes', 'relation, filter'],
  ['one2many', 'A table of lines that belong to this record', '', 'relation, fields; columns on the node'],
  ['reference', 'A link to a record of one of several models', '', 'models'],
  ['binary', 'A file, uploaded or dropped; several with multiple, as a list, thumbnails or cards, each opening in a viewer', 'pdf (shown inline)', 'accept, maxSize, multiple, minFiles, maxFiles'],
  ['image', 'An image, with a preview; several with multiple, as thumbnails, cards or a list', '', 'maxSize, multiple, minFiles, maxFiles'],
  ['json', 'Structured data, checked as it is typed', 'code (with @fieldia/code), address, distribution, tax-totals, payments', ''],
  ['properties', 'Extra values, each edited with the field for its type', '', 'definitions, definitionsFrom'],
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
    <tr><td>${c('radio')}, ${c('rating')}, ${c('scale')}, ${c('buttons')} on a ${c('boolean')}, ${c('slider')}, pictures to pick</td><td>One answer that need not be given shows <em>Clear selection</em> once picked; ${c('clear')}: ${c('false')} leaves it out, as an ERP's radios and priority stars have none — a rating's star picked, clicked again, then takes the answer away. A rating of one star (${c('max')} 1, a priority) never shows it: its second click takes the star away</td></tr>
    <tr><td>${c('rating')}</td><td>${c('icon')}: ${c('"heart"')}, ${c('"thumb"')} or ${c('"number"')} instead of stars; ${c('startLabel')}, ${c('endLabel')}: words at each end</td></tr>
    <tr><td>${c('scale')}</td><td>${c('startLabel')}, ${c('endLabel')}; ${c('nps')}: ${c('true')} colours a 0 to 10 scale as NPS, 0–6, 7–8 and 9–10 apart</td></tr>
    <tr><td>${c('slider')}</td><td>${c('step')} (1), ${c('startLabel')}, ${c('endLabel')}</td></tr>
    <tr><td>${c('time')} on a ${c('char')}</td><td>${c('min')}, ${c('max')} (${c('"09:00"')}), ${c('step')} in minutes</td></tr>
    <tr><td>${c('statusbar')}</td><td>${c('clickable')}, ${c('visibleStates')}. On a ${c('many2one')} its steps are the records the link may point to. ${c('durationsField')}: a ${c('json')} field holding the seconds spent in each step, by the step's value or stage's id, shown on each step (3d, 5h); ${c('fold')}: stages whose record is folded go under a ⋯ menu at the end, unless the record stands on one; ${c('saves')}: a click also saves the record, as Flectra's</td></tr>
    <tr><td>${c('badge')} on a ${c('selection')}</td><td>The chosen option's words in a pill, as Flectra's ${c('widget="badge"')}; ${c('tones')}: a tone for each value, ${c('{ "high": "danger", "low": "success" }')}, muted for one given none</td></tr>
    <tr><td>a ${c('monetary')} field</td><td>The currency's symbol inside the box, where the page's language writes it; ${c('symbol')}: ${c('"before"')} or ${c('"after"')} puts it there instead; ${c('pickCurrency')}: a currency box beside the amount</td></tr>
    <tr><td>a ${c('date')} or ${c('datetime')}</td><td>${c('weekNumbers')}: a calendar beside the date, with ISO week numbers; on a ${c('datetime')}, ${c('step')} in minutes</td></tr>
    <tr><td>a ${c('binary')} or ${c('image')} field</td><td>${c('files')}: ${c('"list"')} (a file's default), ${c('"thumbnails"')} (an image's) or ${c('"cards"')}: a picture over each file's name and size, the name in two lines at most, cut in the middle so its extension stays; ${c('filesSwitch')}: ${c('true')} puts List and Cards (or Thumbnails, when the page shows thumbnails) over the files, for the person filling the form to choose, kept with the page's preferences; ${c('camera')}: ${c('true')} has a phone offer its rear camera, ${c('"user"')} its front one</td></tr>
    <tr><td>an ${c('html')} field</td><td>${c('toolbar')}: ${c('false')} leaves the formatting toolbar off. The toolbar's Heading makes a heading in one press</td></tr>
    <tr><td>a ${c('many2one')} or ${c('many2many')}</td><td>${c('create')}: ${c('false')} never offers to make a record from what was typed. With dialogs, both end their list with Search more… when it has no room, and open a linked record — a ${c('many2many')} from its tag — unless ${c('open')} is ${c('false')}, Flectra's ${c('no_open')}. ${c('avatar')}: ${c('true')} shows the record's picture before its name, or its initials (Flectra's avatar widgets); on a ${c('many2one')}, ${c('details')}: ${c('true')} shows lines of the record under the link — an address, a tax number, as Flectra's ${c('show_address')}; on a ${c('many2many')}, ${c('colors')}: ${c('true')} draws each tag in its record's colour, 1 to 11 as Flectra numbers them (${c('color_field')}). The picture, lines and colour come from the data source, with each record it finds or loads — see <a href="/data/#related">what a link shows</a></td></tr>
    <tr><td>${c('signature')} on a ${c('binary')}</td><td>${c('color')} (${c('"#1b2a5c"')}) and ${c('penWidth')} (3): the pen; the node's ${c('placeholder')}: words on the blank pad; ${c('footerLabel')}: words kept under it; ${c('upload')}: ${c('true')} lets a picture of a signature be uploaded. Undo takes the last stroke away; a typed name is kept as the value's ${c('text')}</td></tr>
    <tr><td>${c('address')} on a ${c('json')}</td><td>${c('parts')}: which, of ${c('street')}, ${c('line2')}, ${c('city')}, ${c('region')}, ${c('postcode')}, ${c('country')} (the first, third, fifth and sixth unless it says); ${c('requiredParts')}: those that must be filled, each asked for by name; ${c('country')}: the ISO code it starts on. The country is chosen from a list in the page's language and kept as its code, ${c('"EG"')}</td></tr>
    <tr><td>a ${c('one2many')} as a table</td><td>${c('min')}: lines at least, a new table starting with them; ${c('max')}: at most; ${c('addLabel')}: the Add button's words, and ${c('addSectionLabel')}, ${c('addNoteLabel')} those of its section's and note's (the grid takes the three too); ${c('emptyLabel')}: a sentence while there is no line; ${c('confirmDelete')}: ${c('true')} asks before a line with something in it goes. A line moves by its grip, or by Alt+↑/↓ from inside it</td></tr>
    <tr><td>${c('duration')} on a ${c('float')}</td><td>Hours as HH:MM, typed so or as ${c('6.5')}: Flectra's ${c('float_time')}. ${c('suffix')}: words after it in its box, ${c('"hours"')}</td></tr>
    <tr><td>${c('percentage')} on a ${c('float')}</td><td>A fraction shown and typed as a per cent: ${c('0.25')} is 25 %, with the field's ${c('digits')} at the most</td></tr>
    <tr><td>${c('priority')}</td><td>Stars over a ${c('selection')}, the first option none — ${c('"0"')}…${c('"3"')} is three — or one over a ${c('boolean')}; the star picked, clicked again, takes them back to none</td></tr>
    <tr><td>${c('dot')} on a ${c('selection')}</td><td>A state's dot with a menu of the states. ${c('tones')}: a tone by value, ${c('{ "blocked": "danger" }')} (else ${c('normal')} grey, ${c('blocked')} red, ${c('done')} green, then by place); ${c('label')}: ${c('true')} shows the state's words beside it</td></tr>
    <tr><td>${c('daterange')} on a ${c('date')} or ${c('datetime')}</td><td>${c('endField')}: the field of the last day. One box from → to, typed in or picked on a calendar</td></tr>
    <tr><td>${c('timer')}</td><td>On a ${c('float')}: the time logged, ${c('unit')} ${c('"minutes"')} when kept in minutes, and ${c('startField')}, a ${c('datetime')} it runs from while set. On a ${c('datetime')}: the time since it</td></tr>
    <tr><td>${c('color')}</td><td>On an ${c('integer')}, Flectra's twelve tag colours from a palette (0 none); on a ${c('char')}, a colour as ${c('#rrggbb')}</td></tr>
    <tr><td>${c('copy')}</td><td>The value and a Copy button</td></tr>
    <tr><td>${c('pdf')} on a ${c('binary')}, ${c('embed')} on a ${c('char')}</td><td>${c('height')} in pixels (480): the browser's own viewer of a PDF, or of the web page at the address, beside a link to open it in a tab</td></tr>
    <tr><td>${c('distribution')} on a ${c('json')}</td><td>${c('model')}: the accounts' (${c('"account.analytic.account"')})</td></tr>
    <tr><td>${c('tax-totals')} on a ${c('json')}</td><td>${c('currencyField')} or ${c('currency')}; ${c('editable')}: ${c('true')} lets the tax amounts be typed while the field is not read-only</td></tr>
    <tr><td>${c('payments')} on a ${c('json')}</td><td>${c('currencyField')}, ${c('dueField')} (the amount still due), ${c('model')} of a payment's page (${c('"account.payment"')})</td></tr>
    <tr><td>a ${c('properties')} field</td><td>${c('columns')}: ${c('2')} lays them side by side; ${c('add')}: ${c('true')}, with ${c('definitionsFrom')}, offers Add a property in place</td></tr>
    <tr><td>${c('cards')} on a ${c('one2many')}</td><td>${c('min')}, ${c('max')}, ${c('itemLabel')} (a card's title), ${c('addLabel')}. Each card moves up and down by its arrows, and is copied, answers and all, right after itself</td></tr>
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

<p>A filter's items all hold together; a group of ${c('any')} holds when one of its items does, and ${c('all')} groups nest inside it. Besides ${c('=')} ${c('!=')} ${c('<')} ${c('>')} ${c('<=')} ${c('>=')} ${c('in')} ${c('not in')}, a condition can find text with ${c('like')} (as typed), ${c('ilike')}, ${c('startswith')} or ${c('endswith')} (whatever the case), ask whether a field is ${c('set')} or ${c('notset')}, or take a value ${c('between')} two. ${c('contains')} holds when a record's many2many holds the value, or one of a list — Flectra's ${c('=')} and ${c('in')} on a many2many, such as a stage's projects — and ${c('not contains')} when it holds none. ${c('=?')} is ${c('=')} while its value is set and is left out while it is empty, as Flectra's: "this company, if the record has one". A record's own ${c('id')} can be tested against a list the form holds: ${c('{ "field": "id", "op": "in", "valueFrom": "available_journal_ids" }')}.</p>
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
  pages: { partner: customerPage },   // or (request) => page | null: request.model for a link
});`
)}
<p>In React pass ${c('pages={…}')}, in Vue ${c(':pages="…"')}, in Angular ${c('[pages]="…"')}. The same option gives a saved form placed in a page by its id (${c('request.id')}, ${c('request.version')}); the older ${c('relatedPages')}, by model only, is still read. A link to one of those models then offers:</p>
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
<h3 id="side-panels">Side panels</h3>
<p>${c('openFormPanel')} opens a page in a panel instead: full height at the inline-end edge (the left, right to left) unless it names another side, the page behind dimmed but still in sight, and the whole screen on a phone. It takes the dialog's options, with ${c('side')}, ${c('width')} and ${c('height')} in place of ${c('size')}, and hands back the same result.</p>
${code(
  'ts',
  `
import { openFormPanel } from '@fieldia/viewer';

const { saved, recordId, values } = await openFormPanel({
  page: callPage, dataSource, recordId: null,
  title: 'Log a call',
  width: 'medium',          // 'narrow' | 'medium' | 'wide': about 420, 560 or 720 pixels
  look: page.look,          // the opener's accent, scheme, corners and font
});

// From another edge: the whole width along the top, 40 in a hundred of the screen tall.
await openFormPanel({ page: callPage, dataSource, title: 'Log a call', side: 'top', height: 'short' });`
)}
<p>${c('side')} is the edge it comes from: ${c("'end'")} (the default: the end of the line, the right, or the left right to left) or ${c("'start'")}, as the page reads; or ${c("'left'")}, ${c("'right'")}, ${c("'top'")} or ${c("'bottom'")} of the screen, whatever the page's direction. At the left or right, ${c('width')} is how deep it is; at the top or bottom it runs the whole width, and ${c('height')} says how tall: ${c("'short'")}, ${c("'medium'")} (the default) or ${c("'tall'")}, about 40, 60 or 85 in a hundred of the screen. On a phone every side fills the screen, the top sliding down from above and the rest up from below. A page's step opens one with ${c('"as": "panel"')} and the same ${c('"side"')}.</p>
<p>Its foot has Discard and Save &amp; Close, or Discard and Done in ${c('"values"')} mode. Escape and × ask “Discard your changes?” first when something was changed; Discard does not ask. A dialog opened from inside it, such as a link's Create and edit…, sits above it; a panel opened from it stacks over it, the older one stepped back from its own edge; each gives the focus back as it closes. It slides in from its edge only when the reader's system welcomes motion. Try it on <a href="/demos/plain/?page=fields&amp;skin=outlined">Every field</a> in JavaScript: “Log a call in a side panel”, over the form, from the right, left, top or bottom.</p>

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
<p>${c('order')} puts the lines in an order of their own fields as they load, as Flectra's list ${c('default_order')}: ${c('[{ "field": "is_done" }, { "field": "manual_consumption", "desc": true }, { "field": "sequence" }]')} — by the first field, then the next, ${c('desc')} turning one round; empty values and false first, a link by its name. Both the plain table and the grid show that order. A line a person drags (with a ${c('sequenceField')}) or adds stays where it is until the lines load again — opening the record, or a save bringing them back.</p>

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
  <li><strong>Dates.</strong> A day picked from a date's calendar keeps it and closes the cell, as a spreadsheet's does; a date typed is kept with Enter or Tab. Fieldia's own calendar with week numbers is the column's ${c('cells.<column>.options')}, ${c('{ "weekNumbers": true }')} — a column's options reach its editor with or without a widget — and its pick closes the cell too. A date with a time, or a whole line open at once, stays open.</li>
  <li><strong>Every keystroke reaches the form</strong>, so totals and other computed values follow while a cell is still being typed.</li>
  <li><strong>Sections and notes</strong> run across the row. A note grows as it is typed; Enter starts a new line of it, Ctrl+Enter (Cmd+Enter) finishes it.</li>
  <li><strong>Moving lines.</strong> With a ${c('sequenceField')}, each line has a handle to drag it by.</li>
  <li><strong>Columns.</strong> People resize them and drag them into another order; the button at the end of the header hides and shows the optional ones. Their choices are kept for the next visit, in the browser unless you pass your own ${c('preferences')} store to the viewer.</li>
  <li><strong>A refused save</strong> marks the wrong cells, lists the problems under the table and opens the first one.</li>
  <li><strong>Long tables</strong> stop growing at 15 lines and scroll inside, drawing only the rows in view.</li>
  <li><strong>A whole line at once.</strong> ${c('"editMode": "row"')} on the node opens every cell of a line together, as an editable list does.</li>
  <li><strong>A line in a dialog.</strong> ↗ at the end of a line opens all of its fields, the hidden columns too, in a dialog. Its links search the page's data source, and the page's ${c('onchange')} runs as it is edited, so a subtotal follows its quantity there. Save &amp; Close writes the line back; Discard leaves it as it was.</li>
</ul>

<h2 id="table-rules">A table's own rules</h2>
<p>Each line of a table can be read on its own, as Flectra's editable lists do. Under ${c('cells')}, a column's ${c('invisible')}, ${c('readonly')} and ${c('required')} are conditions on its line — its fields, its own ${c('id')} (empty until the line is saved, so ${c('"readonly": "id"')} locks a saved line), with the record it is on as ${c('parent')} — and its ${c('hidden')} a condition on the record that hides the whole column, as ${c('column_invisible')} does. A cell its line hides stays, blank, so the column still lines up; one its line requires stops a save until it has a value.</p>
${code(
  'json',
  `
{
  "type": "field", "id": "moves", "field": "move_ids", "widget": "grid",
  "cells": {
    "product_id": { "readonly": "parent.state != 'draft'" },
    "quantity": {
      "hidden": "state == 'draft'",
      "tones": [{ "tone": "danger", "when": "quantity > product_uom_qty" }],
      "bold": "quantity > 0"
    },
    "lot_id": { "invisible": "not has_tracking", "required": "has_tracking and parent.state == 'assigned'" },
    "state": { "badge": true, "tones": [{ "tone": "success", "when": "state == 'done'" }] }
  },
  "rowTones": [{ "tone": "muted", "when": "scrapped" }],
  "rowButtons": [
    { "type": "button", "id": "serials", "label": "Assign serial numbers", "icon": "list",
      "invisible": "not has_tracking", "action": "action_assign_serial" }
  ]
}`
)}
<ul>
  <li><strong>Tones.</strong> A line's ${c('rowTones')} and a cell's ${c('tones')} take the first that holds — ${c('info')}, ${c('success')}, ${c('warning')}, ${c('danger')} or ${c('muted')}, Flectra's ${c('decoration-*')} — and ${c('rowBold')} or a cell's ${c('bold')} its ${c('decoration-bf')}. Their colours are the theme's, readable in light and dark.</li>
  <li><strong>Badges.</strong> A choice with ${c('"badge": true')} shows as a pill in its tone, in the grid, as ${c('widget="badge"')}.</li>
  <li><strong>A line kept.</strong> ${c('lineDelete')} on the node is a condition on each line, as Flectra's ${c("options=\"{'delete': …}\"")}: ${c('"lineDelete": "parent.state == \'draft\' or not id"')} lets a manufacturing order's components go only while it is a draft — or a line not saved yet. A line it keeps has no ×, in the plain table, the grid and the cards, and ${c('form.removeLine')} refuses it.</li>
  <li><strong>Buttons on a line</strong> are shown by their own condition on it. A press runs their steps, and each call your app answers carries the line: ${c('{ field, key, values }')}.</li>
  <li><strong>Width.</strong> A cell's ${c('width')} is the column's, in characters.</li>
  <li><strong>An analytic distribution in a column.</strong> A json line field with ${c('"widget": "distribution"')} under its ${c('cells')} (and its accounts' ${c('model')} in their ${c('options')}) is Flectra's ${c('analytic_distribution')} on order lines: in the grid its cell says each account by its name with its share — "Cairo office 60%, Marketing 40%" — and its editor opens the lines to change, Tab going round them; in the plain table the widget itself sits in the cell. Its accounts are searched by the line (${c('form.searchLine(field, key, column, query, limit, { model, ids })')}).</li>
  <li><strong>A column for some roles.</strong> A cell's ${c('roles')}, as a part's — ${c('["analytic.group_analytic_accounting"]')}, Flectra's ${c('groups=')} on a list's column — hides the whole column, as ${c('hidden')} does, from people holding none of them; their cells are asked nothing. The app names the person's roles (${c('user')}); its server still decides what they may do.</li>
</ul>
<p>Both the plain table and the grid draw them; the form reads them, so your own widget can too, with ${c('form.lineState(node, key)')} and ${c('form.columnHidden(node, column)')}.</p>
<p>A line's money can be in the record's currency, as Flectra's related ${c('currency_id')}: ${c('"currencyField": "parent.currency_id"')} on a line's monetary field. Its cells, the total under them and the line's dialog follow the record's currency as it changes.</p>
<p>An answer rule on a table, ${c('{ "distinct": "partner_id" }')}, refuses two lines with one value in that column — a split's payers, each once — as a model's constraint would: "Payer: Mona Adel is on more than one line of Split". Empty cells, sections and notes are left out.</p>

<h2 id="table-buttons">A table's buttons</h2>
<p>Besides a line's own ${c('rowButtons')}, a table takes buttons for the lines chosen in it and buttons beside Add a line:</p>
${code(
  'json',
  `
{
  "type": "field", "id": "workorders", "field": "workorder_ids", "widget": "grid",
  "selectedButtons": [
    { "type": "button", "id": "wo-start", "label": "Start", "action": "button_start", "invisible": "state == 'done'" },
    { "type": "button", "id": "wo-done", "label": "Done", "action": "button_finish", "confirm": "Mark the chosen work orders done?" }
  ],
  "controlButtons": [{ "type": "button", "id": "catalog", "label": "Catalog", "icon": "list", "action": "action_add_from_catalog" }],
  "options": { "copy": true }
}`
)}
<ul>
  <li><strong>Lines chosen.</strong> With ${c('selectedButtons')}, each line has a tick and the head one that chooses every line; while any is chosen, a bar over the table says how many and shows the buttons — Flectra's list header buttons. A press runs with the lines in the table's order: every call carries ${c('{ field, keys, ids, values }')} as its ${c('lines')}, the ids of those already saved. ${c('form.runLinesAction(node, button, keys)')} does the same.</li>
  <li><strong>Beside Add a line.</strong> ${c('controlButtons')} are the record's buttons, shown by a condition on it, as Flectra's ${c('<control>')}: a catalog to add from, say.</li>
  <li><strong>A copy of a line.</strong> ${c('"copy": true')} in the node's options puts ⧉ on each line: a copy of it, its values too, right after it — never its saved id.</li>
  <li>A button on a line asks its ${c('confirm')} first, as any button does.</li>
</ul>

<h2 id="line-pages">Lines with pages of their own</h2>
<ul>
  <li><strong>A line's own page.</strong> ${c('"lineOpens": "record"')} makes a line's ↗ open its own record, by the table's model, in the page your app gives for it (${c('pages')}) — Flectra's list opening a line's form. What that page saves comes back to the line's fields of the same names. A line not saved yet has no record: it opens its fields, as ${c('"lineOpens": "fields"')} does, and as the grid always can. The plain table shows ↗ only with ${c('lineOpens')}.</li>
  <li><strong>A line's own form.</strong> ${c('lineForm')} on the node lays a line out as a page is — sections, columns, words, tabs — its fields by the line's names: Flectra's ${c('<form>')} inside a one2many, such as a contact's child address. ↗ opens it, on each line of the plain table, the grid and the cards. Its conditions read the line — ${c('"invisible": "type != \'contact\'"')}, ${c('"required": "type == \'contact\'"')} — with the record as ${c('parent')}, in its conditions and its links' filters; the line's fields it does not place are kept as they are. Save &amp; Close checks it and writes the line back.</li>
  <li><strong>Lines inside a line.</strong> A line field may be a one2many of its own, one level down — a survey question's answers: its lines are edited in the line's form (place it there), never drawn in the table's row, and kept in the line's values as its list of lines, ${c('{ key, values }')}, which the line's update carries to your data source. Its own lines' conditions read the line as ${c('parent')}.</li>
  <li><strong>A many2many as a table.</strong> Give the many2many its records' ${c('fields')} and its node ${c('columns')}: a table of the records it links to, its values read with your data source's ${c('list')} by their ids (${c('form.linkedValues(field, ids, columns)')}). Add a line finds one more by searching; × takes one away, never deleting it; ↗ opens a record's own page.</li>
</ul>
${code(
  'json',
  `
"compliance_ids": {
  "type": "many2many", "label": "Compliance", "relation": "legal.compliance",
  "fields": {
    "name": { "type": "char", "label": "Requirement" },
    "state": { "type": "selection", "label": "Status", "options": [{ "value": "open", "label": "Open" }, { "value": "met", "label": "Met" }] }
  }
}
…
{ "type": "field", "id": "compliance", "field": "compliance_ids", "columns": ["name", "state"] }`
)}

<h2 id="table-phone">On a phone</h2>
<ul>
  <li><strong>Lines as cards.</strong> ${c('"cards": "narrow"')} draws a table's lines as cards while it is up to 520px wide — Flectra's ${c('mode="tree,kanban"')} on a phone — each column's label by its value, its tone, its buttons; in the grid, a card's title opens the line. ${c('"cards": "always"')} keeps them at every width.</li>
  <li><strong>Columns as wide as they hold.</strong> ${c('"fit": "content"')} sizes each column to what it holds, as Flectra's lists, rather than sharing the width: a wide table with short columns stops cutting text. A cell's ${c('width')} still fixes one.</li>
  <li><strong>A part hidden on a phone.</strong> Any part — a field, a section, a button, a text — takes ${c('"hideOn": ["narrow"]')}, Flectra's ${c('d-none d-sm-block')}: hidden while the form is that wide. ${c('narrow')} is up to 520px, ${c('medium')} up to 760px, ${c('wide')} above, the widths a section's columns change at.</li>
</ul>

<h2 id="field-tones">A field's value in a tone</h2>
<p>A field outside a table takes ${c('tones')} and ${c('bold')} too, read on the record — Flectra's ${c('decoration-danger')} on a field: a deadline red once it has passed, hours available red below what is needed. ${c('"widget": "badge"')} draws a choice, text or link as a pill in its tone, never edited; in a table, a cell's ${c('"badge": true')}.</p>
${code(
  'json',
  `
{ "type": "field", "id": "deadline", "field": "date_deadline",
  "tones": [{ "tone": "danger", "when": "date_deadline and date_deadline < today() and state != 'done'" }] }

{ "type": "field", "id": "status", "field": "deadline_status", "widget": "badge",
  "tones": [{ "tone": "danger", "when": "deadline_status == 'late'" }, { "tone": "success", "when": "deadline_status == 'ok'" }] }`
)}
<p>${c('form.fieldTone(node)')} says the tone and bold now.</p>

<h2 id="business">Business widgets</h2>
<p>The widgets an ERP's screens lean on, each the Flectra widget it stands for. Open <a href="/demos/plain/?page=business&amp;skin=underline">the business widgets demo</a> to use them all on one task.</p>
<ul>
  <li><strong>Priority and a state's dot on the title's line.</strong> A sheet's ${c('title')} takes ${c('before')} and ${c('after')}: fields on its line, as Flectra's ${c('&lt;h1&gt;')} holds the priority star, the name and the state. Each is a field like any other, with its conditions.</li>
  <li><strong>Hours as HH:MM.</strong> ${c('duration')} writes ${c('6.5')} as ${c('06:30')}, in fields, cells and totals alike.</li>
  <li><strong>A live timer.</strong> ${c('timer')} ticks each second while its ${c('startField')} is set, on top of the time logged; buttons with ${c('call')} steps start and stop it, the app answering with the new values.</li>
  <li><strong>A range of dates.</strong> ${c('daterange')} writes two fields: the node's and ${c('endField')}.</li>
  <li><strong>Structured data the app works out.</strong> ${c('tax-totals')} reads Flectra's own ${c('tax_totals')} — ${c('subtotals')}, ${c('groups_by_subtotal')}, ${c('amount_total')} — or ${c('{ untaxed, groups: [{ name, amount }], total }')}; ${c('payments')} reads Flectra's ${c('invoice_payments_widget')} (${c('{ content: [{ date, amount, name, journal_name, ref, account_payment_id }] }')}) or a plain list; ${c('distribution')} keeps ${c('{ "12": 60, "14": 40 }')}, shares by account id.</li>
</ul>
${code(
  'json',
  `
"title": {
  "field": "name",
  "before": [{ "type": "field", "id": "f-priority", "field": "priority", "widget": "priority" }],
  "after": [{ "type": "field", "id": "f-state", "field": "kanban_state", "widget": "dot" }]
}

{ "type": "field", "id": "f-dates", "field": "request_date_from", "widget": "daterange", "options": { "endField": "request_date_to" } }
{ "type": "field", "id": "f-duration", "field": "duration", "widget": "timer", "options": { "startField": "timer_start", "unit": "minutes" } }`
)}
<p>In a table, a column's cells take a widget of their own, and its options — Flectra's ${c('widget=')} on a list's column: ${c('progressbar')}, ${c('priority')}, ${c('dot')}, ${c('color')} and ${c('timer')} are used in the cell itself, in the plain table and the grid; ${c('duration')} and ${c('percentage')} are typed in the cell as in their field, and say their totals the same way.</p>
${code(
  'json',
  `
"cells": {
  "priority": { "widget": "priority" },
  "allocated_hours": { "widget": "duration" },
  "progress": { "widget": "progressbar", "options": { "maxField": "allocated_hours" } }
}`
)}
<p><strong>Properties defined by a linked record.</strong> A properties field with ${c('definitionsFrom')} takes its definitions from the app — those its link's record keeps, as a task's properties are its project's — through the data source's ${c('definitions')}, again as the link changes. With ${c('"add": true')} a property is added in place, its name and its kind, and handed to ${c('saveDefinitions')}.</p>
${code(
  'json',
  `
"task_properties": { "type": "properties", "label": "Properties", "definitionsFrom": { "list": "task_properties", "dependsOn": ["project_id"] } }

{ "type": "field", "id": "f-props", "field": "task_properties", "options": { "columns": 2, "add": true } }`
)}

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
