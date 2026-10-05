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
      // What the pen is set to, as `strokeStyle=#1b2a5c`.
      set: (_, key: string, value: unknown) => (strokes.push(`${key}=${value}`), true),
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
    // The name typed is kept with its picture.
    expect(value()).toEqual({ ...SIGNED, text: 'Sara Hassan' });
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

describe('a signature’s settings', () => {
  const drawLine = (el: Element, from: number, to: number) => {
    pointer(pad(el), 'pointerdown', from, from);
    pointer(pad(el), 'pointermove', to, to);
    pointer(pad(el), 'pointerup', to, to);
  };
  const button = (el: Element, name: string) => [...el.querySelectorAll('button')].find((b) => b.textContent === name) as HTMLButtonElement;

  it('draws in the page’s pen colour and width, and a typed name in the same ink', () => {
    const { el } = mountKind({ type: 'binary', label: 'Signature' }, { widget: 'signature', options: { color: '#0b57d0', penWidth: 5 } });
    drawLine(el, 10, 40);
    expect(strokes).toEqual(expect.arrayContaining(['strokeStyle=#0b57d0', 'fillStyle=#0b57d0', 'lineWidth=5']));
    strokes.length = 0;
    typeInto(typed(el), 'Sara');
    expect(strokes).toContain('fillStyle=#0b57d0');
  });

  it('keeps the usual blue-black ink and width for a colour or a width that is not one', () => {
    const { el } = mountKind({ type: 'binary', label: 'Signature' }, { widget: 'signature', options: { color: 'red;x', penWidth: -2 } });
    drawLine(el, 10, 40);
    expect(strokes).toEqual(expect.arrayContaining(['strokeStyle=#1b2a5c', 'lineWidth=3']));
  });

  it('undoes the last stroke, drawing the rest again; the last one undone leaves it unanswered', () => {
    const { el, value } = signature();
    expect(button(el, 'Undo').hidden).toBe(true);
    drawLine(el, 10, 40);
    drawLine(el, 50, 80);
    expect(button(el, 'Undo').hidden).toBe(false);
    strokes.length = 0;
    button(el, 'Undo').click();
    // Wiped, and the first stroke drawn again, not the second.
    expect(strokes.find((s) => s.includes('('))).toBe('clearRect(0,0,600,180)');
    expect(strokes).toContain('lineTo(80,80)');
    expect(strokes).not.toContain('lineTo(160,160)');
    expect(value()).toEqual(SIGNED);
    button(el, 'Undo').click();
    expect(value()).toBeNull();
    expect(button(el, 'Undo').hidden).toBe(true);
    expect(el.querySelector<HTMLElement>('.fd-signature-hint')?.hidden).toBe(false);
  });

  it('says the page’s own words on the pad, and keeps words under it', () => {
    const { el } = mountKind({ type: 'binary', label: 'Signature' }, { widget: 'signature', placeholder: 'Sign as in your passport', options: { footerLabel: 'I agree this is my signature' } });
    expect(el.querySelector('.fd-signature-hint')?.textContent).toBe('Sign as in your passport');
    const footer = el.querySelector('.fd-signature-footer') as HTMLElement;
    expect(footer.textContent).toBe('I agree this is my signature');
    drawLine(el, 10, 40);
    expect(footer.hidden).toBe(false);
    // None asked for: none shown.
    expect(signature().el.querySelector('.fd-signature-footer')).toBeNull();
  });

  it('takes a picture of a signature, uploaded, where the page allows it', async () => {
    expect(button(signature().el, 'Upload a picture')).toBeUndefined();
    const { el, value } = mountKind({ type: 'binary', label: 'Signature' }, { widget: 'signature', options: { upload: true } });
    const input = el.querySelector('input[type=file]') as HTMLInputElement;
    expect(input.accept).toBe('image/*');
    const click = jest.spyOn(input, 'click').mockImplementation(() => undefined);
    button(el, 'Upload a picture').click();
    expect(click).toHaveBeenCalled();
    Object.defineProperty(input, 'files', { value: [new File(['ABCD'], 'mine.png', { type: 'image/png' })], configurable: true });
    input.dispatchEvent(new Event('change'));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(value()).toEqual({ name: 'mine.png', type: 'image/png', size: 4, data: 'QUJDRA==' });
    // Shown as its picture, until Clear.
    expect((el.querySelector('img') as HTMLImageElement).hidden).toBe(false);
  });

  it('drops the name once drawn over, and shows a kept name in its box again', () => {
    const { el, value, form } = signature();
    typeInto(typed(el), 'Sara');
    drawLine(el, 10, 40);
    expect(value()).toEqual(SIGNED);
    typed(el).blur();
    form.setValue('x', null);
    form.setValue('x', { ...SIGNED, data: 'WFla', text: 'Sara Hassan' });
    expect(typed(el).value).toBe('Sara Hassan');
  });

  it('has no undo or upload while read-only', () => {
    const { el, refresh } = mountKind({ type: 'binary', label: 'Signature' }, { widget: 'signature', options: { upload: true } });
    refresh({ readonly: true });
    expect(button(el, 'Undo').hidden).toBe(true);
    expect(button(el, 'Upload a picture').hidden).toBe(true);
  });
});
