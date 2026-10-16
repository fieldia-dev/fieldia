import { alikeRecords, createMemoryDataSource, type DataSource, type Page } from '@fieldia/core';
import { mountViewer, type ViewerHandle } from './viewer';
import { duplicatesPart, partsFor } from './viewer-parts';

/**
 * Possible duplicates come in a part of their own, asked for only where a record's page names fields in `duplicates`
 * and its source has `duplicates`; never waited for — the page is drawn at once, and what the part says comes with
 * the source's answer. This file starts with no part loaded (src/test-parts.ts leaves it so), its tests in order.
 */

const page = (more: Partial<Page> = {}): Page =>
  ({
    fieldia: '0.3',
    id: 'card',
    data: { kind: 'record', model: 'partner' },
    fields: { name: { type: 'char', label: 'Name' }, phone: { type: 'char', label: 'Phone' } },
    layout: { type: 'sections', id: 's', children: [{ type: 'section', id: 'g', children: [{ type: 'field', id: 'f-name', field: 'name' }, { type: 'field', id: 'f-phone', field: 'phone' }] }] },
    ...more,
  }) as Page;
const source = () => createMemoryDataSource({ duplicates: alikeRecords(), records: { partner: { 1: { name: 'Nile Traders', phone: '+20223456789' }, 2: { name: 'Nile Traders Co.', phone: '+20223456789' } } } });

let handle: ViewerHandle | null = null;
afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
});
const mount = (shown: Page, dataSource: DataSource, recordId: number | null = 1) => {
  const host = document.createElement('div');
  document.body.append(host);
  handle = mountViewer(host, { page: shown, dataSource, recordId });
  return host;
};
async function until(ready: () => unknown) {
  for (let turn = 0; turn < 200 && !ready(); turn++) await new Promise((done) => setTimeout(done, 5));
  expect(ready()).toBeTruthy();
}
const settle = () => new Promise((done) => setTimeout(done, 30));

describe('possible duplicates, in their part', () => {
  it('are no part a page waits for to be drawn', () => {
    expect(partsFor(page({ duplicates: { fields: ['phone'] } }))).toEqual([]);
  });

  it('a page that names none, or a source with no duplicates, never asks for the part', async () => {
    mount(page(), source());
    await settle();
    handle?.destroy();
    const { duplicates: _none, ...without } = source();
    mount(page({ duplicates: { fields: ['phone'] } }), without as DataSource);
    await settle();
    expect(duplicatesPart.loaded).toBeUndefined();
  });

  it('a page that names fields, with a source that answers, draws at once and says the match once the part came', async () => {
    const host = mount(page({ duplicates: { fields: ['name', 'phone'] } }), source());
    // Drawn at once: nothing waits for the part.
    expect(host.querySelector('.fd-field[data-path="phone"] input')).not.toBeNull();
    await until(() => host.querySelector('.fd-duplicates'));
    expect(duplicatesPart.loaded).toBeDefined();
    expect(host.querySelector('.fd-duplicate-words')?.textContent).toBe('A record with this Phone and a name like this already exists: Nile Traders Co.');
    expect(document.getElementById('fieldia-duplicates-styles')).not.toBeNull();
  });
});
