import type { Page } from '../format/page';
import { validatePage } from '../format/validate';
import { createForm } from './form';

/**
 * A field's own value in a tone while a condition holds, and in bold: Flectra's
 * `decoration-danger="date_deadline < current_date"` on a field outside a table.
 */
const task = {
  fieldia: '0.1',
  id: 'task',
  data: { kind: 'record', model: 'project.task' },
  fields: {
    deadline: { type: 'date', label: 'Deadline' },
    state: { type: 'selection', label: 'Status', options: [{ value: 'open', label: 'Open' }, { value: 'done', label: 'Done' }] },
    remaining: { type: 'float', label: 'Remaining hours' },
  },
  layout: {
    type: 'sheet',
    id: 'sheet',
    title: { field: 'state', below: [{ type: 'field', id: 'f-state-below', field: 'state', widget: 'badge', tones: [{ tone: 'success', when: "state == 'done'" }] }] },
    children: [
      { type: 'field', id: 'f-deadline', field: 'deadline', tones: [{ tone: 'danger', when: "deadline and deadline < today() and state != 'done'" }] },
      { type: 'field', id: 'f-remaining', field: 'remaining', tones: [{ tone: 'danger', when: 'remaining < 0' }, { tone: 'warning', when: 'remaining < 2' }], bold: 'remaining < 0' },
      { type: 'field', id: 'f-plain', field: 'state' },
    ],
  },
} as unknown as Page;

const make = (values: Record<string, unknown>) => createForm({ page: task, values: values as never, now: () => new Date('2026-10-07T10:00:00') });

describe('a field’s own value in a tone', () => {
  it('is a valid page, and refuses a tone that reads a field the page lacks', () => {
    expect(validatePage(task)).toMatchObject({ ok: true });
    const wrong = structuredClone(task) as unknown as { layout: { children: { tones?: unknown }[] } };
    wrong.layout.children[0].tones = [{ tone: 'danger', when: 'nothing > 1' }];
    const result = validatePage(wrong as unknown as Page);
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).toContain('layout.children[0].tones[0].when');
  });

  it('takes the first tone that holds, and none when none does', () => {
    const late = make({ deadline: '2026-10-01', state: 'open', remaining: 5 });
    expect(late.fieldTone('f-deadline')).toEqual({ tone: 'danger', bold: false });
    expect(late.fieldTone('f-remaining')).toEqual({ tone: null, bold: false });
    late.setValue('remaining', 1);
    expect(late.fieldTone('f-remaining')).toEqual({ tone: 'warning', bold: false });
    late.setValue('remaining', -3);
    expect(late.fieldTone('f-remaining')).toEqual({ tone: 'danger', bold: true });
    late.setValue('state', 'done');
    expect(late.fieldTone('f-deadline')).toEqual({ tone: null, bold: false });
    expect(late.fieldTone('f-state-below')).toEqual({ tone: 'success', bold: false });
  });

  it('is plain on a field with no tones, and refuses a part that is not a field', () => {
    const form = make({ state: 'open' });
    expect(form.fieldTone('f-plain')).toEqual({ tone: null, bold: false });
    expect(() => form.fieldTone('sheet')).toThrow(/not a field/);
  });
});
