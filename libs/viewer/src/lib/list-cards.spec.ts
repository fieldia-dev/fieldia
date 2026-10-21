import { createMemoryDataSource, type ActionRequest, type ListNode, type Page, type RecordId } from '@fieldia/core';
import { memoryPreferences } from '@fieldia/widgets';
import { cardSpec } from './list-cards';
import { until } from './test-list';
import { cardsPart, columnsPart, listPart, partsFor } from './viewer-parts';
import { mountViewer, type ViewerHandle, type ViewerOptions } from './viewer';

/**
 * Record lists people read anywhere: richer rows — a status as a pill, links
 * as chips, a picture or a person's initials, a number as a bar, a phone with
 * its call and WhatsApp links, a row's own tone, bold and buttons — and the
 * rows as cards, on a phone (`card`) and in a gallery on any width (`gallery`),
 * each card still its row: ticked, opened, toned, its buttons pressed, under
 * its Group By heading and over the totals.
 */

const SVG = 'data:image/svg+xml;utf8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22/%3E';
const homes: Page = {
  fieldia: '0.9',
  id: 'homes',
  title: 'Homes',
  data: { kind: 'record', model: 'home' },
  fields: {
    name: { type: 'char', label: 'Home' },
    agent: { type: 'char', label: 'Agent' },
    photo: { type: 'image', label: 'Photo' },
    state: { type: 'selection', label: 'Status', options: [{ value: 'open', label: 'For sale' }, { value: 'offer', label: 'Under offer' }, { value: 'sold', label: 'Sold' }] },
    price: { type: 'monetary', label: 'Price', currency: 'EGP', digits: [12, 0] },
    bedrooms: { type: 'integer', label: 'Bedrooms' },
    tag_ids: { type: 'many2many', label: 'Tags', relation: 'home.tag' },
    complete: { type: 'integer', label: 'Listing complete' },
    phone: { type: 'char', label: 'Phone' },
  },
  phone: { country: 'EG' },
  layout: {
    type: 'list',
    id: 'list',
    columns: ['name', 'state', 'price', 'bedrooms', 'tag_ids', 'complete', 'agent', 'phone'],
    sort: [{ field: 'name' }],
    pageSize: 10,
    groupBy: ['state'],
    cells: {
      state: { widget: 'badge', options: { tones: { open: 'success', offer: 'warning', sold: 'muted' } } },
      price: { total: 'sum' },
      tag_ids: { widget: 'tags' },
      complete: { widget: 'progressbar' },
      phone: { widget: 'phone', options: { links: true } },
    },
    rowTones: [{ tone: 'muted', when: "state == 'sold'" }],
    rowBold: 'price > 5000000',
    rowButtons: [{ type: 'button', id: 'book', label: 'Book a viewing', action: 'book_viewing', invisible: "state == 'sold'" }],
  },
};
const records = () => ({
  1: { name: 'Nile view flat', agent: 'Mona Adel', photo: { name: 'nile.svg', type: 'image/svg+xml', size: 10, url: SVG }, state: 'open', price: 4500000, bedrooms: 3, tag_ids: [{ id: 1, label: 'Garden' }, { id: 2, label: 'Lift' }], complete: 80, phone: '+201012345678' },
  2: { name: 'Maadi villa', agent: 'Omar Said', photo: null, state: 'sold', price: 12000000, bedrooms: 5, tag_ids: [], complete: 100, phone: null },
  3: { name: 'Zamalek duplex', agent: 'Sara Haddad', photo: null, state: 'offer', price: 7800000, bedrooms: 4, tag_ids: [{ id: 2, label: 'Lift' }], complete: 45, phone: '+201098765432' },
});
const listOf = (page: Page) => page.layout as ListNode;
const withList = (more: Partial<ListNode>, page: Page = homes): Page => ({ ...page, layout: { ...listOf(page), ...more } });

let handle: ViewerHandle | null = null;
afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
});

async function mount(page: Page = homes, options: Partial<ViewerOptions> = {}) {
  const host = document.createElement('div');
  document.body.append(host);
  handle = mountViewer(host, { page, dataSource: createMemoryDataSource({ records: { home: records() } }), preferences: memoryPreferences(), ...options });
  await until(() => host.querySelectorAll('.fd-list-table tbody tr.fd-list-row').length === 3);
  return host;
}
const rows = (host: Element) => [...host.querySelectorAll('.fd-list-table tbody tr.fd-list-row')] as HTMLTableRowElement[];
const rowOf = (host: Element, name: string) => rows(host).find((tr) => tr.textContent?.includes(name)) as HTMLTableRowElement;
const cellOf = (tr: Element, column: string) => tr.querySelector(`td[data-col="${column}"]`) as HTMLTableCellElement;
const list = (host: Element) => host.querySelector('.fd-list') as HTMLElement;

describe('a list’s richer rows', () => {
  it('draws a status as a pill in its tone, links as chips, a number as a bar and a phone with its links', async () => {
    const host = await mount();
    const flat = rowOf(host, 'Nile view flat');
    const pill = cellOf(flat, 'state').querySelector('.fd-value-badge') as HTMLElement;
    expect(pill.textContent).toBe('For sale');
    expect(pill.dataset['tone']).toBe('success');
    expect([...cellOf(flat, 'tag_ids').querySelectorAll('.fd-list-chip')].map((chip) => chip.textContent)).toEqual(['Garden', 'Lift']);
    // None: no chip, no empty pill.
    expect(cellOf(rowOf(host, 'Maadi villa'), 'tag_ids').children).toHaveLength(0);
    const bar = cellOf(flat, 'complete').querySelector('[role="progressbar"]') as HTMLElement;
    expect(bar.getAttribute('aria-valuenow')).toBe('80');
    expect(bar.getAttribute('aria-valuemax')).toBe('100');
    expect(bar.getAttribute('aria-label')).toBe('Listing complete');
    expect(cellOf(flat, 'complete').textContent).toBe('80\u00a0%');
    const phone = cellOf(flat, 'phone');
    expect(phone.querySelector('bdi')?.textContent).toBe('+20 10 1234 5678');
    const links = [...phone.querySelectorAll('a')];
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['tel:+201012345678', 'https://wa.me/201012345678']);
    expect(links.map((a) => a.getAttribute('aria-label'))).toEqual(['Call +20 10 1234 5678', 'Message +20 10 1234 5678 on WhatsApp']);
    // No number, no links: hidden, never a link to nowhere.
    expect(cellOf(rowOf(host, 'Maadi villa'), 'phone').querySelectorAll('a')).toHaveLength(0);
  });

  it('opens no record when a link in its row is pressed', async () => {
    const opened: RecordId[] = [];
    const host = await mount(homes, { onOpenRecord: (id) => void opened.push(id) });
    const call = cellOf(rowOf(host, 'Nile view flat'), 'phone').querySelector('a') as HTMLAnchorElement;
    // The browser's own way to the number is not this test's.
    call.addEventListener('click', (event) => event.preventDefault());
    call.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(opened).toEqual([]);
  });

  it('draws a picture’s thumbnail, and a person’s initials where a round one has none', async () => {
    const host = await mount(withList({ columns: ['photo', 'name', 'agent'], cells: { photo: { widget: 'image' } } }));
    const thumb = cellOf(rowOf(host, 'Nile view flat'), 'photo').querySelector('img.fd-list-thumb') as HTMLImageElement;
    expect(thumb.getAttribute('src')).toBe(SVG);
    expect(thumb.getAttribute('alt')).toBe('');
    expect(cellOf(rowOf(host, 'Maadi villa'), 'photo').children).toHaveLength(0);
  });

  it('draws a round picture with no picture as initials: the record’s for its own picture, a person’s beside their name', async () => {
    const host = await mount(withList({ columns: ['photo', 'name', 'agent'], cells: { photo: { widget: 'avatar' }, agent: { widget: 'avatar' } } }));
    const own = cellOf(rowOf(host, 'Maadi villa'), 'photo').querySelector('.fd-list-initials') as HTMLElement;
    expect(own.dataset['initials']).toBe('MV');
    expect(own.textContent).toBe('');
    expect(own.getAttribute('aria-hidden')).toBe('true');
    const agent = cellOf(rowOf(host, 'Maadi villa'), 'agent');
    expect(agent.querySelector<HTMLElement>('.fd-list-person .fd-list-initials')?.dataset['initials']).toBe('OS');
    // The cell's words are the name alone: the initials are the sheet's to draw.
    expect(agent.textContent).toBe('Omar Said');
    expect(cellOf(rowOf(host, 'Nile view flat'), 'photo').querySelector('img.fd-list-avatar')?.getAttribute('src')).toBe(SVG);
  });

  it('tones and bolds a row while its condition holds on its record', async () => {
    const host = await mount();
    expect(rowOf(host, 'Maadi villa').dataset['tone']).toBe('muted');
    expect(rowOf(host, 'Maadi villa').hasAttribute('data-bold')).toBe(true);
    expect(rowOf(host, 'Nile view flat').hasAttribute('data-tone')).toBe(false);
    expect(rowOf(host, 'Nile view flat').hasAttribute('data-bold')).toBe(false);
    expect(rowOf(host, 'Zamalek duplex').hasAttribute('data-bold')).toBe(true);
  });

  it('shows a row’s own buttons by their condition, and runs one with that record alone, opening none', async () => {
    const asked: ActionRequest[] = [];
    const opened: RecordId[] = [];
    const host = await mount(homes, { onAction: (request) => void asked.push(request), onOpenRecord: (id) => void opened.push(id) });
    const book = (name: string) => rowOf(host, name).querySelector('.fd-list-tail [data-action="book"]') as HTMLButtonElement | null;
    expect(book('Nile view flat')?.textContent).toContain('Book a viewing');
    // Sold: hidden, never disabled.
    expect(book('Maadi villa')).toBeNull();
    book('Zamalek duplex')!.click();
    await until(() => asked.length === 1);
    expect(asked[0]).toEqual(expect.objectContaining({ action: 'book_viewing', recordIds: [3] }));
    expect(opened).toEqual([]);
    // Its column has a header, said to a screen reader.
    expect(host.querySelector('thead .fd-list-tail')?.textContent).toBe('Actions');
  });

  it('reads the person in a row’s conditions, as a form’s own: its own records bold and toned, its button on them alone — in the table and on the cards', async () => {
    const mine = withList({
      gallery: {},
      rowTones: [{ tone: 'info', when: "agent == user.name and 'agents' in user.roles" }],
      rowBold: 'agent == user.name',
      rowButtons: [{ type: 'button', id: 'hand-over', label: 'Hand over', action: 'hand_over', invisible: 'agent != user.name' }],
    });
    const host = await mount(mine, { user: { id: 9001, name: 'Sara Haddad', roles: ['agents'] } });
    const own = rowOf(host, 'Zamalek duplex');
    const other = rowOf(host, 'Nile view flat');
    expect(own.hasAttribute('data-bold')).toBe(true);
    expect(own.dataset['tone']).toBe('info');
    expect(own.querySelector('[data-action="hand-over"]')).not.toBeNull();
    expect(other.hasAttribute('data-bold')).toBe(false);
    expect(other.hasAttribute('data-tone')).toBe(false);
    expect(other.querySelector('[data-action="hand-over"]')).toBeNull();
    // The cards are the rows: the gallery shows the same.
    ([...host.querySelectorAll('.fd-list-views button')].find((b) => b.textContent === 'Gallery') as HTMLButtonElement).click();
    expect(list(host).dataset['as']).toBe('gallery');
    expect(rowOf(host, 'Zamalek duplex').hasAttribute('data-bold')).toBe(true);
    // Someone else signed in: none of it.
    handle?.destroy();
    document.body.replaceChildren();
    const theirs = await mount(mine, { user: { id: 9002, name: 'Omar Said' } });
    expect(rowOf(theirs, 'Zamalek duplex').hasAttribute('data-bold')).toBe(false);
    expect(rowOf(theirs, 'Maadi villa').hasAttribute('data-bold')).toBe(true);
    expect(rowOf(theirs, 'Maadi villa').hasAttribute('data-tone')).toBe(false);
  });

  it('says what its rows’ tones and bold mean over them, where the page gives words: a key read as a list; none without words', async () => {
    const keyed = withList({ rowTones: [{ tone: 'muted', when: "state == 'sold'", label: 'Sold' }, { tone: 'info', when: "state == 'offer'" }], rowBold: 'price > 5000000', rowBoldLabel: 'Over five million' });
    const host = await mount(keyed);
    const key = host.querySelector('.fd-list-key') as HTMLElement;
    expect(key.tagName).toBe('UL');
    expect(key.getAttribute('aria-label')).toBe('Key to the rows');
    expect([...key.querySelectorAll('li')].map((item) => item.textContent)).toEqual(['Sold', 'AaOver five million']);
    expect(key.querySelector('[data-tone="muted"]')?.getAttribute('aria-hidden')).toBe('true');
    // Over the rows, under the bar.
    expect(key.previousElementSibling?.matches('.fd-list-bar, .fd-list-selection, .fd-list-report')).toBe(true);
    handle?.destroy();
    document.body.replaceChildren();
    const plain = await mount(homes);
    expect(plain.querySelector('.fd-list-key')).toBeNull();
  });

  it('draws as 0.24 did for a list that asks for none of it: no column at the end, no card', async () => {
    const plain: Page = withList({ cells: { price: { total: 'sum' } }, rowTones: undefined, rowBold: undefined, rowButtons: undefined });
    const host = await mount(plain);
    expect(host.querySelector('.fd-list-tail, .fd-list-card, .fd-list-grip, .fd-list-columns-button')).toBeNull();
    expect(list(host).hasAttribute('data-shaped')).toBe(false);
    expect(list(host).hasAttribute('data-as')).toBe(false);
    expect(rows(host)[0].children).toHaveLength(1 + 8);
    expect([...host.querySelectorAll('.fd-list-views button')].every((button) => button.closest('[hidden]'))).toBe(true);
  });
});

describe('the parts a list draws from', () => {
  it('asks for the cards part where it has cards or a gallery, the columns part where people shape its columns, neither else', () => {
    const plain = withList({ rowTones: undefined, rowBold: undefined, rowButtons: undefined, cells: {} });
    expect(partsFor({ ...plain, phone: undefined })).toEqual([listPart]);
    expect(partsFor({ ...withList({ card: {} }, plain), phone: undefined })).toEqual([listPart, cardsPart]);
    expect(partsFor({ ...withList({ gallery: {} }, plain), phone: undefined })).toEqual([listPart, cardsPart]);
    expect(partsFor({ ...withList({ optionalColumns: { price: 'hide' } }, plain), phone: undefined })).toEqual([listPart, columnsPart]);
  });
});

describe('a list’s cards', () => {
  it('takes what a card shows from the columns where the page says nothing', () => {
    expect(cardSpec(homes, { ...listOf(homes), card: {} }, 'name')).toEqual({
      title: 'name',
      status: 'state',
      lines: [[{ field: 'price' }], [{ field: 'bedrooms' }], [{ field: 'tag_ids' }]],
      labels: true,
      lead: false,
    });
    // A picture column is the card's photo, never a line; no card, no gallery: none.
    const pictured = { ...listOf(homes), columns: ['photo', 'name', 'price'], cells: { photo: { widget: 'image' } }, gallery: {} };
    expect(cardSpec(homes, pictured, 'name')).toEqual(expect.objectContaining({ image: 'photo', lines: [[{ field: 'price' }]] }));
    expect(cardSpec(homes, listOf(homes), 'name')).toBeNull();
  });

  it('gives each field of a line of two its own label beside its own value: never two labels, then two values', async () => {
    // The owner's walk of 0.27: a lead's card read "Next follow-up · Agent 30 Sept 2026 · Mona / Adel".
    const page = withList({ card: { fields: [['price', 'agent'], 'bedrooms'] }, gallery: {} });
    const host = await mount(page);
    (host.querySelector('.fd-list-views') as HTMLElement).querySelectorAll('button')[1].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const card = rowOf(host, 'Nile view flat').querySelector('.fd-list-card') as HTMLElement;
    const lines = [...card.querySelectorAll<HTMLElement>('.fd-list-card-lines > div')];
    expect(lines).toHaveLength(2);
    // Each part its own pair, its label then its value, in one line that wraps between the pairs, never inside one.
    const pairs = (line: HTMLElement) => [...line.querySelectorAll<HTMLElement>('dl > div')].map((pair) => [pair.querySelector('dt')?.textContent, pair.querySelector('dd')?.textContent]);
    expect(pairs(lines[0])).toEqual([
      ['Price', 'E£\u00a04,500,000'],
      ['Agent', 'Mona Adel'],
    ]);
    expect(pairs(lines[1])).toEqual([['Bedrooms', '3']]);
    expect(lines[0].dataset['field']).toBe('price');
    expect(lines[0].textContent).not.toContain('Price · Agent');
  });

  it('offers a gallery on the switcher: the rows as cards, each with its photo, title, status pill and lines', async () => {
    const page = withList({ card: { image: 'photo', subtitle: 'agent', fields: ['price', [{ field: 'bedrooms', unit: { one: 'bedroom', other: 'bedrooms' } }]], lead: true, labels: false }, gallery: {} });
    const host = await mount(page);
    const switcher = host.querySelector('.fd-list-views') as HTMLElement;
    expect(switcher.hidden).toBe(false);
    expect([...switcher.querySelectorAll('button')].map((b) => b.textContent)).toEqual(['List', 'Gallery']);
    expect(list(host).hasAttribute('data-as')).toBe(false);
    (switcher.querySelectorAll('button')[1] as HTMLButtonElement).click();
    expect(list(host).dataset['as']).toBe('gallery');
    expect(list(host).dataset['view']).toBe('gallery');
    // The table's own rows, not a view of their own: the records are not asked for again, nor hidden.
    expect(list(host).hasAttribute('data-alone')).toBe(false);
    expect(list(host).dataset['size']).toBe('medium');
    const card = rowOf(host, 'Nile view flat').querySelector('.fd-list-card') as HTMLElement;
    expect(card.querySelector('.fd-list-card-photo img')?.getAttribute('src')).toBe(SVG);
    expect(card.querySelector('.fd-list-card-title')?.textContent).toBe('Nile view flat');
    expect(card.querySelector('.fd-list-card-subtitle')?.textContent).toBe('Mona Adel');
    expect(card.querySelector('.fd-list-card-head .fd-value-badge')?.textContent).toBe('For sale');
    expect([...card.querySelectorAll('.fd-list-card-lines dd')].map((dd) => dd.textContent)).toEqual(['E£\u00a04,500,000', '3\u00a0bedrooms']);
    expect([...card.querySelectorAll('.fd-list-card-lines dt')].map((dt) => dt.textContent)).toEqual(['Price', 'Bedrooms']);
    expect(card.querySelector('.fd-list-card-lines')?.getAttribute('data-labels')).toBe('hidden');
    expect(card.querySelector('.fd-list-card-lines')?.hasAttribute('data-lead')).toBe(true);
    // No photo: the title's initials in its place.
    expect(rowOf(host, 'Maadi villa').querySelector<HTMLElement>('.fd-list-card-photo[data-empty] .fd-list-card-initials')?.dataset['initials']).toBe('MV');
    // Back to the table.
    (switcher.querySelectorAll('button')[0] as HTMLButtonElement).click();
    expect(list(host).hasAttribute('data-as')).toBe(false);
  });

  it('opens on its gallery when the page says so, in the size it gives', async () => {
    const host = await mount(withList({ gallery: { opens: 'gallery', size: 'large' } }));
    expect(list(host).dataset['as']).toBe('gallery');
    expect(list(host).dataset['size']).toBe('large');
  });

  it('keeps what a row has on its card: its box, its press, its buttons, its tone, the headings and the totals', async () => {
    const opened: RecordId[] = [];
    const host = await mount(withList({ gallery: { opens: 'gallery' } }), { onOpenRecord: (id) => void opened.push(id) });
    const flat = rowOf(host, 'Nile view flat');
    // Ticked: chosen as its row is, the list's buttons over the cards.
    (flat.querySelector('.fd-list-checkbox') as HTMLInputElement).click();
    expect(flat.getAttribute('aria-selected')).toBe('true');
    expect((host.querySelector('.fd-list-selection') as HTMLElement).hidden).toBe(false);
    expect(host.querySelector('.fd-list-count')?.textContent).toBe('1 selected');
    // The box that ticks every card, with its words.
    expect(host.querySelector('thead .fd-list-check-all')?.textContent).toBe('Select all');
    (flat.querySelector('.fd-list-card-title') as HTMLElement).click();
    expect(opened).toEqual([1]);
    expect(rowOf(host, 'Maadi villa').dataset['tone']).toBe('muted');
    expect(flat.querySelector('.fd-list-tail [data-action="book"]')).not.toBeNull();
    await until(() => !(host.querySelector('.fd-list-totals tr[data-total="all"]') as HTMLElement).hidden);
    expect(host.querySelector('.fd-list-totals tr[data-total="all"] td[data-field="price"]')?.getAttribute('data-label')).toBe('Price');
  });

  it('turns its rows into cards where the list is as narrow as a phone, and back', async () => {
    let told: ((entries: { contentRect: { width: number } }[]) => void) | null = null;
    const was = (window as unknown as { ResizeObserver?: unknown }).ResizeObserver;
    (window as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
      constructor(callback: (entries: { contentRect: { width: number } }[]) => void) {
        told = callback;
      }
      observe() {}
      disconnect() {}
    };
    try {
      const host = await mount(withList({ card: {} }));
      expect(list(host).hasAttribute('data-as')).toBe(false);
      // Drawn at the next frame, never while the browser tells of sizes.
      const frame = () => new Promise((done) => requestAnimationFrame(done));
      told!([{ contentRect: { width: 390 } }]);
      await frame();
      expect(list(host).dataset['as']).toBe('cards');
      // Put away (no width): as it was.
      told!([{ contentRect: { width: 0 } }]);
      await frame();
      expect(list(host).dataset['as']).toBe('cards');
      told!([{ contentRect: { width: 900 } }]);
      await frame();
      expect(list(host).hasAttribute('data-as')).toBe(false);
      // No gallery asked for: no switcher.
      expect((host.querySelector('.fd-list-views') as HTMLElement).hidden).toBe(true);
    } finally {
      (window as unknown as { ResizeObserver?: unknown }).ResizeObserver = was;
    }
  });

  it('moves between cards with the arrow keys, along the line', async () => {
    const host = await mount(withList({ gallery: { opens: 'gallery' } }));
    rows(host)[0].focus();
    rows(host)[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(document.activeElement).toBe(rows(host)[1]);
    rows(host)[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(document.activeElement).toBe(rows(host)[0]);
  });
});
