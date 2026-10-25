import { tableInChunks, wordsInChunks, type ListNode, type Locale } from '@fieldia/core';
import type { ListViewContext, ListViewFactory, ListViewPart } from '@fieldia/viewer';
import { startLoading } from '@fieldia/widgets';
import type { GanttLabels } from './labels';
import type { GanttSettings } from './settings';

/**
 * Its name on the list's switcher, and what it says should its code not come: words that show before the timeline's own
 * code has come. Every language but English — Arabic, German and French (0.35), and Turkish, Persian, Urdu and Spanish,
 * UNREVIEWED: machine-assisted, not yet reviewed by a native speaker — comes in chunks of its own (the timeline's words' own, locales/), fetched where they are spoken, before a page in one
 * is drawn (`wordsReady` in @fieldia/core): a page in any other language never carries them.
 */
const WORDS = {
  en: { timeline: 'Timeline', loadFailed: 'The timeline could not be loaded.' },
} as Record<Locale, Pick<GanttLabels, 'timeline' | 'loadFailed'>>;
wordsInChunks(
  tableInChunks(WORDS, {
    ar: () => import('./locales/ar').then((words) => words.ar),
    de: () => import('./locales/de').then((words) => words.de),
    fr: () => import('./locales/fr').then((words) => words.fr),
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

/**
 * The timeline's place at once, waiting as the list says it waits the first time (its skeleton, unless the page says
 * otherwise) — never an empty space under the list's search while its code comes; the timeline in it once it has, its own
 * first wait going on from this one, drawn at once where this one was in sight.
 */
function lazyGantt(context: ListViewContext, settings: GanttSettings): ListViewPart {
  const element = context.document.createElement('div');
  element.className = 'fd-gantt-holder';
  const coming = startLoading(element, 'first', context.loading, { part: `${context.node.id}-gantt` });
  let part: ListViewPart | null = null;
  let gone = false;
  const ready: Promise<ListViewPart | null> = import('./gantt-view').then(
    async ({ ganttPart, ganttWordsReady }) => {
      await ganttWordsReady(context.locale);
      if (gone) return null;
      const now = coming.shown;
      coming.stop();
      part = ganttPart(context, settings, now);
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
