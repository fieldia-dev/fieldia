import type { Locale } from '@fieldia/core';

/** Every word the viewer shows, so a page can be translated. `{n}`, `{total}` and `{time}` are filled in. */
export interface ViewerLabels {
  save: string;
  /** Switching a read-only form to editing, and back. */
  edit: string;
  done: string;
  discard: string;
  saving: string;
  saved: string;
  submit: string;
  next: string;
  back: string;
  /** Passing over an optional step. */
  skip: string;
  /** The list of a wizard's steps, for screen readers. */
  steps: string;
  stepOf: string;
  submitted: string;
  submitAnother: string;
  draftFound: string;
  restore: string;
  discardDraft: string;
  ok: string;
  cancel: string;
  loading: string;
  /** A form in a dialog: the button that saves it and closes the dialog, and the × that closes it. */
  saveClose: string;
  close: string;
  /** The × on an alert that may be dismissed. */
  dismiss: string;
  /** Saving again after a save failed. */
  retry: string;
  notSaved: string;
  notSent: string;
  /** What was not saved or sent, and the fields to look at. */
  checkFields: string;
  /** The banner when the server cannot be reached. */
  offline: string;
  /** A list: its pages (`{from}`, `{to}`, `{total}`), what is chosen in it, and an empty one. */
  previousPage: string;
  nextPage: string;
  range: string;
  selected: string;
  clearSelection: string;
  selectAll: string;
  selectRecord: string;
  noRecords: string;
  loadFailed: string;
  /**
   * A list's search bar: the box (`{field}` and `{text}` in a suggestion), its
   * chips (`{label}`), the Filters, Group By and Favourites menu (`{name}`),
   * and the conditions a custom filter offers.
   */
  search: string;
  searchLabel: string;
  searchFor: string;
  searchOptions: string;
  filters: string;
  groupBy: string;
  favourites: string;
  or: string;
  removeFacet: string;
  addCustomFilter: string;
  field: string;
  condition: string;
  value: string;
  apply: string;
  saveSearch: string;
  searchName: string;
  useByDefault: string;
  deleteFavourite: string;
  noFavourites: string;
  opIs: string;
  opIsNot: string;
  opContains: string;
  opGreater: string;
  opLess: string;
  opSet: string;
  opNotSet: string;
  yes: string;
  no: string;
  /** A list's groups: the one of records with no value, and the rest of a group's records (`{n}`). */
  none: string;
  loadMore: string;
}

export const VIEWER_LABELS: Record<Locale, ViewerLabels> = {
  en: {
    save: 'Save',
    edit: 'Edit',
    done: 'Done',
    discard: 'Discard',
    saving: 'Saving…',
    saved: 'Saved',
    submit: 'Submit',
    next: 'Next',
    back: 'Back',
    skip: 'Skip',
    steps: 'Steps',
    stepOf: 'Step {n} of {total}',
    submitted: 'Thank you. Your answers were sent.',
    submitAnother: 'Submit another response',
    draftFound: 'You have unsaved answers from {time}.',
    restore: 'Restore',
    discardDraft: 'Discard',
    ok: 'OK',
    cancel: 'Cancel',
    loading: 'Loading…',
    saveClose: 'Save & Close',
    close: 'Close',
    dismiss: 'Dismiss',
    retry: 'Retry',
    notSaved: 'Not saved',
    notSent: 'Not sent',
    checkFields: '{what}. Check: {fields}',
    offline: 'Could not reach the server. Your changes are still here.',
    previousPage: 'Previous page',
    nextPage: 'Next page',
    range: '{from}–{to} / {total}',
    selected: '{n} selected',
    clearSelection: 'Clear',
    selectAll: 'Select all',
    selectRecord: 'Select {name}',
    noRecords: 'No records match.',
    loadFailed: 'Could not load the records.',
    search: 'Search…',
    searchLabel: 'Search',
    searchFor: 'Search {field} for: {text}',
    searchOptions: 'Search options',
    filters: 'Filters',
    groupBy: 'Group By',
    favourites: 'Favourites',
    or: 'or',
    removeFacet: 'Remove {label}',
    addCustomFilter: 'Add a custom filter',
    field: 'Field',
    condition: 'Condition',
    value: 'Value',
    apply: 'Apply',
    saveSearch: 'Save current search',
    searchName: 'Name of the search',
    useByDefault: 'Use by default',
    deleteFavourite: 'Delete {name}',
    noFavourites: 'No saved searches yet.',
    opIs: 'is',
    opIsNot: 'is not',
    opContains: 'contains',
    opGreater: 'greater than',
    opLess: 'less than',
    opSet: 'is set',
    opNotSet: 'is not set',
    yes: 'Yes',
    no: 'No',
    none: 'None',
    loadMore: 'Show {n} more',
  },
  ar: {
    save: 'حفظ',
    edit: 'تعديل',
    done: 'تم',
    discard: 'تجاهل',
    saving: 'جارٍ الحفظ…',
    saved: 'تم الحفظ',
    submit: 'إرسال',
    next: 'التالي',
    back: 'رجوع',
    skip: 'تخطٍّ',
    steps: 'الخطوات',
    stepOf: 'الخطوة {n} من {total}',
    submitted: 'شكرًا لك. تم إرسال إجاباتك.',
    submitAnother: 'إرسال إجابة أخرى',
    draftFound: 'لديك إجابات غير محفوظة من {time}.',
    restore: 'استعادة',
    discardDraft: 'تجاهل',
    ok: 'موافق',
    cancel: 'إلغاء',
    loading: 'جارٍ التحميل…',
    saveClose: 'حفظ وإغلاق',
    close: 'إغلاق',
    dismiss: 'إخفاء',
    retry: 'أعد المحاولة',
    notSaved: 'لم يُحفظ',
    notSent: 'لم يُرسل',
    checkFields: '{what}. راجِع: {fields}',
    offline: 'تعذّر الوصول إلى الخادم. تعديلاتك ما زالت هنا.',
    previousPage: 'الصفحة السابقة',
    nextPage: 'الصفحة التالية',
    range: '{from}–{to} من {total}',
    selected: 'تم تحديد {n}',
    clearSelection: 'إلغاء التحديد',
    selectAll: 'تحديد الكل',
    selectRecord: 'تحديد {name}',
    noRecords: 'لا توجد سجلات مطابقة.',
    loadFailed: 'تعذّر تحميل السجلات.',
    search: 'بحث…',
    searchLabel: 'بحث',
    searchFor: 'ابحث في {field} عن: {text}',
    searchOptions: 'خيارات البحث',
    filters: 'عوامل التصفية',
    groupBy: 'تجميع حسب',
    favourites: 'المفضلة',
    or: 'أو',
    removeFacet: 'إزالة {label}',
    addCustomFilter: 'إضافة عامل تصفية مخصص',
    field: 'الحقل',
    condition: 'الشرط',
    value: 'القيمة',
    apply: 'تطبيق',
    saveSearch: 'حفظ البحث الحالي',
    searchName: 'اسم البحث',
    useByDefault: 'استخدامه افتراضيًا',
    deleteFavourite: 'حذف {name}',
    noFavourites: 'لا توجد عمليات بحث محفوظة بعد.',
    opIs: 'يساوي',
    opIsNot: 'لا يساوي',
    opContains: 'يحتوي على',
    opGreater: 'أكبر من',
    opLess: 'أصغر من',
    opSet: 'محدد',
    opNotSet: 'غير محدد',
    yes: 'نعم',
    no: 'لا',
    none: 'بلا قيمة',
    loadMore: 'عرض {n} أخرى',
  },
  de: {
    save: 'Speichern',
    edit: 'Bearbeiten',
    done: 'Fertig',
    discard: 'Verwerfen',
    saving: 'Wird gespeichert…',
    saved: 'Gespeichert',
    submit: 'Absenden',
    next: 'Weiter',
    back: 'Zurück',
    skip: 'Überspringen',
    steps: 'Schritte',
    stepOf: 'Schritt {n} von {total}',
    submitted: 'Vielen Dank. Ihre Antworten wurden gesendet.',
    submitAnother: 'Weitere Antwort senden',
    draftFound: 'Sie haben ungespeicherte Antworten vom {time}.',
    restore: 'Wiederherstellen',
    discardDraft: 'Verwerfen',
    ok: 'OK',
    cancel: 'Abbrechen',
    loading: 'Wird geladen…',
    saveClose: 'Speichern und schließen',
    close: 'Schließen',
    dismiss: 'Ausblenden',
    retry: 'Erneut versuchen',
    notSaved: 'Nicht gespeichert',
    notSent: 'Nicht gesendet',
    checkFields: '{what}. Bitte prüfen: {fields}',
    offline: 'Der Server ist nicht erreichbar. Ihre Änderungen sind noch da.',
    previousPage: 'Vorherige Seite',
    nextPage: 'Nächste Seite',
    range: '{from}–{to} / {total}',
    selected: '{n} ausgewählt',
    clearSelection: 'Auswahl aufheben',
    selectAll: 'Alle auswählen',
    selectRecord: '{name} auswählen',
    noRecords: 'Keine passenden Einträge.',
    loadFailed: 'Die Einträge konnten nicht geladen werden.',
    search: 'Suchen…',
    searchLabel: 'Suchen',
    searchFor: '{field} durchsuchen nach: {text}',
    searchOptions: 'Suchoptionen',
    filters: 'Filter',
    groupBy: 'Gruppieren nach',
    favourites: 'Favoriten',
    or: 'oder',
    removeFacet: '{label} entfernen',
    addCustomFilter: 'Eigenen Filter hinzufügen',
    field: 'Feld',
    condition: 'Bedingung',
    value: 'Wert',
    apply: 'Anwenden',
    saveSearch: 'Aktuelle Suche speichern',
    searchName: 'Name der Suche',
    useByDefault: 'Standardmäßig verwenden',
    deleteFavourite: '{name} löschen',
    noFavourites: 'Noch keine gespeicherten Suchen.',
    opIs: 'ist',
    opIsNot: 'ist nicht',
    opContains: 'enthält',
    opGreater: 'größer als',
    opLess: 'kleiner als',
    opSet: 'ist gesetzt',
    opNotSet: 'ist nicht gesetzt',
    yes: 'Ja',
    no: 'Nein',
    none: 'Ohne Angabe',
    loadMore: '{n} weitere anzeigen',
  },
  fr: {
    save: 'Enregistrer',
    edit: 'Modifier',
    done: 'Terminé',
    discard: 'Annuler les modifications',
    saving: 'Enregistrement…',
    saved: 'Enregistré',
    submit: 'Envoyer',
    next: 'Suivant',
    back: 'Retour',
    skip: 'Passer',
    steps: 'Étapes',
    stepOf: 'Étape {n} sur {total}',
    submitted: 'Merci. Vos réponses ont été envoyées.',
    submitAnother: 'Envoyer une autre réponse',
    draftFound: 'Vous avez des réponses non enregistrées du {time}.',
    restore: 'Restaurer',
    discardDraft: 'Ignorer',
    ok: 'OK',
    cancel: 'Annuler',
    loading: 'Chargement…',
    saveClose: 'Enregistrer et fermer',
    close: 'Fermer',
    dismiss: 'Masquer',
    retry: 'Réessayer',
    notSaved: 'Non enregistré',
    notSent: 'Non envoyé',
    checkFields: '{what}. À vérifier : {fields}',
    offline: 'Le serveur est injoignable. Vos modifications sont toujours là.',
    previousPage: 'Page précédente',
    nextPage: 'Page suivante',
    range: '{from}–{to} / {total}',
    selected: '{n} sélectionné(s)',
    clearSelection: 'Désélectionner',
    selectAll: 'Tout sélectionner',
    selectRecord: 'Sélectionner {name}',
    noRecords: 'Aucun enregistrement ne correspond.',
    loadFailed: 'Impossible de charger les enregistrements.',
    search: 'Rechercher…',
    searchLabel: 'Rechercher',
    searchFor: 'Rechercher {field} : {text}',
    searchOptions: 'Options de recherche',
    filters: 'Filtres',
    groupBy: 'Regrouper par',
    favourites: 'Favoris',
    or: 'ou',
    removeFacet: 'Retirer {label}',
    addCustomFilter: 'Ajouter un filtre personnalisé',
    field: 'Champ',
    condition: 'Condition',
    value: 'Valeur',
    apply: 'Appliquer',
    saveSearch: 'Enregistrer la recherche',
    searchName: 'Nom de la recherche',
    useByDefault: 'Utiliser par défaut',
    deleteFavourite: 'Supprimer {name}',
    noFavourites: 'Aucune recherche enregistrée.',
    opIs: 'est',
    opIsNot: 'n’est pas',
    opContains: 'contient',
    opGreater: 'supérieur à',
    opLess: 'inférieur à',
    opSet: 'est défini',
    opNotSet: 'n’est pas défini',
    yes: 'Oui',
    no: 'Non',
    none: 'Aucun',
    loadMore: 'Afficher {n} de plus',
  },
};

/** English, kept under its old name. */
export const DEFAULT_LABELS: ViewerLabels = VIEWER_LABELS.en;
