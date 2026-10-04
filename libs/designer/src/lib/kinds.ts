import type { Field, FieldNode, Option } from '@fieldia/core';

/**
 * The kinds of field the designer makes, and which of them suit a field that
 * already holds data. A kind is a field definition and, for some, an editor
 * (the node's widget): a field made in the designer can become any kind, its
 * definition following; a field from the backend's model keeps what it holds,
 * so it can only change editor, among those made for that data.
 */

export interface QuestionKind {
  id: string;
  label: string;
  field: (label: string) => Field;
  widget?: string;
  /** Where the screen editor's palette lists it; a kind for records is refused in a survey. */
  group?: 'records' | 'more';
}

const firstOption = (): Option[] => [{ value: 'option_1', label: 'Option 1' }];
/** "Row 1", "Row 2"…, with the values a new option has. */
const numbered = (value: string, label: string, count: number): Option[] => Array.from({ length: count }, (_, i) => ({ value: `${value}_${i + 1}`, label: `${label} ${i + 1}` }));

export const QUESTION_KINDS: readonly QuestionKind[] = [
  { id: 'short-answer', label: 'Short answer', field: (label) => ({ type: 'char', label }) },
  { id: 'paragraph', label: 'Paragraph', field: (label) => ({ type: 'text', label }) },
  { id: 'multiple-choice', label: 'Multiple choice', field: (label) => ({ type: 'selection', label, options: firstOption() }), widget: 'radio' },
  { id: 'checkboxes', label: 'Checkboxes', field: (label) => ({ type: 'selection', label, options: firstOption(), multiple: true }), widget: 'checkboxes' },
  { id: 'dropdown', label: 'Dropdown', field: (label) => ({ type: 'selection', label, options: firstOption() }) },
  { id: 'rating', label: 'Rating', field: (label) => ({ type: 'integer', label, min: 1, max: 5 }), widget: 'rating' },
  { id: 'scale', label: 'Linear scale', field: (label) => ({ type: 'integer', label, min: 0, max: 10 }), widget: 'scale' },
  { id: 'number', label: 'Number', field: (label) => ({ type: 'float', label }) },
  { id: 'date', label: 'Date', field: (label) => ({ type: 'date', label }) },
  { id: 'date-time', label: 'Date and time', field: (label) => ({ type: 'datetime', label }) },
  { id: 'yes-no', label: 'Yes or no', field: (label) => ({ type: 'boolean', label }), widget: 'toggle' },
  { id: 'email', label: 'Email', field: (label) => ({ type: 'char', label, pattern: '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$' }), widget: 'email' },
  { id: 'phone', label: 'Phone', field: (label) => ({ type: 'char', label }), widget: 'phone' },
  { id: 'file', label: 'File upload', field: (label) => ({ type: 'binary', label, maxSize: 10 * 1024 * 1024 }) },
  { id: 'signature', label: 'Signature', field: (label) => ({ type: 'binary', label }), widget: 'signature' },
  { id: 'slider', label: 'Slider', field: (label) => ({ type: 'integer', label, min: 0, max: 10 }), widget: 'slider' },
  { id: 'tags', label: 'Tags', field: (label) => ({ type: 'selection', label, options: firstOption(), multiple: true }), widget: 'tags' },
  { id: 'image-choice', label: 'Image choice', field: (label) => ({ type: 'selection', label, options: firstOption() }), widget: 'image-choice' },
  { id: 'ranking', label: 'Ranking', field: (label) => ({ type: 'selection', label, options: numbered('option', 'Option', 3), multiple: true }), widget: 'ranking' },
  { id: 'matrix', label: 'Matrix', field: (label) => ({ type: 'matrix', label, rows: numbered('row', 'Row', 2), columns: numbered('column', 'Column', 2) }) },
  { id: 'address', label: 'Address', field: (label) => ({ type: 'json', label }), widget: 'address' },
  { id: 'repeating', label: 'Repeating group', field: (label) => ({ type: 'one2many', label, relation: 'entry', fields: { name: { type: 'char', label: 'Name' } } }), widget: 'cards' },
];

/** Kinds for app screens only: links to other records, a table of lines, and the fields a business record has. */
export const SCREEN_KINDS: readonly QuestionKind[] = [
  { id: 'link', label: 'Link to a record', group: 'records', field: (label) => ({ type: 'many2one', label, relation: 'contact' }) },
  { id: 'links', label: 'Links to records', group: 'records', field: (label) => ({ type: 'many2many', label, relation: 'tag' }) },
  {
    id: 'lines',
    label: 'Table of lines',
    group: 'records',
    field: (label) => ({ type: 'one2many', label, relation: 'line', fields: { name: { type: 'char', label: 'Description' }, quantity: { type: 'float', label: 'Quantity' } } }),
    // The spreadsheet grid where the app has it (`gridWidgets`), the plain table where it does not.
    widget: 'grid',
  },
  { id: 'amount', label: 'Amount', group: 'more', field: (label) => ({ type: 'monetary', label, currency: 'USD' }) },
  { id: 'progress', label: 'Progress', group: 'more', field: (label) => ({ type: 'integer', label, min: 0, max: 100 }), widget: 'progressbar' },
  {
    id: 'status',
    label: 'Status steps',
    group: 'more',
    field: (label) => ({ type: 'selection', label, options: [{ value: 'draft', label: 'Draft' }, { value: 'confirmed', label: 'Confirmed' }, { value: 'done', label: 'Done' }] }),
    widget: 'statusbar',
  },
  { id: 'rich-text', label: 'Rich text', group: 'more', field: (label) => ({ type: 'html', label }) },
  { id: 'keywords', label: 'Keywords', group: 'more', field: (label) => ({ type: 'char', label }), widget: 'tags' },
  { id: 'website', label: 'Website', group: 'more', field: (label) => ({ type: 'char', label }), widget: 'url' },
  { id: 'image', label: 'Image', group: 'more', field: (label) => ({ type: 'image', label }) },
];

/** The kind a field was made as, from its type and widget; null for one no kind makes. */
export function kindOfField(field: Field, node: FieldNode): string | null {
  switch (field.type) {
    case 'char':
      return node.widget === 'email' ? 'email' : node.widget === 'phone' ? 'phone' : node.widget === 'url' ? 'website' : node.widget === 'tags' ? 'keywords' : 'short-answer';
    case 'text':
      return 'paragraph';
    case 'html':
      return 'rich-text';
    case 'selection':
      if (node.widget === 'image-choice') return 'image-choice';
      if (field.multiple && (node.widget === 'tags' || node.widget === 'ranking')) return node.widget;
      return field.multiple ? 'checkboxes' : node.widget === 'radio' ? 'multiple-choice' : node.widget === 'statusbar' ? 'status' : 'dropdown';
    case 'integer':
      return node.widget === 'rating' ? 'rating' : node.widget === 'scale' ? 'scale' : node.widget === 'progressbar' ? 'progress' : node.widget === 'slider' ? 'slider' : 'number';
    case 'float':
      return node.widget === 'slider' ? 'slider' : 'number';
    case 'monetary':
      return 'amount';
    case 'date':
      return 'date';
    case 'datetime':
      return 'date-time';
    case 'boolean':
      return 'yes-no';
    case 'binary':
      return node.widget === 'signature' ? 'signature' : 'file';
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
      return node.widget === 'address' ? 'address' : null;
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

/** A kind by its id. */
export function kindById(id: string): QuestionKind {
  const kind = ALL_KINDS().find((k) => k.id === id);
  if (!kind) throw new Error(`Unknown question kind "${id}"`);
  return kind;
}

/** Whether a kind shows a field without changing what it holds: same type, one answer or many alike; a plain number for whole numbers too. */
export function kindFits(kind: QuestionKind, field: Field): boolean {
  const made = kind.field(field.label);
  // Pictures to choose from, one or several.
  if (kind.id === 'image-choice') return field.type === 'selection';
  if (made.type === 'selection' && field.type === 'selection') return !!made.multiple === !!field.multiple;
  if (kind.id === 'number' || kind.id === 'slider') return field.type === 'integer' || field.type === 'float';
  return made.type === field.type;
}

/**
 * The kinds a field can be shown as: for a field from the model, those that
 * fit what it holds; otherwise all of them. A survey offers no kinds for records.
 */
export function kindsFor(field: Field, options: { fromModel: boolean; survey: boolean }): QuestionKind[] {
  const offered = options.survey ? QUESTION_KINDS : ALL_KINDS();
  return options.fromModel ? offered.filter((k) => kindFits(k, field)) : [...offered];
}

/** What a field holds, in words, as the designer explains a refusal. */
export function storedAs(field: Field): string {
  switch (field.type) {
    case 'char':
      return 'text';
    case 'text':
      return 'long text';
    case 'html':
      return 'rich text';
    case 'selection':
      return field.multiple ? 'several of a list' : 'one of a list';
    case 'integer':
      return 'a whole number';
    case 'float':
      return 'a number';
    case 'monetary':
      return 'an amount';
    case 'date':
      return 'a date';
    case 'datetime':
      return 'a date and time';
    case 'boolean':
      return 'yes or no';
    case 'binary':
      return 'a file';
    case 'image':
      return 'an image';
    case 'many2one':
      return 'a link to a record';
    case 'many2many':
      return 'links to records';
    case 'one2many':
      return 'lines';
    case 'matrix':
      return 'answers in rows';
    case 'json':
      return 'structured data';
    default:
      return 'its own kind of data';
  }
}

/** "A, B or C". */
export function orList(words: string[]): string {
  return words.length < 2 ? words.join('') : `${words.slice(0, -1).join(', ')} or ${words[words.length - 1]}`;
}
