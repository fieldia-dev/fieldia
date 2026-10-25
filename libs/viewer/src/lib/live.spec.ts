import { createMemoryDataSource, type Page } from '@fieldia/core';
import { mountViewer, type ViewerHandle } from './viewer';

/** Who else has the record open, over it; a change made elsewhere laid on it and said, or the conflict's banner after a change of the person's. */

const page = {
  fieldia: '0.13',
  id: 'course',
  title: 'Treatment course',
  data: { kind: 'record', model: 'course' },
  fields: { name: { type: 'char', label: 'Patient' }, price: { type: 'float', label: 'Price' }, notes: { type: 'text', label: 'Notes' } },
  layout: { type: 'sheet', id: 'sheet', title: { field: 'name' }, children: [{ type: 'section', id: 'main', children: [{ type: 'field', id: 'f-price', field: 'price' }, { type: 'field', id: 'f-notes', field: 'notes' }] }] },
} as unknown as Page;

let handle: ViewerHandle | null = null;
afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
});
const settle = async () => {
  for (let i = 0; i < 6; i++) await new Promise((resolve) => setTimeout(resolve, 0));
};

async function mount() {
  const ds = createMemoryDataSource({ live: true, versions: { by: 'Sara Hassan' }, records: { course: { 1: { name: 'Mona Adel', price: 4500, notes: '' } } } });
  const host = document.createElement('div');
  document.body.append(host);
  handle = mountViewer(host, { page, dataSource: ds, recordId: 1, user: { id: 7, name: 'Sara Hassan' } });
  await handle.drawn;
  await handle.form.settled();
  return { host, ds, form: handle.form };
}

describe('presence and live updates', () => {
  it('says who else has the record open, and who is editing it', async () => {
    const { host, ds } = await mount();
    // Drawn by the live part the first time someone else is here.
    expect(host.querySelector('.fd-presence')).toBeNull();
    ds.arrive?.('course', 1, { id: 9, name: 'Mona Adel' });
    await settle();
    const presence = host.querySelector('.fd-presence') as HTMLElement;
    expect(presence.hidden).toBe(false);
    expect(presence.querySelector('.fd-presence-words')?.textContent).toBe('Also here: Mona Adel');
    expect(presence.querySelector('.fd-presence-face')?.textContent).toBe('MA');
    ds.arrive?.('course', 1, { id: 9, name: 'Mona Adel', editing: true });
    expect(presence.querySelector('.fd-presence-words')?.textContent).toBe('Also here: Mona Adel (editing)');
    ds.leave?.('course', 1, 9);
    expect(presence.hidden).toBe(true);
  });

  it('lays a change made elsewhere and says who changed what; after a change of the person’s, the conflict’s banner', async () => {
    const { host, ds, form } = await mount();
    ds.changeElsewhere('course', 1, { price: 5000 }, { by: 'Mona Adel' });
    await settle();
    expect((host.querySelector('[data-node="f-price"] input') as HTMLInputElement).value).toBe('5,000.00');
    expect([...host.querySelectorAll('.fd-say > span')].map((one) => one.textContent)).toEqual(['Mona Adel changed Price.']);
    form.setValue('notes', 'Moved to Thursday');
    ds.changeElsewhere('course', 1, { notes: 'Moved to Friday' }, { by: 'Mona Adel' });
    await settle();
    const banner = host.querySelector('.fd-conflict') as HTMLElement;
    expect(banner.hidden).toBe(false);
    expect(banner.textContent).toContain('Mona Adel changed this record');
    expect(banner.textContent).toContain('You both changed: Notes.');
    expect(form.getState().values['notes']).toBe('Moved to Thursday');
  });
});
