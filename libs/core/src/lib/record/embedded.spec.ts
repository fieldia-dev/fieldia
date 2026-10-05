import type { Page } from '../format/page';
import { createForm } from './form';
import { createMemoryDataSource } from './memory-data-source';

/**
 * A saved form placed in another: once the app gives the part its page, the
 * inner form's answers sit under the part's name as an object, and the inner
 * page's own required fields, answer rules and worked-out values hold inside
 * it — the outer form refuses to send until they do, and sends them nested.
 */

const address: Page = {
  fieldia: '0.1',
  id: 'address',
  title: 'Address',
  data: { kind: 'responses' },
  fields: {
    street: { type: 'char', label: 'Street', required: true },
    city: { type: 'char', label: 'City' },
    postcode: { type: 'char', label: 'Postcode' },
    one_line: { type: 'char', label: 'On one line', compute: "street + ', ' + city" },
  },
  layout: {
    type: 'sections',
    id: 'root',
    children: [
      {
        type: 'section',
        id: 'where',
        children: [
          { type: 'field', id: 'street', field: 'street' },
          { type: 'field', id: 'city', field: 'city' },
          { type: 'field', id: 'postcode', field: 'postcode', validate: [{ pattern: '^[0-9]{5}$', message: 'Five figures' }] },
        ],
      },
    ],
  },
};

function delivery(kind: 'responses' | 'record' = 'responses', extra: Record<string, unknown> = {}): Page {
  return {
    fieldia: '0.1',
    id: 'delivery',
    data: kind === 'record' ? { kind: 'record', model: 'delivery' } : { kind: 'responses' },
    fields: { full_name: { type: 'char', label: 'Full name' }, same: { type: 'boolean', label: 'Bill the same address' } },
    layout: {
      type: 'sections',
      id: 'root',
      children: [
        { type: 'field', id: 'n', field: 'full_name' },
        { type: 'field', id: 's', field: 'same' },
        { type: 'form', id: 'home', page: 'address', name: 'home', title: 'Home address' },
        { type: 'form', id: 'billing', page: 'address', name: 'billing', invisible: 'same', ...extra },
      ],
    },
  } as Page;
}

const fill = (form: ReturnType<typeof createForm>, values: Record<string, string>) => {
  for (const [name, value] of Object.entries(values)) form.setValue(name, value);
};

describe('a saved form placed in another', () => {
  it('keeps each copy’s answers under its own name, worked-out values worked out inside it', () => {
    const form = createForm({ page: delivery() });
    const home = form.embed('home', address);
    const billing = form.embed('billing', address);
    fill(home, { street: '12 Nile Street', city: 'Cairo' });
    fill(billing, { street: '3 Harbour Road' });
    const values = form.getState().values;
    expect(values['home']).toEqual({ street: '12 Nile Street', city: 'Cairo', postcode: null, one_line: '12 Nile Street, Cairo' });
    expect(values['billing']).toMatchObject({ street: '3 Harbour Road', city: null });
    expect(form.embedded('home')).toBe(home);
    expect(form.embed('home', address)).toBe(home);
    expect(form.embedded('nowhere')).toBeNull();
  });

  it('refuses to send while a field inside asks for an answer, in that field’s own words, and lets go once it has one', async () => {
    const source = createMemoryDataSource();
    const form = createForm({ page: delivery(), dataSource: source });
    const home = form.embed('home', address);
    form.embed('billing', address);
    form.setValue('same', true);
    expect(await form.save()).toBe(false);
    expect(form.getState().errors).toEqual({ 'home.street': 'Street is required' });
    // The inner form shows its own problem beside its own field.
    expect(home.getState().errors).toEqual({ street: 'Street is required' });
    home.setValue('postcode', '12');
    expect(form.getState().errors).toEqual({ 'home.street': 'Street is required' });
    home.setValue('street', '12 Nile Street');
    expect(home.getState().errors).toEqual({});
    expect(form.getState().errors).toEqual({});
    expect(await form.save()).toBe(false);
    expect(home.getState().errors).toEqual({ postcode: 'Five figures' });
    home.setValue('postcode', '11511');
    expect(await form.save()).toBe(true);
    // A copy hidden by its condition is neither asked nor sent.
    expect(source.responses[0].values).toEqual({
      full_name: null,
      same: true,
      home: { street: '12 Nile Street', city: null, postcode: '11511', one_line: '12 Nile Street, ' },
    });
  });

  it('checks a wizard’s step with the saved forms inside it', () => {
    const page: Page = {
      fieldia: '0.1',
      id: 'steps',
      data: { kind: 'responses' },
      fields: { note: { type: 'char', label: 'Note' } },
      layout: {
        type: 'wizard',
        id: 'w',
        children: [
          { type: 'step', id: 'one', label: 'Where', children: [{ type: 'form', id: 'home', page: 'address', name: 'home' }] },
          { type: 'step', id: 'two', label: 'Anything else', children: [{ type: 'field', id: 'note', field: 'note' }] },
        ],
      },
    };
    const form = createForm({ page });
    const home = form.embed('home', address);
    expect(form.next()).toBe(false);
    expect(home.getState().errors).toEqual({ street: 'Street is required' });
    home.setValue('street', '12 Nile Street');
    expect(form.next()).toBe(true);
    expect(form.getState().step).toBe('two');
  });

  it('on a record: loads the nested answers into it, tells what changed, saves them nested and puts them back on Discard', async () => {
    const source = createMemoryDataSource({ records: { delivery: { 7: { full_name: 'Sara', home: { street: '12 Nile Street', city: 'Cairo' } } } } });
    const form = createForm({ page: delivery('record'), dataSource: source, recordId: 7 });
    const home = form.embed('home', address);
    await form.load();
    expect(home.getState().values).toMatchObject({ street: '12 Nile Street', city: 'Cairo', one_line: '12 Nile Street, Cairo' });
    expect(form.getState().dirty).toEqual([]);
    home.setValue('city', 'Giza');
    expect(form.getState().dirty).toEqual(['home']);
    expect(form.changes().values).toEqual({ home: { street: '12 Nile Street', city: 'Giza', postcode: null, one_line: '12 Nile Street, Giza' } });
    form.reset();
    expect(home.getState().values['city']).toBe('Cairo');
    expect(form.getState().dirty).toEqual([]);
    home.setValue('city', 'Alexandria');
    form.setValue('same', true);
    expect(await form.save()).toBe(true);
    expect(source.records['delivery']['7']['home']).toMatchObject({ city: 'Alexandria' });
    expect(form.getState().dirty).toEqual([]);
    expect(home.getState().dirty).toEqual([]);
  });

  it('takes answers given from outside, and answers it starts with', () => {
    const form = createForm({ page: delivery(), values: { home: { street: 'Given Street' } } });
    const home = form.embed('home', address);
    expect(home.getState().values['street']).toBe('Given Street');
    expect(form.getState().dirty).toEqual([]);
    form.setValue('home', { street: 'Set Street', city: 'Luxor' });
    expect(home.getState().values).toMatchObject({ street: 'Set Street', city: 'Luxor', one_line: 'Set Street, Luxor' });
    expect(form.getState().values['home']).toMatchObject({ one_line: 'Set Street, Luxor' });
  });

  it('asks nothing of a saved form whose page has not come yet', async () => {
    const form = createForm({ page: delivery(), dataSource: createMemoryDataSource() });
    expect(await form.save()).toBe(true);
  });

  it('refuses a part that is no saved form, and a page placed in itself', () => {
    const form = createForm({ page: delivery() });
    expect(() => form.embed('n', address)).toThrow('"n" is not a saved form placed on this page');
    expect(() => form.embed('home', { ...address, id: 'delivery' })).toThrow('a page cannot be placed inside itself');
  });
});
