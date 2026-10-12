import { c, code } from '../layout.mjs';

export default {
  path: '/maps/',
  title: 'Maps',
  description: 'Maps in Fieldia pages: a place and an area as fields, a list’s records on a map, a map on a form with its layers, live places and routes, areas by colour, reachable areas and fences, on the map provider you choose.',
  body: `
<p class="lead">${c('@fieldia/map')} puts maps in Fieldia pages, on the provider you choose: Azure Maps, Google, Mapbox, your own map images, or OpenStreetMap's for a demo. The page says what each map shows, by field name; the app gives the maps once.</p>

<h2 id="wiring">Giving the viewer its maps</h2>
<p>Three parts, each loaded only where a page uses it: the fields (${c('mapWidgets')}), a list's records on a map (${c('mapListViews')}), and a map on a form (${c('mapParts')}). They share one set of settings: the provider above all.</p>
${code(
  'ts',
  `
import { azureMaps, mapListViews, mapParts, mapWidgets } from '@fieldia/map';

const maps = { provider: azureMaps({ token: () => fetch('/maps/token').then((r) => r.text()) }), center: { lat: 30.04, lng: 31.24 } };

mountViewer(host, {
  page,
  dataSource,
  widgets: mapWidgets(maps),        // "widget": "place" and "area"
  listViews: mapListViews(maps),    // a list with "map"
  maps: mapParts(maps),             // "type": "map" on a form
});`
)}
<p>In React they are props of the same names, in Vue props, in Angular inputs. Leaflet, the map engine, loads the first time a map is shown, and a provider's routes the first time one is asked for: a page without a map carries none of it.</p>

<h2 id="fields">A place and an area</h2>
<p>A place is a field set by a press on the map, a dragged pin, an address found as it is typed, typed coordinates or “My location”; an area is a polygon, a box or a circle. An address with suggestions (${c('address-search')} on a char field) is the same search without a map: a suggestion picked fills a place field (${c('placeField')}) and an address's parts (${c('partsField')}), within the countries the page names (${c('countries')}), near a point (${c('near')}) or where the app's maps open. See <a href="/fields/#map">maps among the fields</a>.</p>

<h2 id="list">A list's records on a map</h2>
<p>A list page with ${c('map')} shows its records on a map beside the table or instead of it, its pins drawn as the page says, its search and choice shared with the table. See <a href="/lists/#map">lists on a map</a>.</p>

<h2 id="form">A map on a form</h2>
<p>A part of type ${c('map')} shows the record's places as layers. A layer is the record's own place, a place for each of its lines, a route between them, or the reader's own place:</p>
${code(
  'json',
  `
{ "type": "map", "id": "order-map", "label": "Where your order is", "layers": [
  { "id": "kitchen", "label": "Kitchen", "latitude": "kitchen_lat", "longitude": "kitchen_lng",
    "pin": { "look": "icon", "icon": "food" } },
  { "id": "door", "label": "Your door", "point": "door", "pin": { "look": "icon", "icon": "home" } },
  { "id": "courier", "label": "Courier", "latitude": "courier_lat", "longitude": "courier_lng",
    "pin": { "look": "photo", "image": "courier_photo", "label": "eta_text" },
    "live": { "staleAfter": 60, "follow": true } },
  { "id": "way", "route": { "from": "courier", "to": "door", "progress": true,
    "write": { "seconds": "eta_seconds", "metres": "distance_m", "line": "route_line" } } },
  { "id": "me", "label": "You", "myLocation": true }
] }`
)}
<table>
  <thead><tr><th>A layer's key</th><th>What it does</th></tr></thead>
  <tbody>
    <tr><td>${c('point')} · ${c('latitude')} ${c('longitude')}</td><td>Where the place is kept: a ${c('json')} field holding a GeoJSON Point, or two number fields.</td></tr>
    <tr><td>${c('lines')}</td><td>A field of lines: a place for each line, read from the line's own fields (a round's stops, numbered by a field).</td></tr>
    <tr><td>${c('label')}</td><td>Words for the layer: its pins are named by them for a screen reader, “Courier, Mona Adel, 4 min”.</td></tr>
    <tr><td>${c('pin')} · ${c('card')}</td><td>As a list's map has them: a pin, words, an icon, a round photo or a dot, coloured by condition; a card with its title and fields.</td></tr>
    <tr><td>${c('live')}</td><td>A place that moves: see below.</td></tr>
    <tr><td>${c('route')}</td><td>A line along the roads: see below.</td></tr>
    <tr><td>${c('myLocation')}</td><td>The reader's own place, from the browser once they press its button and allow it.</td></tr>
    <tr><td>${c('invisible')}</td><td>A condition, as any part's: no route while an order is still being made.</td></tr>
  </tbody>
</table>
<p>Pins that crowd are gathered as a list's map gathers them, again at each zoom: a bubble with their count, named for a screen reader by whose they are (“2 here: Delta Foods, Amira Clinics. Zoom in to see them.”), pressed to zoom in until they part, or to list them when they stand on one spot. A place that moves is never hidden in a bubble: the pins that crowd it are gathered under it, and it wears their count. Routes, reachable areas and fences read where the places are, never where a bubble stands.</p>
<p><a href="/demos/plain/?page=map-order&skin=outlined&readonly=1">Try the order on its way</a> · <a href="/demos/plain/?page=map-round&skin=outlined">try a delivery round</a>.</p>

<h2 id="live">Places that move</h2>
<p>When a layer's fields change, its pin glides to the new place: along its route when it is on it, straight otherwise (and at once for a reader who asks for less motion). The app sends each new place as a courier's app sends it, with ${c('setValues')}:</p>
${code(
  'ts',
  `
handle.form.setValues({ courier_lat: 30.0512, courier_lng: 31.2337 });`
)}
<p>With ${c('staleAfter')}, a place without news for that many seconds greys and says when it was last seen, in the page's language. With ${c('follow')}, the map keeps it in view, until the person moves the map; then a Follow button brings it back.</p>

<h2 id="routes">Routes</h2>
<p>A route runs ${c('from')} a place (or the reader's own) ${c('to')} another, or ${c('through')} a layer of lines in their order, by ${c('car')}, ${c('bike')} or ${c('foot')}. With ${c('progress')}, the part travelled fades as ${c('from')} moves along it, and the time and distance left are worked out as it goes. ${c('write')} names the record's fields its seconds, metres and line go into: values for words (“4 min”) and for keeping. A route is asked for again when its ends change, or when its traveller leaves it, at most every ten seconds.</p>
<table>
  <thead><tr><th>Provider</th><th>Routes</th></tr></thead>
  <tbody>
    <tr><td>${c('azureMaps')}</td><td>By car and on foot (Route Directions of 2025), with the time in traffic when it gives one.</td></tr>
    <tr><td>${c('googleMaps')}</td><td>By car, bike and on foot, through Google's Routes API: enable it for the key.</td></tr>
    <tr><td>${c('mapbox')}</td><td>By car (with traffic), bike and on foot.</td></tr>
    <tr><td>${c('openStreetMap')}</td><td>OSRM's public demo server, by car alone, for trying things out; or a copy you run (${c('osrmUrl')}).</td></tr>
    <tr><td>${c('tiles')}, or any</td><td>The app's own: ${c('route: ({ points, mode }) => ({ line, metres, seconds })')}.</td></tr>
  </tbody>
</table>
<p>Values a route writes are changes to the record, as the page asks: they are saved as any change is. A page that only follows an order, and keeps nothing, is shown read-only.</p>

<h2 id="areas">Areas by colour</h2>
<p>Districts, zones or municipalities, shaded in up to five steps of the page's accent, with a legend. Their borders are the app's, never Fieldia's: GeoJSON polygons, from your own data or an open source such as OpenStreetMap or geoBoundaries, given to the maps once by name, and loaded the first time a map shades them.</p>
${code(
  'ts',
  `
const maps = {
  provider,
  regions: { districts: () => fetch('/geo/districts.json').then((r) => r.json()) },
};`
)}
<p>On a list's map, each area is shaded by its records: those whose ${c('field')} holds the area's ${c('key')}, counted by the data source's ${c('groups')} under the search. A press searches for an area's records (“In Zamalek”), and the other areas keep their shades. On a form's map, an area is shaded by a number among its own properties, and a press chooses it into a field.</p>
${code(
  'json',
  `
"map": { "point": "place", "regions": { "from": "districts", "key": "code", "name": "name", "field": "district" } }

{ "id": "districts", "label": "Delivery fee, EGP",
  "regions": { "from": "districts", "key": "code", "name": "name", "shade": "fee", "choose": "district" } }`
)}
<p>Pointing at an area lights it and says its name and number. On the keyboard the areas are one stop: the arrow keys go from one to the next in reading order, Enter presses one. <a href="/demos/plain/?page=map-zones&skin=outlined">Try the orders by district</a> · <a href="/demos/plain/?page=map-kitchen&skin=outlined">try the kitchen's map</a>.</p>

<h2 id="heat">A heat map, and nearest first</h2>
<p>With ${c('heat')}, a list's map shows its records as a heat map while it is far out, each weighing one or the number its ${c('weight')} names, their pins coming back close in, at the streets. With the tool ${c('nearest')}, a button under the zoom puts the list in order from where the reader is (the middle of the map, if they do not say): the table and the map both, the data source asked with ${c('sort: [{ field, near }]')}. <a href="/demos/plain/?page=map-heat&skin=outlined">Try the heat map</a>.</p>

<h2 id="reach">The area within some minutes, and fences</h2>
<p>A layer with ${c('reachable')} draws the area within some minutes of a place (or of the reader's own), by car unless said, asked again once the place has moved:</p>
${code(
  'json',
  `
{ "id": "near", "label": "Within 15 minutes' drive", "reachable": { "from": "kitchen", "minutes": 15 } }`
)}
<table>
  <thead><tr><th>Provider</th><th>The area within some minutes</th></tr></thead>
  <tbody>
    <tr><td>${c('azureMaps')}</td><td>By car (Route Range of 2025).</td></tr>
    <tr><td>${c('mapbox')}</td><td>By car, bike and on foot (Isochrone).</td></tr>
    <tr><td>${c('googleMaps')}, ${c('openStreetMap')}</td><td>None: the app's own, ${c('reach: ({ at, minutes, mode }) => ({ rings })')}.</td></tr>
  </tbody>
</table>
<p>A fence runs the page's own steps, as a button's, when a place that moves goes into an area or comes out of it: an area field, or a reachable area of the map. Never at first sight, when the place was there already:</p>
${code(
  'json',
  `
"fences": [{ "layer": "courier", "area": "drop_zone", "when": "enter",
  "steps": [{ "do": "set", "field": "arriving", "value": "true" }, { "do": "call", "action": "tell_customer" }] }]`
)}
<p>A fence runs in the browser that shows the map: for something that must happen once, whoever is looking, your server watches the place instead.</p>

<h2 id="tools">Tools under the zoom</h2>
<p>Any map, a field's, a list's or a form's, takes ${c('tools')}: ${c('satellite')} (no button where the provider has no satellite images), ${c('traffic')} (the provider's live traffic over the map, under its pins; no button where the provider has none), ${c('fullscreen')} (filling the window where the browser refuses the screen), ${c('measure')} (points clicked, or put at the cross with Space; its length said as it grows) and, on a list's map, ${c('nearest')}. Their code comes with the first map that has them.</p>
<table>
  <thead><tr><th>Provider</th><th>Live traffic</th></tr></thead>
  <tbody>
    <tr><td>${c('azureMaps')}</td><td>How each road flows against its free flow, from zoom 6, in darker colours on the dark map; drawn again every four minutes, as Azure's images go out of date.</td></tr>
    <tr><td>${c('googleMaps')}</td><td>Its traffic layer, a Map Tiles session of its own.</td></tr>
    <tr><td>${c('mapbox')}</td><td>From ${c('trafficStyle')}: a style of yours that draws Mapbox Traffic's lines and nothing else. Mapbox has no such style of its own to draw as images.</td></tr>
    <tr><td>${c('tiles')}</td><td>The app's own, from ${c('trafficUrl')}.</td></tr>
    <tr><td>${c('openStreetMap')}</td><td>None.</td></tr>
  </tbody>
</table>

<h2 id="designer">In the designer</h2>
<p>The screen editor offers a Map among its blocks when it is given ${c('maps')}: its panel sets its name, its height, its tools and its layers, each with the fields it reads, adds a route between two of them, areas by colour from the app's borders (${c('regionSets')}), the area within some minutes, and fences, each with the steps it runs, set as a button's are. A list's panel sets its map's tools, a heat map and its areas by colour. Try it draws the map, its places made up around the middle the app gives (${c('sampleCentre')}).</p>
`,
};
