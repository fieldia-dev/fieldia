import type { Field, LineField, PropertyDefinition } from '../format/field';
import { fieldPattern } from '../format/pattern';
import { checkDay } from './limits';
import { fill, fillMessage, MESSAGES, type MessageKey, type Messages } from './messages';
import { charCount, foldDigits, MOST_DIGITS, placesOf, stripMarks } from './input-rules';
import { isQuestion } from './record-words';
import { formLanguagesPart, languagesOf } from './languages';
import { isEmpty, type FileValue, type ReferenceValue, type RelatedRecord, type Value } from './values';

/**
 * Check one value against its field. Returns the message to show, or
 * undefined when the value is fine, naming the field ("Name is required",
 * "Bio takes at most 120 characters").
 *
 * An empty optional value passes everything: a pattern or a minimum applies
 * to what someone typed, not to a field they left alone.
 */
export function checkValue(
  field: Field | LineField,
  value: Value | undefined,
  required: boolean,
  messages: Messages = MESSAGES.en,
  /** The day it is, for a date's limits counted from today. The computer's own when left out. */
  today?: string,
  /**
   * The widget it is shown with, where that changes what its `digits` count: a per cent's are those of the per cent
   * typed and shown (12.50 % of digits [5, 2] is the fraction 0.125), as its box counts them.
   */
  widget?: string
): string | undefined {
  const label = field.label || 'This field';
  const say = (key: MessageKey, values: Record<string, string | number> = {}) => fillMessage(messages, messages[key], { label, ...values });
  // A question is asked for: "Please answer “How was your visit?”", never "How was your visit? is required".
  if (isEmpty(field, value)) return required ? say(isQuestion(label) ? 'requiredQuestion' : 'required') : undefined;
  if (field.type === 'matrix') return checkMatrix(field, value, required, say);
  // A text kept in several languages, language by language, by its part: until it has come (a save waits for it), nothing is said.
  if (languagesOf(field)) return formLanguagesPart.loaded?.checkTranslated(field, value, required, messages, today, widget);

  switch (field.type) {
    case 'char':
    case 'text':
    case 'html': {
      if (typeof value !== 'string') return say('text');
      // Characters as a person sees them and a server counts them: an emoji is one. A text pasted over its most is
      // kept whole, and told how far over it is.
      const count = (field.type === 'char' || field.type === 'text') && field.size !== undefined ? charCount(value) : 0;
      if ((field.type === 'char' || field.type === 'text') && field.size !== undefined && count > field.size) {
        // One over is said as one: "1 character over", never "1 characters".
        return say(count - field.size === 1 ? 'overByOne' : 'overBy', { max: field.size, over: count - field.size });
      }
      // The whole answer, trimmed, its digits as 0-9 and no direction marks: "١١٥١١" is five digits. A pattern that
      // does not read is the page's to fix (checkPage names it), never a reason to refuse a person.
      const pattern = field.type === 'char' && field.pattern !== undefined ? fieldPattern(field.pattern) : null;
      if (field.type === 'char' && pattern instanceof RegExp && !pattern.test(foldDigits(stripMarks(value)).trim())) {
        return field.patternHint ? fill(field.patternHint, { label }) : say('pattern');
      }
      return undefined;
    }
    case 'integer':
    case 'float':
    case 'monetary': {
      if (typeof value !== 'number' || !Number.isFinite(value)) return say('number');
      if (field.type === 'integer' && !Number.isInteger(value)) return say('integer');
      if (field.min !== undefined && value < field.min) return say('min', { min: field.min });
      if (field.max !== undefined && value > field.max) return say('max', { max: field.max });
      const digits = field.type === 'integer' ? undefined : field.digits;
      // Its digits count what is shown: a per cent's, the per cent.
      const shown = widget === 'percentage' ? Math.round(value * 100 * 1e10) / 1e10 : value;
      if (digits && placesOf(shown) > digits[1]) return digits[1] === 0 ? say('integer') : say(decimalsKey(digits[1], messages.locale), { digits: digits[1] });
      // Past what a number keeps exactly (15 digits, a safe whole number), or past the field's own digits[0]: a value
      // from outside, as a box never takes one. The whole part counts, and the places the field keeps.
      const integerPart = Math.trunc(Math.abs(shown));
      const whole = integerPart === 0 ? 0 : integerPart < 1e21 ? String(integerPart).length : 22;
      if (whole > MOST_DIGITS || (field.type === 'integer' && !Number.isSafeInteger(value))) return say('digits', { n: MOST_DIGITS });
      // Before the decimal mark, precision less scale: said as such, never "at most 10 digits" of a number of 10.
      if (digits && whole > digits[0] - digits[1]) return digits[1] ? say('wholeDigits', { n: digits[0] - digits[1] }) : say('digits', { n: digits[0] });
      return undefined;
    }
    case 'boolean':
      return typeof value === 'boolean' ? undefined : say('boolean');
    case 'date':
      return checkDate(value, say) ?? checkDay(field, value as string, today, messages);
    case 'datetime':
      return checkDateTime(value, say) ?? checkDay(field, value as string, today, messages);
    case 'selection': {
      // The app's list, not loaded: nothing to say a choice is not one of it.
      if (field.optionsFrom) return undefined;
      const allowed = new Set(field.options.map((o) => o.value));
      const listing = say(field.other ? 'choiceOrOther' : 'choice', { options: field.options.map((o) => o.label).join(', ') });
      // An answer of one's own, where there is an "Other": words, never blank.
      const own = (v: unknown) => (field.other === true || field.ownAnswers === true) && typeof v === 'string' && v.trim() !== '' && !allowed.has(v);
      if (field.multiple) {
        if (!Array.isArray(value)) return say('choices');
        const owned = value.filter((v) => !allowed.has(v as string | number)).length;
        // Answers of one's own: one "Other", or as many as people add.
        return (owned <= 1 || field.ownAnswers) && value.every((v) => allowed.has(v as string | number) || own(v)) ? undefined : listing;
      }
      return allowed.has(value as string | number) || own(value) ? undefined : listing;
    }
    case 'many2one':
      return isRecord(value) ? undefined : say('record');
    case 'many2many':
      return Array.isArray(value) && value.every(isRecord) ? undefined : say('records');
    case 'reference': {
      const ref = value as ReferenceValue;
      if (!isRecord(value) || typeof ref.model !== 'string') return say('record');
      if (!field.models.some((m) => m.value === ref.model)) {
        const models = listOr(field.models.map((m) => m.label), messages.or);
        return say('reference', { models, aModels: article(models) });
      }
      return undefined;
    }
    case 'binary':
    case 'image':
      return checkFiles(field, value, say, messages);
    case 'properties':
      return Object.values(checkProperties(field.definitions, value, messages, today))[0];
    default:
      return undefined;
  }
}

/**
 * A properties value checked property by property, each as a field of its
 * kind: text, a whole number, a number, yes or no, a choice, a date. Their
 * problems by property name, in their definitions' order, each naming its
 * property ("Floor must be a whole number"). Nothing is asked of properties
 * with no definitions: each is then worked out from what it holds.
 */
export function checkProperties(definitions: readonly PropertyDefinition[] | undefined, value: Value | undefined, messages: Messages = MESSAGES.en, today?: string): Record<string, string> {
  const problems: Record<string, string> = {};
  if (!definitions || !value || typeof value !== 'object' || Array.isArray(value)) return problems;
  const values = value as Record<string, Value>;
  for (const definition of definitions) {
    const field = { type: definition.type, label: definition.label, ...(definition.options ? { options: definition.options } : {}) } as Field;
    const problem = checkValue(field, values[definition.name], false, messages, today);
    if (problem) problems[definition.name] = problem;
  }
  return problems;
}

/** A matrix: an answer per row, each from the columns; every row answered when required. */
function checkMatrix(
  field: Extract<Field, { type: 'matrix' }>,
  value: Value | undefined,
  required: boolean,
  say: (key: MessageKey, values?: Record<string, string | number>) => string
): string | undefined {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return say('matrix');
  const rows = new Set(field.rows.map((r) => String(r.value)));
  const columns = new Set(field.columns.map((c) => c.value as unknown));
  const listing = say('choice', { options: field.columns.map((c) => c.label).join(', ') });
  for (const [row, answer] of Object.entries(value as Record<string, unknown>)) {
    if (!rows.has(row)) return say('matrixRow', { rows: field.rows.map((r) => r.label).join(', ') });
    const picked = field.multiple && Array.isArray(answer) ? answer : [answer];
    if (!field.multiple && Array.isArray(answer)) return listing;
    if (picked.some((a) => a !== null && a !== undefined && !columns.has(a))) return listing;
  }
  const answered = (row: string) => {
    const a = (value as Record<string, unknown>)[row];
    return a !== null && a !== undefined && !(Array.isArray(a) && !a.length);
  };
  if (required && field.rows.some((r) => !answered(String(r.value)))) return say('matrixRows');
  return undefined;
}

/** A field takes at most `places` decimal places, in its language's words and plural form ("Area takes at most 1 decimal place"). */
export function decimalsWords(label: string, places: number, messages: Messages = MESSAGES.en): string {
  return fillMessage(messages, places === 0 ? messages.integer : messages[decimalsKey(places, messages.locale)], { label, digits: places });
}

const pluralRules = new Map<string, Intl.PluralRules>();

/**
 * The decimals message for `places`, in the plural form the language takes for
 * it: one; two (Arabic's dual); 3 to 10; 11 and more (Arabic's singular after them).
 */
function decimalsKey(places: number, locale: string): 'decimals' | 'decimalsOne' | 'decimalsTwo' | 'decimalsMany' {
  let rules = pluralRules.get(locale);
  if (!rules) {
    try {
      rules = new Intl.PluralRules(locale);
    } catch {
      rules = new Intl.PluralRules('en');
    }
    pluralRules.set(locale, rules);
  }
  const form = rules.select(places);
  return form === 'one' ? 'decimalsOne' : form === 'two' ? 'decimalsTwo' : form === 'many' || (form === 'other' && locale === 'ar') ? 'decimalsMany' : 'decimals';
}

function isRecord(value: unknown): value is RelatedRecord {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    (typeof (value as RelatedRecord).id === 'number' || typeof (value as RelatedRecord).id === 'string') &&
    typeof (value as RelatedRecord).label === 'string'
  );
}

type Say = (key: MessageKey, values?: Record<string, string | number>) => string;

function checkDate(value: Value | undefined, say: Say): string | undefined {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return say('dateFormat');
  const [y, m, d] = value.split('-').map(Number);
  return realDay(y, m, d) ? undefined : say('dateInvalid');
}

const ISO_DATETIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:\d{2})?$/;

function checkDateTime(value: Value | undefined, say: Say): string | undefined {
  const match = typeof value === 'string' ? ISO_DATETIME.exec(value) : null;
  if (!match) return say('datetimeFormat');
  const [y, mo, d, h, mi, s] = match.slice(1).map((part) => Number(part ?? 0));
  return realDay(y, mo, d) && h < 24 && mi < 60 && s < 60 ? undefined : say('datetimeInvalid');
}

/** A day of the calendar people write: its year of four digits (never year 2, which a box half typed once made), a month and a day it has. */
function realDay(year: number, month: number, day: number): boolean {
  if (year < 1000 || month < 1 || month > 12 || day < 1) return false;
  const lengths = [31, year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= lengths[month - 1];
}

type FileField = Extract<Field | LineField, { type: 'binary' | 'image' }>;

/** A file, or several: as few and as many as the field says, then each against the kinds it takes and its largest size — named by its own name when there are several. */
function checkFiles(field: FileField, value: Value | undefined, say: Say, messages: Messages): string | undefined {
  // A lone file where several are taken is a list of one, as a backend may send it.
  const files = field.multiple ? (Array.isArray(value) ? value : [value]) : [value];
  if (field.multiple && field.minFiles !== undefined && files.length < field.minFiles) return say('minFiles', { min: field.minFiles });
  if (field.multiple && field.maxFiles !== undefined && files.length > field.maxFiles) return say('maxFiles', { max: field.maxFiles });
  for (const file of files) {
    if (!isFile(file)) return say('file');
    const problem = fileProblem(field, file, messages, field.multiple ? file.name : field.label || 'This field');
    if (problem) return problem;
  }
  return undefined;
}

/**
 * What is wrong with one file for a file or image field — too large, or not a
 * kind it takes — said with the limit and named by the file's own name; undefined
 * when nothing is. A widget asks before it adds a file, as the check does after.
 */
export function fileProblem(field: FileField, file: { name: string; type: string; size: number }, messages: Messages = MESSAGES.en, label = file.name): string | undefined {
  if (field.maxSize !== undefined && file.size > field.maxSize) return fill(messages.fileSize, { label, size: formatBytes(field.maxSize) });
  const accept = field.type === 'image' ? ['image/*'] : field.accept;
  if (accept && !(file.type ? accepts(accept, file.type) : acceptsByName(accept, file.name))) {
    const types = describeTypes(accept, messages.or);
    return fill(messages.fileType, { label, types, aTypes: article(types) });
  }
  return undefined;
}

function isFile(value: unknown): value is FileValue {
  const file = value as FileValue;
  return value !== null && typeof value === 'object' && typeof file.name === 'string' && typeof file.size === 'number';
}

/** Whether a file of this media type is one of these kinds, such as "application/pdf" or "image/*". */
function accepts(patterns: readonly string[], type: string): boolean {
  return patterns.some((pattern) => (pattern.endsWith('/*') ? type.startsWith(pattern.slice(0, -1)) : pattern === type));
}

/** Office kinds by the extension people know them by, from a word in their media type. */
const EXTENSIONS = 'pdf PDF,msword DOC,wordprocessingml DOCX,opendocument.text ODT,plain TXT,ms-excel XLS,spreadsheetml XLSX,opendocument.spreadsheet ODS,csv CSV,ms-powerpoint PPT,presentationml PPTX,opendocument.presentation ODP'.split(',').map((pair) => pair.split(' '));

/** The extensions a picture's file ends in, as people know them. */
const PICTURES = 'PNG JPG JPEG GIF WEBP AVIF HEIC HEIF BMP TIF TIFF SVG'.split(' ');

/**
 * Whether a file the browser or the system gave no media type (a dropped PDF, on some systems) is one of these kinds,
 * by the extension its name ends in, in any case: "REPORT.PDF" is a PDF, "me.jpg" a picture.
 */
function acceptsByName(patterns: readonly string[], name: string): boolean {
  const extension = /\.([A-Za-z0-9]+)$/.exec(name.trim())?.[1]?.toUpperCase();
  if (!extension) return false;
  return patterns.some((pattern) => (pattern === 'image/*' ? PICTURES.includes(extension) : !pattern.endsWith('/*') && [describeType(pattern), pattern === 'image/jpeg' ? 'JPG' : ''].includes(extension)));
}

function describeType(pattern: string): string {
  if (pattern.endsWith('/*')) return pattern.slice(0, -2);
  const sub = pattern.split('/')[1] ?? pattern;
  return EXTENSIONS.find(([word]) => sub.includes(word))?.[1] ?? sub.toUpperCase();
}

/** The kinds a file field takes, as people say them, each once: "PDF or image", "DOC, DOCX or ODT". */
export function describeTypes(patterns: readonly string[], or: string): string {
  return listOr([...new Set(patterns.map(describeType))], or);
}

function listOr(items: string[], or: string): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} ${or} ${items[items.length - 1]}`;
}

function article(phrase: string): string {
  return /^[aeiou]/i.test(phrase) ? `an ${phrase}` : `a ${phrase}`;
}

/** 1048576 -> "1 MB". */
export function formatBytes(bytes: number): string {
  const units = ['bytes', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit++;
  }
  return `${Number(size.toFixed(1))} ${units[unit]}`;
}
