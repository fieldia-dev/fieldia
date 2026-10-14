import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { validatePage, type Field, type ListNode, type Page } from '@fieldia/core';
import { elementFactory } from './chrome';
import { blankPage, createDesigner } from './designer';
import { listProperties } from './list-properties';
import { madeUpTimes } from './try-it';

/**
 * A list page whose records are also on a calendar (`calendar` on the list),
 * set in the list's panel as its map is: when each record starts and ends,
 * its words, its colour, a column for each person, the views offered and the
 * one it shows first, how the list opens, the week's first day and the hours.
 * The fields it names come onto the page from the model and go with it.
 */

const clinic = JSON.parse(readFileSync(join(__dirname, '../../../../examples/pages/clinic-calendar.page.json'), 'utf8')) as Page;
const model: Record<string, Field> = { ...clinic.fields, booked_on: { type: 'date', label: 'Booked on' }, fee: { type: 'monetary', label: 'Fee', currency: 'EGP' } };
const list = (d: ReturnType<typeof createDesigner>) => d.getPage().layout as ListNode;

describe('a list page on a calendar', () => {
  it('puts the records on a calendar, bringing its fields from the model, and takes it away, letting them go', () => {
    const designer = createDesigner({ page: blankPage('list', 'Appointments'), model });
    expect(designer.addColumn('patient')).toBe(true);
    expect(designer.setListOptions({ calendar: { start: 'start', end: 'stop', title: 'patient', resource: 'doctor', colour: 'service' } })).toBe(true);
    expect(list(designer).calendar).toEqual({ start: 'start', end: 'stop', title: 'patient', resource: 'doctor', colour: 'service' });
    for (const name of ['start', 'stop', 'doctor', 'service']) expect(designer.getPage().fields[name]).toEqual(model[name]);
    expect(validatePage(designer.getPage()).ok).toBe(true);
    // The fields stay while it names them, whatever else stops naming them.
    expect(designer.setListOptions({ searchFields: [], groupBy: [] })).toBe(true);
    expect('doctor' in designer.getPage().fields).toBe(true);
    expect(designer.setListOptions({ calendar: null })).toBe(true);
    expect(list(designer).calendar).toBeUndefined();
    expect(Object.keys(designer.getPage().fields).sort()).toEqual(['name', 'patient']);
    designer.undo();
    expect(list(designer).calendar?.resource).toBe('doctor');
  });

  it('refuses a calendar that names a field of the wrong kind, or none, saying why', () => {
    const designer = createDesigner({ page: blankPage('list', 'Appointments'), model });
    expect(designer.setListOptions({ calendar: { start: 'patient', title: 'patient' } })).toBe(false);
    expect(designer.getState().issues.join(' ')).toMatch(/"patient" is a char; a calendar's start is a date, or a date and time/);
    expect(designer.setListOptions({ calendar: { start: 'nowhere', title: 'patient' } })).toBe(false);
    expect(designer.getState().issues).toEqual(['There is no field "nowhere"']);
    expect(list(designer).calendar).toBeUndefined();
  });
});

describe('the list’s Calendar, in its panel', () => {
  function mount(page: Page, fields: Record<string, Field> = model, locale?: 'ar') {
    const designer = createDesigner({ page, model: fields, ...(locale ? { locale } : {}) });
    const panel = listProperties(elementFactory(document), designer);
    document.body.replaceChildren(panel.element);
    const update = () => panel.update(designer.getPage());
    designer.subscribe(update);
    update();
    const part = panel.element.querySelector<HTMLElement>('[data-part="calendar"]')!;
    const control = <T extends HTMLElement>(name: string) => part.querySelector<T>(`[aria-label="${name}"]`)!;
    const shown = (element: Element) => !element.closest('[hidden]');
    const tick = part.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    return { designer, part, control, shown, tick };
  }
  const ticked = (part: HTMLElement, words: string) => [...part.querySelectorAll('label')].find((l) => l.textContent === words)!.querySelector<HTMLInputElement>('input')!;
  const change = (input: HTMLInputElement | HTMLSelectElement, value?: string) => {
    if (value !== undefined) input.value = value;
    else if (input instanceof HTMLInputElement) input.checked = !input.checked;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  };

  it('offers Calendar beside Map, and turned on starts from the page’s first date and time, its end, and its first column’s words', () => {
    const page = { ...blankPage('list', 'Appointments'), fields: { patient: model['patient'], start: model['start'], stop: model['stop'] }, layout: { type: 'list', id: 'list', columns: ['patient', 'start'] } } as Page;
    const { designer, part, tick, shown, control } = mount(page);
    expect(part.querySelector('.fd-prop-name')?.textContent).toBe('Calendar');
    expect(shown(tick)).toBe(true);
    expect(shown(part.querySelector('[data-why="no-date"]')!)).toBe(false);
    expect(shown(control('Starts'))).toBe(false);
    change(tick);
    expect(list(designer).calendar).toEqual({ start: 'start', end: 'stop', title: 'patient' });
    expect(shown(control('Starts'))).toBe(true);
    expect(control<HTMLSelectElement>('Starts').value).toBe('start');
    expect(control<HTMLSelectElement>('Ends').value).toBe('stop');
    expect(control<HTMLSelectElement>('Words on each record').value).toBe('patient');
    change(tick);
    expect(list(designer).calendar).toBeUndefined();
  });

  it('sets its words, its colour, a column for each, the views, the first view, how the list opens, the first day, the hours and the slot', () => {
    const { designer, part, control } = mount(clinic);
    change(control<HTMLSelectElement>('Colour by'), '');
    expect(list(designer).calendar?.colour).toBeUndefined();
    change(control<HTMLSelectElement>('Colour by'), 'state');
    expect(list(designer).calendar?.colour).toBe('state');
    change(control<HTMLSelectElement>('A column for each'), '');
    expect(list(designer).calendar?.resource).toBeUndefined();
    // A column for each: a link, a choice, text or a whole number; never an amount.
    const offered = [...control<HTMLSelectElement>('A column for each').options].map((o) => o.value);
    expect(offered).toContain('doctor');
    expect(offered).not.toContain('fee');
    change(ticked(part, 'Month'));
    expect(list(designer).calendar?.views).toEqual(['day', 'week', 'agenda']);
    change(control<HTMLSelectElement>('Shows first'), 'week');
    expect(list(designer).calendar?.view).toBe('week');
    change(control<HTMLSelectElement>('The list opens on'), 'list');
    expect(list(designer).calendar?.opens).toBeUndefined();
    change(control<HTMLSelectElement>('The week starts on'), '0');
    expect(list(designer).calendar?.firstDay).toBe(0);
    change(control<HTMLSelectElement>('The week starts on'), '');
    expect(list(designer).calendar?.firstDay).toBeUndefined();
    change(control<HTMLInputElement>('From the hour'), '7');
    change(control<HTMLInputElement>('To the hour'), '22');
    expect(list(designer).calendar?.hours).toEqual({ start: 7, end: 22 });
    change(control<HTMLSelectElement>('A slot holds'), '60');
    expect(list(designer).calendar?.slot).toBe(60);
    expect(validatePage(designer.getPage()).ok).toBe(true);
  });

  it('keeps one view at least, and offers as first only the views it shows', () => {
    const page = JSON.parse(JSON.stringify(clinic)) as Page;
    (page.layout as ListNode).calendar = { start: 'start', title: 'patient', views: ['week'], view: 'week' };
    const { designer, part, control } = mount(page);
    const week = ticked(part, 'Week');
    change(week);
    expect(list(designer).calendar?.views).toEqual(['week']);
    expect(week.checked).toBe(true);
    const why = part.querySelector<HTMLElement>('[data-why="views"]')!;
    expect(why.hidden).toBe(false);
    expect(why.textContent).toBe('A calendar shows one view at least.');
    expect([...control<HTMLSelectElement>('Shows first').options].map((o) => o.value)).toEqual(['week']);
    // The first of those offered is said by saying nothing; another is named.
    change(ticked(part, 'Day'));
    expect(why.hidden).toBe(true);
    change(control<HTMLSelectElement>('Shows first'), 'day');
    expect(list(designer).calendar?.view).toBeUndefined();
    change(control<HTMLSelectElement>('Shows first'), 'week');
    expect(list(designer).calendar?.view).toBe('week');
    // The view shown first taken away: the first offered, then.
    change(ticked(part, 'Week'));
    expect(list(designer).calendar).toMatchObject({ views: ['day'] });
    expect(list(designer).calendar?.view).toBeUndefined();
    expect(validatePage(designer.getPage()).ok).toBe(true);
  });

  it('offers an end of the start’s kind alone, and says why there is no calendar on a page with no date', () => {
    const { control } = mount(clinic);
    expect([...control<HTMLSelectElement>('Ends').options].map((o) => o.value)).toEqual(['', 'start', 'stop']);
    const page = { ...blankPage('list', 'Things'), fields: { name: { type: 'char', label: 'Name' } }, layout: { type: 'list', id: 'list', columns: ['name'] } } as Page;
    const { tick, part, shown } = mount(page, { name: { type: 'char', label: 'Name' } });
    expect(shown(tick)).toBe(false);
    const why = part.querySelector<HTMLElement>('[data-why="no-date"]')!;
    expect(shown(why)).toBe(true);
    expect(why.textContent).toBe('A calendar needs a date, or a date and time, for when each record starts.');
  });

  it('speaks Arabic', () => {
    const { part } = mount(clinic, model, 'ar');
    expect(part.querySelector('.fd-prop-name')?.textContent).toBe('التقويم');
  });
});

describe('Try it, with a calendar', () => {
  it('puts each made-up record in the week round today, in working hours, as a calendar opens on today', () => {
    const now = new Date(2026, 9, 14, 11, 0);
    const rows: Record<string, unknown>[] = Array.from({ length: 10 }, () => ({ start: '2026-01-01 09:30:00' }));
    madeUpTimes({ start: 'start', end: 'stop', title: 'patient' }, clinic, rows, now);
    const starts = rows.map((row) => new Date(row['start'] as string));
    expect(Math.min(...starts.map((d) => d.getDate()))).toBe(11);
    expect(Math.max(...starts.map((d) => d.getDate()))).toBe(17);
    for (const [i, start] of starts.entries()) {
      expect(start.getHours()).toBeGreaterThanOrEqual(9);
      expect(start.getHours()).toBeLessThan(17);
      expect(new Date(rows[i]['stop'] as string).getTime()).toBeGreaterThan(start.getTime());
    }
    // A calendar of days: days, as a date field keeps them.
    const days: Record<string, unknown>[] = [{}, {}];
    madeUpTimes({ start: 'booked_on', title: 'patient' }, { ...clinic, fields: { ...clinic.fields, booked_on: { type: 'date', label: 'Booked on' } } }, days, now);
    expect(days.map((d) => d['booked_on'])).toEqual(['2026-10-11', '2026-10-12']);
  });
});
