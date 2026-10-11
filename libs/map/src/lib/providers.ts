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
  label: string;
  lat: number;
  lng: number;
}

export interface SearchRequest {
  text: string;
  /** Where the map is: results near it first. */
  near?: LatLng;
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

/** Places from a GeoJSON FeatureCollection, each named by the first of `labels` it has. */
function placesFrom(collection: unknown, ...labels: string[][]): PlaceFound[] {
  const features = pathOf(collection, 'features');
  if (!Array.isArray(features)) return [];
  return features.flatMap((feature) => {
    const [lng, lat] = (pathOf(feature, 'geometry', 'coordinates') as number[] | undefined) ?? [];
    const label = labels.map((path) => pathOf(feature, ...path)).find((text) => typeof text === 'string' && text.trim());
    return typeof lat === 'number' && typeof lng === 'number' && typeof label === 'string' ? [{ label, lat, lng }] : [];
  });
}

// ---------------------------------------------------------------------------

export interface OpenStreetMapOptions {
  fetch?: Fetch;
}

/**
 * OpenStreetMap's own map images and Nominatim's search: free, for demos and
 * development only. Their usage policies treat an app in production as heavy
 * use, and Nominatim's forbids searching as people type.
 */
export function openStreetMap(options: OpenStreetMapOptions = {}): MapProvider {
  const fetchWith = options.fetch ?? ((...args: Parameters<Fetch>) => globalThis.fetch(...args));
  return {
    id: 'openstreetmap',
    demoOnly: true,
    searchAsYouType: false,
    async tiles(kind) {
      return kind === 'road' ? { url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', maxZoom: 19 } : null;
    },
    async credits() {
      return [{ text: '© OpenStreetMap contributors', href: 'https://www.openstreetmap.org/copyright' }];
    },
    async search({ text, locale, signal }) {
      const found = await getJson(fetchWith, `https://nominatim.openstreetmap.org/search?${query({ format: 'jsonv2', limit: 5, q: text, 'accept-language': locale })}`, { signal });
      return Array.isArray(found)
        ? found.flatMap((place) => {
            const lat = Number(pathOf(place, 'lat'));
            const lng = Number(pathOf(place, 'lon'));
            const label = pathOf(place, 'display_name');
            return Number.isFinite(lat) && Number.isFinite(lng) && typeof label === 'string' ? [{ label, lat, lng }] : [];
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
        if (Array.isArray(copyrights) && copyrights.length) return copyrights.filter((c): c is string => typeof c === 'string').map((text) => ({ text }));
      } catch {
        // Its credits stay said even when the service that lists them is down.
      }
      return [{ text: '© Microsoft' }];
    },
    async search({ text, near, locale, signal }) {
      const found = await ask('geocode', { 'api-version': '2023-06-01', top: 5, query: text, coordinates: near ? `${near.lng},${near.lat}` : undefined }, locale, signal);
      return placesFrom(found, ['properties', 'address', 'formattedAddress']);
    },
    async reverse({ lat, lng, locale, signal }) {
      const found = await ask('reverseGeocode', { 'api-version': '2023-06-01', coordinates: `${lng},${lat}` }, locale, signal);
      return placesFrom(found, ['properties', 'address', 'formattedAddress'])[0]?.label ?? null;
    },
  };
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
 * Google's map images through its Map Tiles API: a session for each kind and
 * language, credits for the view, and Google's mark in the corner its terms
 * name. Address search is the app's own here.
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
        if (Number.isFinite(expiry)) setTimeout(() => sessions.delete(id), Math.max(0, expiry - Date.now() - 3_600_000)).unref?.();
        return { session: value, expiry };
      });
      opening.catch(() => sessions.delete(id));
      sessions.set(id, opening);
      return opening;
    }
  }
  return {
    id: 'google',
    logo: { text: 'Google Maps', ...(options.logo ? { image: options.logo } : {}) },
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
      return placesFrom(await ask('forward', { q: text, limit: 5, language: locale, proximity: near ? `${near.lng},${near.lat}` : undefined }, signal), ['properties', 'full_address'], ['properties', 'name']);
    },
    async reverse({ lat, lng, locale, signal }) {
      return placesFrom(await ask('reverse', { longitude: lng, latitude: lat, language: locale, limit: 1 }, signal), ['properties', 'full_address'], ['properties', 'name'])[0]?.label ?? null;
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
