import { createForm, createMemoryDataSource, type Field, type FieldNode, type Form, type Page } from '@fieldia/core';
import { createWidget } from './widgets';
import { WIDGET_LABELS } from './labels';

const page = {
  fieldia: '0.1',
  id: 'rel',
  data: { kind: 'record', model: 'partner' },
  fields: {
    country_id: { type: 'many2one', label: 'Country', relation: 'country' },
    region_id: { type: 'many2one', label: 'Region', relation: 'region', filter: [{ field: 'country_id', op: '=', valueFrom: 'country_id' }] },
    tag_ids: { type: 'many2many', label: 'Tags', relation: 'tag' },
    origin: { type: 'reference', label: 'Origin', models: [{ value: 'lead', label: 'Lead' }, { value: 'ticket', label: 'Ticket' }] },
  },
  layout: {
    type: 'sections',
    id: 'root',
    children: [
      { type: 'field', id: 'n-country', field: 'country_id' },
      { type: 'field', id: 'n-region', field: 'region_id' },
      { type: 'field', id: 'n-tags', field: 'tag_ids' },
      { type: 'field', id: 'n-tag-boxes', field: 'tag_ids', widget: 'checkboxes' },
      { type: 'field', id: 'n-origin', field: 'origin' },
    ],
  },
} as unknown as Page;

function source() {
  return createMemoryDataSource({
    records: {
      country: { 1: { name: 'Egypt' }, 2: { name: 'Jordan' }, 3: { name: 'Japan' } },
      region: { 1: { name: 'Cairo', country_id: { id: 1, label: 'Egypt' } }, 2: { name: 'Giza', country_id: { id: 1, label: 'Egypt' } }, 3: { name: 'Amman', country_id: { id: 2, label: 'Jordan' } } },
      tag: { 10: { name: 'VIP' }, 11: { name: 'Wholesale' }, 12: { name: 'Export' } },
      lead: { 1: { name: 'Hotel fit-out' } },
      ticket: { 7: { name: 'Broken kettle' } },
    },
  });
}

function mount(nodeId: string, form: Form = createForm({ page, dataSource: source() }), readonly = false) {
  const node = (page.layout as { children: FieldNode[] }).children.find((n) => n.id === nodeId) as FieldNode;
  const widget = createWidget({ form, name: node.field, field: page.fields[node.field] as Field, node, id: `fd-${nodeId}`, document, labels: WIDGET_LABELS.en });
  document.body.replaceChildren(widget.element);
  const refresh = () =>
    widget.update({ value: form.getState().values[node.field], values: form.getState().values, readonly, required: false, invalid: false });
  form.subscribe(refresh);
  refresh();
  return { form, el: widget.element };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 260));
const options = (el: Element) => [...el.querySelectorAll('[role=option]')].map((o) => o.textContent);
const key = (target: Element, k: string) => target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
function type(input: HTMLInputElement, text: string) {
  input.focus();
  input.value = text;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('many2one', () => {
  it('shows the chosen record and finds others as you type', async () => {
    const { form, el } = mount('n-country');
    form.setValue('country_id', { id: 1, label: 'Egypt' });
    const input = el.querySelector('input[role=combobox]') as HTMLInputElement;
    expect(input.value).toBe('Egypt');
    type(input, 'ja');
    await settle();
    expect(input.getAttribute('aria-expanded')).toBe('true');
    expect(options(el)).toEqual(['Japan']);
  });

  it('chooses with the arrow keys and Enter', async () => {
    const { form, el } = mount('n-country');
    const input = el.querySelector('input[role=combobox]') as HTMLInputElement;
    type(input, 'j');
    await settle();
    expect(options(el)).toEqual(['Jordan', 'Japan']);
    key(input, 'ArrowDown');
    key(input, 'ArrowDown');
    expect(input.getAttribute('aria-activedescendant')).toBe(el.querySelectorAll('[role=option]')[1].id);
    key(input, 'Enter');
    expect(form.getState().values['country_id']).toEqual({ id: 3, label: 'Japan' });
    expect(input.value).toBe('Japan');
    expect(input.getAttribute('aria-expanded')).toBe('false');
  });

  it('chooses with the mouse, keeping focus in the box', async () => {
    const { form, el } = mount('n-country');
    const input = el.querySelector('input[role=combobox]') as HTMLInputElement;
    type(input, 'egy');
    await settle();
    const option = el.querySelector('[role=option]') as HTMLElement;
    const down = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
    option.dispatchEvent(down);
    expect(down.defaultPrevented).toBe(true);
    option.click();
    expect(form.getState().values['country_id']).toEqual({ id: 1, label: 'Egypt' });
  });

  it('puts the chosen name back on Escape, and clears with an emptied box', async () => {
    const { form, el } = mount('n-country');
    form.setValue('country_id', { id: 2, label: 'Jordan' });
    const input = el.querySelector('input[role=combobox]') as HTMLInputElement;
    type(input, 'zz');
    await settle();
    expect(options(el)).toEqual([]);
    expect(el.querySelector('.fd-empty')?.textContent).toBe('No results');
    key(input, 'Escape');
    expect(input.value).toBe('Jordan');
    type(input, '');
    input.dispatchEvent(new FocusEvent('blur'));
    expect(form.getState().values['country_id']).toBeNull();
  });

  it('has a clear button, hidden when there is nothing to clear', () => {
    const { form, el } = mount('n-country');
    const clear = el.querySelector('.fd-combo-clear') as HTMLButtonElement;
    expect(clear.hidden).toBe(true);
    form.setValue('country_id', { id: 1, label: 'Egypt' });
    expect(clear.hidden).toBe(false);
    expect(clear.getAttribute('aria-label')).toBe('Clear Country');
    clear.click();
    expect(form.getState().values['country_id']).toBeNull();
  });

  it('only offers records its filter allows', async () => {
    const form = createForm({ page, dataSource: source() });
    form.setValue('country_id', { id: 1, label: 'Egypt' });
    const { el } = mount('n-region', form);
    type(el.querySelector('input[role=combobox]') as HTMLInputElement, '');
    await settle();
    expect(options(el)).toEqual(['Cairo', 'Giza']);
  });

  it('cannot be changed when readonly', () => {
    const form = createForm({ page, dataSource: source() });
    form.setValue('country_id', { id: 1, label: 'Egypt' });
    const { el } = mount('n-country', form, true);
    expect((el.querySelector('input[role=combobox]') as HTMLInputElement).readOnly).toBe(true);
    expect((el.querySelector('.fd-combo-clear') as HTMLButtonElement).hidden).toBe(true);
  });
});

describe('many2many', () => {
  it('shows tags that can be removed, and adds from the search', async () => {
    const { form, el } = mount('n-tags');
    form.setValue('tag_ids', [{ id: 10, label: 'VIP' }]);
    expect([...el.querySelectorAll('.fd-chip-label')].map((c) => c.textContent)).toEqual(['VIP']);
    const input = el.querySelector('input[role=combobox]') as HTMLInputElement;
    type(input, '');
    await settle();
    expect(options(el)).toEqual(['Wholesale', 'Export']); // VIP is already chosen
    key(input, 'ArrowDown');
    key(input, 'Enter');
    expect(form.getState().values['tag_ids']).toEqual([{ id: 10, label: 'VIP' }, { id: 11, label: 'Wholesale' }]);
    (el.querySelector('[aria-label="Remove VIP"]') as HTMLButtonElement).click();
    expect(form.getState().values['tag_ids']).toEqual([{ id: 11, label: 'Wholesale' }]);
  });

  it('removes the last tag with Backspace in an empty box', () => {
    const { form, el } = mount('n-tags');
    form.setValue('tag_ids', [{ id: 10, label: 'VIP' }, { id: 12, label: 'Export' }]);
    const input = el.querySelector('input[role=combobox]') as HTMLInputElement;
    input.focus();
    key(input, 'Backspace');
    expect(form.getState().values['tag_ids']).toEqual([{ id: 10, label: 'VIP' }]);
  });

  it('can be a list of checkboxes instead', async () => {
    const { form, el } = mount('n-tag-boxes');
    await settle();
    const boxes = [...el.querySelectorAll('input[type=checkbox]')] as HTMLInputElement[];
    expect(boxes.map((b) => b.closest('label')?.textContent)).toEqual(['VIP', 'Wholesale', 'Export']);
    boxes[2].focus();
    boxes[2].click();
    expect(document.activeElement).toBe(boxes[2]); // the same box: the list is not rebuilt
    boxes[0].click();
    expect(form.getState().values['tag_ids']).toEqual([{ id: 12, label: 'Export' }, { id: 10, label: 'VIP' }]);
    boxes[2].click();
    expect(form.getState().values['tag_ids']).toEqual([{ id: 10, label: 'VIP' }]);
    expect(boxes.map((b) => b.checked)).toEqual([true, false, false]);
  });
});

describe('reference', () => {
  it('picks a model, then a record of that model', async () => {
    const { form, el } = mount('n-origin');
    const model = el.querySelector('select') as HTMLSelectElement;
    expect([...model.options].map((o) => o.textContent)).toEqual(['', 'Lead', 'Ticket']);
    model.value = 'ticket';
    model.dispatchEvent(new Event('change', { bubbles: true }));
    const input = el.querySelector('input[role=combobox]') as HTMLInputElement;
    type(input, 'ket');
    await settle();
    expect(options(el)).toEqual(['Broken kettle']);
    key(input, 'ArrowDown');
    key(input, 'Enter');
    expect(form.getState().values['origin']).toEqual({ model: 'ticket', id: 7, label: 'Broken kettle' });
  });
});
