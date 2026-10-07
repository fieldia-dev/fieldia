import type { ActionStep, OpenStep, PanelSide, ValueMap } from '../format/actions';
import type { Field, LineField } from '../format/field';
import type { JsonValue } from '../format/json';
import type { Modifier, Tone } from '../format/layout';
import { compileExpression, type CompiledExpression, type ExpressionEnv } from '../expression/expression';
import { compileModifier, type CompiledModifier } from '../expression/modifier';
import { FIELD_NAME } from '../format/names';
import { fitTo } from './compute';
import type { ResolvedFilter } from './data-source';
import { resolveFilter } from './filter';
import { emptyValue, structuredCopy, type RecordId, type RelatedRecord, type Value, type Values } from './values';

/**
 * The engine that runs steps — a button's, a moment's, or the app's own —
 * against a form. Steps run in order; one whose `when` does not hold is
 * passed over; the first that fails or is refused stops the rest, and the
 * run's result says which and why. What the core cannot draw — a page opened,
 * words said, a question asked — it asks of the host the viewer gives.
 */

/** A button pressed, or a `call` step run: what the app's `onAction` is handed. */
export interface ActionRequest {
  /** The button or stat button pressed; for a moment, `on.open`, `on.change.<field>`, `on.beforeSave`, `on.afterSave` or `on.show.<id>`; for `form.run`, the id it was given. */
  id: string;
  action: string;
  params?: { [key: string]: JsonValue };
  recordId: RecordId | null;
  values: Values;
  /** The records chosen in a list, when the button belongs to one. */
  recordIds?: RecordId[];
  /** The line a button on a table's line was pressed on: the table's field, the line's key and values. */
  line?: { field: string; key: string; values: Values };
  /** The lines chosen in a table when a button for them was pressed: the table's field, their keys, the ids of those saved, and their values. */
  lines?: ChosenLines;
}

/** Lines chosen in a table, as a button for them hands them on. */
export interface ChosenLines {
  field: string;
  keys: string[];
  /** The saved records among them, by id: a new line has none yet. */
  ids: RecordId[];
  values: Values[];
}

/**
 * What the app may answer a call with. Nothing at all means go on. `values`
 * are set as a `set` step sets them (no person's change); `say` is said;
 * `open` runs as an `open` step would; `stop` stops the steps after it — with
 * words, said to the person as a warning.
 */
export interface ActionResult {
  values?: Values;
  /** The app changed the record on its server: it is loaded again before the steps go on. */
  reload?: boolean;
  say?: string | { message: string; tone?: Tone };
  open?: Omit<OpenStep, 'do' | 'when'>;
  stop?: boolean | string;
}

/** What a button does that only the app can: handed over, and awaited. */
export type OnAction = (request: ActionRequest) => void | ActionResult | Promise<void | ActionResult>;

/** A page the host is asked to open: in a dialog over the form, a panel beside it, or in its place. */
export interface OpenRequest {
  /** The page's id, as the app's `pages` finds it. */
  page: string;
  /** One published version; left out, the latest. */
  version?: number;
  as: 'dialog' | 'panel' | 'page';
  /** Where a panel comes from, when its step names a side: the end of the line unless told. */
  side?: PanelSide;
  /** The words over it; left out, the page's own title. */
  title?: string;
  /** The record to open; null for a new one. */
  recordId?: RecordId | null;
  /** What a new one starts with. */
  values?: Values;
  /** On a list page, the records it shows: each `valueFrom` already read from the form that opened it. */
  filter?: ResolvedFilter[];
}

/** How an opened page ended: saved (or sent), or closed without. */
export interface OpenResult {
  saved: boolean;
  /** The record it saved. */
  recordId?: RecordId | null;
  /** Its values, once saved. */
  values?: Values;
  /** The saved record's name, as its page's title field shows it: what a link set to it is labelled. */
  label?: string;
}

/**
 * The UI the core cannot draw, given by the viewer. Without one, a form says
 * nothing, asks `FormOptions.confirm` (or goes on as though answered Yes), and
 * cannot open, close or show a tab: those steps stop with reason `cannot`.
 */
export interface ActionHost {
  open(request: OpenRequest): Promise<OpenResult>;
  say(message: string, tone: Tone): void;
  ask(message: string): Promise<boolean>;
  /** Close the dialog or panel this form was opened in. */
  close?(): void;
  /** Show a tab by its id. The viewer then calls `form.shown(id)`, as for a tab a person picks. */
  show?(target: string): void;
  /** Open a web address: in a new tab, or in this one. */
  openUrl?(url: string, newTab: boolean): void;
}

/**
 * Why a run stopped: a check found problems (`check`), a question was
 * answered No (`no`), a save was refused (`save`), the app said stop or threw
 * (`app`), an opened page was closed without saving (`closed`), or the step
 * could not run here — no host to open with, a field the page lacks
 * (`cannot`).
 */
export type RunStop = 'check' | 'no' | 'save' | 'app' | 'closed' | 'cannot';

/** How a run of steps ended. */
export interface RunResult {
  /** Every step ran, or was passed over by its `when`. */
  done: boolean;
  /**
   * The place, among the steps run, of the one that stopped: for a step of
   * an `open`'s `then`, the open step's place; for a button's `action`, one
   * past its steps. Absent when a button's `confirm` was answered No.
   */
  stoppedAt?: number;
  /** The step that stopped, wherever it was. */
  step?: ActionStep;
  reason?: RunStop;
  /** Why, in words: the first problem found, the question, the save's or the app's words. */
  message?: string;
  /** What the app or the host threw, when that stopped it. */
  error?: unknown;
}

/** What a run is for: the id calls carry, the records chosen in a list. */
export interface RunContext {
  id?: string;
  recordIds?: RecordId[];
}

/** A step stopped: why, and which (a step of an `open`'s `then`, the deepest). */
export interface Stopped {
  reason: RunStop;
  message?: string;
  step?: ActionStep;
  error?: unknown;
}

/** A run as it goes: its id, the records chosen, and the moments it was set off by — a moment one of them sets off again does not run. */
export interface RunScope {
  id: string;
  recordIds?: RecordId[];
  line?: { field: string; key: string; values: Values };
  lines?: ChosenLines;
  chain: readonly string[];
}

/** What a run reaches its form by: the form gives these. */
export interface RunForm {
  readonly fields: Readonly<Record<string, Field>>;
  values(): Readonly<Values>;
  recordId(): RecordId | null;
  /** The values as expressions read them, and what else they read. */
  reading(): { context: Record<string, unknown>; env: ExpressionEnv };
  today(): string;
  /** Write fields as a step does: worked out once, no person's change. Throws for a field the page lacks. */
  write(values: Values): void;
  addLine(field: string, values: Values): void;
  check(fields: readonly string[] | undefined): Stopped | null;
  save(chain: readonly string[]): Promise<Stopped | null>;
  /** Load the record again from its data source; a new record cannot be. */
  reload(): Promise<Stopped | null>;
  reset(): void;
  /** Go to a wizard's step; `undefined` when the target is none of its steps (a tab). */
  goTo(target: string, chain: readonly string[]): Stopped | null | undefined;
  /** Run `show` of the host while `chain` is the run's, so a tab it shows knows who showed it. */
  showing(chain: readonly string[], show: () => void): void;
  host?: ActionHost;
  confirm?: (message: string) => boolean | Promise<boolean>;
  onAction?: OnAction;
  /** The app answered a call. */
  answered(request: ActionRequest, result: ActionResult | undefined): void;
}

export const DONE: RunResult = Object.freeze({ done: true });

/** The kinds of field an expression gives a value to; the rest hold records, lines or files, and take a field named alone whole. */
const EXPRESSIBLE = new Set(['char', 'text', 'html', 'integer', 'float', 'monetary', 'boolean', 'date', 'datetime', 'selection', 'json']);

const wordsOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** Steps run against one form. Expressions are read once and kept. */
export function createRunner(form: RunForm) {
  const expressions = new Map<string, CompiledExpression>();
  const conditions = new Map<string, CompiledModifier>();

  const expression = (source: string) => {
    let found = expressions.get(source);
    if (!found) expressions.set(source, (found = compileExpression(source)));
    return found;
  };

  function holds(when: Modifier): boolean {
    if (typeof when === 'boolean') return when;
    let found = conditions.get(when);
    if (!found) conditions.set(when, (found = compileModifier(when)));
    const { context, env } = form.reading();
    return found.evaluate(context, env);
  }

  /** A field named alone, when its value is taken whole. */
  const named = (source: string) => {
    const name = source.trim();
    return FIELD_NAME.test(name) ? name : null;
  };

  /** An expression over this form's values. A field named alone is taken whole when `whole` — a link with its name, the lines themselves. */
  function read(source: string, whole: boolean): unknown {
    const name = named(source);
    if (whole && name !== null && name in form.fields) return structuredCopy(form.values()[name]);
    const { context, env } = form.reading();
    return expression(source).evaluate(context, env);
  }

  /** The name this form knows a record by, from a link to the same model it holds. */
  function knownLabel(relation: string, id: RecordId): string | undefined {
    const values = form.values();
    for (const [name, def] of Object.entries(form.fields)) {
      if ((def.type !== 'many2one' && def.type !== 'many2many') || def.relation !== relation) continue;
      const held = values[name];
      const records = (Array.isArray(held) ? held : held ? [held] : []) as RelatedRecord[];
      const found = records.find((record) => record && record.id === id);
      if (found) return found.label;
    }
    return undefined;
  }

  /** What a value from an expression, the app or another form becomes in a field: a link from an id or a record, anything else as `compute` fits it. */
  function fit(def: Field | LineField, raw: unknown, label: (id: RecordId) => string | undefined = () => undefined): Value {
    const link = (item: unknown): RelatedRecord | null => {
      if (item === null || item === undefined || item === false || item === '') return null;
      const relation = (def as { relation: string }).relation;
      const labelOf = (id: RecordId) => label(id) ?? knownLabel(relation, id) ?? String(id);
      if (typeof item === 'number' || typeof item === 'string') return { id: item, label: labelOf(item) };
      if (typeof item === 'object' && !Array.isArray(item) && 'id' in item) {
        const record = item as { id: RecordId; label?: unknown };
        return { id: record.id, label: typeof record.label === 'string' ? record.label : labelOf(record.id) };
      }
      return null;
    };
    if (def.type === 'many2one') return link(raw);
    if (def.type === 'many2many') return (Array.isArray(raw) ? raw : [raw]).map(link).filter((record): record is RelatedRecord => record !== null);
    return fitTo(def, raw);
  }

  function fieldOf(name: string): Field {
    const def = form.fields[name];
    if (!def) throw new Error(`The page has no field "${name}"`);
    return def;
  }

  async function ask(message: string): Promise<boolean> {
    if (form.host) return form.host.ask(message);
    if (form.confirm) return form.confirm(message);
    return true;
  }

  function cannot(message: string): Stopped {
    return { reason: 'cannot', message };
  }

  /** Open a page through the host, take its answers back, and run its `then`. */
  async function open(step: Omit<OpenStep, 'do' | 'when'>, scope: RunScope): Promise<Stopped | null> {
    const host = form.host;
    if (!host) return cannot(`Nothing can open "${step.page}" here: the form has no host`);
    const record = step.record !== undefined ? read(step.record, false) : null;
    const request: OpenRequest = {
      page: step.page,
      ...(step.version !== undefined ? { version: step.version } : {}),
      as: step.as ?? 'dialog',
      ...(step.side && step.as === 'panel' ? { side: step.side } : {}),
      ...(step.title !== undefined ? { title: step.title } : {}),
      recordId: typeof record === 'number' || (typeof record === 'string' && record !== '') ? record : null,
      ...(step.values ? { values: readMap(step.values) } : {}),
      ...(step.filter ? { filter: resolveFilter(step.filter, form.reading().context) } : {}),
    };
    let result: OpenResult;
    try {
      result = await host.open(request);
    } catch (error) {
      return { reason: 'cannot', message: wordsOf(error), error };
    }
    if (!result.saved) return { reason: 'closed' };
    if (step.into) form.write(into(step.into, result));
    if (!step.then) return null;
    const then = await runSteps(step.then, scope);
    return then.done ? null : { reason: then.reason as RunStop, message: then.message, step: then.step, error: then.error };
  }

  /** What a new page starts with: each an expression over this form's values, a field named alone taken whole. */
  function readMap(map: ValueMap): Values {
    const values: Values = {};
    for (const [name, source] of Object.entries(map)) values[name] = (read(source, true) ?? null) as Value;
    return values;
  }

  /**
   * This form's fields from an opened page's answers: each an expression over
   * its values, where `id` is the record it saved. A link set to that record
   * is labelled by the host's `label`, else its `display_name`, else its
   * `name`, else its id.
   */
  function into(map: ValueMap, result: OpenResult): Values {
    const answers = result.values ?? {};
    const id = result.recordId ?? null;
    const context: Record<string, unknown> = { ...asRead(answers), id };
    const title = [result.label, answers['display_name'], answers['name']].find((text): text is string => typeof text === 'string' && text !== '');
    const label = (other: RecordId) => (other === id ? title : undefined);
    const values: Values = {};
    for (const [name, source] of Object.entries(map)) {
      const def = fieldOf(name);
      const alone = named(source);
      const raw = alone === 'id' ? id : alone !== null && !EXPRESSIBLE.has(def.type) && alone in answers ? answers[alone] : expression(source).evaluate(context, { today: form.today });
      values[name] = fit(def, raw, label);
    }
    return values;
  }

  async function call(step: { action: string; params?: { [key: string]: JsonValue } }, scope: RunScope): Promise<Stopped | null> {
    const request: ActionRequest = {
      id: scope.id,
      action: step.action,
      ...(step.params ? { params: structuredCopy(step.params) } : {}),
      recordId: form.recordId(),
      values: structuredCopy(form.values() as Values),
      ...(scope.recordIds ? { recordIds: [...scope.recordIds] } : {}),
      ...(scope.line ? { line: structuredCopy(scope.line) } : {}),
      ...(scope.lines ? { lines: structuredCopy(scope.lines) } : {}),
    };
    if (!form.onAction) return null;
    let answer: ActionResult | undefined;
    try {
      answer = (await form.onAction(request)) ?? undefined;
    } catch (error) {
      return { reason: 'app', message: wordsOf(error), error };
    }
    form.answered(request, answer);
    if (!answer) return null;
    // The server's record first, then what the app says over it.
    if (answer.reload) {
      const reloaded = await form.reload();
      if (reloaded) return reloaded;
    }
    if (answer.values) {
      const known: Values = {};
      for (const [name, value] of Object.entries(answer.values)) if (name in form.fields) known[name] = fit(form.fields[name], value);
      form.write(known);
    }
    if (answer.say !== undefined) {
      const said = typeof answer.say === 'string' ? { message: answer.say } : answer.say;
      form.host?.say(said.message, said.tone ?? 'info');
    }
    if (answer.open) {
      const opened = await open(answer.open, scope);
      if (opened) return opened;
    }
    if (answer.stop) {
      if (typeof answer.stop === 'string') form.host?.say(answer.stop, 'warning');
      return { reason: 'app', ...(typeof answer.stop === 'string' ? { message: answer.stop } : {}) };
    }
    return null;
  }

  async function runStep(step: ActionStep, scope: RunScope): Promise<Stopped | null> {
    switch (step.do) {
      case 'set': {
        const def = fieldOf(step.field);
        form.write({ [step.field]: fit(def, read(step.value, !EXPRESSIBLE.has(def.type))) });
        return null;
      }
      case 'clear':
        form.write({ [step.field]: emptyValue(fieldOf(step.field)) });
        return null;
      case 'addLine': {
        const def = fieldOf(step.field);
        if (def.type !== 'one2many') return cannot(`"${step.field}" is a ${def.type}; a line is added to a one2many`);
        const values: Values = {};
        for (const [name, source] of Object.entries(step.values ?? {})) {
          const sub = def.fields[name];
          if (!sub) return cannot(`The lines of "${step.field}" have no field "${name}"`);
          values[name] = fit(sub, read(source, !EXPRESSIBLE.has(sub.type)));
        }
        form.addLine(step.field, values);
        return null;
      }
      case 'check':
        return form.check(step.fields);
      case 'save':
        return form.save(scope.chain);
      case 'reset':
        form.reset();
        return null;
      case 'goTo': {
        const stepped = form.goTo(step.target, scope.chain);
        if (stepped !== undefined) return stepped;
        const show = form.host?.show;
        if (!show) return cannot(`Nothing can show "${step.target}" here: the form has no host that shows tabs`);
        form.showing(scope.chain, () => show.call(form.host, step.target));
        return null;
      }
      case 'say':
        form.host?.say(step.message, step.tone ?? 'info');
        return null;
      case 'ask':
        return (await ask(step.message)) ? null : { reason: 'no', message: step.message };
      case 'call':
        return call(step, scope);
      case 'open':
        return open(step, scope);
      case 'close': {
        const close = form.host?.close;
        if (!close) return cannot('Nothing can close this form: it has no host, or was not opened in a dialog or panel');
        close.call(form.host);
        return null;
      }
      case 'reload':
        return form.reload();
      case 'openUrl': {
        const openUrl = form.host?.openUrl;
        if (!openUrl) return cannot('Nothing can open a web address here: the form has no host that opens one');
        const url = read(step.url, false);
        if (typeof url !== 'string' || !url.trim()) return cannot(`"${step.url}" gives no address to open`);
        openUrl.call(form.host, url.trim(), step.newTab ?? true);
        return null;
      }
    }
  }

  async function runSteps(steps: readonly ActionStep[], scope: RunScope): Promise<RunResult> {
    for (let at = 0; at < steps.length; at++) {
      const step = steps[at];
      let stopped: Stopped | null;
      try {
        if (step.when !== undefined && !holds(step.when)) continue;
        stopped = await runStep(step, scope);
      } catch (error) {
        stopped = { reason: 'cannot', message: wordsOf(error), error };
      }
      if (stopped) {
        return {
          done: false,
          stoppedAt: at,
          step: stopped.step ?? step,
          reason: stopped.reason,
          ...(stopped.message !== undefined ? { message: stopped.message } : {}),
          ...(stopped.error !== undefined ? { error: stopped.error } : {}),
        };
      }
    }
    return DONE;
  }

  return { runSteps, ask };
}

/** What an expression reads in another form's answers, its fields unknown: a link as its id, links as their ids, a reference as "model,id", lines by their keys, a file by its name. */
function asRead(values: Values): Record<string, unknown> {
  const read: Record<string, unknown> = {};
  const one = (value: unknown): unknown => {
    if (value === null || typeof value !== 'object') return value;
    const object = value as Record<string, unknown>;
    if ('key' in object && 'values' in object) return object['key'];
    if ('model' in object && 'id' in object) return `${object['model']},${object['id']}`;
    if ('id' in object) return object['id'];
    if ('name' in object && 'type' in object && 'size' in object) return object['name'];
    return value;
  };
  for (const [name, value] of Object.entries(values)) read[name] = Array.isArray(value) ? value.map(one) : one(value);
  return read;
}

/**
 * One run of each moment at a time. A moment set off by a step of its own
 * run — or a run it set off — does not run. Set off while a run of it is
 * going: `again` moments (open, change, show) run once more after it, with
 * the values as they are then, however many times they were set off
 * meanwhile; the others (beforeSave, afterSave) do not run — a save made
 * meanwhile goes ahead without them, so nothing waits on itself.
 */
export function createMoments(run: (key: string, steps: readonly ActionStep[], chain: readonly string[]) => Promise<RunResult>) {
  interface Slot {
    running: Promise<RunResult>;
    queued?: Promise<RunResult>;
  }
  const slots = new Map<string, Slot>();

  return function moment(key: string, steps: readonly ActionStep[] | undefined, chain: readonly string[], again: boolean): Promise<RunResult> {
    if (!steps?.length || chain.includes(key)) return Promise.resolve(DONE);
    /** A run of it, known as running before its first step does: a step that sets it off again finds it busy. */
    const go = (slot: Slot): Promise<RunResult> => {
      let settle!: (result: Promise<RunResult>) => void;
      const running: Promise<RunResult> = new Promise<RunResult>((resolve) => (settle = resolve)).finally(() => {
        if (slot.running === running && !slot.queued) slots.delete(key);
      });
      slot.running = running;
      settle(run(key, steps, [...chain, key]));
      return running;
    };
    const busy = slots.get(key);
    if (!busy) {
      const slot: Slot = { running: Promise.resolve(DONE) };
      slots.set(key, slot);
      return go(slot);
    }
    if (!again) return Promise.resolve(DONE);
    if (!busy.queued) {
      const next = () => {
        busy.queued = undefined;
        return go(busy);
      };
      busy.queued = busy.running.then(next, next);
    }
    return busy.queued;
  };
}
