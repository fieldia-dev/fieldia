import { createForm, createMemoryDataSource, type Field, type FieldNode, type Page, type RelatedRecord } from '@fieldia/core';
import { WIDGET_LABELS } from './labels';
import { mountKind, press, typeInto } from './test-kinds';
import { createWidget } from './widgets';

/**
 * A name typed is taken as the person meant it, by every box that reads names: a link, its tags, a reference, a path
 * and a choice typed by name. Words that name none — or several — stay as typed when the box is left, kept unread
 * with why, so a save is refused in words and never saves what the box held, however fast the source answers; Escape
 * puts that back. A record of exactly the name typed is taken whatever row the list has reached, unless the arrows
 * reached it since the words were typed; a path's Ctrl+Enter reads the words as a save does, however soon.
 */

const wait = (ms = 40) => new Promise((done) => setTimeout(done, ms));

const page = {
  fieldia: '0.1',
  id: 'project',
  data: { kind: 'record', model: 'project' },
  fields: {
    client_id: { type: 'many2one', label: 'Client', relation: 'partner' },
    tag_ids: { type: 'many2many', label: 'Tags', relation: 'tag' },
    source: { type: 'reference', label: 'Came from', models: [{ value: 'partner', label: 'Customer' }, { value: 'country', label: 'Country' }] },
    iteration: { type: 'many2one', label: 'Iteration', relation: 'work.iteration' },
  },
  layout: {
    type: 'sections',
    id: 'root',
    children: [
      { type: 'field', id: 'f-client', field: 'client_id', options: { create: false } },
      { type: 'field', id: 'f-tags', field: 'tag_ids', options: { create: false } },
      { type: 'field', id: 'f-source', field: 'source' },
      { type: 'field', id: 'f-iteration', field: 'iteration', widget: 'path' },
    ],
  },
} as unknown as Page;

async function mount(field: keyof typeof page.fields) {
  const dataSource = createMemoryDataSource({
    records: {
      project: { 1: { client_id: { id: 1, label: 'Acme' }, tag_ids: [], source: { model: 'partner', id: 1, label: 'Acme' }, iteration: { id: 4, label: 'Sprint 14', path: ['Portal', 'Sprint 14'] } } },
      partner: { 1: { name: 'Acme' }, 2: { name: 'Nile Interiors' }, 3: { name: 'Nile' } },
      tag: { 10: { name: 'VIP' } },
      country: { 1: { name: 'Egypt' } },
      'work.iteration': {
        1: { name: 'Portal', path: ['Portal'] },
        3: { name: 'Sprint 12', path: ['Portal', 'Sprint 12'] },
        4: { name: 'Sprint 14', path: ['Portal', 'Sprint 14'] },
        5: { name: 'Sprint 13', path: ['Portal', 'Sprint 13'] },
        6: { name: 'Sprint 1', path: ['Warehouse', 'Sprint 1'] },
      },
    },
    shows: { 'work.iteration': { path: 'path' } },
  });
  const form = createForm({ page, dataSource, recordId: 1 });
  await form.load();
  const node = (page.layout as { children: FieldNode[] }).children.find((n) => n.field === field) as FieldNode;
  const widget = createWidget({ form, name: field, field: page.fields[field] as Field, node, id: `fd-${field}`, document, labels: WIDGET_LABELS.en });
  const after = document.createElement('button');
  document.body.replaceChildren(widget.element, after);
  const refresh = () => widget.update({ value: form.getState().values[field], values: form.getState().values, readonly: false, required: false, invalid: false });
  form.subscribe(refresh);
  refresh();
  const input = widget.element.querySelector('input[role="combobox"]') as HTMLInputElement;
  return { form, dataSource, input, after, el: widget.element, saves: () => dataSource.calls.filter((call) => call.method === 'save').length };
}

describe('words that name none, left', () => {
  for (const [field, typed] of [
    ['client_id', 'Narnia'],
    ['tag_ids', 'Retail'],
    ['source', 'Narnia'],
    ['iteration', 'Sprint 99'],
  ] as const) {
    it(`${field}: stay as typed, kept unread with why; the save after is refused in words, never saving what it held`, async () => {
      const { form, input, after, saves } = await mount(field);
      const held = form.getState().values[field];
      typeInto(input, typed);
      after.focus();
      // The source answers before the save is pressed.
      await wait();
      expect(input.value).toBe(typed);
      expect(form.getState().unread[field]?.text).toBe(typed);
      expect(await form.save()).toBe(false);
      expect(form.getState().errors[field]).toContain(typed);
      expect(form.getState().values[field]).toEqual(held);
      expect(saves()).toBe(0);
    });
  }

  it('Escape puts back what the box held, and lets the words go', async () => {
    const { form, input, after } = await mount('client_id');
    typeInto(input, 'Narnia');
    after.focus();
    await wait();
    input.focus();
    press(input, 'Escape');
    expect(input.value).toBe('Acme');
    expect(form.getState().unread['client_id']).toBeUndefined();
    expect(await form.save()).toBe(true);
  });

  it('a choice typed by name, left: the same', () => {
    const { el, form, value } = mountKind({ type: 'selection', label: 'Country', options: [{ value: 'eg', label: 'Egypt' }, { value: 'jo', label: 'Jordan' }] }, { options: { search: true } });
    form.setValue('x', 'eg');
    const input = el.querySelector('input') as HTMLInputElement;
    const other = document.body.appendChild(document.createElement('button'));
    typeInto(input, 'Narnia');
    other.focus();
    expect(input.value).toBe('Narnia');
    expect(form.getState().unread['x']?.text).toBe('Narnia');
    expect(form.validate()).toBe(false);
    expect(value()).toBe('eg');
  });
});

describe('a record named exactly', () => {
  it('is taken by Enter whatever row the arrows reached before the words were typed', async () => {
    const { form, input } = await mount('client_id');
    typeInto(input, 'Ni');
    await wait(250);
    press(input, 'ArrowDown');
    expect(input.getAttribute('aria-activedescendant')).not.toBeNull();
    // "Nile Interiors" reached; then the words typed on to "Nile", a record's very name.
    typeInto(input, 'Nile');
    await wait(250);
    press(input, 'Enter');
    expect((form.getState().values['client_id'] as RelatedRecord).label).toBe('Nile');
  });

  it('a row the arrows reached after the words were typed is the person’s pick', async () => {
    const { form, input } = await mount('client_id');
    typeInto(input, 'Nile');
    await wait(250);
    // The list: Nile Interiors, Nile. The arrows reach the first.
    press(input, 'ArrowDown');
    press(input, 'Enter');
    expect((form.getState().values['client_id'] as RelatedRecord).label).toBe('Nile Interiors');
  });

  it('a path: Ctrl+Enter on words several paths hold reads them as a save does, however soon; Enter takes the row reached; an exact name wins', async () => {
    const { form, input } = await mount('iteration');
    input.focus();
    input.click();
    await wait();
    typeInto(input, 'Sprint 1');
    await wait();
    // The list has come, its first match reached; "Sprint 1" is Warehouse\Sprint 1's own name, and only its.
    press(input, 'Enter');
    expect((form.getState().values['iteration'] as RelatedRecord).path).toEqual(['Warehouse', 'Sprint 1']);
    typeInto(input, 'Sprint');
    await wait();
    press(input, 'Enter', { ctrlKey: true });
    await wait();
    // Not one of them: words that name several stay, and the field keeps what it held.
    expect((form.getState().values['iteration'] as RelatedRecord).path).toEqual(['Warehouse', 'Sprint 1']);
    expect(await form.save()).toBe(false);
    expect(form.getState().errors['iteration']).toContain('Sprint');
    // Plain Enter on them takes the row the list reached.
    typeInto(input, 'Sprint');
    await wait();
    press(input, 'Enter');
    expect(form.getState().unread['iteration']).toBeUndefined();
    expect((form.getState().values['iteration'] as RelatedRecord).label).toMatch(/^Sprint/);
  });
});

describe('a reference', () => {
  it('lets a name looked up go with its model: the answer comes for a model no longer chosen', async () => {
    const { form, input, el } = await mount('source');
    const select = el.querySelector('select') as HTMLSelectElement;
    typeInto(input, 'Nile');
    select.focus();
    select.value = 'country';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await wait();
    expect(form.getState().values['source']).toBeNull();
    expect(form.getState().unread['source']).toBeUndefined();
    expect(input.value).toBe('');
  });
});

describe('tags typed as words, waiting for room', () => {
  it('are taken by a save once room is made, and go with the record they were typed on', async () => {
    const { el, form, value } = mountKind({ type: 'char', label: 'Materials' }, { widget: 'tags', options: { max: 2 } });
    form.setValue('x', 'oak, glass');
    const input = el.querySelector('input') as HTMLInputElement;
    typeInto(input, 'steel');
    input.blur();
    expect(form.getState().unread['x']?.text).toBe('steel');
    form.setValue('x', 'oak');
    expect(form.validate()).toBe(true);
    expect(value()).toBe('oak, steel');
    expect(input.value).toBe('');
  });
});
