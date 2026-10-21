import type { GanttZoom, Locale } from '@fieldia/core';

/** The words a Gantt timeline shows itself. `{name}`, `{when}`, `{n}` are filled in where they stand. */
export interface GanttLabels {
  /** Its name on the list's switcher, and for a screen reader. */
  timeline: string;
  today: string;
  /** The scales: a column for each day, week or month. */
  zooms: Record<GanttZoom, string>;
  /** The group of Days, Weeks and Months, for a screen reader. */
  showAs: string;
  /** The group of the records with no value in the group field. */
  noGroup: string;
  /** A group's heading pressed: its bars hidden, or shown again. */
  collapse: string;
  expand: string;
  /** How many a group holds: "4 records"; in the words a page names its records by (`Page.records`): `{records}`. */
  holds: string;
  holdsOne: string;
  holdsNoun?: string;
  holdsNounOne?: string;
  loadFailed: string;
  retry: string;
  nothing: string;
  tooMany: string;
  /** A record with no start: its row, and no bar. */
  notPlanned: string;
  /** How long a bar is: "Mon 12 Oct to Fri 16 Oct". */
  fromTo: string;
  /** A milestone, a bar that ends as it starts: "on Fri 30 Oct". */
  on: string;
  /** How many days it lasts. */
  days: string;
  dayOne: string;
  /** The records it waits for: "waits for Plastering, Wiring". */
  waitsFor: string;
  /** Said of one that starts before a record it waits for ends. */
  late: string;
  keysOpen: string;
  keysMove: string;
  keysRows: string;
  moved: string;
  stretched: string;
  started: string;
  undo: string;
  undone: string;
  close: string;
  notMoved: string;
  /** Why a record cannot be moved, when its source gives no reason of its own. */
  cannotMove: string;
}

const en: GanttLabels = {
  timeline: 'Timeline',
  today: 'Today',
  zooms: { day: 'Days', week: 'Weeks', month: 'Months' },
  showAs: 'Show the timeline by',
  noGroup: 'None',
  collapse: 'Hide {name}',
  expand: 'Show {name}',
  holds: '{n} records',
  holdsOne: '1 record',
  holdsNoun: '{n} {records}',
  holdsNounOne: '1 {record}',
  loadFailed: 'The timeline could not be loaded.',
  retry: 'Try again',
  nothing: 'Nothing to show on the timeline.',
  tooMany: 'Showing the first {shown} of {total}: search for fewer to see them all.',
  notPlanned: 'No start yet',
  fromTo: '{from} to {to}',
  on: 'on {day}',
  days: '{n} days',
  dayOne: '1 day',
  waitsFor: 'waits for {names}',
  late: 'starts before {name} ends',
  keysOpen: 'Enter opens it.',
  keysMove: 'The left and right arrow keys move it a day; with Shift, its end.',
  keysRows: 'The up and down arrow keys reach the bar above or below.',
  moved: 'Moved {name}: {from} to {to}.',
  stretched: '{name} now ends {when}.',
  started: '{name} now starts {when}.',
  undo: 'Undo',
  undone: 'Put back as it was.',
  close: 'Close',
  notMoved: 'Not moved: {why}',
  cannotMove: 'You cannot change this one.',
};

const ar: GanttLabels = {
  timeline: 'المخطط الزمني',
  today: 'اليوم',
  zooms: { day: 'أيام', week: 'أسابيع', month: 'شهور' },
  showAs: 'عرض المخطط الزمني حسب',
  noGroup: 'بلا مجموعة',
  collapse: 'إخفاء {name}',
  expand: 'إظهار {name}',
  holds: '{n} سجلات',
  holdsOne: 'سجل واحد',
  loadFailed: 'تعذّر تحميل المخطط الزمني.',
  retry: 'حاول مرة أخرى',
  nothing: 'لا شيء لعرضه على المخطط الزمني.',
  tooMany: 'يُعرض أول {shown} من {total}: ضيّق البحث لترى الكل.',
  notPlanned: 'لم يُحدَّد موعد بدئه بعد',
  fromTo: 'من {from} إلى {to}',
  on: 'في {day}',
  days: '{n} أيام',
  dayOne: 'يوم واحد',
  waitsFor: 'ينتظر {names}',
  late: 'يبدأ قبل أن ينتهي {name}',
  keysOpen: 'زر الإدخال يفتحه.',
  keysMove: 'السهمان الأيمن والأيسر ينقلانه يومًا، ومع Shift ينقلان نهايته.',
  keysRows: 'السهمان لأعلى ولأسفل ينتقلان إلى الشريط السابق أو التالي.',
  moved: 'نُقل {name}: من {from} إلى {to}.',
  stretched: 'صار {name} ينتهي {when}.',
  started: 'صار {name} يبدأ {when}.',
  undo: 'تراجع',
  undone: 'أُعيد كما كان.',
  close: 'إغلاق',
  notMoved: 'لم يُنقل: {why}',
  cannotMove: 'لا يمكنك تغيير هذا السجل.',
};

const fr: GanttLabels = {
  timeline: 'Planning',
  today: 'Aujourd’hui',
  zooms: { day: 'Jours', week: 'Semaines', month: 'Mois' },
  showAs: 'Afficher le planning par',
  noGroup: 'Aucun',
  collapse: 'Masquer {name}',
  expand: 'Afficher {name}',
  holds: '{n} fiches',
  holdsOne: '1 fiche',
  holdsNoun: '{n} {records}',
  holdsNounOne: '1 {record}',
  loadFailed: 'Le planning n’a pas pu être chargé.',
  retry: 'Réessayer',
  nothing: 'Rien à montrer sur le planning.',
  tooMany: 'Les {shown} premiers sur {total} : affinez la recherche pour tout voir.',
  notPlanned: 'Pas encore de début',
  fromTo: 'du {from} au {to}',
  on: 'le {day}',
  days: '{n} jours',
  dayOne: '1 jour',
  waitsFor: 'attend {names}',
  late: 'commence avant la fin de {name}',
  keysOpen: 'Entrée l’ouvre.',
  keysMove: 'Les flèches gauche et droite le déplacent d’un jour ; avec Maj, sa fin.',
  keysRows: 'Les flèches haut et bas passent à la barre au-dessus ou en dessous.',
  moved: '{name} déplacé : du {from} au {to}.',
  stretched: '{name} se termine maintenant le {when}.',
  started: '{name} commence maintenant le {when}.',
  undo: 'Annuler',
  undone: 'Remis comme avant.',
  close: 'Fermer',
  notMoved: 'Pas déplacé : {why}',
  cannotMove: 'Vous ne pouvez pas modifier celle-ci.',
};

const de: GanttLabels = {
  timeline: 'Zeitplan',
  today: 'Heute',
  zooms: { day: 'Tage', week: 'Wochen', month: 'Monate' },
  showAs: 'Zeitplan zeigen nach',
  noGroup: 'Keine',
  collapse: '{name} ausblenden',
  expand: '{name} einblenden',
  holds: '{n} Einträge',
  holdsOne: '1 Eintrag',
  holdsNoun: '{n} {records}',
  holdsNounOne: '1 {record}',
  loadFailed: 'Der Zeitplan konnte nicht geladen werden.',
  retry: 'Erneut versuchen',
  nothing: 'Im Zeitplan ist nichts zu zeigen.',
  tooMany: 'Die ersten {shown} von {total}: Suche enger, um alle zu sehen.',
  notPlanned: 'Noch kein Beginn',
  fromTo: '{from} bis {to}',
  on: 'am {day}',
  days: '{n} Tage',
  dayOne: '1 Tag',
  waitsFor: 'wartet auf {names}',
  late: 'beginnt, bevor {name} endet',
  keysOpen: 'Eingabe öffnet ihn.',
  keysMove: 'Die Pfeiltasten links und rechts verschieben ihn um einen Tag; mit Umschalt sein Ende.',
  keysRows: 'Die Pfeiltasten auf und ab erreichen den Balken darüber oder darunter.',
  moved: '{name} verschoben: {from} bis {to}.',
  stretched: '{name} endet jetzt {when}.',
  started: '{name} beginnt jetzt {when}.',
  undo: 'Rückgängig',
  undone: 'Wie vorher zurückgesetzt.',
  close: 'Schließen',
  notMoved: 'Nicht verschoben: {why}',
  cannotMove: 'Diesen Eintrag können Sie nicht ändern.',
};

export const GANTT_LABELS: Record<Locale, GanttLabels> = { en, ar, fr, de };

/** The timeline's words in a page's language, the app's own over them. */
export function ganttLabels(locale: Locale, own?: Partial<GanttLabels>): GanttLabels {
  const words: GanttLabels = { ...(GANTT_LABELS[locale] ?? en), ...own };
  // A sentence the app gives without its sentence in a page's words for its records says its own on that page too.
  if (own && !('holdsNoun' in own) && 'holds' in own) delete words.holdsNoun;
  if (own && !('holdsNounOne' in own) && 'holdsOne' in own) delete words.holdsNounOne;
  return words;
}

/** Words with their `{name}`s filled in. */
export const fill = (words: string, values: Record<string, string | number>) => words.replace(/\{(\w+)\}/g, (all, key: string) => (key in values ? String(values[key]) : all));
