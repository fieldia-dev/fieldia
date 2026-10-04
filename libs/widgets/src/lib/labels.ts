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
  invalidJson: string;
  /** A signature: the pad, the words on it while it is blank, the box to type a name in instead, and wiping it. */
  signaturePad: string;
  signHere: string;
  typeSignature: string;
  clearDrawing: string;
  /** A slider not slid yet, as a screen reader reads it. */
  notAnswered: string;
  /** A ranking's buttons for a line (`{label}`), and where it went, said aloud: `{n}` of `{total}`, counted from 1. */
  moveUp: string;
  moveDown: string;
  movedTo: string;
  /** An address's parts. */
  addressStreet: string;
  addressCity: string;
  addressPostcode: string;
  addressCountry: string;
  /** A repeating group: a card's title (`{n}` counts from 1), the button that adds one, and a card gone, said aloud. */
  entry: string;
  addAnother: string;
  removed: string;
  /** Choices from the app's list: while they load, a button to load them again, and a value the list no longer has (`{name}`). */
  loadingChoices: string;
  choicesFailed: string;
  notOffered: string;
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
    invalidJson: 'Not valid JSON',
    signaturePad: 'Signature pad: draw your signature',
    signHere: 'Sign here',
    typeSignature: 'Or type your name',
    clearDrawing: 'Clear',
    notAnswered: 'Not answered',
    moveUp: 'Move {label} up',
    moveDown: 'Move {label} down',
    movedTo: '{label} moved to place {n} of {total}',
    addressStreet: 'Street address',
    addressCity: 'City',
    addressPostcode: 'Postcode',
    addressCountry: 'Country',
    entry: 'Entry {n}',
    addAnother: 'Add another',
    removed: '{name} removed',
    loadingChoices: 'Loading choices…',
    choicesFailed: 'Load the choices again',
    notOffered: '{name}: no longer offered',
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
    invalidJson: 'ليس JSON صالحًا',
    signaturePad: 'لوحة التوقيع: ارسم توقيعك',
    signHere: 'وقّع هنا',
    typeSignature: 'أو اكتب اسمك',
    clearDrawing: 'مسح',
    notAnswered: 'لم تتم الإجابة',
    moveUp: 'نقل {label} لأعلى',
    moveDown: 'نقل {label} لأسفل',
    movedTo: 'أصبح {label} في المرتبة {n} من {total}',
    addressStreet: 'عنوان الشارع',
    addressCity: 'المدينة',
    addressPostcode: 'الرمز البريدي',
    addressCountry: 'الدولة',
    entry: 'الإدخال {n}',
    addAnother: 'إضافة المزيد',
    removed: 'أُزيل {name}',
    loadingChoices: 'تحميل الخيارات…',
    choicesFailed: 'أعد تحميل الخيارات',
    notOffered: '{name}: لم يعد متاحًا',
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
    invalidJson: 'Kein gültiges JSON',
    signaturePad: 'Unterschriftenfeld: Unterschrift zeichnen',
    signHere: 'Hier unterschreiben',
    typeSignature: 'Oder Namen eingeben',
    clearDrawing: 'Löschen',
    notAnswered: 'Nicht beantwortet',
    moveUp: '{label} nach oben verschieben',
    moveDown: '{label} nach unten verschieben',
    movedTo: '{label} ist jetzt auf Platz {n} von {total}',
    addressStreet: 'Straße und Hausnummer',
    addressCity: 'Ort',
    addressPostcode: 'Postleitzahl',
    addressCountry: 'Land',
    entry: 'Eintrag {n}',
    addAnother: 'Weitere hinzufügen',
    removed: '{name} entfernt',
    loadingChoices: 'Auswahl lädt…',
    choicesFailed: 'Auswahl neu laden',
    notOffered: '{name}: nicht mehr angeboten',
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
    invalidJson: 'JSON invalide',
    signaturePad: 'Zone de signature : dessinez votre signature',
    signHere: 'Signez ici',
    typeSignature: 'Ou tapez votre nom',
    clearDrawing: 'Effacer',
    notAnswered: 'Pas de réponse',
    moveUp: 'Monter {label}',
    moveDown: 'Descendre {label}',
    movedTo: '{label} est maintenant en position {n} sur {total}',
    addressStreet: 'Adresse',
    addressCity: 'Ville',
    addressPostcode: 'Code postal',
    addressCountry: 'Pays',
    entry: 'Entrée {n}',
    addAnother: 'En ajouter un autre',
    removed: '{name} retiré',
    loadingChoices: 'Chargement des choix…',
    choicesFailed: 'Recharger les choix',
    notOffered: '{name} : plus proposé',
  },
};
