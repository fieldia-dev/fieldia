import { steadyPresses } from './steady-press';

/**
 * A press on a button that came under a pointer that did not move is not
 * taken: the second click of a double-click on Save, which hid, never presses
 * the button that slid into its place. Moved onto, or pressed again a moment
 * later, the button takes it; a key never waits.
 */

let clock = 0;
let stop: (() => void) | null = null;
afterEach(() => {
  stop?.();
  stop = null;
  document.body.replaceChildren();
});

/** A pointer event as a browser sends it: where, which pointer, the first. */
function pointer(type: string, target: Element, x: number, y: number, pointerType = 'mouse') {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y, detail: 1 });
  Object.defineProperty(event, 'pointerType', { value: pointerType });
  Object.defineProperty(event, 'isPrimary', { value: true });
  target.dispatchEvent(event);
  return event;
}

/** A whole press at (x, y) on `target`: down, mousedown, up, click — and whether its click reached the button. */
function press(target: HTMLElement, x: number, y: number, pointerType = 'mouse') {
  pointer('pointerdown', target, x, y, pointerType);
  const down = new MouseEvent('mousedown', { bubbles: true, cancelable: true, clientX: x, clientY: y, detail: 1 });
  target.dispatchEvent(down);
  pointer('pointerup', target, x, y, pointerType);
  const click = new MouseEvent('click', { bubbles: true, cancelable: true, clientX: x, clientY: y, detail: 1 });
  target.dispatchEvent(click);
  return { focusKept: down.defaultPrevented, clicked: !click.defaultPrevented };
}

function bar() {
  const scope = document.createElement('div');
  const save = document.createElement('button');
  save.textContent = 'Save';
  const approve = document.createElement('button');
  approve.textContent = 'Approve';
  scope.append(save, approve);
  document.body.append(scope);
  const pressed: string[] = [];
  for (const button of [save, approve]) button.addEventListener('click', () => pressed.push(button.textContent as string));
  stop = steadyPresses(scope, () => clock);
  return { save, approve, pressed };
}

describe('a press on a bar’s button', () => {
  beforeEach(() => (clock = 1000));

  it('the second click of a double-click lands on Save’s place: Approve, slid there, is not pressed', () => {
    const { save, approve, pressed } = bar();
    pointer('pointermove', save, 30, 10);
    expect(press(save, 30, 10).clicked).toBe(true);
    // Save hid as it saved; Approve now stands where it was, under the pointer.
    save.hidden = true;
    clock += 120;
    const second = press(approve, 30, 10);
    expect(second).toEqual({ focusKept: true, clicked: false });
    // A third click, as quick, is no different.
    clock += 120;
    expect(press(approve, 31, 11).clicked).toBe(false);
    expect(pressed).toEqual(['Save']);
  });

  it('moved onto, the button that slid there is pressed at once', () => {
    const { save, approve, pressed } = bar();
    press(save, 30, 10);
    save.hidden = true;
    clock += 100;
    pointer('pointermove', approve, 60, 14);
    expect(press(approve, 60, 14).clicked).toBe(true);
    expect(pressed).toEqual(['Save', 'Approve']);
  });

  it('pressed again a moment after the press it refused, it is taken: never a dead button', () => {
    const { save, approve, pressed } = bar();
    press(save, 30, 10);
    save.hidden = true;
    clock += 150;
    expect(press(approve, 30, 10).clicked).toBe(false);
    clock += 600;
    expect(press(approve, 30, 10).clicked).toBe(true);
    expect(pressed).toEqual(['Save', 'Approve']);
  });

  it('a double-click on a button that stays where it is presses it twice, as before', () => {
    const { approve, pressed } = bar();
    press(approve, 60, 10);
    clock += 100;
    press(approve, 60, 10);
    expect(pressed).toEqual(['Approve', 'Approve']);
  });

  it('a key, or the app’s own click(), is never refused', () => {
    const { save, approve, pressed } = bar();
    press(save, 30, 10);
    save.hidden = true;
    clock += 50;
    approve.click();
    approve.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    approve.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 0 }));
    expect(pressed).toEqual(['Save', 'Approve', 'Approve']);
  });

  it('a finger: a double tap is refused, a tap a second later is a new look', () => {
    const { save, approve, pressed } = bar();
    press(save, 30, 10, 'touch');
    save.hidden = true;
    clock += 90;
    expect(press(approve, 32, 12, 'touch').clicked).toBe(false);
    clock += 1500;
    expect(press(approve, 30, 10, 'touch').clicked).toBe(true);
    expect(pressed).toEqual(['Save', 'Approve']);
  });

  it('a button outside the bar it keeps is left alone', () => {
    const { save, pressed } = bar();
    const other = document.createElement('button');
    other.textContent = 'Elsewhere';
    other.addEventListener('click', () => pressed.push('Elsewhere'));
    document.body.append(other);
    press(save, 30, 10);
    clock += 50;
    expect(press(other, 30, 10).clicked).toBe(true);
    expect(pressed).toEqual(['Save', 'Elsewhere']);
  });
});
