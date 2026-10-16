import { createForm, createMemoryDataSource, type Field, type FieldNode, type Page, type RelatedRecord } from '@fieldia/core';
import { WIDGET_LABELS } from './labels';
import { memoryPreferences } from './preferences';
import { mountKind } from './test-kinds';
import { createWidget } from './widgets';

/**
 * Words typed into a box that picks by name — a link, its tags, a reference,
 * a path, a choice found by its name, an account in a distribution — and a
 * save made while they are still typed, or still being looked up: Ctrl+Enter,
 * the Save button (the box left first), the app's own save or check. The save
 * reads them through the box's own reader (`form.settling`), as leaving would:
 * the record or option they name is what is saved; words that name none are
 * refused with why and kept in the box — never the choice they were replacing
 * saved in their place. Each box is mounted on a form of its own, without the
 * viewer: the readers are the boxes' own.
 */

const wait = (ms = 60) => new Promise((done) => setTimeout(done, ms));
function type(input: HTMLInputElement, text: string) {
  input.focus();
  input.value = text;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

const page = {
  fieldia: '0.1',
  id: 'project',
  data: { kind: 'record', model: 'project' },
  fields: {
    client_id: { type: 'many2one', label: 'Client', relation: 'partner' },
    tag_ids: { type: 'many2many', label: 'Tags', relation: 'tag' },
    source: { type: 'reference', label: 'Came from', models: [{ value: 'partner', label: 'Customer' }] },
    iteration: { type: 'many2one', label: 'Iteration', relation: 'work.iteration' },
    analytic: { type: 'json', label: 'Analytic' },
  },
  layout: {
    type: 'sections',
    id: 'root',
    children: [
      { type: 'field', id: 'f-client', field: 'client_id', options: { create: false } },
      { type: 'field', id: 'f-tags', field: 'tag_ids', options: { create: false } },
      { type: 'field', id: 'f-source', field: 'source' },
      { type: 'field', id: 'f-iteration', field: 'iteration', widget: 'path' },
      { type: 'field', id: 'f-analytic', field: 'analytic', widget: 'distribution', options: { model: 'partner' } },
    ],
  },
} as unknown as Page;

async function mount(nodeId: string) {
  const dataSource = createMemoryDataSource({
    records: {
      project: { 1: { client_id: { id: 1, label: 'Acme' }, tag_ids: [], source: { model: 'partner', id: 1, label: 'Acme' }, iteration: { id: 4, label: 'Sprint 14', path: ['Portal', 'Sprint 14'] }, analytic: { '1': 100 } } },
      partner: { 1: { name: 'Acme' }, 2: { name: 'Nile Interiors' }, 3: { name: 'Nile Interiors 2' } },
      tag: { 10: { name: 'VIP' }, 11: { name: 'Wholesale' } },
      'work.iteration': { 3: { name: 'Sprint 13', path: ['Portal', 'Sprint 13'] }, 4: { name: 'Sprint 14', path: ['Portal', 'Sprint 14'] } },
    },
    shows: { 'work.iteration': { path: 'path' } },
    // A search that takes its time, as a server's does.
    delayMs: 15,
  });
  const form = createForm({ page, dataSource, recordId: 1 });
  await form.load();
  const node = (page.layout as { children: FieldNode[] }).children.find((n) => n.id === nodeId) as FieldNode;
  const widget = createWidget({ form, name: node.field, field: page.fields[node.field] as Field, node, id: `fd-${nodeId}`, document, labels: WIDGET_LABELS.en, preferences: memoryPreferences() });
  const after = document.createElement('button');
  document.body.replaceChildren(widget.element, after);
  const refresh = () => widget.update({ value: form.getState().values[node.field], values: form.getState().values, readonly: false, required: false, invalid: false });
  form.subscribe(refresh);
  refresh();
  const input = widget.element.querySelector('input[role="combobox"], input:not([type="hidden"])') as HTMLInputElement;
  return { form, widget, input, stored: (name: string) => dataSource.records['project'][1][name] };
}
const label = (value: unknown) => (value as RelatedRecord | null)?.label ?? null;

describe('a link (many2one)', () => {
  it('the app’s save while the name is looked up waits for it, and saves the record it names', async () => {
    const { form, input, stored } = await mount('f-client');
    type(input, 'Nile Interiors');
    expect(await form.save()).toBe(true);
    expect(label(stored('client_id'))).toBe('Nile Interiors');
  });

  it('Ctrl+Enter takes the only match, as Enter does, and the save waits for it', async () => {
    const { form, input, stored } = await mount('f-client');
    type(input, 'interiors 2');
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true, cancelable: true }));
    expect(await form.save()).toBe(true);
    expect(label(stored('client_id'))).toBe('Nile Interiors 2');
  });

  it('left for the Save button, its lookup on its way: the save waits, and refuses words that name none, kept', async () => {
    const { form, input, stored } = await mount('f-client');
    type(input, 'Nile');
    input.blur();
    expect(await form.save()).toBe(false);
    expect(label(stored('client_id'))).toBe('Acme');
    expect(input.value).toBe('Nile');
    expect(form.getState().errors['client_id']).toBe('Client: nothing is called “⁨Nile⁩”; pick one from the list');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    // Picked from its list then, the words go with the pick.
    type(input, 'Nile Interiors 2');
    await wait(260);
    (document.querySelector('.fd-listbox [role="option"]') as HTMLElement).click();
    expect(form.getState().unread['client_id']).toBeUndefined();
    expect(await form.save()).toBe(true);
    expect(label(stored('client_id'))).toBe('Nile Interiors 2');
  });

  it('Escape lets the words go, and the box holds what it held', async () => {
    const { form, input } = await mount('f-client');
    type(input, 'Nile');
    form.validate();
    expect(form.getState().unread['client_id']).toBeDefined();
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    expect(input.value).toBe('Acme');
    expect(form.getState().unread['client_id']).toBeUndefined();
    await form.settle();
    expect(input.value).toBe('Acme');
  });
});

describe('tags of links (many2many) and a reference', () => {
  it('a tag’s name typed and saved at once is added, then saved', async () => {
    const { form, input, stored } = await mount('f-tags');
    type(input, 'VIP');
    expect(await form.save()).toBe(true);
    expect((stored('tag_ids') as RelatedRecord[]).map(label)).toEqual(['VIP']);
  });

  it('a tag’s name that names none is refused, kept in the box', async () => {
    const { form, input } = await mount('f-tags');
    type(input, 'Retail');
    expect(await form.save()).toBe(false);
    expect(input.value).toBe('Retail');
    expect(form.getState().errors['tag_ids']).toContain('Retail');
  });

  it('a reference’s record typed and saved at once is the one saved', async () => {
    const { form, input, stored } = await mount('f-source');
    type(input, 'Nile Interiors');
    expect(await form.save()).toBe(true);
    expect(label(stored('source'))).toBe('Nile Interiors');
  });
});

describe('a path picker', () => {
  it('words typed and saved before their tree has come save the record they name', async () => {
    const { form, input, stored } = await mount('f-iteration');
    type(input, 'Portal\\Sprint 13');
    expect(await form.save()).toBe(true);
    expect(label(stored('iteration'))).toBe('Sprint 13');
  });

  it('words that name none are refused with why and kept; a check made meanwhile refuses them too', async () => {
    const { form, input, stored } = await mount('f-iteration');
    type(input, 'Sprint 99');
    expect(form.validate()).toBe(false);
    expect(await form.save()).toBe(false);
    expect(label(stored('iteration'))).toBe('Sprint 14');
    expect(input.value).toBe('Sprint 99');
    expect(form.getState().errors['iteration']).toBe('Iteration: nothing is called “⁨Sprint 99⁩”; pick one from the list');
  });
});

describe('an account in a distribution', () => {
  it('typed and saved at once: the line’s account is the one it names; words naming none are refused', async () => {
    const { form, widget, stored } = await mount('f-analytic');
    const account = widget.element.querySelector('input[role="combobox"]') as HTMLInputElement;
    type(account, 'Nile Interiors');
    expect(await form.save()).toBe(true);
    expect(stored('analytic')).toEqual({ '2': 100 });
    type(account, 'Narnia');
    expect(await form.save()).toBe(false);
    expect(stored('analytic')).toEqual({ '2': 100 });
    expect(form.getState().errors['analytic']).toContain('Narnia');
  });
});

describe('a choice found by its name', () => {
  const floors = Array.from({ length: 20 }, (_, i) => ({ value: `f${i + 1}`, label: `Floor ${i + 1}` }));
  const box = (el: HTMLElement) => el.querySelector('input') as HTMLInputElement;

  it('one answer: its exact name typed and checked at once is taken; words that name none are refused, kept', () => {
    const { el, form, value } = mountKind({ type: 'selection', label: 'Floor', options: floors });
    const input = box(el);
    type(input, 'floor 12');
    expect(form.validate()).toBe(true);
    expect(value()).toBe('f12');
    type(input, 'Floor 99');
    expect(form.validate()).toBe(false);
    expect(value()).toBe('f12');
    expect(input.value).toBe('Floor 99');
    expect(form.getState().errors['x']).toBe('Floor: nothing is called “⁨Floor 99⁩”; pick one from the list');
    // Left with nothing waiting for them, the words stay, still unread with why: the choice held, never put back unsaid.
    input.blur();
    expect(input.value).toBe('Floor 99');
    expect(form.getState().unread['x']?.text).toBe('Floor 99');
    expect(form.validate()).toBe(false);
  });

  it('one answer emptied and checked at once is no answer', () => {
    const { el, form, value } = mountKind({ type: 'selection', label: 'Floor', options: floors });
    const input = box(el);
    type(input, 'floor 3');
    form.validate();
    expect(value()).toBe('f3');
    type(input, '');
    form.validate();
    expect(value()).toBeNull();
  });

  it('tags: an option’s name, or an own answer, typed and checked at once is added; words that name none are refused', () => {
    const own = mountKind({ type: 'selection', label: 'Needs', multiple: true, ownAnswers: true, options: [{ value: 'lift', label: 'Lift' }] }, { widget: 'tags' });
    type(box(own.el), 'lift');
    own.form.validate();
    expect(own.value()).toEqual(['lift']);
    type(box(own.el), 'Parking ');
    own.form.validate();
    expect(own.value()).toEqual(['lift', 'Parking']);
    const closed = mountKind({ type: 'selection', label: 'Rooms', multiple: true, options: [{ value: 'k', label: 'Kitchen' }] }, { widget: 'tags' });
    type(box(closed.el), 'Attic');
    expect(closed.form.validate()).toBe(false);
    expect(box(closed.el).value).toBe('Attic');
    expect(closed.value()).toEqual([]);
  });

  it('an answer of one’s own under “Other” naming an option ticks it when a save reads it', () => {
    const { el, value } = mountKind({ type: 'selection', label: 'Colour', other: true, options: [{ value: 'red', label: 'Red' }] }, { widget: 'radio' });
    const other = el.querySelector('.fd-other-input') as HTMLInputElement;
    type(other, ' RED ');
    other.dispatchEvent(new Event('change', { bubbles: true }));
    expect(value()).toBe('red');
  });
});



describe('a link in a line taken away', () => {
  const linesPage = {
    fieldia: '0.1',
    id: 'order',
    data: { kind: 'record', model: 'order' },
    fields: {
      line_ids: { type: 'one2many', label: 'Lines', relation: 'order.line', fields: { partner_id: { type: 'many2one', label: 'Supplier', relation: 'partner' } } },
    },
    layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'n-lines', field: 'line_ids' }] },
  } as unknown as Page;

  it('takes the words typed in it away too: a save waits for none of them, and is not refused by them', async () => {
    const dataSource = createMemoryDataSource({ records: { order: { 1: { line_ids: [] } }, partner: { 1: { name: 'Acme' } } }, delayMs: 15 });
    const form = createForm({ page: linesPage, dataSource, recordId: 1 });
    await form.load();
    const node = (linesPage.layout as { children: FieldNode[] }).children[0];
    const widget = createWidget({ form, name: 'line_ids', field: linesPage.fields['line_ids'] as Field, node, id: 'fd-lines', document, labels: WIDGET_LABELS.en });
    document.body.replaceChildren(widget.element);
    const refresh = () => widget.update({ value: form.getState().values['line_ids'], values: form.getState().values, readonly: false, required: false, invalid: false });
    form.subscribe(refresh);
    refresh();
    form.addLine('line_ids', {});
    const cell = widget.element.querySelector('tbody input[role="combobox"]') as HTMLInputElement;
    // Words that name none, left for the line's delete button: their lookup is on its way as the line goes.
    type(cell, 'Narnia');
    cell.blur();
    (widget.element.querySelector('.fd-line-delete') as HTMLButtonElement).click();
    expect(form.getState().values['line_ids']).toEqual([]);
    expect(await form.save()).toBe(true);
    await wait(60);
    expect(form.getState().unread).toEqual({});
    expect(form.getState().errors).toEqual({});
  });
});

describe('autosave while a name is typed', () => {
  it('waits until the box is left, never looking the words up under the keys; then saves the record they name', async () => {
    const dataSource = createMemoryDataSource({ records: { project: { 1: { client_id: { id: 1, label: 'Acme' }, tag_ids: [] } }, partner: { 1: { name: 'Acme' }, 2: { name: 'Nile Interiors' } } }, delayMs: 5 });
    const form = createForm({ page, dataSource, recordId: 1, autosave: { delayMs: 30 } });
    await form.load();
    const node = (page.layout as { children: FieldNode[] }).children[0];
    const widget = createWidget({ form, name: 'client_id', field: page.fields['client_id'] as Field, node, id: 'fd-auto', document, labels: WIDGET_LABELS.en });
    document.body.replaceChildren(widget.element, document.createElement('button'));
    const refresh = () => widget.update({ value: form.getState().values['client_id'], values: form.getState().values, readonly: false, required: false, invalid: false });
    form.subscribe(refresh);
    refresh();
    const input = widget.element.querySelector('input[role="combobox"]') as HTMLInputElement;
    // Something else changed, so autosave is on its way; then a name typed, half of it.
    form.setValue('tag_ids', [{ id: 10, label: 'VIP' }]);
    type(input, 'Nile');
    await wait(120);
    expect(form.getState().unread).toEqual({});
    expect(dataSource.records['project'][1]['tag_ids']).toEqual([]);
    type(input, 'Nile Interiors');
    input.blur();
    await wait(150);
    await form.settled();
    expect(label(dataSource.records['project'][1]['client_id'])).toBe('Nile Interiors');
    expect(dataSource.records['project'][1]['tag_ids']).toHaveLength(1);
  });
});
