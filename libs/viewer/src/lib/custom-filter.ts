import { fill, numberMisfit, readNumber, type Facet, type Field, type JsonValue, type LineField, type Locale, type Page, type ResolvedFilterCondition } from '@fieldia/core';
import { dateExample, dateOrderOf, dateShape, displayValue, guard, numberRules, readDateText, refusalHint, refusalWords, typingText, WIDGET_LABELS, type Guard, type RefusalHint } from '@fieldia/widgets';
import type { El } from './dom';
import type { ViewerLabels } from './labels';

type Op = ResolvedFilterCondition['op'];
type Words = Pick<ViewerLabels, 'opIs' | 'opIsNot' | 'opContains' | 'opGreater' | 'opLess' | 'opSet' | 'opNotSet'>;

const TEXT: [Op, keyof Words][] = [['ilike', 'opContains'], ['=', 'opIs'], ['!=', 'opIsNot'], ['set', 'opSet'], ['notset', 'opNotSet']];
const LINK: [Op, keyof Words][] = [['ilike', 'opContains'], ['set', 'opSet'], ['notset', 'opNotSet']];
const CHOICE: [Op, keyof Words][] = [['=', 'opIs'], ['!=', 'opIsNot'], ['set', 'opSet'], ['notset', 'opNotSet']];
const NUMBER: [Op, keyof Words][] = [['=', 'opIs'], ['!=', 'opIsNot'], ['>', 'opGreater'], ['<', 'opLess'], ['set', 'opSet'], ['notset', 'opNotSet']];
const DATE: [Op, keyof Words][] = [['=', 'opIs'], ['>', 'opGreater'], ['<', 'opLess'], ['set', 'opSet'], ['notset', 'opNotSet']];

/** The conditions that suit a field, or none for a field a custom filter cannot look at. */
function conditionsFor(def: Field): [Op, keyof Words][] {
  switch (def.type) {
    case 'char':
    case 'text':
    case 'html':
      return TEXT;
    case 'many2one':
    case 'many2many':
      return LINK;
    case 'selection':
      return CHOICE;
    case 'integer':
    case 'float':
    case 'monetary':
      return NUMBER;
    case 'date':
    case 'datetime':
      return DATE;
    case 'boolean':
      return [['=', 'opIs']];
    default:
      return [];
  }
}

/**
 * A filter of a person's own, under the list's filters: a field, a condition
 * that suits it, and a value of its kind. Applied, it becomes a chip.
 *
 * Its value is read as every box reads one (FIELDIA INPUT RULES): a number in
 * the page's language — its marks, Arabic and Persian digits, never hex or an
 * exponent — in a box that refuses letters as they are typed, saying why; a
 * date read by the date box's own reader, in the page's order, saying why one
 * is no day (31/02, month 13). A value that does not read is kept, and the
 * words beside it say what goes there; the chip writes the value the page's way.
 */
export function customFilterPart(context: { page: Page; el: El; labels: ViewerLabels; locale?: Locale; add: (facet: Facet) => void }) {
  const { page, el, labels } = context;
  const locale = context.locale ?? 'en';
  const words = WIDGET_LABELS[locale] ?? WIDGET_LABELS.en;
  const dateOrder = dateOrderOf({ page });
  const fields = Object.entries(page.fields).filter(([, def]) => conditionsFor(def).length);
  const field = el('select', { class: 'fd-input', 'aria-label': labels.field }, ...fields.map(([name, def]) => el('option', { value: name }, def.label)));
  const condition = el('select', { class: 'fd-input', 'aria-label': labels.condition });
  const valueBox = el('div', { class: 'fd-custom-filter-value' });
  const apply = el('button', { type: 'button', class: 'fd-button fd-button-primary' }, labels.apply);
  const form = el('div', { class: 'fd-custom-filter', hidden: '' }, field, condition, valueBox, apply);
  const button = el('button', { type: 'button', class: 'fd-search-option fd-search-add', 'aria-expanded': 'false' }, labels.addCustomFilter);
  let value: HTMLInputElement | HTMLSelectElement = el('input', { class: 'fd-input', 'aria-label': labels.value });
  /** The value box's guard and its hint: what it refuses as typed, and why Apply waits. */
  let checks: Guard | null = null;
  let hint: RefusalHint | null = null;

  const def = () => page.fields[field.value];
  const isNumber = (type: string) => type === 'integer' || type === 'float' || type === 'monetary';
  /** A date's kind, as the date box reads one; null for a field that holds no date. */
  const dateKind = (type: string) => (type === 'date' || type === 'datetime' ? type : null);

  function drawConditions() {
    condition.replaceChildren(...conditionsFor(def()).map(([op, word]) => el('option', { value: op }, labels[word])));
    drawValue();
  }

  /** A box of the field's kind: its choices, yes or no, a number, a day, or text. */
  function drawValue() {
    const current = def();
    checks?.destroy();
    checks = null;
    if (current.type === 'selection') value = el('select', { class: 'fd-input', 'aria-label': labels.value }, ...current.options.map((o) => el('option', { value: String(o.value) }, o.label)));
    else if (current.type === 'boolean') value = el('select', { class: 'fd-input', 'aria-label': labels.value }, el('option', { value: 'true' }, labels.yes), el('option', { value: 'false' }, labels.no));
    else {
      // Never the browser's number or date box: they follow the browser's language, not the page's, and drop Arabic digits.
      const date = dateKind(current.type);
      const placeholder = date ? dateShape(date, dateOrder, words) : undefined;
      value = el('input', { class: 'fd-input', type: 'text', autocomplete: 'off', 'aria-label': labels.value, ...(isNumber(current.type) ? { inputmode: 'decimal' } : {}), ...(placeholder ? { placeholder } : {}) });
    }
    valueBox.replaceChildren(value);
    hint = refusalHint(value);
    if (value instanceof HTMLInputElement && isNumber(current.type)) {
      checks = guard(value, numberRules({ label: current.label, locale, labels: words, limits: () => ({ integer: current.type === 'integer' }) }), hint);
    }
    valueBox.hidden = condition.value === 'set' || condition.value === 'notset';
  }

  field.addEventListener('change', drawConditions);
  condition.addEventListener('change', () => (valueBox.hidden = condition.value === 'set' || condition.value === 'notset'));
  button.addEventListener('click', () => {
    form.hidden = !form.hidden;
    button.setAttribute('aria-expanded', String(!form.hidden));
    if (!form.hidden) field.focus();
  });

  /** Apply waits: the value stays, and the words beside it say what goes there, politely. */
  const wait = (said: string) => {
    value.focus();
    hint?.show(said);
  };

  apply.addEventListener('click', () => {
    const current = def();
    const op = condition.value as Op;
    const word = labels[conditionsFor(current).find(([o]) => o === op)?.[1] ?? 'opIs'];
    let wanted: JsonValue = null;
    let shown = '';
    if (!valueBox.hidden) {
      const text = value.value.trim();
      const date = dateKind(current.type);
      if (current.type === 'selection') {
        const option = current.options.find((o) => String(o.value) === text);
        wanted = option?.value ?? text;
        shown = option?.label ?? text;
      } else if (current.type === 'boolean') {
        wanted = text === 'true';
        shown = wanted ? labels.yes : labels.no;
      } else if (isNumber(current.type)) {
        // Keys held after a refused one are part of what was typed ("1.5" where the box shows "1"): they stay, with why.
        const held = checks?.held();
        if (held) {
          value.value = held.text;
          return wait(held.words);
        }
        const read = readNumber(text, locale);
        if (!read.ok || read.value === null) return wait(words.enterNumber);
        // A whole number's column: "1.5" typed as it may still group ("1.500,00") is said now, never read as 15.
        const misfit = numberMisfit(read.value, { integer: current.type === 'integer' });
        if (misfit) return wait(refusalWords(misfit, { label: current.label, locale, labels: words }));
        wanted = read.value;
        // As the page writes the number: its grouping, its decimal mark, never fewer places than it has.
        shown = displayValue({ ...current, type: 'float', digits: [16, 0] } as LineField, read.value, {}, locale);
      } else if (date) {
        // As a date box reads it: the day it is, or why it is none ("Since: February 2026 has 28 days"); a date and
        // time as the instant its field keeps.
        const read = readDateText(text, { kind: date, order: dateOrder, locale, label: current.label, labels: words });
        if (!read.ok) return wait(read.words);
        if (read.value === null) return wait(words.enterDate.split('{example}').join(dateExample({ kind: date, order: dateOrder, locale })));
        // A day and time where a day goes: the day is put in the box and the time it leaves out said; Apply again takes it.
        if (read.timeLeftOut) {
          value.value = typingText(read.value, date, dateOrder, locale);
          return wait(fill(words.timeLeftOut, { label: current.label, time: read.timeLeftOut }));
        }
        wanted = read.value;
        shown = displayValue(current as LineField, read.value, {}, locale);
      } else {
        if (!text) return wait(words.enterValue);
        wanted = text;
        shown = text;
      }
    }
    hint?.hide();
    context.add({ kind: 'custom', label: [current.label, word, shown].filter(Boolean).join(' '), filter: [{ field: field.value, op, value: wanted }] });
    form.hidden = true;
    button.setAttribute('aria-expanded', 'false');
  });

  drawConditions();
  return { button, form };
}
