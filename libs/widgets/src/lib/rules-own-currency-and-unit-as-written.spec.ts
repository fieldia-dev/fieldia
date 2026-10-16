import type { FieldNode, Locale } from '@fieldia/core';
import { mountKind } from './test-kinds';

/**
 * Found by the 0.23 input-rules check (number boxes). MINOR. "Accept every right way to write a value": an amount
 * pasted with the box's own currency is taken (core `cleanPastedNumber`), but only as Intl spells that currency — its
 * code in capitals and the symbols Intl gives in the page's language, English and Arabic. The ways people in Egypt and
 * Jordan write their own currency on an invoice are refused:
 *   - "LE 1,500" / "1,500 L.E." in a box of Egyptian pounds, "JD 12.345" in a box of Jordanian dinars: "is not a number";
 *   - "د.ا. 12.345" (the dinar's Arabic sign typed with a bare alef, as most keyboards type it) in dinars: refused as
 *     another currency — "Budget is in JOD, and this amount is in د.ا." — though it is the box's own;
 *   - "12 usd" in dollars, the code in small letters: "is not a number".
 * The same for a box's own unit: "12 kg" pasted into a weight whose box says "kg" is "not a number", and hours typed
 * "6.5h" (the h that "6h" and "6h30" may have) are kept unread.
 */

/** Ctrl+V: refused, cleaned by the box, or pasted as it is by the browser. */
function paste(input: HTMLInputElement, text: string) {
  const event = new Event('paste', { cancelable: true, bubbles: true });
  Object.defineProperty(event, 'clipboardData', { value: { getData: () => text } });
  if (!input.dispatchEvent(event)) return;
  const start = input.selectionStart ?? input.value.length;
  input.setRangeText(text, start, input.selectionEnd ?? start, 'end');
  input.dispatchEvent(new InputEvent('input', { inputType: 'insertFromPaste', bubbles: true }));
}

/** Keys typed one by one: a beforeinput the box may refuse, then the character, then input. */
function keys(input: HTMLInputElement, text: string) {
  for (const char of [...text]) {
    if (!input.dispatchEvent(new InputEvent('beforeinput', { inputType: 'insertText', data: char, cancelable: true, bubbles: true }))) continue;
    const start = input.selectionStart ?? input.value.length;
    input.setRangeText(char, start, input.selectionEnd ?? start, 'end');
    input.dispatchEvent(new InputEvent('input', { inputType: 'insertText', data: char, bubbles: true }));
  }
}

const hintSays = () => {
  const hint = document.querySelector('.fd-refusal-hint') as HTMLElement | null;
  return hint && !hint.hidden ? hint.textContent : null;
};

/** A field's box on a page in `locale`, entered. */
function box(field: Record<string, unknown>, node: Partial<FieldNode> = {}, locale: Locale = 'en') {
  const mounted = mountKind({ label: 'Budget', ...field }, node, { locale });
  const input = (mounted.el.matches('input') ? mounted.el : mounted.el.querySelector('input.fd-number-input')) as HTMLInputElement;
  input.focus();
  input.dispatchEvent(new Event('focus'));
  return { ...mounted, input };
}

describe('an amount pasted with its own currency, as people write it', () => {
  it.each([
    ['EGP', 'LE 1,500', 1500],
    ['EGP', '1,500 L.E.', 1500],
    ['JOD', 'JD 12.345', 12.345],
    ['JOD', 'د.ا. 12.345', 12.345],
    ['USD', '12 usd', 12],
  ] as const)('%s: "%s" is %s', (currency, pasted, expected) => {
    const { input, value } = box({ type: 'monetary', currency });
    paste(input, pasted);
    expect({ value: value() ?? null, said: hintSays() }).toEqual({ value: expected, said: null });
  });
});

describe('a value pasted or typed with the box’s own unit', () => {
  it('"12 kg" pasted into a weight whose box says kg is 12', () => {
    const { input, value } = box({ type: 'float', label: 'Boxes', digits: [5, 1] }, { options: { suffix: 'kg' } });
    paste(input, '12 kg');
    expect({ value: value() ?? null, said: hintSays() }).toEqual({ value: 12, said: null });
  });

  it('hours typed "6.5h" are six and a half hours, as "6h" is six', () => {
    const { input, form, value } = box({ type: 'float', label: 'Hours' }, { widget: 'duration' });
    keys(input, '6.5h');
    input.dispatchEvent(new Event('change', { bubbles: true }));
    expect({ value: value() ?? null, unread: form.getState().unread?.['x']?.message ?? null }).toEqual({ value: 6.5, unread: null });
  });
});
