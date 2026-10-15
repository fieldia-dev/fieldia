import { createForm, type FieldNode, type Locale, type Page } from '@fieldia/core';
import { WIDGET_LABELS } from './labels';
import { readText } from './read-text';
import { mountKind } from './test-kinds';
import { createWidget } from './widgets';

/**
 * The input rules (0.21) in a text box, typed and pasted as a person does: a
 * key is a beforeinput the box may refuse, then the character at the caret,
 * then input; a paste is a paste event the box may refuse or clean. Nothing
 * typed is lost without a word, and every refusal says why.
 */
function keys(input: HTMLInputElement | HTMLTextAreaElement, text: string) {
  for (const char of [...text]) {
    const before = new InputEvent('beforeinput', { inputType: 'insertText', data: char, cancelable: true, bubbles: true });
    if (!input.dispatchEvent(before)) continue;
    const start = input.selectionStart ?? input.value.length;
    input.setRangeText(char, start, input.selectionEnd ?? start, 'end');
    input.dispatchEvent(new InputEvent('input', { inputType: 'insertText', data: char, bubbles: true }));
  }
}

/** Ctrl+V: refused, cleaned by the box (inserted as typing would), or pasted as it is by the browser. */
function paste(input: HTMLInputElement | HTMLTextAreaElement, text: string) {
  const event = new Event('paste', { cancelable: true, bubbles: true });
  Object.defineProperty(event, 'clipboardData', { value: { getData: () => text } });
  if (!input.dispatchEvent(event)) return;
  const start = input.selectionStart ?? input.value.length;
  input.setRangeText(text, start, input.selectionEnd ?? start, 'end');
  input.dispatchEvent(new InputEvent('input', { inputType: 'insertFromPaste', bubbles: true }));
}

const enter = (input: HTMLElement) => {
  input.focus();
  input.dispatchEvent(new Event('focus'));
};
const leave = (input: HTMLElement) => input.blur();
const hintSays = (el: ParentNode = document) => {
  const hint = el.querySelector('.fd-refusal-hint') as HTMLElement | null;
  return hint && !hint.hidden ? hint.textContent : null;
};

/** A text field on a page in `locale`, its box entered. */
function textBox(field: Record<string, unknown>, node: Partial<FieldNode> = {}, locale: Locale = 'en') {
  const mounted = mountKind({ label: 'Full name', type: 'char', ...field }, node, { locale, ...(locale === 'ar' ? { dir: 'rtl' as const } : {}) });
  const input = (mounted.el.matches('input, textarea') ? mounted.el : mounted.el.querySelector('input, textarea')) as HTMLInputElement;
  enter(input);
  return { ...mounted, input };
}

/** The task a paste is taken in, over: the browser has put it in. */
const pasteTaken = () => new Promise((resolve) => setTimeout(resolve));

describe('a text box’s most characters', () => {
  it.each([
    ['en', 'Full name takes at most 10 characters'],
    ['ar', 'Full name: لا يزيد عدد الأحرف على 10'],
    ['fr', 'Full name accepte au plus 10 caractères'],
  ] as const)('%s: a key typed at the most is refused, and a hint says why', (locale, said) => {
    const { input, value } = textBox({ size: 10 }, {}, locale);
    keys(input, 'Nile Traders Co');
    expect(input.value).toBe('Nile Trade');
    expect(value()).toBe('Nile Trade');
    expect(hintSays()).toBe(said);
    expect(input.hasAttribute('maxlength')).toBe(false);
  });

  it('keeps a paste that goes over whole: the count in the error colour says how many are too many', async () => {
    const { input, value, el } = textBox({ size: 80 });
    const pasted = 'x'.repeat(85);
    paste(input, pasted);
    expect(input.value).toBe(pasted);
    expect(value()).toBe(pasted);
    const count = el.querySelector('.fd-count') as HTMLElement;
    expect(count.textContent).toBe('85 / 80');
    expect(count.classList.contains('fd-count-past')).toBe(true);
    const over = el.querySelector('.fd-count-over') as HTMLElement;
    expect([over.hidden, over.textContent]).toEqual([false, '5 characters too many']);
    expect(input.getAttribute('aria-describedby')).toContain(over.id);
    // Typing more is refused; taking some away is not.
    await pasteTaken();
    keys(input, 'y');
    expect(input.value).toBe(pasted);
  });

  it('tells a screen reader politely how far over it is, once typing pauses', () => {
    jest.useFakeTimers();
    try {
      const { input, el } = textBox({ size: 10 }, {}, 'ar');
      paste(input, 'نص طويل جدًا هنا');
      jest.advanceTimersByTime(1000);
      expect(el.querySelector('.fd-sr-only[aria-live="polite"]')?.textContent).toBe('Full name: أطول من الحد (10) بـ6 من الأحرف؛ اختصره للحفظ');
    } finally {
      jest.useRealTimers();
    }
  });

  it('counts an emoji as one character, as a server does', () => {
    const { input, el } = textBox({ size: 80 });
    paste(input, `a${'😀'.repeat(50)}`);
    expect(el.querySelector('.fd-count')?.textContent).toBe('51 / 80');
    expect(input.value).toBe(`a${'😀'.repeat(50)}`);
  });

  it('holds in a paragraph and a copy box too', () => {
    const area = textBox({ type: 'text', size: 5 });
    keys(area.input, 'abcdefg');
    expect(area.value()).toBe('abcde');
    const copy = textBox({ size: 10 }, { widget: 'copy' });
    paste(copy.input, 'abcdefghijklmnopqrstuvwxyz');
    expect(copy.value()).toBe('abcdefghijklmnopqrstuvwxyz');
    expect(copy.el.querySelector('.fd-count')?.textContent).toBe('26 / 10');
  });
});

describe('a phone number’s box', () => {
  it.each([
    ['en', 'A phone number takes digits, spaces and + ( ) . - only'],
    ['ar', 'رقم الهاتف أرقام ومسافات و+ ( ) . - فقط'],
    ['de', 'Eine Telefonnummer enthält nur Ziffern, Leerzeichen und + ( ) . -'],
  ] as const)('%s: refuses letters as they are typed, and takes digits in any script', (locale, said) => {
    const { input, value, form } = textBox({ label: 'Site phone' }, { widget: 'phone' }, locale);
    keys(input, 'call me');
    // The first letter is refused, and the keys after it wait with it: no number is made of what is left between them.
    expect(input.value).toBe('');
    expect(hintSays()).toBe(said);
    // Left so, all that was typed is the box's, and the field's own check says it is no phone number.
    leave(input);
    expect(value()).toBe('call me');
    expect(form.problem('x')).not.toBeNull();
    const digits = textBox({ label: 'Site phone' }, { widget: 'phone' }, locale);
    keys(digits.input, '+20 (10) ١٢٣٤-۵٦٧٨.9');
    expect(digits.value()).toBe('+20 (10) ١٢٣٤-۵٦٧٨.9');
    // A second plus, or one not first, is no part of a number.
    keys(digits.input, '+');
    expect(digits.input.value).toBe('+20 (10) ١٢٣٤-۵٦٧٨.9');
  });

  it('refuses a paste with letters whole, and takes one with direction marks without them', () => {
    const { input, value } = textBox({ label: 'Site phone' }, { widget: 'phone' });
    paste(input, 'Tel: 0100 123 4567');
    expect(input.value).toBe('');
    expect(hintSays()).toBe('A phone number takes digits, spaces and + ( ) . - only');
    paste(input, '\u2066+20 100 123 4567\u2069\n');
    expect(value()).toBe('+20 100 123 4567');
  });

  it('keeps the number in 0-9 once left, so it can be dialled; one too short is said as it is left', () => {
    const { input, value, form } = textBox({ label: 'Work mobile' }, { widget: 'phone' }, 'ar');
    keys(input, ' ٠١٠١٢٣٤٥٦٧٨ ');
    expect(input.value).toBe(' ٠١٠١٢٣٤٥٦٧٨ ');
    leave(input);
    expect(value()).toBe('01012345678');
    expect(input.value).toBe('01012345678');
    enter(input);
    input.value = '';
    keys(input, '٠١٠٠ ١٢');
    leave(input);
    form.boxLeft('x');
    // The test's form speaks English: the page's messages are the viewer's to give it.
    expect(form.getState().errors['x']).toBe('Enter a phone number, like +20 100 123 4567');
    expect(value()).toBe('0100 12');
  });

});

describe('an email’s box', () => {
  it('is a text box with the email keyboard, keeping an international domain as typed', () => {
    const { input, value } = textBox({ label: 'Email' }, { widget: 'email' }, 'ar');
    expect([input.type, input.inputMode || input.getAttribute('inputmode'), input.autocomplete]).toEqual(['text', 'email', 'email']);
    keys(input, 'ali@مثال.مصر');
    leave(input);
    expect(value()).toBe('ali@مثال.مصر');
  });

  it('refuses a space, and drops the direction marks a paste brings', () => {
    const { input, value } = textBox({ label: 'Email' }, { widget: 'email' }, 'fr');
    keys(input, 'name ');
    expect(hintSays()).toBe('Une adresse e-mail ne contient pas d’espaces');
    // The keys after the refused space wait with it, the words said again: never the address "nameexample".
    keys(input, 'example');
    expect(input.value).toBe('name');
    expect(hintSays()).toBe('Une adresse e-mail ne contient pas d’espaces');
    input.value = '';
    paste(input, '\u200fname@example.com\u200f');
    expect(value()).toBe('name@example.com');
  });
});

describe('an email pasted or typed with what no address has', () => {
  it.each([
    ['en', 'An email address has no “:” before its @'],
    ['ar', 'لا يأتي «:» قبل @ في البريد الإلكتروني'],
  ] as const)('%s: a link’s "mailto:" pasted is the address it links to; a ":" typed before the @ is refused', async (locale, said) => {
    const { input, value } = textBox({ label: 'Email' }, { widget: 'email' }, locale);
    paste(input, 'mailto:ahmed@example.com');
    expect(input.value).toBe('ahmed@example.com');
    await pasteTaken();
    input.value = '';
    paste(input, 'MAILTO:sara@example.com?subject=Hello');
    expect(input.value).toBe('sara@example.com');
    leave(input);
    expect(value()).toBe('sara@example.com');
    input.focus();
    input.value = '';
    keys(input, 'mailto:');
    expect(input.value).toBe('mailto');
    expect(hintSays()).toBe(said);
    // After its @ a colon is no business of this rule: the address is judged whole as it is left.
    input.value = 'ahmed@';
    keys(input, 'x');
    expect(hintSays()).toBeNull();
  });

  it('drops a zero-width character a paste brings, so an address that looks right is one', () => {
    const { input, value, form } = textBox({ label: 'Email' }, { widget: 'email' });
    paste(input, 'ahmed\u200b@example.com');
    expect(input.value).toBe('ahmed@example.com');
    leave(input);
    expect(value()).toBe('ahmed@example.com');
    form.boxLeft('x');
    expect(form.getState().errors['x']).toBeUndefined();
  });
});

describe('a web address’s box', () => {
  it('is a text box with the web keyboard, trimmed once left', () => {
    const { input, value } = textBox({ label: 'Portal' }, { widget: 'url' });
    expect([input.type, input.getAttribute('inputmode')]).toEqual(['text', 'url']);
    keys(input, ' example.com ');
    leave(input);
    expect(value()).toBe('example.com');
  });
});

describe('one line of text', () => {
  it('takes a pasted line break as a space, and is trimmed once left, spaces alone being nothing', () => {
    const { input, value } = textBox({});
    paste(input, '  Cairo\noffice  ');
    expect(input.value).toBe('  Cairo office  ');
    leave(input);
    expect(value()).toBe('Cairo office');
    enter(input);
    input.value = '';
    keys(input, '   ');
    leave(input);
    expect(value()).toBeNull();
  });

  it('keeps an answer a pattern checks in 0-9 once left, and free text as typed', () => {
    const zip = textBox({ label: 'Zip', pattern: '^\\d{5}$' }, {}, 'ar');
    keys(zip.input, '١١٥١١');
    leave(zip.input);
    expect(zip.value()).toBe('11511');
    const free = textBox({ label: 'Flat' }, {}, 'ar');
    keys(free.input, 'شقة ١٢');
    leave(free.input);
    expect(free.value()).toBe('شقة ١٢');
  });

  it('settles a copy box too, and copies it without spaces at its ends', async () => {
    const write = jest.fn(() => Promise.resolve());
    Object.assign(navigator, { clipboard: { writeText: write } });
    const { input, value, el } = textBox({ label: 'Code' }, { widget: 'copy' });
    keys(input, '   ');
    expect((el.querySelector('.fd-copy-button') as HTMLElement).hidden).toBe(true);
    keys(input, 'ABC-123  ');
    (el.querySelector('.fd-copy-button') as HTMLButtonElement).click();
    await Promise.resolve();
    expect(write).toHaveBeenCalledWith('ABC-123');
    leave(input);
    expect(value()).toBe('ABC-123');
  });
});

describe('free-text tags', () => {
  function tags(options: NonNullable<FieldNode['options']> = {}, locale: Locale = 'en') {
    const mounted = mountKind({ type: 'char', label: 'Materials' }, { widget: 'tags', options }, { locale, ...(locale === 'ar' ? { dir: 'rtl' as const } : {}) });
    const input = mounted.el.querySelector('input') as HTMLInputElement;
    enter(input);
    return { ...mounted, input };
  }
  const chipText = (el: Element) => [...el.querySelectorAll('.fd-chip-label')].map((c) => c.textContent);

  it('says “Add a tag”, in the page’s language', () => {
    expect(tags().input.placeholder).toBe('Add a tag');
    expect(tags({}, 'ar').input.placeholder).toBe('أضف وسمًا');
  });

  it('ends a tag at the Arabic comma as at a comma, and at a line break', () => {
    const { input, value } = tags({}, 'ar');
    keys(input, 'خشب، زجاج،');
    expect(value()).toBe('خشب, زجاج');
    paste(input, 'steel\nbrass\nwalnut');
    expect(value()).toBe('خشب, زجاج, steel, brass, walnut');
    expect(input.value).toBe('');
  });

  it('ends a tag at a tab, as cells copied from a spreadsheet are pasted: never a tag with a tab inside', () => {
    const { input, value, el } = tags();
    paste(input, 'walnut\tbrass');
    expect(value()).toBe('walnut, brass');
    expect(chipText(el)).toEqual(['walnut', 'brass']);
    paste(input, 'oak\tglass\r\nsteel\t');
    expect(value()).toBe('walnut, brass, oak, glass, steel');
    expect(input.value).toBe('');
  });

  it('adds a tag there already in no case, says so, and marks its chip', () => {
    const { input, value, el } = tags();
    keys(input, 'oak,');
    keys(input, 'Oak,');
    expect(value()).toBe('oak');
    expect(hintSays()).toBe('“Oak” is already there');
    expect(el.querySelector('.fd-chip-there .fd-chip-label')?.textContent).toBe('oak');
  });

  it('at the most, keeps its box and the focus, names the tags not added, and keeps them waiting', () => {
    const { input, value, el, form } = tags({ max: 3 });
    keys(input, 'oak, glass, steel, ');
    keys(input, 'brass');
    expect(document.activeElement).toBe(input);
    expect(value()).toBe('oak, glass, steel');
    expect(chipText(el)).toEqual(['oak', 'glass', 'steel']);
    expect(input.value).toBe(' brass');
    keys(input, ',');
    expect(input.value).toBe('brass');
    expect(hintSays()).toBe('Materials takes at most 3. Not added: brass');
    // Left so, the form keeps it as text it could not take: said, and Save waits.
    leave(input);
    expect(input.value).toBe('brass');
    expect(form.getState().unread['x']?.message).toBe('Materials takes at most 3. Not added: brass');
    expect(form.validate()).toBe(false);
  });

  it('pasted past the most, adds up to it and names the rest', () => {
    const { input, value } = tags({ max: 3 });
    paste(input, 'oak, glass, steel, brass, walnut');
    expect(value()).toBe('oak, glass, steel');
    expect(hintSays()).toBe('Materials takes at most 3. Not added: brass, walnut');
  });
});

describe('JSON', () => {
  function json() {
    const mounted = mountKind({ type: 'json', label: 'Settings' }, {}, {});
    const area = mounted.el.querySelector('textarea') as HTMLTextAreaElement;
    enter(area);
    return { ...mounted, area };
  }
  const typed = (area: HTMLTextAreaElement, text: string) => {
    area.value = text;
    area.dispatchEvent(new Event('input', { bubbles: true }));
  };

  it('keeps what is typed while it is not JSON, never putting the old value back, and Save says so', () => {
    const { area, form, value } = json();
    form.setValue('x', { doors: 4 });
    typed(area, '{"doors": 4, "zone": "B",}');
    leave(area);
    expect(area.value).toBe('{"doors": 4, "zone": "B",}');
    expect(value()).toEqual({ doors: 4 });
    expect(area.getAttribute('aria-invalid')).toBe('true');
    expect(form.getState().unread['x']?.message).toBe('Not valid JSON, so not saved: a comma with nothing after it (line 1, column 26)');
    expect(form.validate()).toBe(false);
    enter(area);
    typed(area, '{"doors": 4, "zone": "B"}');
    expect(value()).toEqual({ doors: 4, zone: 'B' });
    expect(form.getState().unread['x']).toBeUndefined();
  });

  it('names the reason in words: curly quotes, digits that are not 0-9, a character that cannot be here', () => {
    const { area, form } = json();
    typed(area, '{“a”: 1}');
    expect(form.getState().unread['x']?.message).toBe('Not valid JSON, so not saved: use straight quotes " instead of “ ” (line 1, column 2)');
    typed(area, '{"a": ١٢}');
    expect(form.getState().unread['x']?.message).toBe('Not valid JSON, so not saved: numbers in JSON are written 0-9 (line 1, column 7)');
    typed(area, '{"a" 1}');
    expect(form.getState().unread['x']?.message).toBe('Not valid JSON, so not saved: “1” can’t be here (line 1, column 6)');
  });

  it('shows the words under the box once typing pauses, a polite status that describes the box', () => {
    jest.useFakeTimers();
    try {
      const { area, el } = json();
      typed(area, '{"a": 1,}');
      const error = el.querySelector('.fd-cell-error') as HTMLElement;
      expect(error.hidden).toBe(true);
      jest.advanceTimersByTime(700);
      expect(error.hidden).toBe(false);
      expect(error.getAttribute('role')).toBe('status');
      expect(area.getAttribute('aria-describedby')).toContain(error.id);
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('a properties field’s number rows', () => {
  const page = {
    fieldia: '0.1',
    id: 't',
    data: { kind: 'responses' },
    fields: {
      extra: {
        type: 'properties',
        label: 'Building details',
        definitions: [
          { name: 'floor', label: 'Floor', type: 'integer' },
          { name: 'weight', label: 'Weight', type: 'float' },
        ],
      },
    },
    layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'n', field: 'extra' }] },
  } as unknown as Page;
  function properties(locale: Locale = 'en') {
    const form = createForm({ page });
    const node = (page.layout as { children: FieldNode[] }).children[0];
    const widget = createWidget({ form, name: 'extra', field: page.fields['extra'], node, id: 'fd-extra', document, labels: WIDGET_LABELS[locale], locale });
    document.body.replaceChildren(widget.element);
    const refresh = () => widget.update({ value: form.getState().values['extra'], values: form.getState().values, readonly: false, required: false, invalid: false });
    form.subscribe(refresh);
    refresh();
    const box = (name: string) => widget.element.querySelector(`#fd-extra-${name}`) as HTMLInputElement;
    return { form, el: widget.element, box };
  }

  it('read a decimal comma on a French page, and keep text that does not read, marked on its row, Save waiting', () => {
    const { box, form, el } = properties('fr');
    // Text is refused as any number box refuses it, and the keys after it wait with it: never 12 from "douze12".
    enter(box('floor'));
    keys(box('floor'), 'douze12');
    expect(box('floor').value).toBe('');
    expect(form.getState().values['extra']).toBeNull();
    box('floor').dispatchEvent(new InputEvent('input', { inputType: 'deleteContentBackward', bubbles: true }));
    keys(box('floor'), '12');
    expect(form.getState().values['extra']).toEqual({ floor: 12 });
    leave(box('floor'));
    const weight = box('weight');
    enter(weight);
    keys(weight, '1.234,5');
    expect(form.getState().values['extra']).toEqual({ floor: 12, weight: 1234.5 });
    weight.value = '';
    keys(weight, '12 34');
    leave(weight);
    weight.closest('.fd-property')?.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    const error = el.querySelector('#fd-extra-weight-error') as HTMLElement;
    expect(error.hidden).toBe(false);
    expect(error.textContent).toMatch(/^Les chiffres se groupent par trois, par exemple 1\s234\s567$/);
    expect(weight.getAttribute('aria-invalid')).toBe('true');
    expect(weight.getAttribute('aria-describedby')).toContain(error.id);
    expect(form.validate()).toBe(false);
  });
});

describe('an address’s parts', () => {
  it('keep the postcode in 0-9 and trimmed once left, and mark it alone when it is not of its country’s shape', () => {
    const { el, value, refresh } = mountKind({ type: 'json', label: 'Badge address' }, { widget: 'address', options: { country: 'EG', parts: ['street', 'postcode', 'country'] } }, { locale: 'ar' });
    const postcode = el.querySelector('[data-part="postcode"]') as HTMLInputElement;
    const street = el.querySelector('[data-part="street"]') as HTMLInputElement;
    enter(street);
    keys(street, '  12 Nile Street ');
    leave(street);
    enter(postcode);
    keys(postcode, ' ١١٥١١ ');
    leave(postcode);
    expect(value()).toEqual({ street: '12 Nile Street', postcode: '11511', country: 'EG' });
    enter(postcode);
    postcode.value = '';
    keys(postcode, 'ABCDE');
    leave(postcode);
    refresh({ invalid: true });
    expect(postcode.getAttribute('aria-invalid')).toBe('true');
    expect(street.getAttribute('aria-invalid')).toBe('false');
  });
});

describe('a colour’s code', () => {
  function colour(field: Record<string, unknown> = {}) {
    const mounted = mountKind({ type: 'char', label: 'Epic colour', ...field }, { widget: 'color' });
    const code = mounted.el.querySelector('.fd-colour-code') as HTMLInputElement;
    return { ...mounted, code, swatch: mounted.el.querySelector('.fd-colour-swatch') as HTMLElement, clear: mounted.el.querySelector('.fd-colour-clear') as HTMLButtonElement };
  }

  it('takes #rgb or #rrggbb, with or without #, in any case, and keeps it as #rrggbb', () => {
    const { code, value } = colour();
    expect(code.getAttribute('aria-label')).toBe('Epic colour: Colour code');
    for (const [typed, kept] of [['#1F2937', '#1f2937'], ['abc', '#aabbcc'], ['#F00', '#ff0000']]) {
      enter(code);
      code.value = '';
      keys(code, typed);
      expect(value()).toBe(kept);
    }
    enter(code);
    code.value = '';
    paste(code, ' #1f2937\n');
    expect(value()).toBe('#1f2937');
  });

  it('refuses anything else as it is typed or pasted, saying what a code is', () => {
    const { code, value } = colour();
    enter(code);
    keys(code, 'red');
    // The r is refused, and e and d, hex digits, wait with it: never the code "ed" made of what was typed round it.
    expect(code.value).toBe('');
    keys(code, 'x');
    expect(hintSays()).toBe('Enter a colour code, like #1f2937');
    paste(code, 'rebeccapurple');
    expect(code.value).toBe('');
    expect(value()).toBeNull();
    // Left so, all that was typed stays, marked, and the colour stays what it was.
    leave(code);
    expect(code.value).toBe('redx');
    expect(code.getAttribute('aria-invalid')).toBe('true');
  });

  it.each(['#12345', '#1234', '12345'])('never holds a colour nobody chose: “%s” typed over #2c8397 leaves it #2c8397, the box marked', (typed) => {
    const { code, swatch, value, form } = colour();
    form.setValue('x', '#2c8397');
    enter(code);
    code.value = '';
    keys(code, typed);
    // On the way, "#123" read as a code; one more digit and it reads as none: the colour held comes back.
    expect(value()).toBe('#2c8397');
    leave(code);
    expect(value()).toBe('#2c8397');
    expect(swatch.style.getPropertyValue('--fd-swatch')).toBe('#2c8397');
    expect(code.value).toBe(typed);
    expect(code.getAttribute('aria-invalid')).toBe('true');
    expect(form.getState().unread['x']).toEqual({ text: typed, message: 'Enter a colour code, like #1f2937' });
    expect(form.validate()).toBe(false);
  });

  it('left for its × or its picker, is left all the same: why it was not read is said now, by the field', () => {
    const { el, code, clear, form } = colour();
    form.setValue('x', '#2c8397');
    const heard: (EventTarget | null)[] = [];
    el.parentElement?.addEventListener('focusout', (event) => heard.push(event.relatedTarget));
    enter(code);
    keys(code, '#12345');
    code.dispatchEvent(new FocusEvent('blur', { relatedTarget: clear }));
    code.dispatchEvent(new FocusEvent('focusout', { relatedTarget: clear, bubbles: true }));
    clear.focus();
    // The page round it hears the box left (no relatedTarget inside it), so it says the field's problem now.
    expect(heard).toContain(null);
  });

  it('shows an empty colour as none, never black, and clears one that need not be given', () => {
    const { swatch, clear, value, form, refresh } = colour();
    expect(swatch.classList.contains('fd-colour-none')).toBe(true);
    expect(clear.hidden).toBe(true);
    form.setValue('x', '#abc');
    expect(swatch.classList.contains('fd-colour-none')).toBe(false);
    expect(swatch.style.getPropertyValue('--fd-swatch')).toBe('#aabbcc');
    expect(clear.hidden).toBe(false);
    clear.click();
    expect(value()).toBeNull();
    form.setValue('x', '#abc');
    refresh({ required: true });
    expect(clear.hidden).toBe(true);
  });
});

describe('a mail, phone or web address read-only', () => {
  const read = (widget: string, value: string) => {
    const text = readText({ document, field: { type: 'char', label: 'X' }, node: { type: 'field', id: 'n', field: 'x', widget }, id: 'x' });
    text.update(value, {});
    return text.element.querySelector('a')?.getAttribute('href') ?? null;
  };

  it('dials a number typed in Arabic digits, in 0-9', () => {
    expect(read('phone', '٠١٠١٢٣٤٥٦٧٨')).toBe('tel:01012345678');
    expect(read('phone', '\u2066+20 100 123 4567\u2069')).toBe('tel:+201001234567');
  });

  it('links a web address typed without https:// with it, and never one of another kind', () => {
    expect(read('url', 'example.com')).toBe('https://example.com');
    expect(read('url', 'http://localhost:3000')).toBe('http://localhost:3000');
    expect(read('url', 'javascript:alert(1)')).toBeNull();
    expect(read('email', '\u200fname@example.com')).toBe('mailto:name@example.com');
    expect(read('email', 'mailto:name@example.com')).toBeNull();
  });
});
