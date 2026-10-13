import type { Locale } from '@fieldia/core';
import { getJson, pathOf, type Fetch } from './answers';
import { addressLine } from './address-line';
import type { AddressParts } from './address-parts';
import type { Bounds, LatLng } from './geo';

/**
 * Where a map's images, live traffic, credits, address search and routes come from. Every map in
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
  /** The zoom they start at, when not the world's. */
  minZoom?: number;
  /** Seconds after which they are out of date, as live traffic's are: drawn again then, each address with `&t=` and the time. */
  fresh?: number;
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
  /** `precise: false` when the place found is only near it: the street of a house not found, the district of a street found elsewhere. */
  locate?: () => Promise<{ lat: number; lng: number; address?: string; parts?: AddressParts; precise?: false }>;
  /** Its address in its parts, when the search asked for them (`parts`); for Google's, `locate` gives them. */
  parts?: AddressParts;
  /** Said when it is picked, whether or not it is located: Google's session of suggestions ends there. */
  picked?: () => void;
}

export interface SearchRequest {
  text: string;
  /** Where the map is: results near it first. */
  near?: LatLng;
  /** How close the map is, for how far "near" reaches. */
  zoom?: number;
  locale: Locale;
  signal?: AbortSignal;
  /** Only places in these countries, by their ISO codes ("EG"). */
  countries?: string[];
  /** Each place's address in its parts too, for an address field to fill. */
  parts?: boolean;
  /** Addresses before named places (a shop, a mall), as an address field wants them, where the provider says which are which. */
  addresses?: boolean;
}

export type AddressSearch = (request: SearchRequest) => Promise<PlaceFound[]>;
export type ReverseSearch = (at: LatLng & { locale: Locale; signal?: AbortSignal }) => Promise<string | null>;

export type TravelMode = 'car' | 'bike' | 'foot';

export interface RouteRequest {
  /** Where it starts, the places it passes in order, and where it ends. */
  points: LatLng[];
  mode: TravelMode;
  locale: Locale;
  signal?: AbortSignal;
}

/** A route along the roads: its line, how long it is, and how long it takes. */
export interface RouteFound {
  line: LatLng[];
  metres: number;
  seconds: number;
}

export type RouteFinder = (request: RouteRequest) => Promise<RouteFound>;

/** The area within some minutes of a place, for a map's reachable area. */
export interface ReachRequest {
  at: LatLng;
  minutes: number;
  mode: TravelMode;
  signal?: AbortSignal;
}

/** A reachable area: its outer rings, as places (a ring for each part of it). */
export interface ReachFound {
  rings: LatLng[][];
}

export type ReachFinder = (request: ReachRequest) => Promise<ReachFound>;

/** The providers' routes, loaded the first time one is asked for: a form with only a place or an area never carries them. */
const routes = () => import('./routes');
/** How the providers' addresses read (address-parts.ts), loaded with the first search that needs it: any of Azure's or Google's, another's that asks for parts or countries (an address field's). */
const reader = () => import('./address-parts');
const partsReader = (parts?: boolean, countries?: string[]) => (parts || countries?.length ? reader() : undefined);

export interface MapProvider {
  readonly id: string;
  /** The map images of a kind, or null when the provider has none of it. */
  tiles(kind: BaseMap, locale: Locale): Promise<TileSpec | null>;
  /** What must be credited under the map, for what is in view: its images', and its traffic's while that is drawn. */
  credits(kind: BaseMap | 'traffic', view: MapView, locale: Locale): Promise<Credit[]>;
  /** Live traffic, drawn over its map images of a kind; a provider with none has no Traffic button. */
  traffic?(kind: BaseMap, locale: Locale): Promise<TileSpec | null>;
  /** The provider's mark, which its terms ask for in the map's corner. */
  readonly logo?: { text: string; image?: string; href?: string };
  readonly search?: AddressSearch;
  readonly reverse?: ReverseSearch;
  /** Whether its terms allow a search for each pause in typing; otherwise it searches when Enter is pressed. */
  readonly searchAsYouType?: boolean;
  /** Free for trying things out, not for an app in use: a warning says so once. */
  readonly demoOnly?: boolean;
  /** What its terms ask to be said under its suggestions where no map of its own shows them; its mark (`logo`) says it for Google and Mapbox. */
  readonly searchCredit?: Credit;
  /** A route along the roads, for a map's routes. */
  readonly route?: RouteFinder;
  /** The area within some minutes of a place, for a map's reachable area. */
  readonly reach?: ReachFinder;
}

const query = (params: Record<string, string | number | undefined>) =>
  Object.entries(params)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
    .join('&');

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', copy: '©', reg: '®' };
/** A credit a provider sends as HTML (Azure's are links), as the words a reader sees: never put on the page as HTML. */
const textOfHtml = (html: string) =>
  html
    .replace(/<[^>]*>/g, '')
    .replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (all, name: string) =>
      name[0] === '#' ? String.fromCodePoint(parseInt(name.slice(name[1] === 'x' || name[1] === 'X' ? 2 : 1), name[1] === 'x' || name[1] === 'X' ? 16 : 10)) : (ENTITIES[name.toLowerCase()] ?? all)
    )
    .trim();

/** Places from a GeoJSON FeatureCollection: each named by the first of `labels` it has, with the line under it from `detail`, and its parts from `parts`. */
function placesFrom(collection: unknown, labels: string[][], detail?: (properties: unknown) => string, parts?: (properties: unknown) => AddressParts | undefined): PlaceFound[] {
  const features = pathOf(collection, 'features');
  if (!Array.isArray(features)) return [];
  return features.flatMap((feature) => {
    const [lng, lat] = (pathOf(feature, 'geometry', 'coordinates') as number[] | undefined) ?? [];
    const label = labels.map((path) => pathOf(feature, ...path)).find((text) => typeof text === 'string' && text.trim());
    if (typeof lat !== 'number' || typeof lng !== 'number' || typeof label !== 'string') return [];
    const under = detail?.(pathOf(feature, 'properties'));
    const found = parts?.(pathOf(feature, 'properties'));
    return [{ label, ...(under && under !== label ? { detail: under } : {}), lat, lng, ...(found ? { parts: found } : {}) }];
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
  /**
   * OSRM's address, for routes: its public demo server unless said, which
   * routes by car alone and is for trying things out. A copy the app runs
   * routes by the profiles it was built with (`driving`, `cycling`, `walking`).
   */
  osrmUrl?: string;
  fetch?: Fetch;
}

/** Languages Photon names places in; in any other it gives the places' own names. */
const PHOTON_LANGUAGES = new Set(['en', 'de', 'fr']);

/** Photon's places: each one's name (or its street and number) on one line, where it is on the next; their parts when asked. */
function photonPlaces(found: unknown, locale: Locale, parts?: (properties: unknown) => AddressParts | undefined): PlaceFound[] {
  const features = pathOf(found, 'features');
  if (!Array.isArray(features)) return [];
  return features.flatMap((feature) => {
    const [lng, lat] = (pathOf(feature, 'geometry', 'coordinates') as number[] | undefined) ?? [];
    const p = pathOf(feature, 'properties');
    const name = pathOf(p, 'name');
    const label = typeof name === 'string' && name.trim() ? name.trim() : streetOf(p);
    if (typeof lat !== 'number' || typeof lng !== 'number' || !label) return [];
    // Under a named place, its street when it has one; then its district, city and country.
    const detail = addressLine([label === streetOf(p) ? '' : streetOf(p), pathOf(p, 'district'), pathOf(p, 'city'), pathOf(p, 'state'), pathOf(p, 'country')], locale);
    const own = parts?.(p);
    return [{ label, ...(detail ? { detail } : {}), lat, lng, ...(own ? { parts: own } : {}) }];
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
  const osrm = (options.osrmUrl ?? 'https://router.project-osrm.org').replace(/\/$/, '');
  const base = {
    id: 'openstreetmap',
    demoOnly: true,
    searchCredit: { text: '© OpenStreetMap contributors', href: 'https://www.openstreetmap.org/copyright' },
    async route(request: RouteRequest): Promise<RouteFound> {
      return (await routes()).osrmRoute(fetchWith, osrm, request);
    },
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
      async search({ text, locale, signal, countries, parts }) {
        const read = await partsReader(parts, countries);
        const found = await getJson(
          fetchWith,
          `https://nominatim.openstreetmap.org/search?${query({ format: 'jsonv2', limit: 5, q: text, 'accept-language': locale, countrycodes: read?.knownCountries(countries).join(',').toLowerCase() || undefined, addressdetails: parts ? 1 : undefined })}`,
          { signal }
        );
        return Array.isArray(found)
          ? found.flatMap((place) => {
              const lat = Number(pathOf(place, 'lat'));
              const lng = Number(pathOf(place, 'lon'));
              const whole = pathOf(place, 'display_name');
              if (!Number.isFinite(lat) || !Number.isFinite(lng) || typeof whole !== 'string') return [];
              const name = pathOf(place, 'name');
              const label = typeof name === 'string' && name.trim() ? name : whole.split(',')[0];
              const rest = whole.split(',').map((part) => part.trim()).filter((part, i) => !(i === 0 && part === label));
              const own = read?.nominatimParts(pathOf(place, 'address'));
              const detail = addressLine(rest, locale);
              return [{ label, ...(detail ? { detail } : {}), lat, lng, ...(own ? { parts: own } : {}) }];
            })
          : [];
      },
      async reverse({ lat, lng, locale, signal }) {
        const found = await getJson(fetchWith, `https://nominatim.openstreetmap.org/reverse?${query({ format: 'jsonv2', lat, lon: lng, 'accept-language': locale })}`, { signal });
        return addressLine([pathOf(found, 'display_name')], locale) || null;
      },
    };
  }
  const lang = (locale: Locale) => (PHOTON_LANGUAGES.has(locale) ? locale : undefined);
  return {
    ...base,
    searchAsYouType: true,
    async search({ text, near, zoom, locale, signal, countries, parts }) {
      const found = await getJson(fetchWith, `${photon}/api?${query({ q: text, limit: 6, lang: lang(locale), lat: near?.lat, lon: near?.lng, zoom: near && zoom !== undefined ? Math.round(zoom) : undefined })}`, { signal });
      // Photon cannot be asked to keep to some countries: those outside them are left out here.
      const read = await partsReader(parts, countries);
      return read ? read.inCountries(photonPlaces(found, locale, read.photonParts), read.knownCountries(countries)) : photonPlaces(found, locale);
    },
    async reverse({ lat, lng, locale, signal }) {
      const found = await getJson(fetchWith, `${photon}/reverse?${query({ lat, lon: lng, limit: 1, lang: lang(locale) })}`, { signal });
      const [place] = photonPlaces(found, locale);
      return place ? addressLine([place.label, place.detail], locale) : null;
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
const AZURE_TILESET: Record<BaseMap | 'traffic', string> = { road: 'microsoft.base.road', dark: 'microsoft.base.darkgrey', satellite: 'microsoft.imagery', traffic: 'microsoft.traffic.relative.main' };

/** Microsoft Azure Maps: road, dark and satellite map images, live traffic, credits for the view, and address search. */
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
  const tile = (tileset: string, locale: Locale) =>
    `https://atlas.microsoft.com/map/tile?api-version=2024-04-01&tilesetId=${tileset}&zoom={z}&x={x}&y={y}&tileSize=256&language=${AZURE_LANGUAGE[locale]}&view=Auto${auth}`;
  return {
    id: 'azure-maps',
    searchAsYouType: true,
    async tiles(kind, locale) {
      return { url: tile(AZURE_TILESET[kind], locale), maxZoom: kind === 'satellite' ? 19 : 22, ...(options.key ? {} : { headers }) };
    },
    // How each road flows against its free flow, in its own colours over the dark map; zooms 6 to 21 (it answers none outside them), out of date in four minutes (its cache-control's max-age).
    async traffic(kind, locale) {
      return { url: tile(kind === 'dark' ? 'microsoft.traffic.relative.dark' : AZURE_TILESET.traffic, locale), minZoom: 6, maxZoom: 21, fresh: 240, ...(options.key ? {} : { headers }) };
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
    async search(request) {
      const read = await reader();
      const { text, locale, signal } = request;
      // Its autocomplete reads a word half typed, as geocoding does not; its suggestions carry no place, so a picked one is geocoded then, by its own town and region, not by where the map is.
      const found = await read.azureSearch((params) => ask('geocode:autocomplete', { 'api-version': '2026-01-01', top: 5, query: text, ...params }, locale, signal), request);
      return found.map(({ country, address, ...place }) => ({
        ...place,
        locate: () => read.azureLocate((params) => ask('geocode', { 'api-version': '2026-01-01', ...params }, locale), { ...place, country, address }, locale),
      }));
    },
    async reverse({ lat, lng, locale, signal }) {
      const found = await ask('reverseGeocode', { 'api-version': '2026-01-01', coordinates: `${lng},${lat}` }, locale, signal);
      return (await reader()).azureNamed(found, locale) || null;
    },
    async route(request) {
      return (await routes()).azureRoute({ fetchWith, auth, headers }, request);
    },
    async reach(request) {
      return (await routes()).azureReach({ fetchWith, auth, headers }, request);
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

const GOOGLE_MAP_TYPE: Partial<Record<BaseMap | 'traffic', string>> = { road: 'roadmap', satellite: 'satellite', traffic: 'roadmap' };

/**
 * Google's map images through its Map Tiles API (a session for each kind and
 * language, credits for the view, Google's mark in the corner its terms
 * name; its traffic, a layer of its own over them), its Places API's
 * suggestions as people type, and its Geocoding API
 * to name a point. The key needs those three APIs enabled, and should be
 * restricted to the app's sites.
 */
export function googleMaps(options: GoogleMapsOptions): MapProvider {
  const fetchWith = options.fetch ?? ((...args: Parameters<Fetch>) => globalThis.fetch(...args));
  const key = encodeURIComponent(options.key);
  const sessions = new Map<string, Promise<{ session: string; expiry: number }>>();
  function session(kind: BaseMap | 'traffic', locale: Locale) {
    const mapType = GOOGLE_MAP_TYPE[kind]!;
    const id = `${kind}:${locale}`;
    const known = sessions.get(id);
    return known ?? open();
    function open() {
      const opening = getJson(fetchWith, `https://tile.googleapis.com/v1/createSession?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Traffic alone, without the map under it: an overlay.
        body: JSON.stringify({ mapType, language: locale, region: options.region ?? 'US', ...(kind === 'traffic' ? { layerTypes: ['layerTraffic'], overlay: true } : {}) }),
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
  /**
   * One session token from the first letter typed to the place picked, a new
   * one after it. A session ended by Place Details Essentials (Fieldia's
   * fields) bills its first 12 suggestion requests (Autocomplete Requests)
   * and the details; one never picked bills each request alike. Its token
   * goes with its first Place Details alone: Google bills a token used again
   * as no session, so another of its places is located without one.
   */
  let searching: { token: string; located: boolean } | undefined;
  const newSession = () => (globalThis.crypto?.randomUUID?.() ?? 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => ((Math.random() * 16) | (c === 'x' ? 0 : 8)).toString(16).slice(0, 1)));
  async function tilesOf(kind: BaseMap | 'traffic', locale: Locale): Promise<TileSpec | null> {
    if (!GOOGLE_MAP_TYPE[kind]) return null;
    const { session: id } = await session(kind, locale);
    return { url: `https://tile.googleapis.com/v1/2dtiles/{z}/{x}/{y}?session=${id}&key=${key}`, maxZoom: 22 };
  }
  /** How far "near" reaches at a zoom: about what the map shows, within Google's bounds. */
  const radiusAt = (zoom: number | undefined) => Math.round(Math.min(50_000, Math.max(100, 40_075_016 / 2 ** (zoom ?? 12))));
  return {
    id: 'google',
    logo: { text: 'Google Maps', ...(options.logo ? { image: options.logo } : {}) },
    searchAsYouType: true,
    async search(request) {
      const { text, near, zoom, locale, signal } = request;
      const read = await reader();
      const session = (searching ??= { token: newSession(), located: false });
      const { token } = session;
      const regions = read.googleRegions(request.countries);
      const answer = await getJson(fetchWith, 'https://places.googleapis.com/v1/places:autocomplete', {
        method: 'POST',
        signal,
        headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': options.key },
        body: JSON.stringify({
          input: text,
          languageCode: locale,
          ...(options.region ? { regionCode: options.region } : {}),
          ...(regions.length ? { includedRegionCodes: regions } : {}),
          sessionToken: token,
          ...(near ? { locationBias: { circle: { center: { latitude: near.lat, longitude: near.lng }, radius: radiusAt(zoom) } } } : {}),
        }),
      });
      // Picked, or located: the session is over, the next letter typed opens another.
      const end = () => {
        if (searching === session) searching = undefined;
      };
      return read.googlePlaces(
        answer,
        request,
        (placeId) => {
          const ending = !session.located;
          session.located = true;
          return getJson(fetchWith, `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?${query({ languageCode: locale, sessionToken: ending ? token : undefined })}`, {
            // Place Details Essentials, all three fields its SKU's: its parts name the country its line is written with, for a page that keeps no parts too. Its name is Pro's, and the suggestion gives it.
            headers: { 'X-Goog-Api-Key': options.key, 'X-Goog-FieldMask': 'location,formattedAddress,addressComponents' },
          });
        },
        end
      );
    },
    async reverse({ lat, lng, locale, signal }) {
      const answer = await getJson(fetchWith, `https://maps.googleapis.com/maps/api/geocode/json?${query({ latlng: `${lat},${lng}`, language: locale, key: options.key })}`, { signal });
      // The Geocoding API refuses inside a 200: its status says so, and its message why.
      const status = pathOf(answer, 'status');
      if (typeof status === 'string' && status !== 'OK' && status !== 'ZERO_RESULTS') throw new Error(`Google's Geocoding API answered ${status}: ${String(pathOf(answer, 'error_message') ?? '')}`);
      const results = pathOf(answer, 'results');
      const named = Array.isArray(results) ? addressLine([pathOf(results[0], 'formatted_address')], locale) : '';
      return named || null;
    },
    async route(request) {
      return (await routes()).googleRoute({ fetchWith, key: options.key }, request);
    },
    tiles: (kind, locale) => tilesOf(kind, locale),
    traffic: (_kind, locale) => tilesOf('traffic', locale),
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
  /**
   * A style of the app's own that draws Mapbox Traffic's lines and nothing
   * else (no background), for the Traffic button: Mapbox's traffic is a
   * vector tileset its styles draw, and it has no such style of its own.
   * Without one, no Traffic button.
   */
  trafficStyle?: string;
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
  const styleTiles = (style: string): TileSpec => ({ url: `https://api.mapbox.com/styles/v1/${style}/tiles/512/{z}/{x}/{y}@2x?access_token=${token}`, maxZoom: 22, tileSize: 512, zoomOffset: -1 });
  const traffic = options.trafficStyle;
  const permanent = options.permanent ?? true;
  const ask = async (path: string, params: Record<string, string | number | undefined>, signal?: AbortSignal) =>
    getJson(fetchWith, `https://api.mapbox.com/search/geocode/v6/${path}?${query({ ...params, permanent: String(permanent) })}&access_token=${token}`, { signal });
  return {
    id: 'mapbox',
    searchAsYouType: true,
    logo: { text: 'mapbox', ...(options.logo ? { image: options.logo } : {}), href: 'https://www.mapbox.com/' },
    async tiles(kind) {
      return styleTiles(styles[kind]);
    },
    ...(traffic ? { traffic: async () => styleTiles(traffic) } : {}),
    async credits() {
      return [
        { text: '© Mapbox', href: 'https://www.mapbox.com/about/maps/' },
        { text: '© OpenStreetMap', href: 'https://www.openstreetmap.org/copyright' },
        { text: 'Improve this map', href: 'https://www.mapbox.com/map-feedback/' },
      ];
    },
    async search({ text, near, locale, signal, countries, parts }) {
      const read = await partsReader(parts, countries);
      return placesFrom(
        await ask('forward', { q: text, limit: 5, language: locale, proximity: near ? `${near.lng},${near.lat}` : undefined, country: read?.knownCountries(countries).join(',').toLowerCase() || undefined }, signal),
        [['properties', 'name'], ['properties', 'full_address']],
        (p) => addressLine([pathOf(p, 'place_formatted')], locale),
        parts ? read?.mapboxParts : undefined
      );
    },
    async reverse({ lat, lng, locale, signal }) {
      const [named] = placesFrom(await ask('reverse', { longitude: lng, latitude: lat, language: locale, limit: 1 }, signal), [['properties', 'full_address'], ['properties', 'name']]);
      return named ? addressLine([named.label], locale) : null;
    },
    async route(request) {
      return (await routes()).mapboxRoute({ fetchWith, token }, request);
    },
    async reach(request) {
      return (await routes()).mapboxReach({ fetchWith, token }, request);
    },
  };
}

// ---------------------------------------------------------------------------

export interface TilesOptions {
  /** With `{z}`, `{x}` and `{y}`: the app's own map images, or any provider's. */
  url: string;
  darkUrl?: string;
  satelliteUrl?: string;
  /** The app's own live traffic, drawn over the map: with it, a Traffic button. */
  trafficUrl?: string;
  credit: Credit | Credit[];
  maxZoom?: number;
  tileSize?: number;
  zoomOffset?: number;
  search?: AddressSearch;
  reverse?: ReverseSearch;
  searchAsYouType?: boolean;
  /** The app's own routes. */
  route?: RouteFinder;
  /** The app's own reachable areas. */
  reach?: ReachFinder;
}

/** Map images from any address, such as the app's own server, with their credit. */
export function tiles(options: TilesOptions): MapProvider {
  const urls: Record<BaseMap, string | undefined> = { road: options.url, dark: options.darkUrl, satellite: options.satelliteUrl };
  const credits = Array.isArray(options.credit) ? options.credit : [options.credit];
  const spec = (url: string): TileSpec => ({ url, maxZoom: options.maxZoom ?? 19, ...(options.tileSize ? { tileSize: options.tileSize } : {}), ...(options.zoomOffset ? { zoomOffset: options.zoomOffset } : {}) });
  const traffic = options.trafficUrl;
  return {
    id: 'tiles',
    search: options.search,
    reverse: options.reverse,
    route: options.route,
    reach: options.reach,
    searchAsYouType: options.searchAsYouType ?? !!options.search,
    async tiles(kind) {
      const url = urls[kind];
      return url ? spec(url) : null;
    },
    ...(traffic ? { traffic: async () => spec(traffic) } : {}),
    async credits() {
      return credits;
    },
  };
}
