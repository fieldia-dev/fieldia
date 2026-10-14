import { createMemoryDataSource, type Page } from '@fieldia/core';
import type { PartFailure, WidgetFactory } from '@fieldia/widgets';
import type { MapPartFactory } from './map-part';
import { pageDialogs } from './related';
import { mountViewer, type ViewerHandle, type ViewerOptions } from './viewer';

/**
 * Errors kept to the part that made them: a field's widget, a slot, a map or a saved form's part that throws as it is
 * drawn or brought up to date draws a small box in its place, which names it; the error goes to the console and to
 * the viewer's onError; and the rest of the form keeps working, saving included.
 */

const page = (...extra: Record<string, unknown>[]): Page =>
  ({
    fieldia: '0.1',
    id: 'order',
    title: 'Order',
    data: { kind: 'record', model: 'order' },
    fields: {
      name: { type: 'char', label: 'Customer', required: true },
      price: { type: 'float', label: 'Price' },
      notes: { type: 'char', label: 'Notes' },
      lat: { type: 'float', label: 'Latitude' },
      lng: { type: 'float', label: 'Longitude' },
    },
    layout: {
      type: 'sections',
      id: 'root',
      children: [
        {
          type: 'section',
          id: 'main',
          title: 'Order',
          children: [{ type: 'field', id: 'n-name', field: 'name' }, { type: 'field', id: 'n-price', field: 'price', widget: 'fancy', colspan: 2 }, { type: 'field', id: 'n-notes', field: 'notes' }, ...extra],
        },
      ],
    },
  }) as unknown as Page;

const boom = new Error('it fell over');
/** The app's own widget for a price: it throws as it is drawn, or as it is shown a price of 13. */
const fancy = (when: 'draw' | 'update'): Record<string, WidgetFactory> => ({
  'float.fancy': ({ document: doc, id }) => {
    if (when === 'draw') throw boom;
    const input = doc.createElement('input');
    input.id = id;
    input.className = 'fd-input';
    return {
      element: input,
      update(state) {
        if (state.value === 13) throw boom;
        input.value = String(state.value ?? '');
      },
      focus: () => input.focus(),
    };
  },
});

let handle: ViewerHandle | null = null;
let consoleError: jest.SpyInstance;
beforeEach(() => {
  consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
  consoleError.mockRestore();
});

function mount(options: Partial<ViewerOptions> & { page?: Page } = {}) {
  const host = document.createElement('div');
  document.body.append(host);
  const dataSource = options.dataSource ?? createMemoryDataSource();
  handle = mountViewer(host, { page: page(), dataSource, ...options });
  return { host, handle, form: handle.form, dataSource };
}

const at = (host: Element, node: string) => host.querySelector(`[data-node="${node}"]`) as HTMLElement;
const box = (host: Element, node: string) => at(host, node)?.querySelector('.fd-broken') ?? (at(host, node)?.matches('.fd-broken') ? at(host, node) : null);
function type(input: HTMLInputElement, text: string) {
  input.focus();
  input.value = text;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe("a field's widget that throws", () => {
  it('as it is drawn: a box names the field in its place, under its label; the rest is drawn and works', async () => {
    const onError = jest.fn<void, [unknown, PartFailure]>();
    const { host, form, dataSource } = mount({ widgets: fancy('draw'), onError });
    expect(box(host, 'n-price')?.textContent).toBe('This field could not be shown: Price');
    expect(at(host, 'n-price').querySelector('.fd-label')?.textContent).toBe('Price');
    // Told once, with where; and to the console.
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(boom, { stage: 'draw', part: 'field', field: 'price', node: 'n-price', widget: 'float.fancy' });
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('"price"'), boom);
    // The fields round it work, and the record saves.
    type(at(host, 'n-name').querySelector('input') as HTMLInputElement, 'Mona');
    type(at(host, 'n-notes').querySelector('input') as HTMLInputElement, 'By noon');
    expect(form.getState().values['notes']).toBe('By noon');
    expect(await handle?.save()).toBe(true);
    const saved = await dataSource.list?.({ model: 'order', fields: ['name', 'notes'], filter: [], limit: 10, offset: 0, sort: [] } as never);
    expect(saved?.records[0]?.values).toMatchObject({ name: 'Mona', notes: 'By noon' });
  });

  it('as it is brought up to date: the box takes its place, and the fields after it still follow the record', async () => {
    const onError = jest.fn<void, [unknown, PartFailure]>();
    const { host, form } = mount({ widgets: fancy('update'), onError });
    form.setValues({ price: 12, notes: 'first' });
    expect((at(host, 'n-price').querySelector('input') as HTMLInputElement).value).toBe('12');
    form.setValues({ price: 13, notes: 'second' });
    expect(at(host, 'n-price').querySelector('input')).toBeNull();
    expect(box(host, 'n-price')?.textContent).toBe('This field could not be shown: Price');
    // A part drawn after it in the page is still brought up to date.
    expect((at(host, 'n-notes').querySelector('input') as HTMLInputElement).value).toBe('second');
    form.setValues({ price: 14, notes: 'third' });
    expect((at(host, 'n-notes').querySelector('input') as HTMLInputElement).value).toBe('third');
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][1]).toMatchObject({ stage: 'update', part: 'field', field: 'price' });
    type(at(host, 'n-name').querySelector('input') as HTMLInputElement, 'Mona');
    expect(await handle?.save()).toBe(true);
  });

  it('a refused save still takes the focus to its problem, past the box', async () => {
    const { host } = mount({ widgets: fancy('draw') });
    expect(await handle?.save()).toBe(false);
    expect(document.activeElement).toBe(at(host, 'n-name').querySelector('input'));
  });

  it("in a dialog a link opens: the dialog's viewer tells the page's onError too", async () => {
    const onError = jest.fn();
    const options = { page: page(), widgets: fancy('draw'), onError, relatedPages: { order: page() } } as ViewerOptions;
    const opened = pageDialogs(options).openRecord('order', { title: 'New order' });
    await new Promise((resolve) => setTimeout(resolve, 0));
    const dialog = document.querySelector('.fd-form-dialog') as HTMLElement;
    expect(dialog.querySelector('.fd-broken')?.textContent).toBe('This field could not be shown: Price');
    expect(onError).toHaveBeenCalledWith(boom, expect.objectContaining({ field: 'price' }));
    (dialog.ownerDocument.activeElement as HTMLElement | null)?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    void opened;
  });
});

describe('a slot that throws', () => {
  const slot = { type: 'slot', id: 'n-feed', name: 'feed' };

  it('as the app fills it: the box is in the slot, said as a part; the form goes on', () => {
    const onError = jest.fn<void, [unknown, PartFailure]>();
    const { host, form } = mount({
      page: page(slot),
      onError,
      slots: {
        feed: () => {
          throw boom;
        },
      },
    });
    const feed = at(host, 'n-feed');
    expect(feed.classList.contains('fd-slot')).toBe(true);
    expect(feed.querySelector('.fd-broken')?.textContent).toBe('This part could not be shown');
    expect(onError).toHaveBeenCalledWith(boom, { stage: 'draw', part: 'slot', name: 'feed', node: 'n-feed' });
    type(at(host, 'n-notes').querySelector('input') as HTMLInputElement, 'ok');
    expect(form.getState().values['notes']).toBe('ok');
  });

  it('as it is cleaned up: told, and the rest of the page is still taken down', () => {
    const onError = jest.fn<void, [unknown, PartFailure]>();
    const { host } = mount({
      page: page(slot),
      onError,
      slots: {
        feed: () => () => {
          throw boom;
        },
      },
    });
    expect(() => handle?.destroy()).not.toThrow();
    handle = null;
    expect(host.querySelector('.fd-form')).toBeNull();
    expect(onError).toHaveBeenCalledWith(boom, expect.objectContaining({ stage: 'remove' }));
  });
});

describe('a map that throws', () => {
  const map = { type: 'map', id: 'n-map', label: 'Where it is', layers: [{ id: 'spot', latitude: 'lat', longitude: 'lng' }], colspan: 2 };

  it('as it is drawn: a box names it, as wide as the map would have been', () => {
    const onError = jest.fn<void, [unknown, PartFailure]>();
    const maps: MapPartFactory = () => {
      throw boom;
    };
    const { host } = mount({ page: page(map), maps, onError });
    const shown = at(host, 'n-map');
    expect(shown.matches('.fd-broken')).toBe(true);
    expect(shown.textContent).toBe('This part could not be shown: Where it is');
    expect(shown.style.getPropertyValue('--fd-span')).toBe('2');
    expect(onError).toHaveBeenCalledWith(boom, { stage: 'draw', part: 'map', node: 'n-map' });
  });

  it('as it is brought up to date: the box takes its place, and follows its part\'s condition', () => {
    const onError = jest.fn();
    const maps: MapPartFactory = ({ document: doc }) => ({
      element: doc.createElement('div'),
      update(state) {
        if (state.values['lat'] === 13) throw boom;
      },
    });
    const { host, form } = mount({ page: page({ ...map, invisible: "notes == 'hide'" }), maps, onError });
    form.setValues({ lat: 13 });
    const shown = at(host, 'n-map');
    expect(shown.matches('.fd-broken')).toBe(true);
    expect(shown.hidden).toBe(false);
    form.setValues({ notes: 'hide' });
    expect(at(host, 'n-map').hidden).toBe(true);
    expect(onError).toHaveBeenCalledTimes(1);
  });
});

describe('a saved form placed in the page', () => {
  it('whose own field\'s widget throws: boxed inside it, the outer form saves', async () => {
    const address = {
      fieldia: '0.1',
      id: 'address',
      title: 'Address',
      data: { kind: 'responses' },
      fields: { street: { type: 'char', label: 'Street' }, price: { type: 'float', label: 'Delivery price' } },
      layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'a-street', field: 'street' }, { type: 'field', id: 'a-price', field: 'price', widget: 'fancy' }] },
    } as unknown as Page;
    const onError = jest.fn();
    const outer = { ...page(), layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'n-name', field: 'name' }, { type: 'form', id: 'home', page: 'address', name: 'home' }] } } as unknown as Page;
    const { host } = mount({ page: outer, pages: { address }, widgets: fancy('draw'), onError });
    expect(box(host, 'a-price')?.textContent).toBe('This field could not be shown: Delivery price');
    type(at(host, 'a-street').querySelector('input') as HTMLInputElement, 'Nile St');
    type(at(host, 'n-name').querySelector('input') as HTMLInputElement, 'Mona');
    expect(await handle?.save()).toBe(true);
    expect(onError).toHaveBeenCalledWith(boom, expect.objectContaining({ field: 'price', node: 'a-price' }));
  });
});

describe('the onError hook', () => {
  it('that throws itself: told to the console, and the page is drawn', () => {
    const { host } = mount({
      widgets: fancy('draw'),
      onError: () => {
        throw new Error('the hook fell over');
      },
    });
    expect(box(host, 'n-price')).not.toBeNull();
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('onError'), expect.any(Error));
  });

  it('left out: the console alone is told', () => {
    const { host } = mount({ widgets: fancy('draw') });
    expect(box(host, 'n-price')).not.toBeNull();
    expect(consoleError).toHaveBeenCalledTimes(1);
  });
});
