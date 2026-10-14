import { fill, MESSAGES, placesOf, readNumber, type Locale, type NumberLimits } from '@fieldia/core';
import { formatPlain, guard, numberKeyboard, numberRules, refusalHint, WIDGET_LABELS } from '@fieldia/widgets';
import type { ElementFactory } from './chrome';
import type { DesignerLocale, DesignerWords } from './designer-words';

/**
 * The designer's number box: every number setting — a field's limits, a
 * height, a label width, rows on a page, a map's minutes — is typed into one
 * of these, never the browser's own number box, which follows the browser's
 * language, drops Arabic digits and empties itself on what it cannot read.
 *
 * It is the form's number box (FIELDIA INPUT RULES): Arabic-Indic and Persian
 * digits, ٫ and a decimal comma read; letters, a misplaced minus, a decimal
 * mark in a whole number are refused as they are typed, said under the box.
 * What is typed is kept as the box is left — while typing, only a live
 * preview's text that reads and fits. Out of range, half-typed or unreadable,
 * the setting keeps what it had, the box shows it again, and the words under
 * it say what fits: "Height is a whole number, 120 or more. It stays 600."
 * Emptied, an optional limit goes; a setting that must have a number comes
 * back, said. A number the designer refuses because of another setting is
 * said at the box too, in the designer's words ("From is not less than To"),
 * never only in the issues far above it. Keys typed after a refused one are
 * held with it (the form's rules), and left so, the setting stays as it was,
 * said. ↑ and ↓ step it, as the browser's box did.
 */

export interface SettingNumberOptions {
  /** The setting's own name in the words said of it ("Height"), and its box's name unless `attrs` names it. */
  label: string;
  /** The box's class, its name for a screen reader, its placeholder. */
  attrs?: Record<string, string>;
  /** Whole numbers only. */
  integer?: boolean;
  /** The least it takes, included, and the most. */
  min?: number;
  max?: number;
  /** The least it takes, not included: "Most is more than 0". */
  above?: number;
  /** What ↑ and ↓ add and take away; 1 unless said. */
  step?: number;
  /** Emptied, the setting goes (an optional limit); else what is saved comes back, said. */
  optional?: boolean;
  /** Kept as it is typed too, once what is typed reads and fits: a preview that follows the keys. */
  live?: boolean;
  /** More than a range: why a value that fits it does not fit the setting ("fewer than the 3 options"), or null. */
  check?(value: number): string | null;
  /** What the setting holds now: shown once the box is left. */
  saved(): number | null | undefined;
  /** Keep a number, or take the setting away (null); false when the designer refused it. */
  commit(value: number | null): boolean | void;
}

export interface SettingNumber {
  input: HTMLInputElement;
  /** Show what is saved, unless the box is being typed in. */
  refresh(): void;
  destroy(): void;
}

/** What a designer box needs of its designer: its words, its language, and why it last refused an edit. */
export interface NumberBoxHost {
  readonly words: DesignerWords;
  readonly locale: DesignerLocale | null;
  /** The designer's state: `issues`, why the last edit was refused ("From is not less than To"). */
  getState?(): { readonly issues: readonly string[] };
}

/** A number as a setting's box writes it: plain, in Latin digits, all its places, never in exponent form. */
export function plainNumber(value: number, locale: Locale = 'en'): string {
  return formatPlain(value, Math.min(placesOf(value), 20), locale);
}

export function settingNumber(el: ElementFactory, host: NumberBoxHost, options: SettingNumberOptions): SettingNumber {
  const locale = host.locale ?? 'en';
  const w = host.words.inputs;
  // Read as they are now each time: a box may change its name, or whether it takes whole numbers, with its field.
  const least = () => options.min ?? options.above;
  const limits = (): NumberLimits => ({ integer: !!options.integer, ...(least() !== undefined ? { min: least() } : {}) });
  const input = el('input', { type: 'text', class: 'fd-input', autocomplete: 'off', 'aria-label': options.label, inputmode: numberKeyboard(limits()), ...options.attrs }) as HTMLInputElement;
  const hint = refusalHint(input);
  const box = {
    get label() {
      return options.label;
    },
    locale,
    labels: WIDGET_LABELS[locale] ?? WIDGET_LABELS.en,
    messages: MESSAGES[locale] ?? MESSAGES.en,
    limits,
  };
  const checks = guard(input, numberRules(box), hint);
  const focused = () => input.ownerDocument.activeElement === input;
  const shown = (value: number | null | undefined) => (typeof value === 'number' && Number.isFinite(value) ? plainNumber(value, locale) : '');
  const said = (value: number) => plainNumber(value, locale);
  /** What fits, in words: its range, or that it needs a number. */
  const fits = (): string => {
    const { label, integer, min, max, above } = options;
    if (above !== undefined) return w.settingMoreThan(label, said(above));
    if (min !== undefined && max !== undefined) return integer ? w.settingRange(label, said(min), said(max)) : w.settingNumberRange(label, said(min), said(max));
    if (min !== undefined && integer) return w.settingAtLeast(label, said(min));
    if (integer) return fill((MESSAGES[locale] ?? MESSAGES.en).integer, { label });
    return w.settingNeedsNumber(label);
  };
  /** Why a number read does not fit, or null. */
  const misfit = (value: number): string | null => {
    const { integer, min, max, above } = options;
    if ((integer && !Number.isInteger(value)) || (min !== undefined && value < min) || (max !== undefined && value > max) || (above !== undefined && value <= above)) return fits();
    return options.check?.(value) ?? null;
  };
  /**
   * The text the box was last left with, and what was said of it: a browser says change and then blur as a box is
   * left, and Enter says change too; the second is the same leaving, and says again what the first said (a blur
   * takes the hint away).
   */
  let left: { text: string; said: string | null } | null = null;
  /** What the setting held as the box was entered: a live preview's keys, which kept what read on the way, go back to it. */
  let entered: number | null | undefined;
  input.addEventListener('focus', () => {
    entered = options.saved();
    left = null;
  });
  /** The box back to what was saved before it was typed in, and why, said under it. */
  const keep = (why: string) => {
    let saved = options.saved();
    // "600" passed by 60 on its way: the preview's 60 was never what was meant.
    if (options.live && entered !== undefined && saved !== entered && options.commit(entered ?? null) !== false) saved = entered;
    input.value = shown(saved);
    checks.accept();
    const words = typeof saved === 'number' ? `${why.replace(/[.。]$/, '')}. ${w.settingStays(said(saved))}` : why;
    hint.show(words);
    left = { text: input.value, said: words };
  };

  /** A number (or none) kept, and shown as the box writes it; refused by the designer, what is saved comes back, with why under the box. */
  const kept = (value: number | null) => {
    const done = value === (options.saved() ?? null) || options.commit(value) !== false;
    if (!done) return keep(host.getState?.().issues[0] ?? fits());
    input.value = shown(value);
    checks.accept();
    left = { text: input.value, said: null };
  };

  /** The box left: what it holds kept when it reads and fits, else the setting as it was, and why. */
  function leave() {
    if (left && left.text === input.value) {
      if (left.said) hint.show(left.said);
      return;
    }
    // Keys held after a refused one ("2٫5" in a whole number, where the box shows "2"): what was typed does not fit.
    if (checks.held()) return keep(fits());
    const read = readNumber(input.value, locale);
    if (read.ok && read.value === null) return options.optional ? kept(null) : keep(w.settingNeedsNumber(options.label));
    if (!read.ok || read.value === null) return keep(fits());
    const wrong = misfit(read.value);
    if (wrong) return keep(wrong);
    kept(read.value);
  }

  input.addEventListener('input', () => {
    left = null;
    if (!options.live) return;
    const read = readNumber(input.value, locale);
    if (read.ok && read.value !== null && read.value !== options.saved() && !misfit(read.value)) options.commit(read.value);
  });
  // Left by Tab or a click elsewhere, or Enter pressed: what is typed is taken, or said not to fit.
  input.addEventListener('change', leave);
  input.addEventListener('blur', leave);
  input.addEventListener('keydown', (event) => {
    if (event.isComposing || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === 'Enter') return leave();
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
    // ↑ and ↓ step the number, as the browser's box did; at the end of its range, they say the range.
    const read = readNumber(input.value, locale);
    const from = read.ok ? (read.value ?? options.saved() ?? least() ?? 0) : null;
    if (from === null) return;
    event.preventDefault();
    const step = options.step ?? 1;
    const next = Math.round((from + (event.key === 'ArrowUp' ? step : -step)) * 1e9) / 1e9;
    if (misfit(next)) return hint.show(fits());
    input.value = shown(next);
    checks.accept();
    hint.hide();
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });

  return {
    input,
    refresh: () => {
      input.inputMode = numberKeyboard(limits());
      if (focused()) return;
      const text = shown(options.saved());
      if (input.value !== text) {
        input.value = text;
        checks.accept();
      }
    },
    destroy: () => checks.destroy(),
  };
}
