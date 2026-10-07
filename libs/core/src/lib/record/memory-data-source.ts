import type { Field, Fields, Option, PropertyDefinition } from '../format/field';
import type { JsonValue } from '../format/json';
import type {
  DataSource,
  Group,
  GroupRequest,
  ListRequest,
  ListResult,
  LineOp,
  LinkOp,
  LoadRequest,
  OnchangeRequest,
  OnchangeResult,
  OptionsRequest,
  SaveRequest,
  SaveResult,
  SearchRequest,
  CreateRequest,
  SubmitRequest,
  SubmitResult,
} from './data-source';
import { matchesFilter } from './filter';
import { wait, type Scheduler } from './scheduler';
import { structuredCopy, type Line, type RecordId, type RelatedRecord, type Value, type Values } from './values';

export interface MemoryDataSourceOptions {
  /** Records by model, then by id. */
  records?: Record<string, Record<string, Values>>;
  /** Recalculation rules by model, then by the field that changed. */
  onchange?: Record<string, Record<string, (values: Values) => Values>>;
  /** Warnings by model, then by the field that changed: a message, or null for none. */
  warnings?: Record<string, Record<string, (values: Values) => string | null>>;
  /** Which value names a record in search results, per model. Defaults to `name`. */
  labelField?: Record<string, string>;
  /**
   * What a link shows of a model's records besides their name, by model: the
   * fields its picture, its colour, the lines under its name and its folding
   * come from — `{ "res.users": { avatar: "image" }, "tag": { color: "color" },
   * "stage": { folded: "fold" }, "partner": { details: ["street", "city"] } }` —
   * given with each record a search finds and each link a record loads.
   */
  shows?: Record<string, { avatar?: string; color?: string; details?: string[]; folded?: string }>;
  /** The app's lists of choices, by name: the choices, or a function of the form's values giving them. */
  lists?: Record<string, Option[] | ((values: Values) => Option[] | Promise<Option[]>)>;
  /**
   * Properties' definitions kept on linked records, by the list's name: a
   * function of the form's values giving them — those of the record the link
   * points to. A property added in place is kept with the record's own, by
   * the definitions the app gave for that record.
   */
  definitions?: Record<string, (values: Values) => PropertyDefinition[]>;
  /** Answer after this long, so a demo shows its loading states. */
  delayMs?: number;
  scheduler?: Scheduler;
}

export interface MemoryDataSource extends Required<DataSource> {
  readonly records: Record<string, Record<string, Values>>;
  readonly responses: SubmitRequest[];
  readonly calls: { method: keyof DataSource; request: unknown }[];
}

/**
 * A data source that keeps everything in memory. It implements the whole
 * interface, the way a backend would, so tests and demos exercise the same
 * paths a real adapter takes.
 */
export function createMemoryDataSource(options: MemoryDataSourceOptions = {}): MemoryDataSource {
  const records = structuredCopy(options.records ?? {});
  const responses: SubmitRequest[] = [];
  const calls: MemoryDataSource['calls'] = [];
  /** Properties added in place, by the list and the definitions the app gave for the record they were added to. */
  const addedDefinitions = new Map<string, PropertyDefinition[]>();
  let lineIds = 1000;

  const pause = () => (options.delayMs ? wait(options.delayMs, options.scheduler) : Promise.resolve());
  const table = (model: string) => (records[model] ??= {});
  const labelOf = (model: string, id: RecordId) => {
    const value = table(model)[String(id)]?.[options.labelField?.[model] ?? 'name'];
    return typeof value === 'string' ? value : String(id);
  };
  /** A linked record with what its model shows besides its name. */
  const shown = (model: string, record: RelatedRecord): RelatedRecord => {
    const how = options.shows?.[model];
    const values = how ? table(model)[String(record.id)] : undefined;
    if (!how || !values) return record;
    const out: RelatedRecord = { ...record };
    if (how.avatar && typeof values[how.avatar] === 'string') out.avatar = values[how.avatar] as string;
    if (how.color && typeof values[how.color] === 'number') out.color = values[how.color] as number;
    if (how.folded) out.folded = values[how.folded] === true;
    const lines = (how.details ?? []).map((name) => values[name]).map((v) => (v && typeof v === 'object' && 'label' in v ? (v as RelatedRecord).label : v)).filter((v) => typeof v === 'string' && v.trim());
    if (lines.length) out.details = lines.join('\n');
    return out;
  };
  const nextId = (model: string) => Math.max(0, ...Object.keys(table(model)).map(Number).filter(Number.isFinite)) + 1;
  const asId = (key: string): RecordId => (Number.isFinite(Number(key)) ? Number(key) : key);
  /** A record as a filter reads it: its values and its own `id`, which a field of its own named id comes before. */
  const withId = (key: string, values: Values): Values => ({ id: asId(key), ...values });

  function applyLines(current: Line[], ops: LineOp[]): Line[] {
    let lines = [...current];
    for (const op of ops) {
      if (op.op === 'create') lines.push({ key: op.key, id: ++lineIds, values: structuredCopy(op.values) });
      else if (op.op === 'update') lines = lines.map((l) => (l.id === op.id ? { ...l, values: { ...l.values, ...structuredCopy(op.values) } } : l));
      else lines = lines.filter((l) => l.id !== op.id);
    }
    return lines;
  }

  function applyLinks(current: RelatedRecord[], ops: LinkOp[], model: string): RelatedRecord[] {
    let links = [...current];
    const related = (id: RecordId): RelatedRecord => ({ id, label: labelOf(model, id) });
    for (const op of ops) {
      if (op.op === 'link' && !links.some((r) => r.id === op.id)) links.push(related(op.id));
      else if (op.op === 'unlink') links = links.filter((r) => r.id !== op.id);
      else if (op.op === 'set') links = op.ids.map(related);
      else if (op.op === 'clear') links = [];
    }
    return links;
  }

  function relationOf(fields: Fields, name: string): string {
    const field: Field | undefined = fields[name];
    return field && 'relation' in field ? field.relation : name;
  }

  return {
    records,
    responses,
    calls,

    async load(request: LoadRequest): Promise<Values> {
      calls.push({ method: 'load', request });
      await pause();
      const stored = table(request.model)[String(request.id)];
      if (!stored) throw new Error(`No ${request.model} record with id ${request.id}`);
      const values = structuredCopy(stored);
      // Its links, with what their models show besides their names.
      if (options.shows) {
        for (const [name, def] of Object.entries(request.fields)) {
          const value = values[name];
          if (def.type === 'many2one' && value && typeof value === 'object' && 'id' in value) values[name] = shown(def.relation, value as RelatedRecord);
          else if (def.type === 'many2many' && Array.isArray(value)) values[name] = (value as RelatedRecord[]).map((record) => shown(def.relation, record));
        }
      }
      return values;
    },

    async save(request: SaveRequest): Promise<SaveResult> {
      calls.push({ method: 'save', request });
      await pause();
      const id = request.id ?? nextId(request.model);
      const stored: Values = { ...(table(request.model)[String(id)] ?? {}), ...structuredCopy(request.changes.values) };
      for (const [name, ops] of Object.entries(request.changes.lines)) {
        stored[name] = applyLines((stored[name] as Line[] | undefined) ?? [], ops);
      }
      for (const [name, ops] of Object.entries(request.changes.links)) {
        stored[name] = applyLinks((stored[name] as RelatedRecord[] | undefined) ?? [], ops, relationOf(request.fields, name));
      }
      table(request.model)[String(id)] = stored;
      return { id, values: structuredCopy(stored) };
    },

    async onchange(request: OnchangeRequest): Promise<OnchangeResult> {
      calls.push({ method: 'onchange', request });
      await pause();
      const rule = options.onchange?.[request.model]?.[request.changed];
      const warn = options.warnings?.[request.model]?.[request.changed];
      const result: OnchangeResult = rule ? { values: rule(structuredCopy(request.values)) } : {};
      const warning = warn?.(structuredCopy(request.values));
      return warning ? { ...result, warning } : result;
    },

    async search(request: SearchRequest): Promise<RelatedRecord[]> {
      calls.push({ method: 'search', request });
      await pause();
      const query = request.query.trim().toLowerCase();
      return Object.entries(table(request.model))
        .filter(([key, values]) => matchesFilter(withId(key, values), request.filter ?? []))
        .map(([key]) => ({ id: asId(key), label: labelOf(request.model, asId(key)) }))
        .filter((record) => record.label.toLowerCase().includes(query))
        .slice(0, request.limit ?? 8)
        .map((record) => shown(request.model, record));
    },

    async list(request: ListRequest): Promise<ListResult> {
      calls.push({ method: 'list', request });
      await pause();
      const matching = Object.entries(table(request.model))
        .filter(([key, values]) => matchesFilter(withId(key, values), request.filter))
        .map(([key, values]) => ({ id: asId(key), values }));
      matching.sort((a, b) => {
        for (const order of request.sort) {
          const compared = compareValues(a.values[order.field], b.values[order.field]);
          // Empty last, whichever way the rest goes.
          if (compared.empty) return compared.result;
          if (compared.result) return order.desc ? -compared.result : compared.result;
        }
        return 0;
      });
      return {
        total: matching.length,
        records: matching.slice(request.offset, request.offset + request.limit).map(({ id, values }) => ({
          id,
          values: Object.fromEntries(request.fields.map((field) => [field, structuredCopy(values[field] ?? null) as Value])),
        })),
      };
    },

    async groups(request: GroupRequest): Promise<Group[]> {
      calls.push({ method: 'groups', request });
      await pause();
      const counted = new Map<string, Group>();
      for (const [id, values] of Object.entries(table(request.model))) {
        if (!matchesFilter(withId(id, values), request.filter)) continue;
        const raw = values[request.field] ?? null;
        const link = raw !== null && typeof raw === 'object' && !Array.isArray(raw) && 'id' in raw ? (raw as RelatedRecord) : null;
        const value = (link ? link.id : raw) as JsonValue;
        const key = JSON.stringify(value);
        const group = counted.get(key) ?? { value, label: link ? link.label : raw === null || raw === '' ? '' : String(raw), count: 0 };
        group.count++;
        counted.set(key, group);
      }
      return [...counted.values()].sort((a, b) => (a.value === null) === (b.value === null) ? a.label.localeCompare(b.label) : a.value === null ? 1 : -1);
    },

    async create(request: CreateRequest): Promise<RelatedRecord> {
      calls.push({ method: 'create', request });
      await pause();
      const rows = table(request.model);
      const id = Object.keys(rows).reduce((top, key) => Math.max(top, Number(key) || 0), 0) + 1;
      rows[String(id)] = { ...structuredCopy(request.values ?? {}), name: request.name };
      return { id, label: request.name };
    },

    async submit(request: SubmitRequest): Promise<SubmitResult> {
      calls.push({ method: 'submit', request });
      await pause();
      responses.push(structuredCopy(request));
      return { id: responses.length };
    },

    async options(request: OptionsRequest): Promise<Option[]> {
      calls.push({ method: 'options', request });
      await pause();
      const list = options.lists?.[request.list];
      if (!list) throw new Error(`No list "${request.list}"`);
      return structuredCopy(typeof list === 'function' ? await list(request.values) : list);
    },

    async definitions(request: OptionsRequest): Promise<PropertyDefinition[]> {
      calls.push({ method: 'definitions', request });
      await pause();
      const given = options.definitions?.[request.list];
      if (!given) throw new Error(`No definitions "${request.list}"`);
      // Those added in place, kept for the same answer the app gives.
      const own = given(request.values);
      const added = addedDefinitions.get(`${request.list}:${JSON.stringify(own)}`) ?? [];
      return structuredCopy([...own, ...added.filter((d) => !own.some((o) => o.name === d.name))]);
    },

    async saveDefinitions(request: OptionsRequest & { definitions: PropertyDefinition[] }): Promise<void> {
      calls.push({ method: 'saveDefinitions', request });
      await pause();
      const own = options.definitions?.[request.list]?.(request.values) ?? [];
      addedDefinitions.set(`${request.list}:${JSON.stringify(own)}`, structuredCopy(request.definitions.filter((d) => !own.some((o) => o.name === d.name))));
    },
  };
}

/** Two values in order: a link by its label, text by the reader's rules, numbers by size; `empty` says one of them had nothing. */
function compareValues(a: unknown, b: unknown): { result: number; empty: boolean } {
  const blank = (v: unknown) => v === null || v === undefined || v === '';
  if (blank(a) || blank(b)) return { result: blank(a) === blank(b) ? 0 : blank(a) ? 1 : -1, empty: blank(a) !== blank(b) };
  const label = (v: unknown) => (typeof v === 'object' && v !== null && 'label' in v ? (v as RelatedRecord).label : v);
  const [x, y] = [label(a), label(b)];
  if (typeof x === 'number' && typeof y === 'number') return { result: x - y, empty: false };
  return { result: String(x).localeCompare(String(y)), empty: false };
}
