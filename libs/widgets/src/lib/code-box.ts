import { foldDigits, stripMarks, type Value } from '@fieldia/core';
import { guard, quoted, refusalHint, type InputRules } from './input-rules';
import { boxPurpose, fillIn, maker, setAttr, setText, typeInto, wordsFor } from './kind-parts';
import { inPlural } from './labels';
import { installTypedStyles } from './styles-typed';
import type { Widget, WidgetContext, WidgetFactory } from './widgets';

/**
 * A one-time code (`"widget": "one-time-code"` on a char field): a box for each of its digits — `options.length`, 6
 * unless said; letters too with `options.letters` — drawn over one text box, so the browser's and the phone's autofill
 * of a code sent by SMS (`autocomplete="one-time-code"`) fills it whole, a screen reader reads one box by its label,
 * and a paste of the whole code ("123 456", "123-456") lands across the boxes at once. Typing moves on box by box;
 * Backspace goes back; a press on a box puts the caret there. A key no code has is refused with why, and so is one
 * past its length. The field takes the code once it is whole — so a step that sends it can run on its change; left
 * before then, what was typed stays, marked, with how many are still to type. In the typed part.
 */

/** A code's length on a node: `options.length`, 4 to 12, else 6. */
export const codeLength = (options: Readonly<Record<string, unknown>> | undefined): number => {
  const asked = options?.['length'];
  return typeof asked === 'number' && Number.isInteger(asked) && asked >= 4 && asked <= 12 ? asked : 6;
};
/** Spaces and dashes a code is written with, in a message or as it is read out, which are let go. */
const BETWEEN = /[\s\-.]/g;

export const codeWidget: WidgetFactory = (context: WidgetContext): Widget => {
  const { form, name, field, node, id, document: doc, labels, locale } = context;
  installTypedStyles(doc);
  const words = wordsFor(labels, locale);
  const make = maker(doc);
  const options = node.options ?? {};
  const length = codeLength(options);
  const letters = options['letters'] === true;
  const label = node.label ?? field.label;
  const fits = letters ? /^[\p{Nd}\p{L}]$/u : /^\p{Nd}$/u;
  /** A code as it is kept: digits as 0-9, letters in capitals, what is written between them let go. */
  const clean = (text: string) => foldDigits(stripMarks(text)).replace(BETWEEN, '').toLocaleUpperCase();

  const size = make('span', { class: 'fd-code-size', id: `${id}-size` }, fillIn(letters ? words.codeCharacters : words.codeDigits, { n: length }));
  const input = make('input', {
    id,
    type: 'text',
    class: 'fd-code-input',
    spellcheck: 'false',
    autocapitalize: letters ? 'characters' : 'off',
    ...boxPurpose(node, { autocomplete: 'one-time-code', ...(letters ? {} : { inputmode: 'numeric' }) }),
  });
  const cells = Array.from({ length }, () => make('span', { class: 'fd-code-cell', 'aria-hidden': 'true' }));
  const element = make('span', { class: 'fd-code' }, ...cells, input, size);
  // Through the style object, never a style attribute: a strict Content-Security-Policy refuses those.
  element.style.setProperty('--fd-code-length', String(length));

  const why = (char: string) => fillIn(letters ? words.codeLetterOrDigit : words.codeDigitOnly, { label, char: quoted(char) });
  const full = () => fillIn(letters ? words.codeFullCharacters : words.codeFull, { label, n: length });
  const judge = (text: string): string | null => {
    const kept = foldDigits(stripMarks(text)).replace(BETWEEN, '');
    const stray = [...kept].find((char) => !fits.test(char));
    if (stray) return why(stray);
    return [...kept].length > length ? full() : null;
  };
  const rules: InputRules = {
    hold: true,
    judge: (next) => judge(next),
    paste(text) {
      const plain = text.trim();
      const start = input.selectionStart ?? input.value.length;
      const combined = input.value.slice(0, start) + plain + input.value.slice(input.selectionEnd ?? start);
      const refused = judge(combined);
      if (refused) return { refuse: refused };
      const code = clean(plain);
      return { text: code, whole: [...code].length === length };
    },
  };
  const hint = refusalHint(input, element);
  const checks = guard(input, rules, hint);

  let entered: Value | undefined;
  let readonly = false;
  const typing = () => doc.activeElement === input;
  const unreadNow = () => form.getState().unread?.[name];
  const write = (value: string | null) => {
    if ((form.getState().values[name] ?? null) !== value) form.setValue(name, value);
    if (unreadNow()) form.setUnread(name, null);
  };
  /** The boxes drawn from the text: a character each, the one the caret is at marked while it is typed in. */
  const draw = () => {
    const chars = [...input.value];
    const at = Math.min(input.selectionStart ?? chars.length, length - 1);
    cells.forEach((cell, i) => {
      setText(cell, chars[i] ?? '');
      cell.classList.toggle('fd-code-filled', i < chars.length);
      cell.classList.toggle('fd-code-caret', typing() && i === at);
    });
  };

  input.addEventListener('focus', () => {
    entered = form.getState().values[name];
    draw();
  });
  input.addEventListener('input', () => {
    if (!typing()) entered = form.getState().values[name];
    const code = clean(input.value);
    if (code !== input.value) {
      const at = clean(input.value.slice(0, input.selectionStart ?? input.value.length)).length;
      input.value = code;
      input.setSelectionRange(at, at);
    }
    checks.accept();
    draw();
    if (!code) return write(null);
    // Taken once it is whole: the field's change is the code entered.
    if ([...code].length === length) write(code);
  });
  for (const type of ['keyup', 'select', 'blur']) input.addEventListener(type, draw);
  // A press on a box: the caret there, or after the last character typed.
  input.addEventListener('pointerup', (event) => {
    const x = (event as PointerEvent).clientX;
    const at = cells.findIndex((cell) => {
      const box = cell.getBoundingClientRect();
      return x >= box.left && x <= box.right;
    });
    if (at < 0) return;
    const caret = Math.min(at, [...input.value].length);
    input.setSelectionRange(caret, caret);
    draw();
  });
  const settle = () => {
    if (readonly) return;
    const waiting = checks.held();
    if (waiting) {
      hint.hide();
      input.value = waiting.text;
      checks.accept();
    }
    // As typed: the field put back below draws the box anew where the focus has left it (a change sent as Tab leaves).
    const text = input.value;
    const code = clean(text);
    const refused = judge(text);
    if (!refused && !code) return write(null);
    if (!refused && [...code].length === length) return write(code);
    const message = refused ?? fillIn(inPlural(words.maskShort, words.maskShortOne, length - [...code].length, locale), { label });
    if ((form.getState().values[name] ?? null) !== (entered ?? null)) form.setValue(name, (entered ?? null) as Value);
    form.setUnread(name, { text, message });
  };
  input.addEventListener('change', settle);
  input.addEventListener('blur', settle);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.isComposing) settle();
  });

  return {
    element,
    focus: () => input.focus(),
    takeTyped(typed) {
      typeInto(input, typed, () => {
        entered = typed.entered;
        checks.accept();
      });
      return true;
    },
    destroy() {
      if (typing()) settle();
      checks.destroy();
    },
    update(state) {
      readonly = state.readonly;
      const unread = unreadNow();
      if (!typing()) {
        const text = unread ? unread.text : state.value === null || state.value === undefined ? '' : String(state.value);
        if (input.value !== text) input.value = text;
      }
      if (input.readOnly !== state.readonly) input.readOnly = state.readonly;
      element.toggleAttribute('data-readonly', state.readonly);
      const invalid = state.invalid || (!!unread && !typing());
      element.toggleAttribute('data-invalid', invalid);
      setAttr(input, 'aria-invalid', String(invalid));
      setAttr(input, 'aria-describedby', hint.describedBy([state.describedBy, size.id].filter(Boolean).join(' ')) ?? null);
      draw();
    },
  };
};
