import type {
  Field,
  FieldNode,
  FileValue,
  Form,
  Line,
  ReferenceValue,
  RelatedRecord,
  Value,
  Values,
} from '@fieldia/core';
import type { WidgetLabels } from './labels';
import { linkCheckboxesWidget, many2oneWidget, referenceWidget, tagsWidget } from './relations';
import { linesWidget } from './lines';

/**
 * Field inputs in plain DOM. Each widget builds its element once and then only
 * patches it from state, so typing never loses focus or the caret, and the
 * same widget serves every framework binding.
 */

export interface WidgetContext {
  form: Form;
  /** The field's name in the page. */
  name: string;
  field: Field;
  node: FieldNode;
  /** The id the field's label points at. */
  id: string;
  document: Document;
  /** Words the widget shows itself, in the page's language. English when left out. */
  labels?: WidgetLabels;
}

export interface WidgetState {
  value: Value | undefined;
  /** Every value of the record, for widgets that show one field beside another. */
  values: Readonly<Values>;
  readonly: boolean;
  required: boolean;
  invalid: boolean;
  /** Ids of the help and error text, for assistive technology. */
  describedBy?: string;
}

export interface Widget {
  element: HTMLElement;
  update(state: WidgetState): void;
  focus(): void;
  destroy?(): void;
}

export type WidgetFactory = (context: WidgetContext) => Widget;

/**
 * Pick the widget for a field: the app's or the built-in one for
 * `type.widget` (such as `selection.radio`), then for the type alone. A type
 * with no editor yet shows its value read-only.
 */
export function createWidget(context: WidgetContext, registry: Record<string, WidgetFactory> = {}): Widget {
  const { field, node } = context;
  const keys = [
    node.widget ? `${field.type}.${node.widget}` : null,
    field.type === 'selection' && field.multiple ? 'selection.checkboxes' : null,
    field.type,
  ].filter((key): key is string => key !== null);
  for (const key of keys) {
    const factory = registry[key] ?? builtInWidgets[key];
    if (factory) return factory(context);
  }
  return pendingWidget(context);
}

// ---------------------------------------------------------------------------

function make<K extends keyof HTMLElementTagNameMap>(
  doc: Document,
  tag: K,
  props: Partial<Record<string, string>> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const element = doc.createElement(tag);
  for (const [name, value] of Object.entries(props)) if (value !== undefined) element.setAttribute(name, value);
  element.append(...children);
  return element;
}

function describe(element: HTMLElement, state: WidgetState) {
  element.setAttribute('aria-invalid', String(state.invalid));
  element.setAttribute('aria-required', String(state.required));
  if (state.describedBy) element.setAttribute('aria-describedby', state.describedBy);
  else element.removeAttribute('aria-describedby');
}

const textOf = (value: Value | undefined) => (value === null || value === undefined ? '' : String(value));

function textWidget(inputType: string): WidgetFactory {
  return ({ form, name, field, node, id, document }) => {
    const input = make(document, 'input', { id, type: inputType, class: 'fd-input', autocomplete: 'off' });
    if (field.type === 'char' && field.size !== undefined) input.maxLength = field.size;
    if (node.placeholder) input.placeholder = node.placeholder;
    input.addEventListener('input', () => form.setValue(name, input.value === '' ? null : input.value));
    return {
      element: input,
      focus: () => input.focus(),
      update(state) {
        const text = textOf(state.value);
        if (input.value !== text) input.value = text;
        input.readOnly = state.readonly;
        describe(input, state);
      },
    };
  };
}

const textareaWidget: WidgetFactory = ({ form, name, field, node, id, document }) => {
  const area = make(document, 'textarea', { id, class: 'fd-input fd-textarea', rows: '3' });
  if (field.type === 'text' && field.size !== undefined) area.maxLength = field.size;
  if (node.placeholder) area.placeholder = node.placeholder;
  area.addEventListener('input', () => form.setValue(name, area.value === '' ? null : area.value));
  return {
    element: area,
    focus: () => area.focus(),
    update(state) {
      const text = textOf(state.value);
      if (area.value !== text) area.value = text;
      area.readOnly = state.readonly;
      describe(area, state);
    },
  };
};

const NUMBER = /^-?(\d+\.?\d*|\.\d+)$/;
const UNFINISHED = /^-?\.?$/;

/** Numbers stay as typed while focused: "1." means 1 now and 1.5 a keystroke later. */
const numberWidget: WidgetFactory = (context) => {
  const { form, name, field, node, id, document } = context;
  const integer = field.type === 'integer';
  const input = make(document, 'input', { id, type: 'text', class: 'fd-input fd-number-input', autocomplete: 'off' });
  input.inputMode = integer ? 'numeric' : 'decimal';
  if (node.placeholder) input.placeholder = node.placeholder;

  const parse = (raw: string): Value | undefined => {
    const text = raw.trim();
    if (text === '') return null;
    if (NUMBER.test(text)) return Number(text);
    if (UNFINISHED.test(text)) return undefined; // "-" or ".": keep typing
    return text; // not a number: validation names it
  };
  input.addEventListener('input', () => {
    const value = parse(input.value);
    if (value !== undefined) form.setValue(name, value);
  });
  input.addEventListener('blur', () => {
    input.value = textOf(form.getState().values[name]);
  });

  const currency = field.type === 'monetary' ? make(document, 'span', { class: 'fd-currency', 'aria-hidden': 'true' }) : null;
  const element = currency ? make(document, 'span', { class: 'fd-number' }, currency, input) : input;

  return {
    element,
    focus: () => input.focus(),
    update(state) {
      const typing = document.activeElement === input;
      const parsed = parse(input.value);
      const showsSame = parsed === undefined || parsed === state.value;
      if (!(typing && showsSame)) {
        const text = textOf(state.value);
        if (input.value !== text) input.value = text;
      }
      input.readOnly = state.readonly;
      describe(input, state);
      if (currency && field.type === 'monetary') {
        const holder = field.currencyField ? state.values[field.currencyField] : null;
        currency.textContent =
          holder && typeof holder === 'object' && 'label' in holder ? (holder as RelatedRecord).label : (typeof holder === 'string' ? holder : field.currency ?? '');
      }
    },
  };
};

function checkboxWidget(role?: 'switch'): WidgetFactory {
  return ({ form, name, id, document }) => {
    const box = make(document, 'input', { id, type: 'checkbox', class: role ? 'fd-switch' : 'fd-checkbox', role });
    box.addEventListener('change', () => form.setValue(name, box.checked));
    return {
      element: box,
      focus: () => box.focus(),
      update(state) {
        box.checked = state.value === true;
        box.disabled = state.readonly;
        describe(box, state);
      },
    };
  };
}

function options(field: Field) {
  return field.type === 'selection' ? field.options : [];
}

const selectWidget: WidgetFactory = ({ form, name, field, id, document }) => {
  const choices = options(field);
  const select = make(document, 'select', { id, class: 'fd-input fd-select' }, make(document, 'option', { value: '' }));
  choices.forEach((option, i) => select.append(make(document, 'option', { value: String(i) }, option.label)));
  select.addEventListener('change', () => form.setValue(name, select.value === '' ? null : choices[Number(select.value)].value));
  return {
    element: select,
    focus: () => select.focus(),
    update(state) {
      const index = choices.findIndex((option) => option.value === state.value);
      select.value = index === -1 ? '' : String(index);
      select.disabled = state.readonly;
      describe(select, state);
    },
  };
};

function choiceGroup(kind: 'radio' | 'checkbox'): WidgetFactory {
  return ({ form, name, field, id, document }) => {
    const choices = options(field);
    const group = make(document, 'div', { id, class: `fd-choices fd-choices-${kind}`, role: kind === 'radio' ? 'radiogroup' : 'group' });
    const inputs = choices.map((option, i) => {
      const input = make(document, 'input', { type: kind, name: id, value: String(i), id: `${id}-${i}` });
      group.append(make(document, 'label', { class: 'fd-choice', for: `${id}-${i}` }, input, make(document, 'span', {}, option.label)));
      return input;
    });
    group.addEventListener('change', () => {
      if (kind === 'radio') {
        const chosen = inputs.findIndex((input) => input.checked);
        form.setValue(name, chosen === -1 ? null : choices[chosen].value);
      } else {
        form.setValue(name, choices.filter((_, i) => inputs[i].checked).map((option) => option.value));
      }
    });
    return {
      element: group,
      focus: () => (inputs.find((input) => input.checked) ?? inputs[0])?.focus(),
      update(state) {
        const chosen = Array.isArray(state.value) ? state.value : [state.value];
        inputs.forEach((input, i) => {
          input.checked = chosen.includes(choices[i].value as never);
          input.disabled = state.readonly;
        });
        describe(group, state);
      },
    };
  };
}

/** Stars or numbers to pick from, as a radio group with arrow-key support. */
function pointsWidget(style: 'rating' | 'scale'): WidgetFactory {
  return ({ form, name, field, id, document }) => {
    const min = 'min' in field && field.min !== undefined ? field.min : style === 'rating' ? 1 : 0;
    const max = 'max' in field && field.max !== undefined ? field.max : style === 'rating' ? 5 : 10;
    const group = make(document, 'div', { id, class: `fd-points fd-${style}`, role: 'radiogroup' });
    const points: HTMLButtonElement[] = [];
    for (let n = min; n <= max; n++) {
      const point = make(document, 'button', { type: 'button', role: 'radio', 'aria-label': `${n} of ${max}`, 'data-value': String(n) }, style === 'rating' ? '★' : String(n));
      if (style === 'scale') point.removeAttribute('aria-label');
      point.addEventListener('click', () => form.setValue(name, n));
      points.push(point);
      group.append(point);
    }
    group.addEventListener('keydown', (event) => {
      const current = form.getState().values[name];
      const value = typeof current === 'number' ? current : min - 1;
      const step = event.key === 'ArrowRight' || event.key === 'ArrowUp' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowDown' ? -1 : 0;
      if (!step) return;
      event.preventDefault();
      const next = Math.min(max, Math.max(min, value + step));
      form.setValue(name, next);
      points[next - min]?.focus();
    });
    return {
      element: group,
      focus: () => (points.find((p) => p.getAttribute('aria-checked') === 'true') ?? points[0])?.focus(),
      update(state) {
        const value = typeof state.value === 'number' ? state.value : null;
        points.forEach((point, i) => {
          const n = min + i;
          point.setAttribute('aria-checked', String(n === value));
          point.classList.toggle('fd-on', style === 'rating' ? value !== null && n <= value : n === value);
          point.tabIndex = n === value || (value === null && i === 0) ? 0 : -1;
          point.disabled = state.readonly;
        });
        describe(group, state);
      },
    };
  };
}

const dateWidget: WidgetFactory = ({ form, name, id, document }) => {
  const input = make(document, 'input', { id, type: 'date', class: 'fd-input fd-date' });
  input.addEventListener('input', () => form.setValue(name, input.value || null));
  return {
    element: input,
    focus: () => input.focus(),
    update(state) {
      const text = textOf(state.value);
      if (input.value !== text) input.value = text;
      input.readOnly = state.readonly;
      describe(input, state);
    },
  };
};

const pad = (n: number) => String(n).padStart(2, '0');

/** Shown in local time, stored as an ISO instant in UTC. */
const dateTimeWidget: WidgetFactory = ({ form, name, id, document }) => {
  const input = make(document, 'input', { id, type: 'datetime-local', class: 'fd-input fd-datetime' });
  const local = (iso: Value | undefined) => {
    if (typeof iso !== 'string' || !iso) return '';
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '' : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  input.addEventListener('input', () => {
    if (!input.value) return form.setValue(name, null);
    const d = new Date(input.value);
    if (!Number.isNaN(d.getTime())) form.setValue(name, d.toISOString());
  });
  return {
    element: input,
    focus: () => input.focus(),
    update(state) {
      const text = local(state.value);
      if (input.value !== text) input.value = text;
      input.readOnly = state.readonly;
      describe(input, state);
    },
  };
};

/** Until a type has its own editor (Phase 5), show what it holds. */
function pendingWidget({ field, id, document }: WidgetContext): Widget {
  const span = make(document, 'span', { id, class: 'fd-pending', 'data-fd-pending': field.type });
  return {
    element: span,
    focus: () => undefined,
    update(state) {
      span.textContent = summary(state.value, field);
    },
  };
}

export function summary(value: Value | undefined, field: Field): string {
  if (value === null || value === undefined) return '';
  switch (field.type) {
    case 'many2one':
    case 'reference':
      return (value as RelatedRecord | ReferenceValue).label;
    case 'many2many':
      return (value as RelatedRecord[]).map((record) => record.label).join(', ');
    case 'one2many': {
      const count = (value as Line[]).length;
      return `${count} ${count === 1 ? 'line' : 'lines'}`;
    }
    case 'binary':
    case 'image':
      return (value as FileValue).name;
    case 'html':
      return String(value).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    default:
      return typeof value === 'object' ? JSON.stringify(value) : String(value);
  }
}

export const builtInWidgets: Record<string, WidgetFactory> = {
  char: textWidget('text'),
  'char.email': textWidget('email'),
  'char.phone': textWidget('tel'),
  'char.url': textWidget('url'),
  'char.password': textWidget('password'),
  text: textareaWidget,
  integer: numberWidget,
  float: numberWidget,
  monetary: numberWidget,
  'integer.rating': pointsWidget('rating'),
  'integer.scale': pointsWidget('scale'),
  boolean: checkboxWidget(),
  'boolean.toggle': checkboxWidget('switch'),
  selection: selectWidget,
  'selection.radio': choiceGroup('radio'),
  'selection.checkboxes': choiceGroup('checkbox'),
  date: dateWidget,
  datetime: dateTimeWidget,
  many2one: many2oneWidget,
  many2many: tagsWidget,
  'many2many.tags': tagsWidget,
  'many2many.checkboxes': linkCheckboxesWidget,
  reference: referenceWidget,
  one2many: linesWidget,
};
