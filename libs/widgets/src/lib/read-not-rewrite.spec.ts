import { createForm, type Field, type FieldNode, type Page } from '@fieldia/core';
import { keptExactly, readJson } from './json-problem';
import { readDateText } from './date-text';
import { mountKind } from './test-kinds';
import { createWidget } from './widgets';

/**
 * A box reads what was typed and never rewrites what was not (0.23 input-rules check): hours and a per cent passed
 * through keep their value (47d8fb1); hours typed in a field of two places are kept to them (04df331), and decimal
 * hours are said (2e9f1b2); an amount is read again when its currency changes (e3af23b); JSON numbers are never changed
 * (01934c2); a date and time is read in the zone it is typed in (873c32f).
 */

const focusAndLeave = (input: HTMLInputElement) => {
  input.focus();
  input.dispatchEvent(new Event('change', { bubbles: true }));
  input.blur();
};
const keys = (input: HTMLInputElement, text: string) => {
  for (const char of text) {
    if (!input.dispatchEvent(new InputEvent('beforeinput', { inputType: 'insertText', data: char, cancelable: true, bubbles: true }))) continue;
    const start = input.selectionStart ?? input.value.length;
    input.setRangeText(char, start, input.selectionEnd ?? start, 'end');
    input.dispatchEvent(new InputEvent('input', { inputType: 'insertText', data: char, bubbles: true }));
  }
};
const hintSays = () => [...document.querySelectorAll<HTMLElement>('.fd-refusal-hint')].find((hint) => !hint.hidden)?.textContent ?? null;

describe('hours and a per cent passed through', () => {
  it.each([
    [{ type: 'float' }, 'duration', 6.51, '06:31'],
    [{ type: 'float' }, 'percentage', 0.123456, '12.35'],
  ] as const)('%j %s: %s, shown "%s", stays as it came when the box is entered and left', (field, widget, value, shown) => {
    const { form, el } = mountKind(field, { widget });
    form.setValue('x', value);
    const input = (el.matches('input') ? el : el.querySelector('input')) as HTMLInputElement;
    expect(input.value).toBe(shown);
    focusAndLeave(input);
    expect(form.getState().values['x']).toBe(value);
  });

  it('typed away and back to what it showed, the value is the one it came with', () => {
    const { form, el } = mountKind({ type: 'float' }, { widget: 'duration' });
    form.setValue('x', 6.51);
    const input = el as HTMLInputElement;
    input.focus();
    // Backspace, then the 1 typed again: "06:31" as it showed, never read back as 6.5167.
    input.value = '06:3';
    input.dispatchEvent(new InputEvent('input', { inputType: 'deleteContentBackward', bubbles: true }));
    keys(input, '1');
    expect(input.value).toBe('06:31');
    input.blur();
    expect(form.getState().values['x']).toBe(6.51);
  });
});

describe('hours typed', () => {
  it('in a field of two places are kept to them, to the minute: "6:20" is 6.33, still 06:20', () => {
    const { form, el } = mountKind({ type: 'float', digits: [16, 2] }, { widget: 'duration' });
    const input = el as HTMLInputElement;
    input.focus();
    keys(input, '6:20');
    input.blur();
    expect({ value: form.getState().values['x'], shown: input.value, problem: form.problem('x') }).toEqual({ value: 6.33, shown: '06:20', problem: null });
  });

  it('with a point and two digits are hours with a decimal, and said so once read', () => {
    const { form, el } = mountKind({ type: 'float', label: 'Hours' }, { widget: 'duration' });
    const input = el as HTMLInputElement;
    input.focus();
    keys(input, '6.45');
    input.blur();
    expect({ value: form.getState().values['x'], shown: input.value }).toEqual({ value: 6.45, shown: '06:27' });
    expect(hintSays()).toBe('Hours: “⁨6.45⁩” is hours with a decimal: 06:27');
  });
});

describe('a per cent of a field with digits', () => {
  it('counts the places of the per cent typed, as its box does: 12.5 % of digits [5, 2] is no problem', () => {
    const { form, el } = mountKind({ type: 'float', label: 'Cut', digits: [5, 2] }, { widget: 'percentage' });
    const input = el.querySelector('input') as HTMLInputElement;
    input.focus();
    keys(input, '12.5');
    input.blur();
    expect({ value: form.getState().values['x'], problem: form.problem('x') }).toEqual({ value: 0.125, problem: null });
  });
});

describe('money read again when its currency changes', () => {
  const fields: Record<string, Field> = {
    budget: { type: 'monetary', label: 'Budget', currencyField: 'cur' },
    cur: { type: 'many2one', label: 'Currency', relation: 'res.currency' },
  };
  const page = { fieldia: '0.1', id: 'p', data: { kind: 'responses' }, fields, layout: { type: 'sections', id: 's', children: [] } } as unknown as Page;
  function money(values: Record<string, unknown>) {
    const form = createForm({ page, values: values as never });
    const node = { type: 'field', id: 'f', field: 'budget' } as FieldNode;
    const widget = createWidget({ form, name: 'budget', field: fields['budget'], node, id: 'w', document });
    document.body.replaceChildren(widget.element);
    form.subscribe(() => widget.update({ value: form.getState().values['budget'], values: form.getState().values, readonly: false, required: false, invalid: false }));
    widget.update({ value: form.getState().values['budget'], values: form.getState().values, readonly: false, required: false, invalid: false });
    return { form, input: document.querySelector('input') as HTMLInputElement };
  }
  const settle = () => new Promise((done) => setTimeout(done, 0));

  it('"12.345" typed in dinars, the currency changed to pounds: kept unread, with why, so no save takes it', async () => {
    const { form, input } = money({ budget: 100, cur: { id: 1, label: 'JOD' } });
    input.focus();
    input.select();
    keys(input, '12.345');
    input.blur();
    expect(form.getState().values['budget']).toBe(12.345);
    form.setValue('cur', { id: 2, label: 'EGP' });
    await settle();
    expect(form.getState().unread['budget']).toEqual({ text: '12.345', message: 'Budget takes at most 2 decimal places' });
    expect(input.value).toBe('12.345');
    expect(await form.save()).toBe(false);
    // Back to dinars: it reads again, and nothing is left unread.
    form.setValue('cur', { id: 1, label: 'JOD' });
    await settle();
    expect({ value: form.getState().values['budget'], unread: form.getState().unread['budget'] ?? null }).toEqual({ value: 12.345, unread: null });
  });

  it('"12.345" kept unread in pounds reads once the currency is changed to dinars', async () => {
    const { form, input } = money({ budget: 100, cur: { id: 2, label: 'EGP' } });
    input.focus();
    input.select();
    keys(input, '12.34');
    input.value = '12.345';
    input.blur();
    expect(form.getState().unread['budget']?.text).toBe('12.345');
    form.setValue('cur', { id: 1, label: 'JOD' });
    await settle();
    expect({ value: form.getState().values['budget'], unread: form.getState().unread['budget'] ?? null }).toEqual({ value: 12.345, unread: null });
  });

  it('a value from outside is never read again: only what was typed', async () => {
    const { form } = money({ budget: 12.345, cur: { id: 1, label: 'JOD' } });
    form.setValue('cur', { id: 2, label: 'EGP' });
    await settle();
    expect({ value: form.getState().values['budget'], unread: form.getState().unread['budget'] ?? null }).toEqual({ value: 12.345, unread: null });
  });
});

describe('JSON numbers kept exactly', () => {
  it.each([
    ['12345678901234567890', false],
    ['1e400', false],
    ['1.00000000000000000001', false],
    ['0.30000000000000004', true],
    ['1.50e2', true],
    ['-0.0', true],
    ['9007199254740993', false],
    ['123456789012345', true],
  ])('%s kept as written: %s', (written, kept) => {
    expect(keptExactly(written)).toBe(kept);
  });

  it('readJson refuses JSON whose number it would change, and reads the rest', () => {
    expect(readJson('{"id": 12345678901234567890}')).toBeUndefined();
    expect(readJson('{"id": "12345678901234567890", "n": 1.5}')).toEqual({ id: '12345678901234567890', n: 1.5 });
    expect(readJson('')).toBeNull();
  });
});

describe('a date and time read in the zone it is typed in', () => {
  const reader = { kind: 'datetime' as const, order: 'dmy' as const, locale: 'en' as const, label: 'Kickoff', zone: 'Europe/Berlin' };

  it('a time the clocks skip is refused, saying what they do', () => {
    expect(readDateText('29/03/2026 02:30', reader)).toEqual({ ok: false, problem: 'skippedTime', words: 'Kickoff: 29/03/2026 02:30 does not happen here: the clocks go from 02:00 to 03:00 that night' });
  });

  it('a time the clocks pass twice is refused, naming each way to write it — and each, written so, is read', () => {
    expect(readDateText('25/10/2026 02:30', reader)).toEqual({ ok: false, problem: 'repeatedTime', words: 'Kickoff: 25/10/2026 02:30 happens twice here as the clocks go back; write 25/10/2026 02:30 +02:00 or 25/10/2026 02:30 +01:00' });
    expect(readDateText('25/10/2026 02:30 +01:00', reader)).toEqual({ ok: true, value: '2026-10-25T01:30:00.000Z' });
  });

  it('an ordinary time is the instant it is in that zone', () => {
    expect(readDateText('15/10/2026 14:30', reader)).toEqual({ ok: true, value: '2026-10-15T12:30:00.000Z' });
  });
});
