import { foldForSearch, placesOf, placesOfCurrency, readNumber, type NumberLimits } from '@fieldia/core';
import type {
  Field,
  FieldNode,
  FileValue,
  Form,
  LayoutNode,
  Line,
  LineField,
  Locale,
  Page,
  RecordId,
  ReferenceValue,
  RelatedRecord,
  Value,
  Values,
} from '@fieldia/core';
import type { PreferenceStore } from './preferences';
import { formatNumber, formatPlain, ungroup } from './numbers';
import { guard, leftWords, numberFits, numberKeyboard, numberRules, refusalHint, unreadWords, type NumberBox } from './input-rules';
import { textBox, type TextKind } from './text-box';
import type { WidgetLabels } from './labels';
import { linkCheckboxesWidget, many2oneWidget, plainLinkWidget, plainTagsWidget, referenceWidget, tagsWidget } from './relations-plain';
import { plainLinesWidget, plainLinksWidget } from './lines-plain';
import { labelWidget } from './label';
import { plainDateWidget, type DateKind } from './date-text';
import { htmlWidget, jsonWidget } from './extras';

import { boxPurpose, clearSelection, fillIn, maker, rightToLeft, setAttr, setText, wordsFor } from './kind-parts';
import { seatMarks, seatWords } from './seats';
import { shownOptions } from './shuffle';
import { counted, grower } from './limits';
import { currencySymbol } from './units';
import { currencyOf } from './display';
import { drawIcon } from './icons';
import { listChoices } from './choices-from';
import { yesNoWidget } from './yes-no';
import { badgeWidget } from './badge';
import { layOut, limiter } from './choice-rules';
import { stateDotWidget } from './state-dot';
import { businessPart, choicePart, datePart, filesPart, linesPart, partFactory, pathPart, phonePart, relationsPart, slotsPart, surveyPart, textPart, type BusinessPart, type FilesPart, type PartFactory, type SurveyPart } from './widget-parts';
import { phoneSettings } from './phone-settings';
import { plainNumber, plainPayments, plainShares, plainStars, plainState, plainTimer, plainTotal } from './business-plain';
import { plainAddress, plainChosen, plainColour, plainMatrix, plainProperties, plainRanking } from './survey-plain';
import { partWith, type Part } from './parts';
import { embedWidget } from './embed';
import { containWidget, type ErrorHandler } from './contain';

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
  /**
   * The app's widgets, by `type` or `type.widget`, as given to the viewer. A
   * widget that draws fields of its own (a table's cells, a property's value)
   * draws them from these too, so a column can name one as a field can.
   */
  widgets?: Record<string, WidgetFactory>;
  /**
   * Told when a widget throws as it is drawn, brought up to date, focused or taken away: the widget is then a small box
   * that names its field, and the page goes on (contain.ts). The console is told when this is left out.
   */
  onError?: ErrorHandler;
  /**
   * Said by a widget that learns of its own failure later, where nothing would catch it: a React or Vue component that
   * threw as it rendered, caught by the binding's boundary. Its field then shows the box, as for a widget that throws.
   * `createWidget` gives every widget its own.
   */
  fail?: (error: unknown) => void;
  /**
   * Said by a widget that draws after its update returns — a React or Vue component, drawn as its framework next
   * renders — each time it has drawn: the value it drew. Until a widget first says it, each value its update took
   * without throwing counts as drawn. A widget that fails on a change the person made in it, never having drawn it,
   * puts back the value it last drew (contain.ts). `createWidget` gives every widget its own.
   */
  drew?: (value: Value | undefined) => void;
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
  openRecord(
    model: string,
    request: {
      recordId?: RecordId;
      name?: string;
      title: string;
      values?: Values;
      withValues?: boolean;
      /** A line's own: its labels small inside sentences as its record's page asks (`lowerLabels`), unless its own page says. */
      lowerLabels?: boolean;
    }
  ): Promise<(RelatedRecord & { values?: Values }) | null>;
  /** Pick a record from a searchable list. */
  searchMore(request: { title: string; search(query: string, limit: number): Promise<RelatedRecord[]> }): Promise<RelatedRecord | null>;
  /**
   * Values edited in a form made of these fields. Resolves with the new values,
   * or null. `recompute` recalculates them as they change, as a line's onchange.
   */
  editValues(request: {
    title: string;
    fields: Record<string, Field>;
    values: Values;
    readonly?: boolean;
    recompute?: (values: Values) => Promise<Values>;
    /** How the form is laid out (a table's `lineForm`): its parts, as a page's; every field in two columns when left out. */
    layout?: LayoutNode[];
    /** The record the values are a line of, read by the form's conditions and filters as `parent`. */
    parent?: { values: Readonly<Values>; fields: Readonly<Record<string, Field | LineField>>; id?: RecordId | null };
    /** Its two buttons' words, where Save & Close and Discard would mislead: Update and Cancel, for values set on many records. */
    buttons?: { done?: string; cancel?: string };
    /** Its labels small inside sentences, as the page it is part of asks (`lowerLabels`): a line's record, a list. */
    lowerLabels?: boolean;
  }): Promise<Values | null>;
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

/**
 * Text typed in a box and not yet read, as the person left it: its text — keys a guard holds after a refused one among
 * it — the caret or the selection, and what the field held as the box was entered (what text that does not read puts
 * back). Handed by a plain stand-in to the part's widget that takes its place (`partWidget`).
 */
export interface TypedText {
  text: string;
  start: number;
  end: number;
  entered: Value | undefined;
}

export interface Widget {
  element: HTMLElement;
  update(state: WidgetState): void;
  focus(): void;
  destroy?(): void;
  /**
   * A part's widget taking its plain stand-in's place while the stand-in's box holds text typed and not yet read
   * (`partWidget`): it takes that text as typed — into its own box, focused, the caret where it was, read as that box
   * is read — never the value the stand-in made of it on the way; a widget with no box to type in reads it now (a
   * links box: the record its words name, or why none is). True when it took it. False, or left out, when it cannot
   * take the text as it stands (a slider, "2." on its way to 2.5): the stand-in's box stays beside it, focused, until
   * it is left, and reads what it holds then.
   */
  takeTyped?(typed: TypedText): boolean;
  /**
   * A plain stand-in's box's text as typed, the keys its guard holds after a refused one among it ("1x" where the box
   * shows "1"): what the part's widget taking its place is handed. Its box's text when left out.
   */
  typedText?(): string;
  /**
   * Buttons that act on the whole field, such as a Markdown text's Edit and
   * Done. The widget draws them in its own element; where a group holds this
   * field alone, its label out of sight, the viewer moves them to the group's
   * heading.
   */
  tools?: HTMLElement[];
}

export type WidgetFactory = (context: WidgetContext) => Widget;

/**
 * Pick the widget for a field: the app's or the built-in one for
 * `type.widget` (such as `selection.radio`), then for the type alone. A type
 * with no editor yet shows its value read-only.
 */
export function createWidget(given: WidgetContext, registry: Record<string, WidgetFactory> = given.widgets ?? {}): Widget {
  // The fields it draws of its own are found where it was.
  const context = given.widgets === registry ? given : { ...given, widgets: registry };
  const { field } = context;
  const factory = factoryFor(field, context.node, registry);
  // Kept from throwing: a widget that fails is a box naming its field, and the page goes on (contain.ts).
  return containWidget((kept) => {
    const own = { ...context, ...kept };
    // Choices from the app's list, shown by conditions or carried from another question: the same widget, drawn again as they change.
    if (factory) return field.type === 'selection' && (field.optionsFrom || own.form.offersChange?.(own.name)) ? listChoices(factory, own) : factory(own);
    return pendingWidget(own);
  }, context);
}

/**
 * The part a field's widget comes in (parts.ts) — a work item's text editor, its links box, a path picker — when
 * its code is loaded the first time a page shows one; undefined for a widget that is always there. The viewer
 * asks for these before it draws a page, so its widgets are drawn whole at once. `page`, the page the field is on,
 * for a widget its page's settings choose (a phone read the world over).
 */
export function widgetPart(field: Field, node: FieldNode, registry: Record<string, WidgetFactory> = {}, page?: Page): Part | undefined {
  return (factoryFor(field, node, registry) as Partial<PartFactory> | undefined)?.partOf?.(node, page, field);
}

/** The factory for a field: the app's or the built-in one for `type.widget`, then for the type alone. */
function factoryFor(field: Field, node: FieldNode, registry: Record<string, WidgetFactory>): WidgetFactory | undefined {
  const keys = [
    node.widget ? `${field.type}.${node.widget}` : null,
    field.type === 'selection' && field.multiple ? 'selection.checkboxes' : null,
    // A many2many with columns is a table of its records, as Flectra's list of them.
    field.type === 'many2many' && node.columns?.length ? 'many2many.table' : null,
    field.type,
  ].filter((key): key is string => key !== null);
  for (const key of keys) {
    const factory = registry[key] ?? builtInWidgets[key];
    if (factory) return factory;
  }
  return undefined;
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

/** The text box each input type is: a line of words, a password, a phone number, an email, a web address. A time is a date box's (date-box.ts). */
const TEXT_KINDS: Record<string, TextKind | undefined> = { text: 'line', password: 'password', tel: 'phone', email: 'email', url: 'url' };
/**
 * What the browser fills each kind in with unless the page says (`autocomplete`): a person's own email, phone or web
 * address, a password being set — never the one they sign in with, filled into a field of the record — and nothing
 * for a line of words, whose purpose only the page knows.
 */
const TEXT_PURPOSES: Record<string, string> = { text: 'off', password: 'new-password', tel: 'tel', email: 'email', url: 'url' };

function textWidget(inputType: string): WidgetFactory {
  return (context) => {
    // A record's title (`options.wraps`, set by the viewer): one line that wraps rather than being cut.
    if (inputType === 'text' && context.node.options?.['wraps'] === true) return wrappingLine(context);
    const { form, name, node, id, document } = context;
    // An email or a web address in a text box: the browser's own would keep an international domain as punycode
    // (ali@xn--mgbh0fb.xn--wgbh1c) and trim as it is typed. A phone still shows its keyboard for them.
    const written = inputType === 'email' || inputType === 'url';
    // What the browser fills it in with and the keyboard a phone shows: the page's, else the kind's.
    const input = make(document, 'input', {
      id,
      type: written ? 'text' : inputType,
      class: 'fd-input',
      ...boxPurpose(node, { autocomplete: TEXT_PURPOSES[inputType], inputmode: written ? inputType : undefined }),
    });
    if (node.placeholder) input.placeholder = node.placeholder;
    // No maxlength: the browser would cut a paste without a word. The box refuses a key at the most, and says so.
    const kind = TEXT_KINDS[inputType];
    const box = kind ? textBox(input, context, kind) : null;
    input.addEventListener('input', () => form.setValue(name, input.value === '' ? null : input.value));
    return counted({
      element: input,
      focus: () => input.focus(),
      destroy: () => box?.destroy(),
      update(state) {
        const text = textOf(state.value);
        if (input.value !== text) {
          input.value = text;
          box?.accept();
        }
        if (input.readOnly !== state.readonly) input.readOnly = state.readonly;
        describe(input, { ...state, describedBy: box ? box.describedBy(state.describedBy) : state.describedBy });
      },
    }, context, input);
  };
}

/**
 * One line of words that wraps — a record's title. On a phone a long name runs
 * onto a second line, read from its start, never cut to "Patien…" or scrolled
 * to its end. It is one line all the same: it says so (aria-multiline false),
 * Enter does what it does in any one-line box (the form's, viewer.ts), a line
 * break pasted or dropped into it is a space, and it grows to the lines its
 * words take at its width, as the width changes.
 */
function wrappingLine(context: WidgetContext): Widget {
  const { form, name, node, id, document } = context;
  const area = make(document, 'textarea', { id, class: 'fd-input fd-line-wraps', rows: '1', autocomplete: 'off', 'aria-multiline': 'false' });
  if (node.placeholder) area.placeholder = node.placeholder;
  const grow = grower(area, { ...node, options: {} });
  const box = textBox(area, context, 'line');
  // A phone keyboard's Enter that comes as an edit, not a key: no line break here.
  area.addEventListener('beforeinput', (event) => {
    const type = (event as InputEvent).inputType;
    if (type === 'insertLineBreak' || type === 'insertParagraph') event.preventDefault();
  });
  area.addEventListener('keydown', (event) => {
    // A plain Enter adds no line; the form hears it as it hears Enter in any one-line box.
    if (event.key === 'Enter' && !event.isComposing && !event.shiftKey && !event.altKey) event.preventDefault();
  });
  area.addEventListener('input', () => {
    if (/[\r\n]/.test(area.value)) {
      const at = area.selectionStart;
      area.value = area.value.replace(/\r\n?|\n/g, ' ');
      area.setSelectionRange(at, at);
    }
    grow();
    form.setValue(name, area.value === '' ? null : area.value);
  });
  // Its lines follow its width: a phone turned, a panel opened beside it, the page drawn. Grown in the next frame, never
  // inside the observer's own call: a height changed there is a loop the browser reports.
  const View = document.defaultView as (Window & { ResizeObserver?: typeof ResizeObserver }) | null;
  let width = 0;
  let frame = 0;
  const sized = View?.ResizeObserver
    ? new View.ResizeObserver(() => {
        if (area.clientWidth === width) return;
        width = area.clientWidth;
        View.cancelAnimationFrame(frame);
        frame = View.requestAnimationFrame(grow);
      })
    : null;
  sized?.observe(area);
  return counted(
    {
      element: area,
      focus: () => area.focus(),
      destroy: () => {
        sized?.disconnect();
        View?.cancelAnimationFrame(frame);
        box.destroy();
      },
      update(state) {
        const text = textOf(state.value).replace(/\r\n?|\n/g, ' ');
        if (area.value !== text) {
          area.value = text;
          box.accept();
          // Measured once the page is drawn, never in its midst: a measure there would read the page before its parts'
          // sheets are in, and every box drawn would change its look under a transition.
          queueMicrotask(grow);
        }
        if (area.readOnly !== state.readonly) area.readOnly = state.readonly;
        describe(area, { ...state, describedBy: box.describedBy(state.describedBy) });
      },
    },
    context,
    area
  );
}

const textareaWidget: WidgetFactory = (context) => {
  const { form, name, node, id, document } = context;
  const area = make(document, 'textarea', { id, class: 'fd-input fd-textarea', rows: '3', ...boxPurpose(node) });
  if (node.placeholder) area.placeholder = node.placeholder;
  const grow = grower(area, node);
  const box = textBox(area, context, 'paragraph');
  area.addEventListener('input', () => {
    grow();
    form.setValue(name, area.value === '' ? null : area.value);
  });
  return counted({
    element: area,
    focus: () => area.focus(),
    destroy: () => box.destroy(),
    update(state) {
      const text = textOf(state.value);
      if (area.value !== text) {
        area.value = text;
        box.accept();
        grow();
      }
      if (area.readOnly !== state.readonly) area.readOnly = state.readonly;
      describe(area, { ...state, describedBy: box.describedBy(state.describedBy) });
    },
  }, context, area);
};

/**
 * Numbers are written as readers of the page's language write them, grouped,
 * with the field's decimals, and read back the same way (@fieldia/core's
 * readNumber: Arabic digits, ٫ and ، too, a German or French decimal comma).
 * Entered, the box shows the plain number, no grouping marks — a digit typed
 * mid-number would leave them in the wrong places ("600,1000.00") — and a
 * whole-text selection made on the way in holds, so typing replaces it. What
 * is typed stays as typed while focused: "1." means 1 now and 1.5 a keystroke
 * later. The input rules refuse, as they are typed or pasted, letters, a
 * misplaced minus, a second decimal mark, places and digits past the
 * field's, and hold the keys typed after a refused one; text left that does
 * not read, or that the field cannot hold ("1.5" in whole numbers, keys held
 * after a refused one), stays in the box as typed, marked, and the field
 * keeps the value it held (`FormState.unread`). A save made with the box
 * still entered (Ctrl+Enter) reads it first, as leaving it would.
 */
const numberWidget: WidgetFactory = (context) => {
  const { form, name, field, node, id, document, labels, locale = 'en' } = context;
  const integer = field.type === 'integer';
  /** The box's currency now: a money box's places, and an amount pasted with it, follow it. */
  let currencyNow: string | null = field.type === 'monetary' ? currencyOf(field, form.getState().values) : null;
  const digits = field.type === 'float' || field.type === 'monetary' ? field.digits : undefined;
  /** The places a value is written with at rest: the field's, padded; a money field's currency's when it has no digits. */
  const fieldPlaces = () => (integer ? 0 : (digits?.[1] ?? (field.type === 'monetary' ? placesOfCurrency(currencyNow) : 2)));
  /** Never fewer places than the value has: the box never shows a rounded picture of a different value. */
  const placesFor = (value: number) => Math.max(fieldPlaces(), Math.min(placesOf(value), 20));
  const shown = (value: Value | undefined) => (typeof value === 'number' ? (Number.isFinite(value) ? formatNumber(value, placesFor(value), locale) : '') : textOf(value));
  const plain = (value: number) => formatPlain(value, placesFor(value), locale);
  const min = 'min' in field && typeof field.min === 'number' ? field.min : undefined;
  const limits = (): NumberLimits => ({
    integer,
    ...(integer ? {} : digits ? { places: digits[1] } : field.type === 'monetary' ? { places: placesOfCurrency(currencyNow) } : {}),
    ...(digits ? { digits: digits[0] } : {}),
    ...(min !== undefined ? { min } : {}),
  });
  // Digits, a decimal mark where the field has places, a minus where it may be below 0 — or the page's own keyboard.
  const input = make(document, 'input', { id, type: 'text', class: 'fd-input fd-number-input', ...boxPurpose(node, { autocomplete: 'off', inputmode: numberKeyboard(limits()) }) });
  if (node.placeholder) input.placeholder = node.placeholder;

  // Money shows its currency beside the amount, or with options.pickCurrency the currency field's own widget, to change it.
  const options = node.options ?? {};
  const currencyField = field.type === 'monetary' ? field.currencyField : undefined;
  const currencyDef = currencyField ? form.page.fields[currencyField] : undefined;
  const picker =
    currencyField && currencyDef && options['pickCurrency'] === true
      ? createWidget({ ...context, name: currencyField, field: currencyDef, node: { type: 'field', id: `${node.id}.currency`, field: currencyField }, id: `${id}-currency` })
      : null;
  if (picker && currencyDef) picker.element.querySelector('input, select')?.setAttribute('aria-label', currencyDef.label);
  if (picker?.element.matches('input, select') && currencyDef) picker.element.setAttribute('aria-label', currencyDef.label);
  // Inside the box: the currency where the page's language writes it for that currency — as every total, cell and value
  // of the page writes it, so the sign never moves between them — unless the field's money look says before or after,
  // everywhere it is written; a number's unit (options.prefix, options.suffix).
  const look = field.type === 'monetary' ? field.money : undefined;
  const after = look?.at ? look.at === 'after' : field.type === 'monetary' && currencySymbol(currencyNow && /^[A-Z]{3}$/.test(currencyNow) ? currencyNow : (field.currency ?? 'USD'), locale).after;
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

  // The input rules: refused keystrokes and pastes are said under the box (after the units round it).
  const box: NumberBox = { label: node.label ?? field.label, locale, labels, limits, currency: () => currencyNow, units: () => [prefix, suffix].map((u) => u?.textContent ?? '').filter(Boolean) };
  const hint = refusalHint(input, element);
  const checks = guard(input, numberRules(box), hint);
  /** Unread text the form keeps for this box, and what the field held as the box was entered. */
  const unreadNow = () => form.getState().unread?.[name];
  let entered: Value | undefined;
  input.addEventListener('focus', () => {
    entered = form.getState().values[name];
    // Once the browser has put its selection in the box: a selection made before focus() is put back only after
    // the focus event, and a click places its caret after it, against the plain words.
    queueMicrotask(() => {
      const value = form.getState().values[name];
      if (document.activeElement !== input || input.readOnly || typeof value !== 'number' || input.value !== shown(value)) return;
      const grouped = input.value;
      const [start, end] = [input.selectionStart ?? grouped.length, input.selectionEnd ?? grouped.length];
      // Where the selection stands among the digits, the grouping and direction marks taken out.
      const at = (index: number) => ungroup(grouped.slice(0, index), locale).length;
      input.value = plain(value);
      input.setSelectionRange(at(start), at(end));
      checks.accept();
    });
  });
  input.addEventListener('input', () => {
    // Written while the person is elsewhere — the browser's autofill, from a pick in another box: the field held this as
    // the write came, and keeps it should the text not read.
    if (document.activeElement !== input) entered = form.getState().values[name];
    const reading = readNumber(input.value, locale);
    // On its way to a number ("-", "1,", "12.345" on its way to "12.345,6"), or text that does not read: nothing is
    // set; leaving the box says why.
    if (!reading.ok || !numberFits(input.value, box)) return;
    form.setValue(name, reading.value);
    if (unreadNow()) form.setUnread(name, null);
  });
  /**
   * What is typed, read: as the box is left, and as a save reads it first (a change) — never the value that fitted on
   * the way ("1" of "1.5"). Taken when it reads and fits; else kept as typed, marked with why, the field holding what
   * it held as the box was entered. True when it was taken.
   */
  const read = (): boolean => {
    // Keys held after a refused one are part of what was typed: "1.5" where the box shows "1". All of it is the box's
    // now, and the field's own words take over from the hint, in its place.
    const held = checks.held();
    if (held) {
      hint.hide();
      input.value = held.text;
      checks.accept();
    }
    const text = input.value;
    const reading = readNumber(text, locale);
    // A value the box held as it was entered (one from outside with more places) is let be: check names it.
    const words = !held && reading.ok && reading.value === (entered ?? null) ? unreadWords(text, box) : leftWords(text, box);
    if (words === null) {
      if (unreadNow()) form.setUnread(name, null);
      // What reads and fits is the field's, as typed: "-3" held after its refused minus, or text left marked before
      // and left again. Its least and most are check's to say, as the box is left.
      if (reading.ok && reading.value !== (form.getState().values[name] ?? null)) form.setValue(name, reading.value);
      // Typed and taken: read again should its currency change.
      typed = reading.ok && reading.value !== (entered ?? null) ? { text, value: reading.value } : typed;
      return true;
    }
    // What does not read stays in the box, marked; the field keeps what it held as the box was entered.
    if (form.getState().values[name] !== entered) form.setValue(name, (entered ?? null) as Value);
    form.setUnread(name, { text, message: words });
    return false;
  };
  /**
   * What the person typed that the field took, while it holds it: an amount is read again when its currency changes,
   * as its places are its currency's — "12.345" typed in dinars is three places too many in pounds.
   */
  let typed: { text: string; value: number | null } | null = null;
  /**
   * Its currency changed: what was typed is read again in the new one's places — taken if it fits them, else kept
   * unread with why, which a save refuses — and text kept unread for the old one's places reads if the new one takes it.
   * Never a value saved with places its currency has not, nor words left for a reason gone.
   */
  const readAgain = () => {
    if (document.activeElement === input || input.readOnly) return;
    const kept = unreadNow();
    const now = form.getState().values[name] ?? null;
    const text = kept?.text ?? (typed && typed.value === now ? typed.text : undefined);
    if (text === undefined) return;
    const reading = readNumber(text, locale);
    const words = leftWords(text, box);
    if (words === null && reading.ok) {
      if (kept) form.setUnread(name, null);
      if (reading.value !== now) form.setValue(name, reading.value);
      return;
    }
    if (words && words !== kept?.message) form.setUnread(name, { text, message: words });
  };
  input.addEventListener('change', () => !input.readOnly && read());
  input.addEventListener('blur', () => {
    if (input.readOnly) return;
    if (read()) input.value = shown(form.getState().values[name]);
  });

  return {
    element,
    focus: () => input.focus(),
    // As typed, keys held after a refused one with it: what a slider taking this box's place is handed.
    typedText: () => checks.held()?.text ?? input.value,
    // Its hint stands beside it, outside its element: it goes with it (a slider's number box, swapped for the slider).
    destroy: () => {
      checks.destroy();
      hint.element.remove();
    },
    update(state) {
      const typing = document.activeElement === input;
      if (field.type === 'monetary') {
        const now = currencyOf(field, state.values, state.parent);
        // Read again once this redraw is over: what it sets draws again.
        if (now !== currencyNow && !typing) queueMicrotask(readAgain);
        currencyNow = now;
      }
      // Changed from outside: no longer what was typed.
      if (typed && (state.value ?? null) !== typed.value) typed = null;
      const unread = unreadNow();
      if (typing) {
        const reading = readNumber(input.value, locale);
        // A value changed under the person editing it shows as they edit: plain. Text the box did not set ("1.5" in
        // whole numbers, waiting to be said as the box is left) is theirs, and stays.
        if (reading.ok && numberFits(input.value, box) && reading.value !== (state.value ?? null)) {
          input.value = !state.readonly && typeof state.value === 'number' ? plain(state.value) : shown(state.value);
          // Keys held after a refused one are let go with the text they were typed into, and the words that said why.
          checks.accept();
          hint.hide();
        }
      } else {
        // Text left that does not read stays as it was typed; anything else shows the value at rest.
        const text = unread ? unread.text : shown(state.value);
        if (input.value !== text) input.value = text;
      }
      if (input.readOnly !== state.readonly) input.readOnly = state.readonly;
      describe(input, { ...state, invalid: state.invalid || (!!unread && !typing), describedBy: hint.describedBy([state.describedBy, ...units.map((u) => u.id)].filter(Boolean).join(' ')) });
      if (picker && currencyField) {
        picker.update({ value: state.values[currencyField], values: state.values, readonly: state.readonly, required: false, invalid: false });
      }
      if (currency && field.type === 'monetary') {
        const code = currencyNow ?? '';
        // By its symbol, or its code when the field's money look says so.
        setText(currency, /^[A-Z]{3}$/.test(code) && look?.currency !== 'code' ? currencySymbol(code, locale).text : code);
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

/** A long list, or one the page asks to: a box to type in, its options found as one types (choice-tags.ts, the choice part's). */
function searched(node: FieldNode, field: Field | undefined): boolean {
  const search = node.options?.['search'];
  return search === true || (search !== false && !!field && options(field).length > 15);
}
/** Fieldia's own list in place of the browser's (own-list.ts, the choice part's). */
const ownList = (node: FieldNode) => node.options?.['list'] === 'own';

/** A choice in the browser's own list: a long one's too, until the choice part's box that searches it has come. */
const selectWidget: WidgetFactory = (context) => {
  const { form, name, field, node, id, document, labels, locale } = context;
  const choices = shownOptions(options(field), form, name, node);
  const words = wordsFor(labels, locale);
  const blank = make(document, 'option', { value: '' });
  // A country, a card's month: what the browser fills it in with, when the page says.
  const select = make(document, 'select', { id, class: 'fd-input fd-select', autocomplete: node.autocomplete }, blank);
  const items = choices.map((option, i) => select.appendChild(make(document, 'option', { value: String(i) }, option.label)));
  select.addEventListener('change', () => form.setValue(name, select.value === '' ? null : choices[Number(select.value)].value));
  return {
    element: select,
    focus: () => select.focus(),
    update(state) {
      // An option's words as they read now — one that shows an answer given follows it (the viewer's answers part) — and
      // its places left after them, where the page counts them: "Morning workshop (3 left)", "… (Full)".
      const places = form.getState().limits?.seats?.[name];
      items.forEach((item, i) => setText(item, ((left) => (left ? `${choices[i].label} (${left})` : choices[i].label))(places ? seatWords(places[String(choices[i].value)], words) : '')));
      const index = choices.findIndex((option) => option.value === state.value);
      select.value = index === -1 ? '' : String(index);
      // A required choice made is never taken back to nothing from its list, as Flectra hides the blank.
      blank.hidden = state.required && index !== -1;
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
    const optionWords: HTMLElement[] = [];
    // Each option's places left beside its words, where the page counts them (seats.ts).
    const seats = seatMarks(document, form, name, words, choices.map((option) => option.value));
    const inputs = choices.map((option, i) => {
      const input = make(document, 'input', { type: kind, name: id, value: String(i), id: `${id}-${i}` });
      optionWords.push(make(document, 'span', {}, option.label));
      group.append(make(document, 'label', { class: 'fd-choice', for: `${id}-${i}` }, input, optionWords[i], seats.marks[i]));
      return input;
    });
    // "Other:", after the options: a choice of its own, with a box for the answer — as Google Forms has it.
    const other = field.type === 'selection' && field.other === true;
    const otherChoice = other ? make(document, 'input', { type: kind, name: id, value: 'other', id: `${id}-other` }) : null;
    const otherBox = other ? make(document, 'input', { type: 'text', class: 'fd-input fd-other-input', 'aria-label': words.otherAnswer, autocomplete: 'off' }) : null;
    const otherRow = otherChoice && otherBox ? make(document, 'div', { class: 'fd-choice fd-choice-other' }, make(document, 'label', { class: 'fd-choice-other-pick', for: `${id}-other` }, otherChoice, make(document, 'span', {}, words.other)), otherBox) : null;
    // An answer of one's own that is one of the options, said under it as it is ticked.
    const said = otherBox && otherRow ? refusalHint(otherBox, otherRow) : null;
    /** The most ticked already: one more ticks nothing, and says why. */
    const atMost = () => !!limit?.most && (Array.isArray(form.getState().values[name]) ? (form.getState().values[name] as unknown[]).length : 0) >= limit.most;
    const fold = (text: string) => foldForSearch(text).trim();
    if (otherChoice && otherBox && otherRow) {
      group.append(otherRow);
      // Typing picks "Other"; picking "Other" puts the cursor in its box.
      otherBox.addEventListener('input', () => {
        said?.hide();
        if (!otherChoice.checked) {
          if (kind === 'checkbox' && atMost()) return limit?.say(fillIn(words.chooseUpTo, { max: limit.most }));
          otherChoice.checked = true;
        }
        save(otherChoice);
      });
      otherChoice.addEventListener('change', () => {
        if (otherChoice.checked) otherBox.focus();
      });
      // Left, or read by a save made from inside it (a change), the answer is held trimmed; one that names an option,
      // by its value or its words, ticks that option and says so.
      const settleOther = () => {
        if (otherBox.readOnly || otherBox.disabled) return;
        const text = otherBox.value.trim();
        if (text !== otherBox.value) otherBox.value = text;
        const at = text ? choices.findIndex((option) => fold(option.label) === fold(text) || fold(String(option.value)) === fold(text)) : -1;
        if (at === -1) return;
        otherBox.value = '';
        otherChoice.checked = false;
        inputs[at].checked = true;
        save(inputs[at]);
        said?.show(fillIn(words.isAnOption, { text: choices[at].label }));
      };
      otherBox.addEventListener('change', settleOther);
      otherBox.addEventListener('blur', settleOther);
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
      const own = otherChoice?.checked && otherBox && otherBox.value.trim() ? otherBox.value.trim() : null;
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
      if (event.target === otherBox) return;
      // At the most a question takes, one more is not ticked: the box says why, and stays as it was.
      const ticked = event.target;
      if (kind === 'checkbox' && ticked instanceof HTMLInputElement && ticked.checked && atMost() && !(choices[inputs.indexOf(ticked)]?.exclusive === true)) {
        ticked.checked = false;
        return limit?.say(fillIn(words.chooseUpTo, { max: limit.most }));
      }
      save(ticked);
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
        // At the most a question takes, "Up to 3" says so; a box more, pressed, says why (hide, never disable).
        limit?.full(Array.isArray(state.value) ? state.value.length : 0);
        seats.update();
        inputs.forEach((input, i) => {
          input.checked = chosen.includes(choices[i].value as never);
          if (input.disabled !== state.readonly) input.disabled = state.readonly;
          // Its words as they read now: one that shows an answer given follows it (the viewer's answers part).
          if (optionWords[i].textContent !== choices[i].label) optionWords[i].textContent = choices[i].label;
        });
        if (otherChoice && otherBox) {
          // A value not among the options is an answer of its own: "Other", with its words.
          const own = chosen.find((v) => typeof v === 'string' && !known.has(v));
          // Picked with its box still empty, "Other" stays picked until something else is; while its words are typed, too.
          const typing = document.activeElement === otherBox && otherChoice.checked && !!otherBox.value.trim();
          const waiting = otherChoice.checked && !otherBox.value.trim() && (kind === 'checkbox' || chosen.every((v) => v === null || v === undefined));
          otherChoice.checked = own !== undefined || waiting || typing;
          if (own !== undefined && document.activeElement !== otherBox) otherBox.value = own as string;
          if (otherChoice.disabled !== state.readonly) otherChoice.disabled = otherBox.disabled = state.readonly;
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
      // Right to left the points run from the right: ← goes to the next one on screen, a higher value.
      const back = rightToLeft(group);
      const steps: Record<string, number> = { ArrowUp: 1, ArrowDown: -1, ArrowRight: back ? -1 : 1, ArrowLeft: back ? 1 : -1 };
      const step = steps[event.key] ?? 0;
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

// A date, a date and time, and a time of day are typed in Fieldia's own box, a date's calendar beside it (date-box.ts),
// which comes in the date part: a plain box of the same reader meanwhile. A date and time is shown in local time, stored
// as an ISO instant in UTC.
const dateBoxOf = (kind: DateKind) => partFactory(datePart, (part) => part.dateBoxWidget(kind), plainDateWidget(kind));
/** A range of dates, from → to (date-range.ts), in the date part: its first day in a plain box meanwhile. */
const dateRangeOf = (kind: DateKind) => partFactory(datePart, (part) => part.dateRangeWidget, plainDateWidget(kind));

/**
 * A one2many as a table of its lines (lines-table.ts), in the lines part: its lines as plain words meanwhile, read
 * only, the value kept (lines-plain.ts). What its cells edit a line through stays here (lines.ts).
 */
export const linesWidget: PartFactory = partFactory(linesPart, (part) => part.linesWidget(createWidget), plainLinesWidget);
/** A one2many as a repeating group of cards (cards.ts), in the lines part: its lines as plain words meanwhile, as a table's. */
const cardsWidget: PartFactory = partFactory(linesPart, (part) => part.cardsWidget(createWidget), plainLinesWidget);
// Flectra's business widgets — a statusbar, priority stars, hours and a per cent's boxes, an analytic distribution, tax
// totals, payments — come in the business part (business-part.ts): their value plainly meanwhile (business-plain.ts).
// A state's dot stays in the main script: a work item's State is one, and its list is drawn as the choice part's and the
// path picker's (pick-list.ts).
const business = (widget: (part: BusinessPart) => WidgetFactory, plain: WidgetFactory) => partFactory(businessPart, widget, plain);
const statusbarOf = business((part) => part.statusbarWidget, plainState);
/** A statusbar, as 0.22 gave it: the business part's, the state's label meanwhile. */
export const statusbarWidget: WidgetFactory = statusbarOf;
const priorityOf = business((part) => part.priorityWidget, plainStars);

// Links to other records — a many2one's and a reference's box, a many2many's tags and checkboxes (relations-plain.ts)
// and a char field's tags — come in the relations part (relations.ts). A char field's tags are its words meanwhile, in
// the text box that reads and writes them as they are, the part's tags taking its place once it is left.
/** A char field's tags, as 0.24 gave them: the relations part's, its words in a text box meanwhile. */
export const charTagsWidget: PartFactory = partFactory(relationsPart, (part) => part.charTagsWidget, textWidget('text'));
/** An analytic distribution's lines each draw a link's box: its page waits for the relations part too. */
const businessWithLinks = partWith(businessPart, relationsPart);

/**
 * A file, a picture, a signature or a PDF field before the files part came (files-part.ts): the names of the files its
 * value holds, as read-only words. It never writes, so the field keeps every file it holds — and those on their way,
 * which the form holds — and a file is picked once the part's widget has taken its place, with the last state it was
 * given. Each kind's own widget comes in the part.
 */
function plainFilesWidget({ field, id, document }: WidgetContext): Widget {
  const output = document.createElement('output');
  output.id = id;
  output.className = 'fd-value-text';
  output.dataset['fdPlain'] = 'files';
  // Focus asked for meanwhile (a required field left empty, say) lands here, and moves to the part's widget with it.
  output.tabIndex = -1;
  return {
    element: output,
    focus: () => output.focus(),
    update(state) {
      setText(output, summary(state.value, field));
    },
  };
}
/** A file field's own widget (files.ts, signature.ts, pdf.ts), in the files part: the files' names meanwhile. */
const filesOf = (real: (part: FilesPart) => WidgetFactory) => partFactory(filesPart, real, plainFilesWidget);
/** A file field's and a picture field's widgets, as 0.22 gave them: the files part's, the files' names meanwhile. */
export const binaryWidget: WidgetFactory = filesOf((part) => part.binaryWidget);
export const imageWidget: WidgetFactory = filesOf((part) => part.imageWidget);
// The survey kinds come in the survey part (survey-part.ts), each shown plainly meanwhile (survey-plain.ts): a slider's
// number in the number box, pictures to choose from as the choices' own radios or boxes, a progress bar's number in words.
// A property's rows and an editable progress bar's box are drawn by createWidget, handed to the part rather than imported
// by it: a part that imported this module would make an app's bundler split it off with the part, and run it before
// the widgets it holds (lines, cards) are there.
const surveyKind = (real: (part: SurveyPart) => WidgetFactory, plain: WidgetFactory) => partFactory(surveyPart, real, plain);
const sliderKind = surveyKind((part) => part.sliderWidget, numberWidget);
const colourKind = surveyKind((part) => part.colourWidget, plainColour);
/** A number shown as a bar that fills towards a maximum (progress.ts, in the survey part). */
export const progressbarWidget: WidgetFactory = surveyKind((part) => part.progressbarWidget(createWidget), (context) => labelWidget(context));
/** A properties field, a row per property, each edited with the widget for its type (properties.ts, in the survey part). */
export const propertiesWidget: WidgetFactory = surveyKind((part) => part.propertiesWidget(createWidget), plainProperties);

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

/**
 * A widget the registry reads as a field is drawn, never as this module starts. The widgets that draw with this module
 * — a bar's box and a property's value through `createWidget`, a label's words through `summary` —
 * import it back; an app's bundler that splits its code into chunks may start them after this one (esbuild orders a
 * chunk's modules by how near each is to an entry point, and a new part moves them), when they would not be there yet.
 * The part a widget comes in is told through it all the same (`partOf`), so a page waits for it as for any other.
 */
const later = (factory: () => WidgetFactory): WidgetFactory =>
  Object.assign((context: WidgetContext) => factory()(context), {
    partOf: (node: FieldNode, page?: Page, field?: Field) => (factory() as Partial<PartFactory>).partOf?.(node, page, field),
  });

export const builtInWidgets: Record<string, WidgetFactory> = {
  char: textWidget('text'),
  'char.email': textWidget('email'),
  // A phone read the world over where its page or its own options say so (phone-box.ts, in the phone part): its
  // country picked or typed, checked, kept as E.164, shown at rest with its links. Else, and before the part comes, the
  // text box it was.
  'char.phone': partFactory(phonePart, (part) => part.phoneWidget, textWidget('tel'), (node, page) => phoneSettings(page, node.options) !== null),
  'char.url': textWidget('url'),
  'char.password': textWidget('password'),
  'char.time': dateBoxOf('time'),
  'char.tags': charTagsWidget,
  text: textareaWidget,
  integer: numberWidget,
  float: numberWidget,
  monetary: numberWidget,
  'integer.rating': pointsWidget('rating'),
  'integer.scale': pointsWidget('scale'),
  'integer.slider': sliderKind,
  'float.slider': sliderKind,
  'integer.progressbar': later(() => progressbarWidget),
  'integer.label': later(() => labelWidget),
  'float.label': later(() => labelWidget),
  'monetary.label': later(() => labelWidget),
  'float.progressbar': later(() => progressbarWidget),
  // Hours as HH:MM (Flectra's float_time), a fraction as a per cent (its percentage).
  'float.duration': business((part) => part.durationWidget, plainNumber),
  'float.percentage': business((part) => part.percentageWidget, plainNumber),
  'monetary.progressbar': later(() => progressbarWidget),
  boolean: checkboxWidget(),
  'boolean.toggle': checkboxWidget('switch'),
  'boolean.tick': checkboxWidget('tick'),
  'boolean.buttons': yesNoWidget,
  // Stars over a selection, the first option none, or one over a yes or no: Flectra's priority.
  'boolean.priority': priorityOf,
  'selection.priority': priorityOf,
  // A grey, red or green dot with a menu of the states: Flectra's state_selection.
  'selection.dot': stateDotWidget,
  // A tag colour from Flectra's twelve (0 none … 11), or a colour as #rrggbb.
  'integer.color': colourKind,
  'char.color': colourKind,
  // A value and a button that copies it: Flectra's CopyClipboardChar and CopyClipboardText.
  'char.copy': business((part) => part.copyWidget, textWidget('text')),
  'text.copy': business((part) => part.copyWidget, textareaWidget),
  // One box from → to, a range picked on a calendar, writing two date fields: Flectra's daterange.
  'date.daterange': dateRangeOf('date'),
  'datetime.daterange': dateRangeOf('datetime'),
  // A booking's time picked from those free, asked of the data source's slots: the date and time box without them.
  'datetime.slots': partFactory(slotsPart, (part) => part.slotsWidget, plainDateWidget('datetime')),
  // A live timer, the time logged and the time running from a start: Flectra's mrp_timer.
  'float.timer': business((part) => part.timerWidget, plainTimer),
  'datetime.timer': business((part) => part.timerWidget, plainTimer),
  // A PDF, or a web page at an address, shown inline: Flectra's pdf_viewer and embed_viewer.
  'binary.pdf': filesOf((part) => part.pdfWidget),
  'char.embed': embedWidget,
  // Shares of accounts, {accountId: percent}, as lines adding up to 100 %: Flectra's analytic_distribution.
  'json.distribution': partFactory(businessWithLinks, (part) => part.distributionWidget, plainShares),
  // Untaxed amount, a line per tax group, the total, from a value the app works out: Flectra's tax_totals.
  'json.tax-totals': business((part) => part.taxTotalsWidget, plainTotal),
  // Each payment's date and amount, its details in a popover: Flectra's invoice_payments_widget.
  'json.payments': business((part) => part.paymentsWidget, plainPayments),
  // Fieldia's own list in place of the browser's, a tick by the option picked (own-list.ts), or a long list searched as
  // it is typed (choice-tags.ts): the choice part's, the browser's own list meanwhile.
  selection: partFactory(choicePart, (part) => (context) => (ownList(context.node) ? part.ownListWidget : part.searchWidget)(context), (context) => selectWidget(context), (node, _page, field) => ownList(node) || searched(node, field)),
  'selection.radio': choiceGroup('radio'),
  'selection.checkboxes': choiceGroup('checkbox'),
  // Several answers as tags in a box (choice-tags.ts), in the choice part: their words meanwhile.
  'selection.tags': partFactory(choicePart, (part) => part.choiceTagsWidget, plainChosen),
  'selection.image-choice': surveyKind((part) => part.imageChoiceWidget, (context) => choiceGroup(context.field.type === 'selection' && context.field.multiple ? 'checkbox' : 'radio')(context)),
  'selection.ranking': surveyKind((part) => part.rankingWidget, plainRanking),
  'selection.statusbar': statusbarOf,
  date: dateBoxOf('date'),
  datetime: dateBoxOf('datetime'),
  many2one: many2oneWidget,
  'many2one.statusbar': statusbarOf,
  // A record of a tree as its path, "Portal\\Sprint 14": suggestions, then the tree (path-picker.ts).
  'many2one.path': partFactory(pathPart, (part) => part.pathPickerWidget, plainLinkWidget),
  many2many: tagsWidget,
  'many2many.tags': tagsWidget,
  'many2many.checkboxes': linkCheckboxesWidget,
  // A table of the records it links to, in the lines part: their names as plain words meanwhile.
  'many2many.table': partFactory(linesPart, (part) => part.linksTableWidget, plainLinksWidget),
  // The links box comes with the text part, whose menus and words it shares; the tags meanwhile.
  'many2many.links': partFactory(textPart, (part) => part.linksWidget, plainTagsWidget),
  reference: referenceWidget,
  one2many: linesWidget,
  'one2many.cards': cardsWidget,
  // A file, a signature and a picture, in the files part (files-part.ts): the files' names meanwhile.
  binary: binaryWidget,
  'binary.signature': filesOf((part) => part.signatureWidget),
  image: imageWidget,
  html: htmlWidget,
  json: jsonWidget,
  'json.address': surveyKind((part) => part.addressWidget, plainAddress),
  properties: later(() => propertiesWidget),
  matrix: surveyKind((part) => part.matrixWidget, plainMatrix),
  // A value as a pill in its tone: Flectra's widget="badge".
  'char.badge': badgeWidget,
  'selection.badge': badgeWidget,
  'many2one.badge': badgeWidget,
};
