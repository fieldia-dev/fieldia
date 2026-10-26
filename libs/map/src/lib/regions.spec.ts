import type * as Leaflet from 'leaflet';
import { mapLabels, MAP_LABELS } from './labels';
import { loadLeaflet } from './leaflet';
import { createMapBox } from './map-core';
import { distanceWords } from './measure';
import { tiles } from './providers';
import { drawRegions, insideRings, readBorders, shadeOf, shadeSteps, type Border } from './regions';

/**
 * Areas shaded by colour: borders read from the app's GeoJSON, their numbers
 * in up to five steps of round numbers, a place found inside one, their
 * legend; and a way measured, said as people read lengths.
 */

const square = (x: number, y: number, size: number): [number, number][] => [
  [x, y],
  [x + size, y],
  [x + size, y + size],
  [x, y + size],
  [x, y],
];

describe('borders from the app', () => {
  it('reads polygons and multipolygons with a key, named by another property, passing over the rest', () => {
    const borders = readBorders(
      {
        type: 'FeatureCollection',
        features: [
          { type: 'Feature', properties: { code: 'ZAM', name: 'Zamalek', homes: 12 }, geometry: { type: 'Polygon', coordinates: [square(31.21, 30.05, 0.02)] } },
          { type: 'Feature', properties: { code: 7, name: 'Islands' }, geometry: { type: 'MultiPolygon', coordinates: [[square(0, 0, 1)], [square(2, 2, 1)]] } },
          { type: 'Feature', properties: { name: 'No key' }, geometry: { type: 'Polygon', coordinates: [square(0, 0, 1)] } },
          { type: 'Feature', properties: { code: 'PT' }, geometry: { type: 'Point', coordinates: [1, 1] } },
          { type: 'Feature', properties: { code: 'ODD' }, geometry: null },
        ],
      },
      { key: 'code', name: 'name' }
    );
    expect(borders.map((b) => [b.key, b.value, b.name, b.polygons.length])).toEqual([
      ['ZAM', 'ZAM', 'Zamalek', 1],
      ['7', 7, 'Islands', 2],
    ]);
    expect(borders[0].properties['homes']).toBe(12);
    // Named by its key when there is no name.
    expect(readBorders({ features: [{ properties: { code: 'X' }, geometry: { type: 'Polygon', coordinates: [square(0, 0, 1)] } }] }, { key: 'code' })[0].name).toBe('X');
    expect(readBorders(null, { key: 'code' })).toEqual([]);
  });

  it('finds the area under a place: inside the outer ring and out of its holes', () => {
    const withHole = [square(0, 0, 10), square(4, 4, 2)];
    expect(insideRings(1, 1, withHole)).toBe(true);
    expect(insideRings(5, 5, withHole)).toBe(false);
    expect(insideRings(11, 5, withHole)).toBe(false);
  });
});

describe('shades', () => {
  it('steps by round numbers up to five, whole numbers for counts, from nothing', () => {
    expect(shadeSteps([3, 12, 47, 0])).toEqual({ from: 0, ends: [10, 20, 30, 40, 50] });
    expect(shadeSteps([1, 2, 3])).toEqual({ from: 0, ends: [1, 2, 3] });
    expect(shadeSteps([120, 980])).toEqual({ from: 0, ends: [200, 400, 600, 800, 1000] });
    expect(shadeSteps([0.4, 2.2])).toEqual({ from: 0, ends: [0.5, 1, 1.5, 2, 2.5] });
    expect(shadeSteps([0, 0])).toEqual({ from: 0, ends: [] });
  });

  it('starts from a round number under the least when every number is well above nothing', () => {
    // Delivery fees of 15 to 40: no empty step for 1 to 10.
    expect(shadeSteps([15, 20, 25, 40])).toEqual({ from: 10, ends: [20, 30, 40] });
    expect(shadeSteps([1200, 1450, 1900])).toEqual({ from: 1000, ends: [1200, 1400, 1600, 1800, 2000] });
    expect(shadeSteps([7])).toEqual({ from: 6, ends: [7] });
  });

  it('puts each number in its step, none for nothing', () => {
    const steps = [10, 20, 30, 40, 50];
    expect([1, 10, 11, 47, 50, 0, null].map((n) => shadeOf(n, steps))).toEqual([0, 0, 1, 4, 4, null, null]);
    expect(shadeOf(999, steps)).toBe(4);
  });
});

describe('a way measured', () => {
  it('says metres up to a kilometre, then kilometres to one decimal, in Latin digits', () => {
    expect(distanceWords(340.4, MAP_LABELS.en, 'en')).toBe('340 m');
    expect(distanceWords(1234, MAP_LABELS.en, 'en')).toBe('1.2 km');
    expect(distanceWords(12_480, MAP_LABELS.ar, 'ar')).toBe('12.5 كم');
  });
});

/**
 * The legend folds to its title, a button, and opens again; folded at first on a phone's map. 0.35's could not fold: on a
 * 390-pixel phone it covered most of the map and two of the buttons under the zoom (the zones demo: a tap on Zamalek
 * landed on the legend's title). Leaflet in jsdom, the map's box as wide as a phone's or a desktop's (jsdom lays nothing
 * out); how it looks, and the taps that reach the map, in e2e/map-areas.spec.ts.
 */
describe('the legend', () => {
  const borders: Border[] = [
    { key: 'a', value: 'a', name: 'Dokki', properties: {}, polygons: [[square(31.2, 30.03, 0.02)]] },
    { key: 'b', value: 'b', name: 'Zamalek', properties: {}, polygons: [[square(31.22, 30.05, 0.02)]] },
  ];
  afterEach(() => {
    jest.restoreAllMocks();
    document.body.replaceChildren();
  });

  async function legendOn(width: number) {
    const { L } = await loadLeaflet();
    // jsdom draws no SVG: Leaflet's paths are SVG elements here, as a browser's are.
    jest.replaceProperty(L.Browser, 'svg', true);
    const labels = mapLabels('en');
    const box = createMapBox({ document, provider: tiles({ url: 'https://example.test/{z}/{x}/{y}.png', credit: { text: '© Example' } }), locale: 'en', labels, name: 'Orders', center: { lat: 30.05, lng: 31.23 }, zoom: 12 });
    Object.defineProperty(box.element, 'clientWidth', { value: width });
    document.body.append(box.element);
    const map = await new Promise<Leaflet.Map>((ready) => box.ready((m) => ready(m)));
    const layer = drawRegions({ box, map, L, document, locale: 'en', labels, borders, title: 'Orders this week, by district', legend: true });
    layer.shade(new Map([['a', 4], ['b', 17]]), null);
    const legend = box.element.querySelector<HTMLElement>('.fd-map-legend')!;
    const title = legend.querySelector<HTMLButtonElement>('button.fd-map-legend-title')!;
    return { layer, legend, title };
  }

  it('on a phone’s map: folded to its title at first, a button that opens it and folds it again, as the person left it when the shades change', async () => {
    const { layer, legend, title } = await legendOn(358);
    expect(legend.hidden).toBe(false);
    expect(title.textContent).toBe('Orders this week, by district');
    expect(title.getAttribute('aria-expanded')).toBe('false');
    expect(legend.hasAttribute('data-folded')).toBe(true);
    title.click();
    expect(title.getAttribute('aria-expanded')).toBe('true');
    expect(legend.hasAttribute('data-folded')).toBe(false);
    expect(legend.querySelectorAll('li').length).toBeGreaterThan(1);
    // The shades change (another search): the legend drawn again, open as the person left it.
    layer.shade(new Map([['a', 9], ['b', 30]]), null);
    expect(legend.querySelector('button.fd-map-legend-title')).toBe(title);
    expect(title.getAttribute('aria-expanded')).toBe('true');
    title.click();
    expect(legend.hasAttribute('data-folded')).toBe(true);
    layer.destroy();
  });

  it('on a desktop’s map: open at first, and folds by a press all the same', async () => {
    const { legend, title } = await legendOn(900);
    expect(title.getAttribute('aria-expanded')).toBe('true');
    expect(legend.hasAttribute('data-folded')).toBe(false);
    title.click();
    expect(legend.hasAttribute('data-folded')).toBe(true);
  });
});
