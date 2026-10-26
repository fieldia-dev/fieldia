import type { DataSource, ListedRecord, MemoryDataSource, Page, SaveRequest } from '@fieldia/core';
import { mountViewer, type ViewerHandle, type ViewerOptions } from '@fieldia/viewer';
import { ganttListViews } from './list-view';
import { fitoutPage, fitoutRecords, fitoutSource, key, NOW, until } from './test-gantt';

/**
 * A list's records on a Gantt timeline, in the viewer as an app mounts it:
 * offered on the list's switcher, its bars in their groups, the arrows from
 * what each waits for, today's line; moved and stretched by the pointer and
 * a day at a time by the keys, each move written through the source's save —
 * only the fields it changes — with Undo; a record that is locked kept
 * still; right to left; on paper, the whole plan on the page.
 */

let handle: ViewerHandle | null = null;
afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
  jest.useRealTimers();
});

async function mount(options: Partial<ViewerOptions> = {}, page: Page = fitoutPage(), dir?: 'rtl') {
  const host = document.createElement('div');
  if (dir) host.setAttribute('dir', dir);
  document.body.append(host);
  handle = mountViewer(host, { page, dataSource: fitoutSource(), listViews: ganttListViews({ now: () => NOW }), ...options });
  await until(() => host.querySelector('.fd-gantt-body:not([aria-busy]) .fd-gantt-sheet'));
  return host;
}
const bar = (host: Element, name: string) => [...host.querySelectorAll<HTMLElement>('.fd-gantt-task')].find((b) => b.textContent === name) as HTMLElement;
const said = (host: Element) => host.querySelector('.fd-gantt-said')?.textContent ?? '';
const saves = (source: MemoryDataSource) => source.calls.filter((call) => call.method === 'save').map((call) => call.request as SaveRequest);
const button = (root: Element, words: string) => [...root.querySelectorAll<HTMLButtonElement>('button')].find((b) => (b.getAttribute('aria-label') ?? b.textContent?.trim()) === words) as HTMLButtonElement;
/** A group's toggle by what a press does, its description ("Hide Finishes"): its name is what it shows. */
const toggle = (root: Element, words: string) => root.querySelector<HTMLButtonElement>(`.fd-gantt-toggle[aria-description="${words}"]`) as HTMLButtonElement;
const settle = () => until(() => !document.querySelector('.fd-gantt-body[aria-busy]'));
const pointer = (target: EventTarget, type: string, clientX: number) => target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientX, clientY: 10 }));

describe("a list's Gantt timeline", () => {
  it('is offered as Timeline on the switcher, and opens there when the page says so, in a chunk of its own', async () => {
    const host = await mount();
    expect([...host.querySelectorAll('.fd-list-views button')].map((b) => b.textContent)).toEqual(['List', 'Timeline']);
    expect(host.querySelector('.fd-list')?.getAttribute('data-view')).toBe('gantt');
    expect(host.querySelector('.fd-gantt')?.getAttribute('aria-label')).toBe('Timeline');
    // The plan from its first day to its last.
    expect(host.querySelector('.fd-gantt-title')?.textContent).toMatch(/12.*21 Oct 2026/);
  });

  it('draws each record as a bar in its group, a row with no bar for one with no start, the arrows from what each waits for, today’s line', async () => {
    const host = await mount();
    expect([...host.querySelectorAll('.fd-gantt-toggle bdi')].map((b) => b.textContent)).toEqual(['Strip-out', 'First fix', 'Finishes']);
    expect([...host.querySelectorAll('.fd-gantt-row[data-id] .fd-gantt-name')].map((n) => n.textContent)).toEqual(['Strip the old shop', 'Wiring', 'Painting', 'Plastering', 'Snagging']);
    // Days: 40 pixels each. Wiring runs three days, from two days after the strip-out's start.
    const wiring = bar(host, 'Wiring');
    const strip = bar(host, 'Strip the old shop');
    expect(parseFloat(wiring.style.width)).toBe(120);
    expect(parseFloat(wiring.style.insetInlineStart) - parseFloat(strip.style.insetInlineStart)).toBe(80);
    expect(wiring.getAttribute('aria-label')).toBe('Wiring, Wed 14 Oct to Fri 16 Oct, 3 days, waits for Strip the old shop');
    // Painting starts before the wiring it waits for ends: said, marked, and its arrow red.
    const painting = bar(host, 'Painting');
    expect(painting.hasAttribute('data-late')).toBe(true);
    expect(painting.getAttribute('aria-label')).toContain('starts before Wiring ends');
    const links = [...host.querySelectorAll('.fd-gantt-link')];
    expect(links.map((l) => `${l.getAttribute('data-from')}>${l.getAttribute('data-to')}${l.hasAttribute('data-late') ? '!' : ''}`)).toEqual(['1>2', '2>4!', '2>3']);
    expect(host.querySelector('.fd-gantt-row[data-id="5"] .fd-gantt-unplanned')?.textContent).toBe('No start yet');
    expect(host.querySelector('.fd-gantt-today')).not.toBeNull();
    // Today's day marked on the axis.
    expect(host.querySelector('.fd-gantt-tick[aria-current]')?.getAttribute('title')).toBe('Wednesday, 14 October 2026');
  });

  it('shows days, weeks or months; closes a group under its heading; shares the list’s search', async () => {
    const host = await mount();
    button(host, 'Weeks').click();
    expect(host.querySelector('.fd-gantt')?.getAttribute('data-zoom')).toBe('week');
    expect(parseFloat(bar(host, 'Wiring').style.width)).toBe(54);
    button(host, 'Months').click();
    expect(parseFloat(bar(host, 'Wiring').style.width)).toBe(15);
    // Closed: its rows gone, and the arrows into them.
    expect(toggle(host, 'Hide Finishes').getAttribute('aria-label')).toBe('Finishes, 3 records');
    toggle(host, 'Hide Finishes').click();
    expect(bar(host, 'Painting')).toBeUndefined();
    expect(host.querySelectorAll('.fd-gantt-link')).toHaveLength(1);
    expect(toggle(host, 'Show Finishes').getAttribute('aria-expanded')).toBe('false');
    toggle(host, 'Show Finishes').click();
    expect(bar(host, 'Painting')).toBeDefined();
  });

  it('waits for its records asked again as a refresh, the bars shown kept; days, weeks and months ask nothing', async () => {
    const host = await mount();
    const waits: string[] = [];
    handle?.on('loadingstart', ({ moment, part }) => waits.push(`${moment} ${part}`));
    button(host, 'Weeks').click();
    expect(waits).toEqual([]);
    await handle?.reload();
    await settle();
    // The timeline's wait (the list's own records are asked again beside it, a refresh too).
    expect(waits.filter((wait) => wait.endsWith('-gantt'))).toEqual(['refresh list-gantt']);
    expect(bar(host, 'Wiring')).toBeDefined();
  });

  it('moves a bar a day at a time from the keys, written once they rest, with Undo; Shift moves its end; Enter opens it', async () => {
    const source = fitoutSource();
    const opened: unknown[] = [];
    const host = await mount({ dataSource: source, onOpenRecord: (id) => void opened.push(id) });
    const wiring = bar(host, 'Wiring');
    wiring.focus();
    key(wiring, 'ArrowRight');
    key(wiring, 'ArrowRight');
    // Shown at once, said as it goes; not written yet.
    expect(host.querySelector('.fd-gantt > [aria-live]')?.textContent).toBe('Wiring, Fri 16 Oct to Sun 18 Oct');
    expect(saves(source)).toHaveLength(0);
    await until(() => said(host).includes('Moved'));
    expect(said(host)).toContain('Moved Wiring: Fri 16 Oct to Sun 18 Oct.');
    const [move] = saves(source);
    expect(move).toMatchObject({ partial: true, values: { start: '2026-10-16', finish: '2026-10-18' } });
    expect(Object.keys(move.fields).sort()).toEqual(['finish', 'start']);
    await settle();
    // The keys are still on it.
    expect(document.activeElement).toBe(bar(host, 'Wiring'));
    button(host.querySelector('.fd-gantt-said') as HTMLElement, 'Undo').click();
    await until(() => said(host).includes('Put back'));
    expect(source.records['fitout.task'][2]).toMatchObject({ start: '2026-10-14', finish: '2026-10-16' });
    await settle();
    const again = bar(host, 'Wiring');
    again.focus();
    key(again, 'ArrowRight', { shiftKey: true });
    await until(() => said(host).includes('now ends'));
    expect(saves(source)[2].values).toEqual({ finish: '2026-10-17' });
    await settle();
    key(bar(host, 'Wiring'), 'Enter');
    expect(opened).toEqual([2]);
  });

  it('reaches the bar above and below with up and down; Escape puts back a move not written yet', async () => {
    const source = fitoutSource();
    const host = await mount({ dataSource: source });
    const wiring = bar(host, 'Wiring');
    wiring.focus();
    key(wiring, 'ArrowDown');
    expect(document.activeElement).toBe(bar(host, 'Painting'));
    key(document.activeElement as Element, 'ArrowUp');
    key(document.activeElement as Element, 'ArrowUp');
    expect(document.activeElement).toBe(bar(host, 'Strip the old shop'));
    // One stop for the keys: the bar they stand on.
    expect(host.querySelectorAll('.fd-gantt [tabindex="0"]')).toHaveLength(1);
    key(document.activeElement as Element, 'End');
    expect((document.activeElement as HTMLElement).textContent).toBe('Snagging');
    const strip = bar(host, 'Strip the old shop');
    strip.focus();
    const before = strip.style.insetInlineStart;
    key(strip, 'ArrowLeft');
    expect(bar(host, 'Strip the old shop').style.insetInlineStart).not.toBe(before);
    key(strip, 'Escape');
    expect(bar(host, 'Strip the old shop').style.insetInlineStart).toBe(before);
    await new Promise((resolve) => setTimeout(resolve, 900));
    expect(saves(source)).toHaveLength(0);
  });

  it('moves a bar dragged by whole days, stretches it by its end, and lets go on Escape', async () => {
    const source = fitoutSource();
    const host = await mount({ dataSource: source });
    const wiring = bar(host, 'Wiring');
    pointer(wiring, 'pointerdown', 100);
    pointer(document, 'pointermove', 160);
    pointer(document, 'pointermove', 181);
    expect(wiring.hasAttribute('data-moving')).toBe(true);
    // Its arrows wait while it is moved, and are back as it lands (the walk of 0.35: hidden after a drop, a broken link with them).
    const arrows = () => [...host.querySelectorAll<SVGElement>('.fd-gantt-link')].filter((link) => [link.getAttribute('data-from'), link.getAttribute('data-to')].includes(wiring.getAttribute('data-id')));
    expect(arrows().length).toBeGreaterThan(0);
    expect(arrows().every((link) => link.style.visibility === 'hidden')).toBe(true);
    pointer(document, 'pointerup', 181);
    expect(arrows().filter((link) => link.style.visibility === 'hidden')).toEqual([]);
    await until(() => said(host).includes('Moved'));
    expect(saves(source)[0].values).toEqual({ start: '2026-10-16', finish: '2026-10-18' });
    await settle();
    expect(arrows().filter((link) => link.style.visibility === 'hidden')).toEqual([]);
    const grip = bar(host, 'Plastering').querySelector('.fd-gantt-grip[data-edge="end"]') as HTMLElement;
    pointer(grip, 'pointerdown', 300);
    pointer(document, 'pointermove', 380);
    pointer(document, 'pointerup', 380);
    await until(() => said(host).includes('now ends'));
    expect(saves(source)[1].values).toEqual({ finish: '2026-10-23' });
    await settle();
    const painting = bar(host, 'Painting');
    pointer(painting, 'pointerdown', 100);
    pointer(document, 'pointermove', 300);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    pointer(document, 'pointerup', 300);
    expect(saves(source)).toHaveLength(2);
  });

  it('keeps a locked record still and says why; a refused move is put back and says why', async () => {
    const source = fitoutSource();
    const told: DataSource = {
      ...source,
      list: async (request) => {
        const answer = await source.list(request);
        return { ...answer, records: answer.records.map((r: ListedRecord) => (r.id === 1 ? { ...r, can: { readonlyFields: ['start'], reason: 'The strip-out is signed off.' } } : r)) };
      },
      save: async () => {
        throw Object.assign(new Error('The site is closed that week.'), { kind: 'business' });
      },
    };
    const host = await mount({ dataSource: told });
    const strip = bar(host, 'Strip the old shop');
    expect(strip.hasAttribute('data-moves')).toBe(false);
    expect(strip.getAttribute('aria-label')).toContain('The strip-out is signed off.');
    expect(strip.querySelector('.fd-gantt-grip')).toBeNull();
    const wiring = bar(host, 'Wiring');
    wiring.focus();
    key(wiring, 'ArrowRight');
    await until(() => host.querySelector('.fd-gantt-alert')?.textContent);
    expect(host.querySelector('.fd-gantt-alert')?.textContent).toBe('Not moved: The site is closed that week.');
    await settle();
    expect(bar(host, 'Wiring').getAttribute('aria-label')).toContain('Wed 14 Oct to Fri 16 Oct');
  });

  it('offers no move where the page locks a field it writes, or the app saves nothing', async () => {
    const locked = fitoutPage();
    locked.fields['finish'] = { type: 'date', label: 'Ends', readonly: true };
    const host = await mount({}, locked);
    expect(host.querySelectorAll('.fd-gantt-task[data-moves]')).toHaveLength(0);
    handle?.destroy();
    const source = fitoutSource();
    const host2 = await mount({ dataSource: { ...source, save: undefined } as unknown as DataSource });
    expect(host2.querySelectorAll('.fd-gantt-task[data-moves]')).toHaveLength(0);
    expect(bar(host2, 'Wiring').getAttribute('aria-describedby')).toMatch(/keys-still$/);
  });

  it('right to left, runs the days from the right: the left arrow moves a bar later', async () => {
    const source = fitoutSource();
    const host = await mount({ dataSource: source, locale: 'ar' }, fitoutPage(), 'rtl');
    expect([...host.querySelectorAll('.fd-list-views button')].map((b) => b.textContent)).toEqual(['قائمة', 'المخطط الزمني']);
    const wiring = bar(host, 'Wiring');
    wiring.focus();
    key(wiring, 'ArrowLeft');
    await until(() => saves(source).length);
    expect(saves(source)[0].values).toEqual({ start: '2026-10-15', finish: '2026-10-17' });
    await settle();
    pointer(bar(host, 'Strip the old shop'), 'pointerdown', 400);
    // Dragged leftward by two days: later, right to left.
    pointer(document, 'pointermove', 320);
    pointer(document, 'pointerup', 320);
    await until(() => saves(source).length === 2);
    expect(saves(source)[1].values).toEqual({ start: '2026-10-14', finish: '2026-10-15' });
  });

  it('on paper, fits every day of the plan in the timeline’s width, and its scale’s back after', async () => {
    const host = await mount();
    const width = () => parseFloat(bar(host, 'Wiring').style.width);
    expect(width()).toBe(120);
    // A timeline 400 pixels wide on screen: its fifteen days in 480 at most.
    Object.defineProperty(host.querySelector('.fd-gantt-body') as HTMLElement, 'clientWidth', { value: 400 });
    window.dispatchEvent(new Event('beforeprint'));
    expect(width()).toBeLessThan(120);
    window.dispatchEvent(new Event('afterprint'));
    expect(width()).toBe(120);
  });
});

describe('a timeline on its zone’s clock', () => {
  it('moves a bar of days and times a day, keeping its hours on the page’s clock across a change of the clocks', async () => {
    const page = fitoutPage({ end: 'finish' }, { timeZone: 'Europe/Berlin' });
    page.fields['start'] = { type: 'datetime', label: 'Starts' };
    page.fields['finish'] = { type: 'datetime', label: 'Ends' };
    const records = fitoutRecords();
    records[3] = { ...records[3], start: '2026-10-24T06:00:00.000Z', finish: '2026-10-24T15:00:00.000Z' };
    const source = fitoutSource(records);
    const host = await mount({ dataSource: source }, page);
    const plaster = bar(host, 'Plastering');
    expect(plaster.getAttribute('aria-label')).toContain('Sat 24 Oct, 08:00 to Sat 24 Oct, 17:00');
    plaster.focus();
    key(plaster, 'ArrowRight');
    await until(() => saves(source).length);
    expect(saves(source)[0].values).toEqual({ start: '2026-10-25T07:00:00.000Z', finish: '2026-10-25T16:00:00.000Z' });
  });
});
