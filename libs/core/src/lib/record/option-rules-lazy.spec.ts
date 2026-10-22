import type { Page } from '../format/page';
import { hasOptionRules, optionRulesPart } from '../format/choice-options';
import { createForm } from './form';
import { createMemoryDataSource } from './memory-data-source';

/**
 * Before the options part has come (choice-options.ts, `optionRulesPart`): options shown by a condition, and carried
 * from an earlier question, come in a part a page with any asks for. A form made before it came offers each choice's
 * own options, and judges a write made meanwhile as it comes — a chosen option no longer offered taken out and said,
 * never kept in silence — and a save waits for it. This file starts with no part loaded.
 */

const listing = (): Page =>
  ({
    fieldia: '0.10',
    id: 'listing',
    data: { kind: 'responses' },
    fields: {
      kind: { type: 'selection', label: 'Kind', options: [{ value: 'villa', label: 'Villa' }, { value: 'flat', label: 'Flat' }] },
      extras: {
        type: 'selection',
        label: 'Extras',
        multiple: true,
        options: [
          { value: 'garden', label: 'Garden', invisible: "kind != 'villa'" },
          { value: 'lift', label: 'Lift' },
        ],
      },
    },
    layout: { type: 'sections', id: 's', children: [{ type: 'field', id: 'f-kind', field: 'kind' }, { type: 'field', id: 'f-extras', field: 'extras' }] },
  }) as Page;

describe("a form's options part", () => {
  it('is asked for by a page whose options show by a condition, or are carried, never by another', () => {
    expect(hasOptionRules(listing())).toBe(true);
    expect(hasOptionRules({ fields: { treatments: { type: 'selection', label: 'Treatments', multiple: true, options: [] }, liked: { type: 'selection', label: 'Liked', options: [], optionsFrom: { field: 'treatments' } } } })).toBe(true);
    expect(hasOptionRules({ fields: { lines: { type: 'one2many', label: 'Lines', relation: 'line', fields: { size: { type: 'selection', label: 'Size', options: [{ value: 'xl', label: 'XL', invisible: 'parent.small' }] } } } } } as unknown as Page)).toBe(true);
    expect(hasOptionRules({ fields: { kind: { type: 'selection', label: 'Kind', options: [{ value: 'villa', label: 'Villa' }] } } })).toBe(false);
  });

  it('a form made before it came offers the own options, judges a write as it comes, and a save waits for it', async () => {
    const dataSource = createMemoryDataSource();
    const form = createForm({ page: listing(), dataSource, values: { kind: 'villa', extras: ['garden', 'lift'] } });
    expect(optionRulesPart.loaded).toBeUndefined();
    // Not come yet: every own option offered; that it changes with the answers is known.
    expect(form.offered('extras')?.map((option) => option.value)).toEqual(['garden', 'lift']);
    expect(form.offersChange('extras')).toBe(true);
    form.setValue('kind', 'flat');
    // A save waits for it; the garden a flat no longer offers is taken out and said, never sent.
    expect(await form.save()).toBe(true);
    expect(optionRulesPart.loaded).toBeDefined();
    expect(dataSource.responses[0].values['extras']).toEqual(['lift']);
    expect(form.getState().takenOut['extras']).toBe('Garden is no longer offered, so it was taken out');
    expect(form.offered('extras')?.map((option) => option.value)).toEqual(['lift']);
  });

  it('once it has come, a write is judged at once', () => {
    const form = createForm({ page: listing(), dataSource: createMemoryDataSource(), values: { kind: 'villa', extras: ['garden'] } });
    form.setValue('kind', 'flat');
    expect(form.getState().values['extras']).toEqual([]);
    expect(form.getState().takenOut['extras']).toBe('Garden is no longer offered, so it was taken out');
  });
});
