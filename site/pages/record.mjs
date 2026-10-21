import { SIZES } from '../facts.mjs';
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
    <tr><td>${c('print')}</td><td>Under Print, as <em>This record</em> (<em>This invoice</em> where the page names its records): the record on paper, alone, as <a href="#print">the page prints</a>.</td></tr>
  </tbody>
</table>
<p>A line between items is ${c('{ "type": "divider", "id": "m-rule" }')}, left out where nothing shows on one side of it. An item with a ${c('menu')} of its own opens it beside it, shown with ›: pointed at, pressed, or with Enter, Space or → (← right to left); ← and Escape close it. With ${c('menuFrom')}, your app gives more items as the menu opens — a bug's templates, which depend on the bug — through its ${c('onAction')}, asked with that action's name, the item's ${c('params')}, the record and its values, and answering ${c('{ menu: [...] }')}; each runs its steps, then its action, asking its ${c('confirm')} first. An item whose menu has nothing to show is not shown. A button's own ${c('menu')} takes both too.</p>
${code(
  'json',
  `
{ "id": "m-templates", "label": "Templates", "menuFrom": "templates",
  "menu": [{ "id": "m-capture", "label": "Capture…", "action": "capture-template" }, { "id": "m-rule-t", "type": "divider" }] }`
)}
<p>Give a built-in steps of its own and they run instead, without its question: Flectra's employee form, whose Archive opens the departure wizard, is ${c('{ "id": "m-archive", "builtin": "archive", "steps": [{ "do": "open", "page": "hr-departure-wizard", "record": "id" }] }')}. The same steps — ${c('archive')}, ${c('unarchive')}, ${c('duplicate')}, ${c('delete')} — run from any button or moment, as <a href="/actions/#steps">Actions</a> says.</p>
<p>Where the record's data source says the person may not archive, duplicate or delete it (${c('can')}, see <a href="/data/#permissions">what this person may do</a>), those items are not in the menu, nor the buttons whose steps would do it; the menu's foot says why, and the steps refuse if run from elsewhere.</p>

<h2 id="head">A work item's head</h2>
<p>A sheet's ${c('head')} draws the record as a work tracker draws a bug: its kind's strip of colour along the start edge and a badge — the kind's icon, its name in capitals, the record's number — over the title; the number before the title, with Copy title at its end while it is pointed at or focused — a long title wrapping onto more lines where it is too long for its line, read from its start and never cut, its words whole — only a word longer than the line, a web address, is broken — one line all the same (Enter adds none); a row of people and counts under it, the record's buttons at its end; then a band of fields, their labels beside them, “Updated by” and the tabs at its end. The classic header bar, statusbar, badges and stat buttons give way to it; the gear menu is its ⋮.</p>
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
  <li>Tags in the row — a ${c('many2many')} drawn as tags, with ${c('"adder": "button"')} or its box — sit inline after the comments' link, what adds one after the last chip; out of room, the chips wrap in a slot of their own and the row's other parts keep its first line.</li>
  <li>A button takes ${c('iconOnly')} (its label its name and tooltip), ${c('pressed')} with ${c('pressedLabel')} for a toggle, ${c('menu')} for a split button — or a menu button with no steps of its own — and ${c('primaryWhenChanged')}: quiet but usable with nothing changed, when Save and Close simply closes. Undo with nothing to put back says “Nothing has changed.”</li>
  <li>Your app answers Follow with ${c('{ stored: { following: true } }')}: values the server keeps, written as loaded ones are, never a change to save — ${c('form.setValues(values, { stored: true })')} does the same.</li>
  <li>A field's ${c('hotkey')} underlines that letter of its label; Alt with it takes the focus there. The page's ${c('"lockAt": "value"')} puts a locked field's lock at its value's start.</li>
  <li>${c('"place": "head"')} puts the sheet's tabs at the band's end, their panels as the body; a tab's ${c('count')} shows in a pill and in its name, “Links, 0” — a field's, or the records of a related list in the tab (${c('{ "related": "links" }')}, <a href="#related">below</a>).</li>
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
  <li><strong>On a phone</strong>, with ${c('card')}, its rows are cards, as a list's are (${c('"card": { "title": "name", "status": "state", "fields": ["amount"] }')}, ${c('{}')} for the columns'): a title, a status pill in its column's tones, a few lines, each a field of its own ${c('fields')}; a card is its row, pressed to open its record. On paper its rows as shown, a table, and how many of how many where they run past a page: "5 of 23".</li>
  <li><strong>Its rows' own rules</strong>: ${c('rowTones')}, ${c('rowBold')} and ${c('rowButtons')}, as a list's, each read on the row's own record — its fields, ${c('id')}, ${c('user')} and ${c('context')}, never this record's — a row's button run with that one record (${c('recordIds')}) while this record is shown, then its records asked again: an overdue invoice in red, Send a reminder on one sent.</li>
  <li><strong>A page at a time</strong>: ${c('limit')} rows, 5 unless said. Its title says how many there are; past a page, a pager and a search box show, and its headers put it in order.</li>
  <li><strong>A row</strong> opens its record in a dialog, with the page your app's ${c('pages')} gives for ${c('model')}; <strong>New</strong> opens a new one there, its ${c('field')} filled in with this record, and lists it once saved. Where your app gives no page for the model, neither is offered; ${c('"create": false')} offers no New.</li>
  <li><strong>Your app's own way</strong>, with ${c('"open": "app"')}: a row and New go through your ${c('onOpen')} first (or your host's ${c('open')}), as View all does — ${c("{ page: 'quotation', as: 'dialog', recordId: 7 }")} for a row, ${c("{ page: 'quotation', as: 'dialog', recordId: null, values: { partner_id: { id: 1, label: 'Nile Traders' } } }")} for New, this record filled in through the values — ${c('page')} being the id of the page your app gives for the model, else the model's name. Answer with how it ended (your router's page: a promise that never settles), or ${c('undefined')} for the dialog after all; the list asks for its records again once it settles. Rows and New are offered where your app gives a page for the model or a way of its own.</li>
  <li><strong>View all</strong> opens the page ${c('viewAll')} names — your app's list of those records — showing this record's alone: in a dialog, a side panel (${c('"as": "panel"')}) or this page's place (${c('"as": "page"')}), or your own way, through ${c('onOpen')}, whose request carries the conditions as ${c('filter')} for your router. Its list says what it is kept to as chips over it — <em>Customer: Nile Traders</em> — which a person may take away for every record; your route hands them on from ${c('request.search')} as the list's ${c('listSearch')}.</li>
  <li><strong>Before the record's first save</strong> nothing points at it: the part says so, with no New.</li>
  <li><strong>Another record shown</strong> — the pager, a reload, Discard — its records are asked again; an answer for the one before is drawn in none.</li>
  <li><strong>Counted on its tab</strong>: a tab holding it may count its records, ${c('"count": { "related": "quotations" }')} by its id — “Quotations 4”, read out “Quotations, 4”. Your source's ${c('list')} is asked for one record, with the list's own conditions, as the record is shown, whether the tab is open or not, and the count is its ${c('total')}; the list's own count after New, a delete or a row's button stands for it then. None is shown until it is known: before the answer, before the record's first save, while the list is hidden.</li>
</ul>
<p>In the designer, a <strong>Related list</strong> is among the toolbox's records on a record's page: its panel sets its title, the model and link, its columns, its cards on a phone, its rows a page, New, where rows and New open, and View all; a tab's <strong>Count from</strong> offers the related lists in it. <a href="/demos/plain/?page=customer-account&amp;record=1&amp;skin=underline">Try a customer with its invoices and quotations</a>, or <a href="/demos/plain/?page=property&amp;record=1&amp;skin=underline">a property with its viewings</a>.</p>

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

<h2 id="print">On paper</h2>
<p>Every page prints — Ctrl+P, the browser's menu, or the page's own Print — as a clean page: every tab one after another under its name, every wizard step and folded group open (but what a condition hides); no buttons, bars, gear, pager, a tab's count or help; each box written as the words a person reads in it — a choice by its label, a link by its name, money with its currency, a date on the page's clock, a work item's title — wrapping rather than cut; a table of lines whole, broken between its lines with its header again on each sheet, a grid's every line and column in the order the person sees them; groups side by side as the page sets them, a sheet breaking between any two of them; nothing cut across two sheets, and no tab's name, group's title or table's header left alone at a sheet's foot — it goes on with the start of what follows it; no required star; a number, an amount, a day or a phone number in a table's cell on one line; light colours, the theme's accent kept for the headings; the page's language and direction. Over it, the record's own name — its sheet's title field, else its ${c('name')}, else its first line of text, on a sheet or a page of sections alike: <em>SA-2026-014</em>; with none yet, what the page calls its records and its stage, <em>Invoice · Draft</em> — and the day it was printed; with the page's ${c('print')}, your logo and words over it and its footer under every sheet — nothing runs under it — each ${c('{field}')} showing its value, and a line whose value is empty left out whole. A tab, a group, a field or a related list marked ${c('"print": false')} is left out, as an invoice's journal items. With a dialog or a panel open over the page, its form alone prints — what a person printing looks at — never the page behind it:</p>
${code(
  'json',
  `
{
  "print": {
    "header": "Zamalek Office Supplies S.A.E.\\n26 July Street, Zamalek, Cairo",
    "footer": "Pay by bank transfer, quoting {name}. Thank you for your business.",
    "logo": "https://example.com/logo.svg"
  },
  "layout": {
    "type": "sheet", "id": "sheet",
    "toolbar": { "menu": [
      { "id": "m-print", "builtin": "print" },
      { "id": "m-pdf", "label": "Invoice", "group": "print", "action": "print_invoice" }
    ] },
    "children": [
      { "type": "tabs", "id": "notebook", "children": [
        { "type": "tab", "id": "lines", "label": "Invoice Lines", "children": [] },
        { "type": "tab", "id": "journal", "label": "Journal Items", "print": false, "children": [] }
      ] }
    ]
  }
}`
)}
<p>The built-in ${c('print')} item, under Print as <em>This record</em> — or a ${c('{ "do": "print" }')} step, or ${c('viewer.print()')} — prints the record alone, the page round it in your app left out. An item under Print may run your action instead; answer it with the file your server made, and it opens over the record in the browser's own PDF viewer, with Download — or is saved, with ${c('show: "download"')}:</p>
${code(
  'ts',
  `
onAction: async ({ action, recordId }) => {
  if (action !== 'print_invoice') return;
  const answer = await fetch(\`/report/invoice/\${recordId}.pdf\`);
  return { file: { name: 'INV_2026_0042.pdf', type: 'application/pdf', bytes: await answer.blob() } };
}`
)}
<p>${c('file')} takes your server's ${c('url')}, its ${c('data')} as base64, or its ${c('bytes')}. What a stylesheet cannot do (drawing a tab never opened, writing a box's words, measuring the room a heading keeps under it for the start of what follows) is done at the window's ${c('beforeprint')} and undone at ${c('afterprint')}. <a href="/demos/plain/?page=real-invoice&amp;record=4102&amp;skin=underline">Print an invoice</a>, or a <a href="/lists/#print">list of them</a>.</p>
<p>All of it comes in a part of its own — ${c('fieldia.print.js')}, ${SIZES.print} KB gzipped, a chunk of its own in your app's bundle — only as a person means to print, so a page no one prints never loads it. ${c('Ctrl+P')} (⌘P) is Fieldia's: held back the first time while the part comes, then the page laid out whole and the browser's print asked. Every Print waits for it. It is fetched, and nothing printed, as the gear opens with Print in it or a pointer rests on a Print button, and once a page meant for paper is drawn — its own ${c('print')} words, a list's ${c('"print": true')} — when the browser is idle. The browser's own menu is the one print no page can hold back: before the part came, it prints a plain look — the page as the screen shows it, without buttons, bars or hints, in light colours — and asks for the part, so every print after is whole. To have the whole look from the first moment, ${c('printPart.load()')} as your app starts.</p>

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
