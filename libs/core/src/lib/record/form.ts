import type { ActionStep } from '../format/actions';
import type { DefinitionsFrom, Field, Fields, LineField, Option, PropertyDefinition } from '../format/field';
import { changesOptions, hasOptionRules, optionRulesPart, optionsField, optionsList, type OptionRulesPart } from '../format/choice-options';
import type { OptionRules, TakenOption } from './option-rules';
import type { ButtonNode, FieldNode, FormNode, HeadLink, LayoutNode, MenuItem, Modifier, PressUndo, RelatedNode, RootLayout, StatButton, StepNode } from '../format/layout';
import type { Page } from '../format/page';
import type { PageEnding } from '../format/endings';
import { fillValues, plainWords, READ_WORDS } from '../format/words';
import type { JsonValue } from '../format/json';
import { upgradePage } from '../format/upgrade';
import { zonedPage } from '../format/zoned';
import { compileModifier, type CompiledModifier } from '../expression/modifier';
import { callsPartFunctions, functionsPart, steadyCalls, type Answered, type ExpressionEnv, type FunctionTable } from '../expression/functions';
import { functionTable, type AppFunctions } from '../expression/app-functions';
import { dayIn, ownZone } from './zones';
import { checkProperties, checkValue } from './check';
import { checkInput } from './inputs';
import { compileComputed, type AskedFor } from './compute';
import { compileSetWhen } from './set-when';
import { checkRules, compileRules, type CompiledRule } from './rules';
import { expressionEnv, lineContext, parentReads, recordContext, sameReads, type AppReads } from './env';
import { firstValues, readLooseMap, readValueMap, type MapScope } from './value-map';
import { resolveFilter } from './filter';
import { rolesAllow } from './roles';
import { compileFieldTone, compileTable, type CompiledTable, type FieldTone, type LineState } from './cells';
import { fillMessage, MESSAGES, type Messages } from './messages';
import { recordSentence } from './record-words';
import { askKey, cellOf, listedColumns, notOffered, type ListedColumn } from './line-choices';
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
  type BotReport,
  type SlotsResult,
  type UploadFile,
  type DuplicateMatch,
  type MergeResult,
  type SavedDraft,
  type StoredDraft,
  type ApprovalDecision,
  type VerifiedValue,
  type PaidPayment,
  type SaveRequest,
  type SubmitRequest,
  type PresentPerson,
} from './data-source';
import { formLimitsPart, hasLimits, type FormLimits, type FormLimitsPart } from './taking';
import { formLanguagesPart, hasLanguages, languagesOf } from './languages';
import type { QuizResults } from './quiz';
import type { Countdown } from './timing';
import type { Limits } from './form-limits';
import type { FormApproval } from './approving';
import { draftRead, resumeStep, timedStore } from './drafts';
import { envelopeOf, valuesFromSource } from './from-source';
import { DISCARD_GRACE_MS, stopSends, withDeadlines } from './deadline';
import { ownerOf, tabStore } from './browser-kept';
import { waitingOn, workedOutFrom, type WaitsFor } from './waits';
import { createUploads, fileBytesIn, uploadGoing, withoutFileBytes, type FileUpload, type UploadHow } from './uploads';
import { hostScheduler, type Scheduler } from './scheduler';
import { signedBy, signingFields, type SignedBy } from './signed';
import type { PageLink } from './link-values';
import type { OutboxStore } from './outbox-form';
import { formJoins, joinGate, type FormInner, type FormJoin, type FormJoins, type GuardWords, type JoinPart, type SendKind } from './joins';
import type { Part } from '../parts';
import type { HistoryStep, Noted } from './history';
import { pressUndoPart } from './undo-later';
import { createMoments, createRunner, takenNow, type ActionHost, type ActionRequest, type ActionResult, type AskHow, type OnAction, type PostedMessage, type RunContext, type RunResult, type RunScope, type Stopped } from './run';
import {
  emptyValue,
  initialValues,
  isEmpty,
  keptSame,
  lineKind,
  structuredCopy,
  type Line,
  type RecordId,
  type RelatedRecord,
  type Value,
  type Values,
} from './values';
import { intlFormat } from '../intl-format';
import { recomputeInFull, workCounts } from './work';
import { sayAgainAsWordsCome, sayNoMore, wordsVersion } from './words-chunks';

/** The one-tag script's version, which its build writes in (tools/script-bundle.mjs); none in the packages. */
declare const __FIELDIA_VERSION__: string | undefined;

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
  /**
   * The choices loaded from the app's lists: those of a selection with `optionsFrom`, once asked for — by field, and a
   * table line's by its cell's path (`field.lineKey.subfield`).
   */
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
   * saved went on (its afterSave run, a copy being made), or since — and text
   * they left since in a box of it that does not read (`unread`), which no save
   * can send. Worked out from the record as that save left it, so a change back
   * to it is none; and before the record's first save, only a file the store
   * holds and no save sent. Never a value a step, a rule, a compute or the app
   * set: each change is told by its origin. The next record starts with none.
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
  /**
   * A page of responses sent: the answers as they went, with what the app's source answered — the id it gave the
   * response and the values it added (`SubmitResult`). What its ending reads (`form.ending()`, `{id}`). Null until a
   * send, and again once the form starts a new response (`reset`).
   */
  readonly sent?: SentResponse | null;
  /**
   * Values worked out from an app's function that asks its server (`functions`) with no answer yet, by path (a
   * line's `field.lineKey.subfield`): waiting for it (`{}`) — the value empty meanwhile, a save waiting for it — or
   * why it did not come (`failed`), which a save asks again and, failing, is stopped by under its field.
   */
  readonly asked: Readonly<Record<string, AskedFor>>;
  /**
   * Words said under a choice whose chosen options a change of other answers no longer offers — hidden by their
   * condition, no longer picked where they are carried from, or no longer in the app's list as a field it changes with
   * changed — by path (a field, or a table line's `field.lineKey.subfield`): they were taken out of its answer. Until
   * that value is written again, its line goes, or another record is shown.
   */
  readonly takenOut: Readonly<Record<string, string>>;
  /**
   * When the page takes answers and each choice's places, as its `limits`, its options' `seats`, the form's clock and
   * the data source's `limits` tell: whether it takes them now (`state`), when it opens and closes, the responses it
   * takes still, and each choice's places left. Null on a page with neither.
   */
  readonly limits?: FormLimits | null;
  /**
   * The draft kept on the app's server (`saveDraft`) that these answers continue: its `key`, once the source gave one
   * (the viewer's `resume`, or the first draft kept); `missing` when the key the form was given named no draft — it
   * starts empty. Null while none is.
   */
  readonly resume?: { readonly key: string; readonly missing?: boolean } | null;
  /**
   * The record's approvals, on a page with `approval` whose data source tells them (`approvals`): its levels and where
   * each stands, what was decided, the levels this person may decide, and whether it waits — when its fields lock but
   * for those the page leaves open. Null for a new record, or a page without them.
   */
  readonly approval?: FormApproval | null;
  /**
   * The order drawn for this respondent, where the page draws one (`order: "random"`, `draw`): for each wizard, step
   * or group drawn, its parts' ids in the order shown — those not drawn left out, and never asked. Kept in drafts, and
   * sent with the answers (`SubmitRequest.order`). Null where the page draws nothing, or before the survey flow's part came.
   */
  readonly order?: Readonly<Record<string, readonly string[]>> | null;
  /**
   * A page's time limits (`timeLimit` on the page and on its steps): when each started, by the form's clock (ms) — the
   * page's under `#form`, a step's by its id — kept in drafts so a page opened again goes on counting.
   */
  readonly timers: Readonly<Record<string, number>>;
  /** The time limits that ran out: their answers are locked, and their checks refuse nothing — they go as they stood. */
  readonly timeUp: readonly string[];
  /**
   * The emails and phones the person proved they own by a code (`options.verify`), by field: the value proved and the
   * app's proof. One counts while its field still holds that value; each send carries those that do (`verified`). Set
   * by the verify part, on a page with a field asking for a code.
   */
  readonly verified?: Readonly<Record<string, VerifiedValue>>;
  /**
   * The payment the answers waited for (a page's `payment`), once taken: what a send carries; null before, and once
   * started again. Set by the pay part, on a page asking for a payment.
   */
  readonly paid?: PaidPayment | null;
  /**
   * A page's offline outbox (`outbox`), set by the outbox part: how many sends wait on this device, whether they are
   * being sent now, whether the last try found no network (a send kept, or one kept not taken: the browser's own word
   * is not trusted), whether the last send of this form was kept (`kept`: its ending says so), and those the server
   * refused once they went — kept to try again or discard. Left out on a page without one, and until it is read.
   */
  readonly outbox?: {
    readonly waiting: number;
    readonly sending: boolean;
    readonly offline: boolean;
    readonly kept: boolean;
    readonly refused: readonly { readonly key: string; readonly message: string; readonly at: string }[];
    /** Whether what waits outlives the page: false where the browser keeps nothing past it (no IndexedDB) — held in memory, and said so. */
    readonly lasting?: boolean;
  };
  /** Who else has the record open, as the data source's `presence` pushed: never this person. Empty while none does, or without it. */
  readonly present?: readonly PresentPerson[];
  /**
   * Whether the record shown has its values from its source: false while its first load is on its way, or failed —
   * nothing of it to change or save (the viewer draws its fields inert, and a save is refused) — true once it loaded,
   * and for a new record or a page of responses. A load again that fails keeps what loaded before.
   */
  readonly loaded?: boolean;
  /** Why the record could not be loaded, in words, until a load ends well: said with a Retry of its own (`form.load()`). */
  readonly loadProblem?: SaveProblem | null;
  /**
   * Values the record's source holds that could not be read as their fields hold them — `"vip,new"` for a list of
   * records — by field, with why: shown empty, said under the field, and never sent back over what the source holds,
   * unless the person writes the field.
   */
  readonly unreadable?: Readonly<Record<string, string>>;
}

/** A response sent, as `FormState.sent` keeps it. */
export interface SentResponse {
  /** The id the app's source gave the response ("B-1043"), or null where it gave none. */
  readonly id: RecordId | null;
  /** The answers as they were sent, with the values the source added (`SubmitResult.values`) laid over them. */
  readonly values: Readonly<Values>;
  /** A quiz's results (`quiz` on the page): as the app's source marked them (`SubmitResult.quiz`), else as the page does. */
  readonly quiz?: QuizResults;
}

/** How a search for a link's records is asked (`form.search`, `form.searchLine`). */
export interface SearchOptions {
  /** The model searched: a reference's, or the model structured data names records of. */
  model?: string;
  /** Those records alone, for their names. */
  ids?: RecordId[];
  /** Only the records named exactly the query, in any case (`SearchRequest.exact`): a typed name read as a record. */
  exact?: boolean;
  /**
   * Only the records whose `field` holds the query exactly — a code read by a scanner, by the field holding the linked
   * records' codes ("barcode") — asked through the search's filter, whatever their names.
   */
  field?: string;
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
 * change of theirs the last save did not send, or text they left since that
 * does not read ("12a" counts as "12" does: `unsent`), files still on
 * their way, changes Reload set aside, the changes of a save refused for a
 * conflict, waiting for Reload or Keep mine (only a source that keeps
 * versions has one) — and, `how.changes`, any change not saved. What
 * `form.leave()` — the one check every way out goes through — asks about,
 * once the save on its way and the files on theirs settled. Before a
 * record's first save, a change not saved is not at risk: as in 0.20, each
 * way out decides.
 */
export function workAtRisk(state: FormState, how: LeaveHow = {}): boolean {
  return (
    (state.unsent ?? []).length > 0 ||
    state.setAside != null ||
    (state.uploads ?? []).some(uploadGoing) ||
    // The person asked for these to be saved, and someone else's save came first: still theirs, and not saved.
    (state.conflict != null && state.dirty.length > 0) ||
    (how.changes === true && (state.dirty.length > 0 || Object.keys(state.unread ?? {}).length > 0))
  );
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
  /** A record was saved: its values as the save left it — what it sent and what came back; a change made meanwhile is not among them. */
  save: { recordId: RecordId | null; values: Readonly<Values> };
  /** A page of responses sent its answers: those sent, and on a page with a bot check (`botCheck`) what it saw. */
  send: { values: Values; bot?: BotReport };
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
  /**
   * A draft was kept on the app's server (`saveDraft`): its key — what a link to continue from carries — and whether the
   * person pressed "Continue later" (`later`), with the source's answer.
   */
  draft: { key: string; savedAt: string; later: boolean; saved: SavedDraft };
  /**
   * A change made elsewhere arrived (the data source's `subscribe`): laid on the record where the person had changed
   * nothing (`conflict` false), else waiting as a conflict, Reload or Keep mine — with who and when, and the fields it
   * changed.
   */
  arrived: { recordId: RecordId; by?: string; at?: string; fields: string[]; conflict: boolean };
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
  /**
   * How a question is asked when there is no host. Without either, a question goes on as though answered Yes. `how.yes`
   * is what answering Yes does, for its Yes button's words: a button's own label ("Send the quote"), Archive, Delete.
   */
  confirm?: (message: string, how?: AskHow) => boolean | Promise<boolean>;
  /**
   * Keep what is typed as a draft, offered again the next time the page opens: in `store` (the browser's localStorage
   * fits) — or, on a page with `continueLater` whose data source has `saveDraft` and `loadDraft`, on the app's server,
   * the store keeping only its key (such a page keeps its drafts there without this too). A draft keeps the wizard's
   * step and text typed that does not read yet. `restore`: `ask` (the default) offers it, `auto` lays it at once. A
   * draft is the person's (`user`, else the tab's), a record's its changes alone with their version, and never holds a
   * secret field: see "What Fieldia keeps in the browser" in the README.
   */
  drafts?: { store: DraftStore; restore?: 'auto' | 'ask'; delayMs?: number };
  /**
   * The key of a draft kept on the app's server (`saveDraft`) to continue from — what the link the app made after
   * "Continue later" carries: loaded through the source's `loadDraft` as the form opens, its answers, its wizard step
   * and its text typed that does not read laid as they were. A key that names none starts the form empty
   * (`resume.missing`). Without the source's `loadDraft`, it is let be.
   */
  resume?: string;
  /**
   * The respondent's own seed for a page that draws its questions' order or some of them (`order: "random"`, `draw`):
   * the same seed, the same draw — an invitation's code, a candidate's id. Left out, the person's id (`user.id`), else
   * one of the browser's for each response.
   */
  seed?: string;
  /**
   * The link the page is opened with — its address, its `?…` part, or its parameters by name — for a page that fills
   * fields from it (`prefill.fromUrl`): read as a new record or response starts, before what the form is given
   * (`values`). Left out, the page's own address (`location.href`); an app that renders on a server, or is embedded,
   * gives the one it knows (the React, Vue and Angular wrappers' `url`). Without `prefill`, never read.
   */
  url?: PageLink;
  /**
   * Where a page's offline outbox (`outbox`) keeps its sends: the app's own store; else the browser's IndexedDB, else
   * memory (`memoryOutbox`, lost with the page).
   */
  outbox?: OutboxStore;
  autosave?: { delayMs: number };
  /**
   * The most a request to the data source a person waits on may take, in milliseconds — a save, a send, an onchange, a
   * search, a list's options — past which its `signal` aborts and it ends as the network's problem, with Retry: 30 000
   * unless said, 0 for none. A Discard ends the ones on their way at once. A record's load waits as the loading
   * settings say (`loading.timeout`).
   */
  timeout?: number;
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
  /**
   * How a field's value reads inside the page's own words — a `{field}` in a label, a help, a choice, a step's title, a
   * button, an ending — and so inside the form's messages that name a label ("Please answer “How was your visit to
   * Zamalek?”"). The viewer gives its own, as each field shows its value at rest: a choice by its label, money with its
   * currency, a day in the page's order. Left out, a choice by its label, a link by its name, a yes or no as Yes or No,
   * anything else as it is held.
   */
  valueWords?: (field: Field, value: Value | undefined, values: Readonly<Values>) => string;
  /**
   * The app's own functions, which the page's expressions call by name besides Fieldia's: `vatRate(country)`. Each a
   * plain function, or `{ call, takes, values, gives, tip }`. One that asks the app's server gives a promise: a value
   * worked out from it waits while it is asked — once for the same values, for the record shown — and a save waits
   * for it; a condition reading it does not hold meanwhile. A name a page cannot call is refused as the form is made.
   */
  functions?: AppFunctions;
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
  /** The app's own functions as the page's expressions call them (`FormOptions.functions`): for what reads its conditions apart. */
  readonly functions?: FunctionTable;
  /**
   * A table line's cell's form (@fieldia/widgets' `lineForm`): the table and the line it is the form of, whose values,
   * choices and words taken out of them are the line's own. Left out of a record's own form.
   */
  readonly line?: { readonly field: string; readonly key: string };
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
  /** A part's state now: the same object, given again, while nothing of it changed. */
  node(id: string): NodeState;
  /**
   * The fields a part's state is worked out from: its conditions' and those of the parts round it — for a field's node,
   * its tones', its empty box's words' and the signatures that lock answers too. While none of them changed, nor the
   * record's id, whether it is edited, or what its source lets the person do, the part's state is what it was. Null
   * where that cannot be said: a condition calling today() or the app's own function, a value worked out from others
   * (it waits for them), a page whose parts a survey's draw, its time limits or its approvals may hide or lock.
   */
  nodeReads(id: string): readonly string[] | null;
  /** Whether the record is being edited, as conditions read `editing`: a view that locks it to be read says false, and parts follow. */
  setEditing(editing: boolean): void;
  /**
   * Whether a field is read-only whatever the conditions say: by its definition, for this person by what the record's
   * source said (`can`), or signed by a signature kept (`FileValue.signed`).
   */
  fieldReadonly(name: string): boolean;
  /** What a field would be told if the form were checked now, or null when it passes. Nothing is shown. */
  problem(field: string): string | null;
  /**
   * What a value worked out from others waits for while one of them holds text that does not read (`unread`), or an
   * answer the form refuses (shown, not empty, and refused by its checks: an area under its least, a day past today):
   * a total of the page's own (`compute`) over a table whose line says "abc" in its Quantity, a price per m² over an
   * area of −50, or an amount the app works out as the lines change (read-only, from a source with an onchange) — the
   * line, as people count them, and its cell. Shown, it is a dash said in words, as the table's own total waits: never
   * an amount worked out from the value that text replaced, or from one refused. Then what is asked of the app's
   * server for it (`asking`). Null when it shows its value.
   */
  waitsFor(field: string): WaitsFor | null;
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
   * Tell a public page's bot check (`page.botCheck`) what was seen: its hidden box filled (`honeypot`, the viewer's), or
   * the captcha's token as the app's widget gives it (`captcha`; null once it expires). Each send carries them, with
   * the time the answers took, as `bot` (`SubmitRequest`); a token goes once it is sent, as a captcha's is spent.
   */
  botCheck(seen: { honeypot?: boolean; captcha?: string | null }): void;
  /**
   * A part's side of this form, where the page asks for it (`formJoins`), by its name: `verify` — which fields ask for a
   * code (`asks`), a value proved (`mark`); `pay` — what is due now (`due`); `outbox` — what waits on this device
   * (`send`, `retry`, `discard`). Null where the page asks for none, and until its part has come (the form asks for it
   * as it is made; `settle` waits for it).
   */
  joined<K extends keyof FormJoins>(name: K): FormJoins[K] | null;
  /**
   * Whether a box's reading of what was typed still waits (a name being looked up): a check or a step forward made
   * now refuses its text with "still looking", so a caller that can wait for it (`settle`) checks again after.
   */
  reading(): boolean;
  /**
   * Check the answers — or, given a part's id, those inside it alone (a step, a question shown on its own): what is typed
   * read first, each problem said under its field, true when there is none. The problems said are those it found.
   */
  validate(within?: string): boolean;
  /** `how.yes`: the words of what set it off — the Submit button's —, which the page's `beforeSave` questions' Yes says. */
  save(how?: { yes?: string }): Promise<boolean>;
  reset(): void;
  /**
   * Words of the page's with each `{field}` showing the value the form holds now, as `valueWords` writes it — a label's,
   * a help's, a step's title, a button's: "How was your visit to {branch}?" reads "How was your visit to Zamalek?". A
   * name that is no field of the page shows nothing.
   */
  words(text: string): string;
  /**
   * The ending a page of responses shows now its answers are sent (`FormState.sent`): the first of the page's
   * `endings` whose `when` holds on the answers as sent, with what the source added and the response's `id`, else the
   * first with no `when`; null before a send, on a page with none, or where none holds.
   */
  ending(): PageEnding | null;
  /** An ending's words, its `{field}`s and `{id}` filled in from the response sent (`FormState.sent`), as `words` writes them. */
  endingWords(text: string): string;
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
   * goes through `leave()` first: false when the person kept their work. `name`, the record's name where the person
   * picked it by one (a list's row): what a failure to open it calls it, rather than its id.
   */
  openRecord(id: RecordId | null, name?: string): Promise<boolean>;
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
   * The record shown now, for an answer asked for it that comes later: the
   * function returned is true while that record is still the one shown, as it
   * was — no other opened, it not loaded again, no new one started, the
   * person's Discard not pressed, the form not closed. What writes on the
   * form, or acts on its record, once a wait ends — a name looked up, a
   * record made from a link, a line's dialog, a step's call to the source —
   * asks it first, so an answer is laid only on the record it was asked for
   * (docs/plans/wave1-contract.md, section 10, part 2).
   */
  recordShown(): () => boolean;
  /**
   * What a related list (a `related` part, by its id) asks the data source's `list` for, on the record shown: the
   * records whose link is this record, and that its own `filter` lets through, each `valueFrom` read from this record.
   * Null before the record's first save — nothing points at it yet — and for no related list of that id.
   */
  relatedFilter(id: string): ResolvedFilter[] | null;
  /**
   * Post words in the record's conversation, as a `post` step does: through
   * the form's host when it has a way to, else told to the form's own
   * listeners (`post`). False when nothing heard them.
   */
  post(message: PostedMessage): Promise<boolean>;
  /**
   * Load, or load again, the choices of a selection whose options come from
   * the app's list (`optionsFrom`). Once loaded, they load again by themselves
   * when a field they change with changes; the latest answer wins, and a
   * choice it no longer offers after the person, a step or the app changed
   * that field is taken out and said (`FormState.takenOut`). A value a record
   * comes in with is kept, and its save says why. A table line's, by its
   * cell's path (`field.lineKey.subfield`), are asked by the line's values and
   * shared with every line where the columns they change with hold the same,
   * for the record shown; once loaded, they follow those columns on that line.
   */
  loadChoices(field: string): void;
  /**
   * A table line's choices from the app's list, as they are asked for that line, with `values` laid over it — a row
   * pasted on it, its connection read first. `key` null: a line not added yet, by the values one added now starts with.
   */
  lineChoices(field: string, key: string | null, subfield: string, values?: Values): Promise<Option[]>;
  /**
   * The options a choice offers now: its own — or those its list gave (`optionsFrom.list`), or those picked in the
   * question they are carried from (`optionsFrom.field`), its own after them — less those whose condition hides them
   * (`options[].invisible`). A table line's by its cell's path (`field.lineKey.subfield`), its conditions read on that
   * line. Null for a field that is no choice.
   */
  offered(field: string): readonly Option[] | null;
  /**
   * Whether a choice's options change with the record's answers: a condition on one, or carried from another question.
   * A table line's by its cell's path: a condition on one of its column's options.
   */
  offersChange(field: string): boolean;
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
   * finds those records alone, for their names; `options.exact`, those named
   * exactly the query (`SearchRequest.exact`).
   */
  search(field: string, query: string, limit?: number, options?: SearchOptions): Promise<RelatedRecord[]>;
  /**
   * The same, for a relation inside a one2many line, filtered by that line's values — or structured data of a line
   * naming records of a model (`options.model`). `key` null: a line not added yet, by the values one added now would
   * start with (a row pasted past the last line, its names read before the line is made).
   */
  searchLine(field: string, key: string | null, subfield: string, query: string, limit?: number, options?: SearchOptions): Promise<RelatedRecord[]>;
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
  /** A page's time limit started — its Start pressed: its clock runs from now, and runs out on time (`timeUp`). */
  startTimer(): void;
  /** The time limit's countdown showing now — the page's while it runs, else the step's on screen — or null; read on the form's clock. */
  countdown(): Countdown | null;
  /**
   * Go to a step that applies. Back, at once; forward, only past steps that are
   * complete: it stops at the first one with a problem and shows it, and skips
   * an optional one instead.
   */
  goTo(step: string): boolean;
  /**
   * Press a button: ask its `confirm` first, run its `steps`, then call its
   * `action`, when it names one, as a final `call`. A list's button passes
   * the records chosen in it, and every call of the run carries them. What is
   * typed is read before its first step that reads the form or hands its
   * values on, as a save reads it: text that does not read stops the run.
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
  /** Run steps on this form, as a button would — what is typed read first: `context.id` is what their calls carry (`run` when left out). */
  run(steps: readonly ActionStep[], context?: RunContext): Promise<RunResult>;
  /** A tab was shown: the viewer says so, and the page's `show` steps for it run. */
  shown(tab: string): void;
  /** Listen to one of the form's events; returns what stops listening. */
  on<E extends keyof FormEvents>(event: E, listener: (event: FormEvents[E]) => void): () => void;
  restoreDraft(): void;
  discardDraft(): void;
  /** Whether the page offers "Continue later": it says `continueLater`, and its data source has `saveDraft`. */
  canContinueLater(): boolean;
  /**
   * "Continue later": what is typed read first (`settle`), then the answers so far — their wizard step, text that does
   * not read kept as typed — kept on the app's server through `saveDraft` (`later: true`): its answer, the key, and the
   * link the app made to continue from and its words. Rejects where the source refused, or has no `saveDraft`.
   */
  continueLater(): Promise<SavedDraft>;
  /**
   * Ask the data source's `limits` again — how many responses the page took, this person's, each choice's takers — and
   * show what it tells (`limits`). The form asks it itself as it opens, before its answers go, and after they went.
   */
  refreshLimits(): Promise<void>;
  /**
   * Ask the data source's `approvals` again for the record shown, and keep what it tells (`approval`). The form asks it
   * itself as a saved record is shown, after each save, and after a decision.
   */
  refreshApprovals(): Promise<void>;
  /**
   * Decide at a level of the record's approvals this person may decide now (`approval.mine`): approved, or rejected
   * with why — a rejection always says why. What is typed is read and the person's changes saved first; the source's
   * `decide` takes it; the record is loaded again after, its approvals with it. Rejects in words where the level is not
   * theirs to decide now, a rejection gives no reason, the save is refused, or the source refused the decision.
   */
  decide(level: string, decision: ApprovalDecision, reason?: string): Promise<void>;
  /**
   * What a field's lock says while the record waits for approval — locked but for the fields the page leaves open
   * (`approval.open`) — or null where no approval locks it.
   */
  approvalLock(name: string): string | null;
  /**
   * Whether a file picked for a file or picture field is stored at once,
   * through the data source's `upload`. False without one: a file then
   * travels inside the record as base64, as it always has.
   */
  canUpload(): boolean;
  /** Today, as 2026-10-15, on the clock of the page's time zone — the browser's own where it names none — by the form's clock (`now`). */
  today(): string;
  /** Now, by the form's clock (`now`): the computer's own where the app gave none. A signature's when. */
  now(): Date;
  /** The person using the form, as the app named them (`user`); null where it named none. */
  user(): FormUser | null;
  /**
   * The answers shown now, by field, in the page's order: a field placed on the page — or a saved form's answers, by its
   * name — not hidden by its condition, its roles or the record's source, nor in a step passed over with Skip. What a
   * signature that signs every answer signs.
   */
  shownFields(): string[];
  /**
   * A record of the page's model as conditions read it, the form's own way: its values (a link as its id), its `id`,
   * the person using the form (`user`), the app's `context`, and `editing` false — for what reads conditions on records
   * the form does not hold, such as a list's rows (their `rowTones`, `rowBold` and `rowButtons`). Of another model — a
   * related list's rows — with that model's `fields` (the related list's own).
   */
  recordReads(id: RecordId | null, values: Values, fields?: Record<string, Field | LineField>): Record<string, unknown>;
  /** Whether a date and time drawn as booking slots can ask for its free times: the data source has `slots`. */
  canFindSlots(): boolean;
  /**
   * The free times of a date and time drawn as booking slots, asked of the data source's `slots` for the days `from`
   * to `to` — in the field's time zone: its own, its page's, or the browser's — with the record, its values and the
   * zone filled in. Rejects where the source has no `slots`.
   */
  findSlots(field: string, ask: { from: string; to: string; schedule?: string; length?: number; between?: number }): Promise<SlotsResult>;
  /** Whether the page asks for possible duplicates: a record's page naming fields in `duplicates`, its source with `duplicates`. */
  canFindDuplicates(): boolean;
  /**
   * Records like the one shown, asked of the data source's `duplicates` with the fields the page names that hold a
   * value now — none, and nothing is asked — and every value of the form: the matches, the likest first where the
   * source scores them, never the record itself. Rejects where the source has no `duplicates`. Its answer is for the
   * record shown as it was asked (`recordShown`).
   */
  findDuplicates(): Promise<DuplicateMatch[]>;
  /** Whether the source keeps "It's someone new" itself, on the app's server: it has `notDuplicates` and `markNotDuplicate`, both. */
  keepsNotDuplicates(): boolean;
  /**
   * The records said to be someone else for the record shown, asked of the source's `notDuplicates`: none while it is
   * new. Rejects where the source has no `notDuplicates`. Its answer is for the record shown as it was asked.
   */
  notDuplicates(): Promise<RecordId[]>;
  /** Keep that `matchId` is someone else for the record shown, through the source's `markNotDuplicate`: refused while it is new. */
  markNotDuplicate(matchId: RecordId): Promise<void>;
  /** Whether records of the page's model can be merged: its source has `merge`, and `load` to read the others. */
  canMerge(): boolean;
  /** Another record of the page's model, as its source loads it, its values alone: the form is left as it is. For a merge's screen. */
  readRecord(id: RecordId): Promise<Values>;
  /**
   * Merge records of the page's model into one through the source's `merge`: `keepId` kept with `values`, `mergeIds`
   * gone. The form is left as it is: show the record kept (`openRecord`, `load`) once it is done.
   */
  merge(request: { keepId: RecordId; mergeIds: RecordId[]; values: Values }): Promise<MergeResult | void>;
  /**
   * Store files picked for a file or picture field — or a field on a table's
   * line (`how.line`) — through the data source's `upload`, each as soon as
   * it is picked: `uploads` in the state shows each on its way, and once
   * stored the field holds its link, a field of several in the order they
   * were picked. Three go at once, the rest wait their turn; `how.prepare`
   * makes each ready first, one at a time (a photo made smaller). A field of
   * one file keeps the last one picked. Gives each upload's id. A save waits
   * for those still going, and stops, under the field, for one that failed.
   * `how.replaces`: the file is stored for bytes the field holds (a photo
   * cropped), its link taking their place once stored, as a save's would.
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
  /**
   * Take back the person's last change to the record — a field written, a cell typed in, a line added, taken away or
   * moved; typing on in one box is one change until the box is left — as their own change back: the page's `change`
   * steps and the source's onchange run as for any. A change whose field holds something else since (a step, the app,
   * a reload) or is locked now is passed over. The step taken back, or null when none is left. The viewer's Ctrl+Z.
   * The changes are kept from the first; taking them back is the undo part's (`pressUndoPart`), asked for as the first
   * is kept — null until it has come.
   */
  undo(): HistoryStep | null;
  /** Make the last change taken back again, as `undo` takes one back; null when none is. Ctrl+Shift+Z, Ctrl+Y. */
  redo(): HistoryStep | null;
  /**
   * The changes `undo` and `redo` would take now: for a button or a menu that names them (once the undo part has come).
   * A save starts them afresh (not on a page with `autosave`): a change saved is none to take back.
   */
  history(): { undo: HistoryStep | null; redo: HistoryStep | null };
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
  // Every request a person waits on answers within its deadline (deadline.ts): the one place a form's requests meet it.
  const words = (options.messages ?? MESSAGES.en).noAnswer;
  const dataSource = withDeadlines(options.dataSource, options.timeout, words, options.scheduler);
  return innerForm({ ...options, page, ...(dataSource ? { dataSource } : {}) }, []).form;
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

/** What of the person's a write touches: the one line of a table they changed (`line`), or nothing of theirs it takes over (`keep`). */
interface Claim {
  line?: string;
  keep?: boolean;
}

/** Whether a run works a person's change out: a page's `change` steps, set off by it, or a run they set off. */
const worksOut = (chain: readonly string[]) => chain.some((key) => key.startsWith('on.change.'));

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
  /** Its own test of the record shown: another record shown round it, nothing asked for inside is laid either. */
  recordShown(): () => boolean;
}

/**
 * `within` are the pages round this one, outermost first: a page among them
 * placed again would hold itself. `place`, for a saved form placed in a
 * record: the record its files are stored for. `outer`, the form round it:
 * its ways out go through that one's check.
 */
function innerForm(options: FormOptions, within: string[], place?: Place, outer?: Outer): InnerForm {
  // Its time zone written into each date and time field naming none, for whatever reads one from its field alone.
  const page = zonedPage(options.page);
  const scheduler = options.scheduler ?? hostScheduler;
  // A field's label small inside a message's sentence where the page asks (`lowerLabels`).
  // …and a day written in the page's order where it says one (`look.dateOrder`): "can't be after Oct 20, 2026".
  const dateOrder = page.look?.dateOrder;
  // The page's ask over the language's messages, each read through to them as it is said: a language whose words come in a
  // chunk of their own fills its table in place once they have come (words-chunks.ts).
  const messages: Messages = page.lowerLabels || dateOrder ? Object.assign(Object.create(options.messages ?? MESSAGES.en) as Messages, { lowerLabels: page.lowerLabels, dateOrder }) : (options.messages ?? MESSAGES.en);
  /** One of the form's sentences in the words the page names its records by (`records`), else as the language says it plainly. */
  const named = (noun: string | undefined, plain: string) => recordSentence(page.records, noun, plain, messages.locale);
  /** The app's functions the page's expressions call: a name none may call is refused now. */
  const table = functionTable(options.functions);
  /**
   * The answers of the app's functions that ask, for the record shown (`ExpressionEnv.answer`), by function and
   * values: each asked once, `asking` until it comes. Another record shown, they start again: an answer for the last
   * one is laid on none.
   */
  let answers = new Map<string, Answered | 'asking'>();
  /** Those on their way: a save waits for them. */
  const asking = new Set<Promise<unknown>>();
  /** Everything the form waits on (`track`): there before the form's first values are worked out, which may ask. */
  const pending = new Set<Promise<unknown>>();
  function answer(key: string, asked?: PromiseLike<unknown>): Answered | 'asking' | undefined {
    const kept = answers.get(key);
    if (kept !== undefined || !asked) return kept;
    const map = answers;
    map.set(key, 'asking');
    const land = (found: Answered) => {
      asking.delete(going);
      if (map !== answers || disposed) return;
      map.set(key, found);
      answered();
    };
    const going: Promise<void> = Promise.resolve(asked).then(
      (value) => land({ value: value === undefined ? null : value }),
      (error: unknown) => land({ value: null, failed: error instanceof Error ? error.message : String(error) })
    );
    asking.add(going);
    track(going);
    return 'asking';
  }
  /**
   * What every expression of the form is handed of the app's — and, on a page calling Fieldia's functions whose bodies
   * come in the functions part before it has come, the answers they wait for it with, as an app's function that asks.
   */
  const app: AppReads = table ? { functions: table, answer } : !functionsPart.loaded && callsPartFunctions(page) ? { answer } : {};
  const index = indexLayout(page.layout, table);
  /** Each field node's answer rules, read once. */
  const nodeRules = new Map<string, CompiledRule[]>();
  for (const node of index.values()) {
    const rules = (node.source as { validate?: FieldNode['validate'] }).validate;
    if (node.kind === 'field' && rules) nodeRules.set(node.id, compileRules(rules, table));
  }
  /** Tables of lines with rules of their own, by their field node: each read once. */
  const tables = new Map<string, { field: string; compiled: CompiledTable }>();
  for (const node of index.values()) {
    const source = node.source as FieldNode;
    if (node.kind !== 'field' || page.fields[source.field]?.type !== 'one2many') continue;
    if (source.cells || source.rowTones || source.rowBold !== undefined || source.rowButtons || source.lineDelete !== undefined) tables.set(node.id, { field: source.field, compiled: compileTable(source, table) });
  }
  /** Field nodes whose value takes a tone or bold, by id: each read once. */
  const fieldTones = new Map<string, ReturnType<typeof compileFieldTone>>();
  for (const node of index.values()) {
    const source = node.source as FieldNode;
    if (node.kind === 'field' && (source.tones || source.bold !== undefined)) fieldTones.set(node.id, compileFieldTone(source, table));
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
    if (own.placeholderWhen?.length) placeholders.set(id, { fixed: own.placeholder, when: own.placeholderWhen.map((item) => ({ text: item.text, holds: compileModifier(item.when, table) })) });
  };
  for (const node of index.values()) if (node.kind === 'field' && 'type' in node.source) placeholderOf(node.id, node.source as FieldNode);
  if (page.layout.type === 'sheet' && page.layout.title) placeholderOf('#title', page.layout.title);
  /** Whether any rule only warns: without one, there are never warnings to look for. */
  const warns = [...nodeRules.values()].some((rules) => rules.some((compiled) => compiled.rule.level === 'warning'));
  /** The field nodes with a rule that warns, in the page's order: the only ones a warning can come from. */
  const warningNodes = [...index.values()].filter((node) => node.kind === 'field' && nodeRules.get(node.id)?.some((compiled) => compiled.rule.level === 'warning'));
  const layoutSteps = page.layout.type === 'wizard' ? page.layout.children.map((step) => step.id) : [];
  /** The wizard's steps in the order shown: the page's, or the order drawn for this respondent (`state.order`). */
  let steps = layoutSteps;
  /**
   * The parts that join this form where its page or its source asks (`formJoins`: an offline outbox, the fields its link
   * fills, proof by a code, a payment, a survey's flow, a record's approvals, the record made live), each made as it
   * comes — at once where it has — and kept in their order: holes until then. While one has not come, a send waits for it
   * (`joining`); a draft laid before one came is laid on it as it does (`laid`).
   */
  const joins: FormJoin[] = [];
  const joinParts = formJoins(page, options).filter((part) => !outer || part.name !== 'approvals');
  let joining: Promise<unknown> | undefined;
  let laid: StoredDraft | null = null;
  /** A part that joins the form, made for it as it comes: a draft laid before laid on it, a record loaded before asked of it. */
  function joinMade(at: number) {
    return (part: JoinPart) => {
      if (disposed || joins[at]) return;
      const join = (joins[at] = part.join(inner));
      if (laid) join.lay?.(laid);
      // Its record loaded before it came: what it asks of a loaded record, asked now.
      if (loadedOnce) join.loaded?.();
    };
  }
  /** A part's side of this form, by its name, once it came — one that came since it first failed (its Retry) made now. */
  const joined = <K extends keyof FormJoins>(name: K): FormJoins[K] | null => {
    const at = joinParts.findIndex((part) => part.name === name);
    const came = at === -1 || joins[at] ? undefined : joinParts[at].loaded;
    if (came) joinMade(at)(came);
    return (joins[at] ?? null) as FormJoins[K] | null;
  };
  /** Whether a part that joins the form says so of a part of the page, or of a field. */
  const anyJoin = (says: (join: FormJoin) => boolean | undefined) => joins.some((join) => join && says(join));
  /**
   * Where a draft is kept: by whose it is — the signed-in person's, else this tab's (`ownerOf`) — the page and the record:
   * the next person on a shared device is never offered the last one's typing.
   */
  const storeKey = () => `fieldia:draft:${ownerOf(options.user)}:${page.id}:${state.recordId ?? 'new'}`;
  /** Today, on the clock of the page's time zone (the browser's own when it names none). */
  const today = () => dayIn(options.now?.() ?? new Date(), page.timeZone);
  /** Whether a field's own words — a label, a choice's — show a value or a brace escaped: found once, so a page with none checks as before. */
  const worded = READ_WORDS.test(JSON.stringify(page.fields));
  const clock = () => (options.now?.() ?? new Date()).getTime();
  /** What a page's bot check saw — its hidden box filled, the captcha's token — and when the page was shown or started again. */
  let bot = { honeypot: false, captcha: null as string | null, since: clock() };
  /** What the bot check saw as the answers go; none without one. */
  function botReport(): BotReport | undefined {
    const check = page.botCheck;
    if (!check) return undefined;
    const taken = Math.max(0, clock() - bot.since) / 1000;
    return { honeypot: check.honeypot !== false && bot.honeypot, tooFast: taken < (check.minSeconds ?? 3), seconds: Math.round(taken * 10) / 10, ...(check.captcha ? { captcha: bot.captcha } : {}) };
  }
  // The record's id and the person, as worked-out values read them: the id is the one asked for until the form has its state.
  let started = false;
  let editing = options.editing !== false;
  /** The record a line's form is of, as its conditions read it: worked out once. */
  const parentContext = options.parent ? recordContext(options.parent.values as Values, options.parent.fields, { recordId: options.parent.id ?? null, user: options.user, context: options.context }) : undefined;
  /** Whether the record is being edited now: not while a view locks it, nor when its source lets the person only read it. */
  const editingNow = () => editing && !(started && state.can?.edit === false);
  const about = () => ({ recordId: started ? state.recordId : (options.recordId ?? null), user: options.user, editing: editingNow(), context: options.context, parent: parentContext });
  const computed = compileComputed(page, today, about, app);
  /** Each value worked out from others — by the page, or by the app as the lines change — and what it waits for. */
  const workedOut = workedOutFrom(page, !!options.dataSource?.onchange && page.data.kind === 'record', !!options.parent, table);
  const setWhen = compileSetWhen(page, today, about, app);
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
      Object.assign(values, firstValues(page.fields, mapScope(values, page.fields, recordContext(values, page.fields, about), expressionEnv(values, page.fields, today, app))));
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
    return mapScope(values, lineFields, lineContext(values, lineFields, reading().context), { ...app, today }, { values: state.values as Values, fields: page.fields });
  }

  function tableOf(nodeId: string) {
    const table = tables.get(nodeId);
    if (table) return table;
    const node = index.get(nodeId);
    if (node?.kind !== 'field' || page.fields[node.field as string]?.type !== 'one2many') throw new Error(`"${nodeId}" is not a table of lines`);
    return null;
  }

  /** Each table's lines by their keys, for the array the table holds now: a line found at once, of 200 as of 3. */
  const linesByKey = new WeakMap<Line[], Map<string, Line>>();
  function lineOf(field: string, key: string): Line | undefined {
    const lines = state.values[field] as Line[] | null | undefined;
    if (!Array.isArray(lines)) return undefined;
    let byKey = linesByKey.get(lines);
    if (!byKey) linesByKey.set(lines, (byKey = new Map(lines.map((line) => [line.key, line]))));
    return byKey.get(key);
  }

  /**
   * What a table's line rules read of the record a line is on (`parent.state`), by its node: its fields' names — none
   * when they read only the line — or null where they read the record whole, or call a function that is not said by
   * what it reads alone (today(), an app's own): a line's state then is read again at every change, as before.
   */
  const lineReads = new Map<string, readonly string[] | null>();
  function lineReadsOf(nodeId: string, table: { compiled: CompiledTable }): readonly string[] | null {
    if (lineReads.has(nodeId)) return lineReads.get(nodeId) as readonly string[] | null;
    const conditions = table.compiled.lineConditions.filter((condition) => typeof condition.source === 'string');
    if (!conditions.every((condition) => steadyCalls(condition.calls))) return null;
    const names = parentReads(conditions.flatMap((condition) => condition.paths));
    lineReads.set(nodeId, names);
    return names;
  }
  /** Each line's state as its table's rules last had it, and what they read then: the line, and what of its record. */
  const lineStatesKept = new Map<string, { inputs: unknown[]; found: LineState }>();

  /**
   * A line of a table as its rules have it now; none, plain. The same object while neither the line nor what its rules
   * read of its record changed (0.35.1): 200 lines are not read again for a key in the record's header.
   */
  function lineStateOf(nodeId: string, key: string): LineState {
    const table = tableOf(nodeId);
    if (!table) return { tone: null, bold: false, cells: {}, buttons: {}, deletable: true };
    const line = lineOf(table.field, key);
    if (!line) throw new Error(`"${table.field}" has no line "${key}"`);
    const reads = full ? null : lineReadsOf(nodeId, table);
    const inputs = reads ? [line, ...reads.map(inputOf)] : null;
    const id = `${nodeId}\u0000${key}`;
    const kept = inputs && lineStatesKept.get(id);
    if (kept && inputs && sameReads(kept.inputs, inputs)) return kept.found;
    const def = lineField(table.field);
    const found = table.compiled.line(lineContext(line.values, def.fields as Record<string, LineField>, reading().context, line.id ?? null), { ...app, today }, userRoles);
    if (inputs) lineStatesKept.set(id, { inputs, found });
    return found;
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

  /** The values worked out from an app's function that asks with no answer yet, as the values shown last settled. */
  let askedNow: Map<string, AskedFor> = new Map();
  let baseline: Values = computed.apply(startingValues(), askedNow);
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
    sent: null,
    asked: Object.fromEntries(askedNow),
    takenOut: {},
    // Worked out once the form has its state, as the limits part comes (`limitsCode`).
    limits: null,
    resume: null,
    approval: null,
    order: null,
    timers: {},
    timeUp: [],
    loaded: true,
    loadProblem: null,
    unreadable: {},
  };
  started = true;
  /**
   * Each record shown — opened, loaded again, a new one — is a generation of
   * its own: a save's answer, or a call's, started in another is not laid
   * over it. What follows is kept for the generation shown, and starts again
   * with the next.
   */
  let generation = 0;
  /** Closed (`dispose`): a run still going stops quietly, as its dialog or page is gone — no other record replaced it. */
  let disposed = false;
  /** Counted at each reset (the person's Discard): a save on its way then lands as the record it stored. */
  let resets = 0;
  /**
   * THE test every late answer passes (`recordShown`): taken as it is asked for, true while the record it was asked
   * for is still the one shown, as it was. A save's answer, a call's, an onchange's, a name looked up, a line's
   * dialog, a record step's — none is laid on another record, nor over the values the person's Discard let go.
   */
  /** The data source with a member a record's page asks of it, and the page's model: refused where either is missing. */
  function recordSource<K extends 'duplicates' | 'notDuplicates' | 'markNotDuplicate' | 'merge' | 'load'>(member: K): [Required<Pick<DataSource, K>>, string] {
    const source = options.dataSource;
    if (page.data.kind !== 'record' || !source?.[member]) throw new Error(`The data source has no ${member}()`);
    return [source as Required<Pick<DataSource, K>>, page.data.model];
  }
  function shownNow(): () => boolean {
    const at = generation;
    const reset = resets;
    // A saved form placed in a record is the record's: another shown round it, its answers are laid nowhere either.
    const round = outer?.recordShown();
    return () => !disposed && at === generation && reset === resets && (!round || round());
  }
  /**
   * The person's claims on the record: the fields whose last write was theirs. A step's, a rule's or the app's
   * write of the whole field takes one over; a write that works the person's change out (the source's onchange, the
   * page's `change` steps it sets off) keeps it.
   */
  const personal = new Set<string>();
  /**
   * Of a table the person did not write whole: the keys of the lines they changed, added or took away. A line a
   * step adds is none of theirs, and leaves theirs as they are.
   */
  const personalLines = new Map<string, Set<string>>();
  /** Fields where a file the person picked landed from the store: at risk until a save sends it, a first save or not. */
  const filed = new Set<string>();
  /** The record as the last finished save left it — what it sent and what came back; a page of answers: what it sent. Null before one. */
  let sentAs: Readonly<Values> | null = null;
  /**
   * The records being deleted, by the person's choice, each by its generation: a way out of one of them lets their
   * work in it go, unasked. Another record shown meanwhile is asked about as any.
   */
  const deleting = new Map<number, number>();
  const deletingShown = () => (deleting.get(generation) ?? 0) > 0;
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
    // Through the parts that join the form: a photo taken without signal kept as its bytes, on a page with an outbox.
    through,
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
  /** The tables' columns whose choices are the app's: none on most pages, and then nothing below is followed. */
  const listed = listedColumns(page.fields);
  /** Whether the values set now are a change someone made (`writeValues`), after which a line's choice no longer offered is cleared. */
  let edit = false;
  /**
   * The one kit the parts that work inside the form are given of it (joins.ts): the parts that join it, its limits, the
   * undo part's press.
   */
  const inner: FormInner = {
    get form() {
      return form;
    },
    page,
    fields,
    options,
    messages,
    scheduler,
    state: () => state,
    set,
    reading,
    sending: () => (page.data.kind === 'responses' ? answersSent() : sentValues()),
    baseline: () => baseline,
    same: (name, one, other) => sameValue(fields[name], one, other),
    conflictOf,
    store,
    settled: savesSettled,
    track,
    shownNow,
    generation: () => generation,
    emit,
    replaced,
    clock,
    started: () => started,
    listened: () => listeners.size > 0,
    disposed: () => disposed,
    // A clock started is kept at once where drafts are kept here: a reload a moment after Start finds it.
    keep: () => (onServer() ? scheduleDraft() : keepHere(draftNow())),
    order: (list) => void (steps = list ?? layoutSteps),
    refuse(name, message) {
      // Said until the field changes from what it holds, as a refused save's words are.
      serverErrors[name] = { message, value: JSON.stringify(state.values[name] ?? null) };
      set({ errors: { ...state.errors, [name]: message } });
    },
    reload: () => load(true),
  };
  /** The person's changes to the record shown, as made (history.ts); and whether one is being taken back or made again now. */
  let noted: Noted[] = [];
  let replaying = false;
  /**
   * A person's change written to `field` (on `line`), noted for Undo with what it held `before`: typing on joins it
   * (`joins`). The undo part takes them as they come, asked for with the first: in by the time the person presses Ctrl+Z.
   */
  const noteChange = (field: string, line: string | undefined, before: Value | undefined, joins: boolean) => {
    if (replaying) return;
    noted.push([field, line, before ?? null, state.values[field] ?? null, joins]);
    const part = pressUndoPart.loaded;
    if (part) part.takeNoted(noted, inner.same);
    // Kept while it comes; where it cannot, the oldest let go.
    else if (noted.length > 500) noted.shift();
    else pressUndoPart.load().catch(() => undefined);
  };
  /**
   * Undo (`back`) or Redo, once the undo part has come: the change taken, written as the person's own change back —
   * the page's `change` steps and the source's onchange run as for any — once its field still holds what the change
   * left and may be changed.
   */
  function replay(back: boolean): HistoryStep | null {
    const step = editing ? pressUndoPart.loaded?.takeStep(noted, inner.same, back, (one, left) => !form.fieldReadonly(one.field) && sameValue(fields[one.field], state.values[one.field], left)) : null;
    if (!step) return null;
    const { value, ...taken } = step;
    replaying = true;
    try {
      writeValues({ ...(state.values as Values), [taken.field]: structuredCopy(value) });
      afterEdit(taken.field);
      changed(taken.field, 'person', taken.line === undefined ? {} : { line: taken.line });
    } finally {
      replaying = false;
    }
    return taken;
  }

  function set(patch: Partial<FormState>) {
    const was = state.values;
    const choicesWas = state.choices;
    const shown = state.errors;
    const edited = edit;
    edit = false;
    const stepWas = state.step;
    state = { ...state, ...patch };
    // A line's choices go with their line.
    if (state.values !== was) state = { ...state, choices: choicesNow(state.choices) };
    // What was said taken out is said while it is true: an option offered again, or picked again, is said no more.
    if ((state.values !== was || state.choices !== choicesWas) && Object.keys(state.takenOut).length) {
      const takenOut = takenOutTrue();
      if (takenOut !== state.takenOut) state = { ...state, takenOut };
    }
    // What waits for an app's answer, as the values shown last settled.
    if (patch.values !== undefined && patch.asked === undefined && !sameAsked(state.asked, askedNow)) state = { ...state, asked: Object.fromEntries(askedNow) };
    // The person's changes the last save did not send, worked out again from the values as they are now, and from the
    // text they left that does not read.
    if (patch.unsent === undefined && (patch.values !== undefined || patch.unread !== undefined)) {
      const unsent = unsentNow();
      if (!sameList(unsent, state.unsent)) state = { ...state, unsent };
    }
    // The problems found inside a saved form are shown on it, beside its own fields.
    if (state.errors !== shown) for (const part of attached.values()) part.inner.show(inside(state.errors, part.name));
    for (const listener of [...listeners]) listener(state);
    // What the parts that join the form follow of it: the record shown, watched for changes made elsewhere and for who
    // else has it open, asked again as that changes.
    for (const join of joins) join?.changed?.();
    // Choices that change with a value that just changed are asked for again.
    if (state.values !== was) {
      // After someone's change, a choice its new choices do not offer is taken out and said, as a line's is.
      for (const name in state.choices) if (!name.includes('.') && fromList(name)?.dependsOn?.some((other) => was[other] !== state.values[other])) loadChoices(name, edited);
      for (const name in state.definitions) if (fromRecord(name).dependsOn?.some((other) => was[other] !== state.values[other])) loadDefinitions(name);
      if (listed.length) followLines(was, edited);
    }
    if (showing && state.step !== told) tellStep(entering);
    // A wizard's step entered with answers typed is kept in the draft, so it opens there again.
    if (state.step !== stepWas && showing && state.dirty.length) scheduleDraft();
  }

  function emit<E extends keyof FormEvents>(event: E, payload: FormEvents[E]) {
    const heard = events.get(event);
    if (heard) for (const listener of [...heard]) (listener as (event: FormEvents[E]) => void)(payload);
  }

  /**
   * A field written: told to the app, and — a person's change — the page's `change` steps for it run. `claim` says
   * what of the person's it touches: `line`, the key of the one line of a table the person changed; `keep`, a write
   * that leaves the person's claims as they are (a line a step adds, a write working their change out).
   */
  function changed(field: string, by: ChangeBy, claim: Claim = {}) {
    noteOrigin(field, by, claim);
    emit('change', { field, value: state.values[field], values: state.values, by });
    const list = page.on?.change?.[field];
    if (by === 'person' && list) void track(moment(`on.change.${field}`, list, [], true));
  }

  /** Another record is shown: nothing of the last one's is the person's work any more, and its files on their way stop. */
  function newGeneration() {
    generation++;
    noted = [];
    // Another record's lines ask the source anew.
    lineAsks = new Map();
    answers = new Map();
    personal.clear();
    personalLines.clear();
    filed.clear();
    compared.clear();
    sentAs = null;
    clearFiles();
  }

  /** Whether a field holds a file the store holds that no save sent: its own, or one in a saved form placed here under its name. */
  const filedIn = (name: string) => filed.has(name) || [...attached.values()].some((part) => part.name === name && part.inner.files.filed());

  /**
   * The person's work no save took, by field, in the page's order: each of
   * their changes that differs from the record as the last save left it —
   * a field they wrote, or a line of a table they changed — and text they
   * left in a box of it that does not read (`unread`), which no save can
   * send; before a first save, only a file the store holds.
   */
  function unsentNow(): string[] {
    const typed = sentAs ? unreadFields() : null;
    if (!personal.size && !personalLines.size && !typed?.size) return [];
    const out: string[] = [];
    for (const name of Object.keys(fields)) {
      // Typed and left unread since a save: the person's, as a change is — a value changed to "12" is, so is "12a".
      if (typed?.has(name)) {
        out.push(name);
        continue;
      }
      const lines = personalLines.get(name);
      if (!personal.has(name) && !lines) continue;
      const from = sentAs ?? (filedIn(name) ? baseline : null);
      if (!from) continue;
      if (lines ? linesDiffer(name, lines, state.values[name], from[name]) : differs(name, state.values[name], from[name])) out.push(name);
    }
    return out;
  }

  /** The fields with text left unread in a box of theirs: a field's, a line's cell's, a property's. */
  function unreadFields(): Set<string> {
    const out = new Set<string>();
    for (const path of Object.keys(state.unread ?? {})) out.add(path.split('.')[0]);
    return out;
  }

  function differs(name: string, value: unknown, sent: unknown): boolean {
    const known = compared.get(name);
    if (known && known.value === value && known.sent === sent) return known.differs;
    const verdict = value !== sent && !sameValue(fields[name], value, sent);
    compared.set(name, { value, sent, differs: verdict });
    return verdict;
  }

  /** Whether any of these lines of a table differs from the table as sent: changed, added, or taken away. */
  function linesDiffer(name: string, keys: ReadonlySet<string>, value: unknown, sent: unknown): boolean {
    const def = fields[name] as Extract<Field, { type: 'one2many' }>;
    const find = (lines: unknown, key: string) => ((lines as Line[] | null) ?? []).find((line) => line.key === key);
    for (const key of keys) {
      const now = find(value, key);
      const was = find(sent, key);
      if (!now && !was) continue;
      if (!now || !was) return true;
      if (now.values === was.values) continue;
      for (const sub of new Set([...Object.keys(now.values), ...Object.keys(was.values)])) {
        if (!sameValue(def.fields[sub] as Field | undefined, now.values[sub], was.values[sub])) return true;
      }
    }
    return false;
  }

  /** `unsent` as it is now, told when it changed. */
  function refreshUnsent() {
    const unsent = unsentNow();
    if (!sameList(unsent, state.unsent)) set({ unsent });
  }

  /**
   * A field written, and by whom: the person's change is theirs — the field, or the line of a table they changed —
   * until a step, a rule or the app writes the whole field in its place. A write that leaves their change where it
   * is (`keep`: a line a step adds, a `change` step working out what they typed) leaves it theirs.
   */
  function noteOrigin(field: string, by: ChangeBy, claim: Claim) {
    if (by === 'person') {
      if (claim.line === undefined) {
        personal.add(field);
        personalLines.delete(field);
      } else if (!personal.has(field)) {
        const keys = personalLines.get(field) ?? new Set<string>();
        keys.add(claim.line);
        personalLines.set(field, keys);
      }
    } else if (!claim.keep) {
      personal.delete(field);
      personalLines.delete(field);
    }
    refreshUnsent();
  }

  /** A wizard step entered: told to the app, and its `show` steps run. */
  function tellStep(chain: readonly string[]) {
    const step = state.step;
    if (step === told || step === null) return;
    told = step;
    emit('step', { step });
    // A step with a time limit: its clock starts as it is first entered.
    for (const join of joins) join?.entered?.(step);
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

  /** The app's list a choice's options come from; none for one whose options are its own or carried. */
  const fromList = (name: string) => optionsList((page.fields[name] as Extract<Field, { type: 'selection' }> | undefined)?.optionsFrom);

  // ---- a table line's choices from the app's lists (line-choices.ts) ----------------------------------------------

  /** A line's choices asked of the source, by what they are asked by (`askKey`), for the record shown: lines alike share one. */
  let lineAsks = new Map<string, Promise<Option[]>>();
  /** What each line cell's choices were last asked by. */
  const askedBy = new Map<string, string>();
  const listedAt = (table: string, column: string) => listed.find((one) => one.table === table && one.column === column);
  const lineAt = (table: string, key: string) => ((state.values[table] as Line[] | null) ?? []).find((line) => line.key === key);

  /** A line's choices from the source: asked once for every line whose columns they change with hold the same values. */
  function askLine(one: ListedColumn, values: Values): Promise<Option[]> {
    const key = askKey(one, values, state.values as Values);
    const asks = lineAsks;
    let ask = asks.get(key);
    if (ask) return ask;
    const source = options.dataSource;
    const request = { list: one.list, values: structuredCopy(values), parent: structuredCopy(state.values as Values) };
    ask = source?.options ? source.options(request) : Promise.reject(new Error(`No list "${one.list}"`));
    asks.set(key, ask);
    // One that failed is asked again next time.
    ask.catch(() => asks.get(key) === ask && asks.delete(key));
    return ask;
  }

  /** The choices as the values are now: a line's go with their line. */
  function choicesNow(choices: Readonly<Record<string, Choices>>): Readonly<Record<string, Choices>> {
    let kept: Record<string, Choices> | null = null;
    for (const path of Object.keys(choices)) {
      if (valueAt(state.values, path) !== gone) continue;
      kept ??= { ...choices };
      delete kept[path];
      askedBy.delete(path);
    }
    return kept ?? choices;
  }

  /**
   * Values changed: each line's choices loaded are asked again where what they change with changed on their line (a
   * record shown with the same line, Discard, a draft); after a change someone made (`edited`), judged too — and so is a
   * line holding a choice whose choices nobody asked for yet, so none is kept that its columns no longer offer.
   */
  function followLines(was: Readonly<Values>, edited: boolean) {
    // Choices that change with nothing are asked once.
    for (const one of listed.filter((column) => column.own.length || column.parent.length)) {
      for (const line of (state.values[one.table] as Line[] | null) ?? []) {
        const path = `${one.table}.${line.key}.${one.column}`;
        const by = askKey(one, line.values, state.values as Values);
        const old = !(path in state.choices) && edited && !isEmpty(one.def, line.values[one.column]) && ((was[one.table] as Line[] | null) ?? []).find((l) => l.key === line.key);
        if (path in state.choices ? by !== askedBy.get(path) : old && by !== askKey(one, old.values, was)) loadChoices(path, edited);
      }
    }
  }

  /**
   * Load a field's choices, or a line cell's by its path (`table.key.column`). `judge`, after a change someone made of
   * what they change with: a choice they no longer offer is taken out and said, on the record they were asked for,
   * while a line still asks by the same.
   */
  function loadChoices(name: string, judge = false) {
    const cell = cellOf(name);
    const one = cell && listedAt(cell.table, cell.column);
    const line = cell && lineAt(cell.table, cell.key);
    if (cell && (!one || !line)) throw new Error(`"${name}" is no line's choice from the app's lists`);
    const from = one ?? fromList(name);
    if (!from) throw new Error(`"${name}" takes no choices from the app's lists`);
    const { list } = from;
    const load = (choiceLoads[name] = (choiceLoads[name] ?? 0) + 1);
    const by = one && line ? askKey(one, line.values, state.values as Values) : '';
    if (cell) askedBy.set(name, by);
    // A line's answer lands while its line is there.
    const put = (choices: Choices) => load === choiceLoads[name] && (!cell || name in state.choices) && set({ choices: { ...state.choices, [name]: choices } });
    // What was shown stays while the next ones load, so the list does not flash empty.
    const shown = state.choices[name]?.options ?? null;
    const loading = { options: shown, loading: true };
    // A line's cell asks first as it is drawn, inside its table's drawing: told with the next change, never drawn again
    // inside it. Asked again, as a column they change with changes, it says it is loading at once.
    if (cell && !(name in state.choices)) state = { ...state, choices: { ...state.choices, [name]: loading } };
    else set({ choices: { ...state.choices, [name]: loading } });
    const source = options.dataSource;
    const onRecord = shownNow();
    const ask =
      one && line
        ? askLine(one, line.values)
        : source?.options
          ? // A line's own form (a dialog) asks as its line does: the record it is on as parent.
            source.options({ list, values: structuredCopy(state.values as Values), ...(options.parent ? { parent: structuredCopy(options.parent.values as Values) } : {}) })
          : Promise.reject(new Error(`No list "${list}"`));
    void track(
      ask.then(
        (loaded) => {
          if (load !== choiceLoads[name]) return;
          const now = cell && lineAt(cell.table, cell.key);
          const held = !cell ? state.values[name] : now && askKey(one as ListedColumn, now.values, state.values as Values) === by ? now.values[cell.column] : null;
          const lost = judge && onRecord() ? notOffered(one?.def ?? (page.fields[name] as LineField), held, loaded) : [];
          // Taken out and said: the words stay until its value changes again.
          if (lost.length) clearChoices(cell ? cell.table : name, cell, lost, namedChoices(lost, shown, loaded));
          put({ options: loaded });
          // Options of the app's list with places, never counted yet: how many took each is asked.
          if (!cell && loaded.some((option) => option.seats !== undefined) && (!limitsKit || limitsKit.uncounted(name))) void track(limitsCode().then((kit) => kit?.ask()));
        },
        (error) => put({ options: shown, error: (error as Error).message ?? String(error) })
      )
    );
  }

  /** Choices by their labels, as the choices shown before or now name them. */
  const namedChoices = (lost: readonly Value[], shown: readonly Option[] | null, loaded: readonly Option[]) =>
    lost.map((value) => [...(shown ?? []), ...loaded].find((option) => option.value === value)?.label ?? String(value));

  /**
   * A choice — a field's, or a line's (`key`) column — less what its choices no longer offer, worked out from someone's
   * change, and said as every choice taken out is (`FormState.takenOut`): their claim stays.
   */
  function clearChoices(field: string, line: { key: string; column: string } | null, lost: readonly Value[], labels: string[]) {
    const without = (value: Value | undefined) => (Array.isArray(value) ? value.filter((v) => !lost.includes(v as Value)) : null) as Value;
    const values = state.values as Values;
    const written = line
      ? ((values[field] as Line[] | null) ?? []).map((l) => (l.key === line.key ? { ...l, values: { ...l.values, [line.column]: without(l.values[line.column]) } } : l))
      : without(values[field]);
    const path = line ? `${field}.${line.key}.${line.column}` : field;
    takenOutOf.set(path, lost.map((value, i) => ({ value, label: labels[i] })));
    writeValues({ ...values, [field]: written }, {}, false, { [path]: takenOutWords(labels) });
    afterEdit(field);
    changed(field, 'step', { keep: true });
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

  /**
   * A field as its value is checked: a list's choices are those loaded, and until they are, any choice may be one; its
   * label and its choices' words with their `{field}`s filled in, as the page shows them.
   */
  function checked(name: string): Field {
    const def = checkedAsLoaded(name);
    return worded ? shownWords(def) : def;
  }

  /** A field whose words show values — its label, its choices' — with them filled in now, else as it is. */
  function shownWords(def: Field): Field {
    const options = def.type === 'selection' && def.options.some((option) => option.label.includes('{')) ? def.options.map((option) => ({ ...option, label: wordsNow(option.label) })) : null;
    if (!def.label.includes('{') && !options) return def;
    return { ...def, label: wordsNow(def.label), ...(options ? { options } : {}) } as Field;
  }

  /** A field as its value is checked, its choices those loaded from the app's list. */
  function checkedAsLoaded(name: string): Field {
    const def = page.fields[name];
    const loaded = state.choices[name]?.options;
    if (def.type === 'properties' && def.definitionsFrom) {
      // The definitions the linked record keeps, once loaded: each property checked as one of its kind.
      const definitions = state.definitions[name]?.definitions;
      return definitions ? { ...def, definitions } : def;
    }
    // Carried from an earlier question: any of its options, and its own after them, is one of this one's.
    if (def.type === 'selection' && optionsField(def.optionsFrom)) return { ...def, options: everyOption(name), optionsFrom: undefined };
    return def.type === 'selection' && optionsList(def.optionsFrom) && loaded ? { ...def, options: loaded, optionsFrom: undefined } : def;
  }

  /** Every option a choice may hold, whatever its conditions: its own, its list's once loaded, or those of the question it carries them from and its own. */
  function everyOption(name: string, seen: readonly string[] = []): Option[] {
    const def = page.fields[name];
    if (def?.type !== 'selection') return [];
    const carried = optionsField(def.optionsFrom);
    if (carried && !seen.includes(carried.field)) return [...everyOption(carried.field, [...seen, name]).filter((o) => !o.exclusive), ...def.options];
    return [...((fromList(name) && state.choices[name]?.options) || def.options)];
  }

  // ---- options by condition, and carried from an earlier question (the options part: option-rules.ts) -----------

  /** The options' rules made for this form from the options part, once it came: none before, nor on a page with none. */
  let optionKit: OptionRules | null = null;
  /**
   * The options' rules, made from their part as it comes — at once where it has come — or null on a page with none, or
   * where the part could not come. Values written before they came are judged as they come: a chosen option the values
   * no longer offer, since the form was made, is taken out and said.
   */
  function optionsCode(): Promise<OptionRules | null> {
    if (optionKit || !hasOptionRules(page)) return Promise.resolve(optionKit);
    if (optionRulesPart.loaded) return Promise.resolve(optionsMade(optionRulesPart.loaded));
    const from = state.values;
    return optionRulesPart.load().then(
      (part) => {
        const kit = optionsMade(part);
        if (kit && !disposed && state.values !== from) writeValues(state.values as Values, {}, false, {}, from);
        return kit;
      },
      () => null
    );
  }
  function optionsMade(part: OptionRulesPart): OptionRules | null {
    optionKit ??= part.optionRules({ page, table, app, state: () => state, today, about, reading, settle, words: (labels) => takenOutWords(labels) });
    return optionKit;
  }
  if (hasOptionRules(page)) void track(optionsCode());
  // A text in several languages is checked by the languages part: asked for at once, a save waiting for it.
  const languagesCode = () => formLanguagesPart.load().then(() => undefined, () => undefined);
  if (hasLanguages(page)) void track(languagesCode());

  /** A table line's choice's options as they are offered on that line: its list's once loaded, or its own, by their conditions once they came. */
  function lineOffered(lines: string, line: Line, column: string, record: Record<string, unknown>): Option[] {
    if (optionKit) return optionKit.lineOffered(lines, line, column, record);
    const sub = (page.fields[lines] as Extract<Field, { type: 'one2many' }>).fields[column] as Extract<LineField, { type: 'selection' }>;
    return [...((optionsList(sub.optionsFrom) && state.choices[`${lines}.${line.key}.${column}`]?.options) || sub.options)];
  }

  /** Options in words, as a sentence joins them: "Garden and Pool". */
  function listedLabels(labels: string[]): string {
    try {
      return intlFormat('ListFormat', messages.locale, { type: 'conjunction' }).format(labels);
    } catch {
      return labels.join(', ');
    }
  }

  /**
   * What is said of options taken out of an answer, by their labels — an answer they show (`{branch}`) as it reads now:
   * "Garden is no longer offered, so it was taken out".
   */
  const takenOutWords = (labels: string[]) =>
    fillMessage(messages, labels.length > 1 ? messages.notOfferedNowMany : messages.notOfferedNow, { name: listedLabels(labels.map((label) => (label.includes('{') ? wordsNow(label) : label))) });

  /** The options each note of `takenOut` names, by its path: a note goes once none of them is still out. */
  const takenOutOf = new Map<string, readonly TakenOption[]>();
  /**
   * The notes of options taken out (`FormState.takenOut`) that are still true for the values and the choices now: one
   * whose options are all offered again — the type that offers them picked again, the treatment ticked again above, the
   * app's list asked again offering it — or picked again goes; one with some still out names those. A list being asked
   * again says nothing yet. The same notes, when none changed.
   */
  function takenOutTrue(): Readonly<Record<string, string>> {
    let kept: Record<string, string> | null = null;
    for (const path of Object.keys(state.takenOut)) {
      const options = takenOutOf.get(path);
      const held = valueAt(state.values, path);
      if (!options || held === gone || state.choices[path]?.loading) continue;
      const offered = form.offered(path);
      if (!offered) continue;
      const chosen: unknown[] = [held].flat();
      const left = options.filter((option) => !chosen.includes(option.value) && !offered.some((one) => one.value === option.value));
      if (left.length === options.length) continue;
      kept ??= { ...state.takenOut };
      if (left.length) {
        takenOutOf.set(path, left);
        kept[path] = takenOutWords(left.map((option) => option.label));
      } else delete kept[path];
    }
    return kept ?? state.takenOut;
  }

  /** A line's field as its value is checked: its choices from the app's list, those loaded for its line. */
  function checkedLine(path: string, def: LineField): LineField {
    const loaded = def.type === 'selection' && optionsList(def.optionsFrom) ? state.choices[path]?.options : null;
    return loaded ? ({ ...def, options: loaded, optionsFrom: undefined } as LineField) : def;
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

  /**
   * Words with each `{field}` showing the value `values` hold (the form's now, unless given), as the app's viewer
   * writes it (`valueWords`), else plainly; `other` answers a name first (an ending's `{id}`). A name that is no field
   * shows nothing.
   */
  function wordsNow(text: string, values: Readonly<Values> = state.values, other?: (name: string) => string | undefined): string {
    if (!text.includes('{')) return text;
    return fillValues(text, (name) => {
      const own = other?.(name);
      if (own !== undefined) return own;
      const def = page.fields[name];
      if (!def) return '';
      return options.valueWords ? options.valueWords(def, values[name], values) : wordsOfValue(def, values[name]);
    });
  }

  /**
   * Each ending's condition, read once — with Fieldia's functions and the app's own, as every condition of the page —
   * null for the default (no `when`), and one that does not read never holds.
   */
  const endingConditions = (page.endings ?? []).map((ending) => {
    if (ending.when === undefined) return null;
    try {
      return compileModifier(ending.when, table);
    } catch {
      return compileModifier(false);
    }
  });

  /** The ending for the response sent: the first whose condition holds on it — its answers, what the source added, its id — else the default. */
  function endingNow(): PageEnding | null {
    const sent = state.sent;
    const endings = page.endings;
    if (!sent || !endings?.length) return null;
    const values = sent.values as Values;
    const context = recordContext(values, page.fields, { ...about(), recordId: sent.id });
    // An app's function that asks its server is asked as any condition asks it: it holds once answered.
    const env = expressionEnv(values, page.fields, today, app);
    const at = endingConditions.findIndex((condition) => !condition || condition.evaluate(context, env));
    return at === -1 ? null : endings[at];
  }

  /** The values as expressions read them, and what else they read: the record's id, the person, the lines' rows, today. */
  function reading(): { context: Record<string, unknown>; env: ExpressionEnv } {
    if (contextCache?.values !== state.values || contextCache.recordId !== state.recordId || contextCache.editing !== editingNow()) {
      const values = state.values as Values;
      const context = recordContext(values, page.fields, about());
      contextCache = { values, recordId: state.recordId, editing: editingNow(), context, env: expressionEnv(values, page.fields, today, app) };
    }
    return contextCache;
  }

  const context = () => reading().context;

  /**
   * Whether this form works each change out in full (`recomputeInFull`, as it was made): every condition read again,
   * every field's problem found again — the oracle the quick way below is held to.
   */
  const full = recomputeInFull();
  /** What a condition reads of the built-ins that stay the same for the form's life: the person, the app's context, a line's record. */
  const STILL: unique symbol = Symbol('still');
  /**
   * What a condition reads by a name it reads, as the record holds it now: a field's value — the same object while it
   * is unchanged, as every write keeps the values it does not touch — the record's id, whether it is edited; the person,
   * the app's context and a line's record are the form's for its life.
   */
  function inputOf(name: string): unknown {
    if (name in fields) return (state.values as Values)[name];
    if (name === 'id') return state.recordId;
    if (name === 'editing') return editingNow();
    return STILL;
  }
  /** What each of the record's conditions read when it was last read, and what it said. */
  const heldBy = new Map<CompiledModifier, { inputs: unknown[]; holds: boolean }>();
  /**
   * Whether a condition of the record holds now: read again only once a value it reads changed (`inputOf`). One that
   * calls today(), `age`, an app's function — or the functions part's before it has come — is read every time.
   */
  function holds(condition: CompiledModifier, read: () => { context: Record<string, unknown>; env: ExpressionEnv }): boolean {
    // `true`, `false` or none: it says the same whatever it is handed.
    if (typeof condition.source !== 'string' && !condition.fields.length) return condition.evaluate({}, {});
    if (full || !steadyCalls(condition.calls)) {
      workCounts.conditions++;
      const { context: ctx, env } = read();
      return condition.evaluate(ctx, env);
    }
    const kept = heldBy.get(condition);
    const names = condition.fields;
    if (kept) {
      let same = true;
      for (let i = 0; i < names.length; i++) if (kept.inputs[i] !== inputOf(names[i])) {
        same = false;
        break;
      }
      if (same) return kept.holds;
    }
    workCounts.conditions++;
    const { context: ctx, env } = read();
    const now = condition.evaluate(ctx, env);
    heldBy.set(condition, { inputs: names.map(inputOf), holds: now });
    return now;
  }

  function fieldDef(name: string): Field {
    const def = fields[name];
    if (!def) throw new Error(`The page has no field "${name}"`);
    return def;
  }

  /** Each field's last comparison with the record as loaded: the same value and the same baseline are not compared again. */
  const dirtyKept = new Map<string, { value: unknown; base: unknown; dirty: boolean }>();
  /** Each value's words as JSON, written once for each object: a line unchanged since is never written out again. */
  const jsonKept = new WeakMap<object, string>();
  const jsonOf = (value: unknown): string => {
    if (value === null || typeof value !== 'object') return JSON.stringify(value ?? null);
    let json = jsonKept.get(value);
    if (json === undefined) jsonKept.set(value, (json = JSON.stringify(value)));
    return json;
  };
  /**
   * Whether two values write out the same JSON — a table's lines one by one, each line's words written once for each line
   * object (0.35.1): a key in a line of 200 compares the one line it changed, not the 200 written out whole twice.
   */
  const sameJson = (a: unknown, b: unknown): boolean =>
    a === b || (Array.isArray(a) && Array.isArray(b) ? a.length === b.length && a.every((one, at) => one === b[at] || jsonOf(one ?? null) === jsonOf(b[at] ?? null)) : jsonOf(a) === jsonOf(b));
  function dirtyFields(values: Values): string[] {
    return Object.keys(fields).filter((name) => {
      const value = values[name];
      const base = baseline[name];
      const kept = full ? undefined : dirtyKept.get(name);
      if (kept && kept.value === value && kept.base === base) return kept.dirty;
      const dirty = full ? JSON.stringify(value ?? null) !== JSON.stringify(base ?? null) : !sameJson(value ?? null, base ?? null);
      dirtyKept.set(name, { value, base, dirty });
      return dirty;
    });
  }

  /**
   * What `work` finds, kept by `key` in `store` with what it was found from (`inputs`, compared one by one): found again
   * only once one of them changed. Null inputs: found every time.
   */
  function remembered<T>(store: Map<string, { inputs: unknown[]; found: T }>, key: string, inputs: unknown[] | null, work: () => T): T {
    const kept = inputs && store.get(key);
    if (kept && inputs && sameReads(kept.inputs, inputs)) return kept.found;
    workCounts.checks++;
    const found = work();
    if (inputs) store.set(key, { inputs, found });
    return found;
  }

  /** Each part's state as last found: given again, the same object, while nothing of it changed. */
  const nodeStates = new Map<string, NodeState>();
  /** What each part's state was found to read (`nodeReads`), once asked. */
  const readsOf = new Map<string, readonly string[] | null>();
  function nodeReadsOf(id: string): readonly string[] | null {
    const node = index.get(id);
    if (!node) throw new Error(`The page has no element "${id}"`);
    // A part that joins the form may hide or lock any part: a survey's draw, its time limits, a record's approvals.
    if (joinParts.some((part) => part.name === 'surveyflow' || part.name === 'approvals')) return null;
    const names = new Set<string>();
    const add = (condition: CompiledModifier | undefined): boolean => {
      if (!condition || typeof condition.source !== 'string') return true;
      if (!steadyCalls(condition.calls)) return false;
      for (const name of condition.fields) names.add(name);
      return true;
    };
    for (let at: IndexedNode | undefined = node; at; at = at.parent ? index.get(at.parent) : undefined) {
      if (!add(at.invisible) || !add(at.readonly)) return null;
    }
    if (!add(node.required) || !add(node.pressed)) return null;
    if (node.kind === 'field') {
      const source = node.source as Partial<FieldNode>;
      if (node.field !== undefined && workedOut.has(node.field)) return null;
      const read = (condition: Modifier | undefined) => add(compileModifier(condition, table));
      if (![...(source.tones ?? []).map((tone) => tone.when), source.bold].every(read)) return null;
      if (!(placeholders.get(id)?.when ?? []).every((item) => add(item.holds))) return null;
      for (const name of signingFields(page)) names.add(name);
    }
    return [...names];
  }
  function nodeState(id: string): NodeState {
    const node = index.get(id);
    if (!node) throw new Error(`The page has no element "${id}"`);
    // The record as conditions read it, made only once one is read: a part whose conditions read nothing changed reads none.
    const read = reading;
    const hidden = (at: IndexedNode | undefined) => (at ? anyJoin((join) => join.hides?.(at.id)) || !rolesAllow(at.roles, userRoles) || holds(at.invisible, read) : false);
    let invisible = hidden(node);
    for (let parent = node.parent; !invisible && parent; parent = index.get(parent)?.parent ?? null) {
      invisible = hidden(index.get(parent));
    }
    // A section read-only right now makes everything inside it read-only too; a page's, or a step's, time run out too.
    let readonly = holds(node.readonly, read) || anyJoin((join) => join.locks?.(id));
    for (let parent = node.parent; !readonly && parent; parent = index.get(parent)?.parent ?? null) {
      const above = index.get(parent);
      readonly = above ? holds(above.readonly, read) : false;
    }
    const def = node.field ? page.fields[node.field] : undefined;
    // What the record's source lets this person do: a field hidden from them or locked, a button that would do what they may not.
    const can = state.can;
    if (can) {
      if ((node.field !== undefined && can.hiddenFields?.includes(node.field)) || node.does?.some((right) => can[right] === false)) invisible = true;
      if ((node.kind === 'field' || node.kind === 'form') && (can.edit === false || (node.field !== undefined && can.readonlyFields?.includes(node.field) === true))) readonly = true;
    }
    // An answer a signature kept signed: locked until the signature is taken away and signed again.
    const answer = answerOf(node);
    if (answer !== undefined && signedNow().has(answer)) readonly = true;
    // A record waiting for approval: locked but for the fields the page leaves open (the approvals part).
    if (answer !== undefined && anyJoin((join) => join.locksField?.(answer))) readonly = true;
    readonly ||= def !== undefined && lockedField(def);
    const required = holds(node.required, read) || def?.required === true;
    const pressed = node.pressed ? holds(node.pressed, read) : undefined;
    const kept = full ? undefined : nodeStates.get(id);
    if (kept && kept.invisible === invisible && kept.readonly === readonly && kept.required === required && kept.pressed === pressed) return kept;
    const now: NodeState = { invisible, readonly, required, ...(node.pressed ? { pressed } : {}) };
    if (!full) nodeStates.set(id, now);
    return now;
  }

  /** The answer a field node shows, by its field — or a saved form placed on the page, by the name its answers are kept under. */
  function answerOf(node: IndexedNode): string | undefined {
    return node.kind === 'field' ? node.field : node.kind === 'form' ? (node.source as FormNode).name : undefined;
  }

  /** The answers signatures signed, as the values hold them now: worked out once for each change of the values. */
  let signedCache: { values: Values; answers: SignedBy } | null = null;
  function signedNow(): SignedBy {
    if (signedCache?.values !== state.values) signedCache = { values: state.values as Values, answers: signedBy(page, state.values) };
    return signedCache.answers;
  }

  /**
   * The field nodes a field's problems are found by, in the page's order: those showing it, and the ranges whose end it
   * is (`rangeEnd`); and the saved forms placed on the page. Read once.
   */
  const checkedBy = new Map<string, IndexedNode[]>();
  const formNodes: IndexedNode[] = [];
  for (const node of index.values()) {
    if (node.kind === 'form') formNodes.push(node);
    if (node.kind !== 'field' || node.field === undefined) continue;
    for (const name of new Set([node.field, rangeEnd(node)])) if (name !== null) (checkedBy.get(name) ?? checkedBy.set(name, []).get(name)!).push(node);
  }

  /** Field nodes — or saved forms placed on the page — inside `root` (or the whole page), visible right now; `field`'s alone, when named. */
  function visibleFieldNodes(root?: string, kind: IndexedNode['kind'] = 'field', field?: string): IndexedNode[] {
    return visibleAmong(field !== undefined && kind === 'field' ? (checkedBy.get(field) ?? []) : kind === 'form' ? formNodes : [...index.values()], root, kind, field);
  }

  /** Those of `nodes` of the kind — `field`'s alone, when named — inside `root` (or the whole page), visible right now. */
  function visibleAmong(nodes: readonly IndexedNode[], root?: string, kind: IndexedNode['kind'] = 'field', field?: string): IndexedNode[] {
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
    return nodes.filter((node) => node.kind === kind && (field === undefined || node.field === field) && inside(node) && !skipped(node) && !nodeState(node.id).invisible);
  }

  /**
   * What each field node's answer rules read by name — their conditions' fields and those of the answers they hold
   * together — where they find the same for the same answer, words and reads: none about a date, none calling today()
   * or the app's own function. Null where they do not.
   */
  const ruleReads = new Map<string, readonly string[] | null>();
  for (const [id, rules] of nodeRules) {
    const steady = rules.every((one) => one.rule.date === undefined && steadyCalls(one.when.calls) && (!one.holds || steadyCalls(one.holds.calls)));
    ruleReads.set(id, steady ? [...new Set(rules.flatMap((one) => [...one.when.fields, ...(one.holds?.fields ?? [])]))] : null);
  }
  /** What each node's rules found last, and what they read then. */
  const rulesFound = new Map<string, { inputs: unknown[]; found: { error?: string; warning?: string } }>();
  /** What a field node's answer rules say of its value now: the first error and the first warning. */
  function ruleCheck(node: IndexedNode): { error?: string; warning?: string } {
    const rules = nodeRules.get(node.id);
    if (!rules) return {};
    const name = node.field as string;
    const def = page.fields[name];
    const label = wordsNow((node.source as FieldNode).label ?? def.label);
    // Found again only once the answer, its words or what the rules read changed — their conditions read again with them.
    const reads = full ? null : ruleReads.get(node.id);
    // And once words came since (a language's late chunk): its messages are said in them.
    return remembered(rulesFound, node.id, reads ? [state.values[name], label, wordsVersion(), ...reads.map(inputOf)] : null, () => {
      const { context: ctx, env } = reading();
      return checkRules(def, label, state.values[name], rules, { context: ctx, env, now: options.now?.() ?? new Date(), messages });
    });
  }

  /** A tick box required and not ticked, as an "I agree" box: "no" answers a yes or no, never a box to tick. */
  function unticked(node: IndexedNode): string | undefined {
    const name = node.field as string;
    const ticks = (node.source as FieldNode).widget === 'tick' && page.fields[name].type === 'boolean';
    return ticks && state.values[name] !== true && nodeState(node.id).required ? messages.tick : undefined;
  }

  /** The widget a field is shown with where it keeps its value its own way (a per cent): the first of its nodes'. */
  const shownWidget = (shown: IndexedNode[]) => shown.map((node) => (node.source as FieldNode).widget).find((widget) => widget === 'percentage');

  /** A field node's error now: its field's own rules first, then its answer rules. */
  /** A path's field's label: a field's, or a line's cell's (`field.lineKey.subfield`). */
  function labelOfPath(path: string): string {
    const parts = path.split('.');
    const def = page.fields[parts[0]];
    if (parts.length >= 3 && def?.type === 'one2many') return def.fields[parts[parts.length - 1]]?.label ?? path;
    return def?.label ?? path;
  }

  /** Each field node's own problem as last found, and what it was found from. */
  const ownFound = new Map<string, { inputs: unknown[]; found: string | undefined }>();
  /**
   * A field node's own problem — its kind's, its places', its least and most, required — found again only once its
   * answer, whether it is required, the choices or definitions it is checked against, today, or its words changed — the
   * page's, and the language's own once they came (`wordsVersion`).
   */
  function ownProblem(node: IndexedNode): string | undefined {
    const name = node.field as string;
    const value = state.values[name];
    const required = nodeState(node.id).required;
    return remembered(ownFound, node.id, full ? null : [value, required, state.choices, state.definitions[name], worded ? state.values : null, today(), wordsVersion()], () =>
      checkInput(page.fields[name], node.source as FieldNode, value, messages) ?? checkValue(checked(name), value, required, messages, today(), (node.source as FieldNode).widget)
    );
  }

  function nodeError(node: IndexedNode): string | undefined {
    const name = node.field as string;
    const value = state.values[name];
    const own = ownProblem(node);
    // A value as its source holds it, the person never having touched it: its own checks warn (`storedWarnings`), never refuse.
    const kept = own !== undefined && asStored(name) && !isEmpty(page.fields[name], value);
    return unticked(node) ?? (kept ? undefined : own) ?? ruleCheck(node).error;
  }

  /**
   * Whether a field holds what its record's source gave it: on a record loaded from its source, a field the person has
   * not changed since. Its value's own checks — its kind, places, digits, options, a pattern — are the source's to keep:
   * said as a warning, never a refusal of a save that does not touch it (a rename never stopped by a rate of 1.005 in a
   * field of 2 places, nor by an option since retired). Required still asks: an empty field is no value kept, nor is a
   * text missing a language it is required in; a table's cells, a matrix's rows and a properties field's own are
   * checked as ever.
   */
  const asStored = (name: string) => page.data.kind === 'record' && state.recordId != null && shownLoaded && KEPT_AS_STORED.has(page.fields[name]?.type) && !languagesOf(page.fields[name]) && !state.dirty.includes(name);

  /** The warnings of the record as loaded: each field's value its own checks would not take, and each its source holds that could not be read. */
  let storedWarnings: Record<string, string> = {};
  function storedProblems(values: Values, unreadable: Readonly<Record<string, string>>): Record<string, string> {
    const out: Record<string, string> = {};
    for (const name of Object.keys(unreadable)) if (page.fields[name]) out[name] = fillMessage(messages, messages.unreadableValue, { label: wordsNow(page.fields[name].label) });
    for (const node of index.values()) {
      const name = node.field;
      if (node.kind !== 'field' || !name || out[name] || !page.fields[name]) continue;
      const def = page.fields[name];
      const value = values[name];
      const widget = (node.source as FieldNode).widget;
      // Only what a save leaving it would not be refused for: a table's cells, a matrix's rows, a text's languages are checked as ever.
      const problem = isEmpty(def, value) || !KEPT_AS_STORED.has(def.type) || languagesOf(def) ? undefined : (checkInput(def, node.source as FieldNode, value, messages) ?? checkValue(checked(name), value, false, messages, today(), widget));
      if (problem) out[name] = problem;
    }
    return out;
  }

  /** What a check would refuse now (`collectErrors`), for the state it was found for: each field's asked — every field's, in full. */
  let refusals: { state: FormState; found: Map<string, Record<string, string>> } | null = null;
  /**
   * Whether the form refuses the answer at a path — a field's, or a table line's cell (`field.lineKey.subfield`) — as a
   * check would now: one it shows that holds a value its rules do not take (under its least, past today, a pattern not
   * met, an answer rule's error). An empty answer is none, required or not: there is nothing worked out from it to wait.
   */
  function refusedAt(path: string): boolean {
    const parts = path.split('.');
    const def = page.fields[parts[0]];
    const empty = () => {
      const held = valueAt(state.values, path);
      return held === gone || isEmpty((parts.length > 2 && def?.type === 'one2many' ? def.fields[parts[parts.length - 1]] : def) as Field, held);
    };
    // Only the field's own problems are found: those of the nodes showing it, or a range it ends — once for the state,
    // and not at all for a field's own answer that is empty, which is never one refused.
    const only = full ? undefined : parts[0];
    if (refusals?.state !== state) refusals = { state, found: new Map() };
    let found = refusals.found.get(only ?? '');
    if (!found) {
      if (parts.length === 1 && empty()) return false;
      refusals.found.set(only ?? '', (found = collectErrors(undefined, only)));
    }
    return !!found[path] && !empty();
  }

  /** The paths of a table's cells the form refuses now (`refusedAt`): those its check finds, read once through. */
  function refusedIn(field: string): string[] {
    refusedAt(field);
    const found = refusals?.found.get(full ? '' : field) ?? {};
    return Object.keys(found).filter((path) => path.startsWith(`${field}.`) && path.split('.').length >= 3 && refusedAt(path));
  }

  /** What values worked out from others wait for, by what they are worked out from: found once for each state of the form. */
  let waitsFound: { state: FormState; found: Map<string, WaitsFor | null> } | null = null;
  function waitsOn(from: readonly string[]): WaitsFor | null {
    // Worked out in full (`recomputeInFull`), each value asks of every cell, as before: the oracle the quick way is held to.
    if (full) return waitingOn(page, from, state.values, state.unread, refusedAt);
    if (waitsFound?.state !== state) waitsFound = { state, found: new Map() };
    const key = from.join('\u0000');
    if (waitsFound.found.has(key)) return waitsFound.found.get(key) ?? null;
    const waits = waitingOn(page, from, state.values, state.unread, refusedAt, refusedIn);
    waitsFound.found.set(key, waits);
    return waits;
  }

  /** Warnings for the visible fields of the page, without publishing them. */
  function collectWarnings(dirty: readonly string[] = state.dirty): Record<string, string> {
    const warnings: Record<string, string> = {};
    if (warns) {
      // Only a node with a rule that warns can warn: those alone are looked at, in the page's order.
      for (const node of full ? visibleFieldNodes() : visibleAmong(warningNodes)) {
        const warning = nodeRules.has(node.id) ? ruleCheck(node).warning : undefined;
        if (warning) warnings[node.field as string] ??= warning;
      }
    }
    // A value as its source holds it that its checks would not take, or could not read: until the person writes it.
    for (const [name, warning] of Object.entries(storedWarnings)) if (!dirty.includes(name)) warnings[name] ??= warning;
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
    if (at(value) < at(start)) return fillMessage(messages, messages.endBeforeStart, { end: wordsNow(def.label), start: wordsNow(page.fields[node.field as string].label) });
    return undefined;
  }

  /** A table's columns whose options come from the app's lists (`optionsFrom`), checked against the choices loaded for each line. */
  const listedKept = new Map<string, readonly string[]>();
  const listedSubs = (name: string, def: Extract<Field, { type: 'one2many' }>): readonly string[] => {
    let found = listedKept.get(name);
    if (!found) listedKept.set(name, (found = Object.keys(def.fields).filter((sub) => { const one = def.fields[sub]; return one.type === 'selection' && !!optionsList(one.optionsFrom); })));
    return found;
  };
  /** Each table line's cells' problems as last found, by the table's node and the line's key, and what they were found from. */
  const lineFound = new Map<string, { inputs: unknown[]; found: Readonly<Record<string, string>> }>();
  /**
   * A table line's cells' problems, by their paths — a section or a note answers only for its text; a cell its line
   * hides, or a column the record hides, asks nothing; one its line requires asks for a value. Found again only once
   * the line, its rules' state, the columns hidden, the choices its cells are checked against, the day or the words
   * changed (0.35.1): a key in a record's header checks none of its 200 lines. Each cell checked counts (`workCounts`).
   */
  function lineErrors(node: IndexedNode, name: string, def: Extract<Field, { type: 'one2many' }>, line: Line, hidden: readonly string[], day: string): Readonly<Record<string, string>> {
    const ruled = tables.has(node.id) ? lineStateOf(node.id, line.key) : null;
    // The choices its cells are checked against: those of its columns whose options come from the app's lists, its own.
    const listed = listedSubs(name, def);
    const inputs = full ? null : [line, ruled, hidden.join('\u0000'), day, wordsVersion(), ...listed.map((sub) => state.choices[`${name}.${line.key}.${sub}`])];
    const id = `${node.id}\u0000${line.key}`;
    const kept = inputs && lineFound.get(id);
    if (kept && inputs && sameReads(kept.inputs, inputs)) return kept.found;
    const found: Record<string, string> = {};
    const kind = lineKind(def, line.values);
    for (const [sub, subDef] of Object.entries(def.fields)) {
      if (kind && sub !== def.lineKinds?.text) continue;
      const cell = ruled?.cells[sub];
      if (cell?.invisible || hidden.includes(sub)) continue;
      workCounts.checks++;
      const path = `${name}.${line.key}.${sub}`;
      const message = checkValue(checkedLine(path, subDef), line.values[sub], subDef.required === true || cell?.required === true, messages, day, (node.source as FieldNode).cells?.[sub]?.widget);
      if (message) found[path] = message;
    }
    if (inputs) lineFound.set(id, { inputs, found });
    return found;
  }

  /**
   * Errors for the visible fields under `root`, without publishing them. `only`, a field's alone — those found by the
   * nodes showing it and the ranges it ends, in the page's order, as the whole check finds them for it.
   */
  function collectErrors(root?: string, only?: string): Record<string, string> {
    const errors: Record<string, string> = {};
    const seen = new Set<string>();
    for (const node of only === undefined ? visibleFieldNodes(root) : visibleAmong(checkedBy.get(only) ?? [], root)) {
      // The answers of a time run out go as they stood: their checks refuse nothing.
      if (anyJoin((join) => join.locks?.(node.id))) continue;
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
        const table = tables.get(node.id);
        // Columns the record hides now, read once for the table rather than once for each of its lines.
        const hidden = table ? Object.keys(def.fields).filter((sub) => table.compiled.hidden(sub, reading().context, reading().env, userRoles)) : [];
        const day = today();
        for (const line of (state.values[name] as Line[] | null) ?? []) Object.assign(errors, lineErrors(node, name, def, line, hidden, day));
      }
    }
    // Text left in a box that does not read answers for its field, in the words it was left with.
    for (const [path, unread] of Object.entries(state.unread)) if (seen.has(path.split('.')[0])) errors[path] = unread.message;
    // A value an app's function is asked for answers for its field: still asked, or why it did not come.
    for (const [path, found] of Object.entries(state.asked)) {
      if (!seen.has(path.split('.')[0]) || errors[path]) continue;
      const label = labelOfPath(path);
      errors[path] = found.failed === undefined ? fillMessage(messages, messages.stillWorkedOut, { label }) : fillMessage(messages, messages.notWorkedOut, { label, problem: found.failed });
    }
    // A choice held whose places filled up since it was picked: never sent, said under it.
    if (limitsKit) Object.assign(errors, limitsKit.fullErrors(seen, errors));
    // A saved form placed here answers for its fields by its own page's rules.
    for (const node of only === undefined ? visibleFieldNodes(root, 'form') : visibleAmong(formNodes.filter((one) => (one.source as FormNode).name === only), root, 'form')) {
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

  /** A value — a field's, or a table line's by its cell's path — the same in both: a line that is gone, none. */
  function sameAt(a: Readonly<Values>, b: Readonly<Values>, path: string): boolean {
    if (!path.includes('.')) return a[path] === b[path];
    const now = valueAt(a, path);
    return now !== gone && JSON.stringify(now ?? null) === JSON.stringify(valueAt(b, path) ?? null);
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
    const range = shown.length ? undefined : visibleAmong(checkedBy.get(field) ?? []).find((node) => rangeEnd(node) === field);
    if (!shown.length && !range) return undefined;
    if (state.unread[path]) return state.unread[path].message;
    if (range) return isEmpty(fieldDef(field), state.values[field]) ? undefined : rangeEndError(range, field, false);
    if (parts.length === 1) {
      const value = state.values[field];
      if (isEmpty(fieldDef(field), value)) return undefined;
      return (
        shown.map((node) => checkInput(page.fields[field], node.source as FieldNode, value, messages)).find(Boolean) ??
        besidesRows(field, checkValue(checked(field), value, false, messages, today(), shownWidget(shown))) ??
        shown.map((node) => ruleCheck(node).error).find(Boolean)
      );
    }
    if (parts.length === 2 && page.fields[field]?.type === 'properties') return propertyProblems(field)[path];
    const def = lineField(field);
    const sub = def.fields[parts[parts.length - 1]] as LineField | undefined;
    const value = valueAt(state.values, path);
    if (!sub || value === gone || isEmpty(sub, value)) return undefined;
    return checkValue(checkedLine(path, sub), value, false, messages, today());
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
    let asked = new Map<string, AskedFor>();
    let values = computed.apply(written, asked);
    for (let round = 0; round < 8; round++) {
      const result = setWhen.apply(values, holding);
      holding = result.holding;
      if (result.values === values) break;
      asked = new Map();
      values = computed.apply(result.values, asked);
    }
    askedNow = asked;
    return values;
  }

  /** Values to start again from, as loaded or restored: conditions holding in them hold already, and set nothing. */
  function startFrom(values: Values): Values {
    const asked = new Map<string, AskedFor>();
    const worked = computed.apply(values, asked);
    askedNow = asked;
    holding = setWhen.holding(worked);
    return worked;
  }

  /**
   * An app's function answered: the values worked out again with its answer, and the record as loaded with them, so
   * an answer is never a change of the person's. Values no one has changed start again from it — no rule starts to
   * hold on what only came late — and changed ones settle as any change does.
   */
  function answered() {
    baseline = computed.apply(baseline);
    if (state.dirty.length) return writeValues(state.values as Values);
    const values = startFrom(state.values as Values);
    set({ values, dirty: dirtyFields(values) });
  }

  /** Every answer on its way, and those that come of them, waited for: what a save does before it checks. */
  async function asksSettled(): Promise<void> {
    while (asking.size) await Promise.all([...asking]);
  }

  /** Answers that failed asked again — a save's try — and waited for. */
  async function askAgain(): Promise<void> {
    let failed = false;
    for (const [key, found] of answers) {
      if (found === 'asking' || found.failed === undefined) continue;
      answers.delete(key);
      failed = true;
    }
    if (failed) writeValues(state.values as Values);
    await asksSettled();
  }

  /**
   * Write values someone or something changed. `fresh` values are a starting point instead (a restored draft). `said`:
   * options taken out of an answer by the write, by path, with their words (`FormState.takenOut`); `from`, the values
   * those the write no longer offers were offered in (the form's now, unless said).
   */
  function writeValues(written: Values, extra: Partial<FormState> = {}, fresh = false, said: Record<string, string> = {}, from: Readonly<Values> = state.values) {
    // What the write gives back as the form holds it — an app's server working out every line again, alike — stays the
    // form's own: worked out, drawn, checked and compared again only where it changed (0.35.1). And so again once worked out.
    const given = written;
    if (!fresh) written = keptSame(written, state.values, fields);
    let settled = fresh ? startFrom(written) : keptSame(settle(written), state.values, fields);
    // A choice written again says no more what was taken out of it — a line's, nor once its line is gone; options a
    // change no longer offers are taken out now. Written again as it was given, though alike what it held.
    let takenOut: Record<string, string> = fresh ? {} : { ...Object.fromEntries(Object.entries(state.takenOut).filter(([path]) => sameAt(given, state.values, path))), ...said };
    const out = fresh || !optionKit ? null : optionKit.takeOut(from, settled);
    if (out) {
      settled = out.values;
      takenOut = { ...takenOut, ...out.said };
      for (const [path, gone] of Object.entries(out.gone)) takenOutOf.set(path, gone);
    }
    if (Object.keys(takenOut).length || Object.keys(state.takenOut).length) extra = { takenOut, ...extra };
    const values = syncParts(settled, fresh ? 'fresh' : 'edit');
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
    // A change someone made: a line's choice its columns no longer offer is cleared (followLines); a draft restored is none.
    edit = !fresh;
    const dirty = dirtyFields(values);
    set({ values, dirty, errors, warnings: withValues(values, () => collectWarnings(dirty)), unread, ...extra });
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

  /**
   * Whether drafts are kept on the app's server: its source keeps them, and the page offers "Continue later" (or the
   * form continues one by its key). A page without either keeps its drafts where it always did.
   */
  const onServer = () => !!options.dataSource?.saveDraft && !!options.dataSource.loadDraft && (page.continueLater === true || !!options.resume);
  /** Where drafts are kept in the browser: the app's store, else a timed page's tab (`timedStore`); none else. */
  const appStore = options.drafts?.store ?? timedStore(page);
  /**
   * Where a part that guards a send could not come — the code check, the payment step — what is typed is kept in the
   * tab's own store as it is typed, where the app keeps no drafts of its own: the Reload its words ask for, in the same
   * tab, brings it back, laid as the form opens (0.35.1). Never a secret field's; the person's own (`storeKey`); let go
   * once sent, as any draft.
   */
  let keptForReload = false;
  /** Where a draft is kept now. */
  const draftStore = (): DraftStore | undefined => appStore ?? (keptForReload ? (tabStore() as DraftStore | undefined) : undefined);
  /** Where a draft is looked for, and let go from: the app's store, else the tab's, where one kept for a reload would be. */
  const draftFound = (): DraftStore | undefined => appStore ?? (tabStore() as DraftStore | undefined);
  /** Whether drafts are kept: in a store, or on the server. */
  const draftsOn = () => !!draftStore() || onServer();
  /** A part that guards a send is missing: what is typed kept for a reload from now on, what is typed so far at once. */
  function keepForReload() {
    if (appStore || onServer()) return;
    keptForReload = true;
    if (state.dirty.length) keepHere(draftNow());
  }
  /** The key of the draft kept on the server for the record shown; null until the source gave one. */
  let serverKey: string | null = null;
  /** Counted each time the draft is let go (sent, discarded, another record shown): a keeping answered after is dropped. */
  let draftEpoch = 0;
  /** The draft kept on the server last asked to be kept: the next waits for it, so it carries the key it gave. */
  let draftGoing: Promise<unknown> = Promise.resolve();
  /** How many drafts are on their way to the server. */
  let keeping = 0;
  /** The draft found as the form opened, offered to restore (`state.draft`). */
  let found: StoredDraft | null = null;
  /** The key the form was given to continue from (`resume`), until it is opened. */
  let resumeKey = outer ? undefined : options.resume;

  function scheduleDraft() {
    if (!draftsOn()) return;
    if (draftTimer !== null) scheduler.clearTimeout(draftTimer);
    draftTimer = scheduler.setTimeout(() => {
      draftTimer = null;
      // On the server, a failure is kept in the browser's store instead, where there is one: the form goes on.
      void track(keepDraft(false).catch(() => keepHere(draftNow())));
    }, options.drafts?.delayMs ?? (onServer() ? 1500 : 400));
  }

  /**
   * The draft of what is typed now: the answers, the wizard's step and the steps passed over, text that does not read —
   * never a secret field's (a password box, a field marked `secret`). A record's draft keeps only the fields changed, with
   * the version they were typed against and each one's value then (`from`): laid again, it is the person's changes alone,
   * never the rest of the record as it was — a colleague's save since is never reverted.
   */
  function draftNow(): StoredDraft {
    const answered = Object.keys(fields).filter((name) => state.dirty.includes(name) && !secretFields.has(name));
    const record = page.data.kind === 'record' && state.recordId != null;
    const kept: Values = record ? Object.fromEntries(answered.map((name) => [name, state.values[name]])) : Object.fromEntries(Object.entries(state.values).filter(([name]) => !secretFields.has(name)));
    // Where files are stored apart, never a file's bytes: they would fill the browser's store (uploads.ts). Without, kept as always.
    const values = options.dataSource?.upload ? draftOf(kept) : structuredCopy(kept);
    const unread = Object.fromEntries(Object.entries(state.unread).filter(([path]) => !secretFields.has(path.split('.')[0])));
    return {
      values,
      ...(steps.length ? { step: state.step, skipped: [...state.skipped] } : {}),
      ...Object.assign({}, ...joins.map((join) => join?.kept?.())),
      ...(Object.keys(unread).length ? { unread: structuredCopy(unread as Record<string, UnreadText>) } : {}),
      answered,
      ...(record ? { from: structuredCopy(Object.fromEntries(answered.map((name) => [name, baseline[name] ?? null]))), ...(state.version ? { version: state.version } : {}) } : {}),
      savedAt: new Date(clock()).toISOString(),
    };
  }

  /** Fields never kept in the browser: those marked `secret`, and any drawn as a password box. */
  const secretFields = new Set([...Object.keys(page.fields).filter((name) => (page.fields[name] as { secret?: boolean }).secret === true), ...[...index.values()].filter((node) => node.kind === 'field' && (node.source as FieldNode).widget === 'password').map((node) => node.field as string)]);

  /** A draft in the browser's store, where the app gave one: a store that is full keeps none. */
  function keepHere(kept: StoredDraft | { savedAt: string; key: string }) {
    try {
      draftStore()?.setItem(storeKey(), JSON.stringify(kept));
    } catch {
      // The draft is a convenience: the form goes on without it.
    }
  }

  /**
   * Keep what is typed now: on the server where the source keeps drafts — one at a time, each carrying the key the last
   * was given; its key in the browser's store — else in the browser's store. The server's answer, or null.
   */
  function keepDraft(later: boolean): Promise<SavedDraft | null> {
    const draft = draftNow();
    const source = options.dataSource;
    if (!onServer() || !source?.saveDraft) {
      keepHere(draft);
      return Promise.resolve(null);
    }
    const shown = shownNow();
    const epoch = draftEpoch;
    keeping++;
    const going = draftGoing.then(() => source.saveDraft!({ pageId: page.id, model: page.data.kind === 'record' ? page.data.model : '', recordId: state.recordId, key: epoch === draftEpoch ? serverKey : null, draft, ...(later ? { later } : {}) }));
    draftGoing = going.then(
      () => void keeping--,
      () => void keeping--
    );
    return going.then((saved) => {
      // Kept for a record no longer shown, or for answers sent or let go meanwhile: the source has it; nothing is laid here.
      if (!shown() || epoch !== draftEpoch) return saved;
      serverKey = saved.key;
      if (state.resume?.key !== saved.key || state.resume.missing) set({ resume: { key: saved.key } });
      keepHere({ savedAt: draft.savedAt, key: saved.key });
      emit('draft', { key: saved.key, savedAt: draft.savedAt, later, saved });
      return saved;
    });
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

  /**
   * A draft laid on the form: its answers as a starting point — those of fields the page still has, never a secret one —
   * its wizard step (or the nearest before it that applies), its text that does not read. A record's, typed against a
   * version the record has moved from (or a field someone else changed since), is laid as the person's changes and said
   * as a conflict: Reload takes theirs (the draft set aside, to put back), Keep mine saves it over theirs.
   */
  function applyDraft(draft: StoredDraft) {
    found = null;
    // Its draw and its clocks, by the survey flow's part: now, or once it came.
    laid = draft;
    for (const join of joins) join?.lay?.(draft);
    const kept = Object.fromEntries(Object.entries(draft.values ?? {}).filter(([name]) => Object.prototype.hasOwnProperty.call(page.fields, name) && !secretFields.has(name)));
    const from = draft.from ?? {};
    const moved = page.data.kind === 'record' && state.recordId != null && ((!!draft.version && !!state.version && draft.version.token !== state.version.token) || Object.keys(from).some((name) => name in kept && !sameValue(fields[name], baseline[name], from[name])));
    writeValues(withDraft(kept), { draft: null }, true);
    if (moved) {
      const changed = Object.keys(from).filter((name) => name in kept && !sameValue(fields[name], baseline[name], from[name]));
      set({ conflict: { version: state.version ?? { token: '' }, theirs: structuredCopy(baseline), changed, both: changed.filter((name) => !sameValue(fields[name], baseline[name], kept[name])) } });
    }
    const known = (draft.skipped ?? []).filter((id) => steps.includes(id));
    // Text typed that did not read stays as typed, said as it was, where its field is still on the page.
    const unread = Object.fromEntries(Object.entries(draft.unread ?? {}).filter(([path]) => !!page.fields[path.split('.')[0]] && typeof draft.unread?.[path]?.text === 'string'));
    const patch: Partial<FormState> = {
      ...(steps.length ? { skipped: known, step: resumeStep(steps, form.steps(), draft.step) } : {}),
      ...(Object.keys(unread).length ? { unread: { ...state.unread, ...unread } } : {}),
      // Its boxes were left with it: why each does not read is said at once, as it was where it was typed.
      ...(Object.keys(unread).length ? { errors: { ...state.errors, ...Object.fromEntries(Object.entries(unread).map(([path, kept]) => [path, kept.message])) } } : {}),
    };
    if (Object.keys(patch).length) set(patch);
  }

  function forgetDraft() {
    if (draftTimer !== null) scheduler.clearTimeout(draftTimer);
    draftTimer = null;
    found = null;
    draftEpoch++;
    serverKey = null;
    if (state.resume) set({ resume: null });
    draftFound()?.removeItem(storeKey());
  }

  /**
   * A draft found: laid at once (`restore: "auto"`, a draft continued from its key over nothing typed, one kept in a
   * timed page's tab, or one whose clock started — let go, it would start again), else offered.
   */
  function offer(draft: StoredDraft, auto = !options.drafts || options.drafts.restore === 'auto') {
    // What the person typed while it was asked for is theirs: the draft is offered, never laid over it.
    if ((auto || draft.timers) && !state.dirty.length && !Object.keys(state.unread).length) return applyDraft(draft);
    found = draft;
    set({ draft: { savedAt: draft.savedAt } });
  }

  /**
   * The draft kept for the record shown, offered as it opens: the one the form was given to continue from (`resume`),
   * else the browser's store's — on the server by its key, or in the store. A draft asked of the server is laid only
   * on the record it was asked for.
   */
  function offerDraft(): Promise<void> | void {
    const source = options.dataSource;
    const given = resumeKey;
    resumeKey = undefined;
    const kept = given ? null : draftRead(draftFound()?.getItem(storeKey()) ?? null);
    if (!given && !kept) return;
    if (kept && !('key' in kept)) return offer(kept);
    const key = given ?? (kept as { key: string }).key;
    if (!source?.loadDraft || !onServer()) return;
    const shown = shownNow();
    if (given) set({ status: 'loading' });
    return track(
      source.loadDraft({ pageId: page.id, key }).then(
        (draft) => {
          if (!shown()) return;
          if (given) set({ status: 'ready' });
          if (!draft) {
            // Sent, or gone: the form starts empty, and says so where it was asked to continue it.
            draftFound()?.removeItem(storeKey());
            if (given) set({ resume: { key, missing: true } });
            return;
          }
          serverKey = key;
          set({ resume: { key } });
          offer(draft, given ? true : undefined);
        },
        (error: unknown) => {
          if (shown() && given) set({ status: 'error', error: (error as Error)?.message ?? String(error) });
        }
      )
    );
  }

  // ---- when the page takes answers, and each choice's places (the limits part: form-limits.ts) --------------------

  /** The limits made for this form from the limits part, once it came: none before, nor on a page with neither limits nor places. */
  let limitsKit: Limits | null = null;
  /** Whether the record shown was loaded once: its counts are asked then, its own choices not counted against it. */
  let loadedOnce = false;
  /** Whether the form keeps limits: a page with them or with places of its own, or a list's choices that came with places. */

  const keepsLimits = () => !outer && (hasLimits(page) || Object.values(state.choices).some((choices) => choices.options?.some((option) => option.seats !== undefined)));
  /**
   * The limits, made from their part as it comes — at once where it has come — shown, and asked of the source as the
   * form opens (or once its record is loaded); null where the form keeps none, or the part could not come: the source's
   * submit decides then.
   */
  function limitsCode(): Promise<Limits | null> {
    if (limitsKit || !keepsLimits()) return Promise.resolve(limitsKit);
    if (formLimitsPart.loaded) return Promise.resolve(limitsMade(formLimitsPart.loaded));
    return formLimitsPart.load().then(limitsMade, () => null);
  }
  function limitsMade(part: FormLimitsPart): Limits | null {
    if (limitsKit || disposed) return limitsKit;
    // The one kit, made at the limits' own moment: once the form knows it keeps them (joins.ts).
    const kit = part.formLimits(inner);
    limitsKit = kit;
    kit.show();
    if (kit.asks() && (state.recordId == null || loadedOnce)) void track(kit.ask());
    return kit;
  }
  /** Ask the source's `limits` again and show what it tells; without the limits part, nothing to ask. */
  const askLimits = (): Promise<void> => (limitsKit ? limitsKit.ask() : Promise.resolve());
  /** Whether the form asks the source for counts. */
  const asksLimits = () => !!limitsKit?.asks();

  /**
   * Whether the page takes these answers now, asked of the source again just before they go — the limits part waited
   * for where the form keeps limits: why not, as a save's problem, or null.
   */
  async function stillTaking(asked: number): Promise<Stopped | null> {
    const kit = await limitsCode();
    return kit ? kit.stillTaking(asked) : null;
  }

  /** A choice of a full option, picked by the person, refused under its field: the field keeps what it held. */
  const refusedFull = (name: string, value: Value): boolean => !!limitsKit?.refusedFull(name, value);

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
    const shown = shownNow();
    void track(
      source.onchange(request).then(
        (result) => {
          // A newer change asked since; or the record it was asked for is gone, or its values let go: none of it is laid.
          if (seq !== onchangeSeq || !shown()) return;
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
  /** A response's answers as they go: those shown, and what the parts that join the form add (a link's hidden fields). */
  function answersSent(): Values {
    const values = shownValues();
    for (const join of joins) join.values?.(values);
    return values;
  }

  async function save(chain: readonly string[] = [], yes?: string): Promise<boolean> {
    return (await saving(chain, yes)) === null;
  }

  /** A send — a response's, a save's, an upload's — through the parts that join the form, each around the next. Null: kept, not sent. */
  function through<T>(kind: SendKind, sent: unknown, send: (sent: never) => Promise<T>): Promise<T | null> {
    return joins.reduce<(sent: never) => Promise<T | null>>((go, join) => (join.around ? (one) => join.around!(kind, one, go as never) : go), send)(sent as never);
  }
  /** Started again, or another record opened: the parts that join the form let go of what the one before had. */
  const joinsReset = () => joins.forEach((join) => join.reset?.());
  /** The record loaded, or saved: what the parts that join the form ask again (a record's approvals). */
  const joinsLoaded = () => joins.forEach((join) => join.loaded?.());

  /** Every value, for a source that saves whole records: those of fields hidden from the person, which they never had, left out. */
  function sentValues(): Values {
    const values = structuredCopy(state.values as Values);
    for (const name of state.can?.hiddenFields ?? []) delete values[name];
    // A value its source holds that the form could not read stays as the source holds it, unless the person wrote it.
    for (const name of Object.keys(state.unreadable ?? {})) if (!state.dirty.includes(name)) delete values[name];
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
  /** The save asked for last, and the values it was asked for with: asked again with nothing changed, once it went, it is that one. */
  let running: { values: Readonly<Values>; mine: Promise<Stopped | null> } | null = null;
  /**
   * The idempotency key the send asked for now carries (`SaveRequest.key`, `SubmitRequest.key`): made at its first try,
   * the same for each try after — a Retry, an outbox's copy — until it went: a record's until a save of it went (a new
   * one's until it has its id), a response's until the form starts another (`reset`).
   */
  let sendKey: string | null = null;
  /** A response's answers as they last went, until the form starts another: the same answers are never sent twice. */
  let lastSent: string | null = null;
  const newSendKey = () => `send-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

  /**
   * One save at a time: a second — Ctrl+Enter pressed twice, or while the
   * first waits for files — waits for the first, then saves what is left to
   * save with the version the first got back, never as someone else's. A save
   * the page's own beforeSave steps ask for runs inside the one that set them off.
   */
  function saving(chain: readonly string[], yes?: string): Promise<Stopped | null> {
    if (chain.includes('on.beforeSave')) return savingNow(chain, yes).catch(broken);
    const before = saveRunning;
    const ahead = running;
    const values = state.values;
    const mine = (async () => {
      if (before) await before;
      // Asked again while one was on its way, nothing changed between — a double press, an app's own Submit pressed
      // twice — and that one went: the same save, never a second send. Stopped or refused, this one is asked anew.
      if (ahead && ahead.values === values && (await ahead.mine) === null) return null;
      return savingNow(chain, yes).catch(broken);
    })();
    const asked = (running = { values, mine });
    void mine.then(() => {
      if (running === asked) running = null;
    });
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

  /**
   * Every part that guards a send, in before it goes — fail closed, never skipped: the parts that join the form where
   * they guard it (`joinGate`: a payment, a code check, a time limit's clock, a link's hidden fields, a record's
   * approvals) and the form's own checking parts (its options by condition, its texts in several languages, its limits).
   * Each is waited for where it is coming; one that could not come — offline, or refused as another version's — is asked
   * for once more; still missing, the send is refused in words naming it ("The payment step could not load, so nothing
   * was sent. Try again."), and nothing goes. Null once every one is in. The one way a send passes them (`savingNow`).
   */
  /** Whether a part that guards a send is not in yet: what `guardsIn` waits for, asks for once more, and refuses without. */
  function guardsOwed(): boolean {
    return (
      joinParts.some((part, at) => !joins[at] && joinGate(part, page, options) !== undefined) ||
      (hasOptionRules(page) && !optionKit) ||
      (hasLanguages(page) && !formLanguagesPart.loaded) ||
      (keepsLimits() && !limitsKit)
    );
  }

  /** What a send last said of a part that guards it and could not come: said no more once the part is in. */
  let guardSaid: SaveProblem | null = null;
  async function guardsIn(): Promise<SaveProblem | null> {
    /** A part waited for where it is coming, then asked for once more where it did not come: in, or still missing. */
    const once = async <M,>(part: Part<M>, take: (module: M) => unknown): Promise<boolean> => {
      if (part.coming) await part.load().then(take, () => undefined);
      if (part.loaded === undefined) await part.load().then(take, () => undefined);
      return part.loaded !== undefined;
    };
    const found = await Promise.all([
      ...joinParts.map(async (part, at): Promise<[GuardWords, Part] | null> => {
        const words = joins[at] ? undefined : joinGate(part, page, options);
        if (!words) return null;
        await once(part, joinMade(at));
        return joins[at] ? null : [words, part];
      }),
      (async (): Promise<[GuardWords, Part] | null> => (hasOptionRules(page) && !optionKit && !(await once(optionRulesPart, () => optionsCode())) ? ['guardOptions', optionRulesPart] : null))(),
      (async (): Promise<[GuardWords, Part] | null> => (hasLanguages(page) && !(await once(formLanguagesPart, () => undefined)) ? ['guardLanguages', formLanguagesPart] : null))(),
      (async (): Promise<[GuardWords, Part] | null> => (keepsLimits() && !limitsKit && !(await once(formLimitsPart, () => limitsCode())) ? ['guardLimits', formLimitsPart] : null))(),
    ]);
    const missing = found.find((one) => one !== null);
    if (!missing || disposed) return null;
    // Nothing goes; what is typed is kept for the Reload the words may ask for — kept before they say so.
    keepForReload();
    const [words, part] = missing;
    const again = part.asksAgain === false ? messages.guardReload : messages.guardTryAgain;
    return { kind: 'other', message: fillMessage(messages, page.data.kind === 'responses' ? messages.guardNotSent : messages.guardNotSaved, { part: messages[words], again }) };
  }

  /**
   * A save that broke on its way — a box's reading, a part's hook, anything but the source's own answer (which is a
   * save problem of its own kind): never thrown at whoever saved, but said, nothing sent. `save()` never rejects.
   */
  function broken(error: unknown): Stopped {
    const message = fillMessage(messages, page.data.kind === 'responses' ? messages.sendBroken : messages.saveBroken, { problem: error instanceof Error ? error.message : String(error) });
    const problem: SaveProblem = { kind: 'other', message };
    set({ status: 'error', error: message, saveProblem: problem, conflict: null });
    return { reason: 'save', message };
  }

  async function savingNow(chain: readonly string[], yes?: string): Promise<Stopped | null> {
    // A record its source does not let this person change is refused here, in its words or the form's: no source is asked.
    if (page.data.kind === 'record' && state.can?.edit === false) {
      const problem: SaveProblem = { kind: 'rule', message: state.can.reason ?? named(messages.mayNotEditNoun, messages.mayNotEdit) };
      set({ status: 'error', error: problem.message, saveProblem: problem, conflict: null });
      return { reason: 'save', message: problem.message };
    }
    // A record that never loaded holds none of its values: nothing of it is saved — whole, it would empty the record.
    if (page.data.kind === 'record' && state.recordId != null && state.loaded === false) {
      const problem: SaveProblem = (notLoadedProblem = { kind: 'other', message: named(messages.notLoadedNoun, messages.notLoaded) });
      set({ status: 'error', error: problem.message, saveProblem: problem, conflict: null });
      return { reason: 'save', message: problem.message };
    }
    // Asked for the record shown now: another shown while it waits below, it saves nothing of that one, nor says anything there.
    const asked = generation;
    const elsewhere = (): Stopped => ({ reason: 'save', message: named(messages.recordReplacedNoun, messages.recordReplaced) });
    // What is still typed in a box is read first: it is what is saved, or why nothing is. A name still being looked
    // up is waited for, so the record it names is what is saved — or, named by none, why nothing is.
    const waiting = readTyped();
    if (waiting) await waiting;
    if (asked !== generation) return elsewhere();
    // Every part that guards a send in before anything goes (fail closed): one that could not come is asked for once more,
    // and still missing, nothing is sent — the person told which, in words, with Retry. Options by condition among them:
    // what is saved never holds one they would take out; a text in several languages checked in each.
    // Nothing is waited for where every one is in: a save the page's own steps make meanwhile goes ahead, never waiting on itself.
    const unguarded = guardsOwed() ? await guardsIn() : null;
    if (asked !== generation) return elsewhere();
    if (unguarded) {
      guardSaid = unguarded;
      set({ status: 'error', error: unguarded.message, saveProblem: unguarded, conflict: null });
      return { reason: 'save', message: unguarded.message };
    }
    // Its parts in now (asked for again by Retry): what their absence said is said no more, whatever stops the send next.
    if (guardSaid && state.saveProblem === guardSaid) set({ status: 'ready', error: null, saveProblem: null });
    guardSaid = null;
    // Values the app's functions are asked for are waited for — those that failed asked again — so what is saved is worked out.
    if (asking.size || Object.values(state.asked).some((found) => found.failed !== undefined)) {
      set({ status: 'saving', error: null, saveProblem: null });
      await askAgain();
      if (asked !== generation) return elsewhere();
      set({ status: 'ready' });
    }
    // Files still on their way are waited for first — a saved form's placed here too: the state says how many, so the page can say why it waits.
    if (filesGoing()) {
      set({ status: 'saving', error: null, saveProblem: null });
      await filesSettled();
      if (asked !== generation) return elsewhere();
      set({ status: 'ready' });
    }
    if (page.on?.beforeSave) {
      // Its run stops of itself on a record shown by anything but its own steps (a `call`'s `{ record }`, a reload):
      // those move the save on with it.
      // Its questions' Yes goes on with what set the save off: its words (Submit, a button's).
      const before = await moment('on.beforeSave', page.on.beforeSave, chain, false, yes);
      if (!before.done) {
        // A check's problems, or an inner save's, are shown already; any other stop is this save's problem.
        if (before.reason !== 'check' && before.reason !== 'save') {
          const problem: SaveProblem = { kind: 'stopped', reason: before.reason, message: before.message ?? '' };
          set({ status: 'error', error: problem.message || null, saveProblem: problem, conflict: null });
        }
        return { reason: 'save', ...(before.message !== undefined ? { message: before.message } : {}) };
      }
    }
    // Whether the page still takes answers — its dates, its counts asked again — and each choice held still has room.
    const refused = await stillTaking(asked);
    if (refused) return refused;
    // The parts that join the form and guard nothing (an outbox, a record made live), waited for where they have not come.
    if (joining) {
      await joining;
      if (asked !== generation) return elsewhere();
    }
    // A file that did not reach the store stops it, under its field, with the form's own checks — and what the parts that
    // join the form find: an email or a phone not proved by a code; a payment not taken sends nothing.
    const errors = { ...collectErrors(), ...fileProblems() };
    for (const join of joins) {
      // A part still to come here guards nothing (an outbox, a record made live): every one that guards is in (`guardsIn`).
      if ((await join?.before?.(errors)) === false) return { reason: 'save' };
      if (asked !== generation) return elsewhere();
    }
    if (Object.keys(errors).length) {
      set({ errors, ...unstored(errors) });
      return { reason: 'save', message: Object.values(errors)[0] };
    }
    const source = options.dataSource;
    serverErrors = {};
    set({ status: 'saving', errors: {}, error: null, saveProblem: null, conflict: null });
    // A draft being kept on the server goes first, so the send names the draft it ends; none is kept after it.
    if (draftTimer !== null) scheduler.clearTimeout(draftTimer);
    draftTimer = null;
    if (keeping) await draftGoing;
    const draft = serverKey ? { draft: serverKey } : {};
    /** The generation the record was in when this save went to the source. */
    let at = generation;
    /** The person's Discards so far: one made while this save is on its way wins over it. */
    const discardsAt = resets;
    try {
      // Bytes still in the record — a signature drawn, a value the app set, in a saved form placed here too — go to the store first, where it keeps files.
      await storeBytes(page.data.kind === 'responses' || state.recordId == null ? Object.keys(fields) : state.dirty);
      if (at !== generation) return elsewhere();
      const failed = fileProblems();
      if (Object.keys(failed).length) {
        set({ errors: failed, ...unstored(failed) });
        return { reason: 'save', message: Object.values(failed)[0] };
      }
      if (page.data.kind === 'responses') {
        if (!source?.submit) throw new Error('This page has no data source to send its answers to');
        const sent = answersSent();
        // Sent already, and nothing changed since: never sent twice. Changed since, they go again as the same response.
        const asWritten = JSON.stringify(sent);
        if (lastSent === asWritten) {
          set({ status: 'saved' });
          return { reason: 'save' };
        }
        const before = state.values as Values;
        at = generation;
        const resetAt = resets;
        const seen = botReport();
        // A quiz's marking, in before the answers go: what the person sees of their results.
        // What the source answered: the id it gave the response, and the values it added — what an ending reads.
        const request: SubmitRequest = { pageId: page.id, key: (sendKey ??= newSendKey()), values: sent, ...(seen ? { bot: seen } : {}), ...draft };
        // Through the parts that join the form: kept on the device where an outbox finds no signal (null), the form going
        // on as though it went.
        const got = await through('submit', request, (one: SubmitRequest) => (source.submit as NonNullable<DataSource['submit']>)(one));
        const answer = got ?? {};
        // The captcha's token is spent once sent: the next send waits for a new one.
        if (seen?.captcha) bot.captcha = null;
        // Answered for answers no longer shown — the form was started again meanwhile: the source has them, the form lays nothing.
        if (at !== generation) return null;
        lastSent = asWritten;
        forgetDraft();
        // What it sent is what an answer changed since is told against: still to send.
        sentAs = before;
        const added = answer.values && typeof answer.values === 'object' ? structuredCopy(answer.values) : {};
        // Started again meanwhile (`reset`): a new response is on screen, and no ending is the old one's.
        // A quiz's results: the source's marking, else the page's, on the answers as sent.
        const quiz = answer.quiz ?? joined('surveyflow')?.marked(sent);
        set({ status: 'saved', unsent: unsentNow(), ...(resets === resetAt ? { sent: { id: answer.id ?? null, values: { ...structuredCopy(sent), ...added }, ...(quiz ? { quiz } : {}) } } : {}) });
        emit('send', { values: sent, ...(seen ? { bot: seen } : {}) });
        // Kept, not sent: its counts and its after-save steps wait for a send that went.
        if (got === null) return null;
        // Counted again: one response fewer to take, this person's sent.
        if (asksLimits()) void track(askLimits());
        void track(moment('on.afterSave', page.on?.afterSave, chain, false));
        return null;
      }
      if (!source?.save) throw new Error('This page has no data source to save to');
      // What is sent: a change made while it is on its way is not in it, and stays a change to save.
      const sent = state.values as Values;
      at = generation;
      const resetAt = resets;
      const request: SaveRequest = {
        model: page.data.model,
        id: state.recordId,
        fields,
        changes: changes(),
        values: sentValues(),
        // The version it was opened at, for a source that refuses a save over someone else's.
        ...(state.recordId != null && state.version ? { version: state.version } : {}),
        key: (sendKey ??= newSendKey()),
        ...draft,
      };
      const got = await through('save', request, (one: SaveRequest) => (source.save as NonNullable<DataSource['save']>)(one));
      // Answered (anything but null, which is kept on the device): a new record its source gave no id is unsaved as far as
      // the form knows — the same save tried again by its key, never a second record.
      const went = got !== null;
      if (went && request.id == null && (got?.id === undefined || got.id === null)) throw new Error(messages.saveNoId);
      // Went: the next save is another. Kept on the device, a new record's next saves are the same until it has its id.
      if (went || request.id != null) sendKey = null;
      // Kept on the device (null): the record as it was, its version too.
      const result = got ?? { id: state.recordId as RecordId, version: state.version ?? undefined };
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
      // A save starts the person's changes afresh, as one saved is no change to take back (the viewer's Ctrl+Z says
      // nothing changed since). Not on a page that saves itself as it is changed (`autosave`), whose changes are taken
      // back across its saves; nor where a change made while it saved goes on past it.
      if (!options.autosave && !dirty.length && went) noted = [];
      set({ status: 'saved', recordId: result.id, values, dirty, warnings: withValues(values, () => collectWarnings(dirty)), version: result.version ?? null, ...(result.can ? { can: result.can } : {}) });
      // Changed while it saved: kept in a draft, and saved as any change is.
      if (dirty.length) {
        scheduleDraft();
        scheduleAutosave();
      }
      // A save may have sent it for approval, or moved it on: its approvals asked again.
      joinsLoaded();
      // The record as this save left it: a change made while it was on its way is no value of it.
      emit('save', { recordId: state.recordId, values: baseline });
      if (went) void track(moment('on.afterSave', page.on?.afterSave, chain, false));
      return null;
    } catch (error) {
      // Ended by the person's own Discard, or failed after it (a save stuck till its deadline): theirs won, nothing to say.
      if ((error as { discarded?: boolean } | null)?.discarded || resets !== discardsAt) {
        set({ status: 'ready' });
        return { reason: 'save' };
      }
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
  function afterSave(sent: Values, given: Values | undefined, whole = false): { values: Values; dirty: string[] } {
    // What the source sent back, read as its fields hold values (`valuesFromSource`): one it could not read, left as sent.
    const back = given && typeof given === 'object' && !Array.isArray(given) ? valuesFromSource(fields, given).values : undefined;
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
    const at = generation;
    emit('open', { recordId: state.recordId, values: state.values });
    await moment('on.open', page.on?.open, [], true);
    // Another record shown while its open steps ran: that one's opening tells its own steps.
    if (at !== generation) return;
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

  /** Write fields — a step's or the app's — worked out once, and tell each; `keep`, a write working the person's change out. */
  function write(written: Values, by: ChangeBy, keep = false) {
    const names = Object.keys(written);
    names.forEach(fieldDef);
    if (!names.length) return;
    writeValues({ ...(state.values as Values), ...structuredCopy(written) });
    for (const name of names) afterEdit(name);
    for (const name of names) changed(name, by, { keep });
  }

  /** A line added: the person's, theirs; a step's, none of theirs, and the lines they changed stay theirs. */
  /** What a line added now starts with: each line field's default, then what is worked out from its defaultFrom, then the record's lineDefaults. */
  function newLineValues(field: string): Values {
    const def = lineField(field);
    const lineFields = def.fields as Record<string, LineField>;
    const start = initialValues(lineFields, today());
    Object.assign(start, firstValues(lineFields, lineScope(field, start)));
    if (def.lineDefaults) Object.assign(start, readValueMap(def.lineDefaults, lineFields, recordScope()));
    return start;
  }

  function addLine(field: string, values: Values, by: ChangeBy): string {
    const def = lineField(field);
    const before = state.values[field];
    const current = (before as Line[] | null) ?? [];
    // A key no line holds: lines given (a line's own lines, back from its form) may hold new-… keys already.
    let key = `new-${++lineKeys}`;
    while (current.some((line) => line.key === key)) key = `new-${++lineKeys}`;
    const line: Line = { key, values: { ...newLineValues(field), ...structuredCopy(values) } };
    // A new line comes last, so it is numbered after the last.
    if (def.sequenceField && line.values[def.sequenceField] == null) {
      const numbers = current.map((l) => l.values[def.sequenceField as string]).filter((n): n is number => typeof n === 'number');
      line.values[def.sequenceField] = numbers.length ? Math.max(...numbers) + 1 : 1;
    }
    const lines = [...current, line];
    writeValues({ ...(state.values as Values), [field]: lines });
    if (by === 'person') noteChange(field, key, before, false);
    afterEdit(field);
    changed(field, by, by === 'person' ? { line: key } : { keep: true });
    return key;
  }

  /**
   * Check the form, or only these fields, showing what is found as sending does: a step's check, which waits for a
   * name still being looked up in a box, as a save does.
   */
  async function check(names: readonly string[] | undefined): Promise<Stopped | null> {
    names?.forEach(fieldDef);
    const at = generation;
    const waiting = readTyped();
    if (waiting) await waiting;
    // Another record shown while it waited: nothing found is shown on that one.
    if (at !== generation) return replaced();
    const all = collectErrors();
    const found = names ? Object.fromEntries(Object.entries(all).filter(([key]) => names.some((name) => key === name || key.startsWith(`${name}.`)))) : all;
    set({ errors: found });
    const first = Object.values(found)[0];
    return first === undefined ? null : { reason: 'check', message: first };
  }

  /**
   * What is typed read first, for a run the person or the app set off (`RunScope.typed`): every box read as a save
   * reads it, a name looked up waited for. Text left that does not read stops the run, said under its box as a check
   * says it — never a value under it handed on or worked from.
   */
  async function typedFirst(): Promise<Stopped | null> {
    const at = generation;
    const waiting = readTyped();
    if (waiting) await waiting;
    // Another record shown while it waited: the run is not for that one.
    if (at !== generation) return replaced();
    const found = unreadProblems();
    const first = Object.values(found)[0];
    if (first === undefined) return null;
    set({ errors: { ...state.errors, ...found } });
    return { reason: 'check', message: first };
  }

  /** The problems of text left unread in boxes shown — this form's and its saved forms' placed here — by path. */
  function unreadProblems(): Record<string, string> {
    const inner = (path: string) =>
      [...attached.values()].some((part) => path.startsWith(`${part.name}.`) && !!part.inner.form.getState().unread?.[path.slice(part.name.length + 1)]);
    return Object.fromEntries(Object.entries(collectErrors()).filter(([path]) => !!state.unread[path] || inner(path)));
  }

  /** Go to a wizard's step for a run; undefined when the target is no step of it, but a tab. */
  async function goToStep(target: string, chain: readonly string[]): Promise<Stopped | null | undefined> {
    if (!steps.includes(target)) return undefined;
    if (!form.steps().includes(target)) return { reason: 'cannot', message: `The step "${target}" does not apply now` };
    // A name still being looked up in a box on the way is waited for, as a save waits for it.
    const at = generation;
    const waiting = readTyped();
    if (waiting) await waiting;
    if (at !== generation) return replaced();
    let went = false;
    inRun(chain, () => (went = form.goTo(target)));
    return went ? null : { reason: 'check', message: Object.values(state.errors)[0] };
  }

  /** Run steps from the top — a button's, a moment's, the app's — and tell how it ended: on the record shown as it starts (`generation`). */
  async function runTop(list: readonly ActionStep[], scope: RunScope): Promise<RunResult> {
    scope.generation ??= generation;
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
    { model, ids, exact, field }: SearchOptions = {}
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
    const kept = ids ? [...(own ?? []), { field: 'id', op: 'in' as const, value: ids }] : own;
    // A code read by a scanner: the records whose field holds it, whatever their names.
    const filter = field ? [...(kept ?? []), { field, op: '=' as const, value: query }] : kept;
    const relation = byModel ? (model as string) : def.relation;
    return track(source.search({ model: relation, query: field ? '' : query, ...(filter ? { filter } : {}), limit, ...(exact ? { exact: true } : {}) }));
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

  /**
   * Load the record; `again`, as a step's reload: no draft offered, no `open` steps run a second time. THE way a
   * record's values come in: read as its fields hold them (`valuesFromSource`), anything but one record refused, a
   * failure said in words with a Retry of its own (`loadProblem`). What the person types while it loads is theirs: laid
   * over the record as it lands, changes to save — never lost under it.
   */
  async function load(again = false): Promise<void> {
    const source = options.dataSource;
    if (state.recordId == null || page.data.kind !== 'record') return;
    if (!source?.load) return loadFailed(new Error('this page has no data source to load from'));
    // Only the latest load is taken: a pager pressed twice shows the record it ended on.
    const seq = ++loads;
    // Typed while it was not loaded — its load on its way, or failed and asked again (Retry) — is the person's still.
    const typedBefore = shownLoaded ? [] : [...personal];
    // The record loaded again is shown anew: an answer started for it before is not laid over it.
    newGeneration();
    for (const name of typedBefore) personal.add(name);
    // A record not loaded yet holds none of its values: nothing of it to change or save until it is.
    set({ status: 'loading', error: null, unsent: [], loadProblem: null, ...(shownLoaded ? {} : { loaded: false }) });
    try {
      // A source may give the record's version and what the person may do with it beside its values.
      const { values: given, version, can } = loadedRecordOf(await source.load({ model: page.data.model, id: state.recordId, fields }));
      if (seq !== loads) return;
      const wrapped = envelopeOf(fields, given);
      if (wrapped) throw new Error(`the data source's load answered { ${wrapped}: … } round the record: answer its values themselves`);
      const { values: loaded, unreadable } = valuesFromSource(fields, given);
      // Lines load in their tables' orders; where a person moves them after, they stay.
      baseline = syncParts(startFrom(ordered({ ...initialValues(fields, today()), ...loaded })), 'start');
      // Typed while it loaded — the fields the person wrote, the tables they changed — laid over it as their changes.
      const typed = [...new Set([...personal, ...personalLines.keys()])].filter((name) => name in fields);
      const values = typed.length ? syncParts(startFrom({ ...structuredCopy(baseline), ...structuredCopy(Object.fromEntries(typed.map((name) => [name, state.values[name]]))) }), 'start') : structuredCopy(baseline);
      const unread = Object.fromEntries(Object.entries(state.unread).filter(([path]) => typed.includes(path.split('.')[0])));
      const refusedUnloaded = state.saveProblem !== null && state.saveProblem === notLoadedProblem ? { saveProblem: null } : {};
      const dirty = dirtyFields(values);
      // What the source holds that the page's own checks would not take — 1.005 in a field of 2 places, an option since
      // retired — and what it could not read: said under each field as a warning while it stays as stored.
      shownLoaded = true;
      storedWarnings = storedProblems(values, unreadable);
      set({ status: 'ready', values, dirty, errors: {}, warnings: withValues(values, () => collectWarnings(dirty)), version: version ?? null, can: can ?? null, unread, takenOut: {}, loaded: true, loadProblem: null, unreadable, ...refusedUnloaded });
      // Each choice's places, for this record: its own choices are its own.
      loadedOnce = true;
      if (asksLimits()) void track(askLimits());
      // Its approvals: where it stands, what was decided, what this person may decide — its fields locked while it waits.
      joinsLoaded();
      if (again) return;
      offerDraft();
      void track(opening());
    } catch (error) {
      if (seq === loads) loadFailed(error);
    }
  }

  /**
   * A load that failed: said in words — the source's own after them — with a Retry of its own; what loaded before stays.
   * A record opened in the place of another (`openRecord`), none of it shown yet, is named by its id: "Couldn't open
   * customer 7: …" — the form never says "this record" of one it does not show.
   */
  function loadFailed(error: unknown) {
    const problem = saveProblemOf(error);
    const opening = !shownLoaded && opened !== null && opened === state.recordId;
    const message = opening
      ? fillMessage(messages, named(messages.openFailedNoun, messages.openFailed), { id: openedName?.id === state.recordId ? openedName.name : String(state.recordId), problem: problem.message })
      : fillMessage(messages, named(messages.loadFailedNoun, messages.loadFailed), { problem: problem.message });
    set({ status: 'error', error: message, loadProblem: { kind: problem.kind === 'network' ? 'network' : 'other', message } });
  }

  /** The save refused for a record that never loaded, until it does. */
  let notLoadedProblem: SaveProblem | null = null;
  /** The record opened last in the place of another (`openRecord`): named by its id while none of it is shown. */
  let opened: RecordId | null = null;
  /** And by the name it was picked by, where it was (0.35.1: "Couldn't open customer 32" of a row that said Horus Foods). */
  let openedName: { id: RecordId | null; name: string } | null = null;
  /**
   * Whether the record shown loaded once from its source. A record an app hands the form with its values and never asks
   * to load (`recordId` with `values`) is the app's to vouch for: it saves as ever.
   */
  let shownLoaded = false;

  let loads = 0;

  /** Another record in this form's place, or a new one, once the one check let what was there go: false when the person kept it. */
  function openRecord(id: RecordId | null, chain: readonly string[] = [], name?: string): Promise<boolean> {
    const go = letGo({}, chain);
    const show = () => {
      // Its name, where the person picked it by one that is not its id: kept while it is the one opened (Retry too).
      openedName = name && name !== String(id) ? { id, name } : null;
      return showNow(id);
    };
    return go === true ? show() : go.then((yes) => (yes ? show() : false));
  }

  /** Another record in this form's place, or a new one: what was there let go, the new one loaded and opened. */
  async function showNow(id: RecordId | null): Promise<true> {
    newGeneration();
    // The warnings of the record shown before are that one's, and so is the key its sends carried.
    storedWarnings = {};
    shownLoaded = false;
    sendKey = null;
    lastSent = null;
    if (draftTimer !== null) scheduler.clearTimeout(draftTimer);
    if (autosaveTimer !== null) scheduler.clearTimeout(autosaveTimer);
    draftTimer = autosaveTimer = null;
    serverErrors = {};
    told = null;
    showing = false;
    clearFiles();
    // The draft kept for the record shown before is that one's.
    found = null;
    serverKey = null;
    draftEpoch++;
    const fresh = { dirty: [], errors: {}, warning: null, warningField: null, error: null, draft: null, step: steps[0] ?? null, skipped: [], saveProblem: null, version: null, can: null, conflict: null, setAside: null, unsent: [], unread: {}, takenOut: {}, resume: null, approval: null };
    opened = id;
    if (id != null) {
      // Another record's values are never shown in its place: the form holds none of it until it has loaded.
      baseline = startingValues(false, false);
      set({ ...fresh, recordId: id, status: 'idle', values: structuredCopy(baseline), loaded: false, loadProblem: null, unreadable: {} });
      joinsReset();
      await load();
      return true;
    }
    loads++;
    baseline = startFrom(startingValues(true, false));
    const values = syncParts(structuredCopy(baseline), 'start');
    set({ ...fresh, recordId: null, status: 'ready', values, warnings: withValues(values, collectWarnings), loaded: true, loadProblem: null, unreadable: {} });
    joinsReset();
    if (asksLimits()) void track(askLimits());
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
  const atOnce = (how: LeaveHow, own = false) => !deletingShown() && !checking && !busy(own) && (how.discard === true || !workAtRisk(state, how));

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
    if (deletingShown()) {
      forget();
      return true;
    }
    // The person's own Discard stops the files on their way, never waits for them — and a save on its way it waits for
    // as saves answer (a dialog's new record is its caller's), ending one stuck past `DISCARD_GRACE_MS` (deadline.ts):
    // their choice never waits behind a stuck save.
    if (how.discard) {
      clearFiles();
      stopSends(options.dataSource, DISCARD_GRACE_MS, scheduler);
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
    const message = named(messages.discardChangesNoun, messages.discardChanges);
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

  /**
   * Let go of the person's work at risk: files on their way stop, changes set aside go, a conflict's changes are
   * asked about no more, and the changes no save took go back to the record as the last save left it — so what a
   * dialog or a page in place hands back once it saved is the record as saved, never the change let go.
   */
  function forget() {
    const back = unsentLetGo();
    clearFiles();
    personal.clear();
    personalLines.clear();
    filed.clear();
    if (back) writeValues({ ...(state.values as Values), ...back });
    // Text left that does not read goes too: each box shows what its field holds.
    const unread = Object.keys(state.unread).length ? { unread: {} } : {};
    if (state.setAside !== null || state.unsent.length || state.conflict !== null || unread.unread) set({ setAside: null, unsent: [], conflict: null, ...unread });
  }

  /** The fields holding the person's changes no save took, as the record as last saved holds them: their lines alone, for a table. */
  function unsentLetGo(): Values | null {
    if (!state.unsent.length) return null;
    const out: Values = {};
    for (const name of state.unsent) {
      const from = sentAs ?? baseline;
      const keys = personalLines.get(name);
      out[name] = keys && !personal.has(name) ? linesAsSent(state.values[name], from[name], keys) : (structuredCopy(from[name]) as Value);
    }
    return out;
  }

  /** A table with these lines as sent: changed ones as they were, added ones gone, ones taken away back in their place. */
  function linesAsSent(value: unknown, sent: unknown, keys: ReadonlySet<string>): Value {
    const was = (sent as Line[] | null) ?? [];
    const of = (key: string) => was.find((line) => line.key === key);
    const out = ((value as Line[] | null) ?? []).filter((line) => !keys.has(line.key) || of(line.key)).map((line) => (keys.has(line.key) ? structuredCopy(of(line.key) as Line) : line));
    was.forEach((line, at) => {
      if (keys.has(line.key) && !out.some((other) => other.key === line.key)) out.splice(Math.min(at, out.length), 0, structuredCopy(line));
    });
    return out as unknown as Value;
  }

  /** The check as a step meets it: null to go on — at once when nothing is at risk — else why the run stops. */
  function letGoStep(chain: readonly string[]): Stopped | null | Promise<Stopped | null> {
    const go = letGo({}, chain);
    return go === true ? null : go.then((yes) => (yes ? null : kept()));
  }

  const kept = (): Stopped => ({ reason: 'no', message: named(messages.discardChangesNoun, messages.discardChanges) });

  /**
   * A step's own move — the record loaded again, or another shown — once the check let what is shown go: kept, the
   * person kept their work; replaced, another record was shown before it ended (the run's steps are not for that one).
   */
  async function ownMove(chain: readonly string[], move: () => Promise<unknown>): Promise<Stopped | null> {
    const go = letGo({}, chain);
    if (go !== true && !(await go)) return kept();
    // The record it shows is a generation of its own, made as it starts: another made before it ends replaced it.
    const moving = move();
    const mine = generation;
    await moving;
    return mine === generation ? null : replaced();
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

  /** Why a run stops whose record was replaced while it went on — quietly, when the form was closed. */
  function replaced(): Stopped {
    return disposed ? { reason: 'closed' } : { reason: 'cannot', message: named(messages.recordReplacedNoun, messages.recordReplaced) };
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
    messages,
    values: () => state.values,
    recordId: () => state.recordId,
    reading,
    today,
    // A step's write of a field takes the person's change in it over — unless the step works that change out: the
    // page's `change` steps, set off by it, as the source's onchange does.
    write: (values, chain) => write(values, 'step', worksOut(chain)),
    store: (values) => store(values),
    // The person's own change: the field's, or a line of it (a claim by line): put back, the whole field is theirs
    // again — at risk, asked about — never less than it was.
    mine: (field) => personal.has(field) || personalLines.has(field),
    putBack(values, mine) {
      write(values, 'step');
      for (const name of mine) noteOrigin(name, 'person', {});
    },
    addLine: (field, values) => void addLine(field, values, 'step'),
    check,
    typedFirst,
    save: saving,
    generation: () => generation,
    gone: replaced,
    async reload(chain) {
      if (state.recordId == null) return { reason: 'cannot', message: 'The record is not saved yet: there is nothing to load again' };
      const stopped = await ownMove(chain, () => load(true));
      if (stopped) return stopped;
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
      const of = generation;
      const shown = shownNow();
      deleting.set(of, (deleting.get(of) ?? 0) + 1);
      try {
        const out = await remove();
        // Deleted: what the person had not saved in it goes with it. Refused, it stays theirs. Another record shown
        // meanwhile keeps what was typed in it.
        if (done(out) && shown()) forget();
        return out;
      } finally {
        const left = (deleting.get(of) ?? 1) - 1;
        if (left) deleting.set(of, left);
        else deleting.delete(of);
      }
    },
    ...(options.dataSource?.archive && page.data.kind === 'record' ? { archive: (archive: boolean) => track((options.dataSource?.archive as NonNullable<DataSource['archive']>)({ ...record(), archive })) } : {}),
    ...(options.dataSource?.copy && page.data.kind === 'record' ? { copy: async () => (await track((options.dataSource?.copy as NonNullable<DataSource['copy']>)(record()))).id } : {}),
    ...(options.dataSource?.delete && page.data.kind === 'record' ? { remove: () => track((options.dataSource?.delete as NonNullable<DataSource['delete']>)(record())) } : {}),
    async showRecord(id, chain) {
      const stopped = await ownMove(chain, () => showNow(id));
      if (stopped) return stopped;
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
    barred: (right) => (state.can?.[right] === false ? state.can.reason ?? named(messages[`${MAY_NOT[right]}Noun`], messages[MAY_NOT[right]]) : null),
  });
  // A moment's run is on the record it was set off on: one set off again while its run goes, and run after it, is let
  // go when another record is shown by then (its steps were for that one).
  const moment = createMoments((key, list, chain, on, yes) => runTop(list, { id: key, chain, generation: on, yes }), () => generation);

  /**
   * Whether steps do something before their first save — set a status, call the app, open a page — so a record's
   * button made of them saves first. Steps that start with the save (Save and close), or only check before it, need
   * no save before them: theirs is the first.
   */
  function actsBeforeSaving(list: readonly ActionStep[]): boolean {
    const first = list.findIndex((step) => step.do === 'save');
    return first > 0 && list.slice(0, first).some((step) => step.do !== 'check');
  }

  /**
   * A press of a button: its confirmation first, then its steps and its app action as a final call, in `scope`. A
   * record's button whose steps act and then save saves the record first when it is new or changed, as Flectra's
   * button does: refused — a field it requires left empty — none of its steps run, so nothing it does happens to a
   * record that cannot be saved.
   */
  function press(source: ButtonNode | StatButton | MenuItem, scope: RunScope): Promise<RunResult> {
    const list: ActionStep[] = [...(source.steps ?? [])];
    if (source.action !== undefined) list.push({ do: 'call', action: source.action, ...('params' in source && source.params ? { params: source.params } : {}) });
    // A built-in item of the gear menu with nothing of its own: its step, asked about first when it archives or deletes.
    const builtin = 'builtin' in source && !list.length ? source.builtin : undefined;
    if (builtin) list.push({ do: builtin });
    // Undo after it, in place of asking first: a built-in with `undo` asks nothing unless it says so.
    const offers = 'undo' in source ? source.undo : undefined;
    const asked = offers !== undefined ? undefined : builtin === 'archive' ? named(messages.archiveConfirmNoun, messages.archiveConfirm) : builtin === 'delete' ? named(messages.deleteConfirmNoun, messages.deleteConfirm) : undefined;
    // The page's own question and the press's words, as a person reads them; Fieldia's own as they are.
    const confirm = 'confirm' in source && source.confirm !== undefined ? plainWords(source.confirm) : asked;
    if (offers !== undefined) scope.taken = takenNow(state.values);
    // Its question's Yes, and its ask steps', say what it does: its own words, else Archive or Delete.
    scope.yes ??= plainWords(source.label) || (builtin === 'archive' ? messages.archiveYes : builtin === 'delete' ? messages.deleteYes : undefined);
    // On the record it was pressed on: another shown while its question is asked, it does nothing to that one.
    scope.generation ??= generation;
    // Pressed by the person: what is typed is read before a step reads the form or hands its values on.
    scope.typed ??= 'first';
    return track(
      (async (): Promise<RunResult> => {
        if (confirm && !(await runner.ask(confirm, scope.yes))) {
          const result: RunResult = { done: false, reason: 'no', message: confirm };
          emit('run', { id: scope.id, steps: list, result });
          return result;
        }
        const saveFirst = page.data.kind === 'record' && actsBeforeSaving(list);
        // What is typed is read first, as the run reads it before its first step that reads the form (run.ts): text
        // that does not read stops it with `check`, said under its box — before the save that comes first, and any step.
        if (saveFirst && scope.typed === 'first') {
          const unread = await typedFirst();
          if (unread) {
            const at = Math.max(0, list.findIndex((step) => step.do !== 'check'));
            const result: RunResult = { done: false, stoppedAt: at, step: list[at], reason: unread.reason, ...(unread.message !== undefined ? { message: unread.message } : {}) };
            emit('run', { id: scope.id, steps: list, result });
            return result;
          }
        }
        // Then the save first, then the steps.
        if (saveFirst && (state.recordId == null || state.dirty.length > 0 || Object.keys(state.unread ?? {}).length > 0 || state.uploads.some(uploadGoing))) {
          const first = await saving(scope.chain, scope.yes);
          if (first) {
            const result: RunResult = { done: false, step: { do: 'save' }, reason: first.reason, ...(first.message !== undefined ? { message: first.message } : {}), ...(first.error !== undefined ? { error: first.error } : {}) };
            emit('run', { id: scope.id, steps: list, result });
            return result;
          }
        }
        const result = await runTop(list, scope);
        if (scope.taken) offerUndo(source, scope, result, offers);
        return result;
      })()
    );
  }

  /**
   * A press that offers Undo has ended: its words said — the last with Undo, where what it did can be taken back — by
   * the undo part (press-undo.ts), which a page whose buttons offer Undo asks for first; plainly where it cannot come.
   */
  function offerUndo(source: ButtonNode | StatButton | MenuItem, scope: RunScope, result: RunResult, offers: PressUndo | undefined) {
    const taken = scope.taken as NonNullable<RunScope['taken']>;
    scope.taken = undefined;
    void track(
      pressUndoPart.load().then(
        (part) => part.offerUndo(inner, { kit: runner.kit, source, scope, taken, result, offers }),
        () => taken.said.forEach((words) => options.host?.say(words.message, words.tone))
      )
    );
  }

  const form: Form = {
    page,
    ...(table ? { functions: table } : {}),
    getState: () => state,

    subscribe(listener) {
      listeners.add(listener);
      // Listened to: the page opening or closing is said as it comes.
      if (listeners.size === 1) limitsKit?.heard(true);
      return () => {
        listeners.delete(listener);
        if (!listeners.size) limitsKit?.heard(false);
      };
    },

    load() {
      const go = letGo();
      return track(go === true ? load() : go.then((yes) => (yes ? load() : undefined)));
    },

    setValue(name, value, how) {
      fieldDef(name);
      // A choice whose places are all taken is shown, and refused when the person picks it: said under its field.
      if ((how?.by ?? 'person') === 'person' && refusedFull(name, value)) return;
      const before = state.values[name];
      writeValues({ ...(state.values as Values), [name]: structuredCopy(value) });
      if ((how?.by ?? 'person') === 'person') noteChange(name, undefined, before, true);
      afterEdit(name);
      changed(name, how?.by ?? 'person');
    },

    setValues: (values, how) => (how?.stored ? store(values) : write(values, 'app')),

    node: nodeState,

    nodeReads(id) {
      if (readsOf.has(id)) return readsOf.get(id) ?? null;
      const found = nodeReadsOf(id);
      readsOf.set(id, found);
      return found;
    },

    openRecord: (id, name) => track(openRecord(id, [], name)),

    leave: (how) => Promise.resolve(letGo(how)),

    leaveNow: (how = {}) => (outer ? outer.leaveNow(how) : atOnce(how)),

    recordShown: shownNow,

    relatedFilter(id) {
      const node = index.get(id)?.source as LayoutNode | undefined;
      if (node?.type !== 'related' || state.recordId == null) return null;
      const related: RelatedNode = node;
      return [{ field: related.field, op: '=', value: state.recordId }, ...(related.filter ? resolveFilter(related.filter, context()) : [])];
    },

    post,

    setEditing(next) {
      if (next === editing) return;
      editing = next;
      // Nothing of the record changed; what shows of it may have.
      set({});
    },

    fieldReadonly: (name) => lockedField(fieldDef(name)) || state.can?.edit === false || state.can?.readonlyFields?.includes(name) === true || signedNow().has(name) || anyJoin((join) => join.locksField?.(name)),

    loadChoices: (field) => loadChoices(field),
    loadDefinitions,
    addDefinition,

    lineChoices(field, key, subfield, values = {}) {
      const one = listedAt(field, subfield);
      const line = key === null ? one && { values: newLineValues(field) } : lineAt(field, key);
      if (!one || !line) throw new Error(`"${field}.${key}.${subfield}" is no line's choice from the app's lists`);
      return track(askLine(one, { ...line.values, ...values }));
    },

    offered(name) {
      const cell = cellOf(name);
      if (!cell) return page.fields[name]?.type === 'selection' ? (optionKit ? optionKit.offered(name, state.values, reading()) : everyOption(name)) : null;
      const lines = page.fields[cell.table];
      const line = lineAt(cell.table, cell.key);
      return lines?.type === 'one2many' && lines.fields[cell.column]?.type === 'selection' && line ? lineOffered(cell.table, line, cell.column, reading().context) : null;
    },
    offersChange(name) {
      const cell = cellOf(name);
      const lines = cell ? page.fields[cell.table] : undefined;
      return changesOptions(cell ? (lines?.type === 'one2many' ? lines.fields[cell.column] : undefined) : page.fields[name]);
    },

    waitsFor(name) {
      // What it is worked out from first: an answer that does not read, or that the form refuses, is never asked about.
      const from = workedOut.get(name);
      const waits = from ? waitsOn(from) : null;
      if (waits) return waits;
      const found = state.asked[name];
      return found ? { field: name, asking: true, ...(found.failed !== undefined ? { failed: found.failed } : {}) } : null;
    },

    problem(name) {
      fieldDef(name);
      // Only a field someone can see is asked anything, and required wherever it is shown so.
      const shown = visibleFieldNodes(undefined, 'field', name);
      if (!shown.length) return null;
      if (state.unread[name]) return state.unread[name].message;
      // A property's text left unread answers for its field, and so does a box of a value drawn in parts (a repeat
      // rule's number, an opening hour's time: `field.part`).
      if (['properties', 'json', 'char'].includes(page.fields[name].type)) {
        const row = Object.keys(state.unread).find((path) => path.startsWith(`${name}.`));
        if (row) return state.unread[row].message;
      }
      const own =
        shown.map(unticked).find(Boolean) ??
        shown.map((node) => checkInput(page.fields[name], node.source as FieldNode, state.values[name], messages)).find(Boolean) ??
        checkValue(checked(name), state.values[name], shown.some((node) => nodeState(node.id).required), messages, today(), shownWidget(shown));
      return own ?? shown.map((node) => ruleCheck(node).error).find((error) => error !== undefined) ?? null;
    },

    setUnread(path, unread) {
      const field = path.split('.')[0];
      // A line's cell (`field.lineKey.subfield`), or a property (`field.property`).
      const def = fieldDef(field);
      // A line's cell, a property, or one of the boxes a value is drawn in (a repeat rule's number, an opening hour's
      // time: `field.part`, of a char or a json field).
      if (path.includes('.') && def.type !== 'properties' && !((def.type === 'json' || def.type === 'char') && path.split('.').length === 2)) lineField(field);
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
      noted.push([path.split('.')[0]]);
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

    botCheck(seen) {
      if (seen.honeypot !== undefined) bot.honeypot = seen.honeypot;
      if (seen.captcha !== undefined) bot.captcha = seen.captcha;
    },

    joined: (name) => joined(name as keyof FormJoins) as never,
    reading: () => readingNow > 0 || [...attached.values()].some((part) => part.inner.form.reading()),

    validate(within) {
      readTyped();
      const errors = collectErrors(within);
      set({ errors });
      return Object.keys(errors).length === 0;
    },

    save: (how) => track(save([], how?.yes)),

    canUpload: () => typeof options.dataSource?.upload === 'function',
    today,
    now: () => options.now?.() ?? new Date(),
    user: () => options.user ?? null,
    shownFields: () => [...new Set([...visibleFieldNodes(), ...visibleFieldNodes(undefined, 'form')].map((node) => answerOf(node)).filter((name): name is string => !!name))],
    recordReads: (id, values, fields) => recordContext(values, fields ?? page.fields, { recordId: id, user: options.user, editing: false, context: options.context }),
    canFindSlots: () => typeof options.dataSource?.slots === 'function',
    findSlots(field, ask) {
      const source = options.dataSource;
      if (!source?.slots) return Promise.reject(new Error('The data source has no slots()'));
      const def = page.fields[field];
      const { schedule = field, length, between, from, to } = ask;
      return source.slots({
        model: page.data.kind === 'record' ? page.data.model : '',
        field,
        recordId: state.recordId,
        schedule,
        from,
        to,
        timeZone: (def?.type === 'datetime' && def.timeZone) || page.timeZone || ownZone(),
        ...(length ? { length } : {}),
        ...(between ? { between } : {}),
        values: structuredCopy(state.values as Values),
      });
    },
    canFindDuplicates: () => !!(page.data.kind === 'record' && page.duplicates?.fields?.length && options.dataSource?.duplicates),
    async findDuplicates() {
      const [source, model] = recordSource('duplicates');
      const fields = (page.duplicates?.fields ?? []).filter((name) => page.fields[name] && !isEmpty(page.fields[name], state.values[name]));
      const recordId = state.recordId;
      // Nothing typed in any of them: nothing asked.
      if (!fields.length) return [];
      const { matches } = await source.duplicates({ model, recordId, values: structuredCopy(state.values as Values), fields });
      // Never the record itself, whatever the source says; the likest first where it scores them.
      const others = (matches ?? []).filter((match) => match && String(match.id) !== String(recordId));
      return others.every((match) => typeof match.score === 'number') ? others.sort((a, b) => (b.score as number) - (a.score as number)) : others;
    },
    keepsNotDuplicates: () => !!(page.data.kind === 'record' && options.dataSource?.notDuplicates && options.dataSource.markNotDuplicate),
    async notDuplicates() {
      const [source, model] = recordSource('notDuplicates');
      const recordId = state.recordId;
      if (recordId === null) return [];
      const ids = await source.notDuplicates({ model, recordId });
      return Array.isArray(ids) ? ids.filter((id) => (typeof id === 'string' || typeof id === 'number') && String(id) !== String(recordId)) : [];
    },
    async markNotDuplicate(matchId) {
      const [source, model] = recordSource('markNotDuplicate');
      const recordId = state.recordId;
      if (recordId === null) throw new Error('A new record has no id to keep it by');
      await source.markNotDuplicate({ model, recordId, matchId });
    },
    canMerge: () => !!(page.data.kind === 'record' && options.dataSource?.merge && options.dataSource.load),
    async readRecord(id) {
      const [source, model] = recordSource('load');
      return loadedRecordOf(await source.load({ model, id, fields: page.fields })).values;
    },
    async merge(request) {
      const [source, model] = recordSource('merge');
      return source.merge({ model, keepId: request.keepId, mergeIds: [...request.mergeIds], values: structuredCopy(request.values), fields: page.fields });
    },
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
      noted = [];
      personal.clear();
      personalLines.clear();
      filed.clear();
      sentAs = null;
      // Started again: a new response, timed from now, sent with a key of its own.
      bot = { ...bot, honeypot: false, since: clock() };
      sendKey = null;
      lastSent = null;
      const values = syncParts(structuredCopy(baseline), 'start');
      set({ values, dirty: [], errors: {}, warnings: withValues(values, () => collectWarnings([])), warning: null, warningField: null, draft: null, step: steps[0] ?? null, skipped: [], saveProblem: null, conflict: null, unsent: [], unread: {}, takenOut: {}, sent: null });
      // Started again: a new response proves and pays its own; a new respondent is drawn anew (unless the app or the
      // person's id is the seed), on the first step drawn, no clock running.
      joinsReset();
      // Started again: whether the page takes another response, and each choice's places, asked again.
      if (asksLimits()) void track(askLimits());
    },

    words: (text) => wordsNow(text),

    ending: endingNow,

    endingWords(text) {
      const sent = state.sent;
      if (!sent) return wordsNow(text);
      // The response's id where the page has no field of that name: "Your booking is {id}".
      return wordsNow(text, sent.values, (name) => (name === 'id' && !page.fields['id'] ? String(sent.id ?? '') : undefined));
    },

    changes,

    addLine: (field, values = {}) => addLine(field, values, 'person'),

    updateLine(field, key, name, value) {
      const def = lineField(field);
      if (!def.fields[name]) throw new Error(`The lines of "${field}" have no field "${name}"`);
      const before = state.values[field];
      const lines = ((before as Line[] | null) ?? []).map((line) =>
        line.key === key ? { ...line, values: { ...line.values, [name]: structuredCopy(value) } } : line
      );
      writeValues({ ...(state.values as Values), [field]: lines });
      noteChange(field, key, before, true);
      afterEdit(field);
      changed(field, 'person', { line: key });
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
      const was = state.values[field];
      writeValues({ ...(state.values as Values), [field]: renumbered });
      noteChange(field, undefined, was, false);
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
      const before = state.values[field];
      const lines = ((before as Line[] | null) ?? []).filter((line) => line.key !== key);
      writeValues({ ...(state.values as Values), [field]: lines });
      noteChange(field, key, before, false);
      afterEdit(field);
      changed(field, 'person', { line: key });
    },

    async search(field, query, limit = 8, options = {}) {
      return runSearch(fieldDef(field), field, context(), query, limit, options);
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
      const line = key === null ? { values: newLineValues(field), id: null } : ((state.values[field] as Line[] | null) ?? []).find((l) => l.key === key);
      if (!line) throw new Error(`"${field}" has no line "${key}"`);
      return runSearch(sub, subfield, lineContext(line.values, def.fields as Record<string, LineField>, context(), line.id ?? null), query, limit, options);
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

    startTimer: () => joined('surveyflow')?.start(),
    countdown: () => joined('surveyflow')?.countdown() ?? null,

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
      return own.when.find((item) => holds(item.holds, reading))?.text ?? own.fixed;
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
    run: (list, context = {}) => track(runTop(list, { id: context.id ?? 'run', chain: [], typed: 'first', ...(context.recordIds ? { recordIds: [...context.recordIds] } : {}), yes: context.yes })),

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
      const kept = found ?? draftRead(draftFound()?.getItem(storeKey()) ?? null);
      if (kept && 'values' in kept) applyDraft(kept);
    },

    discardDraft() {
      forgetDraft();
      set({ draft: null });
    },

    canContinueLater: () => page.continueLater === true && onServer() && page.layout.type !== 'list',

    async continueLater() {
      if (!form.canContinueLater()) throw new Error('No continueLater, or no saveDraft and loadDraft');
      // What is typed is read first, as a save reads it: text that does not read is kept as typed, said again as it opens.
      await (readTyped() ?? Promise.resolve());
      if (draftTimer !== null) scheduler.clearTimeout(draftTimer);
      draftTimer = null;
      const saved = await track(keepDraft(true));
      return saved as SavedDraft;
    },

    refreshLimits: () => askLimits(),

    async refreshApprovals() {
      await joining;
      await joined('approvals')?.ask();
    },

    async decide(level, decision, reason) {
      await joining;
      const kit = joined('approvals');
      if (!kit) throw new Error('No approvals on this page');
      return track(kit.decide(level, decision, reason));
    },

    approvalLock: (name) => joined('approvals')?.lockWords(name) ?? null,

    async reloadTheirs() {
      // A save on its way first: its answer is not dropped by the load.
      const asked = shownNow();
      await savesSettled();
      if (!asked()) return false;
      // What is still typed is the person's too: read, a name looked up waited for, before theirs are loaded.
      const waiting = readTyped();
      if (waiting) await waiting;
      if (!asked()) return false;
      // The person's changes, kept before theirs are loaded over them; and text they left that does not read.
      const mine: Values = {};
      for (const name of state.dirty) mine[name] = structuredCopy(state.values[name]) as Value;
      const typed = state.unread;
      // The record loaded again is a record shown anew: what is set aside is laid on it alone.
      const loading = load(true);
      const loaded = generation;
      await track(loading);
      if (loaded !== generation || state.status !== 'ready') return false;
      // Set aside where theirs differ from mine: a change they made the same way is no loss.
      const aside: Values = { ...(state.setAside ?? {}) };
      for (const [name, value] of Object.entries(mine)) if (!sameValue(fields[name], value, state.values[name])) aside[name] = value;
      // Text that does not read is no value to set aside: it stays in its box, unread with why, over their value —
      // never dropped unsaid. A line of theirs no longer there takes its cells' text with it.
      const unread = Object.fromEntries(Object.entries(typed).filter(([path]) => valueAt(state.values, path) !== gone));
      set({ conflict: null, saveProblem: null, setAside: Object.keys(aside).length ? aside : null, ...(Object.keys(unread).length ? { unread } : {}) });
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
          const shown = shownNow();
          try {
            const now = loadedRecordOf(await track(source.load({ model: page.data.model, id: state.recordId, fields })));
            told = valuesFromSource(fields, now.values).values;
            version = now.version ?? version;
          } catch {
            // Unread: said below.
          }
          // Read, or not, once another record is shown or the values let go: nothing is laid, nothing saved.
          if (!shown()) return false;
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

    undo: () => replay(true),
    redo: () => replay(false),
    history: () => pressUndoPart.loaded?.nextSteps(noted, inner.same) ?? { undo: null, redo: null },

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
          // In the record's time zone, unless it names its own.
          page: { ...inner, data: { kind: 'responses' }, ...(inner.timeZone || !page.timeZone ? {} : { timeZone: page.timeZone }) },
          dataSource: options.dataSource,
          values: isRecord(given) ? given : {},
          onAction: options.onAction,
          host: options.host,
          confirm: options.confirm,
          scheduler,
          messages,
          now: options.now,
          // Its words that show its answers read them as this form's do.
          ...(options.valueWords ? { valueWords: options.valueWords } : {}),
        },
        chain,
        // Its files are the record's: stored for it, under the part's name.
        { model: where.model, recordId: where.recordId, under: `${where.under}${part.name}.` },
        // Its ways out are the record's: through this form's check.
        { letGo, close, leaveNow: (how) => atOnce(how), recordShown: shownNow }
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
      // Typed a moment ago, its draft not kept yet: kept now, as the person's own (the draft's rules: changes alone,
      // never a secret) — a form taken away, its dialog closed with its viewer (`destroy()`), is closed, not discarded.
      if (draftTimer !== null) {
        scheduler.clearTimeout(draftTimer);
        draftTimer = null;
        void keepDraft(false).catch(() => keepHere(draftNow()));
      }
      // An answer that lands after is for no record shown.
      disposed = true;
      sayNoMore(form);
      for (const join of joins) join?.dispose?.();
      newGeneration();
      clearFiles();
      if (draftTimer !== null) scheduler.clearTimeout(draftTimer);
      if (autosaveTimer !== null) scheduler.clearTimeout(autosaveTimer);
      limitsKit?.dispose();
      listeners.clear();
      events.clear();
      for (const part of attached.values()) part.inner.form.dispose();
    },
  };

  // A record's starting values may already break a warning rule; nothing listens yet.
  state = { ...state, warnings: collectWarnings() };
  // When the page takes answers — at once where the limits part has come, else as soon as it does — its counts and each
  // choice's places as the source tells them: a record's own once it is loaded, its own choices not counted against it.
  if (keepsLimits()) void track(limitsCode());
  // The parts its page or its source asks to join it — a survey's draw made before a draft is laid, which lays its own
  // draw over it; a record's approvals ready by the time its record is loaded; the record made live — each made at once
  // where it has come, else as it does, a draft laid meanwhile laid on it.
  if (joinParts.length) joining = Promise.all(joinParts.map((part, at) => (part.loaded ? joinMade(at)(part.loaded) : track(part.load().then(joinMade(at), () => undefined))))).then(() => {
    // One that guards a send could not come (the code check, the payment step): what is typed is kept for a reload from now.
    if (!disposed && joinParts.some((part, at) => !joins[at] && joinGate(part, page, options) !== undefined)) keepForReload();
  });
  // A new form has its values now — a draft continued from its key once it is laid — and opens once whoever made it
  // has had the chance to listen.
  if (state.recordId == null) {
    const continued = offerDraft();
    void track(Promise.resolve(continued).then(opening));
  }
  // Words that come after it said its problems and warnings — a language's chunk that came late — and it says them again
  // in those words: each kept problem has the words' version among its inputs, so each is found again. Only what is
  // shown is said again, never taken away or added: a problem said stays said, in its new words. The packages' alone:
  // the one-tag script's languages are its add-ons, in before a page is drawn in one (it has no `__FIELDIA_VERSION__`
  // but there, where this is left out of it).
  if (typeof __FIELDIA_VERSION__ === 'undefined')
    sayAgainAsWordsCome(form, () => {
      if (disposed) return;
      const reworded = <T extends Record<string, string>>(shown: T, fresh: Record<string, string>): T => {
        let out: Record<string, string> | null = null;
        for (const key of Object.keys(shown)) if (fresh[key] && fresh[key] !== shown[key]) (out ??= { ...shown })[key] = fresh[key];
        return (out ?? shown) as T;
      };
      const errors = Object.keys(state.errors).length ? reworded(state.errors, revalidateShown(state.values)) : state.errors;
      const warnings = Object.keys(state.warnings).length ? reworded(state.warnings, collectWarnings()) : state.warnings;
      if (errors !== state.errors || warnings !== state.warnings) set({ errors, warnings });
    });
  return {
    form,
    take(values, how) {
      if (how !== 'start') return writeValues({ ...initialValues(page.fields, today()), ...values }, {}, how === 'fresh');
      // Started again from the record round it: a file it held is the record's now, sent or let go with it.
      filed.clear();
      baseline = startFrom({ ...initialValues(page.fields, today()), ...structuredCopy(values) });
      const start = syncParts(structuredCopy(baseline), 'start');
      set({ values: start, dirty: [], errors: {}, warnings: withValues(start, () => collectWarnings([])), warning: null, warningField: null, unread: {}, takenOut: {} });
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

/** The kinds of field whose value as its source holds it warns of its own checks, never refuses a save that leaves it (`asStored`). */
const KEPT_AS_STORED = new Set<string | undefined>(['char', 'text', 'html', 'integer', 'float', 'monetary', 'boolean', 'date', 'datetime', 'selection', 'many2one', 'many2many', 'reference', 'binary', 'image']);

/** Two ways out taken the same way: the one joined answers for the other. */
const sameHow = (a: LeaveHow, b: LeaveHow) => !!a.changes === !!b.changes && !!a.discard === !!b.discard;

/** Two lists of names the same, in the same order. */
const sameList = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((name, i) => name === b[i]);
/** Whether what waits for an app's answer is the same as before: the same paths, each waiting or failed for the same reason. */
const sameAsked = (shown: Readonly<Record<string, AskedFor>>, now: ReadonlyMap<string, AskedFor>) => Object.keys(shown).length === now.size && [...now].every(([path, found]) => shown[path] !== undefined && shown[path].failed === found.failed);

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
  // Of another shape (an app's write): compared as it is, never a failure.
  const ids = (value: unknown) => (Array.isArray(value) ? value.map(id) : (value ?? []));
  if (def?.type === 'many2many') return JSON.stringify(ids(a)) === JSON.stringify(ids(b));
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

function indexLayout(root: RootLayout, functions?: FunctionTable): Map<string, IndexedNode> {
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
      invisible: compileModifier(modifiers.invisible, functions),
      readonly: compileModifier(modifiers.readonly, functions),
      required: compileModifier(modifiers.required, functions),
      ...(pressed !== undefined ? { pressed: compileModifier(pressed, functions) } : {}),
      ...(does.length ? { does } : {}),
      source,
    });
    // A menu's built-in Archive shows while the record is active, Unarchive while it is not.
    const builtin = (source as MenuItem).builtin;
    if (builtin === 'archive' || builtin === 'unarchive') {
      const own = index.get(source.id) as IndexedNode;
      const mine = own.invisible;
      // It reads `active` too: a form keeping what its conditions said reads it again as that changes.
      own.invisible = { ...mine, fields: [...new Set(['active', ...mine.fields])], evaluate: (context, env) => (context['active'] === false) !== (builtin === 'unarchive') || mine.evaluate(context, env) };
    }
    // A button's menu, and a menu inside a menu: each item a button of the record, hidden with it.
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
      } else if (node.type === 'related') {
        add(node, parent, 'other', { invisible: node.invisible });
        // A row's buttons: their roles here, hidden with the list, their condition read by it on each row's record.
        for (const button of node.rowButtons ?? []) add(button, node.id, 'button', {});
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
    // A row's buttons: their roles here, their condition read by the list on each row's record, which the form does not hold.
    for (const button of root.rowButtons ?? []) add(button, root.id, 'button', {});
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
    // The gear menu's items are buttons of the record — those of a menu inside it too, hidden with the item that opens
    // it (add's own); Archive shows while it is active, Unarchive while it is not.
    for (const item of root.toolbar?.menu ?? []) add(item, root.id, 'button', { invisible: item.invisible });
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
