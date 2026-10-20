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
    fieldia: '0.6',
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

describe('the viewer’s parts, as a bundler makes them', () => {
  it('never reach the viewer (viewer.ts) but for its types: an app bundled whole would start one of its modules early, and mount before its words are set', () => {
    // The modules a module takes values from, or hands on: its imports and re-exports of this folder, types aside.
    const { readFileSync, readdirSync } = jest.requireActual<typeof import('node:fs')>('node:fs');
    const { join } = jest.requireActual<typeof import('node:path')>('node:path');
    const takes = (name: string) =>
      [...readFileSync(join(__dirname, `${name}.ts`), 'utf8').matchAll(/^(?:import|export)\s+(type\s+)?\{[^}]*\}\s+from\s+'\.\/([a-z-]+)'/gm)].filter(([, types]) => !types).map(([, , from]) => from);
    const parts = readdirSync(__dirname).filter((file) => file.endsWith('-part.ts')).map((file) => file.slice(0, -3));
    expect(parts).toEqual(expect.arrayContaining(['duplicates-part', 'head-part', 'list-part', 'filters-part']));
    for (const part of parts) {
      const reached = new Set<string>();
      const visit = (name: string): void => {
        if (reached.has(name)) return;
        reached.add(name);
        for (const next of takes(name)) visit(next);
      };
      visit(part);
      expect([part, reached.has('viewer')]).toEqual([part, false]);
    }
  });
});
