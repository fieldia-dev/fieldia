import { readFileSync } from 'node:fs';
import { c, code } from '../layout.mjs';

/** Fieldia's own icons, read from its source so this page never drifts from it. */
const ICONS = [
  ...readFileSync(new URL('../../libs/widgets/src/lib/icons.ts', import.meta.url), 'utf8').matchAll(/^ {2}(\w+): '([^']+)'/gm),
].map((match) => ({ name: match[1], inside: match[2] }));
const iconGrid = `<ul class="icon-grid">${ICONS.map(
  ({ name, inside }) =>
    `<li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inside}</svg><code>${name}</code></li>`
).join('')}</ul>`;

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
  "fieldia": "0.5",
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
<p>A value can also start from the record, as Flectra's ${c(`context="{'default_…': …}"`)} does. ${c('defaultFrom')} works out a new record's or line's first value — ${c('"defaultFrom": "user"')} starts it with the person using the form, as a link. A one2many's ${c('lineDefaults')} give each new line its values from the record — ${c('{ "project_id": "project_id" }')}, a field named alone taken whole — and a link's ${c('createValues')} what a record made from it starts with, by Create and edit… or at once from what was typed.</p>

<h2 id="layout">layout: how it is arranged</h2>
<p>A page's layout is one of five kinds:</p>
<table>
  <thead><tr><th>Layout</th><th>For</th></tr></thead>
  <tbody>
    <tr><td>${c('sections')}</td><td>A form in titled sections, each with 1 to 4 even columns, or rows each divided in twelfths. Sign-ups, settings, simple records.</td></tr>
    <tr><td>${c('sheet')}</td><td>A business record: a title (with an optional photo and fields over and under it), a statusbar, buttons, stat buttons, badges, a ribbon, alerts, then sections and tabs, and an optional side panel. See <a href="#sheet">the parts of a sheet</a>.</td></tr>
    <tr><td>${c('tabs')}</td><td>Tabs at the top level, each holding sections and fields.</td></tr>
    <tr><td>${c('wizard')}</td><td>Steps, one at a time, with a progress bar. A step whose condition is false is skipped — that is how a survey branches. Steps can be clicked, skipped when optional, and its buttons named — see <a href="#wizard">wizards</a>.</td></tr>
    <tr><td>${c('list')}</td><td>Many records as a table, with a search bar, filters, group by and favourites, and buttons for the records chosen. It names ${c('columns')}, not children — see <a href="/lists/">lists and search</a>.</td></tr>
  </tbody>
</table>
<p>Inside them, these nodes can be nested freely:</p>
<table>
  <thead><tr><th>Node</th><th>What it is</th></tr></thead>
  <tbody>
    <tr><td>${c('field')}</td><td>A field, by name: ${c('{ "type": "field", "id": "email", "field": "email" }')}. It can override the ${c('label')}, choose a ${c('widget')} (such as ${c('radio')} or ${c('tags')}), set a ${c('placeholder')} — or words chosen by a condition, ${c('"placeholderWhen": [{ "when": "is_company", "text": "e.g. Lumber Inc" }]')}, the first that holds, as Flectra's two name fields (a sheet's ${c('title')} takes them too; in the designer, Placeholder, Other words while) — name what the browser fills its box in with and the keyboard a phone shows (${c('"autocomplete": "given-name"')}, ${c('"inputmode": "numeric"')}: <a href="/fields/#autofill">filled in by the browser</a>), span ${c('colspan')} columns, take the focus as the record opens with ${c('"focus": true')} (a sheet's ${c('title')} too) (Flectra's ${c('default_focus')}: in a page, a dialog or a panel, the first such field shown, never from someone busy elsewhere on the screen; in the designer, Focused as the record opens), and carry conditions. A table of lines also takes ${c('columns')}, ${c('totals')}, ${c('optionalColumns')}, ${c('order')}, ${c('editMode')} and rules of its own — ${c('cells')}, ${c('rowTones')}, ${c('rowBold')}, ${c('rowButtons')}, ${c('lineDelete')}, ${c('selectedButtons')}, ${c('controlButtons')}, ${c('lineOpens')}, ${c('cards')}, ${c('fit')} — see <a href="/fields/#lines">tables of lines</a>, <a href="/fields/#table-rules">a table's own rules</a> and <a href="/fields/#table-buttons">its buttons</a>. Any field takes ${c('tones')} and ${c('bold')} (<a href="/fields/#field-tones">a value in a tone</a>), and any part ${c('hideOn')} (<a href="/fields/#table-phone">on a phone</a>); a field, a section, a tab and a related list ${c('"print": false')}, left out on paper (<a href="/record/#print">on paper</a>).</td></tr>
    <tr><td>${c('section')}</td><td>A titled group with ${c('columns')} (1–4, or <a href="#columns">a count for each width</a>), an ${c('icon')} and a ${c('description')}. ${c('tracks')} gives its columns their own widths — pixels, a share of the row or of what is left: ${c('["50%", "1fr", "1fr"]')}, one for each column, from a tablet's width up — and ${c('gap')} the room between them, in pixels. ${c('"foldAt": "end"')} puts its fold control at its heading's end as ^ and ⌄, and ${c('maximise')} a ⤢ beside it that shows the group alone over the record's body until Escape; with either, its heading is a work item's: 16px words over a rule, the tools at its end showing while it is pointed at or worked in. A group holding one field alone, its label out of sight, takes that field's own tools into its heading — a Markdown text's Edit and Done. With ${c('collapsible')} its title folds and unfolds it; add ${c('collapsed')} to start folded. A folded section opens by itself when one of its fields stops a save. A section can sit inside another: two in a two-column section are the two groups of an Odoo header. An untitled plain section of twelfths led by a field with its label beside is a row, as Odoo's ${c('o_row')}: that label lines up with the labels round it, and the parts share the room of the values — fitting even one column of a two-column group.</td></tr>
    <tr><td>${c('tabs')}</td><td>Tabs, each a ${c('tab')} with a label, an ${c('icon')} and children. A tab's parts are drawn when it is first shown, and kept up to date only while it is shown, so a page of many tabs opens and types as fast as one; a tab with a problem in it is marked, and a save stopped there opens it at the problem.</td></tr>
    <tr><td>${c('button')}</td><td>A button that names an ${c('action')}, with an ${c('icon')} if you like. Fieldia hands the press to your app with the record; your app decides what it does. It can ask to ${c('confirm')} first.</td></tr>
    <tr><td>${c('text')}</td><td>A heading, a paragraph or a note — or ${c('"style": "help"')}: help in a light box with room for an ${c('icon')} at its start, as a work item's Deployment note. ${c('[words](https://…)')} in any text's words is a link (web and mail addresses only), opened in a tab of its own.</td></tr>
    <tr><td>${c('slot')}</td><td>A named place your app fills with its own content — an activity feed, a map, a chart.</td></tr>
    <tr><td>${c('image')}</td><td>A picture between parts: its ${c('src')} and its ${c('alt')}, what it shows for those who cannot see it — empty only for a picture that is decoration. ${c('width')}: ${c('small')} (160px), ${c('medium')} (320px), ${c('large')} (480px), ${c('full')} or a number of pixels, never wider than its row; ${c('align')}: ${c('start')}, ${c('center')} or ${c('end')}; ${c('href')}: a web or mail address it opens in a new tab; ${c('caption')}: words under it, translated with the page's others.</td></tr>
    <tr><td>${c('divider')}, ${c('spacer')}</td><td>A line across the row, and empty room.</td></tr>
    <tr><td>${c('form')}</td><td>A saved form placed whole — an address made once, placed wherever a form asks for one: ${c('{ "type": "form", "id": "home", "page": "address", "name": "home_address" }')}. ${c('page')} is the saved page's id; ${c('version')} keeps to a published version, the latest when left out. Its answers go under ${c('name')} as an object, ${c('{ "home_address": { "street": … } }')}, so two copies never mix; its own required fields, rules and worked-out values hold inside it. ${c('title')}: the saved page's own when left out, none when empty. The viewer finds the page through its ${c('pages')} option.</td></tr>
  </tbody>
</table>
<p>Every node has an ${c('id')}, unique in the page. Ids are what a designer, a test or your app use to find a node.</p>

<h3 id="sheet">The parts of a sheet</h3>
${code(
  'json',
  `
{
  "type": "sheet", "id": "sheet",
  "title": {
    "field": "name", "avatarField": "image",
    "above": [
      { "type": "field", "id": "f-type", "field": "company_type", "widget": "radio" }
    ],
    "below": [{ "type": "field", "id": "f-sold", "field": "sale_ok" }]
  },
  "statusbar": { "field": "state", "clickable": true, "position": "header" },
  "badges": [
    { "id": "b-key", "label": "Key account", "tone": "success", "icon": "star",
      "invisible": "sale_order_count < 10" }
  ],
  "alerts": [
    { "id": "a-limit", "message": "Over the credit limit.", "tone": "warning",
      "dismissible": true, "invisible": "not over_limit" }
  ],
  "children": []
}`
)}
<ul>
  <li><strong>Over and under the title</strong>, ${c('above')} and ${c('below')} hold field nodes: an Individual/Company choice over the name, “Can be sold” under it. They are checked like any other field.</li>
  <li><strong>Badges</strong> sit over the title, each with a ${c('tone')} (info, success, warning, danger, muted), an ${c('icon')} and a condition.</li>
  <li><strong>An alert</strong> with ${c('dismissible')} has a × that closes it until the page opens again.</li>
  <li><strong>The statusbar</strong> sits in the header bar, or with ${c('"position": "title"')} under the title in the sheet.</li>
</ul>

<h3 id="sheet-reading">How a dense sheet reads</h3>
<p>What a Flectra sheet shows besides its fields, each checked when the page is: a ribbon or several, alerts that hold a field's value or a button, stat buttons that write their value as its field does, a statusbar that hides and times its steps, keys on buttons, parts on one line, and a label over the title.</p>
${code(
  'json',
  `
{
  "type": "sheet", "id": "invoice",
  "title": { "field": "name", "label": "Customer Invoice" },
  "statusbar": { "field": "stage_id", "clickable": true, "saves": true, "fold": true,
    "durationsField": "duration_tracking", "invisible": "not active" },
  "buttons": [
    { "type": "button", "id": "b-post", "label": "Confirm", "hotkey": "v", "action": "action_post" },
    { "type": "button", "id": "b-draft", "label": "Reset to Draft", "hotkey": "shift+g", "action": "button_draft" }
  ],
  "statButtons": [
    { "id": "s-paid", "label": "Paid", "field": "amount_paid", "action": "open_payments" },
    { "id": "s-sold", "label": "Sold", "field": "sales_count", "unitField": "uom_name", "unit": "Units", "action": "open_sales" },
    { "id": "s-moves", "label": "In", "field": "nbr_moves_in", "secondField": "nbr_moves_out", "secondLabel": "Out", "action": "open_moves" },
    { "id": "s-meeting", "label": "No Meeting", "labelField": "meeting_display_label", "field": "meeting_display_date", "action": "open_meetings" }
  ],
  "ribbons": [
    { "id": "r-paid", "label": "Paid", "tone": "success", "invisible": "payment_state != 'paid'" },
    { "id": "r-outcome", "label": "Closed", "labelField": "outcome", "invisible": "not outcome" },
    { "id": "r-legacy", "label": "Legacy", "tooltip": "Made in the old invoicing app", "invisible": "not legacy" }
  ],
  "alerts": [
    { "id": "a-lock", "message": "Entries before {tax_lock_date} cannot be posted.", "tone": "warning" },
    { "id": "a-credit", "message": "", "messageField": "partner_credit_warning", "invisible": "not partner_credit_warning" },
    { "id": "a-dup", "message": "This bill may be a duplicate.",
      "buttons": [{ "type": "button", "id": "b-dup", "label": "See it", "action": "open_duplicate" }] }
  ],
  "children": [
    { "type": "section", "id": "price", "title": "Pricelist", "style": "inline", "children": [
      { "type": "field", "id": "f-pricelist", "field": "pricelist_id" },
      { "type": "button", "id": "b-update", "label": "Update prices", "style": "link", "action": "update_prices" }
    ] },
    { "type": "text", "id": "t-top-up", "text": "Top up {topup_amount} to reach the minimum.", "style": "alert", "tone": "warning" }
  ]
}`
)}
<ul>
  <li><strong>Ribbons</strong>: ${c('ribbons')} lists several, each with its condition; the first that shows has the corner, after ${c('ribbon')}. A ribbon's ${c('labelField')} gives its words from a field while it holds any — a choice by its label — and ${c('tooltip')} words on pointing at it.</li>
  <li><strong>Alerts</strong>: ${c('{field}')} in an alert's ${c('message')} — or a text's ${c('text')} — shows that field's value as the field writes it, set apart in bold; ${c('messageField')} takes the alert's words from a field while it holds any, as Flectra's server warnings; ${c('buttons')} sit inside it after its words, links unless styled. Words with ${c('"style": "alert"')} and a ${c('tone')} are an alert among the parts: in a tab, a sections page, a dialog.</li>
  <li><strong>Stat buttons</strong> write their ${c('field')} as it shows itself: money with its currency, hours with their digits, a date, a choice's label. ${c('unit')} or ${c('unitField')} puts words after the value; ${c('labelField')} takes the label from a field; ${c('secondField')} adds a second value, “12.5 / 21 Days”, or with ${c('secondLabel')} two values one over the other, each after its words. ${c('help')}, Flectra's ${c('help=')} on a smart button — "List view of operations" — is its tooltip, and what a screen reader says of it after its name (in the designer: Help, on pointing at it).</li>
  <li><strong>The statusbar</strong> takes ${c('invisible')} and ${c('roles')} as any part; ${c('durationsField')}, ${c('fold')} and ${c('saves')} as its widget does — see <a href="/fields/#options">the widgets' options</a>.</li>
  <li><strong>A key</strong>: a button's ${c('hotkey')}, a letter or a digit with ${c('shift+')} or not, presses it with Alt — Flectra's ${c('data-hotkey')}. It shows on the button while Alt is held and in its tooltip, and a screen reader is told it. The first button shown with a key wins; a dialog's own buttons take theirs over the page's; Alt+D, E and F are the browser's and refused.</li>
  <li><strong>On one line</strong>: a section's ${c('"style": "inline"')} lays its fields, words and buttons on one line, as Flectra's ${c('o_row')}, its title as the line's label; its fields are named for a screen reader without showing their labels, unless one sets ${c('labels')}.</li>
  <li><strong>A label over the title</strong>: ${c('title.label')}, as Flectra's “Product Name” over its name.</li>
</ul>

<h3 id="wizard">Wizards</h3>
${code(
  'json',
  `
{
  "type": "wizard", "id": "survey",
  "clickable": true,
  "nextLabel": "Continue", "backLabel": "Previous",
  "finishLabel": "Send my answers",
  "children": [
    { "type": "step", "id": "step-about", "label": "About you", "icon": "user",
      "children": [] },
    { "type": "step", "id": "step-extra", "label": "Your experience",
      "optional": true, "children": [] }
  ]
}`
)}
<p>${c('clickable')} lists the steps over the form: any step behind can be gone back to at once, and a step ahead only past steps that are complete — the first one with a problem stops the jump and shows it. An ${c('optional')} step offers Skip: its answers are then left out, and its required questions are not asked for, unless someone goes back to it and on.</p>

<h3 id="columns">Columns at each width</h3>
<p>${c('columns')} can give a count for each width of the form: ${c('wide')} above 760px, ${c('medium')} up to 760px, ${c('narrow')} up to 520px. A width left out stacks the way the skin does by itself — the outlined skin keeps its columns until the form is narrow, the underline skin, whose labels sit beside their values, stacks at medium. On a narrow form — a phone — every label goes above its value, the page's or a group's ${c('"labels": "beside"')} too, in every theme: the value has the whole width, never cut to <em>+20 100 912 4…</em>; a title gives its picture the line under it rather than break its words.</p>
${code('json', `{ "type": "section", "id": "header", "columns": { "wide": 2, "medium": 2 }, "children": [] }`)}

<h3 id="page-width">Page width, and where Save sits</h3>
<p>The page itself takes ${c('maxWidth')} — ${c('narrow')} (640px), ${c('medium')} (900px), ${c('wide')} (1180px, a sheet's own) or ${c('full')} — and ${c('actionsPosition')}: ${c('top')} or ${c('bottom')}. A page of responses anyone may send takes ${c('botCheck')}: a hidden box, the fewest seconds, a captcha's slot (<a href="/data/#bots">a public form's bot check</a>). A sheet keeps Save and Discard at the top unless told otherwise, a sections page at the bottom; a wizard keeps its own buttons.</p>
<p>And ${c('phone')}: how its phone fields read and show numbers the world over — ${c('{ "country": "EG", "shown": "national" }')}, the country a number typed without its + is read in, and whether one is shown at home's way or abroad's. Left out, a phone field is a text box. See <a href="/fields/#phone">phone numbers the world over</a>.</p>
<p>And ${c('timeZone')}: the time zone its dates and times are in, by its IANA name — ${c('"Africa/Cairo"')}, ${c('"Europe/Berlin"')} — shown and typed on that zone's clock wherever the person is, today being its day there. A date and time field may name its own. See <a href="/fields/#time-zones">time zones</a>.</p>
<p>And, on a record's page, ${c('duplicates')}: the fields records like the one typed are found by — ${c('{ "fields": ["name", "phone", "email", "vat"] }')} — asked of the data source as they are typed and as the record is saved (${c('"on": "type"')}, the default), or only as it is saved (${c('"on": "save"')}). Each match is said under the field it matched on, with Open it, "It's someone new" and Merge. See <a href="/data/#duplicates">possible duplicates</a>.</p>
<p>And ${c('records')}: what its records are called, so Fieldia's own sentences name them as your business does — <em>A customer with this phone already exists</em>, <em>17 customers imported</em>, <em>Are you sure you want to delete this customer?</em>, <em>New customer</em>, <em>1–10 of 1,284 customers</em> — where they said “record”, or no noun at all:</p>
${code('json', `{ "records": { "one": "customer", "other": "customers", "a": "a customer" }, "lowerLabels": true }`)}
<p>${c('one')} and ${c('other')} are the words for one and for more, as they stand inside a sentence. ${c('a')} is one with its article where the language puts one before it — <em>an invoice</em>: Fieldia never guesses an article, so a sentence that needs one says <em>A record</em> until it is given. The page's own ${c('lowerLabels')}, beside ${c('records')}, writes a field's label with a small first letter wherever one of Fieldia's sentences puts it after a word — <em>A customer with this phone already exists</em>, <em>Choose at least 2 for interests</em>, <em>Fix tax rate to see total</em>, <em>Not saved. Check: email</em> — while one that begins its sentence keeps its capital: <em>Phone is required</em>, <em>Status: nothing is called “Prospect”</em>. Off unless said, as only the page knows whether that is right: a label whose first word is a name (<em>IBAN</em>, <em>VAT number</em>, <em>WhatsApp</em>) stays as written, and so does every label in a language that writes its nouns with a capital, or has none. A page asks it with its records named or not, a survey too; a line's own dialog follows its record's page unless the line's own page says otherwise. Other languages come through ${c('translations')}, as the page's other words do. A related list says New, View all and None in the words its model's own page gives (<em>New invoice</em>, <em>View all invoices</em>, <em>No invoices yet.</em>). A language with no such sentence says its own plain one; a page without ${c('records')} reads as before.</p>
<p>A sheet or a sections page may give its own buttons at its ${c('footer')}, as a Flectra wizard does — ${c('Mark as Lost')} and ${c('Cancel')}. They stand in place of Save and Discard, and in a dialog or panel in place of Save &amp; Close and Discard. Each is a button like any other: once its steps saved, the dialog closes with the answers; a ${c('close')} step closes it without them; Ctrl+Enter presses the primary one.</p>

<h3 id="icons">Icons</h3>
<p>Sections, tabs, buttons, stat buttons, badges and steps take an ${c('icon')} by name. Fieldia draws these itself, as lines in the colour of the words beside them:</p>
${iconGrid}
<p>Add your own, or replace one, with the viewer's ${c('icons')} option: the inside of a 24×24 SVG, by name.</p>
${code(
  'ts',
  `
mountViewer(host, {
  page,
  dataSource,
  icons: { rocket: '<path d="M12 2c4 3 6 8 6 12H6c0-4 2-9 6-12z"/>' },
});`
)}

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
<p>Expressions read like Python: ${c('==')} ${c('!=')} ${c('<')} ${c('>')} ${c('<=')} ${c('>=')}, ${c('in')} and ${c('not in')} with a list — ${c("['draft', 'sent']")}, or Python’s tuple ${c("('draft', 'sent')")} as Flectra writes it — ${c('and')} ${c('or')} ${c('not')}, ${c('True')} ${c('False')} ${c('None')}, numbers and quoted strings. An empty value is false, and as in Python ${c('and')} and ${c('or')} give the value that decided: ${c('discount or 0')} is a number. Conditions are checked again on every change, and a hidden field's value is left out of what is saved or submitted.</p>
<p>A field's ${c('compute')} — a value worked out as people type — and ${c('setWhen')} use the same expressions, with arithmetic and <a href="#functions">functions</a>: ${c('round(x, 2)')}, ${c('age(birth_date)')}, ${c('addMonths(first_due, 1)')}, ${c("join(' ', first_name, last_name)")}, and over a table's lines ${c("sum(lines, 'amount')")} and ${c('count(lines)')}, each taking a condition on the lines in quotes: ${c(`count(requirement_ids, "state == 'done'")`)}. While what a value is worked out from holds text that does not read — "abc" in a line's Quantity — the value waits, a dash said in words (<em>Fix line 1 of Order lines to see Untaxed amount</em>), as the table's own total does: never an amount counting the value that text replaced. An amount your app works out as the lines change (read-only, from a source with an onchange) waits the same.</p>
<p>A ${c('setWhen')} acts as its condition starts to hold; with ${c('on')}, as one of those fields changes instead — Flectra's onchange: ${c(`{ "on": ["certification"], "when": "certification", "value": "'scoring_without_answers'" }`)} sets the scoring when Certification is ticked, and never as something else makes its condition hold. Its ${c('when')} may then be left out: set at every change.</p>
<p>A section's ${c('readonly')} locks every field inside it, sections within it too: a blocked customer's whole credit section, say.</p>
<p>Besides the page's fields, a condition reads ${c('id')}, the record's id — empty while it is new, so ${c('not id')} hides what only a saved record can do — and ${c('user')}, the person the app says is using the form: ${c('user.id')}, ${c('user.name')} and ${c('user.roles')}. A page's own field of the same name comes first. On a line — a worked-out value, a value set by a condition — ${c('parent')} is the record the line is on: ${c('parent.discount')}, ${c("parent.state == 'sale'")}. A link's filter may compare with any of these too, its ${c('valueFrom')} naming ${c('user.id')}, or on a line ${c('parent.company_id')}.</p>
<p>${c('roles')} shows a part only to people holding one of them, as Flectra's ${c('groups=')}; a role written with ${c('!')} hides it from people who hold that one. Any part takes them — a field, a section, a tab, a button, a stat button. The app names the person with the form's ${c('user')} option, ${c("{ id, name, roles }")}; without it they hold no role. Roles decide what a page shows, not what someone may do: the app's server checks that.</p>
${code('json', `{ "type": "button", "id": "lock", "label": "Lock", "action": "action_lock",
  "roles": ["sales_team.group_sale_manager"], "invisible": "not id" }`)}
<p>${c('context')} holds the values your app passes in, as Flectra's context: ${c("mountViewer(host, { page, context: { restricted_picking_type_code: 'incoming' } })")} — the same ${c('context')} option in React, Vue and Angular, and on ${c('createForm')}. A condition reads ${c("context.restricted_picking_type_code == 'incoming'")}, and a link's filter compares with one, ${c('{ "field": "code", "op": "=?", "valueFrom": "context.restricted_picking_type_code" }')} — with ${c('=?')}, left out when the app gives none. They are the app's values, never the page's: nothing saves them, a dialog the page opens reads the same ones, and a page's own field named ${c('context')} comes first. The designer's conditions read them too.</p>
<p>${c('editing')} says whether the record is being edited: false while a view shows it locked — the Edit switch before Edit is pressed, or the app's ${c('setReadonly(true)')}. ${c('"invisible": "not editing"')} is a part for editing only, Flectra's ${c('oe_edit_only')}, and ${c('"invisible": "editing"')} one for reading only; a form always being edited shows its editing parts. In the designer it is Shown while.</p>
<p>A condition that names a field the page does not have is refused when the page is checked, not when someone fills it in.</p>

<h2 id="functions">Functions, and your app's own</h2>
<p>Fieldia's own, by what they work on:</p>
<ul>
  <li><strong>Numbers.</strong> ${c('round(x, 2)')}, ${c('roundMoney(amount, currency)')} — to the currency's places, three for a dinar, none for a yen; the currency a code or a link to one —, ${c('min')}, ${c('max')}, ${c('abs')}, ${c("sum(lines, 'amount')")}, ${c('count(lines)')}, ${c("average(lines, 'price')")} or ${c('average(a, b, c)')}, the empty ones left out.</li>
  <li><strong>Dates.</strong> ${c('today()')} on the page's clock, ${c('days(from, to)')}, ${c('age(birth_date)')} in whole years, ${c('years(from, to)')}, ${c('months(from, to)')}, ${c('addDays(day, n)')}, ${c('addMonths(day, n)')} — 31 January and a month is 28 February, and ${c('months')} counts the same way —, ${c('addYears(day, n)')}. A date and time keeps its time.</li>
  <li><strong>Words.</strong> ${c("contains(email, '@gmail.')")}, ${c("startsWith(phone, '+20')")}, ${c('endsWith')}, whatever the case — ${c('contains')} also finds a value among choices ticked —, ${c('upper')}, ${c('lower')}, ${c("join(' ', first_name, last_name)")}, the empty ones left out, ${c('len')}.</li>
  <li><strong>Choosing.</strong> ${c('if(condition, a, b)')}, ${c('empty(phone)')} — zero and no are values —, ${c("firstOf(nickname, first_name, 'friend')")}.</li>
</ul>
<p>A function there is not, or given too many or too few values, is refused as the page is read. A value of a kind a function does not take — ${c('age(notes)')}: <em>age takes a date as its first value; "notes" is text</em> — is a warning, never a refusal: ${c('validatePage')} passes the page and says it in ${c('warnings')}, the designer as a fix to make, and the form runs it as before, the call giving nothing. A function given a value it cannot use gives nothing, never an error.</p>
<p>Your app gives its own with ${c('functions')}, on the viewer, ${c('createForm')}, the React, Vue and Angular components and the designer, and a page calls them by name. One that asks your server returns a promise: the value worked out from it shows an ellipsis while it is asked — <em>Working out Total…</em> —, is asked once for the same values, and is laid only on the record it was asked for; a save waits for it, and one whose answer did not come is asked again as the person saves.</p>
${code(
  'ts',
  `
mountViewer(host, {
  page,
  functions: {
    vatRate: { takes: [1, 1], values: ['text'], gives: 'number', call: (country) => RATES[country] ?? 0 },
    districtPrice: { asks: true, call: (district) => api.average(district) },   // a promise
  },
});`
)}

<h2 id="option-rules">Options that follow the answers</h2>
<p>An option may show only while a condition holds — written as a part's ${c('invisible')} — and a choice may offer the options picked in an earlier one, its own after them:</p>
${code(
  'json',
  `
"features": { "type": "selection", "label": "Features", "multiple": true, "options": [
  { "value": "garden", "label": "Garden", "invisible": "unit_type != 'villa'" },
  { "value": "lift",   "label": "Lift",   "invisible": "unit_type == 'villa'" } ] },
"again": { "type": "selection", "label": "Which would you have again?",
  "options": [{ "value": "none", "label": "None of them" }],
  "optionsFrom": { "field": "treatments" } }`
)}
<p>With ${c('"picked": false')}, the options left unpicked there; a <em>None of these</em> is never carried. A chosen option a change no longer offers is taken out of the answer and said under its field — <em>Garden is no longer offered, so it was taken out</em> — never silently kept; one a record held as it was opened stays, and is said to be no longer offered. In the designer: <strong>Show when…</strong> in an option's row, and <strong>Picked in another question</strong> among a choice's Choices.</p>

<h2 id="checking">Checking a page</h2>
${code(
  'ts',
  `
import { validatePage } from '@fieldia/core';

const checked = validatePage(json);
if (!checked.ok) console.log(checked.issues);   // [{ path: 'layout.children[0]...', message: '...' }]`
)}
<p>${c('validatePage')} checks the shape, key by key, that every id is unique, that every field a node or a condition names exists, and that every condition parses. Run it where pages are made and tested: in a designer, in your tests, in CI. The viewer runs the lighter ${c('checkPage')} as it shows a page — the page's outline, then the same names and conditions — and refuses a page that fails with the same list of issues; it leaves the validation library out of your app. For editors and other languages the format is also a JSON Schema: ${c('@fieldia/core/page.schema.json')}.</p>

<h2 id="versions">Versions: a page from an older Fieldia, or a newer one</h2>
<p>${c('"fieldia"')} says which format a page is written in. This Fieldia writes format ${c('"0.5"')} (${c('FORMAT_VERSION')}), and reads a page in 0.1, 0.2, 0.3 or 0.4 as it is; ${c('FORMAT_VERSIONS')} lists every format Fieldia has had. When a release changes what a page may say, the format gets a new version, and every reader of a page brings one in an older format up to date before anything else: ${c('checkPage')}, ${c('validatePage')}, ${c('createForm')}, the viewer and the saved forms placed in a page, and the designer, which then edits and saves it in the new format. That is ${c('upgradePage')}, which you can call yourself — say, to bring the pages your app keeps up to date as it loads them:</p>
${code(
  'ts',
  `
import { upgradePage } from '@fieldia/core';

const stored = await db.pages.get(id);
const page = upgradePage(stored); // the same object when it is already in the current format
if (page !== stored) await db.pages.put(id, page); // kept in the new format from now on`
)}
<p>A page in an older format is copied and brought up step by step — each step after its own format, in order — and the page you gave is never changed. A page newer than the Fieldia reading it is not guessed at: it is refused, with words that say so, where an older Fieldia would have named the first setting it did not know.</p>
${code('text', `fieldia: this page is in format 0.6, newer than this Fieldia reads (0.5): update Fieldia to show it`)}
<p><strong>How the format changes.</strong> A release that adds to what a page may say — a new setting, a new kind of part — makes a new format version; a page needs nothing rewritten, and ${c('upgradePage')} writes the new version in it. A release that renames or reshapes a setting also adds a step to ${c('PAGE_UPGRADES')}: what changed, in plain words, the rewrite, and a page before and after it, which Fieldia's tests run, so no step goes untested. Format 0.1 is the first: it grew from Fieldia 0.1 to 0.20 under one version. Format 0.2 came with Fieldia 0.22, 0.3 with 0.24 (a time zone, phones, booking slots, a list's totals, periods, Export and Edit, a box's autofill purpose, a public page's bot check), 0.4 with 0.25 (a record's related lists, a list's cards, gallery, columns people shape, rows' own tones and buttons, Import and Print, a page's print look and its possible duplicates), and 0.5 with 0.26 (what a page calls its records and its labels written small inside a sentence, a tab counting a related list, a related list opening the app's own way, a part left off paper, a key to what rows' tones and bold mean); each only added, so no step has been needed yet. From 0.21, the release tool refuses to publish a format whose shape changed under its old version. What each release changed is in the <a href="https://github.com/fieldia-dev/fieldia/blob/main/CHANGELOG.md">changelog</a>.</p>
`,
};
