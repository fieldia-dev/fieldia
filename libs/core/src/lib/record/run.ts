import type { ActionStep, OpenStep, PanelSide, ValueMap } from '../format/actions';
import type { Field, LineField } from '../format/field';
import type { JsonValue } from '../format/json';
import type { MenuItem, Modifier, Tone } from '../format/layout';
import { compileExpression, type CompiledExpression, type ExpressionEnv } from '../expression/expression';
import { compileModifier, type CompiledModifier } from '../expression/modifier';
import { FIELD_NAME } from '../format/names';
import { splitValues } from '../format/words';
import { fitTo } from './compute';
import type { PaidPayment, PaymentDue, PayRequest, ResolvedFilter } from './data-source';
import { resolveFilter } from './filter';
import type { Facet } from './search';
import { emptyValue, sameValue, structuredCopy, type Line, type RecordId, type RelatedRecord, type Value, type Values } from './values';

/**
 * The engine that runs steps — a button's, a moment's, or the app's own —
 * against a form. Steps run in order; one whose `when` does not hold is
 * passed over; the first that fails or is refused stops the rest, and the
 * run's result says which and why. What the core cannot draw — a page opened,
 * words said, a question asked — it asks of the host the viewer gives.
 *
 * A run that saves is one piece of work, as a record's button is in Flectra:
 * when its save, or a check before it, is refused, what its own steps wrote
 * since its last save is put back — a status a button moved stays where it
 * was, and a field it locked stays open to put right.
 */

/** A button pressed, or a `call` step run: what the app's `onAction` is handed. */
export interface ActionRequest {
  /** The button or stat button pressed; for a moment, `on.open`, `on.change.<field>`, `on.beforeSave`, `on.afterSave` or `on.show.<id>`; for `form.run`, the id it was given. */
  id: string;
  action: string;
  params?: { [key: string]: JsonValue };
  recordId: RecordId | null;
  values: Values;
  /** The records chosen in a list, when the button belongs to one; a related list's row button's one record (of its `model`). */
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
  /**
   * A file the app made for the record — its own PDF of an invoice, a report under Print — shown over the record in
   * the browser's own viewer, with Download, or saved at once (`show: 'download'`), as the viewer's host does it.
   */
  file?: ActionFile;
  stop?: boolean | string;
  /**
   * A menu's items, for an item whose menu the app gives as it opens (`MenuItem.menuFrom`): shown after the page's
   * own, each pressed as theirs are. Read only by that menu; any other call's is left alone.
   */
  menu?: MenuItem[];
  /**
   * How to take back what the app just did, for a one-tap press (a follow-up marked done, a message sent with a few
   * seconds to call it back): its words are said with Undo, and Undo calls this — the app reopens the follow-up,
   * cancels the send — answering as a call is answered (values, words, a reload…). Offered for a few seconds.
   */
  undo?: AppUndo;
}

/** The app's own way to take back what it did for a press (`ActionResult.undo`): answered as a call is. */
export type AppUndo = () => void | ActionResult | Promise<void | ActionResult>;

/** The runner's own ways a press's Undo takes it back with (press-undo.ts, the undo part). */
export interface UndoKit {
  form: RunForm;
  answered(answer: ActionResult, scope: RunScope): Promise<Stopped | null>;
  recordStep(name: 'archive' | 'unarchive' | 'duplicate' | 'delete', scope: RunScope): Promise<Stopped | null>;
  replaced(scope: RunScope): boolean;
  tell(scope: RunScope | null, message: string, tone: Tone): void;
  runSteps(steps: readonly ActionStep[], scope: RunScope, inner?: boolean): Promise<RunResult>;
}

/** Undo, offered with the words a press said (`ActionHost.say`'s third): pressed, it takes back what the press did. */
export interface SayUndo {
  undo(): Promise<RunResult>;
}

/**
 * What a press that offers Undo keeps as it runs (a button's or a menu item's `undo`, or the app answering with one):
 * the words it says, held to be said as it ends — the last with Undo — and what Fieldia needs to take it back. What it
 * wrote is read by the undo part as it ends (press-undo.ts), against the values it began with.
 */
export interface PressTaken {
  said: { message: string; tone: Tone }[];
  /** The app's own undos, from its answers, in the order given. */
  app: AppUndo[];
  /** The form's values as the press began. */
  at: Values;
  /** It archived the record (true) or brought it back (false). */
  archived?: boolean;
  /** The app's call answered with no undo: Fieldia cannot take that back by itself. */
  beyond?: string;
}

/**
 * A file the app hands back from an action: its name and kind, and where it is — its address on the app's server, its
 * bytes as base64 (`data`, as a file field holds them), or the bytes themselves (`bytes`, a fetch's blob). A PDF or a
 * picture is shown (`view`, the default); any other kind, or `download`, is saved.
 */
export interface ActionFile {
  /** Its name, as it is saved: "INV_2026_0042.pdf". */
  name: string;
  /** Its kind, as a MIME type: "application/pdf". From its name when left out. */
  type?: string;
  url?: string;
  data?: string;
  /** A Blob (a fetch's `blob()`), or an ArrayBuffer or Uint8Array of them. */
  bytes?: ArrayBuffer | Uint8Array | { readonly size: number; readonly type: string; arrayBuffer(): Promise<ArrayBuffer> };
  /** Shown over the record (`view`), or saved (`download`). */
  show?: 'view' | 'download';
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
  /**
   * On a list page, the same conditions as the search it opens with, chips a person sees and may take away — a related
   * list's View all: "Customer: Nile Traders". Where given, the viewer opens the list with them in place of `filter`'s
   * fixed conditions (and of its default search); `filter` stays what they ask for, for an app that opens the list its
   * own way.
   */
  search?: Facet[];
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
  /** Words to say, in a tone; with `undo`, a one-tap press's: Undo beside them for a few seconds, pressed, takes it back. */
  say(message: string, tone: Tone, undo?: SayUndo): void;
  /** A question, answered Yes (true) or No; `how` says what kind, for a host that asks some differently. */
  ask(message: string, how?: AskHow): Promise<boolean>;
  /** Close the dialog or panel this form was opened in. */
  close?(): void;
  /** Show a tab by its id. The viewer then calls `form.shown(id)`, as for a tab a person picks. */
  show?(target: string): void;
  /** Open a web address: in a new tab, or in this one. */
  openUrl?(url: string, newTab: boolean): void;
  /** Print the page as it prints, to paper or a PDF (a `print` step, a gear menu's built-in Print): settled once the browser's printing is done. */
  print?(): void | Promise<void>;
  /** Show the app's file over the form, or save it (`ActionResult.file`). */
  file?(file: ActionFile): void | Promise<void>;
  /**
   * Post words in a record's conversation. Left out, the form tells its own
   * listeners (`post`): the chatter beside it. A page opened over a record
   * is given one that posts in that record's. False: nothing heard them.
   */
  post?(message: PostedMessage): boolean | void | Promise<boolean | void>;
  /**
   * The payment step a send waits on (a page's `payment`): show what is due, and settle once it is paid — through the
   * data source's `pay`, in the person's press — or with null once the person goes back to the answers: nothing is sent.
   * Left out, the form asks the source's `pay` itself.
   */
  pay?(due: PaymentDue, request: PayRequest): Promise<PaidPayment | null>;
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
   * past its steps. Absent when a button's `confirm` was answered No, or when
   * the save a record's button makes before its steps was refused.
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
  /**
   * A run the person or the app set off — a button, its key, a line's button, `form.run` — reads what is typed
   * first (`'first'`), as a save does: before its first step that reads the form or hands its values on (`set`, a
   * `call`, an `open` with values, a `when`…), every box is read and a name looked up waited for, and text that does
   * not read stops it, said under its box. `'read'` once done. A moment's run takes the values as they are: it never
   * reads a box under the person's keys.
   */
  typed?: 'first' | 'read';
  /**
   * What the run's own steps wrote since its last save, by field: what it held
   * before the first of them, whether that was the person's own change, and
   * what the last wrote. Put back when the run's save is refused.
   */
  wrote?: Map<string, { before: Value; mine: boolean; after: Value }>;
  /** A press that offers Undo: what it said and did, to be taken back (`PressTaken`). */
  taken?: PressTaken;
}

/** What a run reaches its form by: the form gives these. */
export interface RunForm {
  readonly fields: Readonly<Record<string, Field>>;
  values(): Readonly<Values>;
  recordId(): RecordId | null;
  /** The values as expressions read them, and what else they read. */
  reading(): { context: Record<string, unknown>; env: ExpressionEnv };
  today(): string;
  /**
   * Write fields as a step does: worked out once, no person's change. Throws for a field the page lacks. `chain`, the
   * run's: a page's `change` steps work out the person's change, and a write of theirs leaves it the person's.
   */
  write(values: Values, chain: readonly string[]): void;
  /** Write values the record holds where it is kept: no change to save. */
  store(values: Values): void;
  /** Whether a field holds the person's own change, not one a step or the app wrote. */
  mine(field: string): boolean;
  /** Put back what a run's steps wrote, as `write` does; the fields in `mine` are the person's own changes again. */
  putBack(values: Values, mine: readonly string[]): void;
  addLine(field: string, values: Values): void;
  /** Check fields as sending does: what is still typed in a box read first, a name being looked up waited for. */
  check(fields: readonly string[] | undefined): Stopped | null | Promise<Stopped | null>;
  /**
   * What is typed read, as a save reads it — a name being looked up waited for: null to go on, else why the run
   * stops — text left in a box that does not read, said under its box as a check says it.
   */
  typedFirst(): Promise<Stopped | null>;
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
  /** Why the person may not change, archive, copy or delete the record, as its source told: their words to say; null when they may. */
  barred?(right: 'edit' | 'archive' | 'duplicate' | 'delete'): string | null;
}

export const DONE: RunResult = Object.freeze({ done: true });

/** What a press that offers Undo starts keeping (`RunScope.taken`), from the values it begins with. */
export const takenNow = (at: Values = {}): PressTaken => ({ said: [], app: [], at: structuredCopy(at) });

/** The kinds of field an expression gives a value to; the rest hold records, lines or files, and take a field named alone whole. */
const EXPRESSIBLE = new Set(['char', 'text', 'html', 'integer', 'float', 'monetary', 'boolean', 'date', 'datetime', 'selection', 'json']);

const wordsOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** Steps run against one form. Expressions are read once and kept. */
export function createRunner(form: RunForm) {
  const expressions = new Map<string, CompiledExpression>();
  const conditions = new Map<string, CompiledModifier>();

  /** The app's functions the form's expressions call: one table for the form's life. */
  const functions = () => form.reading().env.functions;
  const expression = (source: string) => {
    let found = expressions.get(source);
    if (!found) expressions.set(source, (found = compileExpression(source, functions())));
    return found;
  };

  function holds(when: Modifier): boolean {
    if (typeof when === 'boolean') return when;
    let found = conditions.get(when);
    if (!found) conditions.set(when, (found = compileModifier(when, functions())));
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

  /** Write as a step does, noting in the run what each field held before its first write and what it holds now. */
  function writeIn(scope: RunScope, names: readonly string[], write: () => void) {
    const journal = (scope.wrote ??= new Map());
    const before = new Map(names.filter((name) => !journal.has(name)).map((name) => [name, { before: structuredCopy(form.values()[name] ?? null) as Value, mine: form.mine(name) }]));
    write();
    for (const name of names) {
      const first = journal.get(name) ?? before.get(name);
      if (first) journal.set(name, { before: first.before, mine: first.mine, after: structuredCopy(form.values()[name] ?? null) as Value });
    }
  }

  /** Words a run says: held, for a press that offers Undo, to be said as it ends; else said now. */
  function tell(scope: RunScope | null, message: string, tone: Tone) {
    if (scope?.taken) scope.taken.said.push({ message, tone });
    else form.host?.say(message, tone);
  }

  /**
   * The run's save was refused: what its steps wrote since its last save is put back, each field only while it
   * still holds what they wrote — a change made since by anyone else stays.
   */
  function putBack(scope: RunScope) {
    const journal = scope.wrote;
    if (!journal?.size) return;
    const back: Values = {};
    const mine: string[] = [];
    // On the record it wrote to: another shown since holds none of it.
    if (form.generation() === scope.generation) {
      for (const [name, { before, mine: was, after }] of journal) {
        if (!sameValue(form.values()[name], after)) continue;
        back[name] = before;
        if (was) mine.push(name);
      }
    }
    journal.clear();
    if (Object.keys(back).length) form.putBack(back, mine);
  }

  async function ask(message: string): Promise<boolean> {
    if (form.host) return form.host.ask(message);
    if (form.confirm) return form.confirm(message);
    return true;
  }

  function cannot(message: string): Stopped {
    return { reason: 'cannot', message };
  }

  /**
   * THE rule for every wait a step makes — a page opened, the app's call, the source archiving, copying, deleting:
   * what follows it is for the record the run is on, and is done only while that one is still shown. Another shown
   * meanwhile — by the pager, the app, anything but the run's own steps — the answer is laid on no record.
   */
  const replaced = (scope: RunScope) => form.generation() !== scope.generation;

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
    // Its answers are for the record that opened it: another shown meanwhile takes none of them.
    if (replaced(scope)) return form.gone();
    if (step.into) {
      const values = into(step.into, result);
      writeIn(scope, Object.keys(values), () => form.write(values, scope.chain));
    }
    if (!step.then) return null;
    const then = await runSteps(step.then, scope, true);
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
      const raw = alone === 'id' ? id : alone !== null && !EXPRESSIBLE.has(def.type) && alone in answers ? answers[alone] : expression(source).evaluate(context, { today: form.today, functions: functions() });
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
    // A press offering Undo whose call the app answered with no way back: Fieldia cannot take it back by itself.
    if (scope.taken && !answer?.undo) scope.taken.beyond = 'call';
    if (!answer) return null;
    // The app's own undo for what it did: its words are held to be said with Undo.
    if (answer.undo) (scope.taken ??= takenNow()).app.push(answer.undo);
    return answered(answer, scope);
  }

  /** The app's answer to a call, or to its own undo, laid over the form: values, words, a reload, another record… */
  async function answered(answer: ActionResult, scope: RunScope): Promise<Stopped | null> {
    // Answered for a record no longer shown: nothing of it is laid over the one shown now. Its words to the person are
    // laid over no record, and are said still — a dialog's "Payment … posted", answered as it closed, as before.
    if (replaced(scope)) {
      if (answer.say !== undefined) {
        const said = typeof answer.say === 'string' ? { message: answer.say } : answer.say;
        tell(scope, said.message, said.tone ?? 'info');
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
      writeIn(scope, Object.keys(known), () => form.write(known, scope.chain));
    }
    if (answer.say !== undefined) {
      const said = typeof answer.say === 'string' ? { message: answer.say } : answer.say;
      tell(scope, said.message, said.tone ?? 'info');
    }
    if (answer.post !== undefined) {
      const posted = typeof answer.post === 'string' ? { message: answer.post } : answer.post;
      const stopped = await post(posted.message, posted.kind ?? 'note', false);
      if (stopped) return stopped;
      // Posted while another record was shown: the rest of the answer is not for that one.
      if (replaced(scope)) return form.gone();
    }
    if (answer.record !== undefined) {
      const moved = await ownMove(scope, () => form.showRecord(answer.record as RecordId | null, scope.chain));
      if (moved) return moved;
    }
    if (answer.file) {
      const host = form.host;
      if (!host?.file) return cannot(`Nothing can show the file "${answer.file.name}" here: the form has no host that shows files`);
      await host.file(answer.file);
    }
    if (answer.open) {
      const opened = await open(answer.open, scope);
      if (opened) return opened;
    }
    if (answer.stop) {
      if (typeof answer.stop === 'string') tell(scope, answer.stop, 'warning');
      return { reason: 'app', ...(typeof answer.stop === 'string' ? { message: answer.stop } : {}) };
    }
    return null;
  }

  /** Words posted: a `post` step's with each `{field}` filled in, or the app's as they are. */
  async function post(message: string, kind: 'note' | 'message', filled: boolean): Promise<Stopped | null> {
    const parts = filled ? splitValues(message) : [{ text: message }];
    // A field empty says its words while empty, where the page gives some ({field|words}).
    const said = (part: { text: string; field?: string; fallback?: string }) => (part.field ? form.wordsOf(part.field) || (part.fallback ?? '') : part.text);
    const text = parts.map(said).join('');
    // An html field's value comes as HTML; the rest are escaped, a line each.
    const body = parts.map((part) => (part.field && form.fields[part.field]?.type === 'html' && form.values()[part.field] ? String(form.values()[part.field]) : escapeHtml(said(part)))).join('');
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
      if (scope.taken) scope.taken.archived = scope.taken.archived === undefined ? name === 'archive' : undefined;
      form.told({ archived: name === 'archive' }, id);
      // Archived once another record is shown: that one is not loaded again over what is typed in it.
      if (replaced(scope)) return form.gone();
      return ownMove(scope, () => form.reload(scope.chain));
    }
    if (name === 'duplicate') {
      // What was changed goes with the copy: it is saved first. What that save could not take — changes Reload set
      // aside, a change made while it ran — goes only when the person says so, before any copy is made; and a change
      // made while the copy is made, before the copy shows.
      // A record the person may not change has nothing to save: what is changed in it is asked about instead.
      if (form.changed() && !form.barred?.('edit')) {
        const saved = await form.save(scope.chain);
        if (saved) return saved;
        scope.wrote?.clear();
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
      // Copied once another record is shown: the copy is made, and told; the form stays on the one shown, with what is typed in it.
      if (replaced(scope)) {
        form.told({ copied }, id);
        return form.gone();
      }
      const moved = await ownMove(scope, () => form.showRecord(copied, scope.chain));
      if (moved) return moved;
      form.told({ copied }, id);
      return null;
    }
    // Deleted: what the person had not saved in it goes with it, unasked — they chose to delete it. Refused, it stays.
    if (!form.remove) {
      const stopped = await form.deleting(() => instead(name, 'delete', scope), (out) => !out);
      return stopped ?? told(scope, { deleted: true }, id);
    }
    const remove = form.remove;
    await form.deleting(() => remove(), () => true);
    return told(scope, { deleted: true }, id);
  }

  /**
   * The record deleted, told: a pager showing it moves on at once, and that move is this run's own. Deleted once
   * another record is shown, the run stops there: that one is not left, nor its steps run on it.
   */
  function told(scope: RunScope, event: { deleted: true }, id: RecordId): Stopped | null {
    const late = replaced(scope);
    form.told(event, id);
    if (late) return form.gone();
    scope.generation = form.generation();
    return null;
  }

  /** A step of this run showing another record (or this one loaded again): the run goes on, on that one. */
  async function ownMove(scope: RunScope, move: () => Promise<Stopped | null>): Promise<Stopped | null> {
    const stopped = await move();
    scope.generation = form.generation();
    // The record as it is now, loaded or another: what was written before is no longer the run's to put back.
    scope.wrote?.clear();
    return stopped;
  }

  async function runStep(step: ActionStep, scope: RunScope): Promise<Stopped | null> {
    switch (step.do) {
      case 'set': {
        const def = fieldOf(step.field);
        const value = fit(def, read(step.value, !EXPRESSIBLE.has(def.type)));
        writeIn(scope, [step.field], () => form.write({ [step.field]: value }, scope.chain));
        return null;
      }
      case 'clear': {
        const value = emptyValue(fieldOf(step.field));
        writeIn(scope, [step.field], () => form.write({ [step.field]: value }, scope.chain));
        return null;
      }
      case 'addLine': {
        const def = fieldOf(step.field);
        if (def.type !== 'one2many') return cannot(`"${step.field}" is a ${def.type}; a line is added to a one2many`);
        const values: Values = {};
        for (const [name, source] of Object.entries(step.values ?? {})) {
          const sub = def.fields[name];
          if (!sub) return cannot(`The lines of "${step.field}" have no field "${name}"`);
          values[name] = fit(sub, read(source, !EXPRESSIBLE.has(sub.type)));
        }
        writeIn(scope, [step.field], () => form.addLine(step.field, values));
        return null;
      }
      case 'check':
        return form.check(step.fields);
      case 'save': {
        const stopped = await form.save(scope.chain);
        // Saved: what the steps wrote is the record's now.
        if (!stopped) scope.wrote?.clear();
        return stopped;
      }
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
        tell(scope, step.message, step.tone ?? 'info');
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
      case 'print': {
        const host = form.host;
        if (!host?.print) return cannot('Nothing can print here: the form has no host that prints');
        await host.print();
        return null;
      }
    }
  }

  /**
   * A run the person or the app set off reads what is typed before its first step that reads the form or hands its
   * values on: THE one place a run of steps meets the input rules, whatever its steps are. The line its button was
   * pressed on is taken again then, as what was typed in it reads.
   */
  async function typedFirst(scope: RunScope): Promise<Stopped | null> {
    scope.typed = 'read';
    const stopped = await form.typedFirst();
    if (stopped) return stopped;
    const linesOf = (field: string) => (form.values()[field] as Line[] | null | undefined) ?? [];
    if (scope.line) {
      const { field, key } = scope.line;
      const now = linesOf(field).find((line) => line.key === key);
      if (now) scope.line = { field, key, values: structuredCopy(now.values) };
    }
    if (scope.lines) {
      const { field, keys } = scope.lines;
      const now = keys.map((key) => linesOf(field).find((line) => line.key === key));
      if (now.every(Boolean)) scope.lines = { ...scope.lines, values: now.map((line) => structuredCopy((line as Line).values)) };
    }
    return null;
  }

  /** Run steps; a run's own (not an open step's `then`, which its open step answers for) puts back what it wrote when its save is refused. */
  async function runSteps(steps: readonly ActionStep[], scope: RunScope, inner = false): Promise<RunResult> {
    scope.generation ??= form.generation();
    for (let at = 0; at < steps.length; at++) {
      const step = steps[at];
      let stopped: Stopped | null;
      try {
        // The record it ran on was replaced by something else meanwhile: the rest is not for the one shown now.
        if (form.generation() !== scope.generation) stopped = form.gone();
        // Asked only where it reads: a run with nothing to read goes on in the same tick, as ever.
        else if (scope.typed === 'first' && readsForm(step) && (stopped = await typedFirst(scope))) {
          // What is typed does not read: nothing is done with the values under it.
        } else if (step.when !== undefined && !holds(step.when)) continue;
        else stopped = await runStep(step, scope);
      } catch (error) {
        stopped = { reason: 'cannot', message: wordsOf(error), error };
      }
      if (stopped) {
        if (!inner && (stopped.reason === 'save' || stopped.reason === 'check') && savesIn(steps)) putBack(scope);
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

  /** What a press's Undo takes back with, in the undo part (press-undo.ts): the runner's own ways, on this form. */
  const kit: UndoKit = { form, answered, recordStep, replaced, tell, runSteps };
  return { runSteps, ask, kit };
}

/**
 * Whether a step reads the form's values or hands them on — what is typed is read before it, for a run the person or
 * the app set off: a `when`; `set` and `addLine`, which work values out; a `call`, handing them to the app; an `open`
 * with values, a record or a filter from them; `post`, `openUrl`; `print`, which prints them as words. A save, a check and a step forward read on their own;
 * the ways out (`reload`, `close`, `reset`, another record) ask about what is typed instead; `archive`, `duplicate`
 * and `delete` act on the record as stored.
 */
function readsForm(step: ActionStep): boolean {
  if (step.when !== undefined) return true;
  switch (step.do) {
    case 'set':
    case 'addLine':
    case 'call':
    case 'post':
    case 'openUrl':
    case 'print':
      return true;
    case 'open':
      return step.values !== undefined || step.record !== undefined || step.filter !== undefined;
    default:
      return false;
  }
}

/** Whether steps save, themselves or in an opened page's `then`. */
function savesIn(steps: readonly ActionStep[]): boolean {
  return steps.some((step) => step.do === 'save' || (step.do === 'open' && !!step.then && savesIn(step.then)));
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
export function createMoments(run: (key: string, steps: readonly ActionStep[], chain: readonly string[], on?: number) => Promise<RunResult>, now?: () => number) {
  interface Slot {
    running: Promise<RunResult>;
    queued?: Promise<RunResult>;
    /** The record (`now`) it was last set off on, for the run queued after the one going. */
    on?: number;
  }
  const slots = new Map<string, Slot>();

  return function moment(key: string, steps: readonly ActionStep[] | undefined, chain: readonly string[], again: boolean): Promise<RunResult> {
    if (!steps?.length || chain.includes(key)) return Promise.resolve(DONE);
    /** A run of it, known as running before its first step does: a step that sets it off again finds it busy. */
    const go = (slot: Slot, on = now?.()): Promise<RunResult> => {
      let settle!: (result: Promise<RunResult>) => void;
      const running: Promise<RunResult> = new Promise<RunResult>((resolve) => (settle = resolve)).finally(() => {
        if (slot.running === running && !slot.queued) slots.delete(key);
      });
      slot.running = running;
      // Set off on a record no longer shown: its steps were for that one, and are let go.
      settle(on !== undefined && now && on !== now() ? Promise.resolve(DONE) : run(key, steps, [...chain, key], on));
      return running;
    };
    const busy = slots.get(key);
    if (!busy) {
      const slot: Slot = { running: Promise.resolve(DONE) };
      slots.set(key, slot);
      return go(slot);
    }
    if (!again) return Promise.resolve(DONE);
    busy.on = now?.();
    if (!busy.queued) {
      const next = () => {
        busy.queued = undefined;
        return go(busy, busy.on);
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
