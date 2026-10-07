import type { Field, FieldNode, Option } from '@fieldia/core';
import { checkAppKinds, widgetOf, type AppKind } from './app-kinds';
import type { DesignerWords } from './designer-words';
import { en } from './locales/en';

/**
 * The kinds of field the designer makes, and which of them suit a field that
 * already holds data. A kind is a field definition and, for some, an editor
 * (the node's widget): a field made in the designer can become any kind, its
 * definition following; a field from the backend's model keeps what it holds,
 * so it can only change editor, among those made for that data.
 */

export interface QuestionKind {
  id: string;
  /** Its name in English; the designer says it in its own language (`kindName`). */
  label: string;
  /** The field a new one starts as; what it starts with (its first option) in the designer's words, English unless given. */
  field: (label: string, words?: DesignerWords) => Field;
  widget?: string;
  /** Where the screen editor's palette lists it; a kind for records is refused in a survey. */
  group?: 'records' | 'more';
  /** An app's own kind, as the app gave it. */
  app?: AppKind;
}

const firstOption = (w: DesignerWords): Option[] => [{ value: 'option_1', label: w.defaults.option(1) }];
/** "Row 1", "Row 2"…, with the values a new option has. */
const numbered = (value: string, label: (n: number) => string, count: number): Option[] => Array.from({ length: count }, (_, i) => ({ value: `${value}_${i + 1}`, label: label(i + 1) }));

export const QUESTION_KINDS: readonly QuestionKind[] = [
  { id: 'short-answer', label: 'Short answer', field: (label) => ({ type: 'char', label }) },
  { id: 'paragraph', label: 'Paragraph', field: (label) => ({ type: 'text', label }) },
  { id: 'multiple-choice', label: 'Multiple choice', field: (label, w = en) => ({ type: 'selection', label, options: firstOption(w) }), widget: 'radio' },
  { id: 'checkboxes', label: 'Checkboxes', field: (label, w = en) => ({ type: 'selection', label, options: firstOption(w), multiple: true }), widget: 'checkboxes' },
  { id: 'dropdown', label: 'Dropdown', field: (label, w = en) => ({ type: 'selection', label, options: firstOption(w) }) },
  { id: 'rating', label: 'Rating', field: (label) => ({ type: 'integer', label, min: 1, max: 5 }), widget: 'rating' },
  { id: 'scale', label: 'Linear scale', field: (label) => ({ type: 'integer', label, min: 0, max: 10 }), widget: 'scale' },
  { id: 'number', label: 'Number', field: (label) => ({ type: 'float', label }) },
  { id: 'date', label: 'Date', field: (label) => ({ type: 'date', label }) },
  { id: 'date-time', label: 'Date and time', field: (label) => ({ type: 'datetime', label }) },
  // A time of day, kept as HH:MM: the pattern says so to a backend too.
  { id: 'time', label: 'Time', field: (label) => ({ type: 'char', label, pattern: '^([01]\\d|2[0-3]):[0-5]\\d$' }), widget: 'time' },
  // Two buttons, neither picked until one is: the field starts empty, so Required asks for an answer.
  { id: 'yes-no', label: 'Yes or no', field: (label) => ({ type: 'boolean', label, default: null }), widget: 'buttons' },
  { id: 'tick', label: 'Tick box', field: (label) => ({ type: 'boolean', label }), widget: 'tick' },
  { id: 'email', label: 'Email', field: (label) => ({ type: 'char', label, pattern: '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$' }), widget: 'email' },
  { id: 'phone', label: 'Phone', field: (label) => ({ type: 'char', label }), widget: 'phone' },
  { id: 'file', label: 'File upload', field: (label) => ({ type: 'binary', label, maxSize: 10 * 1024 * 1024 }) },
  { id: 'signature', label: 'Signature', field: (label) => ({ type: 'binary', label }), widget: 'signature' },
  { id: 'slider', label: 'Slider', field: (label) => ({ type: 'integer', label, min: 0, max: 10 }), widget: 'slider' },
  { id: 'tags', label: 'Tags', field: (label, w = en) => ({ type: 'selection', label, options: firstOption(w), multiple: true }), widget: 'tags' },
  { id: 'image-choice', label: 'Image choice', field: (label, w = en) => ({ type: 'selection', label, options: firstOption(w) }), widget: 'image-choice' },
  { id: 'ranking', label: 'Ranking', field: (label, w = en) => ({ type: 'selection', label, options: numbered('option', w.defaults.option, 3), multiple: true }), widget: 'ranking' },
  { id: 'matrix', label: 'Matrix', field: (label, w = en) => ({ type: 'matrix', label, rows: numbered('row', w.defaults.row, 2), columns: numbered('column', w.defaults.column, 2) }) },
  { id: 'address', label: 'Address', field: (label) => ({ type: 'json', label }), widget: 'address' },
  { id: 'repeating', label: 'Repeating group', field: (label, w = en) => ({ type: 'one2many', label, relation: 'entry', fields: { name: { type: 'char', label: w.defaults.name } } }), widget: 'cards' },
];

/** Kinds for app screens only: links to other records, a table of lines, and the fields a business record has. */
export const SCREEN_KINDS: readonly QuestionKind[] = [
  { id: 'link', label: 'Link to a record', group: 'records', field: (label) => ({ type: 'many2one', label, relation: 'contact' }) },
  { id: 'links', label: 'Links to records', group: 'records', field: (label) => ({ type: 'many2many', label, relation: 'tag' }) },
  {
    id: 'lines',
    label: 'Table of lines',
    group: 'records',
    field: (label, w = en) => ({ type: 'one2many', label, relation: 'line', fields: { name: { type: 'char', label: w.defaults.description }, quantity: { type: 'float', label: w.defaults.quantity } } }),
    // The spreadsheet grid where the app has it (`gridWidgets`), the plain table where it does not.
    widget: 'grid',
  },
  { id: 'amount', label: 'Amount', group: 'more', field: (label) => ({ type: 'monetary', label, currency: 'USD' }) },
  { id: 'progress', label: 'Progress', group: 'more', field: (label) => ({ type: 'integer', label, min: 0, max: 100 }), widget: 'progressbar' },
  {
    id: 'status',
    label: 'Status steps',
    group: 'more',
    field: (label, w = en) => ({ type: 'selection', label, options: [{ value: 'draft', label: w.defaults.draft }, { value: 'confirmed', label: w.defaults.confirmed }, { value: 'done', label: w.defaults.done }] }),
    widget: 'statusbar',
  },
  { id: 'rich-text', label: 'Rich text', group: 'more', field: (label) => ({ type: 'html', label }) },
  { id: 'keywords', label: 'Keywords', group: 'more', field: (label) => ({ type: 'char', label }), widget: 'tags' },
  { id: 'website', label: 'Website', group: 'more', field: (label) => ({ type: 'char', label }), widget: 'url' },
  { id: 'image', label: 'Image', group: 'more', field: (label) => ({ type: 'image', label }) },
  // The business widgets an ERP's screens lean on.
  {
    id: 'priority',
    label: 'Priority stars',
    group: 'more',
    field: (label, w = en) => ({ type: 'selection', label, options: [w.defaults.priorityNone, ...w.defaults.priorityLevels].map((words, i) => ({ value: String(i), label: words })) }),
    widget: 'priority',
  },
  {
    id: 'state-dot',
    label: 'State dot',
    group: 'more',
    field: (label, w = en) => ({ type: 'selection', label, options: ['normal', 'blocked', 'done'].map((value, i) => ({ value, label: w.defaults.dotStates[i] })) }),
    widget: 'dot',
  },
  { id: 'duration', label: 'Hours and minutes', group: 'more', field: (label) => ({ type: 'float', label }), widget: 'duration' },
  { id: 'percentage', label: 'Percentage', group: 'more', field: (label) => ({ type: 'float', label }), widget: 'percentage' },
  { id: 'timer', label: 'Timer', group: 'more', field: (label) => ({ type: 'float', label, readonly: true }), widget: 'timer' },
  { id: 'date-range', label: 'Range of dates', group: 'more', field: (label) => ({ type: 'date', label }), widget: 'daterange' },
  { id: 'colour', label: 'Colour', group: 'more', field: (label) => ({ type: 'integer', label }), widget: 'color' },
  { id: 'copy', label: 'Text to copy', group: 'more', field: (label) => ({ type: 'char', label }), widget: 'copy' },
  { id: 'pdf', label: 'PDF shown inline', group: 'more', field: (label) => ({ type: 'binary', label, accept: ['application/pdf'] }), widget: 'pdf' },
  { id: 'embed', label: 'Page shown inline', group: 'more', field: (label) => ({ type: 'char', label }), widget: 'embed' },
  { id: 'distribution', label: 'Analytic distribution', group: 'more', field: (label) => ({ type: 'json', label }), widget: 'distribution' },
  { id: 'tax-totals', label: 'Tax totals', group: 'more', field: (label) => ({ type: 'json', label, readonly: true }), widget: 'tax-totals' },
  { id: 'payments', label: 'Payments', group: 'more', field: (label) => ({ type: 'json', label, readonly: true }), widget: 'payments' },
  { id: 'properties', label: 'Properties', group: 'more', field: (label) => ({ type: 'properties', label }) },
];

/** The business kinds whose own settings are the widget's alone: shown for a field of the model too, which keeps what it holds. */
export const WIDGET_ONLY_KINDS: ReadonlySet<string> = new Set(['priority', 'state-dot', 'duration', 'percentage', 'timer', 'date-range', 'colour', 'copy', 'pdf', 'embed', 'distribution', 'tax-totals', 'payments', 'properties']);

/** The kind a field was made as, from its type and widget — an app's kind by the widget that draws it; null for one no kind makes. */
export function kindOfField(field: Field, node: FieldNode): string | null {
  if (node.widget) {
    for (const kind of APP_KINDS.values()) if (kind.widget === node.widget && kind.field(field.label).type === field.type) return kind.id;
  }
  return builtInKindOf(field, node);
}

function builtInKindOf(field: Field, node: FieldNode): string | null {
  switch (field.type) {
    case 'char':
      if (node.widget === 'color') return 'colour';
      if (node.widget === 'copy' || node.widget === 'embed') return node.widget;
      return node.widget === 'email' ? 'email' : node.widget === 'phone' ? 'phone' : node.widget === 'url' ? 'website' : node.widget === 'tags' ? 'keywords' : node.widget === 'time' ? 'time' : 'short-answer';
    case 'text':
      return node.widget === 'copy' ? 'copy' : 'paragraph';
    case 'html':
      return 'rich-text';
    case 'selection':
      if (node.widget === 'image-choice') return 'image-choice';
      if (!field.multiple && node.widget === 'priority') return 'priority';
      if (!field.multiple && node.widget === 'dot') return 'state-dot';
      if (field.multiple && (node.widget === 'tags' || node.widget === 'ranking')) return node.widget;
      return field.multiple ? 'checkboxes' : node.widget === 'radio' ? 'multiple-choice' : node.widget === 'statusbar' ? 'status' : 'dropdown';
    case 'integer':
      if (node.widget === 'color') return 'colour';
      return node.widget === 'rating' ? 'rating' : node.widget === 'scale' ? 'scale' : node.widget === 'progressbar' ? 'progress' : node.widget === 'slider' ? 'slider' : 'number';
    case 'float':
      if (node.widget === 'duration' || node.widget === 'percentage' || node.widget === 'timer') return node.widget;
      return node.widget === 'slider' ? 'slider' : 'number';
    case 'monetary':
      return 'amount';
    case 'date':
      return node.widget === 'daterange' ? 'date-range' : 'date';
    case 'datetime':
      return node.widget === 'daterange' ? 'date-range' : node.widget === 'timer' ? 'timer' : 'date-time';
    case 'boolean':
      return node.widget === 'priority' ? 'priority' : node.widget === 'tick' ? 'tick' : 'yes-no';
    case 'binary':
      return node.widget === 'signature' ? 'signature' : node.widget === 'pdf' ? 'pdf' : 'file';
    case 'image':
      return 'image';
    case 'many2one':
      return 'link';
    case 'many2many':
      return 'links';
    case 'one2many':
      return node.widget === 'cards' ? 'repeating' : 'lines';
    case 'matrix':
      return 'matrix';
    case 'json':
      return node.widget === 'address' || node.widget === 'distribution' || node.widget === 'tax-totals' || node.widget === 'payments' ? node.widget : null;
    case 'properties':
      return 'properties';
    default:
      return null;
  }
}

/** A column of a table of lines, as the screen editor edits it. `name` is kept for a column that already has one. */
export interface LineColumn {
  name?: string;
  label: string;
  /** `other` keeps a column of a type the editor does not offer, such as a link, as it is. */
  kind: 'text' | 'number' | 'date' | 'yes-no' | 'other';
}
export const COLUMN_TYPES = { text: 'char', number: 'float', date: 'date', 'yes-no': 'boolean' } as const;

/** The kind of column a line field is; a whole number and a float are both numbers. */
export function columnKind(field: Field): LineColumn['kind'] {
  switch (field.type) {
    case 'char':
    case 'text':
      return 'text';
    case 'integer':
    case 'float':
    case 'monetary':
      return 'number';
    case 'date':
    case 'datetime':
      return 'date';
    case 'boolean':
      return 'yes-no';
    default:
      return 'other';
  }
}


const ALL_KINDS = (): readonly QuestionKind[] => [...QUESTION_KINDS, ...SCREEN_KINDS];

/**
 * The apps' kinds, by id: every one registered stays known, so a field made
 * as one is known again on any page, and named in the words of a change.
 * Which are offered is each designer's own.
 */
const APP_KINDS = new Map<string, QuestionKind>();

/** An app's kinds added to those the designer knows, as kinds. Throws, saying why, for one that cannot be told apart from the rest. */
export function registerKinds(kinds: readonly AppKind[]): QuestionKind[] {
  checkAppKinds(kinds, ALL_KINDS(), [...APP_KINDS.values()]);
  const made = kinds.map((app): QuestionKind => ({ id: app.id, label: app.label, field: (label) => app.field(label), widget: widgetOf(app), app }));
  for (const kind of made) APP_KINDS.set(kind.id, kind);
  return made;
}

/** An app's kind's icon, by its id: SVG markup, or nothing. */
export const appKindIcon = (id: string): string | undefined => APP_KINDS.get(id)?.app?.icon;

/** A kind by its id: Fieldia's, or an app's. */
export function kindById(id: string): QuestionKind {
  const kind = ALL_KINDS().find((k) => k.id === id) ?? APP_KINDS.get(id);
  if (!kind) throw new Error(`Unknown question kind "${id}"`);
  return kind;
}

/** Whether a kind shows a field without changing what it holds: same type, one answer or many alike; a plain number for whole numbers too. An app's kind fits where it says. */
export function kindFits(kind: QuestionKind, field: Field): boolean {
  const made = kind.field(field.label);
  if (kind.app) return kind.app.fits ? kind.app.fits(field) : made.type === field.type;
  // Pictures to choose from, one or several.
  if (kind.id === 'image-choice') return field.type === 'selection';
  // The business widgets, each on the data it reads: stars on one of a list or a yes or no, a timer on hours or a start, a range on dates…
  const suits = BUSINESS_FITS[kind.id];
  if (suits) return suits(field);
  if (made.type === 'selection' && field.type === 'selection') return !!made.multiple === !!field.multiple;
  if (kind.id === 'number' || kind.id === 'slider') return field.type === 'integer' || field.type === 'float';
  // A time of day: only text the model keeps as one.
  if (kind.id === 'time') return field.type === 'char' && field.pattern === (made as { pattern?: string }).pattern;
  return made.type === field.type;
}

const single = (field: Field) => field.type === 'selection' && !field.multiple;
/** Which data each business kind shows without changing it. */
const BUSINESS_FITS: Record<string, (field: Field) => boolean> = {
  priority: (field) => single(field) || field.type === 'boolean',
  'state-dot': single,
  duration: (field) => field.type === 'float',
  percentage: (field) => field.type === 'float',
  timer: (field) => field.type === 'float' || field.type === 'datetime',
  'date-range': (field) => field.type === 'date' || field.type === 'datetime',
  colour: (field) => field.type === 'integer' || field.type === 'char',
  copy: (field) => field.type === 'char' || field.type === 'text',
  pdf: (field) => field.type === 'binary' && !field.multiple,
  embed: (field) => field.type === 'char',
  distribution: (field) => field.type === 'json',
  'tax-totals': (field) => field.type === 'json',
  payments: (field) => field.type === 'json',
};

/**
 * The kinds a field can be shown as: for a field from the model, those that
 * fit what it holds; otherwise all of them. A survey offers no kinds for
 * records. The app's own kinds (`app`) come after Fieldia's.
 */
export function kindsFor(field: Field, options: { fromModel: boolean; survey: boolean; app?: readonly QuestionKind[] }): QuestionKind[] {
  const offered = [...(options.survey ? QUESTION_KINDS : ALL_KINDS()), ...(options.app ?? [])];
  return options.fromModel ? offered.filter((k) => kindFits(k, field)) : [...offered];
}

/** What a field holds, in words, as the designer explains a refusal: in English unless given the designer's words. */
export function storedAs(field: Field, words: DesignerWords = en): string {
  const said = words.kinds.stored;
  if (field.type === 'selection') return field.multiple ? said.selectionMany : said.selectionOne;
  return Object.prototype.hasOwnProperty.call(said, field.type) ? said[field.type as keyof typeof said] : said.other;
}

/** A kind's name in the designer's words: Fieldia's in its language, an app's as the app named it. */
export function kindName(kind: QuestionKind, words: DesignerWords): string {
  if (kind.app) return kind.label;
  const names: Record<string, string> = words.kinds.names;
  return names[kind.id] ?? kind.label;
}

/** A kind's name by its id. */
export const kindNameOf = (id: string, words: DesignerWords): string => kindName(kindById(id), words);
