import { pageJsonSchema } from './json-schema';
import type { Page } from './page';
import { translatePage } from './translate';

/**
 * Each word of a page a person reads, with where it is, in the order the one list of a page's words reads them: found
 * by `translatePage` itself — each word given a mark of its own, then the page searched for the marks.
 */
export function wordsAt(page: Page): { path: string; words: string }[] {
  const said: string[] = [];
  const marked = translatePage(page, (words) => `\ue000${said.push(words) - 1}\ue001`);
  const found: { n: number; path: string; words: string }[] = [];
  const visit = (value: unknown, path: string) => {
    if (typeof value === 'string') {
      const mark = /^\ue000(\d+)\ue001$/.exec(value);
      if (mark) found.push({ n: Number(mark[1]), path, words: said[Number(mark[1])] });
    } else if (Array.isArray(value)) value.forEach((item, i) => visit(item, `${path}[${i}]`));
    else if (value !== null && typeof value === 'object') for (const [key, inner] of Object.entries(value)) visit(inner, path ? `${path}.${key}` : key);
  };
  visit(marked, '');
  return found.sort((a, b) => a.n - b.n).map(({ path, words }) => ({ path, words }));
}

/**
 * The places a page holds words a person reads, by kind: `x>Field:char.label` (a field's label, of a char),
 * `children>SectionNode:section.title`, `menu>MenuItem.confirm`, … — found in the format's JSON Schema with the one list
 * of a page's words (`wordsAt`, the one `literalPage` and `translatePage` go through), and the same names for the words a
 * given page holds. What the gate of literal words (literal-words.spec.ts in @fieldia/viewer) holds to: a page built to
 * hold every place, each place's words shown exactly as written. A words key added to the format is a new place: the
 * gate fails until a page holds it, drawn.
 */

// A JSON Schema, read as JSON is: any key, any value.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Schema = Record<string, any>;
type Step = string | number;

/**
 * Places drawn by one piece of code wherever they come, named once: a step's toast whatever moment or press runs it;
 * a column's header whatever the kind of its field (a table of lines', a list of links'); the fields beside a record's
 * title on any of its sides; a plural's every form, each said by one rule.
 */
const SAME: [RegExp, string][] = [
  [/^\w+>ActionStep\./, 'ActionStep.'],
  [/^x>(LineField|InnerLineField|LinkedField):\w+\./, '$1.'],
  [/^(above|after|before|below)>/, 'beside-title>'],
  [/>PluralWords\.\w+$/, '>PluralWords.*'],
  [/__schema1/, 'FieldNode'],
  // A table's buttons — on its rows, on the rows picked, under it — wherever its field stands.
  [/^[\w-]+>FieldNode\.(controlButtons|rowButtons|selectedButtons)/, 'FieldNode.$1'],
];
const named = (slot: string) => SAME.reduce((name, [from, to]) => name.replace(from, to), slot);

/** The JSON Schema and its definitions, each object of it known by a number of its own. */
function schema() {
  const root: Schema = pageJsonSchema();
  const defs: Record<string, Schema> = root['$defs'] ?? {};
  return { root, defs };
}

/** A schema with its references followed: what it is, and the definition it came from (by the key that refers to it). */
function follow(defs: Record<string, Schema>, root: Schema, given: Schema, owner: string, via: string) {
  let at = given;
  let fresh = false;
  while (at?.['$ref']) {
    const ref: string = at['$ref'];
    const name = ref.split('/').pop() ?? '';
    owner = ref === '#' ? 'Page' : `${via}>${name}`;
    at = ref === '#' ? root : defs[name];
    fresh = true;
  }
  return { at, owner, fresh };
}

const branches = (at: Schema): Schema[] => [...(at['anyOf'] ?? []), ...(at['oneOf'] ?? [])];

/** Its kind's name, where it is one of a union told apart by `type`: `section`, `char`, `button`. */
const kind = (at: Schema): string | undefined => ((at['required'] ?? []).includes('type') ? at['properties']?.['type']?.['const'] : undefined);

/** A place's name: its definition, its kind, where in it, the key. */
const place = (owner: string, rel: string, at: Schema, key: string) => {
  const typed = kind(at);
  return named(typed ? `${owner}${rel ? `.${rel}` : ''}:${typed}.${key}` : `${owner}${rel ? `.${rel}` : ''}.${key}`);
};
const within = (rel: string, at: Schema, key: string) => (kind(at) ? key : rel ? `${rel}.${key}` : key);

/** Every place the format has for words a person reads. */
export function schemaPlaces(): Set<string> {
  const { root, defs } = schema();
  const places = new Set<string>();
  const seen = new Map<Schema, Set<string>>();
  const holds = (given: Schema, type: string, owner: string): boolean => {
    const { at } = follow(defs, root, given, owner, '');
    if (!at) return false;
    if (at['type'] === type && (type !== 'string' || (at['const'] === undefined && !at['enum']))) return true;
    return branches(at).some((branch) => holds(branch, type, owner));
  };
  const visit = (given: Schema, keys: Step[], owner: string, rel: string) => {
    const via = String(keys.filter((key) => typeof key === 'string').pop() ?? '');
    const followed = follow(defs, root, given, owner, via);
    const at = followed.at;
    if (!at) return;
    if (followed.fresh) {
      owner = followed.owner;
      rel = '';
    }
    // Each object of the schema once for each place it is reached as: the layout's nodes hold themselves.
    const as = `${owner}|${rel}|${keys.filter((key) => typeof key === 'string').join('.').length > 0 ? via : ''}`;
    const had = seen.get(at) ?? new Set<string>();
    if (had.has(as) || keys.length > 60) return;
    had.add(as);
    seen.set(at, had);
    for (const branch of branches(at)) visit(branch, keys, owner, rel);
    if (at['type'] === 'array' && at['items']) visit(at['items'], [...keys, 0], owner, `${rel}[]`);
    if (at['type'] !== 'object') return;
    const props: Record<string, Schema> = { ...(at['properties'] ?? {}) };
    const map = at['additionalProperties'] && typeof at['additionalProperties'] === 'object' ? at['additionalProperties'] : null;
    // Which of its strings are words: the one list's answer, for an object holding words in each of them, here.
    const leaf: Record<string, string> = Object.fromEntries(Object.entries(props).filter(([key, inner]) => key !== 'type' && holds(inner, 'string', owner)).map(([key]) => [key, 'w']));
    // A map of words by a name of its own (a list's filters' names): any key.
    if (map && holds(map, 'string', owner)) leaf['x'] = 'w';
    const prefix = keys.map((key) => (typeof key === 'number' ? `[${key}]` : `.${key}`)).join('').replace(/^\./, '');
    const nested = keys.reduceRight<unknown>((inner, key) => (typeof key === 'number' ? [inner] : { [key]: inner }), leaf);
    for (const found of wordsAt(nested as never)) {
      const key = found.path.slice(prefix ? prefix.length + 1 : 0);
      if (key in leaf) places.add(place(owner, rel, at, key === 'x' && !(key in props) ? '*' : key));
    }
    for (const [key, inner] of Object.entries(props)) visit(inner, [...keys, key], owner, within(rel, at, key));
    if (map) visit(map, [...keys, 'x'], owner, within(rel, at, '*'));
  };
  visit(root, [], 'Page', '');
  return places;
}

/** The places a page's words are in, each with where the page holds it (its first). */
export function pagePlaces(page: unknown): Map<string, string> {
  const places = new Map<string, string>();
  for (const [path, slot] of placesOfWords(page)) if (!places.has(slot)) places.set(slot, path);
  return places;
}

/** Each of a page's words, by where it is, with its place. */
export function placesOfWords(page: unknown): Map<string, string> {
  const { root, defs } = schema();
  const words = new Set(wordsAt(page as never).map((at) => at.path));
  const found = new Map<string, string>();
  const visit = (value: unknown, given: Schema, path: string, via: string, owner: string, rel: string) => {
    const followed = follow(defs, root, given, owner, via);
    const at = followed.at;
    if (!at) return;
    if (followed.fresh) {
      owner = followed.owner;
      rel = '';
    }
    // A union of shapes; an object's own `anyOf` only adds rules to its properties.
    const options = at['properties'] ? [] : branches(at);
    if (options.length) {
      // A union: the kind the value names, else each branch its shape may be.
      const type = value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>)['type'] : undefined;
      const own = options.filter((branch) => kind(follow(defs, root, branch, owner, via).at ?? {}) === type);
      for (const branch of own.length ? own : options) visit(value, branch, path, via, owner, rel);
      return;
    }
    if (Array.isArray(value)) {
      if (at['items']) value.forEach((item, i) => visit(item, at['items'], `${path}[${i}]`, via, owner, `${rel}[]`));
      return;
    }
    if (value === null || typeof value !== 'object' || at['type'] !== 'object') return;
    for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
      const own = at['properties']?.[key];
      const schemaOf = own ?? (at['additionalProperties'] && typeof at['additionalProperties'] === 'object' ? at['additionalProperties'] : undefined);
      const where = path ? `${path}.${key}` : key;
      if (!schemaOf) continue;
      // A widget's settings are a map of any value: its words are named by their own key.
      const name = own ? key : rel.endsWith('options') || /options$/.test(path) ? key : '*';
      if (typeof inner === 'string' && words.has(where)) {
        found.set(where, place(owner, rel, at, name));
      } else visit(inner, schemaOf, where, own ? key : 'x', owner, within(rel, at, name));
    }
  };
  visit(page, root, '', '', 'Page', '');
  return found;
}
