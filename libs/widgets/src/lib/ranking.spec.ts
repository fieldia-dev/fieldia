import { mountKind, press } from './test-kinds';

/** Options put in order: dragged, or moved with buttons and Alt+↑/↓; each move said aloud; the answer is the order. */

const THINGS = [
  { value: 'light', label: 'Daylight' },
  { value: 'quiet', label: 'Quiet' },
  { value: 'near', label: 'Near a window' },
  { value: 'storage', label: 'Storage' },
];
const ranking = (node: Record<string, unknown> = {}) => mountKind({ type: 'selection', multiple: true, options: THINGS }, { widget: 'ranking', ...node });
const items = (el: Element) => [...el.querySelectorAll<HTMLLIElement>('.fd-rank-item')];
const order = (el: Element) => items(el).map((li) => li.querySelector('.fd-rank-words')?.textContent);
const places = (el: Element) => items(el).map((li) => li.querySelector('.fd-rank-place')?.textContent);
const button = (el: Element, name: string) => el.querySelector(`[aria-label="${name}"]`) as HTMLButtonElement;
const said = (el: Element) => el.querySelector('[aria-live=polite]')?.textContent;

describe('ranking', () => {
  it('lists the options in a group the field’s label names, each numbered with its buttons to move it', () => {
    const { el, value } = ranking();
    expect([el.id, el.getAttribute('role')]).toEqual(['fd-x', 'group']);
    expect(order(el)).toEqual(['Daylight', 'Quiet', 'Near a window', 'Storage']);
    expect(places(el)).toEqual(['1', '2', '3', '4']);
    expect(button(el, 'Move Daylight up').disabled).toBe(true);
    expect(button(el, 'Move Daylight down').disabled).toBe(false);
    expect(button(el, 'Move Storage down').disabled).toBe(true);
    // Not answered until something is moved.
    expect(value()).toEqual([]);
  });

  it('moves an option with its buttons, keeping the cursor on it, and says where it went', () => {
    const { el, value } = ranking();
    button(el, 'Move Daylight down').focus();
    button(el, 'Move Daylight down').click();
    expect(value()).toEqual(['quiet', 'light', 'near', 'storage']);
    expect(order(el)).toEqual(['Quiet', 'Daylight', 'Near a window', 'Storage']);
    expect(places(el)).toEqual(['1', '2', '3', '4']);
    expect(document.activeElement).toBe(button(el, 'Move Daylight down'));
    expect(said(el)).toBe('Daylight moved to place 2 of 4');
    // At the top its up button is no use: the cursor goes to the other.
    button(el, 'Move Daylight up').focus();
    button(el, 'Move Daylight up').click();
    expect(order(el)[0]).toBe('Daylight');
    expect(document.activeElement).toBe(button(el, 'Move Daylight down'));
    expect(said(el)).toBe('Daylight moved to place 1 of 4');
  });

  it('moves with Alt and the up and down arrows, and leaves the plain arrows alone', () => {
    const { el, value } = ranking();
    const down = button(el, 'Move Quiet down');
    down.focus();
    press(down, 'ArrowDown', { altKey: true });
    press(button(el, 'Move Quiet down'), 'ArrowDown', { altKey: true });
    expect(value()).toEqual(['light', 'near', 'storage', 'quiet']);
    expect(document.activeElement).toBe(button(el, 'Move Quiet up'));
    press(button(el, 'Move Quiet up'), 'ArrowUp', { altKey: true });
    expect(value()).toEqual(['light', 'near', 'quiet', 'storage']);
    press(button(el, 'Move Quiet up'), 'ArrowUp');
    expect(value()).toEqual(['light', 'near', 'quiet', 'storage']);
    // Past either end there is nowhere to go, and nothing is said.
    const before = said(el);
    press(button(el, 'Move Daylight up'), 'ArrowUp', { altKey: true });
    press(button(el, 'Move Storage up'), 'ArrowDown', { altKey: true });
    expect(value()).toEqual(['light', 'near', 'quiet', 'storage']);
    expect(said(el)).toBe(before);
  });

  it('shows an order set from outside, the options it leaves out after it, and drops what is not an option', () => {
    const { el, form } = ranking();
    form.setValue('x', ['storage', 'gone', 'quiet']);
    expect(order(el)).toEqual(['Storage', 'Quiet', 'Daylight', 'Near a window']);
  });

  it('moves an option dragged by the pointer past the middle of others', () => {
    const { el, value } = ranking();
    // Each line 40 pixels high, one under the other.
    items(el).forEach((li) => {
      li.getBoundingClientRect = () => {
        const at = items(el).indexOf(li);
        return { top: at * 40, bottom: at * 40 + 40, height: 40, left: 0, right: 300, width: 300, x: 0, y: at * 40, toJSON: () => ({}) };
      };
    });
    const first = items(el)[0];
    const pointer = (target: Element, type: string, y: number) => target.dispatchEvent(new MouseEvent(type, { clientX: 10, clientY: y, button: 0, bubbles: true, cancelable: true }));
    pointer(first, 'pointerdown', 20);
    // A hand's wobble is not a drag.
    pointer(first, 'pointermove', 22);
    expect(first.classList.contains('fd-rank-lifted')).toBe(false);
    pointer(first, 'pointermove', 50);
    expect(first.classList.contains('fd-rank-lifted')).toBe(true);
    // Past the top of the second line, not its middle: still first.
    expect(order(el)[0]).toBe('Daylight');
    // Past the middle of the second line (60) and of the third (100), not of the fourth (140).
    pointer(first, 'pointermove', 110);
    expect(order(el)).toEqual(['Quiet', 'Near a window', 'Daylight', 'Storage']);
    expect(value()).toEqual([]);
    pointer(first, 'pointerup', 110);
    expect(value()).toEqual(['quiet', 'near', 'light', 'storage']);
    expect(first.classList.contains('fd-rank-lifted')).toBe(false);
    expect(said(el)).toBe('Daylight moved to place 3 of 4');
  });

  it('keeps an answer as it was when a drag ends where it began, or with a button pressed', () => {
    const { el, value } = ranking();
    const first = items(el)[0];
    first.dispatchEvent(new MouseEvent('pointerdown', { clientY: 5, button: 0, bubbles: true }));
    first.dispatchEvent(new MouseEvent('pointerup', { clientY: 5, button: 0, bubbles: true }));
    expect(value()).toEqual([]);
    button(el, 'Move Daylight down').dispatchEvent(new MouseEvent('pointerdown', { clientY: 5, button: 0, bubbles: true }));
    first.dispatchEvent(new MouseEvent('pointermove', { clientY: 200, button: 0, bubbles: true }));
    expect(first.classList.contains('fd-rank-lifted')).toBe(false);
  });

  it('can only be read when read-only', () => {
    const { el, value, refresh } = ranking();
    refresh({ readonly: true, invalid: true });
    expect(el.querySelectorAll('.fd-rank-item button:not([hidden])')).toHaveLength(0);
    press(items(el)[0], 'ArrowDown', { altKey: true });
    // The same line all the way: once a drag moves it, the first line is another.
    const first = items(el)[0];
    first.dispatchEvent(new MouseEvent('pointerdown', { clientY: 5, button: 0, bubbles: true }));
    first.dispatchEvent(new MouseEvent('pointermove', { clientY: 200, button: 0, bubbles: true }));
    first.dispatchEvent(new MouseEvent('pointerup', { clientY: 200, button: 0, bubbles: true }));
    expect(order(el)[0]).toBe('Daylight');
    expect(value()).toEqual([]);
    expect(el.getAttribute('aria-invalid')).toBe('true');
  });
});
