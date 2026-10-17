import { isOwnZone, type MemoryDataSource, type Page, type SaveRequest, type Values } from '@fieldia/core';
import { mountViewer, type ViewerHandle, type ViewerOptions } from '@fieldia/viewer';
import { calendarListViews } from './list-view';
import { clinicPage, clinicSource, KARIM, key, until } from './test-calendar';

/**
 * A calendar on the clock of the zone its page names (`timeZone`), or its start field: Tokyo's, wherever the reader
 * is — these tests run in the reader's own zone, whatever it is (UTC, New York…), and their "now" is Sunday 18 October
 * 2026 at 23:30 UTC, which is already Monday 19 October, 08:30, in Tokyo. So the week shown is Tokyo's (19 to 25
 * October), today is Tokyo's Monday, a record at 10:00 in Tokyo sits at 10:00, the hours stretch to Tokyo's early
 * morning, the line for now is at 08:30, and a slot pressed, a stretch and Move to… write the instants those times are
 * in Tokyo. The zone's short name stands after the span, as a date box shows it.
 */

/** Sunday 18 October 2026, 23:30 UTC: Monday 19 October, 08:30 in Tokyo (nine hours ahead all year). */
const NOW = new Date(Date.UTC(2026, 9, 18, 23, 30));
/** The instant a time on Tokyo's clock is, in October 2026: nine hours earlier in UTC. */
const tokyo = (day: number, h: number, m = 0) => new Date(Date.UTC(2026, 9, day, h - 9, m)).toISOString();

const page = (calendar: Parameters<typeof clinicPage>[0] = {}, zone: string | null = 'Asia/Tokyo'): Page => ({ ...clinicPage(calendar), ...(zone ? { timeZone: zone } : {}) });
const RECORDS = (): Record<string, Values> => ({
  1: { patient: 'Mona Adel', start: tokyo(19, 10), stop: tokyo(19, 10, 30), doctor: KARIM, kind: 'check' },
  // At dawn in Tokyo, the evening before in UTC.
  2: { patient: 'Early call', start: tokyo(20, 6), stop: tokyo(20, 6, 30), doctor: KARIM, kind: 'check' },
});

let handle: ViewerHandle | null = null;
let source: MemoryDataSource;
afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
});

async function mount(options: Partial<ViewerOptions> = {}, shown: Page = page()) {
  const host = document.createElement('div');
  document.body.append(host);
  source = clinicSource(RECORDS());
  handle = mountViewer(host, { page: shown, dataSource: source, listViews: calendarListViews({ now: () => NOW }), ...options });
  await until(() => host.querySelector('.fd-cal-body:not([aria-busy]) .fd-cal-grid, .fd-cal-body:not([aria-busy]) .fd-cal-month'));
  return host;
}
const title = (host: Element) => host.querySelector('.fd-cal-title')?.textContent?.replace(/\s*–\s*/g, '–');
const block = (host: Element, name: string) => [...host.querySelectorAll<HTMLElement>('.fd-cal-col > .fd-cal-event, .fd-cal-day > .fd-cal-event')].find((b) => b.querySelector('.fd-cal-event-title')?.textContent === name) as HTMLElement;
const columnOf = (b: Element) => b.closest('.fd-cal-col') as HTMLElement | null;
const said = (host: Element) => host.querySelector('.fd-cal-said')?.textContent ?? '';
const saves = () => source.calls.filter((call) => call.method === 'save').map((call) => call.request as SaveRequest);

describe('a calendar on its page’s time zone', () => {
  it('shows Tokyo’s week, its today and its hours, each record at its time there, the zone named', async () => {
    const host = await mount();
    expect(title(host)).toBe('19–25 Oct 2026');
    expect([...host.querySelectorAll('.fd-cal-head-day')].map((h) => h.getAttribute('aria-label'))[0]).toBe('Monday 19 October');
    expect(host.querySelector('.fd-cal-head[aria-current="date"]')?.textContent).toContain('19');
    // The hours stretch to 06:00 for the early call: Mona at 10:00 is four hours under the grid's top.
    expect(host.querySelector('.fd-cal-hour')?.textContent).toBe('06:00');
    const mona = block(host, 'Mona Adel');
    expect(columnOf(mona)?.dataset['day']).toBe('2026-10-19');
    expect(mona.style.top).toBe(`${4 * 48}px`);
    expect(mona.getAttribute('aria-label')).toBe('Mona Adel, Monday 19 October, 10:00 to 10:30, with Dr Karim');
    expect(columnOf(block(host, 'Early call'))?.dataset['day']).toBe('2026-10-20');
    // Now, 08:30 in Tokyo, on Monday's column: two and a half hours under 06:00.
    const line = host.querySelector<HTMLElement>('.fd-cal-col[data-today] .fd-cal-now');
    expect([columnOf(line as HTMLElement)?.dataset['day'], line?.style.top]).toEqual(['2026-10-19', `${2.5 * 48}px`]);
    // Its zone after the span, where it is not the reader's own: its short name, its long one read out.
    const zone = host.querySelector('.fd-cal-zone') as HTMLElement | null;
    if (isOwnZone('Asia/Tokyo')) expect(zone).toBeNull();
    else {
      expect(zone?.textContent).toMatch(/^(GMT\+9|JST)$/);
      expect(zone?.getAttribute('aria-label')).toBe('Japan Standard Time');
    }
  });

  it('asks its source for the span as Tokyo’s days begin and end', async () => {
    await mount();
    const listed = source.calls.filter((call) => call.method === 'list').map((call) => JSON.stringify(call.request));
    // Monday 19 October at midnight in Tokyo is 15:00 UTC the day before; the week ends as Monday 26th begins there.
    expect(listed.at(-1)).toContain('"value":"2026-10-25T15:00:00.000Z"');
    expect(listed.at(-1)).toContain('"value":"2026-10-18T15:00:00.000Z"');
  });

  it('makes a record at the slot’s time in Tokyo, and New’s next hour is Tokyo’s', async () => {
    const made: Values[] = [];
    const host = await mount({ onNewRecord: (values) => void made.push(values) });
    const slot = host.querySelector('.fd-cal-col[data-day="2026-10-19"] .fd-cal-slot[data-minutes="660"]') as HTMLElement;
    expect(slot.getAttribute('aria-label')).toMatch(/^Monday 19 October, 11:00/);
    slot.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }));
    await until(() => made.length);
    expect(made[0]).toMatchObject({ start: tokyo(19, 11), stop: tokyo(19, 12) });
  });

  it('writes a stretch and a move from the keyboard as the instants their times are in Tokyo', async () => {
    const host = await mount();
    const grip = block(host, 'Mona Adel').querySelector('.fd-cal-resize') as HTMLElement;
    grip.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, cancelable: true, button: 0, clientY: 0 }));
    // 48 pixels an hour from the column's top at 06:00: let go at 11:00 in Tokyo.
    document.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientY: 5 * 48 }));
    document.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, clientY: 5 * 48 }));
    await until(() => said(host).includes('now ends'));
    expect(saves()[0].values).toEqual({ stop: tokyo(19, 11) });
    // Move to… Wednesday at 14:15 in Tokyo: the half an hour it lasts kept.
    const mona = block(host, 'Mona Adel');
    key(mona, 'm');
    const box = host.querySelector('.fd-cal-move') as HTMLElement;
    const [day, time] = [...box.querySelectorAll('input')];
    expect([day.value, time.value]).toEqual(['2026-10-19', '10:00']);
    day.value = '2026-10-21';
    time.value = '14:15';
    ([...box.querySelectorAll('button')].find((b) => b.textContent === 'Move') as HTMLButtonElement).click();
    await until(() => saves().length === 2);
    expect(saves()[1].values).toEqual({ start: tokyo(21, 14, 15), stop: tokyo(21, 15, 15) });
  });

  it('keeps to its start field’s own zone over its page’s; and names none on the reader’s own clock', async () => {
    const own = page({}, 'Africa/Cairo');
    own.fields['start'] = { ...own.fields['start'], timeZone: 'Asia/Tokyo' } as Page['fields'][string];
    const host = await mount({}, own);
    expect(title(host)).toBe('19–25 Oct 2026');
    expect(block(host, 'Mona Adel').style.top).toBe(`${4 * 48}px`);
    handle?.destroy();
    document.body.replaceChildren();
    const plain = await mount({}, page({}, null));
    expect(plain.querySelector('.fd-cal-zone')).toBeNull();
  });

  it('shows Tokyo’s month, its days and today', async () => {
    const host = await mount({}, page({ view: 'month' }));
    expect(title(host)).toBe('October 2026');
    expect(host.querySelector('.fd-cal-day[aria-current="date"]')?.getAttribute('data-day')).toBe('2026-10-19');
    expect(block(host, 'Early call').closest('.fd-cal-day')?.getAttribute('data-day')).toBe('2026-10-20');
  });
});
