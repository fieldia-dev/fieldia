import type { Page } from '../format/page';
import { createForm } from './form';
import { createMemoryDataSource } from './memory-data-source';

/** Structured data that names records of a model — an analytic distribution's accounts — finds them as a link does. */
const page = {
  fieldia: '0.1',
  id: 'line',
  data: { kind: 'record', model: 'account.move.line' },
  fields: { analytic_distribution: { type: 'json', label: 'Analytic' }, name: { type: 'char', label: 'Label' } },
  layout: { type: 'sections', id: 'root', children: [] },
} as unknown as Page;

const dataSource = createMemoryDataSource({
  records: { 'account.analytic.account': { 1: { name: 'Cairo office' }, 2: { name: 'Alexandria branch' }, 3: { name: 'Marketing' } } },
});

describe('records named by structured data', () => {
  it('are found by the model the widget names', async () => {
    const form = createForm({ page, dataSource });
    expect((await form.search('analytic_distribution', 'branch', 8, { model: 'account.analytic.account' })).map((r) => r.label)).toEqual(['Alexandria branch']);
  });

  it('are found by their ids, for the names of those the value holds', async () => {
    const form = createForm({ page, dataSource });
    const found = await form.search('analytic_distribution', '', 8, { model: 'account.analytic.account', ids: [3, 1] });
    expect(found.map((r) => r.label).sort()).toEqual(['Cairo office', 'Marketing']);
  });

  it('need the model named, and only structured data and links search', async () => {
    const form = createForm({ page, dataSource });
    await expect(form.search('analytic_distribution', '')).rejects.toThrow(/needs a model/);
    await expect(form.search('name', '', 8, { model: 'account.analytic.account' })).rejects.toThrow(/not a many2one/);
  });
});
