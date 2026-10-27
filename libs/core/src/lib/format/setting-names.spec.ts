import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as z from 'zod';
import * as core from '../../index';
import { literalPage, literalWords, localizePage, pageJsonSchema, pageWords, translatePage, validatePage, type Page } from '../../index';
import { NAME_MAPS, NOT_TEXT, WORDS_BY_NAME } from './translate';
import { wordsAt } from './test-words-slots';

/**
 * A field may be called anything a name may be — `values`, `default`, `data`, `filter`, `label`, `options` — and keeps
 * its words' handling whatever it is called: a key of a map whose keys are names is a name, never a setting. Only a
 * setting's key in a setting's place is read as one. The one walk of a page's words (translate.ts) is what `literalPage`,
 * `translatePage`, `localizePage`, `pageWords` (the designer's translations table) and `plainPart` (what draws a page's
 * words) all go through, so each is held here through it.
 */

// NexiBI's reproduction (amlak-64, FU1 evidence: repro-literal-page-skips-field-names.cjs), as it was sent.
describe('NexiBI’s reproduction: a field named like a setting keeps its words', () => {
  const mk = (name: string) =>
    ({
      fieldia: '0.1',
      id: 'p',
      data: { kind: 'record', model: 'm' },
      fields: { [name]: { type: 'char', label: 'What each placeholder says', help: "Such as customer: {{ customer }}. The template's {{customer}} gets it." } },
      layout: { type: 'sections', id: 'all', children: [{ type: 'section', id: 's', children: [{ type: 'field', id: `f-${name}`, field: name }] }] },
    }) as unknown as Page;

  it.each(['notes', 'values', 'default', 'data', 'options', 'filter'])('a field named %s: its help escaped, the page accepted', (name) => {
    const page = literalPage(mk(name));
    expect(page.fields[name].help).toBe(String.raw`Such as customer: \{\{ customer }}. The template's \{\{customer}} gets it.`);
    expect(validatePage(page)).toMatchObject({ ok: true });
  });
});

/** Every name the walk reads a key by — its sets, and each key it tells apart (`options`, `map`, `layers`, `…Label`): from its source, so a new one is held here by itself. */
const READ_BY_NAME = [...new Set([...readFileSync(join(__dirname, 'translate.ts'), 'utf8').matchAll(/'([A-Za-z_]\w*)'/g)].map(([, name]) => name))].sort();
// A name the walk reads nothing by: what every other name must be read as.
const PLAIN = 'zz_plain';

const words = (page: unknown) => wordsAt(page as Page);
/** Every word the walk finds, in order: each place's words its own, so the same list is the same places. */
const said = (page: unknown) => words(page).map((at) => at.words).sort();

/** A record's page holding the name everywhere a field's name is a key: its fields, a table's lines, a link's fields, the steps as it changes. */
function recordPage(name: string) {
  return {
    fieldia: '0.13',
    id: 'named',
    data: { kind: 'record', model: 'm' },
    fields: {
      [name]: { type: 'char', label: 'Named {customer}', help: 'Help: {{ customer }}', patternHint: 'Like {customer}' },
      lines: { type: 'one2many', label: 'Lines', relation: 'm.line', fields: { [name]: { type: 'char', label: 'Line {customer}' } }, lineDefaults: { [name]: `"{customer}"` } },
      tags: { type: 'many2many', label: 'Tags', relation: 'm.tag', fields: { [name]: { type: 'char', label: 'Linked {customer}' } }, createValues: { [name]: `"{customer}"` } },
    },
    on: { change: { [name]: [{ do: 'say', message: 'Changed: {customer}' }] } },
    layout: {
      type: 'sections',
      id: 'all',
      children: [{ type: 'section', id: 's', title: 'All', children: [{ type: 'field', id: 'f-named', field: name }, { type: 'field', id: 'f-lines', field: 'lines' }, { type: 'field', id: 'f-tags', field: 'tags' }] }],
    },
  };
}

/** A list's page holding the name where a list keys by field: its filter names, filter ranges, cells, optional columns, a related list's fields. */
function listPage(name: string) {
  return {
    fieldia: '0.13',
    id: 'listed',
    data: { kind: 'record', model: 'm' },
    fields: { [name]: { type: 'integer', label: 'Named {customer}' }, other: { type: 'char', label: 'Other' } },
    layout: {
      type: 'list',
      id: 'list',
      columns: [name, 'other'],
      search: 'fields',
      filterFields: [name],
      filterLabels: { [name]: 'Filter {customer}' },
      filterRanges: { [name]: { atLeast: [1, 2] } },
      cells: { [name]: { width: 12 } },
      optionalColumns: { [name]: 'show' },
      detail: { title: 'Detail', model: 'm.part', field: 'other', fields: { [name]: { type: 'char', label: 'Part {customer}' } }, columns: [name] },
    },
  };
}

describe('every name the walk reads a key by, as a name: a field’s, a line’s, a link’s, a list’s', () => {
  it('reads every name the walk tells apart, its sets’ included', () => {
    for (const name of [...NOT_TEXT, ...WORDS_BY_NAME, ...NAME_MAPS, 'title', 'label', 'help', 'options', 'map', 'card', 'layers', 'references', 'feedback', 'quiz', 'Label']) expect(READ_BY_NAME).toContain(name);
  });

  describe.each(READ_BY_NAME)('named %s', (name) => {
    for (const [kind, make] of [
      ['a record’s page', recordPage],
      ['a list’s page', listPage],
    ] as const) {
      it(`${kind}: its words found where a plain name’s are, written as written by literalPage, accepted, translated`, () => {
        const page = make(name);
        const plain = make(PLAIN);
        // The one walk finds the same words where it finds a plain name's.
        expect(said(page)).toEqual(said(plain));
        // literalPage writes each of them to show as written; the page check, refusing `{customer}` as it was, accepts it.
        expect(validatePage(page).ok).toBe(false);
        const literal = literalPage(page as unknown as Page);
        expect(words(literal)).toEqual(words(page).map(({ path, words }) => ({ path, words: literalWords(words) })));
        expect(validatePage(literal)).toMatchObject({ ok: true });
        // Names, values and data as they were: a link's new record's and a new line's starts are expressions, not words.
        expect(JSON.stringify(translatePage(literal, () => '·'))).toBe(JSON.stringify(translatePage(page as unknown as Page, () => '·')));
        // Translation: the words a translator works through (the designer's table) hold them, and a language applies them.
        const offered = pageWords(page as unknown as Page);
        for (const { words: said } of words(page)) expect(offered).toContain(said);
        expect(offered.some((said) => said.startsWith('"'))).toBe(false);
        const translated = localizePage({ ...(page as unknown as Page), translations: { ar: Object.fromEntries(offered.map((said) => [said, `AR ${said}`])) } }, 'ar');
        expect(words(translated)).toEqual(words(page).map(({ path, words }) => ({ path, words: `AR ${words}` })));
      });
    }
  });
});

// ---- every map of the format, found in its JSON Schema ---------------------------------------------------------------------

// A JSON Schema, read as JSON is.
type Schema = Record<string, any>;
/** A step into a map by name: its key, any name. */
const BY_NAME = Symbol('by name');
type Step = string | number | typeof BY_NAME;

/**
 * Every object the format holds under a map by name — the map's key `BY_NAME` in its steps — with the strings it holds
 * as words, and its kind: from the page's JSON Schema and each widget's settings' schema (under a field's `options`).
 * Its maps by name, each by the key that holds it. A widget's own settings (`options`: any key, any value) are settings, not names.
 */
function formatMaps() {
  const parts: { steps: Step[]; leaf: Record<string, unknown> }[] = [];
  const maps = new Map<string, string>();
  const walkSchema = (root: Schema, start: Step[]) => {
    const defs: Record<string, Schema> = root['$defs'] ?? {};
    const seen = new Map<Schema, number>();
    const visit = (given: Schema, steps: Step[]) => {
      let at = given;
      while (at?.['$ref']) at = at['$ref'] === '#' ? root : defs[at['$ref'].split('/').pop()];
      if (!at) return;
      const deep = steps.filter((step) => step === BY_NAME).length;
      // Each object of the schema once for each depth of maps it is reached at, so a layout holding itself ends.
      if ((seen.get(at) ?? -1) >= deep || steps.length > 40) return;
      seen.set(at, deep);
      for (const branch of [...(at['anyOf'] ?? []), ...(at['oneOf'] ?? [])]) visit(branch, steps);
      if (at['type'] === 'array' && at['items']) visit(at['items'], [...steps, 0]);
      if (at['type'] !== 'object') return;
      const props: Record<string, Schema> = at['properties'] ?? {};
      const map = at['additionalProperties'] && typeof at['additionalProperties'] === 'object' && !at['properties'] ? at['additionalProperties'] : null;
      const holder = [...steps].reverse().find((step) => typeof step === 'string') as string | undefined;
      if (map && holder !== undefined) maps.set(holder, steps.map((step) => (step === BY_NAME ? '*' : String(step))).join('.'));
      if (deep && Object.keys(props).length) {
        const leaf = Object.fromEntries(Object.entries(props).map(([name, inner]) => [name, inner['const'] ?? `${name} {customer}`]));
        parts.push({ steps, leaf });
      }
      for (const [name, inner] of Object.entries(props)) visit(inner, [...steps, name]);
      if (map) {
        if (deep) parts.push({ steps: [...steps, BY_NAME], leaf: {} });
        visit(map, [...steps, BY_NAME]);
      }
    };
    visit(root, start);
  };
  walkSchema(pageJsonSchema(), []);
  // Each widget's settings the format knows, where a field's part holds them.
  for (const [name, schema] of Object.entries(core)) {
    if (/(Options|Settings)Schema$/.test(name) && schema instanceof z.ZodType) walkSchema(z.toJSONSchema(schema, { target: 'draft-2020-12', unrepresentable: 'any' }) as Schema, ['layout', 'children', 0, 'options']);
  }
  return { parts, maps };
}

/** The value the steps lead to, its maps' keys by name given: `named(i)` for the i-th. */
function build(steps: Step[], leaf: unknown, named: (i: number) => string): unknown {
  let n = steps.filter((step) => step === BY_NAME).length;
  return steps.reduceRight<unknown>((inner, step) => (typeof step === 'number' ? [inner] : { [step === BY_NAME ? named(--n) : step]: inner }), leaf === undefined ? 'by name {customer}' : leaf);
}

describe('every map of the format, from its JSON Schema', () => {
  const { parts, maps } = formatMaps();

  it('finds the maps by name it has, and the walk knows each one: by name, of data, or of words', () => {
    expect([...maps.keys()]).toEqual(expect.arrayContaining(['fields', 'cells', 'filterLabels', 'filterRanges', 'optionalColumns', 'change', 'show', 'createValues', 'lineDefaults', 'translations', 'colours', 'fills']));
    const known = new Set([...NAME_MAPS, ...NOT_TEXT, ...WORDS_BY_NAME]);
    // One under data kept whole (a value's own maps, in `default` or a call's `params`) is data too.
    const unknown = [...maps].filter(([holder, at]) => !known.has(holder) && !at.split('.').some((step) => NOT_TEXT.has(step)));
    expect(unknown).toEqual([]);
  });

  it('reads each part in a map by any name as it reads it by a plain one, whatever the name', () => {
    expect(parts.length).toBeGreaterThan(100);
    const wrong: string[] = [];
    for (const { steps, leaf } of parts) {
      const value = Object.keys(leaf).length ? leaf : undefined;
      const maps = steps.filter((step) => step === BY_NAME).length;
      const plain = JSON.stringify(said(build(steps, value, () => PLAIN)));
      for (let i = 0; i < maps; i++) {
        for (const name of READ_BY_NAME) {
          const named = build(steps, value, (j) => (j === i ? name : PLAIN));
          if (JSON.stringify(said(named)) !== plain) wrong.push(`${steps.map((step) => (step === BY_NAME ? '*' : String(step))).join('.')} named ${name}`);
        }
      }
    }
    expect(wrong).toEqual([]);
  });
});
