import { tableInChunks, wordsInChunks, type Locale } from '@fieldia/core';

/** Where each language's words in a chunk of its own keep each table's: the maps', a list's map's, a form's map's, an address field's. */
type Kept = 'map' | 'listMap' | 'formMap' | 'address';

/**
 * A table of the maps' words with every language but English — Arabic, German and French (0.35), and Turkish, Persian,
 * Urdu and Spanish, UNREVIEWED: machine-assisted, not yet reviewed by a native speaker (locales/) — each in a chunk of its
 * own, fetched where it is spoken (`wordsReady` in @fieldia/core), English till it came: a map in any other language
 * never carries them. Called as a pure one, so a bundle that never
 * reads the table (a place and an area alone: no list's map's words) keeps neither it nor its chunks' loader.
 */
export function inChunks<T extends object>(table: Record<string, T>, kept: Kept): Record<Locale, T> {
  wordsInChunks(
    tableInChunks(table, {
      ar: () => import('./locales/ar').then((words) => words[kept] as unknown as T),
      de: () => import('./locales/de').then((words) => words[kept] as unknown as T),
      fr: () => import('./locales/fr').then((words) => words[kept] as unknown as T),
      tr: () => import('./locales/tr').then((words) => words[kept] as unknown as T),
      fa: () => import('./locales/fa').then((words) => words[kept] as unknown as T),
      ur: () => import('./locales/ur').then((words) => words[kept] as unknown as T),
      es: () => import('./locales/es').then((words) => words[kept] as unknown as T),
    })
  );
  return table as Record<Locale, T>;
}

/** The words the maps show themselves. `{label}`, `{n}` are filled in where they stand. */
export interface MapLabels {
  /** The map's name for assistive technology: the field's label and "map". */
  mapOf: string;
  mapKeys: string;
  placeKeys: string;
  zoomIn: string;
  zoomOut: string;
  search: string;
  searching: string;
  noResults: string;
  searchFailed: string;
  myLocation: string;
  locating: string;
  locationBlocked: string;
  locationFailed: string;
  /** Said when the reader's location is rough, as a desktop's often is: `{distance}` is how rough. */
  locatedWithin: string;
  kilometres: string;
  metres: string;
  clear: string;
  latitude: string;
  longitude: string;
  notACoordinate: string;
  /** A coordinate typed that is no number in its range, or left out beside the other: `{label}`, `{min}` and `{max}`. */
  coordinateRange: string;
  polygon: string;
  box: string;
  circle: string;
  drawPolygon: string;
  drawBox: string;
  drawCircle: string;
  points: string;
  finish: string;
  cancel: string;
  chooseArea: string;
  shapeDrawn: string;
  shapeCleared: string;
  ctrlZoom: string;
  cmdZoom: string;
  twoFingers: string;
  point: string;
  centre: string;
  edge: string;
  gripKeys: string;
  drawKeys: string;
  addPoint: string;
  placeKind: string;
  areaKind: string;
  mapsGroup: string;
  settingMyLocation: string;
  settingSearch: string;
  settingHeight: string;
  heightSmall: string;
  heightMedium: string;
  heightLarge: string;
  settingShapes: string;
  /** The designer's setting naming the field a place's address is written into. */
  settingAddress: string;
  settingNowhere: string;
  /** The tools under the zoom. */
  satellite: string;
  traffic: string;
  fullScreen: string;
  leaveFullScreen: string;
  measure: string;
  measureHint: string;
  /** A way measured: `{distance}` its length. */
  measured: string;
  /** An area of a map's shaded areas, with its number. */
  areaValue: string;
  /** The legend's step for areas with nothing to shade them. */
  areasNone: string;
}

export const MAP_LABELS = /* @__PURE__ */ inChunks<MapLabels>({
  en: {
    mapOf: '{label}, map',
    mapKeys: 'Arrow keys move the map. Plus and minus zoom.',
    placeKeys: 'Press Enter to put the place at the centre of the map.',
    zoomIn: 'Zoom in',
    zoomOut: 'Zoom out',
    search: 'Search for an address',
    searching: 'Searching…',
    noResults: 'No address found',
    searchFailed: 'The search did not answer. Try again.',
    myLocation: 'My location',
    locating: 'Finding your location…',
    locationBlocked: 'This site may not ask for your location.',
    locationFailed: 'Your location could not be found.',
    locatedWithin: 'Placed within about {distance} of where you are. Drag the pin to the right spot.',
    kilometres: '{n} km',
    metres: '{n} m',
    clear: 'Clear',
    latitude: 'Latitude',
    longitude: 'Longitude',
    notACoordinate: 'Not a coordinate',
    coordinateRange: '{label}: a number from {min} to {max}',
    polygon: 'Polygon',
    box: 'Box',
    circle: 'Circle',
    drawPolygon: 'Click to add points. Click the first point, double-click or press Enter to finish.',
    drawBox: 'Drag across the map to draw a box.',
    drawCircle: 'Drag from the centre to draw a circle.',
    points: '{n} points',
    finish: 'Finish',
    cancel: 'Cancel',
    chooseArea: 'Choose an area',
    shapeDrawn: 'Area drawn.',
    shapeCleared: 'Area cleared.',
    ctrlZoom: 'Use Ctrl + scroll to zoom the map',
    cmdZoom: 'Use ⌘ + scroll to zoom the map',
    twoFingers: 'Use two fingers to move the map',
    point: 'Point {n}',
    centre: 'Centre',
    edge: 'Edge',
    gripKeys: 'Arrow keys move it.',
    drawKeys: 'With the keyboard: Space puts a point at the centre of the map, Enter finishes, Backspace takes the last point back, Escape stops.',
    addPoint: 'Drag to add a point here',
    placeKind: 'Place',
    areaKind: 'Area',
    mapsGroup: 'Maps',
    settingMyLocation: '“My location” button',
    settingSearch: 'Address search',
    settingHeight: 'Map height',
    heightSmall: 'Small',
    heightMedium: 'Medium',
    heightLarge: 'Large',
    settingShapes: 'Shapes',
    settingAddress: 'Address goes into',
    settingNowhere: 'Nowhere',
    satellite: 'Satellite',
    traffic: 'Traffic',
    fullScreen: 'Full screen',
    leaveFullScreen: 'Leave full screen',
    measure: 'Measure a distance',
    measureHint: 'Click points along the way; double-click or press Enter to finish. Escape clears.',
    measured: 'The way measures {distance}.',
    areaValue: '{name}: {value}',
    areasNone: 'None',
  },
}, 'map');

/** The words a list's map shows, besides the maps' own: kept apart, so a form with only a place or an area never carries them. */
export interface ListMapLabels {
  /** How the keys reach the pins. */
  pinKeys: string;
  searchThisArea: string;
  /** "Search this area" with how many records the view holds, when that is known: `{label}` the button's words, `{n}` the count. */
  searchThisAreaCount: string;
  /** The search a map puts in the list's search bar. */
  inThisArea: string;
  openRecord: string;
  choose: string;
  closeCard: string;
  /** A bubble of pins: `{n}` how many. */
  cluster: string;
  /** The legend's word for a bubble, beside a round mark with a number: what it counts, and how to part it. */
  legendBubble: string;
  /** Pins on one spot, listed. */
  crowd: string;
  /** More on one spot than its card lists (a data source's bubble): `{n}` how many more. */
  crowdMore: string;
  notOnMap: string;
  /** More records than a map shows: `{n}` shown of `{total}`. */
  mapShowsFirst: string;
  mapFailed: string;
  /** The same, in the words the list's page names its records by (`Page.records`): `{records}`. */
  mapFailedNoun?: string;
  /** The tools that draw an area on a list's map, and the search the area becomes. */
  drawArea: string;
  inDrawnArea: string;
  /** A search for one shaded area's records: `{name}` the area. */
  inRegion: string;
  /** The tool that puts the records nearest the reader first. */
  nearestFirst: string;
  /** Said when the reader's place was not given: the records nearest the map's middle come first instead. */
  nearestFromMiddle: string;
  /** Said under a heat map. */
  heatNote: string;
}

export const LIST_MAP_LABELS = /* @__PURE__ */ inChunks<ListMapLabels>({
  en: {
    pinKeys: 'Tab goes through the pins. Enter opens a pin’s card; Escape closes it.',
    searchThisArea: 'Search this area',
    searchThisAreaCount: '{label} ({n})',
    inThisArea: 'In this area',
    openRecord: 'Open',
    choose: 'Choose',
    closeCard: 'Close',
    cluster: '{n} here. Zoom in to see them.',
    legendBubble: 'How many are close together: zoom in to part them',
    crowd: '{n} in one place',
    crowdMore: 'And {n} more here',
    notOnMap: '{n} without a place, not on the map',
    mapShowsFirst: 'The map shows {n} of {total}. Zoom in and search this area for the rest.',
    mapFailed: 'The map could not load the records.',
    mapFailedNoun: 'The map could not load the {records}.',
    drawArea: 'Draw an area to search in',
    inDrawnArea: 'In the area drawn',
    inRegion: 'In {name}',
    nearestFirst: 'Nearest first',
    nearestFromMiddle: 'Nearest the middle of the map first: your place was not given.',
    heatNote: 'A heat map from afar: zoom in to the streets to see each one.',
  },
}, 'listMap');

/** The words a form's map shows, besides the maps' own and a list map's: kept apart, as theirs are. */
export interface FormMapLabels {
  /** A map's name when its page gives none. */
  map: string;
  /** A place whose news is old: `{time}` is how long ago, in the page's language ("3 minutes ago"). */
  lastSeen: string;
  /** Back to following a place that moves, after the person moved the map away. */
  follow: string;
  routeFailed: string;
  /** Pins gathered: `{n}` how many, `{names}` whose ("2 here: Kitchen, Courier"). */
  crowdHere: string;
}

export const FORM_MAP_LABELS = /* @__PURE__ */ inChunks<FormMapLabels>({
  en: { map: 'Map', lastSeen: 'Last seen {time}', follow: 'Follow', routeFailed: 'The way could not be found.', crowdHere: '{n} here: {names}. Zoom in to see them.' },
}, 'formMap');

/** The words for a page's language, with the app's own over them. */
export function mapLabels(locale: Locale | undefined, own?: Partial<MapLabels>): MapLabels {
  return { ...(MAP_LABELS[locale ?? 'en'] ?? MAP_LABELS.en), ...own };
}

/** A list's map's words for a page's language, the maps' own with them, and the app's own over both. */
export function listMapLabels(locale: Locale | undefined, own?: Partial<MapLabels & ListMapLabels>): MapLabels & ListMapLabels {
  const words = { ...(MAP_LABELS[locale ?? 'en'] ?? MAP_LABELS.en), ...(LIST_MAP_LABELS[locale ?? 'en'] ?? LIST_MAP_LABELS.en), ...own };
  // The app's own sentence, given without its sentence for a page's records: its own on that page too.
  if (own && 'mapFailed' in own && !('mapFailedNoun' in own)) delete words.mapFailedNoun;
  return words;
}

/** A word with its `{name}`s filled in. */
export const fill = (words: string, values: Record<string, string | number>) =>
  words.replace(/\{(\w+)\}/g, (all, key: string) => (key in values ? String(values[key]) : all));

/** A form's map's words for a page's language: the maps' own, a list map's (its pins and cards), its own, the app's over all. */
export function formMapLabels(locale: Locale | undefined, own?: Partial<MapLabels & ListMapLabels & FormMapLabels>): MapLabels & ListMapLabels & FormMapLabels {
  return { ...(MAP_LABELS[locale ?? 'en'] ?? MAP_LABELS.en), ...(LIST_MAP_LABELS[locale ?? 'en'] ?? LIST_MAP_LABELS.en), ...(FORM_MAP_LABELS[locale ?? 'en'] ?? FORM_MAP_LABELS.en), ...own };
}
