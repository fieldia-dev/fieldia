import { validatePage } from '../../index';

/**
 * A list's records on a map (`map` on a list node, drawn by @fieldia/map):
 * where each one is, what its pin shows, the card it opens, and how the list
 * opens. The page says it all by field names, so a missing or wrong field is
 * refused here, before anything draws.
 */

const fields = {
  name: { type: 'char', label: 'Name' },
  price: { type: 'monetary', label: 'Price', currency: 'EGP' },
  offer: { type: 'selection', label: 'Offer', options: [{ value: 'sale', label: 'For sale' }, { value: 'rent', label: 'For rent' }] },
  lat: { type: 'float', label: 'Latitude' },
  lng: { type: 'float', label: 'Longitude' },
  spot: { type: 'json', label: 'Place' },
  photo: { type: 'image', label: 'Photo' },
  heading: { type: 'float', label: 'Heading' },
  kind: { type: 'selection', label: 'Kind', options: [{ value: 'car', label: 'Car' }] },
  district: { type: 'char', label: 'District' },
  rooms: { type: 'integer', label: 'Rooms' },
};

const page = (map: Record<string, unknown>) => ({
  fieldia: '0.1',
  id: 'homes',
  data: { kind: 'record', model: 'home' },
  fields,
  layout: { type: 'list', id: 'list', columns: ['name', 'price'], map },
});
const problems = (input: unknown) => {
  const r = validatePage(input);
  return r.ok ? [] : r.issues.map((i) => `${i.path}: ${i.message}`);
};

describe('a list on a map', () => {
  it('takes where each record is, its pin, its card, bubbles, how it opens and how many it shows', () => {
    expect(
      problems(
        page({
          latitude: 'lat',
          longitude: 'lng',
          pin: { look: 'label', label: 'price', tones: [{ tone: 'info', when: "offer == 'rent'" }] },
          card: { title: 'name', image: 'photo', fields: ['price', 'offer'] },
          cluster: true,
          view: 'both',
          limit: 800,
        })
      )
    ).toEqual([]);
    // A place kept as one GeoJSON point; a car facing its way, its icon from a field.
    expect(problems(page({ point: 'spot', pin: { look: 'icon', icon: 'car', iconField: 'kind', turn: 'heading' } }))).toEqual([]);
    expect(problems(page({ point: 'spot', pin: { look: 'photo', image: 'photo', label: 'name' } }))).toEqual([]);
    expect(problems(page({ point: 'spot', pin: { widget: 'my-pin' } }))).toEqual([]);
  });

  it('needs to know where each record is: one point field, or a latitude and a longitude', () => {
    expect(problems(page({}))).toEqual(['layout.map: a map needs where each record is: point, or latitude and longitude']);
    expect(problems(page({ latitude: 'lat' }))).toEqual(['layout.map: a map needs where each record is: point, or latitude and longitude']);
    expect(problems(page({ point: 'spot', latitude: 'lat', longitude: 'lng' }))).toEqual(['layout.map: a map takes point, or latitude and longitude, not both']);
  });

  it('refuses a field the page lacks, and one of the wrong type, saying which', () => {
    expect(problems(page({ point: 'where', card: { fields: ['nope'] } }))).toEqual(['layout.map.point: no field "where"', 'layout.map.card.fields[0]: no field "nope"']);
    expect(problems(page({ latitude: 'name', longitude: 'lng' }))).toEqual(['layout.map.latitude: "name" is a char; a latitude is a number field (float or integer)']);
    expect(problems(page({ point: 'lat' }))).toEqual(['layout.map.point: "lat" is a float; a point is kept in a json field']);
    expect(problems(page({ point: 'spot', pin: { look: 'photo', image: 'name' } }))).toEqual(['layout.map.pin.image: "name" is a char; a pin\'s photo is an image or binary field']);
    expect(problems(page({ point: 'spot', pin: { turn: 'name' } }))).toEqual(['layout.map.pin.turn: "name" is a char; a turn is a number field, in degrees']);
    expect(problems(page({ point: 'spot', pin: { tones: [{ tone: 'info', when: 'nope == 1' }] } }))).not.toEqual([]);
  });

  it('shades areas by their records, searches one by a click, draws a heat map and offers its tools', () => {
    expect(
      problems(
        page({
          point: 'spot',
          regions: { from: 'cairo', key: 'code', name: 'name', field: 'district', shade: 'count', legend: true },
          heat: { weight: 'price' },
          tools: ['satellite', 'fullscreen', 'measure', 'nearest'],
        })
      )
    ).toEqual([]);
    expect(problems(page({ point: 'spot', heat: true }))).toEqual([]);
    expect(problems(page({ point: 'spot', regions: { from: 'cairo', key: 'code', field: 'quarter' } }))).toEqual(['layout.map.regions.field: no field "quarter"']);
    // An area's records are those whose field holds its key: the field is needed.
    expect(problems(page({ point: 'spot', regions: { from: 'cairo', key: 'code' } }))).not.toEqual([]);
    expect(problems(page({ point: 'spot', heat: { weight: 'name' } }))).toEqual(['layout.map.heat.weight: "name" is a char; a weight is a number field']);
    expect(problems(page({ point: 'spot', heat: { weight: 'rooms' } }))).toEqual([]);
    expect(problems(page({ point: 'spot', tools: ['compass'] }))).not.toEqual([]);
  });

  it('refuses a look, a view or a limit that is none', () => {
    expect(problems(page({ point: 'spot', pin: { look: 'balloon' } }))).not.toEqual([]);
    expect(problems(page({ point: 'spot', view: 'globe' }))).not.toEqual([]);
    expect(problems(page({ point: 'spot', limit: 0 }))).not.toEqual([]);
    expect(problems(page({ point: 'spot', limit: 100000 }))).not.toEqual([]);
  });
});
