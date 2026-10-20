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
  createMany?(request: CreateManyRequest): Promise<CreateManyResult>; // many new records at once: a list's Import
  importRecords?(request: ImportRequest): Promise<{ message } | false>; // a list's import, on the server
  slots?(request: SlotsRequest): Promise<SlotsResult>;        // the times free to book, day by day
  duplicates?(request: DuplicatesRequest): Promise<DuplicatesResult>; // records like the one typed
  merge?(request: MergeRequest): Promise<MergeResult | void>; // two records into one
  notDuplicates?(request: NotDuplicatesRequest): Promise<RecordId[]>; // those said to be someone new
  markNotDuplicate?(request: MarkNotDuplicateRequest): Promise<void>; // one said to be someone new
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
    <tr><td>${c('groups')}</td><td>A list is grouped by a field, or a date by its month, quarter, week, day or year; a filter bar counts its values (${c('filterCounts')}), a record of links under each of its links</td><td>Group By — see <a href="/lists/#totals">lists that add up</a>; a filter's values with no counts — see <a href="/lists/#filters">filters</a></td></tr>
    <tr><td>${c('totals')}</td><td>A list totals a column: as it is searched, grouped, and as rows are ticked; its ${c('count')} says how many a named filter, a favourite or a phone's sheet finds</td><td>A totals row, sums on each Group By heading, the sum of the rows ticked — see <a href="/lists/#totals">lists that add up</a>; without it, none shows, and a filter is counted by ${c('list')}'s total</td></tr>
    <tr><td>${c('definitions')}</td><td>A properties field with ${c('definitionsFrom')} is shown, and again when the link it follows changes</td><td>Properties a linked record defines — see <a href="/fields/#business">business widgets</a></td></tr>
    <tr><td>${c('saveDefinitions')}</td><td>Someone adds a property in place</td><td>Keeping it on that record</td></tr>
    <tr><td>${c('archive')} · ${c('copy')} · ${c('delete')}</td><td>The gear menu's Archive, Unarchive, Duplicate or Delete, or those steps, run</td><td>The record's own operations — without one, your app's action of the step's name is called. See <a href="/record/#toolbar">Around a record</a></td></tr>
    <tr><td>${c('attachments')}</td><td>A sheet that shows the record's attachment beside it opens a record</td><td>The PDF or picture beside the sheet</td></tr>
    <tr><td>${c('writeMany')}</td><td>Someone presses Edit for many records of a list, and says Yes</td><td>Changing many at once in one call — without it, the list saves each in turn. See <a href="#many">many records at once</a></td></tr>
    <tr><td>${c('exportRecords')}</td><td>Someone exports a list</td><td>An export written on your server — without it, the browser writes it</td></tr>
    <tr><td>${c('createMany')}</td><td>Someone imports a file's rows into a list</td><td>Making many records in one call — without it, the list saves each as a new record. See <a href="#import">many records made at once</a></td></tr>
    <tr><td>${c('importRecords')}</td><td>Someone has matched a file's columns, before its rows are checked</td><td>An import taken on your server, a file of any size — without it, the browser imports it</td></tr>
    <tr><td>${c('upload')}</td><td>Someone picks or drops a file in a file or picture field, uploads a picture of a signature, or saves one drawn</td><td>Files kept in your store, the record holding only their links — see <a href="#upload">files stored as they are picked</a></td></tr>
    <tr><td>${c('slots')}</td><td>A date and time drawn as booking slots shows a month, a field it depends on changes, or someone picks a time</td><td>Booking a time from those free — see <a href="#slots">booking slots</a></td></tr>
    <tr><td>${c('duplicates')}</td><td>Someone stops typing in a field the page's ${c('duplicates')} names, a saved record opens, or a record is saved</td><td>Saying which records it may duplicate, under the field they matched on — see <a href="#duplicates">possible duplicates</a></td></tr>
    <tr><td>${c('merge')}</td><td>Someone merges a record with one like it, a value picked for each field</td><td>Merge, beside a possible duplicate — without it, none is offered</td></tr>
    <tr><td>${c('notDuplicates')} · ${c('markNotDuplicate')}</td><td>A saved record with possible duplicates is shown; someone presses <em>It's someone new</em></td><td>What was let be kept on your server, so every device lets it be — without both, the person's browser keeps it. See <a href="#duplicates">possible duplicates</a></td></tr>
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
  <li>${c('submit({ pageId, values, bot })')} — the answers to the questions that were shown; skipped steps are left out. ${c('bot')} comes on a page with a bot check, below. Return ${c('{ id }')} — the reference you give the response, ${c('"B-1043"')} — and any ${c('values')} you worked out as you kept it, by the page's fields (the time you confirmed): the page's <a href="/pages/#endings">ending</a> reads them, ${c('{id}')} in its words saying the reference. The answers on the form stay as they were sent; ${c('form.getState().sent')} keeps what you answered.</li>
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

<h2 id="slots">Booking slots</h2>
<p>A date and time drawn as ${c('slots')} books a time from those your app has free: a month whose days are shaded by how they are booked, beside the chosen day's free times. Give your data source ${c('slots')}; without it, the field is the plain date and time box.</p>
<ul>
  <li>${c('slots({ model, field, recordId, schedule, from, to, timeZone, length, between, values })')} — the days ${c('from')} and ${c('to')} (both included, ${c('"2026-10-01"')}) are days in ${c('timeZone')}: the field's, its page's, or the browser's. ${c('schedule')} is what the node's ${c('options.schedule')} names (a doctor's, a showroom's), else the field's name; ${c('length')} and ${c('between')} are the minutes a booking lasts and those kept free between two, as the page says. ${c('recordId')} is the record booked: its own time is free to it. ${c('values')} holds every value of the form — the doctor, the car.</li>
  <li>Answer ${c('{ days, length }')}: each day by its date, ${c("{ state: 'open', free: ['2026-10-19T07:00:00Z', …] }")}, ${c("{ state: 'full' }")}, ${c("{ state: 'closed' }")} or ${c("{ state: 'holiday', note: 'Staff training day' }")} — a day left out is closed — and, when your server knows better than the page, the minutes a booking lasts (a service's own length). The free times are instants: in UTC, or with their offset.</li>
  <li>It is asked a month at a time, again when a field in ${c('options.dependsOn')} changes, and once more for the day of a time picked: a time someone else booked meanwhile is said — “10:00 was just booked by someone else” — and the day's times drawn again; nothing is booked over. To fail, throw: the picker says so, with Try again.</li>
  <li>The time picked is the field's instant; with ${c('options.endField')}, the booking's end — its start and its length — goes there too. Your ${c('save')} still decides: refuse a time taken by then with ${c("saveRefused({ kind: 'rule', message })")}.</li>
</ul>
${code(
  'ts',
  `
const dataSource = {
  ...yourDataSource,
  async slots({ schedule, from, to, timeZone, recordId, values }) {
    const query = new URLSearchParams({ schedule, from, to, timeZone, car: String(values.car?.id ?? '') });
    if (recordId !== null) query.set('booking', String(recordId));
    const answer = await fetch(\`/api/test-drives/free?\${query}\`);
    if (!answer.ok) throw new Error(await answer.text());
    return answer.json();   // { days: { '2026-10-19': { state: 'open', free: [...] }, ... }, length: 45 }
  },
};`
)}
<p>${c('form.findSlots(field, { from, to })')} asks it for a widget of your own, the record, its values and the zone filled in; ${c('form.canFindSlots()')} says whether the source has it. For demos and tests, ${c('scheduleSlots')} answers from booking schedules, beside the <a href="#memory">memory data source</a>.</p>

<h2 id="duplicates">Possible duplicates, and Merge</h2>
<p>A record's page may say which fields records like the one typed are found by — the same phone, email or tax id, a name close enough — with ${c('duplicates')}. While someone types in one of them, a moment after they stop (and as a saved record opens, and as the record is saved), Fieldia asks your data source's ${c('duplicates')}; each record it answers with is said under the field it matched on — <em>“A record with this Phone already exists: Nile Traders”</em> — with <strong>Open it</strong>, <strong>It's someone new</strong> and, on a saved record where the source has ${c('merge')}, <strong>Merge…</strong>. Without ${c('duplicates')} in the source, nothing is asked and nothing shows.</p>
${code(
  'json',
  `
"duplicates": { "fields": ["name", "phone", "email", "vat"] }
"duplicates": { "fields": ["phone", "email"], "on": "save" }`
)}
<ul>
  <li>${c('duplicates({ model, recordId, values, fields })')} — ${c('fields')} are those the page names that hold a value now (none: nothing is asked), ${c('values')} every value of the form (a phone as E.164 where the page reads phones the world over), ${c('recordId')} the record typed (null while new) — never its own duplicate. Answer ${c("{ matches: [{ id, name, why: ['phone', 'email'], score? }] }")}: ${c('why')} names the fields it matched on — the note goes under the first of them in sight, and a name field in it is said as <em>“a name like this”</em> where the names are not the same — and ${c('score')}, from 0 to 1, puts the likest first. To fail, throw: nothing is said.</li>
  <li>${c('on')}: ${c("'type'")} (the default) asks as the fields are typed in, as a saved record opens and as it is saved; ${c("'save'")} only as it is saved. Typing on leaves an answer on its way unheard; an answer for a record no longer shown is laid nowhere. Nothing is in Save's way: a duplicate is said, and Save saves — unless your ${c('save')} refuses it.</li>
  <li><strong>Open it</strong> shows the record found in the form's place, once the person said Discard to what they typed (every change counts, as a panel's Escape counts it). <strong>It's someone new</strong> lets the record found be for this record, whatever field matches it next — a name typed after the email that found it — remembered for the record, by its id once saved: on your server where your source has ${c('notDuplicates')} and ${c('markNotDuplicate')}, else in the person's browser (the viewer's ${c('preferences')}).</li>
  <li><strong>Kept on your server.</strong> ${c('notDuplicates({ model, recordId })')} is asked as a saved record is shown, before its possible duplicates are said — answer with the ids of the records said to be someone else for it — and ${c('markNotDuplicate({ model, recordId, matchId })')} as the person presses <em>It's someone new</em> on a saved record, or saves a new one after pressing it (once for each). Keep them as pairs: Nile Traders is someone else for Nile Traders Co. as much as the other way round. A second device, a phone after the laptop, then never says a match let be on the first. Your ${c('duplicates')} need not leave them out: the page does. Throw from ${c('notDuplicates')}, and the matches are said as found; throw from ${c('markNotDuplicate')}, and the browser keeps that one instead. What a browser kept before your source had them is still read.</li>
  <li>On a page that names its records (${c('"records": { "one": "customer", "other": "customers", "a": "a customer" }')}, see <a href="/pages/#page-width">the page</a>), each match says them — <em>A customer with this phone already exists: Nile Traders</em>, <em>It's a new customer</em>, <em>Merge two customers</em> — its field's label small inside the sentence where the page says so (${c('"lowerLabels": true')}).</li>
  <li><strong>Merge…</strong> saves what is typed first, reads the record found (${c('load')}), and shows the two side by side: the record kept picked over its column (the one found, unless the person picks this one), and a radio for each field they hold apart, the kept record's value picked — or the other's where the kept one holds nothing. What will happen is said before Merge. Then ${c('merge({ model, keepId, mergeIds, values, fields })')}: keep ${c('keepId')} with ${c('values')}, the value picked for each field, and take ${c('mergeIds')} away. Moving what was theirs — messages, activities, the records linking to them — is your source's work. Refuse with ${c("saveRefused({ kind: 'rule', message })")}: it is said in the screen, which stays. Merged, the record kept is shown, and ${c('{ message }')} answered is said with it.</li>
</ul>
${code(
  'ts',
  `
const dataSource = {
  ...yourDataSource,
  async duplicates({ model, recordId, values, fields }) {
    const answer = await fetch(\`/api/\${model}/like\`, { method: 'POST', body: JSON.stringify({ except: recordId, values, fields }) });
    return answer.json();   // { matches: [{ id: 7, name: 'Nile Traders', why: ['phone'], score: 1 }] }
  },
  async merge({ model, keepId, mergeIds, values }) {
    const answer = await fetch(\`/api/\${model}/\${keepId}/merge\`, { method: 'POST', body: JSON.stringify({ mergeIds, values }) });
    if (answer.status === 403) throw saveRefused({ kind: 'rule', message: await answer.text() });
    return answer.json();   // { message: '4 messages and 2 orders moved' }
  },
  async notDuplicates({ model, recordId }) {
    const answer = await fetch(\`/api/\${model}/\${recordId}/not-duplicates\`);
    return answer.json();   // [3, 17]
  },
  async markNotDuplicate({ model, recordId, matchId }) {
    await fetch(\`/api/\${model}/\${recordId}/not-duplicates\`, { method: 'POST', body: JSON.stringify({ matchId }) });
  },
};`
)}
<p>${c('form.findDuplicates()')} asks it for a screen of your own, and ${c('form.merge({ keepId, mergeIds, values })')} merges; ${c('form.canFindDuplicates()')} and ${c('form.canMerge()')} say whether the page and its source can; ${c('form.notDuplicates()')} and ${c('form.markNotDuplicate(matchId)')} read and keep what was let be for the record shown, where ${c('form.keepsNotDuplicates()')} says the source has both. For demos and tests, ${c('alikeRecords()')} answers from the <a href="#memory">memory data source</a>'s records.</p>

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
<p>Save pressed again while a save is on its way — Ctrl+Enter twice — waits for it, and saves with the version it got back: never a conflict with yourself. After Reload, the changes set aside count as unsaved until they are put back or let go — the list's × asks before it lets them go. A change made while a save is on its way stays a change to save, and the status says <em>Saved, but not all your changes</em>. Every way a form's values go passes one check inside the form, ${c('form.leave()')}: another record (the pager, an action's answer naming one, Duplicate's copy), the record loaded again (a ${c('reload')} step, an answer's ${c('reload: true')}), a ${c('reset')} step, and your host's ${c('close')}, which the form takes once where it is made. It first waits for a save on its way and files on theirs, the page saying what it waits for, so a save's answer never lands on another record; then it looks at the record as it is now. It asks "Discard your changes?", the focus on Cancel so Enter keeps the person where they are, only when their work is at risk: a change of theirs the last save did not send — typed while it was on its way, while the run that saved went on, or since; a value your page's steps, rules or app set is never theirs — a file not saved yet, changes set aside. A dialog, a panel and a page opened in place hold what was typed in them and nothing else saves it: their Escape, × and Back ask about every change not saved, before the record's first save too (since 0.26: a related list's New or row and a calendar's New closed unasked before). Once a save in a dialog, a panel or a page in place went through, it comes back saved however it is closed. Call ${c('form.leave()')} before your app's own ways out; ${c('unsavedWork(form.getState())')} answers for a browser's ${c('beforeunload')}. The question comes through your host's ${c('ask(message, { discard: true })')}.</p>
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

<h2 id="import">Many records made at once: a list's Import</h2>
<p>A list's Import (see <a href="/lists/#import">lists</a>) checks every row in the browser first, then writes those that pass. Two optional members make it faster and bigger; without them it still works, a ${c('save')} of each row as a new record, and its Undo uses ${c('delete')}.</p>
${code(
  'ts',
  `
// Many records, each with its own values, a few hundred at a time. Answer each in order:
// the id it was made with, or why it was not (and the problem, as a save would throw it).
createMany?({ model, records: Values[], fields }):
  Promise<{ records: ({ id: RecordId } | { message: string; problem?: SaveProblem })[] }>;

// A list's import taken on the server, asked once the person has matched the columns.
importRecords?({ model, file, columns: [{ header, field | null }], rows, fields, locale, dateOrder }):
  Promise<{ message: string } | false>;`
)}
<ul>
  <li>${c('createMany')} is asked five hundred records at a time, each its row's values and the page's defaults, links as ${c('{ id, label }')}. A record left unanswered is taken as not made. Without it, each row is ${c('save(newRecordSave(model, fields, values))')}: ${c('id: null')}, every value, a many2many's links as one ${c('set')}. Refuse a record as its save would be refused; the list names it by its row in the file.</li>
  <li>${c('importRecords')} gets the file as picked (a browser's ${c('File')}), its columns and the field each goes into, how many rows it holds, and the page's language and date order. Answer ${c('{ message }')} — <em>your file is being imported: you will get an email</em> — and the list says it; or ${c('false')} to let the browser import this one after all. The browser reads at most 50,000 rows: a bigger file is imported only where your source takes it.</li>
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
    const response = await fetch(\`/api/responses/\${pageId}\`, { method: 'POST', body: JSON.stringify(values) });
    // The reference it was given, which the page's ending says: "Your booking is {id}".
    const kept = await response.json();
    return { id: kept.reference, values: { confirmed_at: kept.confirmed_at } };
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
// Each response answered as your server would: createMemoryDataSource({ submitted: (request, count) => ({ id: \`B-\${1042 + count}\` }) })
dataSource.changeElsewhere('lead', 1, { stage: 'visit' }, { by: 'Mona' });   // as someone else, on another screen`
)}
<p>Its ${c('groups')} and ${c('totals')} group a date by the span it falls in (${c('interval')}), and total an amount in one currency only where ${c('currencies')} names the field holding each record's (see <a href="/lists/#totals">lists that add up</a>).</p>
<p>Its ${c('slots')} answers from booking schedules, with ${c('scheduleSlots')}: the hours each day of the week on a zone's clock, a booking's length and the minutes kept free after one, holidays, and the records its bookings are — each car's own, with ${c('same')} — a time the clocks skip that day left out, and times gone by too:</p>
${code(
  'ts',
  `
import { createMemoryDataSource, scheduleSlots } from '@fieldia/core';

const weekday = [['09:00', '13:00'], ['14:00', '18:00']];
const dataSource = createMemoryDataSource({
  records,
  slots: scheduleSlots({
    showroom: {
      timeZone: 'Europe/Berlin',
      hours: { 1: weekday, 2: weekday, 3: weekday, 4: weekday, 5: weekday, 6: [['10:00', '14:00']] }, // 1 Monday … 7 Sunday
      length: 45,   // minutes a drive lasts
      between: 15,  // minutes kept free after each
      holidays: { '2026-12-25': 'Christmas Day' },
      bookings: { model: 'drive.booking', field: 'start', endField: 'stop', same: ['car'] },
    },
  }),
});`
)}
<p>Its ${c('duplicates')} answers with ${c('alikeRecords()')}: each record of the model holding the same value in a field asked as people write them apart — a phone's spaces and dashes, an email in any case, a link by its record — or, in its name field, a name close enough. Its ${c('merge')} keeps one record with the values picked, takes the others away, and moves the links to them to it; its ${c('notDuplicates')} and ${c('markNotDuplicate')} keep what was let be as pairs (${c('notDuplicatePairs')}, by model, read from either side), starting from the option of that name:</p>
${code(
  'ts',
  `
import { alikeRecords, createMemoryDataSource } from '@fieldia/core';

const dataSource = createMemoryDataSource({ records, duplicates: alikeRecords() });`
)}
<p>Its ${c('list')} gives ${c('allIds')} when asked, and its ${c('writeMany')} refuses each record as its ${c('save')} would (the person's ${c('can')}, a version older than the record's); its ${c('createMany')} makes each record as its ${c('save')} makes a new one; it has no ${c('exportRecords')} or ${c('importRecords')}, so the browser writes an export and reads an import, as without a server. Its ${c('upload')} keeps each file as a ${c('data:')} address, so a preview needs nothing else. ${c('storage')} makes it as slow, or as unreliable, as a real store, to see files on their way and Retry:</p>
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
