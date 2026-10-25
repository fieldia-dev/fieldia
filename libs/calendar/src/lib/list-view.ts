import { tableInChunks, wordsInChunks, type ListNode, type Locale } from '@fieldia/core';
import type { ListViewContext, ListViewFactory, ListViewPart } from '@fieldia/viewer';
import { startLoading } from '@fieldia/widgets';
import type { CalendarLabels } from './labels';
import type { CalendarSettings } from './settings';

/**
 * Its name on the list's switcher, and what it says should its code not come: words that show before the calendar's own
 * code has come. Turkish, Persian, Urdu and Spanish — UNREVIEWED: machine-assisted, not yet reviewed by a native speaker —
 * come in chunks of their own (the calendar's words' own, locales/), fetched where they are spoken, before a page in one
 * is drawn (`wordsReady` in @fieldia/core): a page in any other language never carries them.
 */
const WORDS = {
  en: { calendar: 'Calendar', loadFailed: 'The calendar could not be loaded.' },
  ar: { calendar: 'التقويم', loadFailed: 'تعذّر تحميل التقويم.' },
  fr: { calendar: 'Calendrier', loadFailed: 'Le calendrier n’a pas pu être chargé.' },
  de: { calendar: 'Kalender', loadFailed: 'Der Kalender konnte nicht geladen werden.' },
} as Record<Locale, Pick<CalendarLabels, 'calendar' | 'loadFailed'>>;
wordsInChunks(
  tableInChunks(WORDS, {
    tr: () => import('./locales/tr').then((words) => words.tr),
    fa: () => import('./locales/fa').then((words) => words.fa),
    ur: () => import('./locales/ur').then((words) => words.ur),
    es: () => import('./locales/es').then((words) => words.es),
  })
);
const wordsOf = (locale: Locale) => WORDS[locale] ?? WORDS.en;

/**
 * A list's records on a calendar, for the viewer's `listViews`: a list with
 * `calendar` offers Calendar beside its table, and opens on it when the page
 * says `opens: "calendar"`. The calendar's own code loads the first time one
 * is shown, in a chunk of its own.
 *
 *     mountViewer(host, { page, listViews: { ...calendarListViews(), ...mapListViews({ provider }) } })
 */
export function calendarListViews(settings: CalendarSettings = {}): Record<string, ListViewFactory> {
  const calendar: ListViewFactory = Object.assign((context: ListViewContext) => lazyCalendar(context, settings), {
    label: (locale: Locale) => settings.labels?.[locale]?.calendar ?? wordsOf(locale).calendar,
    opens: (node: ListNode) => node.calendar?.opens === 'calendar',
  });
  return { calendar };
}

/**
 * The calendar's place at once, waiting as the list says it waits the first time (its skeleton, unless the page says
 * otherwise) — never an empty space under the list's search while its code comes; the calendar in it once it has, its own
 * first wait going on from this one, drawn at once where this one was in sight.
 */
function lazyCalendar(context: ListViewContext, settings: CalendarSettings): ListViewPart {
  const element = context.document.createElement('div');
  element.className = 'fd-cal-holder';
  const coming = startLoading(element, 'first', context.loading, { part: `${context.node.id}-calendar` });
  let part: ListViewPart | null = null;
  let gone = false;
  const ready: Promise<ListViewPart | null> = import('./calendar-view').then(
    async ({ calendarPart, calendarWordsReady }) => {
      await calendarWordsReady(context.locale);
      if (gone) return null;
      const now = coming.shown;
      coming.stop();
      part = calendarPart(context, settings, now);
      element.replaceChildren(part.element);
      return part;
    },
    () => {
      coming.stop();
      element.setAttribute('role', 'alert');
      element.textContent = settings.labels?.[context.locale]?.loadFailed ?? wordsOf(context.locale).loadFailed;
      return null;
    }
  );
  return {
    element,
    reload: () => ready.then((loaded) => loaded?.reload()),
    highlight: (id) => part?.highlight(id),
    chosenChanged: () => part?.chosenChanged(),
    shown: () => void ready.then((loaded) => loaded?.shown()),
    destroy() {
      gone = true;
      coming.stop();
      part?.destroy();
    },
  };
}
