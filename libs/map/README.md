# @fieldia/map

[Fieldia](https://fieldia.dev)'s maps: a **place** and an **area** as fields of a
form, a **list's records on a map**, and a **map on a form** with its layers,
places that move and routes along the roads, on the map provider you choose.
Built on [Leaflet](https://leafletjs.com), loaded only when a map is shown.

```sh
npm install @fieldia/map
```

```ts
import { mountViewer } from '@fieldia/viewer';
import { mapWidgets, azureMaps } from '@fieldia/map';

mountViewer(host, {
  page,
  dataSource,
  widgets: mapWidgets({
    provider: azureMaps({ token: () => fetch('/maps/token').then((r) => r.text()) }),
    center: { lat: 30.0444, lng: 31.2357 },
  }),
});
```

## Place

A point on a form: a press on the map, a dragged pin, an address found, typed
coordinates, or "My location". On a `json` field it is kept as a GeoJSON Point;
on a `float` field it keeps the latitude, with `longitudeField` naming the field
for the longitude.

```json
{ "type": "field", "id": "deliver_to", "field": "deliver_to", "widget": "place",
  "options": { "addressField": "street", "zoom": 17 } }
```

Options: `longitudeField`, `addressField` (filled from the address found, or
named from the point where the provider can, never over what a person typed),
`myLocation` and `search` (on unless `false`), `zoom`, `height`.

## Area

A polygon, a box or a circle, kept in a `json` field as a GeoJSON Feature whose
`properties.shape` says how it was drawn (a circle is its centre and
`properties.radius` in metres). Its points, corners and edge drag to change it,
the whole area drags to move it, and a point between two adds one.

```json
{ "type": "field", "id": "zone", "field": "zone", "widget": "area",
  "options": { "shapes": ["polygon", "box"], "areas": [{ "label": "Downtown", "value": { "type": "Polygon", "coordinates": [[[31.235, 30.04], [31.25, 30.04], [31.25, 30.055], [31.235, 30.04]]] } }] } }
```

Options: `shapes` (any of polygon, box, circle), `areas` (named areas to choose
instead of drawing), `height`.

## A list on a map

A list page with `map` shows its records on a map too, beside the table or
instead of it, sharing its search and its records chosen: a pin lights its row
and a row its pin, a pin opens a card (a picture, a few fields, Choose, Open),
pins that crowd become a bubble with their count, and "Search this area" puts
the map's view into the search bar.

```ts
import { mapListViews, azureMaps } from '@fieldia/map';

mountViewer(host, { page, dataSource, listViews: mapListViews({ provider: azureMaps({ key }) }) });
```

```json
"map": {
  "latitude": "lat", "longitude": "lng",
  "pin": { "label": "price", "tones": [{ "tone": "info", "when": "offer == 'rent'" }] },
  "card": { "title": "name", "image": "photo", "fields": ["price", "bedrooms"] },
  "view": "both"
}
```

Where each record is: `point` (a json field holding a GeoJSON Point), or
`latitude` and `longitude`. A pin's `look` is `pin`, `label`, `icon`, `photo`
or `dot`; `label` names the field it says (an amount or a number written short,
"E£9.5M"), `icon` or `iconField` its icon (the map's own car, arrow, scooter,
bike, bus, person, shop, food and flag, Fieldia's, or the app's `icons`),
`image` its photo, `turn` a number field in degrees (a car seen from above
turns whole; other icons keep upright, a pointer on their edge turning), and
`tones` its colour by condition. `widget` names the app's own pin, given as
`mapListViews({ pins: { name: (record, { document }) => element } })`. `card`
takes `title`, `image`, `fields` and `open`; `cluster: false` draws every pin
on its own, though pins near one another then overlap and a pointer cannot
reach one under another (the keys still reach each); `view` is `list`, `map` or `both`; `limit` is 500 unless said.

The map's own tools draw an area to search in: a polygon, a box or a circle,
by mouse, finger or keys, as the area field draws one. It becomes a search of
its own ("In the area drawn"), shown on the map until it leaves the search bar.

"Search this area" asks for `between` on a latitude and a longitude, or the
`within` condition on a point: `{ south, west, north, east }` in degrees, west
beyond east across the antimeridian. An area drawn asks for `within` with
`{ polygon: [[lng, lat], …] }` or `{ center: [lng, lat], radius }` in metres;
on a latitude field, `longitude` names the field of its longitude. The memory
data source answers all of them; a server's adapter turns them into its own
query.

A form with only a place or an area never carries the list map's code, its
styles or its words.

A card offers the list's own buttons too, each pressed for its record alone
("Assign", for this driver).

## A map on a form

A part of type `map` shows the record's places as layers: the record's own
place (`point`, or `latitude` and `longitude`), a place for each of its lines
(`lines`, read from the line's fields), a `route` between them, or the
reader's own place (`myLocation`). Give the viewer `maps: mapParts(settings)`.

```json
{ "type": "map", "id": "order-map", "label": "Where your order is", "layers": [
  { "id": "door", "label": "Your door", "point": "door", "pin": { "look": "icon", "icon": "home" } },
  { "id": "courier", "label": "Courier", "latitude": "courier_lat", "longitude": "courier_lng",
    "pin": { "look": "photo", "image": "courier_photo", "label": "eta_text" },
    "live": { "staleAfter": 60, "follow": true } },
  { "id": "way", "route": { "from": "courier", "to": "door", "progress": true,
    "write": { "seconds": "eta_seconds", "metres": "distance_m", "line": "route_line" } } }
] }
```

A place that moves glides to each new place its fields are given (along its
route when on it), greys and says when it was last seen after `staleAfter`
seconds without news, and with `follow` is kept in view until the person moves
the map. A route runs `from` a place `to` another or `through` a layer of
lines, by `car`, `bike` or `foot`; with `progress` the part travelled fades and
the time and distance left are kept up to date; `write` names the fields its
seconds, metres and line go into. Routes come from the provider (`route`),
loaded the first time one is asked for, or from the app's own `route` in the
settings.

## Without a mouse

Tab reaches the map, which shows a cross at its centre: the arrow keys move the
map, plus and minus zoom. On a place, Enter puts the place at the cross and the
arrow keys move the pin. On an area, Space puts a point at the cross, Enter
finishes, Backspace takes a point back, Escape stops; a grip moves with the
arrow keys and leaves with Delete. A scroll passes over a map to the page
unless Ctrl (⌘) is held, and on a phone one finger scrolls the page while two
move the map.

On a list's map, Tab goes from the map to each pin and bubble by its name;
Enter or Space opens a pin's card (Ctrl or ⌘ with it chooses the record) or
zooms into a bubble, and Escape closes the card, back on its pin.

## Providers

| Provider | Road | Dark | Satellite | Address search | Routes |
| --- | --- | --- | --- | --- | --- |
| `azureMaps({ key })` or `({ token, clientId })` | yes | yes | yes | yes, as people type | car, foot |
| `googleMaps({ key, region, logo })` (Map Tiles API) | yes | no | yes | Places API, as people type | car, bike, foot (Routes API) |
| `mapbox({ token })` | yes | yes | yes | yes, as people type | car (traffic), bike, foot |
| `tiles({ url, credit, route })` | the app's own map images | | | the app's own | the app's own |
| `openStreetMap()` | yes, **for demos only** | no | no | Photon, as people type, nearest first (or `{ search: 'nominatim' }`, on Enter) | OSRM's demo server, car only (or `osrmUrl`) |

Keys never live in Fieldia: pass one restricted to your sites, or a function
fetching a short-lived token from your server. Each provider's credits are shown
in the map's corner, and its mark where its terms ask. Read your provider's
terms on keeping search results: a place field keeps what it finds (Mapbox's
permanent geocoding is asked for by default). OpenStreetMap's public map images,
Photon's public server and Nominatim are for trying things out: their policies
treat an app in use as heavy use. Photon can run on your own server
(`openStreetMap({ photonUrl })`).

Suggestions come as people type where the provider allows it, nearest where the
map is looking first, each on two lines (the place, then where it is); Enter
takes the first. "My location" says how sure it is: a rough location (a
desktop's, placed by its network) shows the circle it may be anywhere in, says
how wide, and names no address from it.

Pass your own `search` (and `reverse`) to `mapWidgets` to use your own address
search with any provider.

## In the designer

`mapKinds({ locale })` gives the designer Place and Area for its toolbox, with
their settings (a place's address search, "My location", the field its address
goes into, the map's height; an area's shapes); pass the map widgets to the
designer and its editors too. A list page's panel has its Map: where each
record is, its pins, its card, and how the list opens. Give the screen editor
`listViews` and `maps` (and `sampleCentre`, where its made-up records and
places are) and Try it shows the maps; with `maps` it offers a Map among its
blocks, whose panel sets its layers and the routes between them.

MIT. Leaflet is BSD-2-Clause; its stylesheet is included with its licence.
