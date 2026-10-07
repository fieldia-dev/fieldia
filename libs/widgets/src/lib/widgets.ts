import type {
  Field,
  FieldNode,
  FileValue,
  Form,
  Line,
  Locale,
  RecordId,
  ReferenceValue,
  RelatedRecord,
  Value,
  Values,
} from '@fieldia/core';
import type { PreferenceStore } from './preferences';
import { formatNumber, normalizeNumber } from './numbers';
import type { WidgetLabels } from './labels';
import { charTagsWidget, linkCheckboxesWidget, many2oneWidget, referenceWidget, tagsWidget } from './relations';
import { linesWidget } from './lines';
import { binaryWidget, imageWidget } from './files';
import { progressbarWidget } from './progress';
import { labelWidget } from './label';
import { statusbarWidget } from './statusbar';
import { withCalendar } from './calendar';
import { propertiesWidget } from './properties';
import { htmlWidget, jsonWidget } from './extras';
import { matrixWidget } from './matrix';
import { signatureWidget } from './signature';
import { sliderWidget } from './slider';
import { choiceTagsWidget, searchWidget } from './choice-tags';
import { imageChoiceWidget } from './choice-images';
import { rankingWidget } from './ranking';
import { addressWidget } from './address';
import { cardsWidget } from './cards';
import { clearSelection, fillIn, maker, setAttr, setText, wordsFor } from './kind-parts';
import { shownOptions } from './shuffle';
import { bounds, counted, grower } from './limits';
import { currencySymbol } from './units';
import { currencyOf } from './display';
import { drawIcon } from './icons';
import { listChoices } from './choices-from';
import { yesNoWidget } from './yes-no';
import { badgeWidget } from './badge';
import { linksTableWidget } from './links-table';
import { layOut, limiter } from './choice-rules';
import { durationWidget, percentageWidget } from './duration';
import { priorityWidget } from './priority';

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
  /** Where to keep a person's choices about how the widget looks, such as a table's columns. */
  preferences?: PreferenceStore;
  /** The page's language: numbers and dates are written as its readers write them. English when left out. */
  locale?: Locale;
  /** Dialogs the page can open: a related record, a searchable list, values to edit. Left out, widgets offer none. */
  dialogs?: WidgetDialogs;
}

/** What a widget may ask of the page around it in a dialog. The viewer provides these. */
export interface WidgetDialogs {
  /** Whether a record of this model can be shown in a dialog: the app gave a page for it. */
  canOpen(model: string): boolean;
  /**
   * A record in a dialog: an existing one (`recordId`) or a new one, whose name
   * starts as `name`. Resolves with the record once saved, or null; asked
   * `withValues`, with its values as its page saved them too.
   */
  openRecord(model: string, request: { recordId?: RecordId; name?: string; title: string; values?: Values; withValues?: boolean }): Promise<(RelatedRecord & { values?: Values }) | null>;
  /** Pick a record from a searchable list. */
  searchMore(request: { title: string; search(query: string, limit: number): Promise<RelatedRecord[]> }): Promise<RelatedRecord | null>;
  /**
   * Values edited in a form made of these fields. Resolves with the new values,
   * or null. `recompute` recalculates them as they change, as a line's onchange.
   */
  editValues(request: { title: string; fields: Record<string, Field>; values: Values; readonly?: boolean; recompute?: (values: Values) => Promise<Values> }): Promise<Values | null>;
}

export interface WidgetState {
  value: Value | undefined;
  /** Every value of the record, for widgets that show one field beside another. */
  values: Readonly<Values>;
  /** In a cell of a table's line: the values of the record the line is on, for money in its currency (`parent.currency_id`). */
  parent?: Readonly<Values>;
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
    // A many2many with columns is a table of its records, as Flectra's list of them.
    field.type === 'many2many' && node.columns?.length ? 'many2many.table' : null,
    field.type,
  ].filter((key): key is string => key !== null);
  for (const key of keys) {
    const factory = registry[key] ?? builtInWidgets[key];
    // Choices from the app's list: the same widget, drawn again as they load.
    if (factory) return field.type === 'selection' && field.optionsFrom ? listChoices(factory, context) : factory(context);
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
  setAttr(element, 'aria-invalid', String(state.invalid));
  // ARIA has no "required" for a group of checkboxes: its label's mark says it there.
  setAttr(element, 'aria-required', element.getAttribute('role') === 'group' ? null : String(state.required));
  setAttr(element, 'aria-describedby', state.describedBy || null);
}

const textOf = (value: Value | undefined) => (value === null || value === undefined ? '' : String(value));

function textWidget(inputType: string): WidgetFactory {
  return (context) => {
    const { form, name, field, node, id, document } = context;
    // A person's own email, phone or web address, the browser may offer.
    const input = make(document, 'input', { id, type: inputType, class: 'fd-input', autocomplete: /^(email|tel|url)$/.test(inputType) ? inputType : 'off' });
    if (field.type === 'char' && field.size !== undefined) input.maxLength = field.size;
    if (inputType === 'time') bounds(input, field, node);
    if (node.placeholder) input.placeholder = node.placeholder;
    input.addEventListener('input', () => form.setValue(name, input.value === '' ? null : input.value));
    return counted({
      element: input,
      focus: () => input.focus(),
      update(state) {
        const text = textOf(state.value);
        if (input.value !== text) input.value = text;
        if (input.readOnly !== state.readonly) input.readOnly = state.readonly;
        describe(input, state);
      },
    }, context, input);
  };
}

const textareaWidget: WidgetFactory = (context) => {
  const { form, name, field, node, id, document } = context;
  const area = make(document, 'textarea', { id, class: 'fd-input fd-textarea', rows: '3' });
  if (field.type === 'text' && field.size !== undefined) area.maxLength = field.size;
  if (node.placeholder) area.placeholder = node.placeholder;
  const grow = grower(area, node);
  area.addEventListener('input', () => {
    grow();
    form.setValue(name, area.value === '' ? null : area.value);
  });
  return counted({
    element: area,
    focus: () => area.focus(),
    update(state) {
      const text = textOf(state.value);
      if (area.value !== text) {
        area.value = text;
        grow();
      }
      if (area.readOnly !== state.readonly) area.readOnly = state.readonly;
      describe(area, state);
    },
  }, context, area);
};

const NUMBER = /^-?(\d+\.?\d*|\.\d+)$/;
const UNFINISHED = /^-?\.?$/;

/**
 * Numbers are written as readers of the page's language write them, grouped,
 * with the field's decimals, and read back the same way. What is typed stays
 * as typed while focused: "1." means 1 now and 1.5 a keystroke later. The box
 * keeps its spelling when entered, so a selection made on the way in holds.
 */
const numberWidget: WidgetFactory = (context) => {
  const { form, name, field, node, id, document, locale = 'en' } = context;
  const integer = field.type === 'integer';
  const decimals = integer ? 0 : (field.type === 'float' || field.type === 'monetary' ? field.digits?.[1] : undefined) ?? 2;
  const shown = (value: Value | undefined) => (typeof value === 'number' ? formatNumber(value, decimals, locale) : textOf(value));
  const input = make(document, 'input', { id, type: 'text', class: 'fd-input fd-number-input', autocomplete: 'off' });
  input.inputMode = integer ? 'numeric' : 'decimal';
  if (node.placeholder) input.placeholder = node.placeholder;

  const parse = (raw: string): Value | undefined => {
    const text = normalizeNumber(raw.trim(), locale);
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
    input.value = shown(form.getState().values[name]);
  });

  // Money shows its currency beside the amount (options.symbol "after" puts it
  // after), or with options.pickCurrency the currency field's own widget, to change it.
  const options = node.options ?? {};
  const currencyField = field.type === 'monetary' ? field.currencyField : undefined;
  const currencyDef = currencyField ? form.page.fields[currencyField] : undefined;
  const picker =
    currencyField && currencyDef && options['pickCurrency'] === true
      ? createWidget({ ...context, name: currencyField, field: currencyDef, node: { type: 'field', id: `${node.id}.currency`, field: currencyField }, id: `${id}-currency` })
      : null;
  if (picker && currencyDef) picker.element.querySelector('input, select')?.setAttribute('aria-label', currencyDef.label);
  if (picker?.element.matches('input, select') && currencyDef) picker.element.setAttribute('aria-label', currencyDef.label);
  // Inside the box: the currency where the page's language writes it, unless the page says before or after; a number's unit (options.prefix, options.suffix).
  const after = options['symbol'] ? options['symbol'] === 'after' : field.type === 'monetary' && currencySymbol(field.currency ?? 'USD', locale).after;
  const unit = (text: string, n: number) => make(document, 'span', { class: `fd-unit${field.type === 'monetary' ? ' fd-currency' : ''}`, id: `${id}-unit${n}` }, text);
  const currency = field.type === 'monetary' && !picker ? unit('', 0) : null;
  const [prefix, suffix] = ['prefix', 'suffix'].map((key, n) => (typeof options[key] === 'string' && options[key] ? unit(options[key] as string, n + 1) : null));
  const first = (after ? null : (picker?.element ?? currency)) ?? prefix;
  const last = (after ? (picker?.element ?? currency) : null) ?? suffix;
  const units = [first, last].filter((u): u is HTMLElement => !!u && u !== picker?.element);
  const element =
    first || last
      ? make(document, 'span', { class: `fd-number${after ? ' fd-currency-after' : ''}${picker ? ' fd-currency-picked' : ''}` }, ...[first, input, last].filter((u): u is HTMLElement => !!u))
      : input;

  return {
    element,
    focus: () => input.focus(),
    update(state) {
      const typing = document.activeElement === input;
      const parsed = parse(input.value);
      const showsSame = parsed === undefined || parsed === state.value;
      if (!(typing && showsSame)) {
        const text = shown(state.value);
        if (input.value !== text) input.value = text;
      }
      if (input.readOnly !== state.readonly) input.readOnly = state.readonly;
      describe(input, { ...state, describedBy: [state.describedBy, ...units.map((u) => u.id)].filter(Boolean).join(' ') });
      if (picker && currencyField) {
        picker.update({ value: state.values[currencyField], values: state.values, readonly: state.readonly, required: false, invalid: false });
      }
      if (currency && field.type === 'monetary') {
        const code = currencyOf(field, state.values, state.parent) ?? '';
        setText(currency, /^[A-Z]{3}$/.test(code) ? currencySymbol(code, locale).text : code);
      }
      // Room in the box for its units, as wide as their words.
      for (const [u, side] of [[first, 'start'], [last, 'end']] as const) if (u && units.includes(u)) input.style.setProperty(`padding-inline-${side}`, `calc(var(--fd-pad-x) + ${u.textContent?.length ?? 0}ch + 4px)`);
    },
  };
};

/** A box to tick: plain under its label, a switch, or a tick box with its words after it (the viewer puts them there). */
function checkboxWidget(look: 'box' | 'switch' | 'tick' = 'box'): WidgetFactory {
  const attrs = look === 'switch' ? { class: 'fd-switch', role: 'switch' } : { class: look === 'tick' ? 'fd-checkbox fd-tick' : 'fd-checkbox' };
  return ({ form, name, id, document }) => {
    const box = make(document, 'input', { id, type: 'checkbox', ...attrs });
    box.addEventListener('change', () => form.setValue(name, box.checked));
    return {
      element: box,
      focus: () => box.focus(),
      update(state) {
        box.checked = state.value === true;
        if (box.disabled !== state.readonly) box.disabled = state.readonly;
        describe(box, state);
      },
    };
  };
}

function options(field: Field) {
  return field.type === 'selection' ? field.options : [];
}

const selectWidget: WidgetFactory = (context) => {
  const { form, name, field, node, id, document } = context;
  // A long list, or one the page asks to: a box to type in, its options found as one types.
  const search = node.options?.['search'];
  if (search === true || (search !== false && options(field).length > 15)) return searchWidget(context);
  const choices = shownOptions(options(field), form, name, node);
  const select = make(document, 'select', { id, class: 'fd-input fd-select' }, make(document, 'option', { value: '' }));
  choices.forEach((option, i) => select.append(make(document, 'option', { value: String(i) }, option.label)));
  select.addEventListener('change', () => form.setValue(name, select.value === '' ? null : choices[Number(select.value)].value));
  return {
    element: select,
    focus: () => select.focus(),
    update(state) {
      const index = choices.findIndex((option) => option.value === state.value);
      select.value = index === -1 ? '' : String(index);
      if (select.disabled !== state.readonly) select.disabled = state.readonly;
      describe(select, state);
    },
  };
};

function choiceGroup(kind: 'radio' | 'checkbox'): WidgetFactory {
  return ({ form, name, field, node, id, document, labels, locale }) => {
    // Shown shuffled when the page asks; "Other" comes after them all the same.
    const choices = shownOptions(options(field), form, name, node);
    const words = wordsFor(labels, locale);
    const group = make(document, 'div', { id, class: `fd-choices fd-choices-${kind}`, role: kind === 'radio' ? 'radiogroup' : 'group' });
    layOut(group, node);
    const limit = kind === 'checkbox' ? limiter(maker(document), words, node) : null;
    const inputs = choices.map((option, i) => {
      const input = make(document, 'input', { type: kind, name: id, value: String(i), id: `${id}-${i}` });
      group.append(make(document, 'label', { class: 'fd-choice', for: `${id}-${i}` }, input, make(document, 'span', {}, option.label)));
      return input;
    });
    // "Other:", after the options: a choice of its own, with a box for the answer — as Google Forms has it.
    const other = field.type === 'selection' && field.other === true;
    const otherChoice = other ? make(document, 'input', { type: kind, name: id, value: 'other', id: `${id}-other` }) : null;
    const otherBox = other ? make(document, 'input', { type: 'text', class: 'fd-input fd-other-input', 'aria-label': words.otherAnswer, autocomplete: 'off' }) : null;
    if (otherChoice && otherBox) {
      group.append(make(document, 'div', { class: 'fd-choice fd-choice-other' }, make(document, 'label', { class: 'fd-choice-other-pick', for: `${id}-other` }, otherChoice, make(document, 'span', {}, words.other)), otherBox));
      // Typing picks "Other"; picking "Other" puts the cursor in its box.
      otherBox.addEventListener('input', () => {
        if (!otherChoice.checked) otherChoice.checked = true;
        save(otherChoice);
      });
      otherChoice.addEventListener('change', () => {
        if (otherChoice.checked) otherBox.focus();
      });
    }
    if (limit?.element) group.append(limit.element);
    /** The answer the boxes say now: the options picked, and the words of "Other" when it is picked and has any. */
    function save(ticked?: EventTarget | null) {
      // "None of these" goes alone: ticked, it unticks the rest; another ticked unticks it.
      if (kind === 'checkbox' && ticked instanceof HTMLInputElement && ticked.checked) {
        const alone = choices[inputs.indexOf(ticked)]?.exclusive === true;
        inputs.forEach((input, i) => input !== ticked && (alone || choices[i].exclusive) && (input.checked = false));
        if (alone && otherChoice) otherChoice.checked = false;
      }
      const own = otherChoice?.checked && otherBox && otherBox.value.trim() ? otherBox.value : null;
      if (kind === 'radio') {
        const chosen = inputs.findIndex((input) => input.checked);
        form.setValue(name, chosen !== -1 ? choices[chosen].value : own);
      } else {
        // In the options' own order, however they are shown.
        const ticked = new Set(choices.filter((_, i) => inputs[i].checked));
        form.setValue(name, [...options(field).filter((option) => ticked.has(option)).map((option) => option.value), ...(own !== null ? [own] : [])]);
      }
    }
    group.addEventListener('change', (event) => {
      if (event.target !== otherBox) save(event.target);
    });
    const known = new Set(choices.map((o) => o.value as unknown));
    const picked = () => inputs.some((input) => input.checked) || otherChoice?.checked === true;
    const clear =
      kind === 'radio'
        ? clearSelection(document, words, () => {
            for (const input of [...inputs, otherChoice]) if (input) input.checked = false;
            form.setValue(name, null);
            // The link goes; the cursor stays in the question.
            (inputs[0] ?? otherChoice)?.focus();
          }, node)
        : null;
    return {
      element: clear ? make(document, 'div', { class: 'fd-choices-box' }, group, clear.button) : group,
      focus: () => (inputs.find((input) => input.checked) ?? (otherChoice?.checked ? otherBox : null) ?? inputs[0])?.focus(),
      update(state) {
        const chosen = Array.isArray(state.value) ? state.value : [state.value];
        // At the most a question takes, the boxes not ticked wait; "None of these" stays open.
        const full = !!limit?.full(Array.isArray(state.value) ? state.value.length : 0);
        inputs.forEach((input, i) => {
          input.checked = chosen.includes(choices[i].value as never);
          const off = state.readonly || (full && !input.checked && !choices[i].exclusive);
          if (input.disabled !== off) input.disabled = off;
        });
        if (otherChoice && otherBox) {
          // A value not among the options is an answer of its own: "Other", with its words.
          const own = chosen.find((v) => typeof v === 'string' && !known.has(v));
          // Picked with its box still empty, "Other" stays picked until something else is.
          const waiting = otherChoice.checked && !otherBox.value.trim() && (kind === 'checkbox' || chosen.every((v) => v === null || v === undefined));
          otherChoice.checked = own !== undefined || waiting;
          if (own !== undefined && document.activeElement !== otherBox) otherBox.value = own as string;
          const off = state.readonly || (full && !otherChoice.checked);
          if (otherChoice.disabled !== off) otherChoice.disabled = otherBox.disabled = off;
        }
        clear?.allow(state);
        clear?.show(picked());
        describe(group, state);
      },
    };
  };
}

/**
 * Stars or numbers to pick from, as a radio group with arrow-key support. A
 * rating shows `options.icon`: stars, "heart", "thumb" up, or "number"s that
 * mark only the one picked, as a scale's do.
 */
function pointsWidget(style: 'rating' | 'scale'): WidgetFactory {
  return ({ form, name, field, node, id, document, labels, locale }) => {
    const words = wordsFor(labels, locale);
    const min = 'min' in field && typeof field.min === 'number' ? field.min : style === 'rating' ? 1 : 0;
    const max = 'max' in field && typeof field.max === 'number' ? field.max : style === 'rating' ? 5 : 10;
    const icon = style === 'rating' ? node.options?.['icon'] : 'number';
    const filling = icon !== 'number';
    // A 0–10 scale coloured as NPS (options.nps): 0–6, 7–8 and 9–10 apart, in red, amber and green.
    const nps = style === 'scale' && node.options?.['nps'] === true && min === 0 && max === 10;
    const group = make(document, 'div', { id, class: `fd-points fd-${filling ? 'rating' : 'scale'}${filling ? ` fd-rating-${icon ?? 'star'}` : ''}${nps ? ' fd-nps' : ''}`, role: 'radiogroup' });
    const points: HTMLButtonElement[] = [];
    // One star, as an ERP's priority, or stars without "Clear selection" (options.clear false): the star
    // picked, clicked again, takes the answer away — so one star needs no "Clear selection".
    const single = style === 'rating' && min === max;
    const toggles = style === 'rating' && (single || node.options?.clear === false);
    let required = false;
    for (let n = min; n <= max; n++) {
      const point = make(document, 'button', { type: 'button', role: 'radio', 'aria-label': fillIn(words.ofMax, { n, max }), 'data-value': String(n) }, icon === 'thumb' ? (drawIcon(document, 'thumb') as SVGSVGElement) : icon === 'heart' ? '♥' : filling ? '★' : String(n));
      if (style === 'scale') point.removeAttribute('aria-label');
      if (nps) point.dataset['tone'] = n < 7 ? 'low' : n < 9 ? 'mid' : 'high';
      point.addEventListener('click', () => form.setValue(name, toggles && !required && form.getState().values[name] === n ? null : n));
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
    // The ends in words, under the first and last points: "Not likely" … "Very likely".
    const ends = [node.options?.['startLabel'], node.options?.['endLabel']].map((v) => (typeof v === 'string' ? v : ''));
    const clear = clearSelection(document, words, () => {
      form.setValue(name, null);
      points[0]?.focus();
    }, node, !single);
    const shown = ends.some(Boolean)
      ? make(document, 'div', { class: 'fd-scale-box' }, group, make(document, 'div', { class: 'fd-scale-ends', 'aria-hidden': 'true' }, make(document, 'span', {}, ends[0]), make(document, 'span', {}, ends[1])))
      : group;
    if (ends.some(Boolean)) group.setAttribute('aria-description', ends.filter(Boolean).join(' … '));
    return {
      element: make(document, 'div', { class: 'fd-choices-box' }, shown, clear.button),
      focus: () => (points.find((p) => p.getAttribute('aria-checked') === 'true') ?? points[0])?.focus(),
      update(state) {
        const value = typeof state.value === 'number' ? state.value : null;
        required = state.required;
        points.forEach((point, i) => {
          const n = min + i;
          setAttr(point, 'aria-checked', String(n === value));
          point.classList.toggle('fd-on', filling ? value !== null && n <= value : n === value);
          const tab = n === value || (value === null && i === 0) ? 0 : -1;
          if (point.tabIndex !== tab) point.tabIndex = tab;
          if (point.disabled !== state.readonly) point.disabled = state.readonly;
        });
        clear.allow(state);
        clear.show(value !== null);
        describe(group, state);
      },
    };
  };
}

const dateWidget: WidgetFactory = (context) => {
  const { form, name, field, id, document, node } = context;
  const input = make(document, 'input', { id, type: 'date', class: 'fd-input fd-date' });
  bounds(input, field, node);
  input.addEventListener('input', () => form.setValue(name, input.value || null));
  const widget: Widget = {
    element: input,
    focus: () => input.focus(),
    update(state) {
      const text = textOf(state.value);
      if (input.value !== text) input.value = text;
      if (input.readOnly !== state.readonly) input.readOnly = state.readonly;
      // Empty, its mask is no answer: read-only, it is not drawn.
      input.classList.toggle('fd-blank', !text);
      describe(input, state);
    },
  };
  return node.options?.['weekNumbers'] === true ? withCalendar(widget, context, 'date') : widget;
};

const pad = (n: number) => String(n).padStart(2, '0');

/** Shown in local time, stored as an ISO instant in UTC. */
const dateTimeWidget: WidgetFactory = (context) => {
  const { form, name, field, id, document, node } = context;
  const input = make(document, 'input', { id, type: 'datetime-local', class: 'fd-input fd-datetime' });
  bounds(input, field, node);
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
  const widget: Widget = {
    element: input,
    focus: () => input.focus(),
    update(state) {
      const text = local(state.value);
      if (input.value !== text) input.value = text;
      if (input.readOnly !== state.readonly) input.readOnly = state.readonly;
      input.classList.toggle('fd-blank', !text);
      describe(input, state);
    },
  };
  return node.options?.['weekNumbers'] === true ? withCalendar(widget, context, 'datetime') : widget;
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
      return [value as FileValue | FileValue[]].flat().map((file) => file.name).join(', ');
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
  'char.time': textWidget('time'),
  'char.tags': charTagsWidget,
  text: textareaWidget,
  integer: numberWidget,
  float: numberWidget,
  monetary: numberWidget,
  'integer.rating': pointsWidget('rating'),
  'integer.scale': pointsWidget('scale'),
  'integer.slider': sliderWidget,
  'float.slider': sliderWidget,
  'integer.progressbar': progressbarWidget,
  'integer.label': labelWidget,
  'float.label': labelWidget,
  'monetary.label': labelWidget,
  'float.progressbar': progressbarWidget,
  // Hours as HH:MM (Flectra's float_time), a fraction as a per cent (its percentage).
  'float.duration': durationWidget,
  'float.percentage': percentageWidget,
  'monetary.progressbar': progressbarWidget,
  boolean: checkboxWidget(),
  'boolean.toggle': checkboxWidget('switch'),
  'boolean.tick': checkboxWidget('tick'),
  'boolean.buttons': yesNoWidget,
  // Stars over a selection, the first option none, or one over a yes or no: Flectra's priority.
  'boolean.priority': priorityWidget,
  'selection.priority': priorityWidget,
  selection: selectWidget,
  'selection.radio': choiceGroup('radio'),
  'selection.checkboxes': choiceGroup('checkbox'),
  'selection.tags': choiceTagsWidget,
  'selection.image-choice': imageChoiceWidget,
  'selection.ranking': rankingWidget,
  'selection.statusbar': statusbarWidget,
  date: dateWidget,
  datetime: dateTimeWidget,
  many2one: many2oneWidget,
  'many2one.statusbar': statusbarWidget,
  many2many: tagsWidget,
  'many2many.tags': tagsWidget,
  'many2many.checkboxes': linkCheckboxesWidget,
  'many2many.table': linksTableWidget,
  reference: referenceWidget,
  one2many: linesWidget,
  'one2many.cards': cardsWidget,
  binary: binaryWidget,
  'binary.signature': signatureWidget,
  image: imageWidget,
  html: htmlWidget,
  json: jsonWidget,
  'json.address': addressWidget,
  properties: propertiesWidget,
  matrix: matrixWidget,
  // A value as a pill in its tone: Flectra's widget="badge".
  'char.badge': badgeWidget,
  'selection.badge': badgeWidget,
  'many2one.badge': badgeWidget,
};
