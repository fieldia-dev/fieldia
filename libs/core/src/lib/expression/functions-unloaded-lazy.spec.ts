import type { Page } from '../format/page';

/**
 * The functions part that cannot come (offline, or not the file its fieldia.js was built with; the audits' R-H1, the
 * part-failure matrix): a value worked out by one of its functions is said not worked out, in the page's own words —
 * never the loader's, a file's address and its hash — and the part is asked for once for the record shown, not anew
 * by each working out: no request each time, no rejection no one heard. A save asks again. This file starts with no part
 * loaded.
 */

const page = {
  fieldia: '0.13',
  id: 'visit',
  title: 'Visit',
  data: { kind: 'responses' },
  fields: {
    birth: { type: 'date', label: 'Birth date', default: '1990-10-21' },
    age: { type: 'integer', label: 'Age', compute: 'age(birth)' },
    note: { type: 'char', label: 'Note' },
  },
  layout: { type: 'sections', id: 's', children: [{ type: 'field', id: 'birth', field: 'birth' }, { type: 'field', id: 'age', field: 'age' }, { type: 'field', id: 'note', field: 'note' }] },
} as unknown as Page;

const settle = () => new Promise((done) => setTimeout(done, 0));

describe('the functions part, when it cannot come', () => {
  it('says the value was not worked out in the page’s words, asks once for the record shown, and leaves no rejection unheard', async () => {
    const unheard: unknown[] = [];
    const hear = (reason: unknown) => unheard.push(reason);
    process.on('unhandledRejection', hear);
    try {
      await jest.isolateModulesAsync(async () => {
        let asked = 0;
        jest.doMock('./functions-part', () => {
          asked++;
          throw new Error('http://cdn.example/fieldia.functions.js could not be loaded, or is not the file fieldia.js 0.35.0 was built with');
        });
        const { createForm } = await import('../record/form');
        const { createMemoryDataSource } = await import('../record/memory-data-source');
        const form = createForm({ page, dataSource: createMemoryDataSource(), now: () => new Date('2026-10-20T12:00:00Z') });
        for (let turn = 0; turn < 20 && !form.getState().asked['age']?.failed; turn++) await settle();
        expect(form.getState().asked['age']).toMatchObject({ failed: 'part of this page could not load' });
        expect(form.waitsFor('age')).toMatchObject({ field: 'age', failed: 'part of this page could not load' });
        expect(form.getState().values['age']).toBeNull();
        const once = asked;
        expect(once).toBeGreaterThan(0);
        // Other answers worked out again and again: the part is not asked for anew by each.
        for (const text of ['a', 'ab', 'abc']) {
          form.setValue('note', text);
          await settle();
        }
        form.setValue('birth', '1991-01-01');
        await settle();
        expect(asked).toBe(once);
        await settle();
        expect(unheard).toEqual([]);
        jest.dontMock('./functions-part');
      });
    } finally {
      process.off('unhandledRejection', hear);
    }
  });
});
