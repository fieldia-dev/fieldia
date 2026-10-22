import { mountKind } from './test-kinds';

/**
 * A text box typed to a mask, and a one-time code's boxes, typed and pasted as a person does: a key is a beforeinput
 * the box may refuse, then the character at the caret, then input; a paste is a paste event the box may refuse or
 * clean. What does not fit is refused with why, the keys after it held; what is not whole yet is kept as typed when the
 * box is left, the field holding what it held.
 */

function keys(input: HTMLInputElement, text: string) {
  for (const char of [...text]) {
    const before = new InputEvent('beforeinput', { inputType: 'insertText', data: char, cancelable: true, bubbles: true });
    if (!input.dispatchEvent(before)) continue;
    const start = input.selectionStart ?? input.value.length;
    input.setRangeText(char, start, input.selectionEnd ?? start, 'end');
    input.dispatchEvent(new InputEvent('input', { inputType: 'insertText', data: char, bubbles: true }));
  }
}
function backspace(input: HTMLInputElement) {
  const before = new InputEvent('beforeinput', { inputType: 'deleteContentBackward', cancelable: true, bubbles: true });
  if (!input.dispatchEvent(before)) return;
  const at = input.selectionStart ?? input.value.length;
  input.setRangeText('', Math.max(0, at - 1), input.selectionEnd ?? at, 'end');
  input.dispatchEvent(new InputEvent('input', { inputType: 'deleteContentBackward', bubbles: true }));
}
function paste(input: HTMLInputElement, text: string) {
  const event = new Event('paste', { cancelable: true, bubbles: true });
  Object.defineProperty(event, 'clipboardData', { value: { getData: () => text } });
  if (!input.dispatchEvent(event)) return;
  const start = input.selectionStart ?? input.value.length;
  input.setRangeText(text, start, input.selectionEnd ?? start, 'end');
  input.dispatchEvent(new InputEvent('input', { inputType: 'insertFromPaste', bubbles: true }));
}
const hintSays = () => [...document.querySelectorAll<HTMLElement>('.fd-refusal-hint')].find((h) => !h.hidden)?.textContent?.replace(/[⁦-⁩]/g, '') ?? null;
const boxOf = (el: HTMLElement) => (el.matches('input') ? el : el.querySelector('input')) as HTMLInputElement;

describe('a text box typed to a mask', () => {
  const nationalId = () => mountKind({ type: 'char', label: 'National ID' }, { options: { mask: '9 999999 99 99999' } });

  it('writes the mask’s own characters in as the person types, and takes the value once it is whole', () => {
    const { el, value } = nationalId();
    const box = boxOf(el);
    expect(box.placeholder).toBe('_ ______ __ _____');
    expect(box.getAttribute('inputmode')).toBe('numeric');
    box.focus();
    keys(box, '2901011');
    expect(box.value).toBe('2 901011 ');
    expect(value() ?? null).toBeNull();
    keys(box, '2345678');
    expect(box.value).toBe('2 901011 23 45678');
    expect(value()).toBe('29010112345678');
  });

  it('refuses a key no slot takes there, saying why, and holds the keys after it', () => {
    const { el, form } = nationalId();
    const box = boxOf(el);
    box.focus();
    keys(box, '29o1');
    expect(box.value).toBe('2 9');
    expect(hintSays()).toBe('National ID: a digit goes here, not “o”');
    box.blur();
    expect(form.getState().unread['x']?.message.replace(/[\u2066-\u2069]/g, '')).toBe('National ID: a digit goes here, not “o”');
  });

  it('keeps what is not whole yet when left, with how many are still to type', () => {
    const { el, value, form } = nationalId();
    const box = boxOf(el);
    box.focus();
    keys(box, '290101');
    box.blur();
    expect(value() ?? null).toBeNull();
    expect(form.getState().unread['x']).toEqual({ text: '2 90101', message: 'National ID is not whole yet: 8 more to type' });
    expect(box.value).toBe('2 90101');
    expect(box.getAttribute('aria-invalid')).toBe('true');
  });

  it('takes Backspace over one of its own characters as the character typed before it', () => {
    const { el } = nationalId();
    const box = boxOf(el);
    box.focus();
    keys(box, '2901011');
    backspace(box);
    expect(box.value).toBe('2 90101');
  });

  it('lays a paste out against it, and refuses one that does not fit, saying why', () => {
    const { el, value } = mountKind({ type: 'char', label: 'IBAN' }, { options: { mask: 'aa99 **** **** **** **** **[** **** **** **]', upper: true } });
    const box = boxOf(el);
    box.focus();
    paste(box, 'eg38 0019 0005 0000 0000 2631 8000 2');
    expect(box.value).toBe('EG38 0019 0005 0000 0000 2631 8000 2');
    expect(value()).toBe('EG380019000500000000263180002');
    box.select();
    paste(box, '1234');
    expect(hintSays()).toBe('IBAN: a letter goes here, not “1”');
    expect(value()).toBe('EG380019000500000000263180002');
  });

  it('keeps the mask’s own characters where it says, and shows a value from outside as it came where it does not fit', () => {
    const plate = mountKind({ type: 'char', label: 'Plate' }, { options: { mask: '9999 aaa', upper: true, maskKeeps: 'shown' } });
    const box = boxOf(plate.el);
    box.focus();
    keys(box, '1234abc');
    expect(plate.value()).toBe('1234 ABC');
    const odd = mountKind({ type: 'char', label: 'Plate', default: 'old plate' }, { options: { mask: '9999 aaa' } });
    expect(boxOf(odd.el).value).toBe('old plate');
  });
});

describe('a one-time code’s boxes', () => {
  const code = (options: Record<string, number | boolean> = {}) => mountKind({ type: 'char', label: 'Code' }, { widget: 'one-time-code', options });

  it('draws a box for each digit over one text box the phone fills in whole', () => {
    const { el } = code();
    const box = boxOf(el);
    expect(el.querySelectorAll('.fd-code-cell')).toHaveLength(6);
    expect(box.getAttribute('autocomplete')).toBe('one-time-code');
    expect(box.getAttribute('inputmode')).toBe('numeric');
    expect(document.getElementById(`${box.id}-size`)?.textContent).toBe('6 digits');
    expect(box.getAttribute('aria-describedby')).toContain(`${box.id}-size`);
  });

  it('fills a box a digit at a time, and takes the code once it is whole', () => {
    const { el, value } = code();
    const box = boxOf(el);
    box.focus();
    keys(box, '123');
    expect([...el.querySelectorAll('.fd-code-cell')].map((cell) => cell.textContent)).toEqual(['1', '2', '3', '', '', '']);
    expect(el.querySelectorAll('.fd-code-cell')[3].classList.contains('fd-code-caret')).toBe(true);
    expect(value() ?? null).toBeNull();
    keys(box, '456');
    expect(value()).toBe('123456');
  });

  it('refuses a letter and a seventh digit, saying why', () => {
    const { el } = code();
    const box = boxOf(el);
    box.focus();
    keys(box, '12a');
    expect(hintSays()).toBe('Code: the code is digits only, not “a”');
    box.blur();
    box.focus();
    box.value = '';
    box.dispatchEvent(new InputEvent('input', { bubbles: true }));
    keys(box, '1234567');
    expect(box.value).toBe('123456');
    expect(hintSays()).toBe('Code has 6 digits: there is no room for more');
  });

  it('takes a whole code pasted with its spaces or dashes, in any script’s digits', () => {
    const { el, value } = code();
    const box = boxOf(el);
    box.focus();
    paste(box, '١٢٣-٤٥٦');
    expect(box.value).toBe('123456');
    expect(value()).toBe('123456');
  });

  it('keeps a code not whole when left, with how many are still to type; letters too where it says', () => {
    const { el, form } = code({ length: 4, letters: true });
    const box = boxOf(el);
    expect(el.querySelectorAll('.fd-code-cell')).toHaveLength(4);
    expect(box.getAttribute('inputmode')).toBeNull();
    box.focus();
    keys(box, 'ab');
    expect(box.value).toBe('AB');
    box.blur();
    expect(form.getState().unread['x']).toEqual({ text: 'AB', message: 'Code is not whole yet: 2 more to type' });
  });
});
