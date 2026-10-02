import { c, code } from '../layout.mjs';

export default {
  path: '/lists/',
  title: 'Lists and search',
  description: 'A page of records as a list: columns, pages and sorting, a search bar with suggestions, filters, group by and favourites, and buttons for the records chosen.',
  body: `
<p class="lead">A page whose layout is a ${c('list')} shows its model's records as a table: a page at a time, in the order a header asks for, each row opening its record. A search bar narrows it, groups it, and keeps searches as favourites; the page's buttons act on the records chosen.</p>

${code(
  'json',
  `
{
  "fieldia": "0.1",
  "id": "customers",
  "title": "Customers",
  "data": { "kind": "record", "model": "partner" },
  "fields": {
    "name": { "type": "char", "label": "Name" },
    "country_id": { "type": "many2one", "label": "Country", "relation": "country" },
    "state": { "type": "selection", "label": "Status", "options": [
      { "value": "active", "label": "Active" }, { "value": "blocked", "label": "Blocked" } ] },
    "credit_limit": { "type": "monetary", "label": "Credit limit", "currencyField": "currency_id" },
    "currency_id": { "type": "many2one", "label": "Currency", "relation": "currency" }
  },
  "layout": {
    "type": "list",
    "id": "customers-list",
    "columns": ["name", "country_id", "state", "credit_limit"],
    "sort": [{ "field": "name" }],
    "pageSize": 40,
    "searchFields": ["name", "country_id", "state"],
    "filters": [
      { "id": "active", "label": "Active", "filter": [{ "field": "state", "op": "=", "value": "active" }] },
      { "id": "big", "label": "Credit over 100,000", "filter": [{ "field": "credit_limit", "op": ">", "value": 100000 }] }
    ],
    "defaultFilters": ["active"],
    "groupBy": ["country_id", "state"],
    "actions": [{ "type": "button", "id": "archive", "label": "Archive", "action": "archive", "confirm": "Archive the chosen customers?" }]
  }
}`
)}

<table>
  <thead><tr><th>Key</th><th>What it does</th></tr></thead>
  <tbody>
    <tr><td>${c('columns')}</td><td>The fields shown, in order. Each value reads as the form shows it: a choice by its label, a link by its record's name, an amount in its currency — a ${c('currencyField')} is fetched though it is not a column.</td></tr>
    <tr><td>${c('sort')}</td><td>The order the list opens in. A header click puts its column first, then the other way; this order breaks the ties.</td></tr>
    <tr><td>${c('pageSize')}</td><td>Records to a page, 1 to 500; 40 when left out.</td></tr>
    <tr><td>${c('searchFields')}</td><td>The fields typed text is looked for in; the columns when left out.</td></tr>
    <tr><td>${c('filters')} · ${c('defaultFilters')}</td><td>Named filters for the menu, and the ones the list starts with. A filter compares with values, never with another field.</td></tr>
    <tr><td>${c('groupBy')}</td><td>The fields the menu offers to group by.</td></tr>
    <tr><td>${c('actions')}</td><td>Buttons for the records chosen. A ${c('confirm')} asks first.</td></tr>
  </tbody>
</table>
<p>A list shows records, so its page's ${c('data')} is a record's: the page check refuses a list of responses, and a column, a sort, a search field or a group that names no field.</p>

<h2 id="data">The records, from your data source</h2>
<p>Two more methods of the <a href="/data/">data source</a> feed a list:</p>
${code(
  'ts',
  `
list?(request: { model, fields, filter, sort, offset, limit }): Promise<{ records: { id, values }[]; total: number }>;
groups?(request: { model, field, filter }): Promise<{ value, label, count }[]>;`
)}
<p>${c('filter')} arrives resolved, as a link's search filter does: ${c('{ any: [...] }')} is an OR, ${c('{ all: [...] }')} an AND. ${c('sort')} is ${c('[{ field, desc? }]')}. For ${c('groups')}, a group's ${c('value')} is what records share (a linked record's id), ${c('null')} for the records with none; the list asks for each group's records with that value as one more condition. ${c('createMemoryDataSource()')} does both, empty values last whichever way a list is sorted.</p>

<h2 id="search">The search bar</h2>
<ul>
  <li><strong>Typing</strong> offers the ways to search it: <em>Search Name for: nile</em> in each text field and link, a choice whose label matches (<em>Status: Active</em>), a number where it is one. <kbd>↑</kbd> <kbd>↓</kbd> and <kbd>Enter</kbd> take one, <kbd>Escape</kbd> puts them away.</li>
  <li><strong>Chips</strong> show what applies. Values searched in one field share a chip, any of them (<em>Name: nile or amira</em>); chips all apply together. <kbd>Backspace</kbd> in the empty box takes the last one away; each has its ×.</li>
  <li><strong>Filters</strong> turn on and off from the menu, any of the ones on; <em>Add a custom filter</em> builds one from a field, a condition that suits its kind, and a value.</li>
  <li><strong>Group By</strong> groups by one field, then another inside it: a row for each value, with how many records have it, opening into the next field's groups or into its records, a page at a time.</li>
  <li><strong>Favourites</strong> keep the search on screen by name, one of them used by default when the list opens. They are kept where the viewer keeps a person's choices: its ${c('preferences')} store, the browser's storage unless you give one.</li>
</ul>

<h2 id="app">Opening and acting on records</h2>
<p>A row opens its record by a click or by <kbd>Enter</kbd>; the app decides what that means. A list's button hands the app the records chosen, as ${c('recordIds')}, in the order they were chosen:</p>
${code(
  'ts',
  `
mountViewer(host, {
  page: customers,
  dataSource,
  onOpenRecord: (id) => router.navigate(\`/customers/\${id}\`),
  onAction: ({ action, recordIds }) => action === 'archive' && api.archive(recordIds),
});`
)}
<p>In React it is the ${c('onOpenRecord')} prop, in Vue the ${c('@open-record')} event, in Angular the ${c('(openRecord)')} output. After a button, the list asks for its records again.</p>

<h2 id="details">What it takes care of</h2>
<ul>
  <li><strong>A plain table.</strong> Headers that sort say so with ${c('aria-sort')}; rows take the focus, <kbd>↑</kbd> <kbd>↓</kbd> move between them and <kbd>Space</kbd> chooses one. It reads the same in every binding and in the script bundle.</li>
  <li><strong>Each value in its own direction.</strong> On a right-to-left page a phone number or an amount still reads left to right.</li>
  <li><strong>A narrow screen.</strong> The table scrolls inside its own box; the menu's groups stack.</li>
  <li><strong>Four languages</strong>, as all of Fieldia's own words are.</li>
</ul>
`,
};
