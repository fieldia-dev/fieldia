import { charCount, EMAIL_LOCAL_STRAYS, fill, hasPattern, MESSAGES, oneLine, settledText, stripMarks } from '@fieldia/core';
import { guard, refusalHint, type InputRules, type RefusalHint } from './input-rules';
import { wordsFor } from './kind-parts';
import type { WidgetContext } from './widgets';

/**
 * A text box's side of the input rules (input-rules.ts): what a line of
 * words, a password, a phone number, an email, a web address or a paragraph
 * refuses as it is typed or pasted, and what it keeps once it is left.
 *
 * - Its most characters (the field's `size`) are counted by code point, as a
 *   server counts them: a key typed at the most is refused, with words; a
 *   paste that goes over is kept whole, for the person to shorten — the
 *   counter and the field say how far over it is, and Save waits.
 * - A phone number takes digits in any script, spaces, a + first, and
 *   ( ) . - only; an email takes no spaces, and before its @ none of the
 *   marks an address has only inside quotes (a ":", a ";", a ",").
 * - A link to an address pasted ("mailto:name@example.com?subject=…") is the
 *   address it links to; the zero-width characters a paste brings into an
 *   address go, as its direction marks do.
 * - A line break pasted into one line is a space; into a password, nothing.
 *   Direction marks pasted into an email, a phone number or a web address
 *   are dropped.
 * - The keys typed after a refused one wait with it (`hold`), so "+20 1oo"
 *   is never the number "+20 1", nor "name example@x.com" the address
 *   "nameexample@x.com": left, all that was typed is the box's, and the field's
 *   own check says why it is not a phone number, an address, or how far over
 *   its most it goes.
 * - Left, one line is trimmed and spaces alone are nothing; a phone number
 *   and an answer a pattern checks keep their digits as 0-9; a password is
 *   kept as typed. Nothing is changed while the box has the focus.
 */

/** What a box holds: one line of words, a password, a phone number, an email, a web address, or a paragraph. */
export type TextKind = 'line' | 'password' | 'phone' | 'email' | 'url' | 'paragraph';

/** A guarded text box. */
export interface TextBox {
  readonly hint: RefusalHint;
  /** The box's aria-describedby: the field's own ids (`base`), and the hint's while it shows. */
  describedBy(base: string | undefined): string | undefined;
  /** The box's text as it stands now is taken: its widget wrote it. */
  accept(): void;
  destroy(): void;
}

/** Characters no phone number has, counted: anything but digits in any script, spaces, + ( ) . - and direction marks; and a plus that is not first. */
export function phoneStrays(text: string): number {
  const plain = stripMarks(text);
  return (plain.match(/[^\p{Nd}\s+().-]/gu)?.length ?? 0) + (plain.replace(/^\s*\+/, '').match(/\+/g)?.length ?? 0);
}

const spaces = (text: string) => text.match(/\s/g)?.length ?? 0;
/** Before an address's @ (all of it while there is none): its own part, where a ":" can never be. */
const localPart = (text: string) => text.split('@')[0];
/** A mark no address has before its @ that `next` has more of than `before`: the one an edit brought. */
function emailStray(next: string, before: string): string | null {
  const count = (text: string, mark: string) => localPart(text).split(mark).length - 1;
  for (const mark of new Set(localPart(next).match(EMAIL_LOCAL_STRAYS) ?? [])) if (count(next, mark) > count(before, mark)) return mark;
  return null;
}
/** A link to an address ("mailto:name@example.com?subject=…"): the address it links to; any other text as it is. */
function linkedAddress(text: string): string {
  const link = /^mailto:([^?#]*)/i.exec(text);
  if (!link) return text;
  try {
    return decodeURIComponent(link[1]);
  } catch {
    return link[1];
  }
}

/** The rules of a text box of `kind`, for its field. */
export function textRules(kind: TextKind, context: Pick<WidgetContext, 'field' | 'node' | 'labels' | 'locale'>): InputRules {
  const { field, node, labels, locale = 'en' } = context;
  const words = wordsFor(labels, locale);
  const messages = MESSAGES[locale] ?? MESSAGES.en;
  const label = node.label ?? field.label;
  const size = field.type === 'char' || field.type === 'text' ? field.size : undefined;
  /** A paste is being taken: kept whole, though it goes over the most. Until the browser has put it in, after this task. */
  let pasting = false;
  return {
    hold: true,
    judge(next, before) {
      // What is already there stays editable: only what the edit brings is judged.
      if (kind === 'phone' && phoneStrays(next) > phoneStrays(before)) return words.phoneChars;
      if (kind === 'email' && spaces(next) > spaces(before)) return words.emailNoSpaces;
      const stray = kind === 'email' ? emailStray(next, before) : null;
      if (stray) return fill(words.emailChar, { char: stray });
      if (size !== undefined && !pasting) {
        const n = charCount(next);
        if (n > size && n > charCount(before)) return fill(messages.maxLength, { label, max: size });
      }
      return null;
    },
    paste(text) {
      pasting = true;
      setTimeout(() => (pasting = false));
      let taken = kind === 'paragraph' ? text : oneLine(text, { password: kind === 'password' });
      // Copied from a page or a chat that reads right to left: its marks are no part of an address or a number.
      if (kind === 'phone' || kind === 'url') taken = stripMarks(taken).trim();
      // An address copied as its link, or with a zero-width character inside: the address.
      if (kind === 'email') taken = settledText(linkedAddress(settledText(taken, { widget: 'email' })), { widget: 'email' });
      if (kind === 'phone' && phoneStrays(taken)) return { refuse: words.phoneChars };
      if (kind === 'email' && /\s/.test(taken)) return { refuse: words.emailNoSpaces };
      return { text: taken };
    },
  };
}

/**
 * Guard `input`, a text box of `kind` for its field: refusals said by a hint
 * placed after `anchor`, and the text settled as the box is left — written
 * to the field before the page hears it was left, so what is checked then is
 * what is kept. Keys held after a refused one are part of what was typed: all
 * of it is the box's then, and the field's. A save made with the box still
 * entered (a change: Enter, Ctrl+Enter, the app's own save) settles it as
 * leaving would — its digits as 0-9, its ends trimmed — so the text saved is
 * the same whichever key saved it.
 */
export function textBox(input: HTMLInputElement | HTMLTextAreaElement, context: WidgetContext, kind: TextKind, anchor: HTMLElement = input): TextBox {
  const { form, name, field, node } = context;
  const hint = refusalHint(input, anchor);
  const checks = guard(input, textRules(kind, context), hint);
  const widget = kind === 'line' || kind === 'paragraph' ? undefined : kind;
  const pattern = hasPattern(field, node);
  /** What was typed after a refused key, held: the box's now, as typed, and the field's own words take over from the hint. */
  const takeHeld = (): boolean => {
    const held = checks.held();
    if (!held) return false;
    hint.hide();
    input.value = held.text;
    checks.accept();
    return true;
  };
  const write = (text: string) => form.setValue(name, text === '' ? null : text);
  const settle = () => {
    if (input.readOnly) return;
    const held = takeHeld();
    const settled = kind === 'paragraph' || kind === 'password' ? input.value : settledText(input.value, { widget, pattern });
    if (!held && settled === input.value) return;
    if (settled !== input.value) {
      input.value = settled;
      checks.accept();
    }
    write(settled);
  };
  input.addEventListener('change', settle);
  input.addEventListener('blur', settle);
  return {
    hint,
    describedBy: (base) => hint.describedBy(base),
    accept: () => checks.accept(),
    destroy() {
      checks.destroy();
      input.removeEventListener('change', settle);
      input.removeEventListener('blur', settle);
      // Placed beside the box, outside its widget's element: it goes with the box (a part's widget taking its place has its own).
      hint.element.remove();
    },
  };
}
