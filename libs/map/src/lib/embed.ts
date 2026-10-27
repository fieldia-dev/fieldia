import { checkPage, localizePage, withDeadlines, wordsComing, wordsReady, type DataSource, type ListResult, type Locale, type Page, type RecordId, type ResolvedFilter, type SortOrder } from '@fieldia/core';
import type { ListViewPart } from '@fieldia/viewer';
import type { IconSet } from '@fieldia/widgets';
import type { LatLng } from './geo';
import type { MapSearch, MapViewChange } from './list-view';
import { loadLeaflet } from './leaflet';
import { mapViewPart } from './map-parts';
import type { MapRecord } from './pins';
import type { MapSettings } from './settings';

/**
 * A list's map in a page of the app's own, outside the viewer: the page's
 * own list, filters and address beside it, the map drawn by Fieldia. The
 * app gives the page that describes the records (a list with `map`), where
 * the records come from, the search they were found by, and what to do when
 * the map asks for something; it gets the map back, to reload and destroy.
 * The map brings its own base (its buttons, a part hidden, words for a
 * screen reader) on its own element, and Fieldia's colours as tokens the
 * page can set: none of it reaches the page round it.
 *
 *     const map = mountListMap(element, {
 *       page,                                   // a list page with "map"
 *       provider: azureMaps({ key }),
 *       dataSource,                             // or records: [...]
 *       filter: () => searchNow(),              // the conditions the records are found by
 *       start: { center: { lat: 30.05, lng: 31.23 }, zoom: 12 },  // from the address, say
 *       onSearch: ({ kind, filter }) => { keep(kind, filter); map.reload(); },
 *       onViewChange: ({ center, zoom }) => history.replaceState(null, '', `?at=${center.lat},${center.lng},${zoom}`),
 *       onOpenRecord: (id) => location.assign(`/homes/${id}`),
 *       onHighlight: (id) => lightRow(id),
 *     });
 */
export interface ListMapOptions extends MapSettings {
  /** The page that describes the records: their fields, and a list with `map` (where each is, its pin, its card, its height, its gestures). */
  page: Page;
  /** Where the records come from: a source with `list`, asked with the search, the list's order and the map's `limit`. */
  dataSource?: DataSource;
  /** Or the records themselves, found already: each `{ id, values }`, or a function giving them, asked again at each `reload()`. */
  records?: readonly MapRecord[] | (() => readonly MapRecord[] | Promise<readonly MapRecord[]>);
  /** The language: a tag such as `ar-EG`; Fieldia's words in English, Arabic, French or German, and the page's own `translations`. The document's language unless said. */
  locale?: string;
  /**
   * The conditions the records are found by now, as a search bar's are: the
   * map asks its source with them, draws the areas among them, and counts
   * a view within them. A search the map asked for is among them once the app
   * has taken it.
   */
  filter?: readonly ResolvedFilter[] | (() => readonly ResolvedFilter[]);
  /** The order the records come in: the map shows the same first ones as the page's own list. */
  sort?: readonly SortOrder[] | (() => readonly SortOrder[]);
  /** Where the map opens, from the page's address, say: there it fits no records at first, until the search changes. */
  start?: { center: LatLng; zoom: number };
  /** The app's icons for the pins, besides Fieldia's and the map's own. */
  icons?: IconSet;
  /** The page's buttons for one record, offered on its card: "Book a viewing". */
  actions?: { id: string; label: string; style?: 'primary' | 'secondary' | 'danger' | 'link' }[];
  /** A card's Open: the card has the button when this is given. */
  onOpenRecord?: (id: RecordId) => void;
  /** A pin under the pointer or the focus (null when none): light the record in the page's own list. */
  onHighlight?: (id: RecordId | null) => void;
  /**
   * The map asks for a search: its view (`kind: 'view'`, "Search this area"),
   * an area drawn (`drawn`), or a shaded area pressed (`region`). The app
   * keeps one of each kind, a new one in the last one's place, as a search bar
   * does, puts its conditions in `filter`, and calls `reload()`. Without it the
   * map offers no search: no "Search this area", no tools to draw an area.
   */
  onSearch?: (search: MapSearch) => void;
  /** The map has stopped, after a move or a zoom: where it stands, to keep in the page's address. Each view once. */
  onViewChange?: (view: MapViewChange) => void;
  /** Whether a record is chosen, and a choice made on its card; the map keeps its own choice when these are not given. */
  isChosen?: (id: RecordId) => boolean;
  onChoose?: (id: RecordId, chosen: boolean) => void;
  /** One of `actions` pressed on a record's card: the button is busy until it is done. */
  onAction?: (id: string, ids: RecordId[]) => void | Promise<void>;
  /** "Nearest first" pressed: the order the page's own list should take too (null: its own again). */
  onSort?: (order: SortOrder[] | null) => void;
}

/** A list's map in a page: its element (already in the page), and what the page asks of it. */
export type ListMapHandle = ListViewPart;

const OWN: readonly Locale[] = ['en', 'ar', 'fr', 'de', 'tr', 'fa', 'ur', 'es'];

/** Puts a list's map into `host`, loads its records, and hands it back. Throws when the page cannot be shown, saying why. */
export function mountListMap(host: HTMLElement, options: ListMapOptions): ListMapHandle {
  const tag = options.locale ?? (host.ownerDocument.documentElement.lang || options.page.language || 'en');
  const code = mapViewPart.loaded;
  if (!wordsComing(tag) && code) return drawListMap(host, options, code);
  // Its code (`mapViewPart`, with Leaflet asked for beside it) and its language's words (every language but English) come
  // in chunks of their own: drawn once they have, so its first paint is in them. A page that cannot be shown says so at
  // once, as ever.
  const checked = checkPage(options.page);
  if (!checked.ok) throw new Error(`This page cannot be shown:\n${checked.issues.map((i) => `  ${i.path}: ${i.message}`).join('\n')}`);
  if (host.ownerDocument.defaultView) void loadLeaflet().catch(() => undefined);
  let part: ListMapHandle | null = null;
  let gone = false;
  // Its own words too, which come with its code (labels.ts): asked for as it came.
  const ready = Promise.all([wordsReady(tag), mapViewPart.load()]).then(async ([, loaded]) => {
    await wordsReady(tag);
    if (!gone) part = drawListMap(host, options, loaded);
  });
  return {
    get element() {
      return part?.element ?? host;
    },
    reload: () => ready.then(() => part?.reload()),
    highlight: (id) => part?.highlight(id),
    chosenChanged: () => part?.chosenChanged(),
    shown: () => void ready.then(() => part?.shown()),
    destroy() {
      gone = true;
      part?.destroy();
    },
  };
}

function drawListMap(host: HTMLElement, options: ListMapOptions, { listMap, installEmbedStyles }: NonNullable<typeof mapViewPart.loaded>): ListMapHandle {
  const doc = host.ownerDocument;
  const checked = checkPage(options.page);
  if (!checked.ok) throw new Error(`This page cannot be shown:\n${checked.issues.map((i) => `  ${i.path}: ${i.message}`).join('\n')}`);
  const tag = options.locale ?? (doc.documentElement.lang || checked.page.language || 'en');
  const page = localizePage(checked.page, tag);
  const node = page.layout;
  if (node.type !== 'list' || !node.map) throw new Error('mountListMap shows a list page with "map": its layout is a list, and its map says where each record is.');
  const base = tag.split('-')[0].toLowerCase() as Locale;
  const locale = OWN.includes(base) ? base : 'en';
  const read = <T>(given: T | (() => T) | undefined, none: T): T => (typeof given === 'function' ? (given as () => T)() : (given ?? none));
  // The records given, as a source that hands them over as they are: the search found them already.
  const given = options.records;
  const dataSource: DataSource | undefined = given
    ? {
        async list(): Promise<ListResult> {
          const records = [...(await read(given, []))];
          return { records, total: records.length };
        },
      }
    : // Its answers the engine's own promises, the app's handled where they are made (deadline.ts); no deadline (0), as ever.
      withDeadlines(options.dataSource, 0, '');
  const chosen = new Set<RecordId>();
  let order: SortOrder[] | null = null;
  let part: ListViewPart | null = null;

  installEmbedStyles(doc);
  part = listMap(options, {
    page,
    node,
    dataSource,
    document: doc,
    locale,
    ...(options.icons ? { icons: options.icons } : {}),
    ...(options.start ? { start: options.start } : {}),
    given: !!given,
    searches: !!options.onSearch,
    filter: () => [...read(options.filter, [])],
    sort: () => order ?? [...read(options.sort, [])],
    sortBy(next) {
      order = next;
      options.onSort?.(next);
      void part?.reload();
    },
    isChosen: (id) => (options.isChosen ? options.isChosen(id) : chosen.has(id)),
    choose(id, on) {
      if (on) chosen.add(id);
      else chosen.delete(id);
      options.onChoose?.(id, on);
      part?.chosenChanged();
    },
    ...(options.onOpenRecord ? { open: options.onOpenRecord } : {}),
    highlight: (id) => options.onHighlight?.(id),
    addSearch: (search) => options.onSearch?.(search),
    actions: options.actions ?? [],
    async act(id, ids, button) {
      button.setAttribute('aria-busy', 'true');
      try {
        await options.onAction?.(id, ids);
      } finally {
        button.removeAttribute('aria-busy');
      }
    },
  });
  const element = part.element;
  element.classList.add('fd-map-embed');
  const viewChanged = (event: Event) => options.onViewChange?.((event as CustomEvent<MapViewChange>).detail);
  element.addEventListener('fd-map-view', viewChanged);
  host.append(element);
  void part.reload();
  const shown = part;
  return {
    element,
    reload: () => shown.reload(),
    highlight: (id) => shown.highlight(id),
    chosenChanged: () => shown.chosenChanged(),
    shown: () => shown.shown(),
    destroy() {
      element.removeEventListener('fd-map-view', viewChanged);
      shown.destroy();
      element.remove();
    },
  };
}
