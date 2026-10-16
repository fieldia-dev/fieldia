import type { FieldNode, Locale, Value } from '@fieldia/core';
import { mountKind } from './test-kinds';

/**
 * The input rules and the keys that save: Enter does in a one-line box what it
 * did before the rules came — it sends the form, or moves to the next field —
 * and is never judged as typing; text a box reads as it is left is read when
 * the page asks it to (a `change`, which every save sends first), so a save
 * never takes a value passed on the way; and every box holds the keys typed
 * after a refused one, so a phone number, an email or a colour is never made
 * of what was typed around a key it refused.
 */

/** Keys pressed one by one where the caret is: a beforeinput the box may refuse, then the character, then input. */
function keys(input: HTMLInputElement | HTMLTextAreaElement, text: string) {
  for (const char of [...text]) {
    const before = new InputEvent('beforeinput', { inputType: 'insertText', data: char, cancelable: true, bubbles: true });
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

/**
 * Enter, as a browser says it in a one-line box: its keydown, then — unless that was taken — the beforeinput of a
 * line break, which a page that cancels it stops the form's sending with. Whether the Enter went on to the form.
 */
function pressEnter(input: HTMLInputElement) {
  if (!input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))) return false;
  return input.dispatchEvent(new InputEvent('beforeinput', { inputType: 'insertLineBreak', cancelable: true, bubbles: true }));
}

const hintSays = () => {
  const hint = [...document.querySelectorAll<HTMLElement>('.fd-refusal-hint')].find((h) => !h.hidden);
  return hint ? hint.textContent : null;
};
/** A box entered, its text all chosen so typing replaces it, as a Tab into it does. */
function enter(input: HTMLInputElement) {
  input.focus();
  input.setSelectionRange(0, input.value.length);
}
const leave = (input: HTMLInputElement) => input.blur();
/** What a save sends the box first: read what is typed now. */
const readNow = (input: HTMLInputElement) => input.dispatchEvent(new Event('change', { bubbles: true }));

/** Typed text as a hint quotes it: set apart from the words round it. */
const q = (text: string) => `\u2068${text}\u2069`;

/**
 * A field on a page in `locale` holding `start`, its box entered: the box its widget types in (a colour's code box,
 * not its picker).
 */
function box(field: Record<string, unknown>, node: Partial<FieldNode> = {}, locale: Locale = 'en', options: { selector?: string; start?: Value } = {}) {
  const mounted = mountKind({ label: 'Workstations', ...field }, node, { locale, ...(locale === 'ar' ? { dir: 'rtl' as const } : {}) });
  const selector = options.selector ?? 'input';
  const input = (mounted.el.matches(selector) ? mounted.el : mounted.el.querySelector(selector)) as HTMLInputElement;
  if (options.start !== undefined) mounted.form.setValue('x', options.start);
  enter(input);
  return { ...mounted, input };
}
const colourCode = { selector: 'input.fd-colour-code' };

describe('Enter in a one-line box', () => {
  it.each(['en', 'ar', 'fr'] as const)('%s: goes on to the form from every box, never judged as typing, no hint', (locale) => {
    const boxes: [() => ReturnType<typeof box>, string][] = [
      [() => box({ type: 'integer' }, {}, locale), '7'],
      [() => box({ type: 'float', digits: [10, 1] }, {}, locale), '7'],
      [() => box({ type: 'monetary', currency: 'EGP' }, {}, locale), '7'],
      [() => box({ type: 'float' }, { widget: 'duration' }, locale), '7'],
      [() => box({ type: 'float' }, { widget: 'percentage' }, locale), '7'],
      [() => box({ type: 'char', label: 'Site contact email' }, { widget: 'email' }, locale), 'a@b.eg'],
      [() => box({ type: 'char', label: 'Site phone' }, { widget: 'phone' }, locale), '7'],
      [() => box({ type: 'char', label: 'Name', size: 3 }, {}, locale), 'abc'],
      [() => box({ type: 'char', label: 'Epic colour' }, { widget: 'color' }, locale, colourCode), '#123'],
      [() => box({ type: 'date', label: 'Start date' }, {}, locale), '15/10/2026'],
      [() => box({ type: 'char', label: 'Opens' }, { widget: 'time' }, locale), '14:30'],
    ];
    for (const [mount, typed] of boxes) {
      const { input } = mount();
      keys(input, typed);
      expect(input.value).toBe(typed);
      expect(pressEnter(input)).toBe(true);
      expect(hintSays()).toBeNull();
    }
  });

  it('keys held after a refused one: Enter goes on to the form and is no key held; left, the text is as typed', () => {
    const { input, form } = box({ type: 'integer' });
    keys(input, '1x5');
    expect(hintSays()).toBe('Workstations: numbers only');
    expect(pressEnter(input)).toBe(true);
    leave(input);
    expect(form.getState().unread['x']?.text).toBe('1x5');
  });

  it('a paragraph still takes a line break as typing: past its most, it is refused with words', () => {
    const { input } = box({ type: 'text', label: 'Scope', size: 3 }, {}, 'en', { selector: 'textarea' });
    keys(input, 'abc');
    const before = new InputEvent('beforeinput', { inputType: 'insertLineBreak', cancelable: true, bubbles: true });
    expect(input.dispatchEvent(before)).toBe(false);
    expect(hintSays()).toBe('Scope takes at most 3 characters');
  });
});

describe('a save reads what is typed first, never a value passed on the way', () => {
  it.each([
    ['whole number "1.5"', { type: 'integer' }, {}, '1.5', 'Workstations must be a whole number'],
    ['"1e5", its keys held', { type: 'integer' }, {}, '1e5', `Workstations: “${q('1e5')}” is not a number`],
    ['one place, "12.34"', { type: 'float', digits: [10, 1], label: 'Floor area' }, {}, '12.34', 'Floor area takes at most 1 decimal place'],
    ['a per cent of two places, "25.555"', { type: 'float', label: 'Margin' }, { widget: 'percentage' }, '25.555', 'Margin takes at most 2 decimal places'],
    ['hours "6:305"', { type: 'float', label: 'Time on site' }, { widget: 'duration' }, '6:305', 'Time on site: write hours and minutes, like 6:30, or hours, like 6.5'],
  ] as const)('%s: kept as typed, marked with why, the field holding what it held', (_, field, node, typed, words) => {
    const { input, form, value } = box(field, node, 'en', { start: 4 });
    keys(input, typed);
    readNow(input);
    expect(form.getState().unread['x']).toEqual({ text: typed, message: words });
    expect(value()).toBe(4);
    expect(input.value).toBe(typed);
    expect(document.activeElement).toBe(input);
    // Put right and read again, it is taken.
    input.setSelectionRange(0, input.value.length);
    keys(input, '3');
    readNow(input);
    expect(form.getState().unread['x']).toBeUndefined();
    expect(value()).toBe('widget' in node && node.widget === 'percentage' ? 0.03 : 3);
  });

  it.each(['en', 'ar', 'fr'] as const)('%s: a date whose keys wait after a refused one is read as typed', (locale) => {
    const { input, form, value } = box({ type: 'date', label: 'Start date' }, {}, locale);
    keys(input, '1x5/10/2026');
    readNow(input);
    expect(value() ?? null).toBeNull();
    expect(form.getState().unread['x']?.text).toBe('1x5/10/2026');
  });

  it('hours of one digit of minutes are never 6:03 for "6:3": both are named', () => {
    const { input, form, value } = box({ type: 'float', label: 'Time on site' }, { widget: 'duration' });
    keys(input, '6:3');
    readNow(input);
    expect(value() ?? null).toBeNull();
    expect(form.getState().unread['x']).toEqual({ text: '6:3', message: `Time on site: “${q('6:3')}” could be 6:03 or 6:30; write the minutes with two digits` });
  });

  it.each([
    ['en', `Opens: “${q('14:3')}” could be 14:03 or 14:30; write the minutes with two digits`],
    ['ar', `Opens: «${q('14:3')}» قد تعني 14:03 أو 14:30؛ اكتب الدقائق برقمين`],
    ['fr', `Opens : « ${q('14:3')} » peut être 14:03 ou 14:30 ; écrivez les minutes avec deux chiffres`],
    ['de', `Opens: „${q('14:3')}“ kann 14:03 oder 14:30 sein; schreiben Sie die Minuten mit zwei Ziffern`],
  ] as const)('%s: a time of one digit of minutes is never quietly :03', (locale, words) => {
    const { input, form, value } = box({ type: 'char', label: 'Opens' }, { widget: 'time' }, locale);
    keys(input, '14:3');
    leave(input);
    expect(value() ?? null).toBeNull();
    expect(form.getState().unread['x']).toEqual({ text: '14:3', message: words });
  });

  it.each([
    ['en', `Opens: “${q('14.5')}” could be 14:05, 14:30, or 14:50; write the minutes with two digits`],
    ['ar', `Opens: «${q('14.5')}» قد تعني 14:05 أو 14:30 أو 14:50؛ اكتب الدقائق برقمين`],
    ['fr', `Opens : « ${q('14.5')} » peut être 14:05, 14:30 ou 14:50 ; écrivez les minutes avec deux chiffres`],
    ['de', `Opens: „${q('14.5')}“ kann 14:05, 14:30 oder 14:50 sein; schreiben Sie die Minuten mit zwei Ziffern`],
  ] as const)('%s: "14.5" is never quietly 14:05: half past two, as hours, and 14:50 are named with it', (locale, words) => {
    const { input, form, value } = box({ type: 'char', label: 'Opens' }, { widget: 'time' }, locale);
    keys(input, '14.5');
    leave(input);
    expect(value() ?? null).toBeNull();
    expect(form.getState().unread['x']).toEqual({ text: '14.5', message: words });
  });
});

describe('a text box holds the keys typed after a refused one', () => {
  it.each([
    ['+20 1oo 123 4567', '+20 1'],
    ['010O1234567', '010'],
    ['01001234567 ext 12', '01001234567 '],
  ])('a phone number: "%s" never becomes another number; left, it is kept as typed, and said', (typed, shown) => {
    const { input, form, value } = box({ type: 'char', label: 'Site phone' }, { widget: 'phone' });
    keys(input, typed);
    expect(input.value).toBe(shown);
    expect(hintSays()).toBe('A phone number takes digits, spaces and + ( ) . - only');
    leave(input);
    expect(input.value).toBe(typed);
    expect(value()).toBe(typed);
    expect(form.problem('x')).not.toBeNull();
  });

  it.each(['mailto:ahmed@example.com', 'ahmed ali@example.com', 'ahmed,ali@example.com'])('an email: "%s" is never another address', (typed) => {
    const { input, form, value } = box({ type: 'char', label: 'Site contact email' }, { widget: 'email' });
    keys(input, typed);
    expect(hintSays()).not.toBeNull();
    leave(input);
    expect(value()).toBe(typed);
    expect(form.problem('x')).not.toBeNull();
  });

  it('Backspace takes the held keys back one by one, and a save reads them', () => {
    const { input, form, value } = box({ type: 'char', label: 'Site phone' }, { widget: 'phone' });
    keys(input, '0100 555 1234 ext 5');
    expect(input.value).toBe('0100 555 1234 ');
    readNow(input);
    expect(value()).toBe('0100 555 1234 ext 5');
    expect(form.problem('x')).not.toBeNull();
  });

  it('a line past its most: what was typed after the most is kept, over, for the person to shorten', () => {
    const { input, value, form } = box({ type: 'char', label: 'Name', size: 3 });
    keys(input, 'abcde');
    expect(input.value).toBe('abc');
    leave(input);
    expect(value()).toBe('abcde');
    expect(form.problem('x')).toBe('Name is 2 characters too long: shorten it to 3');
  });
});

describe('a colour’s code box holds the keys typed after a refused one', () => {
  it.each(['#1x23', '2c8 397', '#2c8j397', '#1g23456'])('"%s" never becomes a colour of the keys round it: left, it stays, marked', (typed) => {
    const { input, form, value } = box({ type: 'char', label: 'Epic colour' }, { widget: 'color' }, 'en', { ...colourCode, start: '#f06050' });
    keys(input, typed);
    expect(hintSays()).toBe('Enter a colour code, like #1f2937');
    leave(input);
    expect(value()).toBe('#f06050');
    expect(input.value).toBe(typed);
    expect(form.getState().unread['x']?.text).toBe(typed);
  });
});

describe('a date and time pasted into a box that keeps a day', () => {
  it.each([
    ['en', 'Start date takes a day only: the time 14:30 was left out'],
    ['ar', 'Start date: يأخذ يومًا فقط، فتُرك الوقت 14:30'],
    ['fr', 'Start date ne prend qu’un jour : l’heure 14:30 a été laissée de côté'],
    ['de', 'Start date nimmt nur einen Tag: Die Uhrzeit 14:30 wurde weggelassen'],
  ] as const)('%s: takes the day and says the time was left out', (locale, words) => {
    const { input, value } = box({ type: 'date', label: 'Start date' }, {}, locale);
    paste(input, '15/10/2026 14:30');
    expect(hintSays()).toBe(words);
    leave(input);
    expect(value()).toBe('2026-10-15');
  });

  it('an instant is the day it is here, and its time here is said', () => {
    const { input, value } = box({ type: 'date', label: 'Start date' });
    const at = new Date('2026-10-15T23:30:00Z');
    const pad = (n: number) => String(n).padStart(2, '0');
    paste(input, '2026-10-15T23:30:00Z');
    expect(hintSays()).toBe(`Start date takes a day only: the time ${pad(at.getHours())}:${pad(at.getMinutes())} was left out`);
    leave(input);
    expect(value()).toBe(`${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`);
  });

  it('a day alone says nothing', () => {
    const { input, value } = box({ type: 'date', label: 'Start date' });
    paste(input, '15/10/2026');
    expect(hintSays()).toBeNull();
    leave(input);
    expect(value()).toBe('2026-10-15');
  });
});

describe('a save reads a text box as leaving does: the same text whichever key saved it', () => {
  it.each([
    ['a phone number’s Arabic digits are 0-9', { type: 'char' }, { widget: 'phone' }, '٠١٠٠١٢٣٤٥٦٧', '01001234567'],
    ['a line’s ends are trimmed', { type: 'char' }, {}, 'Office ', 'Office'],
    ['an email’s marks go', { type: 'char' }, { widget: 'email' }, '‏name@example.com', 'name@example.com'],
  ] as const)('%s', (_, field, node, typed, kept) => {
    const { input, value } = box(field, node);
    keys(input, typed);
    readNow(input);
    expect(value()).toBe(kept);
  });
});

describe('a save reads an address’s parts as leaving does', () => {
  it('its postcode’s digits as 0-9 and its parts trimmed', () => {
    const { el, value } = mountKind({ type: 'json', label: 'Home address' }, { widget: 'address' });
    const postcode = el.querySelector('[data-part="postcode"]') as HTMLInputElement;
    const street = el.querySelector('[data-part="street"]') as HTMLInputElement;
    for (const [input, text] of [[street, ' 12 Nile Street '], [postcode, '١١٥١١']] as const) {
      enter(input);
      keys(input, text);
      readNow(input);
    }
    expect(value()).toMatchObject({ street: '12 Nile Street', postcode: '11511' });
  });
});
