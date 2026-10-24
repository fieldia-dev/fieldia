import type { DataSource, Page, SaveRequest } from '@fieldia/core';
import { mountViewer, type ViewerHandle } from './viewer';

/**
 * A record's load as a person meets it (audit R-H3, R-H4, R-M4; proofs B/ds3, view1, view5): while a record's first
 * load is on its way, or failed, its fields are inert — nothing typed lands on a record nobody saw — and a failure is
 * said over the page in words with a Retry of its own, never an editable form whose Save empties the record. A value
 * the source holds that the page cannot show is said under its field alone; the rest is drawn and saves.
 */

const page: Page = {
  fieldia: '0.11',
  id: 'c',
  title: 'C',
  data: { kind: 'record', model: 'm' },
  fields: { name: { type: 'char', label: 'Name' }, amount: { type: 'monetary', label: 'Amount', currency: 'EGP' }, tags: { type: 'many2many', label: 'Tags', relation: 'tag' }, notes: { type: 'text', label: 'Notes' } },
  layout: { type: 'sheet', id: 'main', children: ['name', 'amount', 'tags', 'notes'].map((field) => ({ type: 'field', id: field, field })) },
} as Page;

let handle: ViewerHandle | null = null;
afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
});

const flush = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));
const visible = (el: Element | null) => !!el && !el.closest('[hidden]');
const buttons = (host: Element) => [...host.querySelectorAll('button')].filter(visible).map((b) => b.textContent?.trim());
const box = (host: Element, node: string) => host.querySelector(`[data-node="${node}"] input, [data-node="${node}"] textarea`) as HTMLInputElement;
const inert = (el: Element) => !!el.closest('[inert]');

function mount(dataSource: DataSource) {
  const host = document.createElement('div');
  document.body.append(host);
  handle = mountViewer(host, { page, dataSource, recordId: 7 });
  return host;
}

describe('a record whose load fails (B/ds3)', () => {
  it('says why over the page with a Retry of its own; its fields inert, no Save; Retry loads it', async () => {
    let fail = true;
    const saves: SaveRequest[] = [];
    const host = mount({
      load: async () => {
        if (fail) throw new Error('Gateway Timeout');
        return { name: 'Nile Traders', amount: 52000, notes: 'Pays in 30 days' };
      },
      save: async (request) => (saves.push(request), { id: 7 }),
    });
    await flush(20);
    const banner = host.querySelector('.fd-load-problem') as HTMLElement;
    expect(visible(banner)).toBe(true);
    expect(banner.querySelector('.fd-banner-text')?.textContent).toBe('This record could not be loaded: Gateway Timeout');
    expect(banner.getAttribute('role')).toBe('alert');
    expect(inert(box(host, 'name'))).toBe(true);
    expect(inert(banner)).toBe(false);
    expect(buttons(host)).not.toContain('Save');
    // The status says nothing twice.
    expect(host.querySelector('.fd-status')?.textContent).toBe('');
    fail = false;
    (banner.querySelector('.fd-retry') as HTMLButtonElement).click();
    await flush(20);
    expect(visible(banner)).toBe(false);
    expect(inert(box(host, 'name'))).toBe(false);
    expect(box(host, 'name').value).toBe('Nile Traders');
    expect(saves).toEqual([]);
  });
});

describe('a record on its way (B/view1)', () => {
  it('is inert until it lands; what was typed in it anyway is kept over it', async () => {
    let land: (values: never) => void = () => undefined;
    const host = mount({ load: () => new Promise((resolve) => (land = resolve)), save: async () => ({ id: 7 }) } as DataSource);
    await flush();
    const name = box(host, 'name');
    expect(inert(name)).toBe(true);
    // A box typed in anyway — a script, an extension: what it typed is the person's still.
    name.value = 'Typed while loading';
    name.dispatchEvent(new Event('input', { bubbles: true }));
    land({ name: 'Stored', amount: 10 } as never);
    await flush(20);
    expect(inert(name)).toBe(false);
    expect(handle?.form.getState().values['name']).toBe('Typed while loading');
    expect(box(host, 'name').value).toBe('Typed while loading');
    expect(handle?.form.getState().dirty).toEqual(['name']);
  });
});

describe('a value the page cannot show (B/view5)', () => {
  it('is said under its field alone: every other field drawn, and Save saves without it', async () => {
    const saves: SaveRequest[] = [];
    const errors: unknown[] = [];
    const heard = (event: PromiseRejectionEvent | ErrorEvent) => errors.push(event);
    window.addEventListener('error', heard);
    const host = mount({ load: async () => ({ name: 'Kept', tags: 'vip,new' }), save: async (request) => (saves.push(request), { id: 7 }) });
    await flush(20);
    expect(host.textContent).not.toContain('could not be shown');
    expect(host.querySelector('[data-node="tags"]')?.textContent).toContain('Tags is stored in a way this page cannot show: it is kept as it is');
    const name = box(host, 'name');
    name.value = 'Edited';
    name.dispatchEvent(new Event('input', { bubbles: true }));
    await flush();
    const save = [...host.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Save' && visible(b)) as HTMLButtonElement;
    save.click();
    await flush(20);
    expect(saves).toHaveLength(1);
    expect(saves[0].values).not.toHaveProperty('tags');
    expect(errors).toEqual([]);
    window.removeEventListener('error', heard);
  });
});
