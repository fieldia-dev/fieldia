import { saveRefused, type DataSource, type ListCalendar, type Locale, type Page, type RecordId, type Values } from '@fieldia/core';
import { mountViewer, type ViewerHandle, type ViewerOptions } from '@fieldia/viewer';
import { calendarListViews } from './list-view';
import { at, clinicPage, clinicRecords, clinicSource, KARIM, key, NOW, SALMA, until } from './test-calendar';

/**
 * A list's calendar as a person meets it: the week, the day by doctor, the
 * month and the agenda; records where their times put them, side by side
 * when they meet; moved from the keyboard with "Move to…" and put back with
 * Undo; a new record from an empty slot; the list's own search; its words
 * in four languages, right to left, and the agenda on a phone.
 */

let handle: ViewerHandle | null = null;
afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
  delete (window as { matchMedia?: unknown }).matchMedia;
});

async function mount(options: Partial<ViewerOptions> = {}, page: Page = clinicPage()) {
  const host = document.createElement('div');
  document.body.append(host);
  handle = mountViewer(host, { page, dataSource: clinicSource(), listViews: calendarListViews({ now: () => NOW }), ...options });
  await until(() => host.querySelector('.fd-cal-body:not([aria-busy]) .fd-cal-grid, .fd-cal-body:not([aria-busy]) .fd-cal-month, .fd-cal-body:not([aria-busy]) .fd-cal-agenda'));
  return host;
}
const cal = (host: Element) => host.querySelector('.fd-cal') as HTMLElement;
const title = (host: Element) => host.querySelector('.fd-cal-title')?.textContent;
const blocks = (host: Element) => [...host.querySelectorAll<HTMLElement>('.fd-cal-event')];
const block = (host: Element, name: string) => blocks(host).find((b) => b.querySelector('.fd-cal-event-title')?.textContent === name) as HTMLElement;
const button = (root: Element, words: string) => [...root.querySelectorAll<HTMLButtonElement>('button')].find((b) => (b.getAttribute('aria-label') ?? b.textContent?.trim()) === words && !b.closest('[hidden]')) as HTMLButtonElement;
const settle = () => until(() => !document.querySelector('.fd-cal-body[aria-busy]'));
const columnOf = (b: Element) => b.closest('.fd-cal-col') as HTMLElement | null;

describe("a list's calendar", () => {
  it('opens on its week, from the language’s first day, each record in its day at its time', async () => {
    const host = await mount();
    expect(host.querySelector('.fd-list')?.getAttribute('data-view')).toBe('calendar');
    expect(title(host)).toBe('12–18 Oct 2026');
    const heads = [...host.querySelectorAll('.fd-cal-head-day')].map((h) => h.getAttribute('aria-label'));
    expect(heads[0]).toBe('Monday 12 October');
    expect(heads).toHaveLength(7);
    expect(host.querySelector('.fd-cal-head[aria-current="date"]')?.textContent).toContain('14');
    // Wednesday's column holds Mona at 10:00: two hours under 8:00, half an hour long.
    const mona = block(host, 'Mona Adel');
    expect(columnOf(mona)?.dataset['day']).toBe('2026-10-14');
    expect(mona.style.top).toBe('96px');
    // Half an hour is 24 pixels: a slot or a record never smaller than a finger's target.
    expect(mona.style.height).toBe('24px');
    expect(mona.getAttribute('aria-label')).toBe('Mona Adel, Wednesday 14 October, 10:00 to 10:30, with Dr Karim');
    expect(block(host, 'Laila Hany') && columnOf(block(host, 'Laila Hany'))?.dataset['day']).toBe('2026-10-15');
    // Next week's is not in this one.
    expect(block(host, 'Next week')).toBeUndefined();
  });

  it('takes 96 pixels an hour for slots of a quarter of an hour, so each slot is 24 pixels tall', async () => {
    const host = await mount({}, clinicPage({ slot: 15 }));
    expect(cal(host).style.getPropertyValue('--fd-cal-hour')).toBe('96px');
    expect(block(host, 'Mona Adel').style.top).toBe(`${2 * 96}px`);
    expect(block(host, 'Mona Adel').style.height).toBe('46px');
  });

  it('puts records that meet side by side, and colours each by its kind', async () => {
    const host = await mount();
    const [mona, omar] = [block(host, 'Mona Adel'), block(host, 'Omar Said')];
    expect([mona.style.width, omar.style.width]).toEqual(['calc(50% - 3px)', 'calc(50% - 3px)']);
    expect(omar.style.insetInlineStart).toBe('calc(50% + 1px)');
    expect(mona.style.getPropertyValue('--fd-cal-c')).not.toBe(omar.style.getPropertyValue('--fd-cal-c'));
    expect(block(host, 'Laila Hany').style.width).toBe('calc(100% - 3px)');
  });

  it('shows a day with a column for each doctor, and one for the records with no one', async () => {
    const host = await mount({}, clinicPage({ view: 'day' }));
    expect(title(host)).toBe('Wednesday, 14 October 2026');
    expect([...host.querySelectorAll('.fd-cal-head-who')].map((h) => h.textContent)).toEqual(['Dr Karim', 'Dr Salma', 'Dr Nour', 'No one']);
    expect(columnOf(block(host, 'Mona Adel'))?.getAttribute('aria-label')).toBe('Wednesday 14 October, Dr Karim');
    expect(columnOf(block(host, 'Walk-in'))?.getAttribute('aria-label')).toBe('Wednesday 14 October, No one');
  });

  it('steps a week at a time, asking for that week alone, back to today, and from the week to a day by its head', async () => {
    const source = clinicSource();
    const host = await mount({ dataSource: source });
    button(host, 'Next week').click();
    await until(() => title(host) === '19–25 Oct 2026');
    await settle();
    expect(block(host, 'Next week')).toBeDefined();
    // Starting before the week ends, and ending after it starts.
    const asked = source.calls.filter((call) => call.method === 'list').pop()?.request as { filter: unknown[] };
    expect(asked.filter).toEqual([
      { field: 'start', op: '<', value: new Date(2026, 9, 26).toISOString() },
      { any: [{ field: 'stop', op: '>', value: new Date(2026, 9, 19).toISOString() }, { field: 'start', op: '>=', value: new Date(2026, 9, 19).toISOString() }] },
    ]);
    button(host, 'Today').click();
    await until(() => title(host) === '12–18 Oct 2026');
    (host.querySelector('.fd-cal-head-day[aria-label="Thursday 15 October"]') as HTMLButtonElement).click();
    await until(() => title(host) === 'Thursday, 15 October 2026');
    expect(host.querySelector('.fd-cal-ranges [data-range="day"]')?.getAttribute('aria-pressed')).toBe('true');
  });

  it('draws the month in whole weeks, with how many more a crowded day has', async () => {
    const records = clinicRecords();
    for (let i = 0; i < 4; i++) records[`9${i}`] = { patient: `Extra ${i}`, start: at(16, 9 + i), stop: at(16, 10 + i), doctor: KARIM, kind: 'check' };
    const host = await mount({ dataSource: clinicSource(records) }, clinicPage({ view: 'month' }));
    expect(title(host)).toBe('October 2026');
    expect(host.querySelectorAll('.fd-cal-day')).toHaveLength(35);
    expect(host.querySelector('.fd-cal-day[aria-current="date"]')?.getAttribute('data-day')).toBe('2026-10-14');
    const friday = host.querySelector('.fd-cal-day[data-day="2026-10-16"]') as HTMLElement;
    expect(friday.querySelectorAll('.fd-cal-event')).toHaveLength(3);
    expect(button(friday, '1 more on Friday 16 October')?.textContent).toBe('+1 more');
    expect(host.querySelector('.fd-cal-day[data-day="2026-09-28"]')?.hasAttribute('data-out')).toBe(true);
  });

  it('lists the week to come as an agenda, each day that has something, and says so when none has', async () => {
    const host = await mount({}, clinicPage({ view: 'agenda' }));
    expect(title(host)).toBe('14–20 Oct 2026');
    expect([...host.querySelectorAll('.fd-cal-agenda-head')].map((h) => h.textContent)).toEqual(['Wednesday 14 October', 'Thursday 15 October']);
    expect(block(host, 'Mona Adel').querySelector('.fd-cal-event-time')?.textContent).toBe('10:00 – 10:30');
    button(host, 'Next week').click();
    await until(() => title(host) === '21–27 Oct 2026');
    await settle();
    expect(block(host, 'Next week')).toBeDefined();
    button(host, 'Next week').click();
    await until(() => host.querySelector('.fd-cal-empty'));
    expect(host.querySelector('.fd-cal-empty')?.textContent).toBe('Nothing on these days.');
  });

  it('opens on the agenda on a phone', async () => {
    (window as { matchMedia?: unknown }).matchMedia = (query: string) => ({ matches: query.includes('max-width'), addEventListener() {}, removeEventListener() {} });
    const host = await mount();
    expect(cal(host).dataset['range']).toBe('agenda');
  });

  it('keeps to the list’s search', async () => {
    const host = await mount();
    (host.querySelector('.fd-search-toggle') as HTMLButtonElement).click();
    (host.querySelector('.fd-search-option[data-filter="surgery"]') as HTMLButtonElement).click();
    await until(() => !block(host, 'Mona Adel'));
    await settle();
    expect(blocks(host).map((b) => b.querySelector('.fd-cal-event-title')?.textContent)).toEqual(['Omar Said']);
  });

  it('stretches its hours to a record outside them, and draws a whole day’s record over the hours', async () => {
    const records = { ...clinicRecords(), 8: { patient: 'Early', start: at(13, 6, 30), stop: at(13, 7), doctor: KARIM, kind: 'check' }, 9: { patient: 'Conference', start: at(15, 0), stop: at(17, 0), doctor: SALMA, kind: 'check' } };
    const host = await mount({ dataSource: clinicSource(records) });
    expect(host.querySelector('.fd-cal-hour')?.textContent).toBe('06:00');
    expect(block(host, 'Mona Adel').style.top).toBe(`${4 * 48}px`);
    const conference = blocks(host).filter((b) => b.querySelector('.fd-cal-event-title')?.textContent === 'Conference');
    expect(conference.map((b) => b.closest('.fd-cal-allday')?.getAttribute('data-day'))).toEqual(['2026-10-15', '2026-10-16']);
  });

  it('draws the line of now across today, at this minute', async () => {
    const host = await mount();
    const line = host.querySelector('.fd-cal-col[data-day="2026-10-14"] .fd-cal-now') as HTMLElement;
    expect(line.style.top).toBe(`${(100 / 60) * 48}px`);
    expect(host.querySelectorAll('.fd-cal-now')).toHaveLength(1);
  });
});

describe('moving and making from the keyboard', () => {
  it('moves a record with Move to…: its day, its time, its doctor, then puts it back with Undo', async () => {
    const source = clinicSource();
    const host = await mount({ dataSource: source });
    const mona = block(host, 'Mona Adel');
    mona.focus();
    expect(mona.getAttribute('aria-describedby')).toBeTruthy();
    expect(document.getElementById(mona.getAttribute('aria-describedby') as string)?.textContent).toBe('M moves it.');
    key(mona, 'm');
    const dialog = host.querySelector('.fd-cal-move[role="dialog"]') as HTMLElement;
    expect(dialog.querySelector('.fd-cal-move-title')?.textContent).toBe('Move Mona Adel');
    expect(document.activeElement).toBe(dialog.querySelector('input[type="date"]'));
    const [day, time] = [...dialog.querySelectorAll('input')];
    const doctor = dialog.querySelector('select') as HTMLSelectElement;
    expect([day.value, time.value, doctor.value]).toEqual(['2026-10-14', '10:00', '1']);
    day.value = '2026-10-16';
    time.value = '15:30';
    doctor.value = '2';
    button(dialog, 'Move').click();
    await until(() => host.querySelector('.fd-cal-said')?.textContent?.includes('Moved'));
    expect(source.records['clinic.appointment'][1]).toMatchObject({ start: at(16, 15, 30), stop: at(16, 16), doctor: SALMA });
    expect(host.querySelector('.fd-cal-said')?.textContent).toContain('Moved Mona Adel to Fri 16 Oct, 15:30.');
    await settle();
    expect(columnOf(block(host, 'Mona Adel'))?.dataset['day']).toBe('2026-10-16');
    expect(document.activeElement?.closest('.fd-cal-event')?.textContent).toContain('Mona Adel');
    button(host.querySelector('.fd-cal-said') as HTMLElement, 'Undo').click();
    await until(() => host.querySelector('.fd-cal-said')?.textContent?.includes('Put back'));
    expect(source.records['clinic.appointment'][1]).toMatchObject({ start: at(14, 10), stop: at(14, 10, 30), doctor: KARIM });
  });

  it('closes Move to… with Escape, the focus back on the record', async () => {
    const host = await mount();
    const mona = block(host, 'Mona Adel');
    mona.focus();
    key(mona, 'F10', { shiftKey: true });
    const dialog = host.querySelector('.fd-cal-move') as HTMLElement;
    key(dialog.querySelector('input') as HTMLElement, 'Escape');
    expect(host.querySelector('.fd-cal-move')).toBeNull();
    expect(document.activeElement).toBe(mona);
  });

  it('opens a record by Enter, and moves between records and slots with the arrows', async () => {
    const opened: RecordId[] = [];
    const host = await mount({ onOpenRecord: (id) => void opened.push(id), onNewRecord: () => undefined });
    const mona = block(host, 'Mona Adel');
    mona.focus();
    key(mona, 'Enter');
    expect(opened).toEqual([1]);
    // Down: the next record in its day, by time.
    key(mona, 'ArrowDown');
    expect(document.activeElement).toBe(block(host, 'Omar Said'));
    // Right: the day beside, at the same time.
    key(block(host, 'Omar Said'), 'ArrowRight');
    expect((document.activeElement as HTMLElement).getAttribute('aria-label')).toBe('Thursday 15 October, 10:00, free');
    key(document.activeElement as HTMLElement, 'ArrowDown');
    expect((document.activeElement as HTMLElement).getAttribute('aria-label')).toBe('Thursday 15 October, 10:30, free');
    key(document.activeElement as HTMLElement, 'ArrowLeft');
    expect((document.activeElement as HTMLElement).getAttribute('aria-label')).toBe('Wednesday 14 October, 10:30, 1 record');
    // One stop for all the slots, where the keys left it.
    expect(host.querySelectorAll('.fd-cal-slot[tabindex="0"]')).toHaveLength(1);
  });

  it('flips left and right on a right-to-left page', async () => {
    const host = await mount({ locale: 'ar', dir: 'rtl', onNewRecord: () => undefined });
    const first = host.querySelector('.fd-cal-slot[tabindex="0"]') as HTMLElement;
    first.focus();
    const column = Number(first.dataset['focus']?.split(':')[1]);
    key(first, 'ArrowLeft');
    expect(Number((document.activeElement as HTMLElement).dataset['focus']?.split(':')[1])).toBe(column + 1);
  });

  it('makes a new record from an empty slot by Enter, with its time and its doctor', async () => {
    const made: Values[] = [];
    const host = await mount({ onNewRecord: (values) => void made.push(values) }, clinicPage({ view: 'day' }));
    const slot = host.querySelector('.fd-cal-col[aria-label="Wednesday 14 October, Dr Salma"] .fd-cal-slot[data-minutes="660"]') as HTMLElement;
    slot.focus();
    key(slot, 'Enter');
    await until(() => made.length);
    expect(made).toEqual([{ start: at(14, 11), stop: at(14, 12), doctor: { id: 2, label: 'Dr Salma' } }]);
    // New, from the bar: where the keys stand.
    button(host, 'New').click();
    await until(() => made.length === 2);
    expect(made[1]).toEqual(made[0]);
  });

  it('takes a screen reader’s press, a click with no pointer behind it: a slot makes a record, a record opens', async () => {
    const made: Values[] = [];
    const opened: RecordId[] = [];
    const host = await mount({ onNewRecord: (values) => void made.push(values), onOpenRecord: (id) => void opened.push(id) }, clinicPage({ view: 'day' }));
    const slot = host.querySelector('.fd-cal-col[aria-label="Wednesday 14 October, Dr Nour"] .fd-cal-slot[data-minutes="900"]') as HTMLElement;
    slot.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }));
    await until(() => made.length);
    expect(made).toEqual([{ start: at(14, 15), stop: at(14, 16), doctor: { id: 3, label: 'Dr Nour' } }]);
    block(host, 'Mona Adel').dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }));
    expect(opened).toEqual([1]);
    // A mouse's click (detail 1) is the press it ends, already handled: nothing more.
    slot.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(made).toHaveLength(1);
  });

  it('offers no way to make one when the app has none, and none to move one without a save', async () => {
    const source = clinicSource();
    const { save: _save, ...readOnly } = source;
    const host = await mount({ dataSource: readOnly as DataSource });
    expect(host.querySelector('.fd-cal-slot')).toBeNull();
    expect((host.querySelector('.fd-cal-new') as HTMLElement).hidden).toBe(true);
    expect(blocks(host).some((b) => b.hasAttribute('data-moves') || b.querySelector('.fd-cal-event-menu, .fd-cal-resize'))).toBe(false);
  });

  it('keeps a record its source locks where it is, saying why', async () => {
    const source = clinicSource();
    const locked: DataSource = {
      ...source,
      list: async (request) => {
        const answer = await source.list(request);
        return { ...answer, records: answer.records.map((r) => (r.id === 1 ? { ...r, can: { edit: false, reason: 'Only Dr Karim can change it.' } } : r)) };
      },
    };
    const host = await mount({ dataSource: locked });
    const mona = block(host, 'Mona Adel');
    expect(mona.hasAttribute('data-moves')).toBe(false);
    expect(mona.getAttribute('title')).toBe('Only Dr Karim can change it.');
    expect(mona.getAttribute('aria-label')).toContain('Only Dr Karim can change it.');
    expect(block(host, 'Omar Said').hasAttribute('data-moves')).toBe(true);
  });

  it('puts a move back when the source refuses it, and says why', async () => {
    const source = clinicSource();
    const refusing: DataSource = { ...source, save: async () => Promise.reject(saveRefused({ kind: 'rule', message: 'Dr Salma is away that day.' })) };
    const host = await mount({ dataSource: refusing });
    const mona = block(host, 'Mona Adel');
    mona.focus();
    key(mona, 'm');
    const dialog = host.querySelector('.fd-cal-move') as HTMLElement;
    (dialog.querySelector('input[type="date"]') as HTMLInputElement).value = '2026-10-16';
    button(dialog, 'Move').click();
    await until(() => host.querySelector('.fd-cal-alert')?.textContent);
    expect(host.querySelector('.fd-cal-alert')?.textContent).toBe('Not moved: Dr Salma is away that day.');
    await settle();
    expect(columnOf(block(host, 'Mona Adel'))?.dataset['day']).toBe('2026-10-14');
  });
});

describe('a calendar of days, and in other languages', () => {
  it('draws records of whole days in the days’ row, and moves them by days', async () => {
    const page = clinicPage({ start: 'leave', end: 'back', resource: undefined, colour: undefined } as Partial<ListCalendar>);
    const source = clinicSource({ 1: { patient: 'Dr Karim’s leave', leave: '2026-10-13', back: '2026-10-15' } });
    const host = await mount({ dataSource: source }, page);
    expect(host.querySelector('.fd-cal-col')).toBeNull();
    const days = blocks(host).map((b) => b.closest('.fd-cal-allday')?.getAttribute('data-day'));
    expect(days).toEqual(['2026-10-13', '2026-10-14', '2026-10-15']);
    blocks(host)[0].focus();
    key(blocks(host)[0], 'm');
    const dialog = host.querySelector('.fd-cal-move') as HTMLElement;
    expect(dialog.querySelector('input[type="time"]')).toBeNull();
    (dialog.querySelector('input[type="date"]') as HTMLInputElement).value = '2026-10-19';
    button(dialog, 'Move').click();
    await until(() => source.records['clinic.appointment'][1]['leave'] === '2026-10-19');
    expect(source.records['clinic.appointment'][1]).toMatchObject({ leave: '2026-10-19', back: '2026-10-21' });
  });

  it.each<[Locale, string, string]>([
    ['ar', 'اليوم', 'التقويم'],
    ['fr', 'Aujourd’hui', 'Calendrier'],
    ['de', 'Heute', 'Kalender'],
  ])('says its words in %s', async (locale, today, name) => {
    const host = await mount({ locale });
    expect(host.querySelector('.fd-cal-nav button')?.textContent).toBe(today);
    expect(host.querySelector('.fd-list-view[data-view="calendar"]')?.textContent).toBe(name);
    // The week from the language's own first day: Saturday in Arabic.
    if (locale === 'ar') expect(host.querySelector('.fd-cal-head-day')?.getAttribute('aria-label')).toMatch(/^السبت/);
  });
});
