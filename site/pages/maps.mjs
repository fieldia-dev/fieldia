import { c, code } from '../layout.mjs';

export default {
  path: '/maps/',
  title: 'Maps',
  description: 'Maps in Fieldia pages: a place and an area as fields, a list’s records on a map, and a map on a form with its layers, live places and routes, on the map provider you choose.',
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
<p>A place is a field set by a press on the map, a dragged pin, an address found as it is typed, typed coordinates or “My location”; an area is a polygon, a box or a circle. See <a href="/fields/#map">maps among the fields</a>.</p>

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

<h2 id="designer">In the designer</h2>
<p>The screen editor offers a Map among its blocks when it is given ${c('maps')}: its panel sets its name, its height and its layers, each with the fields it reads, and adds a route between two of them. Try it draws the map, its places made up around the middle the app gives (${c('sampleCentre')}).</p>
`,
};
