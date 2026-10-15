import type { ActionStep } from '../format/actions';
import type { DefinitionsFrom, Field, Fields, LineField, Option, OptionsFrom, PropertyDefinition } from '../format/field';
import type { ButtonNode, FieldNode, FormNode, HeadLink, LayoutNode, MenuItem, Modifier, RootLayout, StatButton, StepNode } from '../format/layout';
import type { Page } from '../format/page';
import type { JsonValue } from '../format/json';
import { upgradePage } from '../format/upgrade';
import { compileModifier, type CompiledModifier } from '../expression/modifier';
import type { ExpressionEnv } from '../expression/functions';
import { localDay } from '../expression/functions';
import { checkProperties, checkValue } from './check';
import { checkInput } from './inputs';
import { compileComputed } from './compute';
import { compileSetWhen } from './set-when';
import { checkRules, compileRules, type CompiledRule } from './rules';
import { expressionEnv, lineContext, recordContext } from './env';
import { firstValues, readLooseMap, readValueMap, type MapScope } from './value-map';
import { resolveFilter } from './filter';
import { rolesAllow } from './roles';
import { compileFieldTone, compileTable, type CompiledTable, type FieldTone, type LineState } from './cells';
import { fill, MESSAGES, type Messages } from './messages';
import {
  loadedRecordOf,
  saveProblemOf,
  type DataSource,
  type LineOp,
  type LinkOp,
  type RecordChanges,
  type RecordPermissions,
  type RecordVersion,
  type ResolvedFilter,
  type SaveConflict,
  type SaveProblem,
  type UploadFile,
} from './data-source';
import { createUploads, fileBytesIn, uploadGoing, withoutFileBytes, type FileUpload, type UploadHow } from './uploads';
import { hostScheduler, type Scheduler } from './scheduler';
import { createMoments, createRunner, type ActionHost, type ActionRequest, type ActionResult, type OnAction, type PostedMessage, type RunContext, type RunResult, type RunScope, type Stopped } from './run';
import {
  emptyValue,
  initialValues,
  isEmpty,
  lineKind,
  structuredCopy,
  type Line,
  type RecordId,
  type RelatedRecord,
  type Value,
  type Values,
} from './values';

export type FormStatus = 'idle' | 'loading' | 'ready' | 'saving' | 'saved' | 'error';

export interface FormState {
  readonly status: FormStatus;
  readonly recordId: RecordId | null;
  readonly values: Readonly<Values>;
  /** Messages by field name; a line's field is `field.lineKey.subfield`, a saved form's field `name.field`. */
  readonly errors: Readonly<Record<string, string>>;
  /** Fields that differ from the record as loaded or last saved. */
  readonly dirty: readonly string[];
  /**
   * Warnings by field name, from answer rules at the warning level: shown,
   * never blocking. Kept current as values change, for the fields people can see.
   */
  readonly warnings: Readonly<Record<string, string>>;
  /** A warning from the data source's onchange, shown without blocking. */
  readonly warning: string | null;
  /** The field whose change brought the warning, so it can be shown beside it. */
  readonly warningField: string | null;
  /** Why loading or saving failed. */
  readonly error: string | null;
  /** A saved draft that can be restored. */
  readonly draft: { savedAt: string } | null;
  /** The wizard step on screen, for a wizard page. */
  readonly step: string | null;
  /** Optional steps passed over with Skip: their answers are left out, and not asked for. */
  readonly skipped: readonly string[];
  /** Why the last save was refused, until the next one starts or the form is reset. */
  readonly saveProblem: SaveProblem | null;
  /** The choices loaded from the app's lists, by field: those of a selection with `optionsFrom`, once asked for. */
  readonly choices: Readonly<Record<string, Choices>>;
  /** The definitions loaded for a properties field with `definitionsFrom`, by field, once asked for. */
  readonly definitions: Readonly<Record<string, Definitions>>;
  /** Files on their way to the data source's store, in the order picked: each field shows its own (`upload`). */
  readonly uploads: readonly FileUpload[];
  /** The record's version, as loaded or last saved, from a source that keeps versions: each save carries it. Null for a new record, or from a source that tells none. */
  readonly version: RecordVersion | null;
  /**
   * What the person may do with the record, as its source told with its load
   * or its last save: the form keeps to it — fields locked or hidden, Save,
   * Archive, Duplicate and Delete not offered. Null when it told nothing, and
   * everything is allowed.
   */
  readonly can: Readonly<RecordPermissions> | null;
  /** Someone else saved the record after this page opened it, and the last save was refused for it: until Reload, Keep mine or another save. */
  readonly conflict: FormConflict | null;
  /** The person's changes Reload set aside after a conflict, by field, to put back (`putBack`); null when none are. */
  readonly setAside: Readonly<Values> | null;
  /**
   * Fields holding a change of the person's that the last finished save of
   * this record did not send: made while it was on its way, while the run that
   * saved went on (its afterSave run, a copy being made), or since. Worked out
   * from the record as that save left it, so a change back to it is none; and
   * before the record's first save, only a file the store holds and no save
   * sent. Never a value a step, a rule, a compute or the app set: each change
   * is told by its origin. The next record starts with none.
   */
  readonly unsent: readonly string[];
  /**
   * A way out (`leave()`) waits for the save on its way, or files on theirs,
   * before it checks: the page says what it waits for.
   */
  readonly leaving: boolean;
  /**
   * Text a person left in a box that does not read as its field's value — "12 34" in a number, "31/02/2026" in a
   * date — by its path (`field`, or a line's `field.lineKey.subfield`), with why in words. The field keeps the
   * value it held as the box was entered; validate and save refuse with the words until the text is fixed.
   */
  readonly unread: Readonly<Record<string, UnreadText>>;
}

/** Text left in a box that does not read, and why, as `FormState.unread` keeps it. */
export interface UnreadText {
  readonly text: string;
  readonly message: string;
}

/** A save refused because someone else saved the record first: who and when, and what each of them changed. */
export interface FormConflict {
  /** The version the record has now, with who saved it (`by`) and when (`at`): Keep mine saves over it. */
  readonly version: RecordVersion;
  /** The record as they left it, when the source told it. */
  readonly theirs?: Readonly<Values>;
  /** The fields they changed since this page opened the record, in the page's order: none known when the source did not tell the record. */
  readonly changed: readonly string[];
  /** Those of them this person changed too, each to something else. */
  readonly both: readonly string[];
  /**
   * Keep mine was pressed, and the record as they left it could not be read:
   * nothing was saved over their work, and the person may try again or Reload.
   */
  readonly unread?: boolean;
}

/**
 * Whether leaving the record now would lose the person's work: changes not
 * saved, files still on their way to the store, or changes Reload set aside
 * and not yet put back or let go, or text left in a box that does not read.
 * Every way out of a record asks this.
 */
export function unsavedWork(state: FormState): boolean {
  return state.dirty.length > 0 || Object.keys(state.unread ?? {}).length > 0 || state.setAside != null || (state.uploads ?? []).some(uploadGoing);
}

/**
 * Whether a way out would lose the person's work without their knowing: a
 * change of theirs the last save did not send (`unsent`), files still on
 * their way, changes Reload set aside — and, `how.changes`, any change not
 * saved. What `form.leave()` — the one check every way out goes through —
 * asks about, once the save on its way and the files on theirs settled.
 * Before a record's first save, a change not saved is not at risk: as in
 * 0.20, each way out decides.
 */
export function workAtRisk(state: FormState, how: LeaveHow = {}): boolean {
  return (state.unsent ?? []).length > 0 || state.setAside != null || (state.uploads ?? []).some(uploadGoing) || (how.changes === true && (state.dirty.length > 0 || Object.keys(state.unread ?? {}).length > 0));
}

/**
 * How a way out asks: `changes`, every change not saved counts too, as a
 * panel's Escape has always asked; `discard`, the person's own Discard: it
 * waits as any way out does, asks nothing, and lets their work go.
 */
export interface LeaveHow {
  changes?: boolean;
  discard?: boolean;
}

/** A properties field's definitions from the app, as they load. */
export interface Definitions {
  /** The definitions last loaded: null until the first load ends well. */
  readonly definitions: PropertyDefinition[] | null;
  readonly loading?: boolean;
  /** Why the last load failed. */
  readonly error?: string;
}

/** A field's choices from one of the app's lists, as they load. */
export interface Choices {
  /** The choices last loaded: null until the first load ends well. */
  readonly options: Option[] | null;
  readonly loading?: boolean;
  /** Why the last load failed. */
  readonly error?: string;
}

/** What a layout element looks like right now. */
export interface NodeState {
  invisible: boolean;
  readonly: boolean;
  required: boolean;
  /** A toggle button's: pressed while its `pressed` holds. Left out for every other part. */
  pressed?: boolean;
}

/** localStorage fits this, and so does anything else with the same three methods. */
export interface DraftStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type { ActionRequest } from './run';

/** Whose change it was: a person's (in the UI), a step's, or the app's (`setValues`, or `setValue` told so). Only a person's runs the page's `change` steps. */
export type ChangeBy = 'person' | 'step' | 'app';

/** What a form tells the app, by event: `form.on(event, listener)`. */
export interface FormEvents {
  /** A field was written: by a person, a step or the app. Values worked out from it are not told. */
  change: { field: string; value: Value; values: Readonly<Values>; by: ChangeBy };
  /** A record was saved. */
  save: { recordId: RecordId | null; values: Readonly<Values> };
  /** A page of responses sent its answers: those sent. */
  send: { values: Values };
  /** The app answered a call: with nothing (undefined), or an `ActionResult`. */
  action: { request: ActionRequest; result: ActionResult | undefined };
  /** A run of steps ended — a button's, a moment's, `form.run`'s — and how. */
  run: { id: string; steps: readonly ActionStep[]; result: RunResult };
  /** A wizard's step was entered. */
  step: { step: string };
  /** The form has its values: loaded, or new. */
  open: { recordId: RecordId | null; values: Readonly<Values> };
  /** The record was archived (`archived` true) or brought back, by a step. */
  archive: { recordId: RecordId; archived: boolean };
  /** The record was copied, by a step: the form shows the copy now. */
  duplicate: { from: RecordId; recordId: RecordId };
  /**
   * The record was deleted, by a step. A listener may show another record
   * (`openRecord`), as a pager moves on; else the form starts a new one.
   */
  delete: { recordId: RecordId };
  /** Words to post in the record's conversation, from a `post` step or the app's answer: the chatter beside it listens. */
  post: { recordId: RecordId | null; message: PostedMessage };
}

export interface FormOptions {
  page: Page;
  dataSource?: DataSource;
  /** The record to edit. Leave out for a new record or a survey. */
  recordId?: RecordId | null;
  /** Values to start with, on top of each field's default. */
  values?: Values;
  /**
   * The app's own actions: a button's `action`, and each `call` step. Fieldia
   * hands the request over and waits; the app may answer (`ActionResult`)
   * with values to set, words to say, a page to open, or to stop. Nothing
   * answered means go on.
   */
  onAction?: OnAction;
  /** The UI the core cannot draw — pages opened, words said, questions asked — given by the viewer. */
  host?: ActionHost;
  /** How a question is asked when there is no host. Without either, a question goes on as though answered Yes. */
  confirm?: (message: string) => boolean | Promise<boolean>;
  drafts?: { store: DraftStore; restore?: 'auto' | 'ask'; delayMs?: number };
  autosave?: { delayMs: number };
  scheduler?: Scheduler;
  /** Validation messages in the page's language. English by default. */
  messages?: Messages;
  /** The clock, for `today()` and for dates that must be past or future. The computer's own when left out. */
  now?: () => Date;
  /**
   * The person using the form: conditions read it as `user` (`user.id`,
   * `user.name`, `user.roles`), and a part with `roles` shows only to people
   * in them. Left out, the person has no id and no roles.
   */
  user?: FormUser;
  /** Whether the record starts being edited, as conditions read `editing`; true unless said. A view locking it says so with `setEditing`. */
  editing?: boolean;
  /**
   * Values the app passes in, as Flectra's context: read by conditions and
   * expressions as `context.name`, and by a filter's `valueFrom:
   * "context.name"` — a transfer opened from Receipts restricting its
   * operation types. They are the app's, never the page's: nothing saves
   * them, and a page's field of that name comes first.
   */
  context?: Readonly<Record<string, JsonValue>>;
  /**
   * The record this form's values are a line of, when the form edits one
   * table's line in a form of its own (a node's `lineForm`): its values and
   * fields, read by conditions and filters as `parent`, as a line's are —
   * `parent.state`, a filter's `valueFrom: "parent.company_id"`.
   */
  parent?: { values: Readonly<Values>; fields: Readonly<Record<string, Field | LineField>>; id?: RecordId | null };
}

/** The person using a form, as the app knows them. */
export interface FormUser {
  id: RecordId | null;
  name?: string;
  /** The roles they hold, by the names the page's `roles` use: Flectra's groups, such as `sales_team.group_sale_manager`. */
  roles?: readonly string[];
}

export interface Form {
  readonly page: Page;
  getState(): FormState;
  subscribe(listener: (state: FormState) => void): () => void;
  load(): Promise<void>;
  /** Write a field: a person's change unless told otherwise, and only a person's runs the page's `change` steps. */
  setValue(name: string, value: Value, how?: { by?: ChangeBy }): void;
  /**
   * Write several fields at once, worked out once: the app's change, never a
   * person's. Throws for a field the page lacks. With `stored`, they are the
   * values the record already holds where it is kept — whether it is
   * followed, how many comments it has: written as loaded ones are, they never
   * count as a change to save.
   */
  setValues(values: Values, how?: { stored?: boolean }): void;
  node(id: string): NodeState;
  /** Whether the record is being edited, as conditions read `editing`: a view that locks it to be read says false, and parts follow. */
  setEditing(editing: boolean): void;
  /** Whether a field is read-only whatever the conditions say: by its definition, or for this person by what the record's source said (`can`). */
  fieldReadonly(name: string): boolean;
  /** What a field would be told if the form were checked now, or null when it passes. Nothing is shown. */
  problem(field: string): string | null;
  /**
   * Keep text a person left in a box that does not read (`FormState.unread`), by its path — `field`, or a line's
   * `field.lineKey.subfield` — with why in words; null once it reads, or is let go. Nothing is shown until the box
   * is left (`boxLeft`) or the form is checked.
   */
  setUnread(path: string, unread: UnreadText | null): void;
  /**
   * A person left a field's box, by its path: its own problem — text that does not read, a format, min or max, a
   * whole number, decimals, a pattern — is shown now, in the words Save would use. That it is required waits for Save.
   */
  boxLeft(path: string): void;
  /**
   * How a box reads what is typed in it and not yet read — a number, hours, a date, a colour's code, a name looked
   * up — now, as if it were left: every save and send, every check and step forward runs these first (`settle`), so
   * Ctrl+Enter, a button's key, a pager or the app's own save keep what the box shows, or refuse it with its words,
   * and never save a value passed on the way ("1" of "1.5") or the one the box held before. The viewer gives one
   * for the box that has the focus (a change, which each box reads); a box whose reading waits — a name looked up
   * among records — gives its own, which keeps the text unread with why at once, and returns the wait: a save
   * waits for it, while a check or a step forward, which cannot wait, refuses meanwhile. `typing` says whether the
   * box is still being typed in (typed since it last read): autosave, which nobody pressed, waits while it is, and
   * never reads text under the person's keys ("12." of "12.5", "Office " of "Office Park"). Returns what stops it.
   */
  settling(read: () => void | Promise<unknown>, typing?: () => boolean): () => void;
  /**
   * Read what is typed and not yet read in every box (`settling`), as if each were left: a save does it first.
   * Resolves once every reading that waits (a name looked up) has ended.
   */
  settle(): Promise<void>;
  /**
   * Whether a box's reading of what was typed still waits (a name being looked up): a check or a step forward made
   * now refuses its text with "still looking", so a caller that can wait for it (`settle`) checks again after.
   */
  reading(): boolean;
  validate(): boolean;
  save(): Promise<boolean>;
  reset(): void;
  changes(): RecordChanges;
  addLine(field: string, values?: Values): string;
  updateLine(field: string, key: string, name: string, value: Value): void;
  removeLine(field: string, key: string): void;
  /** Move a line to another place among its lines, numbering its sequence field again. */
  moveLine(field: string, key: string, to: number): void;
  /**
   * What a line would become with these values once the data source's onchange
   * has run, as a line edited in a dialog shows its subtotal follow. Nothing is
   * written: the record, its changes and its autosave stay as they are.
   */
  previewLine(field: string, key: string, values: Values): Promise<Values>;
  /**
   * Show another record of the page's model in this form, loaded from the
   * data source as a pager moves to it, or a new one for null. Changes not
   * saved are dropped: save first. The page's `open` steps run for it. It
   * goes through `leave()` first: false when the person kept their work.
   */
  openRecord(id: RecordId | null): Promise<boolean>;
  /**
   * The one check every way out of the form goes through — another record,
   * the record loaded again, the form closed, reset by a step — and the app's
   * own ways out should too, before it navigates or unmounts the form. It
   * first waits for a save on its way and files on theirs (`leaving`
   * meanwhile), then looks at the record as it is now. With the person's
   * work at risk (`workAtRisk`), it asks "Discard your changes?" through the
   * host (`ask(message, { discard: true })`), else `confirm`: true on
   * Discard — files on their way stopped, changes set aside let go — false
   * on Cancel, the form as it was. Without either to ask with, the work is
   * kept: false. A way out taken while one waits or asks joins it. Nothing
   * on its way and nothing at risk: true, as in 0.20.
   */
  leave(how?: LeaveHow): Promise<boolean>;
  /**
   * Whether a way out goes at once: nothing on its way, no check going, and
   * nothing of the person's at risk (with `how`) — then it goes in the same
   * moment, as in 0.20, and `leave()` would answer true. Else take it through
   * `leave()`. What the viewer's dialogs, pages in place and breadcrumbs ask
   * first, so a way out with nothing to wait for is not put off.
   */
  leaveNow(how?: LeaveHow): boolean;
  /**
   * Post words in the record's conversation, as a `post` step does: through
   * the form's host when it has a way to, else told to the form's own
   * listeners (`post`). False when nothing heard them.
   */
  post(message: PostedMessage): Promise<boolean>;
  /**
   * Load, or load again, the choices of a selection whose options come from
   * the app's list (`optionsFrom`). Once loaded, they load again by themselves
   * when a field they change with changes; the latest answer wins.
   */
  loadChoices(field: string): void;
  /**
   * Load, or load again, the definitions of a properties field whose
   * definitions come from a linked record (`definitionsFrom`). Once loaded,
   * they load again by themselves when a field they change with changes.
   */
  loadDefinitions(field: string): void;
  /** A property added in place to such a field: kept in its definitions, and handed to the data source's `saveDefinitions`. */
  addDefinition(field: string, definition: PropertyDefinition): Promise<void>;
  /**
   * Records a many2one, many2many or reference may point to. A reference needs
   * `options.model`, and so does structured data naming records of a model (a
   * json field, such as an analytic distribution's accounts); `options.ids`
   * finds those records alone, for their names.
   */
  search(field: string, query: string, limit?: number, options?: { model?: string; ids?: RecordId[] }): Promise<RelatedRecord[]>;
  /** The same, for a relation inside a one2many line, filtered by that line's values — or structured data of a line naming records of a model (`options.model`). */
  searchLine(field: string, key: string, subfield: string, query: string, limit?: number, options?: { model?: string; ids?: RecordId[] }): Promise<RelatedRecord[]>;
  /**
   * The values of records a many2many links to, for a table of them: `fields`
   * of the records with these ids, in the order asked, read with the data
   * source's `list`. None without one.
   */
  linkedValues(field: string, ids: readonly RecordId[], fields: readonly string[]): Promise<{ id: RecordId; values: Values }[]>;
  /** Whether a link field can make a record from a typed name: the data source must be able to. */
  canCreate(field: string): boolean;
  /** Make a record from a typed name, for the link field to point to, with what its `createValues` hand on. */
  quickCreate(field: string, name: string): Promise<RelatedRecord>;
  /** The same, for a link inside a one2many's lines; with the line's key, its `createValues` are read on that line. */
  canCreateLine(field: string, subfield: string): boolean;
  quickCreateLine(field: string, subfield: string, name: string, key?: string): Promise<RelatedRecord>;
  /** What a record made from a link starts with besides its name: its `createValues`, read now — on a line, on that line. */
  createValues(field: string, line?: { lines: string; key: string }): Values;
  steps(): string[];
  next(): boolean;
  back(): boolean;
  /** Pass over the step on screen, when it is optional and not the last one. */
  skip(): boolean;
  /**
   * Go to a step that applies. Back, at once; forward, only past steps that are
   * complete: it stops at the first one with a problem and shows it, and skips
   * an optional one instead.
   */
  goTo(step: string): boolean;
  /**
   * Press a button: ask its `confirm` first, run its `steps`, then call its
   * `action`, when it names one, as a final `call`. A list's button passes
   * the records chosen in it, and every call of the run carries them.
   */
  runAction(id: string, chosen?: { recordIds: RecordId[] }): Promise<RunResult>;
  /** A field's own value as its tones have it now: its tone and whether it is bold, read on the record. */
  fieldTone(nodeId: string): FieldTone;
  /** A table's line as its rules have it now — its tone, each ruled column's cells, which of its buttons show — by the table's field node. */
  lineState(nodeId: string, key: string): LineState;
  /** Whether a table's column is hidden now by its `hidden` rule, read on the record. */
  columnHidden(nodeId: string, column: string): boolean;
  /**
   * The words a field's empty box shows now, by its node (`#title` for a
   * sheet's title): its first `placeholderWhen` that holds, else its
   * `placeholder`; undefined when it has neither.
   */
  placeholder(nodeId: string): string | undefined;
  /** Press a button on a table's line: its confirmation, its steps, then its action, each call carrying the line. Hidden on that line, it does not run. */
  runRowAction(nodeId: string, buttonId: string, key: string): Promise<RunResult>;
  /**
   * Press a button for the lines chosen in a table (its `selectedButtons`),
   * by their keys: its confirmation, its steps, then its action, each call
   * carrying the lines. Hidden, or with no line chosen, it does not run.
   */
  runLinesAction(nodeId: string, buttonId: string, keys: readonly string[]): Promise<RunResult>;
  /** Run steps on this form, as a button would: `context.id` is what their calls carry (`run` when left out). */
  run(steps: readonly ActionStep[], context?: RunContext): Promise<RunResult>;
  /** A tab was shown: the viewer says so, and the page's `show` steps for it run. */
  shown(tab: string): void;
  /** Listen to one of the form's events; returns what stops listening. */
  on<E extends keyof FormEvents>(event: E, listener: (event: FormEvents[E]) => void): () => void;
  restoreDraft(): void;
  discardDraft(): void;
  /**
   * Whether a file picked for a file or picture field is stored at once,
   * through the data source's `upload`. False without one: a file then
   * travels inside the record as base64, as it always has.
   */
  canUpload(): boolean;
  /**
   * Store files picked for a file or picture field — or a field on a table's
   * line (`how.line`) — through the data source's `upload`, each as soon as
   * it is picked: `uploads` in the state shows each on its way, and once
   * stored the field holds its link, a field of several in the order they
   * were picked. Three go at once, the rest wait their turn; `how.prepare`
   * makes each ready first, one at a time (a photo made smaller). A field of
   * one file keeps the last one picked. Gives each upload's id. A save waits
   * for those still going, and stops, under the field, for one that failed.
   */
  upload(field: string, files: readonly UploadFile[], how?: UploadHow): string[];
  /**
   * A field's files on their way, in the order picked: the uploads in the
   * state that are its own. A table's cell (`lineForm`) gives its line's.
   */
  uploading(field: string): readonly FileUpload[];
  /** Stop an upload and drop its file, whether it is on its way, waiting, or failed. */
  cancelUpload(id: string): void;
  /** Send a file that failed again. */
  retryUpload(id: string): void;
  /**
   * After a conflict: show the record as the other person left it, loaded
   * again, and set this person's changes aside (`setAside`), to put back.
   * False when it could not be loaded.
   */
  reloadTheirs(): Promise<boolean>;
  /**
   * After a conflict: save this person's changes over the record as it is
   * now — the other person's values kept wherever this one changed nothing.
   * Refused again as a conflict when a third person saved in between.
   */
  keepMine(): Promise<boolean>;
  /** Write a change set aside by Reload back, as the person's own: one field's, or all when none is named. */
  putBack(field?: string): void;
  /** Let go of the changes set aside. */
  discardSetAside(): void;
  /** Resolves once every onchange, save, autosave and run of steps started so far has finished — a question still waiting for its answer included. */
  settled(): Promise<void>;
  /**
   * Give a saved form placed on this page (a `form` part, by its id) its page,
   * once the app has found it. From then its answers sit under the part's
   * name as an object, checked by that page's own rules: this form refuses
   * to save or send while one of them fails, with the error under
   * `name.field`, and shows it on the inner form beside its field. Returns the
   * inner form, which a view draws the part's fields from; giving the page
   * again returns the same one. A page placed inside itself, directly or
   * through others, is refused.
   */
  embed(id: string, page: Page): Form;
  /** The inner form of a saved form placed on this page, once it has its page; null until then. */
  embedded(id: string): Form | null;
  dispose(): void;
}

interface IndexedNode {
  id: string;
  parent: string | null;
  kind: 'field' | 'button' | 'stat' | 'other' | 'step' | 'form';
  field?: string;
  invisible: CompiledModifier;
  readonly: CompiledModifier;
  required: CompiledModifier;
  /** The roles it is shown to, when it names any. */
  roles?: readonly string[];
  /** A toggle button's condition for being pressed. */
  pressed?: CompiledModifier;
  /** What of the record a button's press does that its source may not allow: it is hidden from a person who may not. */
  does?: readonly RecordRight[];
  source: LayoutNode | StepNode | ButtonNode | StatButton | MenuItem | HeadLink | RootLayout | { id: string; invisible?: Modifier };
}

/**
 * The record state behind a page: values, what changed, what is visible and
 * required, errors, loading and saving. No DOM and no framework — every
 * binding renders from `getState()` and calls these methods.
 */
export function createForm(options: FormOptions): Form {
  // A page in an older format is read in the current one (upgradePage): the same object when it already is.
  const page = upgradePage(options.page);
  return innerForm(page === options.page ? options : { ...options, page }, []).form;
}

/** A form, and what the form round it — when it is a saved form placed in another — reaches it by. */
interface InnerForm {
  form: Form;
  /** Answers from the form round it: where it starts from again (`start`), a change (`edit`), or a draft restored (`fresh`). */
  take(values: Values, how: Sync): void;
  /** What a check would find now, shown nowhere. */
  errorsNow(): Record<string, string>;
  /** Show the problems the form round it found inside it. */
  show(errors: Record<string, string>): void;
  /** Its files, which the form round it saves with its answers. */
  files: PartFiles;
  /** Whether a box of it is still being typed in (`settling`'s `typing`). */
  typing(): boolean;
}

/**
 * A saved form's files, as the form it is placed in reaches them: those on
 * their way, what stops a save, and the bytes it still holds — its own and
 * those of the saved forms placed in it, each named as it names them.
 */
interface PartFiles {
  /** Whether any is still on its way. */
  going(): boolean;
  /** Resolves once none is. */
  settled(): Promise<void>;
  /** A file that failed, or that the store refused, under its field. */
  problems(): Record<string, string>;
  /** Store each file it holds as its bytes (a signature drawn), and wait for them: its answers are sent whole. */
  storeBytes(): Promise<void>;
  /** Its answers as a draft keeps them: no file's bytes. */
  draft(values: Readonly<Values>): Values;
  /** Stop every upload: the changes they were for are gone. */
  clear(): void;
  /** Whether a file the store holds landed in it since it last started: its answers then hold a file no save sent. */
  filed(): boolean;
}

/**
 * The record a form's files are stored for: its model and id and, for a
 * saved form placed in it, where that form's fields sit in it (`consent.`).
 */
interface Place {
  model(): string;
  recordId(): RecordId | null;
  under: string;
}

type Sync = 'start' | 'edit' | 'fresh';

/** A line's cell whose line is no longer there. */
const gone: unique symbol = Symbol('gone');

const isRecord = (value: unknown): value is Values => value !== null && typeof value === 'object' && !Array.isArray(value);
/** A saved form's answers, as the one value they are in the form round it. */
const asValue = (values: Readonly<Values>) => values as unknown as Value;

/** The form a saved form is placed in, as that one's ways out reach it: they are the record's. */
interface Outer {
  letGo(how?: LeaveHow, chain?: readonly string[]): true | Promise<boolean>;
  leaveNow(how: LeaveHow): boolean;
  close(chain?: readonly string[]): Stopped | null | Promise<Stopped | null>;
}

/**
 * `within` are the pages round this one, outermost first: a page among them
 * placed again would hold itself. `place`, for a saved form placed in a
 * record: the record its files are stored for. `outer`, the form round it:
 * its ways out go through that one's check.
 */
function innerForm(options: FormOptions, within: string[], place?: Place, outer?: Outer): InnerForm {
  const { page } = options;
  const scheduler = options.scheduler ?? hostScheduler;
  const messages = options.messages ?? MESSAGES.en;
  const index = indexLayout(page.layout);
  /** Each field node's answer rules, read once. */
  const nodeRules = new Map<string, CompiledRule[]>();
  for (const node of index.values()) {
    const rules = (node.source as { validate?: FieldNode['validate'] }).validate;
    if (node.kind === 'field' && rules) nodeRules.set(node.id, compileRules(rules));
  }
  /** Tables of lines with rules of their own, by their field node: each read once. */
  const tables = new Map<string, { field: string; compiled: CompiledTable }>();
  for (const node of index.values()) {
    const source = node.source as FieldNode;
    if (node.kind !== 'field' || page.fields[source.field]?.type !== 'one2many') continue;
    if (source.cells || source.rowTones || source.rowBold !== undefined || source.rowButtons || source.lineDelete !== undefined) tables.set(node.id, { field: source.field, compiled: compileTable(source) });
  }
  /** Field nodes whose value takes a tone or bold, by id: each read once. */
  const fieldTones = new Map<string, ReturnType<typeof compileFieldTone>>();
  for (const node of index.values()) {
    const source = node.source as FieldNode;
    if (node.kind === 'field' && (source.tones || source.bold !== undefined)) fieldTones.set(node.id, compileFieldTone(source));
  }
  /** The tables whose lines load in an order of their own fields, by the field: the first node to give one. */
  const lineOrders = new Map<string, NonNullable<FieldNode['order']>>();
  for (const node of index.values()) {
    const source = node.source as FieldNode;
    if (node.kind === 'field' && source.order?.length && page.fields[source.field]?.type === 'one2many' && !lineOrders.has(source.field)) lineOrders.set(source.field, source.order);
  }
  /** Lines as they load, in their tables' orders — only `loaded` fields, when given: the same values when nothing moved. */
  function ordered(values: Values, loaded?: readonly string[]): Values {
    let out = values;
    for (const [field, by] of lineOrders) {
      if (loaded && !loaded.includes(field)) continue;
      const lines = values[field] as Line[] | null | undefined;
      if (!Array.isArray(lines) || lines.length < 2) continue;
      const sorted = [...lines].sort((a, b) => compareLines(a.values, b.values, by));
      if (sorted.some((line, i) => line !== lines[i])) out = { ...out, [field]: sorted };
    }
    return out;
  }
  /** The words of each field's empty box chosen by conditions, by its node: read once. */
  const placeholders = new Map<string, { fixed?: string; when: { text: string; holds: CompiledModifier }[] }>();
  const placeholderOf = (id: string, own: { placeholder?: string; placeholderWhen?: FieldNode['placeholderWhen'] }) => {
    if (own.placeholderWhen?.length) placeholders.set(id, { fixed: own.placeholder, when: own.placeholderWhen.map((item) => ({ text: item.text, holds: compileModifier(item.when) })) });
  };
  for (const node of index.values()) if (node.kind === 'field' && 'type' in node.source) placeholderOf(node.id, node.source as FieldNode);
  if (page.layout.type === 'sheet' && page.layout.title) placeholderOf('#title', page.layout.title);
  /** Whether any rule only warns: without one, there are never warnings to look for. */
  const warns = [...nodeRules.values()].some((rules) => rules.some((compiled) => compiled.rule.level === 'warning'));
  const steps = page.layout.type === 'wizard' ? page.layout.children.map((step) => step.id) : [];
  const draftKey = () => `fieldia:draft:${page.id}:${state.recordId ?? 'new'}`;
  const today = () => localDay(options.now?.() ?? new Date());
  // The record's id and the person, as worked-out values read them: the id is the one asked for until the form has its state.
  let started = false;
  let editing = options.editing !== false;
  /** The record a line's form is of, as its conditions read it: worked out once. */
  const parentContext = options.parent ? recordContext(options.parent.values as Values, options.parent.fields, { recordId: options.parent.id ?? null, user: options.user, context: options.context }) : undefined;
  /** Whether the record is being edited now: not while a view locks it, nor when its source lets the person only read it. */
  const editingNow = () => editing && !(started && state.can?.edit === false);
  const about = () => ({ recordId: started ? state.recordId : (options.recordId ?? null), user: options.user, editing: editingNow(), context: options.context, parent: parentContext });
  const computed = compileComputed(page, today, about);
  const setWhen = compileSetWhen(page, today, about);
  /** The saved forms placed on the page, by the part's id: each one's answers sit under its name, as JSON. */
  const parts = new Map<string, FormNode>();
  for (const node of index.values()) if (node.kind === 'form') parts.set(node.id, node.source as FormNode);
  /** Those given their page, with the inner form that holds their answers. */
  const attached = new Map<string, { name: string; inner: InnerForm }>();
  /** How each box with text typed and not yet read reads it now (`settling`). */
  const readers = new Set<() => void | Promise<unknown>>();
  /** Whether each box that says so is still being typed in (`settling`'s `typing`): autosave waits for them. */
  const typings = new Set<() => boolean>();
  /** A box of this form, or of a saved form placed on it, still being typed in. */
  const typingNow = (): boolean => [...typings].some((typing) => typing()) || [...attached.values()].some((part) => part.inner.typing());
  /** Readings of typed text still waiting, as readTyped started them. */
  let readingNow = 0;
  /**
   * Every box's text read now, this form's and its saved forms' placed on the page, before it is checked or saved:
   * what a reading that waits (a name looked up) is waiting for, or null when none does. Such a box keeps its text
   * unread meanwhile, so a check made now refuses it; a save waits.
   */
  function readTyped(): Promise<void> | null {
    const waits: Promise<unknown>[] = [];
    for (const read of [...readers]) {
      const wait = read();
      if (wait && typeof (wait as Promise<unknown>).then === 'function') waits.push((wait as Promise<unknown>).catch(() => undefined));
    }
    for (const part of attached.values()) {
      const inner = part.inner.form;
      const wait = inner.settle();
      if (inner.reading()) waits.push(wait);
    }
    if (!waits.length) return null;
    // Waiting on its own readings, or a saved form's: `reading` says so until they end.
    readingNow++;
    return Promise.all(waits).then(() => void readingNow--);
  }
  /** The page's fields, and each saved form's answers as a JSON value: what is loaded, told as changed and saved. */
  const fields: Fields = { ...page.fields };
  for (const part of parts.values()) fields[part.name] = { type: 'json', label: part.title || part.name };
  /** True while answers are handed to an inner form: what it says back then is no change of its own. */
  let syncing = false;

  /** A new record's values: each field's default, then those worked out from `defaultFrom`, then what the form is given. */
  /** What the record starts with: each field's default, a new one's worked-out first values, and — as the form opens — what it was given. */
  function startingValues(isNew = options.recordId == null, given = true): Values {
    const values = initialValues(fields, today());
    if (isNew) {
      const about = { recordId: null, user: options.user, context: options.context, parent: parentContext };
      Object.assign(values, firstValues(page.fields, mapScope(values, page.fields, recordContext(values, page.fields, about), expressionEnv(values, page.fields, today))));
    }
    return given ? ordered({ ...values, ...structuredCopy(options.values ?? {}) }) : values;
  }

  /** The name this form knows a record by, from a link to the same model it holds. */
  function knownLabel(relation: string, id: RecordId): string | undefined {
    const values = (started ? state.values : {}) as Values;
    for (const [name, def] of Object.entries(page.fields)) {
      if ((def.type !== 'many2one' && def.type !== 'many2many') || def.relation !== relation) continue;
      const held = values[name];
      const found = ((Array.isArray(held) ? held : held ? [held] : []) as RelatedRecord[]).find((record) => record?.id === id);
      if (found) return found.label;
    }
    return undefined;
  }

  function mapScope(values: Values, scopeFields: Record<string, Field | LineField>, context: Record<string, unknown>, env: ExpressionEnv, parent?: MapScope['parent']): MapScope {
    return { values, fields: scopeFields, context, env, ...(parent ? { parent } : {}), ...(options.user ? { user: options.user } : {}), labelOf: knownLabel };
  }

  /** Where a value map on the record is read. */
  function recordScope(): MapScope {
    const { context, env } = reading();
    return mapScope(state.values as Values, page.fields, context, env);
  }

  /** Where a value map on one line is read: the line, with its record as `parent`. */
  function lineScope(field: string, values: Values): MapScope {
    const def = lineField(field);
    const lineFields = def.fields as Record<string, LineField>;
    return mapScope(values, lineFields, lineContext(values, lineFields, reading().context), { today }, { values: state.values as Values, fields: page.fields });
  }

  function tableOf(nodeId: string) {
    const table = tables.get(nodeId);
    if (table) return table;
    const node = index.get(nodeId);
    if (node?.kind !== 'field' || page.fields[node.field as string]?.type !== 'one2many') throw new Error(`"${nodeId}" is not a table of lines`);
    return null;
  }

  /** A line of a table as its rules have it now; none, plain. */
  function lineStateOf(nodeId: string, key: string): LineState {
    const table = tableOf(nodeId);
    if (!table) return { tone: null, bold: false, cells: {}, buttons: {}, deletable: true };
    const line = ((state.values[table.field] as Line[] | null) ?? []).find((l) => l.key === key);
    if (!line) throw new Error(`"${table.field}" has no line "${key}"`);
    const def = lineField(table.field);
    return table.compiled.line(lineContext(line.values, def.fields as Record<string, LineField>, reading().context, line.id ?? null), { today }, userRoles);
  }

  function createValuesOf(field: string, line?: { lines: string; key: string }): Values {
    if (!line) {
      const def = fieldDef(field);
      return def.type === 'many2one' || def.type === 'many2many' ? (def.createValues ? readLooseMap(def.createValues, recordScope()) : {}) : {};
    }
    const found = ((state.values[line.lines] as Line[] | null) ?? []).find((l) => l.key === line.key);
    const sub = lineField(line.lines).fields[field];
    if (!found || !sub || (sub.type !== 'many2one' && sub.type !== 'many2many') || !sub.createValues) return {};
    return readLooseMap(sub.createValues, lineScope(line.lines, found.values));
  }

  let baseline: Values = computed.apply(startingValues());
  /** The setWhen conditions holding for the values as they last settled: one starts to hold only against these. */
  let holding = setWhen.holding(baseline);
  let state: FormState = {
    status: options.recordId != null ? 'idle' : 'ready',
    recordId: options.recordId ?? null,
    values: structuredCopy(baseline),
    errors: {},
    dirty: [],
    warnings: {},
    warning: null,
    warningField: null,
    error: null,
    draft: null,
    step: steps[0] ?? null,
    skipped: [],
    saveProblem: null,
    choices: {},
    definitions: {},
    uploads: [],
    version: null,
    can: null,
    conflict: null,
    setAside: null,
    unsent: [],
    leaving: false,
    unread: {},
  };
  started = true;
  /**
   * Each record shown — opened, loaded again, a new one — is a generation of
   * its own: a save's answer, or a call's, started in another is not laid
   * over it. What follows is kept for the generation shown, and starts again
   * with the next.
   */
  let generation = 0;
  /** The fields whose last write was the person's: a step's, a rule's or the app's write takes one over. */
  const personal = new Set<string>();
  /** Fields where a file the person picked landed from the store: at risk until a save sends it, a first save or not. */
  const filed = new Set<string>();
  /** The record as the last finished save left it — what it sent and what came back; a page of answers: what it sent. Null before one. */
  let sentAs: Readonly<Values> | null = null;
  /** Counted at each reset (the person's Discard): a save on its way then lands as the record it stored. */
  let resets = 0;
  /** Above 0 while a delete the person chose goes on: a way out it takes lets their work go, unasked. */
  let deletes = 0;
  /** Each field's last comparison with what was sent, so a value that did not move is not compared again. */
  const compared = new Map<string, { value: unknown; sent: unknown; differs: boolean }>();

  /** Fields showing a file that did not reach the store: shown until it is sent again or taken away, whatever else changes. */
  const unstoredShown = new Set<string>();
  /** The record this form's files are for: its own, or — a saved form placed in one — that record, its fields under the part's name. */
  const where: Place = place ?? { model: () => (page.data.kind === 'record' ? page.data.model : page.id), recordId: () => state.recordId, under: '' };
  /** This form's own files on their way; the state's `uploads` adds those of each saved form placed in it. */
  let ownUploads: readonly FileUpload[] = [];
  /** The problem a save was stopped by for files that did not reach the store: it goes once none of them is one. */
  let filesProblem: SaveProblem | null = null;
  /** Above 0 while a save stores the bytes held in saved forms placed here: their links in place of bytes are no change of the person's. */
  let quietParts = 0;
  /** Files on their way to the store: uploads.ts. */
  const uploads = createUploads({
    source: () => options.dataSource,
    model: where.model,
    recordId: where.recordId,
    under: where.under,
    lineId: (field, key) => ((state.values[field] as Line[] | null) ?? []).find((line) => line.key === key)?.id,
    fileField(field, line) {
      const def = line ? (fields[line.field]?.type === 'one2many' ? (fields[line.field] as Extract<Field, { type: 'one2many' }>).fields[field] : undefined) : fields[field];
      return def?.type === 'binary' || def?.type === 'image' ? def : null;
    },
    read: (field, line) => (line ? ((state.values[line.field] as Line[] | null) ?? []).find((l) => l.key === line.key)?.values[field] : state.values[field]),
    write(field, line, value, quiet) {
      if (!quiet) {
        // A file the store holds now, picked by the person: at risk until a save sends it.
        filed.add(line ? line.field : field);
        return line ? form.updateLine(line.field, line.key, field, value) : form.setValue(field, value);
      }
      // A link in place of the bytes, as a save stores them: nothing else follows from it.
      const values = line ? { [line.field]: ((state.values[line.field] as Line[] | null) ?? []).map((l) => (l.key === line.key ? { ...l, values: { ...l.values, [field]: value } } : l)) } : { [field]: value };
      writeValues({ ...(state.values as Values), ...values });
    },
    changed(list) {
      ownUploads = list;
      filesChanged();
    },
    track,
  });

  /**
   * Files on their way changed, here or in a saved form placed here: the
   * state shows them all, and a file sent again, or taken away, takes its
   * problem with it — and the save it stopped is no longer said to be stopped
   * once none of its files is a problem.
   */
  function filesChanged() {
    const problems = fileProblems();
    const gone = [...unstoredShown].filter((key) => !(key in problems));
    for (const key of gone) unstoredShown.delete(key);
    const errors = gone.length ? Object.fromEntries(Object.entries(state.errors).filter(([key]) => !gone.includes(key))) : null;
    const stopped = filesProblem;
    const mended = stopped !== null && state.saveProblem === stopped && !Object.keys(stopped.fields ?? {}).some((key) => key in problems);
    if (mended) filesProblem = null;
    set({ uploads: allUploads(), ...(errors ? { errors } : {}), ...(mended ? { status: 'ready' as const, error: null, saveProblem: null } : {}) });
  }

  /** Every file on its way: this form's, then each saved form's placed in it, its id and field under the part's name. */
  function allUploads(): readonly FileUpload[] {
    if (!attached.size) return ownUploads;
    const all = [...ownUploads];
    for (const part of attached.values()) for (const upload of part.inner.form.getState().uploads) all.push(underPart(part.name, upload));
    return all;
  }

  /** What stops a save for files: this form's, and each saved form's placed in it under `name.field`. */
  function fileProblems(): Record<string, string> {
    const found = uploads.problems(messages);
    for (const part of attached.values()) for (const [key, message] of Object.entries(part.inner.files.problems())) found[`${part.name}.${key}`] = message;
    return found;
  }

  const filesGoing = (): boolean => uploads.going() || [...attached.values()].some((part) => part.inner.files.going());

  async function filesSettled(): Promise<void> {
    while (filesGoing()) await Promise.all([uploads.settled(), ...[...attached.values()].map((part) => part.inner.files.settled())]);
  }

  /** Store each file still held as its bytes in these fields — a saved form placed here holding one, among them — and wait for them all. */
  async function storeBytes(names: readonly string[]): Promise<void> {
    quietParts++;
    try {
      const inParts = [...attached.values()].filter((part) => names.includes(part.name)).map((part) => part.inner.files.storeBytes());
      await Promise.all([uploads.storeBytes(fileBytesIn(fields, state.values, names)), ...inParts]);
    } finally {
      quietParts--;
    }
  }

  /** Values as a draft keeps them where files are stored apart: no file's bytes, a saved form's answers included. */
  function draftOf(values: Readonly<Values>): Values {
    const kept = withoutFileBytes(fields, values);
    for (const part of attached.values()) if (isRecord(kept[part.name])) kept[part.name] = asValue(part.inner.files.draft(kept[part.name] as Values));
    return kept;
  }

  /** Stop every upload, here and in the saved forms placed here. */
  function clearFiles() {
    filesProblem = null;
    uploads.clear();
    for (const part of attached.values()) part.inner.files.clear();
  }

  /** The saved form placed here an upload's id names (`consent/upload-3`), with the id it knows it by; null for this form's own. */
  function partUpload(id: string): { form: Form; id: string } | null {
    const at = id.indexOf('/');
    const part = at < 0 ? undefined : [...attached.values()].find((p) => p.name === id.slice(0, at));
    return part ? { form: part.inner.form, id: id.slice(at + 1) } : null;
  }
  /** Field errors a refused save brought, each kept until its field changes from the value it was refused with. */
  let serverErrors: Record<string, { message: string; value: string }> = {};
  let lineKeys = 0;
  let onchangeSeq = 0;
  let draftTimer: unknown = null;
  let autosaveTimer: unknown = null;
  const pending = new Set<Promise<unknown>>();
  const listeners = new Set<(state: FormState) => void>();
  /** The app's listeners, by event. */
  const events = new Map<keyof FormEvents, Set<(event: never) => void>>();
  /** The moments the run going to a step or tab right now was set off by: the `show` that entry runs knows them, and does not set them off again. */
  let entering: readonly string[] = [];
  /** Whether wizard steps entered are told: from once the form has opened and run its `open` steps. */
  let showing = false;
  /** The wizard step last told as entered. */
  let told: string | null = null;
  let contextCache: { values: Values; recordId: RecordId | null; editing: boolean; context: Record<string, unknown>; env: ExpressionEnv } | null = null;
  const userRoles: readonly string[] = [...(options.user?.roles ?? [])];

  /** The latest load of each field's choices: an answer to an older one is let go. */
  const choiceLoads: Record<string, number> = {};

  function set(patch: Partial<FormState>) {
    const was = state.values;
    const shown = state.errors;
    state = { ...state, ...patch };
    // The person's changes the last save did not send, worked out again from the values as they are now.
    if (patch.unsent === undefined && patch.values !== undefined) {
      const unsent = unsentNow();
      if (!sameList(unsent, state.unsent)) state = { ...state, unsent };
    }
    // The problems found inside a saved form are shown on it, beside its own fields.
    if (state.errors !== shown) for (const part of attached.values()) part.inner.show(inside(state.errors, part.name));
    for (const listener of [...listeners]) listener(state);
    // Choices that change with a value that just changed are asked for again.
    if (state.values !== was) {
      for (const name in state.choices) if (fromList(name).dependsOn?.some((other) => was[other] !== state.values[other])) loadChoices(name);
      for (const name in state.definitions) if (fromRecord(name).dependsOn?.some((other) => was[other] !== state.values[other])) loadDefinitions(name);
    }
    if (showing && state.step !== told) tellStep(entering);
  }

  function emit<E extends keyof FormEvents>(event: E, payload: FormEvents[E]) {
    const heard = events.get(event);
    if (heard) for (const listener of [...heard]) (listener as (event: FormEvents[E]) => void)(payload);
  }

  /** A field written: told to the app, and — a person's change — the page's `change` steps for it run. */
  function changed(field: string, by: ChangeBy) {
    noteOrigin(field, by);
    emit('change', { field, value: state.values[field], values: state.values, by });
    const list = page.on?.change?.[field];
    if (by === 'person' && list) void track(moment(`on.change.${field}`, list, [], true));
  }

  /** Another record is shown: nothing of the last one's is the person's work any more. */
  function newGeneration() {
    generation++;
    personal.clear();
    filed.clear();
    compared.clear();
    sentAs = null;
  }

  /** Whether a field holds a file the store holds that no save sent: its own, or one in a saved form placed here under its name. */
  const filedIn = (name: string) => filed.has(name) || [...attached.values()].some((part) => part.name === name && part.inner.files.filed());

  /**
   * The person's work no save took, by field, in the page's order: each of
   * their changes that differs from the record as the last save left it —
   * before a first save, only a file the store holds.
   */
  function unsentNow(): string[] {
    if (!personal.size) return [];
    const out: string[] = [];
    for (const name of Object.keys(fields)) {
      if (!personal.has(name)) continue;
      const from = sentAs ?? (filedIn(name) ? baseline : null);
      if (from && differs(name, state.values[name], from[name])) out.push(name);
    }
    return out;
  }

  function differs(name: string, value: unknown, sent: unknown): boolean {
    const known = compared.get(name);
    if (known && known.value === value && known.sent === sent) return known.differs;
    const verdict = value !== sent && !sameValue(fields[name], value, sent);
    compared.set(name, { value, sent, differs: verdict });
    return verdict;
  }

  /** `unsent` as it is now, told when it changed. */
  function refreshUnsent() {
    const unsent = unsentNow();
    if (!sameList(unsent, state.unsent)) set({ unsent });
  }

  /** A field written, and by whom: the person's change is theirs until a step, a rule or the app writes the field in its place. */
  function noteOrigin(field: string, by: ChangeBy) {
    if (by === 'person') personal.add(field);
    else personal.delete(field);
    refreshUnsent();
  }

  /** A wizard step entered: told to the app, and its `show` steps run. */
  function tellStep(chain: readonly string[]) {
    const step = state.step;
    if (step === told || step === null) return;
    told = step;
    emit('step', { step });
    const list = page.on?.show?.[step];
    if (list) void track(moment(`on.show.${step}`, list, chain, true));
  }

  /** Do something while `chain` is the run's that does it, so a step or tab it enters knows. */
  function inRun(chain: readonly string[], act: () => void) {
    const was = entering;
    entering = chain;
    try {
      act();
    } finally {
      entering = was;
    }
  }

  const fromList = (name: string) => (page.fields[name] as Extract<Field, { type: 'selection' }>).optionsFrom as OptionsFrom;

  function loadChoices(name: string) {
    const { list } = fromList(name);
    const load = (choiceLoads[name] = (choiceLoads[name] ?? 0) + 1);
    const put = (choices: Choices) => load === choiceLoads[name] && set({ choices: { ...state.choices, [name]: choices } });
    // What was shown stays while the next ones load, so the list does not flash empty.
    const shown = state.choices[name]?.options ?? null;
    put({ options: shown, loading: true });
    const source = options.dataSource;
    void track(
      (source?.options ? source.options({ list, values: structuredCopy(state.values as Values) }) : Promise.reject(new Error(`No list "${list}"`))).then(
        (loaded) => put({ options: loaded }),
        (error) => put({ options: shown, error: (error as Error).message ?? String(error) })
      )
    );
  }

  const fromRecord = (name: string) => (page.fields[name] as Extract<Field, { type: 'properties' }>).definitionsFrom as DefinitionsFrom;
  const definitionLoads: Record<string, number> = {};

  function loadDefinitions(name: string) {
    const { list } = fromRecord(name);
    const load = (definitionLoads[name] = (definitionLoads[name] ?? 0) + 1);
    const put = (definitions: Definitions) => load === definitionLoads[name] && set({ definitions: { ...state.definitions, [name]: definitions } });
    // What was shown stays while the next ones load.
    const shown = state.definitions[name]?.definitions ?? null;
    put({ definitions: shown, loading: true });
    const source = options.dataSource;
    void track(
      (source?.definitions ? source.definitions({ list, values: structuredCopy(state.values as Values) }) : Promise.reject(new Error(`No definitions "${list}"`))).then(
        (loaded) => put({ definitions: loaded }),
        (error) => put({ definitions: shown, error: (error as Error).message ?? String(error) })
      )
    );
  }

  async function addDefinition(name: string, definition: PropertyDefinition) {
    const { list } = fromRecord(name);
    const definitions = [...(state.definitions[name]?.definitions ?? []), definition];
    set({ definitions: { ...state.definitions, [name]: { definitions } } });
    await track(options.dataSource?.saveDefinitions?.({ list, values: structuredCopy(state.values as Values), definitions }) ?? Promise.resolve());
  }

  /** A field as its value is checked: a list's choices are those loaded, and until they are, any choice may be one. */
  function checked(name: string): Field {
    const def = page.fields[name];
    const loaded = state.choices[name]?.options;
    if (def.type === 'properties' && def.definitionsFrom) {
      // The definitions the linked record keeps, once loaded: each property checked as one of its kind.
      const definitions = state.definitions[name]?.definitions;
      return definitions ? { ...def, definitions } : def;
    }
    return def.type === 'selection' && def.optionsFrom && loaded ? { ...def, options: loaded, optionsFrom: undefined } : def;
  }

  /** A properties field's problems, each at its property's path (`field.property`), as its row shows them. */
  function propertyProblems(name: string): Record<string, string> {
    const def = checked(name);
    if (def.type !== 'properties') return {};
    return Object.fromEntries(Object.entries(checkProperties(def.definitions, state.values[name], messages, today())).map(([property, message]) => [`${name}.${property}`, message]));
  }

  /** A field's own problem, less what its properties' rows say of themselves. */
  function besidesRows(name: string, message: string | undefined): string | undefined {
    return message !== undefined && page.fields[name]?.type === 'properties' && Object.values(propertyProblems(name)).includes(message) ? undefined : message;
  }

  function track<T>(promise: Promise<T>): Promise<T> {
    pending.add(promise);
    const done = () => pending.delete(promise);
    promise.then(done, done);
    return promise;
  }

  /** The values as expressions read them, and what else they read: the record's id, the person, the lines' rows, today. */
  function reading(): { context: Record<string, unknown>; env: ExpressionEnv } {
    if (contextCache?.values !== state.values || contextCache.recordId !== state.recordId || contextCache.editing !== editingNow()) {
      const values = state.values as Values;
      const context = recordContext(values, page.fields, about());
      contextCache = { values, recordId: state.recordId, editing: editingNow(), context, env: expressionEnv(values, page.fields, today) };
    }
    return contextCache;
  }

  const context = () => reading().context;

  function fieldDef(name: string): Field {
    const def = fields[name];
    if (!def) throw new Error(`The page has no field "${name}"`);
    return def;
  }

  function dirtyFields(values: Values): string[] {
    return Object.keys(fields).filter((name) => JSON.stringify(values[name] ?? null) !== JSON.stringify(baseline[name] ?? null));
  }

  function nodeState(id: string): NodeState {
    const node = index.get(id);
    if (!node) throw new Error(`The page has no element "${id}"`);
    const { context: ctx, env } = reading();
    const hidden = (at: IndexedNode | undefined) => (at ? !rolesAllow(at.roles, userRoles) || at.invisible.evaluate(ctx, env) : false);
    let invisible = hidden(node);
    for (let parent = node.parent; !invisible && parent; parent = index.get(parent)?.parent ?? null) {
      invisible = hidden(index.get(parent));
    }
    // A section read-only right now makes everything inside it read-only too.
    let readonly = node.readonly.evaluate(ctx, env);
    for (let parent = node.parent; !readonly && parent; parent = index.get(parent)?.parent ?? null) {
      readonly = index.get(parent)?.readonly.evaluate(ctx, env) ?? false;
    }
    const def = node.field ? page.fields[node.field] : undefined;
    // What the record's source lets this person do: a field hidden from them or locked, a button that would do what they may not.
    const can = state.can;
    if (can) {
      if ((node.field !== undefined && can.hiddenFields?.includes(node.field)) || node.does?.some((right) => can[right] === false)) invisible = true;
      if ((node.kind === 'field' || node.kind === 'form') && (can.edit === false || (node.field !== undefined && can.readonlyFields?.includes(node.field) === true))) readonly = true;
    }
    return {
      invisible,
      readonly: readonly || (def !== undefined && lockedField(def)),
      required: node.required.evaluate(ctx, env) || def?.required === true,
      ...(node.pressed ? { pressed: node.pressed.evaluate(ctx, env) } : {}),
    };
  }

  /** Field nodes — or saved forms placed on the page — inside `root` (or the whole page), visible right now; `field`'s alone, when named. */
  function visibleFieldNodes(root?: string, kind: IndexedNode['kind'] = 'field', field?: string): IndexedNode[] {
    const inside = (node: IndexedNode) => {
      if (!root) return true;
      for (let at: string | null = node.id; at; at = index.get(at)?.parent ?? null) if (at === root) return true;
      return false;
    };
    // The whole page leaves out the steps passed over with Skip.
    const skipped = (node: IndexedNode) => {
      if (root || !state.skipped.length) return false;
      for (let at: string | null = node.id; at; at = index.get(at)?.parent ?? null) if (state.skipped.includes(at)) return true;
      return false;
    };
    return [...index.values()].filter((node) => node.kind === kind && (field === undefined || node.field === field) && inside(node) && !skipped(node) && !nodeState(node.id).invisible);
  }

  /** What a field node's answer rules say of its value now: the first error and the first warning. */
  function ruleCheck(node: IndexedNode): { error?: string; warning?: string } {
    const rules = nodeRules.get(node.id);
    if (!rules) return {};
    const name = node.field as string;
    const def = page.fields[name];
    const label = (node.source as FieldNode).label ?? def.label;
    const { context: ctx, env } = reading();
    return checkRules(def, label, state.values[name], rules, { context: ctx, env, now: options.now?.() ?? new Date(), messages });
  }

  /** A tick box required and not ticked, as an "I agree" box: "no" answers a yes or no, never a box to tick. */
  function unticked(node: IndexedNode): string | undefined {
    const name = node.field as string;
    const ticks = (node.source as FieldNode).widget === 'tick' && page.fields[name].type === 'boolean';
    return ticks && state.values[name] !== true && nodeState(node.id).required ? messages.tick : undefined;
  }

  /** A field node's error now: its field's own rules first, then its answer rules. */
  function nodeError(node: IndexedNode): string | undefined {
    const name = node.field as string;
    return unticked(node) ?? checkInput(page.fields[name], node.source as FieldNode, state.values[name], messages) ?? checkValue(checked(name), state.values[name], nodeState(node.id).required, messages, today()) ?? ruleCheck(node).error;
  }

  /** Warnings for the visible fields of the page, without publishing them. */
  function collectWarnings(): Record<string, string> {
    const warnings: Record<string, string> = {};
    if (!warns) return warnings;
    for (const node of visibleFieldNodes()) {
      const warning = nodeRules.has(node.id) ? ruleCheck(node).warning : undefined;
      if (warning) warnings[node.field as string] ??= warning;
    }
    return warnings;
  }

  /** What would be found for these values, without publishing them or touching the form. */
  function withValues<T>(values: Values, find: () => T): T {
    const previous = state;
    state = { ...state, values };
    try {
      return find();
    } finally {
      state = previous;
    }
  }

  /** A range's last day (`options.endField` of a `daterange`), the field it writes besides its own; null for any other node. */
  function rangeEnd(node: IndexedNode): string | null {
    const source = node.source as FieldNode;
    const end = source.widget === 'daterange' ? source.options?.['endField'] : undefined;
    return typeof end === 'string' && page.fields[end] && end !== node.field ? end : null;
  }

  /**
   * A range's end, a field of its own though no node shows it alone: its required, min, max and days, and that it
   * is not before its start ("Ends can’t be before Starts"). Required when its field is, or the range is.
   */
  function rangeEndError(node: IndexedNode, end: string, required = nodeState(node.id).required): string | undefined {
    const def = page.fields[end];
    const value = state.values[end];
    const own = checkValue(checked(end), value, required || def.required === true, messages, today());
    if (own) return own;
    const start = state.values[node.field as string];
    if (typeof start !== 'string' || typeof value !== 'string' || !start || !value) return undefined;
    const at = (v: string) => (def.type === 'datetime' ? Date.parse(v) : Date.parse(v.slice(0, 10)));
    if (at(value) < at(start)) return fill(messages.endBeforeStart, { end: def.label, start: page.fields[node.field as string].label });
    return undefined;
  }

  /** Errors for the visible fields under `root`, without publishing them. */
  function collectErrors(root?: string): Record<string, string> {
    const errors: Record<string, string> = {};
    const seen = new Set<string>();
    for (const node of visibleFieldNodes(root)) {
      const name = node.field as string;
      seen.add(name);
      const end = rangeEnd(node);
      if (end) {
        seen.add(end);
        const problem = errors[end] ? undefined : rangeEndError(node, end);
        if (problem) errors[end] = problem;
      }
      if (errors[name]) continue;
      const def = page.fields[name];
      const message = nodeError(node);
      // A property says its own problem on its row; the field, only what is its own (that it is required).
      if (def.type === 'properties') Object.assign(errors, propertyProblems(name));
      if (besidesRows(name, message)) errors[name] = message as string;
      if (def.type === 'one2many') {
        for (const line of (state.values[name] as Line[] | null) ?? []) {
          // A section or note answers only for its text, never for what an item needs.
          const kind = lineKind(def, line.values);
          // The table's own rules: a cell its line hides asks nothing, one it requires asks for a value.
          const ruled = tables.has(node.id) ? lineStateOf(node.id, line.key).cells : {};
          for (const [sub, subDef] of Object.entries(def.fields)) {
            if (kind && sub !== def.lineKinds?.text) continue;
            const cell = ruled[sub];
            if (cell?.invisible || (tables.has(node.id) && tables.get(node.id)!.compiled.hidden(sub, reading().context, reading().env, userRoles))) continue;
            const lineMessage = checkValue(subDef, line.values[sub], subDef.required === true || cell?.required === true, messages, today());
            if (lineMessage) errors[`${name}.${line.key}.${sub}`] = lineMessage;
          }
        }
      }
    }
    // Text left in a box that does not read answers for its field, in the words it was left with.
    for (const [path, unread] of Object.entries(state.unread)) if (seen.has(path.split('.')[0])) errors[path] = unread.message;
    // A saved form placed here answers for its fields by its own page's rules.
    for (const node of visibleFieldNodes(root, 'form')) {
      const part = attached.get(node.id);
      if (part) for (const [key, message] of Object.entries(part.inner.errorsNow())) errors[`${part.name}.${key}`] = message;
    }
    return errors;
  }

  /** The value at a path: a field's, or a line's cell (`field.lineKey.subfield`); `gone` when the line is not there. */
  function valueAt(values: Readonly<Values>, path: string): Value | undefined | typeof gone {
    const parts = path.split('.');
    // A property of a properties field (`field.property`).
    if (parts.length === 2 && page.fields[parts[0]]?.type === 'properties') {
      const held = values[parts[0]];
      return held && typeof held === 'object' && !Array.isArray(held) ? (held as Record<string, Value>)[parts[1]] : undefined;
    }
    if (parts.length < 3) return values[path];
    const [field, sub] = [parts[0], parts[parts.length - 1]];
    const key = parts.slice(1, -1).join('.');
    const line = ((values[field] as Line[] | null) ?? []).find((l) => l.key === key);
    return line ? line.values[sub] : gone;
  }

  /** Unread text whose field has since been written another way — a value typed that reads, the app's — is let go. */
  function unreadKept(values: Readonly<Values>): Readonly<Record<string, UnreadText>> {
    let kept: Record<string, UnreadText> | null = null;
    for (const path of Object.keys(state.unread)) {
      const now = valueAt(values, path);
      if (now !== gone && now === valueAt(state.values, path)) continue;
      kept ??= { ...state.unread };
      delete kept[path];
    }
    return kept ?? state.unread;
  }

  /** A field's own problem as its box is left, never that it is required: undefined when it has none, or is not shown. */
  function leftProblem(path: string): string | undefined {
    const parts = path.split('.');
    const field = parts[0];
    const shown = visibleFieldNodes(undefined, 'field', field);
    // A range's end is left from its own box in the range: its problems, that it is before its start too.
    const range = shown.length ? undefined : visibleFieldNodes().find((node) => rangeEnd(node) === field);
    if (!shown.length && !range) return undefined;
    if (state.unread[path]) return state.unread[path].message;
    if (range) return isEmpty(fieldDef(field), state.values[field]) ? undefined : rangeEndError(range, field, false);
    if (parts.length === 1) {
      const value = state.values[field];
      if (isEmpty(fieldDef(field), value)) return undefined;
      return (
        shown.map((node) => checkInput(page.fields[field], node.source as FieldNode, value, messages)).find(Boolean) ??
        besidesRows(field, checkValue(checked(field), value, false, messages, today())) ??
        shown.map((node) => ruleCheck(node).error).find(Boolean)
      );
    }
    if (parts.length === 2 && page.fields[field]?.type === 'properties') return propertyProblems(field)[path];
    const def = lineField(field);
    const sub = def.fields[parts[parts.length - 1]] as LineField | undefined;
    const value = valueAt(state.values, path);
    if (!sub || value === gone || isEmpty(sub, value)) return undefined;
    return checkValue(sub, value, false, messages, today());
  }

  /**
   * Answers changed from outside a saved form — loaded, put back, set — handed
   * to it, and what it holds after taken back: its defaults and worked-out
   * values filled in. A new starting point (`start`) is handed to each.
   */
  function syncParts(values: Values, how: Sync): Values {
    let out = values;
    for (const part of attached.values()) {
      if (how !== 'start' && out[part.name] === part.inner.form.getState().values) continue;
      syncing = true;
      try {
        part.inner.take(isRecord(out[part.name]) ? (out[part.name] as Values) : {}, how);
      } finally {
        syncing = false;
      }
      out = { ...out, [part.name]: asValue(part.inner.form.getState().values) };
    }
    return out;
  }

  /**
   * Values as they settle after a change: worked out, then set where a
   * condition started to hold, then worked out again from what was set — a
   * few rounds at most, so rules that set each other cannot run forever.
   */
  function settle(written: Values): Values {
    let values = computed.apply(written);
    for (let round = 0; round < 8; round++) {
      const result = setWhen.apply(values, holding);
      holding = result.holding;
      if (result.values === values) break;
      values = computed.apply(result.values);
    }
    return values;
  }

  /** Values to start again from, as loaded or restored: conditions holding in them hold already, and set nothing. */
  function startFrom(values: Values): Values {
    const worked = computed.apply(values);
    holding = setWhen.holding(worked);
    return worked;
  }

  /** Write values someone or something changed. `fresh` values are a starting point instead (a restored draft). */
  function writeValues(written: Values, extra: Partial<FormState> = {}, fresh = false) {
    const values = syncParts(fresh ? startFrom(written) : settle(written), fresh ? 'fresh' : 'edit');
    // Text left unread in a box goes once its field is written another way, and its words with it.
    const unread = unreadKept(values);
    const before = state;
    state = { ...state, unread };
    let errors = Object.keys(before.errors).length ? revalidateShown(values) : before.errors;
    state = before;
    // Words where a number goes — from a server or an old draft: a box never sets them — are said at once; what is
    // missing waits for sending.
    const words: Record<string, string> = {};
    for (const name of Object.keys(written)) {
      const def = page.fields[name];
      if (written[name] === state.values[name] || !def) continue;
      if (notANumber(def, written[name])) words[name] = checkValue(def, written[name], false, messages) as string;
      if (def.type !== 'one2many') continue;
      for (const line of (written[name] as Line[] | null) ?? []) {
        for (const [sub, v] of Object.entries(line.values)) if (notANumber(def.fields[sub] as Field | undefined, v)) words[`${name}.${line.key}.${sub}`] = checkValue(def.fields[sub], v, false, messages) as string;
      }
    }
    if (Object.keys(words).length) errors = { ...errors, ...words };
    set({ values, dirty: dirtyFields(values), errors, warnings: withValues(values, collectWarnings), unread, ...extra });
  }

  /** Once errors are on screen, keep them current as the person fixes things. */
  function revalidateShown(values: Values): Record<string, string> {
    const fresh = withValues(values, () => collectErrors(state.step ?? undefined));
    const kept: Record<string, string> = {};
    for (const key of Object.keys(state.errors)) if (fresh[key]) kept[key] = fresh[key];
    for (const [name, refused] of Object.entries(serverErrors)) {
      if (JSON.stringify(values[name] ?? null) === refused.value) kept[name] ??= refused.message;
      else delete serverErrors[name];
    }
    // A file that did not reach the store stays said under its field.
    const unstoredNow = fileProblems();
    for (const key of unstoredShown) if (unstoredNow[key]) kept[key] ??= unstoredNow[key];
    return kept;
  }

  function scheduleDraft() {
    const drafts = options.drafts;
    if (!drafts) return;
    if (draftTimer !== null) scheduler.clearTimeout(draftTimer);
    draftTimer = scheduler.setTimeout(() => {
      draftTimer = null;
      // Where files are stored apart, never a file's bytes: they would fill the browser's store (uploads.ts). Without, kept as always.
      // A store that is full anyway keeps no draft.
      const values = options.dataSource?.upload ? draftOf(state.values) : state.values;
      try {
        drafts.store.setItem(draftKey(), JSON.stringify({ savedAt: new Date().toISOString(), values }));
      } catch {
        // The draft is a convenience: the form goes on without it.
      }
    }, drafts.delayMs ?? 400);
  }

  /** The values with a draft's over them: a field it left out — a file's bytes — as the record holds it, in a saved form placed here too. */
  function withDraft(kept: Values): Values {
    const values: Values = { ...(state.values as Values), ...kept };
    for (const part of attached.values()) {
      const now = state.values[part.name];
      if (isRecord(now) && isRecord(kept[part.name])) values[part.name] = asValue({ ...now, ...(kept[part.name] as Values) });
    }
    return values;
  }

  function forgetDraft() {
    if (draftTimer !== null) scheduler.clearTimeout(draftTimer);
    draftTimer = null;
    options.drafts?.store.removeItem(draftKey());
  }

  function offerDraft() {
    const drafts = options.drafts;
    if (!drafts) return;
    const raw = drafts.store.getItem(draftKey());
    if (!raw) return;
    let draft: { savedAt: string; values: Values };
    try {
      draft = JSON.parse(raw);
    } catch {
      drafts.store.removeItem(draftKey());
      return;
    }
    if (drafts.restore === 'auto') writeValues(withDraft(draft.values), { draft: null }, true);
    else set({ draft: { savedAt: draft.savedAt } });
  }

  function scheduleAutosave() {
    const autosave = options.autosave;
    // A record the person may not change is never saved unasked: it would only be refused.
    if (!autosave || page.data.kind !== 'record' || state.can?.edit === false) return;
    if (autosaveTimer !== null) scheduler.clearTimeout(autosaveTimer);
    autosaveTimer = scheduler.setTimeout(() => {
      autosaveTimer = null;
      // Nobody pressed anything: a box still typed in is never read under the person's keys. The save waits until it is
      // left (or Enter is pressed in it), and reads it then, as any save does.
      if (typingNow()) return scheduleAutosave();
      if (state.dirty.length && Object.keys(collectErrors()).length === 0) void track(save());
    }, autosave.delayMs);
  }

  function runOnchange(changed: string) {
    const source = options.dataSource;
    if (!source?.onchange || page.data.kind !== 'record') return;
    // Words in a number box are not a value to work anything out from: the server is asked once they read as one.
    if (unreadIn(page.fields[changed], state.values[changed])) return;
    const seq = ++onchangeSeq;
    const request = { model: page.data.model, id: state.recordId, changed, values: structuredCopy(state.values as Values) };
    void track(
      source.onchange(request).then(
        (result) => {
          if (seq !== onchangeSeq) return;
          const values = { ...(state.values as Values), ...(result.values ?? {}) };
          writeValues(values, { warning: result.warning ?? null, warningField: result.warning ? changed : null });
        },
        () => undefined
      )
    );
  }

  function afterEdit(changed: string) {
    scheduleDraft();
    scheduleAutosave();
    runOnchange(changed);
  }

  function changes(): RecordChanges {
    const result: RecordChanges = { values: {}, lines: {}, links: {} };
    // A new record sends every value it holds, those it started with and defaults
    // included; a stored one sends only what changed since it was loaded.
    const creating = state.recordId === null || state.recordId === undefined;
    const names = creating
      ? Object.keys(fields).filter((name) => state.dirty.includes(name) || !isEmpty(fields[name], state.values[name]))
      : state.dirty;
    for (const name of names) {
      const def = fields[name];
      const now = state.values[name];
      const before = creating ? emptyValue(def) : baseline[name];
      if (def.type === 'one2many') result.lines[name] = lineOps((before as Line[] | null) ?? [], (now as Line[] | null) ?? []);
      else if (def.type === 'many2many') result.links[name] = linkOps((before as RelatedRecord[] | null) ?? [], (now as RelatedRecord[] | null) ?? []);
      else result.values[name] = structuredCopy(now) as Value;
    }
    return result;
  }

  /** The values to submit: only fields a visible question shows. */
  function shownValues(): Values {
    const shown: Values = {};
    for (const node of visibleFieldNodes()) {
      const name = node.field as string;
      shown[name] = structuredCopy(state.values[name]) as Value;
    }
    // And each saved form shown, by its page: one not found shows nothing to answer.
    for (const node of visibleFieldNodes(undefined, 'form')) {
      const part = attached.get(node.id);
      if (part) shown[part.name] = structuredCopy(state.values[part.name]) as Value;
    }
    return shown;
  }

  async function save(chain: readonly string[] = []): Promise<boolean> {
    return (await saving(chain)) === null;
  }

  /** Every value, for a source that saves whole records: those of fields hidden from the person, which they never had, left out. */
  function sentValues(): Values {
    const values = structuredCopy(state.values as Values);
    for (const name of state.can?.hiddenFields ?? []) delete values[name];
    return values;
  }

  /** A conflict as the form tells it: what they changed since the record was opened, and what both changed. */
  function conflictOf(conflict: SaveConflict): FormConflict {
    const theirs = conflict.theirs;
    const changed = theirs ? Object.keys(fields).filter((name) => name in theirs && !sameValue(fields[name], theirs[name], baseline[name])) : [];
    const both = changed.filter((name) => state.dirty.includes(name) && !sameValue(fields[name], (theirs as Values)[name], state.values[name]));
    return { version: conflict.version, ...(theirs ? { theirs } : {}), changed, both };
  }

  /**
   * Save, or send: null once done, or why not. The page's `beforeSave` steps
   * run first — before its own check, so they may fill in what it asks for —
   * and a stop keeps it unsaved; `afterSave` runs once it is saved.
   */
  /** The save running now: the next one waits for it. */
  let saveRunning: Promise<unknown> | null = null;

  /**
   * One save at a time: a second — Ctrl+Enter pressed twice, or while the
   * first waits for files — waits for the first, then saves what is left to
   * save with the version the first got back, never as someone else's. A save
   * the page's own beforeSave steps ask for runs inside the one that set them off.
   */
  function saving(chain: readonly string[]): Promise<Stopped | null> {
    if (chain.includes('on.beforeSave')) return savingNow(chain);
    const before = saveRunning;
    const mine = (async () => {
      if (before) await before;
      return savingNow(chain);
    })();
    const done = mine.then(
      () => undefined,
      () => undefined
    );
    saveRunning = done;
    void done.then(() => {
      if (saveRunning === done) saveRunning = null;
    });
    return mine;
  }

  async function savingNow(chain: readonly string[]): Promise<Stopped | null> {
    // A record its source does not let this person change is refused here, in its words or the form's: no source is asked.
    if (page.data.kind === 'record' && state.can?.edit === false) {
      const problem: SaveProblem = { kind: 'rule', message: state.can.reason ?? messages.mayNotEdit };
      set({ status: 'error', error: problem.message, saveProblem: problem, conflict: null });
      return { reason: 'save', message: problem.message };
    }
    // What is still typed in a box is read first: it is what is saved, or why nothing is. A name still being looked
    // up is waited for, so the record it names is what is saved — or, named by none, why nothing is.
    const waiting = readTyped();
    if (waiting) await waiting;
    // Files still on their way are waited for first — a saved form's placed here too: the state says how many, so the page can say why it waits.
    if (filesGoing()) {
      set({ status: 'saving', error: null, saveProblem: null });
      await filesSettled();
      set({ status: 'ready' });
    }
    if (page.on?.beforeSave) {
      const before = await moment('on.beforeSave', page.on.beforeSave, chain, false);
      if (!before.done) {
        // A check's problems, or an inner save's, are shown already; any other stop is this save's problem.
        if (before.reason !== 'check' && before.reason !== 'save') {
          const problem: SaveProblem = { kind: 'stopped', reason: before.reason, message: before.message ?? '' };
          set({ status: 'error', error: problem.message || null, saveProblem: problem, conflict: null });
        }
        return { reason: 'save', ...(before.message !== undefined ? { message: before.message } : {}) };
      }
    }
    // A file that did not reach the store stops it, under its field, with the form's own checks.
    const errors = { ...collectErrors(), ...fileProblems() };
    if (Object.keys(errors).length) {
      set({ errors, ...unstored(errors) });
      return { reason: 'save', message: Object.values(errors)[0] };
    }
    const source = options.dataSource;
    serverErrors = {};
    set({ status: 'saving', errors: {}, error: null, saveProblem: null, conflict: null });
    /** The generation the record was in when this save went to the source. */
    let at = generation;
    try {
      // Bytes still in the record — a signature drawn, a value the app set, in a saved form placed here too — go to the store first, where it keeps files.
      await storeBytes(page.data.kind === 'responses' || state.recordId == null ? Object.keys(fields) : state.dirty);
      const failed = fileProblems();
      if (Object.keys(failed).length) {
        set({ errors: failed, ...unstored(failed) });
        return { reason: 'save', message: Object.values(failed)[0] };
      }
      if (page.data.kind === 'responses') {
        if (!source?.submit) throw new Error('This page has no data source to send its answers to');
        const sent = shownValues();
        const before = state.values as Values;
        at = generation;
        await source.submit({ pageId: page.id, values: sent });
        // Answered for answers no longer shown — the form was started again meanwhile: the source has them, the form lays nothing.
        if (at !== generation) return null;
        forgetDraft();
        // What it sent is what an answer changed since is told against: still to send.
        sentAs = before;
        set({ status: 'saved', unsent: unsentNow() });
        emit('send', { values: sent });
        void track(moment('on.afterSave', page.on?.afterSave, chain, false));
        return null;
      }
      if (!source?.save) throw new Error('This page has no data source to save to');
      // What is sent: a change made while it is on its way is not in it, and stays a change to save.
      const sent = state.values as Values;
      at = generation;
      const resetAt = resets;
      const result = await source.save({
        model: page.data.model,
        id: state.recordId,
        fields,
        changes: changes(),
        values: sentValues(),
        // The version it was opened at, for a source that refuses a save over someone else's.
        ...(state.recordId != null && state.version ? { version: state.version } : {}),
      });
      // Answered for a record no longer shown — another opened, or this one loaded again: the source has it, and the
      // form lays nothing of it over the record it shows now.
      if (at !== generation) return null;
      forgetDraft();
      // Reset by the person meanwhile: the record as it stored it, the reset values never laid over it.
      const { values, dirty } = afterSave(sent, result.values, resets !== resetAt);
      // The record as this save left it: what the person changes from here is told against it.
      sentAs = baseline;
      // Its version now, for the next save to carry; and what the person may do now, when the save changed that.
      // The person's changes it did not send are at risk (`unsent`): every way out asks before it leaves them.
      set({ status: 'saved', recordId: result.id, values, dirty, warnings: withValues(values, collectWarnings), version: result.version ?? null, ...(result.can ? { can: result.can } : {}) });
      // Changed while it saved: kept in a draft, and saved as any change is.
      if (dirty.length) {
        scheduleDraft();
        scheduleAutosave();
      }
      emit('save', { recordId: state.recordId, values: state.values });
      void track(moment('on.afterSave', page.on?.afterSave, chain, false));
      return null;
    } catch (error) {
      const problem = saveProblemOf(error);
      // Refused for a record no longer shown: nothing of it is laid over the one shown now.
      if (at !== generation) return { reason: 'save', message: problem.message };
      // Refused: what the person changed meanwhile is a change not saved, as the rest.
      const fields = problem.kind === 'fields' ? problem.fields ?? {} : {};
      serverErrors = Object.fromEntries(Object.entries(fields).map(([name, message]) => [name, { message, value: JSON.stringify(state.values[name] ?? null) }]));
      set({ status: 'error', error: problem.message, saveProblem: problem, errors: { ...fields }, ...(problem.conflict ? { conflict: conflictOf(problem.conflict) } : {}) });
      return { reason: 'save', message: problem.message };
    }
  }

  /**
   * The record as a save left it — what was sent, with what the save brought
   * back, lines loaded again in their tables' orders, as Flectra's reload after
   * a save — as the new starting point. What the person changed while it was
   * on its way (a file stored meanwhile) was not sent: it is laid over that,
   * still a change to save, never taken as saved.
   */
  function afterSave(sent: Values, back: Values | undefined, whole = false): { values: Values; dirty: string[] } {
    const stored = (from: Values) => (back ? ordered({ ...from, ...back }, Object.keys(back)) : from);
    const since = whole ? [] : Object.keys(fields).filter((name) => state.values[name] !== sent[name] && !sameValue(fields[name], state.values[name], sent[name]));
    if (!since.length) {
      const values = syncParts(startFrom(stored(whole ? sent : (state.values as Values))), 'start');
      baseline = structuredCopy(values);
      return { values, dirty: [] };
    }
    const record = stored(sent);
    const mine: Values = { ...record };
    for (const name of since) mine[name] = keepIds(fields[name], state.values[name], record[name]);
    const values = syncParts(startFrom(mine), 'start');
    // The starting point is the record as stored: those fields as it holds them.
    const base: Values = { ...values };
    for (const name of since) base[name] = record[name];
    baseline = structuredCopy(computed.apply(base));
    return { values, dirty: dirtyFields(values) };
  }

  /** A save stopped by files that did not reach the store: shown under their fields, as a refused save's fields are. */
  function unstored(errors: Record<string, string>): Partial<FormState> {
    const files = fileProblems();
    const only = Object.fromEntries(Object.entries(errors).filter(([key]) => key in files));
    for (const key of Object.keys(only)) unstoredShown.add(key);
    if (!Object.keys(only).length) return {};
    filesProblem = { kind: 'fields', message: Object.values(only)[0], fields: only };
    return { status: 'error', error: Object.values(only)[0], saveProblem: filesProblem };
  }

  /** The form has its values: told to the app, its `open` steps run, then the wizard step it shows is told. */
  async function opening() {
    emit('open', { recordId: state.recordId, values: state.values });
    await moment('on.open', page.on?.open, [], true);
    showing = true;
    tellStep([]);
  }

  /**
   * Values the record holds where it is kept, written as loaded ones are: the
   * starting point moves with them, so they are no change to save, and no
   * change steps, draft or autosave follow. A change of the person's in the
   * same field is taken over by them.
   */
  function store(written: Values) {
    const names = Object.keys(written);
    names.forEach(fieldDef);
    if (!names.length) return;
    const copy = structuredCopy(written);
    baseline = { ...baseline, ...copy };
    writeValues({ ...(state.values as Values), ...copy });
    for (const name of names) changed(name, 'app');
  }

  /** Write fields — a step's or the app's — worked out once, and tell each. */
  function write(written: Values, by: ChangeBy) {
    const names = Object.keys(written);
    names.forEach(fieldDef);
    if (!names.length) return;
    writeValues({ ...(state.values as Values), ...structuredCopy(written) });
    for (const name of names) afterEdit(name);
    for (const name of names) changed(name, by);
  }

  function addLine(field: string, values: Values, by: ChangeBy): string {
    const def = lineField(field);
    const current = (state.values[field] as Line[] | null) ?? [];
    // A key no line holds: lines given (a line's own lines, back from its form) may hold new-… keys already.
    let key = `new-${++lineKeys}`;
    while (current.some((line) => line.key === key)) key = `new-${++lineKeys}`;
    // Each line field's default, then what is worked out from its defaultFrom, then the record's lineDefaults, then what the line is given.
    const lineFields = def.fields as Record<string, LineField>;
    const start = initialValues(lineFields, today());
    Object.assign(start, firstValues(lineFields, lineScope(field, start)));
    if (def.lineDefaults) Object.assign(start, readValueMap(def.lineDefaults, lineFields, recordScope()));
    const line: Line = { key, values: { ...start, ...structuredCopy(values) } };
    // A new line comes last, so it is numbered after the last.
    if (def.sequenceField && line.values[def.sequenceField] == null) {
      const numbers = current.map((l) => l.values[def.sequenceField as string]).filter((n): n is number => typeof n === 'number');
      line.values[def.sequenceField] = numbers.length ? Math.max(...numbers) + 1 : 1;
    }
    const lines = [...current, line];
    writeValues({ ...(state.values as Values), [field]: lines });
    afterEdit(field);
    changed(field, by);
    return key;
  }

  /**
   * Check the form, or only these fields, showing what is found as sending does: a step's check, which waits for a
   * name still being looked up in a box, as a save does.
   */
  async function check(names: readonly string[] | undefined): Promise<Stopped | null> {
    names?.forEach(fieldDef);
    const waiting = readTyped();
    if (waiting) await waiting;
    const all = collectErrors();
    const found = names ? Object.fromEntries(Object.entries(all).filter(([key]) => names.some((name) => key === name || key.startsWith(`${name}.`)))) : all;
    set({ errors: found });
    const first = Object.values(found)[0];
    return first === undefined ? null : { reason: 'check', message: first };
  }

  /** Go to a wizard's step for a run; undefined when the target is no step of it, but a tab. */
  async function goToStep(target: string, chain: readonly string[]): Promise<Stopped | null | undefined> {
    if (!steps.includes(target)) return undefined;
    if (!form.steps().includes(target)) return { reason: 'cannot', message: `The step "${target}" does not apply now` };
    // A name still being looked up in a box on the way is waited for, as a save waits for it.
    const waiting = readTyped();
    if (waiting) await waiting;
    let went = false;
    inRun(chain, () => (went = form.goTo(target)));
    return went ? null : { reason: 'check', message: Object.values(state.errors)[0] };
  }

  /** Run steps from the top — a button's, a moment's, the app's — and tell how it ended: on the record shown as it starts (`generation`). */
  async function runTop(list: readonly ActionStep[], scope: RunScope): Promise<RunResult> {
    scope.generation = generation;
    const result = await runner.runSteps(list, scope);
    emit('run', { id: scope.id, steps: list, result });
    return result;
  }

  /** The model a link field's new record belongs to, or null when it cannot make one. */
  function creatable(def: Field | LineField | undefined): string | null {
    if (!options.dataSource?.create || !def || def.readonly) return null;
    return def.type === 'many2one' || def.type === 'many2many' ? def.relation : null;
  }

  async function runCreate(def: Field | LineField | undefined, name: string, typed: string, values: Values = {}): Promise<RelatedRecord> {
    const model = creatable(def);
    const source = options.dataSource;
    if (!model || !source?.create) throw new Error(`"${name}" cannot make records: its data source has no create, or it is not a link`);
    return track(source.create({ model, name: typed.trim(), ...(Object.keys(values).length ? { values } : {}) }));
  }

  async function runSearch(
    def: Field | LineField,
    name: string,
    ctx: Record<string, unknown>,
    query: string,
    limit: number,
    model?: string,
    ids?: RecordId[]
  ): Promise<RelatedRecord[]> {
    // Formatted text names people and records in place (@mention, #4127): searched by the model they are of.
    const byModel = def.type === 'reference' || def.type === 'json' || def.type === 'html';
    if (def.type !== 'many2one' && def.type !== 'many2many' && !byModel) {
      throw new Error(`"${name}" is not a many2one, many2many, reference, json or html`);
    }
    if (byModel && !model) throw new Error(`Searching "${name}" needs a model`);
    const source = options.dataSource;
    if (!source?.search) return [];
    // Every valueFrom, in groups too, becomes the value it names before the search goes out.
    const own: ResolvedFilter[] | undefined = byModel || !def.filter ? undefined : resolveFilter(def.filter, ctx);
    const filter = ids ? [...(own ?? []), { field: 'id', op: 'in' as const, value: ids }] : own;
    const relation = byModel ? (model as string) : def.relation;
    return track(source.search({ model: relation, query, ...(filter ? { filter } : {}), limit }));
  }

  function lineField(field: string) {
    const def = fieldDef(field);
    if (def.type !== 'one2many') throw new Error(`"${field}" is a ${def.type}, not a one2many`);
    return def;
  }

  function stepIndex(): number {
    return state.step ? steps.indexOf(state.step) : -1;
  }

  /** Whether a step can be passed over with Skip. */
  function optionalStep(id: string): boolean {
    return (index.get(id)?.source as { optional?: boolean } | undefined)?.optional === true;
  }

  /** Load the record; `again`, as a step's reload: no draft offered, no `open` steps run a second time. */
  async function load(again = false): Promise<void> {
    const source = options.dataSource;
    if (state.recordId == null || page.data.kind !== 'record') return;
    if (!source?.load) {
      set({ status: 'error', error: 'This page has no data source to load from' });
      return;
    }
    // Only the latest load is taken: a pager pressed twice shows the record it ended on.
    const seq = ++loads;
    // The record loaded again is shown anew: an answer started for it before is not laid over it.
    newGeneration();
    set({ status: 'loading', error: null, unsent: [] });
    try {
      // A source may give the record's version and what the person may do with it beside its values.
      const { values: loaded, version, can } = loadedRecordOf(await source.load({ model: page.data.model, id: state.recordId, fields }));
      if (seq !== loads) return;
      // Lines load in their tables' orders; where a person moves them after, they stay.
      baseline = syncParts(startFrom(ordered({ ...initialValues(fields, today()), ...loaded })), 'start');
      set({ status: 'ready', values: structuredCopy(baseline), dirty: [], errors: {}, warnings: withValues(baseline, collectWarnings), version: version ?? null, can: can ?? null, unread: {} });
      if (again) return;
      offerDraft();
      void track(opening());
    } catch (error) {
      if (seq === loads) set({ status: 'error', error: (error as Error).message });
    }
  }

  let loads = 0;

  /** Another record in this form's place, or a new one, once the one check let what was there go: false when the person kept it. */
  function openRecord(id: RecordId | null, chain: readonly string[] = []): Promise<boolean> {
    const go = letGo({}, chain);
    return go === true ? showNow(id) : go.then((yes) => (yes ? showNow(id) : false));
  }

  /** Another record in this form's place, or a new one: what was there let go, the new one loaded and opened. */
  async function showNow(id: RecordId | null): Promise<true> {
    newGeneration();
    if (draftTimer !== null) scheduler.clearTimeout(draftTimer);
    if (autosaveTimer !== null) scheduler.clearTimeout(autosaveTimer);
    draftTimer = autosaveTimer = null;
    serverErrors = {};
    told = null;
    showing = false;
    clearFiles();
    const fresh = { dirty: [], errors: {}, warning: null, warningField: null, error: null, draft: null, step: steps[0] ?? null, skipped: [], saveProblem: null, version: null, can: null, conflict: null, setAside: null, unsent: [], unread: {} };
    if (id != null) {
      set({ ...fresh, recordId: id, status: 'idle' });
      await load();
      return true;
    }
    loads++;
    baseline = startFrom(startingValues(true, false));
    const values = syncParts(structuredCopy(baseline), 'start');
    set({ ...fresh, recordId: null, status: 'ready', values, warnings: withValues(values, collectWarnings) });
    offerDraft();
    await opening();
    return true;
  }

  /** The check going now — waiting, or asking — that a way out taken meanwhile joins, with how it was taken. */
  let checking: { how: LeaveHow; going: Promise<boolean> } | null = null;

  /** Whether a way out has to wait first: a save on its way (not the one whose beforeSave steps take it: `own`), or files on theirs. */
  const busy = (own: boolean) => (!own && saveRunning !== null) || filesGoing();

  /** Wait for the saves on their way — unless `own`, the way out is a step of one of them — and the files on theirs, saying so meanwhile. */
  async function quietFirst(own: boolean): Promise<void> {
    if (!busy(own)) return;
    set({ leaving: true });
    try {
      while (busy(own)) {
        if (!own && saveRunning) await saveRunning;
        else await filesSettled();
      }
    } finally {
      set({ leaving: false });
    }
  }

  /** Whether a way out goes at once: nothing to wait for, no check going, nothing at risk — as in 0.20. */
  const atOnce = (how: LeaveHow, own = false) => !deletes && !checking && !busy(own) && (how.discard === true || !workAtRisk(state, how));

  /** The saves on their way, settled: what a load that is not a way out (a conflict's Reload) waits for. */
  async function savesSettled(): Promise<void> {
    while (saveRunning) await saveRunning;
  }

  /**
   * THE check: every way the form's values go — another record, the record
   * loaded again, the host's close, a reset step, the app's own ways out
   * through `leave()` — passes here, so none can lose the person's work
   * unasked. First it waits for a save on its way and files on theirs, so
   * no answer lands on a record that is gone and nothing is told against
   * values that are about to change; then it looks at the record as it is
   * now. Nothing at risk (`workAtRisk`; with `changes`, every change not
   * saved too): true — at once when nothing was on its way, as in 0.20. Else
   * "Discard your changes?" through the host — Discard worded Yes, the focus
   * on Cancel — or `confirm`; with neither, the work is kept. `discard`: the
   * person's own Discard, asked nothing. A way out taken while one waits or
   * asks joins it, and gets its answer. A saved form placed in a record asks
   * the record's. `chain`: the moments the run taking it was set off by — a
   * step of a save's own beforeSave does not wait for that save.
   */
  function letGo(how: LeaveHow = {}, chain: readonly string[] = []): true | Promise<boolean> {
    if (outer) return outer.letGo(how, chain);
    // A delete the person chose: their work goes with the record, unasked.
    if (deletes) {
      forget();
      return true;
    }
    const own = chain.includes('on.beforeSave');
    if (atOnce(how, own)) {
      if (how.discard) forget();
      return true;
    }
    if (checking) {
      const joined = checking;
      // Its answer is this one's too; asked another way (every change counting), it is checked that way after.
      return joined.going.then((yes) => yes && (sameHow(joined.how, how) || Promise.resolve(letGo(how, chain))));
    }
    const going = (async () => {
      await quietFirst(own);
      if (how.discard) {
        forget();
        return true;
      }
      if (!workAtRisk(state, how)) return true;
      return askToLetGo();
    })();
    checking = { how, going };
    void going.then(() => {
      if (checking?.going === going) checking = null;
    });
    return going;
  }

  async function askToLetGo(): Promise<boolean> {
    const message = messages.discardChanges;
    const host = options.host;
    let yes = false;
    try {
      yes = host ? await host.ask(message, { discard: true }) : options.confirm ? await options.confirm(message) : false;
    } catch {
      // A question that could not be asked keeps the work.
    }
    if (yes) forget();
    return yes;
  }

  /** Let go of the person's work at risk: files on their way stop, changes set aside go, changes no save took are asked about no more. */
  function forget() {
    clearFiles();
    personal.clear();
    filed.clear();
    if (state.setAside !== null || state.unsent.length) set({ setAside: null, unsent: [] });
  }

  /** The check as a step meets it: null to go on — at once when nothing is at risk — else why the run stops. */
  function letGoStep(chain: readonly string[]): Stopped | null | Promise<Stopped | null> {
    const go = letGo({}, chain);
    return go === true ? null : go.then((yes) => (yes ? null : kept()));
  }

  const kept = (): Stopped => ({ reason: 'no', message: messages.discardChanges });

  /** Load the record again, once the check let what is shown go. */
  function loadAgain(again: boolean, chain: readonly string[] = []): Promise<boolean> {
    const go = letGo({}, chain);
    if (go === true) return load(again).then(() => true);
    return go.then((yes) => (yes ? load(again).then(() => true) : false));
  }

  /**
   * The host's close, as every `close` step reaches it: the form takes it
   * once, here where it is made, and puts the check before it — so the app's
   * own close (its panel's, its modal's: `host.close`) never drops the
   * person's work unasked, nor does the viewer's dialog, panel or page in
   * place. A saved form placed in a record closes as the record does.
   */
  function close(chain: readonly string[] = []): Stopped | null | Promise<Stopped | null> {
    if (outer) return outer.close(chain);
    const host = options.host;
    if (!host?.close) return { reason: 'cannot', message: 'Nothing can close this form: it has no host, or was not opened in a dialog or panel' };
    const shut = (): null => {
      host.close?.();
      return null;
    };
    const go = letGo({}, chain);
    return go === true ? shut() : go.then((yes) => (yes ? shut() : kept()));
  }

  /** The record a record step asks the data source about. */
  const record = () => ({ model: (page.data as { model: string }).model, id: state.recordId as RecordId, fields });

  async function post(message: PostedMessage): Promise<boolean> {
    if (options.host?.post) {
      try {
        return (await options.host.post(message)) !== false;
      } catch {
        return false;
      }
    }
    if (!events.get('post')?.size) return false;
    emit('post', { recordId: state.recordId, message });
    return true;
  }

  const runner = createRunner({
    fields,
    values: () => state.values,
    recordId: () => state.recordId,
    reading,
    today,
    write: (values) => write(values, 'step'),
    store: (values) => store(values),
    addLine: (field, values) => void addLine(field, values, 'step'),
    check,
    save: saving,
    generation: () => generation,
    gone: () => ({ reason: 'cannot', message: messages.recordReplaced }),
    async reload(chain) {
      if (state.recordId == null) return { reason: 'cannot', message: 'The record is not saved yet: there is nothing to load again' };
      if (!(await loadAgain(true, chain))) return kept();
      return state.status === 'error' ? { reason: 'cannot', message: state.error ?? 'The record could not be loaded again' } : null;
    },
    reset(chain) {
      const reset = (): null => {
        form.reset();
        return null;
      };
      const go = letGo({}, chain);
      return go === true ? reset() : go.then((yes) => (yes ? reset() : kept()));
    },
    close,
    goTo: goToStep,
    showing: inRun,
    host: options.host,
    confirm: options.confirm,
    onAction: options.onAction,
    answered: (request, result) => emit('action', { request, result }),
    changed: () => state.dirty.length > 0 || state.uploads.some(uploadGoing),
    letGo: letGoStep,
    async deleting(remove, done) {
      deletes++;
      try {
        const out = await remove();
        // Deleted: what the person had not saved in it goes with it. Refused, it stays theirs.
        if (done(out)) forget();
        return out;
      } finally {
        deletes--;
      }
    },
    ...(options.dataSource?.archive && page.data.kind === 'record' ? { archive: (archive: boolean) => track((options.dataSource?.archive as NonNullable<DataSource['archive']>)({ ...record(), archive })) } : {}),
    ...(options.dataSource?.copy && page.data.kind === 'record' ? { copy: async () => (await track((options.dataSource?.copy as NonNullable<DataSource['copy']>)(record()))).id } : {}),
    ...(options.dataSource?.delete && page.data.kind === 'record' ? { remove: () => track((options.dataSource?.delete as NonNullable<DataSource['delete']>)(record())) } : {}),
    async showRecord(id, chain) {
      if (!(await openRecord(id, chain))) return kept();
      return state.status === 'error' ? { reason: 'cannot', message: state.error ?? 'The record could not be loaded' } : null;
    },
    told(event, id) {
      if ('archived' in event) emit('archive', { recordId: id, archived: event.archived });
      else if ('copied' in event) emit('duplicate', { from: id, recordId: event.copied });
      else {
        emit('delete', { recordId: id });
        // Nobody moved the form on: it starts a new record in the deleted one's place.
        if (state.recordId === id) void track(openRecord(null));
      }
    },
    post,
    wordsOf: (field) => wordsOfValue(fieldDef(field), state.values[field]),
    barred: (right) => (state.can?.[right] === false ? state.can.reason ?? messages[MAY_NOT[right]] : null),
  });
  const moment = createMoments((key, list, chain) => runTop(list, { id: key, chain }));

  /** A press of a button: its confirmation first, then its steps and its app action as a final call, in `scope`. */
  function press(source: ButtonNode | StatButton | MenuItem, scope: RunScope): Promise<RunResult> {
    const list: ActionStep[] = [...(source.steps ?? [])];
    if (source.action !== undefined) list.push({ do: 'call', action: source.action, ...('params' in source && source.params ? { params: source.params } : {}) });
    // A built-in item of the gear menu with nothing of its own: its step, asked about first when it archives or deletes.
    const builtin = 'builtin' in source && !list.length ? source.builtin : undefined;
    if (builtin) list.push({ do: builtin });
    const asked = builtin === 'archive' ? messages.archiveConfirm : builtin === 'delete' ? messages.deleteConfirm : undefined;
    const confirm = 'confirm' in source && source.confirm !== undefined ? source.confirm : asked;
    return track(
      (async (): Promise<RunResult> => {
        if (confirm && !(await runner.ask(confirm))) {
          const result: RunResult = { done: false, reason: 'no', message: confirm };
          emit('run', { id: scope.id, steps: list, result });
          return result;
        }
        return runTop(list, scope);
      })()
    );
  }

  const form: Form = {
    page,
    getState: () => state,

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    load() {
      const go = letGo();
      return track(go === true ? load() : go.then((yes) => (yes ? load() : undefined)));
    },

    setValue(name, value, how) {
      fieldDef(name);
      writeValues({ ...(state.values as Values), [name]: structuredCopy(value) });
      afterEdit(name);
      changed(name, how?.by ?? 'person');
    },

    setValues: (values, how) => (how?.stored ? store(values) : write(values, 'app')),

    node: nodeState,

    openRecord: (id) => track(openRecord(id)),

    leave: (how) => Promise.resolve(letGo(how)),

    leaveNow: (how = {}) => (outer ? outer.leaveNow(how) : atOnce(how)),

    post,

    setEditing(next) {
      if (next === editing) return;
      editing = next;
      // Nothing of the record changed; what shows of it may have.
      set({});
    },

    fieldReadonly: (name) => lockedField(fieldDef(name)) || state.can?.edit === false || state.can?.readonlyFields?.includes(name) === true,

    loadChoices,
    loadDefinitions,
    addDefinition,

    problem(name) {
      fieldDef(name);
      // Only a field someone can see is asked anything, and required wherever it is shown so.
      const shown = visibleFieldNodes().filter((node) => node.field === name);
      if (!shown.length) return null;
      if (state.unread[name]) return state.unread[name].message;
      // A property's text left unread answers for its field.
      if (page.fields[name].type === 'properties') {
        const row = Object.keys(state.unread).find((path) => path.startsWith(`${name}.`));
        if (row) return state.unread[row].message;
      }
      const own =
        shown.map(unticked).find(Boolean) ??
        shown.map((node) => checkInput(page.fields[name], node.source as FieldNode, state.values[name], messages)).find(Boolean) ??
        checkValue(checked(name), state.values[name], shown.some((node) => nodeState(node.id).required), messages, today());
      return own ?? shown.map((node) => ruleCheck(node).error).find((error) => error !== undefined) ?? null;
    },

    setUnread(path, unread) {
      const field = path.split('.')[0];
      // A line's cell (`field.lineKey.subfield`), or a property (`field.property`).
      const def = fieldDef(field);
      if (path.includes('.') && def.type !== 'properties') lineField(field);
      const had = state.unread[path];
      if (!unread && !had) return;
      // A line taken away takes its cells' text with it: a box of it still reading (a name looked up) keeps none.
      if (unread && !had && path.split('.').length >= 3 && def.type !== 'properties' && valueAt(state.values, path) === gone) return;
      if (unread && had && had.text === unread.text && had.message === unread.message) return;
      const next = { ...state.unread };
      if (unread) next[path] = { text: unread.text, message: unread.message };
      else delete next[path];
      // Problems on screen stay current: an unread text put right takes its words with it.
      const before = state;
      state = { ...state, unread: next };
      const errors = Object.keys(before.errors).length ? revalidateShown(state.values) : before.errors;
      state = before;
      set({ unread: next, errors });
    },

    boxLeft(path) {
      const problem = leftProblem(path);
      if (!problem || state.errors[path] === problem) return;
      set({ errors: { ...state.errors, [path]: problem } });
    },

    settling(read, typing) {
      readers.add(read);
      if (typing) typings.add(typing);
      return () => {
        readers.delete(read);
        if (typing) typings.delete(typing);
      };
    },

    settle: () => readTyped() ?? Promise.resolve(),
    reading: () => readingNow > 0 || [...attached.values()].some((part) => part.inner.form.reading()),

    validate() {
      readTyped();
      const errors = collectErrors();
      set({ errors });
      return Object.keys(errors).length === 0;
    },

    save: () => track(save()),

    canUpload: () => typeof options.dataSource?.upload === 'function',
    upload: (field, files, how = {}) => uploads.start(field, files, how),
    uploading: (field) => state.uploads.filter((upload) => upload.field === field && !upload.line),
    cancelUpload(id) {
      const inner = partUpload(id);
      if (inner) inner.form.cancelUpload(inner.id);
      else uploads.cancel(id);
    },
    retryUpload(id) {
      const inner = partUpload(id);
      if (inner) inner.form.retryUpload(inner.id);
      else uploads.retry(id);
    },

    reset() {
      forgetDraft();
      // Files on their way were changes too: they go with the rest.
      clearFiles();
      serverErrors = {};
      holding = setWhen.holding(baseline);
      // The person's own Discard: nothing of theirs is left at risk, and a save on its way lands as the record it stored.
      resets++;
      personal.clear();
      filed.clear();
      sentAs = null;
      const values = syncParts(structuredCopy(baseline), 'start');
      set({ values, dirty: [], errors: {}, warnings: withValues(values, collectWarnings), warning: null, warningField: null, draft: null, step: steps[0] ?? null, skipped: [], saveProblem: null, conflict: null, unsent: [], unread: {} });
    },

    changes,

    addLine: (field, values = {}) => addLine(field, values, 'person'),

    updateLine(field, key, name, value) {
      const def = lineField(field);
      if (!def.fields[name]) throw new Error(`The lines of "${field}" have no field "${name}"`);
      const lines = ((state.values[field] as Line[] | null) ?? []).map((line) =>
        line.key === key ? { ...line, values: { ...line.values, [name]: structuredCopy(value) } } : line
      );
      writeValues({ ...(state.values as Values), [field]: lines });
      afterEdit(field);
      changed(field, 'person');
    },

    moveLine(field, key, to) {
      const def = lineField(field);
      const sequence = def.sequenceField;
      if (!sequence) throw new Error(`The lines of "${field}" keep no order: give the field a sequenceField`);
      const lines = [...((state.values[field] as Line[] | null) ?? [])];
      const from = lines.findIndex((line) => line.key === key);
      if (from < 0) throw new Error(`"${field}" has no line "${key}"`);
      const target = Math.max(0, Math.min(to, lines.length - 1));
      if (target === from) return;
      // The numbers can be reused only if they rise with the lines as shown.
      const before = lines.map((line) => line.values[sequence]);
      const trusted = before.every((n, i) => typeof n === 'number' && (i === 0 || n > (before[i - 1] as number)));
      lines.splice(target, 0, ...lines.splice(from, 1));
      // The lines that moved take the numbers they held between them, in their
      // new order, and the rest keep theirs; otherwise every line is numbered
      // afresh, 1, 2, 3…, so the order saved is the order shown.
      const low = Math.min(from, target);
      const high = Math.max(from, target);
      const pool = trusted ? (before.slice(low, high + 1) as number[]) : [];
      const renumbered = lines.map((line, i) => {
        const value = trusted ? (i >= low && i <= high ? pool[i - low] : line.values[sequence]) : i + 1;
        return value === line.values[sequence] ? line : { ...line, values: { ...line.values, [sequence]: value } };
      });
      writeValues({ ...(state.values as Values), [field]: renumbered });
      afterEdit(field);
      changed(field, 'person');
    },

    removeLine(field, key) {
      lineField(field);
      // A table that keeps this line (its lineDelete does not hold on it) refuses, wherever the call comes from.
      for (const [nodeId, table] of tables) {
        if (table.field !== field || (index.get(nodeId)?.source as FieldNode).lineDelete === undefined) continue;
        if (((state.values[field] as Line[] | null) ?? []).some((line) => line.key === key) && !lineStateOf(nodeId, key).deletable) {
          throw new Error(`The line "${key}" of "${field}" cannot be deleted now: its table's lineDelete does not hold on it`);
        }
      }
      const lines = ((state.values[field] as Line[] | null) ?? []).filter((line) => line.key !== key);
      writeValues({ ...(state.values as Values), [field]: lines });
      afterEdit(field);
      changed(field, 'person');
    },

    async search(field, query, limit = 8, options = {}) {
      return runSearch(fieldDef(field), field, context(), query, limit, options.model, options.ids);
    },

    async previewLine(field, key, values) {
      lineField(field);
      const lines = (state.values[field] as Line[] | null) ?? [];
      const line = lines.find((l) => l.key === key);
      if (!line) throw new Error(`"${field}" has no line "${key}"`);
      const merged = computed.line(field, { ...line.values, ...values }, state.values as Values);
      const source = options.dataSource;
      if (!source?.onchange || page.data.kind !== 'record') return merged;
      const changed = lines.map((l) => (l.key === key ? { ...l, values: merged } : l));
      const result = await source.onchange({ model: page.data.model, id: state.recordId, changed: field, values: structuredCopy({ ...(state.values as Values), [field]: changed }) });
      const after = ((result.values?.[field] as Line[] | undefined) ?? []).find((l) => l.key === key);
      return after ? computed.line(field, { ...merged, ...after.values }, state.values as Values) : merged;
    },

    async searchLine(field, key, subfield, query, limit = 8, options = {}) {
      const def = lineField(field);
      const sub = def.fields[subfield];
      if (!sub) throw new Error(`The lines of "${field}" have no field "${subfield}"`);
      const line = ((state.values[field] as Line[] | null) ?? []).find((l) => l.key === key);
      if (!line) throw new Error(`"${field}" has no line "${key}"`);
      return runSearch(sub, subfield, lineContext(line.values, def.fields as Record<string, LineField>, context(), line.id ?? null), query, limit, options.model, options.ids);
    },

    canCreate: (field) => creatable(page.fields[field]) !== null,
    quickCreate: (field, typed) => runCreate(page.fields[field], field, typed, page.fields[field] ? createValuesOf(field) : {}),
    canCreateLine: (field, subfield) => creatable(lineField(field).fields[subfield]) !== null,
    quickCreateLine: (field, subfield, typed, key) => runCreate(lineField(field).fields[subfield], subfield, typed, key ? createValuesOf(subfield, { lines: field, key }) : {}),
    createValues: (field, line) => createValuesOf(field, line),

    steps: () => steps.filter((id) => !nodeState(id).invisible),

    next() {
      if (!state.step) return false;
      readTyped();
      // A step skipped before and gone back to is answered now, and checked like any other.
      if (state.skipped.includes(state.step)) set({ skipped: state.skipped.filter((id) => id !== state.step) });
      const errors = collectErrors(state.step);
      if (Object.keys(errors).length) {
        set({ errors });
        return false;
      }
      const visible = form.steps();
      const following = steps.slice(stepIndex() + 1).find((id) => visible.includes(id));
      if (!following) return false;
      set({ step: following, errors: {} });
      return true;
    },

    back() {
      if (!state.step) return false;
      const visible = form.steps();
      const previous = steps.slice(0, stepIndex()).reverse().find((id) => visible.includes(id));
      if (!previous) return false;
      set({ step: previous, errors: {} });
      return true;
    },

    skip() {
      const current = state.step;
      if (!current || !optionalStep(current)) return false;
      const visible = form.steps();
      const following = visible[visible.indexOf(current) + 1];
      if (!following) return false;
      set({ step: following, errors: {}, skipped: [...state.skipped.filter((id) => id !== current), current] });
      return true;
    },

    goTo(target) {
      const visible = form.steps();
      const to = visible.indexOf(target);
      const at = state.step ? visible.indexOf(state.step) : -1;
      if (to === -1 || at === -1) return false;
      if (to <= at) {
        set({ step: target, errors: {} });
        return true;
      }
      readTyped();
      const skipped = [...state.skipped];
      for (const id of visible.slice(at, to)) {
        if (skipped.includes(id)) continue;
        const errors = collectErrors(id);
        if (!Object.keys(errors).length) continue;
        if (optionalStep(id)) {
          skipped.push(id);
          continue;
        }
        set({ step: id, errors, skipped });
        return false;
      }
      set({ step: target, errors: {}, skipped });
      return true;
    },

    async runAction(id, chosen) {
      const node = index.get(id);
      if (!node || (node.kind !== 'button' && node.kind !== 'stat')) throw new Error(`The page has no button "${id}"`);
      if (nodeState(id).invisible) return { done: false, reason: 'cannot', message: `The button "${id}" is hidden` };
      // A button for a table's chosen lines runs with them: runLinesAction.
      if (node.parent && (index.get(node.parent)?.source as FieldNode | undefined)?.selectedButtons?.some((b) => b.id === id)) {
        return { done: false, reason: 'cannot', message: `The button "${id}" runs with the lines chosen in its table` };
      }
      return press(node.source as ButtonNode | StatButton | MenuItem, { id, chain: [], ...(chosen ? { recordIds: [...chosen.recordIds] } : {}) });
    },

    async linkedValues(field, ids, columns) {
      const def = fieldDef(field);
      if (def.type !== 'many2many') throw new Error(`"${field}" is not a many2many`);
      const source = options.dataSource;
      if (!source?.list || !ids.length) return [];
      const found = await source.list({ model: def.relation, fields: [...columns], filter: [{ field: 'id', op: 'in', value: [...ids] }], sort: [], offset: 0, limit: ids.length });
      const byId = new Map(found.records.map((record) => [String(record.id), record]));
      return ids.flatMap((id) => {
        const record = byId.get(String(id));
        return record ? [{ id: record.id, values: record.values }] : [];
      });
    },
    fieldTone(nodeId) {
      const compiled = fieldTones.get(nodeId);
      if (compiled) {
        const { context: ctx, env } = reading();
        return compiled(ctx, env);
      }
      if (index.get(nodeId)?.kind !== 'field') throw new Error(`"${nodeId}" is not a field on this page`);
      return { tone: null, bold: false };
    },
    placeholder(nodeId) {
      const own = placeholders.get(nodeId);
      if (!own) {
        const node = index.get(nodeId);
        if (node?.kind !== 'field') throw new Error(`"${nodeId}" is not a field on this page`);
        const source = node.source as Partial<FieldNode>;
        return nodeId === '#title' && page.layout.type === 'sheet' ? page.layout.title?.placeholder : source.placeholder;
      }
      const { context: ctx, env } = reading();
      return own.when.find((item) => item.holds.evaluate(ctx, env))?.text ?? own.fixed;
    },
    lineState: (nodeId, key) => lineStateOf(nodeId, key),
    columnHidden(nodeId, column) {
      const table = tableOf(nodeId);
      const { context, env } = reading();
      return table ? table.compiled.hidden(column, context, env, userRoles) : false;
    },
    async runRowAction(nodeId, buttonId, key) {
      const table = tableOf(nodeId);
      const button = table?.compiled.buttons.find((b) => b.id === buttonId);
      if (!table || !button) throw new Error(`The table "${nodeId}" has no button "${buttonId}"`);
      if (!lineStateOf(nodeId, key).buttons[buttonId]) return { done: false, reason: 'cannot', message: `The button "${buttonId}" is hidden on this line` };
      const line = ((state.values[table.field] as Line[] | null) ?? []).find((l) => l.key === key) as Line;
      return press(button, { id: buttonId, chain: [], line: { field: table.field, key, values: structuredCopy(line.values) } });
    },
    async runLinesAction(nodeId, buttonId, keys) {
      const node = index.get(nodeId);
      const source = node?.source as FieldNode | undefined;
      const button = source?.selectedButtons?.find((b) => b.id === buttonId);
      if (!node || !source || !button) throw new Error(`The table "${nodeId}" has no button "${buttonId}" for its chosen lines`);
      const all = (state.values[source.field] as Line[] | null) ?? [];
      const chosen = keys.map((key) => all.find((line) => line.key === key) ?? null);
      const missing = keys.find((_, i) => !chosen[i]);
      if (missing !== undefined) throw new Error(`"${source.field}" has no line "${missing}"`);
      if (nodeState(buttonId).invisible) return { done: false, reason: 'cannot', message: `The button "${buttonId}" is hidden` };
      if (!keys.length) return { done: false, reason: 'cannot', message: `The button "${buttonId}" runs with lines chosen: none is` };
      const lines = chosen as Line[];
      return press(button, {
        id: buttonId,
        chain: [],
        lines: { field: source.field, keys: [...keys], ids: lines.flatMap((line) => (line.id === undefined ? [] : [line.id])), values: lines.map((line) => structuredCopy(line.values)) },
      });
    },
    run: (list, context = {}) => track(runTop(list, { id: context.id ?? 'run', chain: [], ...(context.recordIds ? { recordIds: [...context.recordIds] } : {}) })),

    shown(tab) {
      // A wizard's steps are told by the form itself, as they are entered.
      if (steps.includes(tab)) return;
      void track(moment(`on.show.${tab}`, page.on?.show?.[tab], entering, true));
    },

    on(event, listener) {
      let heard = events.get(event);
      if (!heard) events.set(event, (heard = new Set()));
      heard.add(listener as (event: never) => void);
      return () => void heard.delete(listener as (event: never) => void);
    },

    restoreDraft() {
      const raw = options.drafts?.store.getItem(draftKey());
      if (!raw) return;
      const draft = JSON.parse(raw) as { values: Values };
      writeValues(withDraft(draft.values), { draft: null }, true);
    },

    discardDraft() {
      forgetDraft();
      set({ draft: null });
    },

    async reloadTheirs() {
      // A save on its way first: its answer is not dropped by the load.
      await savesSettled();
      // The person's changes, kept before theirs are loaded over them.
      const mine: Values = {};
      for (const name of state.dirty) mine[name] = structuredCopy(state.values[name]) as Value;
      await track(load(true));
      if (state.status !== 'ready') return false;
      // Set aside where theirs differ from mine: a change they made the same way is no loss.
      const aside: Values = { ...(state.setAside ?? {}) };
      for (const [name, value] of Object.entries(mine)) if (!sameValue(fields[name], value, state.values[name])) aside[name] = value;
      set({ conflict: null, saveProblem: null, setAside: Object.keys(aside).length ? aside : null });
      return true;
    },

    async keepMine() {
      const conflict = state.conflict;
      let told = conflict?.theirs;
      let version = conflict?.version;
      // Not told the record as they left it: read as it is now, so a source that saves whole records keeps their work.
      const source = options.dataSource;
      if (conflict && !told) {
        if (source?.load && state.recordId != null && page.data.kind === 'record') {
          try {
            const now = loadedRecordOf(await track(source.load({ model: page.data.model, id: state.recordId, fields })));
            told = now.values;
            version = now.version ?? version;
          } catch {
            // Unread: said below.
          }
        }
        // Still unread: saving now would go over work this person never saw. Nothing is saved; they are told, and choose again.
        if (!told) {
          const message = messages.theirsUnread;
          set({ status: 'error', error: message, saveProblem: { kind: 'conflict', message, conflict: { version: conflict.version } }, conflict: { ...conflict, unread: true } });
          return false;
        }
      }
      if (told) {
        // The record as they left it is where this person's changes start from: theirs stay wherever they changed nothing.
        const theirs: Values = {};
        for (const [name, value] of Object.entries(told)) if (fields[name]) theirs[name] = structuredCopy(value) as Value;
        const mine = state.dirty;
        baseline = { ...baseline, ...theirs };
        const values = { ...(state.values as Values) };
        for (const [name, value] of Object.entries(theirs)) if (!mine.includes(name)) values[name] = value;
        writeValues(values);
      }
      // Saved with the version it has now: these changes over the record as it is.
      if (version) set({ version });
      return track(save());
    },

    putBack(field) {
      const aside = state.setAside;
      if (!aside) return;
      const names = field === undefined ? Object.keys(aside) : Object.prototype.hasOwnProperty.call(aside, field) ? [field] : [];
      if (!names.length) return;
      const left = { ...aside };
      for (const name of names) delete left[name];
      set({ setAside: Object.keys(left).length ? left : null });
      for (const name of names) form.setValue(name, aside[name]);
    },

    discardSetAside() {
      if (state.setAside) set({ setAside: null });
    },

    async settled() {
      while (pending.size) await Promise.allSettled([...pending]);
    },

    embed(id, inner) {
      const known = attached.get(id);
      if (known) return known.inner.form;
      const part = parts.get(id);
      if (!part) throw new Error(`"${id}" is not a saved form placed on this page`);
      const chain = [...within, page.id];
      if (chain.includes(inner.id)) throw new Error(`a page cannot be placed inside itself: ${[...chain.slice(chain.indexOf(inner.id)), inner.id].join(' → ')}`);
      const given = state.values[part.name];
      // A record of no model of its own: its links search and its lists load, but it never loads, saves, sends or recalculates alone.
      const made = innerForm(
        {
          page: { ...inner, data: { kind: 'responses' } },
          dataSource: options.dataSource,
          values: isRecord(given) ? given : {},
          onAction: options.onAction,
          host: options.host,
          confirm: options.confirm,
          scheduler,
          messages,
          now: options.now,
        },
        chain,
        // Its files are the record's: stored for it, under the part's name.
        { model: where.model, recordId: where.recordId, under: `${where.under}${part.name}.` },
        // Its ways out are the record's: through this form's check.
        { letGo, close, leaveNow: (how) => atOnce(how) }
      );
      attached.set(id, { name: part.name, inner: made });
      // A change inside it is told as a change of its answers here, whoever made it.
      made.form.on('change', ({ by }) => {
        if (!syncing) changed(part.name, by);
      });
      // A change made inside it is a change of this form's: shown, kept in a draft, saved. Its files on their way are this form's too.
      let seenUploads = made.form.getState().uploads;
      made.form.subscribe((inside) => {
        if (inside.uploads !== seenUploads) {
          seenUploads = inside.uploads;
          filesChanged();
        }
        if (syncing || inside.values === state.values[part.name]) return;
        writeValues({ ...(state.values as Values), [part.name]: asValue(inside.values) });
        // A link a save put in place of bytes is no change of the person's.
        if (!quietParts) afterEdit(part.name);
      });
      // What it starts with, its defaults and worked-out values filled in, is this form's starting point too — unless changed already.
      const start = asValue(made.form.getState().values);
      if (!state.dirty.includes(part.name)) baseline = { ...baseline, [part.name]: start };
      const values = { ...(state.values as Values), [part.name]: start };
      set({ values, dirty: dirtyFields(values) });
      return made.form;
    },

    embedded: (id) => attached.get(id)?.inner.form ?? null,

    dispose() {
      // An answer that lands after is for no record shown.
      newGeneration();
      clearFiles();
      if (draftTimer !== null) scheduler.clearTimeout(draftTimer);
      if (autosaveTimer !== null) scheduler.clearTimeout(autosaveTimer);
      listeners.clear();
      events.clear();
      for (const part of attached.values()) part.inner.form.dispose();
    },
  };

  // A record's starting values may already break a warning rule; nothing listens yet.
  state = { ...state, warnings: collectWarnings() };
  if (state.recordId == null) offerDraft();
  // A new form has its values now: it opens once whoever made it has had the chance to listen.
  if (state.recordId == null) void track(Promise.resolve().then(opening));
  return {
    form,
    take(values, how) {
      if (how !== 'start') return writeValues({ ...initialValues(page.fields, today()), ...values }, {}, how === 'fresh');
      // Started again from the record round it: a file it held is the record's now, sent or let go with it.
      filed.clear();
      baseline = startFrom({ ...initialValues(page.fields, today()), ...structuredCopy(values) });
      const start = syncParts(structuredCopy(baseline), 'start');
      set({ values: start, dirty: [], errors: {}, warnings: withValues(start, collectWarnings), warning: null, warningField: null, unread: {} });
    },
    errorsNow: () => collectErrors(),
    typing: typingNow,
    show(errors) {
      if (JSON.stringify(errors) !== JSON.stringify(state.errors)) set({ errors });
    },
    files: {
      going: filesGoing,
      settled: filesSettled,
      problems: fileProblems,
      // Its answers are sent whole: every field's bytes are stored.
      storeBytes: () => storeBytes(Object.keys(fields)),
      draft: draftOf,
      clear: clearFiles,
      filed: () => filed.size > 0,
    },
  };
}

/** Two ways out taken the same way: the one joined answers for the other. */
const sameHow = (a: LeaveHow, b: LeaveHow) => !!a.changes === !!b.changes && !!a.discard === !!b.discard;

/** Two lists of names the same, in the same order. */
const sameList = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((name, i) => name === b[i]);

/** A file on its way in a saved form placed in another, as that one names it: its id and its field under the part's name. */
function underPart(name: string, upload: FileUpload): FileUpload {
  return { ...upload, id: `${name}/${upload.id}`, ...(upload.line ? { line: { ...upload.line, field: `${name}.${upload.line.field}` } } : { field: `${name}.${upload.field}` }) };
}

/** The problems found inside a saved form, by its own fields' names. */
function inside(errors: Readonly<Record<string, string>>, name: string): Record<string, string> {
  const found: Record<string, string> = {};
  for (const [key, message] of Object.entries(errors)) if (key.startsWith(`${name}.`)) found[key.slice(name.length + 1)] = message;
  return found;
}

/** One value against another in a table's order: empty and false first, a link by its name, words as people sort them. */
function compareValues(a: unknown, b: unknown): number {
  const empty = (v: unknown) => v === null || v === undefined || v === false || v === '';
  if (empty(a) || empty(b)) return empty(a) === empty(b) ? 0 : empty(a) ? -1 : 1;
  const plain = (v: unknown) => (v !== null && typeof v === 'object' && !Array.isArray(v) && 'label' in v ? String((v as RelatedRecord).label) : v);
  const x = plain(a);
  const y = plain(b);
  if (typeof x === 'number' && typeof y === 'number') return x - y;
  if (typeof x === 'boolean' && typeof y === 'boolean') return Number(x) - Number(y);
  return String(x).localeCompare(String(y));
}

/** Two lines in a table's order: by the first field, then the next. */
function compareLines(a: Values, b: Values, by: NonNullable<FieldNode['order']>): number {
  for (const item of by) {
    const found = compareValues(a[item.field], b[item.field]);
    if (found) return item.desc ? -found : found;
  }
  return 0;
}

/** A field no one types in: read-only by its definition, or worked out from others. */
function lockedField(def: Field): boolean {
  return def.readonly === true || def.compute !== undefined;
}

/** What a record's source may not let a person do, by the name `RecordPermissions` gives it. */
type RecordRight = 'edit' | 'archive' | 'duplicate' | 'delete';

/** The words a person is told when a step would do what they may not, and the source gave no reason. */
const MAY_NOT = { edit: 'mayNotEdit', archive: 'mayNotArchive', duplicate: 'mayNotDuplicate', delete: 'mayNotDelete' } as const;

/**
 * What a press does that a record's source may forbid, read from what it
 * runs: its steps — saving is editing; archiving and bringing back are both
 * archiving — or, for a gear menu's built-in item with nothing of its own, the
 * built-in itself.
 */
function rightsUsed(source: ButtonNode | StatButton | MenuItem): RecordRight[] {
  const steps = source.steps ?? [];
  const names: string[] = steps.map((step) => step.do);
  if ('builtin' in source && source.builtin && !steps.length && source.action === undefined) names.push(source.builtin);
  const rights = new Set<RecordRight>();
  for (const name of names) {
    if (name === 'save') rights.add('edit');
    else if (name === 'archive' || name === 'unarchive') rights.add('archive');
    else if (name === 'duplicate' || name === 'delete') rights.add(name);
  }
  return [...rights];
}

/** A table's lines as the person has them, each new one given the id a save just gave it, by its key: the next save changes it, never makes it again. */
function keepIds(def: Field, mine: Value | undefined, stored: Value | undefined): Value {
  if (def.type !== 'one2many' || !Array.isArray(mine) || !Array.isArray(stored)) return mine as Value;
  const ids = new Map((stored as Line[]).filter((line) => line.id !== undefined).map((line) => [line.key, line.id as RecordId]));
  return (mine as Line[]).map((line) => (line.id === undefined && ids.has(line.key) ? { ...line, id: ids.get(line.key) } : line)) as unknown as Value;
}

/** Two values of a field the same: a link by the record it points to, whatever name it is shown by; the rest as written. */
function sameValue(def: Field | undefined, a: unknown, b: unknown): boolean {
  const id = (value: unknown) => (value !== null && typeof value === 'object' && !Array.isArray(value) && 'id' in value ? (value as RelatedRecord).id : value);
  if (def?.type === 'many2one') return JSON.stringify(id(a) ?? null) === JSON.stringify(id(b) ?? null);
  if (def?.type === 'many2many') return JSON.stringify(((a as unknown[] | null) ?? []).map(id)) === JSON.stringify(((b as unknown[] | null) ?? []).map(id));
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

function lineOps(before: Line[], now: Line[]): LineOp[] {
  const ops: LineOp[] = [];
  const old = new Map(before.filter((line) => line.id !== undefined).map((line) => [line.key, line]));
  for (const line of now) {
    const previous = old.get(line.key);
    if (line.id === undefined || !previous) {
      ops.push({ op: 'create', key: line.key, values: structuredCopy(line.values) });
      continue;
    }
    const changed: Values = {};
    for (const [name, value] of Object.entries(line.values)) {
      if (JSON.stringify(value) !== JSON.stringify(previous.values[name])) changed[name] = structuredCopy(value) as Value;
    }
    if (Object.keys(changed).length) ops.push({ op: 'update', id: line.id, values: changed });
  }
  const kept = new Set(now.map((line) => line.key));
  for (const line of before) if (line.id !== undefined && !kept.has(line.key)) ops.push({ op: 'delete', id: line.id });
  return ops;
}

function linkOps(before: RelatedRecord[], now: RelatedRecord[]): LinkOp[] {
  const had = new Set(before.map((r) => r.id));
  const has = new Set(now.map((r) => r.id));
  return [
    ...now.filter((r) => !had.has(r.id)).map((r): LinkOp => ({ op: 'link', id: r.id })),
    ...before.filter((r) => !has.has(r.id)).map((r): LinkOp => ({ op: 'unlink', id: r.id })),
  ];
}

function indexLayout(root: RootLayout): Map<string, IndexedNode> {
  const index = new Map<string, IndexedNode>();
  const add = (
    source: IndexedNode['source'],
    parent: string | null,
    kind: IndexedNode['kind'],
    modifiers: { invisible?: Modifier; readonly?: Modifier; required?: Modifier; field?: string }
  ) => {
    const roles = (source as { roles?: readonly string[] }).roles;
    const pressed = kind === 'button' ? (source as ButtonNode).pressed : undefined;
    const does = kind === 'button' || kind === 'stat' ? rightsUsed(source as ButtonNode | StatButton | MenuItem) : [];
    index.set(source.id, {
      id: source.id,
      parent,
      kind,
      field: modifiers.field,
      ...(roles?.length ? { roles } : {}),
      invisible: compileModifier(modifiers.invisible),
      readonly: compileModifier(modifiers.readonly),
      required: compileModifier(modifiers.required),
      ...(pressed !== undefined ? { pressed: compileModifier(pressed) } : {}),
      ...(does.length ? { does } : {}),
      source,
    });
    // A button's menu: each item a button of the record, hidden with it.
    if (kind === 'button') for (const item of (source as ButtonNode).menu ?? []) add(item, source.id, 'button', { invisible: item.invisible });
  };
  const walk = (nodes: LayoutNode[], parent: string) => {
    for (const node of nodes) {
      if (node.type === 'field') {
        add(node, parent, 'field', { invisible: node.invisible, readonly: node.readonly, required: node.required, field: node.field });
        // A table's buttons for its chosen lines and in its control row: buttons of the record, inside the table.
        for (const button of [...(node.selectedButtons ?? []), ...(node.controlButtons ?? [])]) add(button, node.id, 'button', { invisible: button.invisible });
      } else if (node.type === 'button') {
        add(node, parent, 'button', { invisible: node.invisible });
      } else if (node.type === 'tabs') {
        add(node, parent, 'other', { invisible: node.invisible });
        for (const tab of node.children) {
          add(tab, node.id, 'other', { invisible: tab.invisible });
          walk(tab.children, tab.id);
        }
      } else if (node.type === 'section') {
        add(node, parent, 'other', { invisible: node.invisible, readonly: node.readonly });
        walk(node.children, node.id);
      } else if (node.type === 'form') {
        add(node, parent, 'form', { invisible: node.invisible, readonly: node.readonly });
      } else {
        add(node, parent, 'other', { invisible: node.invisible });
      }
    }
  };

  if (root.type === 'tabs') {
    walk([root], '');
    index.get(root.id)!.parent = null;
    return index;
  }
  add(root, null, 'other', {});
  if (root.type === 'wizard') {
    for (const step of root.children) {
      add(step, root.id, 'step', { invisible: step.invisible });
      walk(step.children, step.id);
    }
  } else if (root.type === 'sections') {
    walk(root.children, root.id);
    for (const button of root.footer ?? []) add(button, root.id, 'button', { invisible: button.invisible });
  } else if (root.type === 'list') {
    // A list holds no fields of its own record: only the buttons for what is selected.
    for (const button of root.actions ?? []) add(button, root.id, 'button', { invisible: button.invisible });
  } else {
    // The title and statusbar show fields too, so they are validated like
    // any field node. Their ids start with "#", which no page id can.
    const shown = (id: string, field: string | undefined) => {
      if (field) add({ id }, root.id, 'field', { field });
    };
    shown('#title', root.title?.field);
    shown('#subtitle', root.title?.subtitleField);
    shown('#avatar', root.title?.avatarField);
    // The statusbar shows and hides by its own condition and roles.
    if (root.statusbar) add({ id: '#statusbar', ...(root.statusbar.roles ? { roles: root.statusbar.roles } : {}) }, root.id, 'field', { field: root.statusbar.field, invisible: root.statusbar.invisible });
    for (const button of [...(root.buttons ?? []), ...(root.footer ?? [])]) add(button, root.id, 'button', { invisible: button.invisible });
    for (const stat of root.statButtons ?? []) add(stat, root.id, 'stat', { invisible: stat.invisible });
    for (const ribbon of [...(root.ribbon ? [root.ribbon] : []), ...(root.ribbons ?? [])]) add(ribbon, root.id, 'other', { invisible: ribbon.invisible });
    for (const alert of root.alerts ?? []) {
      add(alert, root.id, 'other', { invisible: alert.invisible });
      // An alert's buttons are hidden with it.
      for (const button of alert.buttons ?? []) add(button, alert.id, 'button', { invisible: button.invisible });
    }
    for (const badge of root.badges ?? []) add(badge, root.id, 'other', { invisible: badge.invisible });
    // Fields over and under the title, and on its line, are field nodes like any other.
    walk([...(root.title?.above ?? []), ...(root.title?.before ?? []), ...(root.title?.after ?? []), ...(root.title?.below ?? [])], root.id);
    walk(root.children, root.id);
    // The head's row, buttons and band: its fields are field nodes, its link and buttons buttons of the record.
    const head = root.head;
    for (const part of head?.meta ?? []) {
      if (part.type === 'field') walk([part], root.id);
      else add(part, root.id, 'button', { invisible: part.invisible });
    }
    for (const button of head?.actions ?? []) add(button, root.id, 'button', { invisible: button.invisible });
    walk(head?.band?.children ?? [], root.id);
    if (root.sidePanel) add(root.sidePanel, root.id, 'other', { invisible: root.sidePanel.invisible });
    // The gear menu's items are buttons of the record; Archive shows while it is active, Unarchive while it is not.
    for (const item of root.toolbar?.menu ?? []) {
      add(item, root.id, 'button', { invisible: item.invisible });
      if (item.builtin === 'archive' || item.builtin === 'unarchive') {
        const own = index.get(item.id) as IndexedNode;
        const mine = own.invisible;
        const archived = item.builtin === 'unarchive';
        own.invisible = { ...mine, evaluate: (context, env) => (context['active'] === false) !== archived || mine.evaluate(context, env) };
      }
    }
    if (root.attachmentPreview) add({ id: '#preview', ...root.attachmentPreview }, root.id, 'other', { invisible: root.attachmentPreview.invisible });
  }
  return index;
}

/** A field's value as words in a posted message: a link's name, a choice's label, a yes or no, a number or a date as written. */
function wordsOfValue(def: Field, value: Value | undefined): string {
  if (def.type === 'boolean') return value === true ? 'Yes' : 'No';
  if (value === null || value === undefined || value === false) return '';
  if (def.type === 'selection') return def.options.find((option) => option.value === value)?.label ?? String(value);
  if (def.type === 'html') return String(value).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const one = (item: unknown): string => (item && typeof item === 'object' && 'label' in item ? String((item as { label: unknown }).label) : item && typeof item === 'object' && 'name' in item ? String((item as { name: unknown }).name) : String(item));
  return Array.isArray(value) ? value.map(one).join(', ') : one(value);
}

/** Words held where a number goes ("4.001234567.5"): a box the person typed in and the browser could not read as one. */
export function notANumber(def: Field | undefined, value: unknown): boolean {
  return !!def && (def.type === 'integer' || def.type === 'float' || def.type === 'monetary') && typeof value === 'string' && value.trim() !== '';
}

/** A number box holding words, the field's own or a line's cell. */
function unreadIn(def: Field | undefined, value: unknown): boolean {
  if (def?.type !== 'one2many') return notANumber(def, value);
  return ((value as Line[] | null) ?? []).some((line) => Object.entries(line.values).some(([sub, v]) => notANumber(def.fields[sub] as Field | undefined, v)));
}
