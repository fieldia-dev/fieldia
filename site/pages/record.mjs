import { c, code } from '../layout.mjs';

export default {
  path: '/record/',
  title: 'Around a record',
  description: 'What sits around one record: the gear menu with Archive, Duplicate, Delete, Print and your server actions; the pager and the breadcrumbs your app gives; the records that point at it, listed inside it; the attachment beside the sheet; and the chatter beside it on any screen it fits.',
  body: `
<p class="lead">A record sheet sits in more than its card. Over it, Flectra's control panel: the breadcrumbs back to the list, the gear menu, and the pager — “3 / 42”. Beside it, the record's main attachment and its conversation. The page says what the menu holds; your app gives the records round this one and the trail to it.</p>

<p>The <a href="/demos/plain/?page=vendor-bill&amp;record=3&amp;skin=underline">Vendor bill</a> demo, in each framework, shows all of it.</p>

<h2 id="toolbar">The sheet's ${c('toolbar')}</h2>
${code(
  'json',
  `
{
  "type": "sheet", "id": "sheet",
  "toolbar": {
    "menu": [
      { "id": "m-print", "label": "Invoice", "group": "print", "action": "print_invoice" },
      { "id": "m-debit", "label": "Debit Note", "action": "action_debit_note", "invisible": "state != 'posted'" },
      { "id": "m-archive", "builtin": "archive" },
      { "id": "m-unarchive", "builtin": "unarchive" },
      { "id": "m-duplicate", "builtin": "duplicate" },
      { "id": "m-delete", "builtin": "delete", "roles": ["account.group_account_manager"] }
    ],
    "pager": true,
    "breadcrumbs": true
  },
  "children": []
}`
)}
<p>Each item of ${c('menu')} is pressed like a button: its ${c('steps')}, then its ${c('action')}, asking its ${c('confirm')} first; it shows by ${c('invisible')} and ${c('roles')}. ${c('"group": "print"')} puts it under Print, as Flectra's reports. A ${c('builtin')} item needs no words or steps of its own:</p>
<table>
  <thead><tr><th>Built-in</th><th>What it does</th></tr></thead>
  <tbody>
    <tr><td>${c('archive')} · ${c('unarchive')}</td><td>Asks first, then archives through your data source's ${c('archive')}, or your app's action ${c('archive')}; the record is loaded again. Archive shows while the record's ${c('active')} is not false, Unarchive while it is.</td></tr>
    <tr><td>${c('duplicate')}</td><td>Saves what changed, copies the record through ${c('copy')} — or your action ${c('duplicate')}, answering with the copy's ${c('record')} — and shows the copy.</td></tr>
    <tr><td>${c('delete')}</td><td>Asks first, then deletes through ${c('delete')}, or your action ${c('delete')}. The pager moves to the next record; with none left, the breadcrumbs go back; else the form starts a new one.</td></tr>
  </tbody>
</table>
<p>Give a built-in steps of its own and they run instead, without its question: Flectra's employee form, whose Archive opens the departure wizard, is ${c('{ "id": "m-archive", "builtin": "archive", "steps": [{ "do": "open", "page": "hr-departure-wizard", "record": "id" }] }')}. The same steps — ${c('archive')}, ${c('unarchive')}, ${c('duplicate')}, ${c('delete')} — run from any button or moment, as <a href="/actions/#steps">Actions</a> says.</p>
<p>Where the record's data source says the person may not archive, duplicate or delete it (${c('can')}, see <a href="/data/#permissions">what this person may do</a>), those items are not in the menu, nor the buttons whose steps would do it; the menu's foot says why, and the steps refuse if run from elsewhere.</p>

<h2 id="head">A work item's head</h2>
<p>A sheet's ${c('head')} draws the record as a work tracker draws a bug: its kind's strip of colour along the start edge and a badge — the kind's icon, its name in capitals, the record's number — over the title; the number before the title, with Copy title at its end while it is pointed at or focused; a row of people and counts under it, the record's buttons at its end; then a band of fields, their labels beside them, “Updated by” and the tabs at its end. The classic header bar, statusbar, badges and stat buttons give way to it; the gear menu is its ⋮.</p>
${code(
  'json',
  `
{
  "type": "sheet", "id": "bug",
  "title": { "field": "title", "before": [{ "type": "field", "id": "t-number", "field": "number" }] },
  "head": {
    "kind": { "field": "work_type", "numberField": "number",
      "looks": { "bug": { "colour": "#cc293d", "icon": "bug" }, "task": { "colour": "#f2cb1d", "icon": "task" } } },
    "meta": [
      { "type": "field", "id": "h-assigned", "field": "assigned_to", "placeholder": "No one selected" },
      { "type": "link", "id": "h-comments", "icon": "chat", "field": "comment_count",
        "words": { "one": "Comment", "other": "Comments" }, "target": "g-discussion" }
    ],
    "actions": [
      { "type": "button", "id": "b-save-close", "label": "Save and Close", "icon": "save", "primaryWhenChanged": true,
        "steps": [{ "do": "save" }, { "do": "close" }], "menu": [{ "id": "m-save", "label": "Save", "steps": [{ "do": "save" }] }] },
      { "type": "button", "id": "b-follow", "label": "Follow", "pressedLabel": "Following", "pressed": "following",
        "icon": "eye", "action": "follow", "menuIcon": "gear", "menuLabel": "Notification settings",
        "menu": [{ "id": "m-all", "label": "All changes", "action": "follow-all" }] },
      { "type": "button", "id": "b-undo", "label": "Revert changes", "icon": "undo", "iconOnly": true, "steps": [{ "do": "reset" }] }
    ],
    "band": { "tracks": ["274px", "1fr"], "labelWidth": 76, "children": [
      { "type": "field", "id": "f-state", "field": "state", "widget": "dot", "hotkey": "e" },
      { "type": "field", "id": "f-reason", "field": "reason", "readonly": true, "readonlyReason": "Set by the workflow" }
    ] },
    "updated": { "byField": "changed_by", "atField": "changed_date", "opens": "t-history" }
  },
  "children": [{ "type": "tabs", "id": "tabs", "place": "head", "children": [
    { "type": "tab", "id": "t-details", "label": "Details", "children": [] },
    { "type": "tab", "id": "t-history", "label": "History", "icon": "history", "iconOnly": true, "children": [] },
    { "type": "tab", "id": "t-links", "label": "Links", "icon": "link", "iconOnly": true, "count": "related", "children": [] }
  ] }]
}`
)}
<ul>
  <li>A button takes ${c('iconOnly')} (its label its name and tooltip), ${c('pressed')} with ${c('pressedLabel')} for a toggle, ${c('menu')} for a split button — or a menu button with no steps of its own — and ${c('primaryWhenChanged')}: quiet but usable with nothing changed, when Save and Close simply closes. Undo with nothing to put back says “Nothing has changed.”</li>
  <li>Your app answers Follow with ${c('{ stored: { following: true } }')}: values the server keeps, written as loaded ones are, never a change to save — ${c('form.setValues(values, { stored: true })')} does the same.</li>
  <li>A field's ${c('hotkey')} underlines that letter of its label; Alt with it takes the focus there. The page's ${c('"lockAt": "value"')} puts a locked field's lock at its value's start.</li>
  <li>${c('"place": "head"')} puts the sheet's tabs at the band's end, their panels as the body; a tab's ${c('count')} shows in a pill and in its name, “Links, 0”.</li>
  <li>In ${c("openFormDialog({ size: 'inset', backdrop: 'clear', maximise: true, resizable: true })")} the head is the dialog's own: no title bar or foot, its ⤢ and × at the badge row's end, Escape and × asking before changes go.</li>
</ul>
<p><a href="/demos/plain/?page=wi-head&amp;open=dialog">Try a bug in a large popup</a>.</p>

<h2 id="pager">The pager and the breadcrumbs: your app's</h2>
${code(
  'ts',
  `
const viewer = mountViewer(host, {
  page, dataSource, recordId: 7,
  // The list it was opened from: their ids in order…
  records: [3, 7, 12, 19],
  // …or how many there are, where this one is, and the id at a place.
  // records: { total: 42, at: 2, id: (at) => api.idAt(at) },
  breadcrumbs: [{ label: 'Vendor bills', open: () => router.back() }],
});
viewer.on('open', ({ recordId }) => router.replace(\`/bills/\${recordId}\`));`
)}
<p>The pager says where the record is, “2 / 4”, and goes round from the last to the first. Moving saves what changed first, as Flectra does; a refused save keeps the record. Alt+P and Alt+N press its buttons. A copy joins the records after the one it was made from; a deleted record leaves them. The form shows the other record in place — ${c('form.openRecord(id)')} — and its ${c('open')} event says which: in React ${c('onRecord')}, in Vue ${c('@record')}, in Angular ${c('(record)')}, beside ${c('onArchive')}, ${c('onDuplicate')} and ${c('onDelete')}.</p>
<p>The breadcrumbs are a ${c('nav')}: each page before the record a link — ${c('href')} or ${c('open')} — and the record last, by its title field, with ${c('aria-current="page"')}. A page a step opens in the record's place adds the record to the trail, as the way back. ${c('"pager": false')} or ${c('"breadcrumbs": false')} keeps them away even when your app gives them.</p>
<p>In a dialog there is no pager and no trail: they belong to the record under it. The gear menu still shows. On a phone the gear keeps only its picture and the trail folds to the page before this one, an arrow back.</p>

<h2 id="related">Related records inside it</h2>
<p>A customer's invoices, a property's viewings, an employee's leave requests: another model's records that point at this one, listed inside it — in a group, a tab, or straight in the sheet — a page at a time, searched, sorted and counted.</p>
${code(
  'json',
  `
{
  "type": "related", "id": "invoices", "title": "Invoices",
  "model": "invoice", "field": "partner_id",
  "fields": {
    "name": { "type": "char", "label": "Number" },
    "invoice_date": { "type": "date", "label": "Invoice date" },
    "state": { "type": "selection", "label": "Status",
               "options": [{ "value": "sent", "label": "Sent" }, { "value": "paid", "label": "Paid" }] },
    "currency_id": { "type": "many2one", "label": "Currency", "relation": "currency" },
    "amount": { "type": "monetary", "label": "Amount", "currencyField": "currency_id" }
  },
  "columns": ["name", "invoice_date", "state", "amount"],
  "cells": { "state": { "widget": "dot", "options": { "tones": { "paid": "success" } } }, "amount": { "total": "sum" } },
  "filter": [{ "field": "company_id", "op": "=", "valueFrom": "company_id" }],
  "sort": [{ "field": "invoice_date", "desc": true }],
  "limit": 5,
  "viewAll": { "page": "invoices", "as": "page" }
}`
)}
<ul>
  <li><strong>Its records</strong> are those of ${c('model')} whose ${c('field')} — their link to this record — is this record, and that ${c('filter')} lets through, a ${c('valueFrom')} read from this record. Your data source's ${c('list')} answers, with ${c('{ field: "partner_id", op: "=", value: 1 }')} first among its conditions: nothing new to write. Without ${c('list')}, the part is not shown.</li>
  <li><strong>Its columns</strong> are fields of its own ${c('fields')} — text, numbers, money, yes or no, dates, choices and links — drawn by the list's own table: a state's dot, a phone as people read it, a column's total under it (with your source's ${c('totals')}).</li>
  <li><strong>A page at a time</strong>: ${c('limit')} rows, 5 unless said. Its title says how many there are; past a page, a pager and a search box show, and its headers put it in order.</li>
  <li><strong>A row</strong> opens its record in a dialog, with the page your app's ${c('pages')} gives for ${c('model')}; <strong>New</strong> opens a new one there, its ${c('field')} filled in with this record, and lists it once saved. Where your app gives no page for the model, neither is offered; ${c('"create": false')} offers no New.</li>
  <li><strong>View all</strong> opens the page ${c('viewAll')} names — your app's list of those records — showing this record's alone: in a dialog, a side panel (${c('"as": "panel"')}) or this page's place (${c('"as": "page"')}), or your own way, through ${c('onOpen')}, whose request carries the conditions as ${c('filter')} for your router.</li>
  <li><strong>Before the record's first save</strong> nothing points at it: the part says so, with no New.</li>
  <li><strong>Another record shown</strong> — the pager, a reload, Discard — its records are asked again; an answer for the one before is drawn in none.</li>
</ul>
<p>In the designer, a <strong>Related list</strong> is among the toolbox's records on a record's page: its panel sets its title, the model and link, its columns, its rows a page, New and View all. <a href="/demos/plain/?page=customer-account&amp;record=1&amp;skin=underline">Try a customer with its invoices and quotations</a>, or <a href="/demos/plain/?page=property&amp;record=1&amp;skin=underline">a property with its viewings</a>.</p>

<h2 id="preview">The attachment beside the sheet</h2>
${code(
  'json',
  `
{ "type": "sheet", "id": "sheet", "attachmentPreview": {}, "children": [] }`
)}
<p>Flectra's ${c('o_attachment_preview')}: the record's main attachment, a PDF in the browser's own viewer or a picture, beside the sheet on a wide form and under it on a narrow one, with Previous and Next through several and Open. ${c('{ "field": "invoice_pdf" }')} shows a file field's file; left out, the record's attachments come from your data source's ${c('attachments')} — asked again when the form shows another record, and after a save. It hides while there is nothing to show. With the conversation's own files:</p>
${code(
  'ts',
  `
import { chatterAttachments } from '@fieldia/chatter';

mountViewer(host, { page, dataSource: { ...dataSource, attachments: chatterAttachments(source) } });`
)}

<h2 id="chatter">The chatter beside it</h2>
<p>As Flectra's chatter, the side panel sits beside the sheet on a form 1534px wide or more, the page growing by its width so the sheet keeps its own; on a narrower one it goes under the sheet, which takes the whole width. ${c('"sidePanelBeside": "always"')} keeps it beside, narrower, down to 600px, the sheet's columns stacking inside it as they need. A grid of many columns beside it can ${c('"fit": "shrink"')}: its columns go narrower, their headers wrapping, before it scrolls.</p>
<p>A ${c('post')} step puts words in the record's conversation — ${c('{ "do": "post", "message": "Lost: {lost_reason}" }')}, a note unless ${c('"kind": "message"')} — and so does your app's answer, ${c('{ post: "Debit note DN/0001 made" }')}. In a page opened over the record, such as the Mark as Lost wizard, it posts in the record's conversation. The chatter fetches again after a save and after the record is loaded again, so what your server posts — tracked changes, a server action's note — shows.</p>

<h2 id="controllers">Flectra's own form controllers</h2>
<p>Flectra pages with a ${c('js_class')} (account_move_form, crm_form, hr_employee_form…) carry JavaScript of their own. Fieldia does not copy them; what they did is data here, or your app's:</p>
<ul>
  <li><strong>An Archive that opens a wizard</strong> (hr_employee_form): a built-in item with its own steps.</li>
  <li><strong>A probability that follows the stage, a won stage</strong> (crm_form): your data source's ${c('onchange')} and your server's.</li>
  <li><strong>Quick edit of an invoice</strong> (account_move_form): the form is editable as it is; a lock by state is ${c('readonly')} on the sheet's parts.</li>
  <li><strong>Anything else at a moment</strong>: the page's ${c('on')} steps, and a ${c('call')} of your app's action, whose answer can set values, post, reload, open a page or show another record.</li>
</ul>
`,
};
