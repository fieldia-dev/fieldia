import { createForm, type ActionRequest, type Field, type FieldNode, type Page } from '@fieldia/core';
import { createWidget } from './widgets';
import { WIDGET_LABELS } from './labels';

/**
 * A plain table's buttons besides those on each line: lines chosen with a tick
 * and buttons for them in a bar over the table, buttons beside Add a line, and
 * a copy of a line right after it.
 */
const page = {
  fieldia: '0.1',
  id: 'mo',
  data: { kind: 'record', model: 'mrp.production' },
  fields: {
    state: { type: 'selection', label: 'Status', options: [{ value: 'draft', label: 'Draft' }, { value: 'progress', label: 'In progress' }] },
    workorder_ids: {
      type: 'one2many',
      label: 'Work orders',
      relation: 'mrp.workorder',
      fields: { name: { type: 'char', label: 'Operation' }, hours: { type: 'float', label: 'Hours' } },
    },
  },
  layout: {
    type: 'sections',
    id: 'root',
    children: [
      {
        type: 'field',
        id: 'f-wo',
        field: 'workorder_ids',
        options: { copy: true },
        selectedButtons: [
          { type: 'button', id: 'wo-start', label: 'Start', action: 'button_start', invisible: "state == 'draft'" },
          { type: 'button', id: 'wo-done', label: 'Done', action: 'button_finish' },
        ],
        controlButtons: [{ type: 'button', id: 'wo-catalog', label: 'Catalog', action: 'action_add_from_catalog', invisible: "state == 'draft'" }],
      },
    ],
  },
} as unknown as Page;

function mount(state = 'progress') {
  const asked: ActionRequest[] = [];
  const form = createForm({
    page,
    values: { state, workorder_ids: [{ key: 'a', id: 11, values: { name: 'Cut', hours: 2 } }, { key: 'b', id: 12, values: { name: 'Glue', hours: 1 } }, { key: 'c', values: { name: 'Paint', hours: 3 } }] } as never,
    onAction: (request) => void asked.push(request),
  });
  const node = (page.layout as { children: FieldNode[] }).children[0];
  const widget = createWidget({ form, name: 'workorder_ids', field: page.fields['workorder_ids'] as Field, node, id: 'fd-wo', document, labels: WIDGET_LABELS.en });
  document.body.replaceChildren(widget.element);
  let readonly = false;
  const refresh = () => widget.update({ value: form.getState().values['workorder_ids'], values: form.getState().values, readonly, required: false, invalid: false });
  form.subscribe(refresh);
  refresh();
  return { form, el: widget.element, asked, setReadonly: (on: boolean) => ((readonly = on), refresh()) };
}

const pick = (el: Element, key: string) => el.querySelector(`tr[data-line="${key}"] input.fd-line-pick`) as HTMLInputElement;
const tick = (box: HTMLInputElement) => {
  box.checked = !box.checked;
  box.dispatchEvent(new Event('change', { bubbles: true }));
};
const bar = (el: Element) => el.querySelector('.fd-lines-chosen') as HTMLElement;
const barButton = (el: Element, id: string) => bar(el).querySelector(`[data-node="${id}"]`) as HTMLButtonElement;
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('lines chosen in a plain table, and buttons for them', () => {
  it('shows the bar once a line is chosen, says how many, and its buttons by the record', () => {
    const { el, form } = mount('draft');
    expect(bar(el).hidden).toBe(true);
    tick(pick(el, 'a'));
    expect(bar(el).hidden).toBe(false);
    expect(bar(el).querySelector('.fd-lines-chosen-count')?.textContent).toBe('1 chosen');
    expect(barButton(el, 'wo-start').hidden).toBe(true);
    expect(barButton(el, 'wo-done').hidden).toBe(false);
    form.setValue('state', 'progress');
    expect(barButton(el, 'wo-start').hidden).toBe(false);
    expect(pick(el, 'b').getAttribute('aria-label')).toBe('Choose line 2');
  });

  it('runs with the lines chosen, in their order in the table', async () => {
    const { el, asked } = mount();
    tick(pick(el, 'c'));
    tick(pick(el, 'a'));
    barButton(el, 'wo-start').click();
    await settle();
    expect(asked[0]).toMatchObject({ action: 'button_start', lines: { keys: ['a', 'c'], ids: [11] } });
  });

  it('chooses every line from the head, and a line gone is no longer chosen', () => {
    const { el, form } = mount();
    const all = el.querySelector('thead input.fd-line-pick-all') as HTMLInputElement;
    expect(all.getAttribute('aria-label')).toBe('Choose every line');
    tick(all);
    expect(bar(el).querySelector('.fd-lines-chosen-count')?.textContent).toBe('3 chosen');
    tick(pick(el, 'b'));
    expect(all.indeterminate).toBe(true);
    form.removeLine('workorder_ids', 'a');
    expect(bar(el).querySelector('.fd-lines-chosen-count')?.textContent).toBe('1 chosen');
  });

  it('chooses nothing while read-only', () => {
    const { el, setReadonly } = mount();
    tick(pick(el, 'a'));
    setReadonly(true);
    expect(bar(el).hidden).toBe(true);
    expect(pick(el, 'a').disabled).toBe(true);
  });
});

describe('buttons beside Add a line', () => {
  it('show by the record, run as the record’s buttons, and go while read-only', async () => {
    const { el, form, asked, setReadonly } = mount('draft');
    const catalog = () => el.querySelector('.fd-lines-adds [data-node="wo-catalog"]') as HTMLButtonElement;
    expect(catalog().hidden).toBe(true);
    form.setValue('state', 'progress');
    expect(catalog().hidden).toBe(false);
    catalog().click();
    await settle();
    expect(asked[0]).toMatchObject({ action: 'action_add_from_catalog' });
    setReadonly(true);
    expect((el.querySelector('.fd-lines-adds') as HTMLElement).hidden).toBe(true);
  });
});

describe('a line copied', () => {
  it('puts a copy right after it, its values too, never its saved id', () => {
    const { el, form } = mount();
    const copy = el.querySelector('tr[data-line="a"] button.fd-line-copy') as HTMLButtonElement;
    expect(copy.getAttribute('aria-label')).toBe('Copy line 1');
    copy.click();
    const lines = form.getState().values['workorder_ids'] as { key: string; id?: number; values: { name: string } }[];
    expect(lines.map((l) => l.values.name)).toEqual(['Cut', 'Cut', 'Glue', 'Paint']);
    expect(lines[1].id).toBeUndefined();
  });
});

describe('a plain table on a phone', () => {
  it('is marked to draw its lines as cards, each cell with its column’s label, and its columns fit to content', async () => {
    const { FIELDIA_CSS } = await import('./styles');
    const node = { ...(page.layout as { children: FieldNode[] }).children[0], cards: 'narrow', fit: 'content' } as FieldNode;
    const form = createForm({ page, values: { state: 'draft', workorder_ids: [{ key: 'a', values: { name: 'Cut', hours: 2 } }] } as never });
    const widget = createWidget({ form, name: 'workorder_ids', field: page.fields['workorder_ids'] as Field, node, id: 'fd-wo', document, labels: WIDGET_LABELS.en });
    widget.update({ value: form.getState().values['workorder_ids'], values: form.getState().values, readonly: false, required: false, invalid: false });
    expect(widget.element.dataset['cards']).toBe('narrow');
    expect(widget.element.dataset['fit']).toBe('content');
    expect((widget.element.querySelector('td[data-column="hours"]') as HTMLElement).dataset['label']).toBe('Hours');
    expect(FIELDIA_CSS).toContain('@container fd-lines (max-width: 520px)');
    expect(FIELDIA_CSS).toContain('.fd-lines[data-cards="always"]');
  });
});
