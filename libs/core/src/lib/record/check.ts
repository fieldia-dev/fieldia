import type { Field, LineField } from '../format/field';
import { isEmpty, type FileValue, type ReferenceValue, type RelatedRecord, type Value } from './values';

/**
 * Check one value against its field. Returns the message to show, or
 * undefined when the value is fine. The wording follows the React engine's
 * ("Name is required", "Maximum 120 characters allowed").
 *
 * An empty optional value passes everything: a pattern or a minimum applies
 * to what someone typed, not to a field they left alone.
 */
export function checkValue(field: Field | LineField, value: Value | undefined, required: boolean): string | undefined {
  const label = field.label || 'This field';
  if (isEmpty(field, value)) return required ? `${label} is required` : undefined;

  switch (field.type) {
    case 'char':
    case 'text':
    case 'html': {
      if (typeof value !== 'string') return `${label} must be text`;
      if ((field.type === 'char' || field.type === 'text') && field.size !== undefined && value.length > field.size) {
        return `Maximum ${field.size} characters allowed`;
      }
      if (field.type === 'char' && field.pattern !== undefined && !new RegExp(field.pattern).test(value)) {
        return `${label} is not in the expected format`;
      }
      return undefined;
    }
    case 'integer':
    case 'float':
    case 'monetary': {
      if (typeof value !== 'number' || !Number.isFinite(value)) return `${label} must be a number`;
      if (field.type === 'integer' && !Number.isInteger(value)) return `${label} must be a whole number`;
      if (field.min !== undefined && value < field.min) return `${label} must be at least ${field.min}`;
      if (field.max !== undefined && value > field.max) return `${label} must be at most ${field.max}`;
      if (field.type !== 'integer' && field.digits && decimals(value) > field.digits[1]) {
        return `Maximum ${field.digits[1]} decimal places allowed`;
      }
      return undefined;
    }
    case 'boolean':
      return typeof value === 'boolean' ? undefined : `${label} must be yes or no`;
    case 'date':
      return checkDate(value);
    case 'datetime':
      return checkDateTime(value);
    case 'selection': {
      const allowed = new Set(field.options.map((o) => o.value));
      const listing = `Must be one of: ${field.options.map((o) => o.label).join(', ')}`;
      if (field.multiple) {
        if (!Array.isArray(value)) return `${label} must be a list of choices`;
        return value.every((v) => allowed.has(v as string | number)) ? undefined : listing;
      }
      return allowed.has(value as string | number) ? undefined : listing;
    }
    case 'many2one':
      return isRecord(value) ? undefined : `${label} must be a record`;
    case 'many2many':
      return Array.isArray(value) && value.every(isRecord) ? undefined : `${label} must be a list of records`;
    case 'reference': {
      const ref = value as ReferenceValue;
      if (!isRecord(value) || typeof ref.model !== 'string') return `${label} must be a record`;
      if (!field.models.some((m) => m.value === ref.model)) {
        return `${label} must point to ${article(field.models.map((m) => m.label).join(' or '))}`;
      }
      return undefined;
    }
    case 'binary':
    case 'image':
      return checkFile(field, label, value);
    default:
      return undefined;
  }
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

function checkDate(value: Value | undefined): string | undefined {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'Invalid date format (expected YYYY-MM-DD)';
  const [y, m, d] = value.split('-').map(Number);
  return realDay(y, m, d) ? undefined : 'Invalid date (check month/day values)';
}

const ISO_DATETIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:\d{2})?$/;

function checkDateTime(value: Value | undefined): string | undefined {
  const match = typeof value === 'string' ? ISO_DATETIME.exec(value) : null;
  if (!match) return 'Invalid date and time format (expected YYYY-MM-DDTHH:MM:SS)';
  const [y, mo, d, h, mi, s] = match.slice(1).map((part) => Number(part ?? 0));
  return realDay(y, mo, d) && h < 24 && mi < 60 && s < 60 ? undefined : 'Invalid date and time (check the values)';
}

function realDay(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1) return false;
  const lengths = [31, year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= lengths[month - 1];
}

function checkFile(field: Field | LineField, label: string, value: Value | undefined): string | undefined {
  const file = value as FileValue;
  if (!isFile(value)) return `${label} must be a file`;
  if ('maxSize' in field && field.maxSize !== undefined && file.size > field.maxSize) {
    return `${label} is larger than ${formatBytes(field.maxSize)}`;
  }
  if (field.type === 'binary' && field.accept && !field.accept.some((pattern) => matchesType(pattern, file.type))) {
    return `${label} must be ${article(listOr(field.accept.map(describeType)))} file`;
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

function listOr(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} or ${items[items.length - 1]}`;
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
