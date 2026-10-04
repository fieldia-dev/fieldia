import { mountKind, press } from './test-kinds';

/** Pictures to choose from, each with its words: one, as a radio group with one stop for Tab, or several. */

const DESKS = [
  { value: 'standing', label: 'Standing desk', image: 'data:image/svg+xml,%3Csvg%2F%3E' },
  { value: 'corner', label: 'Corner desk', image: 'https://example.com/corner.png' },
  { value: 'bench', label: 'Bench' },
];
const single = (extra: Record<string, unknown> = {}, dir?: 'rtl') =>
  mountKind({ type: 'selection', options: DESKS, ...extra }, { widget: 'image-choice' }, dir ? { dir, locale: 'ar' } : {});
const cards = (el: Element) => [...el.querySelectorAll<HTMLButtonElement>('.fd-image-card')];
const checked = (el: Element) => cards(el).map((c) => c.getAttribute('aria-checked'));
const tabStops = (el: Element) => cards(el).map((c) => c.tabIndex);

describe('image choice', () => {
  it('shows each option as its picture over its words, in a radio group the field’s label names', () => {
    const { el } = single();
    const group = el.querySelector('[role=radiogroup]') as HTMLElement;
    expect(group.id).toBe('fd-x');
    expect(cards(el).map((c) => c.getAttribute('role'))).toEqual(['radio', 'radio', 'radio']);
    expect(cards(el).map((c) => c.textContent)).toEqual(['Standing desk', 'Corner desk', 'Bench']);
    const pictures = cards(el).map((c) => c.querySelector('img')?.getAttribute('src') ?? null);
    expect(pictures).toEqual(['data:image/svg+xml,%3Csvg%2F%3E', 'https://example.com/corner.png', null]);
    // The words name the card; the picture adds nothing a screen reader should say twice.
    expect(cards(el)[0].querySelector('img')?.getAttribute('alt')).toBe('');
    // An option without a picture still has a tile of its size.
    expect(cards(el)[2].querySelector('.fd-image-card-blank')).not.toBeNull();
  });

  it('picks one with a click, and is one stop for Tab: the one picked, or the first', () => {
    const { el, value } = single();
    expect(tabStops(el)).toEqual([0, -1, -1]);
    cards(el)[1].click();
    expect(value()).toBe('corner');
    expect(checked(el)).toEqual(['false', 'true', 'false']);
    expect(tabStops(el)).toEqual([-1, 0, -1]);
  });

  it('moves and picks with the arrows, going round at either end, and Home and End', () => {
    const { el, value } = single();
    cards(el)[0].focus();
    press(cards(el)[0], 'ArrowRight');
    expect(value()).toBe('corner');
    expect(document.activeElement).toBe(cards(el)[1]);
    press(cards(el)[1], 'ArrowDown');
    expect(value()).toBe('bench');
    press(cards(el)[2], 'ArrowRight');
    expect(value()).toBe('standing');
    press(cards(el)[0], 'ArrowUp');
    expect(value()).toBe('bench');
    press(cards(el)[2], 'Home');
    expect(value()).toBe('standing');
    press(cards(el)[0], 'End');
    expect(value()).toBe('bench');
    expect(document.activeElement).toBe(cards(el)[2]);
  });

  it('moves the other way with the left and right arrows on a right-to-left page', () => {
    const { el, value } = single({}, 'rtl');
    cards(el)[0].focus();
    press(cards(el)[0], 'ArrowLeft');
    expect(value()).toBe('corner');
    press(cards(el)[1], 'ArrowRight');
    expect(value()).toBe('standing');
  });

  it('takes several when the field does, each card a checkbox of its own stop', () => {
    const { el, value } = single({ multiple: true });
    // No "Clear selection" for several: the group is the whole widget.
    expect([el.id, el.getAttribute('role')]).toEqual(['fd-x', 'group']);
    expect(cards(el).map((c) => c.getAttribute('role'))).toEqual(['checkbox', 'checkbox', 'checkbox']);
    expect(tabStops(el)).toEqual([0, 0, 0]);
    cards(el)[2].click();
    cards(el)[0].click();
    // In the options' order, as checkboxes keep them.
    expect(value()).toEqual(['standing', 'bench']);
    cards(el)[2].click();
    expect(value()).toEqual(['standing']);
    expect(checked(el)).toEqual(['true', 'false', 'false']);
  });

  it('never offers "Other"', () => {
    const { el } = single({ other: true });
    expect(cards(el)).toHaveLength(3);
    expect(el.querySelector('input[type=text]')).toBeNull();
  });

  it('takes the pick back with "Clear selection" when it need not be answered', () => {
    const { el, value, refresh } = single();
    const clear = el.querySelector('.fd-choice-clear') as HTMLButtonElement;
    cards(el)[1].click();
    expect(clear.hidden).toBe(false);
    clear.click();
    expect(value()).toBeNull();
    expect(document.activeElement).toBe(cards(el)[0]);
    cards(el)[1].click();
    refresh({ required: true });
    expect(clear.hidden).toBe(true);
  });

  it('cannot be changed when read-only, and says when it is wrong', () => {
    const { el, value, form, refresh } = single();
    form.setValue('x', 'bench');
    refresh({ readonly: true, invalid: true });
    expect(cards(el).every((c) => c.disabled)).toBe(true);
    press(cards(el)[2], 'ArrowRight');
    expect(value()).toBe('bench');
    expect(el.querySelector('[role=radiogroup]')?.getAttribute('aria-invalid')).toBe('true');
  });
});
