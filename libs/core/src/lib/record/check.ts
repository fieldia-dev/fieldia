import type { Field, LineField } from '../format/field';
import { checkDay } from './limits';
import { fill, MESSAGES, type Messages } from './messages';
import { isEmpty, type FileValue, type ReferenceValue, type RelatedRecord, type Value } from './values';

/**
 * Check one value against its field. Returns the message to show, or
 * undefined when the value is fine. The wording follows the React engine's
 * ("Name is required", "Maximum 120 characters allowed").
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
  today?: string
): string | undefined {
  const label = field.label || 'This field';
  const say = (key: keyof Messages, values: Record<string, string | number> = {}) => fill(messages[key], { label, ...values });
  if (isEmpty(field, value)) return required ? say('required') : undefined;
  if (field.type === 'matrix') return checkMatrix(field, value, required, say);

  switch (field.type) {
    case 'char':
    case 'text':
    case 'html': {
      if (typeof value !== 'string') return say('text');
      if ((field.type === 'char' || field.type === 'text') && field.size !== undefined && value.length > field.size) {
        return say('maxLength', { max: field.size });
      }
      if (field.type === 'char' && field.pattern !== undefined && !new RegExp(field.pattern).test(value)) {
        return say('pattern');
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
      if (field.type !== 'integer' && field.digits && decimals(value) > field.digits[1]) {
        return say('decimals', { digits: field.digits[1] });
      }
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
      const own = (v: unknown) => field.other === true && typeof v === 'string' && v.trim() !== '' && !allowed.has(v);
      if (field.multiple) {
        if (!Array.isArray(value)) return say('choices');
        const owned = value.filter((v) => !allowed.has(v as string | number)).length;
        return owned <= 1 && value.every((v) => allowed.has(v as string | number) || own(v)) ? undefined : listing;
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
      return checkFile(field, value, say, messages);
    default:
      return undefined;
  }
}

/** A matrix: an answer per row, each from the columns; every row answered when required. */
function checkMatrix(
  field: Extract<Field, { type: 'matrix' }>,
  value: Value | undefined,
  required: boolean,
  say: (key: keyof Messages, values?: Record<string, string | number>) => string
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

function decimals(value: number): number {
  const text = String(value);
  if (text.includes('e-')) return Number(text.split('e-')[1]);
  const dot = text.indexOf('.');
  return dot === -1 ? 0 : text.length - dot - 1;
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

type Say = (key: keyof Messages, values?: Record<string, string | number>) => string;

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

function realDay(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1) return false;
  const lengths = [31, year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= lengths[month - 1];
}

function checkFile(field: Field | LineField, value: Value | undefined, say: Say, messages: Messages): string | undefined {
  const file = value as FileValue;
  if (!isFile(value)) return say('file');
  if ('maxSize' in field && field.maxSize !== undefined && file.size > field.maxSize) {
    return say('fileSize', { size: formatBytes(field.maxSize) });
  }
  if (field.type === 'binary' && field.accept && !field.accept.some((pattern) => matchesType(pattern, file.type))) {
    const types = listOr(field.accept.map(describeType), messages.or);
    return say('fileType', { types, aTypes: article(types) });
  }
  return undefined;
}

function isFile(value: unknown): value is FileValue {
  const file = value as FileValue;
  return value !== null && typeof value === 'object' && typeof file.name === 'string' && typeof file.size === 'number';
}

function matchesType(pattern: string, type: string): boolean {
  return pattern.endsWith('/*') ? type.startsWith(pattern.slice(0, -1)) : pattern === type;
}

function describeType(pattern: string): string {
  if (pattern.endsWith('/*')) return pattern.slice(0, -2);
  if (pattern === 'application/pdf') return 'PDF';
  return (pattern.split('/')[1] ?? pattern).toUpperCase();
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
