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
  "fieldia": "0.3",
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
    <tr><td>${c('filters')} · ${c('defaultFilters')}</td><td>Named filters for the menu, and the ones the list starts with. A filter compares with values, never with another field; or names a ${c('period')} a date falls in, counted from today — see <a href="#totals">lists that add up</a>.</td></tr>
    <tr><td>${c('groupBy')}</td><td>The fields the menu offers to group by; a date by its year, quarter, month, week or day.</td></tr>
    <tr><td>${c('actions')}</td><td>Buttons for the records chosen. A ${c('confirm')} asks first.</td></tr>
    <tr><td>${c('map')}</td><td>The records on a map too, beside the table or instead of it: see <a href="#map">on a map</a>.</td></tr>
    <tr><td>${c('calendar')}</td><td>The records on a calendar too, by day, week or month or as an agenda, a column for each person or room: see <a href="#calendar">on a calendar</a>.</td></tr>
    <tr><td>${c('cells')}</td><td>Each column's cells, by its field: a ${c('widget')} (${c('dot')}, a state's dot in ${c('options.colours')} or ${c('tones')}), a ${c('lead')} icon from another field's value, a ${c('width')} in characters, or in pixels for the whole column (${c('"200px"')}) as a tracker sizes its grid's (words past it end in “…”, a header cut short shows its whole name when pointed at; every column sized, the table keeps them and scrolls sideways in its card when wider), an ${c('align')}, a ${c('total')} (see <a href="#totals">lists that add up</a>), and its header's ${c('rule')} where the theme parts the columns (Fluent's): ${c('false')} for none, as a tracker draws a column people cannot size, or ${c('"42px"')} to set it in from the column's end, before the room a tracker keeps there for a row's tools. See <a href="#backlog">a backlog</a>.</td></tr>
    <tr><td>${c('choose')}</td><td>${c('false')}: no box to choose a row, and so no buttons for rows chosen.</td></tr>
    <tr><td>${c('sortable')}</td><td>${c('false')}: a ranked list, such as a backlog, keeps its own order (${c('sort')}): its headers are words, with no press and no arrow, the order still said by ${c('aria-sort')}.</td></tr>
    <tr><td>${c('search')} · ${c('filterFields')} · ${c('filterLabels')}</td><td>${c('"fields"')}: a keyword box and a list of values to tick for each of ${c('filterFields')}, in place of the search bar; ${c('filterLabels')} gives a filter its own, shorter name on the bar, by field (${c('{ "iteration": "Iteration" }')} for Iteration Path), translated with the page's words.</td></tr>
    <tr><td>${c('parentField')}</td><td>Rows nested under their parent by this link to the list's own records, with Expand all and Collapse all.</td></tr>
    <tr><td>${c('export')}</td><td>${c('true')}: Export in the list's bar. Off unless said, as Edit is: see <a href="#bulk">taking records away</a>.</td></tr>
    <tr><td>${c('bulkEdit')}</td><td>Edit, for the rows chosen: ${c('true')} offers the columns one value can set, a list of fields offers those. Off unless said: see <a href="#bulk">changing many at once</a>.</td></tr>
  </tbody>
</table>
<p>A list shows records, so its page's ${c('data')} is a record's: the page check refuses a list of responses, and a column, a sort, a search field or a group that names no field.</p>

<h2 id="data">The records, from your data source</h2>
<p>Two more methods of the <a href="/data/">data source</a> feed a list:</p>
${code(
  'ts',
  `
list?(request: { model, fields, filter, sort, offset, limit }): Promise<{ records: { id, values }[]; total: number }>;
groups?(request: { model, field, filter, interval?, weekStart?, timeZone? }): Promise<{ value, label, count }[]>;
totals?(request: { model, filter, totals, groupBy?, interval?, currencies? }): Promise<{ count, totals, groups?, currencies? }>;`
)}
<p>${c('filter')} arrives resolved, as a link's search filter does: ${c('{ any: [...] }')} is an OR, ${c('{ all: [...] }')} an AND. ${c('sort')} is ${c('[{ field, desc? }]')}; for a map's Nearest first, ${c('[{ field, near: { lat, lng, longitude? } }]')}: the records nearest that place first, those with no place last (the field a GeoJSON point, or a latitude whose pair ${c('longitude')} names). A source that cannot sort by distance leaves its order as it is. For ${c('groups')}, a group's ${c('value')} is what records share (a linked record's id), ${c('null')} for the records with none; the list asks for each group's records with that value as one more condition. ${c('createMemoryDataSource()')} does both, empty values last whichever way a list is sorted.</p>

<h2 id="totals">Lists that add up, and filter by time</h2>
<p>A column can add up: its ${c('cells')} entry says how — ${c('"sum"')}, ${c('"avg"')} (the average), ${c('"min"')} (the lowest), ${c('"max"')} (the highest) of a number, or the ${c('"count"')} of records holding a value in any column. A named filter can be a period a date falls in, counted from the day the list is looked at, so it is right every day. And a date in ${c('groupBy')} groups by its year, quarter, month, week or day.</p>
${code(
  'json',
  `
{
  "type": "list", "id": "invoices-list",
  "columns": ["name", "partner_id", "city", "invoice_date", "due_date", "state", "amount"],
  "cells": { "amount": { "total": "sum" } },
  "filters": [
    { "id": "overdue", "label": "Overdue", "filter": [{ "field": "state", "op": "=", "value": "sent" }], "period": { "field": "due_date", "is": "overdue" } },
    { "id": "this_month", "label": "This month", "period": { "field": "invoice_date", "is": "thisMonth" } }
  ],
  "groupBy": ["city", "invoice_date"]
}`
)}
<ul>
  <li><strong>A totals row</strong> under the list totals every record the search finds, not only the page shown; while rows are ticked, a row over it totals those (<em>3 selected</em>). Each <strong>Group By heading</strong> says its sums after its count: <em>Cairo (12) · EGP 4.3M</em>, an amount short there.</li>
  <li><strong>Money in one currency only.</strong> An amount whose currency each record keeps (${c('currencyField')}) is totalled within one currency: over records in more than one, no honest sum exists, and none is shown — never a wrong number. Pointed at, its empty cell says why. An amount in the field's own ${c('currency')} always adds up.</li>
  <li><strong>Periods</strong>: ${c('today')}, ${c('yesterday')}, ${c('thisWeek')}, ${c('lastWeek')}, ${c('thisMonth')}, ${c('lastMonth')}, ${c('thisYear')}, ${c('last7Days')}, ${c('last30Days')} (today the last of them) and ${c('overdue')} (any day before today, for a due date). A week starts on the page's language's first day: Saturday in Arabic, Monday elsewhere. Days are the page's time zone's (its ${c('timeZone')}), else the browser's; a date and time falls on the day it is there. A filter may hold a period and conditions, which hold together; a person's own filter offers <em>in the period</em> for a date, and kept as a favourite it is counted again each time it is used.</li>
  <li><strong>Group By a date</strong>: the menu offers its Year, Quarter, Month, Week and Day; the headings say them in words — <em>March 2026</em>, <em>Q1 2026</em>, <em>Week 12, 2026</em> (the ISO week holding most of its days) — in time order, those with no date last.</li>
  <li><strong>The viewer's clock</strong>: ${c('now')} (a function giving the date) is what periods count from, as a form's ${c('today()')} does; the computer's own unless given.</li>
</ul>
<p>Nothing new to filter: a period reaches the data source as plain conditions — ${c('{ field: "due_date", op: "<", value: "2026-10-14" }')}, or ${c('>=')} and ${c('<')} on a span's first days (on their first moments, as instants, for a date and time). The data source's optional ${c('totals')} adds up, and its ${c('groups')} groups a date by a span:</p>
${code(
  'ts',
  `
// Group By month: each group's value is its span's first day; the page writes its words.
groups({ model: 'invoice', field: 'invoice_date', filter, interval: 'month', weekStart: 1, timeZone: 'Africa/Cairo' })
  // → [{ value: '2026-09-01', label: '2026-09-01', count: 4 }, { value: '2026-10-01', label: '2026-10-01', count: 7 }, { value: null, label: '', count: 1 }]

// The totals row, the sums on each heading (groupBy), the rows ticked (one more condition: id in the ids).
totals({ model: 'invoice', filter, totals: { amount: ['sum'] }, groupBy: 'city', currencies: { amount: 'currency_id' } })
  // → { count: 23, totals: { amount: { sum: null } }, currencies: { amount: null },
  //     groups: [{ value: 'cairo', label: 'cairo', count: 12, totals: { amount: { sum: 4312550 } }, currencies: { amount: { id: 1, label: 'EGP' } } }, …] }`
)}
<p>${c('spanStart(value, interval, { weekStart, timeZone })')} from ${c('@fieldia/core')} finds the span a value falls in as the list counts it, for a source that groups in JavaScript; a backend groups by its own (SQL's ${c('date_trunc')}). A source without ${c('totals')} shows no totals — no row, no sums; one that leaves ${c('interval')} out groups by the value itself, which the list then shows as it is. ${c('createMemoryDataSource()')} does it all. <a href="/demos/plain/?page=invoices&amp;skin=underline">Try the invoices</a>.</p>

<h2 id="search">The search bar</h2>
<ul>
  <li><strong>Typing</strong> offers the ways to search it: <em>Search Name for: nile</em> in each text field and link, a choice whose label matches (<em>Status: Active</em>), a number where it is one. <kbd>↑</kbd> <kbd>↓</kbd> and <kbd>Enter</kbd> take one, <kbd>Escape</kbd> puts them away.</li>
  <li><strong>Chips</strong> show what applies. Values searched in one field share a chip, any of them (<em>Name: nile or amira</em>); chips all apply together. <kbd>Backspace</kbd> in the empty box takes the last one away; each has its ×.</li>
  <li><strong>Filters</strong> turn on and off from the menu, any of the ones on; <em>Add a custom filter</em> builds one from a field, a condition that suits its kind, and a value — for a date, also a period: <em>Invoice date: This month</em>.</li>
  <li><strong>Group By</strong> groups by one field, then another inside it: a row for each value, with how many records have it (and their sums), opening into the next field's groups or into its records, a page at a time. A date groups by its year, quarter, month, week or day.</li>
  <li><strong>Favourites</strong> keep the search on screen by name, one of them used by default when the list opens. They are kept where the viewer keeps a person's choices: its ${c('preferences')} store, the browser's storage unless you give one.</li>
</ul>

<h2 id="backlog">A backlog: cells, a filter bar, rows under their parent</h2>
<p>A list can read as a work tracker's backlog. ${c('"search": "fields"')} puts a filter bar over it: <em>Filter by keyword</em> looks in the search fields, and each field of ${c('filterFields')} has a list of its values to tick — a choice's options, yes and no, the records a link or links hold — its button muted until values are ticked, then saying them. <kbd>↓</kbd> opens a list, the arrows move, <kbd>Space</kbd> ticks, <kbd>Escape</kbd> closes; × clears every filter, and the gear chooses which fields the bar offers, kept in the viewer's ${c('preferences')}. A default favourite search starts it with values ticked.</p>
${code(
  'json',
  `
{
  "type": "list", "id": "backlog", "columns": ["order", "work_type", "title", "state"],
  "choose": false, "sortable": false,
  "search": "fields", "filterFields": ["work_type", "state", "area", "iteration", "tags"],
  "filterLabels": { "iteration": "Iteration" },
  "parentField": "parent_id",
  "cells": {
    "order": { "align": "start", "width": "59px", "rule": false },
    "work_type": { "width": "36px" },
    "title": { "width": "911px", "rule": "42px", "lead": { "field": "work_type", "looks": { "bug": { "icon": "bug", "colour": "#cc293d" } } } },
    "state": { "width": "68px", "widget": "dot", "options": { "colours": { "new": "#b2b2b2", "active": "#007acc" } } }
  }
}`
)}
<p>Rows under a parent on the same page sit under it, each depth further in; a parent's toggle, or <kbd>→</kbd> and <kbd>←</kbd> on its row (turned round right to left), folds it. A row opened in a dialog comes back: when ${c('onOpenRecord')} answers with a promise, its row is lit (${c('aria-current')}) while the record is open, the list asks for its records again once it settles, and the row has the focus back. ${c('handle.openRecord(id)')} opens one the same way from the app; for a record named in the address as the page loads, ${c('{ lit: false }')} leaves its row unlit, as no row was pressed. ${c('handle.reload()')} asks again, after a new record is made. With the Fluent theme the table reads as the tracker draws it: small muted headers parted by short rules and standing a little in from the words under them, rows 36 pixels tall with no lines between them, a slim scroll bar. <a href="/demos/backlog/">Try the backlog</a>.</p>

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

<h2 id="bulk">Taking records away, changing many at once</h2>
<p><strong>Every record that matches.</strong> With every row on show ticked, the bar offers <em>Select all 1,284 that match</em>. The list asks your source once for their ids (${c('list({ …, allIds: true, limit: 0 })')}), and its buttons, Export and Edit then get every one; turning a page keeps them ticked, a new search, Clear or the header's box lets them go. A source that answers with fewer ids than match is never called “all”: the bar says <em>1,000 of 1,284 could be selected</em>. A source that ignores ${c('allIds')} is read through a page at a time, its own page size kept, up to 10,000 ids, and says how many of how many past that.</p>
<p><strong>Export</strong>, in the list's bar, writes the rows ticked — or, none ticked, every record the search finds — as an Excel workbook or a CSV file named after the list and the day (<em>Contacts 2026-10-16.xlsx</em>): the columns the list shows, in its order, under a header row, each value as a person reads it there — a choice by its label, a link by its record's name, yes or no in words. In the workbook a number, an amount and a day stay numbers, in the format the list reads them in (an amount with its currency, <em>E£ 250,000.00</em>, a dinar's three places), so they still add up and sort; its header row stays in view and filters; a page read right to left gives a sheet that runs right to left. The workbook is written in the browser, in the list's part, with no library. A CSV file is marked as UTF-8, its values parted by a comma, or by a semicolon where the page's language writes a decimal comma, as a spreadsheet there reads it. The browser writes at most 50,000 records and says how many it left out; your source's ${c('exportRecords')} writes a bigger one on the server (see <a href="/data/#many">many records at once</a>). A list offers it with ${c('"export": true')}: off unless asked, so an app that asks for neither Export nor Edit shows no new button.</p>
<p><strong>Edit</strong>, with ${c('bulkEdit')}, sets one field to one value in each record chosen. A dialog asks the field, then the value in that field's own box, with its rules: a required field cannot be emptied, a number keeps its least and most. Then the question — <em>Update 24 records? Status becomes “Customer”.</em> — and the records are written: by your source's ${c('writeMany')}, a thousand at a time, or by ${c('save')} per record, four at once, each with the version it was listed at, so a record changed since is refused rather than written over. A record its row says this person may not change (${c('can.edit')}, ${c('can.readonlyFields')}) is never sent; what the source refuses is named with its reason; the rest stays done. What was not changed stays chosen, and the list says, record by record, why: <em>Giza Plaza: A blocked contact's status is changed by the credit team.</em></p>
${code(
  'json',
  `
{
  "type": "list", "id": "contacts", "columns": ["name", "company", "state", "owner_id", "newsletter"],
  "bulkEdit": ["state", "owner_id", "newsletter"],
  "export": true
}`
)}
<p>A field one value cannot set — links of many, a table of lines, files, a read-only or worked-out field — is never offered, and the page check refuses one named. The fields a ${c('bulkEdit')} of ${c('true')} offers are ${c('bulkEditFields(page, list)')} from ${c('@fieldia/core')}. <a href="/demos/plain/?page=contacts&skin=underline">Try it on 1,284 contacts</a>.</p>

<h2 id="print">On paper</h2>
<p><strong>Print</strong>, in the list's bar with ${c('"print": true')}, prints every record the search finds — each page of them asked of your source, as Export asks for every match, up to 10,000, saying how many it left out past that — the columns as the list shows them, each value as its cell says it, under the list's Group By headings with their counts and their sums in their columns, the totals under them all. Over them: the list's title, its filters in words, how many, the day it was printed, and the page's ${c('print')} logo and words. The list itself is left off the paper, and the printout goes once it is printed. Ctrl+P alone prints the rows on screen, without the bar and the boxes. <a href="/demos/plain/?page=invoices&amp;skin=underline">Print the invoices</a>, grouped by customer.</p>
${code(
  'json',
  `
{ "type": "list", "id": "invoices", "columns": ["name", "partner_id", "invoice_date", "amount"],
  "cells": { "amount": { "total": "sum" } }, "groupBy": ["partner_id"], "print": true }`
)}

<h2 id="map">On a map</h2>
<p>With ${c('map')}, a list shows its records on a map as well, drawn by ${c('@fieldia/map')} on the provider the app chooses. The map and the table share one search and one choice: a pin lights its row and a row its pin, a home chosen on its card is ticked in the table, and the list's buttons act on it. A pin opens a card with the record's picture, a few of its fields, a box to choose it and a button to open it; pins that crowd become a bubble with their count. Once the map is moved, <em>Search this area</em> puts the area into the search bar as a search of its own; the map's own tools draw one instead — a polygon, a box or a circle, by mouse, finger or keys — searched as <em>In the area drawn</em>.</p>
${code(
  'json',
  `
"map": {
  "latitude": "lat",
  "longitude": "lng",
  "pin": { "label": "price", "money": { "home": "EGP" }, "tones": [{ "tone": "info", "when": "offer == 'rent'" }] },
  "card": {
    "title": "name", "image": "photo", "href": "link", "labels": false, "lead": true,
    "fields": ["price", ["district", { "field": "bedrooms", "unit": { "one": "bedroom", "other": "bedrooms" } }]]
  },
  "view": "both"
}`
)}
<table>
  <thead><tr><th>Key</th><th>What it does</th></tr></thead>
  <tbody>
    <tr><td>${c('point')} · ${c('latitude')} ${c('longitude')}</td><td>Where each record is: a ${c('json')} field holding a GeoJSON Point, or two number fields. A record with neither is left off the map, and the map says how many are.</td></tr>
    <tr><td>${c('pin')}</td><td>Its ${c('look')} — ${c('pin')}, ${c('label')} (its words: a price, a name, minutes away), ${c('icon')} (a car, a scooter, a bike, a shop, Fieldia's own or the app's), ${c('photo')} (a round picture, a courier's face), ${c('dot')}; ${c('label')} the field it says, short as a pin needs (<em>E£9.5M</em>); ${c('icon')}, or ${c('iconField')} for each record's own; ${c('image')}; ${c('turn')}, a number field in degrees, which way it faces; ${c('tones')}, its colour while a condition holds, as a field's are; or ${c('widget')}, the app's own pin by name. An amount's ${c('money')} on the pin, over its field's own (<a href="/fields/#money">how an amount is written</a>): short unless ${c('short')} is ${c('false')}, ${c('home')} the currency left unsaid — <em>13.9M</em>, and <em>$ 450K</em> for another — and its field's ${c('per')}, <em>25K/month</em> on a rent.</td></tr>
    <tr><td>${c('card')}</td><td>Its ${c('title')} (the first column when left out), its ${c('image')}, the lines it shows (${c('fields')}), and ${c('open')}: a button to open the record unless ${c('false')}. A line is a field, a field with words after its value — ${c('{ "field": "area_m2", "unit": "m²" }')}, or ${c('{ "one": "bedroom", "other": "bedrooms" }')} for the plural the number needs — or several on one line, parted by a dot: <em>Sheikh Zayed · 4 bedrooms · 280 m²</em>. ${c('labels')}: ${c('false')} writes the lines bare, their labels said to a screen reader alone; ${c('lead')}: ${c('true')} makes the first line larger and bold, as a home's price heads its card; ${c('href')}: a text field holding the record's address on the web, so its title and picture are links, opened in a new tab or copied as links are; ${c('choose')}: ${c('false')} leaves the box to choose off a map people only look at, a buyer's. Each of the record's words keeps its own direction: an English name on an Arabic page reads as it was typed.</td></tr>
    <tr><td>${c('cluster')}</td><td>Pins that crowd become a bubble, unless ${c('false')}: then each is drawn on its own, and pins near one another overlap, one under another out of a pointer's reach (the keys still reach each).</td></tr>
    <tr><td>${c('view')}</td><td>How the list opens: ${c('list')}, ${c('map')} or ${c('both')} side by side (the map over the table on a narrow screen). People switch between them over the records.</td></tr>
    <tr><td>${c('limit')}</td><td>The most records the map shows, 500 when left out; past it, the map says how many it shows of how many.</td></tr>
    <tr><td>${c('height')}</td><td>How tall the map is: pixels, or ${c('fill')}, as tall as the element it is put in (in a page of your own: <a href="/maps/#own-page">a map in your page</a>). As tall as the window allows, 320 to 640 pixels, when left out.</td></tr>
    <tr><td>${c('gestures')}</td><td>${c('shared')} when left out: one finger and the wheel scroll the page past the map, two fingers or <kbd>Ctrl</kbd> with the wheel move it. ${c('all')}: the map takes every gesture, one finger pans and the wheel zooms, for a page that is mostly its map.</td></tr>
    <tr><td>${c('fitZoom')}</td><td>The closest the map comes when it fits its records in view: 16 when left out; 14 keeps a neighbourhood round a lone record.</td></tr>
  </tbody>
</table>
<p>The app gives the list its map, as it gives the viewer widgets:</p>
${code(
  'ts',
  `
import { mapListViews, azureMaps } from '@fieldia/map';

mountViewer(host, {
  page: homes,
  dataSource,
  listViews: mapListViews({ provider: azureMaps({ key }), center: { lat: 30.04, lng: 31.24 } }),
});`
)}
<p>An app's own pin is a function given by name, ${c("pins: { courier: (record, { document }) => element }")}, and drawn wherever a page says ${c('"widget": "courier"')}. ${c("homeCurrency: 'EGP'")} in the map's settings is the currency the app's pins leave unsaid, unless a page says its own. <em>Search this area</em> asks the data source for the records within the map's view: ${c('between')} on a latitude and a longitude, or the ${c('within')} condition on a point, ${c('{ south, west, north, east }')} in degrees. An area drawn asks for ${c('within')} with ${c('{ polygon: [[lng, lat], …] }')} or ${c('{ center: [lng, lat], radius }')} in metres, and on a latitude field ${c('longitude')} names the field of its longitude. ${c('createMemoryDataSource()')} answers them all; a server's adapter turns them into its own query. Once the map is moved, the button says how many records the view holds, <em>Search this area (24)</em>, when the records on hand can tell; with ${c('countArea: true')} in the maps' settings the data source is asked for the rest (one record, its ${c('total')}), a moment after the map stops. Each time the map stops it sends ${c('fd-map-view')} from its element, ${c('{ center, zoom, bounds, byPerson }')}, for an app that keeps the view in its address. <a href="/demos/plain/?page=map-homes&skin=outlined">Try the homes</a> · <a href="/demos/plain/?page=map-couriers&skin=outlined">try the couriers</a>.</p>

<h2 id="calendar">On a calendar</h2>
<p>With ${c('calendar')}, a list offers <em>Calendar</em> beside its table, drawn by ${c('@fieldia/calendar')}: its records by day, week or month, or as an agenda of the week to come, which a phone opens on. The day has a column for each person or room the page names; records that meet sit side by side, a whole day's sit over the hours, and a line marks now. The calendar keeps to the list's search, filters and favourites.</p>
${code(
  'json',
  `
"calendar": {
  "start": "start", "end": "stop", "title": "patient",
  "colour": "service", "resource": "doctor",
  "views": ["day", "week", "month", "agenda"], "view": "day", "opens": "calendar",
  "firstDay": 6, "hours": { "start": 9, "end": 18 }, "slot": 15
}`
)}
<table>
  <thead><tr><th>Key</th><th>What it does</th></tr></thead>
  <tbody>
    <tr><td>${c('start')} · ${c('end')}</td><td>When each record starts and ends: two ${c('datetime')} fields, or two ${c('date')} fields for records of whole days. With no ${c('end')}, a record lasts an hour (a day) and cannot be stretched. The page check refuses an end of another kind than its start.</td></tr>
    <tr><td>${c('title')}</td><td>The words on each record: a patient, a customer.</td></tr>
    <tr><td>${c('colour')}</td><td>A field whose value colours each record, the same value the same colour, as a tint that reads light and dark; a value that is a colour (${c('#0f766e')}) is used as it is.</td></tr>
    <tr><td>${c('resource')}</td><td>Who or what each record is with (a link, a choice, text or a whole number): a column for each in the day view, and a record dragged into another's column is theirs. A link's columns are the records its model's ${c('search')} finds.</td></tr>
    <tr><td>${c('views')} · ${c('view')}</td><td>The views offered, of ${c('day')}, ${c('week')}, ${c('month')} and ${c('agenda')}, all four when left out; and the one shown first, the first of them unless said.</td></tr>
    <tr><td>${c('opens')}</td><td>${c('calendar')}: the list opens on its calendar; its table when left out.</td></tr>
    <tr><td>${c('firstDay')}</td><td>The week's first day, ${c('0')} Sunday to ${c('6')} Saturday: Saturday in Arabic and Monday in English, French and German when left out.</td></tr>
    <tr><td>${c('hours')} · ${c('slot')}</td><td>The hours the day and the week show, 8 to 20 when left out (a record outside them stretches them), and the minutes a slot holds and a drag moves by: 15, 30 or 60.</td></tr>
  </tbody>
</table>
<p>People drag a record to another time, day or person, and stretch it by its lower edge; from the keyboard, <kbd>M</kbd> on a record opens <em>Move to…</em> for its day, its time and its person, and the arrow keys move between the slots. Each move is saved at once through the data source's ${c('save')}, with the changed fields alone and the row's ${c('version')}, and <em>Undo</em> puts it back; a refused save puts it back and says why. A record whose row says ${c('can: { edit: false }')} stays where it is, saying why. An empty slot pressed, or dragged across, makes a new record: the viewer's ${c('onNewRecord')} gets its start, end and person, or, without it, the record's page from ${c('pages')} opens in a dialog with them filled in.</p>
${code(
  'ts',
  `
import { calendarListViews } from '@fieldia/calendar';

mountViewer(host, {
  page: appointments,
  dataSource,
  listViews: calendarListViews(), // with a map too: { ...mapListViews(settings), ...calendarListViews() }
  onNewRecord: (values) => openAppointment(null, values), // or pages: { 'clinic.appointment': appointmentPage }
});`
)}
<p>A move saves the fields it changes and no others, with ${c('partial: true')} (see <a href="/data/#requests">what save receives</a>), and Undo saves what they held before. A record whose start, end or person its list row puts in ${c('can.readonlyFields')} or ${c('can.hiddenFields')}, or the page marks ${c('readonly')}, offers no way to move it. Too many records in one slot to read side by side leave room for <em>+N more</em>, which lists them all. Move to… refuses a day more than ten years from the record's, so a year typed short (26) or long (2062) is caught, and names the year whenever the move leaves the record's own.</p>
<p>The calendar asks ${c('list')} for the records of the span it shows: those starting before it ends and ending after it starts, as ${c('date')} keys or ISO instants, with the list's own search. Its code loads the first time a calendar is shown, in a chunk of its own. A list's switcher takes an app's own views the same way: a function by name in ${c('listViews')}, offered on a list with the page option of its name, or where its ${c('offers(node)')} says, in its own words (${c('label(locale)')}). <a href="/demos/plain/?page=clinic-calendar&skin=outlined">Try the clinic</a> · <a href="/demos/plain/?page=booking-week&skin=outlined">try the booking desk</a>.</p>

<h2 id="details">What it takes care of</h2>
<ul>
  <li><strong>A plain table.</strong> Headers that sort say so with ${c('aria-sort')}; rows take the focus, <kbd>↑</kbd> <kbd>↓</kbd> move between them and <kbd>Space</kbd> chooses one. It reads the same in every binding and in the script bundle.</li>
  <li><strong>Each value in its own direction.</strong> On a right-to-left page a phone number or an amount still reads left to right.</li>
  <li><strong>A narrow screen.</strong> The table scrolls inside its own box; the menu's groups stack.</li>
  <li><strong>Four languages</strong>, as all of Fieldia's own words are.</li>
</ul>
`,
};
