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
  /** The signs at either edge of the days shown: how many bars run off them (`{n}`), pressed to go on to them. */
  edgeBefore: string;
  edgeAfter: string;
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
  edgeBefore: 'Before the days shown: {n}',
  edgeAfter: 'After the days shown: {n}',
};

/**
 * The timeline's words in each language it speaks: English at once; every other — Arabic, German and French (0.35), and
 * Turkish, Persian, Urdu and Spanish, UNREVIEWED: machine-assisted, not yet reviewed by a native speaker (locales/) — in a
 * chunk of its own, fetched with the first timeline shown in it (`ganttWordsReady`): a timeline in any other language never
 * carries its words.
 */
export const GANTT_LABELS: Partial<Record<Locale, GanttLabels>> = { en };
const LATER: Partial<Record<Locale, () => Promise<Partial<Record<Locale, GanttLabels>>>>> = {
  ar: () => import('./locales/ar'),
  de: () => import('./locales/de'),
  fr: () => import('./locales/fr'),
  tr: () => import('./locales/tr'),
  fa: () => import('./locales/fa'),
  ur: () => import('./locales/ur'),
  es: () => import('./locales/es'),
};

/** The timeline's words in `locale`, fetched where they come in a chunk of their own; English where they cannot be. */
export async function ganttWordsReady(locale: Locale): Promise<void> {
  const load = LATER[locale];
  if (!load || GANTT_LABELS[locale]) return;
  try {
    GANTT_LABELS[locale] = (await load())[locale];
  } catch {
    // Their chunk could not be fetched: the timeline speaks English rather than nothing.
  }
}

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
