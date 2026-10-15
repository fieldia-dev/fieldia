import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';
import { expect, type BrowserContext, type Locator, type Page } from '@playwright/test';

/**
 * The map tests' stand-ins: no test calls a real map provider. Map images
 * are one grid drawn here; OpenStreetMap's search (Nominatim) answers with
 * the shapes it really sends, as its reference documents them
 * (`format=jsonv2`): an array of places for a search, one place for a
 * point named.
 */

function crc32(bytes: Buffer): number {
  let crc = ~0;
  for (const byte of bytes) {
    crc ^= byte;
    for (let k = 0; k < 8; k++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ~crc >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

/** A 256-pixel map image: a pale ground with a line every 32 pixels, so a moved map shows it moved. */
export const TILE = (() => {
  const size = 256;
  const rows: Buffer[] = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 3);
    for (let x = 0; x < size; x++) {
      const line = x % 32 === 0 || y % 32 === 0;
      row.set(line ? [205, 214, 222] : [238, 241, 236], 1 + x * 3);
    }
    rows.push(row);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(Buffer.concat(rows))), chunk('IEND', Buffer.alloc(0))]);
})();

/** A place as Photon answers it: GeoJSON, longitude first, its name and where it is in `properties`. */
export interface PhotonPlace {
  lat: number;
  lon: number;
  name?: string;
  street?: string;
  housenumber?: string;
  district?: string;
  city?: string;
  country?: string;
  /** Its parts, for an address field that fills them: what kind of place it is, its region, postcode and country code. */
  type?: string;
  state?: string;
  postcode?: string;
  countrycode?: string;
}

const photonAnswer = (places: PhotonPlace[]) => ({
  type: 'FeatureCollection',
  features: places.map(({ lat, lon, ...properties }) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [lon, lat] }, properties: { osm_key: 'place', ...properties } })),
});

/** Every request a map made, and the stand-in answers to them: Photon's search and naming, OpenStreetMap's map images. */
export async function stubMaps(page: Page, answers: { search?: PhotonPlace[]; reverse?: PhotonPlace | null } = {}) {
  const asked: string[] = [];
  await page.route('https://tile.openstreetmap.org/**', (route) => {
    asked.push(route.request().url());
    return route.fulfill({ status: 200, contentType: 'image/png', body: TILE, headers: { 'access-control-allow-origin': '*' } });
  });
  await page.route('https://photon.komoot.io/**', (route) => {
    const url = route.request().url();
    asked.push(url);
    const json = photonAnswer(url.includes('/reverse') ? (answers.reverse ? [answers.reverse] : []) : (answers.search ?? []));
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(json), headers: { 'access-control-allow-origin': '*' } });
  });
  return asked;
}

/** A field's map, by the field's layout id. */
export const mapOf = (page: Page, nodeId: string) => page.locator(`[data-node="${nodeId}"] .fd-map-box`);

/** Wait until a map has drawn its images. */
export async function mapReady(map: Locator) {
  await expect(map.locator('.leaflet-tile-loaded').first()).toBeVisible();
  await mapSettled(map);
}

/**
 * The map has stopped moving: no zoom on its way, and the panes where they were a moment ago. A slow runner (WebKit on
 * CI) is still gliding when a guessed wait ends; this waits for the map itself.
 */
export async function mapSettled(map: Locator) {
  const where = () =>
    map.evaluate((el) => {
      const panes = el.querySelector<HTMLElement>('.leaflet-map-pane');
      const levels = [...el.querySelectorAll<HTMLElement>('.leaflet-tile-container')].map((level) => level.style.transform);
      return `${el.querySelector('.leaflet-zoom-anim') ? 'zooming' : ''}|${panes?.style.transform ?? ''}|${levels.join(';')}`;
    });
  let last = '';
  await expect
    .poll(async () => {
      const now = await where();
      const still = now === last && !now.startsWith('zooming');
      last = now;
      return still;
    }, { intervals: [120], timeout: 10_000 })
    .toBe(true);
}

/**
 * The map's zoom, read from the address of an image of the level it shows — Leaflet draws that level on top, and keeps
 * the last one's images under it until the new ones come, so the first image in the page may be of the zoom before.
 */
export async function zoomOf(map: Locator): Promise<number> {
  const src = await map.evaluate((el) => {
    const levels = [...el.querySelectorAll<HTMLElement>('.leaflet-tile-container')].filter((level) => level.querySelector('.leaflet-tile-loaded'));
    const top = levels.sort((a, b) => Number(b.style.zIndex || 0) - Number(a.style.zIndex || 0))[0];
    return top?.querySelector('.leaflet-tile-loaded')?.getAttribute('src') ?? '';
  });
  return Number(/\/(\d+)\/\d+\/\d+\.png/.exec(src)?.[1]);
}

/** A value of the demo's form. */
type Demo = { fieldiaDemo: { handle: { form: { getState(): { values: Record<string, unknown> } } } } };
export const valueOf = (page: Page, field: string) => page.evaluate((name) => (window as unknown as Demo).fieldiaDemo.handle.form.getState().values[name], field);

/** A point on a map, as a share of its width and height. */
export async function at(map: Locator, x: number, y: number) {
  const box = (await map.boundingBox())!;
  return { x: box.x + box.width * x, y: box.y + box.height * y };
}

/** A drag at a hand's speed: pressed, moved in steps, let go. */
export async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }, steps = 12) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps });
  await page.mouse.up();
}

/** A drag by a finger: the pointer events a touch screen raises, which the area's drawing reads. */
export async function fingerDrag(page: Page, target: Locator, from: { x: number; y: number }, to: { x: number; y: number }, steps = 10) {
  await target.evaluate(
    (element, { from, to, steps }) => {
      const send = (type: string, x: number, y: number) =>
        element.dispatchEvent(new PointerEvent(type, { pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y, button: 0, buttons: type === 'pointerup' ? 0 : 1, bubbles: true, cancelable: true, composed: true }));
      send('pointerdown', from.x, from.y);
      for (let i = 1; i <= steps; i++) send('pointermove', from.x + ((to.x - from.x) * i) / steps, from.y + ((to.y - from.y) * i) / steps);
      send('pointerup', to.x, to.y);
    },
    { from, to, steps }
  );
}

/** OSRM's routes, answered with one line recorded from Tahrir to Zamalek, whatever is asked: every request kept. */
export async function stubRoutes(page: Page) {
  const asked: string[] = [];
  const answer = readFileSync(join(__dirname, '../libs/map/src/lib/fixtures/osrm-route.json'), 'utf8');
  await page.route('https://router.project-osrm.org/**', (route) => {
    asked.push(route.request().url());
    return route.fulfill({ status: 200, contentType: 'application/json', body: answer, headers: { 'access-control-allow-origin': '*' } });
  });
  return asked;
}

/** The recorded route's line, latitude first, to place a courier on it. */
export const ROUTE_LINE: { lat: number; lng: number }[] = (
  JSON.parse(readFileSync(join(__dirname, '../libs/map/src/lib/fixtures/osrm-route.json'), 'utf8')).routes[0].geometry.coordinates as [number, number][]
).map(([lng, lat]) => ({ lat, lng }));

/**
 * Every map server a demo can call, answered by stand-ins for a whole
 * browser context, so no test ever reaches a real one: map images
 * (OpenStreetMap's, and Azure Maps' for `?maps=azure`), address search
 * (Photon, Nominatim) and routes (OSRM).
 * Each test gets them from e2e/fixtures.ts; a test's own `stubMaps` or
 * `stubRoutes`, set on its page, still wins.
 */
export async function quietMapServers(context: BrowserContext) {
  const json = (body: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(body), headers: { 'access-control-allow-origin': '*' } });
  const route = readFileSync(join(__dirname, '../libs/map/src/lib/fixtures/osrm-route.json'), 'utf8');
  await context.route('https://tile.openstreetmap.org/**', (r) => r.fulfill({ status: 200, contentType: 'image/png', body: TILE, headers: { 'access-control-allow-origin': '*' } }));
  await context.route('https://photon.komoot.io/**', (r) => r.fulfill(json({ type: 'FeatureCollection', features: [] })));
  await context.route('https://nominatim.openstreetmap.org/**', (r) => r.fulfill(json(r.request().url().includes('/reverse') ? {} : [])));
  await context.route('https://router.project-osrm.org/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: route, headers: { 'access-control-allow-origin': '*' } }));
  // Azure Maps, for the demos' `?maps=azure`: its map images the grid, its credits as it gave them.
  const answers = JSON.parse(readFileSync(join(__dirname, '../libs/map/src/lib/fixtures/azure-answers.json'), 'utf8'));
  await context.route('https://atlas.microsoft.com/**', (r) =>
    r.request().url().includes('/map/attribution')
      ? r.fulfill(json(answers.attribution ?? {}))
      : r.fulfill({ status: 200, contentType: 'image/png', body: TILE, headers: { 'access-control-allow-origin': '*' } })
  );
  // Azure's address search, for an address field's suggestions: its recorded suggestions (Cairo's), and its place for one picked. As Azure
  // answers them: an autocomplete with no point or box to look near refused, one kept to another country (or to a list of them) empty; a
  // street picked found by its parts, and its district asked for by its name or its words found.
  await context.route('https://atlas.microsoft.com/geocode**', (r) => {
    const url = new URL(r.request().url());
    const district = url.searchParams.get('query')?.startsWith('El Sheikh Ali,') || (url.searchParams.get('locality') === 'El Sheikh Ali' && !url.searchParams.has('addressLine'));
    if (!url.pathname.endsWith('geocode:autocomplete')) return r.fulfill(json(district ? answers.geocodeDistrict : answers.geocode));
    if (!url.searchParams.has('coordinates') && !url.searchParams.has('bbox')) return r.fulfill({ ...json({ error: { code: 'BadRequest', message: 'Either Bbox or Coordinates is required.' } }), status: 400 });
    const country = url.searchParams.get('countryRegion');
    return r.fulfill(json(country && country.toUpperCase() !== 'EG' ? { type: 'FeatureCollection', features: [] } : answers.autocomplete));
  });
}

/**
 * Azure Maps, answered as it answers (its recorded answers, map-support's
 * grid for its map images): its traffic over Cairo is a real image of it,
 * and its credits its own. Every request kept.
 */
export async function stubAzure(page: Page) {
  const asked: string[] = [];
  const fixtures = join(__dirname, '../libs/map/src/lib/fixtures');
  const traffic = readFileSync(join(fixtures, 'azure-traffic-tile.png'));
  const answers = JSON.parse(readFileSync(join(fixtures, 'azure-answers.json'), 'utf8'));
  const trafficAnswers = JSON.parse(readFileSync(join(fixtures, 'azure-traffic.json'), 'utf8'));
  await page.route('https://atlas.microsoft.com/**', (route) => {
    const url = route.request().url();
    asked.push(url);
    const headers = { 'access-control-allow-origin': '*' };
    if (url.includes('/map/attribution')) {
      const body = JSON.stringify(url.includes('.traffic.') ? trafficAnswers.attribution : answers.attribution);
      return route.fulfill({ status: 200, contentType: 'application/json', body, headers });
    }
    return route.fulfill({ status: 200, contentType: 'image/png', body: url.includes('.traffic.') ? traffic : TILE, headers });
  });
  return asked;
}
