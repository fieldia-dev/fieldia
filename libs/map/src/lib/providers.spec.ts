/** @jest-environment node */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { azureMaps, googleMaps, mapbox, openStreetMap, tiles } from './providers';

/** Azure Maps' own answers, as it gave them on 12 Oct 2026 (the key taken out): its HTML credits, its addresses' parts, its Arabic with direction marks. */
const AZURE = JSON.parse(readFileSync(join(__dirname, 'fixtures/azure-answers.json'), 'utf8'));
/** Its traffic over Cairo the same day: an image's answer, which zooms it answers at, and its traffic's credit. */
const AZURE_TRAFFIC = JSON.parse(readFileSync(join(__dirname, 'fixtures/azure-traffic.json'), 'utf8'));

/** A stand-in for the network: every request kept, each answered from the table by the start of its URL. */
function network(answers: Record<string, unknown>) {
  const asked: { url: string; init?: RequestInit }[] = [];
  const fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    asked.push({ url, init });
    const key = Object.keys(answers).find((start) => url.startsWith(start));
    if (!key) return new Response('not found', { status: 404 });
    return new Response(JSON.stringify(answers[key]), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof globalThis.fetch;
  return { fetch, asked };
}

const view = { zoom: 12, bounds: { south: 29.9, west: 31.1, north: 30.2, east: 31.4 } };

describe('OpenStreetMap', () => {
  it('draws its own map images with its credit, for demos only', async () => {
    const osm = openStreetMap();
    expect(osm.demoOnly).toBe(true);
    expect(await osm.tiles('road', 'en')).toEqual({ url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', maxZoom: 19 });
    expect(await osm.tiles('satellite', 'en')).toBeNull();
    expect(await osm.credits('road', view, 'en')).toEqual([{ text: '© OpenStreetMap contributors', href: 'https://www.openstreetmap.org/copyright' }]);
    // No live traffic: no Traffic button.
    expect(osm.traffic).toBeUndefined();
  });

  it('searches as people type through Photon, nearest the map first, each place on two lines', async () => {
    const found = {
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', geometry: { type: 'Point', coordinates: [31.2357, 30.0444] }, properties: { name: 'Tahrir Square', district: 'Downtown', city: 'Cairo', country: 'Egypt', osm_key: 'place' } },
        { type: 'Feature', geometry: { type: 'Point', coordinates: [31.2391, 30.0487] }, properties: { street: 'Tahrir Street', housenumber: '12', city: 'Cairo', country: 'Egypt' } },
      ],
    };
    const { fetch, asked } = network({ 'https://photon.komoot.io/api': found });
    const osm = openStreetMap({ fetch });
    expect(osm.searchAsYouType).toBe(true);
    expect(await osm.search!({ text: 'tahrir', near: { lat: 30.05, lng: 31.24 }, zoom: 13, locale: 'en' })).toEqual([
      { label: 'Tahrir Square', detail: 'Downtown, Cairo, Egypt', lat: 30.0444, lng: 31.2357 },
      { label: 'Tahrir Street 12', detail: 'Cairo, Egypt', lat: 30.0487, lng: 31.2391 },
    ]);
    expect(asked[0].url).toBe('https://photon.komoot.io/api?q=tahrir&limit=6&lang=en&lat=30.05&lon=31.24&zoom=13');
    // Photon names places in English, German and French; in Arabic it gives the places' own names.
    await osm.search!({ text: 'tahrir', locale: 'ar' });
    expect(asked[1].url).toBe('https://photon.komoot.io/api?q=tahrir&limit=6');
  });

  it('names a point through Photon too', async () => {
    const { fetch, asked } = network({ 'https://photon.komoot.io/reverse': { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [31.22, 30.06] }, properties: { street: '26 July Street', housenumber: '3', district: 'Zamalek', city: 'Cairo', country: 'Egypt' } }] } });
    expect(await openStreetMap({ fetch }).reverse!({ lat: 30.06, lng: 31.22, locale: 'fr' })).toBe('26 July Street 3, Zamalek, Cairo, Egypt');
    expect(asked[0].url).toBe('https://photon.komoot.io/reverse?lat=30.06&lon=31.22&limit=1&lang=fr');
  });

  it('searches Nominatim instead when asked, and only on Enter, as its policy says', async () => {
    const { fetch, asked } = network({ 'https://nominatim.openstreetmap.org/search': [{ lat: '30.0444', lon: '31.2357', name: 'Cairo', display_name: 'Cairo, Cairo Governorate, Egypt' }] });
    const osm = openStreetMap({ fetch, search: 'nominatim' });
    expect(osm.searchAsYouType).toBe(false);
    // Joined with the Arabic comma, as the page reads.
    expect(await osm.search!({ text: 'cairo', locale: 'ar' })).toEqual([{ label: 'Cairo', detail: 'Cairo Governorate، Egypt', lat: 30.0444, lng: 31.2357 }]);
    expect(asked[0].url).toBe('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&q=cairo&accept-language=ar');
  });
});

describe('Azure Maps', () => {
  it('draws road, dark and satellite map images in the page’s language, the key in the address', async () => {
    const azure = azureMaps({ key: 'K' });
    const road = await azure.tiles('road', 'ar');
    // Azure refuses "ar-001" and every other tag it does not list: Arabic is plain "ar".
    expect(road?.url).toBe('https://atlas.microsoft.com/map/tile?api-version=2024-04-01&tilesetId=microsoft.base.road&zoom={z}&x={x}&y={y}&tileSize=256&language=ar&view=Auto&subscription-key=K');
    expect((await azure.tiles('dark', 'en'))?.url).toContain('tilesetId=microsoft.base.darkgrey');
    expect((await azure.tiles('satellite', 'fr'))?.url).toContain('tilesetId=microsoft.imagery');
    expect((await azure.tiles('road', 'de'))?.url).toContain('language=de-DE');
  });

  it('sends a token in a header instead, when the app gives one', async () => {
    const azure = azureMaps({ token: async () => 'T', clientId: 'C' });
    const road = await azure.tiles('road', 'en');
    expect(road?.url).not.toContain('subscription-key');
    expect(await road?.headers?.()).toEqual({ Authorization: 'Bearer T', 'x-ms-client-id': 'C' });
  });

  it('reads its credits for the view from its attribution service, as words: Azure sends them as HTML links', async () => {
    const { fetch, asked } = network({ 'https://atlas.microsoft.com/map/attribution': AZURE.attribution });
    const azure = azureMaps({ key: 'K', fetch });
    expect(await azure.credits('road', view, 'en')).toEqual([{ text: '©2026 OSM' }, { text: '©2026 TomTom' }]);
    expect(asked[0].url).toBe('https://atlas.microsoft.com/map/attribution?api-version=2024-04-01&tilesetId=microsoft.base.road&zoom=12&bounds=31.1%2C29.9%2C31.4%2C30.2&subscription-key=K');
  });

  it('says why, in Azure’s own words, when it refuses a search', async () => {
    const fetch = (async () => new Response(JSON.stringify({ error: { code: 'Unauthorized', message: 'Access denied due to invalid subscription key.' } }), { status: 401 })) as typeof globalThis.fetch;
    await expect(azureMaps({ key: 'K', fetch }).search!({ text: 'x', locale: 'en' })).rejects.toThrow('Access denied due to invalid subscription key.');
  });

  it('draws its live traffic over the map, in its dark colours over the dark map, at the zooms it answers, again as it goes out of date', async () => {
    const azure = azureMaps({ key: 'K' });
    const traffic = await azure.traffic!('road', 'ar');
    expect(traffic?.url).toBe('https://atlas.microsoft.com/map/tile?api-version=2024-04-01&tilesetId=microsoft.traffic.relative.main&zoom={z}&x={x}&y={y}&tileSize=256&language=ar&view=Auto&subscription-key=K');
    expect((await azure.traffic!('satellite', 'en'))?.url).toContain('tilesetId=microsoft.traffic.relative.main&');
    expect((await azure.traffic!('dark', 'en'))?.url).toContain('tilesetId=microsoft.traffic.relative.dark&');
    // Its answers: an image from zoom 6 to 21, nothing (204) outside them; good for 239 seconds.
    const answered = Object.entries(AZURE_TRAFFIC.statusByZoom as Record<string, number>).filter(([, status]) => status === 200).map(([zoom]) => Number(zoom));
    expect([traffic?.minZoom, traffic?.maxZoom]).toEqual([Math.min(...answered), Math.max(...answered)]);
    expect(traffic?.fresh).toBe(Number(/max-age=(\d+)/.exec(AZURE_TRAFFIC.headers['cache-control'])![1]) + 1);
    // A token goes in a header, as for its map images.
    expect(await (await azureMaps({ token: async () => 'T' }).traffic!('road', 'en'))?.headers?.()).toEqual({ Authorization: 'Bearer T' });
  });

  it('credits its traffic, while it is drawn, as its attribution service names it', async () => {
    const { fetch, asked } = network({ 'https://atlas.microsoft.com/map/attribution': AZURE_TRAFFIC.attribution });
    expect(await azureMaps({ key: 'K', fetch }).credits('traffic', view, 'en')).toEqual([{ text: '©2026 TomTom' }]);
    expect(asked[0].url).toContain('tilesetId=microsoft.traffic.relative.main&');
  });

  it('keeps a credit when its attribution service fails', async () => {
    const { fetch } = network({});
    expect(await azureMaps({ key: 'K', fetch }).credits('road', view, 'en')).toEqual([{ text: '© Microsoft' }]);
  });

  it('suggests addresses as people type (its autocomplete), near the map, each on two lines; a place picked is located then', async () => {
    const { fetch, asked } = network({
      'https://atlas.microsoft.com/geocode:autocomplete': AZURE.autocomplete,
      'https://atlas.microsoft.com/geocode?api-version=2026-01-01&top=5&query=El%20Sheikh%20Ali%2C': AZURE.geocodeDistrict,
      'https://atlas.microsoft.com/geocode': AZURE.geocode,
    });
    const azure = azureMaps({ key: 'K', fetch });
    expect(azure.searchAsYouType).toBe(true);
    const [first] = await azure.search!({ text: '26 july st', near: { lat: 30.05, lng: 31.24 }, locale: 'en' });
    expect(first).toMatchObject({ label: '26 July Street', detail: 'El Sheikh Ali, Cairo, Egypt' });
    // Its suggestions carry no place: looked up when one is picked.
    expect(first.lat).toBeUndefined();
    expect(asked[0].url).toBe('https://atlas.microsoft.com/geocode:autocomplete?api-version=2026-01-01&top=5&query=26%20july%20st&coordinates=31.24%2C30.05&subscription-key=K');
    expect((asked[0].init?.headers as Record<string, string>)['Accept-Language']).toBe('en-US');
    // Asked for by its own address, in Azure's structured form (the street without the house number Azure made of its name, its district, governorate and city, its country): the street, in Cairo, as Azure answers it.
    expect(await first.locate!()).toEqual({ lat: 30.0541906885011, lng: 31.2371480131072, address: '26 July Street, El Sheikh Ali, Cairo, Egypt' });
    expect(asked[1].url).toBe(
      'https://atlas.microsoft.com/geocode?api-version=2026-01-01&top=5&addressLine=26%20July%20Street&locality=El%20Sheikh%20Ali&adminDistrict=Cairo&adminDistrict2=Cairo&countryRegion=EG&subscription-key=K'
    );
    expect(asked).toHaveLength(2);
  });

  it('takes the district a street is in, only near, where its geocoding finds no street', async () => {
    const { fetch, asked } = network({
      'https://atlas.microsoft.com/geocode:autocomplete': AZURE.autocomplete,
      'https://atlas.microsoft.com/geocode?api-version=2026-01-01&top=5&locality=El%20Sheikh%20Ali&': AZURE.geocodeDistrict,
      'https://atlas.microsoft.com/geocode': { type: 'FeatureCollection', features: [] },
    });
    const [first] = await azureMaps({ key: 'K', fetch }).search!({ text: '26 july st', near: { lat: 30.05, lng: 31.24 }, locale: 'en' });
    expect(await first.locate!()).toEqual({ lat: 30.053436279296875, lng: 31.23265838623047, address: '26 July Street, El Sheikh Ali, Cairo, Egypt', precise: false });
    // The street by its parts, then by its two lines, then its district.
    expect(asked.slice(1).map((request) => new URL(request.url).searchParams.get('addressLine') ?? new URL(request.url).searchParams.get('query') ?? new URL(request.url).searchParams.get('locality'))).toEqual([
      '26 July Street',
      '26 July Street, El Sheikh Ali, Cairo, Egypt',
      'El Sheikh Ali',
    ]);
  });

  it('suggests what a half-typed Arabic name may be, in Arabic, without direction marks', async () => {
    const { fetch } = network({ 'https://atlas.microsoft.com/geocode:autocomplete': AZURE.autocompleteArabic });
    const found = await azureMaps({ key: 'K', fetch }).search!({ text: 'ميدان التح', locale: 'ar' });
    expect(found.map((place) => place.label)).toEqual(['ميدان التحرير', 'ميدان التحرير', 'ميدان التحرير']);
    expect(found[1].detail).toBe('الإسماعيلية، القاهرة، مصر');
    expect(found.every((place) => !/[\u200e\u200f\u061c]/.test(`${place.label}${place.detail}`))).toBe(true);
  });

  it('names a point without the direction marks Azure puts in Arabic, which would sit unseen in an address field', async () => {
    const { fetch } = network({ 'https://atlas.microsoft.com/reverseGeocode': AZURE.reverseArabic });
    const named = await azureMaps({ key: 'K', fetch }).reverse!({ lat: 30.0444, lng: 31.2357, locale: 'ar' });
    // Azure names its locality "Cairo", in Latin, beside its governorate "القاهرة", as its own formatted address does: both said, as no guess tells a name in two alphabets from two names.
    expect(named).toBe('7 ميدان التحرير، Cairo، القاهرة، مصر');
    expect(named).not.toMatch(/[\u200e\u200f\u061c]/);
  });
});

describe('Google', () => {
  const session = { session: 'S1', expiry: '1893456000', tileWidth: 256, tileHeight: 256, imageFormat: 'png' };

  it('opens a session for its map images, once for each kind and language', async () => {
    const { fetch, asked } = network({ 'https://tile.googleapis.com/v1/createSession': session });
    const google = googleMaps({ key: 'G', region: 'EG', fetch });
    const road = await google.tiles('road', 'ar');
    expect(road).toEqual({ url: 'https://tile.googleapis.com/v1/2dtiles/{z}/{x}/{y}?session=S1&key=G', maxZoom: 22 });
    await google.tiles('road', 'ar');
    expect(asked).toHaveLength(1);
    expect(asked[0].url).toBe('https://tile.googleapis.com/v1/createSession?key=G');
    expect(JSON.parse(String(asked[0].init?.body))).toEqual({ mapType: 'roadmap', language: 'ar', region: 'EG' });
    await google.tiles('satellite', 'ar');
    expect(JSON.parse(String(asked[1].init?.body))).toMatchObject({ mapType: 'satellite' });
    // Google's map images have no dark kind through this service.
    expect(await google.tiles('dark', 'ar')).toBeNull();
  });

  it('opens a session of its own for traffic: the traffic layer alone, without the map under it', async () => {
    const { fetch, asked } = network({ 'https://tile.googleapis.com/v1/createSession': session });
    const google = googleMaps({ key: 'G', region: 'EG', fetch });
    expect(await google.traffic!('road', 'en')).toEqual({ url: 'https://tile.googleapis.com/v1/2dtiles/{z}/{x}/{y}?session=S1&key=G', maxZoom: 22 });
    expect(JSON.parse(String(asked[0].init?.body))).toEqual({ mapType: 'roadmap', language: 'en', region: 'EG', layerTypes: ['layerTraffic'], overlay: true });
    // One session for it, whatever the map under it, apart from the road map's.
    await google.traffic!('dark', 'en');
    expect(asked).toHaveLength(1);
    await google.tiles('road', 'en');
    expect(JSON.parse(String(asked[1].init?.body))).toEqual({ mapType: 'roadmap', language: 'en', region: 'EG' });
  });

  it('shows its credits for the view, and its name where its logo goes', async () => {
    const { fetch, asked } = network({ 'https://tile.googleapis.com/v1/createSession': session, 'https://tile.googleapis.com/tile/v1/viewport': { copyright: 'Map data ©2026 Google', maxZoomRects: [] } });
    const google = googleMaps({ key: 'G', fetch });
    expect(await google.credits('road', view, 'en')).toEqual([{ text: 'Map data ©2026 Google' }]);
    expect(asked[1].url).toBe('https://tile.googleapis.com/tile/v1/viewport?session=S1&key=G&zoom=12&north=30.2&south=29.9&east=31.4&west=31.1');
    expect(google.logo).toEqual({ text: 'Google Maps' });
    expect(googleMaps({ key: 'G', logo: '/google.png' }).logo).toEqual({ text: 'Google Maps', image: '/google.png' });
  });

  it('suggests places as people type (Places), near the map, in one session; a place picked is located then, closing the session', async () => {
    const suggestions = {
      suggestions: [
        { placePrediction: { place: 'places/A1', placeId: 'A1', text: { text: 'Tahrir Square, Cairo, Egypt' }, structuredFormat: { mainText: { text: 'Tahrir Square' }, secondaryText: { text: 'Cairo, Egypt' } } } },
        { queryPrediction: { text: { text: 'tahrir restaurants' } } },
      ],
    };
    const details = { location: { latitude: 30.0444, longitude: 31.2357 }, formattedAddress: 'Tahrir Square, Qasr El Nil, Cairo, Egypt' };
    const { fetch, asked } = network({ 'https://places.googleapis.com/v1/places:autocomplete': suggestions, 'https://places.googleapis.com/v1/places/A1': details });
    const google = googleMaps({ key: 'G', region: 'EG', fetch });
    expect(google.searchAsYouType).toBe(true);
    const found = await google.search!({ text: 'tahr', near: { lat: 30.05, lng: 31.24 }, zoom: 13, locale: 'ar' });
    // A suggestion of words, not of a place, is left out.
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ label: 'Tahrir Square', detail: 'Cairo، Egypt' });
    expect(found[0].lat).toBeUndefined();
    const sent = JSON.parse(String(asked[0].init?.body));
    expect(asked[0].url).toBe('https://places.googleapis.com/v1/places:autocomplete');
    expect((asked[0].init?.headers as Record<string, string>)['X-Goog-Api-Key']).toBe('G');
    expect(sent).toMatchObject({ input: 'tahr', languageCode: 'ar', regionCode: 'EG', locationBias: { circle: { center: { latitude: 30.05, longitude: 31.24 }, radius: 4892 } } });
    expect(sent.sessionToken).toMatch(/^[0-9a-f-]{36}$/);
    // The same session while the person types on.
    await google.search!({ text: 'tahri', locale: 'ar' });
    expect(JSON.parse(String(asked[1].init?.body)).sessionToken).toBe(sent.sessionToken);

    expect(await found[0].locate!()).toEqual({ lat: 30.0444, lng: 31.2357, address: 'Tahrir Square، Qasr El Nil، Cairo، Egypt' });
    expect(asked[2].url).toBe(`https://places.googleapis.com/v1/places/A1?languageCode=ar&sessionToken=${sent.sessionToken}`);
    // Place Details Essentials, its parts with them: the country they name is set apart in the line.
    expect((asked[2].init?.headers as Record<string, string>)['X-Goog-FieldMask']).toBe('location,formattedAddress,addressComponents');
    // Picked: the next search is a new session.
    await google.search!({ text: 'zam', locale: 'ar' });
    expect(JSON.parse(String(asked[3].init?.body)).sessionToken).not.toBe(sent.sessionToken);
  });

  it('locates a place from a session already ended without its token: a token used again is no session to Google', async () => {
    const suggestion = (placeId: string, name: string) => ({ placePrediction: { placeId, types: ['geocode'], structuredFormat: { mainText: { text: name } } } });
    const details = { location: { latitude: 30.0444, longitude: 31.2357 }, formattedAddress: 'Tahrir Square, Cairo, Egypt' };
    const { fetch, asked } = network({
      'https://places.googleapis.com/v1/places:autocomplete': { suggestions: [suggestion('A1', 'Tahrir Square'), suggestion('A2', 'Tahrir Street')] },
      'https://places.googleapis.com/v1/places/': details,
    });
    const google = googleMaps({ key: 'G', fetch });
    const [square, street] = await google.search!({ text: 'tahr', locale: 'en' });
    const token = JSON.parse(String(asked[0].init?.body)).sessionToken;
    square.picked?.();
    await square.locate!();
    expect(asked[1].url).toBe(`https://places.googleapis.com/v1/places/A1?languageCode=en&sessionToken=${token}`);
    // Its session ended by the place picked from it: another of its places is located alone.
    await street.locate!();
    expect(asked[2].url).toBe('https://places.googleapis.com/v1/places/A2?languageCode=en');
  });

  it('says why, in Google’s own words, when it refuses: a service not switched on, a key not allowed', async () => {
    const refused = (status: number, body: unknown) => (async () => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })) as typeof globalThis.fetch;
    const off = { error: { code: 403, message: 'Places API (New) has not been used in project 1 before or it is disabled.', status: 'PERMISSION_DENIED' } };
    await expect(googleMaps({ key: 'G', fetch: refused(403, off) }).search!({ text: 'x', locale: 'en' })).rejects.toThrow('Places API (New) has not been used in project 1 before or it is disabled.');
    // The Geocoding API answers 200 with its refusal inside.
    const denied = { status: 'REQUEST_DENIED', error_message: 'This API is not activated on your API project.', results: [] };
    await expect(googleMaps({ key: 'G', fetch: refused(200, denied) }).reverse!({ lat: 30, lng: 31, locale: 'en' })).rejects.toThrow('This API is not activated on your API project.');
  });

  it('names a point in Arabic without the direction marks Google puts in it, every piece after the Arabic comma', async () => {
    const { fetch } = network({ 'https://maps.googleapis.com/maps/api/geocode/json': { status: 'OK', results: [{ formatted_address: '1 شارع محمد محمود، ميدان التحرير, قسم قصر النيل، محافظة القاهرة\u202c 4272077، مصر' }] } });
    expect(await googleMaps({ key: 'G', fetch }).reverse!({ lat: 30.0444, lng: 31.2357, locale: 'ar' })).toBe('1 شارع محمد محمود، ميدان التحرير، قسم قصر النيل، محافظة القاهرة 4272077، مصر');
  });

  it('names a point through the Geocoding API', async () => {
    const { fetch, asked } = network({ 'https://maps.googleapis.com/maps/api/geocode/json': { status: 'OK', results: [{ formatted_address: '7 Tahrir Square, Cairo, Egypt' }] } });
    expect(await googleMaps({ key: 'G', fetch }).reverse!({ lat: 30.0444, lng: 31.2357, locale: 'fr' })).toBe('7 Tahrir Square, Cairo, Egypt');
    expect(asked[0].url).toBe('https://maps.googleapis.com/maps/api/geocode/json?latlng=30.0444%2C31.2357&language=fr&key=G');
  });
});

describe('Mapbox', () => {
  it('draws its styles at 512 pixels, with its credits and its name', async () => {
    const box = mapbox({ token: 'M' });
    expect(await box.tiles('road', 'en')).toEqual({ url: 'https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/512/{z}/{x}/{y}@2x?access_token=M', maxZoom: 22, tileSize: 512, zoomOffset: -1 });
    expect((await box.tiles('dark', 'en'))?.url).toContain('/mapbox/dark-v11/');
    expect((await box.tiles('satellite', 'en'))?.url).toContain('/mapbox/satellite-streets-v12/');
    expect((await box.credits('road', view, 'en')).map((c) => c.text)).toEqual(['© Mapbox', '© OpenStreetMap', 'Improve this map']);
    expect(box.logo).toEqual({ text: 'mapbox', href: 'https://www.mapbox.com/' });
  });

  it('draws traffic only from a style of the app’s own: Mapbox has none of its own to draw as images', async () => {
    expect(mapbox({ token: 'M' }).traffic).toBeUndefined();
    const box = mapbox({ token: 'M', trafficStyle: 'nile/traffic-only' });
    expect(await box.traffic!('dark', 'en')).toEqual({ url: 'https://api.mapbox.com/styles/v1/nile/traffic-only/tiles/512/{z}/{x}/{y}@2x?access_token=M', maxZoom: 22, tileSize: 512, zoomOffset: -1 });
  });

  it('searches as people type, asking for results it may keep', async () => {
    const found = { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [2.3522, 48.8566] }, properties: { name: 'Paris', full_address: 'Paris, France', place_formatted: 'Île-de-France, France' } }] };
    const { fetch, asked } = network({ 'https://api.mapbox.com/search/geocode/v6/forward': found, 'https://api.mapbox.com/search/geocode/v6/reverse': found });
    const box = mapbox({ token: 'M', fetch });
    expect(await box.search!({ text: 'paris', near: { lat: 48, lng: 2 }, locale: 'fr' })).toEqual([{ label: 'Paris', detail: 'Île-de-France, France', lat: 48.8566, lng: 2.3522 }]);
    expect(asked[0].url).toBe('https://api.mapbox.com/search/geocode/v6/forward?q=paris&limit=5&language=fr&proximity=2%2C48&permanent=true&access_token=M');
    expect(await box.reverse!({ lat: 48.8566, lng: 2.3522, locale: 'en' })).toBe('Paris, France');
  });
});

describe('any map images', () => {
  it('draws from the app’s own address, with its own credit', async () => {
    const own = tiles({ url: 'https://maps.example.com/{z}/{x}/{y}.png', credit: { text: '© Example' }, darkUrl: 'https://maps.example.com/dark/{z}/{x}/{y}.png' });
    expect(await own.tiles('road', 'en')).toEqual({ url: 'https://maps.example.com/{z}/{x}/{y}.png', maxZoom: 19 });
    expect((await own.tiles('dark', 'en'))?.url).toBe('https://maps.example.com/dark/{z}/{x}/{y}.png');
    expect(await own.tiles('satellite', 'en')).toBeNull();
    expect(await own.credits('road', view, 'en')).toEqual([{ text: '© Example' }]);
    expect(own.traffic).toBeUndefined();
  });

  it('draws the app’s own traffic over them, when it has some', async () => {
    const own = tiles({ url: 'https://maps.example.com/{z}/{x}/{y}.png', trafficUrl: 'https://maps.example.com/traffic/{z}/{x}/{y}.png', maxZoom: 18, credit: { text: '© Example' } });
    expect(await own.traffic!('road', 'en')).toEqual({ url: 'https://maps.example.com/traffic/{z}/{x}/{y}.png', maxZoom: 18 });
  });
});

describe('routes along the roads', () => {
  const TAHRIR = { lat: 30.0444, lng: 31.2357 };
  const ZAMALEK = { lat: 30.0626, lng: 31.2197 };
  /** Their answers for this route, as each gave them on 12 Oct 2026: Azure's (the key taken out) and OSRM's. */
  const AZURE_ROUTE = JSON.parse(readFileSync(join(__dirname, 'fixtures/azure-route.json'), 'utf8'));
  const OSRM_ROUTE = JSON.parse(readFileSync(join(__dirname, 'fixtures/osrm-route.json'), 'utf8'));

  it('asks Azure Maps for its route path, a GeoJSON of the points in order, and reads its line, metres and seconds', async () => {
    const { fetch, asked } = network({ 'https://atlas.microsoft.com/route/directions': AZURE_ROUTE });
    const route = await azureMaps({ key: 'k', fetch }).route!({ points: [TAHRIR, ZAMALEK], mode: 'car', locale: 'en' });
    expect(route.metres).toBe(3311);
    expect(route.seconds).toBe(489);
    expect(route.line).toHaveLength(110);
    expect(route.line[0]).toEqual({ lat: 30.04405, lng: 31.2358 });
    expect(asked[0].url).toBe('https://atlas.microsoft.com/route/directions?api-version=2025-01-01&subscription-key=k');
    const body = JSON.parse(String(asked[0].init?.body));
    expect(body.features.map((f: { geometry: { coordinates: number[] } }) => f.geometry.coordinates)).toEqual([[31.2357, 30.0444], [31.2197, 30.0626]]);
    expect(body).toMatchObject({ travelMode: 'driving', routeOutputOptions: ['routePath'] });
    // A stop on the way is passed through, not stopped at.
    await azureMaps({ key: 'k', fetch }).route!({ points: [TAHRIR, { lat: 30.05, lng: 31.23 }, ZAMALEK], mode: 'foot', locale: 'en' });
    const via = JSON.parse(String(asked[1].init?.body));
    expect(via.features.map((f: { properties: { pointType: string } }) => f.properties.pointType)).toEqual(['waypoint', 'viaWaypoint', 'waypoint']);
    expect(via.travelMode).toBe('walking');
    // The time with traffic, when it gives one.
    const busy = structuredClone(AZURE_ROUTE);
    busy.features.find((f: { properties: { type: string } }) => f.properties.type === 'RoutePath').properties.durationTrafficInSeconds = 612;
    const slow = network({ 'https://atlas.microsoft.com/route/directions': busy });
    expect((await azureMaps({ key: 'k', fetch: slow.fetch }).route!({ points: [TAHRIR, ZAMALEK], mode: 'car', locale: 'en' })).seconds).toBe(612);
  });

  it('says plainly that Azure Maps has no routes by bike, and what a route-less answer is', async () => {
    const { fetch } = network({ 'https://atlas.microsoft.com/route/directions': { type: 'FeatureCollection', features: [] } });
    await expect(azureMaps({ key: 'k', fetch }).route!({ points: [TAHRIR, ZAMALEK], mode: 'bike', locale: 'en' })).rejects.toThrow('Azure Maps finds routes by car or on foot, not by bike');
    await expect(azureMaps({ key: 'k', fetch }).route!({ points: [TAHRIR, ZAMALEK], mode: 'car', locale: 'en' })).rejects.toThrow('Azure Maps found no route');
  });

  it('asks OSRM by its profile, the points longitude first', async () => {
    const { fetch, asked } = network({ 'https://router.project-osrm.org/route/v1/': OSRM_ROUTE, 'https://osrm.example.test/route/v1/': OSRM_ROUTE });
    const route = await openStreetMap({ fetch }).route!({ points: [TAHRIR, ZAMALEK], mode: 'car', locale: 'en' });
    expect(asked[0].url).toBe('https://router.project-osrm.org/route/v1/driving/31.2357,30.0444;31.2197,30.0626?overview=full&geometries=geojson');
    expect([route.metres, route.seconds, route.line.length]).toEqual([3380.8, 242.9, 139]);
    await openStreetMap({ fetch, osrmUrl: 'https://osrm.example.test/' }).route!({ points: [TAHRIR, ZAMALEK], mode: 'bike', locale: 'en' });
    expect(asked[1].url.startsWith('https://osrm.example.test/route/v1/cycling/')).toBe(true);
  });

  it('asks Google’s Routes API for only the fields it reads, and decodes its line', async () => {
    // The answer as Google's reference shows it; its polyline the documented example.
    const { fetch, asked } = network({ 'https://routes.googleapis.com/directions/v2:computeRoutes': { routes: [{ distanceMeters: 3380, duration: '512s', polyline: { encodedPolyline: '_p~iF~ps|U_ulLnnqC_mqNvxq`@' } }] } });
    const route = await googleMaps({ key: 'g', fetch }).route!({ points: [TAHRIR, { lat: 30.05, lng: 31.23 }, ZAMALEK], mode: 'bike', locale: 'ar' });
    expect(route).toEqual({ metres: 3380, seconds: 512, line: [{ lat: 38.5, lng: -120.2 }, { lat: 40.7, lng: -120.95 }, { lat: 43.252, lng: -126.453 }] });
    const sent = asked[0].init!;
    expect((sent.headers as Record<string, string>)['X-Goog-FieldMask']).toBe('routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline');
    expect(JSON.parse(String(sent.body))).toEqual({
      origin: { location: { latLng: { latitude: 30.0444, longitude: 31.2357 } } },
      destination: { location: { latLng: { latitude: 30.0626, longitude: 31.2197 } } },
      intermediates: [{ location: { latLng: { latitude: 30.05, longitude: 31.23 } } }],
      travelMode: 'BICYCLE',
    });
  });

  /** Google's own answers on 12 Oct 2026, each to the request Fieldia sends (the key taken out). */
  const GOOGLE_ROUTES = JSON.parse(readFileSync(join(__dirname, 'fixtures/google-routes-live.json'), 'utf8')) as Record<string, { request: unknown; body: unknown }>;
  const googleAnswering = (name: string) => network({ 'https://routes.googleapis.com/directions/v2:computeRoutes': GOOGLE_ROUTES[name].body });
  const pointsOf = (name: string) => {
    const sent = GOOGLE_ROUTES[name].request as { origin: { location: { latLng: { latitude: number; longitude: number } } }; destination: { location: { latLng: { latitude: number; longitude: number } } } };
    return [sent.origin, sent.destination].map(({ location: { latLng } }) => ({ lat: latLng.latitude, lng: latLng.longitude }));
  };

  it('says plainly where Google has no bicycle routes: it answers Cairo’s with nothing', async () => {
    const cairo = googleAnswering('bike-tahrir-zamalek');
    await expect(googleMaps({ key: 'g', fetch: cairo.fetch }).route!({ points: pointsOf('bike-tahrir-zamalek'), mode: 'bike', locale: 'en' })).rejects.toThrow(/Google has no bicycle routes here/);
    expect(JSON.parse(String(cairo.asked[0].init?.body))).toEqual(GOOGLE_ROUTES['bike-tahrir-zamalek'].request);
    // Berlin's, it has.
    const berlin = googleAnswering('bike-berlin-control');
    expect((await googleMaps({ key: 'g', fetch: berlin.fetch }).route!({ points: pointsOf('bike-berlin-control'), mode: 'bike', locale: 'en' })).metres).toBe(2754);
  });

  it('takes a route from a spot to itself as no way to go: Google leaves out its zero metres, and draws one point', async () => {
    for (const [name, mode, seconds] of [['car-same-point', 'car', 3], ['walk-same-point', 'foot', 0]] as const) {
      const { fetch, asked } = googleAnswering(name);
      const route = await googleMaps({ key: 'g', fetch }).route!({ points: pointsOf(name), mode, locale: 'en' });
      expect(JSON.parse(String(asked[0].init?.body))).toEqual(GOOGLE_ROUTES[name].request);
      // Its one point the road's nearest to Tahrir.
      const road = { lat: 30.04429, lng: 31.23527 };
      expect(route).toEqual({ metres: 0, seconds, line: [road, road] });
    }
  });

  it('asks Mapbox by its profile, traffic for a car', async () => {
    const { fetch, asked } = network({ 'https://api.mapbox.com/directions/v5/': { routes: [{ distance: 3400.5, duration: 300.2, geometry: { type: 'LineString', coordinates: [[31.2357, 30.0444], [31.2197, 30.0626]] } }] } });
    const route = await mapbox({ token: 't', fetch }).route!({ points: [TAHRIR, ZAMALEK], mode: 'car', locale: 'en' });
    expect(asked[0].url).toBe('https://api.mapbox.com/directions/v5/mapbox/driving-traffic/31.2357,30.0444;31.2197,30.0626?geometries=geojson&overview=full&access_token=t');
    expect(route).toEqual({ metres: 3400.5, seconds: 300.2, line: [TAHRIR, ZAMALEK] });
  });

  it('takes the app’s own routes with its own map images', async () => {
    const own = jest.fn(async () => ({ line: [TAHRIR, ZAMALEK], metres: 1, seconds: 2 }));
    expect(await tiles({ url: 'https://x.test/{z}/{x}/{y}.png', credit: { text: 'x' }, route: own }).route!({ points: [TAHRIR, ZAMALEK], mode: 'car', locale: 'en' })).toEqual({ line: [TAHRIR, ZAMALEK], metres: 1, seconds: 2 });
    expect(tiles({ url: 'https://x.test/{z}/{x}/{y}.png', credit: { text: 'x' } }).route).toBeUndefined();
  });
});

describe('reachable areas', () => {
  const TAHRIR = { lat: 30.0444, lng: 31.2357 };
  /** Azure's answer for 15 minutes' drive from Tahrir, as it gave it on 12 Oct 2026. */
  const AZURE_RANGE = JSON.parse(readFileSync(join(__dirname, 'fixtures/azure-range.json'), 'utf8'));

  it('asks Azure Maps’ Route Range for the time in seconds by car, and reads its boundary', async () => {
    const { fetch, asked } = network({ 'https://atlas.microsoft.com/route/range': AZURE_RANGE });
    const area = await azureMaps({ key: 'k', fetch }).reach!({ at: TAHRIR, minutes: 15, mode: 'car' });
    expect(asked[0].url).toBe('https://atlas.microsoft.com/route/range?api-version=2025-01-01&subscription-key=k');
    expect(JSON.parse(String(asked[0].init!.body))).toEqual({ type: 'Feature', geometry: { type: 'Point', coordinates: [31.2357, 30.0444] }, properties: { timeBudgetInSec: 900, travelMode: 'driving' } });
    expect(area.rings).toHaveLength(1);
    expect(area.rings[0].length).toBeGreaterThan(20);
    // Not the centre it also sends: the boundary.
    expect(area.rings[0][0]).toEqual({ lat: 30.09273, lng: 31.23572 });
  });

  it('says plainly that Azure Maps reaches by car alone, and what an area-less answer is', async () => {
    const { fetch } = network({ 'https://atlas.microsoft.com/route/range': { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [31.2, 30] }, properties: { type: 'center' } }] } });
    await expect(azureMaps({ key: 'k', fetch }).reach!({ at: TAHRIR, minutes: 15, mode: 'foot' })).rejects.toThrow('Azure Maps works out reachable areas by car, not by bike or on foot');
    await expect(azureMaps({ key: 'k', fetch }).reach!({ at: TAHRIR, minutes: 15, mode: 'car' })).rejects.toThrow('Azure Maps found no reachable area');
  });

  it('asks Mapbox’s Isochrone by its profile, as polygons', async () => {
    // The answer as Mapbox's reference shows it.
    const ring = [[31.2, 30.0], [31.3, 30.0], [31.3, 30.1], [31.2, 30.0]];
    const { fetch, asked } = network({ 'https://api.mapbox.com/isochrone/v1/': { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { contour: 10 }, geometry: { type: 'Polygon', coordinates: [ring] } }] } });
    const area = await mapbox({ token: 't', fetch }).reach!({ at: TAHRIR, minutes: 10, mode: 'foot' });
    expect(asked[0].url).toBe('https://api.mapbox.com/isochrone/v1/mapbox/walking/31.2357,30.0444?contours_minutes=10&polygons=true&access_token=t');
    expect(area.rings).toEqual([ring.map(([lng, lat]) => ({ lat, lng }))]);
  });

  it('has none from OpenStreetMap or Google, and takes the app’s own', async () => {
    expect(openStreetMap({}).reach).toBeUndefined();
    expect(googleMaps({ key: 'g' }).reach).toBeUndefined();
    const own = jest.fn(async () => ({ rings: [[TAHRIR, TAHRIR, TAHRIR]] }));
    expect(tiles({ url: 'https://x.test/{z}/{x}/{y}.png', credit: { text: 'x' }, reach: own }).reach).toBe(own);
  });
});
