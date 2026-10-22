/**
 * Make the phone part's table of countries (libs/widgets/src/lib/phone-table.ts) from libphonenumber's metadata, as
 * libphonenumber-js ships it (`metadata.max.json`, Google's PhoneNumberMetadata.xml read into JSON, Apache-2.0):
 *
 *   node tools/phone-table.mjs path/to/libphonenumber-js/metadata.max.json
 *
 * The table keeps what a phone box checks and shows, and no more — about a tenth of libphonenumber's own weight:
 *
 * - each country's code, its dialling code and the digit a number is dialled with at home (its trunk prefix);
 * - which lengths a number has by what it starts with — "10 digits after a 1 then 0, 1, 2 or 5" for Egypt's mobiles —
 *   worked out from every kind of number the country has (its fixed lines, mobiles, free calls…), to two digits, or
 *   three where several countries share a dialling code (+1's areas, +7's): enough to refuse a number one digit short,
 *   or one no number there starts with, and to say whose a +1 number is;
 * - how a number is written, in groups, at home and abroad, for the country whose dialling code it is;
 * - the starts its mobile numbers can have, to three digits — Egypt's 10, 11, 12 and 15 — so a fixed line is offered
 *   no WhatsApp: `*` where any number may be a mobile (+1's mobiles are written as its fixed lines) or the metadata
 *   names no mobiles, `-` where none is.
 *
 * Each line: `CODE dial trunk rule rules mobile [formats]`, where `rules` are `lengths:start|start…` joined with commas
 * — a length a digit, or a letter from `a` for 10 — and the starts a pattern of digits; `mobile` a pattern of starts, or
 * `*` or `-`; formats come on the dialling code's first country only, each `start/groups at home/groups abroad` joined
 * with `!`, a group a letter (`a` one digit, `b` two…) or a capital and a letter for a group of either length (`Gh`:
 * seven or eight), the rest as it is written.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const WORKSPACE = resolve(new URL('..', import.meta.url).pathname);
const OUT = join(WORKSPACE, 'libs/widgets/src/lib/phone-table.ts');
const source = process.argv[2];
if (!source) throw new Error('usage: node tools/phone-table.mjs path/to/libphonenumber-js/metadata.max.json');
const meta = JSON.parse(readFileSync(source, 'utf8'));
if (meta.version !== 4) throw new Error(`${source}: libphonenumber-js metadata of version 4 is read, not ${meta.version}`);

// ---- a pattern of digits read into a machine of states (only what libphonenumber's patterns use) -------------------

const ALL = 0x3ff;
/** A pattern read: digits (a mask of 0-9), one after another, one of several, or repeated. */
function parse(pattern) {
  let at = 0;
  const fail = (why) => {
    throw new Error(`${why} at ${at} in ${pattern}`);
  };
  const alternation = () => {
    const options = [sequence()];
    while (pattern[at] === '|') {
      at++;
      options.push(sequence());
    }
    return options.length === 1 ? options[0] : { alt: options };
  };
  const sequence = () => {
    const items = [];
    while (at < pattern.length && pattern[at] !== '|' && pattern[at] !== ')') items.push(quantified(atom()));
    return { seq: items };
  };
  const digitSet = () => {
    let mask = 0;
    let negate = false;
    if (pattern[at] === '^') {
      negate = true;
      at++;
    }
    while (pattern[at] !== ']') {
      if (at >= pattern.length) fail('an open class');
      if (pattern.startsWith('\\d', at)) {
        mask |= ALL;
        at += 2;
        continue;
      }
      const from = pattern[at++];
      if (!/\d/.test(from)) fail(`"${from}" in a class`);
      if (pattern[at] === '-' && pattern[at + 1] !== ']') {
        const to = pattern[at + 1];
        at += 2;
        for (let d = Number(from); d <= Number(to); d++) mask |= 1 << d;
      } else mask |= 1 << Number(from);
    }
    at++;
    return negate ? ALL & ~mask : mask;
  };
  const atom = () => {
    const c = pattern[at++];
    if (c === '(') {
      if (pattern.startsWith('?:', at)) at += 2;
      const inner = alternation();
      if (pattern[at++] !== ')') fail('an open group');
      return inner;
    }
    if (c === '[') return { set: digitSet() };
    if (c === '\\' && pattern[at] === 'd') {
      at++;
      return { set: ALL };
    }
    if (/\d/.test(c)) return { set: 1 << Number(c) };
    return fail(`"${c}"`);
  };
  const quantified = (node) => {
    const c = pattern[at];
    if (c === '?') return (at++, { rep: node, min: 0, max: 1 });
    if (c === '*') return (at++, { rep: node, min: 0, max: 18 });
    if (c === '+') return (at++, { rep: node, min: 1, max: 18 });
    if (c === '{') {
      const found = /^\{(\d+)(?:(,)(\d*))?\}/.exec(pattern.slice(at));
      if (!found) fail('a count');
      at += found[0].length;
      const min = Number(found[1]);
      return { rep: node, min, max: found[2] ? (found[3] ? Number(found[3]) : 18) : min };
    }
    return node;
  };
  const tree = alternation();
  if (at !== pattern.length) fail('a stray ")"');
  return tree;
}

/** A machine of states for one pattern or several (any of them): its start, its end, and each state's moves. */
function machine(patterns) {
  const states = [];
  const state = () => (states.push({ free: [], moves: [] }), states.length - 1);
  const build = (node) => {
    if ('set' in node) {
      const [a, b] = [state(), state()];
      states[a].moves.push([node.set, b]);
      return [a, b];
    }
    if ('seq' in node) {
      const [a, b] = [state(), state()];
      let last = a;
      for (const item of node.seq) {
        const [s, e] = build(item);
        states[last].free.push(s);
        last = e;
      }
      states[last].free.push(b);
      return [a, b];
    }
    if ('alt' in node) {
      const [a, b] = [state(), state()];
      for (const option of node.alt) {
        const [s, e] = build(option);
        states[a].free.push(s);
        states[e].free.push(b);
      }
      return [a, b];
    }
    const [a, b] = [state(), state()];
    let last = a;
    for (let i = 0; i < node.max; i++) {
      const [s, e] = build(node.rep);
      states[last].free.push(s);
      if (i >= node.min) states[last].free.push(b);
      last = e;
    }
    states[last].free.push(b);
    return [a, b];
  };
  const [start, end] = build({ alt: patterns.map(parse) });
  const close = (set) => {
    const seen = new Set(set);
    const todo = [...set];
    while (todo.length) {
      for (const next of states[todo.pop()].free) {
        if (seen.has(next)) continue;
        seen.add(next);
        todo.push(next);
      }
    }
    return seen;
  };
  const step = (set, mask) => {
    const next = new Set();
    for (const s of set) for (const [m, to] of states[s].moves) if (m & mask) next.add(to);
    return close(next);
  };
  return {
    start: close([start]),
    step,
    /** The lengths a number has, from `set` reached after `done` digits: up to 17 in all. */
    /** Whether a pattern of starts has matched by `set`. */
    done: (set) => set.has(end),
    lengths(set, done) {
      const found = [];
      let now = set;
      for (let n = done; n <= 17 && now.size; n++) {
        if (now.has(end)) found.push(n);
        now = step(now, ALL);
      }
      return found;
    },
  };
}

// ---- a country's lengths by its numbers' starts ---------------------------------------------------------------------

const lengthChars = (lengths) => lengths.map((n) => (n < 10 ? String(n) : String.fromCharCode(97 + n - 10))).join('');

/** Starts as a pattern: "10", "11", "12", "15" as 1[0-25]; a start of one digit alone as itself. */
function startsPattern(starts) {
  const tree = {};
  for (const start of starts) {
    let node = tree;
    for (const digit of start) node = node[digit] ??= {};
    node.end = true;
  }
  const digitsClass = (digits) => {
    if (digits.length === 1) return digits[0];
    const runs = [];
    for (const d of digits.map(Number)) {
      const run = runs[runs.length - 1];
      if (run && run[1] === d - 1) run[1] = d;
      else runs.push([d, d]);
    }
    return `[${runs.map(([a, b]) => (a === b ? a : b === a + 1 ? `${a}${b}` : `${a}-${b}`)).join('')}]`;
  };
  const write = (node) => {
    const digits = Object.keys(node).filter((key) => key !== 'end').sort();
    const ends = digits.filter((d) => node[d].end && Object.keys(node[d]).length === 1);
    const deeper = digits.filter((d) => !ends.includes(d));
    // The same continuation after several digits is written once, after their class.
    const byRest = new Map();
    for (const d of deeper) {
      const rest = write(node[d]);
      byRest.set(rest, [...(byRest.get(rest) ?? []), d]);
    }
    const options = [...(ends.length ? [digitsClass(ends)] : []), ...[...byRest].map(([rest, ds]) => digitsClass(ds) + rest)];
    return options.length === 1 ? options[0] : `(?:${options.join('|')})`;
  };
  const top = write(tree);
  return top.startsWith('(?:') && top.endsWith(')') && balanced(top.slice(3, -1)) ? top.slice(3, -1) : top;
}
/** Whether a pattern's brackets close as they open (so its outer group can go). */
function balanced(text) {
  let depth = 0;
  for (const c of text) {
    if (c === '(') depth++;
    if (c === ')' && --depth < 0) return false;
  }
  return depth === 0;
}

/**
 * A country's rules: for each set of lengths, the starts that have it, to `depth` digits. A country that shares its
 * dialling code with another (`main`, the code's first country) keeps only the starts that are none of the main's, to
 * three digits — Jamaica's 876 of +1, Kazakhstan's 7 of +7 — so a number is the main country's unless it starts as
 * another's; one whose starts are all the main's keeps them all.
 */
function rulesOf(patterns, depth, main) {
  const m = machine(patterns);
  const theirs = (prefix) => {
    if (!main) return false;
    let set = main.start;
    for (const d of prefix) set = main.step(set, 1 << Number(d));
    return main.lengths(set, prefix.length).length > 0;
  };
  const found = [];
  const visit = (prefix, set) => {
    const lengths = m.lengths(set, prefix.length);
    if (!lengths.length) return;
    // Past its depth, a start the main country has too is followed further, to six digits (Guernsey's 1481 of +44's 148…).
    if (prefix.length >= depth && !theirs(prefix)) return void found.push([prefix, lengths]);
    if (prefix.length >= (main ? 6 : depth)) return;
    const children = Array.from({ length: 10 }, (_, d) => {
      const next = m.step(set, 1 << d);
      return [String(d), next, m.lengths(next, prefix.length + 1).join()];
    });
    // Every digit next leads to the same lengths: decided here.
    if (prefix && !theirs(prefix) && children.every(([, , key]) => key === children[0][2])) return void found.push([prefix, lengths]);
    for (const [d, next] of children) visit(prefix + d, next);
  };
  visit('', m.start);
  if (main && !found.length) return rulesOf(patterns, depth);
  const byLengths = new Map();
  for (const [prefix, lengths] of found) {
    const key = lengthChars(lengths);
    byLengths.set(key, [...(byLengths.get(key) ?? []), prefix]);
  }
  return [...byLengths].map(([lengths, starts]) => `${lengths}:${startsPattern(starts)}`).join(',');
}

// ---- how numbers are written --------------------------------------------------------------------------------------

const groupLetter = (n) => String.fromCharCode(96 + n);
/** A format's groups, from its pattern: (\d{2})(\d{6,7}) is b and Fg. */
function groupsOf(pattern) {
  const groups = [];
  for (const [, inner] of pattern.matchAll(/\(([^()]*)\)/g)) {
    const counted = /^\\d(?:\{(\d+)(?:,(\d+))?\})?$/.exec(inner);
    if (!counted) return null;
    const min = Number(counted[1] ?? 1);
    const max = Number(counted[2] ?? min);
    if (max > 26) return null;
    groups.push(min === max ? groupLetter(min) : groupLetter(min).toUpperCase() + groupLetter(max));
  }
  return groups;
}
/** A format written with its groups' letters: "$1 $2-$3" with b, c, d is "b c-d". */
function written(format, groups) {
  if (/[a-zA-Z!/]/.test(format.replace(/\$\d/g, ''))) return null;
  // Every group, in order: a format that leaves one out (Argentina's mobiles at home drop their 9) is not kept.
  if ([...format.matchAll(/\$(\d)/g)].map(([, n]) => n).join('') !== groups.map((_, i) => i + 1).join('')) return null;
  return format.replace(/\$(\d)/g, (_, n) => groups[Number(n) - 1] ?? '');
}

const LEAD_DEPTH = Number(process.env.LEAD_DEPTH ?? 2);
/** The starts, to two digits, a format's pattern of starts can begin: its first pattern, the widest. */
function leadStarts(lead) {
  const m = machine([lead]);
  const found = [];
  const visit = (prefix, set) => {
    if (m.done(set) || (prefix.length === LEAD_DEPTH && set.size)) return true;
    if (!set.size) return false;
    const whole = Array.from({ length: 10 }, (_, d) => [String(d), visit(prefix + d, m.step(set, 1 << d))]);
    if (whole.every(([, all]) => all)) {
      // Every digit after it: the start itself, unless a deeper one was already taken.
      for (let i = found.length - 1; i >= 0 && found[i].startsWith(prefix) && found[i] !== prefix; i--) found.pop();
      return true;
    }
    for (const [d, all] of whole) if (all) found.push(prefix + d);
    return false;
  };
  return visit('', m.start) ? '' : startsPattern(found);
}

/** A rule for the first group at home, with ~ for its digits: "0~" puts the trunk digit before it, "(~)" brackets it, "~" leaves it. */
const homeRule = (entry, own) => (own || entry[6] || '$1').replace('$NP', entry[5] || '').replace('$FG', '$1').replace(/\$CC ?/, '').replace('$1', '~');

/** How a dialling code's numbers are written: each format's starts, its groups at home, abroad when not the same, and its own rule for the first group. */
function formatsOf(entry, rule) {
  const out = [];
  for (const format of entry[4] || []) {
    const [pattern, at, leading, ownRule, , intl] = format;
    const groups = groupsOf(pattern);
    const home = groups && written(at, groups);
    const abroad = groups && (intl === 'NA' ? home : written(intl || at, groups));
    if (!home || !abroad) continue;
    const own = homeRule(entry, ownRule);
    // Abroad, its groups apart with spaces alone (ITU-T E.123): written only where its groups are not home's.
    const spaced = (layout) => layout.replace(/[^A-Za-z]+/g, ' ').trim();
    const shape = `${home}${spaced(abroad) === spaced(home) ? '' : `;${spaced(abroad)}`}${own === rule ? '' : `=${own}`}`;
    const starts = leading?.length ? leadStarts(leading[0]) : '';
    // A format written as the one before it: one format, starting as either does.
    const last = out[out.length - 1];
    if (last && last.shape === shape && last.starts && starts) last.starts += `|${starts}`;
    else out.push({ starts, shape });
  }
  return out.map(({ starts, shape }) => `${starts}/${shape}`).join('!');
}

/** The rule most of a country's formats write their first group at home with. */
function usualRule(entry) {
  const counts = new Map();
  for (const format of entry[4] || []) {
    const rule = homeRule(entry, format[3]);
    counts.set(rule, (counts.get(rule) ?? 0) + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? homeRule(entry);
}

// ---- the table ----------------------------------------------------------------------------------------------------

/** Every kind of number a country has: its fixed lines', mobiles', free calls'… patterns (an empty one is its fixed lines', as +1's mobiles are). */
function patternsOf(entry) {
  const types = (entry[11] || []).filter((type) => type && Array.isArray(type));
  const patterns = types.map((type) => type[0] || types[0][0]).filter(Boolean);
  return patterns.length ? patterns : [entry[2]];
}

/**
 * The starts a country's mobile numbers can have, to three digits, as a pattern: `*` where any of its numbers can be
 * one — its mobiles written as its fixed lines (+1's), or no mobiles named, their kind unknown — and `-` where none
 * can. A start is taken where every number after it may be a mobile, or past three digits where some may: a number
 * that may be a mobile is never refused its WhatsApp.
 */
function mobileStarts(entry) {
  const types = entry[11] || [];
  const mobile = types[1];
  if (!Array.isArray(mobile)) return '*';
  const pattern = mobile[0] || types[0]?.[0];
  if (!pattern) return '*';
  const mobiles = machine([pattern]);
  const all = machine(patternsOf(entry));
  const found = [];
  const visit = (prefix, mine, any) => {
    if (!mobiles.lengths(mine, prefix.length).length) return;
    if (prefix.length >= 3) return void found.push(prefix);
    const next = Array.from({ length: 10 }, (_, d) => [String(d), mobiles.step(mine, 1 << d), all.step(any, 1 << d)]);
    // Every number after it may be a mobile, or there is none: decided here.
    if (next.every(([, m, a]) => mobiles.lengths(m, prefix.length + 1).length || !all.lengths(a, prefix.length + 1).length)) return void found.push(prefix);
    for (const [d, m, a] of next) visit(prefix + d, m, a);
  };
  visit('', mobiles.start, all.start);
  if (found.includes('')) return '*';
  return found.length ? startsPattern(found) : '-';
}

/** The prefixes a pattern of digits alone says ("0|80?": 0, 8, 80), up to three digits; none for one that rewrites the number (a group in brackets). */
function dialledWith(pattern) {
  if (!pattern || /[()]/.test(pattern)) return [];
  const m = machine([pattern]);
  const found = [];
  const visit = (prefix, set) => {
    if (!set.size) return;
    if (m.done(set) && prefix) found.push(prefix);
    if (prefix.length < 3) for (let d = 0; d < 10; d++) visit(prefix + d, m.step(set, 1 << d));
  };
  visit('', m.start);
  return found;
}

const lines = [];
const dialOf = {};
for (const [dial, countries] of Object.entries(meta.country_calling_codes)) for (const code of countries) dialOf[code] = dial;
for (const [dial, countries] of Object.entries(meta.country_calling_codes).sort(([a], [b]) => a.localeCompare(b))) {
  countries.forEach((code, i) => {
    const entry = meta.countries[code];
    if (!entry) return;
    const rules = rulesOf(patternsOf(entry), i > 0 ? 3 : 2, i > 0 ? machine(patternsOf(meta.countries[countries[0]])) : undefined);
    // The trunk digit, and the others a number is dialled with at home where a pattern of digits alone says them (Belarus's 8, 80 and 0).
    const trunk = [...new Set([entry[5] || '', ...dialledWith(entry[7])])].filter(Boolean).join(',');
    const rule = usualRule(i === 0 ? entry : meta.countries[countries[0]]);
    const formats = i === 0 ? formatsOf(entry, rule) : '';
    lines.push([code, dial, trunk || '-', rule.replace(/ /g, '_'), rules, mobileStarts(entry), ...(formats ? [formats] : [])].join(' '));
  });
}
const table = lines.join('\n');
if (/[`\\$]/.test(table.replace(/\\d/g, ''))) throw new Error('the table cannot sit in a template literal');

writeFileSync(
  OUT,
  `/**
 * Every country's phone numbers, as the phone part checks and writes them (phone-numbers.ts): made by
 * tools/phone-table.mjs from libphonenumber's metadata (Google's PhoneNumberMetadata.xml, Apache-2.0, as
 * libphonenumber-js ${meta.version === 4 ? '1.12' : ''} ships it). Do not edit by hand: run the tool again.
 *
 * A line a country: \`CODE dial trunk rule rules mobile [formats]\` — its ISO code, its dialling code, the digit a
 * number is dialled with at home (- for none), how the first group is written at home, the lengths its numbers have
 * by how they start (\`lengths:starts\`, a length a digit or a letter from a for 10), the starts its mobiles can
 * have (* any, - none), and, on a dialling code's first country, how its numbers are written in groups.
 */
export const PHONE_TABLE = \`${table.replace(/\\/g, '\\\\')}\`;
`
);
console.log(`${OUT}: ${lines.length} countries, ${(table.length / 1024).toFixed(1)} KB`);
