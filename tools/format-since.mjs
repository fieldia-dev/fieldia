/**
 * Which format each part of the page format came in, read from the format's own history: the JSON Schema of each format
 * version released (libs/core/schema/page.schema.json at the release commit whose shape tools/format-shapes.json
 * records for it), walked beside the current one. What it finds — for each place of the current schema, the format it
 * came in; for each value a setting takes, the format it came in; for each limit a format loosened, what it was before
 * — is tools/format-since.json, which page-shape.spec.ts writes into the schema the checks read (page-shape.ts), so
 * `lowestFormat` stamps a page with the lowest format it needs and a page is read by its stamp (the audit's R-M7).
 *
 *   node tools/format-since.mjs           say whether tools/format-since.json is what the history says
 *   node tools/format-since.mjs --write   write it (as a format is made: after `node tools/format-shape.mjs --record`)
 *
 * tools/format-since.test.mjs holds the file to the history, and every example page stamped with its lowest format to
 * that format's own schema, read by a JSON Schema validator: a page stamped lower than it needs would fail there.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { shapeOf } from './format-shape.mjs';
import { releasedVersions } from './release-notes.mjs';

const WORKSPACE = resolve(new URL('..', import.meta.url).pathname);
const FILE = 'tools/format-since.json';

/** Every format Fieldia has had, oldest first: FORMAT_VERSIONS in libs/core/src/lib/format/version.ts. */
export function formatVersions(workspace = WORKSPACE) {
  const source = readFileSync(join(workspace, 'libs/core/src/lib/format/version.ts'), 'utf8');
  const listed = /export const FORMAT_VERSIONS = \[([^\]]+)\]/.exec(source)?.[1];
  if (!listed) throw new Error('libs/core/src/lib/format/version.ts names no FORMAT_VERSIONS');
  return [...listed.matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

/**
 * The schema of each format released, by version: the first release commit whose schema has the shape
 * tools/format-shapes.json records for that format. The current format is the workspace's own.
 */
export function formatSchemas(workspace = WORKSPACE) {
  const git = (args) => execFileSync('git', args, { cwd: workspace, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] });
  const shapes = JSON.parse(readFileSync(join(workspace, 'tools/format-shapes.json'), 'utf8'));
  const versions = formatVersions(workspace);
  const current = versions[versions.length - 1];
  const found = new Map();
  for (const { version, commit } of releasedVersions(workspace)) {
    let schema;
    try {
      schema = JSON.parse(git(['show', `${commit}:libs/core/schema/page.schema.json`]));
    } catch {
      continue;
    }
    const shape = shapeOf(schema);
    const format = versions.find((one) => one !== current && shapes[one] === shape);
    if (format && !found.has(format)) found.set(format, { release: version, commit: commit.slice(0, 12), schema });
  }
  for (const format of versions.slice(0, -1)) if (!found.has(format)) throw new Error(`no release commit has format ${format}'s shape (${shapes[format]}): its history cannot be read`);
  return { versions, found, current: JSON.parse(readFileSync(join(workspace, 'libs/core/schema/page.schema.json'), 'utf8')) };
}

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const escape = (key) => String(key).replace(/~/g, '~0').replace(/\//g, '~1');
/** A node of a schema by its JSON pointer. */
const at = (schema, pointer) => pointer.split('/').slice(1).reduce((node, key) => node?.[key.replace(/~1/g, '/').replace(/~0/g, '~')], schema);
/** A pointer with its `$ref`s followed: the node it names, and its own pointer. */
function follow(schema, pointer) {
  let node = at(schema, pointer);
  for (let depth = 0; isObject(node) && typeof node.$ref === 'string' && depth < 32; depth++) {
    pointer = node.$ref.slice(1);
    node = at(schema, pointer);
  }
  return { node, pointer };
}

/**
 * What tells a union's branches apart: the key each names its kind by (`type`, `do`), else each one's JSON type, its
 * one value and its required keys together. Branches it cannot tell apart are told by nothing: none matches, and the
 * place is taken as come in later — a page stamped higher than it needs, never lower.
 */
function identity(siblings, schema) {
  const own = (one) => follow(schema, one).node;
  const props = (one) => (isObject(own(one)?.properties) ? own(one).properties : {});
  for (const key of Object.keys(props(siblings[0] ?? ''))) {
    const consts = siblings.map((one) => props(one)[key]?.const);
    if (consts.every((value) => typeof value === 'string') && new Set(consts).size === consts.length) return (one) => `${key}=${props(one)[key]?.const}`;
  }
  const idOf = (one) => {
    const node = own(one) ?? {};
    return [[node.type ?? '?'].flat().join('|'), node.const !== undefined ? `=${JSON.stringify(node.const)}` : '', [...(node.required ?? [])].sort().join(',')].join(':');
  };
  const ids = siblings.map(idOf);
  return (one) => {
    const id = idOf(one);
    return ids.filter((other) => other === id).length > 1 ? `${one}#ambiguous` : id;
  };
}

/** The constraints a format may loosen, compared place by place. */
const LIMITS = ['minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum', 'minLength', 'maxLength', 'minItems', 'maxItems', 'pattern', 'uniqueItems', 'multipleOf'];

/**
 * One older format's schema walked beside the current one: each place of the current schema it has not (`missing`),
 * each value it does not take (`values`), each limit it held otherwise (`limits`, the old one), each key it required
 * that the current one does not (`required`). A place reached from two of the older schema's places is missing where
 * either lacks it.
 */
function compare(current, old) {
  const missing = new Set();
  const values = new Map();
  const limits = [];
  const seen = new Set();
  const queue = [['', '']];
  const pair = (c, o) => {
    const key = `${c}\u0000${o}`;
    if (seen.has(key)) return;
    seen.add(key);
    queue.push([c, o]);
  };
  while (queue.length) {
    const [cAt, oAt] = queue.shift();
    const { node: c, pointer: cp } = follow(current, cAt);
    const { node: o, pointer: op } = follow(old, oAt);
    if (!isObject(c)) continue;
    // An older place that took anything — no schema, or `true` — took what is here.
    if (o === true || (isObject(o) && Object.keys(o).length === 0)) continue;
    // One that took nothing (`false`, `{ "not": {} }`), or none at all: this place came later. Said of the place itself
    // (its pointer before its `$ref` is read), never of the definition it names, which other places may have had.
    if (!isObject(o) || (isObject(o.not) && Object.keys(o.not).length === 0 && Object.keys(o).length === 1)) {
      missing.add(cAt);
      continue;
    }
    // Values a setting takes.
    if (c.enum || c.const !== undefined) {
      const taken = o.enum ?? (o.const !== undefined ? [o.const] : null);
      if (taken) for (const value of c.enum ?? [c.const]) if (!taken.some((one) => JSON.stringify(one) === JSON.stringify(value))) values.set(`${cp}\u0000${JSON.stringify(value)}`, true);
    }
    // Limits loosened, and keys required before that are not now.
    for (const limit of LIMITS) if (o[limit] !== undefined && JSON.stringify(o[limit]) !== JSON.stringify(c[limit]) && !tighter(limit, c[limit], o[limit])) limits.push({ at: cp, limit, was: o[limit] });
    // A type and keys required compared where the current place says a type: a branch that only adds a limit to the
    // object round it (`{ "required": ["optionsFrom"] }`) is compared as that object is, once.
    const cTypes = c.type === undefined ? null : [c.type].flat();
    const oTypes = o.type === undefined ? null : [o.type].flat();
    if (cTypes && oTypes && cTypes.some((one) => !oTypes.includes(one) && !(one === 'integer' && oTypes.includes('number')))) limits.push({ at: cp, limit: 'type', was: oTypes });
    const required = cTypes ? (o.required ?? []).filter((key) => !(c.required ?? []).includes(key)) : [];
    if (required.length) limits.push({ at: cp, limit: 'required', was: required });
    // The places beside.
    if (isObject(c.properties)) {
      for (const key of Object.keys(c.properties)) {
        const child = `${cp}/properties/${escape(key)}`;
        if (isObject(o.properties) && o.properties[key] !== undefined) pair(child, `${op}/properties/${escape(key)}`);
        else if (o.additionalProperties !== undefined && o.additionalProperties !== false) pair(child, `${op}/additionalProperties`);
        else if (o.additionalProperties === undefined && !isObject(o.properties)) pair(child, `${op}/additionalProperties`);
        else missing.add(child);
      }
    }
    for (const keyword of ['additionalProperties', 'items', 'propertyNames']) {
      if (!isObject(c[keyword])) continue;
      const child = `${cp}/${keyword}`;
      if (o[keyword] === undefined || o[keyword] === true) continue;
      if (o[keyword] === false) missing.add(child);
      else pair(child, `${op}/${keyword}`);
    }
    if (Array.isArray(c.prefixItems)) c.prefixItems.forEach((_, i) => (o.prefixItems?.[i] !== undefined ? pair(`${cp}/prefixItems/${i}`, `${op}/prefixItems/${i}`) : missing.add(`${cp}/prefixItems/${i}`)));
    for (const keyword of ['anyOf', 'oneOf']) {
      if (!Array.isArray(c[keyword])) continue;
      const mine = c[keyword].map((_, i) => `${cp}/${keyword}/${i}`);
      const theirs = Array.isArray(o.anyOf) ? o.anyOf.map((_, i) => `${op}/anyOf/${i}`) : Array.isArray(o.oneOf) ? o.oneOf.map((_, i) => `${op}/oneOf/${i}`) : [op];
      const mineId = identity(mine, current);
      const theirsId = identity(theirs, old);
      for (const branch of mine) {
        // An older place that is no union is its one branch, matched as one would be.
        const matched = theirs.length === 1 && !Array.isArray(o.anyOf) && !Array.isArray(o.oneOf) ? theirs.find((one) => compatible(follow(current, branch).node, follow(old, one).node)) : theirs.find((one) => theirsId(one) === mineId(branch));
        if (matched) pair(branch, matched);
        else missing.add(branch);
      }
    }
  }
  return { missing, values, limits };
}

/**
 * Whether the current limit holds tighter than the older one, so a value the current one takes the older one took:
 * a higher least, a lower most, a pattern made of the older one with a refusal before it (`^(?!…)` then the older).
 */
function tighter(limit, now, was) {
  if (now === undefined) return false;
  if (['minimum', 'exclusiveMinimum', 'minLength', 'minItems'].includes(limit)) return typeof now === 'number' && typeof was === 'number' && now >= was;
  if (['maximum', 'exclusiveMaximum', 'maxLength', 'maxItems'].includes(limit)) return typeof now === 'number' && typeof was === 'number' && now <= was;
  if (limit === 'pattern' && typeof now === 'string' && typeof was === 'string') return now.startsWith('^(?!') && now.endsWith(was.replace(/^\^/, ''));
  if (limit === 'uniqueItems') return now === true;
  return false;
}

/** A current union's branch and an older place that is no union: the same kind of value, by type and by kind named. */
function compatible(branch, old) {
  if (!isObject(branch) || !isObject(old)) return false;
  const types = (node) => [node.type ?? (node.const !== undefined ? typeof node.const : null)].flat();
  if (types(branch)[0] !== null && types(old)[0] !== null && !types(branch).some((one) => types(old).includes(one))) return false;
  for (const [key, schema] of Object.entries(branch.properties ?? {})) if (schema?.const !== undefined && old.properties?.[key]?.const !== undefined && old.properties[key].const !== schema.const) return false;
  return true;
}

/**
 * What the history says, as tools/format-since.json keeps it: the formats, the commit each was read at, and — by place
 * of the current schema (a JSON pointer into page.schema.json) — the format each place and each value came in, after
 * the first, and the limits each older format held where the current one is looser.
 */
export function formatSince(workspace = WORKSPACE) {
  const { versions, found, current } = formatSchemas(workspace);
  const places = {};
  const values = {};
  const before = {};
  // Oldest first: a place missing from a format came in the format after the newest that lacks it.
  versions.slice(0, -1).forEach((format, i) => {
    const { missing, values: lacking, limits } = compare(current, found.get(format).schema);
    const next = versions[i + 1];
    for (const place of missing) places[place] = next;
    for (const key of lacking.keys()) {
      const [place, value] = key.split('\u0000');
      (values[place] ??= {})[value] = next;
    }
    for (const { at: place, limit, was } of limits) ((before[place] ??= {})[limit] ??= []).push([next, was]);
  });
  // The format a page says it is in is the stamp itself, never a setting that came in one.
  delete values['/properties/fieldia'];
  // Of an older limit held alike through several formats, the newest says it: a value it refuses needs the format after.
  for (const by of Object.values(before)) {
    for (const [limit, held] of Object.entries(by)) by[limit] = held.filter(([, was], i) => i === held.length - 1 || JSON.stringify(held[i + 1][1]) !== JSON.stringify(was));
  }
  const sorted = (record) => Object.fromEntries(Object.entries(record).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
  // Each place's own: the root itself is never missing; a place under one that came later is at least as late.
  return {
    formats: versions,
    commits: Object.fromEntries(versions.slice(0, -1).map((format) => [format, `${found.get(format).release} ${found.get(format).commit}`])),
    places: sorted(places),
    values: sorted(Object.fromEntries(Object.entries(values).map(([place, by]) => [place, sorted(by)]))),
    before: sorted(Object.fromEntries(Object.entries(before).map(([place, by]) => [place, sorted(by)]))),
  };
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  const made = `${JSON.stringify(formatSince(), null, 1)}\n`;
  if (process.argv[2] === '--write') {
    writeFileSync(join(WORKSPACE, FILE), made);
    console.log(`format-since: ${FILE} written`);
  } else {
    const kept = readFileSync(join(WORKSPACE, FILE), 'utf8');
    if (kept !== made) {
      console.error(`format-since: ${FILE} is not what the format's history says: \`node tools/format-since.mjs --write\`, then \`UPDATE_SHAPE=1 npx nx test core\``);
      process.exit(1);
    }
    console.log(`format-since: ${FILE} is what the format's history says`);
  }
}
