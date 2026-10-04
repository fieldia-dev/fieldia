import { mountKind, typeInto } from './test-kinds';

/**
 * A signature: drawn on a pad with a mouse, a finger or a pen, or typed as a
 * name and shown as a signature; kept as a picture, the value a file upload has.
 */

/** jsdom draws nothing: a pen that remembers what it was asked to draw, and a picture of it to save. */
const strokes: string[] = [];
beforeEach(() => {
  strokes.length = 0;
  const pen = new Proxy(
    {},
    {
      get: (_, key: string) => (key === 'canvas' ? undefined : (...args: unknown[]) => strokes.push(`${key}(${args.join(',')})`)),
      set: () => true,
    }
  );
  jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => pen as never);
  jest.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockImplementation(() => 'data:image/png;base64,QUJDRA==');
  jest.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockImplementation(() => ({ left: 0, top: 0, width: 300, height: 90, right: 300, bottom: 90, x: 0, y: 0, toJSON: () => ({}) }));
});
afterEach(() => jest.restoreAllMocks());

const signature = () => mountKind({ type: 'binary', label: 'Signature' }, { widget: 'signature' });
/** jsdom has no PointerEvent: a mouse event of the pointer's type carries the same place and button. */
const pointer = (target: Element, type: string, x: number, y: number, button = 0) =>
  target.dispatchEvent(new MouseEvent(type, { clientX: x, clientY: y, button, bubbles: true, cancelable: true }));
const pad = (el: Element) => el.querySelector('canvas') as HTMLCanvasElement;
const typed = (el: Element) => el.querySelector('input.fd-signature-typed') as HTMLInputElement;
const clear = (el: Element) => el.querySelector('button.fd-signature-clear') as HTMLButtonElement;
const SIGNED = { name: 'signature.png', type: 'image/png', size: 4, data: 'QUJDRA==' };

describe('signature', () => {
  it('is a group the field’s label names: a pad, a box to type a name in, and Clear', () => {
    const { el } = signature();
    expect(el.id).toBe('fd-x');
    expect(el.getAttribute('role')).toBe('group');
    expect(pad(el).getAttribute('role')).toBe('img');
    expect(pad(el).getAttribute('aria-label')).toBe('Signature pad: draw your signature');
    expect(typed(el).getAttribute('aria-label')).toBe('Or type your name');
    expect(el.querySelector('.fd-signature-hint')?.textContent).toBe('Sign here');
    // Nothing to clear yet.
    expect(clear(el).hidden).toBe(true);
  });

  it('draws with the pointer, at the pad’s own scale, and keeps the drawing as a picture once the stroke ends', () => {
    const { el, value } = signature();
    pointer(pad(el), 'pointerdown', 30, 9);
    pointer(pad(el), 'pointermove', 150, 45);
    expect(value()).toBeNull();
    pointer(pad(el), 'pointerup', 150, 45);
    // The pad is 600 × 180 drawn at 300 × 90: twice the scale.
    expect(strokes).toEqual(expect.arrayContaining(['moveTo(60,18)', 'lineTo(300,90)']));
    expect(value()).toEqual(SIGNED);
    expect(el.querySelector<HTMLElement>('.fd-signature-hint')?.hidden).toBe(true);
    expect(clear(el).hidden).toBe(false);
  });

  it('keeps adding strokes to its own drawing, and draws nothing for another button or a move without a press', () => {
    const { el, value } = signature();
    pointer(pad(el), 'pointermove', 10, 10);
    pointer(pad(el), 'pointerdown', 10, 10, 2);
    pointer(pad(el), 'pointerup', 10, 10, 2);
    expect(strokes.filter((s) => s.startsWith('lineTo'))).toEqual([]);
    expect(value()).toBeNull();
    pointer(pad(el), 'pointerdown', 10, 10);
    pointer(pad(el), 'pointerup', 10, 10);
    pointer(pad(el), 'pointerdown', 20, 20);
    pointer(pad(el), 'pointerup', 20, 20);
    // Its own picture coming back from the form leaves the pad as it is, to draw on.
    expect((el.querySelector('img') as HTMLImageElement).hidden).toBe(true);
    expect(pad(el).hidden).toBe(false);
  });

  it('takes a typed name, drawn as a signature, for anyone without a pointer', () => {
    const { el, value } = signature();
    typeInto(typed(el), 'Sara Hassan');
    expect(strokes).toContain('fillText(Sara Hassan,300,90,560)');
    expect(value()).toEqual(SIGNED);
    typeInto(typed(el), '  ');
    expect(value()).toBeNull();
  });

  it('clears the pad and the name, and puts the cursor in the name box', () => {
    const { el, value } = signature();
    typeInto(typed(el), 'Sara');
    clear(el).click();
    expect(value()).toBeNull();
    expect(typed(el).value).toBe('');
    expect(strokes).toContain('clearRect(0,0,600,180)');
    expect(document.activeElement).toBe(typed(el));
    expect(clear(el).hidden).toBe(true);
  });

  it('shows a signature already kept as its picture, until it is cleared', () => {
    const { el, form } = signature();
    form.setValue('x', { name: 'signature.png', type: 'image/png', size: 4, data: 'WFla' });
    const image = el.querySelector('img') as HTMLImageElement;
    expect(image.hidden).toBe(false);
    expect(image.getAttribute('src')).toBe('data:image/png;base64,WFla');
    expect(image.alt).toBe('Signature');
    expect(pad(el).hidden).toBe(true);
    form.setValue('x', { name: 'signature.png', type: 'image/png', size: 4, url: 'https://example.com/s.png' });
    expect(image.getAttribute('src')).toBe('https://example.com/s.png');
    clear(el).click();
    expect(image.hidden).toBe(true);
    expect(pad(el).hidden).toBe(false);
  });

  it('cannot be drawn on, typed in or cleared when read-only', () => {
    const { el, value, refresh } = signature();
    refresh({ readonly: true });
    pointer(pad(el), 'pointerdown', 10, 10);
    pointer(pad(el), 'pointerup', 10, 10);
    expect(value()).toBeNull();
    expect(typed(el).hidden).toBe(true);
    expect(clear(el).hidden).toBe(true);
    expect(el.querySelector<HTMLElement>('.fd-signature-hint')?.hidden).toBe(true);
  });

  it('says when it is wrong, and what describes it', () => {
    const { el, refresh } = signature();
    refresh({ invalid: true });
    expect(el.getAttribute('aria-invalid')).toBe('true');
    expect(typed(el).getAttribute('aria-invalid')).toBe('true');
    refresh({ invalid: false });
    expect(el.getAttribute('aria-invalid')).toBe('false');
  });
});
