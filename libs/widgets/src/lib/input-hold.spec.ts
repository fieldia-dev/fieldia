import { mountKind } from './test-kinds';

/**
 * The keys a box holds after a refused one (`hold`), whichever way text comes
 * next: typed, pasted, dropped, composed by an IME, typed by a phone's keyboard
 * that cannot be stopped, corrected by a spell checker, undone or deleted. The
 * hold survives each: what comes joins the keys held (or waits with them), the
 * words said again — never landing beside the text typed before the refused
 * key, which would make a value nobody typed ("ahmedali@example.com" from
 * "ahmed " and a pasted "ali@example.com"). In a line of words, a phone number,
 * an email, a colour's code, a whole number and hours.
 */

function keys(input: HTMLInputElement, text: string, cancelable = true) {
  for (const char of [...text]) {
    const before = new InputEvent('beforeinput', { inputType: 'insertText', data: char, cancelable, bubbles: true });
    if (!input.dispatchEvent(before)) continue;
    const start = input.selectionStart ?? input.value.length;
    input.setRangeText(char, start, input.selectionEnd ?? start, 'end');
    input.dispatchEvent(new InputEvent('input', { inputType: 'insertText', data: char, bubbles: true }));
  }
}
/** Ctrl+V: refused, cleaned by the box, or pasted as it is by the browser. */
function paste(input: HTMLInputElement, text: string) {
  const event = new Event('paste', { cancelable: true, bubbles: true });
  Object.defineProperty(event, 'clipboardData', { value: { getData: () => text } });
  if (!input.dispatchEvent(event)) return;
  const start = input.selectionStart ?? input.value.length;
  input.setRangeText(text, start, input.selectionEnd ?? start, 'end');
  input.dispatchEvent(new InputEvent('input', { inputType: 'insertFromPaste', bubbles: true }));
}
/** Text dropped on the box where the caret is. */
function drop(input: HTMLInputElement, text: string) {
  const event = new Event('drop', { cancelable: true, bubbles: true });
  Object.defineProperty(event, 'dataTransfer', { value: { getData: () => text } });
  if (!input.dispatchEvent(event)) return;
  const start = input.selectionStart ?? input.value.length;
  input.setRangeText(text, start, input.selectionEnd ?? start, 'end');
  input.dispatchEvent(new InputEvent('input', { inputType: 'insertFromDrop', bubbles: true }));
}
/** An IME's composition, which no page can stop: its text lands, then it ends. */
function compose(input: HTMLInputElement, text: string) {
  input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
  input.dispatchEvent(new InputEvent('beforeinput', { inputType: 'insertCompositionText', data: text, bubbles: true }));
  const start = input.selectionStart ?? input.value.length;
  input.setRangeText(text, start, input.selectionEnd ?? start, 'end');
  input.dispatchEvent(new InputEvent('input', { inputType: 'insertCompositionText', data: text, isComposing: true, bubbles: true }));
  input.dispatchEvent(new CompositionEvent('compositionend', { data: text, bubbles: true }));
}
/** An edit of `type` (a correction, Undo, a deletion): whether the box let it land. */
function edit(input: HTMLInputElement, type: string, data: string | null = null) {
  const event = new InputEvent('beforeinput', { inputType: type, data, cancelable: true, bubbles: true });
  return input.dispatchEvent(event);
}
const hintSays = () => {
  const hint = [...document.querySelectorAll<HTMLElement>('.fd-refusal-hint')].find((h) => !h.hidden);
  return hint ? hint.textContent : null;
};
const leave = (input: HTMLInputElement) => input.blur();
function enter(input: HTMLInputElement) {
  input.focus();
  input.setSelectionRange(0, input.value.length);
}

/** A box of a kind, with what is typed into it before a refused key, that key, and what is pasted after it. */
const KINDS = [
  ['a line of words, at its most', { type: 'char', size: 5 }, {}, 'abcde', 'f', 'gh'],
  ['a phone number', { type: 'char' }, { widget: 'phone' }, '0100 5', 'o', '55 1234'],
  ['an email', { type: 'char' }, { widget: 'email' }, 'ahmed', ' ', 'ali@example.com'],
  ['a colour’s code', { type: 'char' }, { widget: 'color' }, '#1', 'x', 'abcdef'],
  ['a whole number', { type: 'integer' }, {}, '1', 'x', '5'],
  ['hours', { type: 'float' }, { widget: 'duration' }, '6', 'x', '30'],
] as const;

const box = (el: HTMLElement) => (el.matches('input') ? el : (el.querySelector('input.fd-colour-code') ?? el.querySelector('input'))) as HTMLInputElement;

describe.each(KINDS)('%s: the keys held after a refused one', (_, field, node, before, refused, after) => {
  it('take a paste made where they wait: it joins them, said again, and the box is left with all of it, refused', () => {
    const { el, form, value } = mountKind(field, node);
    const input = box(el);
    enter(input);
    keys(input, before + refused);
    const words = hintSays();
    expect(words).not.toBeNull();
    paste(input, after);
    // Nothing landed beside the text typed before the refused key.
    expect(input.value).toBe(before);
    expect(hintSays()).toBe(words);
    leave(input);
    expect(input.value).toBe(before + refused + after);
    expect(form.validate()).toBe(false);
    expect(value()).not.toBe(`${before}${after}`);
  });

  it('take a drop made where they wait, as a paste', () => {
    const { el, form } = mountKind(field, node);
    const input = box(el);
    enter(input);
    keys(input, before + refused);
    drop(input, after);
    expect(input.value).toBe(before);
    leave(input);
    expect(input.value).toBe(before + refused + after);
    expect(form.validate()).toBe(false);
  });

  it('take what an IME composes where they wait: put back, and held with them', () => {
    const { el, form } = mountKind(field, node);
    const input = box(el);
    enter(input);
    keys(input, before + refused);
    const words = hintSays();
    compose(input, after);
    expect(input.value).toBe(before);
    expect(hintSays()).toBe(words);
    leave(input);
    expect(input.value).toBe(before + refused + after);
    expect(form.validate()).toBe(false);
  });

  it('take what a phone’s keyboard types where they wait, though it cannot be stopped', () => {
    const { el, form } = mountKind(field, node);
    const input = box(el);
    enter(input);
    keys(input, before + refused);
    keys(input, after, false);
    expect(input.value).toBe(before);
    leave(input);
    expect(input.value).toBe(before + refused + after);
    expect(form.validate()).toBe(false);
  });
});

describe('the keys held after a refused one, and the other edits', () => {
  it('a correction a spell checker offers while they wait is refused, with the same words', () => {
    const { el } = mountKind({ type: 'char' }, { widget: 'email' });
    const input = box(el);
    enter(input);
    keys(input, 'ahmed ali');
    const words = hintSays();
    expect(edit(input, 'insertReplacementText', 'Ali')).toBe(false);
    expect(hintSays()).toBe(words);
    leave(input);
    expect(input.value).toBe('ahmed ali');
  });

  it('Undo takes all of them back, and the box holds what it showed', () => {
    const { el, form, value } = mountKind({ type: 'integer' });
    const input = box(el);
    enter(input);
    keys(input, '1x5');
    expect(edit(input, 'historyUndo')).toBe(false);
    expect(hintSays()).toBeNull();
    leave(input);
    expect(input.value).toBe('1');
    expect(value()).toBe(1);
    expect(form.getState().unread['x']).toBeUndefined();
  });

  it('a word taken back takes them back too', () => {
    const { el, value } = mountKind({ type: 'integer' });
    const input = box(el);
    enter(input);
    keys(input, '1x5');
    expect(edit(input, 'deleteWordBackward')).toBe(false);
    leave(input);
    expect(value()).toBe(1);
  });

  it('a deletion after the caret lands, and they still wait where they were', () => {
    const { el, form, value } = mountKind({ type: 'integer' });
    const input = box(el);
    enter(input);
    keys(input, '129');
    input.setSelectionRange(2, 2);
    keys(input, 'x');
    expect(input.value).toBe('129');
    // Delete: the 9 after the caret goes, as it would have.
    expect(edit(input, 'deleteContentForward')).toBe(true);
    input.setRangeText('', 2, 3, 'end');
    input.dispatchEvent(new InputEvent('input', { inputType: 'deleteContentForward', bubbles: true }));
    expect(input.value).toBe('12');
    expect(hintSays()).not.toBeNull();
    leave(input);
    expect(input.value).toBe('12x');
    // The field keeps what it held as the box was entered; the text, unread, says why.
    expect(value()).toBeNull();
    expect(form.getState().unread['x']?.text).toBe('12x');
  });

  it('a paste refused on its own is refused there too, the keys still held', () => {
    const { el } = mountKind({ type: 'char' }, { widget: 'color' });
    const input = box(el);
    enter(input);
    keys(input, '#1x');
    paste(input, 'rebeccapurple');
    expect(input.value).toBe('#1');
    leave(input);
    expect(input.value).toBe('#1x');
  });
});
