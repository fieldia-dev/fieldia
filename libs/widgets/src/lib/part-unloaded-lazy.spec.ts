import { createForm, createMemoryDataSource, type Field, type Page } from '@fieldia/core';
import { lazyPart, type Part } from './parts';
import { partWidget } from './widget-parts';
import type { Widget, WidgetContext, WidgetFactory } from './widgets';

/**
 * A field's widget whose part could not come (partWidget; the audits' R-H1, the part-failure matrix): the plain widget
 * stays, and works — never an empty box — and the field is told (`WidgetContext.unloaded`), with a way to ask for the
 * part again: as it then comes, its widget takes the plain one's place, what was typed in the plain one with it; where it
 * cannot come again, the field is told again. This file starts with no part loaded.
 */

const fields: Record<string, Field> = { n: { type: 'char', label: 'Code' } };
const page = { fieldia: '0.1', id: 'p', data: { kind: 'responses' }, fields, layout: { type: 'sections', id: 's', children: [] } } as unknown as Page;

/** Keys typed where the focus is: each lands, then an input says so. */
function type(box: HTMLInputElement, text: string) {
  for (const char of text) {
    const start = box.selectionStart ?? box.value.length;
    box.setRangeText(char, start, box.selectionEnd ?? start, 'end');
    box.dispatchEvent(new InputEvent('input', { inputType: 'insertText', data: char, bubbles: true }));
  }
}
const settle = () => new Promise((done) => setTimeout(done, 0));

afterEach(() => document.body.replaceChildren());

/** A part that cannot come while `offline.now` holds; a plain box, and the part's own, which takes what was typed. */
function setUp(told?: (part: Part, retry: () => Promise<boolean>) => void) {
  const offline = { now: true };
  let asked = 0;
  const part = lazyPart('code', () => {
    asked++;
    return offline.now ? Promise.reject(new Error('offline')) : Promise.resolve({ real: true });
  });
  const form = createForm({ page, dataSource: createMemoryDataSource() });
  const plain: WidgetFactory = ({ document: doc }) => {
    const input = doc.createElement('input');
    input.className = 'plain';
    return { element: input, focus: () => input.focus(), update: () => undefined };
  };
  const real = (): Widget => {
    const input = document.createElement('input');
    input.className = 'real';
    return {
      element: input,
      focus: () => input.focus(),
      update: () => undefined,
      takeTyped: (typed) => {
        input.value = typed.text;
        input.focus();
        return true;
      },
    };
  };
  const context = { form, name: 'n', field: fields['n'], node: { type: 'field', id: 'f', field: 'n' }, id: 'w', document, ...(told ? { unloaded: told } : {}) } as WidgetContext;
  const widget = partWidget(part, context, real, plain);
  document.body.append(widget.element);
  return { offline, part, widget, asked: () => asked };
}

describe('a widget whose part could not come', () => {
  it('stays plain, and works; the field is told, with a way to ask again that brings the part in place, what was typed with it', async () => {
    const told: { part: Part; retry: () => Promise<boolean> }[] = [];
    const { offline, part, widget, asked } = setUp((one, retry) => void told.push({ part: one, retry }));
    await settle();
    expect(told.map((one) => one.part)).toEqual([part]);
    expect(widget.element.className).toBe('plain');
    // Typed in the plain box meanwhile.
    const plain = widget.element as HTMLInputElement;
    plain.focus();
    type(plain, 'AB-1');
    // Asked again while it still cannot come: told again, the plain box kept, its text with it.
    expect(await told[0].retry()).toBe(false);
    expect(told).toHaveLength(2);
    expect(widget.element).toBe(plain);
    expect(plain.value).toBe('AB-1');
    // It can come now: the part's widget in the plain one's place, the text as typed, the focus with it.
    offline.now = false;
    expect(await told[1].retry()).toBe(true);
    expect(widget.element.className).toBe('real');
    expect((widget.element as HTMLInputElement).value).toBe('AB-1');
    expect(document.activeElement).toBe(widget.element);
    expect(plain.isConnected).toBe(false);
    // Asked again once in: nothing more is asked of the network, nothing swapped twice.
    const before = asked();
    expect(await told[1].retry()).toBe(true);
    expect(asked()).toBe(before);
    expect(told).toHaveLength(2);
  });

  it('where nothing listens (an app that draws a widget itself), stays plain and throws nothing', async () => {
    const { widget } = setUp();
    await settle();
    expect(widget.element.className).toBe('plain');
  });

  it('taken away before its part could not come: nobody is told', async () => {
    const told: Part[] = [];
    const { widget } = setUp((one) => void told.push(one));
    widget.destroy?.();
    await settle();
    expect(told).toEqual([]);
  });
});
