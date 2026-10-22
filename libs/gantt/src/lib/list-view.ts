import { tableInChunks, wordsInChunks, type ListNode, type Locale } from '@fieldia/core';
import type { ListViewContext, ListViewFactory, ListViewPart } from '@fieldia/viewer';
import type { GanttLabels } from './labels';
import type { GanttSettings } from './settings';

/**
 * Its name on the list's switcher, and what it says should its code not come: words that show before the timeline's own
 * code has come. Turkish, Persian, Urdu and Spanish — UNREVIEWED: machine-assisted, not yet reviewed by a native speaker —
 * come in chunks of their own (the timeline's words' own, locales/), fetched where they are spoken, before a page in one
 * is drawn (`wordsReady` in @fieldia/core): a page in any other language never carries them.
 */
const WORDS = {
  en: { timeline: 'Timeline', loadFailed: 'The timeline could not be loaded.' },
  ar: { timeline: 'المخطط الزمني', loadFailed: 'تعذّر تحميل المخطط الزمني.' },
  fr: { timeline: 'Planning', loadFailed: 'Le planning n’a pas pu être chargé.' },
  de: { timeline: 'Zeitplan', loadFailed: 'Der Zeitplan konnte nicht geladen werden.' },
} as Record<Locale, Pick<GanttLabels, 'timeline' | 'loadFailed'>>;
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
 * A list's records on a Gantt timeline, for the viewer's `listViews`: a list
 * with `gantt` offers Timeline beside its table, and opens on it when the
 * page says `opens: "gantt"`. The timeline's own code loads the first time
 * one is shown, in a chunk of its own.
 *
 *     mountViewer(host, { page, listViews: { ...ganttListViews(), ...calendarListViews() } })
 */
export function ganttListViews(settings: GanttSettings = {}): Record<string, ListViewFactory> {
  const gantt: ListViewFactory = Object.assign((context: ListViewContext) => lazyGantt(context, settings), {
    label: (locale: Locale) => settings.labels?.[locale]?.timeline ?? wordsOf(locale).timeline,
    opens: (node: ListNode) => node.gantt?.opens === 'gantt',
  });
  return { gantt };
}

/** The timeline's place at once, busy; the timeline in it once its code has come. */
function lazyGantt(context: ListViewContext, settings: GanttSettings): ListViewPart {
  const element = context.document.createElement('div');
  element.className = 'fd-gantt-holder';
  element.setAttribute('aria-busy', 'true');
  let part: ListViewPart | null = null;
  let gone = false;
  const ready: Promise<ListViewPart | null> = import('./gantt-view').then(
    async ({ ganttPart, ganttWordsReady }) => {
      await ganttWordsReady(context.locale);
      if (gone) return null;
      part = ganttPart(context, settings);
      element.replaceChildren(part.element);
      element.removeAttribute('aria-busy');
      return part;
    },
    () => {
      element.removeAttribute('aria-busy');
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
      part?.destroy();
    },
  };
}
