import type { Locale } from '@fieldia/core';

/** Every word a widget shows on its own. `{label}` and `{name}` are filled in. */
export interface WidgetLabels {
  search: string;
  noResults: string;
  remove: string;
  clear: string;
  addLine: string;
  addSection: string;
  addNote: string;
  deleteLine: string;
  /** A line of a table, as a person is told of it: `{n}` counts from 1. */
  lineN: string;
  /** Heads the row that adds up a table's number columns. */
  total: string;
  /** A problem on one line of a table, under the table. `{n}` counts from 1. */
  lineProblem: string;
  /** Problems beyond the first few. */
  moreProblems: string;
  /** The choice that makes a new record from what was typed. `{name}` is filled in. */
  createNamed: string;
  /** Choices at the end of a link's list, and the button that opens the linked record (`{name}`). */
  createAndEdit: string;
  searchMore: string;
  openNamed: string;
  /** The button that opens a line of a table in a dialog. */
  openLine: string;
  /** The button that lets a person hide or show a table's optional columns. */
  chooseColumns: string;
  /** The button beside a date that opens its calendar. */
  chooseDate: string;
  /** The choice after the options for an answer of one's own, and its box. */
  other: string;
  otherAnswer: string;
  /** Under a single choice that need not be answered, once one is picked: takes the pick back. */
  clearSelection: string;
  previousMonth: string;
  nextMonth: string;
  /** Heads the column of week numbers: short, and in full. */
  weekShort: string;
  week: string;
  /** The formatted-text toolbar and its buttons. */
  formatting: string;
  bold: string;
  italic: string;
  underline: string;
  textStyle: string;
  paragraph: string;
  heading: string;
  subheading: string;
  bulletList: string;
  numberList: string;
  alignLeft: string;
  alignCenter: string;
  alignRight: string;
  link: string;
  linkAddress: string;
  applyLink: string;
  removeLink: string;
  upload: string;
  uploadImage: string;
  replace: string;
  removeFile: string;
  dropHere: string;
  /**
   * Several files: the picker's words, an image field's, and the drop zone's;
   * the limits said before anyone tries (`{size}`, `{max}`); how many there are
   * (`{n}`); why some were not added (`{name}`); removing one, asked first.
   */
  addFiles: string;
  addPhotos: string;
  dropThem: string;
  upToSize: string;
  upToEach: string;
  upToFiles: string;
  fileCount: string;
  oneFile: string;
  fileCountOf: string;
  tooMany: string;
  alreadyAdded: string;
  removeAsk: string;
  keep: string;
  /** A file opened to look at: going through them, which one of how many (`{n}` of `{total}`), and what has no preview. */
  previous: string;
  next: string;
  download: string;
  close: string;
  fileAt: string;
  noPreview: string;
  invalidJson: string;
  /** A signature: the pad, the words on it while it is blank, the box to type a name in instead, and wiping it. */
  signaturePad: string;
  signHere: string;
  typeSignature: string;
  clearDrawing: string;
  /** Takes the last stroke away; a picture of a signature, uploaded instead. */
  undo: string;
  uploadSignature: string;
  /** A slider not slid yet, as a screen reader reads it. */
  notAnswered: string;
  /** A ranking's buttons for a line (`{label}`), and where it went, said aloud: `{n}` of `{total}`, counted from 1. */
  moveUp: string;
  moveDown: string;
  movedTo: string;
  /** An address's parts. */
  addressStreet: string;
  addressCity: string;
  addressLine2: string;
  addressRegion: string;
  addressPostcode: string;
  addressCountry: string;
  /** A repeating group: a card's title (`{n}` counts from 1), the button that adds one, and a card gone, said aloud. */
  entry: string;
  addAnother: string;
  /** A repeating group's card copied right after it: `{name}` is its title. */
  copy: string;
  removed: string;
  /** Choices from the app's list: while they load, a button to load them again, and a value the list no longer has (`{name}`). */
  loadingChoices: string;
  choicesFailed: string;
  notOffered: string;
  /** A yes or no as two buttons. */
  yes: string;
  no: string;
  /** Said once as many boxes are ticked as a question takes (`{n}`). */
  upTo: string;
  /** A ranking: taking the order shown as the answer. */
  keepOrder: string;
  /** A rating's point, as a screen reader names it: `{n}` of `{max}`. */
  ofMax: string;
  /** How many more characters a box with a most takes, said to a screen reader once typing pauses. */
  charactersLeft: string;
}

export const WIDGET_LABELS: Record<Locale, WidgetLabels> = {
  en: {
    search: 'Search…',
    noResults: 'No results',
    remove: 'Remove {name}',
    clear: 'Clear {label}',
    addLine: 'Add a line',
    addSection: 'Add a section',
    addNote: 'Add a note',
    deleteLine: 'Delete line',
    lineN: 'line {n}',
    total: 'Total',
    lineProblem: 'Line {n}: {message}',
    moreProblems: 'and {n} more',
    chooseColumns: 'Choose columns',
    createNamed: 'Create “{name}”',
    createAndEdit: 'Create and edit…',
    searchMore: 'Search more…',
    openNamed: 'Open {name}',
    openLine: 'Open line',
    chooseDate: 'Choose a date',
    other: 'Other:',
    otherAnswer: 'Your own answer',
    clearSelection: 'Clear selection',
    previousMonth: 'Previous month',
    nextMonth: 'Next month',
    weekShort: 'Wk',
    week: 'Week',
    formatting: 'Formatting',
    bold: 'Bold',
    italic: 'Italic',
    underline: 'Underline',
    textStyle: 'Text style',
    paragraph: 'Paragraph',
    heading: 'Heading',
    subheading: 'Subheading',
    bulletList: 'Bulleted list',
    numberList: 'Numbered list',
    alignLeft: 'Align left',
    alignCenter: 'Align centre',
    alignRight: 'Align right',
    link: 'Link',
    linkAddress: 'Link address',
    applyLink: 'Apply',
    removeLink: 'Remove link',
    upload: 'Upload a file',
    uploadImage: 'Add a photo',
    replace: 'Replace',
    removeFile: 'Remove',
    dropHere: 'or drop it here',
    addFiles: 'Add files',
    addPhotos: 'Add photos',
    dropThem: 'or drop them here',
    upToSize: 'up to {size}',
    upToEach: 'up to {size} each',
    upToFiles: 'up to {max} files',
    fileCount: '{n} files',
    oneFile: '1 file',
    fileCountOf: '{n} of {max} files',
    tooMany: 'Up to {max} files: {n} not added',
    alreadyAdded: '{name}: already added',
    removeAsk: 'Remove {name}?',
    keep: 'Keep',
    previous: 'Previous',
    next: 'Next',
    download: 'Download',
    close: 'Close',
    fileAt: '{n} of {total}',
    noPreview: 'No preview for this kind of file',
    invalidJson: 'Not valid JSON',
    signaturePad: 'Signature pad: draw your signature',
    signHere: 'Sign here',
    typeSignature: 'Or type your name',
    clearDrawing: 'Clear',
    undo: 'Undo',
    uploadSignature: 'Upload a picture',
    notAnswered: 'Not answered',
    moveUp: 'Move {label} up',
    moveDown: 'Move {label} down',
    movedTo: '{label} moved to place {n} of {total}',
    addressStreet: 'Street address',
    addressCity: 'City',
    addressLine2: 'Address line 2',
    addressRegion: 'State or region',
    addressPostcode: 'Postcode',
    addressCountry: 'Country',
    entry: 'Entry {n}',
    addAnother: 'Add another',
    copy: 'Copy {name}',
    removed: '{name} removed',
    loadingChoices: 'Loading choices…',
    choicesFailed: 'Load the choices again',
    notOffered: '{name}: no longer offered',
    yes: 'Yes',
    no: 'No',
    upTo: 'Up to {n}',
    keepOrder: 'Keep this order',
    ofMax: '{n} of {max}',
    charactersLeft: 'Characters left: {n}',
  },
  ar: {
    search: 'بحث…',
    noResults: 'لا توجد نتائج',
    remove: 'إزالة {name}',
    clear: 'مسح {label}',
    addLine: 'إضافة سطر',
    addSection: 'إضافة قسم',
    addNote: 'إضافة ملاحظة',
    deleteLine: 'حذف السطر',
    lineN: 'السطر {n}',
    total: 'الإجمالي',
    lineProblem: 'السطر {n}: {message}',
    moreProblems: 'و{n} أخرى',
    chooseColumns: 'اختيار الأعمدة',
    createNamed: 'إنشاء «{name}»',
    createAndEdit: 'إنشاء وتعديل…',
    searchMore: 'بحث موسّع…',
    openNamed: 'فتح {name}',
    openLine: 'فتح السطر',
    chooseDate: 'اختيار تاريخ',
    other: 'أخرى:',
    otherAnswer: 'إجابتك الخاصة',
    clearSelection: 'محو التحديد',
    previousMonth: 'الشهر السابق',
    nextMonth: 'الشهر التالي',
    weekShort: 'أسبوع',
    week: 'الأسبوع',
    formatting: 'التنسيق',
    bold: 'غامق',
    italic: 'مائل',
    underline: 'تسطير',
    textStyle: 'نمط النص',
    paragraph: 'فقرة',
    heading: 'عنوان',
    subheading: 'عنوان فرعي',
    bulletList: 'قائمة نقطية',
    numberList: 'قائمة مرقمة',
    alignLeft: 'محاذاة لليسار',
    alignCenter: 'توسيط',
    alignRight: 'محاذاة لليمين',
    link: 'رابط',
    linkAddress: 'عنوان الرابط',
    applyLink: 'تطبيق',
    removeLink: 'إزالة الرابط',
    upload: 'رفع ملف',
    uploadImage: 'إضافة صورة',
    replace: 'استبدال',
    removeFile: 'إزالة',
    dropHere: 'أو أفلته هنا',
    addFiles: 'إضافة ملفات',
    addPhotos: 'إضافة صور',
    dropThem: 'أو أفلتها هنا',
    upToSize: 'حتى {size}',
    upToEach: 'حتى {size} لكل ملف',
    upToFiles: 'بحد أقصى {max} من الملفات',
    fileCount: 'عدد الملفات: {n}',
    oneFile: 'ملف واحد',
    fileCountOf: 'الملفات: {n} من {max}',
    tooMany: 'بحد أقصى {max} من الملفات: لم يُضف {n} منها',
    alreadyAdded: '{name}: مضاف من قبل',
    removeAsk: 'إزالة {name}؟',
    keep: 'إبقاء',
    previous: 'السابق',
    next: 'التالي',
    download: 'تنزيل',
    close: 'إغلاق',
    fileAt: '{n} من {total}',
    noPreview: 'لا معاينة لهذا النوع من الملفات',
    invalidJson: 'ليس JSON صالحًا',
    signaturePad: 'لوحة التوقيع: ارسم توقيعك',
    signHere: 'وقّع هنا',
    typeSignature: 'أو اكتب اسمك',
    clearDrawing: 'مسح',
    undo: 'تراجع',
    uploadSignature: 'رفع صورة',
    notAnswered: 'لم تتم الإجابة',
    moveUp: 'نقل {label} لأعلى',
    moveDown: 'نقل {label} لأسفل',
    movedTo: 'أصبح {label} في المرتبة {n} من {total}',
    addressStreet: 'عنوان الشارع',
    addressCity: 'المدينة',
    addressLine2: 'سطر العنوان 2',
    addressRegion: 'المحافظة أو المنطقة',
    addressPostcode: 'الرمز البريدي',
    addressCountry: 'الدولة',
    entry: 'الإدخال {n}',
    addAnother: 'إضافة المزيد',
    copy: 'نسخ {name}',
    removed: 'أُزيل {name}',
    loadingChoices: 'تحميل الخيارات…',
    choicesFailed: 'أعد تحميل الخيارات',
    notOffered: '{name}: لم يعد متاحًا',
    yes: 'نعم',
    no: 'لا',
    upTo: 'حتى {n}',
    keepOrder: 'أبقِ هذا الترتيب',
    ofMax: '{n} من {max}',
    charactersLeft: 'الأحرف المتبقية: {n}',
  },
  de: {
    search: 'Suchen…',
    noResults: 'Keine Ergebnisse',
    remove: '{name} entfernen',
    clear: '{label} leeren',
    addLine: 'Zeile hinzufügen',
    addSection: 'Abschnitt hinzufügen',
    addNote: 'Notiz hinzufügen',
    deleteLine: 'Zeile löschen',
    lineN: 'Zeile {n}',
    total: 'Summe',
    lineProblem: 'Zeile {n}: {message}',
    moreProblems: 'und {n} weitere',
    chooseColumns: 'Spalten auswählen',
    createNamed: '„{name}“ anlegen',
    createAndEdit: 'Anlegen und bearbeiten…',
    searchMore: 'Weitere suchen…',
    openNamed: '{name} öffnen',
    openLine: 'Zeile öffnen',
    chooseDate: 'Datum auswählen',
    other: 'Andere:',
    otherAnswer: 'Eigene Antwort',
    clearSelection: 'Auswahl löschen',
    previousMonth: 'Vorheriger Monat',
    nextMonth: 'Nächster Monat',
    weekShort: 'KW',
    week: 'Kalenderwoche',
    formatting: 'Formatierung',
    bold: 'Fett',
    italic: 'Kursiv',
    underline: 'Unterstrichen',
    textStyle: 'Textstil',
    paragraph: 'Absatz',
    heading: 'Überschrift',
    subheading: 'Unterüberschrift',
    bulletList: 'Aufzählung',
    numberList: 'Nummerierte Liste',
    alignLeft: 'Linksbündig',
    alignCenter: 'Zentriert',
    alignRight: 'Rechtsbündig',
    link: 'Link',
    linkAddress: 'Linkadresse',
    applyLink: 'Übernehmen',
    removeLink: 'Link entfernen',
    upload: 'Datei hochladen',
    uploadImage: 'Foto hinzufügen',
    replace: 'Ersetzen',
    removeFile: 'Entfernen',
    dropHere: 'oder hier ablegen',
    addFiles: 'Dateien hinzufügen',
    addPhotos: 'Fotos hinzufügen',
    dropThem: 'oder hier ablegen',
    upToSize: 'bis {size}',
    upToEach: 'bis {size} je Datei',
    upToFiles: 'bis zu {max} Dateien',
    fileCount: '{n} Dateien',
    oneFile: '1 Datei',
    fileCountOf: '{n} von {max} Dateien',
    tooMany: 'Höchstens {max} Dateien: {n} nicht hinzugefügt',
    alreadyAdded: '{name}: schon hinzugefügt',
    removeAsk: '{name} entfernen?',
    keep: 'Behalten',
    previous: 'Zurück',
    next: 'Weiter',
    download: 'Herunterladen',
    close: 'Schließen',
    fileAt: '{n} von {total}',
    noPreview: 'Keine Vorschau für diese Art von Datei',
    invalidJson: 'Kein gültiges JSON',
    signaturePad: 'Unterschriftenfeld: Unterschrift zeichnen',
    signHere: 'Hier unterschreiben',
    typeSignature: 'Oder Namen eingeben',
    clearDrawing: 'Löschen',
    undo: 'Rückgängig',
    uploadSignature: 'Bild hochladen',
    notAnswered: 'Nicht beantwortet',
    moveUp: '{label} nach oben verschieben',
    moveDown: '{label} nach unten verschieben',
    movedTo: '{label} ist jetzt auf Platz {n} von {total}',
    addressStreet: 'Straße und Hausnummer',
    addressCity: 'Ort',
    addressLine2: 'Adresszeile 2',
    addressRegion: 'Bundesland oder Region',
    addressPostcode: 'Postleitzahl',
    addressCountry: 'Land',
    entry: 'Eintrag {n}',
    addAnother: 'Weitere hinzufügen',
    copy: '{name} kopieren',
    removed: '{name} entfernt',
    loadingChoices: 'Auswahl lädt…',
    choicesFailed: 'Auswahl neu laden',
    notOffered: '{name}: nicht mehr angeboten',
    yes: 'Ja',
    no: 'Nein',
    upTo: 'Bis zu {n}',
    keepOrder: 'Diese Reihenfolge behalten',
    ofMax: '{n} von {max}',
    charactersLeft: 'Noch {n} Zeichen',
  },
  fr: {
    search: 'Rechercher…',
    noResults: 'Aucun résultat',
    remove: 'Retirer {name}',
    clear: 'Effacer {label}',
    addLine: 'Ajouter une ligne',
    addSection: 'Ajouter une section',
    addNote: 'Ajouter une note',
    deleteLine: 'Supprimer la ligne',
    lineN: 'ligne {n}',
    total: 'Total',
    lineProblem: 'Ligne {n} : {message}',
    moreProblems: 'et {n} de plus',
    chooseColumns: 'Choisir les colonnes',
    createNamed: 'Créer « {name} »',
    createAndEdit: 'Créer et modifier…',
    searchMore: 'Rechercher plus…',
    openNamed: 'Ouvrir {name}',
    openLine: 'Ouvrir la ligne',
    chooseDate: 'Choisir une date',
    other: 'Autre :',
    otherAnswer: 'Votre propre réponse',
    clearSelection: 'Effacer la sélection',
    previousMonth: 'Mois précédent',
    nextMonth: 'Mois suivant',
    weekShort: 'Sem.',
    week: 'Semaine',
    formatting: 'Mise en forme',
    bold: 'Gras',
    italic: 'Italique',
    underline: 'Souligné',
    textStyle: 'Style du texte',
    paragraph: 'Paragraphe',
    heading: 'Titre',
    subheading: 'Sous-titre',
    bulletList: 'Liste à puces',
    numberList: 'Liste numérotée',
    alignLeft: 'Aligner à gauche',
    alignCenter: 'Centrer',
    alignRight: 'Aligner à droite',
    link: 'Lien',
    linkAddress: 'Adresse du lien',
    applyLink: 'Appliquer',
    removeLink: 'Supprimer le lien',
    upload: 'Téléverser un fichier',
    uploadImage: 'Ajouter une photo',
    replace: 'Remplacer',
    removeFile: 'Retirer',
    dropHere: 'ou déposez-le ici',
    addFiles: 'Ajouter des fichiers',
    addPhotos: 'Ajouter des photos',
    dropThem: 'ou déposez-les ici',
    upToSize: 'jusqu’à {size}',
    upToEach: 'jusqu’à {size} par fichier',
    upToFiles: 'jusqu’à {max} fichiers',
    fileCount: '{n} fichiers',
    oneFile: '1 fichier',
    fileCountOf: '{n} fichiers sur {max}',
    tooMany: '{max} fichiers au plus : {n} non ajouté(s)',
    alreadyAdded: '{name} : déjà ajouté',
    removeAsk: 'Retirer {name} ?',
    keep: 'Garder',
    previous: 'Précédent',
    next: 'Suivant',
    download: 'Télécharger',
    close: 'Fermer',
    fileAt: '{n} sur {total}',
    noPreview: 'Pas d’aperçu pour ce type de fichier',
    invalidJson: 'JSON invalide',
    signaturePad: 'Zone de signature : dessinez votre signature',
    signHere: 'Signez ici',
    typeSignature: 'Ou tapez votre nom',
    clearDrawing: 'Effacer',
    undo: 'Annuler',
    uploadSignature: 'Importer une image',
    notAnswered: 'Pas de réponse',
    moveUp: 'Monter {label}',
    moveDown: 'Descendre {label}',
    movedTo: '{label} est maintenant en position {n} sur {total}',
    addressStreet: 'Adresse',
    addressCity: 'Ville',
    addressLine2: 'Complément d’adresse',
    addressRegion: 'État ou région',
    addressPostcode: 'Code postal',
    addressCountry: 'Pays',
    entry: 'Entrée {n}',
    addAnother: 'En ajouter un autre',
    copy: 'Copier {name}',
    removed: '{name} retiré',
    loadingChoices: 'Chargement des choix…',
    choicesFailed: 'Recharger les choix',
    notOffered: '{name} : plus proposé',
    yes: 'Oui',
    no: 'Non',
    upTo: 'Jusqu’à {n}',
    keepOrder: 'Garder cet ordre',
    ofMax: '{n} sur {max}',
    charactersLeft: 'Caractères restants : {n}',
  },
};
