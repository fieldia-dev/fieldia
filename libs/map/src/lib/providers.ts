import type { Locale } from '@fieldia/core';
import type { Bounds, LatLng } from './geo';

/**
 * Where a map's images, credits and address search come from. Every map in
 * the package draws through one of these, so an app changes provider in one
 * place and nothing else moves. Keys never live in Fieldia: the app passes
 * them, or a function that fetches a short-lived token from its own server.
 * Credits are text and links built here, never HTML from a provider.
 */

export type BaseMap = 'road' | 'dark' | 'satellite';

export interface TileSpec {
  /** With `{z}`, `{x}` and `{y}` where the tile's numbers go. */
  url: string;
  maxZoom: number;
  tileSize?: number;
  zoomOffset?: number;
  /** Headers each image is fetched with: a token that must not sit in an address. */
  headers?: () => Promise<Record<string, string>>;
}

export interface Credit {
  text: string;
  href?: string;
}

export interface MapView {
  zoom: number;
  bounds: Bounds;
}

export interface PlaceFound {
  /** The place itself: a name, or a street and its number. */
  label: string;
  /** Where it is, on the line under it: its district, city, country. */
  detail?: string;
  /** Where it is on the map; or, for a provider whose suggestions carry none (Google's), `locate` finds it when the place is picked. */
  lat?: number;
  lng?: number;
  locate?: () => Promise<{ lat: number; lng: number; address?: string }>;
}

export interface SearchRequest {
  text: string;
  /** Where the map is: results near it first. */
  near?: LatLng;
  /** How close the map is, for how far "near" reaches. */
  zoom?: number;
  locale: Locale;
  signal?: AbortSignal;
}

export type AddressSearch = (request: SearchRequest) => Promise<PlaceFound[]>;
export type ReverseSearch = (at: LatLng & { locale: Locale; signal?: AbortSignal }) => Promise<string | null>;

export interface MapProvider {
  readonly id: string;
  /** The map images of a kind, or null when the provider has none of it. */
  tiles(kind: BaseMap, locale: Locale): Promise<TileSpec | null>;
  /** What must be credited under the map, for what is in view. */
  credits(kind: BaseMap, view: MapView, locale: Locale): Promise<Credit[]>;
  /** The provider's mark, which its terms ask for in the map's corner. */
  readonly logo?: { text: string; image?: string; href?: string };
  readonly search?: AddressSearch;
  readonly reverse?: ReverseSearch;
  /** Whether its terms allow a search for each pause in typing; otherwise it searches when Enter is pressed. */
  readonly searchAsYouType?: boolean;
  /** Free for trying things out, not for an app in use: a warning says so once. */
  readonly demoOnly?: boolean;
}

type Fetch = typeof globalThis.fetch;
const query = (params: Record<string, string | number | undefined>) =>
  Object.entries(params)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
    .join('&');

async function getJson(fetchWith: Fetch, url: string, init?: RequestInit): Promise<unknown> {
  const response = await fetchWith(url, init);
  if (!response.ok) throw new Error(`${response.status} from ${url.split('?')[0]}`);
  return response.json();
}

type Json = { [key: string]: unknown };
const isObject = (value: unknown): value is Json => typeof value === 'object' && value !== null && !Array.isArray(value);
const pathOf = (value: unknown, ...path: string[]): unknown => path.reduce<unknown>((at, key) => (isObject(at) ? at[key] : undefined), value);

/** A provider's words, without the direction marks some put in Arabic: unseen, they would stay in an address field and its searches. */
const clean = (value: unknown) => (typeof value === 'string' ? value.replace(/[\u200e\u200f\u061c]/g, '').trim() : '');

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', copy: '©', reg: '®' };
/** A credit a provider sends as HTML (Azure's are links), as the words a reader sees: never put on the page as HTML. */
const textOfHtml = (html: string) =>
  html
    .replace(/<[^>]*>/g, '')
    .replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (all, name: string) =>
      name[0] === '#' ? String.fromCodePoint(parseInt(name.slice(name[1] === 'x' || name[1] === 'X' ? 2 : 1), name[1] === 'x' || name[1] === 'X' ? 16 : 10)) : (ENTITIES[name.toLowerCase()] ?? all)
    )
    .trim();

/** The words of a list that are there, once each, joined: "Downtown, Cairo, Egypt". */
const joined = (...parts: unknown[]) => {
  const seen: string[] = [];
  for (const part of parts) if (typeof part === 'string' && part.trim() && !seen.includes(part.trim())) seen.push(part.trim());
  return seen.join(', ');
};

/** Places from a GeoJSON FeatureCollection: each named by the first of `labels` it has, with the line under it from `detail`. */
function placesFrom(collection: unknown, labels: string[][], detail?: (properties: unknown) => string): PlaceFound[] {
  const features = pathOf(collection, 'features');
  if (!Array.isArray(features)) return [];
  return features.flatMap((feature) => {
    const [lng, lat] = (pathOf(feature, 'geometry', 'coordinates') as number[] | undefined) ?? [];
    const label = labels.map((path) => pathOf(feature, ...path)).find((text) => typeof text === 'string' && text.trim());
    if (typeof lat !== 'number' || typeof lng !== 'number' || typeof label !== 'string') return [];
    const under = detail?.(pathOf(feature, 'properties'));
    return [{ label, ...(under && under !== label ? { detail: under } : {}), lat, lng }];
  });
}

// ---------------------------------------------------------------------------

export interface OpenStreetMapOptions {
  /**
   * Whose search: Photon (komoot's, on OpenStreetMap's data), which answers as
   * people type, nearest the map first; or Nominatim, OpenStreetMap's own,
   * whose policy allows a search only when Enter is pressed.
   */
  search?: 'photon' | 'nominatim';
  /** Photon's address, for a copy of it the app runs: `https://photon.komoot.io` unless said. */
  photonUrl?: string;
  fetch?: Fetch;
}

/** Languages Photon names places in; in any other it gives the places' own names. */
const PHOTON_LANGUAGES = new Set(['en', 'de', 'fr']);

/** Photon's places: each one's name (or its street and number) on one line, where it is on the next. */
function photonPlaces(found: unknown): PlaceFound[] {
  const features = pathOf(found, 'features');
  if (!Array.isArray(features)) return [];
  return features.flatMap((feature) => {
    const [lng, lat] = (pathOf(feature, 'geometry', 'coordinates') as number[] | undefined) ?? [];
    const p = pathOf(feature, 'properties');
    const name = pathOf(p, 'name');
    const label = typeof name === 'string' && name.trim() ? name.trim() : streetOf(p);
    if (typeof lat !== 'number' || typeof lng !== 'number' || !label) return [];
    // Under a named place, its street when it has one; then its district, city and country.
    const detail = joined(label === streetOf(p) ? '' : streetOf(p), pathOf(p, 'district'), pathOf(p, 'city'), pathOf(p, 'state'), pathOf(p, 'country'));
    return [{ label, ...(detail ? { detail } : {}), lat, lng }];
  });
}

/**
 * OpenStreetMap's own map images, for demos and development only (its usage
 * policy treats an app in production as heavy use), with Photon's search,
 * which answers as people type, or Nominatim's.
 */
export function openStreetMap(options: OpenStreetMapOptions = {}): MapProvider {
  const fetchWith = options.fetch ?? ((...args: Parameters<Fetch>) => globalThis.fetch(...args));
  const photon = (options.photonUrl ?? 'https://photon.komoot.io').replace(/\/$/, '');
  const base = {
    id: 'openstreetmap',
    demoOnly: true,
    async tiles(kind: BaseMap) {
      return kind === 'road' ? { url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', maxZoom: 19 } : null;
    },
    async credits() {
      return [{ text: '© OpenStreetMap contributors', href: 'https://www.openstreetmap.org/copyright' }];
    },
  };
  if (options.search === 'nominatim') {
    return {
      ...base,
      searchAsYouType: false,
      async search({ text, locale, signal }) {
        const found = await getJson(fetchWith, `https://nominatim.openstreetmap.org/search?${query({ format: 'jsonv2', limit: 5, q: text, 'accept-language': locale })}`, { signal });
        return Array.isArray(found)
          ? found.flatMap((place) => {
              const lat = Number(pathOf(place, 'lat'));
              const lng = Number(pathOf(place, 'lon'));
              const whole = pathOf(place, 'display_name');
              if (!Number.isFinite(lat) || !Number.isFinite(lng) || typeof whole !== 'string') return [];
              const name = pathOf(place, 'name');
              const label = typeof name === 'string' && name.trim() ? name : whole.split(',')[0];
              const rest = whole.split(',').map((part) => part.trim()).filter((part, i) => !(i === 0 && part === label));
              return [{ label, ...(rest.length ? { detail: rest.join(', ') } : {}), lat, lng }];
            })
          : [];
      },
      async reverse({ lat, lng, locale, signal }) {
        const found = await getJson(fetchWith, `https://nominatim.openstreetmap.org/reverse?${query({ format: 'jsonv2', lat, lon: lng, 'accept-language': locale })}`, { signal });
        const label = pathOf(found, 'display_name');
        return typeof label === 'string' ? label : null;
      },
    };
  }
  const lang = (locale: Locale) => (PHOTON_LANGUAGES.has(locale) ? locale : undefined);
  return {
    ...base,
    searchAsYouType: true,
    async search({ text, near, zoom, locale, signal }) {
      const found = await getJson(fetchWith, `${photon}/api?${query({ q: text, limit: 6, lang: lang(locale), lat: near?.lat, lon: near?.lng, zoom: near && zoom !== undefined ? Math.round(zoom) : undefined })}`, { signal });
      return photonPlaces(found);
    },
    async reverse({ lat, lng, locale, signal }) {
      const found = await getJson(fetchWith, `${photon}/reverse?${query({ lat, lon: lng, limit: 1, lang: lang(locale) })}`, { signal });
      const [place] = photonPlaces(found);
      return place ? joined(place.label, place.detail) : null;
    },
  };
}

/** A street with its number, as a place without a name of its own is called. */
function streetOf(properties: unknown): string {
  const street = pathOf(properties, 'street');
  const number = pathOf(properties, 'housenumber');
  return typeof street === 'string' ? [street, typeof number === 'string' ? number : ''].filter(Boolean).join(' ') : '';
}

// ---------------------------------------------------------------------------

export interface AzureMapsOptions {
  /** A subscription key, restricted to the app's sites in Azure. */
  key?: string;
  /** Or a Microsoft Entra token, fetched from the app's own server; sent in a header with `clientId`. */
  token?: () => Promise<string>;
  clientId?: string;
  fetch?: Fetch;
}

/** Azure lists the languages it draws; it refuses any other tag, `ar-001` among them. */
const AZURE_LANGUAGE: Record<Locale, string> = { en: 'en-US', ar: 'ar', fr: 'fr-FR', de: 'de-DE' };
const AZURE_TILESET: Record<BaseMap, string> = { road: 'microsoft.base.road', dark: 'microsoft.base.darkgrey', satellite: 'microsoft.imagery' };

/** Microsoft Azure Maps: road, dark and satellite map images, credits for the view, and address search. */
export function azureMaps(options: AzureMapsOptions): MapProvider {
  if (!options.key && !options.token) throw new Error('azureMaps needs a key or a token');
  const fetchWith = options.fetch ?? ((...args: Parameters<Fetch>) => globalThis.fetch(...args));
  const auth = options.key ? `&subscription-key=${encodeURIComponent(options.key)}` : '';
  const headers = async (): Promise<Record<string, string>> =>
    options.key ? {} : { Authorization: `Bearer ${await options.token!()}`, ...(options.clientId ? { 'x-ms-client-id': options.clientId } : {}) };
  const ask = async (path: string, params: Record<string, string | number | undefined>, locale?: Locale, signal?: AbortSignal) =>
    getJson(fetchWith, `https://atlas.microsoft.com/${path}?${query(params)}${auth}`, {
      signal,
      headers: { ...(await headers()), ...(locale ? { 'Accept-Language': AZURE_LANGUAGE[locale] } : {}) },
    });
  return {
    id: 'azure-maps',
    searchAsYouType: true,
    async tiles(kind, locale) {
      const url = `https://atlas.microsoft.com/map/tile?api-version=2024-04-01&tilesetId=${AZURE_TILESET[kind]}&zoom={z}&x={x}&y={y}&tileSize=256&language=${AZURE_LANGUAGE[locale]}&view=Auto${auth}`;
      return { url, maxZoom: kind === 'satellite' ? 19 : 22, ...(options.key ? {} : { headers }) };
    },
    async credits(kind, { zoom, bounds }) {
      try {
        const answer = await ask('map/attribution', { 'api-version': '2024-04-01', tilesetId: AZURE_TILESET[kind], zoom: Math.round(zoom), bounds: [bounds.west, bounds.south, bounds.east, bounds.north].join(',') });
        const copyrights = pathOf(answer, 'copyrights');
        if (Array.isArray(copyrights) && copyrights.length) return copyrights.filter((c): c is string => typeof c === 'string').map((html) => ({ text: textOfHtml(html) })).filter((c) => c.text);
      } catch {
        // Its credits stay said even when the service that lists them is down.
      }
      return [{ text: '© Microsoft' }];
    },
    async search({ text, near, locale, signal }) {
      const coordinates = near ? `${near.lng},${near.lat}` : undefined;
      // Its autocomplete reads a word half typed, as geocoding does not; its suggestions carry no place, so a picked one is geocoded then.
      const found = await ask('geocode:autocomplete', { 'api-version': '2026-01-01', top: 5, query: text, coordinates }, locale, signal);
      return azurePlaces(found).map((place) => ({
        ...place,
        locate: async () => {
          const address = [place.label, place.detail].filter(Boolean).join(', ');
          const [hit] = azurePlaces(await ask('geocode', { 'api-version': '2023-06-01', top: 1, query: place.whole ?? address, coordinates }, locale));
          if (hit?.lat === undefined || hit.lng === undefined) throw new Error('Azure Maps found no place');
          // The address as its two lines read: with its town, which Azure's own may leave out.
          return { lat: hit.lat, lng: hit.lng, address };
        },
      })).map(({ whole: _whole, ...place }) => place);
    },
    async reverse({ lat, lng, locale, signal }) {
      const found = await ask('reverseGeocode', { 'api-version': '2023-06-01', coordinates: `${lng},${lat}` }, locale, signal);
      const features = pathOf(found, 'features');
      const formatted = Array.isArray(features) ? clean(pathOf(features[0], 'properties', 'address', 'formattedAddress')) : '';
      return formatted || null;
    },
  };
}

/**
 * Azure's addresses on two lines: the street (or the place's name), then the
 * rest of the address, its town always in it; where it is, when the answer
 * says (geocoding does, autocomplete does not); and the whole address as Azure
 * wrote it, to geocode a suggestion by.
 */
function azurePlaces(found: unknown): (PlaceFound & { whole?: string })[] {
  const features = pathOf(found, 'features');
  if (!Array.isArray(features)) return [];
  return features.flatMap((feature) => {
    const [lng, lat] = (pathOf(feature, 'geometry', 'coordinates') as number[] | undefined) ?? [];
    const address = pathOf(feature, 'properties', 'address');
    const whole = clean(pathOf(address, 'formattedAddress'));
    const parts = whole
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
    const label = clean(pathOf(address, 'addressLine')) || parts[0];
    if (!label) return [];
    let rest = parts.filter((part, i) => !(i === 0 && part === label) && part !== label);
    const town = clean(pathOf(address, 'locality'));
    if (town && !rest.includes(town)) rest = [town, ...rest];
    const at = typeof lat === 'number' && typeof lng === 'number' ? { lat, lng } : {};
    return [{ label, ...(rest.length ? { detail: rest.join(', ') } : {}), ...at, ...(whole ? { whole } : {}) }];
  });
}

// ---------------------------------------------------------------------------

export interface GoogleMapsOptions {
  key: string;
  /** The country whose borders and names the map follows (CLDR, such as `EG`). */
  region?: string;
  /** Google's logo, as an image the app serves; its name is shown in its place until one is given. */
  logo?: string;
  fetch?: Fetch;
}

const GOOGLE_MAP_TYPE: Partial<Record<BaseMap, string>> = { road: 'roadmap', satellite: 'satellite' };

/**
 * Google's map images through its Map Tiles API (a session for each kind and
 * language, credits for the view, Google's mark in the corner its terms
 * name), its Places API's suggestions as people type, and its Geocoding API
 * to name a point. The key needs those three APIs enabled, and should be
 * restricted to the app's sites.
 */
export function googleMaps(options: GoogleMapsOptions): MapProvider {
  const fetchWith = options.fetch ?? ((...args: Parameters<Fetch>) => globalThis.fetch(...args));
  const key = encodeURIComponent(options.key);
  const sessions = new Map<string, Promise<{ session: string; expiry: number }>>();
  function session(kind: BaseMap, locale: Locale) {
    const mapType = GOOGLE_MAP_TYPE[kind]!;
    const id = `${mapType}:${locale}`;
    const known = sessions.get(id);
    return known ?? open();
    function open() {
      const opening = getJson(fetchWith, `https://tile.googleapis.com/v1/createSession?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mapType, language: locale, region: options.region ?? 'US' }),
      }).then((answer) => {
        const value = pathOf(answer, 'session');
        if (typeof value !== 'string') throw new Error('Google gave no session');
        const expiry = Number(pathOf(answer, 'expiry')) * 1000;
        // A session lasts about two weeks; one near its end is opened again.
        if (Number.isFinite(expiry)) {
          const timer = setTimeout(() => sessions.delete(id), Math.min(2 ** 31 - 1, Math.max(0, expiry - Date.now() - 3_600_000)));
          // In Node (a test, a server), a timer waiting two weeks must not keep the process alive.
          (timer as unknown as { unref?: () => void }).unref?.();
        }
        return { session: value, expiry };
      });
      opening.catch(() => sessions.delete(id));
      sessions.set(id, opening);
      return opening;
    }
  }
  /** One session from the first letter typed to the place picked: Google charges the suggestions of a session that ends in a pick as the pick. */
  let searching: string | undefined;
  const newSession = () => (globalThis.crypto?.randomUUID?.() ?? 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => ((Math.random() * 16) | (c === 'x' ? 0 : 8)).toString(16).slice(0, 1)));
  /** How far "near" reaches at a zoom: about what the map shows, within Google's bounds. */
  const radiusAt = (zoom: number | undefined) => Math.round(Math.min(50_000, Math.max(100, 40_075_016 / 2 ** (zoom ?? 12))));
  return {
    id: 'google',
    logo: { text: 'Google Maps', ...(options.logo ? { image: options.logo } : {}) },
    searchAsYouType: true,
    async search({ text, near, zoom, locale, signal }) {
      searching ??= newSession();
      const token = searching;
      const answer = await getJson(fetchWith, 'https://places.googleapis.com/v1/places:autocomplete', {
        method: 'POST',
        signal,
        headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': options.key },
        body: JSON.stringify({
          input: text,
          languageCode: locale,
          ...(options.region ? { regionCode: options.region } : {}),
          sessionToken: token,
          ...(near ? { locationBias: { circle: { center: { latitude: near.lat, longitude: near.lng }, radius: radiusAt(zoom) } } } : {}),
        }),
      });
      const suggestions = pathOf(answer, 'suggestions');
      if (!Array.isArray(suggestions)) return [];
      return suggestions.flatMap((suggestion) => {
        const prediction = pathOf(suggestion, 'placePrediction');
        const placeId = pathOf(prediction, 'placeId');
        const label = clean(pathOf(prediction, 'structuredFormat', 'mainText', 'text')) || clean(pathOf(prediction, 'text', 'text'));
        if (typeof placeId !== 'string' || !label) return [];
        const detail = clean(pathOf(prediction, 'structuredFormat', 'secondaryText', 'text'));
        return [
          {
            label,
            ...(detail ? { detail } : {}),
            locate: async () => {
              const place = await getJson(fetchWith, `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?${query({ languageCode: locale, sessionToken: token })}`, {
                headers: { 'X-Goog-Api-Key': options.key, 'X-Goog-FieldMask': 'location,formattedAddress' },
              });
              // Picked: the session is over, the next letter typed opens another.
              if (searching === token) searching = undefined;
              const latitude = pathOf(place, 'location', 'latitude');
              const longitude = pathOf(place, 'location', 'longitude');
              if (typeof latitude !== 'number' || typeof longitude !== 'number') throw new Error('Google gave no place');
              const address = clean(pathOf(place, 'formattedAddress'));
              return { lat: latitude, lng: longitude, ...(address ? { address } : {}) };
            },
          },
        ];
      });
    },
    async reverse({ lat, lng, locale, signal }) {
      const answer = await getJson(fetchWith, `https://maps.googleapis.com/maps/api/geocode/json?${query({ latlng: `${lat},${lng}`, language: locale, key: options.key })}`, { signal });
      const results = pathOf(answer, 'results');
      const named = Array.isArray(results) ? clean(pathOf(results[0], 'formatted_address')) : '';
      return named || null;
    },
    async tiles(kind, locale) {
      if (!GOOGLE_MAP_TYPE[kind]) return null;
      const { session: id } = await session(kind, locale);
      return { url: `https://tile.googleapis.com/v1/2dtiles/{z}/{x}/{y}?session=${id}&key=${key}`, maxZoom: 22 };
    },
    async credits(kind, { zoom, bounds }, locale) {
      try {
        const { session: id } = await session(kind === 'dark' ? 'road' : kind, locale);
        const answer = await getJson(fetchWith, `https://tile.googleapis.com/tile/v1/viewport?${query({ session: id, key: options.key, zoom: Math.round(zoom), north: bounds.north, south: bounds.south, east: bounds.east, west: bounds.west })}`);
        const copyright = pathOf(answer, 'copyright');
        if (typeof copyright === 'string' && copyright.trim()) return [{ text: copyright }];
      } catch {
        // Said even when the service that lists them is down.
      }
      return [{ text: 'Map data © Google' }];
    },
  };
}

// ---------------------------------------------------------------------------

export interface MapboxOptions {
  token: string;
  /** Style ids, `owner/style`. */
  style?: string;
  darkStyle?: string;
  satelliteStyle?: string;
  /** Mapbox's wordmark, as an image the app serves; its name is shown until one is given. */
  logo?: string;
  /**
   * Ask for results the app may keep (Mapbox's permanent geocoding). On by
   * default, because a place field keeps what it finds; off only for an app
   * that stores nothing.
   */
  permanent?: boolean;
  fetch?: Fetch;
}

/** Mapbox: its styles as map images, its credits and wordmark, and its address search as people type. */
export function mapbox(options: MapboxOptions): MapProvider {
  const fetchWith = options.fetch ?? ((...args: Parameters<Fetch>) => globalThis.fetch(...args));
  const token = encodeURIComponent(options.token);
  const styles: Record<BaseMap, string> = {
    road: options.style ?? 'mapbox/streets-v12',
    dark: options.darkStyle ?? 'mapbox/dark-v11',
    satellite: options.satelliteStyle ?? 'mapbox/satellite-streets-v12',
  };
  const permanent = options.permanent ?? true;
  const ask = async (path: string, params: Record<string, string | number | undefined>, signal?: AbortSignal) =>
    getJson(fetchWith, `https://api.mapbox.com/search/geocode/v6/${path}?${query({ ...params, permanent: String(permanent) })}&access_token=${token}`, { signal });
  return {
    id: 'mapbox',
    searchAsYouType: true,
    logo: { text: 'mapbox', ...(options.logo ? { image: options.logo } : {}), href: 'https://www.mapbox.com/' },
    async tiles(kind) {
      return { url: `https://api.mapbox.com/styles/v1/${styles[kind]}/tiles/512/{z}/{x}/{y}@2x?access_token=${token}`, maxZoom: 22, tileSize: 512, zoomOffset: -1 };
    },
    async credits() {
      return [
        { text: '© Mapbox', href: 'https://www.mapbox.com/about/maps/' },
        { text: '© OpenStreetMap', href: 'https://www.openstreetmap.org/copyright' },
        { text: 'Improve this map', href: 'https://www.mapbox.com/map-feedback/' },
      ];
    },
    async search({ text, near, locale, signal }) {
      return placesFrom(await ask('forward', { q: text, limit: 5, language: locale, proximity: near ? `${near.lng},${near.lat}` : undefined }, signal), [['properties', 'name'], ['properties', 'full_address']], (p) => joined(pathOf(p, 'place_formatted')));
    },
    async reverse({ lat, lng, locale, signal }) {
      return placesFrom(await ask('reverse', { longitude: lng, latitude: lat, language: locale, limit: 1 }, signal), [['properties', 'full_address'], ['properties', 'name']])[0]?.label ?? null;
    },
  };
}

// ---------------------------------------------------------------------------

export interface TilesOptions {
  /** With `{z}`, `{x}` and `{y}`: the app's own map images, or any provider's. */
  url: string;
  darkUrl?: string;
  satelliteUrl?: string;
  credit: Credit | Credit[];
  maxZoom?: number;
  tileSize?: number;
  zoomOffset?: number;
  search?: AddressSearch;
  reverse?: ReverseSearch;
  searchAsYouType?: boolean;
}

/** Map images from any address, such as the app's own server, with their credit. */
export function tiles(options: TilesOptions): MapProvider {
  const urls: Record<BaseMap, string | undefined> = { road: options.url, dark: options.darkUrl, satellite: options.satelliteUrl };
  const credits = Array.isArray(options.credit) ? options.credit : [options.credit];
  return {
    id: 'tiles',
    search: options.search,
    reverse: options.reverse,
    searchAsYouType: options.searchAsYouType ?? !!options.search,
    async tiles(kind) {
      const url = urls[kind];
      if (!url) return null;
      return { url, maxZoom: options.maxZoom ?? 19, ...(options.tileSize ? { tileSize: options.tileSize } : {}), ...(options.zoomOffset ? { zoomOffset: options.zoomOffset } : {}) };
    },
    async credits() {
      return credits;
    },
  };
}
