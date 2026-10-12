import type { Locale } from '@fieldia/core';
import { pathOf } from './answers';
import { addressLine } from './address-line';
import { warnOnce } from './map-core';
import type { PlaceFound, SearchRequest } from './providers';

/**
 * How each provider's addresses read, loaded with the first search that
 * needs it (an address field's; any of Azure's or Google's), never with a
 * page: an address in its parts, as Fieldia's address field
 * (`json.address`) keeps one (the street with its number, the city, the
 * region, a state or a governorate, the postcode, and the country as its ISO
 * code, "EG"); Azure's and Google's places on two lines, in the page's
 * language; and where a suggestion picked is, for those whose suggestions
 * carry no place. Each provider names the parts its own way: what each
 * answered in Egypt, Saudi Arabia, the UAE and Jordan on 12 Oct 2026 is
 * read here.
 */
export interface AddressParts {
  street?: string;
  city?: string;
  region?: string;
  postcode?: string;
  country?: string;
}

/** Words without the direction marks Azure and Google put in Arabic. */
const text = (value: unknown) => (typeof value === 'string' ? value.replace(/[‎‏؜‪-‮⁦-⁩]/g, '').trim() : '');

interface Pieces {
  street?: unknown;
  number?: unknown;
  /** The number before the street, as Egypt and Saudi Arabia write it; after it unless said, as a place's name has it in most countries. */
  numberFirst?: boolean;
  city?: unknown;
  region?: unknown;
  postcode?: unknown;
  country?: unknown;
}

/** The parts there are, the country's code in capitals; nothing when none is. */
function partsOf({ street, number, numberFirst, city, region, postcode, country }: Pieces): AddressParts | undefined {
  const road = text(street);
  const house = road && text(number);
  const found: Record<string, string> = {
    street: house ? (numberFirst ? `${house} ${road}` : `${road} ${house}`) : road,
    city: text(city),
    region: text(region),
    postcode: text(postcode),
    country: text(country).toUpperCase(),
  };
  const parts = Object.fromEntries(Object.entries(found).filter(([, value]) => value));
  return Object.keys(parts).length ? parts : undefined;
}

/** Photon's properties: a street, or a city, may be the place itself. */
export const photonParts = (p: unknown) => {
  const kind = pathOf(p, 'type');
  const own = (as: string) => (kind === as ? pathOf(p, 'name') : undefined);
  return partsOf({ street: pathOf(p, 'street') ?? own('street'), number: pathOf(p, 'housenumber'), city: pathOf(p, 'city') ?? own('city'), region: pathOf(p, 'state'), postcode: pathOf(p, 'postcode'), country: pathOf(p, 'countrycode') });
};

/** Nominatim's `address` (with `addressdetails=1`): a town or a village where there is no city. */
export const nominatimParts = (a: unknown) =>
  partsOf({ street: pathOf(a, 'road'), number: pathOf(a, 'house_number'), city: pathOf(a, 'city') ?? pathOf(a, 'town') ?? pathOf(a, 'village'), region: pathOf(a, 'state'), postcode: pathOf(a, 'postcode'), country: pathOf(a, 'country_code') });

/** Mapbox's `context`: its address's own line (number and street, in its country's order), or the street alone. */
export const mapboxParts = (p: unknown) => {
  const at = (...path: string[]) => pathOf(p, 'context', ...path);
  return partsOf({ street: at('address', 'name') ?? at('street', 'name'), city: at('place', 'name') ?? at('locality', 'name'), region: at('region', 'name'), postcode: at('postcode', 'name'), country: at('country', 'country_code') });
};

/** Only places in the countries asked for, when some are: for a provider that cannot be asked to keep to them. */
export const inCountries = <T extends { parts?: AddressParts }>(places: T[], countries?: string[]) =>
  countries?.length ? places.filter((place) => countries.includes(place.parts?.country ?? '')) : places;

const regionNames = (locale: string) => (typeof Intl.DisplayNames === 'function' ? new Intl.DisplayNames([locale], { type: 'region', fallback: 'none' }) : null);

/**
 * The countries a provider can be asked to keep to: ISO codes, each once,
 * "UK" read as "GB" (as every provider's parts name it). A code no one
 * knows ("XX", "EGY") is left out and said once: Azure and Google refuse a
 * whole search for one.
 */
export function knownCountries(countries: string[] | undefined): string[] {
  const names = regionNames('en');
  const codes: string[] = [];
  for (const given of countries ?? []) {
    const code = String(given).trim().toUpperCase().replace(/^UK$/, 'GB');
    let known = /^[A-Z]{2}$/.test(code);
    try {
      known &&= !names || !!names.of(code);
    } catch {
      known = false;
    }
    if (!known) warnOnce(`"${given}" is not a country's ISO code ("EG", "SA"): the address search leaves it out.`);
    else if (!codes.includes(code)) codes.push(code);
  }
  return codes;
}

/** The countries Google is asked to keep to (`includedRegionCodes`): 15 at most, as it refuses a whole search for more; with more, none, said once. */
export function googleRegions(countries: string[] | undefined): string[] {
  const codes = knownCountries(countries);
  if (codes.length <= 15) return codes.map((code) => code.toLowerCase());
  warnOnce(`Google keeps its suggestions to 15 countries at most: with ${codes.length}, none are asked for, and its suggestions come from anywhere.`);
  return [];
}

/** A country named in the page's language ("مصر", "Egypt"), or as the provider wrote it where the browser names none. */
function countryName(code: string, locale: Locale, own: unknown) {
  try {
    return (/^[A-Z]{2}$/.test(code) && regionNames(locale)?.of(code)) || text(own);
  } catch {
    return text(own);
  }
}

// ---- Azure Maps --------------------------------------------------------------------

/**
 * Where Azure keeps a city. Its `locality` is the city in most countries, a
 * district or a neighbourhood in these: there the city is one of its admin
 * districts (coarsest first), the second in Egypt and Saudi Arabia (the
 * first a governorate or a region), the first in the UAE (an emirate) and
 * Jordan (the second a liwa).
 */
const AZURE_CITY: Record<string, number> = { EG: 1, SA: 1, AE: 0, JO: 0 };

const isoOf = (a: unknown) => (text(pathOf(a, 'countryRegion', 'ISO')) || text(pathOf(a, 'countryRegion', 'iso'))).toUpperCase();

/** An address of Azure's where it is: its locality, its city and region (admin districts by name, or by short name in its geocoding's), its country. */
function azureWhere(a: unknown) {
  const listed = pathOf(a, 'adminDistricts');
  const districts = (Array.isArray(listed) ? listed : []).map((d) => text(pathOf(d, 'name')) || text(pathOf(d, 'shortName'))).filter(Boolean);
  const locality = text(pathOf(a, 'locality'));
  const country = isoOf(a);
  const at = AZURE_CITY[country];
  return { locality, country, region: districts[0] ?? '', city: at === undefined ? locality : (districts[at] ?? districts[0] ?? locality) };
}

/**
 * An address of Azure's on one line from its own fields, in order (`first`,
 * then its neighbourhood and district, city, region, postcode and country),
 * the country named in the page's language: never its formatted address's
 * emirate codes ("DU"), spellings ("Mişr") and dashes ("King Fahd Road - Al
 * Olaya").
 */
function azureLine(a: unknown, locale: Locale, first: string, before: unknown[] = []) {
  const { locality, city, region, country } = azureWhere(a);
  return addressLine([first, pathOf(a, 'neighborhood'), locality, city, region, pathOf(a, 'postalCode'), countryName(country, locale, pathOf(a, 'countryRegion', 'name'))], locale, before);
}

/** Digits as numbers, Arabic's too ("٢٦" is "26"). */
const asDigits = (words: string) => words.replace(/[٠-٩۰-۹]/g, (d) => String(d.charCodeAt(0) % 16));

/**
 * Azure's street line, without a house number it made up: a street named
 * with a number ("26 July Street") comes with that number as a house's too
 * ("26 26 July Street"), unless the number was typed twice.
 */
function azureStreet(a: unknown, typed: string) {
  const line = text(pathOf(a, 'addressLine'));
  const number = text(pathOf(a, 'streetNumber'));
  const street = text(pathOf(a, 'streetName'));
  const typedTimes = asDigits(typed).split(/\D+/).filter((n) => n && n === number).length;
  return number && line === `${number} ${street}` && street.startsWith(`${number} `) && typedTimes < 2 ? street : line;
}

/** A place of Azure's, with what locating it takes: the whole address as Azure wrote it, its country, its address. */
export interface AzurePlace extends PlaceFound {
  whole: string;
  country: string;
  address: unknown;
}

/** Azure's places on two lines: the street (or the place's name), then where it is; their parts when asked. */
export function azurePlaces(found: unknown, locale: Locale, typed = '', withParts?: boolean): AzurePlace[] {
  const features = pathOf(found, 'features');
  if (!Array.isArray(features)) return [];
  return features.flatMap((feature) => {
    const a = pathOf(feature, 'properties', 'address');
    const line = text(pathOf(a, 'addressLine'));
    const street = azureStreet(a, typed);
    let whole = text(pathOf(a, 'formattedAddress'));
    const label = street || text(pathOf(feature, 'properties', 'name')) || whole.split(',')[0].trim();
    if (!label) return [];
    // A number made up is not asked for either.
    if (street !== line && whole.startsWith(line)) whole = street + whole.slice(line.length);
    const where = azureWhere(a);
    // Where it is, each piece said once, the name above it among them: "Sheikh Zayed City" is not said again under itself.
    const detail = azureLine(a, locale, '', [label]) || addressLine(whole.split(/,| - /), locale, [label]);
    const [lng, lat] = (pathOf(feature, 'geometry', 'coordinates') as number[] | undefined) ?? [];
    const parts = withParts ? partsOf({ street, city: where.city, region: where.region, postcode: pathOf(a, 'postalCode'), country: where.country }) : undefined;
    return [{ label, ...(detail ? { detail } : {}), ...(typeof lat === 'number' && typeof lng === 'number' ? { lat, lng } : {}), ...(parts ? { parts } : {}), whole, country: where.country, address: a }];
  });
}

/** A point named by Azure: its first address, in order. */
export function azureNamed(found: unknown, locale: Locale) {
  const features = pathOf(found, 'features');
  const a = Array.isArray(features) ? pathOf(features[0], 'properties', 'address') : undefined;
  return azureLine(a, locale, text(pathOf(a, 'addressLine'))) || addressLine([pathOf(a, 'formattedAddress')], locale);
}

type Ask = (params: Record<string, string | number | undefined>) => Promise<unknown>;

/** The whole world, for an autocomplete with no place to look near: Azure answers none without a box or a point. */
const WORLD = '-180,-90,180,90';
/** The most countries asked for one at a time; with more, Azure is asked once and its answer kept to them. */
const ONE_AT_A_TIME = 10;

/**
 * Azure's suggestions: nearest the place the page gives first, or the whole
 * world's by prominence when it gives none; kept to the countries the page
 * names by Azure itself (`countryRegion`), one request for each (a tenth of
 * a Search transaction each; a list of them answers nothing), taken in
 * turn, five in all.
 */
export async function azureSearch(autocomplete: Ask, { text: typed, near, locale, countries, parts }: SearchRequest): Promise<AzurePlace[]> {
  const codes = knownCountries(countries);
  if (codes.length > ONE_AT_A_TIME) warnOnce(`Azure Maps is asked for ${ONE_AT_A_TIME} countries at most, one at a time: with ${codes.length}, its suggestions are kept to them after it answers, and may be few.`);
  const where = near ? { coordinates: `${near.lng},${near.lat}` } : { bbox: WORLD };
  const each = codes.length && codes.length <= ONE_AT_A_TIME ? codes : [undefined];
  const answers = await Promise.allSettled(each.map((code) => autocomplete({ ...where, countryRegion: code })));
  // One country's refusal leaves the others' suggestions; every one's is the search's.
  const refused = answers.find((answer): answer is PromiseRejectedResult => answer.status === 'rejected');
  if (refused && answers.every((answer) => answer.status === 'rejected')) throw refused.reason;
  const lists = answers.map((answer) => (answer.status === 'fulfilled' ? azurePlaces(answer.value, locale, typed, parts) : []));
  const taken: AzurePlace[] = [];
  for (let i = 0; lists.some((list) => i < list.length); i++) taken.push(...lists.flatMap((list) => list.slice(i, i + 1)));
  return taken.filter((place) => !codes.length || codes.includes(place.country)).slice(0, 5);
}

/** Whether a geocoding hit is where a suggestion is: in its country, and in its district (or its town) by name. */
function isThere(hit: unknown, address: unknown) {
  const a = pathOf(hit, 'properties', 'address');
  if (isoOf(address) && isoOf(a) && isoOf(address) !== isoOf(a)) return false;
  const district = text(pathOf(address, 'locality')).toLowerCase();
  return !district || [pathOf(a, 'locality'), pathOf(a, 'neighborhood'), ...text(pathOf(a, 'formattedAddress')).split(/,| - /)].some((name) => text(name).toLowerCase() === district);
}

/**
 * Where a suggestion of Azure's is (its suggestions carry no place), as its
 * geocoding finds it: the first of its hits in the suggestion's own
 * district that Azure is sure of. Otherwise only near it (`precise:
 * false`): the street there, of a house not found; or the district itself.
 * Its first hit can lie in another district kilometres away ("King Fahd
 * Road - Al Olaya" found at Al Olaya Street, in Al Arid), or be a street for
 * a house, unsure ("Low", "UpHierarchy").
 */
export async function azureLocate(geocode: Ask, place: AzurePlace, locale: Locale) {
  const hits = (answer: unknown) => {
    const features = pathOf(answer, 'features');
    return (Array.isArray(features) ? features : []).filter((hit) => Array.isArray(pathOf(hit, 'geometry', 'coordinates')));
  };
  const address = addressLine([place.label, place.detail], locale);
  const found = hits(await geocode({ top: 5, query: place.whole || address }));
  const there = found.filter((hit) => isThere(hit, place.address));
  const sure = there.find((hit) => !(pathOf(hit, 'properties', 'matchCodes') as string[] | undefined)?.includes('UpHierarchy') && pathOf(hit, 'properties', 'confidence') !== 'Low');
  let hit = sure ?? there[0];
  if (!hit) {
    const { locality, city } = azureWhere(place.address);
    if (locality) [hit] = hits(await geocode({ top: 1, query: addressLine([locality, city, pathOf(place.address, 'countryRegion', 'name')]) }));
    hit ??= found[0];
  }
  if (!hit) throw new Error('Azure Maps found no place');
  const [lng, lat] = pathOf(hit, 'geometry', 'coordinates') as number[];
  return { lat, lng, address, ...(sure ? {} : { precise: false as const }) };
}

// ---- Google ------------------------------------------------------------------------

/** A plus code ("2XFJ+VJ6"): Google's name for a spot with no address of its own, never the place a person picked. */
const PLUS_CODE = /^[23456789CFGHJMPQRVWX]{4,8}\+[23456789CFGHJMPQRVWX]{0,3}(\s|$)/i;
/** What Google may put before a house's number (": 15 شارع التحرير"). */
const STRAY = /^[\s:;,،.\-–]+/u;

/**
 * Google's `addressComponents`, each by its type: the country by its short
 * code. Its number where Google's own line (`formatted`) puts it: before the
 * street in Egypt and Saudi Arabia ("7524 King Fahd Rd"), after it in Jordan
 * and Germany ("Rainbow St. 15"). Its city its locality; Egypt's streets have
 * none, and their district stands for it ("Qasr El Nil", "Maadi").
 */
export const googleParts = (components: unknown, formatted?: unknown) => {
  const list = Array.isArray(components) ? components : [];
  const of = (type: string, short?: boolean) => text(pathOf(list.find((c) => (pathOf(c, 'types') as string[] | undefined)?.includes(type)), short ? 'shortText' : 'longText'));
  const number = of('street_number').replace(STRAY, '');
  const line = text(formatted);
  const numberAt = number ? line.search(new RegExp(`(^|\\P{N})${number.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?!\\p{N})`, 'u')) : -1;
  const streetAt = [of('route'), of('route', true)].map((name) => (name ? line.indexOf(name) : -1)).filter((at) => at >= 0);
  const postcode = of('postal_code');
  // A Saudi postcode's additional number, a ZIP code's four: "13521-4273".
  const suffix = of('postal_code_suffix');
  return partsOf({
    street: of('route'),
    number,
    numberFirst: numberAt >= 0 && (!streetAt.length || numberAt < Math.min(...streetAt)),
    city: of('locality') || of('postal_town') || of('administrative_area_level_2') || of('sublocality_level_1') || of('administrative_area_level_3'),
    region: of('administrative_area_level_1'),
    postcode: postcode && suffix ? `${postcode}-${suffix}` : postcode,
    country: of('country', true),
  });
};

/**
 * Google's suggestions: each one's name, and where it is; for an address
 * field, the addresses first (their types say "geocode"), the shops and
 * buildings after them. Each is located when picked, through `details`
 * (Place Details), which ends its session (`end`), as picking it does.
 */
export function googlePlaces(answer: unknown, { locale, addresses, parts }: SearchRequest, details: (placeId: string) => Promise<unknown>, end: () => void): PlaceFound[] {
  const suggestions = pathOf(answer, 'suggestions');
  if (!Array.isArray(suggestions)) return [];
  const found = suggestions.flatMap((suggestion) => {
    const prediction = pathOf(suggestion, 'placePrediction');
    const placeId = pathOf(prediction, 'placeId');
    const label = (text(pathOf(prediction, 'structuredFormat', 'mainText', 'text')) || text(pathOf(prediction, 'text', 'text'))).replace(STRAY, '');
    if (typeof placeId !== 'string' || !label) return [];
    const detail = addressLine([pathOf(prediction, 'structuredFormat', 'secondaryText', 'text')], locale);
    const types = pathOf(prediction, 'types');
    // A building, a shop, a mall: a place with a name of its own, which its address may not say.
    const named = Array.isArray(types) && !types.includes('geocode');
    const place: PlaceFound = {
      label,
      ...(detail ? { detail } : {}),
      picked: end,
      async locate() {
        try {
          const at = await details(placeId);
          const lat = pathOf(at, 'location', 'latitude');
          const lng = pathOf(at, 'location', 'longitude');
          if (typeof lat !== 'number' || typeof lng !== 'number') throw new Error('Google gave no place');
          const pieces = text(pathOf(at, 'formattedAddress')).split(/[,،]/);
          pieces[0] = pieces[0].replace(STRAY, '').replace(PLUS_CODE, '');
          const address = addressLine(named ? [label, ...pieces] : pieces, locale);
          const own = parts ? googleParts(pathOf(at, 'addressComponents'), pathOf(at, 'formattedAddress')) : undefined;
          return { lat, lng, ...(address ? { address } : {}), ...(own ? { parts: own } : {}) };
        } finally {
          end();
        }
      },
    };
    return [{ place, named }];
  });
  return (addresses ? [...found.filter((p) => !p.named), ...found.filter((p) => p.named)] : found).map(({ place }) => place);
}
