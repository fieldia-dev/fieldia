import { createForm, type Field, type FieldNode, type Locale, type Page } from '@fieldia/core';
import { createWidget, type WidgetContext, type WidgetFactory, type WidgetState } from './widgets';
import type { PartFailure } from './contain';

/**
 * A widget that throws — the app's own, or one of Fieldia's given what it cannot draw — never takes the page with it:
 * a small box says which field could not be shown, the error goes to the console and to the page's onError, and the
 * widget's other calls (focus, removal) are kept from throwing too.
 */
function page(widget?: string): Page {
  return {
    fieldia: '0.1',
    id: 't',
    data: { kind: 'responses' },
    fields: { price: { type: 'float', label: 'Price' } as Field },
    layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'n-price', field: 'price', ...(widget ? { widget } : {}) }] },
  } as Page;
}

function setup(registry: Record<string, WidgetFactory>, more: Partial<WidgetContext> = {}, widget = 'fancy') {
  const shown = page(widget);
  const form = createForm({ page: shown });
  const node = (shown.layout as { children: FieldNode[] }).children[0];
  const made = createWidget({ form, name: 'price', field: shown.fields['price'], node, id: 'fd-price', document, ...more }, registry);
  const host = document.createElement('div');
  host.append(made.element);
  document.body.replaceChildren(host);
  return { form, widget: made, host };
}

const state = (value: unknown): WidgetState => ({ value: value as WidgetState['value'], values: { price: value as number }, readonly: false, required: false, invalid: false });
const boom = new Error('the widget fell over');

let consoleError: jest.SpyInstance;
beforeEach(() => {
  consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => consoleError.mockRestore());

describe('a widget that throws as it is drawn', () => {
  const throwing: Record<string, WidgetFactory> = {
    'float.fancy': () => {
      throw boom;
    },
  };

  it('draws a small box in its place that names the field', () => {
    const { widget, host } = setup(throwing);
    const box = host.querySelector('.fd-broken') as HTMLElement;
    expect(box).not.toBeNull();
    expect(widget.element).toBe(box);
    expect(box.textContent).toBe('This field could not be shown: Price');
    // Said to a screen reader as it appears, as a status, never as an alarm.
    expect(box.getAttribute('role')).toBe('status');
    expect(box.querySelector('svg, .fd-broken-mark')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('says it in the page\'s language', () => {
    for (const [locale, words] of [
      ['ar', 'تعذّر عرض هذا الحقل: Price'],
      ['fr', 'Ce champ n’a pas pu être affiché : Price'],
      ['de', 'Dieses Feld konnte nicht angezeigt werden: Price'],
    ] as [Locale, string][]) {
      expect(setup(throwing, { locale }).widget.element.textContent).toBe(words);
    }
  });

  it('tells the console, and the page\'s onError where it was', () => {
    const onError = jest.fn<void, [unknown, PartFailure]>();
    setup(throwing, { onError });
    expect(onError).toHaveBeenCalledWith(boom, { stage: 'draw', part: 'field', field: 'price', node: 'n-price', widget: 'float.fancy' });
    // The viewer's onError tells the console itself: it is not told twice.
    expect(consoleError).not.toHaveBeenCalled();
    setup(throwing);
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('"price"'), boom);
  });

  it('takes updates, the focus and its removal quietly', () => {
    const { widget } = setup(throwing);
    expect(() => widget.update(state(3))).not.toThrow();
    expect(() => widget.focus()).not.toThrow();
    expect(() => widget.destroy?.()).not.toThrow();
  });
});

describe('a widget that throws later', () => {
  const touchy = (calls: { focus?: boolean; destroy?: boolean } = {}): Record<string, WidgetFactory> => ({
    'float.fancy': ({ document: doc }) => {
      const input = doc.createElement('input');
      input.className = 'fd-input';
      return {
        element: input,
        update(next) {
          if (next.value === 13) throw boom;
          input.value = String(next.value ?? '');
        },
        focus() {
          if (calls.focus) throw boom;
          input.focus();
        },
        destroy() {
          if (calls.destroy) throw boom;
        },
      };
    },
  });

  it('as it is brought up to date: the box takes its place, once, and it is left alone after', () => {
    const onError = jest.fn();
    const { widget, host } = setup(touchy(), { onError });
    widget.update(state(12));
    expect((host.querySelector('input') as HTMLInputElement).value).toBe('12');
    expect(() => widget.update(state(13))).not.toThrow();
    expect(host.querySelector('input')).toBeNull();
    expect(host.querySelector('.fd-broken')?.textContent).toBe('This field could not be shown: Price');
    expect(widget.element).toBe(host.querySelector('.fd-broken'));
    expect(onError).toHaveBeenCalledWith(boom, expect.objectContaining({ stage: 'update', field: 'price' }));
    widget.update(state(13));
    widget.update(state(14));
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('before it is placed: whoever places it later places the box', () => {
    const shown = page('fancy');
    const form = createForm({ page: shown });
    const made = createWidget({ form, name: 'price', field: shown.fields['price'], node: (shown.layout as { children: FieldNode[] }).children[0], id: 'fd-price', document }, touchy());
    made.update(state(13));
    expect(made.element.classList.contains('fd-broken')).toBe(true);
  });

  it('as it takes the focus, or is taken away: said, never thrown', () => {
    const onError = jest.fn();
    const { widget } = setup(touchy({ focus: true, destroy: true }), { onError });
    expect(() => widget.focus()).not.toThrow();
    expect(() => widget.destroy?.()).not.toThrow();
    expect(onError.mock.calls.map(([, where]) => where.stage)).toEqual(['focus', 'remove']);
  });

  it('an onError that throws itself is told to the console, and the page goes on', () => {
    const { widget } = setup(touchy(), {
      onError: () => {
        throw new Error('the hook fell over too');
      },
    });
    expect(() => widget.update(state(13))).not.toThrow();
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('onError'), expect.any(Error));
  });
});

describe('a widget that learns of its own failure later', () => {
  it('says so through fail: its box takes its place, as for one that throws', () => {
    let fail: ((error: unknown) => void) | undefined;
    const onError = jest.fn();
    const { widget, host } = setup(
      {
        'float.fancy': (context) => {
          fail = context.fail;
          return { element: document.createElement('div'), update: () => undefined, focus: () => undefined };
        },
      },
      { onError }
    );
    expect(host.querySelector('.fd-broken')).toBeNull();
    fail?.(boom);
    expect(host.querySelector('.fd-broken')?.textContent).toBe('This field could not be shown: Price');
    expect(widget.element).toBe(host.querySelector('.fd-broken'));
    expect(onError).toHaveBeenCalledWith(boom, expect.objectContaining({ stage: 'update', field: 'price' }));
  });

  it('says so while it is being made: it is made wrong', () => {
    const onError = jest.fn();
    const { widget } = setup(
      {
        'float.fancy': (context) => {
          context.fail?.(boom);
          return { element: document.createElement('div'), update: () => undefined, focus: () => undefined };
        },
      },
      { onError }
    );
    expect(widget.element.classList.contains('fd-broken')).toBe(true);
    expect(onError).toHaveBeenCalledWith(boom, expect.objectContaining({ stage: 'draw' }));
  });
});

describe('widgets that draw fields of their own', () => {
  it('a table\'s cell drawn by a widget that throws is boxed in its cell, and the table stands', () => {
    const shown = {
      fieldia: '0.1',
      id: 't',
      data: { kind: 'responses' },
      fields: {
        lines: { type: 'one2many', label: 'Lines', fields: { name: { type: 'char', label: 'Name' }, qty: { type: 'float', label: 'Quantity' } } } as unknown as Field,
      },
      layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'n-lines', field: 'lines', cells: { qty: { widget: 'fancy' } } }] },
    } as unknown as Page;
    const form = createForm({ page: shown });
    form.setValue('lines', [{ key: 'a', values: { name: 'Tea', qty: 2 } }]);
    const onError = jest.fn();
    const registry: Record<string, WidgetFactory> = {
      'float.fancy': () => {
        throw boom;
      },
    };
    const table = createWidget({ form, name: 'lines', field: shown.fields['lines'], node: (shown.layout as { children: FieldNode[] }).children[0], id: 'fd-lines', document, onError }, registry);
    document.body.replaceChildren(table.element);
    table.update({ value: form.getState().values['lines'], values: form.getState().values, readonly: false, required: false, invalid: false });
    const cell = document.querySelector('td[data-column="qty"]') as HTMLElement;
    expect(cell.querySelector('.fd-broken')?.textContent).toBe('This field could not be shown: Quantity');
    expect((document.querySelector('td[data-column="name"] input') as HTMLInputElement).value).toBe('Tea');
    expect(onError).toHaveBeenCalledWith(boom, expect.objectContaining({ stage: 'draw', field: 'qty' }));
  });
});

describe('a widget that works', () => {
  it('is handed back as it was made: its element, its tools, its calls', () => {
    const tools = [document.createElement('button')];
    const update = jest.fn();
    const element = document.createElement('input');
    const { widget } = setup({ 'float.fancy': () => ({ element, update, focus: () => element.focus(), tools }) });
    expect(widget.element).toBe(element);
    expect(widget.tools).toBe(tools);
    widget.update(state(1));
    expect(update).toHaveBeenCalledTimes(1);
  });
});
