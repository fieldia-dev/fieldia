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
  /** Said when the reader's location is rough, as a desktop's often is: `{distance}` is how rough. */
  locatedWithin: string;
  kilometres: string;
  metres: string;
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
    locatedWithin: 'Placed within about {distance} of where you are. Drag the pin to the right spot.',
    kilometres: '{n} km',
    metres: '{n} m',
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
    locatedWithin: 'وُضع على بُعد نحو {distance} من مكانك. اسحب الدبوس إلى المكان الصحيح.',
    kilometres: '{n} كم',
    metres: '{n} م',
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
    drawKeys: 'بلوحة المفاتيح: تضع المسافة نقطة في وسط الخريطة، وينهي Enter الرسم، ويحذف Backspace آخر نقطة، ويوقف Escape الرسم.',
    addPoint: 'اسحب لإضافة نقطة هنا',
    placeKind: 'مكان',
    areaKind: 'منطقة',
    mapsGroup: 'الخرائط',
    settingMyLocation: 'زر «موقعي»',
    settingSearch: 'البحث عن عنوان',
    settingHeight: 'ارتفاع الخريطة',
    heightSmall: 'صغير',
    heightMedium: 'متوسط',
    heightLarge: 'كبير',
    settingShapes: 'الأشكال',
    settingAddress: 'يُكتب العنوان في',
    settingNowhere: 'لا مكان',
    satellite: 'القمر الصناعي',
    traffic: 'حركة المرور',
    fullScreen: 'ملء الشاشة',
    leaveFullScreen: 'الخروج من ملء الشاشة',
    measure: 'قِس مسافة',
    measureHint: 'انقر نقاطًا على طول الطريق؛ انقر مرتين أو اضغط Enter للإنهاء، ويمسح Escape القياس.',
    measured: 'يبلغ الطريق {distance}.',
    areaValue: '{name}: {value}',
    areasNone: 'لا شيء',
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
    locatedWithin: 'Placé à environ {distance} de l’endroit où vous êtes. Faites glisser l’épingle au bon endroit.',
    kilometres: '{n} km',
    metres: '{n} m',
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
    drawKeys: 'Au clavier : Espace place un point au centre de la carte, Entrée termine, Retour arrière retire le dernier point, Échap arrête.',
    addPoint: 'Faites glisser pour ajouter un point ici',
    placeKind: 'Lieu',
    areaKind: 'Zone',
    mapsGroup: 'Cartes',
    settingMyLocation: 'Bouton « Ma position »',
    settingSearch: 'Recherche d’adresse',
    settingHeight: 'Hauteur de la carte',
    heightSmall: 'Petite',
    heightMedium: 'Moyenne',
    heightLarge: 'Grande',
    settingShapes: 'Formes',
    settingAddress: 'L’adresse va dans',
    settingNowhere: 'Nulle part',
    satellite: 'Satellite',
    traffic: 'Trafic',
    fullScreen: 'Plein écran',
    leaveFullScreen: 'Quitter le plein écran',
    measure: 'Mesurer une distance',
    measureHint: 'Cliquez des points le long du trajet ; double-cliquez ou appuyez sur Entrée pour terminer. Échap efface.',
    measured: 'Le trajet mesure {distance}.',
    areaValue: '{name} : {value}',
    areasNone: 'Aucun',
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
    locatedWithin: 'Auf etwa {distance} genau gesetzt. Ziehen Sie die Nadel an die richtige Stelle.',
    kilometres: '{n} km',
    metres: '{n} m',
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
    drawKeys: 'Mit der Tastatur: Leertaste setzt einen Punkt in die Kartenmitte, Eingabe schließt ab, Rücktaste nimmt den letzten Punkt zurück, Escape bricht ab.',
    addPoint: 'Ziehen, um hier einen Punkt einzufügen',
    placeKind: 'Ort',
    areaKind: 'Gebiet',
    mapsGroup: 'Karten',
    settingMyLocation: 'Schaltfläche „Mein Standort“',
    settingSearch: 'Adresssuche',
    settingHeight: 'Kartenhöhe',
    heightSmall: 'Klein',
    heightMedium: 'Mittel',
    heightLarge: 'Groß',
    settingShapes: 'Formen',
    settingAddress: 'Adresse kommt in',
    settingNowhere: 'Nirgends',
    satellite: 'Satellit',
    traffic: 'Verkehr',
    fullScreen: 'Vollbild',
    leaveFullScreen: 'Vollbild verlassen',
    measure: 'Entfernung messen',
    measureHint: 'Punkte entlang des Weges anklicken; Doppelklick oder Eingabe beendet, Escape löscht.',
    measured: 'Der Weg misst {distance}.',
    areaValue: '{name}: {value}',
    areasNone: 'Keine',
  },
};

/** The words a list's map shows, besides the maps' own: kept apart, so a form with only a place or an area never carries them. */
export interface ListMapLabels {
  /** How the keys reach the pins. */
  pinKeys: string;
  searchThisArea: string;
  /** The search a map puts in the list's search bar. */
  inThisArea: string;
  openRecord: string;
  choose: string;
  closeCard: string;
  /** A bubble of pins: `{n}` how many. */
  cluster: string;
  /** Pins on one spot, listed. */
  crowd: string;
  notOnMap: string;
  /** More records than a map shows: `{n}` shown of `{total}`. */
  mapShowsFirst: string;
  mapFailed: string;
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

export const LIST_MAP_LABELS: Record<Locale, ListMapLabels> = {
  en: {
    pinKeys: 'Tab goes through the pins. Enter opens a pin’s card; Escape closes it.',
    searchThisArea: 'Search this area',
    inThisArea: 'In this area',
    openRecord: 'Open',
    choose: 'Choose',
    closeCard: 'Close',
    cluster: '{n} here. Zoom in to see them.',
    crowd: '{n} in one place',
    notOnMap: '{n} without a place, not on the map',
    mapShowsFirst: 'The map shows {n} of {total}. Zoom in and search this area for the rest.',
    mapFailed: 'The map could not load the records.',
    drawArea: 'Draw an area to search in',
    inDrawnArea: 'In the area drawn',
    inRegion: 'In {name}',
    nearestFirst: 'Nearest first',
    nearestFromMiddle: 'Nearest the middle of the map first: your place was not given.',
    heatNote: 'A heat map from afar: zoom in to the streets to see each one.',
  },
  ar: {
    pinKeys: 'ينتقل Tab بين الدبابيس. يفتح Enter بطاقة الدبوس، ويغلقها Escape.',
    searchThisArea: 'ابحث في هذه المنطقة',
    inThisArea: 'في هذه المنطقة',
    openRecord: 'فتح',
    choose: 'اختيار',
    closeCard: 'إغلاق',
    cluster: '{n} هنا. كبّر الخريطة لرؤيتها.',
    crowd: '{n} في مكان واحد',
    notOnMap: '{n} بلا مكان، ليست على الخريطة',
    mapShowsFirst: 'تعرض الخريطة {n} من {total}. كبّر الخريطة وابحث في هذه المنطقة لرؤية البقية.',
    mapFailed: 'تعذّر تحميل السجلات على الخريطة.',
    drawArea: 'ارسم منطقة للبحث فيها',
    inDrawnArea: 'في المنطقة المرسومة',
    inRegion: 'في {name}',
    nearestFirst: 'الأقرب أولًا',
    nearestFromMiddle: 'الأقرب إلى منتصف الخريطة أولًا: لم يُعطَ موقعك.',
    heatNote: 'خريطة حرارية من بعيد: قرّب إلى الشوارع لترى كلًّا منها.',
  },
  fr: {
    pinKeys: 'Tab parcourt les épingles. Entrée ouvre la fiche d’une épingle, Échap la ferme.',
    searchThisArea: 'Rechercher dans cette zone',
    inThisArea: 'Dans cette zone',
    openRecord: 'Ouvrir',
    choose: 'Choisir',
    closeCard: 'Fermer',
    cluster: '{n} ici. Zoomez pour les voir.',
    crowd: '{n} au même endroit',
    notOnMap: '{n} sans lieu, absents de la carte',
    mapShowsFirst: 'La carte en montre {n} sur {total}. Zoomez et recherchez dans cette zone pour voir les autres.',
    mapFailed: 'La carte n’a pas pu charger les enregistrements.',
    drawArea: 'Tracer une zone où chercher',
    inDrawnArea: 'Dans la zone tracée',
    inRegion: 'À {name}',
    nearestFirst: 'Les plus proches d’abord',
    nearestFromMiddle: 'Les plus proches du centre de la carte d’abord : votre position n’a pas été donnée.',
    heatNote: 'Une carte de chaleur vue de loin : zoomez jusqu’aux rues pour voir chacun.',
  },
  de: {
    pinKeys: 'Tab springt von Nadel zu Nadel. Eingabe öffnet die Karte einer Nadel, Escape schließt sie.',
    searchThisArea: 'In diesem Gebiet suchen',
    inThisArea: 'In diesem Gebiet',
    openRecord: 'Öffnen',
    choose: 'Auswählen',
    closeCard: 'Schließen',
    cluster: '{n} hier. Hineinzoomen, um sie zu sehen.',
    crowd: '{n} an einem Ort',
    notOnMap: '{n} ohne Ort, nicht auf der Karte',
    mapShowsFirst: 'Die Karte zeigt {n} von {total}. Hineinzoomen und in diesem Gebiet suchen, um die übrigen zu sehen.',
    mapFailed: 'Die Karte konnte die Datensätze nicht laden.',
    drawArea: 'Ein Gebiet zum Suchen zeichnen',
    inDrawnArea: 'Im gezeichneten Gebiet',
    inRegion: 'In {name}',
    nearestFirst: 'Nächste zuerst',
    nearestFromMiddle: 'Die der Kartenmitte nächsten zuerst: Ihr Standort wurde nicht freigegeben.',
    heatNote: 'Eine Heatmap aus der Ferne: bis zu den Straßen zoomen, um jeden zu sehen.',
  },
};

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

export const FORM_MAP_LABELS: Record<Locale, FormMapLabels> = {
  en: { map: 'Map', lastSeen: 'Last seen {time}', follow: 'Follow', routeFailed: 'The way could not be found.', crowdHere: '{n} here: {names}. Zoom in to see them.' },
  ar: { map: 'خريطة', lastSeen: 'آخر ظهور {time}', follow: 'تتبّع', routeFailed: 'تعذّر إيجاد الطريق.', crowdHere: '{n} هنا: {names}. كبّر الخريطة لرؤيتها.' },
  fr: { map: 'Carte', lastSeen: 'Vu pour la dernière fois {time}', follow: 'Suivre', routeFailed: 'Le trajet est introuvable.', crowdHere: '{n} ici : {names}. Zoomez pour les voir.' },
  de: { map: 'Karte', lastSeen: 'Zuletzt gesehen {time}', follow: 'Folgen', routeFailed: 'Der Weg wurde nicht gefunden.', crowdHere: '{n} hier: {names}. Hineinzoomen, um sie zu sehen.' },
};

/** The words for a page's language, with the app's own over them. */
export function mapLabels(locale: Locale | undefined, own?: Partial<MapLabels>): MapLabels {
  return { ...MAP_LABELS[locale ?? 'en'], ...own };
}

/** A list's map's words for a page's language, the maps' own with them, and the app's own over both. */
export function listMapLabels(locale: Locale | undefined, own?: Partial<MapLabels & ListMapLabels>): MapLabels & ListMapLabels {
  return { ...MAP_LABELS[locale ?? 'en'], ...LIST_MAP_LABELS[locale ?? 'en'], ...own };
}

/** A word with its `{name}`s filled in. */
export const fill = (words: string, values: Record<string, string | number>) =>
  words.replace(/\{(\w+)\}/g, (all, key: string) => (key in values ? String(values[key]) : all));

/** A form's map's words for a page's language: the maps' own, a list map's (its pins and cards), its own, the app's over all. */
export function formMapLabels(locale: Locale | undefined, own?: Partial<MapLabels & ListMapLabels & FormMapLabels>): MapLabels & ListMapLabels & FormMapLabels {
  return { ...MAP_LABELS[locale ?? 'en'], ...LIST_MAP_LABELS[locale ?? 'en'], ...FORM_MAP_LABELS[locale ?? 'en'], ...own };
}
