/**
 * How a test finds a field and reads it, as a person does: by the words of its label, and by what it shows. Each
 * function here stands alone — no import, no helper outside it — because the Playwright helpers hand it to the browser
 * to run as it is written (`evaluateAll`), as the DOM helpers run it in place.
 */

/** A field named by the words of its label, as people read them ("Email"), or by its field's name: `{ field: 'email' }`. */
export type FieldRef = string | { field: string };

/** What a field shows: its value as its box shows it, and its messages. */
export interface FieldReading {
  /** The words of its label. */
  label: string;
  /**
   * What its box shows: the text in it; a choice's words (`null` with none chosen); the words of each box ticked among
   * several; `true` or `false` for one box; a formatted text's words. Never the stored value, which is the app's.
   */
  value: string | boolean | string[] | null;
  /** The problems it says (a refused answer, a server's refusal), each in its words. */
  errors: string[];
  /** Its warnings (an answer rule's, the app's onchange's). */
  warnings: string[];
}

/** Which of `fields` (Fieldia's `.fd-field` elements) `ref` names: their places in the list. Stands alone. */
export function matchFields(fields: Element[], ref: FieldRef): number[] {
  const labelOf = (field: Element) => {
    const label = Array.from(field.children).find((child) => child.classList.contains('fd-label'));
    if (!label) return '';
    const words = label.cloneNode(true) as Element;
    // Its (?) and lock with what they say, its ✓, the words only a screen reader hears: not its label's words.
    for (const extra of Array.from(words.querySelectorAll('.fd-help-tip-wrap, .fd-lock-wrap, .fd-valid-mark, .fd-sr-only, [aria-hidden="true"]'))) extra.remove();
    return (words.textContent ?? '').replace(/\s+/g, ' ').trim();
  };
  const found: number[] = [];
  fields.forEach((field, i) => {
    const named = typeof ref === 'string' ? labelOf(field) === ref.replace(/\s+/g, ' ').trim() : field.getAttribute('data-field') === ref.field;
    if (named && !field.closest('[hidden]')) found.push(i);
  });
  return found;
}

/** The words of each field's label, for saying which there are when none is found. Stands alone. */
export function labelsOf(fields: Element[]): string[] {
  return fields
    .filter((field) => !field.closest('[hidden]'))
    .map((field) => {
      const label = Array.from(field.children).find((child) => child.classList.contains('fd-label'));
      const words = label?.cloneNode(true) as Element | undefined;
      for (const extra of Array.from(words?.querySelectorAll('.fd-help-tip-wrap, .fd-lock-wrap, .fd-valid-mark, .fd-sr-only, [aria-hidden="true"]') ?? [])) extra.remove();
      return (words?.textContent ?? '').replace(/\s+/g, ' ').trim() || `{ field: '${field.getAttribute('data-field')}' }`;
    });
}

/** What a field (its `.fd-field` element) shows, as a person reads it. Stands alone. */
export function readField(field: Element): FieldReading {
  const words = (element: Element | null | undefined) => (element?.textContent ?? '').replace(/\s+/g, ' ').trim();
  // Its own parts, never those of a field inside it (a table's line's).
  const own = <T extends Element>(selector: string) => Array.from(field.querySelectorAll<T>(selector)).filter((element) => element.closest('.fd-field') === field);
  const shown = (element: Element) => !element.closest('[hidden]');
  const label = Array.from(field.children).find((child) => child.classList.contains('fd-label'));
  const labelWords = (() => {
    const copy = label?.cloneNode(true) as Element | undefined;
    for (const extra of Array.from(copy?.querySelectorAll('.fd-help-tip-wrap, .fd-lock-wrap, .fd-valid-mark, .fd-sr-only, [aria-hidden="true"]') ?? [])) extra.remove();
    return words(copy);
  })();
  const named = (input: HTMLInputElement) => words(input.labels?.[0]) || input.getAttribute('aria-label') || words(input.closest('label')) || words(input.parentElement);
  const value = ((): FieldReading['value'] => {
    const radios = own<HTMLInputElement>('input[type="radio"]');
    if (radios.length) {
      const on = radios.find((radio) => radio.checked);
      return on ? named(on) : null;
    }
    const ticks = own<HTMLInputElement>('input[type="checkbox"]');
    if (ticks.length > 1) return ticks.filter((tick) => tick.checked).map(named);
    if (ticks.length === 1) return ticks[0].checked;
    const select = own<HTMLSelectElement>('select')[0];
    if (select) {
      const chosen = Array.from(select.selectedOptions).filter((option) => option.value !== '');
      return select.multiple ? chosen.map((option) => words(option)) : chosen.length ? words(chosen[0]) : null;
    }
    const box = own<HTMLInputElement | HTMLTextAreaElement>('input:not([type="hidden"]):not([type="file"]), textarea')[0];
    if (box) return box.value;
    const editable = own<HTMLElement>('[contenteditable]')[0];
    if (editable) return words(editable);
    // Words shown in place of a box (a value read as text, a badge): the field's, but its label and messages.
    const copy = field.cloneNode(true) as Element;
    for (const extra of Array.from(copy.querySelectorAll('.fd-label, .fd-help, .fd-error, .fd-warning, .fd-sr-only, [aria-hidden="true"]'))) extra.remove();
    return words(copy) || null;
  })();
  return {
    label: labelWords,
    value,
    errors: own('.fd-error').filter(shown).map(words).filter(Boolean),
    warnings: own('.fd-warning').filter(shown).map(words).filter(Boolean),
  };
}
