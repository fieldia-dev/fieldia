/** @jest-environment node */
import { addressLine, directionOf } from './address-line';
import { azureMaps, googleMaps, mapbox, openStreetMap } from './providers';

/**
 * An address on one line: each piece said once, joined as the page's
 * language joins them. The same join makes a suggestion's second line, a
 * point's name and the line an address field or a place writes, so a
 * provider whose pieces repeat ("Cairo, Cairo Governorate") is read once
 * everywhere.
 */

/** A stand-in for the network: each request answered from the table by the start of its URL. */
function network(answers: Record<string, unknown>) {
  return (async (input: RequestInfo | URL) => {
    const key = Object.keys(answers).find((start) => String(input).startsWith(start));
    return key ? new Response(JSON.stringify(answers[key]), { status: 200 }) : new Response('not found', { status: 404 });
  }) as typeof globalThis.fetch;
}

/** The line a picked suggestion writes: its two lines as one. */
const whole = (place: { label: string; detail?: string }, locale: 'en' | 'ar' = 'en') => addressLine([place.label, place.detail], locale);

describe('an address on one line', () => {
  it('says the same words once, whatever their case', () => {
    expect(addressLine(['Cairo', 'Cairo', 'cairo', 'Egypt'])).toBe('Cairo, Egypt');
  });

  it('leaves out a wider place named after one said before it', () => {
    expect(addressLine(['Downtown', 'Cairo', 'Cairo Governorate', 'Egypt'])).toBe('Downtown, Cairo, Egypt');
    expect(addressLine(['وسط البلد', 'القاهرة', 'محافظة القاهرة', 'مصر'], 'ar')).toBe('وسط البلد، القاهرة، مصر');
  });

  it('keeps one that carries a postcode of its own, in any digits', () => {
    expect(addressLine(['Qasr El Nil', 'Cairo', 'Cairo Governorate 4272077', 'Egypt'])).toBe('Qasr El Nil, Cairo, Cairo Governorate 4272077, Egypt');
    expect(addressLine(['القاهرة', 'محافظة القاهرة ٤٢٧٢٠٧٧'], 'ar')).toBe('القاهرة، محافظة القاهرة ٤٢٧٢٠٧٧');
  });

  it('keeps a narrower piece holding a wider one’s name, said first, and words only as whole words', () => {
    expect(addressLine(['Alexandria Street 5', 'Alexandria', 'Egypt'])).toBe('Alexandria Street 5, Alexandria, Egypt');
    expect(addressLine(['Giza', 'Gizawy Street'])).toBe('Giza, Gizawy Street');
  });

  it('reads pieces at the commas a provider put in them, either comma, without direction marks', () => {
    expect(addressLine(['Tahrir Square', 'Cairo, Cairo Governorate, Egypt'])).toBe('Tahrir Square, Cairo, Egypt');
    expect(addressLine(['1 شارع محمد محمود، ميدان التحرير, قسم قصر النيل‏', '', null, 7], 'ar')).toBe('1 شارع محمد محمود، ميدان التحرير، قسم قصر النيل');
  });

  it('reads past the tatweel and the vowel marks Arabic may carry: "الشيـخ زايد" is "الشيخ زايد"', () => {
    expect(addressLine(['الشيـخ زايد', 'الشيخ زايد', 'الجيزة', 'مصر'], 'ar')).toBe('الشيـخ زايد، الجيزة، مصر');
    expect(addressLine(['وادِي الدَّواسِر', 'وادي الدواسر', 'الرياض'], 'ar')).toBe('وادِي الدَّواسِر، الرياض');
  });

  it('joins with the Arabic comma in Arabic and the comma in the other languages', () => {
    const pieces = ['Tahrir Street 12', 'Downtown', 'Cairo'];
    expect(['en', 'fr', 'de', 'ar'].map((locale) => addressLine(pieces, locale as 'en'))).toEqual([
      'Tahrir Street 12, Downtown, Cairo',
      'Tahrir Street 12, Downtown, Cairo',
      'Tahrir Street 12, Downtown, Cairo',
      'Tahrir Street 12، Downtown، Cairo',
    ]);
  });
});

describe('the direction an address reads in', () => {
  it('is the one most of its letters are written in, whatever its first: an Arabic address that starts with a Latin street reads from the right', () => {
    expect(directionOf('El Tahrir، الإسماعيلية، القاهرة، مصر')).toBe('rtl');
    expect(directionOf('1 Mohammed Mahmoud، ميدان التحرير')).toBe('ltr');
    expect(directionOf('15 شارع التحرير')).toBe('rtl');
    // No letters, or as many each way: the page's.
    expect([directionOf(''), directionOf('12 / 4'), directionOf('ab جد')]).toEqual(['', '', '']);
  });
});

describe('each provider’s answer that repeats, said once', () => {
  it('Photon: a city and its governorate, a city that is the place itself, in English and in Arabic', async () => {
    const feature = (properties: Record<string, string>) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [31.24, 30.05] }, properties });
    const answer = {
      type: 'FeatureCollection',
      features: [
        feature({ type: 'house', street: 'Tahrir Street', housenumber: '12', district: 'Downtown', city: 'Cairo', state: 'Cairo Governorate', country: 'Egypt' }),
        feature({ type: 'city', name: 'Cairo', state: 'Cairo Governorate', country: 'Egypt' }),
      ],
    };
    const [house, city] = await openStreetMap({ fetch: network({ 'https://photon.komoot.io/api': answer }) }).search!({ text: 'cairo', locale: 'en' });
    expect([house.detail, whole(house)]).toEqual(['Downtown, Cairo, Egypt', 'Tahrir Street 12, Downtown, Cairo, Egypt']);
    expect([city.detail, whole(city)]).toEqual(['Cairo Governorate, Egypt', 'Cairo, Egypt']);
    const arabic = { type: 'FeatureCollection', features: [feature({ type: 'house', street: 'شارع التحرير', housenumber: '12', district: 'وسط البلد', city: 'القاهرة', state: 'محافظة القاهرة', country: 'مصر' })] };
    const [found] = await openStreetMap({ fetch: network({ 'https://photon.komoot.io/api': arabic }) }).search!({ text: 'التحرير', locale: 'ar' });
    expect(whole(found, 'ar')).toBe('شارع التحرير 12، وسط البلد، القاهرة، مصر');
    // A point named: the same line.
    const named = await openStreetMap({ fetch: network({ 'https://photon.komoot.io/reverse': arabic }) }).reverse!({ lat: 30.05, lng: 31.24, locale: 'ar' });
    expect(named).toBe('شارع التحرير 12، وسط البلد، القاهرة، مصر');
  });

  it('Nominatim: its display name, a governorate named after its city', async () => {
    const answer = [{ lat: '29.99', lon: '31.16', name: 'Pyramids Road', display_name: 'Pyramids Road, Giza, Giza Governorate, 12511, Egypt' }];
    const fetch = network({ 'https://nominatim.openstreetmap.org/search': answer, 'https://nominatim.openstreetmap.org/reverse': answer[0] });
    const [found] = await openStreetMap({ fetch, search: 'nominatim' }).search!({ text: 'pyramids', locale: 'en' });
    expect([found.detail, whole(found)]).toEqual(['Giza, 12511, Egypt', 'Pyramids Road, Giza, 12511, Egypt']);
    expect(await openStreetMap({ fetch, search: 'nominatim' }).reverse!({ lat: 29.99, lng: 31.16, locale: 'ar' })).toBe('Pyramids Road، Giza، 12511، Egypt');
  });

  it('Azure: its town said twice in its formatted address', async () => {
    const answer = {
      type: 'FeatureCollection',
      features: [{ type: 'Feature', geometry: null, properties: { address: { addressLine: 'Tahrir Street', locality: 'Cairo', adminDistricts: [{ name: 'Cairo' }], countryRegion: { ISO: 'EG', name: 'Egypt' }, formattedAddress: 'Tahrir Street, Cairo, Cairo, Egypt' } } }],
    };
    const [found] = await azureMaps({ key: 'K', fetch: network({ 'https://atlas.microsoft.com/geocode:autocomplete': answer }) }).search!({ text: 'tahrir', locale: 'en' });
    expect([found.detail, whole(found)]).toEqual(['Cairo, Egypt', 'Tahrir Street, Cairo, Egypt']);
  });

  it('Google: a governorate named after its city in a suggestion, a point named, and a picked place’s address keeping its postcode', async () => {
    const suggestions = { suggestions: [{ placePrediction: { placeId: 'P1', structuredFormat: { mainText: { text: 'Pyramids Rd' }, secondaryText: { text: 'Giza, Giza Governorate, Egypt' } } } }] };
    const details = { location: { latitude: 29.99, longitude: 31.16 }, formattedAddress: 'Pyramids Rd, Giza, Giza Governorate 3512201, Egypt' };
    const fetch = network({
      'https://places.googleapis.com/v1/places:autocomplete': suggestions,
      'https://places.googleapis.com/v1/places/P1': details,
      'https://maps.googleapis.com/maps/api/geocode/json': { status: 'OK', results: [{ formatted_address: 'Al Haram, Giza, Giza Governorate, Egypt' }] },
    });
    const [found] = await googleMaps({ key: 'G', fetch }).search!({ text: 'pyramids', locale: 'en' });
    expect([found.detail, whole(found)]).toEqual(['Giza, Egypt', 'Pyramids Rd, Giza, Egypt']);
    expect((await found.locate!()).address).toBe('Pyramids Rd, Giza, Giza Governorate 3512201, Egypt');
    expect(await googleMaps({ key: 'G', fetch }).reverse!({ lat: 29.99, lng: 31.16, locale: 'en' })).toBe('Al Haram, Giza, Egypt');
  });

  it('Mapbox: a governorate named after its city in its place line', async () => {
    const answer = {
      type: 'FeatureCollection',
      features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [29.9, 31.2] }, properties: { name: 'Fouad Street', full_address: 'Fouad Street, Alexandria, Alexandria Governorate, Egypt', place_formatted: 'Alexandria, Alexandria Governorate, Egypt' } }],
    };
    const fetch = network({ 'https://api.mapbox.com/search/geocode/v6/forward': answer, 'https://api.mapbox.com/search/geocode/v6/reverse': answer });
    const [found] = await mapbox({ token: 'M', fetch }).search!({ text: 'fouad', locale: 'en' });
    expect([found.detail, whole(found)]).toEqual(['Alexandria, Egypt', 'Fouad Street, Alexandria, Egypt']);
    expect(await mapbox({ token: 'M', fetch }).reverse!({ lat: 31.2, lng: 29.9, locale: 'ar' })).toBe('Fouad Street، Alexandria، Egypt');
  });
});
