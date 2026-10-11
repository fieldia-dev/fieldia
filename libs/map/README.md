# @fieldia/map

[Fieldia](https://fieldia.dev)'s maps: a **place** and an **area** as fields of a
form, on the map provider you choose. Built on [Leaflet](https://leafletjs.com),
loaded only when a map is shown.

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

## Without a mouse

Tab reaches the map, which shows a cross at its centre: the arrow keys move the
map, plus and minus zoom. On a place, Enter puts the place at the cross and the
arrow keys move the pin. On an area, Space puts a point at the cross, Enter
finishes, Backspace takes a point back, Escape stops; a grip moves with the
arrow keys and leaves with Delete. A scroll passes over a map to the page
unless Ctrl (⌘) is held, and on a phone one finger scrolls the page while two
move the map.

## Providers

| Provider | Road | Dark | Satellite | Address search |
| --- | --- | --- | --- | --- |
| `azureMaps({ key })` or `({ token, clientId })` | yes | yes | yes | yes, as people type |
| `googleMaps({ key, region, logo })` (Map Tiles API) | yes | no | yes | the app's own (`search`) |
| `mapbox({ token })` | yes | yes | yes | yes, as people type |
| `tiles({ url, credit })` | the app's own map images | | | the app's own |
| `openStreetMap()` | yes, **for demos only** | no | no | Nominatim, on Enter |

Keys never live in Fieldia: pass one restricted to your sites, or a function
fetching a short-lived token from your server. Each provider's credits are shown
in the map's corner, and its mark where its terms ask. Read your provider's
terms on keeping search results: a place field keeps what it finds (Mapbox's
permanent geocoding is asked for by default). OpenStreetMap's public map images
and Nominatim are for trying things out: their policies treat an app in use as
heavy use.

Pass your own `search` (and `reverse`) to `mapWidgets` to use your own address
search with any provider.

## In the designer

`mapKinds({ locale })` gives the designer Place and Area for its toolbox, with
their settings; pass the map widgets to the designer and its editors too.

MIT. Leaflet is BSD-2-Clause; its stylesheet is included with its licence.
