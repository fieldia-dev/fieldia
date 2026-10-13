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

How the map sits in its page: `height` is pixels, or `fill` (as tall as the
element it is put in), as tall as the window allows (320 to 640 pixels) unless
said; `gestures: "all"` lets the map take every gesture — one finger pans, the
wheel zooms with no key held — where it is most of its page (unless said, one
finger and the wheel scroll the page past it); `fitZoom` is the closest it comes
when it fits its records, 16 unless said.

Once the map is moved, "Search this area" says how many records the view holds,
"Search this area (24)", when the records on hand can tell (all the search
finds, and a view within any area already searched). Otherwise, with
`countArea: true` in the settings, the data source is asked: one record, its
`total` the count, a moment after the map stops, the request's `signal` aborted
when it moves again; or `countArea` is the app's own
`(filter, signal) => Promise<number>`. Each time it stops, the map's element
sends `fd-map-view` (it bubbles): `{ center, zoom, bounds, byPerson }`.

## A list's map in a page of your own

A page that is not Fieldia's — its own list, filters and address — shows a list's
map beside them with `mountListMap`. The app gives the page that describes the
records (a list with `map`), a data source or the records themselves, the
conditions they are found by, and what to do when the map asks for something; it
gets back the map.

```ts
import { mountListMap, azureMaps } from '@fieldia/map';

const map = mountListMap(element, {
  page,                                          // a list page with "map"
  provider: azureMaps({ key }),
  dataSource,                                    // or records: [{ id, values }, …]
  filter: () => yourSearch(),                    // the conditions the records are found by
  start: { center: { lat: 30.05, lng: 31.23 }, zoom: 13 },   // from the address: no fit at first
  countArea: true,
  onSearch: ({ kind, filter }) => { keep(kind, filter); map.reload(); },  // 'view', 'drawn' or 'region'
  onViewChange: ({ center, zoom, bounds, byPerson }) => writeTheAddress(center, zoom),
  onHighlight: (id) => lightYourRow(id),
  onOpenRecord: (id) => location.assign(`/homes/${id}`),
});
map.highlight(id);   // a row of yours under the pointer
map.reload();        // your search changed
map.destroy();
```

Also `locale` (a tag; the document's language unless said), `sort`, `icons`,
`isChosen` and `onChoose`, `actions` and `onAction`, `onSort` (Nearest first),
and every setting `mapListViews` takes. Without `onSearch` the map offers no
search. It brings its own base on its own element alone (a part hidden stays
hidden, words for a screen reader, its buttons) and Fieldia's colours as tokens,
light or dark by the page's `color-scheme`: set your own on `.fd-map-embed`
(`.fd-map-embed { --fd-accent: #375dfb; }`), and your rule wins whatever its
weight.

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

Pins that crowd are gathered as a list's map gathers them, again at each zoom:
a bubble with their count ("2 here: Delta Foods, Amira Clinics. Zoom in to see
them."), pressed to zoom in until they part, or to list them when they stand on
one spot. A place that moves is never hidden in a bubble: the pins that crowd
it are gathered under it, and it wears their count, still gliding, greying and
followed. Routes, reachable areas and fences read where places are, never where
a bubble stands.

## Areas by colour, reach and fences

Districts, zones or municipalities shaded in up to five steps of the page's
accent, with a legend. The borders are the app's: GeoJSON polygons given once
by name, loaded the first time a map shades them.

```ts
mapListViews({ provider, regions: { districts: () => fetch('/geo/districts.json').then((r) => r.json()) } });
```

On a list's map (`"regions": { "from": "districts", "key": "code", "field":
"district" }`) each area is shaded by its records, counted by the data source's
`groups` under the search; a press searches for them, and the other areas keep
their shades. On a form's map, a layer with `regions` is shaded by a number
among each border's properties (`shade`), and a press chooses an area into a
field (`choose`). The areas are one keyboard stop, the arrows going from one to
the next.

A layer with `reachable: { from, minutes, mode }` draws the area within some
minutes of a place: Azure Maps (by car), Mapbox (car, bike, foot), or the app's
own `reach({ at, minutes, mode })`. A map's `fences` run the page's own steps,
as a button's, when a place that moves goes into an area field (`area`) or a
reachable area (`within`), or comes out of it; never at first sight. They run in
the browser showing the map: what must happen once, your server watches.

A list's map with `heat` shows its records as a heat map from afar (each
weighing one, or `weight`), their pins back at the streets. Any map takes
`tools`: `satellite`, `traffic` (the provider's live traffic over the map),
`fullscreen`, `measure`, and on a list's map `nearest` (its records nearest the
reader first, the data source sorting by `near`). A provider with no satellite
images or no traffic shows no button for them.
Areas, reach, fences, the heat map and the tools each load with the first map
that has them.

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
zooms into a bubble, and Escape closes the card, back on its pin. A form's map
does the same, its bubbles saying whose pins they hold; the keys stay on the
pin, or the bubble, that holds the place they were on.

## Providers

| Provider | Road | Dark | Satellite | Traffic | Address search | Routes | Reachable area |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `azureMaps({ key })` or `({ token, clientId })` | yes | yes | yes | yes, from zoom 6, in dark colours on the dark map, drawn again every four minutes | yes, as people type | car, foot | car |
| `googleMaps({ key, region, logo })` (Map Tiles API) | yes | no | yes | yes, its traffic layer | Places API, as people type | car (with traffic), foot; bike where Google has bicycle routes, none in Egypt, Saudi Arabia, the UAE or Jordan (Routes API) | no: Google's Isochrones API is in preview, and Fieldia does not use it yet |
| `mapbox({ token, trafficStyle })` | yes | yes | yes | from `trafficStyle`, a style of yours with Mapbox Traffic's lines alone | yes, as people type | car (traffic), bike, foot | car, bike, foot |
| `tiles({ url, credit, trafficUrl, route, reach })` | the app's own map images | | | the app's own (`trafficUrl`) | the app's own | the app's own | the app's own |
| `openStreetMap()` | yes, **for demos only** | no | no | no | Photon, as people type, nearest first (or `{ search: 'nominatim' }`, on Enter) | OSRM's demo server, car only (or `osrmUrl`) | no |

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

An address with suggestions (`address-search` on a char field) keeps them to
the `countries` the page names (ISO codes; "UK" is read as "GB", a code no one
knows is left out and said in the console). Azure Maps is asked once for each
country, up to ten (an autocomplete request is a tenth of a Search
transaction); Google, for fifteen at most; Mapbox and Nominatim, for the list;
Photon's answers are kept to them. Nearest `near` first (or where the app's
maps open), so give a point in the page's own country: Azure ranks another
country's suggestions by their distance from it. Addresses come before shops
and malls where the provider says which are which (Google, Azure), and an
address field asks Azure for no postcodes alone. A suggestion of Azure's is
located when picked, asked of Azure's geocoding by its own address in its
structured form (its street, district, governorate or province, postcode and
country), and only there: a district named alike in another town is never
taken for it, as no hit outside its own admin districts is. Its city is read
from them each country's way (in Egypt and Saudi Arabia the governorate's
city: Zamalek is Cairo's; in the emirate of Abu Dhabi, the city it is in).
It is said to be only near (`precise: false`) when Azure is unsure of it, or
finds only the street for a house, the district for a street, the town for a
district; found nowhere in its own districts, no place is written (the field
says so under the box), and its parts still are. A search still waiting when
a suggestion is picked or the box is left is dropped, and Enter never searches
for the address a pick wrote.

Escape drops a search waiting or on its way, as a pick and leaving the box
do, and no search is said to be going once it is dropped. While one address
is typed, words asked for once (near the same place) show what they brought
again, however they come back (a letter taken back, Enter after Escape);
after a pick they are a new address's, asked for anew.

Google's costs, as its pricing pages put them (October 2026): a session of
suggestions ended by a pick bills its first 12 requests (Autocomplete
Requests) and the place's details (Place Details Essentials: its place, its
line and its parts are all three that SKU's fields, asked for whatever the
page keeps, as the parts name the country the line is written with); a session
never picked bills each request. A session's token goes with its first Place
Details alone: Google bills a token used again as no session. A route by car
asks for traffic, which makes it Compute Routes Pro; on foot (or by bike) with
up to 10 stops it is Essentials, 11 to 25 stops Pro, and Google refuses more
than 25.

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
blocks, whose panel sets its tools, its layers (places, routes, areas by colour,
the area within some minutes) and its fences with their steps. Give
`createDesigner` the app's `regionSets` (each set's name, key property, name
property and numbers) and a map's areas are offered from them.

MIT. Leaflet is BSD-2-Clause; its stylesheet is included with its licence.
