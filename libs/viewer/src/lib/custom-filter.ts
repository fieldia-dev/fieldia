import type { Facet, Field, JsonValue, Page, ResolvedFilterCondition } from '@fieldia/core';
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
 */
export function customFilterPart(context: { page: Page; el: El; labels: ViewerLabels; add: (facet: Facet) => void }) {
  const { page, el, labels } = context;
  const fields = Object.entries(page.fields).filter(([, def]) => conditionsFor(def).length);
  const field = el('select', { class: 'fd-input', 'aria-label': labels.field }, ...fields.map(([name, def]) => el('option', { value: name }, def.label)));
  const condition = el('select', { class: 'fd-input', 'aria-label': labels.condition });
  const valueBox = el('span', { class: 'fd-custom-filter-value' });
  const apply = el('button', { type: 'button', class: 'fd-button fd-button-primary' }, labels.apply);
  const form = el('div', { class: 'fd-custom-filter', hidden: '' }, field, condition, valueBox, apply);
  const button = el('button', { type: 'button', class: 'fd-search-option fd-search-add', 'aria-expanded': 'false' }, labels.addCustomFilter);
  let value: HTMLInputElement | HTMLSelectElement = el('input', { class: 'fd-input', 'aria-label': labels.value });

  const def = () => page.fields[field.value];

  function drawConditions() {
    condition.replaceChildren(...conditionsFor(def()).map(([op, word]) => el('option', { value: op }, labels[word])));
    drawValue();
  }

  /** A box of the field's kind: its choices, yes or no, a number, a day, or text. */
  function drawValue() {
    const current = def();
    if (current.type === 'selection') value = el('select', { class: 'fd-input', 'aria-label': labels.value }, ...current.options.map((o) => el('option', { value: String(o.value) }, o.label)));
    else if (current.type === 'boolean') value = el('select', { class: 'fd-input', 'aria-label': labels.value }, el('option', { value: 'true' }, labels.yes), el('option', { value: 'false' }, labels.no));
    else {
      const type = ['integer', 'float', 'monetary'].includes(current.type) ? 'number' : current.type === 'date' ? 'date' : current.type === 'datetime' ? 'datetime-local' : 'text';
      value = el('input', { class: 'fd-input', type, 'aria-label': labels.value });
    }
    valueBox.replaceChildren(value);
    valueBox.hidden = condition.value === 'set' || condition.value === 'notset';
  }

  field.addEventListener('change', drawConditions);
  condition.addEventListener('change', () => (valueBox.hidden = condition.value === 'set' || condition.value === 'notset'));
  button.addEventListener('click', () => {
    form.hidden = !form.hidden;
    button.setAttribute('aria-expanded', String(!form.hidden));
    if (!form.hidden) field.focus();
  });

  apply.addEventListener('click', () => {
    const current = def();
    const op = condition.value as Op;
    const word = labels[conditionsFor(current).find(([o]) => o === op)?.[1] ?? 'opIs'];
    let wanted: JsonValue = null;
    let shown = '';
    if (!valueBox.hidden) {
      const text = value.value.trim();
      if (!text) return value.focus();
      if (current.type === 'selection') {
        const option = current.options.find((o) => String(o.value) === text);
        wanted = option?.value ?? text;
        shown = option?.label ?? text;
      } else if (current.type === 'boolean') {
        wanted = text === 'true';
        shown = wanted ? labels.yes : labels.no;
      } else if (['integer', 'float', 'monetary'].includes(current.type)) {
        wanted = Number(text);
        if (!Number.isFinite(wanted)) return value.focus();
        shown = text;
      } else {
        wanted = text;
        shown = text;
      }
    }
    context.add({ kind: 'custom', label: [current.label, word, shown].filter(Boolean).join(' '), filter: [{ field: field.value, op, value: wanted }] });
    form.hidden = true;
    button.setAttribute('aria-expanded', 'false');
  });

  drawConditions();
  return { button, form };
}
