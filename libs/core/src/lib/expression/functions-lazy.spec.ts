import type { Page } from '../format/page';
import { createForm } from '../record/form';
import { createMemoryDataSource } from '../record/memory-data-source';
import { compileExpression } from './expression';
import { callsPartFunctions, functionsPart } from './functions';

/**
 * Before the functions part has come (functions.ts): the bodies of Fieldia's functions beyond the plain ones are in a
 * part a page asks for when its formulas call one. A form made before it came waits for it as for an app's function
 * that asks — never a value worked out wrong, never a save without it. This file starts with no part loaded.
 */

const page = {
  fieldia: '0.13',
  id: 'visit',
  title: 'Visit',
  data: { kind: 'responses' },
  fields: {
    birth: { type: 'date', label: 'Birth date', default: '1990-10-21' },
    age: { type: 'integer', label: 'Age', compute: 'age(birth)' },
    guardian: { type: 'char', label: 'Guardian' },
  },
  layout: { type: 'sections', id: 's', children: [{ type: 'field', id: 'birth', field: 'birth' }, { type: 'field', id: 'age', field: 'age' }, { type: 'field', id: 'guardian', field: 'guardian', invisible: 'age(birth) >= 18' }] },
} as unknown as Page;

describe('the functions part', () => {
  it('is asked for by a page whose formulas call one of its functions, never by another', () => {
    expect(callsPartFunctions(page)).toBe(true);
    expect(callsPartFunctions({ fields: { total: { type: 'float', label: 'Total', compute: 'round(sum(lines, "amount"), 2)' } }, layout: { invisible: 'total > 0' } })).toBe(false);
    expect(callsPartFunctions({ fields: { name: { type: 'char', label: 'Your age, in years' } } })).toBe(false);
    expect(callsPartFunctions({ layout: { invisible: "contains(tags, 'vip')" } })).toBe(true);
  });

  it('makes a value worked out from one wait for it, a condition not hold, and a save wait, until it comes', async () => {
    expect(functionsPart.loaded).toBeUndefined();
    // Where nothing waits (no form), a call gives nothing meanwhile.
    expect(compileExpression('age(birth)').evaluate({ birth: '1990-10-21' }, { today: () => '2026-10-20' })).toBeNull();
    const dataSource = createMemoryDataSource();
    const form = createForm({ page, dataSource, now: () => new Date('2026-10-20T12:00:00Z') });
    expect(functionsPart.loaded).toBeUndefined();
    // Waiting: empty, said as asked, its condition not holding (the guardian's box shown).
    expect(form.getState().values['age']).toBeNull();
    expect(form.getState().asked).toEqual({ age: {} });
    expect(form.waitsFor('age')).toMatchObject({ field: 'age', asking: true });
    expect(form.node('guardian').invisible).toBe(false);
    // A save waits for it: what is sent is worked out.
    const saved = form.save();
    expect(await saved).toBe(true);
    expect(functionsPart.loaded).toBeDefined();
    expect(dataSource.responses[0].values).toMatchObject({ birth: '1990-10-21', age: 35 });
    expect(form.getState().asked).toEqual({});
    expect(form.getState().dirty).toEqual([]);
  });

  it("makes a value worked out from the app's own function wait for it too, then calls it", async () => {
    // (The part came in the test before: a form made now finds it in, the app's function called at once.)
    const vat = { ...page, fields: { ...page.fields, rate: { type: 'float', label: 'VAT', compute: "vatRate('EG')" } } } as unknown as Page;
    const form = createForm({ page: vat, dataSource: createMemoryDataSource(), functions: { vatRate: (country: never) => (country === 'EG' ? 0.14 : 0) } });
    expect(form.getState().values['rate']).toBe(0.14);
  });

  it('works a value out at once once it has come', () => {
    const form = createForm({ page: { ...page, fields: { ...page.fields, birth: { type: 'date', label: 'Birth date', default: '1990-10-20' } } }, dataSource: createMemoryDataSource(), now: () => new Date('2026-10-20T12:00:00Z') });
    expect(form.getState().values['age']).toBe(36);
    expect(form.getState().asked).toEqual({});
    expect(form.node('guardian').invisible).toBe(true);
  });
});
