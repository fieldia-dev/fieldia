import type { Page } from '../format/page';
import { createForm } from './form';
import { createMemoryDataSource } from './memory-data-source';

/** A formatted text names people and records in place — "@Mona Adel", "#4127" — and finds them by the model they are of. */
const page = {
  fieldia: '0.1',
  id: 'bug',
  data: { kind: 'record', model: 'work.item' },
  fields: { repro_steps: { type: 'html', label: 'Repro Steps' }, title: { type: 'char', label: 'Title' } },
  layout: { type: 'sections', id: 'root', children: [] },
} as unknown as Page;

const dataSource = createMemoryDataSource({
  records: {
    'res.users': { 1: { name: 'Mona Adel' }, 2: { name: 'Karim Fathy' } },
    'work.item': { 4127: { name: 'Stock count shows 12' }, 4130: { name: 'Invoice total off by one' } },
  },
});

describe('people and records named in a formatted text', () => {
  it('are found by the model the text’s settings name', async () => {
    const form = createForm({ page, dataSource });
    expect((await form.search('repro_steps', 'mona', 8, { model: 'res.users' })).map((r) => r.label)).toEqual(['Mona Adel']);
    expect((await form.search('repro_steps', 'invoice', 8, { model: 'work.item' })).map((r) => [r.id, r.label])).toEqual([[4130, 'Invoice total off by one']]);
  });

  it('need the model named; plain words do not search', async () => {
    const form = createForm({ page, dataSource });
    await expect(form.search('repro_steps', 'mona')).rejects.toThrow('Searching "repro_steps" needs a model');
    await expect(form.search('title', '', 8, { model: 'res.users' })).rejects.toThrow(/not a many2one, many2many, reference, json or html/);
  });
});
