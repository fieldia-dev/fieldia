/**
 * A field's `pattern`, as it is checked: about the whole answer, not a part
 * of it — "[0-9]{5}" takes "11511" and never "ab11511cd", as an answer
 * rule's pattern and the browser's own `pattern` attribute do — and read with
 * Unicode (`u`), so `\p{L}` is any letter. A pattern written before patterns
 * were read with Unicode, which only reads without it (an escaped "\-" outside
 * a class), is read as it was written. A pattern that does not read at all
 * is the reason why, for checkPage to name: a check never throws on one.
 *
 * Nor one that can take a browser — or a server checking the same answer —
 * seconds on a short answer: a pattern is refused (`patternRisk`) where a part
 * that repeats holds a repeat that can take the same characters its next round
 * starts with (`([a-z]+\s?)*`, `(a+)+`), may match nothing (`(a?)*`) or has
 * choices starting alike (`(a|ab)*`), or where two repeats without end stand
 * side by side, only optional parts between them, the second able to start with
 * what the first takes (`\d+\d+`, `\w+\s*\w+`). It accepts every pattern whose
 * repeats each start with what the one before cannot take: `(-[A-Za-z0-9]{2,8})*`,
 * `[^@\s]+@[^@\s]+\.[^@\s]+`, `( ?[A-Za-z0-9]){10,30}`. And no answer longer
 * than `PATTERN_MOST` characters is tried against a pattern: it is refused as
 * not of its pattern.
 */
export function fieldPattern(pattern: string): RegExp | Error {
  return whole(pattern, true);
}

/** An answer rule's pattern (`validate[].pattern`): read as it is written, without Unicode, as rules always were; refused as a field's is. */
export function rulePattern(pattern: string): RegExp | Error {
  return whole(pattern, false);
}

/** The most characters of an answer a pattern is tried on: more is refused as not of its pattern, never tried. */
export const PATTERN_MOST = 1000;

const compiled = new Map<string, RegExp | Error>();

function whole(pattern: string, unicode: boolean): RegExp | Error {
  const key = `${unicode ? 'u' : ''}:${pattern}`;
  const found = compiled.get(key);
  if (found) return found;
  let made: RegExp | Error;
  try {
    made = new RegExp(`^(?:${pattern})$`, unicode ? 'u' : '');
  } catch (error) {
    try {
      made = new RegExp(`^(?:${pattern})$`);
    } catch {
      made = error as Error;
    }
  }
  if (made instanceof RegExp) {
    const risk = patternRisk(pattern, made.flags);
    if (risk) made = new Error(`it can take seconds on a short answer: ${risk}`);
  }
  compiled.set(key, made);
  return made;
}

/** The characters each part of a pattern is tried against, to tell whether two parts can take the same one. */
const PROBE = [9, 10, 0xa0, 0xe9, 0xdf, 0x628, 0x645, 0x663, 0x4e2d, ...Array.from({ length: 95 }, (_, i) => 32 + i)].map((code) => String.fromCharCode(code));
/** Whether two sets of the probe's characters share one. */
const meet = (a: string, b: string) => [...a].some((c) => b.includes(c));
const join = (a: string, b: string) => a + [...b].filter((c) => !a.includes(c)).join('');
/** A pattern's parts: an escape, a class, a group's start, a repeat, or one character. */
const TOKEN = /\\[pPk][{<][^}>]*[}>]|\\u\{[^}]*\}|\\x..|\\u.{4}|\\c.|\\.|\[(?:\\.|[^\]\\])*\]|\(\?(?:[:=!]|<[=!]|<[^>]*>)?|[*+?]\??|\{\d+(?:,\d*)?\}\??|[\s\S]/gu;

/**
 * What a part of a pattern can do: the characters it may start with, all it may take, those a repeat inside it may
 * still be taking as it ends, whether it may match nothing, whether two of its choices may start alike, and whether a
 * repeat inside it is followed, before anything that sets it apart, by a part that can take what it takes.
 */
interface Reach {
  first: string;
  all: string;
  tail: string;
  empty: boolean;
  alike?: boolean;
  inner?: boolean;
}
const NOTHING: Reach = { first: '', all: '', tail: '', empty: true };

/**
 * Why a pattern can backtrack for seconds, in words, or null: read part by part — a character, a class, an escape, a
 * group and its choices, each with how often it repeats.
 */
export function patternRisk(pattern: string, flags = 'u'): string | null {
  const tokens = pattern.match(TOKEN) ?? [];
  let at = 0;
  let risk: string | null = null;
  /** The probe's characters a part matches (a brace alone as itself, as a pattern without Unicode takes one). */
  const charsOf = (part: string) => {
    try {
      const one = new RegExp(`^(?:${part.replace(/^[{}\]]$/, '\\$&')})$`, flags);
      return PROBE.filter((c) => one.test(c)).join('');
    } catch {
      return PROBE.join('');
    }
  };
  /** Choices, to the end or the group's `)`. */
  const choices = (): Reach => {
    const each = [sequence()];
    while (tokens[at] === '|' && ++at) each.push(sequence());
    const reach = each.reduce((a, b) => ({ first: join(a.first, b.first), all: join(a.all, b.all), tail: join(a.tail, b.tail), empty: a.empty || b.empty }));
    return { ...reach, alike: each.some((one, i) => each.slice(i + 1).some((other) => meet(one.first, other.first))) };
  };
  const sequence = (): Reach => {
    const parts: (Reach & { max: number })[] = [];
    while (at < tokens.length && tokens[at] !== '|' && tokens[at] !== ')') {
      const token = tokens[at++];
      // A group (a look ahead or behind takes nothing); a start, an end or a word's edge takes nothing; else what it takes.
      let part = NOTHING;
      if (token[0] === '(') {
        const inner = choices();
        at++;
        if (!/^\(\?<?[=!]$/.test(token)) part = inner;
      } else if (!/^(\^|\$|\\[bB])$/.test(token)) part = { first: charsOf(token), all: charsOf(token), tail: '', empty: false };
      // How often it repeats: its least and its most.
      const repeat = /^([*+?])|^\{(\d+)(,(\d*))?/.exec(tokens[at] ?? '');
      if (repeat) at++;
      const [min, max] = !repeat ? [1, 1] : repeat[1] ? [repeat[1] === '+' ? 1 : 0, repeat[1] === '?' ? 1 : Infinity] : [+repeat[2], repeat[3] === undefined ? +repeat[2] : repeat[4] ? +repeat[4] : Infinity];
      if (max > 1 && (part.empty || part.inner || part.alike || meet(part.tail, part.first))) risk ??= 'a part that repeats can match the same characters more than one way.';
      parts.push({ ...part, empty: min === 0 || part.empty, max });
    }
    let reach = NOTHING;
    parts.forEach((part, i) => {
      // What a repeat — this part's own, or one ending inside it — takes, read on past the parts after it: one that can
      // take the same characters makes two ways; one that cannot, and must match, sets it apart.
      const taking = part.max > 1 ? part.all : part.tail;
      let open = !!taking;
      for (const next of parts.slice(i + 1)) {
        if (!open) break;
        if (meet(taking, next.first)) {
          reach = { ...reach, inner: true };
          if (part.max === Infinity && next.max === Infinity) risk ??= 'two repeats side by side can take the same characters.';
        }
        open = next.empty;
      }
      reach = {
        first: reach.empty ? join(reach.first, part.first) : reach.first,
        all: join(reach.all, part.all),
        tail: join(part.empty ? reach.tail : '', open ? taking : ''),
        empty: reach.empty && part.empty,
        inner: reach.inner || part.inner,
      };
    });
    return reach;
  };
  choices();
  return risk;
}
