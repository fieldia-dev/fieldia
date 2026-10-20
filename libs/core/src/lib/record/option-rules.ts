import type { Field, LineField, Option, SelectionOption } from '../format/field';
import type { Page } from '../format/page';
import { optionsField, optionsList } from '../format/choice-options';
import { compileModifier, type CompiledModifier } from '../expression/modifier';
import type { ExpressionEnv, FunctionTable } from '../expression/functions';
import { expressionEnv, lineContext, recordContext, type About, type AppReads } from './env';
import type { FormState } from './form';
import type { Line, Value, Values } from './values';

/**
 * A page's options by condition and carried from an earlier question (the options part): each option shown or hidden
 * by its `invisible` — a page's choice's, and a table line's on its line — the options picked in an earlier question
 * offered in a later one (`optionsFrom.field`), and a chosen option a change no longer offers taken out of its answer,
 * said. A form on a page with any makes this from the part as it comes (form.ts); before, its choices offer their own
 * options, nothing is taken out, and a save waits for it.
 */

/** What the options ask of the form they are made for. */
export interface OptionsHost {
  readonly page: Page;
  readonly table: FunctionTable | undefined;
  readonly app: AppReads;
  state(): FormState;
  today(): string;
  about(): About;
  /** The values as expressions read them now, and what else they read. */
  reading(): { context: Record<string, unknown>; env: ExpressionEnv };
  /** Values worked out again after a write: what is taken out may take another's away. */
  settle(values: Values): Values;
  /** What is said of options taken out of an answer, by their labels. */
  words(labels: string[]): string;
}

/** A page's options by condition and carried, made for a form (`optionRules`). */
export interface OptionRules {
  /** A choice's options as they are offered for these values, read with `read`: see `Form.offered`. */
  offered(name: string, values: Readonly<Values>, read: { context: Record<string, unknown>; env: ExpressionEnv }): Option[];
  /** A table line's choice's options as they are offered on that line, its conditions read on it and `record` its record's context. */
  lineOffered(lines: string, line: Line, column: string, record: Record<string, unknown>): Option[];
  /**
   * The chosen options a write no longer offers taken out of their answers, with what is said: those offered before it
   * and not after. Null when none goes.
   */
  takeOut(before: Readonly<Values>, after: Values): { values: Values; said: Record<string, string>; gone: Record<string, TakenOption[]> } | null;
}

/** An option taken out of an answer, as its note names it: so the note goes once it is offered again. */
export interface TakenOption {
  readonly value: Value;
  readonly label: string;
}

/** A choice's options that show or hide by a condition, read once: by each option's value. */
function rulesOf(options: readonly SelectionOption[], table: FunctionTable | undefined): Map<Option['value'], CompiledModifier> {
  const rules = new Map<Option['value'], CompiledModifier>();
  for (const option of options) if (option.invisible !== undefined && option.invisible !== false) rules.set(option.value, compileModifier(option.invisible, table));
  return rules;
}

export function optionRules(host: OptionsHost): OptionRules {
  const { page, table, app, today } = host;
  /** The app's list a choice's options come from; none for one whose options are its own or carried. */
  const fromList = (name: string) => optionsList((page.fields[name] as Extract<Field, { type: 'selection' }> | undefined)?.optionsFrom);
  /** Each choice's options that show or hide by a condition, read once: by the field, by each option's value. */
  const optionRules = new Map<string, Map<Option['value'], CompiledModifier>>();
  for (const [name, def] of Object.entries(page.fields)) {
    if (def.type !== 'selection') continue;
    const rules = rulesOf(def.options as SelectionOption[], table);
    if (rules.size) optionRules.set(name, rules);
  }
  /** The choices whose options change with the record's answers. */
  const changing = Object.keys(page.fields).filter((name) => optionRules.has(name) || (page.fields[name].type === 'selection' && !!optionsField((page.fields[name] as Extract<Field, { type: 'selection' }>).optionsFrom)));
  /**
   * A table line's choices whose options show or hide by a condition on the line's values (and `parent.` the record's),
   * read once: by the table, its column, each option's value.
   */
  const lineOptionRules = new Map<string, Map<string, Map<Option['value'], CompiledModifier>>>();
  for (const [lines, def] of Object.entries(page.fields)) {
    if (def.type !== 'one2many') continue;
    for (const [column, sub] of Object.entries(def.fields)) {
      if (sub.type !== 'selection') continue;
      const rules = rulesOf(sub.options as SelectionOption[], table);
      if (!rules.size) continue;
      if (!lineOptionRules.has(lines)) lineOptionRules.set(lines, new Map());
      lineOptionRules.get(lines)?.set(column, rules);
    }
  }

  function lineOffered(lines: string, line: Line, column: string, record: Record<string, unknown>): Option[] {
    const sub = (page.fields[lines] as Extract<Field, { type: 'one2many' }>).fields[column] as Extract<LineField, { type: 'selection' }>;
    const options = (optionsList(sub.optionsFrom) && host.state().choices[`${lines}.${line.key}.${column}`]?.options) || sub.options;
    const rules = lineOptionRules.get(lines)?.get(column);
    if (!rules) return [...options];
    const context = lineContext(line.values, (page.fields[lines] as Extract<Field, { type: 'one2many' }>).fields as Record<string, LineField>, record, line.id ?? null);
    const env = { ...app, today };
    return options.filter((o) => !rules.get(o.value)?.evaluate(context, env));
  }

  function offeredIn(name: string, values: Readonly<Values>, read: { context: Record<string, unknown>; env: ExpressionEnv }, seen: readonly string[] = []): Option[] {
    const def = page.fields[name] as Extract<Field, { type: 'selection' }>;
    const carried = optionsField(def.optionsFrom);
    let options: readonly Option[];
    if (carried && page.fields[carried.field]?.type === 'selection' && !seen.includes(carried.field)) {
      const picked = new Set([values[carried.field]].flat().filter((value) => value !== null && value !== undefined));
      // A "None of these" goes alone: it is no choice to carry.
      const from = offeredIn(carried.field, values, read, [...seen, name]).filter((o) => !o.exclusive && picked.has(o.value) === (carried.picked !== false));
      options = [...from.map(({ invisible: _, ...option }: SelectionOption) => option), ...def.options];
    } else options = (fromList(name) && host.state().choices[name]?.options) || def.options;
    const rules = optionRules.get(name);
    return rules ? options.filter((o) => !rules.get(o.value)?.evaluate(read.context, read.env)) : [...options];
  }

  /**
   * The chosen options a write no longer offers — hidden by their condition, or no longer picked where they are
   * carried from — taken out of their answers, with what is said: those offered before it and not after, so a record
   * opened holding one keeps it, and says so. A table line's alike, by its cell's path, its conditions read on the line
   * as it was and as it is. Again while one taken out takes another's away. Null when none goes.
   */
  function takeOut(before: Readonly<Values>, after: Values): { values: Values; said: Record<string, string>; gone: Record<string, TakenOption[]> } | null {
    if (!changing.length && !lineOptionRules.size) return null;
    const was = before === host.state().values ? host.reading() : { context: recordContext(before as Values, page.fields, host.about()), env: expressionEnv(before as Values, page.fields, today, app) };
    const said: Record<string, string> = {};
    const taken: Record<string, TakenOption[]> = {};
    /** Said at a path: the options gone, by their labels as they were offered. */
    const say = (path: string, gone: unknown[], offeredBefore: ReadonlyMap<Option['value'], string>) => {
      taken[path] = gone.map((value) => ({ value: value as Value, label: offeredBefore.get(value as Option['value']) ?? String(value) }));
      said[path] = host.words(taken[path].map((option) => option.label));
    };
    let values = after;
    for (let round = 0; round < 4; round++) {
      const now = { context: recordContext(values, page.fields, host.about()), env: expressionEnv(values, page.fields, today, app) };
      let next = values;
      for (const name of changing) {
        const chosen: unknown[] = [values[name]].flat().filter((value) => value !== null && value !== undefined);
        if (!chosen.length) continue;
        const offeredBefore = new Map(offeredIn(name, before, was).map((o) => [o.value, o.label]));
        const offeredNow = new Set(offeredIn(name, values, now).map((o) => o.value));
        const gone = chosen.filter((value) => offeredBefore.has(value as Option['value']) && !offeredNow.has(value as Option['value']));
        if (!gone.length) continue;
        const held = values[name];
        next = { ...next, [name]: Array.isArray(held) ? ((held as unknown[]).filter((value) => !gone.includes(value)) as Value) : null };
        say(name, gone, offeredBefore);
      }
      // A line's choice its line's change hides: only a line that was there, and what it offered then.
      for (const [lines, columns] of lineOptionRules) {
        const rows = (values[lines] as Line[] | null) ?? [];
        const rowsBefore = (before[lines] as Line[] | null) ?? [];
        let written: Line[] | null = null;
        rows.forEach((line, i) => {
          const old = rowsBefore.find((one) => one.key === line.key);
          if (!old) return;
          for (const column of columns.keys()) {
            const held = (written?.[i] ?? line).values[column];
            const chosen: unknown[] = [held].flat().filter((value) => value !== null && value !== undefined);
            if (!chosen.length) continue;
            const offeredBefore = new Map(lineOffered(lines, old, column, was.context).map((o) => [o.value, o.label]));
            const offeredNow = new Set(lineOffered(lines, written?.[i] ?? line, column, now.context).map((o) => o.value));
            const gone = chosen.filter((value) => offeredBefore.has(value as Option['value']) && !offeredNow.has(value as Option['value']));
            if (!gone.length) continue;
            written ??= [...rows];
            written[i] = { ...written[i], values: { ...written[i].values, [column]: (Array.isArray(held) ? (held as unknown[]).filter((value) => !gone.includes(value)) : null) as Value } };
            say(`${lines}.${line.key}.${column}`, gone, offeredBefore);
          }
        });
        if (written) next = { ...next, [lines]: written };
      }
      if (next === values) break;
      values = host.settle(next);
    }
    return Object.keys(said).length ? { values, said, gone: taken } : null;
  }

  return { offered: (name, values, read) => offeredIn(name, values, read), lineOffered, takeOut };
}
