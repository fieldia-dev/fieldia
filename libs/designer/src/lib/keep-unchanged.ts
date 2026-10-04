/**
 * The page an edit made, with every part the edit left as it was taken from
 * the page before: equal parts keep their identity, so the views can skip
 * what did not change by comparing objects, and the pages kept for undo share
 * what they have in common. The result is equal to `next`, its keys in
 * `next`'s order; `before` itself when nothing changed.
 *
 * Parts of a list are matched by their id when they have one — a field put in
 * before others leaves the others as they were — and by place otherwise.
 * Pages are JSON, so plain objects, arrays and plain values are all it meets.
 */
export function keepUnchanged<T>(before: unknown, next: T): T {
  return keep(before, next) as T;
}

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json => typeof value === 'object' && value !== null && !Array.isArray(value);
const idOf = (value: unknown) => (isObject(value) && typeof value['id'] === 'string' ? value['id'] : undefined);

function keep(before: unknown, next: unknown): unknown {
  if (before === next) return before;
  if (Array.isArray(next)) return Array.isArray(before) ? keepList(before, next) : next;
  if (isObject(next)) return isObject(before) ? keepObject(before, next) : next;
  return next;
}

function keepList(before: unknown[], next: unknown[]): unknown[] {
  // By id, when every part has one of its own.
  let byId: Map<string, unknown> | null = new Map();
  for (const item of before) {
    const id = idOf(item);
    if (id === undefined || byId.has(id)) {
      byId = null;
      break;
    }
    byId.set(id, item);
  }
  let same = before.length === next.length;
  const out = next.map((item, i) => {
    const id = idOf(item);
    const was = byId ? (id === undefined ? undefined : byId.get(id)) : before[i];
    const kept = keep(was, item);
    if (kept !== before[i]) same = false;
    return kept;
  });
  return same ? before : out;
}

function keepObject(before: Json, next: Json): Json {
  const keys = Object.keys(next);
  const beforeKeys = Object.keys(before);
  // Made only once something differs: most of a page is as it was.
  let out: Json | null = keys.length === beforeKeys.length ? null : {};
  keys.forEach((key, i) => {
    const kept = keep(before[key], next[key]);
    if (!out && (beforeKeys[i] !== key || kept !== before[key])) {
      out = {};
      for (const earlier of keys.slice(0, i)) out[earlier] = before[earlier];
    }
    if (out) out[key] = kept;
  });
  return out ?? before;
}
