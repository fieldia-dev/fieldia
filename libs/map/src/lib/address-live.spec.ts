/** @jest-environment node */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { azureMaps, googleMaps } from './providers';
import { addressLine } from './address-line';

/**
 * Azure Maps and Google, as they answered on 12 Oct 2026 (the keys taken
 * out): each answer given back only to the request it was given to, so a
 * request Fieldia sends differently from the one sent live finds no answer.
 * Their suggestions in Egypt, Saudi Arabia, the UAE and Jordan, read into
 * two lines and an address's parts; a suggestion picked, located; a point
 * named.
 */

interface Recorded {
  request: string | { url?: string; body?: unknown };
  acceptLanguage?: string;
  status: number;
  body: unknown;
}
const AZURE = JSON.parse(readFileSync(join(__dirname, 'fixtures/azure-live.json'), 'utf8')) as Record<string, Recorded>;
const GOOGLE = JSON.parse(readFileSync(join(__dirname, 'fixtures/google-live.json'), 'utf8')) as Record<string, Recorded>;

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/** A request's own words: its path and its parameters, the key left out, numbers read as numbers ("31.2357,30.0444"). */
function said(url: string) {
  const at = new URL(url);
  const params = [...at.searchParams.entries()].filter(([key]) => key !== 'subscription-key').map(([key, value]) => [key, /^-?[\d.]+(,-?[\d.]+)*$/.test(value) ? value.split(',').map(Number).join(',') : value]);
  return JSON.stringify([at.pathname, Object.fromEntries(params.sort())]);
}

/** Azure as it answered: the recorded answer to the very request, in its language; without a place to look near, its refusal. */
function azure() {
  const asked: URL[] = [];
  const fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    asked.push(new URL(url));
    const language = (init?.headers as Record<string, string> | undefined)?.['Accept-Language'];
    const answer = Object.values(AZURE).find((r) => said(String(r.request)) === said(url) && (r.acceptLanguage ?? 'en-US') === language);
    if (answer) return json(answer.status, answer.body);
    // Azure's own rule, as it answered it live: an autocomplete needs a place to look near.
    if (url.includes('geocode:autocomplete') && !/[?&](coordinates|bbox)=/.test(url)) return json(400, AZURE['ac-nocoords'].body);
    return json(404, { error: { message: `not recorded: ${said(url)} ${language}` } });
  }) as typeof globalThis.fetch;
  return { fetch, asked };
}

const CAIRO = { lat: 30.0444, lng: 31.2357 };
const RIYADH = { lat: 24.7136, lng: 46.6753 };
const DUBAI = { lat: 25.2048, lng: 55.2708 };
const AMMAN = { lat: 31.9516, lng: 35.9239 };

describe('Azure Maps’ suggestions, as it answers them', () => {
  it('asks the whole world, by prominence, when the page gives no place to look near: Azure refuses an autocomplete with neither', async () => {
    const { fetch, asked } = azure();
    const found = await azureMaps({ key: 'K', fetch }).search!({ text: 'Tahrir Street', locale: 'en' });
    expect(asked[0].searchParams.get('bbox')).toBe('-180,-90,180,90');
    expect(asked[0].searchParams.has('coordinates')).toBe(false);
    expect(found.map((place) => place.label)).toContain('El Tahrir Street');
    // Near a place, by distance from it.
    const near = azure();
    await azureMaps({ key: 'K', fetch: near.fetch }).search!({ text: 'Tahrir Street', near: CAIRO, locale: 'en' });
    expect([near.asked[0].searchParams.get('coordinates'), near.asked[0].searchParams.has('bbox')]).toEqual(['31.2357,30.0444', false]);
  });

  it('asks Azure for the one country the page names, so its own suggestions there come, not those the world over left out', async () => {
    const { fetch, asked } = azure();
    const found = await azureMaps({ key: 'K', fetch }).search!({ text: 'Olaya', near: CAIRO, locale: 'en', countries: ['SA'] });
    expect(asked[0].searchParams.get('countryRegion')).toBe('SA');
    expect(found.map((place) => place.label)).toEqual(['Olaya Street', 'Al Olaya', 'Liat Al Olaya', 'Olaya Street', 'Olaya Street']);
    expect(found[3].detail).toBe('Al Olaya, Riyadh, Saudi Arabia');
    const marina = await azureMaps({ key: 'K', fetch: azure().fetch }).search!({ text: 'Marina', near: CAIRO, locale: 'en', countries: ['ae'], parts: true });
    expect(marina.map((place) => place.label)).toContain('Dubai Marina');
    expect(marina.every((place) => place.parts?.country === 'AE')).toBe(true);
    // No place to look near, in one country: the whole world's box, kept to it.
    const anywhere = azure();
    const egypt = await azureMaps({ key: 'K', fetch: anywhere.fetch }).search!({ text: 'Tahrir Street', locale: 'en', countries: ['EG'] });
    expect([anywhere.asked[0].searchParams.get('countryRegion'), anywhere.asked[0].searchParams.get('bbox')]).toEqual(['EG', '-180,-90,180,90']);
    expect(egypt).toHaveLength(5);
  });

  it('asks once for each country the page names, never a list Azure answers with nothing, and takes them in turn; a code Azure refuses is never sent', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { fetch, asked } = azure();
    const found = await azureMaps({ key: 'K', fetch }).search!({ text: 'Sheikh Zayed', near: CAIRO, locale: 'en', countries: ['EG', 'AE', 'XX', 'EGY'], parts: true });
    expect(asked.map((url) => url.searchParams.get('countryRegion'))).toEqual(['EG', 'AE']);
    // Said to the developer: Azure refuses a whole search for one of them ("Unsupported region id").
    expect(warn.mock.calls.map(([words]) => String(words))).toEqual(['[Fieldia] "XX" is not a country\'s ISO code ("EG", "SA"): the address search leaves it out.', '[Fieldia] "EGY" is not a country\'s ISO code ("EG", "SA"): the address search leaves it out.']);
    warn.mockRestore();
    expect(found.map((place) => [place.label, place.parts?.country])).toEqual([
      ['Sheikh Zayed City', 'EG'],
      ['Sheikh Zayed Grand Mosque', 'AE'],
      ['El Sheikh Zayed Station', 'EG'],
      ['Sheikh Zayed Road', 'AE'],
      ['Arab El Sheikh Zayed - El Saf', 'EG'],
    ]);
    // One country with nothing to say: the other's alone.
    const one = await azureMaps({ key: 'K', fetch: azure().fetch }).search!({ text: 'Tahrir Street', near: CAIRO, locale: 'en', countries: ['EG', 'SA'] });
    expect(one.map((place) => place.detail)).toEqual(['El Balaqsa, Cairo, Egypt', 'El Tahrir, Giza, Al Jizah, Egypt', 'Ad-Duqqi, Al Jizah, 12311, Egypt', 'El Tahrir, Giza, Al Jizah, Egypt', 'Zenein, Giza, Al Jizah, 12351, Egypt']);
  });

  it('says a numbered Saudi address’s street once: Azure joins its street and district with a dash', async () => {
    const { fetch } = azure();
    const found = await azureMaps({ key: 'K', fetch }).search!({ text: '2 King Fahd Road Riyadh', near: RIYADH, locale: 'en' });
    expect(found[3]).toMatchObject({ label: '2 King Fahd Road', detail: 'Al Olaya, Riyadh, Saudi Arabia' });
    expect(addressLine([found[3].label, found[3].detail], 'en')).toBe('2 King Fahd Road, Al Olaya, Riyadh, Saudi Arabia');
    const arabic = await azureMaps({ key: 'K', fetch: azure().fetch }).search!({ text: 'طريق الملك فهد', near: RIYADH, locale: 'ar' });
    expect(arabic[0]).toMatchObject({ label: 'طريق الملك فهد', detail: 'الرحمانية، الرياض، المملكة العربية السعودية' });
  });

  it('says a place that is its own town once, not again under it', async () => {
    const { fetch } = azure();
    const [city] = await azureMaps({ key: 'K', fetch }).search!({ text: 'Sheikh Zayed', near: CAIRO, locale: 'en' });
    expect(city.label).toBe('Sheikh Zayed City');
    expect(city.detail).not.toMatch(/Sheikh Zayed/);
    const [abdoun] = await azureMaps({ key: 'K', fetch: azure().fetch }).search!({ text: 'Abdoun', near: AMMAN, locale: 'en', countries: ['JO'] });
    expect(abdoun).toMatchObject({ label: 'Abdoun', detail: 'Amman, Jordan' });
    const [road] = await azureMaps({ key: 'K', fetch: azure().fetch }).search!({ text: 'Sheikh Zayed Road', near: DUBAI, locale: 'en' });
    expect(road).toMatchObject({ label: 'Sheikh Zayed Road', detail: 'Dubai, United Arab Emirates' });
  });

  it('names the city where Azure keeps it: an admin district in Egypt, Saudi Arabia, the UAE and Jordan, where its locality is a district', async () => {
    const parts = async (text: string, near: { lat: number; lng: number }, locale: 'en' | 'ar' = 'en', countries?: string[]) =>
      (await azureMaps({ key: 'K', fetch: azure().fetch }).search!({ text, near, locale, parts: true, countries })).map((place) => place.parts);
    expect((await parts('Tahrir Street', CAIRO))[0]).toEqual({ street: 'El Tahrir Street', city: 'Cairo', region: 'Cairo', country: 'EG' });
    // Giza's district, in Giza.
    expect((await parts('Tahrir Street', CAIRO))[1]).toEqual({ street: '31 Street', city: 'Giza', region: 'Al Jizah', country: 'EG' });
    expect((await parts('التجمع الخامس', CAIRO, 'ar'))[0]).toEqual({ city: 'القاهرة الجديدة', region: 'القاهرة', postcode: '11774', country: 'EG' });
    expect((await parts('King Fahd Road', RIYADH))[0]).toEqual({ street: 'King Fahd Road', city: 'Riyadh', region: 'Riyadh', country: 'SA' });
    expect((await parts('Sheikh Zayed Road', DUBAI))[1]).toEqual({ street: 'Sheikh Zayed Road', city: 'Dubai', region: 'Dubai', country: 'AE' });
    expect((await parts('Abdoun', AMMAN, 'en', ['JO']))[0]).toEqual({ city: 'Amman', region: 'Amman', country: 'JO' });
    // A district of its own, with no locality: still a city.
    expect((await parts('الشيخ زايد', CAIRO, 'ar'))[0]).toEqual({ city: 'الشيخ زايد', region: 'الجيزة', country: 'EG' });
    // Elsewhere, its locality is the city.
    expect((await parts('Fifth Settlement', CAIRO))[0]).toEqual({ street: '5th St', city: 'Rome', region: 'New York', postcode: '13440', country: 'US' });
  });

  it('keeps a street whose name starts with a number from wearing it twice: Azure makes it its house number', async () => {
    const { fetch } = azure();
    const [first] = await azureMaps({ key: 'K', fetch }).search!({ text: '26 July Street Zamalek', near: CAIRO, locale: 'en', parts: true });
    expect(first).toMatchObject({ label: '26 July Street', detail: 'Mohamed Mazhar, Cairo, Egypt', parts: { street: '26 July Street', city: 'Cairo' } });
    // A number typed is the house's own.
    const [numbered] = await azureMaps({ key: 'K', fetch: azure().fetch }).search!({ text: '15 Tahrir Street', near: CAIRO, locale: 'en', parts: true });
    expect([numbered.label, numbered.parts?.street]).toEqual(['15 El Tahrir Street', '15 El Tahrir Street']);
    // A postcode typed reads as a house number to Azure; it is left as Azure has it, as a house's five digits would be.
    const [postcode] = await azureMaps({ key: 'K', fetch: azure().fetch }).search!({ text: '12311', near: CAIRO, locale: 'en' });
    expect(postcode.label).toBe('12311 El Kasr El Aini Street');
  });

  it('names an emirate and a country in the page’s language, never Azure’s codes and spellings ("DU", "Mişr")', async () => {
    const { fetch } = azure();
    const dubai = await azureMaps({ key: 'K', fetch }).search!({ text: 'شارع الشيخ زايد', near: DUBAI, locale: 'ar' });
    expect(dubai[0]).toMatchObject({ label: 'شارع الشيخ زايد', detail: 'دبي، الإمارات العربية المتحدة' });
    expect(dubai.map((place) => place.detail).join()).not.toContain('DU');
    const tagamoa = await azureMaps({ key: 'K', fetch: azure().fetch }).search!({ text: 'التجمع الخامس', near: CAIRO, locale: 'ar' });
    expect(tagamoa[1]).toMatchObject({ label: 'التجمع الخامس', detail: 'القاهرة الجديدة، القاهرة، مصر' });
    expect(tagamoa.map((place) => place.detail).join()).not.toContain('Mişr');
  });
});

describe('a suggestion of Azure’s picked', () => {
  it('is located in its own district: a hit elsewhere is refused, and the district stands in for it, said to be near', async () => {
    const { fetch, asked } = azure();
    const found = await azureMaps({ key: 'K', fetch }).search!({ text: 'King Fahd Road', near: RIYADH, locale: 'en' });
    expect(found[2]).toMatchObject({ label: 'King Fahd Road', detail: 'Al Olaya, Riyadh, Saudi Arabia' });
    // Azure's first answer is King Fahd Road at Al Olaya Street, in Al Arid, 16 km away; its district is Al Olaya.
    expect(await found[2].locate!()).toEqual({ lat: 24.694242477416992, lng: 46.687294006347656, address: 'King Fahd Road, Al Olaya, Riyadh, Saudi Arabia', precise: false });
    expect(asked.slice(1).map((url) => [url.searchParams.get('query'), url.searchParams.get('top'), url.searchParams.get('api-version')])).toEqual([
      ['King Fahd Road - Al Olaya, Riyadh, Saudi Arabia', '5', '2026-01-01'],
      ['Al Olaya, Riyadh, Saudi Arabia', '1', '2026-01-01'],
    ]);
  });

  it('refuses a hit Azure itself is unsure of, a street found in place of the house', async () => {
    const { fetch } = azure();
    const found = await azureMaps({ key: 'K', fetch }).search!({ text: '2 King Fahd Road Riyadh', near: RIYADH, locale: 'en' });
    // "King Fahd Road, Riyadh 12361": Low, UpHierarchy, 5 km off.
    expect(await found[3].locate!()).toMatchObject({ lat: 24.694242477416992, lng: 46.687294006347656, precise: false });
  });

  it('takes the street in its district, said to be near, when the house is not found; and a good hit as it is', async () => {
    const { fetch, asked } = azure();
    const [house] = await azureMaps({ key: 'K', fetch }).search!({ text: '15 Tahrir Street', near: CAIRO, locale: 'en' });
    expect(await house.locate!()).toEqual({ lat: 30.0441504188108, lng: 31.2423197184108, address: '15 El Tahrir Street, El Balaqsa, Cairo, Egypt', precise: false });
    expect(asked).toHaveLength(2);
    const [street] = await azureMaps({ key: 'K', fetch: azure().fetch }).search!({ text: 'Tahrir Street', near: CAIRO, locale: 'en' });
    expect(await street.locate!()).toEqual({ lat: 30.0441504188108, lng: 31.2423197184108, address: 'El Tahrir Street, El Balaqsa, Cairo, Egypt' });
  });
});

describe('a point named by Azure', () => {
  it('reads its address in order, the street first, through the geocoding of 2026', async () => {
    const name = async (lat: number, lng: number, locale: 'en' | 'ar') => {
      const { fetch, asked } = azure();
      const named = await azureMaps({ key: 'K', fetch }).reverse!({ lat, lng, locale });
      expect(asked[0].searchParams.get('api-version')).toBe('2026-01-01');
      return named;
    };
    expect(await name(24.6942, 46.6873, 'en')).toBe('2348 Al Jumayhaa Street, Al Olaya, Riyadh, 12222, Saudi Arabia');
    expect(await name(31.952, 35.929, 'en')).toBe('Yazid Bin Abi Sufyan Street 46, الياسمين, Amman, Jordan');
    expect(await name(30.0074, 31.4913, 'ar')).toBe("5th Tagamoa' Qesm-1st New Cairo، القاهرة، 11774، مصر");
    expect(await name(30.0444, 31.2357, 'ar')).toBe('7 ميدان التحرير، Cairo، القاهرة، مصر');
  });
});

/** Google as it answered: the recorded suggestions for the words typed, and each place's details by its id. */
function google(suggestions: string) {
  const asked: { url: string; init?: RequestInit }[] = [];
  const answer = GOOGLE[suggestions].body;
  const fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    asked.push({ url, init });
    if (url.endsWith('places:autocomplete')) return json(200, answer);
    const id = decodeURIComponent(url.split('/places/')[1].split('?')[0]);
    const details = Object.values(GOOGLE).find((r) => typeof r.request === 'object' && String(r.request.url).includes(`/places/${id}`));
    return details ? json(details.status, details.body) : json(404, { error: { message: `not recorded: ${id}` } });
  }) as typeof globalThis.fetch;
  return { fetch, asked };
}

/** A place's details as Google gave them, read as Fieldia reads a picked one. */
async function picked(name: string, locale: 'en' | 'ar' = 'en', types = ['route', 'geocode']) {
  const recorded = GOOGLE[name];
  const id = String((recorded.request as { url: string }).url).split('/places/')[1].split('?')[0];
  const suggestions = { suggestions: [{ placePrediction: { placeId: decodeURIComponent(id), types, structuredFormat: { mainText: { text: 'Picked' } } } }] };
  const fetch = (async (input: RequestInfo | URL) => (String(input).endsWith('places:autocomplete') ? json(200, suggestions) : json(200, recorded.body))) as typeof globalThis.fetch;
  const [found] = await googleMaps({ key: 'G', fetch }).search!({ text: 'x', locale, parts: true });
  return found.locate!();
}

describe('Google’s places, as it answers them', () => {
  it('names the city of an Egyptian address by its district: Google gives Egypt’s streets no locality', async () => {
    expect((await picked('pick-tahrir-square-en-route')).parts).toEqual({ street: 'El-Tahrir Square', city: 'Qasr El Nil', region: 'Cairo Governorate', country: 'EG' });
    expect((await picked('pick-tahrir-street-ar-dokki-route', 'ar')).parts).toEqual({ street: 'شارع التحرير', city: 'قسم الدقي', region: 'محافظة الجيزة', country: 'EG' });
    expect((await picked('pick-road-9-maadi-en')).parts?.city).toBe('Maadi');
    expect((await picked('pick-street-90th-en')).parts?.city).toBe('New Cairo 1');
    // A locality where there is one: a city itself, Riyadh, Amman.
    expect((await picked('pick-new-cairo-city-en-locality')).parts?.city).toBe('New Cairo City');
    expect((await picked('pick-number-7524-king-fahd-en')).parts?.city).toBe('Riyadh');
    expect((await picked('pick-rainbow-street-amman-en')).parts?.city).toBe('Amman');
  });

  it('puts a street’s number where Google writes it in that country: before it in Egypt and Saudi Arabia, after it in Jordan and Germany', async () => {
    expect((await picked('pick-number-1-mohamed-mahmoud-en')).parts?.street).toBe('1 Mohammed Mahmoud');
    expect((await picked('pick-number-7524-king-fahd-en')).parts?.street).toBe('7524 King Fahd Road');
    // Google's own ": 15", without its colon, in the parts and in the line.
    const dokki = await picked('pick-number-15-tahrir-dokki-ar', 'ar');
    expect([dokki.parts?.street, dokki.address]).toEqual(['15 شارع التحرير', '15 شارع التحرير، الدقي، محافظة الجيزة 3750161، مصر']);
    expect((await picked('cmp-amman-number-postal')).parts?.street).toBe('Rainbow Street 15');
    expect((await picked('cmp-berlin-number-postal')).parts?.street).toBe('Friedrichstraße 43');
  });

  it('keeps a Saudi postcode’s additional number, as a ZIP+4 keeps its four', async () => {
    expect((await picked('pick-number-7524-king-fahd-en')).parts?.postcode).toBe('13521-4273');
  });

  it('keeps the name of a building or a shop picked, never Google’s plus code in its place', async () => {
    const building = google('ac-sheikh-zayed-city-en');
    const found = await googleMaps({ key: 'G', fetch: building.fetch }).search!({ text: 'Sheikh Zayed City', locale: 'en', parts: true });
    expect(await found[1].locate!()).toMatchObject({ address: 'Sheikh Zayed City, the seventh district, the third neighborhood Build 26, First Al Sheikh Zayed, Giza Governorate 3241507, Egypt' });
    const mall = google('ac-citymark-en');
    const [citymark] = await googleMaps({ key: 'G', fetch: mall.fetch }).search!({ text: 'Citymark Sheikh Zayed', locale: 'en' });
    expect((await citymark.locate!()).address).toBe('Citymark, Al Mostakbal, First Al Sheikh Zayed, Giza Governorate 3244030, Egypt');
    // An address as Google writes it, a plus code before it or not.
    const [city] = found;
    expect((await city.locate!()).address).toBe('El Sheikh Zayed City, Giza Governorate, Egypt');
  });

  it('lists the addresses first for an address field, the shops after them', async () => {
    const { fetch } = google('ac-road-9-maadi-en');
    const found = await googleMaps({ key: 'G', fetch }).search!({ text: 'Road 9 Maadi', locale: 'en', addresses: true });
    expect(found.map((place) => place.label)).toEqual(['Road 9', 'Maadi used books', 'Maadi Educational Administration', 'Maadi Skin Medica', 'Maadi Engineering Car Co.']);
    // A map's own search, as Google ranks them.
    const map = await googleMaps({ key: 'G', fetch: google('ac-road-9-maadi-en').fetch }).search!({ text: 'Road 9 Maadi', locale: 'en' });
    expect(map[0].label).toBe('Maadi used books');
  });

  it('asks Google only for countries it knows, at most fifteen: one it refuses, or one too many, fails the whole search', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { fetch, asked } = google('ac-king-fahd-road-eg-sa');
    await googleMaps({ key: 'G', fetch }).search!({ text: 'King Fahd Road', locale: 'en', countries: ['EG', 'sa', 'XX', 'EGY', 'UK'] });
    expect(JSON.parse(String(asked[0].init?.body)).includedRegionCodes).toEqual(['eg', 'sa', 'gb']);
    const many = 'EG SA AE JO KW QA BH OM LB SY IQ YE LY TN DZ MA'.split(' ');
    await googleMaps({ key: 'G', fetch }).search!({ text: 'King Fahd Road', locale: 'en', countries: many });
    expect(JSON.parse(String(asked[1].init?.body)).includedRegionCodes).toBeUndefined();
    expect(warn.mock.calls.map(([words]) => String(words)).join('\n')).toMatch(/15 countries at most/);
    warn.mockRestore();
  });

  it('ends a session when a suggestion is picked, though nothing is looked up: the next address typed is a session of its own', async () => {
    const { fetch, asked } = google('ac-road-9-maadi-en');
    const maps = googleMaps({ key: 'G', fetch });
    const [first] = await maps.search!({ text: 'Road 9', locale: 'en' });
    first.picked?.();
    await maps.search!({ text: 'Road 1', locale: 'en' });
    const tokens = asked.map(({ init }) => JSON.parse(String(init?.body)).sessionToken);
    expect(tokens[0]).not.toBe(tokens[1]);
  });
});
