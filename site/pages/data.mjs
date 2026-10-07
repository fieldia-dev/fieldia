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
  load?(request: LoadRequest): Promise<Values>;              // read a record
  save?(request: SaveRequest): Promise<SaveResult>;          // create or update it
  onchange?(request: OnchangeRequest): Promise<OnchangeResult>;  // recalculate after a change
  search?(request: SearchRequest): Promise<RelatedRecord[]>; // find records to link to
  create?(request: CreateRequest): Promise<RelatedRecord>;   // make one from a typed name
  submit?(request: SubmitRequest): Promise<SubmitResult>;    // store one response
  list?(request: ListRequest): Promise<ListResult>;          // a page of records, for a list
  groups?(request: GroupRequest): Promise<Group[]>;          // a list's groups and their counts
  options?(request: OptionsRequest): Promise<Option[]>;      // a selection's choices from the app
  definitions?(request: OptionsRequest): Promise<PropertyDefinition[]>;  // properties a linked record keeps
  saveDefinitions?(request: OptionsRequest & { definitions }): Promise<void>; // one added in place
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
    <tr><td>${c('groups')}</td><td>A list is grouped by a field</td><td>Group By</td></tr>
    <tr><td>${c('definitions')}</td><td>A properties field with ${c('definitionsFrom')} is shown, and again when the link it follows changes</td><td>Properties a linked record defines — see <a href="/fields/#business">business widgets</a></td></tr>
    <tr><td>${c('saveDefinitions')}</td><td>Someone adds a property in place</td><td>Keeping it on that record</td></tr>
  </tbody>
</table>
</div>

<h2 id="requests">What each method receives</h2>
<ul>
  <li>${c('load({ model, id, fields })')} — the page's fields come along, so you can read exactly the columns the page shows.</li>
  <li>${c('save({ model, id, fields, changes, values })')} — to refuse it, throw ${c('saveRefused({ kind, message, fields })')}: the fields, a business rule or the network, each shown where it belongs (see <a href="/behaviour/#refused">a save the server refuses</a>). ${c('id')} is ${c('null')} for a new record. ${c('changes')} holds only what changed since the record was loaded; ${c('values')} holds everything, for backends that save whole records. Return ${c('{ id }')}, and ${c('values')} if your backend recalculated anything.</li>
  <li>${c('onchange({ model, id, changed, values })')} — return ${c('{ values }')} for the fields to update, and an optional ${c('warning')}. The warning appears under the field that changed, without blocking, and goes away with the next answer that has none. A line edited in a dialog also asks it, with that line changed, to show what it would become; nothing is saved, so answer without side effects.</li>
  <li>${c('search({ model, query, filter, limit })')} — the field's filter arrives with every ${c('valueFrom')} already replaced by its value, its groups kept: an ${c('{ any: [...] }')} is an OR, an ${c('{ all: [...] }')} an AND. Translate both, or the OR is lost; ${c('matchesFilter(values, filter)')} from ${c('@fieldia/core')} judges a record the same way, for sources that filter in JavaScript. Return ${c('[{ id, label }]')}.</li>
  <li>A ${c('json')} field whose widget names records of a model — an analytic distribution's accounts — searches that ${c('model')} too, and asks for the records its value holds by their ids: the filter is then ${c('[{ field: "id", op: "in", value: [12, 14] }]')}.</li>
  <li>${c('definitions({ list, values })')} — the definitions of a properties field's ${c('definitionsFrom.list')}: those the record its link points to keeps (Flectra's ${c('definition_record')}), read from ${c('values')}. ${c('saveDefinitions({ list, values, definitions })')} keeps them all again, one added in place among them.</li>
  <li>${c('create({ model, name })')} — make a record from just its name (a backend's ${c('name_create')}). Return ${c('{ id, label }')}.</li>
  <li>${c('submit({ pageId, values })')} — the answers to the questions that were shown; skipped steps are left out.</li>
</ul>
<p>A slow answer is handled for you: if someone keeps typing, an ${c('onchange')} or ${c('search')} answer that arrives after a newer question is ignored.</p>

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
});
dataSource.responses;   // every submitted response, for tests`
)}
`,
};
