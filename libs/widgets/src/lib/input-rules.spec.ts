import { createForm, type Field, type FieldNode, type Locale, type Page } from '@fieldia/core';
import { WIDGET_LABELS } from './labels';
import { mountKind } from './test-kinds';
import { createWidget } from './widgets';

/**
 * The input rules in a box, typed and pasted as a person does: a key is a
 * beforeinput the box may refuse, then the character at the caret, then
 * input; a paste is a paste event the box may refuse or clean.
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

/** Backspace: a beforeinput the box may take for itself (keys held), else the character before the caret goes. */
function backspace(input: HTMLInputElement) {
  const before = new InputEvent('beforeinput', { inputType: 'deleteContentBackward', cancelable: true, bubbles: true });
  if (!input.dispatchEvent(before)) return;
  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? start;
  input.setRangeText('', start === end ? Math.max(0, start - 1) : start, end, 'end');
  input.dispatchEvent(new InputEvent('input', { inputType: 'deleteContentBackward', bubbles: true }));
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

/** An IME's composition, which cannot be refused before it lands. */
function compose(input: HTMLInputElement, text: string) {
  input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
  const start = input.selectionStart ?? input.value.length;
  input.setRangeText(text, start, input.selectionEnd ?? start, 'end');
  input.dispatchEvent(new InputEvent('input', { inputType: 'insertCompositionText', data: text, isComposing: true, bubbles: true }));
  input.dispatchEvent(new CompositionEvent('compositionend', { data: text, bubbles: true }));
}

const enter = (input: HTMLInputElement) => {
  input.focus();
  input.dispatchEvent(new Event('focus'));
};
const leave = (input: HTMLInputElement) => {
  input.blur();
  input.dispatchEvent(new Event('blur'));
};
const selectAll = (input: HTMLInputElement) => input.setSelectionRange(0, input.value.length);
const boxOf = (el: HTMLElement) => (el.matches('input') ? el : el.querySelector('input')) as HTMLInputElement;
const hintOf = () => document.querySelector('.fd-refusal-hint') as HTMLElement | null;
const hintSays = () => {
  const hint = hintOf();
  return hint && !hint.hidden ? hint.textContent : null;
};

/** A number field on a page in `locale`, its box entered. */
function numberBox(field: Record<string, unknown>, node: Partial<FieldNode> = {}, locale: Locale = 'en') {
  const mounted = mountKind({ label: 'Seats', ...field }, node, { locale, ...(locale === 'ar' ? { dir: 'rtl' as const } : {}) });
  const input = boxOf(mounted.el);
  enter(input);
  return { ...mounted, input };
}

describe('a number box refuses what can never be part of a number', () => {
  it.each([
    ['en', 'Seats: numbers only'],
    ['ar', 'Seats: أرقام فقط'],
    ['fr', 'Seats : des nombres uniquement'],
    ['de', 'Seats: nur Zahlen'],
  ] as const)('%s: letters, emoji and symbols never land, and a hint says why', (locale, said) => {
    const { input, value } = numberBox({ type: 'integer' }, {}, locale);
    keys(input, '12abc');
    expect(input.value).toBe('12');
    expect(value()).toBe(12);
    expect(hintSays()).toBe(said);
    for (const text of ['😀', '#', 'e', 'x']) keys(input, text);
    expect(input.value).toBe('12');
  });

  it('says it in a polite live region, named by the box, gone at the next key taken and when the box is left', () => {
    const { input } = numberBox({ type: 'integer' });
    keys(input, 'a');
    const hint = hintOf() as HTMLElement;
    expect(hint.getAttribute('role')).toBe('status');
    expect(hint.getAttribute('aria-live')).toBe('polite');
    expect(input.getAttribute('aria-describedby')).toContain(hint.id);
    // Right under the box, never a dialog, never a disabled box.
    expect(input.nextElementSibling).toBe(hint);
    expect(input.disabled).toBe(false);
    // Backspace takes the refused key back, as it would have taken back a key that landed; the next key is taken.
    backspace(input);
    expect(hintSays()).toBeNull();
    keys(input, '4');
    expect(input.value).toBe('4');
    expect(hintSays()).toBeNull();
    expect(input.getAttribute('aria-describedby') ?? '').not.toContain(hint.id);
    keys(input, 'b');
    expect(hintSays()).not.toBeNull();
    leave(input);
    expect(hintSays()).toBeNull();
  });

  it('never lets words into the field’s value: it holds a number or nothing, and what was typed is kept, marked', () => {
    const { input, form, value } = numberBox({ type: 'float' });
    for (const text of ['abc', '1e5', '0x1F', '😀']) {
      keys(input, text);
      expect(typeof value() === 'number' || value() === null).toBe(true);
    }
    // Every key after the first letter waited with it: no digit was taken from among the letters.
    expect(input.value).toBe('');
    expect(value()).toBeNull();
    leave(input);
    expect(input.value).toBe('abc1e50x1F😀');
    expect(form.getState().unread['x']?.message).toBe('Seats: “\u2068abc1e50x1F😀\u2069” is not a number');
  });

  it('refuses a minus that is not first, and any minus where the least is 0 or more', () => {
    const free = numberBox({ type: 'float' });
    keys(free.input, '5-');
    expect(free.input.value).toBe('5');
    expect(hintSays()).toBe('The minus sign goes before the number');
    const counted = numberBox({ type: 'integer', min: 1 });
    keys(counted.input, '-');
    expect(counted.input.value).toBe('');
    expect(hintSays()).toBe('Seats must be at least 1');
  });

  it('puts back what an IME or a phone keyboard typed that cannot be part of a number, caret and all', () => {
    const { input, value } = numberBox({ type: 'integer' });
    keys(input, '12');
    input.setSelectionRange(1, 1);
    compose(input, 'ab');
    expect(input.value).toBe('12');
    expect([input.selectionStart, input.selectionEnd]).toEqual([1, 1]);
    expect(value()).toBe(12);
    expect(hintSays()).toBe('Seats: numbers only');
    // Composed where the refused text waits, more waits with it, the words said again: never 1３2 made round it.
    compose(input, '３');
    expect(input.value).toBe('12');
    expect(value()).toBe(12);
    expect(hintSays()).toBe('Seats: numbers only');
    // Backspace takes back what waits, one by one; then digits a composition makes (fullwidth, Arabic) are numbers like any other.
    for (let n = 0; n < 3; n++) backspace(input);
    expect(hintSays()).toBeNull();
    compose(input, '３');
    expect(value()).toBe(132);
  });

  it('lets the keys held and their words go when the field is set from outside while it is typed in (a block pasted on its line)', () => {
    const { input, form } = numberBox({ type: 'float' });
    keys(input, '2.5x');
    expect(input.value).toBe('2.5');
    expect(hintSays()).toBe('Seats: numbers only');
    form.setValue('x', 12);
    expect(input.value).toBe('12.00');
    expect(hintSays()).toBeNull();
    // Left now, what the box shows is the field's: no "x" waiting to come back.
    leave(input);
    expect(form.getState().values['x']).toBe(12);
  });

  it('never refuses deleting', () => {
    const { input } = numberBox({ type: 'float' });
    keys(input, '1,234,567');
    input.setSelectionRange(3, 4);
    input.setRangeText('', 3, 4, 'end');
    input.dispatchEvent(new InputEvent('input', { inputType: 'deleteContentBackward', bubbles: true }));
    expect(input.value).toBe('1,24,567');
  });
});

describe('a number box takes every way a number is written', () => {
  it.each([
    ['ar', '١٢٣٤٫٥', 1234.5],
    ['ar', '۱۲۳', 123],
    ['ar', '١،٥', 1.5],
    ['en', '١٬٢٣٤', 1234],
    ['en', '+5', 5],
    ['en', '\u22125', -5],
    ['en', '５', 5],
    ['en', '1,5', 1.5],
    ['en', '1,500', 1500],
    ['en', '1 234,56', 1234.56],
    ['en', '1.234,56', 1234.56],
    ['de', '1.5', 1.5],
    ['de', '1.500', 1500],
    ['de', '1,234.56', 1234.56],
    ['fr', '1,5', 1.5],
  ] as const)('%s: "%s" is %s', (locale, typed, expected) => {
    const { input, value } = numberBox({ type: 'float' }, {}, locale);
    keys(input, typed);
    expect(value()).toBe(expected);
    // Nothing is rewritten while the box has focus.
    expect(input.value).toBe(typed);
  });

  it('on an Arabic page, a negative number is edited like any other: no direction mark in the box', async () => {
    const { input, form, value } = numberBox({ type: 'integer' }, {}, 'ar');
    leave(input);
    form.setValue('x', -5);
    // At rest it carries the mark Intl writes, so the minus shows before the number right to left.
    expect(input.value).toBe('\u200e-5');
    enter(input);
    await Promise.resolve();
    expect(input.value).toBe('-5');
    input.setSelectionRange(input.value.length, input.value.length);
    keys(input, '0');
    expect(value()).toBe(-50);
    leave(input);
    input.value = '';
    enter(input);
    paste(input, '\u200e-1,500');
    expect(value()).toBe(-1500);
  });

  it('reads the Arabic per cent sign like %, in a percentage box', () => {
    const { input, value } = numberBox({ type: 'float' }, { widget: 'percentage' }, 'ar');
    keys(input, '٢٥٪');
    expect(value()).toBe(0.25);
  });
});

describe('a number box never makes a number of what was typed by dropping a key', () => {
  it.each([
    ['en', '1.5', '1.5', 'Seats must be a whole number'],
    ['en', '.5', '.', 'Seats must be a whole number'],
    ['en', '1e5', '1', 'Seats: “\u20681e5\u2069” is not a number'],
    ['en', '0.500', '0.', 'Seats must be a whole number'],
    ['ar', '١٫٥', '١٫', 'يجب أن يكون Seats رقمًا صحيحًا'],
    ['ar', '٫٥', '٫', 'يجب أن يكون Seats رقمًا صحيحًا'],
    ['fr', '1,5', '1,5', 'Seats doit être un nombre entier'],
    ['fr', '1,234.56', '1,234.', 'Seats doit être un nombre entier'],
    ['fr', '1 234,56', '1 234,56', 'Seats doit être un nombre entier'],
    ['de', '1.234,56', '1.234,', 'Seats muss eine ganze Zahl sein'],
    ['de', '1,234.56', '1,234.', 'Seats muss eine ganze Zahl sein'],
  ] as const)('%s: "%s" in a whole number from 1 is never 15, 3 or 5; left, it stays as typed, marked, with why', (locale, typed, shows, said) => {
    const { input, form, value } = numberBox({ type: 'integer', min: 1 }, {}, locale);
    keys(input, typed);
    // Nothing after a refused key is taken: the box never holds a different number.
    expect(input.value).toBe(shows);
    leave(input);
    expect(input.value).toBe(typed);
    expect(value()).toBeNull();
    expect(form.getState().unread['x']?.message).toBe(said);
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(form.validate()).toBe(false);
  });

  it('"-3" in a whole number from 1 is never 3: left, the field holds -3 as typed, and check says its least', () => {
    const { input, form, value } = numberBox({ type: 'integer', min: 1 });
    keys(input, '-3');
    expect(input.value).toBe('');
    expect(hintSays()).toBe('Seats must be at least 1');
    leave(input);
    expect(input.value).toBe('-3');
    expect(value()).toBe(-3);
    expect(form.validate()).toBe(false);
    expect(form.getState().errors['x']).toBe('Seats must be at least 1');
  });

  it('keeps text left marked when the box is entered and left again, never emptying it', () => {
    const { input, form, value } = numberBox({ type: 'integer', min: 1 });
    keys(input, '1e5');
    leave(input);
    enter(input);
    leave(input);
    expect(input.value).toBe('1e5');
    expect(value()).toBeNull();
    expect(form.getState().unread['x']?.text).toBe('1e5');
  });

  it('keeps the hint while it holds keys, says it again for each, and Backspace takes them back one by one', () => {
    const { input, value } = numberBox({ type: 'integer', min: 1 });
    keys(input, '12');
    keys(input, '-');
    expect(hintSays()).toBe('Seats must be at least 1');
    keys(input, '3');
    expect(input.value).toBe('12');
    expect(hintSays()).toBe('Seats must be at least 1');
    backspace(input);
    expect(hintSays()).toBe('Seats must be at least 1');
    backspace(input);
    expect(hintSays()).toBeNull();
    expect(input.value).toBe('12');
    keys(input, '3');
    expect(input.value).toBe('123');
    expect(value()).toBe(123);
  });

  it('lets the keys held go once the caret moves: what is typed there is judged on its own', () => {
    const { input, form, value } = numberBox({ type: 'integer', min: 1 });
    keys(input, '12a');
    input.setSelectionRange(0, 0);
    keys(input, '3');
    expect(input.value).toBe('312');
    leave(input);
    expect(value()).toBe(312);
    expect(form.getState().unread).toEqual({});
  });
});

describe('a number box keeps to its field', () => {
  it('takes a decimal mark in a whole number, which zeros may follow, and refuses a digit that makes it a fraction', () => {
    const { input, value } = numberBox({ type: 'integer' });
    keys(input, '12.0');
    expect(input.value).toBe('12.0');
    expect(value()).toBe(12);
    const ar = numberBox({ type: 'integer' }, {}, 'ar');
    keys(ar.input, '١٢٫٥');
    expect(ar.input.value).toBe('١٢٫');
    expect(hintSays()).toBe('يجب أن يكون Seats رقمًا صحيحًا');
  });

  it('refuses a place past the field’s, in its plural form, once the mark can only be decimal', () => {
    const area = numberBox({ type: 'float', label: 'Floor area', digits: [10, 1] });
    keys(area.input, '0.34');
    expect(area.input.value).toBe('0.3');
    expect(hintSays()).toBe('Floor area takes at most 1 decimal place');
    const ar = numberBox({ type: 'float', label: 'Rate', digits: [10, 2] }, {}, 'ar');
    keys(ar.input, '1٫234');
    expect(hintSays()).toBe('Rate: منزلتان عشريتان على الأكثر');
  });

  it('says places past the field’s as the box is left, when the mark could still have grouped as they were typed', () => {
    const { input, form, value } = numberBox({ type: 'float', label: 'Floor area', digits: [10, 1] });
    keys(input, '12.34');
    // "12.34" may be on its way to "12.345,6": nothing is refused, and nothing it cannot hold is set.
    expect(input.value).toBe('12.34');
    expect(value()).toBe(12.3);
    leave(input);
    expect(input.value).toBe('12.34');
    expect(value()).toBeNull();
    expect(form.getState().unread['x']?.message).toBe('Floor area takes at most 1 decimal place');
  });

  it('gives money without digits its currency’s places: 3 for the Kuwaiti dinar, 2 for the pound', () => {
    const kwd = numberBox({ type: 'monetary', currency: 'KWD' });
    keys(kwd.input, '1.2345');
    expect(kwd.input.value).toBe('1.234');
    expect(kwd.value()).toBe(1.234);
    expect(hintSays()).toBe('Seats takes at most 3 decimal places');
    backspace(kwd.input);
    leave(kwd.input);
    expect(kwd.input.value).toBe('1.234');
    const egp = numberBox({ type: 'monetary', currency: 'EGP' });
    keys(egp.input, '0.345');
    expect(egp.input.value).toBe('0.34');
    expect(egp.value()).toBe(0.34);
  });

  it.each([
    ['en', '0,500', 0.5],
    ['en', '0,750', 0.75],
    ['ar', '0,500', 0.5],
    ['ar', '٠,٥٠٠', 0.5],
    ['de', '0.500', 0.5],
    ['fr', '0,500', 0.5],
  ] as const)('%s: "%s", led by 0, is a fraction and never 500', (locale, typed, expected) => {
    const { input, value } = numberBox({ type: 'float', label: 'Budget', digits: [12, 2] }, {}, locale);
    keys(input, typed);
    expect(value()).toBe(expected);
    leave(input);
    expect(value()).toBe(expected);
  });

  it.each([
    ['en', '1.234,56', 1234.56],
    ['ar', '1.234,56', 1234.56],
    ['ar', '١.٢٣٤,٥٦', 1234.56],
    ['fr', '1,234.56', 1234.56],
    ['de', '1,234.56', 1234.56],
  ] as const)('%s: "%s" typed key by key into a box of two places is %s, as pasted', (locale, typed, expected) => {
    const { input, form, value } = numberBox({ type: 'monetary', label: 'Budget', currency: 'EGP' }, {}, locale);
    keys(input, typed);
    expect(input.value).toBe(typed);
    expect(hintSays()).toBeNull();
    leave(input);
    expect(value()).toBe(expected);
    expect(form.getState().unread).toEqual({});
  });

  it('shows every place a value from outside has, never a rounded picture of another value', () => {
    const { input, form } = numberBox({ type: 'float', digits: [10, 1] });
    leave(input);
    form.setValue('x', 12.345);
    expect(input.value).toBe('12.345');
    const whole = numberBox({ type: 'integer' });
    leave(whole.input);
    whole.form.setValue('x', 2.5);
    expect(whole.input.value).toBe('2.5');
  });

  it('refuses a 16th significant digit, and a digit past the field’s digits', () => {
    const { input, value } = numberBox({ type: 'integer' });
    keys(input, '12345678901234567890');
    expect(value()).toBe(123456789012345);
    expect(hintSays()).toBe('Seats takes at most 15 digits');
    // Digits [10, 1] keep one place after the mark, so nine before it, as the field's check counts them (df827a7).
    const area = numberBox({ type: 'float', label: 'Area', digits: [10, 1] });
    keys(area.input, '12345678901');
    expect(area.value()).toBe(123456789);
    expect(hintSays()).toBe('Area takes at most 9 digits before the decimal point');
  });
});

describe('a number box and a paste', () => {
  it.each([
    ['en', '370,000.00 EGP', 370000],
    ['fr', '370\u202f000,00 EGP', 370000],
    ['en', 'E£ 1,500', 1500],
    ['de', 'E£ 1.200,00', 1200],
    ['en', '(1,200.00)', -1200],
    ['en', '1,200-', -1200],
  ] as const)('%s: takes an amount pasted with the box’s own currency: "%s"', (locale, pasted, expected) => {
    const { input, value } = numberBox({ type: 'monetary', label: 'Budget', currency: 'EGP' }, {}, locale);
    paste(input, pasted);
    expect(value()).toBe(expected);
    expect(hintSays()).toBeNull();
  });

  it('refuses another currency, naming both, and leaves the box exactly as it was', () => {
    const { input, value } = numberBox({ type: 'monetary', label: 'Budget', currency: 'EGP' });
    keys(input, '12');
    paste(input, '$1,500.00');
    expect(input.value).toBe('12');
    expect(value()).toBe(12);
    expect(hintSays()).toBe('Budget is in EGP, and this amount is in $');
  });

  it('refuses words, quoting them, and several values', () => {
    const { input } = numberBox({ type: 'float' });
    paste(input, 'abc');
    expect(input.value).toBe('');
    expect(hintSays()).toBe('“\u2068abc\u2069” is not a number, so it was not pasted');
    paste(input, '12\t380');
    expect(hintSays()).toBe('Seats takes one value, and several were pasted');
    paste(input, '12\n380');
    expect(input.value).toBe('');
  });

  it('refuses whole a paste that breaks the field’s rules', () => {
    const { input, value } = numberBox({ type: 'integer' });
    paste(input, '1.5');
    expect(input.value).toBe('');
    expect(value()).toBeNull();
    expect(hintSays()).toBe('Seats must be a whole number');
    const area = numberBox({ type: 'float', label: 'Floor area', digits: [10, 1] });
    paste(area.input, '12.345');
    expect(area.input.value).toBe('');
    expect(hintSays()).toBe('Floor area takes at most 1 decimal place');
  });

  it.each([
    ['en', 'integer', '1,200.00', 1200],
    ['en', 'integer', '12.0', 12],
    ['ar', 'integer', '1,200.00', 1200],
    ['en', 'area', '12.50', 12.5],
    ['ar', 'area', '٠٫٥٠', 0.5],
    ['en', 'area', '0,500', 0.5],
    ['de', 'area', '0.500', 0.5],
    ['fr', 'area', '0,500', 0.5],
  ] as const)('%s: takes a pasted value with trailing zeros, or led by 0, into %s: "%s" is %s', (locale, kind, pasted, expected) => {
    const field = kind === 'integer' ? { type: 'integer' } : { type: 'float', label: 'Floor area', digits: [10, 1] };
    const { input, value } = numberBox(field, {}, locale);
    paste(input, pasted);
    expect(hintSays()).toBeNull();
    expect(value()).toBe(expected);
  });
});

describe('text left in a number box that does not read', () => {
  it('stays in the box, marked, the field keeping what it held, until it is fixed', () => {
    const { input, form, value } = numberBox({ type: 'float' });
    keys(input, '5');
    leave(input);
    enter(input);
    selectAll(input);
    keys(input, '12 34');
    leave(input);
    expect(input.value).toBe('12 34');
    expect(value()).toBe(5);
    expect(form.getState().unread['x']).toEqual({ text: '12 34', message: 'Digits are grouped in threes, like 1,234,567' });
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(form.validate()).toBe(false);
    enter(input);
    selectAll(input);
    keys(input, '1234');
    expect(form.getState().unread).toEqual({});
    leave(input);
    expect(input.value).toBe('1,234.00');
  });

  it('keeps the value held as the box was entered, even when a reading came and went while typing', () => {
    const { input, value } = numberBox({ type: 'float' });
    keys(input, '7');
    leave(input);
    enter(input);
    selectAll(input);
    keys(input, '12');
    expect(value()).toBe(12);
    keys(input, ' 3');
    leave(input);
    expect(value()).toBe(7);
    expect(input.value).toBe('12 3');
  });

  it('is unfinished text too, left as it was: a lone minus', () => {
    const { input, form } = numberBox({ type: 'float' });
    keys(input, '-');
    leave(input);
    expect(form.getState().unread['x']?.message).toBe('Seats: “\u2068-\u2069” is not a number');
  });

  it('empties the field when only spaces are left', () => {
    const { input, value } = numberBox({ type: 'float' });
    keys(input, '4');
    selectAll(input);
    keys(input, '   ');
    leave(input);
    expect(value()).toBeNull();
    expect(input.value).toBe('');
  });
});

describe('hours', () => {
  const hoursBox = (locale: Locale = 'en') => numberBox({ type: 'float', label: 'Time on site' }, { widget: 'duration' }, locale);

  it.each([
    ['6:30', 6.5],
    ['6h30', 6.5],
    ['6h', 6],
    ['6:30:00', 6.5],
    ['6,5', 6.5],
    ['٦:٣٠', 6.5],
  ] as const)('reads "%s" as %s hours', (typed, expected) => {
    const { input, value } = hoursBox();
    keys(input, typed);
    leave(input);
    expect(value()).toBe(expected);
  });

  it('says why "6 30" and "12:75" are no hours, never reading them as 630', () => {
    const { input, form, value } = hoursBox();
    keys(input, '6 30');
    leave(input);
    expect(value()).toBeNull();
    expect(form.getState().unread['x']?.message).toBe('Time on site: write hours and minutes, like 6:30, or hours, like 6.5');
    enter(input);
    selectAll(input);
    keys(input, '12:75');
    leave(input);
    expect(form.getState().unread['x']?.message).toBe('Time on site: minutes go from 0 to 59, like 6:30');
  });

  it('says it in German with the German decimal comma', () => {
    const { input, form } = hoursBox('de');
    keys(input, '6 30');
    leave(input);
    expect(form.getState().unread['x']?.message).toBe('Time on site: Stunden und Minuten wie 6:30 oder Stunden wie 6,5');
  });

  it('refuses letters other than h', () => {
    const { input } = hoursBox();
    keys(input, '6x');
    expect(input.value).toBe('6');
  });
});

/** A widget of its own kind on a page of one field, kept up to date by its form. */
function mountWidget(field: Field, node: Partial<FieldNode>, locale: Locale = 'en') {
  const page = { fieldia: '0.1', id: 't', data: { kind: 'responses' }, fields: { x: field }, layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'n', field: 'x', ...node }] } } as Page;
  const form = createForm({ page });
  const widget = createWidget({ form, name: 'x', field, node: (page.layout as { children: FieldNode[] }).children[0], id: 'fd-x', document, locale, labels: WIDGET_LABELS[locale] });
  document.body.replaceChildren(widget.element);
  const refresh = () => widget.update({ value: form.getState().values['x'], values: form.getState().values, readonly: false, required: false, invalid: false });
  form.subscribe(refresh);
  refresh();
  return { form, el: widget.element, value: () => form.getState().values['x'] };
}

describe('an analytic distribution’s shares', () => {
  const mount = () => mountWidget({ type: 'json', label: 'Distribution', default: { '1': 70, '3': 30 } } as Field, { widget: 'distribution', options: { model: 'account' } });
  const shares = (el: HTMLElement) => [...el.querySelectorAll<HTMLInputElement>('input.fd-share')];

  it('refuses letters and a minus as they are typed, with words', () => {
    const { el, value } = mount();
    const [first] = shares(el);
    enter(first);
    selectAll(first);
    keys(first, 'abc');
    expect(first.value).toBe('70');
    expect(hintSays()).toBe('Percentage: numbers only');
    for (const _ of 'abc') backspace(first);
    keys(first, '-');
    expect(hintSays()).toBe('Percentage must be at least 0');
    expect(value()).toEqual({ '1': 70, '3': 30 });
  });

  it('takes an emptied share as 0, and the total shows it', () => {
    const { el, value } = mount();
    const [first] = shares(el);
    enter(first);
    selectAll(first);
    first.setRangeText('', 0, first.value.length, 'end');
    first.dispatchEvent(new InputEvent('input', { inputType: 'deleteContentBackward', bubbles: true }));
    leave(first);
    expect(value()).toEqual({ '1': 0, '3': 30 });
    expect(el.querySelector('.fd-distribution-total')?.textContent).toBe('30%');
  });

  it('reads a decimal comma, and keeps text that does not read, marked, without saving it', () => {
    const { el, form, value } = mount();
    const [first] = shares(el);
    enter(first);
    selectAll(first);
    keys(first, '1 2');
    leave(first);
    expect(first.value).toBe('1 2');
    expect(first.getAttribute('aria-invalid')).toBe('true');
    expect(value()).toEqual({ '1': 70, '3': 30 });
    expect(form.validate()).toBe(false);
    enter(first);
    selectAll(first);
    keys(first, '70,5');
    leave(first);
    expect(value()).toEqual({ '1': 70.5, '3': 30 });
    expect(first.getAttribute('aria-invalid')).toBeNull();
    expect(form.validate()).toBe(true);
  });
});

describe('tax amounts typed in', () => {
  const totals = { subtotals: [{ name: 'Untaxed Amount', amount: 1000 }], groups_by_subtotal: { 'Untaxed Amount': [{ tax_group_name: 'VAT 14%', tax_group_amount: 140 }] }, amount_total: 1140 };
  const mount = () => mountWidget({ type: 'json', label: 'Taxes', default: totals } as Field, { widget: 'tax-totals', options: { editable: true, currency: 'EGP' } });

  it('refuses letters, and an emptied box goes back to the amount kept, saying so', () => {
    const { el, value } = mount();
    const box = el.querySelector('input') as HTMLInputElement;
    enter(box);
    selectAll(box);
    keys(box, 'abc');
    expect(hintSays()).toBe('VAT 14%: numbers only');
    box.setRangeText('', 0, box.value.length, 'end');
    box.dispatchEvent(new InputEvent('input', { inputType: 'deleteContentBackward', bubbles: true }));
    box.dispatchEvent(new Event('change', { bubbles: true }));
    leave(box);
    expect(box.value).toBe('140.00');
    expect(el.querySelector('.fd-tax-note')?.textContent).toBe('VAT 14% still holds E£\u00a0140.00');
    expect((value() as typeof totals).amount_total).toBe(1140);
  });

  it('takes an amount pasted with its currency, and keeps text that does not read, marked', () => {
    const { el, form, value } = mount();
    const box = el.querySelector('input') as HTMLInputElement;
    enter(box);
    selectAll(box);
    paste(box, 'E£ 150.00');
    box.dispatchEvent(new Event('change', { bubbles: true }));
    expect((value() as typeof totals).amount_total).toBe(1150);
    selectAll(box);
    keys(box, '1 5');
    box.dispatchEvent(new Event('change', { bubbles: true }));
    expect(box.getAttribute('aria-invalid')).toBe('true');
    expect(form.validate()).toBe(false);
  });
});

describe('tax amounts in a currency of three places', () => {
  const totals = { subtotals: [{ name: 'Untaxed Amount', amount: 1000 }], groups_by_subtotal: { 'Untaxed Amount': [{ tax_group_name: 'VAT 5%', tax_group_amount: 50.125 }] }, amount_total: 1050.125 };
  const mount = () => mountWidget({ type: 'json', label: 'Taxes', default: totals } as Field, { widget: 'tax-totals', options: { editable: true, currency: 'KWD' } });

  it('shows a Kuwaiti amount as it is, and takes one typed or pasted to three places', () => {
    const { el, value } = mount();
    const box = el.querySelector('input') as HTMLInputElement;
    expect(box.value).toBe('50.125');
    expect(el.querySelector('.fd-tax-total td')?.textContent).toContain('1,050.125');
    enter(box);
    selectAll(box);
    keys(box, '12.345');
    expect(hintSays()).toBeNull();
    box.dispatchEvent(new Event('change', { bubbles: true }));
    expect((value() as typeof totals).groups_by_subtotal['Untaxed Amount'][0].tax_group_amount).toBe(12.345);
    expect((value() as typeof totals).amount_total).toBe(1012.345);
    selectAll(box);
    paste(box, 'KWD 12.346');
    expect(hintSays()).toBeNull();
    expect(box.value).toBe('12.346');
  });

  it('holds the keys typed after a refused one, and leaving says why, the amount kept', () => {
    const { el, form, value } = mount();
    const box = el.querySelector('input') as HTMLInputElement;
    enter(box);
    selectAll(box);
    keys(box, '12a5');
    expect(box.value).toBe('12');
    box.dispatchEvent(new Event('change', { bubbles: true }));
    leave(box);
    expect(box.value).toBe('12a5');
    expect(box.getAttribute('aria-invalid')).toBe('true');
    expect((value() as typeof totals).amount_total).toBe(1050.125);
    expect(form.validate()).toBe(false);
  });
});

describe('an editable progress bar', () => {
  it('refuses a minus where the bar starts at 0, and says the real value', () => {
    const { el, form } = mountWidget({ type: 'integer', label: 'Progress' } as Field, { widget: 'progressbar', options: { editable: true } });
    const input = el.querySelector('input') as HTMLInputElement;
    enter(input);
    keys(input, '-');
    expect(hintSays()).toBe('Progress must be at least 0');
    backspace(input);
    keys(input, '150');
    const bar = el.querySelector('[role="progressbar"]') as HTMLElement;
    expect(bar.getAttribute('aria-valuenow')).toBe('150');
    expect(bar.getAttribute('aria-valuetext')).toBe('150%');
    expect(form.getState().values['x']).toBe(150);
  });
});
