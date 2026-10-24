import { createMemoryDataSource, type Page } from '@fieldia/core';
import { phonePart } from '@fieldia/widgets';
import { customers } from './test-list';
import { mountViewer, type ViewerHandle } from './viewer';
import { listPart, partsFor } from './viewer-parts';

/**
 * A phone read the world over comes in the phone part: a page whose `phone` (or a field's own options) asks for it
 * waits for it before it is drawn, and a list's phone column writes its numbers as people read them from it. A page
 * that says neither keeps its phone fields as text boxes, and asks for nothing. This file starts with no part loaded
 * (src/test-parts.ts leaves it so), and its tests run in order.
 */

const page = (more: Partial<Page> = {}, node: Record<string, unknown> = {}): Page =>
  ({
    fieldia: '0.11',
    id: 'p',
    title: 'Contact',
    data: { kind: 'record', model: 'partner' },
    fields: { name: { type: 'char', label: 'Name' }, mobile: { type: 'char', label: 'Mobile' } },
    layout: { type: 'sections', id: 's', children: [{ type: 'section', id: 'g', children: [{ type: 'field', id: 'f-name', field: 'name' }, { type: 'field', id: 'f-mobile', field: 'mobile', widget: 'phone', ...node }] }] },
    ...more,
  }) as Page;

const list = (more: Partial<Page> = {}): Page => ({
  ...customers,
  fields: { ...customers.fields, phone: { type: 'char', label: 'Phone' } },
  layout: { ...(customers.layout as object), columns: ['name', 'phone'], cells: { phone: { widget: 'phone' } } } as unknown as Page['layout'],
  ...more,
});

const source = () =>
  createMemoryDataSource({
    records: {
      partner: {
        1: { name: 'Nile Traders', mobile: '+201012345678', phone: '+20223456789' },
        2: { name: 'Gulf Lines', mobile: '+971501234567', phone: '+971 4 123 4567' },
        3: { name: 'Thames Office', mobile: null, phone: '+442079460958' },
      },
    },
  });

/** Waits, a turn at a time, until `ready` holds. */
async function until(ready: () => unknown) {
  for (let turn = 0; turn < 100 && !ready(); turn++) await new Promise((done) => setTimeout(done, 0));
  expect(ready()).toBeTruthy();
}

let handles: ViewerHandle[] = [];
afterEach(() => {
  for (const handle of handles) handle.destroy();
  handles = [];
  document.body.replaceChildren();
});
const mount = (shown: Page, more: Partial<Parameters<typeof mountViewer>[1]> = {}) => {
  const host = document.createElement('div');
  document.body.append(host);
  const handle = mountViewer(host, { page: shown, ...more });
  handles.push(handle);
  return { host, handle };
};

describe('a phone read the world over, in its part', () => {
  it('is asked for where the page or the field says so, and a list’s phone column then; never elsewhere', () => {
    expect(partsFor(page())).toEqual([]);
    expect(partsFor(page({ phone: { country: 'EG' } }))).toEqual([phonePart]);
    expect(partsFor(page({ phone: {} }))).toEqual([phonePart]);
    expect(partsFor(page({}, { options: { country: 'AE' } }))).toEqual([phonePart]);
    // Not a phone: the page's setting asks for nothing.
    expect(partsFor(page({ phone: { country: 'EG' } }, { widget: undefined }))).toEqual([]);
    expect(partsFor(list())).toEqual([listPart]);
    expect(partsFor(list({ phone: { shown: 'national', country: 'EG' } }))).toEqual([listPart, phonePart]);
    // A table's phone column, as its cells say.
    const lines = page({ phone: {}, fields: { lines: { type: 'one2many', label: 'Contacts', relation: 'contact', fields: { mobile: { type: 'char', label: 'Mobile' } } } } as Page['fields'] });
    (lines.layout as { children: { children: unknown[] }[] }).children[0].children = [{ type: 'field', id: 'f-lines', field: 'lines', columns: ['mobile'], cells: { mobile: { widget: 'phone' } } }];
    expect(partsFor(lines)).toContain(phonePart);
  });

  it('a page of plain phones is drawn at once, its phone the text box it was, and asks for nothing', async () => {
    const { host, handle } = mount(page(), { dataSource: source(), recordId: 1 });
    expect(handle.element.hasAttribute('aria-busy')).toBe(false);
    await handle.drawn;
    await until(() => (host.querySelector('[data-node="f-mobile"] input') as HTMLInputElement | null)?.value);
    expect((host.querySelector('[data-node="f-mobile"] input') as HTMLInputElement).value).toBe('+201012345678');
    expect(host.querySelector('.fd-phone')).toBeNull();
    expect(phonePart.loaded).toBeUndefined();
  });

  it('a page that reads its phones so: nothing drawn until the part has come, then the number as the page shows it, with its links', async () => {
    const { host, handle } = mount(page({ phone: { country: 'EG', shown: 'national' } }), { dataSource: source(), recordId: 1 });
    expect(handle.element.getAttribute('aria-busy')).toBe('true');
    expect(host.querySelector('[data-node="f-mobile"]')).toBeNull();
    await handle.drawn;
    expect(phonePart.loaded).toBeDefined();
    const box = () => host.querySelector('[data-node="f-mobile"] .fd-phone-input') as HTMLInputElement | null;
    await until(() => box()?.value);
    expect(box()?.value).toBe('010 1234 5678');
    expect(host.querySelector('[data-node="f-mobile"] .fd-phone-whatsapp')?.getAttribute('href')).toBe('https://wa.me/201012345678');
    expect(document.getElementById('fieldia-phone-styles')).not.toBeNull();
  });

  it('read-only as words, a phone so read shows itself, with its links', async () => {
    const { host, handle } = mount(page({ phone: { country: 'EG' }, look: { readonlyShown: 'text' } }), { dataSource: source(), recordId: 2, readonly: true });
    await handle.drawn;
    const field = host.querySelector('[data-node="f-mobile"]') as HTMLElement;
    await until(() => (field.querySelector('.fd-phone-input') as HTMLInputElement | null)?.value);
    expect((field.querySelector('.fd-phone-input') as HTMLInputElement).value).toBe('+971 50 123 4567');
    expect(field.querySelector('.fd-read-text')).toBeNull();
    expect(field.querySelector('.fd-phone-call:not([hidden])')).not.toBeNull();
  });

  it('a list’s phone column writes each number as people read it, at home’s way where the page says, another country’s abroad’s', async () => {
    const { host, handle } = mount(list({ phone: { country: 'EG', shown: 'national' } }), { dataSource: source() });
    await handle.drawn;
    const cells = () => [...host.querySelectorAll('.fd-list-table tbody tr.fd-list-row')].map((row) => [...row.querySelectorAll('td')].at(-1)?.textContent ?? '');
    await until(() => cells().length === 2);
    expect(cells()).toEqual(['+971 4 123 4567', '02 2345 6789']);
    // A list that says nothing of phones shows them as they are kept.
    const plain = mount(list(), { dataSource: source() });
    await plain.handle.drawn;
    const plainCells = () => [...plain.host.querySelectorAll('.fd-list-table tbody tr.fd-list-row')].map((row) => [...row.querySelectorAll('td')].at(-1)?.textContent ?? '');
    await until(() => plainCells().length === 2);
    expect(plainCells()).toEqual(['+971 4 123 4567', '+20223456789']);
  });
});
