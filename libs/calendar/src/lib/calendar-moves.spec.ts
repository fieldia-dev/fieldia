import type { DataSource, ListedRecord, MemoryDataSource, Page, RecordId, SaveRequest, Values } from '@fieldia/core';
import { mountViewer, type ViewerHandle, type ViewerOptions } from '@fieldia/viewer';
import { calendarListViews } from './list-view';
import { at, clinicPage, clinicRecords, clinicSource, KARIM, key, NOW, until } from './test-calendar';

/**
 * A move kept safe: it saves the fields it changes and nothing else, and says
 * so, so a source that saves whole records keeps the rest; Undo puts back
 * exactly what they held. A record whose times or person are locked offers no
 * way to move it. Move to… refuses a day that is no day or far from the
 * record's, keeps the keys' place when the record leaves the days shown, and
 * Escape lets go of any drag. A slot too crowded to read offers "+N more".
 */

let handle: ViewerHandle | null = null;
afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
});

async function mount(options: Partial<ViewerOptions> = {}, page: Page = clinicPage()) {
  const host = document.createElement('div');
  document.body.append(host);
  handle = mountViewer(host, { page, dataSource: clinicSource(), listViews: calendarListViews({ now: () => NOW }), ...options });
  await until(() => host.querySelector('.fd-cal-body:not([aria-busy]) .fd-cal-grid, .fd-cal-body:not([aria-busy]) .fd-cal-month, .fd-cal-body:not([aria-busy]) .fd-cal-agenda'));
  return host;
}
const blocks = (host: Element) => [...host.querySelectorAll<HTMLElement>('.fd-cal-col > .fd-cal-event, .fd-cal-allday > .fd-cal-event')];
const block = (host: Element, name: string) => blocks(host).find((b) => b.querySelector('.fd-cal-event-title')?.textContent === name) as HTMLElement;
const button = (root: Element, words: string) => [...root.querySelectorAll<HTMLButtonElement>('button')].find((b) => (b.getAttribute('aria-label') ?? b.textContent?.trim()) === words && !b.closest('[hidden]')) as HTMLButtonElement;
const settle = () => until(() => !document.querySelector('.fd-cal-body[aria-busy]'));
const said = (host: Element) => host.querySelector('.fd-cal-said')?.textContent ?? '';
const saves = (source: MemoryDataSource) => source.calls.filter((call) => call.method === 'save').map((call) => call.request as SaveRequest);

/** Mona's visit moved with Move to…: to these inputs' values, by the Move button. */
function moveTo(host: Element, name: string, values: { day?: string; time?: string; doctor?: string }) {
  const mona = block(host, name);
  mona.focus();
  key(mona, 'm');
  const dialog = host.querySelector('.fd-cal-move') as HTMLElement;
  const [day, time] = [...dialog.querySelectorAll('input')];
  if (values.day !== undefined) day.value = values.day;
  if (values.time !== undefined) time.value = values.time;
  if (values.doctor !== undefined) (dialog.querySelector('select') as HTMLSelectElement).value = values.doctor;
  button(dialog, 'Move').click();
  return dialog;
}

describe('a move saves only what it changes', () => {
  /**
   * A backend that saves whole records, as a PUT does: every field the request names is written from its `values`,
   * an empty one where `values` has none; and a request that says it is partial writes its values over the record.
   */
  function wholeRecords(source: MemoryDataSource): DataSource {
    return {
      ...source,
      save: async (request) => {
        source.calls.push({ method: 'save', request });
        const table = source.records[request.model];
        const stored: Values = request.partial ? { ...table[String(request.id)] } : {};
        for (const name of Object.keys(request.fields)) stored[name] = request.values[name] ?? null;
        table[String(request.id)] = stored;
        return { id: request.id as RecordId };
      },
    };
  }

  it('keeps every other field, and a change made elsewhere since the calendar asked, through a move and its Undo', async () => {
    const records = clinicRecords();
    records[1] = { ...records[1], back: '2026-10-30', leave: '2026-10-20' };
    const source = clinicSource(records);
    const host = await mount({ dataSource: wholeRecords(source) });
    // Someone renames the patient on another screen after the calendar listed the visit.
    source.records['clinic.appointment'][1] = { ...source.records['clinic.appointment'][1], patient: 'Mona Adel Sayed' };
    const before = { ...source.records['clinic.appointment'][1] };
    moveTo(host, 'Mona Adel', { day: '2026-10-16', time: '15:30', doctor: '2' });
    await until(() => said(host).includes('Moved'));
    expect(source.records['clinic.appointment'][1]).toEqual({ ...before, start: at(16, 15, 30), stop: at(16, 16), doctor: { id: 2, label: 'Dr Salma' } });
    // It says it carries only those fields.
    const [move] = saves(source);
    expect(move.partial).toBe(true);
    expect(Object.keys(move.fields).sort()).toEqual(['doctor', 'start', 'stop']);
    expect(move.values).toEqual(move.changes.values);
    await settle();
    button(host.querySelector('.fd-cal-said') as HTMLElement, 'Undo').click();
    await until(() => said(host).includes('Put back'));
    // Exactly as it was, the rename kept.
    expect(source.records['clinic.appointment'][1]).toEqual(before);
    const undo = saves(source)[1];
    expect(undo.partial).toBe(true);
    expect(undo.values).toEqual({ start: at(14, 10), stop: at(14, 10, 30), doctor: KARIM });
    expect(Object.keys(undo.fields).sort()).toEqual(['doctor', 'start', 'stop']);
  });

  it('keeps every other field through a stretch, in a source that replaces the record unless told it is partial', async () => {
    const records = clinicRecords();
    // A field the calendar never asks for.
    records[1] = { ...records[1], leave: '2026-10-20' };
    const source = clinicSource(records);
    const replacing: DataSource = {
      ...source,
      save: async (request) => {
        const table = source.records[request.model];
        table[String(request.id)] = request.partial ? { ...table[String(request.id)], ...request.values } : { ...request.values };
        return { id: request.id as RecordId };
      },
    };
    const host = await mount({ dataSource: replacing });
    const before = { ...source.records['clinic.appointment'][1] };
    const grip = block(host, 'Mona Adel').querySelector('.fd-cal-resize') as HTMLElement;
    grip.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, cancelable: true, button: 0, clientY: 0 }));
    // 48 pixels an hour, from the column's top at 8:00: let go at 11:00.
    document.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientY: 144 }));
    document.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, clientY: 144 }));
    await until(() => said(host).includes('now ends'));
    expect(source.records['clinic.appointment'][1]).toEqual({ ...before, stop: at(14, 11) });
  });
});

describe('a record whose times or person are locked', () => {
  /** The clinic's source, its list rows told what may be done with each. */
  function telling(can: Record<number, NonNullable<ListedRecord['can']>>) {
    const source = clinicSource();
    const told: DataSource = {
      ...source,
      list: async (request) => {
        const answer = await source.list(request);
        return { ...answer, records: answer.records.map((r) => (can[r.id as number] ? { ...r, can: can[r.id as number] } : r)) };
      },
    };
    return { source, told };
  }

  it.each([
    ['its end read-only', { readonlyFields: ['stop'] }],
    ['its start read-only', { readonlyFields: ['start'] }],
    ['its doctor read-only', { readonlyFields: ['doctor'] }],
    ['its doctor hidden', { hiddenFields: ['doctor'] }],
  ])('offers no drag, no stretch, no M and no Move to… with %s, and says why', async (_, can) => {
    const { source, told } = telling({ 1: { ...can, reason: 'Booked by the front desk.' } });
    const opened: RecordId[] = [];
    const host = await mount({ dataSource: told, onOpenRecord: (id) => void opened.push(id) });
    const mona = block(host, 'Mona Adel');
    expect(mona.hasAttribute('data-moves')).toBe(false);
    expect(mona.querySelector('.fd-cal-resize, .fd-cal-event-menu')).toBeNull();
    expect(mona.getAttribute('title')).toBe('Booked by the front desk.');
    mona.focus();
    key(mona, 'm');
    key(mona, 'F10', { shiftKey: true });
    expect(host.querySelector('.fd-cal-move')).toBeNull();
    // Its keys are told as Enter alone, never M.
    expect(document.getElementById(mona.getAttribute('aria-describedby') ?? '')?.textContent).toBe('Enter opens it.');
    // A drag goes nowhere, and is no click: nothing opens.
    mona.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, cancelable: true, button: 0, clientX: 10, clientY: 10 }));
    document.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 10, clientY: 200 }));
    document.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, clientX: 10, clientY: 200 }));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(saves(source)).toEqual([]);
    expect(opened).toEqual([]);
    // A press that stays put still opens it.
    mona.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, cancelable: true, button: 0, clientX: 10, clientY: 10 }));
    document.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, clientX: 10, clientY: 10 }));
    expect(opened).toEqual([1]);
    expect(block(host, 'Omar Said').hasAttribute('data-moves')).toBe(true);
  });

  it('offers no move at all when the page locks the start, and tells no key that does nothing', async () => {
    const page = clinicPage();
    page.fields['start'] = { ...page.fields['start'], readonly: true } as Page['fields'][string];
    const host = await mount({ onOpenRecord: () => undefined }, page);
    expect(blocks(host).some((b) => b.hasAttribute('data-moves') || b.querySelector('.fd-cal-resize, .fd-cal-event-menu'))).toBe(false);
    const mona = block(host, 'Mona Adel');
    expect(document.getElementById(mona.getAttribute('aria-describedby') ?? '')?.textContent).toBe('Enter opens it.');
    // No reason to give one by one: nothing on the page moves.
    expect(mona.getAttribute('title')).toBe('10:00 to 10:30 · Mona Adel · Dr Karim');
  });
});

describe('Move to… refuses a day it cannot mean', () => {
  it.each([
    ['a year of two digits', '0026-10-14'],
    ['a year far on', '2062-10-14'],
    ['no day at all', ''],
  ])('refuses %s with words, saving nothing, the focus on the day', async (_, typed) => {
    const source = clinicSource();
    const host = await mount({ dataSource: source });
    const dialog = moveTo(host, 'Mona Adel', { day: typed });
    expect(dialog.isConnected).toBe(true);
    const day = dialog.querySelector('input[type="date"]') as HTMLInputElement;
    expect(document.activeElement).toBe(day);
    expect(day.getAttribute('aria-invalid')).toBe('true');
    const problem = document.getElementById(day.getAttribute('aria-describedby') ?? '') as HTMLElement;
    expect(problem.textContent).toBe('Pick a day from 14 Oct 2016 to 14 Oct 2036.');
    expect(problem.getAttribute('role')).toBe('alert');
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(saves(source)).toEqual([]);
    // Put right, it moves.
    day.value = '2026-10-15';
    button(dialog, 'Move').click();
    await until(() => said(host).includes('Moved'));
    expect(source.records['clinic.appointment'][1]['start']).toBe(at(15, 10));
  });

  it('refuses a time left empty rather than moving to midnight', async () => {
    const source = clinicSource();
    const host = await mount({ dataSource: source });
    const dialog = moveTo(host, 'Mona Adel', { time: '' });
    const time = dialog.querySelector('input[type="time"]') as HTMLInputElement;
    expect(document.activeElement).toBe(time);
    expect(document.getElementById(time.getAttribute('aria-describedby') ?? '')?.textContent).toBe('Pick a time.');
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(saves(source)).toEqual([]);
  });

  it('names the year when the move leaves the record’s own', async () => {
    const source = clinicSource();
    const host = await mount({ dataSource: source });
    moveTo(host, 'Mona Adel', { day: '2027-01-05' });
    await until(() => said(host).includes('Moved'));
    expect(said(host)).toMatch(/Moved Mona Adel to Tue,? 5 Jan 2027, 10:00\./);
    expect(source.records['clinic.appointment'][1]['start']).toBe(new Date(2027, 0, 5, 10).toISOString());
  });

  it('says its words in Arabic, French and German', async () => {
    for (const [locale, words] of [
      ['ar', 'اختر يومًا من'],
      ['fr', 'Choisissez un jour du'],
      ['de', 'Wählen Sie einen Tag vom'],
    ] as const) {
      const host = await mount({ locale });
      const mona = blocks(host).find((b) => b.querySelector('.fd-cal-event-title')?.textContent === 'Mona Adel') as HTMLElement;
      mona.focus();
      key(mona, 'm');
      const dialog = host.querySelector('.fd-cal-move') as HTMLElement;
      (dialog.querySelector('input[type="date"]') as HTMLInputElement).value = '0026-10-14';
      (dialog.querySelector('.fd-button-primary') as HTMLButtonElement).click();
      expect(dialog.querySelector('[role="alert"]')?.textContent).toContain(words);
      handle?.destroy();
      document.body.replaceChildren();
    }
  });
});

describe('the keys keep their place', () => {
  it('stands on the step toward a day not shown after Move to… sends the record there, and says where it went', async () => {
    const source = clinicSource();
    const host = await mount({ dataSource: source });
    moveTo(host, 'Mona Adel', { day: '2026-10-31' });
    await until(() => said(host).includes('Moved'));
    await settle();
    await until(() => document.activeElement !== document.body);
    expect(document.activeElement).toBe(button(host, 'Next week'));
    expect(said(host)).toContain('Moved Mona Adel to Sat 31 Oct, 10:00.');
    expect(host.querySelector('.fd-cal-said')?.getAttribute('role')).toBe('status');
  });

  it('stands on the record on its new day when that day is shown, and on it again after Undo', async () => {
    const host = await mount();
    moveTo(host, 'Mona Adel', { day: '2026-10-16' });
    await until(() => said(host).includes('Moved'));
    await settle();
    await until(() => (document.activeElement as HTMLElement)?.dataset?.['focus'] === 'e:1:2026-10-16');
    expect((document.activeElement as HTMLElement).dataset['focus']).toBe('e:1:2026-10-16');
    const undo = button(host.querySelector('.fd-cal-said') as HTMLElement, 'Undo');
    undo.focus();
    undo.click();
    await until(() => said(host).includes('Put back'));
    await settle();
    await until(() => document.activeElement !== document.body);
    expect((document.activeElement as HTMLElement).dataset['focus']).toBe('e:1:2026-10-14');
  });
});

describe('Escape lets go of a drag', () => {
  const pointer = (type: string, clientY = 0, target: EventTarget = document) =>
    target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientX: 5, clientY }));

  it('puts a stretch back, saving nothing', async () => {
    const source = clinicSource();
    const host = await mount({ dataSource: source });
    const height = block(host, 'Mona Adel').style.height;
    pointer('pointerdown', 10, block(host, 'Mona Adel').querySelector('.fd-cal-resize') as HTMLElement);
    pointer('pointermove', 300);
    expect(block(host, 'Mona Adel').style.height).not.toBe(height);
    key(document.body, 'Escape');
    expect(block(host, 'Mona Adel').style.height).toBe(height);
    pointer('pointerup', 300);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(saves(source)).toEqual([]);
    expect(source.records['clinic.appointment'][1]['stop']).toBe(at(14, 10, 30));
  });

  it('makes no record from slots dragged across', async () => {
    const made: Values[] = [];
    const host = await mount({ onNewRecord: (values) => void made.push(values) }, clinicPage({ view: 'day' }));
    const slot = host.querySelector('.fd-cal-col[aria-label="Wednesday 14 October, Dr Nour"] .fd-cal-slot[data-minutes="900"]') as HTMLElement;
    pointer('pointerdown', 0, slot);
    pointer('pointermove', 100);
    expect(host.querySelector('.fd-cal-picking')).not.toBeNull();
    key(document.body, 'Escape');
    expect(host.querySelector('.fd-cal-picking')).toBeNull();
    pointer('pointerup', 100);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(made).toEqual([]);
  });
});

describe('a crowded slot', () => {
  /** Nine visits at 16:00 with Dr Karim, as a busy afternoon's walk-ins. */
  function crowded() {
    const records = clinicRecords();
    for (let i = 0; i < 9; i++) records[910 + i] = { patient: `Crowd patient ${i + 1}`, start: at(14, 16), stop: at(14, 16, 30), doctor: KARIM, kind: 'check' };
    return records;
  }

  it('shows as many as are readable side by side and "+N more", which lists them all', async () => {
    const opened: RecordId[] = [];
    const host = await mount({ dataSource: clinicSource(crowded()), onOpenRecord: (id) => void opened.push(id) });
    const column = host.querySelector('.fd-cal-col[data-day="2026-10-14"]') as HTMLElement;
    const crowd = [...column.querySelectorAll<HTMLElement>(':scope > .fd-cal-event')].filter((b) => b.querySelector('.fd-cal-event-title')?.textContent?.startsWith('Crowd'));
    const more = column.querySelector<HTMLButtonElement>(':scope > button.fd-cal-more') as HTMLButtonElement;
    expect(more).not.toBeNull();
    // Three lanes, as no width is measured here: two records, and the third lane for the rest.
    expect(crowd).toHaveLength(2);
    for (const b of crowd) expect(b.style.width).toBe('calc(33.3333% - 3px)');
    expect(more.textContent).toBe('+7 more');
    expect(more.getAttribute('aria-label')).toBe('7 more on Wednesday 14 October, 16:00');
    more.focus();
    more.click();
    const list = host.querySelector('.fd-cal-crowd[role="dialog"]') as HTMLElement;
    expect(list.getAttribute('aria-labelledby')).toBeTruthy();
    expect(document.getElementById(list.getAttribute('aria-labelledby') as string)?.textContent).toBe('Wednesday 14 October, 16:00 to 16:30');
    const rows = [...list.querySelectorAll<HTMLElement>('.fd-cal-event-open')];
    expect(rows.map((r) => r.querySelector('.fd-cal-event-title')?.textContent)).toEqual(Array.from({ length: 9 }, (_, i) => `Crowd patient ${i + 1}`));
    expect(document.activeElement).toBe(rows[0]);
    // The arrows go down the list; Enter opens one.
    key(rows[0], 'ArrowDown');
    expect(document.activeElement).toBe(rows[1]);
    key(rows[1], 'Enter');
    expect(opened).toEqual([911]);
    // Escape closes it, the keys back on "+N more".
    key(rows[1], 'Escape');
    expect(host.querySelector('.fd-cal-crowd')).toBeNull();
    expect(document.activeElement).toBe(more);
  });

  it('moves one of the hidden ones from the list with M, and the keys find it after', async () => {
    const source = clinicSource(crowded());
    const host = await mount({ dataSource: source });
    const more = host.querySelector<HTMLButtonElement>('.fd-cal-col > button.fd-cal-more') as HTMLButtonElement;
    more.click();
    const row = [...(host.querySelector('.fd-cal-crowd') as HTMLElement).querySelectorAll<HTMLElement>('.fd-cal-event-open')][8];
    row.focus();
    key(row, 'm');
    const dialog = host.querySelector('.fd-cal-move') as HTMLElement;
    (dialog.querySelector('input[type="time"]') as HTMLInputElement).value = '17:30';
    button(dialog, 'Move').click();
    await until(() => said(host).includes('Moved Crowd patient 9'));
    await settle();
    await until(() => document.activeElement !== document.body);
    expect((document.activeElement as HTMLElement).dataset['focus']).toBe('e:918:2026-10-14');
    expect(source.records['clinic.appointment'][918]['start']).toBe(at(14, 17, 30));
  });

  it('gives each run of the records held back its own "+N more", and draws one alone itself', async () => {
    const records = clinicRecords();
    const add = (id: number, patient: string, from: [number, number], to: [number, number]) => (records[id] = { patient, start: at(14, ...from), stop: at(14, ...to), doctor: KARIM, kind: 'check' });
    // Four at 15:00 meet, and the first lasts on to 17:00, where one more meets it: one crowd, four lanes.
    add(930, 'Long', [15, 0], [17, 0]);
    add(931, 'Second', [15, 0], [15, 30]);
    add(932, 'Third', [15, 0], [15, 30]);
    add(933, 'Fourth', [15, 0], [15, 30]);
    add(934, 'Later', [16, 0], [16, 30]);
    add(935, 'Later still', [16, 0], [16, 30]);
    const host = await mount({ dataSource: clinicSource(records) });
    const column = host.querySelector('.fd-cal-col[data-day="2026-10-14"]') as HTMLElement;
    const mores = [...column.querySelectorAll<HTMLButtonElement>(':scope > button.fd-cal-more')];
    // Third and Fourth at 15:00 behind "+2 more"; at 16:00, Later still alone in the last lane, drawn itself.
    expect(mores.map((m) => [m.textContent, m.dataset['holds']])).toEqual([['+2 more', '932 933']]);
    expect(block(host, 'Later still').style.width).toBe('calc(33.3333% - 3px)');
    expect(block(host, 'Later still').style.insetInlineStart).toMatch(/^calc\(66\.66\d*% \+ 1px\)$/);
    // Its list: all the column holds then.
    mores[0].click();
    expect([...(host.querySelector('.fd-cal-crowd') as HTMLElement).querySelectorAll('.fd-cal-event-title')].map((t) => t.textContent)).toEqual(['Long', 'Second', 'Third', 'Fourth']);
  });

  it('keeps a crowd that fits side by side as it was', async () => {
    const records = clinicRecords();
    records[920] = { patient: 'Third', start: at(14, 10), stop: at(14, 10, 30), doctor: KARIM, kind: 'check' };
    const host = await mount({ dataSource: clinicSource(records) });
    expect(host.querySelector('.fd-cal-col > .fd-cal-more')).toBeNull();
    expect(block(host, 'Third').style.width).toBe('calc(33.3333% - 3px)');
  });
});
