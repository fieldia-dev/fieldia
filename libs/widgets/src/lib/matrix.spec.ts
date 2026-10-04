import { createForm, type Field, type Page } from '@fieldia/core';
import { createWidget } from './widgets';

/** A matrix question: rows down the side, columns across, one answer per row — or several when asked. */

const matrix = (extra: Record<string, unknown> = {}) =>
  ({
    type: 'matrix',
    label: 'How was it?',
    rows: [{ value: 'food', label: 'Food' }, { value: 'service', label: 'Service' }],
    columns: [{ value: 1, label: 'Poor' }, { value: 2, label: 'Fine' }, { value: 3, label: 'Great' }],
    ...extra,
  }) as Field;

function setup(field: Field) {
  const page = {
    fieldia: '0.1',
    id: 't',
    data: { kind: 'responses' },
    fields: { x: field },
    layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'n', field: 'x' }] },
  } as Page;
  const form = createForm({ page });
  const widget = createWidget({ form, name: 'x', field, node: { type: 'field', id: 'n', field: 'x' }, id: 'fd-x', document });
  document.body.replaceChildren(widget.element);
  const refresh = (extra: Partial<{ readonly: boolean }> = {}) =>
    widget.update({ value: form.getState().values['x'], values: form.getState().values, readonly: false, required: false, invalid: false, ...extra });
  form.subscribe(() => refresh());
  refresh();
  return { form, el: widget.element, refresh };
}
const cell = (el: Element, row: string, col: number) => el.querySelector(`input[data-row="${row}"][value="${col}"]`) as HTMLInputElement;

describe('matrix', () => {
  it('lays rows against columns, each row a group a screen reader names', () => {
    const { el } = setup(matrix());
    expect([...el.querySelectorAll('thead th')].map((t) => t.textContent)).toEqual(['', 'Poor', 'Fine', 'Great']);
    expect([...el.querySelectorAll('tbody th[scope="row"]')].map((t) => t.textContent)).toEqual(['Food', 'Service']);
    expect(el.querySelectorAll('input[type=radio]')).toHaveLength(6);
    expect(cell(el, 'food', 2).getAttribute('aria-label')).toBe('Food: Fine');
  });

  it('keeps one answer per row, keeping column values as they are', () => {
    const { form, el } = setup(matrix());
    cell(el, 'food', 3).click();
    cell(el, 'service', 1).click();
    cell(el, 'food', 2).click();
    expect(form.getState().values['x']).toEqual({ food: 2, service: 1 });
  });

  it('takes several per row when asked', () => {
    const { form, el } = setup(matrix({ multiple: true }));
    expect(el.querySelectorAll('input[type=checkbox]')).toHaveLength(6);
    cell(el, 'food', 1).click();
    cell(el, 'food', 3).click();
    expect(form.getState().values['x']).toEqual({ food: [1, 3] });
    cell(el, 'food', 1).click();
    expect(form.getState().values['x']).toEqual({ food: [3] });
  });

  it('shows a value set from outside, and goes read-only with the field', () => {
    const { form, el, refresh } = setup(matrix());
    form.setValue('x', { service: 3 });
    expect(cell(el, 'service', 3).checked).toBe(true);
    expect(cell(el, 'food', 1).checked).toBe(false);
    refresh({ readonly: true });
    expect(cell(el, 'food', 1).disabled).toBe(true);
  });
});
