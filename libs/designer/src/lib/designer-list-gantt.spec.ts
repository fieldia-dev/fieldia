import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { validatePage, type Field, type ListNode, type Page } from '@fieldia/core';
import { elementFactory } from './chrome';
import { blankPage, createDesigner } from './designer';
import { listProperties } from './list-properties';
import { madeUpPlan } from './try-it';

/**
 * A list page whose records are also on a Gantt timeline (`gantt` on the
 * list), set in the list's panel beside its calendar: when each record
 * starts, and ends or how many days it lasts, its words, its group, its
 * colour, what it waits for, the scales offered and the one it shows first,
 * and how the list opens. The fields it names come onto the page from the
 * model and go with it.
 */

const fitout = JSON.parse(readFileSync(join(__dirname, '../../../../examples/pages/fitout-plan.page.json'), 'utf8')) as Page;
const model: Record<string, Field> = {
  ...fitout.fields,
  finish: { type: 'date', label: 'Finishes' },
  booked: { type: 'datetime', label: 'Booked at' },
  cost: { type: 'monetary', label: 'Cost', currency: 'EGP' },
};
const list = (d: ReturnType<typeof createDesigner>) => d.getPage().layout as ListNode;
const tasks = (): Page => ({ ...blankPage('list', 'Tasks'), data: { kind: 'record', model: 'cafe.task' } });

describe('a list page on a timeline', () => {
  it('puts the records on a timeline, bringing its fields from the model, and takes it away, letting them go', () => {
    // A new list's first column is its name.
    const designer = createDesigner({ page: tasks(), model });
    expect(designer.setListOptions({ gantt: { start: 'start', duration: 'days', title: 'name', group: 'phase', colour: 'trade', dependsOn: 'after' } })).toBe(true);
    expect(list(designer).gantt).toEqual({ start: 'start', duration: 'days', title: 'name', group: 'phase', colour: 'trade', dependsOn: 'after' });
    for (const name of ['start', 'days', 'phase', 'trade', 'after']) expect(designer.getPage().fields[name]).toEqual(model[name]);
    expect(validatePage(designer.getPage()).ok).toBe(true);
    expect(designer.setListOptions({ gantt: null })).toBe(true);
    expect(list(designer).gantt).toBeUndefined();
    expect(Object.keys(designer.getPage().fields).sort()).toEqual(['name']);
    designer.undo();
    expect(list(designer).gantt?.dependsOn).toBe('after');
  });

  it('refuses a timeline that names a field of the wrong kind, or both an end and a duration, saying why', () => {
    // A new list's first column is its name.
    const designer = createDesigner({ page: tasks(), model });
    expect(designer.setListOptions({ gantt: { start: 'name', title: 'name' } })).toBe(false);
    expect(designer.getState().issues.join(' ')).toMatch(/"name" is a char; a bar's start is a date, or a date and time/);
    expect(designer.setListOptions({ gantt: { start: 'start', end: 'finish', duration: 'days', title: 'name' } })).toBe(false);
    expect(designer.getState().issues.join(' ')).toMatch(/a bar ends at its end or lasts its duration: say one/);
    expect(list(designer).gantt).toBeUndefined();
  });
});

describe('the list’s Timeline, in its panel', () => {
  function mount(page: Page, fields: Record<string, Field> = model, locale?: 'ar') {
    const designer = createDesigner({ page, model: fields, ...(locale ? { locale } : {}) });
    const panel = listProperties(elementFactory(document), designer);
    document.body.replaceChildren(panel.element);
    const update = () => panel.update(designer.getPage());
    designer.subscribe(update);
    update();
    const part = panel.element.querySelector<HTMLElement>('[data-part="gantt"]')!;
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

  it('offers Timeline after Calendar, and turned on starts from the first date, its end, the first column’s words and what each waits for', () => {
    const page = { ...fitout, layout: { ...(fitout.layout as ListNode), gantt: undefined } } as Page;
    delete (page.layout as ListNode).gantt;
    const { designer, part, tick, control, shown } = mount(page);
    expect(part.querySelector('.fd-prop-name')?.textContent).toBe('Timeline');
    const parts = [...document.querySelectorAll<HTMLElement>('[data-part]')].map((p) => p.dataset['part']);
    expect(parts.indexOf('gantt')).toBe(parts.indexOf('calendar') + 1);
    expect(tick.checked).toBe(false);
    change(tick);
    expect(list(designer).gantt).toEqual({ start: 'start', end: 'finish', title: 'name', dependsOn: 'after' });
    expect(shown(control('Grouped by'))).toBe(true);
    change(control<HTMLSelectElement>('Grouped by'), 'phase');
    change(control<HTMLSelectElement>('Colour by'), 'trade');
    expect(list(designer).gantt).toMatchObject({ group: 'phase', colour: 'trade' });
    // A number of days in place of the end: one or the other.
    change(control<HTMLSelectElement>('Lasts (days)'), 'days');
    expect(list(designer).gantt?.duration).toBe('days');
    expect(list(designer).gantt?.end).toBeUndefined();
    change(control<HTMLSelectElement>('Ends'), 'finish');
    expect(list(designer).gantt?.end).toBe('finish');
    expect(list(designer).gantt?.duration).toBeUndefined();
    // The scales: one at least, and the first among those offered.
    change(ticked(part, 'Days'));
    expect(list(designer).gantt?.zooms).toEqual(['week', 'month']);
    change(control<HTMLSelectElement>('Shows first'), 'month');
    expect(list(designer).gantt?.zoom).toBe('month');
    change(ticked(part, 'Weeks'));
    change(ticked(part, 'Months'));
    expect(shown(part.querySelector('[data-why="zooms"]')!)).toBe(true);
    expect(list(designer).gantt?.zooms).toEqual(['month']);
    change(control<HTMLSelectElement>('The list opens on'), 'gantt');
    expect(list(designer).gantt?.opens).toBe('gantt');
    expect(validatePage(designer.getPage()).ok).toBe(true);
    change(tick);
    expect(list(designer).gantt).toBeUndefined();
  });

  it('offers an end of the start’s kind alone, hides Waits for where the list has no link to its own records and says why, and says why there is no timeline on a page with no date', () => {
    const { control } = mount(fitout);
    expect([...control<HTMLSelectElement>('Ends').options].map((o) => o.value)).toEqual(['', 'finish']);
    const page = { ...fitout, fields: { name: fitout.fields['name'], start: fitout.fields['start'] }, layout: { type: 'list', id: 'list', columns: ['name'], gantt: { start: 'start', title: 'name' } } } as Page;
    const own = mount(page, { name: fitout.fields['name'], start: fitout.fields['start'] });
    expect(own.shown(own.control('Waits for'))).toBe(false);
    expect(own.shown(own.part.querySelector('[data-why="no-waits"]')!)).toBe(true);
    const bare = { ...blankPage('list', 'Things'), fields: { name: { type: 'char', label: 'Name' } }, layout: { type: 'list', id: 'list', columns: ['name'] } } as Page;
    const none = mount(bare, { name: { type: 'char', label: 'Name' } });
    expect(none.shown(none.tick)).toBe(false);
    const why = none.part.querySelector<HTMLElement>('[data-why="no-date"]')!;
    expect(none.shown(why)).toBe(true);
    expect(why.textContent).toBe('A timeline needs a date, or a date and time, for when each record starts.');
  });

  it('speaks Arabic', () => {
    const { part } = mount(fitout, model, 'ar');
    expect(part.querySelector('.fd-prop-name')?.textContent).toBe('المخطط الزمني');
  });
});

describe('Try it, with a timeline', () => {
  it('puts each made-up record a bar in the weeks round today, each third waiting for the one before it', () => {
    const now = new Date(2026, 9, 14, 11, 0);
    const rows: Record<string, unknown>[] = Array.from({ length: 9 }, () => ({}));
    madeUpPlan({ start: 'start', end: 'finish', title: 'name', dependsOn: 'after' }, { ...fitout, fields: { ...fitout.fields, finish: { type: 'date', label: 'Finishes' } } }, rows, now);
    expect(rows.map((r) => r['start'])).toEqual(['2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11', '2026-10-12']);
    expect(rows[0]['finish']).toBe('2026-10-05');
    expect(rows[3]['after']).toEqual([{ id: '3', label: '3' }]);
    expect(rows[1]['after']).toEqual([]);
    const timed: Record<string, unknown>[] = [{}];
    madeUpPlan({ start: 'booked', duration: 'days', title: 'name' }, { ...fitout, fields: { ...fitout.fields, booked: { type: 'datetime', label: 'Booked at' } } }, timed, now);
    expect(new Date(timed[0]['booked'] as string).getHours()).toBe(9);
    expect(timed[0]['days']).toBe(2);
  });
});
