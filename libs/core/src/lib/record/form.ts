import type { Field, LineField } from '../format/field';
import type { JsonValue } from '../format/json';
import type { ButtonNode, LayoutNode, Modifier, RootLayout, StatButton, StepNode } from '../format/layout';
import type { Page } from '../format/page';
import { compileModifier, type CompiledModifier } from '../expression/modifier';
import { checkValue } from './check';
import { MESSAGES, type Messages } from './messages';
import type { DataSource, LineOp, LinkOp, RecordChanges, ResolvedFilterCondition } from './data-source';
import { hostScheduler, type Scheduler } from './scheduler';
import {
  expressionContext,
  initialValues,
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
}

export interface Form {
  readonly page: Page;
  getState(): FormState;
  subscribe(listener: (state: FormState) => void): () => void;
  load(): Promise<void>;
  setValue(name: string, value: Value): void;
  node(id: string): NodeState;
  fieldReadonly(name: string): boolean;
  validate(): boolean;
  save(): Promise<boolean>;
  reset(): void;
  changes(): RecordChanges;
  addLine(field: string, values?: Values): string;
  updateLine(field: string, key: string, name: string, value: Value): void;
  removeLine(field: string, key: string): void;
  /** Records a many2one, many2many or reference may point to. A reference needs `options.model`. */
  search(field: string, query: string, limit?: number, options?: { model?: string }): Promise<RelatedRecord[]>;
  /** The same, for a relation inside a one2many line, filtered by that line's values. */
  searchLine(field: string, key: string, subfield: string, query: string, limit?: number): Promise<RelatedRecord[]>;
  steps(): string[];
  next(): boolean;
  back(): boolean;
  runAction(id: string): Promise<void>;
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
  const steps = page.layout.type === 'wizard' ? page.layout.children.map((step) => step.id) : [];
  const draftKey = () => `fieldia:draft:${page.id}:${state.recordId ?? 'new'}`;

  let baseline: Values = { ...initialValues(page.fields), ...structuredCopy(options.values ?? {}) };
  let state: FormState = {
    status: options.recordId != null ? 'idle' : 'ready',
    recordId: options.recordId ?? null,
    values: structuredCopy(baseline),
    errors: {},
    dirty: [],
    warning: null,
    warningField: null,
    error: null,
    draft: null,
    step: steps[0] ?? null,
  };
  let lineKeys = 0;
  let onchangeSeq = 0;
  let draftTimer: unknown = null;
  let autosaveTimer: unknown = null;
  const pending = new Set<Promise<unknown>>();
  const listeners = new Set<(state: FormState) => void>();
  let contextCache: { values: Values; context: Record<string, unknown> } | null = null;

  function set(patch: Partial<FormState>) {
    state = { ...state, ...patch };
    for (const listener of [...listeners]) listener(state);
  }

  function track<T>(promise: Promise<T>): Promise<T> {
    pending.add(promise);
    const done = () => pending.delete(promise);
    promise.then(done, done);
    return promise;
  }

  function context(): Record<string, unknown> {
    if (contextCache?.values !== state.values) {
      contextCache = { values: state.values as Values, context: expressionContext(state.values as Values, page.fields) };
    }
    return contextCache.context;
  }

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
    const ctx = context();
    let invisible = node.invisible.evaluate(ctx);
    for (let parent = node.parent; !invisible && parent; parent = index.get(parent)?.parent ?? null) {
      invisible = index.get(parent)?.invisible.evaluate(ctx) ?? false;
    }
    const def = node.field ? page.fields[node.field] : undefined;
    return {
      invisible,
      readonly: node.readonly.evaluate(ctx) || def?.readonly === true,
      required: node.required.evaluate(ctx) || def?.required === true,
    };
  }

  /** Field nodes inside `root` (or the whole page), visible right now. */
  function visibleFieldNodes(root?: string): IndexedNode[] {
    const inside = (node: IndexedNode) => {
      if (!root) return true;
      for (let at: string | null = node.id; at; at = index.get(at)?.parent ?? null) if (at === root) return true;
      return false;
    };
    return [...index.values()].filter((node) => node.kind === 'field' && inside(node) && !nodeState(node.id).invisible);
  }

  /** Errors for the visible fields under `root`, without publishing them. */
  function collectErrors(root?: string): Record<string, string> {
    const errors: Record<string, string> = {};
    for (const node of visibleFieldNodes(root)) {
      const name = node.field as string;
      if (errors[name]) continue;
      const def = page.fields[name];
      const message = checkValue(def, state.values[name], nodeState(node.id).required, messages);
      if (message) errors[name] = message;
      if (def.type === 'one2many') {
        for (const line of (state.values[name] as Line[] | null) ?? []) {
          // A section or note answers only for its text, never for what an item needs.
          const kind = lineKind(def, line.values);
          for (const [sub, subDef] of Object.entries(def.fields)) {
            if (kind && sub !== def.lineKinds?.text) continue;
            const lineMessage = checkValue(subDef, line.values[sub], subDef.required === true, messages);
            if (lineMessage) errors[`${name}.${line.key}.${sub}`] = lineMessage;
          }
        }
      }
    }
    return errors;
  }

  function writeValues(values: Values, extra: Partial<FormState> = {}) {
    const errors = Object.keys(state.errors).length ? revalidateShown(values) : state.errors;
    set({ values, dirty: dirtyFields(values), errors, ...extra });
  }

  /** Once errors are on screen, keep them current as the person fixes things. */
  function revalidateShown(values: Values): Record<string, string> {
    const previous = state;
    state = { ...state, values };
    const fresh = collectErrors(state.step ?? undefined);
    state = previous;
    const kept: Record<string, string> = {};
    for (const key of Object.keys(state.errors)) if (fresh[key]) kept[key] = fresh[key];
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
    if (drafts.restore === 'auto') writeValues({ ...state.values, ...draft.values }, { draft: null });
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
    for (const name of state.dirty) {
      const def = page.fields[name];
      const now = state.values[name];
      const before = baseline[name];
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
    set({ status: 'saving', errors: {}, error: null });
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
      const values = result.values ? { ...(state.values as Values), ...result.values } : (state.values as Values);
      baseline = structuredCopy(values);
      set({ status: 'saved', recordId: result.id, values, dirty: [] });
      return true;
    } catch (error) {
      set({ status: 'error', error: (error as Error).message });
      return false;
    }
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
    const filter: ResolvedFilterCondition[] | undefined =
      def.type === 'reference'
        ? undefined
        : def.filter?.map(({ field: target, op, value, valueFrom }) => ({
            field: target,
            op,
            value: (valueFrom !== undefined ? ctx[valueFrom] ?? null : value ?? null) as JsonValue,
          }));
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
      baseline = { ...initialValues(page.fields), ...loaded };
      set({ status: 'ready', values: structuredCopy(baseline), dirty: [], errors: {} });
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

    fieldReadonly: (name) => fieldDef(name).readonly === true,

    validate() {
      const errors = collectErrors();
      set({ errors });
      return Object.keys(errors).length === 0;
    },

    save: () => track(save()),

    reset() {
      forgetDraft();
      set({ values: structuredCopy(baseline), dirty: [], errors: {}, warning: null, warningField: null, draft: null, step: steps[0] ?? null });
    },

    changes,

    addLine(field, values = {}) {
      const def = lineField(field);
      const key = `new-${++lineKeys}`;
      const line: Line = { key, values: { ...initialValues(def.fields as Record<string, LineField>), ...structuredCopy(values) } };
      const lines = [...((state.values[field] as Line[] | null) ?? []), line];
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

    removeLine(field, key) {
      lineField(field);
      const lines = ((state.values[field] as Line[] | null) ?? []).filter((line) => line.key !== key);
      writeValues({ ...(state.values as Values), [field]: lines });
      afterEdit(field);
    },

    async search(field, query, limit = 8, options = {}) {
      return runSearch(fieldDef(field), field, context(), query, limit, options.model);
    },

    async searchLine(field, key, subfield, query, limit = 8) {
      const def = lineField(field);
      const sub = def.fields[subfield];
      if (!sub) throw new Error(`The lines of "${field}" have no field "${subfield}"`);
      const line = ((state.values[field] as Line[] | null) ?? []).find((l) => l.key === key);
      if (!line) throw new Error(`"${field}" has no line "${key}"`);
      return runSearch(sub, subfield, expressionContext(line.values, def.fields as Record<string, LineField>), query, limit);
    },

    steps: () => steps.filter((id) => !nodeState(id).invisible),

    next() {
      if (!state.step) return false;
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

    async runAction(id) {
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
          })
        )
      );
    },

    restoreDraft() {
      const raw = options.drafts?.store.getItem(draftKey());
      if (!raw) return;
      const draft = JSON.parse(raw) as { values: Values };
      writeValues({ ...(state.values as Values), ...draft.values }, { draft: null });
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

  if (state.recordId == null) offerDraft();
  return form;
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
      } else {
        add(node, parent, 'other', { invisible: node.invisible });
        if (node.type === 'section') walk(node.children, node.id);
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
    walk(root.children, root.id);
    if (root.sidePanel) add(root.sidePanel, root.id, 'other', { invisible: root.sidePanel.invisible });
  }
  return index;
}
