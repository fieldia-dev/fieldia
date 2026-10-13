import type { ListNode, Locale, Page, RecordId, ResolvedFilter, Values } from '@fieldia/core';
import type { ListViewContext, ListViewFactory, ListViewPart } from './list';
import { customers, partners, until } from './test-list';
import { mountViewer, type ViewerHandle, type ViewerOptions } from './viewer';

/**
 * A list's switcher, open to other views: a package registers one by name
 * in `listViews`, as @fieldia/map registers its map, and the list offers it
 * beside its table — by the page option of its name, or as the view itself
 * says — in the view's own words, sharing the list's search and its chosen
 * records, and asking the app for a new record when the view makes one.
 */

let handle: ViewerHandle | null = null;
afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
});

/** A view that records what the list tells it, as a calendar or a board would. */
function fakeView(name: string, more: Partial<Pick<ListViewFactory, 'label' | 'offers' | 'opens'>> = {}) {
  const told: string[] = [];
  const contexts: ListViewContext[] = [];
  const factory = Object.assign((context: ListViewContext): ListViewPart => {
    contexts.push(context);
    const element = document.createElement('div');
    element.className = `fake-${name}`;
    element.textContent = `the ${name}`;
    return {
      element,
      reload: async () => void told.push('reload'),
      highlight: (id: RecordId | null) => void told.push(`highlight ${id}`),
      chosenChanged: () => void told.push('chosen'),
      shown: () => void told.push('shown'),
      destroy: () => void told.push('destroy'),
    };
  }, more) as ListViewFactory;
  return { factory, told, contexts };
}

async function mount(options: Partial<ViewerOptions> = {}, page: Page = customers) {
  const host = document.createElement('div');
  document.body.append(host);
  handle = mountViewer(host, { page, dataSource: partners(), ...options });
  await until(() => host.querySelector('.fd-list-table tbody tr'));
  return host;
}
const switcher = (host: Element) => host.querySelector('.fd-list-views') as HTMLElement;
const viewButtons = (host: Element) => [...switcher(host).querySelectorAll('button')].map((b) => b.textContent);
const press = (host: Element, words: string) => ([...switcher(host).querySelectorAll('button')].find((b) => b.textContent === words) as HTMLButtonElement).click();
const list = (host: Element) => host.querySelector('.fd-list') as HTMLElement;
const withCalendar = (calendar: ListNode['calendar'], more: Partial<ListNode> = {}): Page => ({
  ...customers,
  fields: { ...customers.fields, since: { type: 'date', label: 'Customer since' }, lat: { type: 'float', label: 'Latitude' }, lng: { type: 'float', label: 'Longitude' } },
  layout: { ...(customers.layout as ListNode), calendar, ...more },
});
const calendarLabel = (locale: Locale) => (locale === 'ar' ? 'التقويم' : 'Calendar');

describe("a list's other views", () => {
  it('offers a view by the page option of its name, in its own words, and shows it in place of the table', async () => {
    const calendar = fakeView('calendar', { label: calendarLabel });
    const host = await mount({ listViews: { calendar: calendar.factory } }, withCalendar({ start: 'since', title: 'name' }));
    expect(switcher(host).hidden).toBe(false);
    expect(switcher(host).getAttribute('role')).toBe('group');
    expect(viewButtons(host)).toEqual(['List', 'Calendar']);
    // Made the first time it is shown, not before: a list that is never seen as a calendar loads none.
    expect(calendar.contexts).toHaveLength(0);
    expect(list(host).dataset['view']).toBe('list');
    press(host, 'Calendar');
    expect(list(host).dataset['view']).toBe('calendar');
    expect(list(host).hasAttribute('data-alone')).toBe(true);
    const holder = host.querySelector('.fd-list-addon[data-addon="calendar"]') as HTMLElement;
    expect(holder.hasAttribute('data-on')).toBe(true);
    expect(holder.querySelector('.fake-calendar')).not.toBeNull();
    expect(calendar.told).toEqual(['reload', 'shown']);
    const pressed = () => [...switcher(host).querySelectorAll('button')].map((b) => b.getAttribute('aria-pressed'));
    expect(pressed()).toEqual(['false', 'true']);
    press(host, 'List');
    expect(list(host).dataset['view']).toBe('list');
    expect(list(host).hasAttribute('data-alone')).toBe(false);
    expect(holder.hasAttribute('data-on')).toBe(false);
    expect(pressed()).toEqual(['true', 'false']);
  });

  it('says its words in the page’s language', async () => {
    const calendar = fakeView('calendar', { label: calendarLabel });
    const host = await mount({ listViews: { calendar: calendar.factory }, locale: 'ar' }, withCalendar({ start: 'since', title: 'name' }));
    expect(viewButtons(host)).toEqual(['قائمة', 'التقويم']);
  });

  it('keeps a view to the lists that ask for it: no page option, no button, and no switcher with nothing to switch to', async () => {
    const calendar = fakeView('calendar', { label: calendarLabel });
    const host = await mount({ listViews: { calendar: calendar.factory } });
    expect(switcher(host).hidden).toBe(true);
    expect(host.querySelector('.fd-list-addon')).toBeNull();
  });

  it('takes a view of the app’s own that says which lists it is for', async () => {
    const board = fakeView('board', { label: () => 'Board', offers: (node) => node.columns.includes('state') });
    const host = await mount({ listViews: { board: board.factory } });
    expect(viewButtons(host)).toEqual(['List', 'Board']);
    press(host, 'Board');
    expect(list(host).dataset['view']).toBe('board');
    // Named by its key when it gives no words.
    const plain = fakeView('cards', { offers: () => true });
    handle?.destroy();
    document.body.replaceChildren();
    const other = await mount({ listViews: { cards: plain.factory } });
    expect(viewButtons(other)).toEqual(['List', 'cards']);
  });

  it('opens on the view when the page says so', async () => {
    const calendar = fakeView('calendar', { label: calendarLabel, opens: (node) => node.calendar?.opens === 'calendar' });
    const host = await mount({ listViews: { calendar: calendar.factory } }, withCalendar({ start: 'since', title: 'name', opens: 'calendar' }));
    expect(list(host).dataset['view']).toBe('calendar');
    expect(calendar.contexts).toHaveLength(1);
  });

  it('keeps the map as it was: List, Map, List and map, beside another view', async () => {
    const map = fakeView('map');
    const calendar = fakeView('calendar', { label: calendarLabel });
    const page = withCalendar({ start: 'since', title: 'name' }, { map: { latitude: 'lat', longitude: 'lng', view: 'both' } });
    const host = await mount({ listViews: { map: map.factory, calendar: calendar.factory } }, page);
    expect(viewButtons(host)).toEqual(['List', 'Map', 'List and map', 'Calendar']);
    expect(list(host).dataset['view']).toBe('both');
    expect(list(host).hasAttribute('data-alone')).toBe(false);
    expect(host.querySelector('.fd-list-map.fd-list-addon[data-addon="map"]')?.hasAttribute('data-on')).toBe(true);
    press(host, 'Map');
    expect(list(host).hasAttribute('data-alone')).toBe(true);
    press(host, 'Calendar');
    expect(host.querySelector('.fd-list-map')?.hasAttribute('data-on')).toBe(false);
    expect(host.querySelector('.fd-list-addon[data-addon="calendar"]')?.hasAttribute('data-on')).toBe(true);
  });

  it('shares the list’s search and its records chosen, and asks again when the search changes or a button acts', async () => {
    const calendar = fakeView('calendar', { label: calendarLabel });
    const host = await mount({ listViews: { calendar: calendar.factory } }, withCalendar({ start: 'since', title: 'name' }));
    press(host, 'Calendar');
    const context = calendar.contexts[0];
    expect(context.filter()).toEqual([]);
    calendar.told.length = 0;
    // A filter picked in the search bar: the calendar asks again, with it.
    (host.querySelector('.fd-search-toggle') as HTMLButtonElement).click();
    const active = host.querySelector('.fd-search-option[data-filter="active"]') as HTMLElement;
    active.click();
    await until(() => calendar.told.includes('reload'));
    expect(calendar.told).toContain('reload');
    expect(context.filter()).toEqual<ResolvedFilter[]>([{ field: 'state', op: '=', value: 'active' }]);
    // Chosen in the view: the table's box follows, and the list's buttons offer themselves.
    context.choose(1, true);
    expect(context.isChosen(1)).toBe(true);
    expect((host.querySelector('.fd-list-selection') as HTMLElement).hidden).toBe(false);
  });

  it('opens a record from the view as its row does, and asks the app for a new one with the values the view gives', async () => {
    const opened: RecordId[] = [];
    const made: Values[] = [];
    const calendar = fakeView('calendar', { label: calendarLabel });
    const host = await mount(
      { listViews: { calendar: calendar.factory }, onOpenRecord: (id) => void opened.push(id), onNewRecord: (values) => void made.push(values) },
      withCalendar({ start: 'since', title: 'name' })
    );
    press(host, 'Calendar');
    const context = calendar.contexts[0];
    await context.open?.(2);
    expect(opened).toEqual([2]);
    await context.create?.({ since: '2026-10-14' });
    expect(made).toEqual([{ since: '2026-10-14' }]);
  });

  it('makes a new record in the model’s own page, in a dialog, when the app gives a page and no way of its own', async () => {
    const calendar = fakeView('calendar', { label: calendarLabel });
    const record: Page = { fieldia: '0.1', id: 'partner-form', title: 'Customer', data: { kind: 'record', model: 'partner' }, fields: { name: { type: 'char', label: 'Name' }, since: { type: 'date', label: 'Customer since' } }, layout: { type: 'sections', id: 'p', children: [{ type: 'field', id: 'f-name', field: 'name' }, { type: 'field', id: 'f-since', field: 'since' }] } };
    const source = partners();
    const host = await mount({ dataSource: source, listViews: { calendar: calendar.factory }, pages: { partner: record } }, withCalendar({ start: 'since', title: 'name' }));
    press(host, 'Calendar');
    const context = calendar.contexts[0];
    expect(typeof context.create).toBe('function');
    calendar.told.length = 0;
    const making = context.create!({ since: '2026-10-14' });
    const dialog = () => document.querySelector('[role="dialog"]') as HTMLElement | null;
    await until(() => dialog()?.querySelector('[data-node="f-since"] input'));
    expect(dialog()?.querySelector<HTMLInputElement>('[data-node="f-since"] input')?.value).toBe('2026-10-14');
    const name = dialog()!.querySelector<HTMLInputElement>('[data-node="f-name"] input')!;
    name.value = 'Delta Labs';
    name.dispatchEvent(new Event('input', { bubbles: true }));
    const save = [...dialog()!.querySelectorAll<HTMLButtonElement>('.fd-form-dialog-foot button')].find((b) => b.textContent === 'Save & Close')!;
    save.click();
    await making;
    // Saved: the records again, the new one with them.
    expect(Object.values(source.records['partner']).find((values) => values['name'] === 'Delta Labs')?.['since']).toBe('2026-10-14');
    expect(calendar.told).toContain('reload');
  });

  it('gives the view no way to make a record when the app has none', async () => {
    const calendar = fakeView('calendar', { label: calendarLabel });
    const host = await mount({ listViews: { calendar: calendar.factory } }, withCalendar({ start: 'since', title: 'name' }));
    press(host, 'Calendar');
    expect(calendar.contexts[0].create).toBeUndefined();
  });
});
