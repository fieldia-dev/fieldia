import type { CalendarView, Locale } from '@fieldia/core';

/** The words a calendar shows itself. `{name}`, `{when}`, `{n}` are filled in where they stand. */
export interface CalendarLabels {
  /** Its name on the list's switcher, and for a screen reader. */
  calendar: string;
  today: string;
  previous: Record<CalendarView, string>;
  next: Record<CalendarView, string>;
  views: Record<CalendarView, string>;
  /** The group of Day, Week, Month and Agenda, for a screen reader. */
  showAs: string;
  /** The group of Today, back and on. */
  moveThrough: string;
  newRecord: string;
  /**
   * New, how many a slot holds and what Enter makes, in the words a page names its records by (`Page.records`):
   * `{record}` for one, `{records}` for more. Where a language leaves one out, it says its own sentence before it.
   */
  newRecordNoun?: string;
  holdsNoun?: string;
  holdsNounOne?: string;
  keysSlotsNoun?: string;
  keysDaysNoun?: string;
  allDay: string;
  /** The hours' column head, for a screen reader. */
  time: string;
  loadFailed: string;
  retry: string;
  nothing: string;
  /** Under a month's day with more than it shows: "+2 more". */
  more: string;
  /** The same, said in full: "2 more on Wednesday 14 October". */
  moreOn: string;
  /** The column of records with no one. */
  noResource: string;
  tooMany: string;
  /** How long a record is: "10:00 to 10:30". */
  fromTo: string;
  /** Who a record is with: "with Dr Karim". */
  withWho: string;
  /** Said of a slot nothing takes. */
  free: string;
  /** How many a slot holds: "1 record", "{n} records". */
  holds: string;
  holdsOne: string;
  keysOpen: string;
  keysMove: string;
  keysOpenMove: string;
  keysSlots: string;
  keysDays: string;
  moveTo: string;
  moveTitle: string;
  moveDay: string;
  moveTime: string;
  move: string;
  cancel: string;
  /** Move to…'s day refused: no day, or one far from the record's ("0026", "2062"). */
  badDay: string;
  badTime: string;
  moved: string;
  stretched: string;
  undo: string;
  undone: string;
  close: string;
  notMoved: string;
  /** Why a record cannot be moved, when its source gives no reason of its own. */
  cannotMove: string;
  saving: string;
}

const en: CalendarLabels = {
  calendar: 'Calendar',
  today: 'Today',
  previous: { day: 'Previous day', week: 'Previous week', month: 'Previous month', agenda: 'Previous week' },
  next: { day: 'Next day', week: 'Next week', month: 'Next month', agenda: 'Next week' },
  views: { day: 'Day', week: 'Week', month: 'Month', agenda: 'Agenda' },
  showAs: 'Show the calendar by',
  moveThrough: 'Move through the calendar',
  newRecord: 'New',
  newRecordNoun: 'New {record}',
  allDay: 'All day',
  time: 'Time',
  loadFailed: 'The calendar could not be loaded.',
  retry: 'Try again',
  nothing: 'Nothing on these days.',
  more: '+{n} more',
  moreOn: '{n} more on {when}',
  noResource: 'No one',
  tooMany: 'Showing the first {shown} of {total}: search for fewer to see them all.',
  fromTo: '{from} to {to}',
  withWho: 'with {name}',
  free: 'free',
  holds: '{n} records',
  holdsNoun: '{n} {records}',
  holdsOne: '1 record',
  holdsNounOne: '1 {record}',
  keysOpen: 'Enter opens it.',
  keysMove: 'M moves it.',
  keysOpenMove: 'Enter opens it. M moves it.',
  keysSlots: 'The arrow keys move between days and times; Enter makes a new record there.',
  keysSlotsNoun: 'The arrow keys move between days and times; Enter makes a new {record} there.',
  keysDays: 'The arrow keys move between days; Enter makes a new record there.',
  keysDaysNoun: 'The arrow keys move between days; Enter makes a new {record} there.',
  moveTo: 'Move to…',
  moveTitle: 'Move {name}',
  moveDay: 'Day',
  moveTime: 'Starts at',
  move: 'Move',
  cancel: 'Cancel',
  badDay: 'Pick a day from {from} to {to}.',
  badTime: 'Pick a time.',
  moved: 'Moved {name} to {when}.',
  stretched: '{name} now ends at {when}.',
  undo: 'Undo',
  undone: 'Put back as it was.',
  close: 'Close',
  notMoved: 'Not moved: {why}',
  cannotMove: 'You cannot change this one.',
  saving: 'Saving…',
};

const ar: CalendarLabels = {
  calendar: 'التقويم',
  today: 'اليوم',
  previous: { day: 'اليوم السابق', week: 'الأسبوع السابق', month: 'الشهر السابق', agenda: 'الأسبوع السابق' },
  next: { day: 'اليوم التالي', week: 'الأسبوع التالي', month: 'الشهر التالي', agenda: 'الأسبوع التالي' },
  views: { day: 'يوم', week: 'أسبوع', month: 'شهر', agenda: 'جدول' },
  showAs: 'عرض التقويم حسب',
  moveThrough: 'التنقل في التقويم',
  newRecord: 'جديد',
  allDay: 'طوال اليوم',
  time: 'الوقت',
  loadFailed: 'تعذّر تحميل التقويم.',
  retry: 'حاول مرة أخرى',
  nothing: 'لا شيء في هذه الأيام.',
  more: '+{n} أخرى',
  moreOn: '{n} أخرى يوم {when}',
  noResource: 'بلا أحد',
  tooMany: 'يُعرض أول {shown} من {total}: ضيّق البحث لترى الكل.',
  fromTo: 'من {from} إلى {to}',
  withWho: 'مع {name}',
  free: 'متاح',
  holds: '{n} سجلات',
  holdsOne: 'سجل واحد',
  keysOpen: 'زر الإدخال يفتحه.',
  keysMove: 'حرف M ينقله.',
  keysOpenMove: 'زر الإدخال يفتحه. حرف M ينقله.',
  keysSlots: 'مفاتيح الأسهم تتنقل بين الأيام والأوقات، وزر الإدخال ينشئ سجلًا جديدًا هناك.',
  keysDays: 'مفاتيح الأسهم تتنقل بين الأيام، وزر الإدخال ينشئ سجلًا جديدًا هناك.',
  moveTo: 'نقل إلى…',
  moveTitle: 'نقل {name}',
  moveDay: 'اليوم',
  moveTime: 'يبدأ في',
  move: 'نقل',
  cancel: 'إلغاء',
  badDay: 'اختر يومًا من {from} إلى {to}.',
  badTime: 'اختر وقتًا.',
  moved: 'نُقل {name} إلى {when}.',
  stretched: 'صار {name} ينتهي في {when}.',
  undo: 'تراجع',
  undone: 'أُعيد كما كان.',
  close: 'إغلاق',
  notMoved: 'لم يُنقل: {why}',
  cannotMove: 'لا يمكنك تغيير هذا السجل.',
  saving: 'جارٍ الحفظ…',
};

const fr: CalendarLabels = {
  calendar: 'Calendrier',
  today: 'Aujourd’hui',
  previous: { day: 'Jour précédent', week: 'Semaine précédente', month: 'Mois précédent', agenda: 'Semaine précédente' },
  next: { day: 'Jour suivant', week: 'Semaine suivante', month: 'Mois suivant', agenda: 'Semaine suivante' },
  views: { day: 'Jour', week: 'Semaine', month: 'Mois', agenda: 'Agenda' },
  showAs: 'Afficher le calendrier par',
  moveThrough: 'Parcourir le calendrier',
  newRecord: 'Nouveau',
  allDay: 'Toute la journée',
  time: 'Heure',
  loadFailed: 'Le calendrier n’a pas pu être chargé.',
  retry: 'Réessayer',
  nothing: 'Rien ces jours-ci.',
  more: '+{n} de plus',
  moreOn: '{n} de plus le {when}',
  noResource: 'Personne',
  tooMany: 'Les {shown} premiers sur {total} : affinez la recherche pour tout voir.',
  fromTo: 'de {from} à {to}',
  withWho: 'avec {name}',
  free: 'libre',
  holds: '{n} fiches',
  holdsNoun: '{n} {records}',
  holdsOne: '1 fiche',
  holdsNounOne: '1 {record}',
  keysOpen: 'Entrée l’ouvre.',
  keysMove: 'M le déplace.',
  keysOpenMove: 'Entrée l’ouvre. M le déplace.',
  keysSlots: 'Les flèches passent d’un jour et d’une heure à l’autre ; Entrée crée une fiche à cet endroit.',
  keysDays: 'Les flèches passent d’un jour à l’autre ; Entrée crée une fiche à cet endroit.',
  moveTo: 'Déplacer vers…',
  moveTitle: 'Déplacer {name}',
  moveDay: 'Jour',
  moveTime: 'Commence à',
  move: 'Déplacer',
  cancel: 'Annuler',
  badDay: 'Choisissez un jour du {from} au {to}.',
  badTime: 'Choisissez une heure.',
  moved: '{name} déplacé au {when}.',
  stretched: '{name} se termine maintenant à {when}.',
  undo: 'Annuler',
  undone: 'Remis comme avant.',
  close: 'Fermer',
  notMoved: 'Pas déplacé : {why}',
  cannotMove: 'Vous ne pouvez pas modifier celle-ci.',
  saving: 'Enregistrement…',
};

const de: CalendarLabels = {
  calendar: 'Kalender',
  today: 'Heute',
  previous: { day: 'Vorheriger Tag', week: 'Vorherige Woche', month: 'Vorheriger Monat', agenda: 'Vorherige Woche' },
  next: { day: 'Nächster Tag', week: 'Nächste Woche', month: 'Nächster Monat', agenda: 'Nächste Woche' },
  views: { day: 'Tag', week: 'Woche', month: 'Monat', agenda: 'Agenda' },
  showAs: 'Kalender zeigen nach',
  moveThrough: 'Durch den Kalender blättern',
  newRecord: 'Neu',
  newRecordNoun: 'Neu: {record}',
  allDay: 'Ganztägig',
  time: 'Uhrzeit',
  loadFailed: 'Der Kalender konnte nicht geladen werden.',
  retry: 'Erneut versuchen',
  nothing: 'An diesen Tagen ist nichts.',
  more: '+{n} weitere',
  moreOn: '{n} weitere am {when}',
  noResource: 'Niemand',
  tooMany: 'Die ersten {shown} von {total}: Suche enger, um alle zu sehen.',
  fromTo: '{from} bis {to}',
  withWho: 'mit {name}',
  free: 'frei',
  holds: '{n} Einträge',
  holdsNoun: '{n} {records}',
  holdsOne: '1 Eintrag',
  holdsNounOne: '1 {record}',
  keysOpen: 'Eingabe öffnet ihn.',
  keysMove: 'M verschiebt ihn.',
  keysOpenMove: 'Eingabe öffnet ihn. M verschiebt ihn.',
  keysSlots: 'Die Pfeiltasten wechseln zwischen Tagen und Zeiten; Eingabe legt dort einen neuen Eintrag an.',
  keysDays: 'Die Pfeiltasten wechseln zwischen Tagen; Eingabe legt dort einen neuen Eintrag an.',
  moveTo: 'Verschieben nach…',
  moveTitle: '{name} verschieben',
  moveDay: 'Tag',
  moveTime: 'Beginnt um',
  move: 'Verschieben',
  cancel: 'Abbrechen',
  badDay: 'Wählen Sie einen Tag vom {from} bis zum {to}.',
  badTime: 'Wählen Sie eine Uhrzeit.',
  moved: '{name} verschoben auf {when}.',
  stretched: '{name} endet jetzt um {when}.',
  undo: 'Rückgängig',
  undone: 'Wie vorher zurückgesetzt.',
  close: 'Schließen',
  notMoved: 'Nicht verschoben: {why}',
  cannotMove: 'Diesen Eintrag können Sie nicht ändern.',
  saving: 'Wird gespeichert…',
};

export const CALENDAR_LABELS: Record<Locale, CalendarLabels> = { en, ar, fr, de };

/** The calendar's words in a page's language, the app's own over them. */
export function calendarLabels(locale: Locale, own?: Partial<CalendarLabels>): CalendarLabels {
  const words: CalendarLabels = { ...(CALENDAR_LABELS[locale] ?? en), ...own };
  // A sentence the app gives without its sentence in a page's words for its records says its own on that page too.
  for (const [noun, plain] of NOUNS) if (own && !(noun in own) && plain in own) delete words[noun];
  return words;
}

/** Each sentence in a page's words for its records, and the sentence it stands for. */
const NOUNS = [
  ['newRecordNoun', 'newRecord'],
  ['holdsNoun', 'holds'],
  ['holdsNounOne', 'holdsOne'],
  ['keysSlotsNoun', 'keysSlots'],
  ['keysDaysNoun', 'keysDays'],
] as const;

/** Words with their `{name}`s filled in. */
export const fill = (words: string, values: Record<string, string | number>) => words.replace(/\{(\w+)\}/g, (all, key: string) => (key in values ? String(values[key]) : all));
