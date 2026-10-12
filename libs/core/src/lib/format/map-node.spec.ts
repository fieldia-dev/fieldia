import { translatePage, validatePage, type MapLayer, type Page } from '../../index';

/**
 * A map on a form (`type: "map"`), drawn by @fieldia/map: its layers — the
 * record's own places, a place for each line, a route between them, the
 * reader's own place — each checked against the fields it names, before
 * anything draws.
 */

const fields = {
  name: { type: 'char', label: 'Order' },
  kitchen_lat: { type: 'float', label: 'Kitchen latitude' },
  kitchen_lng: { type: 'float', label: 'Kitchen longitude' },
  door: { type: 'json', label: 'Deliver to' },
  courier_lat: { type: 'float', label: 'Courier latitude' },
  courier_lng: { type: 'float', label: 'Courier longitude' },
  courier_heading: { type: 'integer', label: 'Heading' },
  courier_photo: { type: 'image', label: 'Courier' },
  eta_text: { type: 'char', label: 'Arrives in' },
  eta_seconds: { type: 'integer', label: 'Seconds left' },
  distance_m: { type: 'float', label: 'Metres left' },
  route_line: { type: 'json', label: 'Route' },
  stop_ids: {
    type: 'one2many',
    label: 'Stops',
    relation: 'stop',
    fields: { name: { type: 'char', label: 'Stop' }, place: { type: 'json', label: 'Place' }, sequence: { type: 'integer', label: 'No.' }, done: { type: 'boolean', label: 'Done' } },
  },
};

const LAYERS: MapLayer[] = [
  { id: 'kitchen', label: 'Kitchen', latitude: 'kitchen_lat', longitude: 'kitchen_lng', pin: { look: 'icon', icon: 'shop' } },
  { id: 'door', point: 'door', pin: { look: 'icon', icon: 'home' } },
  { id: 'courier', latitude: 'courier_lat', longitude: 'courier_lng', pin: { look: 'photo', image: 'courier_photo', label: 'eta_text', turn: 'courier_heading' }, live: { staleAfter: 120, follow: true } },
  { id: 'stops', lines: 'stop_ids', point: 'place', pin: { label: 'sequence', tones: [{ tone: 'muted', when: 'done' }] }, card: { title: 'name' } },
  { id: 'way', route: { from: 'courier', to: 'door', mode: 'car', progress: true, write: { seconds: 'eta_seconds', metres: 'distance_m', line: 'route_line' } } },
  { id: 'round', route: { from: 'kitchen', through: 'stops' } },
  { id: 'me', myLocation: true },
];

const page = (layers: unknown[]) => ({
  fieldia: '0.1',
  id: 'order',
  data: { kind: 'record', model: 'order' },
  fields,
  layout: { type: 'sections', id: 'order', children: [{ type: 'section', id: 's', children: [{ type: 'field', id: 'f-name', field: 'name' }, { type: 'map', id: 'order-map', label: 'Where it is', layers }] }] },
});
const problems = (layers: unknown[]) => {
  const r = validatePage(page(layers));
  return r.ok ? [] : r.issues.map((i) => `${i.path.replace('layout.children[0].children[1].', '')}: ${i.message}`);
};

describe('a map on a form', () => {
  it('takes layers of the record’s places, its lines’ places, routes between them, and the reader’s own place', () => {
    expect(problems(LAYERS)).toEqual([]);
  });

  it('makes each layer one kind, with all it needs', () => {
    expect(problems([{ id: 'nothing' }])).toEqual(['layers[0]: a layer is one of: a place (point, or latitude and longitude, for the record or for each of its lines), a route, or myLocation']);
    expect(problems([{ id: 'both', point: 'door', myLocation: true }])).toEqual([
      'layers[0]: a layer is one of: a place (point, or latitude and longitude, for the record or for each of its lines), a route, or myLocation',
    ]);
    expect(problems([{ id: 'half', latitude: 'kitchen_lat' }])).toEqual(['layers[0]: a layer needs both latitude and longitude']);
    expect(problems([{ id: 'stops', lines: 'stop_ids', myLocation: true }])).toContain("layers[0].lines: a layer of lines needs where each line is: point, or latitude and longitude, of the line's fields");
    expect(problems([LAYERS[1], { ...LAYERS[0], id: 'door' }])).toEqual(['layers[1].id: two layers are called "door"']);
  });

  it('reads a layer of lines from the line’s own fields, and only from a field of lines', () => {
    expect(problems([{ id: 'stops', lines: 'name', point: 'place' }])).toEqual(['layers[0].lines: "name" is a char; a layer of lines is a one2many field']);
    // `door` is the record's, not the line's.
    expect(problems([{ id: 'stops', lines: 'stop_ids', point: 'door' }])).toEqual(['layers[0].point: no field "door"']);
    expect(problems([{ id: 'stops', lines: 'stop_ids', point: 'place', pin: { label: 'eta_text' } }])).toEqual(['layers[0].pin.label: no field "eta_text"']);
    expect(problems([{ id: 'stops', lines: 'stop_ids', point: 'place', live: {} }])).toEqual(["layers[0].live: live is for a layer of the record's own place: it moves as its fields change"]);
  });

  it('joins a route to layers it can: from and to a place, through lines; and writes its numbers where they fit', () => {
    const [kitchen, door, courier, stops] = LAYERS;
    expect(problems([kitchen, { id: 'way', route: { from: 'kitchen', to: 'nowhere' } }])).toEqual(['layers[1].route.to: no layer "nowhere" on this map']);
    expect(problems([kitchen, stops, { id: 'way', route: { from: 'stops', to: 'kitchen' } }])).toEqual([`layers[2].route.from: a route's from is a layer of one place, or the reader's own; "stops" is not`]);
    expect(problems([kitchen, door, { id: 'way', route: { from: 'kitchen', through: 'door' } }])).toEqual(['layers[2].route.through: a route goes through a layer of lines; "door" is not one']);
    expect(problems([kitchen, { id: 'way', route: { from: 'kitchen' } }])).toEqual(['layers[1].route: a route needs where it goes: to, or through']);
    expect(problems([courier, door, { id: 'way', route: { from: 'courier', to: 'door', write: { seconds: 'eta_text', line: 'distance_m' } } }])).toEqual([
      'layers[2].route.write.seconds: "eta_text" is a char; seconds are a number field',
      'layers[2].route.write.line: "distance_m" is a float; a line is kept in a json field',
    ]);
  });

  it('refuses a mode, a height or a staleness that is none', () => {
    expect(validatePage(page([{ id: 'way', route: { from: 'a', to: 'b', mode: 'boat' } }])).ok).toBe(false);
    expect(validatePage({ ...page(LAYERS), layout: { type: 'sections', id: 'o', children: [{ type: 'map', id: 'm', layers: LAYERS, height: 50 }] } }).ok).toBe(false);
    expect(validatePage(page([{ ...LAYERS[2], live: { staleAfter: 1 } }])).ok).toBe(false);
  });

  it('is translated by its words alone, its own label and its layers’: its layers name fields, never words', () => {
    const translated = translatePage(page(LAYERS) as unknown as Page, (words) => `«${words}»`);
    const map = (translated.layout as unknown as { children: { children: { label: string; layers: MapLayer[] }[] }[] }).children[0].children[1];
    expect(map.label).toBe('«Where it is»');
    expect(map.layers).toEqual([{ ...LAYERS[0], label: '«Kitchen»' }, ...LAYERS.slice(1)]);
  });
});
