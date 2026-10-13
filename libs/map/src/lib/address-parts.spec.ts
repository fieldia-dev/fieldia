/** @jest-environment node */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sameName } from './address-parts';
import { azureMaps, googleMaps, mapbox, openStreetMap } from './providers';

/**
 * Each provider's answer read into an address's parts, as `json.address`
 * keeps them (street with its number, city, region, postcode, country by its
 * ISO code), when an address field asks for them; and the suggestions kept to
 * the countries it names, by the provider where it can be asked, by reading
 * its answer where it cannot. A search that asks for neither is as it was.
 */

/** Azure Maps' own answers, as it gave them on 12 Oct 2026. */
const AZURE = JSON.parse(readFileSync(join(__dirname, 'fixtures/azure-answers.json'), 'utf8'));

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

/** A place as Photon answers it, with every part it names. */
const photonFeature = (lng: number, lat: number, properties: Record<string, string>) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [lng, lat] }, properties: { osm_key: 'place', ...properties } });
const PHOTON = {
  type: 'FeatureCollection',
  features: [
    photonFeature(31.2391, 30.0487, { type: 'house', housenumber: '12', street: 'Tahrir Street', district: 'Downtown', city: 'Cairo', state: 'Cairo Governorate', postcode: '11511', country: 'Egypt', countrycode: 'EG' }),
    photonFeature(31.2197, 30.0626, { type: 'street', name: '26 July Street', district: 'Zamalek', city: 'Cairo', state: 'Cairo Governorate', country: 'Egypt', countrycode: 'EG' }),
    photonFeature(31.2357, 30.0444, { type: 'city', name: 'Cairo', state: 'Cairo Governorate', country: 'Egypt', countrycode: 'EG' }),
    photonFeature(39.8262, 21.4225, { type: 'street', name: 'Tahrir Street', city: 'Mecca', state: 'Makkah Region', country: 'Saudi Arabia', countrycode: 'SA' }),
  ],
};

describe('an address in its parts', () => {
  it('reads Photon’s properties: a street or a city may be the place itself', async () => {
    const { fetch } = network({ 'https://photon.komoot.io/api': PHOTON });
    const found = await openStreetMap({ fetch }).search!({ text: 'tahrir', locale: 'en', parts: true });
    expect(found.map((place) => place.parts)).toEqual([
      { street: 'Tahrir Street 12', city: 'Cairo', region: 'Cairo Governorate', postcode: '11511', country: 'EG' },
      { street: '26 July Street', city: 'Cairo', region: 'Cairo Governorate', country: 'EG' },
      { city: 'Cairo', region: 'Cairo Governorate', country: 'EG' },
      { street: 'Tahrir Street', city: 'Mecca', region: 'Makkah Region', country: 'SA' },
    ]);
    // Asked for nothing more, the places are as a map's search has them.
    expect((await openStreetMap({ fetch }).search!({ text: 'tahrir', locale: 'en' }))[0]).toEqual({ label: 'Tahrir Street 12', detail: 'Downtown, Cairo, Egypt', lat: 30.0487, lng: 31.2391 });
  });

  it('keeps Photon’s places to the countries asked for, by reading its answer: Photon cannot be asked', async () => {
    const { fetch, asked } = network({ 'https://photon.komoot.io/api': PHOTON });
    const found = await openStreetMap({ fetch }).search!({ text: 'tahrir', locale: 'en', countries: ['SA'] });
    expect(found.map((place) => place.label)).toEqual(['Tahrir Street']);
    expect(asked[0].url).toBe('https://photon.komoot.io/api?q=tahrir&limit=6&lang=en');
  });

  it('asks Nominatim for its address details and its countries, and reads them', async () => {
    const answer = [
      {
        lat: '30.0487',
        lon: '31.2391',
        name: '',
        display_name: '12, Tahrir Street, Downtown, Cairo, Cairo Governorate, 11511, Egypt',
        address: { house_number: '12', road: 'Tahrir Street', suburb: 'Downtown', city: 'Cairo', state: 'Cairo Governorate', 'ISO3166-2-lvl4': 'EG-C', postcode: '11511', country: 'Egypt', country_code: 'eg' },
      },
      { lat: '31.2', lon: '29.9', name: 'Borg El Arab', display_name: 'Borg El Arab, Alexandria, Egypt', address: { town: 'Borg El Arab', state: 'Alexandria', country: 'Egypt', country_code: 'eg' } },
    ];
    const { fetch, asked } = network({ 'https://nominatim.openstreetmap.org/search': answer });
    const found = await openStreetMap({ fetch, search: 'nominatim' }).search!({ text: 'tahrir', locale: 'ar', countries: ['EG', 'SA'], parts: true });
    expect(asked[0].url).toBe('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&q=tahrir&accept-language=ar&countrycodes=eg%2Csa&addressdetails=1');
    expect(found.map((place) => place.parts)).toEqual([
      { street: 'Tahrir Street 12', city: 'Cairo', region: 'Cairo Governorate', postcode: '11511', country: 'EG' },
      { city: 'Borg El Arab', region: 'Alexandria', country: 'EG' },
    ]);
  });

  it('reads Azure’s suggestions, its own street line first, its city where it keeps one in Egypt, in English and in Arabic without direction marks', async () => {
    const { fetch } = network({ 'https://atlas.microsoft.com/geocode:autocomplete': AZURE.autocomplete });
    const [first] = await azureMaps({ key: 'K', fetch }).search!({ text: '26 july st', locale: 'en', parts: true });
    // Not the house number Azure makes of the street's own "26"; not the district it calls a locality.
    expect(first.parts).toEqual({ street: '26 July Street', city: 'Cairo', region: 'Cairo', country: 'EG' });
    const arabic = network({ 'https://atlas.microsoft.com/geocode:autocomplete': AZURE.autocompleteArabic });
    const found = await azureMaps({ key: 'K', fetch: arabic.fetch }).search!({ text: 'ميدان التح', locale: 'ar', parts: true });
    // A place, then a street: a place has no street line of its own.
    expect(found[0].parts).toEqual({ city: 'القاهرة', region: 'القاهرة', country: 'EG' });
    expect(found[1].parts).toEqual({ street: 'ميدان التحرير', city: 'القاهرة', region: 'القاهرة', country: 'EG' });
  });

  it('asks Azure for the country asked for, and keeps its answer to it', async () => {
    const { fetch, asked } = network({ 'https://atlas.microsoft.com/geocode:autocomplete': AZURE.autocompleteArabic });
    const found = await azureMaps({ key: 'K', fetch }).search!({ text: 'ميدان التح', locale: 'ar', countries: ['YE'] });
    expect(asked[0].url).toContain('&countryRegion=YE&');
    // An answer from elsewhere (this one is Cairo's) is never suggested.
    expect(found).toEqual([]);
  });

  it('asks Google for its regions, and for the parts with the place picked, at the same price', async () => {
    const suggestions = { suggestions: [{ placePrediction: { placeId: 'A1', text: { text: '1 Mohamed Mahmoud, Cairo, Egypt' }, structuredFormat: { mainText: { text: '1 Mohamed Mahmoud' }, secondaryText: { text: 'Cairo, Egypt' } } } }] };
    const details = {
      location: { latitude: 30.0436, longitude: 31.2371 },
      formattedAddress: '1 Mohamed Mahmoud, Qasr El Nil, Cairo Governorate 4272077, Egypt',
      addressComponents: [
        { longText: '1', shortText: '1', types: ['street_number'] },
        { longText: 'Mohamed Mahmoud', shortText: 'Mohamed Mahmoud', types: ['route'] },
        { longText: 'Qasr El Nil', shortText: 'Qasr El Nil', types: ['sublocality_level_1', 'sublocality', 'political'] },
        { longText: 'Cairo', shortText: 'Cairo', types: ['locality', 'political'] },
        { longText: 'Cairo Governorate', shortText: 'Cairo Governorate', types: ['administrative_area_level_1', 'political'] },
        { longText: 'Egypt', shortText: 'EG', types: ['country', 'political'] },
        { longText: '4272077', shortText: '4272077', types: ['postal_code'] },
      ],
    };
    const { fetch, asked } = network({ 'https://places.googleapis.com/v1/places:autocomplete': suggestions, 'https://places.googleapis.com/v1/places/A1': details });
    const [found] = await googleMaps({ key: 'G', fetch }).search!({ text: 'mohamed mah', locale: 'en', countries: ['EG'], parts: true });
    expect(JSON.parse(String(asked[0].init?.body)).includedRegionCodes).toEqual(['eg']);
    // Its suggestions carry no parts: the place picked does.
    expect(found.parts).toBeUndefined();
    // Its number before the street, where Google's own line has it.
    expect(await found.locate!()).toEqual({ lat: 30.0436, lng: 31.2371, address: details.formattedAddress, parts: { street: '1 Mohamed Mahmoud', city: 'Cairo', region: 'Cairo Governorate', postcode: '4272077', country: 'EG' } });
    expect((asked[1].init?.headers as Record<string, string>)['X-Goog-FieldMask']).toBe('location,formattedAddress,addressComponents');
  });

  it('asks Mapbox for its countries and reads its context: its address line, its city', async () => {
    const answer = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [2.3554, 48.8556] },
          properties: {
            feature_type: 'address',
            name: '12 Rue de Rivoli',
            full_address: '12 Rue de Rivoli, 75004 Paris, France',
            place_formatted: '75004 Paris, France',
            context: {
              address: { address_number: '12', street_name: 'Rue de Rivoli', name: '12 Rue de Rivoli' },
              street: { name: 'Rue de Rivoli' },
              postcode: { name: '75004' },
              locality: { name: '4th arrondissement of Paris' },
              place: { name: 'Paris' },
              region: { name: 'Île-de-France', region_code: 'IDF' },
              country: { name: 'France', country_code: 'fr', country_code_alpha_3: 'FRA' },
            },
          },
        },
      ],
    };
    const { fetch, asked } = network({ 'https://api.mapbox.com/search/geocode/v6/forward': answer });
    const [found] = await mapbox({ token: 'M', fetch }).search!({ text: '12 rue de rivoli', locale: 'fr', countries: ['FR', 'BE'], parts: true });
    expect(asked[0].url).toBe('https://api.mapbox.com/search/geocode/v6/forward?q=12%20rue%20de%20rivoli&limit=5&language=fr&country=fr%2Cbe&permanent=true&access_token=M');
    expect(found.parts).toEqual({ street: '12 Rue de Rivoli', city: 'Paris', region: 'Île-de-France', postcode: '75004', country: 'FR' });
  });

  it('says OpenStreetMap’s credit under suggestions shown without its map', () => {
    expect(openStreetMap().searchCredit).toEqual({ text: '© OpenStreetMap contributors', href: 'https://www.openstreetmap.org/copyright' });
  });
});

describe('one place’s names, however a provider spells them', () => {
  it('are one place’s in two spellings, or in Latin and in Arabic, as Azure names a town and its province', () => {
    const same: [string, string][] = [
      ['Giza', 'Al Jizah'],
      ['Gizeh', 'الجيزة'],
      ['Ḩā’il', "Ha'il"],
      ['Ha’il', 'حائل'],
      ['Amman', 'عمان'],
      ['Cairo', 'القاهرة'],
      ['Sharjah', 'Ash Shāriqah'],
      ['Tabūk', 'Tabuk'],
      ['Domiat', 'Dumyat'],
      ['El Ismailia', "Al Isma'iliyah"],
      ['Al Khubar', 'Al Khobar'],
      ['الشيـخ زايد', 'الشيخ زايد'],
    ];
    expect(same.filter(([one, other]) => !sameName(one, other))).toEqual([]);
  });

  it('are not when only some of their letters agree: districts and their cities, names of one sound', () => {
    const different: [string, string][] = [
      ['Al Woroud', 'Riyadh'],
      ['Al Olaya', 'Riyadh'],
      ['Huqan', 'Al Khurmah'],
      ['Jabal Amman', 'Amman'],
      ['Dokki', 'Gise'],
      ['Kalba', 'Ash Shāriqah'],
      ['Tema', 'Suhaj'],
      ['El Tahrir', 'Giza'],
    ];
    expect(different.filter(([one, other]) => sameName(one, other))).toEqual([]);
  });
});
