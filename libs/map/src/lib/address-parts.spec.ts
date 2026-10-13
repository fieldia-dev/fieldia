/** @jest-environment node */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { azureLocate, azurePlaces } from './address-parts';
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

describe('a place and the places around it, however alike their names', () => {
  /** A suggestion of Azure's as its autocomplete gives one: a district of a city, in a province. */
  const district = (name: string, city: string, province: string, code: string) => ({
    type: 'Feature',
    geometry: null,
    properties: { typeGroup: 'Place', type: 'PopulatedPlace', address: { locality: name, adminDistricts: [{ name: province, shortName: code }, { name: city }], countryRegion: { ISO: 'SA', name: 'Saudi Arabia' } } },
  });

  it('says each, and writes its city: a district whose name sounds like its city’s, or like another district’s, is not that place', () => {
    const alike: [string, string][] = [
      ['Al Rawdah', 'Riyadh'],
      ['Al Ruwaydah', 'Riyadh'],
      ['Al Nada', 'Al Nahdah'],
      ['Al Quds', 'Al Qadisiyah'],
      ['Al Sahafa', 'Al Safa'],
      ['Al Rabwah', 'Al Rabi'],
      ['Al Zahraa', 'Al Zuhur'],
      ['Maadi', 'Al Madi'],
    ];
    const found = azurePlaces({ features: alike.map(([name, city]) => district(name, city, 'Riyadh', 'RIY')) }, 'en', '', true);
    expect(found.map((place) => [place.label, place.detail, place.parts?.city])).toEqual(alike.map(([name, city]) => [name, city === 'Riyadh' ? 'Riyadh, Saudi Arabia' : `${city}, Riyadh, Saudi Arabia`, city]));
  });

  it('says a name once where it is the same words, its accents, vowel marks and tatweel aside; a city Fieldia knows, in the page’s words', () => {
    const [olaya, zayed] = azurePlaces({ features: [district('Al Olaya', 'Riyadh', 'Riyadh', 'RIY'), district('الشيـخ زايد', 'الشيخ زايد', 'الجيزة', '')] }, 'ar');
    expect([olaya.detail, zayed.detail]).toEqual(['الرياض، المملكة العربية السعودية', 'الجيزة، المملكة العربية السعودية']);
  });
});

describe('a region and a city named one way, and a street’s district said', () => {
  /** A suggestion of Azure's, its fields as its autocomplete gave them live on 13 Oct 2026. */
  const azure = (type: string, address: Record<string, unknown>) => ({ type: 'Feature', geometry: null, properties: { type, address } });
  const uae = (name: string) => ({ ISO: 'AE', name });

  it('names an emirate or a province one way in each language, whichever name or code Azure gives it in each suggestion', () => {
    const english = azurePlaces(
      {
        features: [
          azure('Neighborhood', { locality: 'Al Majaz, Sharjah', adminDistricts: [{ name: 'Sharjah Emirate', shortName: 'SH' }], countryRegion: uae('United Arab Emirates'), formattedAddress: 'Sharjah, United Arab Emirates' }),
          azure('RoadBlock', { locality: 'Sharjah', adminDistricts: [{ name: 'Ash Shāriqah', shortName: 'SH' }], countryRegion: uae('United Arab Emirates'), streetName: 'Al Wahda Street', addressLine: 'Al Wahda Street', formattedAddress: 'Al Wahda Street, Halwan, Sharjah, SH, United Arab Emirates' }),
          azure('Neighborhood', { locality: 'Al Khalidiyah', adminDistricts: [{ name: 'Abu Dhabi Emirate', shortName: 'AZ' }], countryRegion: uae('United Arab Emirates') }),
        ],
      },
      'en',
      '',
      true,
    );
    expect(english.map((place) => [place.detail, place.parts?.region])).toEqual([
      ['Sharjah, United Arab Emirates', 'Sharjah'],
      ['Halwan, Sharjah, United Arab Emirates', 'Sharjah'],
      ['Abu Dhabi, United Arab Emirates', 'Abu Dhabi'],
    ]);
    const saudi = { ISO: 'SA', name: 'السعودية' };
    const arabic = azurePlaces(
      {
        features: [
          azure('RoadBlock', { locality: 'العليا', adminDistricts: [{ name: 'منطقة الرياض' }, { name: 'الرياض' }], countryRegion: saudi, streetName: '', addressLine: '', formattedAddress: 'العليا, الرياض, Al ‘Arabīyah as Su‘ūdīyah' }),
          azure('PopulatedPlace', { locality: 'الروضة', adminDistricts: [{ name: 'الرياض', shortName: 'RIY' }, { name: 'الرياض' }], countryRegion: saudi }),
          azure('RoadBlock', { locality: 'مدينة الشارقة', adminDistricts: [{ name: 'الشارقة', shortName: 'SH' }], countryRegion: uae('الإمارات العربية المتحدة'), streetName: '30 Street', addressLine: '30 Street', formattedAddress: '‏30 Street, الفشت‏, مدينة‏ الشارقة‏, SH, الإمارات‏ العربية‏ المتحدة' }),
        ],
      },
      'ar',
      '',
      true,
    );
    expect(arabic.map((place) => [place.label, place.detail, place.parts?.city, place.parts?.region])).toEqual([
      ['العليا', 'الرياض، المملكة العربية السعودية', 'الرياض', 'الرياض'],
      ['الروضة', 'الرياض، المملكة العربية السعودية', 'الرياض', 'الرياض'],
      // Sharjah the city ("مدينة الشارقة") and the emirate ("الشارقة"): one name each, said once; Al Fisht, which Azure names only in its own line, between them.
      ['30 Street', 'الفشت، الشارقة، الإمارات العربية المتحدة', 'الشارقة', 'الشارقة'],
    ]);
  });

  it('says a district Azure names only in its line, so two streets of one number are told apart; never a piece of a line written another way', () => {
    const sharjah = (street: string, formattedAddress: string) =>
      azure('RoadBlock', { locality: 'Sharjah', adminDistricts: [{ name: 'Ash Shāriqah', shortName: 'SH' }], countryRegion: uae('United Arab Emirates'), streetName: street, addressLine: street, formattedAddress });
    const found = azurePlaces(
      {
        features: [
          sharjah('19 Street', '19 Street, Al Layyeh, Sharjah, SH, United Arab Emirates'),
          sharjah('19 Street', '19 Street, Al Abar, Sharjah, SH, United Arab Emirates'),
          // A line that does not start with the street: nothing read from it.
          sharjah('Al Khan Street', 'Sharjah, United Arab Emirates'),
        ],
      },
      'en',
    );
    expect(found.map((place) => place.detail)).toEqual(['Al Layyeh, Sharjah, United Arab Emirates', 'Al Abar, Sharjah, United Arab Emirates', 'Sharjah, United Arab Emirates']);
  });
});

describe('a street of Azure’s located in its own district', () => {
  type Hit = { line: string; district: string; at: [number, number]; type?: string; codes?: string[] };
  const hit = ({ line, district, at, type = 'Address', codes = ['Ambiguous'] }: Hit) => ({
    geometry: { coordinates: [at[1], at[0]] },
    properties: { type, confidence: 'Medium', matchCodes: codes, address: { addressLine: line, neighborhood: district, locality: 'Abu Dhabi', adminDistricts: [{ name: 'Abu Dhabi' }], countryRegion: { ISO: 'AE' }, formattedAddress: `${line}, ${district}, Abu Dhabi, United Arab Emirates` } },
  });
  const area = (name: string, at: [number, number]) => ({ geometry: { coordinates: [at[1], at[0]] }, properties: { type: 'PopulatedPlace', confidence: 'High', matchCodes: ['Ambiguous'], address: { locality: name, adminDistricts: [{ shortName: 'AZ' }], countryRegion: { ISO: 'AE' } } } });
  const suggestion = (street: string) =>
    azurePlaces(
      { features: [{ properties: { type: 'RoadBlock', address: { locality: 'Abu Dhabi', adminDistricts: [{ name: 'Abu Dhabi Emirate', shortName: 'AZ' }], countryRegion: { ISO: 'AE' }, streetName: street, addressLine: street, formattedAddress: `${street}, Al Bateen, Abu Dhabi, AZ, United Arab Emirates` } } }] },
      'en',
      '',
      true,
      { lat: 24.4539, lng: 54.3773 },
    )[0];

  it('takes another district’s street of the same number for another street: the district then, nearest where the search looked, and said to be near', async () => {
    const asked: Record<string, unknown>[] = [];
    const answers = [
      { features: [hit({ line: '8', district: 'Al Jami Al Kabeer', at: [24.4077, 54.4711] }), hit({ line: '8', district: 'Al Mazoon', at: [24.4087, 54.4666] })] },
      { features: [] },
      // Al Ain's Al Bateen first, as Azure ranks them; Abu Dhabi's nearer where the search looked.
      { features: [area('Al Bateen', [24.2049, 55.6197]), area('Al Bateen', [24.4516, 54.3447])] },
    ];
    const located = await azureLocate(async (params) => (asked.push(params), answers[asked.length - 1]), suggestion('8'), 'en');
    expect(located).toMatchObject({ lat: 24.4516, lng: 54.3447, address: '8, Al Bateen, Abu Dhabi, United Arab Emirates', precise: false, parts: { street: '8', city: 'Abu Dhabi' } });
    expect(asked.map((params) => params['addressLine'] ?? params['query'] ?? params['locality'])).toEqual(['8', '8, Al Bateen, Abu Dhabi, United Arab Emirates', 'Al Bateen']);
  });

  it('takes its district, where Azure finds the street only as the town above it, as Azure answered live for Sharjah’s 19 Street in Al Layyeh', async () => {
    const sharjah = { adminDistricts: [{ shortName: 'SH' }], countryRegion: { ISO: 'AE' } };
    const [street] = azurePlaces(
      { features: [{ properties: { type: 'RoadBlock', address: { locality: 'مدينة الشارقة', adminDistricts: [{ name: 'الشارقة', shortName: 'SH' }], countryRegion: { ISO: 'AE' }, streetName: '19 Street', addressLine: '19 Street', formattedAddress: '‏19 Street, اللية‏, مدينة‏ الشارقة‏, SH, الإمارات‏ العربية‏ المتحدة' } } }] },
      'ar',
      '',
      true,
      { lat: 25.3463, lng: 55.4209 },
    );
    const asked: Record<string, unknown>[] = [];
    const answers = [
      { features: [{ geometry: { coordinates: [55.42106, 25.34615] }, properties: { type: 'PopulatedPlace', confidence: 'Medium', matchCodes: ['UpHierarchy'], address: { locality: 'مدينة الشارقة', ...sharjah } } }] },
      { features: [{ geometry: { coordinates: [55.37251, 25.34709] }, properties: { type: 'Neighborhood', confidence: 'Medium', matchCodes: ['UpHierarchy'], address: { neighborhood: 'اللية', locality: 'مدينة الشارقة', ...sharjah } } }] },
    ];
    const located = await azureLocate(async (params) => (asked.push(params), answers[asked.length - 1]), street, 'ar');
    expect(located).toMatchObject({ lat: 25.34709, lng: 55.37251, address: '19 Street، اللية، الشارقة، الإمارات العربية المتحدة', precise: false, parts: { street: '19 Street', city: 'الشارقة', region: 'الشارقة' } });
    expect(asked.map((params) => params['addressLine'] ?? params['locality'])).toEqual(['19 Street', 'اللية']);
  });

  it('takes a named street’s stretch in its own district, and another district’s stretch where Azure gives no other: one street through several', async () => {
    const stretches = [hit({ line: 'Al Khaleej Al Arabi Street', district: 'Al Mushrif', at: [24.44, 54.39] }), hit({ line: 'Al Khaleej Al Arabi Street', district: 'Al Bateen', at: [24.45, 54.34] })];
    const own = await azureLocate(async () => ({ features: stretches }), suggestion('Al Khaleej Al Arabi Street'), 'en');
    expect([own.lat, own.lng, own.precise]).toEqual([24.45, 54.34, undefined]);
    const other = await azureLocate(async () => ({ features: stretches.slice(0, 1) }), suggestion('Al Khaleej Al Arabi Street'), 'en');
    expect([other.lat, other.lng, other.precise]).toEqual([24.44, 54.39, undefined]);
  });
});
