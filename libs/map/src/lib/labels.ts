import type { Locale } from '@fieldia/core';

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
  clear: string;
  latitude: string;
  longitude: string;
  notACoordinate: string;
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
  placeKind: string;
  areaKind: string;
  mapsGroup: string;
}

export const MAP_LABELS: Record<Locale, MapLabels> = {
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
    clear: 'Clear',
    latitude: 'Latitude',
    longitude: 'Longitude',
    notACoordinate: 'Not a coordinate',
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
    placeKind: 'Place',
    areaKind: 'Area',
    mapsGroup: 'Maps',
  },
  ar: {
    mapOf: '{label}، خريطة',
    mapKeys: 'تحرّك مفاتيح الأسهم الخريطة، ويكبّرها زر الجمع ويصغّرها زر الطرح.',
    placeKeys: 'اضغط Enter لوضع المكان في وسط الخريطة.',
    zoomIn: 'تكبير',
    zoomOut: 'تصغير',
    search: 'ابحث عن عنوان',
    searching: 'جارٍ البحث…',
    noResults: 'لم يُعثر على عنوان',
    searchFailed: 'لم يُجب البحث. حاول مرة أخرى.',
    myLocation: 'موقعي',
    locating: 'جارٍ تحديد موقعك…',
    locationBlocked: 'لا يُسمح لهذا الموقع بطلب موقعك.',
    locationFailed: 'تعذّر تحديد موقعك.',
    clear: 'مسح',
    latitude: 'خط العرض',
    longitude: 'خط الطول',
    notACoordinate: 'ليس إحداثيًا صحيحًا',
    polygon: 'مضلّع',
    box: 'مستطيل',
    circle: 'دائرة',
    drawPolygon: 'انقر لإضافة نقاط. انقر النقطة الأولى أو انقر مرتين أو اضغط Enter للإنهاء.',
    drawBox: 'اسحب على الخريطة لرسم مستطيل.',
    drawCircle: 'اسحب من المركز لرسم دائرة.',
    points: 'النقاط: {n}',
    finish: 'إنهاء',
    cancel: 'إلغاء',
    chooseArea: 'اختر منطقة',
    shapeDrawn: 'رُسمت المنطقة.',
    shapeCleared: 'مُسحت المنطقة.',
    ctrlZoom: 'استخدم Ctrl مع عجلة الفأرة لتكبير الخريطة',
    cmdZoom: 'استخدم ⌘ مع عجلة الفأرة لتكبير الخريطة',
    twoFingers: 'استخدم إصبعين لتحريك الخريطة',
    point: 'النقطة {n}',
    centre: 'المركز',
    edge: 'الحافة',
    gripKeys: 'تحرّكها مفاتيح الأسهم.',
    placeKind: 'مكان',
    areaKind: 'منطقة',
    mapsGroup: 'الخرائط',
  },
  fr: {
    mapOf: '{label}, carte',
    mapKeys: 'Les flèches déplacent la carte. Plus et moins zooment.',
    placeKeys: 'Entrée place le lieu au centre de la carte.',
    zoomIn: 'Zoom avant',
    zoomOut: 'Zoom arrière',
    search: 'Rechercher une adresse',
    searching: 'Recherche…',
    noResults: 'Aucune adresse trouvée',
    searchFailed: 'La recherche n’a pas répondu. Réessayez.',
    myLocation: 'Ma position',
    locating: 'Recherche de votre position…',
    locationBlocked: 'Ce site ne peut pas demander votre position.',
    locationFailed: 'Votre position est introuvable.',
    clear: 'Effacer',
    latitude: 'Latitude',
    longitude: 'Longitude',
    notACoordinate: 'Coordonnée non valide',
    polygon: 'Polygone',
    box: 'Rectangle',
    circle: 'Cercle',
    drawPolygon: 'Cliquez pour ajouter des points. Cliquez sur le premier point, double-cliquez ou appuyez sur Entrée pour terminer.',
    drawBox: 'Faites glisser sur la carte pour tracer un rectangle.',
    drawCircle: 'Faites glisser depuis le centre pour tracer un cercle.',
    points: '{n} points',
    finish: 'Terminer',
    cancel: 'Annuler',
    chooseArea: 'Choisir une zone',
    shapeDrawn: 'Zone tracée.',
    shapeCleared: 'Zone effacée.',
    ctrlZoom: 'Utilisez Ctrl + molette pour zoomer',
    cmdZoom: 'Utilisez ⌘ + molette pour zoomer',
    twoFingers: 'Utilisez deux doigts pour déplacer la carte',
    point: 'Point {n}',
    centre: 'Centre',
    edge: 'Bord',
    gripKeys: 'Les flèches le déplacent.',
    placeKind: 'Lieu',
    areaKind: 'Zone',
    mapsGroup: 'Cartes',
  },
  de: {
    mapOf: '{label}, Karte',
    mapKeys: 'Pfeiltasten verschieben die Karte, Plus und Minus zoomen.',
    placeKeys: 'Eingabe setzt den Ort in die Kartenmitte.',
    zoomIn: 'Vergrößern',
    zoomOut: 'Verkleinern',
    search: 'Adresse suchen',
    searching: 'Suche läuft …',
    noResults: 'Keine Adresse gefunden',
    searchFailed: 'Die Suche hat nicht geantwortet. Bitte erneut versuchen.',
    myLocation: 'Mein Standort',
    locating: 'Standort wird ermittelt …',
    locationBlocked: 'Diese Seite darf Ihren Standort nicht abfragen.',
    locationFailed: 'Ihr Standort wurde nicht gefunden.',
    clear: 'Leeren',
    latitude: 'Breitengrad',
    longitude: 'Längengrad',
    notACoordinate: 'Keine gültige Koordinate',
    polygon: 'Polygon',
    box: 'Rechteck',
    circle: 'Kreis',
    drawPolygon: 'Klicken, um Punkte zu setzen. Ersten Punkt klicken, doppelklicken oder Eingabe drücken, um abzuschließen.',
    drawBox: 'Über die Karte ziehen, um ein Rechteck zu zeichnen.',
    drawCircle: 'Von der Mitte aus ziehen, um einen Kreis zu zeichnen.',
    points: '{n} Punkte',
    finish: 'Fertig',
    cancel: 'Abbrechen',
    chooseArea: 'Gebiet wählen',
    shapeDrawn: 'Gebiet gezeichnet.',
    shapeCleared: 'Gebiet gelöscht.',
    ctrlZoom: 'Strg + Mausrad zum Zoomen',
    cmdZoom: '⌘ + Mausrad zum Zoomen',
    twoFingers: 'Mit zwei Fingern die Karte bewegen',
    point: 'Punkt {n}',
    centre: 'Mitte',
    edge: 'Rand',
    gripKeys: 'Pfeiltasten verschieben ihn.',
    placeKind: 'Ort',
    areaKind: 'Gebiet',
    mapsGroup: 'Karten',
  },
};

/** The words for a page's language, with the app's own over them. */
export function mapLabels(locale: Locale | undefined, own?: Partial<MapLabels>): MapLabels {
  return { ...MAP_LABELS[locale ?? 'en'], ...own };
}

/** A word with its `{name}`s filled in. */
export const fill = (words: string, values: Record<string, string | number>) =>
  words.replace(/\{(\w+)\}/g, (all, key: string) => (key in values ? String(values[key]) : all));
