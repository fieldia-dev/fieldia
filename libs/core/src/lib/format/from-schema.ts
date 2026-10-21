import type { Field, LineField, Option } from './field';
import type { FieldNode, LayoutNode } from './layout';
import { FIELD_NAME, FIELD_TYPES } from './names';
import type { Page } from './page';
import { fieldPattern } from './pattern';
import { FORMAT_VERSION } from './version';

/**
 * A starting page from what an app already has: a JSON Schema, an OpenAPI document (a component's schema, or an
 * operation's request body and parameters), or a model's fields (Fieldia's own, or a backend's field list such as
 * Flectra's `fields_get`). Each property becomes a field of its kind — text, numbers, yes or no, dates, choices, files,
 * lines — with its label, help, whether it is required or read-only, its limits, its pattern and its default, laid out
 * in sections (a screen) or steps (a survey). What has no field of its own is kept as JSON and said; what cannot be
 * read is left out and said: nothing is dropped quietly.
 *
 *   const { page, notes, unmapped } = pageFromSchema(openApi, { schema: 'POST /enquiries' });
 *
 * The page is a start, to edit in the designer: it names a model (`data.model`) the app's data source answers for.
 */

/** Something a schema said, about one of its properties (`path`, as the schema names it), and how it was taken. */
export interface SchemaNote {
  path: string;
  /**
   * Kept with a change: `renamed` (a name a field cannot have), `flattened` (an object's properties as fields of their
   * own, in a section), `json` (a value of a kind no field holds, kept as JSON), `limit` (a limit no setting holds),
   * `format` (a format Fieldia does not know, kept as text), `pattern` (a pattern that does not read, left out),
   * `constant` (one value, shown read-only), `links` (lines whose fields are not given, kept as links).
   * Left out: `reference` (a `$ref` outside the document, or one that refers to itself), `kind` (no kind of value).
   */
  code: 'renamed' | 'flattened' | 'json' | 'limit' | 'format' | 'pattern' | 'constant' | 'links' | 'reference' | 'kind';
  /** What exactly: the new name, the limit as the schema wrote it, the kind of value, the reference. */
  detail?: string;
}

export interface PageFromSchema {
  page: Page;
  /** What was kept with a change. */
  notes: SchemaNote[];
  /** What was left out. */
  unmapped: SchemaNote[];
  /** What it was read as. */
  from: 'json-schema' | 'openapi' | 'fields';
}

/** Why a schema gave no page, for an app (or the designer) to say in its own words; the error's message says it in English. */
export type SchemaRefusal = 'not-json-object' | 'not-a-schema' | 'not-an-object' | 'outside' | 'no-properties' | 'no-such-schema' | 'nothing-in-document';

/** A schema that gave no page: what `pageFromSchema` throws, its `code` saying why. */
export class SchemaRefused extends Error {
  constructor(
    readonly code: SchemaRefusal,
    message: string
  ) {
    super(message);
    this.name = 'SchemaRefused';
  }
}

export interface PageFromSchemaOptions {
  /** A screen of sections, kept as a record of `model` (the default), or a survey's steps, sent as responses. */
  kind?: 'screen' | 'survey';
  /** The page's title: the schema's own, else its name in the document, else "Form". */
  title?: string;
  /** The page's id: its title's words joined by hyphens. */
  id?: string;
  /** The model its records are kept as: its title's words joined by dots. */
  model?: string;
  /**
   * An OpenAPI document's schema to start from: a component's name (`Pet`), an operation's id (`addPet`), or its
   * method and path (`POST /pets`). The first operation with a request body or parameters, else the first component.
   */
  schema?: string;
}

/** What an OpenAPI document offers to start from, for a person to choose: its operations, then its components. */
export function schemaChoices(input: unknown): { value: string; label: string }[] {
  const doc = asObject(input);
  if (!doc || !isOpenApi(doc)) return [];
  const choices: { value: string; label: string }[] = [];
  for (const [path, item] of Object.entries(asObject(doc['paths']) ?? {})) {
    for (const [method, operation] of Object.entries(asObject(item) ?? {})) {
      if (!METHODS.has(method)) continue;
      const op = asObject(operation) ?? {};
      const summary = typeof op['summary'] === 'string' ? ` — ${op['summary']}` : '';
      choices.push({ value: `${method.toUpperCase()} ${path}`, label: `${method.toUpperCase()} ${path}${summary}` });
    }
  }
  for (const name of Object.keys(components(doc))) choices.push({ value: name, label: name });
  return choices;
}

/** A page to start from, from a JSON Schema, an OpenAPI document or a model's fields. Throws when it is none of them. */
export function pageFromSchema(input: unknown, options: PageFromSchemaOptions = {}): PageFromSchema {
  const doc = asObject(input) ?? (Array.isArray(input) ? input : null);
  if (!doc) throw new SchemaRefused('not-json-object', 'A schema is a JSON object: a JSON Schema, an OpenAPI document or a model’s fields.');
  const build = new Builder(Array.isArray(doc) ? {} : doc);
  let from: PageFromSchema['from'];
  let title: string | undefined;
  if (Array.isArray(doc) || isFieldList(doc)) {
    from = 'fields';
    build.fieldList(Array.isArray(doc) ? doc : Object.entries(doc).map(([name, field]) => ({ name, ...(field as object) })));
  } else if (isOpenApi(doc)) {
    from = 'openapi';
    title = build.openApi(doc, options.schema);
  } else if (isJsonSchema(doc)) {
    from = 'json-schema';
    const root = build.resolve(doc, '');
    if (!root) throw new SchemaRefused('outside', 'This JSON Schema refers to a schema outside it: give the schema itself.');
    if (!build.objectLike(root)) throw new SchemaRefused('not-an-object', 'A page starts from an object schema, with properties: this schema is not one.');
    title = typeof root['title'] === 'string' ? root['title'] : undefined;
    build.object(root, '', null);
  } else throw new SchemaRefused('not-a-schema', 'This is not a JSON Schema, an OpenAPI document or a model’s fields: no properties, no paths, no fields with a type.');
  if (!build.fieldCount()) throw new SchemaRefused('no-properties', 'The schema has no properties to ask for.');
  const pageTitle = options.title ?? title ?? 'Form';
  return { page: build.page(pageTitle, options), notes: build.notes, unmapped: build.unmapped, from };
}

/** Each note in words, for an app to show; the designer says them in its own language. */
export function schemaNoteWords(note: SchemaNote): string {
  const at = note.path || 'the schema';
  const detail = note.detail ?? '';
  switch (note.code) {
    case 'renamed':
      return `${at} is named ${detail} on the page: a field’s name has letters, digits and _ alone.`;
    case 'flattened':
      return `${at}’s properties are fields of their own, in a section of its name: your data source joins them into one object.`;
    case 'json':
      return `${at} is kept as JSON, shown as text to edit: no field holds ${detail}.`;
    case 'limit':
      return `${at}: ${detail} is not checked by the page; your server checks it.`;
    case 'format':
      return `${at} is plain text: Fieldia does not know the format ${detail}.`;
    case 'pattern':
      return `${at}’s pattern ${detail} does not read as a regular expression, so it was left out.`;
    case 'constant':
      return `${at} is always ${detail}: shown, not asked.`;
    case 'links':
      return `${at} is links to ${detail} records: the fields of its lines were not given.`;
    case 'reference':
      return `${at} was left out: it refers to ${detail}, which is not in the document.`;
    case 'kind':
      return `${at} was left out: ${detail} is no kind of value a page asks for.`;
  }
}

// ---- reading ------------------------------------------------------------------------------------

type Json = Record<string, unknown>;
const asObject = (value: unknown): Json | null => (value && typeof value === 'object' && !Array.isArray(value) ? (value as Json) : null);
const METHODS = new Set(['get', 'put', 'post', 'patch', 'delete', 'options', 'head']);
const isOpenApi = (doc: Json) => typeof doc['openapi'] === 'string' || typeof doc['swagger'] === 'string';
const isJsonSchema = (doc: Json) => !!asObject(doc['properties']) || typeof doc['$ref'] === 'string' || Array.isArray(doc['allOf']) || doc['type'] === 'object' || typeof doc['$schema'] === 'string';
/** A model's fields: every value an object with a type and words (Fieldia's `label`, a backend's `string`). */
function isFieldList(doc: Json): boolean {
  const values = Object.values(doc);
  return values.length > 0 && !isJsonSchema(doc) && values.every((value) => {
    const field = asObject(value);
    return !!field && typeof field['type'] === 'string' && (typeof field['label'] === 'string' || typeof field['string'] === 'string');
  });
}
function components(doc: Json): Json {
  return asObject(asObject(doc['components'])?.['schemas']) ?? asObject(doc['definitions']) ?? {};
}

/** Words for a name: `first_name`, `firstName` and `first-name` all "First name". */
export function wordsOf(name: string): string {
  const words = name
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .replace(/[_\-.]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
  if (!words) return name;
  return words.charAt(0).toUpperCase() + words.slice(1).replace(/\b([A-Z])([a-z])/g, (_, first: string, next: string) => first.toLowerCase() + next);
}
const slug = (words: string, separator: string) =>
  words
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, separator)
    .replace(new RegExp(`^\\${separator}+|\\${separator}+$`, 'g'), '');

/** What each property becomes: its field, and how its node shows it. */
interface Made {
  name: string;
  field: Field;
  widget?: string;
  wide?: boolean;
}

class Builder {
  readonly notes: SchemaNote[] = [];
  readonly unmapped: SchemaNote[] = [];
  /** The fields of the page itself, and each section's (an object's flattened), in order. */
  private readonly groups: { title?: string; made: Made[] }[] = [{ made: [] }];
  private readonly names = new Set<string>();

  constructor(private readonly doc: Json) {}

  fieldCount(): number {
    return this.groups.reduce((n, group) => n + group.made.length, 0);
  }

  /** A `$ref` followed inside the document (with JSON Pointer's escapes), its own words kept over what it points to. */
  resolve(schema: unknown, path: string, seen: readonly string[] = []): Json | null {
    let at = asObject(schema);
    const followed = [...seen];
    while (at && typeof at['$ref'] === 'string') {
      const ref = at['$ref'];
      if (!ref.startsWith('#') || followed.includes(ref)) {
        this.unmapped.push({ path, code: 'reference', detail: followed.includes(ref) ? `${ref} (itself)` : ref });
        return null;
      }
      followed.push(ref);
      const target = ref
        .slice(1)
        .split('/')
        .filter(Boolean)
        .map((part) => decodeURIComponent(part).replace(/~1/g, '/').replace(/~0/g, '~'))
        .reduce<unknown>((node, part) => asObject(node)?.[part], this.doc);
      const { $ref: _ref, ...own } = at;
      const found = asObject(target);
      if (!found) {
        this.unmapped.push({ path, code: 'reference', detail: ref });
        return null;
      }
      at = { ...found, ...own };
    }
    if (!at) return null;
    // allOf: one schema of them all, their properties and what each requires together.
    if (Array.isArray(at['allOf'])) {
      const parts = (at['allOf'] as unknown[]).map((part) => this.resolve(part, path, followed)).filter((part): part is Json => !!part);
      const { allOf: _all, ...own } = at;
      return parts.reduce<Json>(
        (merged, part) => ({
          ...part,
          ...merged,
          properties: { ...(asObject(part['properties']) ?? {}), ...(asObject(merged['properties']) ?? {}) },
          required: [...((part['required'] as unknown[]) ?? []), ...((merged['required'] as unknown[]) ?? [])],
        }),
        own
      );
    }
    return at;
  }

  objectLike(schema: Json): boolean {
    return schema['type'] === 'object' || !!asObject(schema['properties']);
  }

  /** The kinds of value a schema allows, `null` aside: `["string", "null"]`, OpenAPI 3.0's `nullable`, a union with null. */
  private kindOf(schema: Json, path: string): { schema: Json; type: string | null } {
    let at = schema;
    for (const key of ['anyOf', 'oneOf']) {
      const branches = Array.isArray(at[key]) ? (at[key] as unknown[]).map((branch) => this.resolve(branch, path)).filter((branch): branch is Json => !!branch) : null;
      if (!branches) continue;
      const real = branches.filter((branch) => branch['type'] !== 'null');
      if (real.length === 1) {
        const { [key]: _union, ...own } = at;
        at = { ...real[0], ...own };
      } else if (real.length && real.every((branch) => 'const' in branch)) {
        const { [key]: _union, ...own } = at;
        at = { ...own, type: typeof real[0]['const'] === 'number' ? 'number' : 'string', enum: real.map((branch) => branch['const']), 'x-enumNames': real.map((branch) => (typeof branch['title'] === 'string' ? branch['title'] : String(branch['const']))) };
      } else return { schema: at, type: 'union' };
    }
    const declared = at['type'];
    const types = (Array.isArray(declared) ? declared : declared === undefined ? [] : [declared]).filter((type) => type !== 'null');
    if (types.length > 1) return { schema: at, type: 'union' };
    if (types.length === 1) return { schema: at, type: String(types[0]) };
    if (Array.isArray(at['enum'])) return { schema: at, type: (at['enum'] as unknown[]).every((value) => typeof value === 'number') ? 'number' : 'string' };
    if (this.objectLike(at)) return { schema: at, type: 'object' };
    if (asObject(at['items'])) return { schema: at, type: 'array' };
    if ('const' in at) return { schema: at, type: typeof at['const'] === 'number' ? 'number' : typeof at['const'] === 'boolean' ? 'boolean' : 'string' };
    if (declared === 'null') return { schema: at, type: null };
    // No type said: any JSON.
    return { schema: at, type: 'any' };
  }

  /** A field's name from a property's: letters, digits and _ alone, never one already taken. */
  private fieldName(name: string, path: string, taken: Set<string>): string {
    let made = name.replace(/[^A-Za-z0-9_]+/g, '_').replace(/^_+(?=.)/, '');
    if (!made || !FIELD_NAME.test(made)) made = `field_${made}`.replace(/_+$/, '') || 'field';
    let unique = made;
    for (let n = 2; taken.has(unique); n++) unique = `${made}_${n}`;
    taken.add(unique);
    if (unique !== name) this.notes.push({ path, code: 'renamed', detail: unique });
    return unique;
  }

  /**
   * An object's properties as the page's fields; an object inside one as a section of its own, its fields' names after
   * its name (`prefix`) — two objects deep, then kept as JSON.
   */
  object(schema: Json, path: string, prefix: string | null, section?: string, depth = 0): void {
    const group = section === undefined ? this.groups[0] : (this.groups[this.groups.push({ title: section, made: [] }) - 1] as { title?: string; made: Made[] });
    const required = new Set(Array.isArray(schema['required']) ? (schema['required'] as unknown[]).map(String) : []);
    for (const [key, value] of Object.entries(asObject(schema['properties']) ?? {})) {
      const at = path ? `${path}.${key}` : key;
      const resolved = this.resolve(value, at);
      if (!resolved) continue;
      const { schema: property, type } = this.kindOf(resolved, at);
      if (type === 'object' && asObject(property['properties']) && depth < 2) {
        // An object in an object: its properties a section of their own, their names after its name.
        this.notes.push({ path: at, code: 'flattened' });
        this.object(property, at, `${prefix ? `${prefix}_` : ''}${key}`, typeof property['title'] === 'string' ? property['title'] : wordsOf(key), depth + 1);
        continue;
      }
      const name = this.fieldName(prefix ? `${prefix}_${key}` : key, at, this.names);
      const made = this.field(property, type, name, at, required.has(key), false);
      if (made) group.made.push(made);
    }
  }

  /** One property's field, with its words, its rules and how it is shown; null when it is left out. */
  private field(schema: Json, type: string | null, name: string, path: string, required: boolean, onLine: boolean): Made | null {
    const label = typeof schema['title'] === 'string' && schema['title'].trim() ? schema['title'].trim() : wordsOf(path.split('.').pop() ?? name);
    const common: Record<string, unknown> = { label };
    if (typeof schema['description'] === 'string' && schema['description'].trim()) common['help'] = schema['description'].trim();
    if (required) common['required'] = true;
    if (schema['readOnly'] === true) common['readonly'] = true;
    const made = (field: Record<string, unknown>, extra: Omit<Made, 'name' | 'field'> = {}): Made => {
      const whole = { ...field, ...common } as Field;
      this.withDefault(whole, schema, path);
      return { name, field: whole, ...extra };
    };
    if ('const' in schema && !Array.isArray(schema['enum'])) {
      this.notes.push({ path, code: 'constant', detail: JSON.stringify(schema['const']) });
      common['readonly'] = true;
      schema = { ...schema, default: schema['const'] };
    }
    if (Array.isArray(schema['enum'])) {
      const options = this.options(schema);
      if (options.length) return made({ type: 'selection', options });
    }
    switch (type) {
      case 'string':
        return this.text(schema, path, made);
      case 'integer':
      case 'number':
        return made({ type: type === 'integer' ? 'integer' : 'float', ...this.bounds(schema, path, type === 'integer') });
      case 'boolean':
        return made({ type: 'boolean' });
      case 'array':
        return this.list(schema, name, path, onLine, made);
      case 'object':
      case 'union':
      case 'any':
        this.notes.push({ path, code: 'json', detail: type === 'object' ? 'an object' : type === 'union' ? 'a value of several kinds' : 'any JSON' });
        return made({ type: 'json' }, { wide: true });
      default:
        this.unmapped.push({ path, code: 'kind', detail: type === null ? 'null' : String(type) });
        return null;
    }
  }

  /** A schema's default, where it is a value its field takes. */
  private withDefault(field: Field, schema: Json, path: string): void {
    if (!('default' in schema) || schema['default'] === null) return;
    const value = schema['default'];
    const fits =
      field.type === 'selection'
        ? (field.multiple ? Array.isArray(value) && value.every((one) => field.options.some((option) => option.value === one)) : field.options.some((option) => option.value === value))
        : field.type === 'boolean'
          ? typeof value === 'boolean'
          : field.type === 'integer'
            ? Number.isInteger(value)
            : field.type === 'float' || field.type === 'monetary'
              ? typeof value === 'number'
              : field.type === 'date'
                ? typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
                : field.type === 'char' || field.type === 'text' || field.type === 'html'
                  ? typeof value === 'string'
                  : field.type === 'json';
    if (fits) (field as { default?: unknown }).default = value;
    else this.notes.push({ path, code: 'limit', detail: `default ${JSON.stringify(value)}` });
  }

  /** A list of choices: each value with its words — `x-enumNames`, else the value as words. */
  private options(schema: Json): Option[] {
    const names = Array.isArray(schema['x-enumNames']) ? (schema['x-enumNames'] as unknown[]) : Array.isArray(schema['x-enum-varnames']) ? (schema['x-enum-varnames'] as unknown[]) : [];
    return (schema['enum'] as unknown[])
      .filter((value): value is string | number => typeof value === 'string' || typeof value === 'number')
      .map((value, i) => ({ value, label: typeof names[i] === 'string' && names[i] ? String(names[i]) : typeof value === 'string' ? wordsOf(value) : String(value) }));
  }

  private text(schema: Json, path: string, made: (field: Record<string, unknown>, extra?: Omit<Made, 'name' | 'field'>) => Made): Made {
    const format = typeof schema['format'] === 'string' ? schema['format'] : '';
    const media = typeof schema['contentMediaType'] === 'string' ? schema['contentMediaType'] : '';
    if (format === 'date') return made({ type: 'date' });
    if (format === 'date-time') return made({ type: 'datetime' });
    if (format === 'binary' || format === 'byte' || schema['contentEncoding'] === 'base64') return made({ type: 'binary', ...(media && media !== 'application/octet-stream' ? { accept: [media] } : {}) });
    if (format === 'html' || media === 'text/html') return made({ type: 'html' }, { wide: true });
    const maxLength = typeof schema['maxLength'] === 'number' && Number.isInteger(schema['maxLength']) && schema['maxLength'] > 0 ? schema['maxLength'] : undefined;
    if (typeof schema['minLength'] === 'number' && schema['minLength'] > 1) this.notes.push({ path, code: 'limit', detail: `minLength ${schema['minLength']}` });
    const long = format === 'textarea' || format === 'multiline' || (maxLength !== undefined && maxLength > 255);
    if (long) return made({ type: 'text', ...(maxLength ? { size: maxLength } : {}) }, { wide: true });
    const widget = format === 'email' || format === 'idn-email' ? 'email' : format === 'uri' || format === 'url' || format === 'iri' ? 'url' : format === 'time' ? 'time' : format === 'phone' || format === 'tel' ? 'phone' : format === 'color' ? 'color' : format === 'password' || schema['writeOnly'] === true ? 'password' : undefined;
    if (format && !widget && !['uuid', 'hostname', 'idn-hostname', 'ipv4', 'ipv6', 'regex', 'uri-reference', 'json-pointer'].includes(format)) this.notes.push({ path, code: 'format', detail: format });
    const field: Record<string, unknown> = { type: 'char', ...(maxLength ? { size: maxLength } : {}) };
    if (typeof schema['pattern'] === 'string' && !widget) {
      const pattern = wholePattern(schema['pattern']);
      if (fieldPattern(pattern) instanceof Error) this.notes.push({ path, code: 'pattern', detail: schema['pattern'] });
      else field['pattern'] = pattern;
    }
    return made(field, widget ? { widget } : {});
  }

  /** A number's least and most, as the schema writes them: `minimum`, `exclusiveMinimum` (a number, or draft 4's flag), `multipleOf` as decimals. */
  private bounds(schema: Json, path: string, whole: boolean): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [side, inclusive, exclusive, step] of [['min', 'minimum', 'exclusiveMinimum', 1], ['max', 'maximum', 'exclusiveMaximum', -1]] as const) {
      const value = schema[inclusive];
      const excluded = schema[exclusive];
      if (typeof excluded === 'number') {
        out[side] = whole ? excluded + step : excluded;
        if (!whole) this.notes.push({ path, code: 'limit', detail: `${exclusive} ${excluded}` });
      } else if (typeof value === 'number') {
        out[side] = excluded === true && whole ? value + step : value;
        if (excluded === true && !whole) this.notes.push({ path, code: 'limit', detail: `${exclusive} ${value}` });
      }
    }
    const multiple = schema['multipleOf'];
    if (typeof multiple === 'number' && multiple > 0) {
      const places = Math.round(-Math.log10(multiple));
      if (!whole && places > 0 && places <= 8 && Math.abs(multiple - 10 ** -places) < 1e-12) out['digits'] = [16, places];
      else if (!(whole && multiple === 1)) this.notes.push({ path, code: 'limit', detail: `multipleOf ${multiple}` });
    }
    return out;
  }

  /** A list: choices (several picked), files, lines of their own — else JSON. */
  private list(schema: Json, name: string, path: string, onLine: boolean, made: (field: Record<string, unknown>, extra?: Omit<Made, 'name' | 'field'>) => Made): Made | null {
    const items = this.resolve(schema['items'], `${path}[]`);
    const { schema: item, type } = items ? this.kindOf(items, `${path}[]`) : { schema: {}, type: 'any' };
    const counts = ['minItems', 'maxItems', 'uniqueItems'].filter((key) => key in schema && !(key === 'uniqueItems' && Array.isArray(item['enum'])));
    if (Array.isArray(item['enum'])) {
      const options = this.options(item);
      for (const key of counts) this.notes.push({ path, code: 'limit', detail: `${key} ${JSON.stringify(schema[key])}` });
      if (options.length) return made({ type: 'selection', options, multiple: true });
    }
    if (type === 'string' && (item['format'] === 'binary' || item['format'] === 'byte' || item['contentEncoding'] === 'base64')) {
      const min = typeof schema['minItems'] === 'number' && schema['minItems'] > 0 ? { minFiles: schema['minItems'] } : {};
      const max = typeof schema['maxItems'] === 'number' && schema['maxItems'] > 0 ? { maxFiles: schema['maxItems'] } : {};
      return made({ type: 'binary', multiple: true, ...min, ...max });
    }
    if (type === 'object' && asObject(item['properties']) && !onLine) {
      const fields: Record<string, LineField> = {};
      const taken = new Set<string>();
      const required = new Set(Array.isArray(item['required']) ? (item['required'] as unknown[]).map(String) : []);
      for (const [key, value] of Object.entries(asObject(item['properties']) ?? {})) {
        const at = `${path}[].${key}`;
        const resolved = this.resolve(value, at);
        if (!resolved) continue;
        const { schema: property, type: kind } = this.kindOf(resolved, at);
        const lineName = this.fieldName(key, at, taken);
        // A line holds no lines of its own here, nor an object: those are kept as JSON.
        const line = kind === 'object' || (kind === 'array' && !Array.isArray(this.resolve(property['items'], at)?.['enum']))
          ? (this.notes.push({ path: at, code: 'json', detail: kind === 'object' ? 'an object inside a line' : 'a list inside a line' }), this.field(property, 'any', lineName, at, required.has(key), true))
          : this.field(property, kind, lineName, at, required.has(key), true);
        if (line) fields[line.name] = line.field as LineField;
      }
      for (const key of counts) this.notes.push({ path, code: 'limit', detail: `${key} ${JSON.stringify(schema[key])}` });
      if (!Object.keys(fields).length) return null;
      const relation = typeof item['title'] === 'string' ? slug(item['title'], '.') || slug(name, '.') : slug(name, '.');
      return made({ type: 'one2many', relation: relation || 'line', fields }, { wide: true });
    }
    this.notes.push({ path, code: 'json', detail: type === 'string' ? 'a list of text' : type === 'integer' || type === 'number' ? 'a list of numbers' : 'a list' });
    return made({ type: 'json' }, { wide: true });
  }

  /** An OpenAPI document's schema, as asked: its title. */
  openApi(doc: Json, asked: string | undefined): string | undefined {
    const operations: { key: string; id?: string; path: string; method: string; operation: Json; item: Json }[] = [];
    for (const [path, item] of Object.entries(asObject(doc['paths']) ?? {})) {
      for (const [method, operation] of Object.entries(asObject(item) ?? {})) {
        const op = asObject(operation);
        if (METHODS.has(method) && op) operations.push({ key: `${method.toUpperCase()} ${path}`, id: typeof op['operationId'] === 'string' ? op['operationId'] : undefined, path, method, operation: op, item: asObject(item) ?? {} });
      }
    }
    const schemas = components(doc);
    const wanted = asked?.trim();
    const operation = wanted
      ? operations.find((one) => one.key.toLowerCase() === wanted.toLowerCase() || one.id === wanted)
      : schemas && Object.keys(schemas).length && !operations.some((one) => this.bodyOf(one.operation) || this.parametersOf(one.operation, one.item).length)
        ? undefined
        : operations.find((one) => this.bodyOf(one.operation) || this.parametersOf(one.operation, one.item).length);
    if (operation) {
      const body = this.bodyOf(operation.operation);
      const parameters = this.parametersOf(operation.operation, operation.item);
      const required = new Set<string>();
      const properties: Json = {};
      for (const parameter of parameters) {
        properties[String(parameter['name'])] = { ...(asObject(parameter['schema']) ?? parameter), ...(typeof parameter['description'] === 'string' ? { description: parameter['description'] } : {}) };
        if (parameter['required'] === true) required.add(String(parameter['name']));
      }
      if (parameters.length) this.object({ properties, required: [...required] }, '', null);
      const resolved = body ? this.resolve(body, 'body') : null;
      if (resolved && this.objectLike(resolved)) this.object(resolved, '', null);
      else if (resolved) {
        const made = this.field(resolved, this.kindOf(resolved, 'body').type, this.fieldName('body', 'body', this.names), 'body', true, false);
        if (made) this.groups[0].made.push(made);
      }
      const summary = operation.operation['summary'];
      return typeof summary === 'string' && summary.trim() ? summary.trim() : typeof resolved?.['title'] === 'string' ? resolved['title'] : operation.id ? wordsOf(operation.id) : undefined;
    }
    const name = wanted ? Object.keys(schemas).find((one) => one === wanted || one.toLowerCase() === wanted.toLowerCase()) : Object.keys(schemas)[0];
    if (wanted && !name) throw new SchemaRefused('no-such-schema', `This document has no operation or schema “${wanted}”.`);
    if (!name) throw new SchemaRefused('nothing-in-document', 'This OpenAPI document has no operation with a request body or parameters, and no schemas.');
    const root = this.resolve(schemas[name], name);
    if (!root || !this.objectLike(root)) throw new SchemaRefused('not-an-object', `The schema “${name}” is not an object, with properties.`);
    this.object(root, '', null);
    return typeof root['title'] === 'string' ? root['title'] : wordsOf(name);
  }

  /** An operation's request body's JSON (or form) schema: OpenAPI 3's `requestBody`, Swagger 2's `in: body` parameter. */
  private bodyOf(operation: Json): Json | null {
    const body = this.resolve(operation['requestBody'], 'body');
    const content = asObject(body?.['content']);
    if (content) {
      const type = Object.keys(content).find((one) => /json/.test(one)) ?? Object.keys(content).find((one) => /form/.test(one)) ?? Object.keys(content)[0];
      return asObject(asObject(content[type])?.['schema']);
    }
    const parameter = ((operation['parameters'] as unknown[]) ?? []).map((one) => this.resolve(one, 'body')).find((one) => one?.['in'] === 'body');
    return asObject(parameter?.['schema']);
  }

  /** An operation's own parameters and its path's — query, path, header, a form's — each a field to fill. */
  private parametersOf(operation: Json, item: Json): Json[] {
    const all = [...((item['parameters'] as unknown[]) ?? []), ...((operation['parameters'] as unknown[]) ?? [])].map((one) => this.resolve(one, 'parameters')).filter((one): one is Json => !!one && typeof one['name'] === 'string' && one['in'] !== 'body' && one['in'] !== 'cookie');
    const byName = new Map(all.map((one) => [`${one['in']}:${one['name']}`, one]));
    return [...byName.values()];
  }

  /** A model's fields: Fieldia's own as they are, a backend's (`string`, `selection` pairs, `relation`) made Fieldia's. */
  fieldList(list: unknown[]): void {
    for (const entry of list) {
      const given = asObject(entry);
      if (!given || typeof given['name'] !== 'string' || typeof given['type'] !== 'string') continue;
      const path = given['name'];
      const name = this.fieldName(path, path, this.names);
      const type = given['type'] === 'many2one_reference' ? 'integer' : given['type'];
      if (!(FIELD_TYPES as readonly string[]).includes(type) || type === 'properties' || type === 'matrix') {
        this.unmapped.push({ path, code: 'kind', detail: type });
        continue;
      }
      const label = typeof given['label'] === 'string' ? given['label'] : typeof given['string'] === 'string' ? given['string'] : wordsOf(path);
      const field: Record<string, unknown> = { type, label };
      for (const key of ['help', 'required', 'readonly', 'relation', 'size', 'digits', 'currency', 'multiple', 'accept', 'min', 'max', 'pattern'] as const) if (given[key] !== undefined && given[key] !== false && given[key] !== '') field[key] = given[key];
      if (typeof given['currency_field'] === 'string') field['currencyField'] = given['currency_field'];
      if (Array.isArray(given['digits']) && (given['digits'] as unknown[]).length !== 2) delete field['digits'];
      if (type === 'selection' || type === 'reference') {
        const raw = (Array.isArray(given['options']) ? given['options'] : Array.isArray(given['selection']) ? given['selection'] : Array.isArray(given['models']) ? given['models'] : []) as unknown[];
        const options = raw.map((one) => (Array.isArray(one) ? { value: one[0] as string | number, label: String(one[1] ?? one[0]) } : (asObject(one) as Option | null))).filter((one): one is Option => !!one && (typeof one.value === 'string' || typeof one.value === 'number'));
        if (!options.length) {
          this.unmapped.push({ path, code: 'kind', detail: `${type} with no options` });
          continue;
        }
        field[type === 'reference' ? 'models' : 'options'] = options;
      }
      if ((type === 'many2one' || type === 'many2many' || type === 'one2many') && typeof field['relation'] !== 'string') {
        this.unmapped.push({ path, code: 'kind', detail: `${type} with no relation` });
        continue;
      }
      if (type === 'one2many') {
        const lines = asObject(given['fields']);
        if (lines) field['fields'] = lines;
        else {
          // Its lines' fields unknown: its records as links, which the designer can turn into lines.
          field['type'] = 'many2many';
          this.notes.push({ path, code: 'links', detail: String(field['relation']) });
        }
      }
      this.groups[0].made.push({ name, field: field as Field, wide: ['text', 'html', 'one2many', 'many2many', 'json'].includes(String(field['type'])) && type !== 'many2many' });
    }
  }

  /** The page: its fields, and a screen's sections or a survey's steps. */
  page(title: string, options: PageFromSchemaOptions): Page {
    const survey = options.kind === 'survey';
    const fields: Record<string, Field> = {};
    const nodes = (made: Made[]): FieldNode[] =>
      made.map((one) => {
        fields[one.name] = one.field;
        return { type: 'field', id: `f-${one.name}`, field: one.name, ...(one.widget ? { widget: one.widget } : {}), ...(one.wide && !survey ? { colspan: 2 } : {}) } as FieldNode;
      });
    const groups = this.groups.filter((group) => group.made.length);
    const children: LayoutNode[] = groups.map((group, i) =>
      survey
        ? ({ type: 'step', id: `step-${i + 1}`, label: group.title ?? title, children: nodes(group.made) } as unknown as LayoutNode)
        : ({ type: 'section', id: `section-${i + 1}`, ...(group.title ? { title: group.title } : {}), columns: 2, children: nodes(group.made) } as LayoutNode)
    );
    const words = slug(title, '-') || 'form';
    return {
      fieldia: FORMAT_VERSION,
      id: options.id ?? words,
      title,
      data: survey ? { kind: 'responses' } : { kind: 'record', model: options.model ?? (slug(title, '.') || 'record') },
      fields,
      layout: survey ? ({ type: 'wizard', id: 'steps', children } as unknown as Page['layout']) : { type: 'sections', id: 'sections', children },
    } as Page;
  }
}

/** A JSON Schema pattern (found anywhere in the answer) as a field's (the whole answer): `^…$` as it is, else found inside. */
function wholePattern(pattern: string): string {
  const anchored = pattern.startsWith('^') && /(^|[^\\])\$$/.test(pattern) && !pattern.includes('|');
  return anchored ? pattern.slice(1, -1) : `.*(?:${pattern}).*`;
}
