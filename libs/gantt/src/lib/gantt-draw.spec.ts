import { createMemoryDataSource, type DataSource, type MemoryDataSource, type Page, type SaveRequest, type Values } from '@fieldia/core';
import { mountViewer, type ViewerHandle } from '@fieldia/viewer';
import { ganttListViews } from './list-view';
import { fitoutPage, fitoutSource, key, NOW, until } from './test-gantt';

/**
 * A bar moved is written in place (the performance audit's M5): its bar, its row among its group's, its group's span,
 * the arrows and what they make late — never the chart drawn anew, nor the save's answer drawn again where it brings
 * back what is shown (0.32 drew the whole chart twice for each drop, 520 ms on a desktop at 500 tasks; 0.34 once). A
 * change of scale moves the bars and draws the axis, the lines and the arrows anew, every row kept. Held to the chart
 * drawn whole for the same records and scale: the same, element for element. A save that changes what is shown
 * (refused, so put back; or the app's own change) is drawn whole.
 */

const handles: ViewerHandle[] = [];
afterEach(() => {
  for (const handle of handles.splice(0)) handle.destroy();
  document.body.replaceChildren();
});

const bar = (host: Element, name: string) => [...host.querySelectorAll<HTMLElement>('.fd-gantt-task')].find((b) => b.textContent === name) as HTMLElement;
const saves = (source: MemoryDataSource) => source.calls.filter((call) => call.method === 'save').map((call) => call.request as SaveRequest);
const settle = () => until(() => !document.querySelector('.fd-gantt-body[aria-busy], .fd-gantt-task[aria-busy]'));

async function mounted(dataSource: DataSource, page: Page = fitoutPage()) {
  const host = document.createElement('div');
  document.body.append(host);
  handles.push(mountViewer(host, { page, dataSource, listViews: ganttListViews({ now: () => NOW }) }));
  await until(() => host.querySelector('.fd-gantt-body:not([aria-busy]) .fd-gantt-sheet'));
  // Each drawing of the chart: its sheet made anew.
  const drawn = { count: 0 };
  new MutationObserver((changes) => {
    for (const change of changes) for (const node of change.addedNodes) if (node instanceof Element && node.classList.contains('fd-gantt-scroll')) drawn.count++;
  }).observe(host.querySelector('.fd-gantt-body') as Element, { childList: true });
  return { host, drawn };
}

/**
 * A chart as it reads, element by element: each one's tag, its attributes in order of their names, its words. Its ids
 * — numbered by the timelines made before it — alike, and the keys' one stop left out: it stands where the keys were.
 */
function read(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? '';
  if (!(node instanceof Element)) return '';
  const attrs = [...node.attributes]
    .filter((attr) => attr.name !== 'tabindex')
    .map((attr) => `${attr.name}=${attr.value.replace(/fd-gantt-\d+/g, 'fd-gantt-N')}`)
    .sort();
  return `<${node.tagName.toLowerCase()} ${attrs.join(' ')}>${[...node.childNodes].map(read).join('')}</>`;
}
const chart = (host: Element) => `${host.querySelector('.fd-gantt-title')?.textContent} ${read(host.querySelector('.fd-gantt-body') as Element)}`;

/** Two charts the same — or where they part first, with what each holds round it: a short difference to read. */
function same(mine: string, whole: string): { mine: string; whole: string } | true {
  if (mine === whole) return true;
  let at = 0;
  while (at < mine.length && mine[at] === whole[at]) at++;
  const from = Math.max(0, at - 200);
  return { mine: mine.slice(from, at + 200), whole: whole.slice(from, at + 200) };
}

/** The same records drawn whole, in a timeline of their own: what the chart written in place is held to. */
async function drawnWhole(records: Record<string, Values>, page: Page) {
  const { host } = await mounted(source(records), page);
  return chart(host);
}

const source = (records: Record<string, Values>) => createMemoryDataSource({ records: { 'fitout.task': JSON.parse(JSON.stringify(records)), 'fitout.trade': { 1: { name: 'Nile Builders' }, 2: { name: 'Sparks Electric' } } } });
const saved = (memory: MemoryDataSource) => memory.records['fitout.task'];

/** A plan of n tasks in phases, each after the one before it in its phase, some too soon. */
function plan(n: number): Record<string, Values> {
  const out: Record<string, Values> = {};
  const day = (d: number) => `2026-10-${String(1 + d).padStart(2, '0')}`;
  for (let i = 1; i <= n; i++) {
    const at = 4 + ((i * 7) % 20);
    out[i] = { name: `Task ${i}`, start: day(at), finish: day(at + 1 + (i % 4)), phase: ['strip', 'first', 'finish'][i % 3], trade: null, after: i > 3 ? [{ id: i - 3, label: `Task ${i - 3}` }] : [] };
  }
  // The whole plan's frame, which no move takes the days shown past: the moves are written in place.
  out[n + 1] = { name: 'Frame', start: '2026-09-26', finish: '2026-10-31', phase: 'strip', trade: null, after: [] };
  return out;
}

describe('a bar moved on the timeline', () => {
  it('is written in place: as it is moved, and not drawn when the save brings back what is shown', async () => {
    const memory = fitoutSource();
    const { host, drawn } = await mounted(memory);
    bar(host, 'Wiring').focus();
    key(bar(host, 'Wiring'), 'ArrowRight');
    await until(() => saves(memory).length === 1);
    await settle();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(drawn.count).toBe(0);
    expect(bar(host, 'Wiring').getAttribute('aria-label')).toContain('Thu 15 Oct to Sat 17 Oct');
    // The keys are still on it, and the next move goes with the version the save gave.
    expect(document.activeElement).toBe(bar(host, 'Wiring'));
    expect(same(chart(host), await drawnWhole(saved(memory), fitoutPage()))).toBe(true);
  });

  it('is drawn again where the save changes what is shown: refused, it is put back', async () => {
    const memory = fitoutSource();
    const refusing: DataSource = {
      ...memory,
      save: async () => {
        throw Object.assign(new Error('The site is closed that week.'), { kind: 'business' });
      },
    };
    const { host, drawn } = await mounted(refusing);
    bar(host, 'Wiring').focus();
    key(bar(host, 'Wiring'), 'ArrowRight');
    await until(() => host.querySelector('.fd-gantt-alert')?.textContent);
    await settle();
    expect(drawn.count).toBe(1);
    expect(bar(host, 'Wiring').getAttribute('aria-label')).toContain('Wed 14 Oct to Fri 16 Oct');
  });

  it('writes in place what a drawing of the moved plan draws: bars, rows in order, spans, arrows, late marks', async () => {
    const page = fitoutPage();
    const memory = source(plan(18));
    const { host, drawn } = await mounted(memory, page);
    // Moves at random from a seed, whole bars and their ends, back and forth: each held to the plan drawn whole.
    let seed = 7;
    const next = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
    for (let move = 0; move < 16; move++) {
      const bars = [...host.querySelectorAll<HTMLElement>('.fd-gantt-task')].filter((one) => one.textContent !== 'Frame');
      const target = bars[Math.floor(next() * bars.length)];
      const name = target.textContent as string;
      const days = 1 + Math.floor(next() * 4);
      const way = next() < 0.5 ? 'ArrowRight' : 'ArrowLeft';
      const end = next() < 0.3;
      target.focus();
      for (let i = 0; i < days; i++) key(target, way, end ? { shiftKey: true } : {});
      // Left, the move is written.
      target.blur();
      await until(() => saves(memory).length === move + 1);
      await settle();
      expect({ move: `${name} ${way} ${days}${end ? ' (end)' : ''}`, same: same(chart(host), await drawnWhole(saved(memory), page)) }).toEqual({ move: `${name} ${way} ${days}${end ? ' (end)' : ''}`, same: true });
      handles.splice(1).forEach((handle) => handle.destroy());
    }
    // Moves that keep within the days shown are each written in place, rows moving among their group's.
    expect(drawn.count).toBe(0);
  });
});

describe('a change of scale', () => {
  it('moves the bars and draws the axis, its lines and the arrows anew, keeping every row: as a drawing at that scale', async () => {
    const records = plan(18);
    const { host, drawn } = await mounted(source(records), fitoutPage());
    const names = [...host.querySelectorAll('.fd-gantt-row[data-id]')];
    for (const zoom of ['week', 'month', 'day'] as const) {
      (host.querySelector(`.fd-gantt-zooms button[data-zoom="${zoom}"]`) as HTMLButtonElement).click();
      expect({ zoom, same: same(chart(host), await drawnWhole(records, fitoutPage({ zoom }))) }).toEqual({ zoom, same: true });
      handles.splice(1).forEach((handle) => handle.destroy());
    }
    expect(drawn.count).toBe(0);
    // The very rows drawn at first.
    expect([...host.querySelectorAll('.fd-gantt-row[data-id]')]).toEqual(names);
  });
});
