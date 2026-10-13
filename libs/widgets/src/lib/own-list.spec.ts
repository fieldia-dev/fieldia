import { mountKind, press } from './test-kinds';

/**
 * A choice in Fieldia's own list (`options.list: "own"`), as a work tracker's
 * Priority and Severity: the value as words on a button, and a list with a
 * tick by the option picked, used from the keyboard as the browser's is.
 */
const SEVERITY = [
  { value: '1', label: '1 - Critical' },
  { value: '2', label: '2 - High' },
  { value: '3', label: '3 - Medium' },
  { value: '4', label: '4 - Low' },
];

const button = (el: HTMLElement) => el.querySelector('button') as HTMLButtonElement;
const list = (el: HTMLElement) => el.querySelector('[role=listbox]') as HTMLElement;
const options = (el: HTMLElement) => [...el.querySelectorAll<HTMLElement>('[role=option]')];
const active = (el: HTMLElement) => document.getElementById(list(el).getAttribute('aria-activedescendant') ?? '')?.textContent;

describe('a choice in Fieldia’s own list', () => {
  it('is a button that opens a listbox, named by its label and its value', () => {
    const { el } = mountKind({ type: 'selection', label: 'Severity', options: SEVERITY, default: '3' }, { options: { list: 'own' } });
    expect(el.querySelector('select')).toBeNull();
    expect(button(el).id).toBe('fd-x');
    expect(button(el).getAttribute('aria-haspopup')).toBe('listbox');
    expect(button(el).getAttribute('aria-expanded')).toBe('false');
    expect(button(el).getAttribute('aria-labelledby')).toBe('fd-x-label fd-x-words');
    expect(document.getElementById('fd-x-words')?.textContent).toBe('3 - Medium');
    expect(list(el).hidden).toBe(true);
  });

  it('opens on the option picked, a tick by it alone, and picks another with a press', () => {
    const { el, value } = mountKind({ type: 'selection', options: SEVERITY, default: '3' }, { options: { list: 'own' } });
    button(el).click();
    expect(list(el).hidden).toBe(false);
    expect(button(el).getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(list(el));
    expect(options(el).map((o) => o.getAttribute('aria-selected'))).toEqual(['false', 'false', 'true', 'false']);
    expect(options(el).map((o) => o.querySelector('.fd-pick-tick svg') !== null)).toEqual([true, true, true, true]);
    expect(active(el)).toBe('3 - Medium');
    options(el)[1].click();
    expect(value()).toBe('2');
    expect(list(el).hidden).toBe(true);
    expect(document.activeElement).toBe(button(el));
  });

  it('is used from the keyboard: ↓ opens it, the arrows, Home and End move, typing finds, Enter picks, Escape closes', () => {
    const { el, value } = mountKind({ type: 'selection', options: SEVERITY, default: '3' }, { options: { list: 'own' } });
    button(el).focus();
    press(button(el), 'ArrowDown');
    expect(active(el)).toBe('3 - Medium');
    press(list(el), 'ArrowDown');
    expect(active(el)).toBe('4 - Low');
    press(list(el), 'ArrowDown');
    expect(active(el)).toBe('4 - Low');
    press(list(el), 'Home');
    expect(active(el)).toBe('1 - Critical');
    press(list(el), '2');
    expect(active(el)).toBe('2 - High');
    let reached = false;
    document.body.addEventListener('keydown', () => (reached = true), { once: true });
    press(list(el), 'Escape');
    expect(reached).toBe(false);
    expect(list(el).hidden).toBe(true);
    expect(value()).toBe('3');
    press(button(el), 'Enter');
    press(list(el), 'End');
    press(list(el), 'Enter');
    expect(value()).toBe('4');
  });

  it('empties a choice that need not be made with Delete, never one that must', () => {
    const { el, value, refresh } = mountKind({ type: 'selection', options: SEVERITY, default: '3' }, { options: { list: 'own' } });
    refresh({ required: true });
    press(button(el), 'Delete');
    expect(value()).toBe('3');
    refresh({ required: false });
    press(button(el), 'Delete');
    expect(value()).toBeNull();
    expect(document.getElementById('fd-x-words')?.textContent).toBe('');
  });

  it('cannot be opened while read-only', () => {
    const { el, refresh } = mountKind({ type: 'selection', options: SEVERITY, default: '1' }, { options: { list: 'own' } });
    refresh({ readonly: true });
    expect(button(el).disabled).toBe(true);
    el.click();
    expect(list(el).hidden).toBe(true);
  });

  it('opens from its words too, as a box does', () => {
    const { el } = mountKind({ type: 'selection', options: SEVERITY, default: '1' }, { options: { list: 'own' } });
    (el.querySelector('.fd-own-words') as HTMLElement).click();
    expect(list(el).hidden).toBe(false);
  });
});
