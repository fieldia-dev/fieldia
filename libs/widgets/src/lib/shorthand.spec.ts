import type { Locale } from '@fieldia/core';
import { readShort } from './input-rules';
import { WIDGET_LABELS } from './labels';
import { shorthandFor } from './shorthand';
import { mountKind } from './test-kinds';

/**
 * Amounts typed in shorthand (`options.shorthand`): "3.5m", "500k", "1.2bn", "٣٫٥ مليون", "3,5 Mio." — read by the
 * number reader in the page's way, the word as the power of ten it names, worked out on the digits; said under the
 * box while it is typed and shown whole at rest; a key no number nor shorthand has refused, saying so.
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
const hintSays = () => [...document.querySelectorAll<HTMLElement>('.fd-refusal-hint')].find((h) => !h.hidden)?.textContent ?? null;
const read = (text: string, locale: Locale = 'en') => {
  const reading = readShort(text, { locale, shorthand: shorthandFor(locale, WIDGET_LABELS[locale]) });
  return reading.ok ? reading.value : reading.problem;
};

describe('amounts in shorthand', () => {
  it('reads the letters typed the world over, and the page’s own words for thousands and millions', () => {
    expect(read('3.5m')).toBe(3_500_000);
    expect(read('3.5 M')).toBe(3_500_000);
    expect(read('500k')).toBe(500_000);
    expect(read('1.2bn')).toBe(1_200_000_000);
    expect(read('2 million')).toBe(2_000_000);
    expect(read('1.1m')).toBe(1_100_000);
    expect(read('1.2345k')).toBe(1234.5);
    expect(read('0.5k')).toBe(500);
    expect(read('-2k')).toBe(-2000);
    expect(read('1,250')).toBe(1250);
    expect(read('٣٫٥ مليون', 'ar')).toBe(3_500_000);
    expect(read('٥٠٠ ألف', 'ar')).toBe(500_000);
    expect(read('3 ملايين', 'ar')).toBe(3_000_000);
    expect(read('3,5 Mio.', 'de')).toBe(3_500_000);
    expect(read('2 Milliarden', 'de')).toBe(2_000_000_000);
    expect(read('1,5 Md', 'fr')).toBe(1_500_000_000);
    expect(read('3.5 zillion')).toBe('numbersOnly');
  });

  it('is typed in an amount’s box, said as it reads, and shown whole once left', () => {
    const { el, value } = mountKind({ type: 'monetary', label: 'Price', currency: 'EGP' }, { options: { shorthand: true } });
    const box = (el.matches('input') ? el : el.querySelector('input')) as HTMLInputElement;
    box.focus();
    keys(box, '3.5m');
    expect(value()).toBe(3_500_000);
    expect(document.querySelector('.fd-shorthand-said')?.textContent).toBe('3.5m is 3,500,000.00');
    expect(document.querySelector('.fd-shorthand-said')?.getAttribute('role')).toBe('status');
    box.blur();
    expect((document.querySelector('.fd-shorthand-said') as HTMLElement).hidden).toBe(true);
    expect(box.value).toMatch(/3,500,000\.00/);
  });

  it('lets a word on its way be typed, and refuses a letter no shorthand begins with, saying so', () => {
    const { el, value } = mountKind({ type: 'float', label: 'Budget' }, { options: { shorthand: true } });
    const box = (el.matches('input') ? el : el.querySelector('input')) as HTMLInputElement;
    box.focus();
    keys(box, '2 mil');
    expect(box.value).toBe('2 mil');
    keys(box, 'lion');
    expect(value()).toBe(2_000_000);
    box.select();
    keys(box, '5x');
    expect(box.value).toBe('5');
    expect(hintSays()).toBe('Budget: numbers only, or short for thousands and millions, like 3.5M');
  });

  it('takes an amount pasted in shorthand', () => {
    const { el, value } = mountKind({ type: 'integer', label: 'Seats' }, { options: { shorthand: true } });
    const box = (el.matches('input') ? el : el.querySelector('input')) as HTMLInputElement;
    box.focus();
    paste(box, '12k');
    expect(value()).toBe(12_000);
  });

  it('is the plain number box where the node says nothing', () => {
    const { el } = mountKind({ type: 'float', label: 'Budget' });
    const box = (el.matches('input') ? el : el.querySelector('input')) as HTMLInputElement;
    box.focus();
    keys(box, '3m');
    expect(box.value).toBe('3');
  });
});
