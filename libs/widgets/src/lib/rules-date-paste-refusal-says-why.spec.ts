import { mountKind } from './test-kinds';

/**
 * Found by the 0.23 input-rules check (dates), MINOR. A whole date or time pasted that does not read is refused with
 * the generic "“…” is not a date, so it was not pasted" (date-box.ts dateRules.paste), though its reader knows why: 31/02
 * typed says "February 2026 has 28 days", 13 as a month "months go from 1 to 12", a time with seconds "is not a time;
 * write it like 14:30". Only a two-digit year and a date and time's time get their own words. A time of day's box
 * calls what it refused "not a date". Rule: refuse, and say why.
 */

function paste(input: HTMLInputElement, text: string) {
  const event = new Event('paste', { cancelable: true, bubbles: true });
  Object.defineProperty(event, 'clipboardData', { value: { getData: () => text } });
  if (!input.dispatchEvent(event)) return;
  const start = input.selectionStart ?? input.value.length;
  input.setRangeText(text, start, input.selectionEnd ?? start, 'end');
  input.dispatchEvent(new InputEvent('input', { inputType: 'insertFromPaste', bubbles: true }));
}
const hintSays = () => [...document.querySelectorAll<HTMLElement>('.fd-refusal-hint')].find((h) => !h.hidden)?.textContent ?? null;

describe('a whole date or time pasted that does not read', () => {
  it.each([
    [{ type: 'date' }, {}, '31/02/2026', 'February 2026 has 28 days'],
    [{ type: 'date' }, {}, '15/13/2026', 'months go from 1 to 12'],
    [{ type: 'char' }, { widget: 'time' }, '14:30:45', 'is not a time'],
  ] as const)('%j: "%s" is refused saying why (%s)', (field, node, pasted, why) => {
    const { el, value } = mountKind({ label: 'Start', ...field }, node);
    const input = (el.matches('input') ? el : el.querySelector('input')) as HTMLInputElement;
    input.focus();
    paste(input, pasted);
    expect({ value: value() ?? null, says: hintSays() }).toEqual({ value: null, says: expect.stringContaining(why) });
  });

  it('a time of day’s box never calls what it refused a date', () => {
    const { el } = mountKind({ label: 'Arrival', type: 'char' }, { widget: 'time' });
    const input = el.querySelector('input') ?? (el as HTMLInputElement);
    input.focus();
    paste(input as HTMLInputElement, 'half past two');
    expect(hintSays()).not.toMatch(/not a date/);
  });
});
