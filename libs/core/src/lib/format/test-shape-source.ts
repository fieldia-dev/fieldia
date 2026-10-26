import * as z from 'zod';
import { PageSchema } from './page';
import { OPTION_SCHEMAS } from './option-schemas';
import { RULED } from './ruled';
import { RULES, type OptionShape } from './rules';
import { makeSchemasJitless } from './jitless';
import { KEYWORDS, TYPES, type Shape, type ShapeData } from './shape-check';

makeSchemasJitless();

/**
 * Which format each place of the schema came in, as tools/format-since.json keeps it (tools/format-since.mjs reads it
 * from the format's own history): by JSON pointer into page.schema.json, the format each place came in, each value a
 * setting takes, and each limit an older format held otherwise.
 */
export interface FormatSince {
  formats: string[];
  places: Record<string, string>;
  values: Record<string, Record<string, string>>;
  before: Record<string, Record<string, [string, unknown][]>>;
}

/**
 * The format's schema as the viewer's check reads it (shape-check.ts), made from the zod definitions `validatePage`
 * parses with: the page's JSON Schema as page.schema.json is — each place where it is there, so the format each came in
 * (`since`) is written where it belongs (`x-since`, `x-since-values`, `x-before`, by the format's index) — its words
 * left out, each rule named where it runs (`x-rule`) and each pattern's flags (`x-flags`); and beside it the shapes of
 * widgets' options (named `o:…`). page-shape.spec.ts writes it into page-shape.ts and refuses a page-shape.ts that is
 * not this. It refuses, too, a definition the check could not hold the same — a refinement not written as a rule of
 * rules.ts, a string with two patterns — and a place `since` names that the schema has not.
 */
export function pageShapeData(since?: FormatSince): { data: ShapeData; problems: string[] } {
  const problems: string[] = [];
  const override = (context: { zodSchema: unknown; jsonSchema: unknown; path: (string | number)[] }) => {
    const zod = context.zodSchema as unknown as Zod;
    const json = context.jsonSchema as Record<string, unknown>;
    const rule = ruleOf(zod);
    if (rule) json['x-rule'] = rule;
    else if (ownChecks(zod).some((check) => check._zod.def.check === 'custom')) {
      problems.push(`a refinement no rule of rules.ts holds, at ${context.path.join('.') || '(the page)'}: write it as a rule there and refine with ruled(schema, name), so the viewer's check runs it too`);
    }
    const patterns = ownChecks(zod).filter((check) => check._zod.def.format === 'regex');
    if (patterns.length > 1) problems.push(`a string with ${patterns.length} patterns, at ${context.path.join('.')}: the JSON Schema keeps one`);
    const flags = (patterns[0]?._zod.def as { pattern?: RegExp } | undefined)?.pattern?.flags;
    if (flags) json['x-flags'] = flags;
    // An object that takes keys it does not name, as zod takes them (a widget's options): open, as a page is given.
    if (zod._zod.def.type === 'object' && zod._zod.def.catchall === undefined && json['additionalProperties'] === false) delete json['additionalProperties'];
  };
  // The page's as page.schema.json is made (json-schema.ts): its places where that file has them.
  const page = z.toJSONSchema(PageSchema, { target: 'draft-2020-12', override }) as Record<string, unknown>;
  if (since) annotate(page, since, problems);
  const options = z.toJSONSchema(z.strictObject(OPTION_SCHEMAS), { target: 'draft-2020-12', io: 'input', override }) as Record<string, unknown>;
  const own = withoutWords(page) as Record<string, unknown> & { $defs?: Record<string, Shape> };
  // A widget's options' definitions named apart from the page's (`o:…`): two of a name may differ.
  const theirs = JSON.parse(JSON.stringify(withoutWords(options)).replace(/"#\/\$defs\/([^"]+)"/g, '"#/$defs/o:$1"')) as { properties: Record<OptionShape, Shape>; $defs?: Record<string, Shape> };
  const defs: Record<string, Shape> = { ...(own.$defs ?? {}), ...Object.fromEntries(Object.entries(theirs.$defs ?? {}).map(([name, shape]) => [`o:${name}`, shape])) };
  delete own.$defs;
  delete own['$schema'];
  for (const name of Object.keys(RULES)) if (!JSON.stringify([own, defs, theirs.properties]).includes(`"x-rule":"${name}"`)) problems.push(`the rule ${name} of rules.ts runs nowhere in the format`);
  return { data: interned({ page: own, defs, options: theirs.properties }), problems };
}

/** The format each place, each value and each older limit came in, written where it is (by the format's index). */
function annotate(schema: Record<string, unknown>, since: FormatSince, problems: string[]) {
  const index = (format: string) => {
    const i = since.formats.indexOf(format);
    if (i < 0) problems.push(`format-since.json names format ${format}, which FORMAT_VERSIONS does not have`);
    return i;
  };
  const node = (pointer: string): Record<string, unknown> | null => {
    const found = pointer
      .split('/')
      .slice(1)
      .reduce<unknown>((at, key) => (at && typeof at === 'object' ? (at as Record<string, unknown>)[key.replace(/~1/g, '/').replace(/~0/g, '~')] : undefined), schema);
    if (!found || typeof found !== 'object') {
      problems.push(`format-since.json names ${pointer}, which page.schema.json's schema has not: \`node tools/format-since.mjs --write\``);
      return null;
    }
    return found as Record<string, unknown>;
  };
  for (const [pointer, format] of Object.entries(since.places)) {
    const at = node(pointer);
    if (at) at['x-since'] = index(format);
  }
  for (const [pointer, values] of Object.entries(since.values)) {
    const at = node(pointer);
    if (at) at['x-since-values'] = Object.fromEntries(Object.entries(values).map(([value, format]) => [value, index(format)]));
  }
  for (const [pointer, limits] of Object.entries(since.before)) {
    const at = node(pointer);
    if (at) at['x-before'] = Object.fromEntries(Object.entries(limits).map(([limit, held]) => [limit, held.map(([format, was]) => [index(format), was])]));
  }
}

/**
 * The schema with each part it holds more than once written once: a name's pattern, a modifier, a list of rules —
 * made a definition of its own (`_1`, `_2`, …) that each place names by `$ref` — and each set of settings many
 * objects have alike, a set of its own (`x-with`), the largest saving first, until none saves more than a little. The
 * check reads it the same (shape-check.ts); the viewer carries a fraction of it.
 */
function interned(data: ShapeData): ShapeData {
  const all = { page: data.page, defs: { ...data.defs }, options: { ...data.options } } as { page: Shape; defs: Record<string, Shape>; options: Record<string, Shape> };
  /** Each schema a place holds, by where it is: its parent and key, the schema itself. */
  type Place = { parent: Record<string, unknown> | Shape[]; key: string | number; node: Record<string, unknown> };
  const places = (): Place[] => {
    const out: Place[] = [];
    const visit = (parent: Record<string, unknown> | Shape[], key: string | number, node: unknown) => {
      if (!node || typeof node !== 'object' || Array.isArray(node)) return;
      out.push({ parent, key, node: node as Record<string, unknown> });
      within(node as Record<string, unknown>);
    };
    const within = (node: Record<string, unknown>) => {
      for (const [key, value] of Object.entries(node)) {
        if (ONE.has(key)) visit(node, key, value);
        else if (LIST.has(key) && Array.isArray(value)) value.forEach((inner, i) => visit(value as Shape[], i, inner));
        else if (MAP.has(key) && value && typeof value === 'object') for (const [name, inner] of Object.entries(value)) visit(value as Record<string, unknown>, name, inner);
      }
    };
    visit(all as unknown as Record<string, unknown>, 'page', all.page);
    for (const map of [all.defs, all.options] as Record<string, unknown>[]) for (const [name, inner] of Object.entries(map)) {
      if (inner && typeof inner === 'object') within(inner as Record<string, unknown>);
      void name;
    }
    return out;
  };
  for (let made = 1; ; made++) {
    const found = new Map<string, Place[]>();
    for (const place of places()) {
      const text = JSON.stringify(place.node);
      if (text.length < 24) continue;
      const list = found.get(text);
      if (list) list.push(place);
      else found.set(text, [place]);
    }
    let best: [string, Place[]] | null = null;
    let saving = 0;
    for (const [text, list] of found) {
      const saves = (list.length - 1) * (text.length - 18) - 12;
      if (list.length > 1 && saves > saving) [best, saving] = [[text, list], saves];
    }
    if (!best || saving < 40) break;
    const name = `_${made}`;
    all.defs[name] = JSON.parse(best[0]) as Shape;
    for (const { parent, key } of best[1]) (parent as Record<string | number, unknown>)[key] = { $ref: `#/$defs/${name}` };
  }
  // Then the settings many objects have alike — each field kind's label, help, rules — written once as a set of their
  // own (`_w1`, …), each object naming the sets it has (`x-with`) beside its own.
  for (let made = 1; ; made++) {
    // Every object the schema has: those it holds in place, and each definition's own.
    const objects = [...places().map((place) => place.node), ...([...Object.values(all.defs), ...Object.values(all.options)] as Record<string, unknown>[])]
      .filter((node, i, list) => node && typeof node === 'object' && list.indexOf(node) === i)
      .filter((node) => node['properties'] && typeof node['properties'] === 'object');
    const items = objects.map((node) => new Map(Object.entries(node['properties'] as Record<string, unknown>).map(([key, value]) => [`${key}\u0000${JSON.stringify(value)}`, key.length + JSON.stringify(value).length + 4])));
    let best: { keys: string[]; size: number; holders: number[] } | null = null;
    let saving = 0;
    for (let a = 0; a < objects.length; a++) {
      for (let b = a + 1; b < objects.length; b++) {
        const shared = [...items[a].keys()].filter((key) => items[b].has(key));
        if (shared.length < 3) continue;
        const size = shared.reduce((sum, key) => sum + (items[a].get(key) ?? 0), 0);
        const holders = objects.map((_, i) => i).filter((i) => shared.every((key) => items[i].has(key)));
        const saves = (holders.length - 1) * size - holders.length * 14 - 30;
        if (saves > saving) [best, saving] = [{ keys: shared, size, holders }, saves];
      }
    }
    if (!best || saving < 200) break;
    const name = `_w${made}`;
    const first = objects[best.holders[0]]['properties'] as Record<string, unknown>;
    const names = best.keys.map((key) => key.split('\u0000')[0]);
    all.defs[name] = { properties: Object.fromEntries(names.map((key) => [key, first[key]])) } as Shape;
    for (const i of best.holders) {
      const node = objects[i];
      const own = node['properties'] as Record<string, unknown>;
      for (const key of names) delete own[key];
      node['x-with'] = [...((node['x-with'] as string[] | undefined) ?? []), name];
    }
  }
  return all;
}

/** The keywords that say nothing a value is checked by. */
const WORDS = new Set(['description', 'title', 'examples', '$comment', '$schema', 'default']);
/** The keywords that hold a schema, a list of them, or a map of them by name — their names kept, never a word. */
const ONE = new Set(['items', 'not', 'additionalProperties', 'propertyNames', 'contains', 'if', 'then', 'else']);
const LIST = new Set(['anyOf', 'oneOf', 'allOf', 'prefixItems']);
const MAP = new Set(['properties', '$defs', 'dependentSchemas', 'patternProperties']);

/** A schema with its words left out, keyword by keyword: a property named `title` or `default` stays, as `const` and `enum` values do. */
function withoutWords(shape: unknown): unknown {
  if (shape === null || typeof shape !== 'object' || Array.isArray(shape)) return shape;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(shape as Record<string, unknown>)) {
    if (WORDS.has(key)) continue;
    if (ONE.has(key)) out[key] = withoutWords(value);
    else if (LIST.has(key) && Array.isArray(value)) out[key] = value.map(withoutWords);
    else if (MAP.has(key) && value && typeof value === 'object') out[key] = Object.fromEntries(Object.entries(value).map(([name, inner]) => [name, withoutWords(inner)]));
    else out[key] = value;
  }
  return out;
}

type ZodCheck = { _zod: { def: { check?: string; format?: string } } };
type Zod = { _zod: { def: { checks?: ZodCheck[]; type?: string; catchall?: unknown }; parent?: Zod } };

/** The rule a schema was ruled with, by itself or by the schema it was made from (`.meta()` makes one). */
function ruleOf(zod: Zod): string | undefined {
  for (let at: Zod | undefined = zod; at; at = at._zod.parent) {
    const rule = RULED.get(at);
    if (rule) return rule;
  }
  return undefined;
}

/** The checks a schema holds itself. */
const ownChecks = (zod: Zod): ZodCheck[] => zod._zod.def.checks ?? [];

const isObject = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);

/** The format's schema written short, as page-shape.ts holds it (`readShape` reads it back). */
export function writeShape(data: ShapeData): string {
  const short = Object.fromEntries(Object.entries(KEYWORDS).map(([key, word]) => [word, key]));
  const letter = Object.fromEntries(Object.entries(TYPES).map(([key, type]) => [type, key]));
  const SCHEMA = new Set(['items', 'not', 'additionalProperties', 'propertyNames']);
  const LISTS = new Set(['anyOf', 'oneOf', 'prefixItems']);
  const MAPS = new Set(['properties', 'dependentSchemas']);
  const write = (node: unknown): unknown => {
    if (!isObject(node)) return node;
    const out: Record<string, unknown> = {};
    for (const [word, inner] of Object.entries(node)) {
      const key = short[word] ?? word;
      if (word === '$ref') out[key] = (inner as string).replace('#/$defs/', '');
      else if (word === 'type') out[key] = Array.isArray(inner) ? inner.map((one) => letter[one as string]) : letter[inner as string];
      else if (SCHEMA.has(word)) out[key] = write(inner);
      else if (LISTS.has(word)) out[key] = (inner as unknown[]).map(write);
      else if (MAPS.has(word)) out[key] = Object.fromEntries(Object.entries(inner as Record<string, unknown>).map(([name, one]) => [name, write(one)]));
      else out[key] = inner;
    }
    return out;
  };
  const map = (shapes: { readonly [name: string]: Shape }) => Object.fromEntries(Object.entries(shapes).map(([name, one]) => [name, write(one)]));
  return JSON.stringify({ page: write(data.page), defs: map(data.defs), options: map(data.options) });
}
