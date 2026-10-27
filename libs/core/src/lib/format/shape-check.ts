import type { PageIssue } from './references';
import { RULES, type RuleContext, type RuleName } from './rules';

/**
 * A page's shape checked without the validation library: the format's own schema — the JSON Schema `validatePage`'s
 * zod definitions make, its words left out (`PAGE_SHAPE`, page-shape.ts, generated from them and held to them by
 * page-shape.spec.ts) — read here, with the format's rules a schema cannot say (rules.ts, the very functions the zod
 * definitions run). So the viewer refuses what `validatePage` refuses, by one check: shape-parity.spec.ts holds the two
 * to the same verdict on every example page and thousands of mistakes made in them.
 *
 * The JSON Schema it reads is the part of draft 2020-12 the definitions make: `$ref`, `type`, `const`, `enum`, `not`,
 * `anyOf` and `oneOf`, an object's `properties`, `required`, `additionalProperties`, `propertyNames` and
 * `dependentSchemas`, an array's `items`, `prefixItems`, `minItems`, `maxItems` and `uniqueItems`, a string's
 * `minLength`, `maxLength` and `pattern` (with `x-flags`, a pattern's flags), a number's bounds; `x-rule`, a rule of
 * rules.ts run on a value whose shape held; and `x-with`, the sets of settings an object has beside its own, each a
 * definition written once (test-shape-source.ts).
 */

/** A node of the schema: an object of keywords, or `true` (anything) or `false` (nothing). */
export type Shape = { readonly [keyword: string]: unknown } | boolean;
/** The format's schema as the check reads it: the page's, its definitions, and the shapes of widgets' own options. */
export interface ShapeData {
  readonly page: Shape;
  readonly defs: { readonly [name: string]: Shape };
  /** The shapes a rule checks a part against by name (`RuleContext.check`): a widget's own options. */
  readonly options: { readonly [name: string]: Shape };
}

type Path = readonly (string | number)[];
interface Found {
  path: Path;
  message: string;
}

const isObject = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const has = (record: object, key: string) => Object.prototype.hasOwnProperty.call(record, key);
/** A value's kind as zod names it in its messages. */
const kindOf = (value: unknown) => (value === null ? 'null' : Array.isArray(value) ? 'array' : value === undefined ? 'undefined' : typeof value);

/** Two JSON values the same, as `const`, `enum` and `uniqueItems` compare them. */
function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a)) return Array.isArray(b) && a.length === b.length && a.every((x, i) => same(x, b[i]));
  if (isObject(a) && isObject(b)) {
    const keys = Object.keys(a);
    return keys.length === Object.keys(b).length && keys.every((key) => has(b, key) && same(a[key], b[key]));
  }
  return false;
}

/** Whether a value is of a JSON Schema type. */
function ofType(type: string, value: unknown): boolean {
  switch (type) {
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'integer':
      return typeof value === 'number' && Number.isInteger(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'null':
      return value === null;
    case 'array':
      return Array.isArray(value);
    case 'object':
      return isObject(value);
    default:
      return false;
  }
}

/**
 * The schema's keywords as page-shape.ts writes them, short, each after a `~` no setting of the format begins with —
 * so a setting's name is never read as one — and a `$ref` by its definition's name, a type by its letter.
 */
export const KEYWORDS: Record<string, string> = {
  '~t': 'type',
  '~p': 'properties',
  '~r': 'required',
  '~a': 'additionalProperties',
  '~$': '$ref',
  '~e': 'enum',
  '~c': 'const',
  '~i': 'items',
  '~u': 'anyOf',
  '~o': 'oneOf',
  '~n': 'not',
  '~k': 'propertyNames',
  '~d': 'dependentSchemas',
  '~x': 'prefixItems',
  '~P': 'pattern',
  '~m': 'minimum',
  '~M': 'maximum',
  '~l': 'minLength',
  '~L': 'maxLength',
  '~j': 'minItems',
  '~J': 'maxItems',
  '~g': 'exclusiveMinimum',
  '~G': 'exclusiveMaximum',
  '~q': 'uniqueItems',
  '~w': 'x-with',
  '~R': 'x-rule',
  '~F': 'x-flags',
  '~s': 'x-since',
  '~S': 'x-since-values',
  '~b': 'x-before',
};
export const TYPES: Record<string, string> = { s: 'string', n: 'number', i: 'integer', b: 'boolean', o: 'object', a: 'array', z: 'null' };

/** The format's schema as page-shape.ts writes it, read back: its keywords and types written out (`KEYWORDS`). */
export function readShape(text: string): ShapeData {
  return JSON.parse(text, (_, value: unknown) => {
    if (!isObject(value)) return value;
    if (!Object.keys(value).some((key) => key.startsWith('~'))) return value;
    const out: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value)) {
      const word = KEYWORDS[key] ?? key;
      out[word] = word === '$ref' ? `#/$defs/${inner as string}` : word === 'type' ? (Array.isArray(inner) ? inner.map((one) => TYPES[one as string]) : TYPES[inner as string]) : inner;
    }
    return out;
  }) as ShapeData;
}

/** The path as `validatePage` writes it: `layout.children[0].field`, `(page)` for the page itself. */
export function pathWords(path: Path): string {
  if (!path.length) return '(page)';
  return path.map((segment, i) => (typeof segment === 'number' ? `[${segment}]` : i === 0 ? segment : `.${segment}`)).join('');
}

/** What a place says beside its schema: the format it, its values and its older limits came in. */
const NOTES = new Set(['x-since', 'x-since-values', 'x-before']);
/** Each pattern made once, by its flags and source. */
const PATTERNS = new Map<string, RegExp>();
/** Each union's discriminator found once, by its branches. */
const KEYS = new WeakMap<object, string | null>();
/** Each object's settings with the sets it names (`x-with`), gathered once. */
const SETTINGS = new WeakMap<object, Record<string, Shape>>();

/** The check of one value against the format's schema, its problems kept as they are found. */
class ShapeCheck {
  private readonly patterns = PATTERNS;
  private readonly keys = KEYS;
  /**
   * The newest format a part of the value checked so far came in, by its index (`x-since`), and where: the lowest
   * format the value needs. -1 while it needs none past the first.
   */
  need = -1;
  needAt: Path = [];

  constructor(private readonly data: ShapeData) {}

  /** A part of the value that came in format `index`, at `path`: the value needs that format at least. */
  private needs(index: number, path: Path) {
    if (index > this.need) [this.need, this.needAt] = [index, path];
  }

  /**
   * What the value uses at this place, by the format each came in: the place itself (`x-since`), the value it takes
   * (`x-since-values`), and any limit an older format held that the value goes past (`x-before`) — written by the
   * format's history (tools/format-since.json).
   */
  private since(s: Record<string, unknown>, value: unknown, path: Path) {
    if (typeof s['x-since'] === 'number') this.needs(s['x-since'], path);
    const values = s['x-since-values'] as Record<string, number> | undefined;
    if (values) {
      const said = JSON.stringify(value);
      if (has(values, said)) this.needs(values[said], path);
    }
    const before = s['x-before'] as Record<string, [number, unknown][]> | undefined;
    if (!before) return;
    for (const [limit, held] of Object.entries(before)) for (const [index, was] of held) if (index > this.need && !this.heldTo(limit, was, value)) this.needs(index, path);
  }

  /** Whether a value holds to a limit as an older format had it. */
  private heldTo(limit: string, was: unknown, value: unknown): boolean {
    const size = typeof value === 'string' || Array.isArray(value) ? value.length : undefined;
    switch (limit) {
      case 'minimum':
        return typeof value !== 'number' || value >= (was as number);
      case 'maximum':
        return typeof value !== 'number' || value <= (was as number);
      case 'exclusiveMinimum':
        return typeof value !== 'number' || value > (was as number);
      case 'exclusiveMaximum':
        return typeof value !== 'number' || value < (was as number);
      case 'minLength':
      case 'minItems':
        return size === undefined || size >= (was as number);
      case 'maxLength':
      case 'maxItems':
        return size === undefined || size <= (was as number);
      case 'pattern':
        return typeof value !== 'string' || this.pattern(was as string).test(value);
      case 'uniqueItems':
        return !Array.isArray(value) || !was || !value.some((one, i) => value.findIndex((other) => same(one, other)) !== i);
      case 'required':
        return !isObject(value) || (was as string[]).every((key) => has(value, key) && value[key] !== undefined);
      case 'type':
        return (was as string[]).some((one) => ofType(one, value));
      default:
        return true;
    }
  }

  /** A `$ref` (`#/$defs/Field`) read. */
  private resolve(ref: string): Shape {
    const name = ref.startsWith('#/$defs/') ? ref.slice(8) : null;
    const found = name !== null && has(this.data.defs, name) ? this.data.defs[name] : undefined;
    if (found === undefined) throw new Error(`the format's schema names ${ref}, which it does not hold`);
    return found;
  }

  private pattern(source: string, flags = ''): RegExp {
    const key = `${flags}/${source}`;
    let found = this.patterns.get(key);
    if (!found) this.patterns.set(key, (found = new RegExp(source, flags)));
    return found;
  }

  /**
   * The key every branch of a union names its kind by (`type`, `do`): each branch an object with that property's one
   * value (`const`). Null when the branches are told apart otherwise.
   */
  private discriminator(branches: readonly Shape[]): string | null {
    if (this.keys.has(branches)) return this.keys.get(branches) ?? null;
    const shapes = branches.map((branch) => this.flat(branch)).map((shape) => (typeof shape === 'object' ? this.propertiesOf(shape) : null));
    let found: string | null = null;
    const first = shapes[0];
    if (shapes.length > 1 && first) {
      for (const key of Object.keys(first)) {
        const consts = shapes.map((shape) => (shape && isObject(shape[key]) && has(shape[key] as object, 'const') ? (shape[key] as { const: unknown }).const : undefined));
        if (consts.every((value) => typeof value === 'string') && new Set(consts).size === consts.length) {
          found = key;
          break;
        }
      }
    }
    this.keys.set(branches, found);
    return found;
  }

  /** An object's settings: its own, and those of each set it names (`x-with`), gathered once. */
  private propertiesOf(s: Record<string, unknown>): Record<string, Shape> {
    const own = (isObject(s['properties']) ? s['properties'] : {}) as Record<string, Shape>;
    const sets = s['x-with'];
    if (!Array.isArray(sets)) return own;
    let found = SETTINGS.get(s);
    if (!found) {
      found = {};
      for (const name of sets as string[]) Object.assign(found, (this.resolve(`#/$defs/${name}`) as { properties: Record<string, Shape> }).properties);
      SETTINGS.set(s, Object.assign(found, own));
    }
    return found;
  }

  /** A branch with its `$ref` read — through a place that says no more than the format it came in. */
  private flat(shape: Shape): Shape {
    let at = shape;
    for (let depth = 0; typeof at === 'object' && typeof at['$ref'] === 'string' && Object.keys(at).every((key) => key === '$ref' || NOTES.has(key)) && depth < 16; depth++) at = this.resolve(at['$ref'] as string);
    return at;
  }

  /** Every problem of `value` against `shape`, at `path`. */
  check(shape: Shape, value: unknown, path: Path): Found[] {
    if (shape === true) return [];
    if (shape === false) return [{ path, message: 'Invalid input' }];
    const s = shape as Record<string, unknown>;
    const found: Found[] = [];
    if (typeof s['$ref'] === 'string') {
      found.push(...this.check(this.resolve(s['$ref']), value, path));
      if (found.length) return found;
    }
    const type = s['type'];
    if (type !== undefined) {
      const types = Array.isArray(type) ? (type as string[]) : [type as string];
      if (!types.some((one) => ofType(one, value))) return [{ path, message: `Invalid input: expected ${types.map((one) => (one === 'integer' ? 'int' : one)).join(' or ')}, received ${kindOf(value)}` }];
    }
    if (has(s, 'const') && !same(value, s['const'])) return [{ path, message: `Invalid input: expected ${JSON.stringify(s['const'])}` }];
    this.since(s, value, path);
    if (Array.isArray(s['enum']) && !s['enum'].some((one) => same(one, value))) return [{ path, message: `Invalid option: expected one of ${s['enum'].map((one) => JSON.stringify(one)).join('|')}` }];
    if (s['not'] !== undefined) {
      const kept = [this.need, this.needAt] as const;
      const refused = !this.check(s['not'] as Shape, value, path).length;
      [this.need, this.needAt] = kept;
      if (refused) return [{ path, message: 'Invalid input' }];
    }
    if (typeof value === 'string') this.string(s, value, path, found);
    else if (typeof value === 'number') this.number(s, value, path, found);
    else if (Array.isArray(value)) this.array(s, value, path, found);
    else if (isObject(value)) this.object(s, value, path, found);
    const branches = (s['anyOf'] ?? s['oneOf']) as Shape[] | undefined;
    if (branches) found.push(...this.union(branches, value, path));
    if (Array.isArray(s['allOf'])) for (const one of s['allOf'] as Shape[]) found.push(...this.check(one, value, path));
    const rule = s['x-rule'];
    if (!found.length && typeof rule === 'string') found.push(...this.rule(rule as RuleName, value, path));
    return found;
  }

  private string(s: Record<string, unknown>, value: string, path: Path, found: Found[]) {
    if (typeof s['minLength'] === 'number' && value.length < s['minLength']) found.push({ path, message: `Too small: expected string to have >=${s['minLength']} characters` });
    if (typeof s['maxLength'] === 'number' && value.length > s['maxLength']) found.push({ path, message: `Too big: expected string to have <=${s['maxLength']} characters` });
    if (typeof s['pattern'] === 'string' && !this.pattern(s['pattern'], s['x-flags'] as string | undefined).test(value)) {
      const pattern = s['pattern'].length <= 40 ? ` (/${s['pattern']}/)` : '';
      found.push({ path, message: `Invalid string: ${JSON.stringify(value.length > 60 ? `${value.slice(0, 57)}…` : value)} is not in the form this setting takes${pattern}` });
    }
  }

  private number(s: Record<string, unknown>, value: number, path: Path, found: Found[]) {
    if (typeof s['minimum'] === 'number' && value < s['minimum']) found.push({ path, message: `Too small: expected number to be >=${s['minimum']}` });
    if (typeof s['maximum'] === 'number' && value > s['maximum']) found.push({ path, message: `Too big: expected number to be <=${s['maximum']}` });
    if (typeof s['exclusiveMinimum'] === 'number' && value <= s['exclusiveMinimum']) found.push({ path, message: `Too small: expected number to be >${s['exclusiveMinimum']}` });
    if (typeof s['exclusiveMaximum'] === 'number' && value >= s['exclusiveMaximum']) found.push({ path, message: `Too big: expected number to be <${s['exclusiveMaximum']}` });
    if (typeof s['multipleOf'] === 'number' && !Number.isInteger(value / s['multipleOf'])) found.push({ path, message: `Invalid number: must be a multiple of ${s['multipleOf']}` });
  }

  private array(s: Record<string, unknown>, value: unknown[], path: Path, found: Found[]) {
    if (typeof s['minItems'] === 'number' && value.length < s['minItems']) found.push({ path, message: `Too small: expected array to have >=${s['minItems']} items` });
    if (typeof s['maxItems'] === 'number' && value.length > s['maxItems']) found.push({ path, message: `Too big: expected array to have <=${s['maxItems']} items` });
    if (s['uniqueItems'] === true && value.some((one, i) => value.findIndex((other) => same(one, other)) !== i)) found.push({ path, message: 'Invalid input: each item once' });
    const prefix = Array.isArray(s['prefixItems']) ? (s['prefixItems'] as Shape[]) : [];
    value.forEach((item, i) => {
      const shape = i < prefix.length ? prefix[i] : (s['items'] as Shape | undefined);
      if (shape !== undefined) found.push(...this.check(shape, item, [...path, i]));
    });
  }

  private object(s: Record<string, unknown>, value: Record<string, unknown>, path: Path, found: Found[]) {
    const properties = this.propertiesOf(s);
    if (Array.isArray(s['required'])) {
      for (const key of s['required'] as string[]) {
        if (has(value, key) && value[key] !== undefined) continue;
        const wanted = properties[key];
        const type = typeof wanted === 'object' ? this.flat(wanted) : wanted;
        const named = typeof type === 'object' && typeof type['type'] === 'string' ? type['type'] : typeof type === 'object' && has(type, 'const') ? JSON.stringify(type['const']) : 'a value';
        found.push({ path: [...path, key], message: `Invalid input: expected ${named === 'integer' ? 'int' : named}, received undefined` });
      }
    }
    const unknown: string[] = [];
    for (const key of Object.keys(value)) {
      if (value[key] === undefined) continue;
      if (has(properties, key)) found.push(...this.check(properties[key], value[key], [...path, key]));
      else if (s['additionalProperties'] === false) unknown.push(key);
      else if (s['additionalProperties'] !== undefined) found.push(...this.check(s['additionalProperties'] as Shape, value[key], [...path, key]));
      if (s['propertyNames'] !== undefined && this.check(s['propertyNames'] as Shape, key, [...path, key]).length) found.push({ path: [...path, key], message: `Invalid key: "${key}"` });
    }
    if (unknown.length) found.push({ path, message: `Unrecognized key${unknown.length > 1 ? 's' : ''}: ${unknown.map((key) => `"${key}"`).join(', ')}` });
    if (isObject(s['dependentSchemas'])) {
      for (const [key, shape] of Object.entries(s['dependentSchemas'] as Record<string, Shape>)) if (has(value, key) && value[key] !== undefined) found.push(...this.check(shape, value, path));
    }
  }

  /** A value one of a union's branches takes: by its kind (`type`, `do`) where they name one, else the first that holds. */
  private union(branches: readonly Shape[], value: unknown, path: Path): Found[] {
    const key = isObject(value) ? this.discriminator(branches) : null;
    if (key !== null && isObject(value)) {
      const kind = value[key];
      const branch = branches.find((one) => (this.propertiesOf(this.flat(one) as Record<string, unknown>)[key] as { const?: unknown }).const === kind);
      return branch === undefined ? [{ path: [...path, key], message: `"${key}" is not one of the kinds allowed here` }] : this.check(branch, value, path);
    }
    let closest: Found[] | null = null;
    let fitting = 0;
    // What a branch tried and refused uses is never the value's: the format it needs is the branch it takes.
    const kept = [this.need, this.needAt] as const;
    for (const branch of branches) {
      [this.need, this.needAt] = kept;
      const found = this.check(branch, value, path);
      if (!found.length) return [];
      const flat = this.flat(branch);
      const type = typeof flat === 'object' ? flat['type'] : undefined;
      if (type === undefined || (Array.isArray(type) ? (type as string[]) : [type as string]).some((one) => ofType(one, value))) {
        fitting++;
        closest = found;
      }
    }
    [this.need, this.needAt] = kept;
    return fitting === 1 && closest ? closest : [{ path, message: 'Invalid input' }];
  }

  private rule(name: RuleName, value: unknown, path: Path): Found[] {
    const found: Found[] = [];
    const context: RuleContext = {
      say: (message, at = []) => void found.push({ path: [...path, ...at], message }),
      check: (shape, part, at) => {
        const own = this.data.options[shape];
        if (own === undefined) throw new Error(`the format's schema holds no shape "${shape}" for a widget's options`);
        found.push(...this.check(own, part, [...path, ...at]));
      },
    };
    (RULES[name] as (value: unknown, context: RuleContext) => void)(value, context);
    return found;
  }
}

/**
 * A page checked against the format's schema `data`: every problem of its shape, as `validatePage` says where each is,
 * and the newest format a part of it came in (`need`, an index into the formats; -1 for the first) with where that
 * part is (`needAt`) — the lowest format the page needs.
 */
export function shapeCheck(page: unknown, data: ShapeData): { issues: PageIssue[]; need: number; needAt: string } {
  const check = new ShapeCheck(data);
  const issues = check.check(data.page, page, []).map((found) => ({ path: pathWords(found.path), message: found.message }));
  return { issues, need: check.need, needAt: pathWords(check.needAt) };
}

/** Every problem of a page's shape against the format's schema `data`, as `validatePage` says where each is. */
export function shapeIssues(page: unknown, data: ShapeData): PageIssue[] {
  return shapeCheck(page, data).issues;
}
