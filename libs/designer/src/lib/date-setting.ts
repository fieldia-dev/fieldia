import type { Page } from '@fieldia/core';
import { datePart, dateOrderOf, dateShape, guard, readDateText, refusalHint, restingText, typingText, WIDGET_LABELS, type DateKind, type DatePart, type DateReader, type Guard } from '@fieldia/widgets';
import type { ElementFactory } from './chrome';
import type { NumberBoxHost } from './number-box';

/**
 * The designer's date box: a setting that is a day, a day and time or a time
 * of day — a date's earliest or latest day, a time's earliest and latest, the
 * value a rule sets a date to — is typed into one of these, never the
 * browser's own date or time box, which follows the browser's language, takes
 * no paste and drops Arabic digits.
 *
 * It is the form's date box (FIELDIA INPUT RULES): typed in the page's order,
 * which its placeholder shows (dd/mm/yyyy); ISO 2026-03-02 always; Arabic and
 * Persian digits; a date as Fieldia writes it at rest (2 Mar 2026). A key no
 * date is written with, and a paste that is no date, are refused with words
 * under the box, the keys typed after a refused one waiting with it — never a
 * day made of the rest. What is typed is kept as the box is left, or on Enter; at
 * rest the box shows it in words, so how it was read can be seen. Half typed
 * or impossible (31/02, a year of two digits), the setting keeps what it had,
 * the box shows it again, and the words under it say why: "Earliest day:
 * February 2026 has 28 days. It stays 2 Mar 2026." Emptied, the setting goes.
 * A date the designer refuses because of another setting is said at the box
 * too ("The earliest day is after the latest").
 */

export interface SettingDateOptions {
  kind: DateKind;
  /** The setting's own name in the words said of it ("Earliest day"), and its box's name unless `attrs` names it. */
  label: string;
  /** The box's class, its name for a screen reader. */
  attrs?: Record<string, string>;
  /**
   * What the setting holds now, as a page keeps it: a day 2026-03-02, a time 09:00, a day and time as the moment it
   * is where the page is used, 2026-03-02T14:30. Shown in words once the box is left.
   */
  saved(): string | null | undefined;
  /** Keep a value, or take the setting away (null); false when the designer refused it. */
  commit(value: string | null): boolean | void;
}

export interface SettingDate {
  input: HTMLInputElement;
  /** Show what is saved, unless the box is being typed in. */
  refresh(): void;
  destroy(): void;
}

/** What a date box needs of its designer: a number box's needs, and the page, whose order its dates are typed in. */
export interface DateSettingHost extends NumberBoxHost {
  getPage(): Page;
}

const pad = (n: number) => String(n).padStart(2, '0');
/** A moment read (an instant) as a page's setting writes a day and time, as the browser's box did: its local day and time, to the minute. */
const localMoment = (instant: string) => {
  const d = new Date(instant);
  return `${String(d.getFullYear()).padStart(4, '0')}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export function settingDate(el: ElementFactory, host: DateSettingHost, options: SettingDateOptions): SettingDate {
  const locale = host.locale ?? 'en';
  const w = host.words.inputs;
  const labels = WIDGET_LABELS[locale] ?? WIDGET_LABELS.en;
  const { kind } = options;
  // Read as it is at each edit: the page's order, and the setting's name, may change while the box is drawn.
  const reader: DateReader = {
    kind,
    get order() {
      return dateOrderOf({ page: host.getPage() });
    },
    locale,
    get label() {
      return options.label;
    },
    labels,
  };
  const input = el('input', { type: 'text', class: 'fd-input', autocomplete: 'off', spellcheck: 'false', 'aria-label': options.label, placeholder: dateShape(kind, reader.order, labels), ...options.attrs }) as HTMLInputElement;
  input.dataset['kind'] = kind;
  const hint = refusalHint(input);
  const focused = () => input.ownerDocument.activeElement === input;
  const atRest = (value: string | null | undefined) => (value ? restingText(value, kind, locale) : '');
  const typing = (value: string | null | undefined) => (value ? typingText(value, kind, reader.order, locale) : '');

  // The box's input rules come with Fieldia's own date box, in the date part: at once where a date was drawn already.
  let checks: Guard | null = null;
  let gone = false;
  const attach = (part: DatePart) => {
    if (gone || checks) return;
    checks = guard(input, part.dateRules(input, reader), hint);
    if (focused()) checks.accept();
  };
  if (datePart.loaded) attach(datePart.loaded);
  else datePart.load().then(attach, () => undefined);

  /** The box showing `text`: what a refused edit goes back to. */
  const shown = (text: string) => {
    if (input.value !== text) input.value = text;
    checks?.accept();
  };

  /** The text the box was last left with, and what was said of it: change, then focusout, are one leaving. */
  let left: { text: string; said: string | null } | null = null;
  input.addEventListener('focus', () => {
    left = null;
    // Entered, the box shows what is saved as it is typed, all of it chosen, so typing replaces it.
    const text = typing(options.saved());
    if (input.value !== text) {
      shown(text);
      input.setSelectionRange(0, text.length);
    }
  });

  /** The box back to what was saved, and why, said under it. */
  const keep = (why: string | undefined) => {
    const saved = options.saved();
    shown(focused() ? typing(saved) : atRest(saved));
    const stays = saved ? w.settingStays(atRest(saved)) : '';
    const words = [why?.replace(/[.。]$/, ''), stays].filter(Boolean).join('. ') || stays;
    if (words) hint.show(words);
    left = { text: input.value, said: words || null };
  };
  /** A value (or none) kept and shown; refused by the designer, what is saved comes back, with why under the box. */
  const kept = (value: string | null) => {
    const done = value === (options.saved() ?? null) || options.commit(value) !== false;
    // Refused with no word of why from the designer: never in silence — that it was not taken, at least.
    if (!done) return keep(host.getState?.().issues[0] ?? w.settingDateRefused(options.label));
    shown(focused() ? typing(value) : atRest(value));
    hint.hide();
    left = { text: input.value, said: null };
  };

  /** The box left, or Enter pressed: what it holds kept when it reads, else the setting as it was, and why. */
  function leave() {
    if (left && left.text === input.value) {
      if (left.said) hint.show(left.said);
      return;
    }
    // Keys held after a refused one ("1x5/10/2026" where the box shows "1"): what was typed, read whole, is no date.
    const held = checks?.held();
    const read = readDateText(held?.text ?? input.value, reader);
    if (held || !read.ok) return keep(read.ok ? held?.words : read.words);
    kept(read.value !== null && kind === 'datetime' ? localMoment(read.value) : read.value);
  }
  input.addEventListener('input', () => (left = null));
  input.addEventListener('change', leave);
  // After the guard's own blur, which takes its hint away: what was found is said last, the box at rest in words.
  input.addEventListener('focusout', () => {
    leave();
    shown(atRest(options.saved()));
    if (left) left.text = input.value;
  });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.isComposing) leave();
  });

  return {
    input,
    refresh: () => {
      input.placeholder = dateShape(kind, reader.order, labels);
      if (!focused()) shown(atRest(options.saved()));
    },
    destroy: () => {
      gone = true;
      checks?.destroy();
    },
  };
}
