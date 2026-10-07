import type { ActionStep } from '../format/actions';
import type { DefinitionsFrom, Field, Fields, LineField, Option, OptionsFrom, PropertyDefinition } from '../format/field';
import type { ButtonNode, FieldNode, FormNode, LayoutNode, MenuItem, Modifier, RootLayout, StatButton, StepNode } from '../format/layout';
import type { Page } from '../format/page';
import { compileModifier, type CompiledModifier } from '../expression/modifier';
import type { ExpressionEnv } from '../expression/functions';
import { localDay } from '../expression/functions';
import { checkValue } from './check';
import { checkInput } from './inputs';
import { compileComputed } from './compute';
import { compileSetWhen } from './set-when';
import { checkRules, compileRules, type CompiledRule } from './rules';
import { expressionEnv, lineContext, recordContext } from './env';
import { firstValues, readLooseMap, readValueMap, type MapScope } from './value-map';
import { resolveFilter } from './filter';
import { rolesAllow } from './roles';
import { compileFieldTone, compileTable, type CompiledTable, type FieldTone, type LineState } from './cells';
import { MESSAGES, type Messages } from './messages';
import { saveProblemOf, type DataSource, type LineOp, type LinkOp, type RecordChanges, type ResolvedFilter, type SaveProblem } from './data-source';
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
  /** Write several fields at once, worked out once: the app's change, never a person's. Throws for a field the page lacks. */
  setValues(values: Values): void;
  node(id: string): NodeState;
  /** Whether the record is being edited, as conditions read `editing`: a view that locks it to be read says false, and parts follow. */
  setEditing(editing: boolean): void;
  fieldReadonly(name: string): boolean;
  /** What a field would be told if the form were checked now, or null when it passes. Nothing is shown. */
  problem(field: string): string | null;
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
   * saved are dropped: save first. The page's `open` steps run for it.
   */
  openRecord(id: RecordId | null): Promise<void>;
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
  /** The same, for a relation inside a one2many line, filtered by that line's values. */
  searchLine(field: string, key: string, subfield: string, query: string, limit?: number): Promise<RelatedRecord[]>;
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
  source: LayoutNode | StepNode | ButtonNode | StatButton | MenuItem | RootLayout | { id: string; invisible?: Modifier };
}

/**
 * The record state behind a page: values, what changed, what is visible and
 * required, errors, loading and saving. No DOM and no framework — every
 * binding renders from `getState()` and calls these methods.
 */
export function createForm(options: FormOptions): Form {
  return innerForm(options, []).form;
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
}

type Sync = 'start' | 'edit' | 'fresh';

const isRecord = (value: unknown): value is Values => value !== null && typeof value === 'object' && !Array.isArray(value);
/** A saved form's answers, as the one value they are in the form round it. */
const asValue = (values: Readonly<Values>) => values as unknown as Value;

/** `within` are the pages round this one, outermost first: a page among them placed again would hold itself. */
function innerForm(options: FormOptions, within: string[]): InnerForm {
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
    if (source.cells || source.rowTones || source.rowBold !== undefined || source.rowButtons) tables.set(node.id, { field: source.field, compiled: compileTable(source) });
  }
  /** Field nodes whose value takes a tone or bold, by id: each read once. */
  const fieldTones = new Map<string, ReturnType<typeof compileFieldTone>>();
  for (const node of index.values()) {
    const source = node.source as FieldNode;
    if (node.kind === 'field' && (source.tones || source.bold !== undefined)) fieldTones.set(node.id, compileFieldTone(source));
  }
  /** Whether any rule only warns: without one, there are never warnings to look for. */
  const warns = [...nodeRules.values()].some((rules) => rules.some((compiled) => compiled.rule.level === 'warning'));
  const steps = page.layout.type === 'wizard' ? page.layout.children.map((step) => step.id) : [];
  const draftKey = () => `fieldia:draft:${page.id}:${state.recordId ?? 'new'}`;
  const today = () => localDay(options.now?.() ?? new Date());
  // The record's id and the person, as worked-out values read them: the id is the one asked for until the form has its state.
  let started = false;
  let editing = options.editing !== false;
  const about = () => ({ recordId: started ? state.recordId : (options.recordId ?? null), user: options.user, editing });
  const computed = compileComputed(page, today, about);
  const setWhen = compileSetWhen(page, today, about);
  /** The saved forms placed on the page, by the part's id: each one's answers sit under its name, as JSON. */
  const parts = new Map<string, FormNode>();
  for (const node of index.values()) if (node.kind === 'form') parts.set(node.id, node.source as FormNode);
  /** Those given their page, with the inner form that holds their answers. */
  const attached = new Map<string, { name: string; inner: InnerForm }>();
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
      const about = { recordId: null, user: options.user };
      Object.assign(values, firstValues(page.fields, mapScope(values, page.fields, recordContext(values, page.fields, about), expressionEnv(values, page.fields, today))));
    }
    return given ? { ...values, ...structuredCopy(options.values ?? {}) } : values;
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
    if (!table) return { tone: null, bold: false, cells: {}, buttons: {} };
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
  };
  started = true;
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
    emit('change', { field, value: state.values[field], values: state.values, by });
    const list = page.on?.change?.[field];
    if (by === 'person' && list) void track(moment(`on.change.${field}`, list, [], true));
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
    return def.type === 'selection' && def.optionsFrom && loaded ? { ...def, options: loaded, optionsFrom: undefined } : def;
  }

  function track<T>(promise: Promise<T>): Promise<T> {
    pending.add(promise);
    const done = () => pending.delete(promise);
    promise.then(done, done);
    return promise;
  }

  /** The values as expressions read them, and what else they read: the record's id, the person, the lines' rows, today. */
  function reading(): { context: Record<string, unknown>; env: ExpressionEnv } {
    if (contextCache?.values !== state.values || contextCache.recordId !== state.recordId || contextCache.editing !== editing) {
      const values = state.values as Values;
      const context = recordContext(values, page.fields, about());
      contextCache = { values, recordId: state.recordId, editing, context, env: expressionEnv(values, page.fields, today) };
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
    return {
      invisible,
      readonly: readonly || (def !== undefined && lockedField(def)),
      required: node.required.evaluate(ctx, env) || def?.required === true,
    };
  }

  /** Field nodes — or saved forms placed on the page — inside `root` (or the whole page), visible right now. */
  function visibleFieldNodes(root?: string, kind: IndexedNode['kind'] = 'field'): IndexedNode[] {
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
    return [...index.values()].filter((node) => node.kind === kind && inside(node) && !skipped(node) && !nodeState(node.id).invisible);
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

  /** Errors for the visible fields under `root`, without publishing them. */
  function collectErrors(root?: string): Record<string, string> {
    const errors: Record<string, string> = {};
    for (const node of visibleFieldNodes(root)) {
      const name = node.field as string;
      if (errors[name]) continue;
      const def = page.fields[name];
      const message = nodeError(node);
      if (message) errors[name] = message;
      if (def.type === 'one2many') {
        for (const line of (state.values[name] as Line[] | null) ?? []) {
          // A section or note answers only for its text, never for what an item needs.
          const kind = lineKind(def, line.values);
          // The table's own rules: a cell its line hides asks nothing, one it requires asks for a value.
          const ruled = tables.has(node.id) ? lineStateOf(node.id, line.key).cells : {};
          for (const [sub, subDef] of Object.entries(def.fields)) {
            if (kind && sub !== def.lineKinds?.text) continue;
            const cell = ruled[sub];
            if (cell?.invisible || (tables.has(node.id) && tables.get(node.id)!.compiled.hidden(sub, reading().context, reading().env))) continue;
            const lineMessage = checkValue(subDef, line.values[sub], subDef.required === true || cell?.required === true, messages, today());
            if (lineMessage) errors[`${name}.${line.key}.${sub}`] = lineMessage;
          }
        }
      }
    }
    // A saved form placed here answers for its fields by its own page's rules.
    for (const node of visibleFieldNodes(root, 'form')) {
      const part = attached.get(node.id);
      if (part) for (const [key, message] of Object.entries(part.inner.errorsNow())) errors[`${part.name}.${key}`] = message;
    }
    return errors;
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
    const errors = Object.keys(state.errors).length ? revalidateShown(values) : state.errors;
    set({ values, dirty: dirtyFields(values), errors, warnings: withValues(values, collectWarnings), ...extra });
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
    return kept;
  }

  function scheduleDraft() {
    const drafts = options.drafts;
    if (!drafts) return;
    if (draftTimer !== null) scheduler.clearTimeout(draftTimer);
    draftTimer = scheduler.setTimeout(() => {
      draftTimer = null;
      drafts.store.setItem(draftKey(), JSON.stringify({ savedAt: new Date().toISOString(), values: state.values }));
    }, drafts.delayMs ?? 400);
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
    if (drafts.restore === 'auto') writeValues({ ...state.values, ...draft.values }, { draft: null }, true);
    else set({ draft: { savedAt: draft.savedAt } });
  }

  function scheduleAutosave() {
    const autosave = options.autosave;
    if (!autosave || page.data.kind !== 'record') return;
    if (autosaveTimer !== null) scheduler.clearTimeout(autosaveTimer);
    autosaveTimer = scheduler.setTimeout(() => {
      autosaveTimer = null;
      if (state.dirty.length && Object.keys(collectErrors()).length === 0) void track(save());
    }, autosave.delayMs);
  }

  function runOnchange(changed: string) {
    const source = options.dataSource;
    if (!source?.onchange || page.data.kind !== 'record') return;
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

  /**
   * Save, or send: null once done, or why not. The page's `beforeSave` steps
   * run first — before its own check, so they may fill in what it asks for —
   * and a stop keeps it unsaved; `afterSave` runs once it is saved.
   */
  async function saving(chain: readonly string[]): Promise<Stopped | null> {
    if (page.on?.beforeSave) {
      const before = await moment('on.beforeSave', page.on.beforeSave, chain, false);
      if (!before.done) {
        // A check's problems, or an inner save's, are shown already; any other stop is this save's problem.
        if (before.reason !== 'check' && before.reason !== 'save') {
          const problem: SaveProblem = { kind: 'stopped', reason: before.reason, message: before.message ?? '' };
          set({ status: 'error', error: problem.message || null, saveProblem: problem });
        }
        return { reason: 'save', ...(before.message !== undefined ? { message: before.message } : {}) };
      }
    }
    const errors = collectErrors();
    if (Object.keys(errors).length) {
      set({ errors });
      return { reason: 'save', message: Object.values(errors)[0] };
    }
    const source = options.dataSource;
    serverErrors = {};
    set({ status: 'saving', errors: {}, error: null, saveProblem: null });
    try {
      if (page.data.kind === 'responses') {
        if (!source?.submit) throw new Error('This page has no data source to send its answers to');
        const sent = shownValues();
        await source.submit({ pageId: page.id, values: sent });
        forgetDraft();
        set({ status: 'saved' });
        emit('send', { values: sent });
        void track(moment('on.afterSave', page.on?.afterSave, chain, false));
        return null;
      }
      if (!source?.save) throw new Error('This page has no data source to save to');
      const result = await source.save({
        model: page.data.model,
        id: state.recordId,
        fields,
        changes: changes(),
        values: structuredCopy(state.values as Values),
      });
      forgetDraft();
      const values = syncParts(startFrom(result.values ? { ...(state.values as Values), ...result.values } : (state.values as Values)), 'start');
      baseline = structuredCopy(values);
      set({ status: 'saved', recordId: result.id, values, dirty: [], warnings: withValues(values, collectWarnings) });
      emit('save', { recordId: state.recordId, values: state.values });
      void track(moment('on.afterSave', page.on?.afterSave, chain, false));
      return null;
    } catch (error) {
      const problem = saveProblemOf(error);
      const fields = problem.kind === 'fields' ? problem.fields ?? {} : {};
      serverErrors = Object.fromEntries(Object.entries(fields).map(([name, message]) => [name, { message, value: JSON.stringify(state.values[name] ?? null) }]));
      set({ status: 'error', error: problem.message, saveProblem: problem, errors: { ...fields } });
      return { reason: 'save', message: problem.message };
    }
  }

  /** The form has its values: told to the app, its `open` steps run, then the wizard step it shows is told. */
  async function opening() {
    emit('open', { recordId: state.recordId, values: state.values });
    await moment('on.open', page.on?.open, [], true);
    showing = true;
    tellStep([]);
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
    const key = `new-${++lineKeys}`;
    const current = (state.values[field] as Line[] | null) ?? [];
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

  /** Check the form, or only these fields, showing what is found as sending does. */
  function check(names: readonly string[] | undefined): Stopped | null {
    names?.forEach(fieldDef);
    const all = collectErrors();
    const found = names ? Object.fromEntries(Object.entries(all).filter(([key]) => names.some((name) => key === name || key.startsWith(`${name}.`)))) : all;
    set({ errors: found });
    const first = Object.values(found)[0];
    return first === undefined ? null : { reason: 'check', message: first };
  }

  /** Go to a wizard's step for a run; undefined when the target is no step of it, but a tab. */
  function goToStep(target: string, chain: readonly string[]): Stopped | null | undefined {
    if (!steps.includes(target)) return undefined;
    if (!form.steps().includes(target)) return { reason: 'cannot', message: `The step "${target}" does not apply now` };
    let went = false;
    inRun(chain, () => (went = form.goTo(target)));
    return went ? null : { reason: 'check', message: Object.values(state.errors)[0] };
  }

  /** Run steps from the top — a button's, a moment's, the app's — and tell how it ended. */
  async function runTop(list: readonly ActionStep[], scope: RunScope): Promise<RunResult> {
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
    if (def.type !== 'many2one' && def.type !== 'many2many' && def.type !== 'reference' && def.type !== 'json') {
      throw new Error(`"${name}" is not a many2one, many2many, reference or json`);
    }
    if ((def.type === 'reference' || def.type === 'json') && !model) throw new Error(`Searching "${name}" needs a model`);
    const source = options.dataSource;
    if (!source?.search) return [];
    // Every valueFrom, in groups too, becomes the value it names before the search goes out.
    const own: ResolvedFilter[] | undefined = def.type === 'reference' || def.type === 'json' || !def.filter ? undefined : resolveFilter(def.filter, ctx);
    const filter = ids ? [...(own ?? []), { field: 'id', op: 'in' as const, value: ids }] : own;
    const relation = def.type === 'reference' || def.type === 'json' ? (model as string) : def.relation;
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
    set({ status: 'loading', error: null });
    try {
      const loaded = await source.load({ model: page.data.model, id: state.recordId, fields });
      if (seq !== loads) return;
      baseline = syncParts(startFrom({ ...initialValues(fields, today()), ...loaded }), 'start');
      set({ status: 'ready', values: structuredCopy(baseline), dirty: [], errors: {}, warnings: withValues(baseline, collectWarnings) });
      if (again) return;
      offerDraft();
      void track(opening());
    } catch (error) {
      if (seq === loads) set({ status: 'error', error: (error as Error).message });
    }
  }

  let loads = 0;

  /** Another record in this form's place, or a new one: what was there let go, the new one loaded and opened. */
  async function openRecord(id: RecordId | null): Promise<void> {
    if (draftTimer !== null) scheduler.clearTimeout(draftTimer);
    if (autosaveTimer !== null) scheduler.clearTimeout(autosaveTimer);
    draftTimer = autosaveTimer = null;
    serverErrors = {};
    told = null;
    showing = false;
    const fresh = { dirty: [], errors: {}, warning: null, warningField: null, error: null, draft: null, step: steps[0] ?? null, skipped: [], saveProblem: null };
    if (id != null) {
      set({ ...fresh, recordId: id, status: 'idle' });
      return load();
    }
    loads++;
    baseline = startFrom(startingValues(true, false));
    const values = syncParts(structuredCopy(baseline), 'start');
    set({ ...fresh, recordId: null, status: 'ready', values, warnings: withValues(values, collectWarnings) });
    offerDraft();
    await opening();
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
    addLine: (field, values) => void addLine(field, values, 'step'),
    check,
    save: saving,
    async reload() {
      if (state.recordId == null) return { reason: 'cannot', message: 'The record is not saved yet: there is nothing to load again' };
      await load(true);
      return state.status === 'error' ? { reason: 'cannot', message: state.error ?? 'The record could not be loaded again' } : null;
    },
    reset: () => form.reset(),
    goTo: goToStep,
    showing: inRun,
    host: options.host,
    confirm: options.confirm,
    onAction: options.onAction,
    answered: (request, result) => emit('action', { request, result }),
    changed: () => state.dirty.length > 0,
    ...(options.dataSource?.archive && page.data.kind === 'record' ? { archive: (archive: boolean) => track((options.dataSource?.archive as NonNullable<DataSource['archive']>)({ ...record(), archive })) } : {}),
    ...(options.dataSource?.copy && page.data.kind === 'record' ? { copy: async () => (await track((options.dataSource?.copy as NonNullable<DataSource['copy']>)(record()))).id } : {}),
    ...(options.dataSource?.delete && page.data.kind === 'record' ? { remove: () => track((options.dataSource?.delete as NonNullable<DataSource['delete']>)(record())) } : {}),
    async showRecord(id) {
      await openRecord(id);
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

    load: () => track(load()),

    setValue(name, value, how) {
      fieldDef(name);
      writeValues({ ...(state.values as Values), [name]: structuredCopy(value) });
      afterEdit(name);
      changed(name, how?.by ?? 'person');
    },

    setValues: (values) => write(values, 'app'),

    node: nodeState,

    openRecord: (id) => track(openRecord(id)),

    post,

    setEditing(next) {
      if (next === editing) return;
      editing = next;
      // Nothing of the record changed; what shows of it may have.
      set({});
    },

    fieldReadonly: (name) => lockedField(fieldDef(name)),

    loadChoices,
    loadDefinitions,
    addDefinition,

    problem(name) {
      fieldDef(name);
      // Only a field someone can see is asked anything, and required wherever it is shown so.
      const shown = visibleFieldNodes().filter((node) => node.field === name);
      if (!shown.length) return null;
      const own =
        shown.map(unticked).find(Boolean) ??
        shown.map((node) => checkInput(page.fields[name], node.source as FieldNode, state.values[name], messages)).find(Boolean) ??
        checkValue(checked(name), state.values[name], shown.some((node) => nodeState(node.id).required), messages, today());
      return own ?? shown.map((node) => ruleCheck(node).error).find((error) => error !== undefined) ?? null;
    },

    validate() {
      const errors = collectErrors();
      set({ errors });
      return Object.keys(errors).length === 0;
    },

    save: () => track(save()),

    reset() {
      forgetDraft();
      serverErrors = {};
      holding = setWhen.holding(baseline);
      const values = syncParts(structuredCopy(baseline), 'start');
      set({ values, dirty: [], errors: {}, warnings: withValues(values, collectWarnings), warning: null, warningField: null, draft: null, step: steps[0] ?? null, skipped: [], saveProblem: null });
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

    async searchLine(field, key, subfield, query, limit = 8) {
      const def = lineField(field);
      const sub = def.fields[subfield];
      if (!sub) throw new Error(`The lines of "${field}" have no field "${subfield}"`);
      const line = ((state.values[field] as Line[] | null) ?? []).find((l) => l.key === key);
      if (!line) throw new Error(`"${field}" has no line "${key}"`);
      return runSearch(sub, subfield, lineContext(line.values, def.fields as Record<string, LineField>, context(), line.id ?? null), query, limit);
    },

    canCreate: (field) => creatable(page.fields[field]) !== null,
    quickCreate: (field, typed) => runCreate(page.fields[field], field, typed, page.fields[field] ? createValuesOf(field) : {}),
    canCreateLine: (field, subfield) => creatable(lineField(field).fields[subfield]) !== null,
    quickCreateLine: (field, subfield, typed, key) => runCreate(lineField(field).fields[subfield], subfield, typed, key ? createValuesOf(subfield, { lines: field, key }) : {}),
    createValues: (field, line) => createValuesOf(field, line),

    steps: () => steps.filter((id) => !nodeState(id).invisible),

    next() {
      if (!state.step) return false;
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
    lineState: (nodeId, key) => lineStateOf(nodeId, key),
    columnHidden(nodeId, column) {
      const table = tableOf(nodeId);
      const { context, env } = reading();
      return table ? table.compiled.hidden(column, context, env) : false;
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
      writeValues({ ...(state.values as Values), ...draft.values }, { draft: null }, true);
    },

    discardDraft() {
      forgetDraft();
      set({ draft: null });
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
        chain
      );
      attached.set(id, { name: part.name, inner: made });
      // A change inside it is told as a change of its answers here, whoever made it.
      made.form.on('change', ({ by }) => {
        if (!syncing) changed(part.name, by);
      });
      // A change made inside it is a change of this form's: shown, kept in a draft, saved.
      made.form.subscribe((inside) => {
        if (syncing || inside.values === state.values[part.name]) return;
        writeValues({ ...(state.values as Values), [part.name]: asValue(inside.values) });
        afterEdit(part.name);
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
      baseline = startFrom({ ...initialValues(page.fields, today()), ...structuredCopy(values) });
      const start = syncParts(structuredCopy(baseline), 'start');
      set({ values: start, dirty: [], errors: {}, warnings: withValues(start, collectWarnings), warning: null, warningField: null });
    },
    errorsNow: () => collectErrors(),
    show(errors) {
      if (JSON.stringify(errors) !== JSON.stringify(state.errors)) set({ errors });
    },
  };
}

/** The problems found inside a saved form, by its own fields' names. */
function inside(errors: Readonly<Record<string, string>>, name: string): Record<string, string> {
  const found: Record<string, string> = {};
  for (const [key, message] of Object.entries(errors)) if (key.startsWith(`${name}.`)) found[key.slice(name.length + 1)] = message;
  return found;
}

/** A field no one types in: read-only by its definition, or worked out from others. */
function lockedField(def: Field): boolean {
  return def.readonly === true || def.compute !== undefined;
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
    index.set(source.id, {
      id: source.id,
      parent,
      kind,
      field: modifiers.field,
      ...(roles?.length ? { roles } : {}),
      invisible: compileModifier(modifiers.invisible),
      readonly: compileModifier(modifiers.readonly),
      required: compileModifier(modifiers.required),
      source,
    });
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
