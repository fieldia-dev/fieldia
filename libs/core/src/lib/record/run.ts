import type { ActionStep, OpenStep, PanelSide } from '../format/actions';
import type { Field } from '../format/field';
import type { JsonValue } from '../format/json';
import type { MenuItem, Tone } from '../format/layout';
import type { ExpressionEnv } from '../expression/expression';
import type { PaidPayment, PaymentDue, PayRequest, ResolvedFilter } from './data-source';
import type { Facet } from './search';
import { structuredCopy, type RecordId, type Value, type Values } from './values';
import type { Messages } from './messages';

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
 *
 * What it runs, and how a run ends, are named here; the engine itself (run-steps.ts) is in a part of its own.
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
 * focus on Cancel: Enter keeps the work. `yes`: what answering Yes does, in
 * words its Yes button says — a button's `confirm` is answered by the button's
 * own words, Archive by Archive, "Paste 40 rows: change 7 and add 33?" by
 * Paste 40 rows —, never a bare OK.
 */
export interface AskHow {
  discard?: boolean;
  yes?: string;
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

/**
 * What a run is for: the id calls carry, the records chosen in a list, and the words of what set it off (a menu item's
 * label), which an `ask` step's Yes says: answered Yes, the run goes on doing it.
 */
export interface RunContext {
  id?: string;
  recordIds?: RecordId[];
  yes?: string;
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
  /** The words of what set the run off — a button's label, a menu item's — which its `ask` steps' Yes says. */
  yes?: string;
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
  /** The form's words, for what a step says it did not do. */
  readonly messages: Messages;
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
  /** `yes`: the words of what set it off, which its `beforeSave` questions' Yes says. */
  save(chain: readonly string[], yes?: string): Promise<Stopped | null>;
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
  confirm?: (message: string, how?: AskHow) => boolean | Promise<boolean>;
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

/** A question a run asks — a button's `confirm`, an `ask` step: the host's, else the app's `confirm`, else answered Yes. */
export async function askOf(form: Pick<RunForm, 'host' | 'confirm'>, message: string, yes?: string): Promise<boolean> {
  const how = yes ? { yes } : undefined;
  if (form.host) return form.host.ask(message, how);
  if (form.confirm) return form.confirm(message, how);
  return true;
}

/**
 * One run of each moment at a time. A moment set off by a step of its own
 * run — or a run it set off — does not run. Set off while a run of it is
 * going: `again` moments (open, change, show) run once more after it, with
 * the values as they are then, however many times they were set off
 * meanwhile; the others (beforeSave, afterSave) do not run — a save made
 * meanwhile goes ahead without them, so nothing waits on itself.
 */
export function createMoments(run: (key: string, steps: readonly ActionStep[], chain: readonly string[], on?: number, yes?: string) => Promise<RunResult>, now?: () => number) {
  interface Slot {
    running: Promise<RunResult>;
    queued?: Promise<RunResult>;
    /** The record (`now`) it was last set off on, for the run queued after the one going. */
    on?: number;
  }
  const slots = new Map<string, Slot>();

  /** `yes`: the words of what set it off (a save's Submit), which its questions' Yes says. */
  return function moment(key: string, steps: readonly ActionStep[] | undefined, chain: readonly string[], again: boolean, yes?: string): Promise<RunResult> {
    if (!steps?.length || chain.includes(key)) return Promise.resolve(DONE);
    /** A run of it, known as running before its first step does: a step that sets it off again finds it busy. */
    const go = (slot: Slot, on = now?.()): Promise<RunResult> => {
      let settle!: (result: Promise<RunResult>) => void;
      const running: Promise<RunResult> = new Promise<RunResult>((resolve) => (settle = resolve)).finally(() => {
        if (slot.running === running && !slot.queued) slots.delete(key);
      });
      slot.running = running;
      // Set off on a record no longer shown: its steps were for that one, and are let go.
      settle(on !== undefined && now && on !== now() ? Promise.resolve(DONE) : run(key, steps, [...chain, key], on, yes));
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
