import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import Ajv2020 from 'ajv/dist/2020';
import { pageJsonSchema } from '../../index';

/**
 * The JSON Schema file is what tools outside JavaScript see: editors, other
 * languages, the designer's own checks. It is generated from the same
 * definitions validatePage uses, checked in, and must never drift.
 *
 * Each setting carries its words, from the docs of the format's TypeScript types, written into it by
 * tools/schema-words.mjs (and held there by tools/schema-words.test.mjs).
 *
 * To regenerate after changing the format: UPDATE_SCHEMA=1 npx nx test core
 */
const SCHEMA_FILE = join(__dirname, '..', '..', '..', 'schema', 'page.schema.json');
const EXAMPLES = join(__dirname, '..', '..', '..', '..', '..', 'examples', 'pages');
/**
 * Every setting of a schema — each property of each object it holds, a dependent schema's keys none — by pointer,
 * as tools/schema-words.mjs reads them.
 */
function settingsOf(schema: unknown, pointer = '', out: string[] = []): string[] {
  if (Array.isArray(schema)) schema.forEach((one, i) => settingsOf(one, `${pointer}/${i}`, out));
  else if (schema && typeof schema === 'object') {
    for (const [key, value] of Object.entries(schema)) {
      const own = key.replace(/~/g, '~0').replace(/\//g, '~1');
      if (key === 'properties' && value && typeof value === 'object') {
        for (const [name, inner] of Object.entries(value)) {
          const at = `${pointer}/properties/${name.replace(/~/g, '~0').replace(/\//g, '~1')}`;
          out.push(at);
          settingsOf(inner, at, out);
        }
      } else if (!['enum', 'const', 'examples', 'default', 'required', 'dependentSchemas'].includes(key)) settingsOf(value, `${pointer}/${own}`, out);
    }
  }
  return out;
}
const at = (schema: unknown, pointer: string) => pointer.split('/').slice(1).reduce<unknown>((node, key) => (node as Record<string, unknown> | undefined)?.[key.replace(/~1/g, '/').replace(/~0/g, '~')], schema) as Record<string, unknown> | undefined;
/** The schema without the words tools/schema-words.mjs writes for each setting from the types' docs. */
function withoutSettingWords(schema: Record<string, unknown>, generated: Record<string, unknown>): Record<string, unknown> {
  const copy = JSON.parse(JSON.stringify(schema)) as Record<string, unknown>;
  for (const pointer of settingsOf(copy)) {
    const node = at(copy, pointer);
    // The definitions' own description stays: only what the types' docs gave is left out.
    if (node && node['description'] !== undefined && at(generated, pointer)?.['description'] === undefined) delete node['description'];
  }
  return copy;
}

describe('page.schema.json', () => {
  const made = pageJsonSchema();
  const generated = JSON.stringify(made, null, 2) + '\n';

  it('matches the format definitions, each setting with its words (tools/schema-words.mjs)', () => {
    // Made again: each setting's words kept where the setting still is, for tools/schema-words.mjs to bring up to date.
    if (process.env['UPDATE_SCHEMA']) {
      const kept = JSON.parse(readFileSync(SCHEMA_FILE, 'utf8')) as Record<string, unknown>;
      const next = JSON.parse(generated) as Record<string, unknown>;
      for (const pointer of settingsOf(next)) {
        const node = at(next, pointer);
        const words = at(kept, pointer)?.['description'];
        if (node && node['description'] === undefined && typeof words === 'string') node['description'] = words;
      }
      writeFileSync(SCHEMA_FILE, JSON.stringify(next, null, 2) + '\n');
    }
    const file = JSON.parse(readFileSync(SCHEMA_FILE, 'utf8')) as Record<string, unknown>;
    expect(JSON.stringify(withoutSettingWords(file, made), null, 2) + '\n').toBe(generated);
  });

  it('validates the example pages with a standard JSON Schema validator', () => {
    const ajv = new Ajv2020({ allErrors: true, strict: false });
    const validate = ajv.compile(JSON.parse(readFileSync(SCHEMA_FILE, 'utf8')));
    for (const name of readdirSync(EXAMPLES).filter((f) => f.endsWith('.page.json'))) {
      const page = JSON.parse(readFileSync(join(EXAMPLES, name), 'utf8'));
      expect({ name, ok: validate(page), errors: validate.errors ?? null }).toEqual({ name, ok: true, errors: null });
    }
  });

  it('rejects a key the format does not define', () => {
    const ajv = new Ajv2020({ allErrors: true, strict: false });
    const validate = ajv.compile(JSON.parse(readFileSync(SCHEMA_FILE, 'utf8')));
    const page = JSON.parse(readFileSync(join(EXAMPLES, 'survey.page.json'), 'utf8'));
    page.layout.children[0].onEnter = 'run()';
    expect(validate(page)).toBe(false);
  });
});
