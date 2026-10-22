import type { ListNode, Locale } from '@fieldia/core';
import type { ListViewContext, ListViewFactory, ListViewPart } from '@fieldia/viewer';
import type { CalendarSettings } from './settings';

/** Its name on the list's switcher, which shows before the calendar's own code has come. */
// Turkish, Persian, Urdu and Spanish — UNREVIEWED: machine-assisted, not yet reviewed by a native speaker.
const NAME: Record<Locale, string> = { en: 'Calendar', ar: 'التقويم', fr: 'Calendrier', de: 'Kalender', tr: 'Takvim', fa: 'تقویم', ur: 'کیلنڈر', es: 'Calendario' };
const FAILED: Record<Locale, string> = { en: 'The calendar could not be loaded.', ar: 'تعذّر تحميل التقويم.', fr: 'Le calendrier n’a pas pu être chargé.', de: 'Der Kalender konnte nicht geladen werden.', tr: 'Takvim yüklenemedi.', fa: 'تقویم بارگیری نشد.', ur: 'کیلنڈر لوڈ نہیں ہو سکا۔', es: 'No se pudo cargar el calendario.' };

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
    label: (locale: Locale) => settings.labels?.[locale]?.calendar ?? NAME[locale] ?? NAME.en,
    opens: (node: ListNode) => node.calendar?.opens === 'calendar',
  });
  return { calendar };
}

/** The calendar's place at once, busy; the calendar in it once its code has come. */
function lazyCalendar(context: ListViewContext, settings: CalendarSettings): ListViewPart {
  const element = context.document.createElement('div');
  element.className = 'fd-cal-holder';
  element.setAttribute('aria-busy', 'true');
  let part: ListViewPart | null = null;
  let gone = false;
  const ready: Promise<ListViewPart | null> = import('./calendar-view').then(
    async ({ calendarPart, calendarWordsReady }) => {
      await calendarWordsReady(context.locale);
      if (gone) return null;
      part = calendarPart(context, settings);
      element.replaceChildren(part.element);
      element.removeAttribute('aria-busy');
      return part;
    },
    () => {
      element.removeAttribute('aria-busy');
      element.setAttribute('role', 'alert');
      element.textContent = settings.labels?.[context.locale]?.loadFailed ?? FAILED[context.locale] ?? FAILED.en;
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
      part?.destroy();
    },
  };
}
