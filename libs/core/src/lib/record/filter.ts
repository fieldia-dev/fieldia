import type { JsonValue } from '../format/json';
import type { ResolvedFilter, ResolvedFilterCondition } from './data-source';
import type { RelatedRecord, Values } from './values';

/**
 * Whether a record passes a filter, the way a search should judge it: every
 * item of the list holds, an `any` group when one of its items holds, an `all`
 * group when each does. The memory data source searches with it; an app may too.
 */
export function matchesFilter(values: Values, filter: readonly ResolvedFilter[]): boolean {
  return filter.every((item) => holds(values, item));
}

function holds(values: Values, item: ResolvedFilter): boolean {
  if ('any' in item) return item.any.some((inner) => holds(values, inner));
  if ('all' in item) return item.all.every((inner) => holds(values, inner));
  return meets(values, item);
}

/** Empty is not set: no value, empty text, an empty list. */
function isSet(value: unknown): boolean {
  return value !== null && value !== undefined && value !== '' && value !== false && !(Array.isArray(value) && !value.length);
}

function meets(values: Values, condition: ResolvedFilterCondition): boolean {
  const raw = values[condition.field];
  // A link compares by its id.
  const actual = raw !== null && typeof raw === 'object' && !Array.isArray(raw) && 'id' in raw ? (raw as RelatedRecord).id : (raw as JsonValue | undefined);
  const expected = condition.value;
  // Text is looked for in a link's name, as a search by name does.
  const text = raw !== null && typeof raw === 'object' && !Array.isArray(raw) && 'label' in raw ? String((raw as RelatedRecord).label) : String(actual ?? '');
  switch (condition.op) {
    case '=':
      return actual === expected;
    case '!=':
      return actual !== expected;
    case '<':
      return isSet(actual) && (actual as number) < (expected as number);
    case '>':
      return isSet(actual) && (actual as number) > (expected as number);
    case '<=':
      return isSet(actual) && (actual as number) <= (expected as number);
    case '>=':
      return isSet(actual) && (actual as number) >= (expected as number);
    case 'in':
      return Array.isArray(expected) && expected.includes(actual as JsonValue);
    case 'not in':
      return Array.isArray(expected) && !expected.includes(actual as JsonValue);
    case 'like':
      return text.includes(String(expected));
    case 'ilike':
      return text.toLowerCase().includes(String(expected).toLowerCase());
    case 'startswith':
      return text.toLowerCase().startsWith(String(expected).toLowerCase());
    case 'endswith':
      return text.toLowerCase().endsWith(String(expected).toLowerCase());
    case 'set':
      return isSet(raw);
    case 'notset':
      return !isSet(raw);
    case 'between': {
      if (!isSet(actual) || !Array.isArray(expected)) return false;
      const [low, high] = expected as (number | string)[];
      return (actual as number | string) >= low && (actual as number | string) <= high;
    }
  }
}
