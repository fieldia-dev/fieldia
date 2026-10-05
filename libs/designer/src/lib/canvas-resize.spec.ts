import { canvasResize, chipWords, clampWidth, dragWidth, keyWidth, valueWords, type CanvasResize } from './canvas-resize';
import type { ScreenSize } from './canvas-size';
import { elementFactory } from './chrome';
import { mount, press } from './test-editor';
import { employeeDesigner } from './test-layout';

/**
 * A canvas dragged to any width, as Designable's is: a handle on its end edge
 * sets a width from a phone's to the stage's whole, a chip says the width and
 * the size the form takes it for, and each group shows the columns it has
 * there. The keys move it too. The width is kept in this browser.
 */

describe('the width a drag or a key sets', () => {
  it('a drag: two pixels of width for each the pointer moves, as the canvas stays in the stage’s middle — mirrored right to left', () => {
    expect(dragWidth({ start: 900, from: 1000, x: 960, rtl: false })).toBe(820);
    expect(dragWidth({ start: 900, from: 1000, x: 1030, rtl: false })).toBe(960);
    // Right to left the handle is on the left: towards the left is wider.
    expect(dragWidth({ start: 900, from: 100, x: 140, rtl: true })).toBe(820);
    expect(dragWidth({ start: 900, from: 100, x: 70, rtl: true })).toBe(960);
  });

  it('no narrower than a phone, no wider than the stage, in whole pixels', () => {
    expect(clampWidth(200, 900)).toBe(320);
    expect(clampWidth(1000, 900)).toBe(900);
    expect(clampWidth(640.4, 900)).toBe(640);
    // A stage narrower than a phone still gives a phone's.
    expect(clampWidth(500, 300)).toBe(320);
  });

  it('the keys: ← and → ten pixels, with Shift a hundred, Home and End the least and the most — mirrored right to left', () => {
    const key = (k: string, shiftKey = false, more: { altKey?: boolean; ctrlKey?: boolean; metaKey?: boolean } = {}) => ({ key: k, shiftKey, altKey: false, ctrlKey: false, metaKey: false, ...more });
    expect(keyWidth(640, key('ArrowRight'), false, 900)).toBe(650);
    expect(keyWidth(640, key('ArrowLeft'), false, 900)).toBe(630);
    expect(keyWidth(640, key('ArrowRight', true), false, 900)).toBe(740);
    expect(keyWidth(640, key('ArrowLeft', true), false, 900)).toBe(540);
    expect(keyWidth(640, key('ArrowLeft'), true, 900)).toBe(650);
    expect(keyWidth(640, key('ArrowRight', true), true, 900)).toBe(540);
    expect(keyWidth(640, key('Home'), false, 900)).toBe(320);
    expect(keyWidth(640, key('End'), false, 900)).toBe(900);
    expect(keyWidth(880, key('ArrowRight', true), false, 900)).toBe(900);
    expect(keyWidth(330, key('ArrowLeft', true), false, 900)).toBe(320);
    expect(keyWidth(640, key('ArrowUp'), false, 900)).toBeNull();
    expect(keyWidth(640, key('a'), false, 900)).toBeNull();
    // With Alt, Ctrl or ⌘ a key is the editor's, or the browser's.
    expect(keyWidth(640, key('ArrowLeft', false, { altKey: true }), false, 900)).toBeNull();
    expect(keyWidth(640, key('Home', false, { ctrlKey: true }), false, 900)).toBeNull();
    expect(keyWidth(640, key('ArrowRight', false, { metaKey: true }), false, 900)).toBeNull();
  });

  it('in words: the chip’s, and a screen reader’s', () => {
    expect(chipWords(640, 'tablet')).toBe('640 px · Tablet');
    expect(valueWords(640, 'tablet')).toBe('640 pixels, tablet');
    expect(valueWords(1024, 'desktop')).toBe('1024 pixels, desktop');
  });
});

describe('the handle', () => {
  let resize: CanvasResize | null = null;
  afterEach(() => {
    resize?.destroy();
    resize = null;
    document.body.replaceChildren();
  });

  /** A handle on a canvas the stage holds at `width`, out of `room`; the canvas keeps 66px round the form, as the designer's does. */
  function setup(options: { rtl?: boolean; width?: number; room?: number; size?: ScreenSize } = {}) {
    const canvas = document.createElement('div');
    document.body.append(canvas);
    const measured = { width: options.width ?? 900, room: options.room ?? 900, inset: 66 };
    let size: ScreenSize = options.size ?? 'desktop';
    const changes: string[] = [];
    const said: string[] = [];
    let resets = 0;
    resize = canvasResize({
      el: elementFactory(document),
      canvas,
      rtl: () => options.rtl === true,
      size: () => size,
      measure: () => ({ ...measured }),
      change(width, next, done) {
        changes.push(`${width} ${next}${done ? ' done' : ''}`);
        size = next;
        measured.width = width;
      },
      reset: () => resets++,
      say: (words) => said.push(words),
    });
    const handle = resize.element;
    const pointer = (type: string, x: number, target: EventTarget = handle) => target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: 300, button: 0 }));
    const chip = handle.querySelector('.fd-canvas-resize-chip') as HTMLElement;
    return { canvas, handle, pointer, chip, changes, said, resets: () => resets, measured };
  }
  const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));

  it('sits on the canvas: a vertical separator the keys reach, a phone’s width its least', () => {
    const { canvas, handle } = setup();
    expect(handle.parentElement).toBe(canvas);
    expect(handle.getAttribute('role')).toBe('separator');
    expect(handle.getAttribute('aria-orientation')).toBe('vertical');
    expect(handle.getAttribute('aria-label')).toBe('Screen width');
    expect(handle.tabIndex).toBe(0);
    expect(handle.getAttribute('aria-valuemin')).toBe('320');
  });

  it('read once the page is laid out: its width now, the most it can be, in words with the size shown', () => {
    const { handle } = setup({ width: 768, room: 900, size: 'tablet' });
    resize?.read()?.();
    expect(handle.getAttribute('aria-valuenow')).toBe('768');
    expect(handle.getAttribute('aria-valuemax')).toBe('900');
    expect(handle.getAttribute('aria-valuetext')).toBe('768 pixels, tablet');
  });

  it('dragged: one change a frame, however many moves come in it; the chip says the width and the size; one change more when let go, said aloud', async () => {
    const { handle, pointer, chip, changes, said } = setup();
    pointer('pointerdown', 1000);
    expect(handle.hasAttribute('data-active')).toBe(true);
    for (const x of [995, 990, 980, 970, 960]) pointer('pointermove', x, document);
    expect(changes).toEqual([]);
    await frame();
    // 900 + 2 × (960 − 1000) = 820 wide; the form, 66px less, 754: a tablet's.
    expect(changes).toEqual(['820 tablet']);
    expect(chip.textContent).toBe('820 px · Tablet');
    expect(handle.getAttribute('aria-valuenow')).toBe('820');
    expect(handle.getAttribute('aria-valuetext')).toBe('820 pixels, tablet');
    pointer('pointermove', 700, document);
    pointer('pointermove', 600, document);
    await frame();
    // As narrow as a phone, no narrower.
    expect(changes).toEqual(['820 tablet', '320 phone']);
    expect(chip.textContent).toBe('320 px · Phone');
    pointer('pointermove', 900, document);
    pointer('pointerup', 900, document);
    expect(changes).toEqual(['820 tablet', '320 phone', '700 tablet done']);
    expect(handle.hasAttribute('data-active')).toBe(false);
    expect(said).toEqual(['700 pixels, tablet']);
    await frame();
    expect(changes).toHaveLength(3);
  });

  it('right to left, on the canvas’s left edge: dragged left, wider', async () => {
    const { pointer, changes } = setup({ rtl: true, width: 600, room: 900 });
    pointer('pointerdown', 200);
    pointer('pointermove', 150, document);
    await frame();
    pointer('pointerup', 150, document);
    expect(changes).toEqual(['700 tablet', '700 tablet done']);
  });

  it('pressed and let go without moving: nothing changes — a click is not a width', async () => {
    const { pointer, changes, said } = setup();
    pointer('pointerdown', 1000);
    pointer('pointerup', 1000, document);
    await frame();
    expect(changes).toEqual([]);
    expect(said).toEqual([]);
  });

  it('a double-click goes back to the size’s own width', () => {
    const { handle, resets } = setup();
    handle.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    expect(resets()).toBe(1);
  });

  it('the keys: each press a change, said aloud; Shift a hundred; Home and End', () => {
    const { handle, changes, said, measured } = setup({ width: 900, room: 1000 });
    handle.focus();
    press('ArrowLeft');
    expect(changes).toEqual(['890 desktop done']);
    expect(said).toEqual(['890 pixels, desktop']);
    press('ArrowLeft', { shiftKey: true });
    expect(changes.at(-1)).toBe('790 tablet done');
    expect(handle.getAttribute('aria-valuenow')).toBe('790');
    expect(handle.getAttribute('aria-valuetext')).toBe('790 pixels, tablet');
    press('Home');
    expect(changes.at(-1)).toBe('320 phone done');
    press('End');
    expect(changes.at(-1)).toBe('1000 desktop done');
    // At the most already: nothing to change, nothing said.
    const before = changes.length;
    press('ArrowRight');
    expect(changes).toHaveLength(before);
    expect(measured.width).toBe(1000);
  });

  it('a key it does not use goes on to the editor', () => {
    const { handle } = setup();
    handle.focus();
    const event = new KeyboardEvent('keydown', { key: 'Delete', bubbles: true, cancelable: true });
    handle.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it('right to left, the keys mirrored: ← is wider', () => {
    const { handle, changes } = setup({ rtl: true, width: 600, room: 900 });
    handle.focus();
    press('ArrowLeft');
    press('ArrowRight', { shiftKey: true });
    expect(changes).toEqual(['610 tablet done', '510 phone done']);
  });

  it('gone with the canvas: the handle off it, a drag going on ended', async () => {
    const { canvas, pointer, changes } = setup();
    pointer('pointerdown', 1000);
    pointer('pointermove', 900, document);
    resize?.destroy();
    resize = null;
    await frame();
    pointer('pointermove', 800, document);
    pointer('pointerup', 800, document);
    expect(changes).toEqual([]);
    expect(canvas.querySelector('.fd-canvas-resize')).toBeNull();
  });
});

describe('the handle in the screen editor', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    localStorage.clear();
  });

  /**
   * The page laid out as a browser would: the stage `room` wide, the canvas as
   * wide as its own width, a tablet's or a phone's, never wider than the stage.
   */
  function laidOut(room: number) {
    jest.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      const e = this as HTMLElement;
      let width = 0;
      if (e.classList.contains('fd-canvas-scroll')) width = room;
      if (e.classList.contains('fd-canvas')) {
        const own = e.dataset['mode'] === 'advanced' && e.dataset['width'] !== undefined ? parseFloat(e.style.getPropertyValue('--fd-canvas-width')) : { tablet: 768, phone: 390 }[e.dataset['size'] as string] ?? room;
        width = Math.min(own, room);
      }
      return { left: 0, right: width, width, top: 0, bottom: 0, height: 0, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
    });
  }

  const setup = (mode: 'simple' | 'advanced', room = 1000) => {
    laidOut(room);
    localStorage.setItem('fieldia.designer.mode', mode);
    const designer = employeeDesigner();
    const { host, handle } = mount(designer);
    const canvas = host.querySelector('.fd-canvas') as HTMLElement;
    const resizer = canvas.querySelector(':scope > .fd-canvas-resize') as HTMLElement;
    const button = (name: string) => host.querySelector(`.fd-canvas-sizes button[data-size="${name}"]`) as HTMLButtonElement;
    const pressed = () => host.querySelector('.fd-canvas-sizes [aria-pressed="true"]')?.getAttribute('data-size');
    const note = host.querySelector('.fd-canvas-size-px') as HTMLElement;
    const cols = (id: string) => (host.querySelector(`.fd-canvas-body [data-node="${id}"] > .fd-grid`) as HTMLElement).style.getPropertyValue('--fd-cols');
    const columns = () => [cols('personal'), cols('side-1'), cols('address')];
    return { designer, host, handle, canvas, resizer, button, pressed, note, columns };
  };

  it('Advanced has the handle on the canvas; its keys give the canvas a width of its own, each group the columns it has there', () => {
    const { canvas, resizer, pressed, note, columns } = setup('advanced');
    expect(getComputedStyle(resizer).display).not.toBe('none');
    expect(canvas.dataset['width']).toBeUndefined();
    expect(note.hidden).toBe(true);
    resizer.focus();
    // 1000 wide, a desktop; 900 still one (the form 836 inside it); 800 a tablet's (736).
    press('ArrowLeft', { shiftKey: true });
    expect(canvas.dataset['width']).toBe('');
    expect(canvas.style.getPropertyValue('--fd-canvas-width')).toBe('900px');
    expect(pressed()).toBe('desktop');
    expect(columns()).toEqual(['3', '2', '2']);
    press('ArrowLeft', { shiftKey: true });
    expect(canvas.style.getPropertyValue('--fd-canvas-width')).toBe('800px');
    expect(canvas.dataset['size']).toBe('tablet');
    expect(pressed()).toBe('tablet');
    expect(columns()).toEqual(['3', '1', '2']);
    expect(note.hidden).toBe(false);
    expect(note.textContent).toBe('800 px');
    press('Home');
    expect(pressed()).toBe('phone');
    expect(columns()).toEqual(['1', '1', '1']);
    expect(note.textContent).toBe('320 px');
    expect(document.querySelector('.fd-canvas-said')?.textContent).toBe('320 pixels, phone');
  });

  it('the width and its size kept in this browser, the next time as they were', () => {
    const { resizer, handle, designer } = setup('advanced');
    resizer.focus();
    for (let i = 0; i < 3; i++) press('ArrowLeft', { shiftKey: true });
    expect(localStorage.getItem('fieldia.designer.width')).toBe('700');
    expect(localStorage.getItem('fieldia.designer.size')).toBe('tablet');
    handle.destroy();
    document.body.replaceChildren();
    const { host } = mount(designer);
    const canvas = host.querySelector('.fd-canvas') as HTMLElement;
    expect(canvas.style.getPropertyValue('--fd-canvas-width')).toBe('700px');
    expect(canvas.dataset['size']).toBe('tablet');
    expect(host.querySelector('.fd-canvas-sizes [aria-pressed="true"]')?.getAttribute('data-size')).toBe('tablet');
    expect(host.querySelector('.fd-canvas-size-px')?.textContent).toBe('700 px');
  });

  it('a size picked goes to its own width, the width of its own forgotten', () => {
    const { canvas, resizer, button, note, pressed } = setup('advanced');
    resizer.focus();
    press('Home');
    button('desktop').click();
    expect(canvas.dataset['width']).toBeUndefined();
    expect(pressed()).toBe('desktop');
    expect(note.hidden).toBe(true);
    expect(localStorage.getItem('fieldia.designer.width')).toBeNull();
    expect(localStorage.getItem('fieldia.designer.size')).toBe('desktop');
  });

  it('a double-click on the handle goes back to the pressed size’s own width', () => {
    const { canvas, resizer, pressed, columns } = setup('advanced');
    resizer.focus();
    for (let i = 0; i < 3; i++) press('ArrowLeft', { shiftKey: true });
    expect(pressed()).toBe('tablet');
    resizer.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    expect(canvas.dataset['width']).toBeUndefined();
    expect(canvas.dataset['size']).toBe('tablet');
    expect(pressed()).toBe('tablet');
    expect(columns()).toEqual(['3', '1', '2']);
    expect(localStorage.getItem('fieldia.designer.width')).toBeNull();
  });

  it('the handle’s keys and clicks are its own: the part picked stays picked, where it is', () => {
    const { designer, resizer } = setup('advanced');
    designer.select('f-mobile');
    const before = JSON.stringify(designer.getPage().layout);
    resizer.focus();
    press('ArrowLeft');
    resizer.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(JSON.stringify(designer.getPage().layout)).toBe(before);
    expect(designer.getState().selected).toBe('f-mobile');
  });

  it('Simple shows a desktop: no handle, and no width of its own', () => {
    localStorage.setItem('fieldia.designer.width', '640');
    localStorage.setItem('fieldia.designer.size', 'tablet');
    const { canvas, resizer, columns } = setup('simple');
    expect(getComputedStyle(resizer).display).toBe('none');
    expect(canvas.dataset['size']).toBe('desktop');
    expect(canvas.dataset['width']).toBeUndefined();
    expect(columns()).toEqual(['3', '2', '2']);
  });
});
