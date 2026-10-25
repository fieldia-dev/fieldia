import type { DataSource, MemoryDataSource, SaveRequest } from '@fieldia/core';
import { mountViewer, type ViewerHandle } from '@fieldia/viewer';
import { ganttListViews } from './list-view';
import { fitoutPage, fitoutSource, key, NOW, until } from './test-gantt';

/**
 * A bar moved is drawn once (the performance audit's M5 and its forced layouts): at once, as it is moved, and not again
 * when the save comes back with what is shown already — 0.32 drew the whole chart twice for each drop, 520 ms on a
 * desktop at 500 tasks. A save that changes what is shown (refused, so put back; or the app's own change) is drawn.
 */

let handle: ViewerHandle | null = null;
afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
});

const bar = (host: Element, name: string) => [...host.querySelectorAll<HTMLElement>('.fd-gantt-task')].find((b) => b.textContent === name) as HTMLElement;
const saves = (source: MemoryDataSource) => source.calls.filter((call) => call.method === 'save').map((call) => call.request as SaveRequest);
const settle = () => until(() => !document.querySelector('.fd-gantt-body[aria-busy]'));

async function mounted(dataSource: DataSource) {
  const host = document.createElement('div');
  document.body.append(host);
  handle = mountViewer(host, { page: fitoutPage(), dataSource, listViews: ganttListViews({ now: () => NOW }) });
  await until(() => host.querySelector('.fd-gantt-body:not([aria-busy]) .fd-gantt-sheet'));
  // Each drawing of the chart: its sheet made anew.
  const drawn = { count: 0 };
  new MutationObserver((changes) => {
    for (const change of changes) for (const node of change.addedNodes) if (node instanceof Element && node.classList.contains('fd-gantt-scroll')) drawn.count++;
  }).observe(host.querySelector('.fd-gantt-body') as Element, { childList: true });
  return { host, drawn };
}

describe('a bar moved on the timeline', () => {
  it('is drawn once: as it is moved, not again when the save brings back what is shown', async () => {
    const source = fitoutSource();
    const { host, drawn } = await mounted(source);
    bar(host, 'Wiring').focus();
    key(bar(host, 'Wiring'), 'ArrowRight');
    await until(() => saves(source).length === 1);
    await settle();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(drawn.count).toBe(1);
    expect(bar(host, 'Wiring').getAttribute('aria-label')).toContain('Thu 15 Oct to Sat 17 Oct');
    // The keys are still on it, and the next move goes with the version the save gave.
    expect(document.activeElement).toBe(bar(host, 'Wiring'));
  });

  it('is drawn again where the save changes what is shown: refused, it is put back', async () => {
    const source = fitoutSource();
    const refusing: DataSource = {
      ...source,
      save: async () => {
        throw Object.assign(new Error('The site is closed that week.'), { kind: 'business' });
      },
    };
    const { host, drawn } = await mounted(refusing);
    bar(host, 'Wiring').focus();
    key(bar(host, 'Wiring'), 'ArrowRight');
    await until(() => host.querySelector('.fd-gantt-alert')?.textContent);
    await settle();
    expect(drawn.count).toBe(2);
    expect(bar(host, 'Wiring').getAttribute('aria-label')).toContain('Wed 14 Oct to Fri 16 Oct');
  });
});
