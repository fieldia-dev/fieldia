import { pathOf } from './answers';

/**
 * An address in its parts, as Fieldia's address field (`json.address`) keeps
 * one: the street with its number, the city, the region (a state, a
 * governorate), the postcode, and the country as its ISO code ("EG"). Each
 * provider names them its own way; they are read into these here, asked for
 * only by a search that wants them (`SearchRequest.parts`).
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

/** The parts there are, the street with its number after it (as a place's name has it), the country's code in capitals; nothing when none is. */
function partsOf(street: unknown, number: unknown, city: unknown, region: unknown, postcode: unknown, country: unknown): AddressParts | undefined {
  const found: Record<string, string> = {
    street: [text(street), text(street) && text(number)].filter(Boolean).join(' '),
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
  return partsOf(pathOf(p, 'street') ?? own('street'), pathOf(p, 'housenumber'), pathOf(p, 'city') ?? own('city'), pathOf(p, 'state'), pathOf(p, 'postcode'), pathOf(p, 'countrycode'));
};

/** Nominatim's `address` (with `addressdetails=1`): a town or a village where there is no city. */
export const nominatimParts = (a: unknown) =>
  partsOf(pathOf(a, 'road'), pathOf(a, 'house_number'), pathOf(a, 'city') ?? pathOf(a, 'town') ?? pathOf(a, 'village'), pathOf(a, 'state'), pathOf(a, 'postcode'), pathOf(a, 'country_code'));

/** Azure's `address`: its own street line when it has one, its first admin district the region; its country's code is `ISO`, or `iso` in some answers. */
export const azureParts = (a: unknown) =>
  partsOf(
    text(pathOf(a, 'addressLine')) || pathOf(a, 'streetName'),
    text(pathOf(a, 'addressLine')) ? '' : pathOf(a, 'streetNumber'),
    pathOf(a, 'locality'),
    (pathOf(a, 'adminDistricts') as unknown[] | undefined)?.map((d) => text(pathOf(d, 'name')) || pathOf(d, 'shortName'))[0],
    pathOf(a, 'postalCode'),
    pathOf(a, 'countryRegion', 'ISO') ?? pathOf(a, 'countryRegion', 'iso')
  );

/** Google's `addressComponents`, each by its type: the country by its short code. */
export const googleParts = (components: unknown) => {
  const of = (type: string, short?: boolean) => pathOf((Array.isArray(components) ? components : []).find((c) => (pathOf(c, 'types') as string[] | undefined)?.includes(type)), short ? 'shortText' : 'longText');
  return partsOf(of('route'), of('street_number'), of('locality') ?? of('postal_town'), of('administrative_area_level_1'), of('postal_code'), of('country', true));
};

/** Mapbox's `context`: its address's own line (number and street), or the street alone. */
export const mapboxParts = (p: unknown) => {
  const at = (...path: string[]) => pathOf(p, 'context', ...path);
  return partsOf(at('address', 'name') ?? at('street', 'name'), '', at('place', 'name') ?? at('locality', 'name'), at('region', 'name'), at('postcode', 'name'), at('country', 'country_code'));
};

/** Only places in the countries asked for, when some are: for a provider that cannot be asked to keep to them. */
export const inCountries = <T extends { parts?: AddressParts }>(places: T[], countries?: string[]) =>
  countries?.length ? places.filter((place) => countries.includes(place.parts?.country ?? '')) : places;
