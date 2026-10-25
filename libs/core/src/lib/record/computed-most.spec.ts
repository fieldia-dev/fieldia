import { checkPage } from '../format/check-page';
import type { Page } from '../format/page';
import { COMPUTED_MOST, fitTo } from './compute';
import { createForm } from './form';
import { createMemoryDataSource } from './memory-data-source';
import { PROOF_MS, timed } from '../../../../../testing/proof-time';

/** A page whose values each double the one before: one letter typed, 2^24 of them worked out (S-L7, the audit's proof). */
function doubling(n: number): Page {
  const fields: Page['fields'] = { f0: { type: 'char', label: 'F0' } };
  for (let i = 1; i <= n; i++) fields[`f${i}`] = { type: 'char', label: `F${i}`, compute: `f${i - 1} + f${i - 1}` };
  return { fieldia: '0.13', id: 'p', data: { kind: 'responses' }, fields, layout: { type: 'sheet', id: 'root', children: Object.keys(fields).map((name, i) => ({ type: 'field', id: `n${i}`, field: name })) } } as Page;
}

describe('a value the page works out stops at the most it may hold (S-L7)', () => {
  it('works out 24 doublings of what is typed at once, none past the most (the audit’s proof: 0.6 s and 33.5 million characters)', () => {
    const checked = checkPage(doubling(24));
    expect(checked.ok).toBe(true);
    const form = createForm({ page: checked.ok ? checked.page : doubling(24), dataSource: createMemoryDataSource() });
    const ms = timed(() => form.setValue('f0', 'ab'));
    // The work it bounds, counted: no value past the most (the 17th doubling, 2^17 characters, held as none, so every
    // one after it too) — and the clock never runs away.
    const values = form.getState().values;
    expect((values['f15'] as string).length).toBe(2 ** 16);
    expect(values['f16']).toBeNull();
    expect(Object.values(values).every((value) => typeof value !== 'string' || value.length <= COMPUTED_MOST.text)).toBe(true);
    expect(Object.values(values).reduce((sum: number, value) => sum + (typeof value === 'string' ? value.length : 0), 0)).toBeLessThan(2 ** 17);
    expect(ms).toBeLessThan(PROOF_MS);
    form.dispose();
  });

  it('holds text and lists to the most, and anything shorter as ever', () => {
    expect(fitTo({ type: 'text', label: 'T' }, 'x'.repeat(COMPUTED_MOST.text))).toHaveLength(COMPUTED_MOST.text);
    expect(fitTo({ type: 'text', label: 'T' }, 'x'.repeat(COMPUTED_MOST.text + 1))).toBeNull();
    expect(fitTo({ type: 'json', label: 'J' }, Array(COMPUTED_MOST.items + 1).fill(1))).toBeNull();
    expect(fitTo({ type: 'json', label: 'J' }, [1, 2])).toEqual([1, 2]);
  });
});
