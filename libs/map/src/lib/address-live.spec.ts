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

  it('says each place once by its words, and never takes one place for another whose name sounds like it: a city and its governorate spelt apart are both said', async () => {
    const [, giza] = await azureMaps({ key: 'K', fetch: azure().fetch }).search!({ text: 'Tahrir Street', near: CAIRO, locale: 'en', countries: ['EG', 'SA'] });
    // Its city "Giza" (its second admin district), its governorate "Al Jizah": two names Azure gives, both said, as no guess tells two spellings of one name from two names.
    expect(giza).toMatchObject({ label: '31 Street', detail: 'El Tahrir, Giza, Al Jizah, Egypt' });
    const sharjah = await azureMaps({ key: 'K', fetch: azure().fetch }).search!({ text: 'Al Wahda Street Sharjah', locale: 'en', countries: ['AE'] });
    expect(sharjah.map((place) => place.detail)).toEqual(['Sharjah, Ash Shāriqah, United Arab Emirates', 'Kalba, Ash Shāriqah, United Arab Emirates']);
  });

  it('lists a place once though Azure gives it twice (a road with no name, in the district that is listed itself), and reads past the tatweel', async () => {
    const olaya = await azureMaps({ key: 'K', fetch: azure().fetch }).search!({ text: 'العلي', near: RIYADH, locale: 'ar', countries: ['SA'] });
    expect(olaya.map((place) => [place.label, place.detail])).toEqual([
      ['العليا', 'الرياض، المملكة العربية السعودية'],
      ['105', 'العليا، الرياض، المملكة العربية السعودية'],
      ['Zaheer Rustam Street', 'العليا، الرياض، 12244، المملكة العربية السعودية'],
      ["Abdullah Bin Zam'a Street", 'العليا، الرياض، 12244، المملكة العربية السعودية'],
    ]);
    // "الشيـخ زايد", its town "الشيخ زايد": the same words, said once.
    const zayed = await azureMaps({ key: 'K', fetch: azure().fetch }).search!({ text: 'الشيخ زا', near: CAIRO, locale: 'ar', countries: ['EG'] });
    expect(zayed[1]).toMatchObject({ label: 'الشيـخ زايد', detail: 'الجيزة، 12556، مصر' });
  });

  it('names a neighbourhood by its own name, which Azure puts first in its locality ("Zamâlek, Cairo"), and its city as its governorate’s: Zamalek is Cairo’s', async () => {
    const zamalek = await azureMaps({ key: 'K', fetch: azure().fetch }).search!({ text: 'Zamalek', locale: 'en', countries: ['EG', 'SA'], parts: true });
    expect(zamalek[1]).toMatchObject({ label: 'Zamâlek', detail: 'Cairo, Egypt', parts: { city: 'Cairo', region: 'Cairo', country: 'EG' } });
    // As Azure answers it live: "El Zamalek", its locality, in Cairo alone: a district, its city Cairo.
    expect(zamalek[0]).toMatchObject({ label: 'El Zamalek', detail: 'Cairo, Egypt', parts: { city: 'Cairo', region: 'Cairo', country: 'EG' } });
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

  it('takes the locality for the city in Saudi Arabia where Azure gives one admin district alone, a province: the locality is the town then; in Egypt, the governorate’s city', async () => {
    const parts = async (text: string, near: { lat: number; lng: number } | undefined, countries: string[]) =>
      (await azureMaps({ key: 'K', fetch: azure().fetch }).search!({ text, near, locale: 'en', parts: true, countries })).map((place) => place.parts);
    // Al Khubar in the Eastern Province; Al Khurmah, 250 km from Mecca, in Makkah's.
    expect((await parts('Prince Turki St Al Khob', undefined, ['SA']))[1]).toEqual({ street: 'Prince Turki Street', city: 'Al Khubar', region: 'Eastern', country: 'SA' });
    expect((await parts('King Faisal St', CAIRO, ['EG', 'SA']))[0]).toEqual({ street: 'King Faisal Street', city: 'Al Khurmah', region: 'Makkah', country: 'SA' });
    // Azure files Sheikh Zayed City under Cairo alone, as it files Cairo's own districts ("El Zamalek"): its city is Cairo's, by Egypt's rule. Azure's Arabic answer gives it its own (Giza, Sheikh Zayed).
    expect((await parts('Sheikh Zayed', CAIRO, []))[0]).toMatchObject({ city: 'Cairo', region: 'Cairo', country: 'EG' });
  });

  it('names a UAE city as Azure tells it: Dubai and Ajman are their emirates’ cities; the other emirates’ localities are their towns, never "Abu Dhabi Emirate"', async () => {
    const parts = async (text: string) => (await azureMaps({ key: 'K', fetch: azure().fetch }).search!({ text, locale: 'en', parts: true, countries: ['AE'] })).map((place) => place.parts);
    expect((await parts('Al Wahda Street Sharjah')).map((found) => [found?.city, found?.region])).toEqual([
      ['Sharjah', 'Ash Shāriqah'],
      ['Kalba', 'Ash Shāriqah'],
    ]);
    expect((await parts('Sheikh Rashid Bin Humaid Street'))[0]).toEqual({ street: 'Sheikh Rashid Bin Humaid Al Nuaimi Street', city: 'Ajman', region: 'Ajman Emirate', country: 'AE' });
    // Al Ain's quarters, which Azure files under the emirate alone: the quarter, where Azure names no town.
    const abuDhabi = await parts('Khalifa Bin Zayed Street');
    expect(abuDhabi.map((found) => found?.city)).toEqual(['Asharej', 'Ghireebah', 'Al Maqam', 'Al Bateen', 'Al Salamat']);
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
  const pick = async (text: string, locale: 'en' | 'ar', near: { lat: number; lng: number } | undefined, countries: string[] | undefined, which: (place: { label: string; detail?: string }, i: number) => boolean) => {
    const { fetch, asked } = azure();
    const found = await azureMaps({ key: 'K', fetch }).search!({ text, near, locale, countries, parts: true });
    const place = found.find(which)!;
    return { place, located: await place.locate!(), asked: asked.filter((url) => url.pathname === '/geocode') };
  };

  it('is asked of Azure’s geocoding by its own address, in its structured form: its governorate keeps it in its own town, not another of the same district name that Azure ranks first', async () => {
    // "Al Nahdah" is in Jeddah, Tabuk, Riyadh and Dammam; asked by its words, Azure gives Al Duwadimi's, Huraymila's, Afif's and Al Kharj's before Riyadh's.
    const nahdah = await pick('Al Nahda', 'en', undefined, ['EG', 'SA'], ({ detail }) => !!detail?.startsWith('Riyadh'));
    expect([nahdah.place.label, nahdah.located]).toEqual(['Al Nahdah', { lat: 24.760343551635742, lng: 46.81574630737305, address: 'Al Nahdah, Riyadh, Saudi Arabia', parts: { city: 'Riyadh', region: 'Riyadh', country: 'SA' } }]);
    // Its locality, its province and governorate, its country: never its words as one query, nor where the map is (the page gave none).
    expect(Object.fromEntries(nahdah.asked[0].searchParams)).toEqual({ 'api-version': '2026-01-01', top: '5', locality: 'Al Nahdah', adminDistrict: 'Riyadh', adminDistrict2: 'Riyadh', countryRegion: 'SA', 'subscription-key': 'K' });
    // El Tahrir in Tema, Sohag: not the El Tahrir in Giza near the map, 360 km away.
    const tema = await pick('El Tahrir Tem', 'en', CAIRO, ['EG'], ({ detail }) => !!detail?.startsWith('Tema'));
    expect(tema.located).toEqual({ lat: 26.871919631958008, lng: 31.419221878051758, address: 'El Tahrir, Tema, Suhaj, Egypt', parts: { city: 'Tema', region: 'Suhaj', country: 'EG' } });
    // Al Duwadimi's Al Olaya: not Riyadh's, 230 km away.
    const olaya = await pick('العليا الدوادمي', 'ar', RIYADH, ['SA'], () => true);
    expect(olaya.located).toEqual({ lat: 24.53575325012207, lng: 44.40029525756836, address: 'العليا، الدوادمي، الرياض، المملكة العربية السعودية', parts: { city: 'الدوادمي', region: 'الرياض', country: 'SA' } });
    // Al Khubar's street, though Azure spells its town "Al Khobar" there.
    const khobar = await pick('Prince Turki St Al Khob', 'en', undefined, ['SA'], ({ detail }) => !!detail?.startsWith('Al Khubar'));
    expect(khobar.located).toMatchObject({ lat: 26.2894126500008, lng: 50.2198505499914, address: 'Prince Turki Street, Al Khubar, Eastern, Saudi Arabia' });
    expect(khobar.located.precise).toBeUndefined();
    // Sharjah's street: its emirate "Ash Shāriqah" (SH) in the suggestion, "Sharjah Emirate" in the hit, a name beside a code: not a different emirate.
    const sharjah = await pick('Al Wahda Street Sharjah', 'en', undefined, ['AE'], ({ detail }) => !!detail?.startsWith('Sharjah'));
    expect(sharjah.located).toMatchObject({ lat: 25.353978600063, lng: 55.4138630999806, address: 'Al Wahda Street, Sharjah, Ash Shāriqah, United Arab Emirates' });
    expect(sharjah.located.precise).toBeUndefined();
  });

  it('is not located anywhere else: with no hit in its own governorate, none is written', async () => {
    // Azure's answer to Al Duwadimi's Al Olaya asked without its town: Riyadh's, Qassim's, Buraydah's; none in Al Duwadimi.
    const elsewhere = AZURE['v1-olaya-sa-geocode'].body;
    const fetch = (async (input: RequestInfo | URL, init?: RequestInit) =>
      String(input).includes('geocode:autocomplete') ? azure().fetch(input, init) : json(200, elsewhere)) as typeof globalThis.fetch;
    const [olaya] = await azureMaps({ key: 'K', fetch }).search!({ text: 'العليا الدوادمي', near: RIYADH, locale: 'ar', countries: ['SA'] });
    await expect(olaya.locate!()).rejects.toThrow('Azure Maps found "العليا، الدوادمي، الرياض، المملكة العربية السعودية" nowhere in its own district and town');
  });

  it('refuses a hit outside the suggestion’s own governorate, though Azure gives it to the structured question, and asks by its two lines then', async () => {
    const { located, asked } = await pick('Mohandessin', 'en', CAIRO, ['EG'], ({ label }) => label === 'Soria');
    // Azure answers "Haret Soria" in Shubra El Kheima, Qalyubia, for Mohandessin's Soria (Giza); asked by its two lines, Soria in Agouza, Giza: the street.
    expect(asked.map((url) => url.searchParams.get('query') ?? url.searchParams.get('addressLine'))).toEqual(['Soria', 'Soria, El Mohandessin, Giza, Al Jizah, Egypt']);
    expect(located).toMatchObject({ lat: 30.0531737871735, lng: 31.2010040559053 });
    expect(located.precise).toBeUndefined();
  });

  it('asks for a street with its district and town, not where the search looked: one of a road’s stretches, as Azure ranks them, is the street itself', async () => {
    const kingFahd = await pick('King Fahd Road', 'en', RIYADH, undefined, (_, i) => i === 2);
    expect(kingFahd.place).toMatchObject({ label: 'King Fahd Road', detail: 'Al Olaya, Riyadh, Saudi Arabia' });
    expect(kingFahd.located).toEqual({ lat: 24.7343642500028, lng: 46.6606356000113, address: 'King Fahd Road, Al Olaya, Riyadh, Saudi Arabia', parts: { street: 'King Fahd Road', city: 'Riyadh', region: 'Riyadh', country: 'SA' } });
    expect(Object.fromEntries(kingFahd.asked[0].searchParams)).toMatchObject({ addressLine: 'King Fahd Road', locality: 'Al Olaya', adminDistrict: 'Riyadh', adminDistrict2: 'Riyadh', countryRegion: 'SA' });
    // Where the search looked may be a town away from the street: it would rank the stretch nearest it, not the street's own.
    expect(kingFahd.asked[0].searchParams.has('coordinates')).toBe(false);
    expect(kingFahd.asked).toHaveLength(1);
    // A road of Azure's own, its suggestion's district: "El Bank El Markazy", High and Good.
    const bank = await pick('Mohandessin', 'en', CAIRO, ['EG'], ({ label }) => label === 'El Bank El Markazy');
    expect(bank.located).toMatchObject({ lat: 30.061392854799, lng: 31.2054219632006 });
    expect(bank.located.precise).toBeUndefined();
  });

  it('is only near when Azure is unsure of the hit, or found it only above it: a house not found, its street; a street not found, its district', async () => {
    // "King Fahd Road, Riyadh 12361" for house 2: Low, UpHierarchy.
    const house = await pick('2 King Fahd Road Riyadh', 'en', RIYADH, undefined, (_, i) => i === 3);
    expect(house.located).toMatchObject({ lat: 24.7343642500028, lng: 46.6606356000113, precise: false });
    const [tahrir] = await azureMaps({ key: 'K', fetch: azure().fetch }).search!({ text: '15 Tahrir Street', near: CAIRO, locale: 'en' });
    expect(await tahrir.locate!()).toEqual({ lat: 30.0441504188108, lng: 31.2423197184108, address: '15 El Tahrir Street, El Balaqsa, Cairo, Egypt', precise: false });
    // A street of New Maadi Azure finds only as New Maadi (a populated place, UpHierarchy): its centre, near, not the street.
    const maadi = await pick('المعادي', 'ar', CAIRO, ['EG'], ({ label }) => label === 'المحمدية');
    expect(maadi.located).toMatchObject({ lat: 29.97357177734375, lng: 31.29014015197754, precise: false });
    // A street found as it is.
    const { fetch, asked } = azure();
    const [street] = await azureMaps({ key: 'K', fetch }).search!({ text: 'Tahrir Street', near: CAIRO, locale: 'en' });
    expect(await street.locate!()).toEqual({ lat: 30.0441504188108, lng: 31.2423197184108, address: 'El Tahrir Street, El Balaqsa, Cairo, Egypt' });
    expect(asked).toHaveLength(2);
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
    // A locality Azure names in Latin on an Arabic page, as its own formatted address does ("Cairo, القاهرة"; "Amman"): said as it is, beside its governorate, as no guess tells a name in two alphabets from two names.
    expect(await name(30.0444, 31.2357, 'ar')).toBe('7 ميدان التحرير، Cairo، القاهرة، مصر');
    expect(await name(31.952, 35.929, 'ar')).toBe('شارع يزيد بن أبي سفيان 46، الياسمين، Amman، عمان، الأردن');
  });
});

/** An object's fields in one order, to compare. */
const canonical = (value: Record<string, unknown>) => JSON.stringify(Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))));

/**
 * Google as it answered: the recorded suggestions, given back only to the
 * request sent live (its words, language, region and countries; a session
 * token of its own), unless `anyRequest`; and each place's details by its
 * id, asked for with an Essentials field mask.
 */
function google(suggestions: string, anyRequest = false) {
  const asked: { url: string; init?: RequestInit }[] = [];
  const recorded = GOOGLE[suggestions];
  const fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    asked.push({ url, init });
    if (url.endsWith('places:autocomplete')) {
      const { sessionToken, ...sent } = JSON.parse(String(init?.body)) as Record<string, unknown>;
      const { sessionToken: token, ...live } = (recorded.request as { body: Record<string, unknown> }).body as Record<string, unknown>;
      const same = typeof sessionToken === 'string' && typeof token === 'string' && canonical(sent) === canonical(live);
      return same || anyRequest ? json(200, recorded.body) : json(400, { error: { message: `not recorded: ${canonical(sent)}` } });
    }
    expect(['location,formattedAddress', 'location,formattedAddress,addressComponents']).toContain((init?.headers as Record<string, string>)['X-Goog-FieldMask']);
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

  it('sets a Saudi address’s country apart, where Google writes no comma before it ("Riyadh Saudi Arabia")', async () => {
    expect((await picked('pick-king-fahd-road-riyadh-en')).address).toBe('King Fahd Rd, Riyadh, Saudi Arabia');
    expect((await picked('pick-king-fahd-road-riyadh-ar', 'ar')).address).toBe('طريق الملك فهد، الرياض، السعودية');
  });

  it('keeps a Saudi postcode’s additional number, as a ZIP+4 keeps its four', async () => {
    expect((await picked('pick-number-7524-king-fahd-en')).parts?.postcode).toBe('13521-4273');
  });

  it('keeps the name of a building or a shop picked, never Google’s plus code in its place', async () => {
    const building = google('ac-sheikh-zayed-city-en');
    const found = await googleMaps({ key: 'G', region: 'EG', fetch: building.fetch }).search!({ text: 'Sheikh Zayed City', locale: 'en', countries: ['EG'], parts: true });
    expect(await found[1].locate!()).toMatchObject({ address: 'Sheikh Zayed City, the seventh district, the third neighborhood Build 26, First Al Sheikh Zayed, Giza Governorate 3241507, Egypt' });
    const mall = google('ac-citymark-en');
    const [citymark] = await googleMaps({ key: 'G', region: 'EG', fetch: mall.fetch }).search!({ text: 'Citymark Sheikh Zayed', locale: 'en', countries: ['EG'] });
    expect((await citymark.locate!()).address).toBe('Citymark, Al Mostakbal, First Al Sheikh Zayed, Giza Governorate 3244030, Egypt');
    // An address as Google writes it, a plus code before it or not.
    const [city] = found;
    expect((await city.locate!()).address).toBe('El Sheikh Zayed City, Giza Governorate, Egypt');
  });

  it('lists the addresses first for an address field, the shops after them', async () => {
    const { fetch } = google('ac-road-9-maadi-en');
    const found = await googleMaps({ key: 'G', region: 'EG', fetch }).search!({ text: 'Road 9 Maadi', locale: 'en', countries: ['EG'], addresses: true });
    expect(found.map((place) => place.label)).toEqual(['Road 9', 'Maadi used books', 'Maadi Educational Administration', 'Maadi Skin Medica', 'Maadi Engineering Car Co.']);
    // A map's own search, as Google ranks them.
    const map = await googleMaps({ key: 'G', region: 'EG', fetch: google('ac-road-9-maadi-en').fetch }).search!({ text: 'Road 9 Maadi', locale: 'en', countries: ['EG'] });
    expect(map[0].label).toBe('Maadi used books');
  });

  it('asks Google only for countries it knows, at most fifteen: one it refuses, or one too many, fails the whole search', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { fetch, asked } = google('ac-king-fahd-road-eg-sa', true);
    await googleMaps({ key: 'G', fetch }).search!({ text: 'King Fahd Road', locale: 'en', countries: ['EG', 'sa', 'XX', 'EGY', 'UK'] });
    expect(JSON.parse(String(asked[0].init?.body)).includedRegionCodes).toEqual(['eg', 'sa', 'gb']);
    const many = 'EG SA AE JO KW QA BH OM LB SY IQ YE LY TN DZ MA'.split(' ');
    await googleMaps({ key: 'G', fetch }).search!({ text: 'King Fahd Road', locale: 'en', countries: many });
    expect(JSON.parse(String(asked[1].init?.body)).includedRegionCodes).toBeUndefined();
    expect(warn.mock.calls.map(([words]) => String(words)).join('\n')).toMatch(/15 countries at most/);
    warn.mockRestore();
  });

  it('ends a session when a suggestion is picked, though nothing is looked up: the next address typed is a session of its own', async () => {
    const { fetch, asked } = google('ac-road-9-maadi-en', true);
    const maps = googleMaps({ key: 'G', fetch });
    const [first] = await maps.search!({ text: 'Road 9', locale: 'en' });
    first.picked?.();
    await maps.search!({ text: 'Road 1', locale: 'en' });
    const tokens = asked.map(({ init }) => JSON.parse(String(init?.body)).sessionToken);
    expect(tokens[0]).not.toBe(tokens[1]);
  });
});
