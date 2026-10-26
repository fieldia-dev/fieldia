/**
 * Each setting's words in the page format's JSON Schema, from one source: the docs of the format's own TypeScript
 * types — the `Page` interface and every type it holds, their JSDoc, which an editor shows as a page is written in
 * TypeScript — read by the TypeScript checker beside the JSON Schema the zod definitions make, setting by setting (the
 * audit's agent help: "273 KB with 87 $defs and only 3 descriptions"). Each one is written into page.schema.json as
 * that setting's `description` (json-schema.spec.ts makes the rest of the file, and keeps these as they are).
 *
 *   node tools/schema-words.mjs           say whether page.schema.json's settings carry what the types' docs say
 *   node tools/schema-words.mjs --write   write them (after `UPDATE_SCHEMA=1 npx nx test core` changed the schema)
 *
 * tools/schema-words.test.mjs holds the file to the types, and every setting of the schema to having its words.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import ts from 'typescript';

const WORKSPACE = resolve(new URL('..', import.meta.url).pathname);
const FILE = 'libs/core/schema/page.schema.json';
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const escape = (key) => String(key).replace(/~/g, '~0').replace(/\//g, '~1');

/** The checker over @fieldia/core's own source, and the `Page` type. */
function pageType(workspace) {
  const config = ts.readConfigFile(join(workspace, 'libs/core/tsconfig.lib.json'), ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, join(workspace, 'libs/core'));
  const program = ts.createProgram({ rootNames: [join(workspace, 'libs/core/src/lib/format/page.ts')], options: { ...parsed.options, noEmit: true } });
  const checker = program.getTypeChecker();
  const source = program.getSourceFile(join(workspace, 'libs/core/src/lib/format/page.ts'));
  const symbol = checker.getExportsOfModule(checker.getSymbolAtLocation(source)).find((one) => one.name === 'Page');
  return { checker, type: checker.getDeclaredTypeOfSymbol(symbol) };
}

/** A symbol's docs, in plain words: its JSDoc's text, its tags left out, one line. */
function docsOf(symbol, checker) {
  const text = ts.displayPartsToString(symbol.getDocumentationComment(checker)).replace(/\s+/g, ' ').trim();
  return text || null;
}

/**
 * A setting that names its part's kind (`"type": "date"`, `"do": "open"`) said by the docs of the part it names: the
 * interface or the schema it is declared in, where it has none of its own.
 */
function kindDocs(symbol, checker) {
  const declared = symbol.declarations?.[0];
  if (!declared || !(checker.getTypeOfSymbol(symbol).flags & ts.TypeFlags.StringLiteral)) return null;
  for (let node = declared.parent, depth = 0; node && depth < 12; node = node.parent, depth++) {
    if ((ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node) || ts.isVariableDeclaration(node)) && node.name) {
      const own = checker.getSymbolAtLocation(node.name);
      const said = own && docsOf(own, checker);
      if (said) return said;
    }
  }
  return null;
}

/**
 * The words of every setting of the schema, by pointer: the schema walked beside the type — a property's words its
 * own docs; a union's branch by the kind it names (`type`, `do`), else its JSON type; an array's items, a map's values
 * — each pair of a place and a type once.
 */
export function schemaWords(workspace = WORKSPACE) {
  const schema = JSON.parse(readFileSync(join(workspace, 'libs/core/schema/page.schema.json'), 'utf8'));
  const { checker, type } = pageType(workspace);
  const words = {};
  const seen = new Set();
  const at = (pointer) => pointer.split('/').slice(1).reduce((node, key) => node?.[key.replace(/~1/g, '/').replace(/~0/g, '~')], schema);
  const ids = new Map();
  const idOf = (one) => {
    if (!ids.has(one)) ids.set(one, ids.size);
    return ids.get(one);
  };
  const strip = (one) => (one && one.isUnion() ? checker.getNonNullableType(one) : one);
  const kindOf = (one) => {
    if (!one) return '?';
    if (one.flags & ts.TypeFlags.StringLike) return 'string';
    if (one.flags & ts.TypeFlags.NumberLike) return 'number';
    if (one.flags & ts.TypeFlags.BooleanLike) return 'boolean';
    if (checker.isArrayType(one) || checker.isTupleType(one)) return 'array';
    if (one.flags & ts.TypeFlags.Object) return 'object';
    return '?';
  };
  const walk = (pointer, given) => {
    let node = at(pointer);
    let place = pointer;
    for (let depth = 0; isObject(node) && typeof node.$ref === 'string' && depth < 32; depth++) {
      place = node.$ref.slice(1);
      node = at(place);
    }
    const tsType = strip(given);
    if (!isObject(node) || !tsType) return;
    const key = `${place}\u0000${idOf(tsType)}`;
    if (seen.has(key)) return;
    seen.add(key);
    if (isObject(node.properties)) {
      for (const name of Object.keys(node.properties)) {
        const child = `${place}/properties/${escape(name)}`;
        const prop = checker.getPropertyOfType(tsType, name) ?? (tsType.isUnion() ? tsType.types.map((one) => checker.getPropertyOfType(one, name)).find(Boolean) : undefined);
        if (!prop) continue;
        const said = docsOf(prop, checker) ?? kindDocs(prop, checker);
        if (said && words[child] === undefined) words[child] = said;
        walk(child, checker.getTypeOfSymbol(prop));
      }
    }
    for (const keyword of ['anyOf', 'oneOf']) {
      if (!Array.isArray(node[keyword])) continue;
      const parts = tsType.isUnion() ? tsType.types : [tsType];
      node[keyword].forEach((branch, i) => {
        const pointerOf = `${place}/${keyword}/${i}`;
        let target = branch;
        for (let depth = 0; isObject(target) && typeof target.$ref === 'string' && depth < 32; depth++) target = at(target.$ref.slice(1));
        // By the kind it names: a property whose one value is this branch's.
        const named = isObject(target?.properties) ? Object.entries(target.properties).find(([, one]) => one?.const !== undefined) : null;
        // Else by its JSON type — and among objects, the one that has the most of its settings.
        const kind = [target?.type ?? (target?.const !== undefined ? typeof target.const : '?')].flat()[0];
        const settings = isObject(target?.properties) ? Object.keys(target.properties) : [];
        const fits = (one) => settings.filter((name) => checker.getPropertyOfType(one, name)).length;
        const match = named
          ? parts.find((one) => {
              const prop = checker.getPropertyOfType(one, named[0]);
              const literal = prop && checker.getTypeOfSymbol(prop);
              return literal && literal.isLiteral?.() && literal.value === named[1].const;
            })
          : (parts.filter((one) => kindOf(one) === kind).sort((a, b) => fits(b) - fits(a))[0] ?? (parts.length === 1 ? parts[0] : undefined));
        if (match) walk(pointerOf, match);
      });
    }
    if (isObject(node.items)) {
      const element = checker.isArrayType(tsType) ? checker.getTypeArguments(tsType)[0] : checker.getIndexTypeOfType(tsType, ts.IndexKind.Number);
      if (element) walk(`${place}/items`, element);
    }
    if (isObject(node.additionalProperties)) {
      const value = checker.getIndexTypeOfType(tsType, ts.IndexKind.String);
      if (value) walk(`${place}/additionalProperties`, value);
    }
  };
  walk('', type);
  return Object.fromEntries(Object.entries(words).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

/** Every setting of the schema — each property of each object it holds — by pointer. */
export function settingsOf(schema) {
  const out = [];
  const walk = (node, pointer) => {
    if (Array.isArray(node)) return node.forEach((one, i) => walk(one, `${pointer}/${i}`));
    if (!isObject(node)) return;
    for (const [key, value] of Object.entries(node)) {
      if (key === 'properties' && isObject(value)) {
        for (const [name, inner] of Object.entries(value)) {
          out.push(`${pointer}/properties/${escape(name)}`);
          walk(inner, `${pointer}/properties/${escape(name)}`);
        }
      } else if (key === '$defs' && isObject(value)) for (const [name, inner] of Object.entries(value)) walk(inner, `${pointer}/$defs/${escape(name)}`);
      // A dependent schema only adds a limit to the object round it ("multiple" with "minFiles"): its keys are no setting.
      else if (!['enum', 'const', 'examples', 'default', 'required', 'dependentSchemas'].includes(key)) walk(value, `${pointer}/${escape(key)}`);
    }
  };
  walk(schema, '');
  return out;
}

/** The settings of a schema that carry no words: each one's pointer. */
export function wordless(schema) {
  const at = (pointer) => pointer.split('/').slice(1).reduce((node, key) => node?.[key.replace(/~1/g, '/').replace(/~0/g, '~')], schema);
  return settingsOf(schema).filter((pointer) => {
    const node = at(pointer);
    return !isObject(node) || typeof node.description !== 'string' || !node.description.trim();
  });
}

/**
 * page.schema.json with each setting's words its `description`: a setting the zod definitions describe themselves
 * keeps theirs. As the file is written, two spaces deep.
 */
export function describedSchema(workspace = WORKSPACE) {
  const schema = JSON.parse(readFileSync(join(workspace, FILE), 'utf8'));
  const words = schemaWords(workspace);
  const at = (pointer) => pointer.split('/').slice(1).reduce((node, key) => node?.[key.replace(/~1/g, '/').replace(/~0/g, '~')], schema);
  const own = JSON.parse(readFileSync(join(workspace, FILE), 'utf8'));
  for (const pointer of settingsOf(schema)) {
    const node = at(pointer);
    if (!isObject(node)) continue;
    // What the file had from the definitions themselves: none is a setting's word of the types'.
    const kept = pointer.split('/').slice(1).reduce((one, key) => one?.[key.replace(/~1/g, '/').replace(/~0/g, '~')], own);
    if (words[pointer] !== undefined && (kept?.description === undefined || kept.description === node.description)) node.description = words[pointer];
  }
  return `${JSON.stringify(schema, null, 2)}\n`;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  const made = describedSchema();
  if (process.argv[2] === '--write') {
    writeFileSync(join(WORKSPACE, FILE), made);
    console.log(`schema-words: ${FILE}'s settings carry their words`);
  } else if (readFileSync(join(WORKSPACE, FILE), 'utf8') !== made) {
    console.error(`schema-words: ${FILE}'s settings do not carry what the format's types say: \`node tools/schema-words.mjs --write\``);
    process.exit(1);
  } else console.log(`schema-words: ${FILE}'s settings carry what the format's types say`);
}
