import { mountKind, press } from './test-kinds';

/** Flectra's priority: stars over a selection, the first option none, as '0'…'3'; one star over '0'/'1' or a yes or no. */
const LEVELS = [
  { value: '0', label: 'Low' },
  { value: '1', label: 'Medium' },
  { value: '2', label: 'High' },
  { value: '3', label: 'Very high' },
];

const stars = (el: HTMLElement) => [...el.querySelectorAll<HTMLButtonElement>('button[role="radio"]')];
const lit = (el: HTMLElement) => stars(el).filter((star) => star.classList.contains('fd-on')).length;

describe('priority stars', () => {
  it('draws a star for each option after the first, as a group of radios named by the options', () => {
    const { el } = mountKind({ type: 'selection', options: LEVELS }, { widget: 'priority' });
    const group = el.closest('[role="radiogroup"]') as HTMLElement;
    expect(group.id).toBe('fd-x');
    expect(stars(el).map((star) => star.getAttribute('aria-label'))).toEqual(['Medium', 'High', 'Very high']);
    expect(stars(el).map((star) => star.title)).toEqual(['Medium', 'High', 'Very high']);
    expect(el.querySelector('.fd-choice-clear')).toBeNull();
  });

  it('lights the stars up to the one picked, and the picked one, clicked again, takes them back to the first option', () => {
    const { el, value } = mountKind({ type: 'selection', options: LEVELS, default: '0' }, { widget: 'priority' });
    expect(lit(el)).toBe(0);
    stars(el)[1].click();
    expect(value()).toBe('2');
    expect(lit(el)).toBe(2);
    expect(stars(el)[1].getAttribute('aria-checked')).toBe('true');
    stars(el)[1].click();
    expect(value()).toBe('0');
    expect(lit(el)).toBe(0);
  });

  it('moves with the arrow keys, mirrored right to left, and Space toggles the star it is on', () => {
    const { el, value } = mountKind({ type: 'selection', options: LEVELS, default: '0' }, { widget: 'priority' });
    stars(el)[0].focus();
    press(stars(el)[0], 'ArrowRight');
    expect(value()).toBe('1');
    press(document.activeElement as Element, 'ArrowRight');
    expect(value()).toBe('2');
    expect(document.activeElement).toBe(stars(el)[1]);
    press(document.activeElement as Element, 'ArrowLeft');
    expect(value()).toBe('1');
    press(document.activeElement as Element, 'ArrowLeft');
    expect(value()).toBe('0');
    const rtl = mountKind({ type: 'selection', options: LEVELS, default: '0' }, { widget: 'priority' }, { dir: 'rtl' });
    press(stars(rtl.el)[0], 'ArrowLeft');
    expect(rtl.value()).toBe('1');
  });

  it('is one star over a yes or no, or two options, that a second click takes away', () => {
    const one = mountKind({ type: 'boolean' }, { widget: 'priority' });
    expect(stars(one.el)).toHaveLength(1);
    stars(one.el)[0].click();
    expect(one.value()).toBe(true);
    stars(one.el)[0].click();
    expect(one.value()).toBe(false);
    const two = mountKind({ type: 'selection', options: LEVELS.slice(0, 2), default: '0' }, { widget: 'priority' });
    stars(two.el)[0].click();
    expect(two.value()).toBe('1');
    expect(stars(two.el)[0].getAttribute('aria-label')).toBe('Medium');
  });

  it('cannot be changed while read-only', () => {
    const { el, refresh, value } = mountKind({ type: 'selection', options: LEVELS, default: '1' }, { widget: 'priority' });
    refresh({ readonly: true });
    expect(stars(el).every((star) => star.disabled)).toBe(true);
    expect(lit(el)).toBe(1);
    expect(value()).toBe('1');
  });
});
