import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createMemoryDataSource, type Page } from '@fieldia/core';
import { mountViewer, type ViewerHandle } from '@fieldia/viewer';
import { createMemoryChatter } from './memory';
import { chatterSlot } from './slot';

const EXAMPLES = join(__dirname, '..', '..', '..', '..', 'examples', 'pages');
const page = (name: string): Page => JSON.parse(readFileSync(join(EXAMPLES, `${name}.page.json`), 'utf8'));
const me = { id: 1, name: 'Ramy Fathi' };
async function until(check: () => unknown) {
  for (let waited = 0; !check() && waited < 2000; waited += 10) await new Promise((resolve) => setTimeout(resolve, 10));
}

let viewer: ViewerHandle | null = null;
afterEach(() => {
  viewer?.destroy();
  viewer = null;
  document.body.replaceChildren();
});

function chatter() {
  return createMemoryChatter({
    me,
    records: { 'partner:1': { messages: [{ id: 1, kind: 'message', author: me, date: '2026-10-01T10:00:00Z', body: '<p>Welcome aboard.</p>' }] } },
  });
}

describe('chatterSlot', () => {
  it('fills a sheet’s chatter with the conversation of the record on show', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    const dataSource = createMemoryDataSource({ records: { partner: { 1: { name: 'Nile Traders', state: 'active' } } } });
    viewer = mountViewer(host, { page: page('customer'), dataSource, recordId: 1, slots: { chatter: chatterSlot({ source: chatter() }) } });
    await until(() => host.querySelector('.fd-slot[data-slot="chatter"] .fd-message'));
    expect(host.querySelector('.fd-slot[data-slot="chatter"] .fd-message-body')?.textContent).toBe('Welcome aboard.');
  });

  it('waits while the record is new, starts once it is saved, and fetches again after each save', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    const source = chatter();
    const dataSource = createMemoryDataSource();
    viewer = mountViewer(host, { page: page('customer'), dataSource, slots: { chatter: chatterSlot({ source }) } });
    const slot = () => host.querySelector('.fd-slot[data-slot="chatter"]') as HTMLElement;
    await until(() => slot().textContent?.includes('The conversation starts once the record is saved.'));
    viewer.form.setValue('name', 'Delta Foods');
    await viewer.save();
    await until(() => slot().querySelector('.fd-chatter-empty:not([hidden])'));
    const id = viewer.form.getState().recordId as number;
    await source.post({ model: 'partner', id }, { kind: 'note', body: '<p>Created from the demo.</p>' });
    viewer.form.setValue('phone', '+20 2 0000 0000');
    await viewer.save();
    await until(() => slot().querySelector('.fd-message'));
    expect(slot().querySelector('.fd-message-body')?.textContent).toBe('Created from the demo.');
  });
});
