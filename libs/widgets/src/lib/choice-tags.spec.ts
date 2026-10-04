import { mountKind, press, typeInto } from './test-kinds';

/** Several answers from a list, as tags in a box: type to find one, Enter or a click to add it, × or Backspace to take it away. */

const ROOMS = [
  { value: 'kitchen', label: 'Kitchen' },
  { value: 'quiet', label: 'Quiet room' },
  { value: 'gym', label: 'Gym' },
  { value: 'library', label: 'Library' },
];
const tags = () => mountKind({ type: 'selection', multiple: true, options: ROOMS }, { widget: 'tags' });
const box = (el: Element) => el.querySelector('input') as HTMLInputElement;
const list = (el: Element) => el.querySelector('[role=listbox]') as HTMLElement;
const offered = (el: Element) => [...list(el).querySelectorAll('[role=option]')].map((o) => o.textContent);
const chips = (el: Element) => [...el.querySelectorAll('.fd-chip-label')].map((c) => c.textContent);

describe('tags from a list', () => {
  it('is a combobox the field’s label names, its list closed', () => {
    const { el } = tags();
    const input = box(el);
    expect(input.id).toBe('fd-x');
    expect(input.getAttribute('role')).toBe('combobox');
    expect(input.getAttribute('aria-controls')).toBe(list(el).id);
    expect(input.getAttribute('aria-expanded')).toBe('false');
    expect(list(el).hidden).toBe(true);
  });

  it('offers every option on focus, and those whose words match as one types', () => {
    const { el } = tags();
    box(el).focus();
    expect(list(el).hidden).toBe(false);
    expect(box(el).getAttribute('aria-expanded')).toBe('true');
    expect(offered(el)).toEqual(['Kitchen', 'Quiet room', 'Gym', 'Library']);
    typeInto(box(el), 'RO');
    expect(offered(el)).toEqual(['Quiet room']);
    typeInto(box(el), 'zz');
    expect(offered(el)).toEqual([]);
    expect(list(el).textContent).toBe('No results');
  });

  it('adds the option reached with the arrows on Enter, then offers only the others', () => {
    const { el, value } = tags();
    box(el).focus();
    press(box(el), 'ArrowDown');
    press(box(el), 'ArrowDown');
    const active = list(el).querySelector('[aria-selected=true]') as HTMLElement;
    expect(active.textContent).toBe('Quiet room');
    expect(box(el).getAttribute('aria-activedescendant')).toBe(active.id);
    press(box(el), 'Enter');
    expect(value()).toEqual(['quiet']);
    expect(chips(el)).toEqual(['Quiet room']);
    expect(box(el).value).toBe('');
    expect(offered(el)).toEqual(['Kitchen', 'Gym', 'Library']);
    // Up from the top goes round to the bottom.
    press(box(el), 'ArrowUp');
    expect(list(el).querySelector('[aria-selected=true]')?.textContent).toBe('Library');
  });

  it('adds the first match on Enter when nothing is reached, and one clicked', () => {
    const { el, value } = tags();
    typeInto(box(el), 'li');
    press(box(el), 'Enter');
    expect(value()).toEqual(['library']);
    box(el).focus();
    const gym = [...list(el).querySelectorAll<HTMLElement>('[role=option]')].find((o) => o.textContent === 'Gym') as HTMLElement;
    gym.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    gym.click();
    // In the order added.
    expect(value()).toEqual(['library', 'gym']);
    expect(chips(el)).toEqual(['Library', 'Gym']);
  });

  it('takes a tag away with its ×, or the last one with Backspace in the empty box', () => {
    const { el, form, value } = tags();
    form.setValue('x', ['kitchen', 'gym', 'library']);
    const remove = el.querySelector('[aria-label="Remove Gym"]') as HTMLButtonElement;
    remove.click();
    expect(value()).toEqual(['kitchen', 'library']);
    box(el).focus();
    press(box(el), 'Backspace');
    expect(value()).toEqual(['kitchen']);
    typeInto(box(el), 'k');
    press(box(el), 'Backspace');
    // Typing still in the box: Backspace is the box's.
    expect(value()).toEqual(['kitchen']);
  });

  it('closes its list on Escape, and when the cursor leaves', () => {
    const { el } = tags();
    box(el).focus();
    press(box(el), 'Escape');
    expect(list(el).hidden).toBe(true);
    press(box(el), 'ArrowDown');
    expect(list(el).hidden).toBe(false);
    box(el).blur();
    expect(list(el).hidden).toBe(true);
  });

  it('shows answers set from outside in their order, and words of one’s own as they are', () => {
    const { el, form } = tags();
    form.setValue('x', ['gym', 'Roof garden', 'kitchen']);
    expect(chips(el)).toEqual(['Gym', 'Roof garden', 'Kitchen']);
  });

  it('can only be read when read-only', () => {
    const { el, form, refresh } = tags();
    form.setValue('x', ['gym']);
    refresh({ readonly: true });
    expect(box(el).hidden).toBe(true);
    expect(el.querySelector('.fd-chip-remove')).toBeNull();
    expect(chips(el)).toEqual(['Gym']);
  });

  it('says when it is wrong', () => {
    const { el, refresh } = tags();
    refresh({ invalid: true, describedBy: 'help' });
    expect(box(el).getAttribute('aria-invalid')).toBe('true');
    expect(box(el).getAttribute('aria-describedby')).toBe('help');
  });
});
