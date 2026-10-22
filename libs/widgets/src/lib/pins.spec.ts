import { createForm, type Field, type FieldNode, type Page } from '@fieldia/core';
import { createWidget } from './widgets';
import { WIDGET_LABELS } from './labels';
import { pinAt, pinsOf } from './pins';

/**
 * Pins with notes on a picture, as a person meets them: a click on the picture puts a pin there and goes to its note;
 * the keyboard moves a cross over the picture and Enter puts a pin under it; on a pin, the arrow keys move it, Delete
 * takes it away, Enter goes to its note; a pin dragged is kept where it is let go, Escape putting it back. Each pin is
 * named by its number, where it is in words and its note; the pins are a numbered list under the picture. The value
 * holds where each is as shares of the picture's width and height, an app's own keys kept. Read-only, nothing moves.
 */

const FACE = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 480"/%3E';

function setup(options: Record<string, unknown>, more: { readonly?: boolean; value?: unknown; values?: Record<string, unknown> } = {}) {
  const page = {
    fieldia: '0.1',
    id: 't',
    data: { kind: 'responses' },
    fields: { x: { type: 'json', label: 'Injection points' } as Field, plan: { type: 'image', label: 'Floor plan' } as Field },
    layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'n', field: 'x', widget: 'pins', options }] },
  } as Page;
  const form = createForm({ page, values: { ...(more.value !== undefined ? { x: more.value } : {}), ...(more.values ?? {}) } as never });
  const widget = createWidget({ form, name: 'x', field: page.fields['x'], node: (page.layout as { children: FieldNode[] }).children[0], id: 'fd-x', document, labels: WIDGET_LABELS.en });
  const root = document.createElement('div');
  root.className = 'fd-form';
  root.append(widget.element);
  document.body.replaceChildren(root);
  const refresh = () => widget.update({ value: form.getState().values['x'], values: form.getState().values, readonly: more.readonly ?? false, required: false, invalid: false });
  form.subscribe(refresh);
  refresh();
  const el = widget.element;
  const image = el.querySelector('.fd-pins-image') as HTMLImageElement;
  // jsdom lays nothing out: the picture as drawn, 400 by 480 at the page's top left, and loaded.
  image.getBoundingClientRect = () => ({ left: 0, top: 0, width: 400, height: 480, right: 400, bottom: 480, x: 0, y: 0, toJSON: () => ({}) });
  Object.defineProperties(image, { complete: { value: true }, naturalWidth: { value: 400 } });
  return { form, el, widget, stage: el.querySelector('.fd-pins-stage') as HTMLElement, value: () => form.getState().values['x'] as { x: number; y: number; note?: string }[] };
}
const key = (target: Element, name: string, shift = false) => target.dispatchEvent(new KeyboardEvent('keydown', { key: name, shiftKey: shift, bubbles: true }));
const click = (target: Element, x: number, y: number) => target.dispatchEvent(new MouseEvent('click', { clientX: x, clientY: y, bubbles: true }));
const pointer = (target: Element, type: string, x: number, y: number) => {
  const event = new MouseEvent(type, { clientX: x, clientY: y, bubbles: true, button: 0 });
  Object.defineProperty(event, 'pointerId', { value: 1 });
  target.dispatchEvent(event);
};
const pins = (el: Element) => [...el.querySelectorAll<HTMLButtonElement>('.fd-pin')];
const said = (el: Element) => el.querySelector('.fd-announce')?.textContent;

describe('pins on a picture', () => {
  it('draws the picture with its words, and each pin where the value says, named by its number, its place and its note', () => {
    const { el, stage } = setup({ image: FACE, alt: 'Face, from the front' }, { value: [{ x: 0.3, y: 0.4, note: 'Botox, 4 units', product: 'B-17' }, { x: 0.8, y: 0.9 }, { x: 2, y: 0 }, 'nothing'] });
    expect([stage.getAttribute('role'), stage.getAttribute('aria-label'), stage.getAttribute('tabindex')]).toEqual(['group', 'Face, from the front: put pins on it', '0']);
    expect(document.getElementById(stage.getAttribute('aria-describedby') as string)?.textContent).toMatch(/^Click the picture to add a pin/);
    expect((el.querySelector('.fd-pins-image') as HTMLImageElement).getAttribute('alt')).toBe('Face, from the front');
    // A pin with no place on the picture is left out.
    expect(pins(el).map((pin) => [pin.textContent, pin.style.left, pin.style.top, pin.getAttribute('aria-label')])).toEqual([
      ['1', '30%', '40%', 'Pin 1, left, 30% across, 40% down: Botox, 4 units'],
      ['2', '80%', '90%', 'Pin 2, bottom right, 80% across, 90% down'],
    ]);
    // The list under it: each pin's number, its place, its note's box and Remove.
    const rows = [...el.querySelectorAll('.fd-pins-list li')];
    expect(rows.map((row) => [row.querySelector('.fd-pin-at')?.textContent, (row.querySelector('.fd-pin-note') as HTMLInputElement).value, row.querySelector('.fd-pin-note')?.getAttribute('aria-label'), row.querySelector('.fd-pin-remove')?.getAttribute('aria-label')])).toEqual([
      ['left, 30% across, 40% down', 'Botox, 4 units', 'Note for pin 1', 'Remove pin 1'],
      ['bottom right, 80% across, 90% down', '', 'Note for pin 2', 'Remove pin 2'],
    ]);
  });

  it('puts a pin where the picture is clicked, its note focused, and keeps the note as it is typed', () => {
    const { el, stage, value } = setup({ image: FACE });
    expect(el.querySelector('.fd-pins-none')?.hasAttribute('hidden')).toBe(false);
    click(stage.querySelector('.fd-pins-image') as Element, 100, 120);
    expect(value()).toEqual([{ x: 0.25, y: 0.25 }]);
    expect(said(el)).toBe('Pin 1 added: top left, 25% across, 25% down.');
    const note = el.querySelector('.fd-pin-note') as HTMLInputElement;
    expect(document.activeElement).toBe(note);
    note.value = 'Filler, 0.5 ml';
    note.dispatchEvent(new Event('input', { bubbles: true }));
    expect(value()).toEqual([{ x: 0.25, y: 0.25, note: 'Filler, 0.5 ml' }]);
    expect(pins(el)[0].getAttribute('aria-label')).toBe('Pin 1, top left, 25% across, 25% down: Filler, 0.5 ml');
    // Typed on, the box keeps what is in it and where the caret is: it is never drawn again under the keys.
    expect(document.activeElement).toBe(note);
  });

  it('puts a pin by the keyboard: the arrows move the cross, Shift further, Enter puts a pin under it', () => {
    const { el, stage, value } = setup({ image: FACE });
    stage.focus();
    key(stage, 'ArrowRight', true);
    key(stage, 'ArrowUp');
    key(stage, 'ArrowUp');
    expect(stage.classList.contains('fd-pins-keyed')).toBe(true);
    const cross = el.querySelector('.fd-pins-cross') as HTMLElement;
    expect([cross.style.left, cross.style.top]).toEqual(['60%', '46%']);
    key(stage, 'Enter');
    expect(value()).toEqual([{ x: 0.6, y: 0.46 }]);
    expect(said(el)).toBe('Pin 1 added: centre, 60% across, 46% down.');
  });

  it('moves a pin by the arrows and takes it away with Delete, the next pin taking the focus', () => {
    const { el, value } = setup({ image: FACE }, { value: [{ x: 0.5, y: 0.5, note: 'a', id: 7 }, { x: 0.1, y: 0.1 }] });
    const first = pins(el)[0];
    first.focus();
    key(first, 'ArrowLeft');
    key(first, 'ArrowDown', true);
    // The app's own keys on a pin kept as it moves.
    expect(value()[0]).toEqual({ x: 0.48, y: 0.6, note: 'a', id: 7 });
    expect(said(el)).toBe('Pin 1 moved: centre, 48% across, 60% down.');
    expect(document.activeElement).toBe(pins(el)[0]);
    key(pins(el)[0], 'Delete');
    expect(value()).toEqual([{ x: 0.1, y: 0.1 }]);
    expect(said(el)).toBe('Pin 1 removed.');
    expect(pins(el).map((pin) => pin.textContent)).toEqual(['1']);
    expect(document.activeElement).toBe(pins(el)[0]);
    (el.querySelector('.fd-pin-remove') as HTMLButtonElement).click();
    expect(value()).toEqual([]);
    expect(el.querySelector('.fd-pins-list li')).toBeNull();
  });

  it('keeps a dragged pin where it is let go, puts it back on Escape, and goes to its note for a press that does not move', () => {
    const { el, stage, value } = setup({ image: FACE }, { value: [{ x: 0.5, y: 0.5 }] });
    const pin = pins(el)[0];
    pointer(pin, 'pointerdown', 200, 240);
    pointer(stage, 'pointermove', 300, 360);
    expect(pin.style.left).toBe('75%');
    pointer(stage, 'pointerup', 300, 360);
    expect(value()).toEqual([{ x: 0.75, y: 0.75 }]);
    pointer(pins(el)[0], 'pointerdown', 300, 360);
    pointer(stage, 'pointermove', 40, 48);
    key(stage, 'Escape');
    expect(pins(el)[0].style.left).toBe('75%');
    expect(value()).toEqual([{ x: 0.75, y: 0.75 }]);
    pointer(pins(el)[0], 'pointerdown', 300, 360);
    pointer(stage, 'pointerup', 301, 360);
    expect(document.activeElement).toBe(el.querySelector('.fd-pin-note'));
  });

  it('takes no more pins than it may, saying so', () => {
    const { el, stage, value } = setup({ image: FACE, maxPins: 1 }, { value: [{ x: 0.5, y: 0.5 }] });
    click(stage.querySelector('.fd-pins-image') as Element, 10, 10);
    expect(value()).toHaveLength(1);
    expect(said(el)).toBe('No more pins: 1 at most.');
  });

  it('places pins on a field’s picture, and says when there is none', () => {
    const { el, form } = setup({ imageField: 'plan' });
    expect((el.querySelector('.fd-pins-stage') as HTMLElement).hidden).toBe(true);
    expect((el.querySelector('.fd-pins-missing') as HTMLElement).textContent).toBe('No picture to put pins on yet.');
    form.setValue('plan', { name: 'plan.svg', type: 'image/svg+xml', size: 4, url: 'https://files.example/plan.svg' });
    expect(el.querySelector('.fd-pins-image')?.getAttribute('src')).toBe('https://files.example/plan.svg');
    expect((el.querySelector('.fd-pins-stage') as HTMLElement).hidden).toBe(false);
  });

  it('read-only, shows the pins and their notes, and nothing moves', () => {
    const { el, stage, value } = setup({ image: FACE }, { readonly: true, value: [{ x: 0.5, y: 0.5, note: 'Botox' }] });
    expect(stage.hasAttribute('tabindex')).toBe(false);
    click(stage.querySelector('.fd-pins-image') as Element, 10, 10);
    key(pins(el)[0], 'ArrowLeft');
    expect(value()).toEqual([{ x: 0.5, y: 0.5, note: 'Botox' }]);
    expect((el.querySelector('.fd-pin-note') as HTMLElement).hidden).toBe(true);
    expect(el.querySelector('.fd-pin-note-words')?.textContent).toBe('Botox');
    expect((el.querySelector('.fd-pin-remove') as HTMLElement).hidden).toBe(true);
  });

  it('names the ninth of the picture a pin is in, and reads only pins with a place', () => {
    const at = (x: number, y: number) => pinAt({ x, y }, WIDGET_LABELS.en);
    expect([at(0.1, 0.1), at(0.5, 0.1), at(0.9, 0.5), at(0.2, 0.95)]).toEqual(['top left, 10% across, 10% down', 'top, 50% across, 10% down', 'right, 90% across, 50% down', 'bottom left, 20% across, 95% down']);
    expect(pinsOf([{ x: 0, y: 1 }, { x: -0.1, y: 0.5 }, { x: '0.5', y: 0.5 }, null])).toEqual([{ x: 0, y: 1 }]);
    expect(pinsOf({ x: 0.5, y: 0.5 })).toEqual([]);
  });
});
