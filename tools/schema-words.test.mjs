/**
 * The page format's JSON Schema describes each setting (the audit's agent help), from one source — the docs of the
 * format's own TypeScript types — and never drifts from them.
 *   node --test tools/schema-words.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describedSchema, schemaWords, settingsOf, wordless } from './schema-words.mjs';

const WORKSPACE = resolve(new URL('..', import.meta.url).pathname);
const kept = readFileSync(join(WORKSPACE, 'libs/core/schema/page.schema.json'), 'utf8');

test('page.schema.json carries each setting\'s words as the format\'s types say them', () => {
  assert.equal(kept, describedSchema(WORKSPACE), 'run `node tools/schema-words.mjs --write`');
});

test('every setting of the format has its words: none is left undescribed', () => {
  const schema = JSON.parse(kept);
  assert.ok(settingsOf(schema).length > 1500, 'the settings read');
  assert.deepEqual(wordless(schema), [], 'document each in the format\'s TypeScript types (libs/core/src/lib/format), then `node tools/schema-words.mjs --write`');
});

test('the check bites: a setting whose docs are gone is said, by its place', () => {
  const schema = JSON.parse(kept);
  delete schema.$defs.Field.oneOf[0].properties.label.description;
  assert.deepEqual(wordless(schema), ['/$defs/Field/oneOf/0/properties/label']);
  // And the words come from the types: a field's label is what `common.label`'s JSDoc says.
  assert.match(schemaWords(WORKSPACE)['/$defs/Field/oneOf/0/properties/label'], /^Its name, as the person reads it beside its box/);
});
