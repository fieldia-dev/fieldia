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
    <tr><td>${c('map')}</td><td>The records on a map too, beside the table or instead of it: see <a href="#map">on a map</a>.</td></tr>
    <tr><td>${c('cells')}</td><td>Each column's cells, by its field: a ${c('widget')} (${c('dot')}, a state's dot in ${c('options.colours')} or ${c('tones')}), a ${c('lead')} icon from another field's value, a ${c('width')} in characters, or in pixels for the whole column (${c('"200px"')}) as a tracker sizes its grid's (words past it end in “…”, a header cut short shows its whole name when pointed at; every column sized, the table keeps them and scrolls sideways in its card when wider), an ${c('align')}, and its header's ${c('rule')} where the theme parts the columns (Fluent's): ${c('false')} for none, as a tracker draws a column people cannot size, or ${c('"42px"')} to set it in from the column's end, before the room a tracker keeps there for a row's tools. See <a href="#backlog">a backlog</a>.</td></tr>
    <tr><td>${c('choose')}</td><td>${c('false')}: no box to choose a row, and so no buttons for rows chosen.</td></tr>
    <tr><td>${c('sortable')}</td><td>${c('false')}: a ranked list, such as a backlog, keeps its own order (${c('sort')}): its headers are words, with no press and no arrow, the order still said by ${c('aria-sort')}.</td></tr>
    <tr><td>${c('search')} · ${c('filterFields')} · ${c('filterLabels')}</td><td>${c('"fields"')}: a keyword box and a list of values to tick for each of ${c('filterFields')}, in place of the search bar; ${c('filterLabels')} gives a filter its own, shorter name on the bar, by field (${c('{ "iteration": "Iteration" }')} for Iteration Path), translated with the page's words.</td></tr>
    <tr><td>${c('parentField')}</td><td>Rows nested under their parent by this link to the list's own records, with Expand all and Collapse all.</td></tr>
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
<p>${c('filter')} arrives resolved, as a link's search filter does: ${c('{ any: [...] }')} is an OR, ${c('{ all: [...] }')} an AND. ${c('sort')} is ${c('[{ field, desc? }]')}; for a map's Nearest first, ${c('[{ field, near: { lat, lng, longitude? } }]')}: the records nearest that place first, those with no place last (the field a GeoJSON point, or a latitude whose pair ${c('longitude')} names). A source that cannot sort by distance leaves its order as it is. For ${c('groups')}, a group's ${c('value')} is what records share (a linked record's id), ${c('null')} for the records with none; the list asks for each group's records with that value as one more condition. ${c('createMemoryDataSource()')} does both, empty values last whichever way a list is sorted.</p>

<h2 id="search">The search bar</h2>
<ul>
  <li><strong>Typing</strong> offers the ways to search it: <em>Search Name for: nile</em> in each text field and link, a choice whose label matches (<em>Status: Active</em>), a number where it is one. <kbd>↑</kbd> <kbd>↓</kbd> and <kbd>Enter</kbd> take one, <kbd>Escape</kbd> puts them away.</li>
  <li><strong>Chips</strong> show what applies. Values searched in one field share a chip, any of them (<em>Name: nile or amira</em>); chips all apply together. <kbd>Backspace</kbd> in the empty box takes the last one away; each has its ×.</li>
  <li><strong>Filters</strong> turn on and off from the menu, any of the ones on; <em>Add a custom filter</em> builds one from a field, a condition that suits its kind, and a value.</li>
  <li><strong>Group By</strong> groups by one field, then another inside it: a row for each value, with how many records have it, opening into the next field's groups or into its records, a page at a time.</li>
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

<h2 id="details">What it takes care of</h2>
<ul>
  <li><strong>A plain table.</strong> Headers that sort say so with ${c('aria-sort')}; rows take the focus, <kbd>↑</kbd> <kbd>↓</kbd> move between them and <kbd>Space</kbd> chooses one. It reads the same in every binding and in the script bundle.</li>
  <li><strong>Each value in its own direction.</strong> On a right-to-left page a phone number or an amount still reads left to right.</li>
  <li><strong>A narrow screen.</strong> The table scrolls inside its own box; the menu's groups stack.</li>
  <li><strong>Four languages</strong>, as all of Fieldia's own words are.</li>
</ul>
`,
};
