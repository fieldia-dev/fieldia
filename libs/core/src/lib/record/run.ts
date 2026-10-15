import type { ActionStep, OpenStep, PanelSide, ValueMap } from '../format/actions';
import type { Field, LineField } from '../format/field';
import type { JsonValue } from '../format/json';
import type { Modifier, Tone } from '../format/layout';
import { compileExpression, type CompiledExpression, type ExpressionEnv } from '../expression/expression';
import { compileModifier, type CompiledModifier } from '../expression/modifier';
import { FIELD_NAME } from '../format/names';
import { splitValues } from '../format/words';
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
  /**
   * Values the app's server keeps for the record now, written as loaded ones
   * are: never a change to save. Follow's answer, `{ following: true }`.
   */
  stored?: Values;
  /** The app changed the record on its server: it is loaded again before the steps go on. */
  reload?: boolean;
  say?: string | { message: string; tone?: Tone };
  open?: Omit<OpenStep, 'do' | 'when'>;
  /**
   * Show this record in the form's place from now on, as the pager moves to
   * one — the copy a duplicate made, the record a server action made — or a
   * new one for null. Changes not saved are dropped.
   */
  record?: RecordId | null;
  /** Post words in the record's conversation, as a `post` step does: a note unless it is a `message`. */
  post?: string | { message: string; kind?: 'note' | 'message' };
  stop?: boolean | string;
}

/** Words posted in a record's conversation by a `post` step or the app's answer. */
export interface PostedMessage {
  kind: 'note' | 'message';
  /** The words as typed, each `{field}` filled in. */
  text: string;
  /** The same as HTML: every character escaped, each line its own. An html field's value comes as it is. */
  body: string;
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
  /** A question, answered Yes (true) or No; `how` says what kind, for a host that asks some differently. */
  ask(message: string, how?: AskHow): Promise<boolean>;
  /** Close the dialog or panel this form was opened in. */
  close?(): void;
  /** Show a tab by its id. The viewer then calls `form.shown(id)`, as for a tab a person picks. */
  show?(target: string): void;
  /** Open a web address: in a new tab, or in this one. */
  openUrl?(url: string, newTab: boolean): void;
  /**
   * Post words in a record's conversation. Left out, the form tells its own
   * listeners (`post`): the chatter beside it. A page opened over a record
   * is given one that posts in that record's. False: nothing heard them.
   */
  post?(message: PostedMessage): boolean | void | Promise<boolean | void>;
}

/**
 * How a question is asked. `discard`: its Yes lets go of the person's work not
 * saved ("Discard your changes?"), so a host words Yes as Discard and puts the
 * focus on Cancel: Enter keeps the work.
 */
export interface AskHow {
  discard?: boolean;
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
  /**
   * The record the run is on, as the form numbers each record it shows: set
   * as it starts, and moved on by its own steps that show another (a `call`'s
   * `{ record }`, Duplicate's copy, a reload). Shown another by anything else,
   * the run stops: its steps are not for that record.
   */
  generation?: number;
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
  /** Write values the record holds where it is kept: no change to save. */
  store(values: Values): void;
  addLine(field: string, values: Values): void;
  /** Check fields as sending does: what is still typed in a box read first, a name being looked up waited for. */
  check(fields: readonly string[] | undefined): Stopped | null | Promise<Stopped | null>;
  save(chain: readonly string[]): Promise<Stopped | null>;
  /** The number of the record shown now: each record shown — opened, loaded again, a new one — has its own. */
  generation(): number;
  /** Why a run stops whose record was replaced while it went on. */
  gone(): Stopped;
  /**
   * Load the record again from its data source, once the form's one check let
   * what is shown go; a new record cannot be. Each of these takes the run's
   * `chain`: a step of a save's own beforeSave does not wait for that save.
   */
  reload(chain: readonly string[]): Promise<Stopped | null>;
  /** Reset the form, once its one check let what is shown go. */
  reset(chain: readonly string[]): Stopped | null | Promise<Stopped | null>;
  /** Close it through the host, once its one check let what is shown go. */
  close(chain: readonly string[]): Stopped | null | Promise<Stopped | null>;
  /** Go to a wizard's step; `undefined` when the target is none of its steps (a tab). */
  goTo(target: string, chain: readonly string[]): Stopped | null | undefined | Promise<Stopped | null | undefined>;
  /** Run `show` of the host while `chain` is the run's, so a tab it shows knows who showed it. */
  showing(chain: readonly string[], show: () => void): void;
  host?: ActionHost;
  confirm?: (message: string) => boolean | Promise<boolean>;
  onAction?: OnAction;
  /** The app answered a call. */
  answered(request: ActionRequest, result: ActionResult | undefined): void;
  /** Whether something changed since the record was loaded or saved: a file still on its way is a change coming. */
  changed(): boolean;
  /**
   * The form's one check, asked by a step before something that cannot be
   * taken back — a copy made, the record archived, the page left for an
   * address — whose way out passes the check only after: null to go on,
   * else why the run stops. Every way out passes it anyway; asked first, it
   * is not asked again.
   */
  letGo(chain: readonly string[]): Stopped | null | Promise<Stopped | null>;
  /**
   * The record being deleted, by `remove`: a way out it takes meanwhile asks
   * nothing, and once `done` says it is deleted, the person's work in it goes
   * with it. Refused, their work stays.
   */
  deleting<T>(remove: () => Promise<T>, done: (out: T) => boolean): Promise<T>;
  /**
   * The record's own operations through the data source, each only when the
   * data source has it; without, the app's action of the step's name is called.
   */
  archive?(archive: boolean): Promise<void>;
  copy?(): Promise<RecordId>;
  remove?(): Promise<void>;
  /** Show another record in this form's place, loaded as a pager loads it, once the one check let this one go; a new one for null. */
  showRecord(id: RecordId | null, chain: readonly string[]): Promise<Stopped | null>;
  /** The record was archived (or brought back), copied, or deleted: told to the app. Deleted, the form leaves it unless a listener moved it on. */
  told(event: { archived: boolean } | { copied: RecordId } | { deleted: true }, id: RecordId): void;
  /** Post words in the record's conversation: false when nothing here can. */
  post(message: PostedMessage): Promise<boolean>;
  /** A field's value as words in a posted message: a link's name, a choice's label. */
  wordsOf(field: string): string;
  /** Why the person may not archive, copy or delete the record, as its source told: their words to say; null when they may. */
  barred?(right: 'archive' | 'duplicate' | 'delete'): string | null;
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
    const on = form.generation();
    let result: OpenResult;
    try {
      result = await host.open(request);
    } catch (error) {
      return { reason: 'cannot', message: wordsOf(error), error };
    }
    if (!result.saved) return { reason: 'closed' };
    // Its answers are for the record that opened it: another shown meanwhile takes none of them.
    if (form.generation() !== on) return form.gone();
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
    const on = form.generation();
    let answer: ActionResult | undefined;
    try {
      answer = (await form.onAction(request)) ?? undefined;
    } catch (error) {
      return { reason: 'app', message: wordsOf(error), error };
    }
    form.answered(request, answer);
    if (!answer) return null;
    // Answered for a record no longer shown: nothing of it is laid over the one shown now. Its words to the person are
    // laid over no record, and are said still — a dialog's "Payment … posted", answered as it closed, as before.
    if (form.generation() !== on) {
      if (answer.say !== undefined) {
        const said = typeof answer.say === 'string' ? { message: answer.say } : answer.say;
        form.host?.say(said.message, said.tone ?? 'info');
      }
      return form.gone();
    }
    // The server's record first, then what the app says over it.
    if (answer.reload) {
      const reloaded = await ownMove(scope, () => form.reload(scope.chain));
      if (reloaded) return reloaded;
    }
    if (answer.stored) {
      const known: Values = {};
      for (const [name, value] of Object.entries(answer.stored)) if (name in form.fields) known[name] = fit(form.fields[name], value);
      form.store(known);
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
    if (answer.post !== undefined) {
      const posted = typeof answer.post === 'string' ? { message: answer.post } : answer.post;
      const stopped = await post(posted.message, posted.kind ?? 'note', false);
      if (stopped) return stopped;
    }
    if (answer.record !== undefined) {
      const moved = await ownMove(scope, () => form.showRecord(answer.record as RecordId | null, scope.chain));
      if (moved) return moved;
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

  /** Words posted: a `post` step's with each `{field}` filled in, or the app's as they are. */
  async function post(message: string, kind: 'note' | 'message', filled: boolean): Promise<Stopped | null> {
    const parts = filled ? splitValues(message) : [{ text: message }];
    const text = parts.map((part) => (part.field ? form.wordsOf(part.field) : part.text)).join('');
    // An html field's value comes as HTML; the rest are escaped, a line each.
    const body = parts
      .map((part) => (part.field && form.fields[part.field]?.type === 'html' ? String(form.values()[part.field] ?? '') : escapeHtml(part.field ? form.wordsOf(part.field) : part.text)))
      .join('');
    const posted = await form.post({ kind, text, body: `<p>${body}</p>` });
    return posted ? null : cannot('Nothing can post a message here: no conversation is beside this record');
  }

  /** A record step the data source cannot do: the app's action of its name, answered as a call is. */
  async function instead(name: 'archive' | 'unarchive' | 'duplicate' | 'delete', method: string, scope: RunScope): Promise<Stopped | null> {
    if (!form.onAction) return cannot(`Nothing can ${name} this record here: the data source has no ${method}, and the app takes no actions`);
    return call({ action: name }, scope);
  }

  /** Archive the record or bring it back, copy it, or delete it: through the data source when it can, else the app. */
  async function recordStep(name: 'archive' | 'unarchive' | 'duplicate' | 'delete', scope: RunScope): Promise<Stopped | null> {
    const id = form.recordId();
    if (id == null) return cannot(`A new record cannot be ${name === 'duplicate' ? 'duplicated' : name === 'delete' ? 'deleted' : `${name}d`}: it is not saved yet`);
    // Not when the record's source says this person may not: neither it nor the app is asked.
    const barred = form.barred?.(name === 'unarchive' ? 'archive' : name);
    if (barred) return cannot(barred);
    if (name === 'archive' || name === 'unarchive') {
      if (!form.archive) return instead(name, 'archive', scope);
      // Loaded again once archived: the person's work is asked about before anything is.
      const kept = await form.letGo(scope.chain);
      if (kept) return kept;
      await form.archive(name === 'archive');
      form.told({ archived: name === 'archive' }, id);
      return ownMove(scope, () => form.reload(scope.chain));
    }
    if (name === 'duplicate') {
      // What was changed goes with the copy: it is saved first. What that save could not take — changes Reload set
      // aside, a change made while it ran — goes only when the person says so, before any copy is made; and a change
      // made while the copy is made, before the copy shows.
      if (form.changed()) {
        const saved = await form.save(scope.chain);
        if (saved) return saved;
      }
      const kept = await form.letGo(scope.chain);
      if (kept) return kept;
      if (!form.copy) {
        const stopped = await instead(name, 'copy', scope);
        const now = form.recordId();
        if (!stopped && now != null && now !== id) form.told({ copied: now }, id);
        return stopped;
      }
      const copied = await form.copy();
      const moved = await ownMove(scope, () => form.showRecord(copied, scope.chain));
      if (moved) return moved;
      form.told({ copied }, id);
      return null;
    }
    // Deleted: what the person had not saved in it goes with it, unasked — they chose to delete it. Refused, it stays.
    if (!form.remove) {
      const stopped = await form.deleting(() => instead(name, 'delete', scope), (out) => !out);
      if (!stopped) told(scope, { deleted: true }, id);
      return stopped;
    }
    const remove = form.remove;
    await form.deleting(() => remove(), () => true);
    told(scope, { deleted: true }, id);
    return null;
  }

  /** The record deleted, told: a pager moves on at once, and that move is this run's own. */
  function told(scope: RunScope, event: { deleted: true }, id: RecordId) {
    form.told(event, id);
    scope.generation = form.generation();
  }

  /** A step of this run showing another record (or this one loaded again): the run goes on, on that one. */
  async function ownMove(scope: RunScope, move: () => Promise<Stopped | null>): Promise<Stopped | null> {
    const stopped = await move();
    scope.generation = form.generation();
    return stopped;
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
        return form.reset(scope.chain);
      case 'goTo': {
        const stepped = await form.goTo(step.target, scope.chain);
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
      case 'close':
        if (!form.host?.close) return cannot('Nothing can close this form: it has no host, or was not opened in a dialog or panel');
        return form.close(scope.chain);
      case 'reload':
        return ownMove(scope, () => form.reload(scope.chain));
      case 'openUrl': {
        const openUrl = form.host?.openUrl;
        if (!openUrl) return cannot('Nothing can open a web address here: the form has no host that opens one');
        const url = read(step.url, false);
        if (typeof url !== 'string' || !url.trim()) return cannot(`"${step.url}" gives no address to open`);
        // In this tab, the page goes: the person's work is asked about first.
        if (step.newTab === false) {
          const kept = await form.letGo(scope.chain);
          if (kept) return kept;
        }
        openUrl.call(form.host, url.trim(), step.newTab ?? true);
        return null;
      }
      case 'archive':
      case 'unarchive':
      case 'duplicate':
      case 'delete':
        return recordStep(step.do, scope);
      case 'post':
        return post(step.message, step.kind ?? 'note', true);
    }
  }

  async function runSteps(steps: readonly ActionStep[], scope: RunScope): Promise<RunResult> {
    scope.generation ??= form.generation();
    for (let at = 0; at < steps.length; at++) {
      const step = steps[at];
      let stopped: Stopped | null;
      try {
        // The record it ran on was replaced by something else meanwhile: the rest is not for the one shown now.
        if (form.generation() !== scope.generation) stopped = form.gone();
        else if (step.when !== undefined && !holds(step.when)) continue;
        else stopped = await runStep(step, scope);
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

/** Words as HTML: every character that means something there escaped, each line break a <br>. */
function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string).replace(/\n/g, '<br>');
}
