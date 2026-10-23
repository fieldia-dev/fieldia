import { stripMarks, type Value } from '@fieldia/core';
import { guard, quoted, refusalHint, type InputRules } from './input-rules';
import { boxPurpose, fillIn, maker, setAttr, typeInto, wordsFor } from './kind-parts';
import { inPlural } from './labels';
import { caretAfter, conform, masked, maskShape, readMask, valueIn, type Conformed, type Mask } from './mask';
import { installTypedStyles } from './styles-typed';
import type { Widget, WidgetContext, WidgetFactory } from './widgets';

/**
 * A text box typed to a mask (`options.mask` on a char field, mask.ts): a national ID, an IBAN, a car plate. The
 * mask's own characters are written in as the person types — "2901 " as the fifth digit is due — and Backspace over
 * one takes the character before it. A key no slot takes there is refused with why ("a digit goes here, not “o”"),
 * and the keys typed after it go in where they fit, as typed — never hidden ("10a2345" shows "1 023 45"). A paste is
 * laid out against the mask; one with words round the value ("ID 1023456789", "IBAN: SA03 …") gives the one value in
 * them; one that has none, or two, is refused whole, saying why. The field takes the
 * value once every slot it needs is filled — the characters typed (`"29010112345678"`), or as shown with the mask's
 * own (`options.maskKeeps: "shown"`); left before then, what was typed stays in the box, marked, with how many are
 * still to type, and the field keeps what it held. A value from outside that the mask does not fit is shown as it came,
 * never rewritten. In the typed part.
 */

/** A mask's settings on a node: its pattern, and whether letters are written in capitals. Null where it has none. */
export function maskOf(options: Readonly<Record<string, unknown>> | undefined): Mask | null {
  const pattern = options?.['mask'];
  return typeof pattern === 'string' && pattern ? readMask(pattern, options?.['upper'] === true) : null;
}

export const maskWidget: WidgetFactory = (context: WidgetContext): Widget => {
  const { form, name, field, node, id, document: doc, labels, locale } = context;
  const words = wordsFor(labels, locale);
  const options = node.options ?? {};
  const mask = maskOf(options) as Mask;
  const keepsShown = options['maskKeeps'] === 'shown';
  const label = node.label ?? field.label;
  // Digits alone: the phone's keypad.
  const digits = mask.parts.every((part) => !('slot' in part) || part.slot === 'digit');
  installTypedStyles(doc);
  // Left to right, as an ID's, an IBAN's or a plate's groups are written — where it has no letters of a script written
  // right to left (`dir: auto` then follows them).
  const input = maker(doc)('input', { id, type: 'text', class: 'fd-input fd-masked', dir: digits || mask.upper ? 'ltr' : 'auto', spellcheck: 'false', ...boxPurpose(node, { autocomplete: 'off', ...(digits ? { inputmode: 'numeric' } : {}) }) });
  input.placeholder = node.placeholder || maskShape(mask);
  if (mask.upper) input.setAttribute('autocapitalize', 'characters');

  /** Why text does not fit the mask, in the page's words. */
  const why = (read: Extract<Conformed, { ok: false }>) =>
    read.want === 'room'
      ? fillIn(words.maskFull, { label, n: mask.most })
      : fillIn(read.want === 'digit' ? words.maskDigit : read.want === 'letter' ? words.maskLetter : words.maskEither, { label, char: quoted(read.char) });
  /** The text with `text` in place of the box's selection. */
  const spliced = (text: string) => input.value.slice(0, input.selectionStart ?? input.value.length) + text + input.value.slice(input.selectionEnd ?? input.value.length);
  const rules: InputRules = {
    stay: true,
    judge(next) {
      const read = conform(next, mask);
      return read.ok ? null : why(read);
    },
    paste(text) {
      const plain = stripMarks(text).replace(/(\r\n|[\r\n])+$/, '').trim();
      const read = conform(spliced(plain), mask);
      if (!read.ok) {
        // Words round the value: the one value in them, taken whole.
        const found = valueIn(plain, mask);
        return found ? { text: found.shown, whole: true } : { refuse: why(read) };
      }
      // A whole value pasted over all the box holds: written the mask's way at once.
      const replacing = (input.selectionStart ?? 0) === 0 && (input.selectionEnd ?? 0) >= input.value.length;
      return replacing ? { text: read.shown, whole: true } : { text: plain };
    },
  };
  const hint = refusalHint(input);
  const checks = guard(input, rules, hint);

  /** What the field held as the box was entered: text left that does not read puts it back. */
  let entered: Value | undefined;
  let readonly = false;
  /** The last edit put characters in (typing, a paste): the mask's own after them are written, so the next key lands after them. */
  let inserted = false;
  const typing = () => doc.activeElement === input;
  const unreadNow = () => form.getState().unread?.[name];
  const valueOf = (read: Extract<Conformed, { ok: true }>) => (keepsShown ? (conform(read.shown, mask) as Extract<Conformed, { ok: true }>).shown : read.typed);
  /** A value as the box shows it: laid out by the mask where it fits, else as it came. */
  const shownOf = (value: Value | undefined) => (value === null || value === undefined ? '' : (masked(String(value), mask) ?? String(value)));
  const write = (value: string | null) => {
    if ((form.getState().values[name] ?? null) !== value) form.setValue(name, value);
    if (unreadNow()) form.setUnread(name, null);
  };

  input.addEventListener('focus', () => {
    entered = form.getState().values[name];
  });
  input.addEventListener('beforeinput', (event) => {
    const type = (event as InputEvent).inputType;
    // Refused, or a key held after a refused one taken back: the guard's (it listens first).
    if (event.defaultPrevented) return;
    inserted = type.startsWith('insert');
    // Backspace or Delete on one of the mask's own characters: the character typed beside it goes instead.
    const at = input.selectionStart ?? 0;
    if (at !== input.selectionEnd || readonly) return;
    const back = type === 'deleteContentBackward';
    if (!back && type !== 'deleteContentForward') return;
    const read = conform(input.value, mask);
    if (!read.ok) return;
    const slots = conform(input.value.slice(0, at), mask);
    const before = slots.ok ? slots.filled : 0;
    const own = (index: number) => index >= 0 && index < input.value.length && !('slot' in (mask.parts[index] ?? { slot: 'digit' }));
    if (!own(back ? at - 1 : at)) return;
    event.preventDefault();
    const gone = back ? before - 1 : before;
    if (gone < 0 || gone >= read.filled) return;
    const typed = [...read.typed];
    typed.splice(gone, 1);
    const next = conform(typed.join(''), mask);
    if (!next.ok) return;
    input.value = next.shown;
    const caret = caretAfter(next.shown, mask, gone);
    input.setSelectionRange(caret, caret);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  input.addEventListener('input', () => {
    // Written while the person is elsewhere (the browser's autofill): what the field held as it came is kept should it not read.
    if (!typing()) entered = form.getState().values[name];
    const at = input.selectionStart ?? input.value.length;
    const atEnd = at >= input.value.length;
    const read = conform(input.value, mask, inserted && atEnd);
    if (!read.ok) return;
    if (input.value !== read.shown) {
      const before = conform(input.value.slice(0, at), mask);
      input.value = read.shown;
      const caret = atEnd ? read.shown.length : caretAfter(read.shown, mask, before.ok ? before.filled : 0);
      input.setSelectionRange(caret, caret);
    }
    checks.accept();
    if (!read.filled) return write(null);
    // Taken once every slot it needs is filled; until then the field holds what it held.
    if (read.filled >= mask.needed) write(valueOf(read));
  });
  /** Read as the box is left, or as a save reads it first: taken, or kept as typed with why, the field holding what it held. */
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
    const read = conform(text, mask);
    if (read.ok && !read.filled) return write(null);
    if (read.ok && read.filled >= mask.needed) return write(valueOf(read));
    // Not whole, or a text that does not fit (kept from a key held after a refused one).
    const message = read.ok ? fillIn(inPlural(words.maskShort, words.maskShortOne, mask.needed - read.filled, locale), { label }) : why(read);
    if ((form.getState().values[name] ?? null) !== (entered ?? null)) form.setValue(name, (entered ?? null) as Value);
    form.setUnread(name, { text, message });
  };
  input.addEventListener('change', settle);
  input.addEventListener('blur', () => {
    settle();
    const unread = unreadNow();
    const text = unread ? unread.text : shownOf(form.getState().values[name]);
    if (input.value !== text) input.value = text;
    inserted = false;
  });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.isComposing) settle();
  });

  return {
    element: input,
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
      hint.element.remove();
    },
    update(state) {
      readonly = state.readonly;
      const unread = unreadNow();
      if (!typing()) {
        const text = unread ? unread.text : shownOf(state.value);
        if (input.value !== text) input.value = text;
      }
      if (input.readOnly !== state.readonly) input.readOnly = state.readonly;
      setAttr(input, 'aria-invalid', String(state.invalid || (!!unread && !typing())));
      setAttr(input, 'aria-describedby', hint.describedBy(state.describedBy) ?? null);
    },
  };
};
