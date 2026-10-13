import type { Locale } from '@fieldia/core';
import { pathOf } from './answers';
import { addressLine } from './address-line';
import { knownCity, knownRegion, nameIn, nameKey, sameKnown } from './address-names';
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

const sameWords = (one: unknown, other: unknown) => !!nameKey(one) && nameKey(one) === nameKey(other);

/** An admin district's code ("RIY", "DU"), as Azure gives a province's or an emirate's beside its name. */
const isCode = (name: string) => /^[A-Z]{2,3}$/.test(name);

const isoOf = (a: unknown) => (text(pathOf(a, 'countryRegion', 'ISO')) || text(pathOf(a, 'countryRegion', 'iso'))).toUpperCase();

/** An address's admin districts, coarsest first, each by every name Azure gives it: its suggestions give a name and a code ("Riyadh", "RIY"), its geocoding one of them. */
function districtsOf(a: unknown): string[][] {
  const listed = pathOf(a, 'adminDistricts');
  return (Array.isArray(listed) ? listed : []).map((d) => [text(pathOf(d, 'name')), text(pathOf(d, 'shortName'))].filter(Boolean));
}
const nameOf = (names: string[] = []) => names.find((name) => !isCode(name)) ?? '';

/** What one of Azure's places is, by its type: a street (an address, a road), an area (a town, a district, a governorate), or a place with a name of its own (a station, a park, a mall). */
type Level = 'street' | 'area' | 'named';
const STREETS = ['Address', 'RoadBlock', 'RoadIntersection'];
const AREAS = ['PopulatedPlace', 'Neighborhood', 'AdminDivision1', 'AdminDivision2', 'AdminDivision3', 'CountryRegion', 'Postcode1'];
const levelOf = (type: unknown): Level => (STREETS.includes(String(type)) ? 'street' : AREAS.includes(String(type)) ? 'area' : 'named');
/** A suggestion's level: a road with no name of its own reads as the area it is in ("العليا", Riyadh), and is that. */
const levelOfPlace = (type: unknown, street: string): Level => (levelOf(type) === 'street' && !street ? 'area' : levelOf(type));

/** A region's name without the word for its kind, where it is not one Fieldia knows ("Ajman Emirate" is "Ajman", "إمارة دبي" "دبي"). */
const KIND = /^(?:إمارة|امارة)\s+|\s+emirate$/iu;
const withoutKind = (name: string) => name.replace(KIND, '');

/** The emirates that are a city and its quarters, by Azure's codes: their quarters' city is the emirate's. */
const CITY_EMIRATES = ['DU', 'AJ', 'UQ'];
/**
 * Egypt's governorate of Helwan (2008 to 2011), Cairo's again since: Azure
 * still files Cairo's southern quarters under it ("Qesm El Maadi", Cairo,
 * Helwan), which are Cairo's, as their addresses say. Helwan itself is a town.
 */
const FORMER_GOVERNORATES: Record<string, string[]> = { EG: ['helwan', 'حلوان'] };
/**
 * The cities of the emirate of Abu Dhabi, whose quarters Azure files under
 * the emirate alone ("Al Khalidiyah", "Al Jimi"): a quarter is in the city
 * it is within reach of (km), as its place found says; elsewhere (Al
 * Dhafra's towns) it is its own town.
 */
const ABU_DHABI_CITIES = [
  { lat: 24.4539, lng: 54.3773, km: 45, name: 'Abu Dhabi' },
  { lat: 24.2075, lng: 55.7447, km: 30, name: 'Al Ain' },
];
type LatLngAt = { lat: number; lng: number };
const kmBetween = (a: LatLngAt, b: LatLngAt) => {
  const rad = Math.PI / 180;
  const h = Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(((b.lng - a.lng) * rad) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
};

/** A city's or region's name as Fieldia writes it in the page's language, where it knows the place ("Al Jizah" is "Giza", "Ad Dammām" "Dammam"); as Azure wrote it otherwise. */
function cityName(country: string, name: string, locale: Locale) {
  const known = knownCity(country, name) ?? knownRegion(country, name);
  return known ? nameIn(known, locale) : name;
}

/**
 * An address of Azure's where it is: its place (its locality's first
 * piece, "Zamâlek, Cairo"'s "Zamâlek"), its city, region and country.
 *
 * Its region is its first admin district, known by Azure's code for it or
 * one of its names ("SH", "Ash Shāriqah", "Sharjah Emirate" are Sharjah),
 * and named one way in each language; one Fieldia does not know is named as
 * Azure names it, the word for an emirate aside.
 *
 * Its admin districts say the city, each country's own way: in Egypt the
 * second (a city, "New Cairo", "6th of October"), or the governorate's own
 * city where there is none (Zamalek and Nasr City are Cairo's, Dokki Giza's:
 * the locality there is a district); in Saudi Arabia the second, a
 * governorate named for its city, or the place itself, a town, where there
 * is none ("Jeddah", in Makkah); in Jordan the first, a governorate named
 * for its city; in the UAE the emirate where it is a city and its quarters,
 * its locality (a town, "Kalba") in the others. Elsewhere its locality is
 * the city. A city Fieldia knows is named one way in each language too.
 */
function azureWhere(a: unknown, locale: Locale) {
  const country = isoOf(a);
  const districts = districtsOf(a);
  const known = knownRegion(country, ...(districts[0] ?? []));
  const region = known ? nameIn(known, locale) : withoutKind(nameOf(districts[0]));
  const second = nameOf(districts[1]);
  const pieces = text(pathOf(a, 'locality'))
    .split(',')
    .map((piece) => piece.trim())
    .filter(Boolean);
  const place = pieces[0] ?? '';
  const town = pieces[pieces.length - 1] ?? '';
  const former = (FORMER_GOVERNORATES[country] ?? []).includes(nameKey(second)) && !sameWords(second, place);
  const cities: Record<string, string> = {
    EG: (!former && second) || region,
    SA: second || town || region,
    JO: region || town,
    AE: known?.code && CITY_EMIRATES.includes(known.code) ? region : town || region,
  };
  const city = cityName(country, cities[country] ?? town, locale);
  return { place, pieces, country, region, city, abuDhabi: known?.code === 'AZ' };
}

/** The city of a place found in the emirate of Abu Dhabi, by where it is; elsewhere its city as its address says. */
function cityAt(a: unknown, at: LatLngAt, locale: Locale) {
  const where = azureWhere(a, locale);
  const near = where.abuDhabi ? ABU_DHABI_CITIES.find((city) => kmBetween(city, at) <= city.km) : undefined;
  return near ? cityName('AE', near.name, locale) : where.city;
}

/** The names an address's own fields give its places: its neighbourhood, locality, admin districts (and their codes), postcode and country. */
function namedIn(a: unknown) {
  return [
    pathOf(a, 'neighborhood'),
    ...text(pathOf(a, 'locality')).split(','),
    ...districtsOf(a).flat(),
    pathOf(a, 'postalCode'),
    pathOf(a, 'countryRegion', 'name'),
    isoOf(a),
  ]
    .map(nameKey)
    .filter(Boolean);
}

/**
 * The districts Azure's own line names between a street and its locality,
 * which its fields leave out ("30 Street, Al Fisht, Sharjah", whose
 * neighbourhood is none and locality Sharjah: Al Fisht): the street's two
 * of a number told apart. Only between the street and a place its fields
 * name; none where its line is written another way.
 */
function districtsInLine(a: unknown, street: string): string[] {
  const formatted = text(pathOf(a, 'formattedAddress'));
  if (!street || !formatted.startsWith(street)) return [];
  const named = namedIn(a);
  const found: string[] = [];
  for (const piece of formatted
    .slice(street.length)
    .split(/\s+[-–]\s+|[,،]/)
    .map((one) => one.trim())
    .filter(Boolean)) {
    if (named.includes(nameKey(piece))) return found;
    found.push(piece);
  }
  return [];
}

/**
 * Pieces of a line, each place said once: one that names a city or region
 * Fieldia knows, said in the page's own words elsewhere in the line (`own`,
 * its city and region) or above it (`before`), is left out ("Cairo" on an
 * Arabic page beside "القاهرة"; "Al Jizah" beside "Giza").
 */
function onceKnown(country: string, pieces: unknown[], own: string[], before: unknown[]) {
  const said = before.map(text).filter(Boolean);
  const kept: string[] = [];
  for (const piece of pieces.map(text)) {
    if (!piece) continue;
    const other = (name: string) => nameKey(name) !== nameKey(piece) && sameKnown(country, piece, name);
    if (!own.includes(piece) && own.some(other)) continue;
    if (said.some(other)) continue;
    said.push(piece);
    kept.push(piece);
  }
  return kept;
}

/**
 * An address of Azure's on one line from its own fields, in order (`first`,
 * then its neighbourhood, the districts its line names between, its
 * locality, city, region, postcode and country), each place said once (the
 * same words, or the names of one city or region), the country named in the
 * page's language: never its formatted address's emirate codes ("DU"),
 * spellings ("Mişr") and dashes ("King Fahd Road - Al Olaya").
 */
function azureLine(a: unknown, locale: Locale, first: string, before: unknown[] = [], street = '') {
  const { pieces, city, region, country } = azureWhere(a, locale);
  const line = [first, pathOf(a, 'neighborhood'), ...districtsInLine(a, street), ...pieces, city, region, pathOf(a, 'postalCode'), countryName(country, locale, pathOf(a, 'countryRegion', 'name'))];
  return addressLine(onceKnown(country, line, [city, region], before), locale, before);
}

/** Digits as numbers, Arabic's too ("٢٦" is "26"). */
const asDigits = (words: string) => words.replace(/[٠-٩۰-۹]/g, (d) => String(d.charCodeAt(0) % 16));
const numbersIn = (words: string) => asDigits(words).match(/\d+/g) ?? [];

/** The words for a street, a road, a lane and a number, which a street named by its number alone has beside it ("30 Street", "شارع 6", "Street No. 8", "طريق رقم 9"). */
const STREET_WORDS = new Set(['street', 'st', 'road', 'rd', 'lane', 'ln', 'no', 'number', 'شارع', 'طريق', 'رقم', 'سكة', 'ممر', 'حارة']);
/**
 * A street named by its number alone ("30 Street", "8", "شارع 6"): each
 * district of a town in the UAE, Saudi Arabia and Egypt numbers its own, so
 * one of the number in another district is another street.
 */
const isNumbered = (street: string) =>
  numbersIn(street).length > 0 &&
  asDigits(street)
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .every((word) => /^\d+$/.test(word) || STREET_WORDS.has(word));

/**
 * A street line of Azure's up to the first place its fields name: its
 * street line may carry them after it ("Bldg. 13 Bay Square, Business Bay,
 * Dubai, Uae", in Business Bay).
 */
function ownLine(a: unknown, line: string) {
  const pieces = line.split(/[,،]/).map((piece) => piece.trim());
  const named = namedIn(a);
  const at = pieces.findIndex((piece, i) => i > 0 && named.includes(nameKey(piece)));
  return at > 0 ? pieces.slice(0, at).join(', ') : line;
}

/**
 * Azure's street line, without a house number it made up: a street whose
 * name has a number ("26 July Street", "شارع 26 يوليو", typed "شارع ٢٦
 * يوليو") comes with that number as a house's too, unless it was typed
 * again, for a house. Azure's whole line where it differs from its parts
 * ("15 El Tahrir Street").
 */
function azureStreet(a: unknown, typed: string) {
  const line = ownLine(a, text(pathOf(a, 'addressLine')));
  const number = asDigits(text(pathOf(a, 'streetNumber')));
  const street = ownLine(a, text(pathOf(a, 'streetName')));
  if (!number || !street) return line;
  const inName = numbersIn(street).filter((n) => n === number).length;
  return inName && numbersIn(typed).filter((n) => n === number).length <= inName ? street : line;
}

/** A place of Azure's, with what locating it takes: its address as Azure gave it, its level, its street line, and where the search looked. */
export interface AzurePlace extends PlaceFound {
  country: string;
  azure: { address: unknown; level: Level; street: string; near?: LatLngAt };
}

/** Azure's places on two lines: the street, or the place's own name (a quarter's, a town's), then where it is; their parts when asked. */
export function azurePlaces(found: unknown, locale: Locale, typed = '', withParts?: boolean, near?: LatLngAt): AzurePlace[] {
  const features = pathOf(found, 'features');
  if (!Array.isArray(features)) return [];
  return features.flatMap((feature) => {
    const properties = pathOf(feature, 'properties');
    const a = pathOf(properties, 'address');
    const type = pathOf(properties, 'type');
    const street = levelOf(type) === 'street' ? azureStreet(a, typed) : '';
    const level = levelOfPlace(type, street);
    const where = azureWhere(a, locale);
    // A quarter's or a town's own name: its neighbourhood, or its locality's first ("Zamâlek, Cairo", whose formatted address starts with Cairo); a town Fieldia knows by the name it writes for it ("Ad Dammām" is Dammam).
    const area = level === 'area' ? text(pathOf(a, 'neighborhood')) || where.place : '';
    const own = type === 'PopulatedPlace' && area && sameKnown(where.country, area, where.city) ? where.city : area;
    const label = street || text(pathOf(properties, 'name')) || own || text(pathOf(a, 'formattedAddress')).split(',')[0].trim();
    if (!label) return [];
    const detail = azureLine(a, locale, '', [label], text(pathOf(a, 'addressLine')));
    const [lng, lat] = (pathOf(feature, 'geometry', 'coordinates') as number[] | undefined) ?? [];
    const parts = withParts ? partsOf({ street, city: where.city, region: where.region, postcode: pathOf(a, 'postalCode'), country: where.country }) : undefined;
    return [
      {
        label,
        ...(detail ? { detail } : {}),
        ...(typeof lat === 'number' && typeof lng === 'number' ? { lat, lng } : {}),
        ...(parts ? { parts } : {}),
        country: where.country,
        azure: { address: a, level, street, ...(near ? { near } : {}) },
      },
    ];
  });
}

/** A point named by Azure: its first address, in order. */
export function azureNamed(found: unknown, locale: Locale) {
  const features = pathOf(found, 'features');
  const a = Array.isArray(features) ? pathOf(features[0], 'properties', 'address') : undefined;
  const line = text(pathOf(a, 'addressLine'));
  return azureLine(a, locale, ownLine(a, line), [], line) || addressLine([pathOf(a, 'formattedAddress')], locale);
}

type Ask = (params: Record<string, string | number | undefined>) => Promise<unknown>;

/** The whole world, for an autocomplete with no place to look near: Azure answers none without a box or a point. */
const WORLD = '-180,-90,180,90';
/** The most countries asked for one at a time; with more, Azure is asked once and its answer kept to them. */
const ONE_AT_A_TIME = 10;
/**
 * Every kind of place Azure's autocomplete names (api-version 2026-01-01)
 * but a postcode alone ("56967, Saudi Arabia"), as an address field asks for
 * them: with the whole world to look in, a town's postcodes crowd out its
 * districts. Azure refuses a name it does not know, so these are its own.
 */
const NOT_POSTCODES =
  'Address AdminDivision1 AdminDivision2 AdminDivision3 AdministrativeBuilding Airport AirportTerminal AmusementPark AncientSite Aquarium Archipelago Basin Battlefield Bay Beach Bridge BusinessStructure Camp Canal Casino Castle Cave Cemetery Channel Church Cliff Coast CommunityCenter Continent CountryRegion Crater CulturalRegion Dam Delta Desert DrainageBasin Dune FacilityStructure FerryTerminal FinancialStructure FireStation Forest Fort Garden Geyser Glacier GolfCourse GreaterPopulatedPlace HigherEducationFacility HistoricalSite Hospital HotSpring Ice IndigenousPeoplesReserve IndustrialStructure Island Isthmus Lake LandArea Landform LandmarkBuilding Library Lighthouse Marina Market MedicalStructure MetroStation MilitaryBase Mission Monument Mosque Mountain MountainRange MultiModalStation Museum NauticalStructure Neighborhood Oasis ObservationPoint Ocean OfficeBuilding Other Park ParkingStructure Pass Peninsula Plain Planet Plateau Playground PlayingField Pole PoliticalUnit PopulatedPlace Port Promontory RaceTrack RailwayStation Reef ReligiousStructure Reserve ResidentialStructure River RoadBlock Ruin ScientificResearchBase Sea SeaplaneLandingArea Shrine SkiArea Spring Stadium StatisticalDistrict Temple Theater TouristRailway TouristStructure Trailhead TransportationStructure Tunnel Valley Volcano Walkway Wall Waterfall WaterFeature Wetland Winery Zoo'
    .split(' ')
    .join(',');

/** The word for a district typed before its name ("حي الملقا"), which Azure's names of districts leave out. */
const DISTRICT_WORD = /^\s*حي\s+(?=\S)/u;

/** The same two lines, said once: the first of them kept. */
const onceEach = <T extends PlaceFound>(places: T[]) => places.filter((place, i) => places.findIndex((other) => other.label === place.label && other.detail === place.detail) === i);

/**
 * Azure's suggestions: nearest the place the page gives first, or the whole
 * world's by prominence when it gives none; kept to the countries the page
 * names by Azure itself (`countryRegion`), one request for each (a tenth of
 * a Search transaction each; a list of them answers nothing), taken in
 * turn, five in all. For an address field (`addresses`), no postcodes alone,
 * and the addresses and areas first, the places with names of their own
 * (a station, a park) after them, as Azure's types say. A row that reads as
 * one before it is left out.
 */
export async function azureSearch(autocomplete: Ask, request: SearchRequest): Promise<AzurePlace[]> {
  const { text: typed, near, locale, countries, parts, addresses } = request;
  const codes = knownCountries(countries);
  if (codes.length > ONE_AT_A_TIME) warnOnce(`Azure Maps is asked for ${ONE_AT_A_TIME} countries at most, one at a time: with ${codes.length}, its suggestions are kept to them after it answers, and may be few.`);
  const where = { ...(near ? { coordinates: `${near.lng},${near.lat}` } : { bbox: WORLD }), ...(addresses ? { resultTypes: NOT_POSTCODES } : {}) };
  const each = codes.length && codes.length <= ONE_AT_A_TIME ? codes : [undefined];
  const answers = await Promise.allSettled(each.map((code) => autocomplete({ query: typed, ...where, countryRegion: code })));
  // One country's refusal leaves the others' suggestions; every one's is the search's.
  const refused = answers.find((answer): answer is PromiseRejectedResult => answer.status === 'rejected');
  if (refused && answers.every((answer) => answer.status === 'rejected')) throw refused.reason;
  const lists = answers.map((answer) => (answer.status === 'fulfilled' ? azurePlaces(answer.value, locale, typed, parts, near) : []));
  // "حي الملقا": Azure names a district without the word for one, and finds nothing with it; asked again without it.
  const district = typed.match(DISTRICT_WORD);
  if (district && lists.every((list) => !list.length)) return azureSearch(autocomplete, { ...request, text: typed.slice(district[0].length) });
  const taken: AzurePlace[] = [];
  for (let i = 0; lists.some((list) => i < list.length); i++) taken.push(...lists.flatMap((list) => list.slice(i, i + 1)));
  const kept = onceEach(taken.filter((place) => !codes.length || codes.includes(place.country)));
  const named = (place: AzurePlace) => place.azure.level === 'named';
  return (addresses ? [...kept.filter((place) => !named(place)), ...kept.filter(named)] : kept).slice(0, 5);
}

/** A geocoding hit's address. */
const addressOf = (hit: unknown) => pathOf(hit, 'properties', 'address');

/**
 * Whether a geocoding hit is in the suggestion's own country and admin
 * districts, each as Azure names it at its level: a region Fieldia knows by
 * which it is (its code or any of its names: "SH" and "Ash Shāriqah" are
 * one), another by its codes, or by the same words where neither side has
 * one, or the names of one city ("Al Jizah", "Giza"). "Al Rawdah" in
 * Riyadh's governorate, never in Al Wasiah's.
 */
function fits(hit: unknown, a: unknown) {
  const theirs = addressOf(hit);
  const country = isoOf(a);
  if (country && isoOf(theirs) && country !== isoOf(theirs)) return false;
  const levels = districtsOf(theirs);
  return districtsOf(a).every((ours, i) => {
    const their = levels[i] ?? [];
    if (!ours.length || !their.length) return true;
    if (i === 0) {
      const [mine, other] = [knownRegion(country, ...ours), knownRegion(country, ...their)];
      if (mine && other) return mine === other;
    }
    // Codes with codes ("RIY"); names only where neither side has a code, as Azure spells a coded one differently in each service.
    const [codes, theirCodes] = [ours.filter(isCode), their.filter(isCode)];
    if (codes.length && theirCodes.length) return codes.some((code) => theirCodes.includes(code));
    if (codes.length || theirCodes.length) return true;
    return ours.some((name) => their.some((other) => sameWords(name, other) || sameKnown(country, name, other)));
  });
}

/**
 * Whether a hit is the place itself, as Azure says: at the suggestion's
 * level (a street for a street, a town or district for one, a named place
 * for one), without Azure's own doubt (`UpHierarchy`: found only above it,
 * as a street for a house; `Low` confidence). A district's centre for a
 * street, or a town's for its district, is only near it.
 */
function isItself(hit: unknown, level: Level) {
  const properties = pathOf(hit, 'properties');
  const codes = pathOf(properties, 'matchCodes');
  if ((Array.isArray(codes) && codes.includes('UpHierarchy')) || pathOf(properties, 'confidence') === 'Low') return false;
  const type = pathOf(properties, 'type');
  if (level === 'street') return !!text(pathOf(addressOf(hit), 'addressLine')) || !!text(pathOf(addressOf(hit), 'streetName'));
  if (level === 'area') return levelOf(type) === 'area' && type !== 'Postcode1' && type !== 'CountryRegion';
  return levelOf(type) === 'named';
}

/** A hit's own name: its street line, its neighbourhood, or its locality's first piece. */
const ownName = (hit: unknown) => {
  const a = addressOf(hit);
  return text(pathOf(a, 'addressLine')) || text(pathOf(a, 'neighborhood')) || text(pathOf(a, 'locality')).split(',')[0].trim();
};
const pointOf = (hit: unknown) => {
  const [lng, lat] = pathOf(hit, 'geometry', 'coordinates') as number[];
  return { lat, lng };
};
/**
 * Of the places of one kind and name among a geocoding's hits (Azure cannot
 * tell Abu Dhabi's Al Bateen from Al Ain's, and marks them `Ambiguous`, or
 * not, as its two forms answer), the one nearest where the search looked:
 * the suggestion was found nearest it.
 */
function nearestOf(first: unknown, among: unknown[], near?: LatLngAt) {
  const kind = pathOf(first, 'properties', 'type');
  const twins = among.filter((one) => pathOf(one, 'properties', 'type') === kind && sameWords(ownName(one), ownName(first)));
  return near && twins.length > 1 ? twins.reduce((best, one) => (kmBetween(near, pointOf(one)) < kmBetween(near, pointOf(best)) ? one : best)) : first;
}

/**
 * A street suggestion's own district, where its address names one below its
 * town: its neighbourhood ("Al Mina"), the district its line names after it
 * ("30 Street, Al Fisht, Sharjah"), or its locality where that is not its
 * city (Cairo's "El Balaqsa", Riyadh's "Al Rawdah").
 */
function districtOf(a: unknown, street: string, locale: Locale) {
  const [inLine] = districtsInLine(a, street);
  const { place, city, country } = azureWhere(a, locale);
  return text(pathOf(a, 'neighborhood')) || inLine || (place && !sameKnown(country, place, city) ? place : '');
}

/** Whether a geocoding hit names a district among its places: its neighbourhood, its locality's pieces, its line's. */
function names(hit: unknown, district: string) {
  const a = addressOf(hit);
  const key = nameKey(district);
  return [pathOf(a, 'neighborhood'), ...text(pathOf(a, 'locality')).split(','), ...text(pathOf(a, 'formattedAddress')).split(/\s+[-–]\s+|[,،]/)].some((piece) => nameKey(piece) === key);
}

/** Whether a geocoding hit is in another district than `district`: it names one of its own (its neighbourhood, or its line's after its street) and not this one. */
function elsewhere(hit: unknown, district: string) {
  const a = addressOf(hit);
  return !names(hit, district) && !!(text(pathOf(a, 'neighborhood')) || districtsInLine(a, text(pathOf(a, 'addressLine')))[0]);
}

/**
 * Where a suggestion of Azure's is (its suggestions carry no place), asked
 * of its geocoding in this order, the first hit in the suggestion's own
 * country and admin districts kept (`fits`):
 *
 * 1. the place by its own address, in Azure's structured form: its street
 *    line (a street's, never with a house number Azure made up), locality,
 *    admin districts (`adminDistrict2`, the governorate, keeps "Al Rawdah"
 *    in Riyadh), postcode and country; a place with a name of its own, or a
 *    neighbourhood its locality does not name, by its two lines (`query`);
 * 2. what found nothing so: by its two lines (`query`);
 * 3. the area it is in, a town's size or less: a street's own district (its
 *    neighbourhood, or the district its line names), then its locality; a
 *    named place's locality; an area's town (`precise: false`).
 *
 * Of the hits, a street's stretch in its own district first; for a street
 * named by its number alone, never another district's street of that
 * number. Of places of one kind and name (Abu Dhabi's Al Bateen and Al
 * Ain's), the one nearest where the search looked. It is precise when the
 * hit is the place itself (`isItself`); otherwise only near it. Never a
 * place anywhere else: none is found then.
 */
export async function azureLocate(geocode: Ask, place: AzurePlace, locale: Locale) {
  const { address: a, level, street, near } = place.azure;
  const { place: locality, city, country } = azureWhere(a, locale);
  const [first = [], second = []] = districtsOf(a);
  const line = addressLine([place.label, place.detail]);
  const around = {
    adminDistrict: first[0],
    adminDistrict2: second[0],
    countryRegion: country || undefined,
  };
  // Places of one name in one district, ranked nearest where the search looked (the Al Bateen it found first); a street's stretches by Azure, as where the search looked may be a town away from the street.
  const ranked = near && level !== 'street' ? { coordinates: `${near.lng},${near.lat}` } : {};
  const hits = async (params: Record<string, string | number | undefined>) => {
    const features = pathOf(await geocode({ top: 5, ...params, ...ranked }), 'features');
    return (Array.isArray(features) ? features : []).filter((hit) => Array.isArray(pathOf(hit, 'geometry', 'coordinates')) && fits(hit, a));
  };
  const own = text(pathOf(a, 'neighborhood'));
  const byName = level === 'named' || (own && !sameWords(own, locality));
  const structured =
    level === 'street'
      ? { addressLine: street, locality: locality || undefined, postalCode: text(pathOf(a, 'postalCode')) || undefined, ...around }
      : level === 'area' && locality
        ? { locality, postalCode: text(pathOf(a, 'postalCode')) || undefined, ...around }
        : { ...around };
  // A street's own district, and whether it is named by its number alone: another district's street of that number is another street.
  const district = level === 'street' ? districtOf(a, street, locale) : '';
  const another = (one: unknown) => !!district && isNumbered(street) && elsewhere(one, district);
  let found = (await hits(byName ? { query: line } : structured)).filter((one) => !another(one));
  if (!found.length && !byName) found = (await hits({ query: line })).filter((one) => !another(one));
  const exact = found.filter((one) => isItself(one, level));
  // Of a street's stretches, the one in its own district ("Al Wasl Road" in Al Mina, not in Al Bada'a).
  const home = district ? exact.find((one) => names(one, district)) : undefined;
  const likeliest = exact[0] ?? found[0];
  let hit = home ?? (likeliest && nearestOf(likeliest, exact[0] ? exact : found, near));
  let itself = !!hit && isItself(hit, level);
  // An area of the town's size or less, nearest where the search looked of two of a name: never a province's or a country's middle, hundreds of kilometres off.
  const small = (one: unknown) => levelOf(pathOf(one, 'properties', 'type')) === 'area' && !['AdminDivision1', 'CountryRegion', 'Postcode1'].includes(String(pathOf(one, 'properties', 'type')));
  const areaOf = async (params: Record<string, string | undefined>) => {
    const smaller = (await hits({ ...params, ...(near ? { coordinates: `${near.lng},${near.lat}` } : {}) })).filter(small);
    return smaller[0] && nearestOf(smaller[0], smaller, near);
  };
  // A street found only as the town above its district ("19 Street, Al Layyeh" as Sharjah's middle): its district, where Azure finds it, is nearer.
  const inDistrict = district && !sameWords(district, locality) ? { locality: district, ...around } : undefined;
  if (inDistrict && hit && !itself && !text(pathOf(addressOf(hit), 'addressLine')) && !names(hit, district)) hit = (await areaOf(inDistrict)) ?? hit;
  else if (!hit) {
    // Not found: the area it is in, its district first, then its town.
    const areas = level === 'area' ? [city && !sameWords(city, locality) ? { locality: city, ...around } : undefined] : [inDistrict, locality ? { locality, ...around } : undefined];
    for (const area of areas) if (!hit && area) hit = await areaOf(area);
    itself = false;
  }
  if (!hit) throw new Error(`Azure Maps found "${addressLine([place.label, place.detail], locale)}" nowhere in its own district and town`);
  const at = pointOf(hit);
  const parts = place.parts && { ...place.parts, ...(place.parts.city ? { city: cityAt(a, at, locale) } : {}) };
  return { ...at, address: addressLine([place.label, place.detail], locale), ...(parts ? { parts } : {}), ...(itself ? {} : { precise: false as const }) };
}

// ---- Google ------------------------------------------------------------------------

/** A plus code ("2XFJ+VJ6"): Google's name for a spot with no address of its own, never the place a person picked. */
const PLUS_CODE = /^[23456789CFGHJMPQRVWX]{4,8}\+[23456789CFGHJMPQRVWX]{0,3}(\s|$)/i;
/** What Google may put before a house's number (": 15 شارع التحرير"). */
const STRAY = /^[\s:;,،.\-–]+/u;

/** One of Google's `addressComponents`, by its type. */
const componentOf = (components: unknown, type: string) => (Array.isArray(components) ? components : []).find((c) => (pathOf(c, 'types') as string[] | undefined)?.includes(type));

/** Every country's name in a language and in English, as the browser names them: by the page's language, once. */
const COUNTRY_NAMES = new Map<string, Set<string>>();
function isCountry(name: string, locale: Locale) {
  let names = COUNTRY_NAMES.get(locale);
  if (!names) {
    names = new Set<string>();
    for (const language of new Set([locale, 'en'])) {
      const named = regionNames(language);
      for (let a = 65; a <= 90; a++)
        for (let b = 65; b <= 90; b++) {
          try {
            const one = named?.of(String.fromCharCode(a, b));
            if (one) names.add(one);
          } catch {
            // A code the browser names nothing for.
          }
        }
    }
    COUNTRY_NAMES.set(locale, names);
  }
  return names.has(name);
}

/** A dash between two pieces of a line, as Google writes the UAE's ("Sheikh Zayed Rd - Dubai - United Arab Emirates"). */
const DASH = /\s+[-–—]\s+/u;
/**
 * A line Google writes with dashes between its pieces, the UAE's, with
 * commas there: each piece then said once, and joined as the page joins an
 * address's ("Burj Khalifa" not again after the landmark's own name). Only
 * a line whose last piece, after a dash, is its country (`country`, as its
 * parts name it; or any country's name, for a suggestion's line): a dash in
 * a name ("26 July Axis - El Shiakh Zaied", "Mobil Gas Station - Zamalek")
 * stays.
 */
function undashed(line: string, locale: Locale, country = '') {
  const pieces = line.split(DASH);
  const last = pieces[pieces.length - 1];
  return pieces.length > 1 && (country ? last === country : isCountry(last, locale)) ? pieces.join(', ') : line;
}

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
  // A number has a digit: Google's "شارع" ("street") before a street on an English page is none.
  const said = of('street_number').replace(STRAY, '');
  const number = /\p{Nd}/u.test(said) ? said : '';
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
    const detail = addressLine([undashed(text(pathOf(prediction, 'structuredFormat', 'secondaryText', 'text')), locale)], locale);
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
          // Its country set apart where Google writes nothing but a space before it ("King Fahd Rd, Riyadh Saudi Arabia"), as its parts name it; the UAE's dashes read as commas.
          const country = text(pathOf(componentOf(pathOf(at, 'addressComponents'), 'country'), 'longText'));
          const pieces = undashed(text(pathOf(at, 'formattedAddress')), locale, country)
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
