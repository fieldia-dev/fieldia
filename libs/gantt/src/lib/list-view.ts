import type { ListNode, Locale } from '@fieldia/core';
import type { ListViewContext, ListViewFactory, ListViewPart } from '@fieldia/viewer';
import type { GanttSettings } from './settings';

/** Its name on the list's switcher, which shows before the timeline's own code has come. */
const NAME: Record<Locale, string> = { en: 'Timeline', ar: 'المخطط الزمني', fr: 'Planning', de: 'Zeitplan' };
const FAILED: Record<Locale, string> = { en: 'The timeline could not be loaded.', ar: 'تعذّر تحميل المخطط الزمني.', fr: 'Le planning n’a pas pu être chargé.', de: 'Der Zeitplan konnte nicht geladen werden.' };

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
    label: (locale: Locale) => settings.labels?.[locale]?.timeline ?? NAME[locale] ?? NAME.en,
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
    ({ ganttPart }) => {
      if (gone) return null;
      part = ganttPart(context, settings);
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
