import type { Field, FilterItem, LineField, Option, OptionsFrom } from '../format/field';
import type { JsonValue } from '../format/json';
import type { ButtonNode, FieldNode, LayoutNode, Modifier, RootLayout, StatButton, StepNode } from '../format/layout';
import type { Page } from '../format/page';
import { compileModifier, type CompiledModifier } from '../expression/modifier';
import type { ExpressionEnv } from '../expression/functions';
import { localDay } from '../expression/functions';
import { checkValue } from './check';
import { checkInput } from './inputs';
import { compileComputed } from './compute';
import { compileSetWhen } from './set-when';
import { checkRules, compileRules, type CompiledRule } from './rules';
import { expressionEnv } from './env';
import { MESSAGES, type Messages } from './messages';
import { saveProblemOf, type DataSource, type LineOp, type LinkOp, type RecordChanges, type ResolvedFilter, type SaveProblem } from './data-source';
import { hostScheduler, type Scheduler } from './scheduler';
import {
  emptyValue,
  expressionContext,
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
  /** Messages by field name; a line's field is `field.lineKey.subfield`. */
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

export interface ActionRequest {
  /** The button or stat button pressed. */
  id: string;
  action: string;
  params?: { [key: string]: JsonValue };
  recordId: RecordId | null;
  values: Values;
  /** The records chosen in a list, when the button belongs to one. */
  recordIds?: RecordId[];
}

export interface FormOptions {
  page: Page;
  dataSource?: DataSource;
  /** The record to edit. Leave out for a new record or a survey. */
  recordId?: RecordId | null;
  /** Values to start with, on top of each field's default. */
  values?: Values;
  /** What a button does. Fieldia hands the press over; the app decides. */
  onAction?: (request: ActionRequest) => void | Promise<void>;
  drafts?: { store: DraftStore; restore?: 'auto' | 'ask'; delayMs?: number };
  autosave?: { delayMs: number };
  scheduler?: Scheduler;
  /** Validation messages in the page's language. English by default. */
  messages?: Messages;
  /** The clock, for `today()` and for dates that must be past or future. The computer's own when left out. */
  now?: () => Date;
}

export interface Form {
  readonly page: Page;
  getState(): FormState;
  subscribe(listener: (state: FormState) => void): () => void;
  load(): Promise<void>;
  setValue(name: string, value: Value): void;
  node(id: string): NodeState;
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
   * Load, or load again, the choices of a selection whose options come from
   * the app's list (`optionsFrom`). Once loaded, they load again by themselves
   * when a field they change with changes; the latest answer wins.
   */
  loadChoices(field: string): void;
  /** Records a many2one, many2many or reference may point to. A reference needs `options.model`. */
  search(field: string, query: string, limit?: number, options?: { model?: string }): Promise<RelatedRecord[]>;
  /** The same, for a relation inside a one2many line, filtered by that line's values. */
  searchLine(field: string, key: string, subfield: string, query: string, limit?: number): Promise<RelatedRecord[]>;
  /** Whether a link field can make a record from a typed name: the data source must be able to. */
  canCreate(field: string): boolean;
  /** Make a record from a typed name, for the link field to point to. */
  quickCreate(field: string, name: string): Promise<RelatedRecord>;
  /** The same, for a link inside a one2many's lines. */
  canCreateLine(field: string, subfield: string): boolean;
  quickCreateLine(field: string, subfield: string, name: string): Promise<RelatedRecord>;
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
  /** Run a button; a list's button passes the records chosen in it. */
  runAction(id: string, chosen?: { recordIds: RecordId[] }): Promise<void>;
  restoreDraft(): void;
  discardDraft(): void;
  /** Resolves once every onchange, save and autosave started so far has finished. */
  settled(): Promise<void>;
  dispose(): void;
}

interface IndexedNode {
  id: string;
  parent: string | null;
  kind: 'field' | 'button' | 'stat' | 'other' | 'step';
  field?: string;
  invisible: CompiledModifier;
  readonly: CompiledModifier;
  required: CompiledModifier;
  source: LayoutNode | StepNode | ButtonNode | StatButton | RootLayout | { id: string; invisible?: Modifier };
}

/**
 * The record state behind a page: values, what changed, what is visible and
 * required, errors, loading and saving. No DOM and no framework — every
 * binding renders from `getState()` and calls these methods.
 */
export function createForm(options: FormOptions): Form {
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
  /** Whether any rule only warns: without one, there are never warnings to look for. */
  const warns = [...nodeRules.values()].some((rules) => rules.some((compiled) => compiled.rule.level === 'warning'));
  const steps = page.layout.type === 'wizard' ? page.layout.children.map((step) => step.id) : [];
  const draftKey = () => `fieldia:draft:${page.id}:${state.recordId ?? 'new'}`;
  const today = () => localDay(options.now?.() ?? new Date());
  const computed = compileComputed(page, today);
  const setWhen = compileSetWhen(page, today);

  let baseline: Values = computed.apply({ ...initialValues(page.fields, today()), ...structuredCopy(options.values ?? {}) });
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
  };
  /** Field errors a refused save brought, each kept until its field changes from the value it was refused with. */
  let serverErrors: Record<string, { message: string; value: string }> = {};
  let lineKeys = 0;
  let onchangeSeq = 0;
  let draftTimer: unknown = null;
  let autosaveTimer: unknown = null;
  const pending = new Set<Promise<unknown>>();
  const listeners = new Set<(state: FormState) => void>();
  let contextCache: { values: Values; context: Record<string, unknown>; env: ExpressionEnv } | null = null;

  /** The latest load of each field's choices: an answer to an older one is let go. */
  const choiceLoads: Record<string, number> = {};

  function set(patch: Partial<FormState>) {
    const was = state.values;
    state = { ...state, ...patch };
    for (const listener of [...listeners]) listener(state);
    // Choices that change with a value that just changed are asked for again.
    if (state.values !== was) {
      for (const name in state.choices) if (fromList(name).dependsOn?.some((other) => was[other] !== state.values[other])) loadChoices(name);
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

  /** The values as expressions read them, and what else they read: the lines' rows, today. */
  function reading(): { context: Record<string, unknown>; env: ExpressionEnv } {
    if (contextCache?.values !== state.values) {
      const values = state.values as Values;
      contextCache = { values, context: expressionContext(values, page.fields), env: expressionEnv(values, page.fields, today) };
    }
    return contextCache;
  }

  const context = () => reading().context;

  function fieldDef(name: string): Field {
    const def = page.fields[name];
    if (!def) throw new Error(`The page has no field "${name}"`);
    return def;
  }

  function dirtyFields(values: Values): string[] {
    return Object.keys(page.fields).filter((name) => JSON.stringify(values[name] ?? null) !== JSON.stringify(baseline[name] ?? null));
  }

  function nodeState(id: string): NodeState {
    const node = index.get(id);
    if (!node) throw new Error(`The page has no element "${id}"`);
    const { context: ctx, env } = reading();
    let invisible = node.invisible.evaluate(ctx, env);
    for (let parent = node.parent; !invisible && parent; parent = index.get(parent)?.parent ?? null) {
      invisible = index.get(parent)?.invisible.evaluate(ctx, env) ?? false;
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

  /** Field nodes inside `root` (or the whole page), visible right now. */
  function visibleFieldNodes(root?: string): IndexedNode[] {
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
    return [...index.values()].filter((node) => node.kind === 'field' && inside(node) && !skipped(node) && !nodeState(node.id).invisible);
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

  /** A field node's error now: its field's own rules first, then its answer rules. */
  function nodeError(node: IndexedNode): string | undefined {
    const name = node.field as string;
    return checkInput(page.fields[name], node.source as FieldNode, state.values[name], messages) ?? checkValue(checked(name), state.values[name], nodeState(node.id).required, messages, today()) ?? ruleCheck(node).error;
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
          for (const [sub, subDef] of Object.entries(def.fields)) {
            if (kind && sub !== def.lineKinds?.text) continue;
            const lineMessage = checkValue(subDef, line.values[sub], subDef.required === true, messages, today());
            if (lineMessage) errors[`${name}.${line.key}.${sub}`] = lineMessage;
          }
        }
      }
    }
    return errors;
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
    const values = fresh ? startFrom(written) : settle(written);
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
      ? Object.keys(page.fields).filter((name) => state.dirty.includes(name) || !isEmpty(page.fields[name], state.values[name]))
      : state.dirty;
    for (const name of names) {
      const def = page.fields[name];
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
    return shown;
  }

  async function save(): Promise<boolean> {
    const errors = collectErrors();
    if (Object.keys(errors).length) {
      set({ errors });
      return false;
    }
    const source = options.dataSource;
    serverErrors = {};
    set({ status: 'saving', errors: {}, error: null, saveProblem: null });
    try {
      if (page.data.kind === 'responses') {
        if (!source?.submit) throw new Error('This page has no data source to send its answers to');
        await source.submit({ pageId: page.id, values: shownValues() });
        forgetDraft();
        set({ status: 'saved' });
        return true;
      }
      if (!source?.save) throw new Error('This page has no data source to save to');
      const result = await source.save({
        model: page.data.model,
        id: state.recordId,
        fields: page.fields,
        changes: changes(),
        values: structuredCopy(state.values as Values),
      });
      forgetDraft();
      const values = startFrom(result.values ? { ...(state.values as Values), ...result.values } : (state.values as Values));
      baseline = structuredCopy(values);
      set({ status: 'saved', recordId: result.id, values, dirty: [], warnings: withValues(values, collectWarnings) });
      return true;
    } catch (error) {
      const problem = saveProblemOf(error);
      const fields = problem.kind === 'fields' ? problem.fields ?? {} : {};
      serverErrors = Object.fromEntries(Object.entries(fields).map(([name, message]) => [name, { message, value: JSON.stringify(state.values[name] ?? null) }]));
      set({ status: 'error', error: problem.message, saveProblem: problem, errors: { ...fields } });
      return false;
    }
  }

  /** The model a link field's new record belongs to, or null when it cannot make one. */
  function creatable(def: Field | LineField | undefined): string | null {
    if (!options.dataSource?.create || !def || def.readonly) return null;
    return def.type === 'many2one' || def.type === 'many2many' ? def.relation : null;
  }

  async function runCreate(def: Field | LineField | undefined, name: string, typed: string): Promise<RelatedRecord> {
    const model = creatable(def);
    const source = options.dataSource;
    if (!model || !source?.create) throw new Error(`"${name}" cannot make records: its data source has no create, or it is not a link`);
    return track(source.create({ model, name: typed.trim() }));
  }

  async function runSearch(
    def: Field | LineField,
    name: string,
    ctx: Record<string, unknown>,
    query: string,
    limit: number,
    model?: string
  ): Promise<RelatedRecord[]> {
    if (def.type !== 'many2one' && def.type !== 'many2many' && def.type !== 'reference') {
      throw new Error(`"${name}" is not a many2one, many2many or reference`);
    }
    if (def.type === 'reference' && !model) throw new Error(`Searching "${name}" needs a model`);
    const source = options.dataSource;
    if (!source?.search) return [];
    // Every valueFrom, in groups too, becomes the value it names before the search goes out.
    const resolve = (item: FilterItem): ResolvedFilter =>
      'any' in item
        ? { any: item.any.map(resolve) }
        : 'all' in item
          ? { all: item.all.map(resolve) }
          : { field: item.field, op: item.op, value: (item.valueFrom !== undefined ? ctx[item.valueFrom] ?? null : item.value ?? null) as JsonValue };
    const filter: ResolvedFilter[] | undefined = def.type === 'reference' ? undefined : def.filter?.map(resolve);
    const relation = def.type === 'reference' ? (model as string) : def.relation;
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

  async function load(): Promise<void> {
    const source = options.dataSource;
    if (state.recordId == null || page.data.kind !== 'record') return;
    if (!source?.load) {
      set({ status: 'error', error: 'This page has no data source to load from' });
      return;
    }
    set({ status: 'loading', error: null });
    try {
      const loaded = await source.load({ model: page.data.model, id: state.recordId, fields: page.fields });
      baseline = startFrom({ ...initialValues(page.fields, today()), ...loaded });
      set({ status: 'ready', values: structuredCopy(baseline), dirty: [], errors: {}, warnings: withValues(baseline, collectWarnings) });
      offerDraft();
    } catch (error) {
      set({ status: 'error', error: (error as Error).message });
    }
  }

  const form: Form = {
    page,
    getState: () => state,

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    load: () => track(load()),

    setValue(name, value) {
      fieldDef(name);
      writeValues({ ...(state.values as Values), [name]: structuredCopy(value) });
      afterEdit(name);
    },

    node: nodeState,

    fieldReadonly: (name) => lockedField(fieldDef(name)),

    loadChoices,

    problem(name) {
      fieldDef(name);
      // Only a field someone can see is asked anything, and required wherever it is shown so.
      const shown = visibleFieldNodes().filter((node) => node.field === name);
      if (!shown.length) return null;
      const own =
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
      set({ values: structuredCopy(baseline), dirty: [], errors: {}, warnings: withValues(baseline, collectWarnings), warning: null, warningField: null, draft: null, step: steps[0] ?? null, skipped: [], saveProblem: null });
    },

    changes,

    addLine(field, values = {}) {
      const def = lineField(field);
      const key = `new-${++lineKeys}`;
      const current = (state.values[field] as Line[] | null) ?? [];
      const line: Line = { key, values: { ...initialValues(def.fields as Record<string, LineField>, today()), ...structuredCopy(values) } };
      // A new line comes last, so it is numbered after the last.
      if (def.sequenceField && line.values[def.sequenceField] == null) {
        const numbers = current.map((l) => l.values[def.sequenceField as string]).filter((n): n is number => typeof n === 'number');
        line.values[def.sequenceField] = numbers.length ? Math.max(...numbers) + 1 : 1;
      }
      const lines = [...current, line];
      writeValues({ ...(state.values as Values), [field]: lines });
      afterEdit(field);
      return key;
    },

    updateLine(field, key, name, value) {
      const def = lineField(field);
      if (!def.fields[name]) throw new Error(`The lines of "${field}" have no field "${name}"`);
      const lines = ((state.values[field] as Line[] | null) ?? []).map((line) =>
        line.key === key ? { ...line, values: { ...line.values, [name]: structuredCopy(value) } } : line
      );
      writeValues({ ...(state.values as Values), [field]: lines });
      afterEdit(field);
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
    },

    removeLine(field, key) {
      lineField(field);
      const lines = ((state.values[field] as Line[] | null) ?? []).filter((line) => line.key !== key);
      writeValues({ ...(state.values as Values), [field]: lines });
      afterEdit(field);
    },

    async search(field, query, limit = 8, options = {}) {
      return runSearch(fieldDef(field), field, context(), query, limit, options.model);
    },

    async previewLine(field, key, values) {
      lineField(field);
      const lines = (state.values[field] as Line[] | null) ?? [];
      const line = lines.find((l) => l.key === key);
      if (!line) throw new Error(`"${field}" has no line "${key}"`);
      const merged = computed.line(field, { ...line.values, ...values });
      const source = options.dataSource;
      if (!source?.onchange || page.data.kind !== 'record') return merged;
      const changed = lines.map((l) => (l.key === key ? { ...l, values: merged } : l));
      const result = await source.onchange({ model: page.data.model, id: state.recordId, changed: field, values: structuredCopy({ ...(state.values as Values), [field]: changed }) });
      const after = ((result.values?.[field] as Line[] | undefined) ?? []).find((l) => l.key === key);
      return after ? computed.line(field, { ...merged, ...after.values }) : merged;
    },

    async searchLine(field, key, subfield, query, limit = 8) {
      const def = lineField(field);
      const sub = def.fields[subfield];
      if (!sub) throw new Error(`The lines of "${field}" have no field "${subfield}"`);
      const line = ((state.values[field] as Line[] | null) ?? []).find((l) => l.key === key);
      if (!line) throw new Error(`"${field}" has no line "${key}"`);
      return runSearch(sub, subfield, expressionContext(line.values, def.fields as Record<string, LineField>), query, limit);
    },

    canCreate: (field) => creatable(page.fields[field]) !== null,
    quickCreate: (field, typed) => runCreate(page.fields[field], field, typed),
    canCreateLine: (field, subfield) => creatable(lineField(field).fields[subfield]) !== null,
    quickCreateLine: (field, subfield, typed) => runCreate(lineField(field).fields[subfield], subfield, typed),

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
      if (nodeState(id).invisible) return;
      const source = node.source as ButtonNode | StatButton;
      await track(
        Promise.resolve(
          options.onAction?.({
            id,
            action: source.action,
            ...('params' in source && source.params ? { params: source.params } : {}),
            recordId: state.recordId,
            values: structuredCopy(state.values as Values),
            ...(chosen ? { recordIds: [...chosen.recordIds] } : {}),
          })
        )
      );
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

    dispose() {
      if (draftTimer !== null) scheduler.clearTimeout(draftTimer);
      if (autosaveTimer !== null) scheduler.clearTimeout(autosaveTimer);
      listeners.clear();
    },
  };

  // A record's starting values may already break a warning rule; nothing listens yet.
  state = { ...state, warnings: collectWarnings() };
  if (state.recordId == null) offerDraft();
  return form;
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
    index.set(source.id, {
      id: source.id,
      parent,
      kind,
      field: modifiers.field,
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
    shown('#statusbar', root.statusbar?.field);
    for (const button of root.buttons ?? []) add(button, root.id, 'button', { invisible: button.invisible });
    for (const stat of root.statButtons ?? []) add(stat, root.id, 'stat', { invisible: stat.invisible });
    if (root.ribbon) add(root.ribbon, root.id, 'other', { invisible: root.ribbon.invisible });
    for (const alert of root.alerts ?? []) add(alert, root.id, 'other', { invisible: alert.invisible });
    for (const badge of root.badges ?? []) add(badge, root.id, 'other', { invisible: badge.invisible });
    // Fields over and under the title are field nodes like any other.
    walk([...(root.title?.above ?? []), ...(root.title?.below ?? [])], root.id);
    walk(root.children, root.id);
    if (root.sidePanel) add(root.sidePanel, root.id, 'other', { invisible: root.sidePanel.invisible });
  }
  return index;
}
