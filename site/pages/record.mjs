import { c, code } from '../layout.mjs';

export default {
  path: '/record/',
  title: 'Around a record',
  description: 'What sits around one record: the gear menu with Archive, Duplicate, Delete, Print and your server actions; the pager and the breadcrumbs your app gives; the attachment beside the sheet; and the chatter beside it on any screen it fits.',
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
    <tr><td>${c('print')}</td><td>Under Print, as <em>This record</em>: the record on paper, alone, as <a href="#print">the page prints</a>.</td></tr>
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
<p>Every page prints — Ctrl+P, the browser's menu, or the page's own Print — as a clean page: every tab one after another under its name, every wizard step and folded group open (but what a condition hides); no buttons, bars, gear, pager or help; each box written as the words a person reads in it — a choice by its label, a link by its name, money with its currency, a date on the page's clock — wrapping rather than cut; a table of lines whole, its header again on each sheet, a grid's every line and column; nothing cut across two sheets; light colours, the theme's accent kept for the headings; the page's language and direction. Over it, the record's title and the day it was printed; with the page's ${c('print')}, your logo and words over it and words under it, each ${c('{field}')} showing its value:</p>
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
    "children": []
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
<p>${c('file')} takes your server's ${c('url')}, its ${c('data')} as base64, or its ${c('bytes')}. The print rules are in every page's sheet — about 1.3 KB gzipped — so a print the browser lays out by itself gets them too; what a stylesheet cannot do (drawing a tab never opened, writing a box's words) is done at the window's ${c('beforeprint')} and undone at ${c('afterprint')}. <a href="/demos/plain/?page=real-invoice&amp;record=4102&amp;skin=underline">Print an invoice</a>, or a <a href="/lists/#print">list of them</a>.</p>

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
