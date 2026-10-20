import type { Page } from '../format/page';
import { createForm } from '../record/form';
import { createMemoryDataSource } from '../record/memory-data-source';
import { functionsPart } from './functions';

/**
 * Before the functions part has come (functions.ts): the app's own functions are called through it. A form given
 * them before it came knows their names at once — a name a page cannot call refused as it is made — and a value worked
 * out from one waits for the part, then for the function's answer where it asks. This file starts with no part loaded.
 */

const page = {
  fieldia: '0.5',
  id: 'order',
  title: 'Order',
  data: { kind: 'responses' },
  fields: {
    country: { type: 'char', label: 'Country', default: 'EG' },
    rate: { type: 'float', label: 'VAT', compute: 'vatRate(country)' },
  },
  layout: { type: 'sections', id: 's', children: [{ type: 'field', id: 'f-country', field: 'country' }, { type: 'field', id: 'f-rate', field: 'rate' }] },
} as unknown as Page;

describe("the app's functions before the functions part", () => {
  it('refuses a name a page cannot call as the form is made, as ever', () => {
    expect(() => createForm({ page, dataSource: createMemoryDataSource(), functions: { round: () => 1 } })).toThrow('functions: "round" is Fieldia\'s own function');
    expect(functionsPart.loaded).toBeUndefined();
  });

  it('makes a value worked out from one wait for the part, then calls it, and a save waits for it', async () => {
    let calls = 0;
    const dataSource = createMemoryDataSource();
    const form = createForm({ page, dataSource, functions: { vatRate: { takes: [1, 1], call: (country: never) => (calls++, country === 'EG' ? 0.14 : 0) } } });
    expect(functionsPart.loaded).toBeUndefined();
    expect(form.getState().values['rate']).toBeNull();
    expect(form.waitsFor('rate')).toMatchObject({ asking: true });
    expect(calls).toBe(0);
    expect(await form.save()).toBe(true);
    expect(dataSource.responses[0].values).toMatchObject({ country: 'EG', rate: 0.14 });
    expect(form.getState().asked).toEqual({});
  });
});
