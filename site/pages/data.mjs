import { c, code } from '../layout.mjs';

export default {
  path: '/data/',
  title: 'Data sources',
  description: 'Connect Fieldia to your backend: the methods of a data source, what each receives, and an adapter for a REST API.',
  body: `
<p class="lead">Fieldia has no backend of its own. A page's records and responses travel through a <em>data source</em>: an object your app writes, with up to eight methods. Implement only the ones your pages use.</p>

${code(
  'ts',
  `
interface DataSource {
  load?(request: LoadRequest): Promise<Values | LoadedRecord>; // read a record: its values, or with its version and rights
  save?(request: SaveRequest): Promise<SaveResult>;          // create or update it
  onchange?(request: OnchangeRequest): Promise<OnchangeResult>;  // recalculate after a change
  search?(request: SearchRequest): Promise<RelatedRecord[]>; // find records to link to
  create?(request: CreateRequest): Promise<RelatedRecord>;   // make one from a typed name
  submit?(request: SubmitRequest): Promise<SubmitResult>;    // store one response
  list?(request: ListRequest): Promise<ListResult>;          // a page of records, for a list
  groups?(request: GroupRequest): Promise<Group[]>;          // a list's groups and their counts
  totals?(request: TotalsRequest): Promise<TotalsResult>;    // a list's sums: under it, per group, the rows ticked
  options?(request: OptionsRequest): Promise<Option[]>;      // a selection's choices from the app
  definitions?(request: OptionsRequest): Promise<PropertyDefinition[]>;  // properties a linked record keeps
  saveDefinitions?(request: OptionsRequest & { definitions }): Promise<void>; // one added in place
  archive?(request: ArchiveRequest): Promise<void>;          // archive a record, or bring it back
  copy?(request: RecordRequest): Promise<SaveResult>;        // duplicate it: the copy's id
  delete?(request: RecordRequest): Promise<void>;            // delete it
  attachments?(request: RecordRequest): Promise<FileValue[]>; // its files, the main one first
  upload?(file: UploadFile, request: UploadRequest): Promise<UploadedFile>; // store one file as it is picked
  writeMany?(request: WriteManyRequest): Promise<WriteManyResult>; // one value in many records: a list's Edit
  exportRecords?(request: ExportRequest): Promise<ExportedFile | { message } | false>; // a list's export, on the server
}`
)}

<div class="table-scroll">
<table>
  <thead><tr><th>Method</th><th>Called when</th><th>Needed for</th></tr></thead>
  <tbody>
    <tr><td>${c('load')}</td><td>A record page opens with a ${c('recordId')}</td><td>Editing an existing record</td></tr>
    <tr><td>${c('save')}</td><td>Someone presses Save (or autosave fires)</td><td>Record pages</td></tr>
    <tr><td>${c('onchange')}</td><td>A value changes, so the backend can fill in others</td><td>Totals, defaults that depend on other fields</td></tr>
    <tr><td>${c('search')}</td><td>Someone types in a many2one, many2many or reference</td><td>Links to other records</td></tr>
    <tr><td>${c('create')}</td><td>Someone picks <em>Create “…”</em> in a link field</td><td>Making a record without leaving the page</td></tr>
    <tr><td>${c('submit')}</td><td>Someone sends a responses page</td><td>Surveys, sign-ups</td></tr>
    <tr><td>${c('list')}</td><td>A list opens, is searched, sorted or paged</td><td>Lists of records — see <a href="/lists/#data">lists</a></td></tr>
    <tr><td>${c('groups')}</td><td>A list is grouped by a field, or a date by its month, quarter, week, day or year</td><td>Group By — see <a href="/lists/#totals">lists that add up</a></td></tr>
    <tr><td>${c('totals')}</td><td>A list totals a column: as it is searched, grouped, and as rows are ticked</td><td>A totals row, sums on each Group By heading, the sum of the rows ticked — see <a href="/lists/#totals">lists that add up</a>; without it, none shows</td></tr>
    <tr><td>${c('definitions')}</td><td>A properties field with ${c('definitionsFrom')} is shown, and again when the link it follows changes</td><td>Properties a linked record defines — see <a href="/fields/#business">business widgets</a></td></tr>
    <tr><td>${c('saveDefinitions')}</td><td>Someone adds a property in place</td><td>Keeping it on that record</td></tr>
    <tr><td>${c('archive')} · ${c('copy')} · ${c('delete')}</td><td>The gear menu's Archive, Unarchive, Duplicate or Delete, or those steps, run</td><td>The record's own operations — without one, your app's action of the step's name is called. See <a href="/record/#toolbar">Around a record</a></td></tr>
    <tr><td>${c('attachments')}</td><td>A sheet that shows the record's attachment beside it opens a record</td><td>The PDF or picture beside the sheet</td></tr>
    <tr><td>${c('writeMany')}</td><td>Someone presses Edit for many records of a list, and says Yes</td><td>Changing many at once in one call — without it, the list saves each in turn. See <a href="#many">many records at once</a></td></tr>
    <tr><td>${c('exportRecords')}</td><td>Someone exports a list</td><td>An export written on your server — without it, the browser writes it</td></tr>
    <tr><td>${c('upload')}</td><td>Someone picks or drops a file in a file or picture field, uploads a picture of a signature, or saves one drawn</td><td>Files kept in your store, the record holding only their links — see <a href="#upload">files stored as they are picked</a></td></tr>
  </tbody>
</table>
</div>

<h2 id="requests">What each method receives</h2>
<ul>
  <li>${c('load({ model, id, fields })')} — the page's fields come along, so you can read exactly the columns the page shows.</li>
  <li>${c('save({ model, id, fields, changes, values })')} — to refuse it, throw ${c('saveRefused({ kind, message, fields })')}: the fields, a business rule or the network, each shown where it belongs (see <a href="/behaviour/#refused">a save the server refuses</a>). ${c('id')} is ${c('null')} for a new record. ${c('changes')} holds only what changed since the record was loaded; ${c('values')} holds everything, for backends that save whole records. A save made outside a form, such as a calendar's move or its Undo, carries ${c('partial: true')}: ${c('values')} and ${c('fields')} then hold only the fields it changes, so a backend that saves whole records writes those and keeps the rest as stored. Return ${c('{ id }')}, and ${c('values')} if your backend recalculated anything.</li>
  <li>${c('onchange({ model, id, changed, values })')} — return ${c('{ values }')} for the fields to update, and an optional ${c('warning')}. The warning appears under the field that changed, without blocking, and goes away with the next answer that has none. A line edited in a dialog also asks it, with that line changed, to show what it would become; nothing is saved, so answer without side effects.</li>
  <li>${c('search({ model, query, filter, limit })')} — the field's filter arrives with every ${c('valueFrom')} already replaced by its value, its groups kept: an ${c('{ any: [...] }')} is an OR, an ${c('{ all: [...] }')} an AND. Translate both, or the OR is lost; ${c('matchesFilter(values, filter)')} from ${c('@fieldia/core')} judges a record the same way, for sources that filter in JavaScript. Return ${c('[{ id, label }]')}. With ${c('exact: true')}, return only the records named exactly ${c('query')}, in any case: a box asks so for a name typed when a search's first answers, cut at their ${c('limit')}, did not hold it, and to tell two records of one name apart. A source that leaves ${c('exact')} out still works: the box looks for the name among what comes.</li>
  <li>A ${c('json')} field whose widget names records of a model — an analytic distribution's accounts — searches that ${c('model')} too, and asks for the records its value holds by their ids: the filter is then ${c('[{ field: "id", op: "in", value: [12, 14] }]')}.</li>
  <li>${c('definitions({ list, values })')} — the definitions of a properties field's ${c('definitionsFrom.list')}: those the record its link points to keeps (Flectra's ${c('definition_record')}), read from ${c('values')}. ${c('saveDefinitions({ list, values, definitions })')} keeps them all again, one added in place among them.</li>
  <li>${c('create({ model, name })')} — make a record from just its name (a backend's ${c('name_create')}). Return ${c('{ id, label }')}.</li>
  <li id="related">What a link shows of its record besides its name, a found or loaded link may carry: ${c('avatar')} (a picture's address or a ${c('data:')} URI), ${c('color')} (1 to 11, Flectra's colours), ${c('details')} (lines under its name, such as an address, joined by new lines) and, for a stage, ${c('folded')}. The page asks for them with its nodes' ${c('avatar')}, ${c('colors')} and ${c('details')} options and a statusbar's ${c('fold')}; a source gives them where its model has them. A record of a tree — an area, an iteration — may carry its ${c('path')}, its names from the top down (${c('["Portal", "Sprint 14"]')}), and an ${c('aside')}, words a path picker shows at the end of its row (an iteration's dates). ${c('createMemoryDataSource')} takes ${c('shows')}: by model, the fields each comes from — ${c('{ "res.users": { avatar: "image_128" }, tag: { color: "color" }, stage: { folded: "fold" }, partner: { details: ["street", "city"] }, iteration: { path: "path", aside: "dates" } }')}; a ${c('path')} field holds a list of names, or names joined by a backslash, and a search finds such a record by its whole path too.</li>
  <li>${c('submit({ pageId, values, bot })')} — the answers to the questions that were shown; skipped steps are left out. ${c('bot')} comes on a page with a bot check, below.</li>
</ul>
<p>A slow answer is handled for you: if someone keeps typing, an ${c('onchange')} or ${c('search')} answer that arrives after a newer question is ignored.</p>

<h2 id="bots">A public form's bot check</h2>
<p>A page of responses anyone may send — a sign-up, a contact form — can check that a person sent it: ${c('botCheck')} draws a box no person sees, reaches with Tab or hears read out, which a bot filling every box fills (${c('honeypot')}, on unless ${c('false')}); times the answers from the page shown to its send, against the fewest seconds a person takes (${c('minSeconds')}, 3 unless said; 0 tells none); and holds the place for your app's own captcha — Turnstile, reCAPTCHA, hCaptcha — in a slot of the page (${c('captcha')}, the slot's name).</p>
${code(
  'json',
  `
"layout": { "type": "sections", "id": "signup", "children": [
  …,
  { "type": "slot", "id": "s-captcha", "name": "captcha" }
] },
"botCheck": { "minSeconds": 3, "captcha": "captcha" }`
)}
<p>Nothing is refused on the page for what it saw: ${c('submit')} gets it beside the answers, and so does the ${c('send')} event, and your app decides — keep the response aside, check the token with the captcha's service, or refuse it with ${c('saveRefused')}. A person whose browser filled every box in at once can be quick, which is why it is yours to judge.</p>
${code(
  'ts',
  `
async submit({ pageId, values, bot }) {
  // bot: { honeypot: false, tooFast: false, seconds: 41.2, captcha: '0.Zx…' }
  if (bot?.honeypot) return { id: await keepAside(pageId, values) };
  if (bot && !(await verifyTurnstile(bot.captcha))) throw saveRefused({ kind: 'rule', message: 'Please tick the check box first.' });
  return { id: await store(pageId, values) };
}

// The captcha's widget, in the page's slot: its token handed to the form, a new one after each send.
slots: {
  captcha: (element, { form }) => {
    const id = turnstile.render(element, { sitekey, callback: (token) => form.botCheck({ captcha: token }) });
    const spent = form.on('send', () => turnstile.reset(id));
    return () => (spent(), turnstile.remove(id));
  },
}`
)}
<p>A page without ${c('botCheck')} sends what it always did. In the designer, a page of responses has <em>Bot check</em> on its Rules tab. The <a href="/demos/plain/?page=signup&amp;skin=outlined">sign-up demo</a> has one, with a stand-in for a captcha, and shows under the form what the app was told.</p>

<h2 id="upload">Files stored as they are picked</h2>
<p>A phone's photo is 3 to 12 MB. Twenty of them inside one save fail on mobile data, and one in a draft fills the browser's store. Give your data source ${c('upload')}, and a file or picture field sends each file to your store <em>as soon as it is picked</em>: photos are made smaller first, each shows on its way with a bar, × to cancel it and Retry when it failed, and the field keeps only what ${c('upload')} returns — ${c('{ url, name, size, type, fileId }')}, never the bytes. Three go at once, the rest wait their turn; a field of several keeps them in the order they were picked.</p>
<ul>
  <li>${c('upload(file, { model, field, recordId, line, signal, onProgress })')} — ${c('file')} is the browser's ${c('File')} (made smaller already, for a photo). ${c('recordId')} is ${c('null')} while the record is new: keep the file, and link it when the record's first save carries the field's ${c('{ url, fileId }')}. ${c('line')} names a table's line, ${c('{ field, key, id }')}, for a file on one. On a page of responses (a survey), ${c('model')} is the page's id. In a <a href="/pages/#layout">saved form placed in a record</a> (a ${c('form')} part), the file is the record's: ${c('model')} and ${c('recordId')} are the record's, and ${c('field')} says where it sits in the answers the record keeps under the part's name — ${c('consent.deed')}, or ${c('consent.rooms')} for a table's line.</li>
  <li>Call ${c('onProgress(sent, total)')} as the bytes go, for the bar's number; without it the bar moves with none.</li>
  <li>To fail, throw: the field says the file was not uploaded and offers Retry. Throw ${c("saveRefused({ kind: 'rule', message })")} when your store will not keep this file — its kind, its size — and the field shows your words, with no Retry, since trying again cannot help.</li>
  <li>When ${c('signal')} aborts — the person pressed ×, discarded their changes, or left — stop, and reject with an error named ${c('AbortError')}: the file is dropped without being called a failure.</li>
  <li><strong>Save waits and tells.</strong> Pressed while files are still going, Save waits for them, saying where <em>Saving…</em> would be: “2 files still uploading. Saving when they are done.” A file that failed stops the save under its field — “balcony.jpg was not uploaded: try again, or remove it” — until it is sent again or taken away; once it is, the form no longer says it was not saved. Save shows as soon as a file is picked, before it has arrived. A saved form placed in the record is waited for, and stopped for, the same way.</li>
  <li>A file picked while a save is on its way was not in that save: it stays a change, shown and still to save, even when it is stored before the save returns.</li>
  <li>Bytes still in the record are stored by the save: a signature drawn on its pad, or a file your app set with its ${c('data')}. A record's stored files that did not change are never sent again.</li>
  <li>A draft never keeps a file's bytes: a field holding one is left out of the draft, a saved form's placed in the page too, and its record's value stays when the draft is restored.</li>
  <li>Without ${c('upload')}, a file travels inside the record as base64, and a draft keeps it, as they always have; one larger than a megabyte warns once in the console.</li>
</ul>
<p>Photos are made smaller by the field's ${c('shrink')} — see <a href="/fields/#files">files and photos</a>.</p>

<h3 id="upload-to">${c('uploadTo')}: a plain endpoint</h3>
<p>${c('uploadTo')} from ${c('@fieldia/core')} writes ${c('upload')} for you. It sends through ${c('XMLHttpRequest')}, so the bar has its number, and through ${c('fetch')} where there is none. By default it POSTs a form with the file under ${c('file')}, and reads the stored file's address from the answer's JSON ${c('url')} (and its ${c('id')} as ${c('fileId')}), else from its ${c('Location')}. An answer of 400, 409, 413, 415 or 422 is a refusal, shown in the server's words (its JSON's ${c('message')}); any other failure offers Retry.</p>
${code(
  'ts',
  `
import { uploadTo } from '@fieldia/core';

const dataSource = {
  ...yourDataSource,
  upload: uploadTo({
    url: '/api/files',                          // or (file, request) => an address of the file's own
    headers: { 'X-CSRF-Token': csrfToken },     // or (file, request) => headers
    field: 'file',                              // the form's field the file goes under
    // link: (answer, file) => ({ url: answer.json.location }),   // when your answer says it its own way
  }),
};`
)}

<h3 id="azure-blob">Straight to Azure Blob storage</h3>
<p>The file need not pass through your server. Your server signs one address per file — a service SAS, write-only, for minutes — and the browser PUTs the file to it. The field keeps the blob's address, without the signature. No SDK on either side:</p>
${code(
  'ts',
  `
// In the page: ask your server for the address, then PUT the file there.
const upload = uploadTo({
  method: 'PUT',
  url: async (file) => (await fetch(\`/api/upload-address?name=\${encodeURIComponent(file.name)}\`)).text(),
  headers: { 'x-ms-blob-type': 'BlockBlob' },
});

// On your server (Node): the address, signed with the storage account's key.
import { createHmac, randomUUID } from 'node:crypto';

const ACCOUNT = 'yourstorage';
const CONTAINER = 'listings';
const KEY = process.env.AZURE_STORAGE_KEY; // the account's key, base64, as the portal gives it

export function uploadAddress(fileName) {
  const blob = \`\${new Date().toISOString().slice(0, 10)}/\${randomUUID()}-\${fileName.replace(/[^\\w.-]+/g, '-')}\`;
  const expiry = new Date(Date.now() + 10 * 60_000).toISOString().replace(/\\.\\d+Z$/, 'Z');
  const version = '2022-11-02';
  const signed = [
    'cw', '', expiry, \`/blob/\${ACCOUNT}/\${CONTAINER}/\${blob}\`, // permissions, start, expiry, resource
    '', '', 'https', version, 'b', // identifier, IP, protocol, version, a blob
    '', '', '', '', '', '', '', // snapshot, encryption scope, and the five response headers
  ].join('\\n');
  const sig = createHmac('sha256', Buffer.from(KEY, 'base64')).update(signed, 'utf8').digest('base64');
  const query = new URLSearchParams({ sv: version, spr: 'https', se: expiry, sr: 'b', sp: 'cw', sig });
  return \`https://\${ACCOUNT}.blob.core.windows.net/\${CONTAINER}/\${blob}?\${query}\`;
}`
)}
<p>Let your site PUT to the account in its CORS rules, with the ${c('x-ms-blob-type')} and ${c('Content-Type')} headers. To show a stored file to people who may not read the container, give them a read SAS for it when your server sends the record. An S3 presigned PUT URL works the same way, without the ${c('x-ms-blob-type')} header.</p>

<h2 id="changes">What a save sends</h2>
<p>${c('changes.values')} has the plain fields that changed. Tables of lines and many2many links come as operations, named the way Odoo names its x2many commands, so an Odoo or Flectra adapter maps them one to one:</p>
${code(
  'ts',
  `
changes.lines['child_ids'] = [
  { op: 'create', key: 'new-1', values: { name: 'Sara' } },
  { op: 'update', id: 7, values: { email: 'sara@example.com' } },
  { op: 'delete', id: 9 },
];
changes.links['tag_ids'] = [{ op: 'link', id: 3 }, { op: 'unlink', id: 4 }];   // or { op: 'set', ids }, { op: 'clear' }`
)}

<h2 id="versions">Two people, one record: versions and conflicts</h2>
<p>When two people open the same record and both save, the second save would wipe out the first without a word. A source that keeps versions stops that. Its ${c('load')} returns the record with the version it was read at, through ${c('loadedRecord')}; the form sends that version back with each save, as ${c('version')}, and keeps the one each save returns. When the record changed in between, the source throws a ${c('ConflictError')} naming who changed it, when, and — if it can — the record as they left it:</p>
${code(
  'ts',
  `
import { ConflictError, loadedRecord } from '@fieldia/core';

const dataSource: DataSource = {
  async load({ model, id }) {
    const row = await api.read(model, id);
    return loadedRecord(row.values, { version: { token: row.etag, by: row.changedBy, at: row.changedAt } });
  },
  async save({ model, id, changes, version }) {
    const response = await api.write(model, id, changes.values, { ifMatch: version?.token });
    if (response.status === 409) {
      const now = response.body;   // who saved it, when, and what it holds now
      throw new ConflictError({ version: { token: now.etag, by: now.changedBy, at: now.changedAt }, theirs: now.values });
    }
    return { id: response.body.id, version: { token: response.body.etag } };
  },
};`
)}
<p>The form then says it over the record — <em>Mona changed this record at 10:42</em>, the fields she changed and those you both changed, in the page's language and its way of writing a time — and offers two answers. Nothing of the person's is lost while they choose:</p>
<ul>
  <li><strong>Reload</strong> shows the record as the other person left it, and lists the person's own changes beside it, each with <em>Put back</em> (${c('form.reloadTheirs()')}, ${c('state.setAside')}, ${c('form.putBack(field)')}).</li>
  <li><strong>Keep mine</strong> saves the person's changes over the record as it is now: the other person's values stay wherever this one changed nothing (${c('form.keepMine()')}). It saves with the version the conflict named, so a source needs no second way to save; a source that saves whole records gets ${c('values')} as theirs with these changes over them — read again first when the conflict did not carry the record. If it cannot be read, nothing is saved over work the person never saw: the form says so (${c('conflict.unread')}), and they may try again or Reload. If a third person saved in between, that is another conflict.</li>
</ul>
<p>Save pressed again while a save is on its way — Ctrl+Enter twice — waits for it, and saves with the version it got back: never a conflict with yourself. After Reload, the changes set aside count as unsaved until they are put back or let go — the list's × asks before it lets them go. A change made while a save is on its way stays a change to save, and the status says <em>Saved, but not all your changes</em>. Every way a form's values go passes one check inside the form, ${c('form.leave()')}: another record (the pager, an action's answer naming one, Duplicate's copy), the record loaded again (a ${c('reload')} step, an answer's ${c('reload: true')}), a ${c('reset')} step, and your host's ${c('close')}, which the form takes once where it is made. It first waits for a save on its way and files on theirs, the page saying what it waits for, so a save's answer never lands on another record; then it looks at the record as it is now. It asks "Discard your changes?", the focus on Cancel so Enter keeps the person where they are, only when their work is at risk: a change of theirs the last save did not send — typed while it was on its way, while the run that saved went on, or since; a value your page's steps, rules or app set is never theirs — a file not saved yet, changes set aside. Before a record's first save, every way out behaves as it did before 0.21: a plain dialog's Escape still closes at once on a change not saved. Once a save in a dialog, a panel or a page in place went through, it comes back saved however it is closed. Call ${c('form.leave()')} before your app's own ways out; ${c('unsavedWork(form.getState())')} answers for a browser's ${c('beforeunload')}. The question comes through your host's ${c('ask(message, { discard: true })')}.</p>
<p>A new record, and a source that tells no version, are never checked. ${c('saveProblemOf(error)')} reads a ${c('ConflictError')} as ${c('{ kind: "conflict", conflict }')} without ${c('instanceof')}, so an app with two copies of core still shows it. Try it in the <a href="/demos/save-safety/">two tabs demo</a>.</p>

<h2 id="permissions">What this person may do with a record</h2>
<p>The same ${c('loadedRecord')} tells what the person may do with the record, as ${c('can')}. Everything is allowed unless it says ${c('false')}, so a source that says nothing keeps today's behaviour. The form keeps to it before any source is asked — and the source should still refuse on its side:</p>
${code(
  'ts',
  `
return loadedRecord(row.values, {
  version: { token: row.etag },
  can: {
    edit: row.isMine,                 // false: every field read-only, no Save, no Edit
    delete: false,                    // false: Delete and the buttons whose steps delete are hidden
    archive: true, duplicate: true,   // the same for Archive and Unarchive, and for Duplicate
    readonlyFields: ['commission'],   // locked, with a lock that says why
    hiddenFields: ['margin'],         // not shown, never asked for, left out of what a save sends
    reason: 'Only Mona, the lead’s agent, can change it.',
  },
});`
)}
<p>What is not allowed is hidden, never shown greyed out, and the reason is said: over the record when it is only to be read, by a locked field's lock, and at the foot of the gear menu for an action it leaves out — the source's ${c('reason')}, or Fieldia's own words in English, Arabic, French or German. A save can change it (a stage that locks the record): return ${c('can')} with the ${c('SaveResult')}. Each row of a list may carry ${c('can')} and ${c('version')} too. See it as a <a href="/demos/save-safety/?role=viewer">viewer who may only read</a>.</p>

<h2 id="many">Many records at once: every match, export and bulk edit</h2>
<p>A list's <em>Select all 1,284 that match</em>, its Export and its Edit (see <a href="/lists/#bulk">lists</a>) read three optional members. Without them each still works: the list reads ${c('list')} a page at a time, writes the file in the browser, and saves each record in turn.</p>
${code(
  'ts',
  `
// Every matching id, in the list's order, beside one page (limit 0 for the ids alone).
list({ model, fields, filter, sort, offset, limit, allIds: true }): Promise<{ records, total, allIds?: RecordId[] }>;

// One value in a field of each record. Refuse a record as its save would be refused:
// one this person may not change, or one changed since the version it was listed at.
writeMany?({ model, ids, values: { state: 'customer' }, fields, versions?: { [id]: RecordVersion } }):
  Promise<{ failed: { id, message, problem?: SaveProblem }[] }>;

// A list's export written on the server.
exportRecords?({ model, format: 'xlsx' | 'csv', columns: [{ field, label }], ids?, filter, sort, count, name, locale }):
  Promise<{ name, data?: Blob | ArrayBuffer | string, type?, url? } | { message: string } | false>;`
)}
<ul>
  <li>${c('allIds')} shorter than ${c('total')} means you stopped early: the list says <em>1,000 of 1,284 could be selected</em> rather than claim all. Each row's ${c('version')} and ${c('can')} are what an Edit sends and keeps to.</li>
  <li>${c('writeMany')} is asked a thousand ids at a time. Every id not in ${c('failed')} is taken as changed; a failure's ${c('message')} is said beside the record's name, and its ${c('problem')} (a ${c('ConflictError')}'s, say) lets the list name who changed it. A call that throws counts each of its records as not changed, with its words. Without ${c('writeMany')}, each record is a ${c('save')} with ${c('partial: true')}: ${c('values')} and ${c('changes')} hold the one field.</li>
  <li>${c('exportRecords')} gets the list's columns and words, the ticked ${c('ids')} (none: every record ${c('filter')} finds), the order and the file's name. Answer with the file and the browser saves it; with ${c('{ message }')} — <em>it will be emailed to you</em> — and the list says it; or with ${c('false')} to let the browser write this one after all, as for a small export.</li>
</ul>

<h2 id="rest">An adapter for a REST API</h2>
${code(
  'ts',
  `
import type { DataSource } from '@fieldia/core';

export const api: DataSource = {
  async load({ model, id }) {
    return (await fetch(\`/api/\${model}/\${id}\`)).json();
  },
  async save({ model, id, values }) {
    const response = await fetch(id === null ? \`/api/\${model}\` : \`/api/\${model}/\${id}\`, {
      method: id === null ? 'POST' : 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(values),
    });
    const saved = await response.json();
    return { id: saved.id, values: saved };
  },
  async search({ model, query, limit = 8 }) {
    const rows = await (await fetch(\`/api/\${model}?q=\${encodeURIComponent(query)}&limit=\${limit}\`)).json();
    return rows.map((row: { id: number; name: string }) => ({ id: row.id, label: row.name }));
  },
  async submit({ pageId, values }) {
    await fetch(\`/api/responses/\${pageId}\`, { method: 'POST', body: JSON.stringify(values) });
    return {};
  },
};`
)}

<h2 id="memory">The memory data source</h2>
<p>${c('createMemoryDataSource()')} implements every method in memory. It is what the demos and tests use, and a good way to try a page before a backend exists. You can seed it with records, search labels and onchange rules:</p>
${code(
  'ts',
  `
import { createMemoryDataSource } from '@fieldia/core';

const dataSource = createMemoryDataSource({
  records: { partner: { 1: { name: 'Nile Towers', is_company: true } }, country: { 63: { name: 'Egypt' } } },
  onchange: { partner: { is_company: (values) => ({ title: values.is_company ? null : values.title }) } },
  warnings: { partner: { credit_limit: (values) => (values.credit_limit > 100000 ? 'Above the approval limit' : null) } },
  delayMs: 300,   // answer slowly, to see loading states
  versions: { by: 'Sara' },   // a version for each record; a save over a newer one is a conflict
  can: { lead: (values) => (values.stage === 'won' ? { edit: false, reason: 'A won lead is closed.' } : undefined) },
});
dataSource.responses;   // every submitted response, for tests
dataSource.changeElsewhere('lead', 1, { stage: 'visit' }, { by: 'Mona' });   // as someone else, on another screen`
)}
<p>Its ${c('groups')} and ${c('totals')} group a date by the span it falls in (${c('interval')}), and total an amount in one currency only where ${c('currencies')} names the field holding each record's (see <a href="/lists/#totals">lists that add up</a>).</p>
<p>Its ${c('list')} gives ${c('allIds')} when asked, and its ${c('writeMany')} refuses each record as its ${c('save')} would (the person's ${c('can')}, a version older than the record's); it has no ${c('exportRecords')}, so the browser writes an export, as without a server. Its ${c('upload')} keeps each file as a ${c('data:')} address, so a preview needs nothing else. ${c('storage')} makes it as slow, or as unreliable, as a real store, to see files on their way and Retry:</p>
${code(
  'ts',
  `
const dataSource = createMemoryDataSource({
  storage: {
    bytesPerSecond: 150_000,                                          // a phone sending on mobile data
    fails: (file, attempt) => file.name === 'balcony.jpg' && attempt === 1, // fails once, partway: Retry mends it
    // or words, for the store refusing the file: (file) => file.size > 5e6 && 'Photos up to 5 MB'
  },
});`
)}
`,
};
