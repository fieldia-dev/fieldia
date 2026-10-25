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

/**
 * The calendar's words in each language it speaks: English at once; every other — Arabic, German and French (0.35), and
 * Turkish, Persian, Urdu and Spanish, UNREVIEWED: machine-assisted, not yet reviewed by a native speaker (locales/) — in a
 * chunk of its own, fetched with the first calendar shown in it (`calendarWordsReady`): a calendar in any other language never
 * carries its words.
 */
export const CALENDAR_LABELS: Partial<Record<Locale, CalendarLabels>> = { en };
const LATER: Partial<Record<Locale, () => Promise<Partial<Record<Locale, CalendarLabels>>>>> = {
  ar: () => import('./locales/ar'),
  de: () => import('./locales/de'),
  fr: () => import('./locales/fr'),
  tr: () => import('./locales/tr'),
  fa: () => import('./locales/fa'),
  ur: () => import('./locales/ur'),
  es: () => import('./locales/es'),
};

/** The calendar's words in `locale`, fetched where they come in a chunk of their own; English where they cannot be. */
export async function calendarWordsReady(locale: Locale): Promise<void> {
  const load = LATER[locale];
  if (!load || CALENDAR_LABELS[locale]) return;
  try {
    CALENDAR_LABELS[locale] = (await load())[locale];
  } catch {
    // Their chunk could not be fetched: the calendar speaks English rather than nothing.
  }
}

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
