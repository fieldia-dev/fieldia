import { createMemoryDataSource, type Page, type Values } from '@fieldia/core';
import { memoryPreferences, type PreferenceStore } from '@fieldia/widgets';
import { until } from './test-list';
import { mountViewer, type ViewerHandle, type ViewerOptions } from './viewer';

/**
 * A list drawn as a work tracker's backlog: cells with a state's dot and a
 * kind's icon, widths and sides, no box to choose a row, a filter bar of a
 * keyword and a list of values per field, rows nested under their parent,
 * and a row opened in a dialog that the list comes back to.
 */

const backlog: Page = {
  fieldia: '0.1',
  id: 'backlog',
  title: 'Backlog',
  data: { kind: 'record', model: 'work.item' },
  fields: {
    number: { type: 'integer', label: 'Order' },
    work_type: { type: 'selection', label: 'Work Item Type', options: [{ value: 'bug', label: 'Bug' }, { value: 'task', label: 'Task' }] },
    title: { type: 'char', label: 'Title' },
    state: { type: 'selection', label: 'State', options: [{ value: 'new', label: 'New' }, { value: 'active', label: 'Active' }, { value: 'closed', label: 'Closed' }] },
    area: { type: 'many2one', label: 'Area', relation: 'work.area' },
    tags: { type: 'many2many', label: 'Tags', relation: 'work.tag' },
    parent_id: { type: 'many2one', label: 'Parent', relation: 'work.item' },
  },
  layout: {
    type: 'list',
    id: 'list',
    columns: ['number', 'work_type', 'title', 'state'],
    sort: [{ field: 'number' }],
    cells: {
      number: { align: 'start', width: 6 },
      work_type: { width: 3 },
      title: { lead: { field: 'work_type', looks: { bug: { icon: 'bug', colour: '#cc293d' }, task: { icon: 'task', colour: '#f2cb1d' } } } },
      state: { widget: 'dot', options: { colours: { new: '#b2b2b2', active: '#007acc' }, tones: { closed: 'success' } } },
    },
    choose: false,
    search: 'fields',
    searchFields: ['title', 'number'],
    filterFields: ['work_type', 'state', 'area', 'tags'],
    parentField: 'parent_id',
  },
};

const records = (): Record<string, Values> => ({
  1: { number: 17, work_type: 'bug', title: 'Stock count shows 12 after releasing 3', state: 'active', area: { id: 1, label: 'Portal' }, tags: [{ id: 1, label: 'Stock' }], parent_id: null },
  2: { number: 31, work_type: 'bug', title: 'Cancel stage loses the download', state: 'new', area: { id: 2, label: 'Warehouse' }, tags: [], parent_id: null },
  3: { number: 52, work_type: 'task', title: 'Write the stock test', state: 'active', area: { id: 1, label: 'Portal' }, tags: [], parent_id: { id: 1, label: 'Stock count shows 12 after releasing 3' } },
  4: { number: 84, work_type: 'task', title: 'Check the scanner log', state: 'closed', area: { id: 1, label: 'Portal' }, tags: [], parent_id: { id: 3, label: 'Write the stock test' } },
});
/** Preferences that start with these. */
const kept = (values: Record<string, unknown>): PreferenceStore => {
  const store = memoryPreferences();
  for (const [name, value] of Object.entries(values)) store.set(name, value as never);
  return store;
};
const source = () => createMemoryDataSource({ records: { 'work.item': records(), 'work.tag': { 1: { name: 'Stock' }, 2: { name: 'Printing' } } } });

let handle: ViewerHandle | null = null;
afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
});

async function mount(options: Partial<ViewerOptions> = {}, page: Page = backlog) {
  const host = document.createElement('div');
  document.body.append(host);
  handle = mountViewer(host, { page, dataSource: source(), ...options });
  await until(() => host.querySelector('.fd-list-table tbody tr'));
  return host;
}
const rows = (host: Element) => [...host.querySelectorAll<HTMLTableRowElement>('.fd-list-table tbody tr.fd-list-row')];
const shown = (host: Element) => rows(host).filter((tr) => !tr.hidden);
const titles = (trs: HTMLTableRowElement[]) => trs.map((tr) => tr.querySelector('td[data-name] bdi, td:nth-child(4) bdi')?.textContent);
const key = (target: Element, name: string) => target.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true }));
const byName = (root: Element, name: string) => [...root.querySelectorAll('button')].find((b) => (b.getAttribute('aria-label') ?? b.textContent?.trim()) === name) as HTMLButtonElement;

describe('a backlog’s cells', () => {
  it('draw a state’s dot in its colour, a kind’s icon before the title, widths and sides', async () => {
    const host = await mount();
    const first = rows(host)[0];
    const [order, kind, title, state] = [...first.querySelectorAll('td')].slice(1);
    expect(order.classList.contains('fd-num')).toBe(false);
    expect(order.getAttribute('data-width')).toBe('6');
    expect(order.style.getPropertyValue('--fd-col-width')).toBe('6');
    expect(kind.textContent).toBe('Bug');
    const icon = title.querySelector('svg.fd-list-lead') as SVGElement;
    expect(icon.getAttribute('aria-hidden')).toBe('true');
    expect(icon.style.color).toBe('rgb(204, 41, 61)');
    expect(title.textContent).toBe('Stock count shows 12 after releasing 3');
    const dot = state.querySelector('.fd-list-dot') as HTMLElement;
    expect(dot.style.getPropertyValue('--fd-dot')).toBe('#007acc');
    expect(state.textContent).toBe('Active');
    // A tone where the page gives no colour.
    const closed = rows(host).find((tr) => tr.textContent?.includes('Closed')) as HTMLElement;
    expect(closed.querySelector('.fd-list-dot')?.getAttribute('data-tone')).toBe('success');
  });

  it('cut a header too long for its width, saying it whole as its title', async () => {
    const host = await mount();
    const head = (field: string) => host.querySelector(`thead th[data-field="${field}"] .fd-list-head`) as HTMLElement;
    expect(head('work_type').getAttribute('title')).toBe('Work Item Type');
    expect(head('number').hasAttribute('title')).toBe(false);
    expect(head('title').hasAttribute('title')).toBe(false);
  });

  it('take widths in pixels for the whole column; every column sized, the table keeps them', async () => {
    const sized: Page = {
      ...backlog,
      layout: { ...backlog.layout, cells: { number: { width: '59px', rule: false }, work_type: { width: '36px' }, title: { width: '908px', rule: '42px' }, state: { width: 8 } } } as Page['layout'],
    };
    const host = await mount({}, sized);
    const head = (field: string) => host.querySelector(`thead th[data-field="${field}"]`) as HTMLElement;
    expect(head('title').hasAttribute('data-width-px')).toBe(true);
    expect(head('title').style.getPropertyValue('--fd-col-px')).toBe('908px');
    expect(head('state').getAttribute('data-width')).toBe('8');
    // Its header's rule: none after the number, 42px in from the title's end, at the end of the others.
    expect(head('number').getAttribute('data-rule')).toBe('none');
    expect(head('title').style.getPropertyValue('--fd-rule-in')).toBe('42px');
    expect([head('work_type').hasAttribute('data-rule'), head('work_type').style.getPropertyValue('--fd-rule-in')]).toEqual([false, '']);
    const [, , kind] = [...rows(host)[0].querySelectorAll('td')];
    expect(kind.style.getPropertyValue('--fd-col-px')).toBe('36px');
    // Cut in 36px, its header says itself whole; whole in 908px, it does not.
    expect(head('work_type').querySelector('.fd-list-head')?.getAttribute('title')).toBe('Work Item Type');
    expect(head('title').querySelector('.fd-list-head')?.hasAttribute('title')).toBe(false);
    expect(host.querySelector('.fd-list-table')?.hasAttribute('data-fixed')).toBe(true);
    // One column left to take the room: the table fills its card as before.
    handle?.destroy();
    document.body.replaceChildren();
    const loose = await mount({}, { ...sized, layout: { ...sized.layout, cells: { number: { width: '59px' } } } as Page['layout'] });
    expect(loose.querySelector('.fd-list-table')?.hasAttribute('data-fixed')).toBe(false);
  });

  it('keep a ranked list’s order: its headers are words, not presses, and the order still said', async () => {
    const host = await mount({}, { ...backlog, layout: { ...backlog.layout, sortable: false } as Page['layout'] });
    expect(host.querySelectorAll('thead .fd-list-sort')).toHaveLength(0);
    expect(host.querySelector('thead th[data-field="title"] .fd-list-head')?.textContent).toBe('Title');
    expect(host.querySelector('thead th[data-field="number"]')?.getAttribute('aria-sort')).toBe('ascending');
    // Sortable as before unless said.
    handle?.destroy();
    document.body.replaceChildren();
    const sorting = await mount();
    expect(sorting.querySelectorAll('thead .fd-list-sort').length).toBeGreaterThan(0);
  });

  it('keep room the size of a toggle before every name, and the name’s header over the names', async () => {
    const host = await mount({}, { ...backlog, layout: { ...backlog.layout, defaultFilters: undefined } as Page['layout'] });
    // Rows that are no parent have the room, so names line up whether a page shows parents or not.
    const leaf = rows(host).find((tr) => !tr.hasAttribute('data-parent-of')) as HTMLElement;
    expect(leaf.querySelector('td[data-name] > .fd-list-twisty-room')).not.toBeNull();
    expect(host.querySelector('thead th[data-field="title"]')?.hasAttribute('data-name')).toBe(true);
    expect(host.querySelector('thead th[data-field="state"]')?.hasAttribute('data-name')).toBe(false);
  });

  it('have no box to choose a row, and no buttons for rows chosen', async () => {
    const host = await mount();
    expect(host.querySelector('.fd-list-checkbox')).toBeNull();
    expect(host.querySelector('.fd-list-selection')).toBeNull();
    // Space on a row chooses nothing, and the row says nothing about being chosen.
    key(rows(host)[0], ' ');
    expect(rows(host)[0].hasAttribute('aria-selected')).toBe(false);
  });
});

describe('rows under their parent', () => {
  it('are drawn under it, depth first, each further in, with Expand all and Collapse all', async () => {
    const host = await mount();
    expect(titles(rows(host))).toEqual(['Stock count shows 12 after releasing 3', 'Write the stock test', 'Check the scanner log', 'Cancel stage loses the download']);
    expect(rows(host).map((tr) => tr.dataset['depth'])).toEqual(['0', '1', '2', '0']);
    const parent = rows(host)[0];
    expect(parent.getAttribute('aria-expanded')).toBe('true');
    expect(parent.querySelector('.fd-list-twisty')?.getAttribute('aria-label')).toBe('Stock count shows 12 after releasing 3');
    byName(host, 'Collapse all').click();
    expect(titles(shown(host))).toEqual(['Stock count shows 12 after releasing 3', 'Cancel stage loses the download']);
    expect(parent.getAttribute('aria-expanded')).toBe('false');
    byName(host, 'Expand all').click();
    expect(shown(host)).toHaveLength(4);
  });

  it('fold by their toggle and by the arrow keys, which skip the rows folded away', async () => {
    const host = await mount();
    const parent = rows(host)[0];
    (parent.querySelector('.fd-list-twisty') as HTMLButtonElement).click();
    expect(shown(host)).toHaveLength(2);
    // The toggle is its own: it opens no record.
    parent.focus();
    key(parent, 'ArrowRight');
    expect(shown(host)).toHaveLength(4);
    key(rows(host)[1], 'ArrowLeft');
    expect(titles(shown(host))).toEqual(['Stock count shows 12 after releasing 3', 'Write the stock test', 'Cancel stage loses the download']);
    key(parent, 'ArrowLeft');
    parent.focus();
    key(parent, 'ArrowDown');
    expect(document.activeElement).toBe(rows(host)[3]);
  });

  it('turn their arrows round right to left', async () => {
    const host = await mount({ locale: 'ar', dir: 'rtl' });
    const parent = rows(host)[0];
    key(parent, 'ArrowRight');
    expect(shown(host)).toHaveLength(2);
    key(parent, 'ArrowLeft');
    expect(shown(host)).toHaveLength(4);
    expect(byName(host, 'طي الكل')).toBeTruthy();
  });
});

describe('the filter bar', () => {
  const bar = (host: Element) => host.querySelector('.fd-filter-bar') as HTMLElement;
  const pick = (host: Element, field: string) => bar(host).querySelector(`.fd-filter-pick[data-field="${field}"]`) as HTMLButtonElement;
  const menuOf = (button: HTMLButtonElement) => document.getElementById(button.getAttribute('aria-controls') as string) as HTMLElement;
  const options = (menu: HTMLElement) => [...menu.querySelectorAll<HTMLElement>('[role="menuitemcheckbox"]')];

  it('looks for a keyword in the search fields, once typing rests or at Enter', async () => {
    const host = await mount();
    const input = bar(host).querySelector('input') as HTMLInputElement;
    expect(input.getAttribute('aria-label')).toBe('Filter by keyword');
    expect(input.placeholder).toBe('Filter by keyword');
    input.value = 'scanner';
    input.dispatchEvent(new Event('input'));
    key(input, 'Enter');
    await until(() => rows(host).length === 1);
    expect(titles(rows(host))).toEqual(['Check the scanner log']);
    // A number of a number field.
    input.value = '31';
    key(input, 'Enter');
    await until(() => rows(host)[0]?.textContent?.includes('Cancel'));
    expect(titles(rows(host))).toEqual(['Cancel stage loses the download']);
    // Escape takes the keyword away.
    key(input, 'Escape');
    await until(() => rows(host).length === 4);
    expect(input.value).toBe('');
  });

  it('lists a field’s values to tick: ↓ opens, the arrows move, Space ticks, Escape closes; its button then says what is ticked', async () => {
    const host = await mount();
    const button = pick(host, 'state');
    expect(button.textContent).toBe('State');
    expect(button.hasAttribute('data-picked')).toBe(false);
    button.focus();
    key(button, 'ArrowDown');
    const menu = menuOf(button);
    await until(() => options(menu).length);
    expect(menu.getAttribute('role')).toBe('menu');
    expect(menu.getAttribute('aria-label')).toBe('Filter by State');
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(options(menu).map((o) => o.textContent)).toEqual(['New', 'Active', 'Closed']);
    expect(document.activeElement).toBe(options(menu)[0]);
    key(menu, 'ArrowDown');
    expect(document.activeElement).toBe(options(menu)[1]);
    key(menu, ' ');
    await until(() => rows(host).length === 2);
    expect(titles(rows(host))).toEqual(['Stock count shows 12 after releasing 3', 'Write the stock test']);
    expect(options(menu)[1].getAttribute('aria-checked')).toBe('true');
    expect(document.activeElement).toBe(options(menu)[1]);
    key(menu, 'Escape');
    expect(menu.hidden).toBe(true);
    expect(document.activeElement).toBe(button);
    // The ticked value's words, the field's name read out before them.
    expect(button.hasAttribute('data-picked')).toBe(true);
    expect(button.textContent).toBe('State: Active');
    expect(button.querySelector('.fd-sr-only')?.textContent).toBe('State: ');
  });

  it('lists a link’s values from its records, and links’ from their model', async () => {
    const host = await mount();
    const area = pick(host, 'area');
    area.click();
    await until(() => options(menuOf(area)).length);
    expect(options(menuOf(area)).map((o) => o.textContent)).toEqual(['Portal', 'Warehouse']);
    options(menuOf(area))[1].click();
    await until(() => rows(host).length === 1);
    expect(titles(rows(host))).toEqual(['Cancel stage loses the download']);
    const tags = pick(host, 'tags');
    tags.click();
    await until(() => options(menuOf(tags)).length);
    expect(menuOf(area).hidden).toBe(true);
    expect(options(menuOf(tags)).map((o) => o.textContent)).toEqual(['Stock', 'Printing']);
  });

  it('starts with the values a default search kept, and × clears every filter', async () => {
    const preferences = kept({
      'favourites:backlog': [{ name: 'Active bugs', isDefault: true, facets: [{ kind: 'field', field: 'work_type', label: 'Work Item Type', values: [{ op: '=', value: 'bug', label: 'Bug' }] }, { kind: 'field', field: 'state', label: 'State', values: [{ op: '=', value: 'active', label: 'Active' }] }] }],
    });
    const host = await mount({ preferences });
    await until(() => rows(host).length === 1);
    expect(titles(rows(host))).toEqual(['Stock count shows 12 after releasing 3']);
    expect(pick(host, 'work_type').textContent).toBe('Work Item Type: Bug');
    expect(pick(host, 'state').hasAttribute('data-picked')).toBe(true);
    expect(pick(host, 'area').hasAttribute('data-picked')).toBe(false);
    const clear = byName(bar(host), 'Clear filters');
    expect(clear.hidden).toBe(false);
    clear.click();
    await until(() => rows(host).length === 4);
    expect(pick(host, 'work_type').textContent).toBe('Work Item Type');
    expect(clear.hidden).toBe(true);
  });

  it('offers the fields the person keeps, by its gear: a field taken away no longer filters', async () => {
    const preferences = memoryPreferences();
    const host = await mount({ preferences });
    const state = pick(host, 'state');
    state.click();
    await until(() => options(menuOf(state)).length);
    options(menuOf(state))[0].click();
    await until(() => rows(host).length === 1);
    const gear = byName(bar(host), 'Filter settings');
    expect(gear.getAttribute('title')).toBe('Filter settings');
    gear.click();
    const settings = menuOf(gear);
    await until(() => options(settings).length);
    expect(options(settings).map((o) => `${o.textContent} ${o.getAttribute('aria-checked')}`)).toEqual(['Work Item Type true', 'State true', 'Area true', 'Tags true']);
    options(settings)[1].click();
    await until(() => rows(host).length === 4);
    expect((state.parentElement as HTMLElement).hidden).toBe(true);
    expect(preferences.get('filters:backlog:list')).toEqual(['state']);
  });

  it('names a filter by its own name where the page gives one, on its button, its list and the gear’s', async () => {
    const host = await mount({}, { ...backlog, layout: { ...backlog.layout, filterLabels: { area: 'Where' } } as Page['layout'] });
    const area = host.querySelector('.fd-filter-pick[data-field="area"]') as HTMLButtonElement;
    expect(area.textContent).toBe('Where');
    expect(host.querySelector(`#${area.getAttribute('aria-controls')}`)?.getAttribute('aria-label')).toBe('Filter by Where');
    expect(host.querySelector('.fd-filter-pick[data-field="state"]')?.textContent).toBe('State');
  });

  it('speaks German, French and Arabic', async () => {
    for (const [locale, words] of [['de', 'Nach Stichwort filtern'], ['fr', 'Filtrer par mot-clé'], ['ar', 'تصفية بكلمة']] as const) {
      const host = await mount({ locale });
      expect((bar(host).querySelector('input') as HTMLInputElement).placeholder).toBe(words);
      handle?.destroy();
      document.body.replaceChildren();
    }
  });
});

describe('a row opened in a dialog', () => {
  it('has the list ask again once the app’s promise settles, and the focus back on its row', async () => {
    let close!: () => void;
    const opened: unknown[] = [];
    const dataSource = source();
    const host = document.createElement('div');
    document.body.append(host);
    handle = mountViewer(host, {
      page: backlog,
      dataSource,
      onOpenRecord: (id) => {
        opened.push(id);
        return new Promise<void>((done) => (close = done));
      },
    });
    await until(() => rows(host).length);
    const row = rows(host)[3];
    row.focus();
    key(row, 'Enter');
    expect(opened).toEqual([2]);
    // The record changed in its dialog meanwhile.
    dataSource.records['work.item']['2'] = { ...dataSource.records['work.item']['2'], title: 'Cancel stage keeps the download' };
    (document.activeElement as HTMLElement).blur();
    close();
    await until(() => rows(host)[3]?.textContent?.includes('keeps'));
    await until(() => document.activeElement?.classList.contains('fd-list-row'));
    expect((document.activeElement as HTMLElement).dataset['id']).toBe('2');
  });

  it('marks the row of the record open while it is, and opens one the app asks for as a press on its row would', async () => {
    let close!: () => void;
    const opened: unknown[] = [];
    const host = document.createElement('div');
    document.body.append(host);
    handle = mountViewer(host, {
      page: backlog,
      dataSource: source(),
      onOpenRecord: (id) => {
        opened.push(id);
        return new Promise<void>((done) => (close = done));
      },
    });
    // Asked before the rows are there, as an address read at load: its row comes marked.
    const done = handle.openRecord(2);
    expect(opened).toEqual([2]);
    await until(() => rows(host).length);
    const marked = () => rows(host).filter((tr) => tr.getAttribute('aria-current') === 'true').map((tr) => tr.dataset['id']);
    expect(marked()).toEqual(['2']);
    close();
    await done;
    expect(marked()).toEqual([]);
    expect((document.activeElement as HTMLElement).dataset['id']).toBe('2');
    // A press on a row marks it too, until it closes.
    rows(host)[0].click();
    expect(marked()).toEqual(['1']);
    close();
    await until(() => marked().length === 0);
    // Opened from the address with no row pressed ({ lit: false }): no row marked, the records again and its row's focus after.
    rows(host)[0].focus();
    const unlit = handle.openRecord(2, { lit: false });
    expect(opened).toEqual([2, 1, 2]);
    expect(marked()).toEqual([]);
    close();
    await unlit;
    expect(marked()).toEqual([]);
    expect((document.activeElement as HTMLElement).dataset['id']).toBe('2');
  });

  it('can be asked to load again by the app, keeping its search', async () => {
    const dataSource = source();
    const host = document.createElement('div');
    document.body.append(host);
    handle = mountViewer(host, { page: backlog, dataSource });
    await until(() => rows(host).length);
    dataSource.records['work.item']['9'] = { number: 207, work_type: 'bug', title: 'A new bug', state: 'new', parent_id: null, tags: [] };
    await handle.reload();
    expect(rows(host)).toHaveLength(5);
  });
});
