import type { Page } from '../format/page';
import { validatePage } from '../format/validate';
import { createForm } from './form';
import { MESSAGES } from './messages';

/**
 * A column of a table's lines no two lines may share a value in — a split's
 * payers, each once — as a model's constraint would refuse it: the answer
 * rule `distinct`, naming the column.
 */
const split = (rule: Record<string, unknown> = { distinct: 'payer_id' }) =>
  ({
    fieldia: '0.1',
    id: 'split',
    data: { kind: 'record', model: 'legal.split' },
    fields: {
      payer_ids: {
        type: 'one2many',
        label: 'Split',
        relation: 'legal.split.line',
        lineKinds: { field: 'kind', text: 'note' },
        fields: {
          kind: { type: 'selection', label: 'Kind', options: [{ value: 'section', label: 'Section' }, { value: 'note', label: 'Note' }] },
          note: { type: 'char', label: 'Note' },
          payer_id: { type: 'many2one', label: 'Payer', relation: 'res.partner' },
          share: { type: 'float', label: 'Share' },
        },
      },
    },
    layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'f-split', field: 'payer_ids', validate: [rule] }] },
  }) as unknown as Page;

const line = (key: string, payer: { id: number; label: string } | null, share = 50) => ({ key, values: { kind: null, note: null, payer_id: payer, share } });
const mona = { id: 1, label: 'Mona Adel' };
const omar = { id: 2, label: 'Omar Said' };

describe('distinct: a column no two lines share a value in', () => {
  it('is a valid rule on a table, naming one of its columns', () => {
    expect(validatePage(split())).toMatchObject({ ok: true });
    const wrong = validatePage(split({ distinct: 'nobody' }));
    expect(wrong.ok).toBe(false);
    expect(JSON.stringify(wrong)).toContain('layout.children[0].validate[0].distinct');
  });

  it('refuses two lines with one payer, a link by its id, and says which', () => {
    const form = createForm({ page: split(), values: { payer_ids: [line('a', mona), line('b', omar), line('c', { ...mona })] } as never });
    expect(form.validate()).toBe(false);
    expect(form.getState().errors['payer_ids']).toBe('Payer: Mona Adel is on more than one line of Split');
    form.removeLine('payer_ids', 'c');
    expect(form.validate()).toBe(true);
  });

  it('leaves out empty values and the sections and notes between lines', () => {
    const note = { key: 'n', values: { kind: 'note', note: 'Mona Adel', payer_id: null, share: null } };
    const form = createForm({ page: split(), values: { payer_ids: [line('a', mona), line('b', null), line('c', null), note] } as never });
    expect(form.validate()).toBe(true);
  });

  it('says it in the page’s language, or in the rule’s own words', () => {
    const arabic = createForm({ page: split(), messages: MESSAGES.ar, values: { payer_ids: [line('a', mona), line('b', mona)] } as never });
    arabic.validate();
    expect(arabic.getState().errors['payer_ids']).toBe('Payer: Mona Adel في أكثر من سطر في Split');
    const own = createForm({ page: split({ distinct: 'payer_id', message: 'Each payer once.' }), values: { payer_ids: [line('a', mona), line('b', mona)] } as never });
    own.validate();
    expect(own.getState().errors['payer_ids']).toBe('Each payer once.');
  });
});
