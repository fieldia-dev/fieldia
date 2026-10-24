import { createMemoryDataSource, type ListNode, type Page } from '@fieldia/core';
import { memoryPreferences, WIDGET_LABELS, type PreferenceStore } from '@fieldia/widgets';
import { columnsKey } from './list-columns';
import { until } from './test-list';
import { mountViewer, type ViewerHandle } from './viewer';

/**
 * Columns people control (`optionalColumns`): shown and hidden from the
 * Columns menu at the header's end, put in their order there (Move up, Move
 * down, Alt with an arrow), sized by a header's grip, each kept for the person
 * in the viewer's `preferences` by page and list, and Reset back to the page's.
 * The rows, the totals and the Group By headings follow.
 */

const contacts: Page = {
  fieldia: '0.12',
  id: 'contacts',
  title: 'Contacts',
  data: { kind: 'record', model: 'contact' },
  fields: {
    name: { type: 'char', label: 'Name' },
    company: { type: 'char', label: 'Company' },
    email: { type: 'char', label: 'Email' },
    city: { type: 'selection', label: 'City', options: [{ value: 'cairo', label: 'Cairo' }, { value: 'giza', label: 'Giza' }] },
    value: { type: 'monetary', label: 'Value', currency: 'EGP' },
  },
  layout: {
    type: 'list',
    id: 'list',
    columns: ['name', 'company', 'email', 'city', 'value'],
    sort: [{ field: 'name' }],
    groupBy: ['city'],
    cells: { value: { total: 'sum' } },
    optionalColumns: { company: 'show', email: 'hide', city: 'show', value: 'show' },
  },
};
const records = () => ({
  1: { name: 'Mona Adel', company: 'Nile Traders', email: 'mona@nile.example', city: 'cairo', value: 1000 },
  2: { name: 'Omar Said', company: 'Delta Foods', email: 'omar@delta.example', city: 'giza', value: 2500 },
});

let handle: ViewerHandle | null = null;
afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
});

async function mount(preferences: PreferenceStore = memoryPreferences(), page: Page = contacts) {
  const host = document.createElement('div');
  document.body.append(host);
  handle = mountViewer(host, { page, dataSource: createMemoryDataSource({ records: { contact: records() } }), preferences });
  await until(() => host.querySelectorAll('.fd-list-table tbody tr.fd-list-row').length === 2);
  return host;
}
/** The headers a person sees, in order. */
const heads = (host: Element) => [...host.querySelectorAll('.fd-list-table thead th[data-col]')].filter((th) => !(th as HTMLElement).hidden).map((th) => th.textContent);
/** A row's cells a person sees, in order. */
const cells = (host: Element, row = 0) => [...host.querySelectorAll('.fd-list-table tbody tr.fd-list-row')[row].querySelectorAll('td[data-col]')].filter((td) => !(td as HTMLElement).hidden).map((td) => td.textContent);
const menuButton = (host: Element) => host.querySelector('thead .fd-list-columns-button') as HTMLButtonElement;
const menu = (host: Element) => host.querySelector('.fd-list-columns-menu') as HTMLElement;
const item = (host: Element, column: string) => menu(host).querySelector(`[data-col="${column}"]`) as HTMLElement;
const box = (host: Element, column: string) => item(host, column).querySelector('input') as HTMLInputElement;
const items = (host: Element) => [...menu(host).querySelectorAll('.fd-list-columns-item')].map((li) => li.textContent?.replace(/[↑↓]/g, ''));

describe('columns a person shows, hides and orders', () => {
  it('opens on the page’s columns, those it starts hidden hidden, a Columns menu at the header’s end', async () => {
    const host = await mount();
    expect(heads(host)).toEqual(['Name', 'Company', 'City', 'Value']);
    expect(cells(host)).toEqual(['Mona Adel', 'Nile Traders', 'Cairo', 'E£\u00a01,000.00']);
    expect(host.querySelector('.fd-list')?.hasAttribute('data-shaped')).toBe(true);
    expect(menuButton(host).getAttribute('aria-label')).toBe('Columns');
    expect(menuButton(host).getAttribute('aria-expanded')).toBe('false');
    // The first shown column is kept in view as the table scrolls sideways.
    expect(host.querySelector('thead th[data-pin]')?.getAttribute('data-col')).toBe('name');
  });

  it('shows and hides a column from the menu, the rows and the totals following, and keeps it for the person', async () => {
    const preferences = memoryPreferences();
    const host = await mount(preferences);
    menuButton(host).click();
    expect(menu(host).hidden).toBe(false);
    expect(menuButton(host).getAttribute('aria-expanded')).toBe('true');
    expect(items(host)).toEqual(['Name', 'Company', 'Email', 'City', 'Value']);
    // Name is no column the page lets them hide: no box, never a box that does nothing.
    expect(item(host, 'name').querySelector('input')).toBeNull();
    expect(box(host, 'email').checked).toBe(false);
    expect(document.activeElement).toBe(box(host, 'company'));
    box(host, 'email').click();
    expect(heads(host)).toEqual(['Name', 'Company', 'Email', 'City', 'Value']);
    expect(cells(host)[2]).toBe('mona@nile.example');
    box(host, 'company').click();
    expect(heads(host)).toEqual(['Name', 'Email', 'City', 'Value']);
    // The totals row under the columns shown.
    await until(() => !(host.querySelector('.fd-list-totals tr[data-total="all"]') as HTMLElement).hidden);
    const totals = [...(host.querySelector('.fd-list-totals tr[data-total="all"]') as HTMLElement).children];
    // The box's, the Total under Name, then Email, City and Value, and the menu's column.
    expect(totals).toHaveLength(6);
    expect(totals.map((cell) => cell.getAttribute('data-field'))).toEqual([null, null, 'email', 'city', 'value', null]);
    expect(preferences.get(columnsKey(contacts, contacts.layout as ListNode))).toEqual([
      { colId: 'name', width: null, hide: false },
      { colId: 'company', width: null, hide: true },
      { colId: 'email', width: null, hide: false },
      { colId: 'city', width: null, hide: false },
      { colId: 'value', width: null, hide: false },
    ]);
    // Next time, as they left it.
    handle?.destroy();
    document.body.replaceChildren();
    const again = await mount(preferences);
    expect(heads(again)).toEqual(['Name', 'Email', 'City', 'Value']);
  });

  it('never hides the last column shown', async () => {
    const page: Page = { ...contacts, layout: { ...(contacts.layout as ListNode), columns: ['company', 'email'], cells: {}, optionalColumns: { company: 'show', email: 'hide' } } };
    const host = await mount(memoryPreferences(), page);
    menuButton(host).click();
    box(host, 'company').click();
    expect(box(host, 'company').checked).toBe(true);
    expect(heads(host)).toEqual(['Company']);
  });

  it('orders the columns with Move up and Move down, and with Alt and an arrow, the focus staying on the column moved', async () => {
    const host = await mount();
    menuButton(host).click();
    // Hide, never disable: the name column has neither (it stays first), the one under it no Move up, the last no Move down.
    expect((item(host, 'name').querySelector('[data-move="up"]') as HTMLElement).hidden).toBe(true);
    expect((item(host, 'name').querySelector('[data-move="down"]') as HTMLElement).hidden).toBe(true);
    expect((item(host, 'company').querySelector('[data-move="up"]') as HTMLElement).hidden).toBe(true);
    expect((item(host, 'value').querySelector('[data-move="down"]') as HTMLElement).hidden).toBe(true);
    // Past Email, hidden: the menu says where it went, the table shows it where it is now.
    (item(host, 'city').querySelector('[data-move="up"]') as HTMLButtonElement).click();
    expect(items(host)).toEqual(['Name', 'Company', 'City', 'Email', 'Value']);
    (item(host, 'city').querySelector('[data-move="up"]') as HTMLButtonElement).click();
    expect(heads(host)).toEqual(['Name', 'City', 'Company', 'Value']);
    expect(cells(host)).toEqual(['Mona Adel', 'Cairo', 'Nile Traders', expect.any(String)]);
    // Right under Name its Move up is gone: the focus stays on its row, on its box.
    expect(document.activeElement).toBe(box(host, 'city'));
    box(host, 'value').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', altKey: true, bubbles: true }));
    expect(items(host)).toEqual(['Name', 'City', 'Company', 'Value', 'Email']);
    expect(document.activeElement).toBe(box(host, 'value'));
    // Right under the name column, City has no Move up: Name stays first, the one kept in view; Alt and ↑ do nothing.
    expect((item(host, 'city').querySelector('[data-move="up"]') as HTMLElement).hidden).toBe(true);
    box(host, 'city')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', altKey: true, bubbles: true }));
    item(host, 'city').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', altKey: true, bubbles: true }));
    expect(heads(host)).toEqual(['Name', 'City', 'Company', 'Value']);
    expect(host.querySelector('thead th[data-pin]')?.getAttribute('data-col')).toBe('name');
  });

  it('closes with Escape, the focus back on its button — the table not scrolled to it — and Reset puts back the page’s columns', async () => {
    const preferences = memoryPreferences();
    const host = await mount(preferences);
    menuButton(host).click();
    expect((menu(host).querySelector('.fd-list-columns-reset') as HTMLElement).hidden).toBe(true);
    box(host, 'company').click();
    expect((menu(host).querySelector('.fd-list-columns-reset') as HTMLElement).hidden).toBe(false);
    const focused = jest.spyOn(menuButton(host), 'focus');
    menu(host).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(focused).toHaveBeenCalledWith({ preventScroll: true });
    expect(menu(host).hidden).toBe(true);
    expect(document.activeElement).toBe(menuButton(host));
    menuButton(host).click();
    (menu(host).querySelector('.fd-list-columns-reset') as HTMLButtonElement).click();
    expect(heads(host)).toEqual(['Name', 'Company', 'City', 'Value']);
    expect(preferences.get(columnsKey(contacts, contacts.layout as ListNode))).toBeNull();
  });

  it('sizes a column from its grip with the arrow keys, kept for the person', async () => {
    const preferences = memoryPreferences();
    const host = await mount(preferences);
    const company = host.querySelector('thead th[data-col="company"]') as HTMLElement;
    const grip = company.querySelector('.fd-list-grip') as HTMLElement;
    expect(grip.getAttribute('role')).toBe('separator');
    expect(grip.getAttribute('aria-label')).toBe('Resize Company');
    // jsdom lays nothing out: the column starts at no width, and takes the narrowest a person may give.
    grip.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(company.hasAttribute('data-width-px')).toBe(true);
    const width = company.style.getPropertyValue('--fd-col-px');
    expect(width).toBe('48px');
    grip.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(company.style.getPropertyValue('--fd-col-px')).toBe('64px');
    expect((host.querySelector('tbody tr.fd-list-row td[data-col="company"]') as HTMLElement).style.getPropertyValue('--fd-col-px')).toBe('64px');
    expect(grip.getAttribute('aria-valuenow')).toBe('64');
    expect((preferences.get(columnsKey(contacts, contacts.layout as ListNode)) as { colId: string; width: number | null }[]).find((one) => one.colId === 'company')?.width).toBe(64);
    // Twice on its grip: the page's width again.
    grip.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    expect(company.hasAttribute('data-width-px')).toBe(false);
  });

  it('marks its card scrolled from its start, and while columns lie past its end, for the rules by the columns held there', async () => {
    const host = await mount();
    const scroller = host.querySelector('.fd-list-scroll') as HTMLElement;
    // jsdom lays nothing out: a card of 500px over a table of 1000.
    let left = 0;
    Object.defineProperties(scroller, { scrollWidth: { value: 1000 }, clientWidth: { value: 500 }, scrollLeft: { get: () => left } });
    const scrolled = (to: number) => {
      left = to;
      scroller.dispatchEvent(new Event('scroll'));
      return [scroller.hasAttribute('data-scrolled'), scroller.hasAttribute('data-more')];
    };
    expect(scrolled(0)).toEqual([false, true]);
    expect(scrolled(200)).toEqual([true, true]);
    expect(scrolled(500)).toEqual([true, false]);
    // Right to left, scrollLeft runs below 0.
    expect(scrolled(-200)).toEqual([true, true]);
    expect(scrolled(-500)).toEqual([true, false]);
    // The Columns menu's cell is the header's last.
    expect(host.querySelector('thead tr > th:last-child')?.contains(menuButton(host))).toBe(true);
  });

  it('spans its Group By headings across the columns shown', async () => {
    const host = await mount();
    (host.querySelector('.fd-search-toggle') as HTMLButtonElement).click();
    ([...host.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'City') as HTMLButtonElement).click();
    await until(() => host.querySelector('.fd-list-group'));
    // The box, the four columns, the menu's.
    expect((host.querySelector('.fd-list-group > td') as HTMLTableCellElement).colSpan).toBe(6);
    menuButton(host).click();
    box(host, 'email').click();
    expect((host.querySelector('.fd-list-group > td') as HTMLTableCellElement).colSpan).toBe(7);
  });

  it('reads what was kept leniently: a column the page has since added in its place, one it took away gone, one it no longer lets them hide shown', async () => {
    const preferences = memoryPreferences();
    preferences.set(columnsKey(contacts, contacts.layout as ListNode), [
      { colId: 'value', width: 120, hide: false },
      { colId: 'gone', width: null, hide: true },
      { colId: 'name', width: null, hide: true },
      { colId: 'company', width: 5000, hide: true },
    ]);
    const host = await mount(preferences);
    // Name first, wherever it was kept (0.26 kept it after Value): the name column always leads.
    expect(heads(host)).toEqual(['Name', 'Value', 'City']);
    expect((host.querySelector('thead th[data-col="value"]') as HTMLElement).style.getPropertyValue('--fd-col-px')).toBe('120px');
    // Wider than any column may be: the widest.
    expect((host.querySelector('thead th[data-col="company"]') as HTMLElement).style.getPropertyValue('--fd-col-px')).toBe('1200px');
  });
});

/**
 * jsdom lays nothing out: the table as a browser would lay it, its cells side by side from its start — the box to
 * choose a row and the menu's column 40px wide, each field's 100px — right to left where the list is.
 */
function layOut(rtl = false) {
  const wide = (cell: Element) => (cell.hasAttribute('data-col') || cell.hasAttribute('data-field') ? 100 : 40);
  const rect = (left: number, top: number, width: number, height: number) => ({ x: left, y: top, left, top, width, height, right: left + width, bottom: top + height, toJSON: () => ({}) }) as DOMRect;
  return jest.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const cell = this.closest('th, td');
    const table = this.closest('table');
    const head = table?.querySelector('thead tr');
    const total = head ? [...head.children].filter((one) => !(one as HTMLElement).hidden).reduce((sum, one) => sum + wide(one), 0) : 0;
    if (cell?.parentElement) {
      const row = [...cell.parentElement.children].filter((one) => !(one as HTMLElement).hidden);
      const start = row.slice(0, row.indexOf(cell)).reduce((sum, one) => sum + wide(one), 0);
      return rect(rtl ? total - start - wide(cell) : start, 0, wide(cell), 30);
    }
    if (table) return rect(0, 0, total, 300);
    return rect(0, 0, 1000, 400);
  });
}
/** A mouse's pointer event as a browser sends it (jsdom has no PointerEvent: a mouse event with its pointer's id and kind). */
const pointer = (type: string, x: number) => {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientX: x, clientY: 15 });
  Object.defineProperties(event, { pointerId: { value: 1 }, pointerType: { value: 'mouse' }, isPrimary: { value: true } });
  return event;
};
const sortButton = (host: Element, column: string) => host.querySelector(`thead th[data-col="${column}"] .fd-list-sort`) as HTMLElement;
/** A hand's drag of a header from one point to another: pressed, moved a step at a time, let go; then the click a press ends with. */
function dragHeader(host: Element, column: string, from: number, to: number, between?: () => void) {
  const button = sortButton(host, column);
  button.dispatchEvent(pointer('pointerdown', from));
  for (let step = 1; step <= 10; step++) button.dispatchEvent(pointer('pointermove', from + ((to - from) * step) / 10));
  between?.();
  button.dispatchEvent(pointer('pointerup', to));
  button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }));
}
const voiceOf = (host: Element) => host.querySelector('.fd-list > .fd-sr-only[role="status"]')?.textContent;

describe('a column moved by dragging its header', () => {
  let laid: jest.SpyInstance | null = null;
  afterEach(() => {
    laid?.mockRestore();
    laid = null;
  });

  it('follows the pointer past the middles of the columns it passes, the others sliding aside; let go, it is there, kept and said, and nothing sorted', async () => {
    const preferences = memoryPreferences();
    const host = await mount(preferences);
    laid = layOut();
    const list = host.querySelector('.fd-list') as HTMLElement;
    // Company (140–240) pressed in its middle, carried past City's middle (290).
    const button = sortButton(host, 'company');
    button.dispatchEvent(pointer('pointerdown', 190));
    button.dispatchEvent(pointer('pointermove', 193));
    // A few pixels are still a press.
    expect(list.hasAttribute('data-moving')).toBe(false);
    for (let x = 200; x <= 300; x += 10) button.dispatchEvent(pointer('pointermove', x));
    expect(list.hasAttribute('data-moving')).toBe(true);
    // Its ghost under the pointer, City slid back into Company's place, Company's own cells in City's, a line where it goes.
    const ghost = list.querySelector('.fd-list-ghost') as HTMLElement;
    expect(ghost.textContent).toBe('Company');
    expect(ghost.style.left).toBe('250px');
    expect((host.querySelector('thead th[data-col="city"]') as HTMLElement).style.transform).toBe('translateX(-100px)');
    expect((host.querySelector('tbody td[data-col="city"]') as HTMLElement).style.transform).toBe('translateX(-100px)');
    expect((host.querySelector('thead th[data-col="company"]') as HTMLElement).style.transform).toBe('translateX(100px)');
    expect(host.querySelector('tbody td[data-col="company"]')?.hasAttribute('data-lifted')).toBe(true);
    expect((host.querySelector('thead th[data-col="value"]') as HTMLElement).style.transform).toBe('');
    expect((list.querySelector('.fd-list-drop') as HTMLElement).style.left).toBe('240px');
    button.dispatchEvent(pointer('pointerup', 300));
    button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }));
    expect(heads(host)).toEqual(['Name', 'City', 'Company', 'Value']);
    expect(cells(host)).toEqual(['Mona Adel', 'Cairo', 'Nile Traders', expect.any(String)]);
    // The totals under the columns, in their order.
    await until(() => !(host.querySelector('.fd-list-totals tr[data-total="all"]') as HTMLElement).hidden);
    expect([...(host.querySelector('.fd-list-totals tr[data-total="all"]') as HTMLElement).children].map((cell) => cell.getAttribute('data-field'))).toEqual([null, null, 'city', 'company', 'value', null]);
    expect(list.querySelector('.fd-list-ghost, .fd-list-drop')).toBeNull();
    expect((host.querySelector('thead th[data-col="city"]') as HTMLElement).style.transform).toBe('');
    expect(host.querySelector('[data-lifted]')).toBeNull();
    expect(voiceOf(host)).toBe('Company moved to place 3 of 4');
    // Kept as the menu keeps an order, Email hidden in its place.
    expect((preferences.get(columnsKey(contacts, contacts.layout as ListNode)) as { colId: string }[]).map((one) => one.colId)).toEqual(['name', 'email', 'city', 'company', 'value']);
    // The drag's click sorted nothing.
    expect(host.querySelector('thead th[data-col="company"]')?.hasAttribute('aria-sort')).toBe(false);
  });

  it('sorts as before on a press that does not move, and on a key', async () => {
    const host = await mount();
    laid = layOut();
    dragHeader(host, 'company', 190, 192);
    await until(() => host.querySelector('thead th[data-col="company"]')?.getAttribute('aria-sort') === 'ascending');
    expect(heads(host)).toEqual(['Name', 'Company', 'City', 'Value']);
    // A drag, then a key's click (no pointer's): the key sorts.
    dragHeader(host, 'city', 290, 120);
    expect(heads(host)).toEqual(['Name', 'City', 'Company', 'Value']);
    sortButton(host, 'city').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 0 }));
    await until(() => host.querySelector('thead th[data-col="city"]')?.getAttribute('aria-sort') === 'ascending');
  });

  it('puts the column back with Escape, keeping nothing, the dialog round it not told', async () => {
    const preferences = memoryPreferences();
    const host = await mount(preferences);
    laid = layOut();
    const heard: string[] = [];
    host.addEventListener('keydown', (event) => heard.push(event.key));
    dragHeader(host, 'company', 190, 400, () => {
      expect(host.querySelector('.fd-list-ghost')).not.toBeNull();
      host.querySelector('thead th[data-col="company"]')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      expect(host.querySelector('.fd-list-ghost')).toBeNull();
    });
    expect(heard).toEqual([]);
    expect(heads(host)).toEqual(['Name', 'Company', 'City', 'Value']);
    expect((host.querySelector('thead th[data-col="city"]') as HTMLElement).style.transform).toBe('');
    expect(preferences.get(columnsKey(contacts, contacts.layout as ListNode))).toBeNull();
    // The press was a drag all the same: no sort.
    expect(host.querySelector('thead th[data-col="company"]')?.hasAttribute('aria-sort')).toBe(false);
  });

  it('keeps the name column first, held in view, whatever is carried; mirrored right to left', async () => {
    const host = await mount(memoryPreferences(), { ...contacts, language: 'ar' });
    laid = layOut(true);
    expect(host.querySelector('[dir]')?.getAttribute('dir')).toBe('rtl');
    // Right to left, Name is at 340–440 (from the start, 40–140): carried leftwards past Company's middle (290), it stays.
    dragHeader(host, 'name', 390, 280);
    expect(heads(host)).toEqual(['Name', 'Company', 'City', 'Value']);
    // Value (40–140) carried to the table's start, over Name: right after it.
    dragHeader(host, 'value', 90, 430);
    expect(heads(host)).toEqual(['Name', 'Value', 'Company', 'City']);
    expect(host.querySelector('thead th[data-pin]')?.getAttribute('data-col')).toBe('name');
  });

  it('is lifted by a finger resting on its header, and follows it; a swipe is left to the browser', async () => {
    const preferences = memoryPreferences();
    const host = await mount(preferences);
    laid = layOut();
    const list = host.querySelector('.fd-list') as HTMLElement;
    const header = host.querySelector('thead th[data-col="company"]') as HTMLElement;
    const touch = (type: string, x: number, y = 15) => {
      const event = new Event(type, { bubbles: true, cancelable: true });
      const point = [{ identifier: 7, clientX: x, clientY: y }];
      Object.defineProperties(event, { touches: { value: type === 'touchend' ? [] : point }, changedTouches: { value: point } });
      sortButton(host, 'company').dispatchEvent(event);
      return event;
    };
    // A swipe: the finger wanders before it has rested, and nothing is lifted.
    touch('touchstart', 190);
    touch('touchmove', 170);
    await new Promise((resolve) => setTimeout(resolve, 600));
    expect(list.hasAttribute('data-moving')).toBe(false);
    touch('touchend', 170);
    // Resting: lifted, then it follows the finger, the page held still.
    touch('touchstart', 190);
    await until(() => list.hasAttribute('data-moving'));
    expect(header.hasAttribute('data-lifted')).toBe(true);
    expect(touch('touchmove', 300).defaultPrevented).toBe(true);
    expect(touch('touchend', 300).defaultPrevented).toBe(true);
    expect(heads(host)).toEqual(['Name', 'City', 'Company', 'Value']);
    expect(voiceOf(host)).toBe('Company moved to place 3 of 4');
  });

  it('says where the menu moved a column too', async () => {
    const host = await mount();
    menuButton(host).click();
    (item(host, 'value').querySelector('[data-move="up"]') as HTMLButtonElement).click();
    expect(voiceOf(host)).toBe('Value moved to place 4 of 5');
  });

  it('says the label small inside a sentence that puts it there where the page asks (lowerLabels), as written at its start', async () => {
    const own = WIDGET_LABELS.en.movedTo;
    try {
      const host = await mount(memoryPreferences(), { ...contacts, lowerLabels: true });
      menuButton(host).click();
      (item(host, 'value').querySelector('[data-move="up"]') as HTMLButtonElement).click();
      expect(voiceOf(host)).toBe('Value moved to place 4 of 5');
      // An app's own words, the label inside them.
      WIDGET_LABELS.en.movedTo = 'Moved {label} to place {n} of {total}';
      (item(host, 'city').querySelector('[data-move="up"]') as HTMLButtonElement).click();
      expect(voiceOf(host)).toBe('Moved city to place 4 of 5');
    } finally {
      WIDGET_LABELS.en.movedTo = own;
    }
  });
});
