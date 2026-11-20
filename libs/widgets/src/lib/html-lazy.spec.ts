import { createForm, createMemoryDataSource, type Field, type FieldNode, type Page } from '@fieldia/core';
import type { Widget, WidgetContext } from './widgets';

/**
 * The classic formatted text's toolbar comes in a part of its own (the html part: html-classic.ts). Before it comes —
 * a page that waits for no other part draws at once without it — its box is drawn alone: what it holds, cleaned, typed
 * in place; then the toolbar in the same place, what was typed kept. Where the part cannot come, the box stays and works,
 * its words still cleaned (no script ever runs from what it holds), and the field is told so, with a way to ask again.
 * This file starts with no part loaded; each case with fresh modules, the part failing as the test says.
 */

let mockFailing = 0;
jest.mock('./html-part', () => {
  if (mockFailing > 0) {
    mockFailing--;
    throw new Error('Loading chunk fieldia.html.js failed');
  }
  return jest.requireActual('./html-part');
});

beforeEach(() => {
  jest.resetModules();
  mockFailing = 0;
  document.body.replaceChildren();
});

const fields: Record<string, Field> = { notes: { type: 'html', label: 'Notes' } };
const page = { fieldia: '0.14', id: 'p', title: 'P', data: { kind: 'responses' }, fields, layout: { type: 'sections', id: 's', children: [] } } as unknown as Page;
const node: FieldNode = { type: 'field', id: 'n', field: 'notes' };
const state = (value: unknown) => ({ value: value as never, values: {}, readonly: false, required: false, invalid: false });

async function make(more: Partial<WidgetContext> = {}) {
  const { createWidget } = await import('./widgets');
  const { htmlPart } = await import('./widget-parts');
  const form = createForm({ page, dataSource: createMemoryDataSource() });
  const widget: Widget = createWidget({ form, name: 'notes', field: fields['notes'], node, id: 'w-n', document, ...more });
  const box = document.createElement('div');
  document.body.append(box);
  box.append(widget.element);
  return { widget, form, box, htmlPart };
}
const typeIn = (area: HTMLElement, html: string) => {
  area.innerHTML = html;
  area.dispatchEvent(new Event('input', { bubbles: true }));
};

describe('the classic formatted text, its toolbar in the html part', () => {
  it('before it came: its box alone, its words cleaned, typed in; then the toolbar in its place, what was typed kept', async () => {
    const { widget, form, box, htmlPart } = await make();
    expect(htmlPart.loaded).toBeUndefined();
    // The box, typed in, the toolbar's room held over it — nothing in it to press — and what holds script is cleaned as
    // it goes in.
    const area = box.querySelector('.fd-richtext[contenteditable="true"]') as HTMLElement;
    expect(area).not.toBeNull();
    const held = box.querySelector('.fd-richtext-bar') as HTMLElement;
    expect(held.getAttribute('aria-hidden')).toBe('true');
    expect(held.querySelectorAll('button, [aria-label="Bold"]')).toHaveLength(0);
    widget.update(state('<p>First <img src=x onerror="window.ran = 1"></p>'));
    expect(area.innerHTML).not.toContain('onerror');
    typeIn(area, '<p>Typed <b>here</b><script>window.ran = 1</script></p>');
    expect(form.getState().values['notes']).toBe('<p>Typed <b>here</b></p>');
    // Drawn again from the form, as the viewer draws a field once it changed.
    widget.update(state(form.getState().values['notes']));
    await htmlPart.load();
    await Promise.resolve();
    // The toolbar over the same words, in the same place.
    expect(box.children).toHaveLength(1);
    expect(box.querySelector('.fd-richtext-bar [aria-label="Bold"]')).not.toBeNull();
    expect(box.querySelector('.fd-richtext')?.innerHTML).toBe('<p>Typed <b>here</b></p>');
    expect((window as { ran?: number }).ran).toBeUndefined();
  });

  it('where it cannot come: the box stays and works, cleaned, and the field is told, with a way to ask again that brings it', async () => {
    mockFailing = 1;
    let again: (() => Promise<boolean>) | null = null;
    const { widget, form, box } = await make({ unloaded: (_part, retry) => void (again = retry) });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(again).not.toBeNull();
    typeIn(box.querySelector('.fd-richtext') as HTMLElement, '<p>Still <i>typed</i><img src=x onerror="window.ran = 1"></p>');
    expect(form.getState().values['notes']).toBe('<p>Still <i>typed</i></p>');
    widget.update(state(form.getState().values['notes']));
    // Shown plainly: no room held for tools that cannot come.
    expect(box.querySelector('.fd-richtext-bar')).toBeNull();
    expect(await (again as unknown as () => Promise<boolean>)()).toBe(true);
    expect(box.querySelector('.fd-richtext-bar')).not.toBeNull();
    expect(box.querySelector('.fd-richtext')?.textContent).toBe('Still typed');
  });

  it('holds the toolbar’s room as the toolbar is drawn: its bar, its text style’s box with its every style, a room for each tool', async () => {
    const { box, htmlPart } = await make();
    const held = box.querySelector('.fd-richtext-bar') as HTMLElement;
    // Each child by its look (its class: a tool's room is drawn as a tool is, 28 px each way) and the style box by its styles.
    const shape = (bar: Element) => [...bar.children].map((child) => `${child.className}${child.tagName === 'SELECT' ? `(${[...(child as HTMLSelectElement).options].map((o) => o.textContent).join('|')})` : ''}`);
    const before = shape(held);
    await htmlPart.load();
    await Promise.resolve();
    // The real toolbar, child by child: the same box of styles, as wide, and as many tools, each its room.
    expect(shape(box.querySelector('.fd-richtext-bar') as HTMLElement)).toEqual(before);
    expect(box.querySelector('.fd-richtext-bar [aria-label="Bold"]')).not.toBeNull();
  });

  it('a page that waits for it draws it whole: the part in, the toolbar at once', async () => {
    const { htmlPart } = await import('./widget-parts');
    await htmlPart.load();
    const { box } = await make();
    expect(box.querySelector('.fd-richtext-bar')).not.toBeNull();
  });
});
