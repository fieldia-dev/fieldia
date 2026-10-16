import { foldForSearch } from './input-rules';
import type { DuplicateMatch, DuplicatesRequest, DuplicatesResult } from './data-source';
import type { MemoryDataSourceOptions } from './memory-data-source';
import type { RelatedRecord, Values } from './values';

/**
 * How a memory source answers `duplicates` (its `duplicates` option), for demos and tests: each stored record of the
 * model but the one typed, alike in a field asked when it holds the same — a phone, an email, an id as people write
 * them apart ("+20 2 2345-6789" is "+20223456789", an email in any case, "123-456-789" is "123 456 789"), a link by its
 * record — or, in its name field, a name close enough (`nameLikeness`, 0.8 or more). The likest first, then those
 * alike in more fields. Outside the one-tag script, as `scheduleSlots` is.
 *
 *   createMemoryDataSource({ records, duplicates: alikeRecords() })
 */
export function alikeRecords(how: { names?: Record<string, string> } = {}): NonNullable<MemoryDataSourceOptions['duplicates']> {
  return (request: DuplicatesRequest, records: Readonly<Record<string, Record<string, Values>>>): DuplicatesResult => {
    const named = how.names?.[request.model] ?? 'name';
    const matches: DuplicateMatch[] = [];
    for (const [key, values] of Object.entries(records[request.model] ?? {})) {
      if (request.recordId !== null && String(request.recordId) === key) continue;
      const alike = request.fields
        .map((field) => [field, field === named ? nameLikeness(request.values[field], values[field]) : sameValue(request.values[field], values[field]) ? 1 : 0] as const)
        .filter(([, likeness]) => likeness >= NAME_LIKE);
      if (!alike.length) continue;
      const id = Number.isFinite(Number(key)) ? Number(key) : key;
      const name = values[named];
      matches.push({ id, name: typeof name === 'string' ? name : key, why: alike.map(([field]) => field), score: Math.max(...alike.map(([, likeness]) => likeness)) });
    }
    return { matches: matches.sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || b.why.length - a.why.length) };
  };
}

/** How alike two names must be to be a possible duplicate's (`nameLikeness`). */
const NAME_LIKE = 0.8;

/** A link: a record's id and its name. */
const isLink = (value: unknown): value is RelatedRecord => !!value && typeof value === 'object' && !Array.isArray(value) && 'id' in value && 'label' in value;

/** Words as records are compared by them: an email in any case; anything else folded, its spaces and marks — ( ) - . / — gone ("+20 2 2345-6789" is "+20223456789"). */
const comparedText = (text: string) => (text.includes('@') ? text.trim().toLowerCase() : foldForSearch(text).replace(/[\s()./-]+/g, ''));

/** Whether two values are the same as people write them apart: a link by its record, words as `comparedText`, numbers by their value. Nothing is the same as nothing. */
function sameValue(a: unknown, b: unknown): boolean {
  if (a === null || a === undefined || a === '' || b === null || b === undefined || b === '') return false;
  if (isLink(a) || isLink(b)) return isLink(a) && isLink(b) && String(a.id) === String(b.id);
  if (typeof a === 'string' && typeof b === 'string') return comparedText(a) !== '' && comparedText(a) === comparedText(b);
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * How alike two names are, from 0 to 1: 1 the same as people write it (any case, marks, spaces); 0.9 when every word
 * of the shorter one, two or more, is in the longer ("Nile Traders", "Nile Traders Co."); else how many of their
 * pairs of letters they share (Dice's coefficient: "Nile Trader", "Nile Traders" are 0.95).
 */
export function nameLikeness(a: unknown, b: unknown): number {
  if (typeof a !== 'string' || typeof b !== 'string') return 0;
  const words = (text: string) => foldForSearch(text).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const [x, y] = [words(a), words(b)];
  if (!x.length || !y.length) return 0;
  if (x.join(' ') === y.join(' ')) return 1;
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  if (short.length > 1 && short.every((word) => long.includes(word))) return 0.9;
  const pairs = (text: string) => Array.from({ length: Math.max(0, text.length - 1) }, (_, at) => text.slice(at, at + 2));
  const [p, q] = [pairs(x.join('')), pairs(y.join(''))];
  const left = [...q];
  const shared = p.filter((pair) => {
    const at = left.indexOf(pair);
    if (at >= 0) left.splice(at, 1);
    return at >= 0;
  }).length;
  return p.length + q.length ? (2 * shared) / (p.length + q.length) : 0;
}
