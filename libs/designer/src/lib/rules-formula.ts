import { compileModifier, createForm, type Field, type Page } from '@fieldia/core';

/**
 * A formula as a person types it — "Worked out from" a field's value, or a
 * value to set when something holds: what is wrong with it and where (by
 * character, counted from 1, as an editor counts them), what it reads, how it
 * reads in words, and what it gives on made-up values. The page's own parser
 * decides what reads; this only says where it stopped, and in words.
 */

/** What is wrong, and the characters it is about, from 1; none when it is about the whole. */
export interface FormulaProblem {
  words: string;
  from?: number;
  to?: number;
}

/** A piece of a formula, and where it is: `from` and `to` count characters from 0, `to` not included. */
export interface FormulaToken {
  kind: 'name' | 'number' | 'text' | 'list' | 'sign' | 'word' | 'open' | 'close' | 'comma';
  text: string;
  from: number;
  to: number;
}

/** The same pieces, in the same order, as the page's own reader takes them. */
const PIECE = /(\(|\)|,|==|!=|<=|>=|<>|<|>|[-+*/%]|not\s+in\b|in\b|and\b|or\b|not\b|\[[^\]]*\]|'[^']*'|"[^"]*"|\d+\.?\d*|\w+(?:\.\w+)*)/iy;
const SPACE = /\s*/y;
const WORDS = new Set(['and', 'or', 'not', 'in']);
const CONSTANTS = new Set(['True', 'False', 'None', 'true', 'false', 'null']);

function kindOf(text: string): FormulaToken['kind'] {
  if (text === '(') return 'open';
  if (text === ')') return 'close';
  if (text === ',') return 'comma';
  if (text.startsWith('[')) return 'list';
  if (text.startsWith("'") || text.startsWith('"')) return 'text';
  if (/^\d/.test(text)) return 'number';
  if (WORDS.has(text.toLowerCase().split(/\s+/)[0]) || CONSTANTS.has(text)) return 'word';
  if (/^\w/.test(text)) return 'name';
  return 'sign';
}

/** The pieces of a formula, or the character it cannot read. */
export function formulaTokens(source: string): FormulaToken[] | { bad: number } {
  const tokens: FormulaToken[] = [];
  let at = 0;
  for (;;) {
    SPACE.lastIndex = at;
    SPACE.exec(source);
    at = SPACE.lastIndex;
    if (at >= source.length) return tokens;
    PIECE.lastIndex = at;
    const match = PIECE.exec(source);
    if (!match) return { bad: at };
    tokens.push({ kind: kindOf(match[0]), text: match[0], from: at, to: PIECE.lastIndex });
    at = PIECE.lastIndex;
  }
}

/** "Unknown field “prise” at 1–5": the words, and where, as they are shown under the box. */
export function problemWords(problem: FormulaProblem | null): string {
  if (!problem) return '';
  if (problem.from === undefined) return problem.words;
  const at = problem.to === undefined || problem.to === problem.from ? `${problem.from}` : `${problem.from}–${problem.to}`;
  // Words that go on past the place end in a comma of their own: "“round” takes 1 or 2 values, at 9–13".
  return `${problem.words} at ${at}`;
}

const place = (token: FormulaToken) => ({ from: token.from + 1, to: token.to });

/** A field called as a function is a function: "round(" is not a field "round". */
const calls = (tokens: FormulaToken[], i: number) => tokens[i + 1]?.kind === 'open';

/** Whether it reads at all: the page's own reader, stopped where it stops. */
function readError(source: string): string | null {
  try {
    compileModifier(source);
    return null;
  } catch (error) {
    return (error as Error).message;
  }
}

/** A message that only says the formula ran out: what came before it may still go on to read. */
const ranOut = (message: string) => /EOF|^Expected/.test(message);

/**
 * What is wrong with a formula on this page, or null when it reads: a sign it
 * cannot hold, a piece out of place, something missing, a function there is
 * not or given too many values, a field the page does not have.
 */
export function formulaProblem(page: Page, source: string): FormulaProblem | null {
  if (!source.trim()) return { words: 'Type a formula' };
  const tokens = formulaTokens(source);
  if (!Array.isArray(tokens)) return { words: `“${source[tokens.bad]}” cannot be in a formula,`, from: tokens.bad + 1, to: tokens.bad + 1 };
  const message = readError(source);
  if (message !== null) return whereItStops(source, tokens, message);
  // It reads: each name must be a field of the page.
  for (const [i, token] of tokens.entries()) {
    if (token.kind !== 'name' || calls(tokens, i)) continue;
    const root = token.text.split('.')[0];
    if (!Object.prototype.hasOwnProperty.call(page.fields, root)) return { words: `Unknown field “${root}”`, ...place(token) };
  }
  return null;
}

function whereItStops(source: string, tokens: FormulaToken[], message: string): FormulaProblem {
  const named = /^no function "(\w+)"/.exec(message) ?? /^(\w+) takes /.exec(message) ?? /^(sum) takes the name/.exec(message);
  if (named) {
    // The call the reader stopped at: the last one of that name before where it stopped.
    const at = firstFailing(source, tokens);
    const name = [...tokens.slice(0, at + 1)].reverse().find((t) => t.kind === 'name' && t.text === named[1]) ?? tokens.find((t) => t.text === named[1]);
    const words = /^no function/.test(message) ? `Unknown function “${named[1]}”` : `“${named[1]}”${message.slice(named[1].length)},`;
    return name ? { words, ...place(name) } : { words };
  }
  if (ranOut(message)) {
    const open = unclosed(tokens);
    if (open) return { words: 'A “(” is never closed', ...place(open) };
    const last = tokens[tokens.length - 1];
    return { words: `Something is missing after “${last.text}”`, ...place(last) };
  }
  const token = tokens[firstFailing(source, tokens)];
  return { words: `“${token.text}” is out of place`, ...place(token) };
}

/** The first piece the formula cannot go on from: up to it, the formula reads, or only runs out. */
function firstFailing(source: string, tokens: FormulaToken[]): number {
  for (let i = 0; i < tokens.length; i++) {
    const message = readError(source.slice(0, tokens[i].to));
    if (message !== null && !ranOut(message)) return i;
  }
  return tokens.length - 1;
}

/** The first bracket opened and never closed. */
function unclosed(tokens: FormulaToken[]): FormulaToken | undefined {
  const open: FormulaToken[] = [];
  for (const token of tokens) {
    if (token.kind === 'open') open.push(token);
    else if (token.kind === 'close') open.pop();
  }
  return open[0];
}

/** The fields a formula reads, by name, once each; none when it cannot be read. */
export function fieldsReadBy(source: string | boolean | undefined): string[] {
  if (typeof source !== 'string') return [];
  try {
    return [...compileModifier(source).fields];
  } catch {
    return [];
  }
}

const labelOf = (page: Page, name: string) => page.fields[name]?.label || name;

/**
 * Whether working a field out from this formula would have it worked out
 * from itself, directly or through other worked-out fields; the words if so.
 */
export function wouldCircle(page: Page, own: string, source: string): string | null {
  const reads = (name: string) => (name === own ? fieldsReadBy(source) : fieldsReadBy(page.fields[name]?.compute));
  if (reads(own).includes(own)) return `“${labelOf(page, own)}” cannot be worked out from itself`;
  const path: string[] = [own];
  const seen = new Set<string>();
  const visit = (name: string): boolean => {
    for (const next of reads(name)) {
      if (next === own) return true;
      if (seen.has(next)) continue;
      seen.add(next);
      path.push(next);
      if (visit(next)) return true;
      path.pop();
    }
    return false;
  };
  if (!visit(own)) return null;
  return `“${labelOf(page, own)}” would be worked out from itself: ${[...path, own].map((name) => labelOf(page, name)).join(' → ')}`;
}

// ---- in words ------------------------------------------------------------------------------------

const SIGNS: Record<string, string> = { '*': '×', '/': '÷', '-': '−', '>=': '≥', '<=': '≤', '==': 'is', '!=': 'is not', '<>': 'is not' };

/** A label that holds a sign of its own, "Price - net", is quoted, so it reads as one name and not as a sum. */
const nameWords = (label: string) => (/[-+*/%<>=!(),'"×÷−≥≤]/.test(label) ? `“${label}”` : label);

/** A literal as written, as its value: `'bulk'` is bulk, `-5` is −5; null for anything else. */
export function literalOf(source: string): { value: string | number | boolean | null } | null {
  const tokens = formulaTokens(source.trim());
  if (!Array.isArray(tokens)) return null;
  const [first, second] = tokens;
  if (tokens.length === 2 && first.text === '-' && second.kind === 'number') return { value: -Number(second.text) };
  if (tokens.length !== 1) return null;
  if (first.kind === 'text') return { value: first.text.slice(1, -1) };
  if (first.kind === 'number') return { value: Number(first.text) };
  if (first.kind === 'word' && CONSTANTS.has(first.text)) return { value: /^t/i.test(first.text) ? true : /^f/i.test(first.text) ? false : null };
  return null;
}

/** A value as a person reads it: a choice by its label, yes or no, text as it is. */
export function valueInWords(field: Field | undefined, value: unknown): string {
  if (field?.type === 'selection') return field.options.find((o) => o.value === value)?.label ?? String(value);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (value === null || value === undefined) return 'nothing';
  return String(value);
}

/** A piece of a formula in words, with the space before it and what it was written as; `field` names the field it stands for. */
export interface WordPiece {
  text: string;
  was: string;
  space: boolean;
  field?: string;
}

/** A formula in words, piece by piece: what `formulaInWords` joins, and the box draws with each field marked. */
export function formulaPieces(page: Page, source: string): WordPiece[] {
  const tokens = formulaTokens(source);
  if (!Array.isArray(tokens)) return [{ text: source, was: source, space: false }];
  return tokens.map((token, i) => {
    let text = token.text;
    let field: string | undefined;
    if (token.kind === 'name' && !calls(tokens, i)) {
      field = token.text.split('.')[0];
      text = nameWords(labelOf(page, field));
    } else if (token.kind === 'sign') text = SIGNS[token.text] ?? token.text;
    else if (token.kind === 'word' && CONSTANTS.has(token.text)) text = valueInWords(undefined, literalOf(token.text)?.value);
    else if (token.kind === 'text') {
      // Compared with a choice: the choice's label.
      const compared = tokens[i - 1]?.kind === 'sign' && tokens[i - 2]?.kind === 'name' ? page.fields[tokens[i - 2].text] : undefined;
      text = compared?.type === 'selection' ? valueInWords(compared, token.text.slice(1, -1)) : `“${token.text.slice(1, -1)}”`;
    }
    const tight = token.kind === 'close' || token.kind === 'comma' || i === 0 || tokens[i - 1].kind === 'open' || (token.kind === 'open' && tokens[i - 1]?.kind === 'name');
    return { text, was: token.text, space: !tight, ...(field ? { field } : {}) };
  });
}

/**
 * A formula in words: its fields by their labels, × and ÷ for * and /, ≥
 * and ≤ for >= and <=, "is" and "is not" for == and !=, and a choice
 * compared with a value by the value's label: `state == 'done'` reads
 * "Status is Done". A label with a sign in it is quoted.
 */
export function formulaInWords(page: Page, source: string): string {
  return formulaPieces(page, source)
    .map((piece) => (piece.space ? ' ' : '') + piece.text)
    .join('');
}

// ---- on made-up values ---------------------------------------------------------------------------

const AMOUNTS = [120, 80, 45, 15.5];
const COUNTS = [3, 5, 2, 4];
/** Days apart, so a rule comparing two dates can be seen to hold or not. */
const DAYS = ['2026-03-14', '2026-03-01', '2026-04-02'];

/** A made-up value for a field, the n-th of its kind in the formula. */
function sampleOf(name: string, field: Field, n: number): unknown {
  switch (field.type) {
    case 'integer':
      return COUNTS[n % COUNTS.length];
    case 'float':
    case 'monetary':
      return AMOUNTS[n % AMOUNTS.length];
    case 'boolean':
      return true;
    case 'selection':
      return field.multiple ? [field.options[0]?.value] : field.options[0]?.value;
    case 'date':
      return DAYS[n % DAYS.length];
    case 'datetime':
      return `${DAYS[n % DAYS.length]} 09:30:00`;
    case 'char':
    case 'text':
    case 'html':
      return field.label || name;
    default:
      return null;
  }
}

const shown = (field: Field | undefined, value: unknown) => (typeof value === 'string' && field?.type !== 'selection' && !/^\d{4}-/.test(value) ? `“${value}”` : valueInWords(field, value));

/** Made-up values for the fields a formula reads, the n-th of a kind taking the n-th sample; a worked-out field is left to be worked out. */
function samplesFor(page: Page, reads: string[]): Record<string, unknown> {
  const counts = new Map<string, number>();
  const values: Record<string, unknown> = {};
  for (const name of reads) {
    const field = page.fields[name];
    const group = ['integer'].includes(field.type) ? 'count' : ['float', 'monetary'].includes(field.type) ? 'amount' : field.type;
    const n = counts.get(group) ?? 0;
    counts.set(group, n + 1);
    if (field.compute === undefined) values[name] = sampleOf(name, field, n);
  }
  return values;
}

/** The values as a form settles them on these fields, worked-out ones worked out; null when they cannot be. */
function settled(fields: Page['fields'], values: Record<string, unknown>): Record<string, unknown> | null {
  const trial: Page = { fieldia: '0.1', id: 'sample', data: { kind: 'responses' }, fields, layout: { type: 'sections', id: 'root', children: [] } };
  try {
    return createForm({ page: trial, values: values as never }).getState().values;
  } catch {
    return null;
  }
}

const andWords = (words: string[]) => (words.length < 2 ? words.join('') : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`);

/** "Price 120 and Quantity 3": each field read, by its label, with its value. */
const givenWords = (page: Page, reads: string[], values: Record<string, unknown>) => andWords(reads.map((name) => `${labelOf(page, name)} ${shown(page.fields[name], values[name])}`));

/**
 * The formula worked out on made-up values, the way the form works it out
 * (a whole number rounded, text as text): "With Price 120 and Quantity 3:
 * 360". Empty when the formula does not read.
 */
export function sampleResult(page: Page, own: string, source: string): string {
  if (formulaProblem(page, source) || wouldCircle(page, own, source)) return '';
  const reads = fieldsReadBy(source).filter((name) => name !== own && page.fields[name]);
  const target = page.fields[own];
  if (!target) return '';
  const worked = settled({ ...page.fields, [own]: { ...target, compute: source } as Field }, samplesFor(page, reads));
  if (!worked) return '';
  const result = worked[own];
  const said = result === null || result === undefined || (typeof result === 'number' && !Number.isFinite(result)) ? 'nothing — it cannot be worked out' : shown(target, result);
  if (!reads.length) return `Always ${said}`;
  return `With ${givenWords(page, reads, worked)}: ${said}`;
}

/**
 * Whether a rule across fields holds on made-up values, as the form checks
 * it: "With Contract ends 2026-03-14 and Start date 2026-03-01: holds".
 * Empty when the formula does not read.
 */
export function sampleHolds(page: Page, source: string): string {
  if (formulaProblem(page, source)) return '';
  const reads = fieldsReadBy(source).filter((name) => page.fields[name]);
  const worked = settled(page.fields, samplesFor(page, reads));
  if (!worked) return '';
  const holds = compileModifier(source).evaluate(worked);
  if (!reads.length) return holds ? 'Always holds' : 'Never holds';
  // The form waits for every field a rule reads: one with no made-up value is said so.
  const waits = reads.filter((name) => worked[name] === null || worked[name] === undefined);
  if (waits.length) return `Checked once ${andWords(waits.map((name) => labelOf(page, name)))} ${waits.length === 1 ? 'is' : 'are'} filled in`;
  return `With ${givenWords(page, reads, worked)}: ${holds ? 'holds' : 'does not hold'}`;
}
