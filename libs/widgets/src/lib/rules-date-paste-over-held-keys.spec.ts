import { mountKind } from './test-kinds';

/**
 * Found by the 0.23 input-rules check (dates). The hold (docs/plans/input-rules.md §3): a paste where keys wait after a
 * refused one "joins them, the words said again: never lands beside the text typed before the refused key". In a date
 * or a time box, a paste that reads as a whole date (or time) is put "in the box's place" by dateRules.paste, which
 * chooses all the box's text first — so `holding()` no longer holds and the paste replaces the box: "1x" typed (the
 * x refused and held, "1" in the box) then "5/10/2026" pasted is 5 October, the "1" and the "x" gone and nothing said.
 * Keys typed are lost and the day taken is one the person never wrote. An email, a phone number join the paste to the
 * held keys and keep all of it ("ahmed ali@example.com").
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
function paste(input: HTMLInputElement, text: string) {
  const event = new Event('paste', { cancelable: true, bubbles: true });
  Object.defineProperty(event, 'clipboardData', { value: { getData: () => text } });
  if (!input.dispatchEvent(event)) return;
  const start = input.selectionStart ?? input.value.length;
  input.setRangeText(text, start, input.selectionEnd ?? start, 'end');
  input.dispatchEvent(new InputEvent('input', { inputType: 'insertFromPaste', bubbles: true }));
}

describe('a whole date or time pasted where keys wait after a refused one', () => {
  it.each([
    [{ type: 'date' }, {}, '1x', '5/10/2026'],
    [{ type: 'datetime' }, {}, '1x', '5/10/2026 14:30'],
    [{ type: 'char' }, { widget: 'time' }, '1x', '4:30'],
  ] as const)('%j: typed %s then pasted %s — joins the keys held, all of it kept unread; never only the paste', (field, node, typed, pasted) => {
    const { form, el } = mountKind({ label: 'Start', ...field }, node);
    const input = (el.matches('input') ? el : el.querySelector('input')) as HTMLInputElement;
    input.focus();
    keys(input, typed);
    expect(input.value).toBe('1');
    paste(input, pasted);
    input.blur();
    const state = form.getState();
    expect({ value: state.values['x'] ?? null, unread: state.unread?.['x']?.text, box: input.value }).toEqual({ value: null, unread: `${typed}${pasted}`, box: `${typed}${pasted}` });
  });
});
