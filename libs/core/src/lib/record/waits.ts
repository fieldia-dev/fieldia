import type { Field } from '../format/field';
import type { Page } from '../format/page';
import { compileExpression } from '../expression/expression';
import type { FunctionTable } from '../expression/functions';
import type { UnreadText } from './form';
import { lineKind, type Line, type Values } from './values';

/**
 * What a value worked out from others waits for, while one of them holds text that does not read or an answer the form
 * refuses: the field, and on a table of lines the line — numbered as people count lines, sections and notes not
 * counted — and its cell.
 */
export interface WaitsFor {
  /** The field holding the text, or the table whose line holds it. */
  readonly field: string;
  /** The line, from 1: items only. Left out for a field of the record's own. */
  readonly line?: number;
  /** The line's cell holding the text. */
  readonly column?: string;
  /** It waits for an app's function that asks its server (`functions`): `field` is the value itself. */
  readonly asking?: true;
  /** Why that answer did not come: a save asks again. */
  readonly failed?: string;
}

/** Kinds of value an app works out from a record's lines: amounts, and totals kept whole (Flectra's tax_totals). */
const WORKED_OUT = new Set<Field['type']>(['integer', 'float', 'monetary', 'json']);
/** The numbers a line works out, which wait for its cells (0.24's rule for a table's cells). */
const NUMBERS = new Set<Field['type']>(['integer', 'float', 'monetary']);

/**
 * Which fields of a page each of its values worked out from others is worked out from — what it waits for while one
 * of them holds text that does not read, as a number worked out on a line waits for its line's cells and the table's
 * total for its lines (0.24). The page's own `compute`: the fields it reads, and what each of those it reads that is
 * worked out reads in turn — a sum over a table's lines waits for those lines. The app's (`appWorksOut`, a source
 * with an onchange): an amount no one types in (read-only), which the app works out as the lines change, from any
 * table of lines the page has — a sales order's Untaxed, Taxes and Total, its tax totals. A line's own form (`asLine`:
 * a line opened in its dialog) is the line the table's rule reads: a number on it no one types in waits for any of
 * its fields a person types in, as its cell in the table does. Fields worked out from nothing that can hold such text
 * are left out.
 */
export function workedOutFrom(page: Page, appWorksOut: boolean, asLine = false, functions?: FunctionTable): Map<string, readonly string[]> {
  const tables = Object.keys(page.fields).filter((name) => page.fields[name].type === 'one2many');
  const typed = Object.keys(page.fields).filter((name) => page.fields[name].readonly !== true && page.fields[name].compute === undefined);
  const reads = new Map<string, readonly string[]>();
  for (const [name, def] of Object.entries(page.fields)) {
    if (def.type === 'one2many') continue;
    if (asLine && NUMBERS.has(def.type) && (def.readonly === true || def.compute !== undefined)) reads.set(name, typed);
    else if (def.compute !== undefined) {
      try {
        reads.set(name, compileExpression(def.compute, functions).fields.filter((one) => one !== name && one in page.fields));
      } catch {
        // An expression that does not read is refused by the page's checks; it works nothing out here.
      }
    } else if (appWorksOut && def.readonly === true && WORKED_OUT.has(def.type) && tables.length) reads.set(name, tables);
  }
  const found = new Map<string, readonly string[]>();
  /** What a value is worked out from, read through the values worked out it reads. */
  const sources = (name: string, seen: Set<string>): string[] => {
    seen.add(name);
    const all = (reads.get(name) ?? []).flatMap((one) => (seen.has(one) ? [] : [one, ...(reads.has(one) ? sources(one, seen) : [])]));
    return [...new Set(all)];
  };
  // What holds text a person typed: a field they type in, or a table's lines — never a value worked out.
  for (const name of reads.keys()) {
    const from = sources(name, new Set()).filter((one) => !reads.has(one));
    if (from.length) found.set(name, from);
  }
  return found;
}

/**
 * The first of `from` holding text that does not read, or an answer the form refuses (`refused`: a value its checks
 * would not take — under its least, past today, not a whole number), in the page's order: a field's own, or a table's
 * line's cell (the first line holding one, as people count lines). Null when none does.
 */
export function waitingOn(
  page: Page,
  from: readonly string[],
  values: Readonly<Values>,
  unread: Readonly<Record<string, UnreadText>>,
  refused: (path: string) => boolean = () => false
): WaitsFor | null {
  const paths = Object.keys(unread);
  for (const field of from) {
    const def = page.fields[field];
    if (!def) continue;
    if (def.type !== 'one2many') {
      if (unread[field] || refused(field)) return { field };
      continue;
    }
    const held = paths.filter((path) => path.startsWith(`${field}.`));
    let n = 0;
    for (const line of (values[field] as Line[] | null | undefined) ?? []) {
      if (lineKind(def, line.values) !== null) continue;
      n++;
      const cell = held.find((path) => path.startsWith(`${field}.${line.key}.`))?.slice(field.length + line.key.length + 2).split('.')[0] ?? Object.keys(def.fields).find((column) => refused(`${field}.${line.key}.${column}`));
      if (cell) return { field, line: n, column: cell };
    }
  }
  return null;
}
