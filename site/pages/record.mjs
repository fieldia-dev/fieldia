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
  </tbody>
</table>
<p>Give a built-in steps of its own and they run instead, without its question: Flectra's employee form, whose Archive opens the departure wizard, is ${c('{ "id": "m-archive", "builtin": "archive", "steps": [{ "do": "open", "page": "hr-departure-wizard", "record": "id" }] }')}. The same steps — ${c('archive')}, ${c('unarchive')}, ${c('duplicate')}, ${c('delete')} — run from any button or moment, as <a href="/actions/#steps">Actions</a> says.</p>

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

<h2 id="chatter">The chatter beside it</h2>
<p>The side panel goes under the sheet once the form is narrower than 1000px. ${c('"sidePanelBeside": "always"')} keeps it beside, narrower, down to 600px, the sheet's columns stacking inside it as they need. A grid of many columns beside it can ${c('"fit": "shrink"')}: its columns go narrower, their headers wrapping, before it scrolls.</p>
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
