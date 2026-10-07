import { createForm, type Field, type FieldNode, type Page } from '@fieldia/core';
import { createWidget } from './widgets';
import { WIDGET_LABELS } from './labels';
import { cellText } from './display';

/** A plain table whose columns are drawn by widgets of their own: sub-tasks with their hours as HH:MM and a progress bar. */
const page = {
  fieldia: '0.1',
  id: 'task',
  data: { kind: 'record', model: 'project.task' },
  fields: {
    child_ids: {
      type: 'one2many',
      label: 'Sub-tasks',
      relation: 'project.task',
      fields: {
        name: { type: 'char', label: 'Title' },
        allocated_hours: { type: 'float', label: 'Allocated' },
        progress: { type: 'float', label: 'Progress' },
        share: { type: 'float', label: 'Share' },
      },
    },
  },
  layout: {
    type: 'sections',
    id: 'root',
    children: [
      {
        type: 'field',
        id: 'f-lines',
        field: 'child_ids',
        totals: ['allocated_hours'],
        cells: { allocated_hours: { widget: 'duration' }, progress: { widget: 'progressbar', options: { max: 1 } }, share: { widget: 'percentage' } },
      },
    ],
  },
} as unknown as Page;

function mount() {
  const values = { child_ids: [{ key: 'a', values: { name: 'Survey', allocated_hours: 6.5, progress: 0.5, share: 0.25 } }, { key: 'b', values: { name: 'Drawings', allocated_hours: 2.25, progress: 1, share: 0.75 } }] };
  const form = createForm({ page, values: values as never });
  const node = (page.layout as { children: FieldNode[] }).children[0];
  const widget = createWidget({ form, name: 'child_ids', field: page.fields['child_ids'] as Field, node, id: 'fd-lines', document, labels: WIDGET_LABELS.en });
  document.body.replaceChildren(widget.element);
  const refresh = () => widget.update({ value: form.getState().values['child_ids'], values: form.getState().values, readonly: false, required: false, invalid: false });
  form.subscribe(refresh);
  refresh();
  return { form, el: widget.element };
}

const cell = (el: HTMLElement, line: string, column: string) => el.querySelector(`tr[data-line="${line}"] td[data-column="${column}"]`) as HTMLElement;

describe('a table’s cells drawn by a widget of their own', () => {
  it('draws each cell with its column’s widget and options', () => {
    const { el } = mount();
    expect((cell(el, 'a', 'allocated_hours').querySelector('input') as HTMLInputElement).value).toBe('06:30');
    const bar = cell(el, 'a', 'progress').querySelector('[role="progressbar"]') as HTMLElement;
    expect(bar.getAttribute('aria-valuetext')).toBe('50%');
    expect((cell(el, 'b', 'share').querySelector('input') as HTMLInputElement).value).toBe('75');
  });

  it('adds up a column in its widget’s words', () => {
    const { el } = mount();
    expect((el.querySelector('tfoot td[data-column="allocated_hours"]') as HTMLElement).textContent).toBe('08:45');
  });

  it('says a value in the words of the widget it is shown with, else as its type does', () => {
    const def = { type: 'float', label: 'Hours' } as Field;
    expect(cellText(def as never, 1.5, {}, 'en', undefined, { widget: 'duration', options: { suffix: 'h' } })).toBe('01:30 h');
    expect(cellText(def as never, 0.5, {}, 'en', undefined, { widget: 'percentage' })).toBe('50%');
    expect(cellText(def as never, 1.5, {}, 'en')).toBe('1.50');
  });
});
