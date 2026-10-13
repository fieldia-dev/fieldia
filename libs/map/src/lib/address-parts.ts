import type { Locale } from '@fieldia/core';
import { pathOf } from './answers';
import { addressLine, directionOf } from './address-line';
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

/** A name as compared: its letters and digits alone, in lower case, without accents, tatweel or vowel marks ("Ḩā’il" is "hail"). */
const bare = (name: unknown) =>
  text(name)
    .normalize('NFD')
    .replace(/[\p{M}\u0640]/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim();

/** Arabic's letters as Latin spellings write them; its long vowels and "ع" as a vowel, which a spelling leaves out but at a word's start. */
const SOUNDS: Record<string, string> = {
  ا: 'a', ى: 'a', ع: 'a', ء: 'a', ب: 'b', ت: 't', ث: 't', ج: 'j', ح: 'h', خ: 'kh', د: 'd', ذ: 'd', ر: 'r', ز: 'z', س: 's', ش: 's', ص: 's', ض: 'd', ط: 't', ظ: 'z',
  غ: 'gh', ف: 'f', ق: 'q', ك: 'k', ل: 'l', م: 'm', ن: 'n', ه: 'h', ة: 'h', و: 'w', ي: 'y',
};
const PAIRS: Record<string, string> = { kh: 'k', gh: 'k', sh: 's', th: 't', dh: 'd', ph: 'f' };
const ARTICLES = new Set(['al', 'el', 'ad', 'ar', 'as', 'ash', 'at', 'az', 'an', 'ed', 'er', 'es', 'et', 'ez']);

/**
 * A name's consonants, as its spellings share them: "Giza", "Al Jizah",
 * "Gizeh" and "الجيزة" are all "kz"; "Ḩā’il", "Ha'il" and "حائل", "hl";
 * "Amman" and "عمان", "-mn". Its article is left out, and an "h" ending a
 * word, and its vowels but a word's first (as one, "-"); the letters
 * spellings trade (g, j, q, k) are one.
 */
function skeleton(name: string) {
  return bare(name)
    .split(/[\s-]+/)
    .filter((word) => word && !ARTICLES.has(word))
    .map((word) =>
      word
        .replace(/^ال/, '')
        .replace(/[\u0600-\u06FF]/g, (letter) => SOUNDS[letter] ?? '')
        .replace(/kh|gh|sh|th|dh|ph/g, (pair) => PAIRS[pair])
        .replace(/h$/, '')
        .replace(/[gjqc]/g, 'k')
        .replace(/^[aeiou]+/, '-')
        .replace(/(?!^)[aeiouwy\d]/g, '')
    )
    .join('')
    .replace(/(.)\1+/g, '$1');
}

/**
 * Whether two names are one place's, however spelt: the same words, or the
 * same consonants ("Giza", "Al Jizah"; "Al Khubar", "Al Khobar"), with their
 * "h"s or without them, as a spelling may leave one out ("Cairo",
 * "القاهرة").
 */
export function sameName(a: unknown, b: unknown) {
  const [one, other] = [bare(a), bare(b)];
  if (!one || !other) return false;
  if (one === other) return true;
  const [shape, theirs] = [skeleton(one), skeleton(other)];
  const soft = (consonants: string) => consonants.replace(/h/g, '');
  return (shape.length > 1 && shape === theirs) || (soft(shape).length > 1 && soft(shape) === soft(theirs));
}

const isoOf = (a: unknown) => (text(pathOf(a, 'countryRegion', 'ISO')) || text(pathOf(a, 'countryRegion', 'iso'))).toUpperCase();

/** An address's admin districts, coarsest first, each by every name Azure gives it: its name, its short name or code ("Riyadh", "RIY"). */
function districtsOf(a: unknown): string[][] {
  const listed = pathOf(a, 'adminDistricts');
  return (Array.isArray(listed) ? listed : []).map((d) => [text(pathOf(d, 'name')), text(pathOf(d, 'shortName'))].filter(Boolean));
}

/** A district's name without the word for its kind ("Ajman Emirate" is "Ajman", "منطقة الرياض" "الرياض"). */
const KIND = /^(?:إمارة|امارة|منطقة|محافظة|لواء|قسم|مركز)\s+|\s+(?:emirate|governorate|province|region|district|sub-district|qesm|markaz)$/iu;
const withoutKind = (name: string) => name.replace(KIND, '');

/** The emirates that are a city and its quarters (Jabal Ali, Dubai Marina; Al Rumailah): their localities are quarters, their towns themselves. */
const CITY_EMIRATES = ['Dubai', 'Ajman', 'Umm al-Quwain'];

/**
 * An address of Azure's where it is: its place (a quarter's name, the first
 * of a locality such as "Zamâlek, Cairo"), its city, region and country.
 * Its `locality` is the city in most countries, but a district or a
 * neighbourhood in these, where the city is an admin district (coarsest
 * first): in Egypt and Saudi Arabia the second, the first a governorate or a
 * province, and where there is no second, the locality itself ("Al Khubar"
 * in Eastern, "Sheikh Zayed City"); in Jordan the first (the second is a
 * liwa); in the UAE, the emirate where it is a city and its quarters
 * (Dubai, Ajman), the locality in the others, whose towns are many ("Kalba"
 * in Sharjah) and whose admin district is not a city ("Abu Dhabi Emirate").
 */
function azureWhere(a: unknown) {
  const districts = districtsOf(a).map(([name = '']) => name);
  const locality = text(pathOf(a, 'locality'));
  const pieces = locality.split(',').map((piece) => piece.trim()).filter(Boolean);
  const town = pieces[pieces.length - 1] ?? '';
  const country = isoOf(a);
  const [region = '', second = ''] = districts;
  const emirate = withoutKind(region);
  const oneCity = districtsOf(a)[0]?.includes('DU') || CITY_EMIRATES.some((name) => sameName(name, emirate));
  const city = { EG: second || town || region, SA: second || town || region, JO: region || town, AE: oneCity ? emirate : town || emirate }[country] ?? town;
  return { place: pieces[0] ?? '', locality: pieces, country, region, city };
}

/**
 * Names that say where a place is, each place once: of two spellings of one
 * ("Giza", "Al Jizah"; "Amman", "عمان"), the one in the page's letters, or
 * the first; none that says the name above it again (`said`).
 */
function oncePerPlace(names: unknown[], locale: Locale, said: unknown[]) {
  const ours = locale === 'ar' ? 'rtl' : 'ltr';
  const kept: string[] = [];
  for (const name of names.map(text).filter(Boolean)) {
    if (said.some((earlier) => sameName(earlier, name))) continue;
    const at = kept.findIndex((earlier) => sameName(earlier, name));
    if (at < 0) kept.push(name);
    else if (directionOf(name) === ours && directionOf(kept[at]) !== ours) kept[at] = name;
  }
  return kept;
}

/**
 * An address of Azure's on one line from its own fields, in order (`first`,
 * then its neighbourhood and district, city, region, postcode and country),
 * each place once, the country named in the page's language: never its
 * formatted address's emirate codes ("DU"), spellings ("Mişr") and dashes
 * ("King Fahd Road - Al Olaya").
 */
function azureLine(a: unknown, locale: Locale, first: string, before: unknown[] = []) {
  const { locality, city, region, country } = azureWhere(a);
  const where = oncePerPlace([pathOf(a, 'neighborhood'), ...locality, city, region], locale, [first, ...before]);
  return addressLine([first, ...where, pathOf(a, 'postalCode'), countryName(country, locale, pathOf(a, 'countryRegion', 'name'))], locale, before);
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

/** A place of Azure's, with what locating it takes: its country, its address as Azure gave it. */
export interface AzurePlace extends PlaceFound {
  country: string;
  address: unknown;
}

/** Azure's places on two lines: the street, or the place's own name (a quarter's, a town's), then where it is; their parts when asked. */
export function azurePlaces(found: unknown, locale: Locale, typed = '', withParts?: boolean): AzurePlace[] {
  const features = pathOf(found, 'features');
  if (!Array.isArray(features)) return [];
  return features.flatMap((feature) => {
    const properties = pathOf(feature, 'properties');
    const a = pathOf(properties, 'address');
    const street = azureStreet(a, typed);
    const where = azureWhere(a);
    // A quarter's or a town's own name: its neighbourhood, or its locality's first ("Zamâlek, Cairo", whose formatted address starts with Cairo).
    const own = pathOf(properties, 'typeGroup') === 'Place' ? text(pathOf(a, 'neighborhood')) || where.place : '';
    const label = street || text(pathOf(properties, 'name')) || own || text(pathOf(a, 'formattedAddress')).split(',')[0].trim();
    if (!label) return [];
    const detail = azureLine(a, locale, '', [label]);
    const [lng, lat] = (pathOf(feature, 'geometry', 'coordinates') as number[] | undefined) ?? [];
    const parts = withParts ? partsOf({ street, city: where.city, region: where.region, postcode: pathOf(a, 'postalCode'), country: where.country }) : undefined;
    return [{ label, ...(detail ? { detail } : {}), ...(typeof lat === 'number' && typeof lng === 'number' ? { lat, lng } : {}), ...(parts ? { parts } : {}), country: where.country, address: a }];
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

/** The same two lines, said once: the first of them kept. */
const onceEach = <T extends PlaceFound>(places: T[]) => places.filter((place, i) => places.findIndex((other) => other.label === place.label && other.detail === place.detail) === i);

/**
 * Azure's suggestions: nearest the place the page gives first, or the whole
 * world's by prominence when it gives none; kept to the countries the page
 * names by Azure itself (`countryRegion`), one request for each (a tenth of
 * a Search transaction each; a list of them answers nothing), taken in
 * turn, five in all. A row that reads as one before it (a road with no
 * name, in the district that is listed itself) is left out.
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
  return onceEach(taken.filter((place) => !codes.length || codes.includes(place.country))).slice(0, 5);
}

/** Whether names given an admin district are one's: the same name, its kind said or not ("Ash Shāriqah", "Sharjah Emirate"; "منطقة الرياض", "الرياض"); a code ("RIY") only with a code. */
function sameDistrict(ours: string[], theirs: string[]) {
  const isCode = (name: string) => /^[A-Z]{2,3}$/.test(name);
  const [ourCodes, theirCodes] = [ours.filter(isCode), theirs.filter(isCode)];
  if (ourCodes.length && theirCodes.length) return ourCodes.some((code) => theirCodes.includes(code));
  const [ourNames, theirNames] = [ours.filter((name) => !isCode(name)).map(withoutKind), theirs.filter((name) => !isCode(name)).map(withoutKind)];
  return !ourNames.length || !theirNames.length || ourNames.some((one) => theirNames.some((other) => sameName(one, other)));
}

/**
 * Whether a geocoding hit is where a suggestion is: in its country, in its
 * admin districts (a district named alike in another city is not: "Al
 * Nahdah" is in Riyadh, Jeddah and Dammam), and in its own district or town
 * by name.
 */
function isThere(hit: unknown, address: unknown) {
  const a = pathOf(hit, 'properties', 'address');
  if (isoOf(address) && isoOf(a) && isoOf(address) !== isoOf(a)) return false;
  const theirs = districtsOf(a);
  if (districtsOf(address).some((names, i) => theirs[i] && !sameDistrict(names, theirs[i]))) return false;
  const { place } = azureWhere(address);
  const names = [...text(pathOf(a, 'locality')).split(','), pathOf(a, 'neighborhood'), ...theirs.flat(), ...text(pathOf(a, 'formattedAddress')).split(/,| - /).map((piece) => piece.replace(/\d+/g, ''))];
  return !place || names.some((name) => sameName(name, place));
}

/**
 * Where a suggestion of Azure's is (its suggestions carry no place), as its
 * geocoding finds the address as the person reads it, its town and region
 * in it: the first of its hits there that Azure is sure of. Otherwise only
 * near it (`precise: false`): the street there, of a house not found; or,
 * for a street found elsewhere, its district. Its first hit can be a
 * district named alike in another city ("Al Nahdah", Jeddah's, for
 * Riyadh's), a street of the name in another district ("King Fahd Road" at
 * Al Olaya Street, in Al Arid), or a street for a house, unsure ("Low",
 * "UpHierarchy"). Never a place anywhere else: none is found then.
 */
export async function azureLocate(geocode: Ask, place: AzurePlace, locale: Locale) {
  const hits = async (query: string) => {
    const features = pathOf(await geocode({ top: 5, query }), 'features');
    return (Array.isArray(features) ? features : []).filter((hit) => Array.isArray(pathOf(hit, 'geometry', 'coordinates')) && isThere(hit, place.address));
  };
  const address = addressLine([place.label, place.detail], locale);
  // Its pieces as Azure reads them, joined by the comma it reads.
  const there = await hits(addressLine([place.label, place.detail]));
  const sure = there.find((hit) => !(pathOf(hit, 'properties', 'matchCodes') as string[] | undefined)?.includes('UpHierarchy') && pathOf(hit, 'properties', 'confidence') !== 'Low');
  let hit = sure ?? there[0];
  // A street found only elsewhere: its district, the line under it.
  if (!hit && text(pathOf(place.address, 'addressLine')) && place.detail) [hit] = await hits(addressLine([place.detail]));
  if (!hit) throw new Error(`Azure Maps found "${address}" nowhere in its own district and town`);
  const [lng, lat] = pathOf(hit, 'geometry', 'coordinates') as number[];
  return { lat, lng, address, ...(sure ? {} : { precise: false as const }) };
}

// ---- Google ------------------------------------------------------------------------

/** A plus code ("2XFJ+VJ6"): Google's name for a spot with no address of its own, never the place a person picked. */
const PLUS_CODE = /^[23456789CFGHJMPQRVWX]{4,8}\+[23456789CFGHJMPQRVWX]{0,3}(\s|$)/i;
/** What Google may put before a house's number (": 15 شارع التحرير"). */
const STRAY = /^[\s:;,،.\-–]+/u;

/** One of Google's `addressComponents`, by its type. */
const componentOf = (components: unknown, type: string) => (Array.isArray(components) ? components : []).find((c) => (pathOf(c, 'types') as string[] | undefined)?.includes(type));

/**
 * Google's `addressComponents`, each by its type: the country by its short
 * code. Its number where Google's own line (`formatted`) puts it: before the
 * street in Egypt and Saudi Arabia ("7524 King Fahd Rd"), after it in Jordan
 * and Germany ("Rainbow St. 15"). Its city its locality; Egypt's streets have
 * none, and their district stands for it ("Qasr El Nil", "Maadi"), by its
 * name alone in Arabic too ("الدقي", not "قسم الدقي", its police district's).
 */
export const googleParts = (components: unknown, formatted?: unknown) => {
  const of = (type: string, short?: boolean) => text(pathOf(componentOf(components, type), short ? 'shortText' : 'longText'));
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
    city: (of('locality') || of('postal_town') || of('administrative_area_level_2') || of('sublocality_level_1') || of('administrative_area_level_3')).replace(/^قسم\s+/u, ''),
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
          // Its country set apart where Google writes nothing but a space before it ("King Fahd Rd, Riyadh Saudi Arabia"), as its parts name it; a dash sets it apart already ("Sheikh Zayed Rd - Dubai - United Arab Emirates").
          const country = text(pathOf(componentOf(pathOf(at, 'addressComponents'), 'country'), 'longText'));
          const pieces = text(pathOf(at, 'formattedAddress'))
            .split(/[,،]/)
            .map((piece) => piece.trim())
            .flatMap((piece) => {
              const before = country && piece !== country && piece.endsWith(` ${country}`) ? piece.slice(0, -country.length).trim() : '';
              return before && !/[-–—]$/u.test(before) ? [before, country] : [piece];
            });
          // Without a plus code before it, nor what joined the code to it ("67GM+6V6 - Sheikh Zayed Rd").
          pieces[0] = pieces[0].replace(STRAY, '').replace(PLUS_CODE, '').replace(STRAY, '');
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
