import { steadyPresses } from './steady-press';

/**
 * The second click of a double-click on Save, which hid as it saved, never
 * presses the button that slid into its place; nor does a finger's double
 * tap. A single click, a key and the app's own click() always go through.
 */

let clock = 0;
let stop: (() => void) | null = null;
afterEach(() => {
  stop?.();
  stop = null;
  document.body.replaceChildren();
});

/** A press as a browser sends it: pointerdown, mousedown, pointerup, click — `count` the browser's count of clicks going on. Whether its click reached the button, and whether its focus stayed. */
function press(target: HTMLElement, x: number, y: number, count = 1, pointerType = 'mouse') {
  const pointer = (type: string) => {
    const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y });
    Object.defineProperty(event, 'pointerType', { value: pointerType });
    Object.defineProperty(event, 'isPrimary', { value: true });
    target.dispatchEvent(event);
  };
  pointer('pointerdown');
  const down = new MouseEvent('mousedown', { bubbles: true, cancelable: true, clientX: x, clientY: y, detail: count });
  target.dispatchEvent(down);
  pointer('pointerup');
  const click = new MouseEvent('click', { bubbles: true, cancelable: true, clientX: x, clientY: y, detail: count });
  target.dispatchEvent(click);
  return { focusKept: down.defaultPrevented, clicked: !click.defaultPrevented };
}

function bar() {
  const scope = document.createElement('div');
  scope.className = 'fd-header';
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

  it('the second click of a double-click lands where Save was: Approve, slid there, is not pressed', () => {
    const { save, approve, pressed } = bar();
    expect(press(save, 30, 10, 1).clicked).toBe(true);
    // Save hid as it saved; Approve now stands where it was, under the pointer.
    save.hidden = true;
    expect(press(approve, 30, 10, 2)).toEqual({ focusKept: true, clicked: false });
    // A triple click is no different.
    expect(press(approve, 31, 11, 3).clicked).toBe(false);
    expect(pressed).toEqual(['Save']);
  });

  it('a single click on the button that slid there presses it: a click is never lost', () => {
    const { save, approve, pressed } = bar();
    press(save, 30, 10, 1);
    save.hidden = true;
    expect(press(approve, 30, 10, 1).clicked).toBe(true);
    expect(pressed).toEqual(['Save', 'Approve']);
  });

  it('a double-click on a button that stays where it is presses it twice, as before', () => {
    const { approve, pressed } = bar();
    press(approve, 60, 10, 1);
    press(approve, 60, 10, 2);
    expect(pressed).toEqual(['Approve', 'Approve']);
  });

  it('a key, or the app’s own click(), is never refused', () => {
    const { save, approve, pressed } = bar();
    press(save, 30, 10, 1);
    save.hidden = true;
    approve.click();
    approve.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    approve.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 0 }));
    expect(pressed).toEqual(['Save', 'Approve', 'Approve']);
  });

  it('a finger: a double tap is refused; a tap a moment later, or elsewhere, is taken', () => {
    const { save, approve, pressed } = bar();
    press(save, 30, 10, 1, 'touch');
    save.hidden = true;
    clock += 90;
    expect(press(approve, 34, 12, 1, 'touch').clicked).toBe(false);
    clock += 600;
    expect(press(approve, 30, 10, 1, 'touch').clicked).toBe(true);
    expect(pressed).toEqual(['Save', 'Approve']);
  });

  it('a line’s × in a table is no bar’s: lines deleted one after another, each × coming up under the pointer', () => {
    const scope = document.createElement('div');
    const table = document.createElement('table');
    const deleted: string[] = [];
    const rows = ['Chair', 'Desk', 'Lamp'].map((name) => {
      const remove = document.createElement('button');
      remove.textContent = '×';
      remove.addEventListener('click', () => {
        deleted.push(name);
        remove.closest('tr')?.remove();
      });
      table.insertRow().insertCell().append(remove);
      return remove;
    });
    scope.append(table);
    document.body.append(scope);
    stop = steadyPresses(scope, () => clock);
    rows.forEach((remove, i) => press(remove, 200, 40, i + 1));
    expect(deleted).toEqual(['Chair', 'Desk', 'Lamp']);
  });

  it('a button outside the scope it keeps is left alone', () => {
    const { save, pressed } = bar();
    const other = document.createElement('button');
    other.textContent = 'Elsewhere';
    other.addEventListener('click', () => pressed.push('Elsewhere'));
    document.body.append(other);
    press(save, 30, 10, 1);
    expect(press(other, 30, 10, 2).clicked).toBe(true);
    expect(pressed).toEqual(['Save', 'Elsewhere']);
  });
});
