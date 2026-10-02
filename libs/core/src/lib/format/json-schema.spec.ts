import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import Ajv2020 from 'ajv/dist/2020';
import { pageJsonSchema } from '../../index';

/**
 * The JSON Schema file is what tools outside JavaScript see: editors, other
 * languages, the designer's own checks. It is generated from the same
 * definitions validatePage uses, checked in, and must never drift.
 *
 * To regenerate after changing the format: UPDATE_SCHEMA=1 npx nx test core
 */
const SCHEMA_FILE = join(__dirname, '..', '..', '..', 'schema', 'page.schema.json');
const EXAMPLES = join(__dirname, '..', '..', '..', '..', '..', 'examples', 'pages');

describe('page.schema.json', () => {
  const generated = JSON.stringify(pageJsonSchema(), null, 2) + '\n';

  it('matches the format definitions', () => {
    if (process.env['UPDATE_SCHEMA']) writeFileSync(SCHEMA_FILE, generated);
    expect(readFileSync(SCHEMA_FILE, 'utf8')).toBe(generated);
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
