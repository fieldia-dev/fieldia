import type { Field, Fields } from '../format/field';
import type { JsonValue } from '../format/json';
import type {
  DataSource,
  LineOp,
  LinkOp,
  LoadRequest,
  OnchangeRequest,
  OnchangeResult,
  ResolvedFilterCondition,
  SaveRequest,
  SaveResult,
  SearchRequest,
  SubmitRequest,
  SubmitResult,
} from './data-source';
import { wait, type Scheduler } from './scheduler';
import { structuredCopy, type Line, type RecordId, type RelatedRecord, type Values } from './values';

export interface MemoryDataSourceOptions {
  /** Records by model, then by id. */
  records?: Record<string, Record<string, Values>>;
  /** Recalculation rules by model, then by the field that changed. */
  onchange?: Record<string, Record<string, (values: Values) => Values>>;
  /** Warnings by model, then by the field that changed: a message, or null for none. */
  warnings?: Record<string, Record<string, (values: Values) => string | null>>;
  /** Which value names a record in search results, per model. Defaults to `name`. */
  labelField?: Record<string, string>;
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
  let lineIds = 1000;

  const pause = () => (options.delayMs ? wait(options.delayMs, options.scheduler) : Promise.resolve());
  const table = (model: string) => (records[model] ??= {});
  const labelOf = (model: string, id: RecordId) => {
    const value = table(model)[String(id)]?.[options.labelField?.[model] ?? 'name'];
    return typeof value === 'string' ? value : String(id);
  };
  const nextId = (model: string) => Math.max(0, ...Object.keys(table(model)).map(Number).filter(Number.isFinite)) + 1;
  const asId = (key: string): RecordId => (Number.isFinite(Number(key)) ? Number(key) : key);

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
      return structuredCopy(stored);
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
        .filter(([, values]) => (request.filter ?? []).every((condition) => matches(values, condition)))
        .map(([key]) => ({ id: asId(key), label: labelOf(request.model, asId(key)) }))
        .filter((record) => record.label.toLowerCase().includes(query))
        .slice(0, request.limit ?? 8);
    },

    async submit(request: SubmitRequest): Promise<SubmitResult> {
      calls.push({ method: 'submit', request });
      await pause();
      responses.push(structuredCopy(request));
      return { id: responses.length };
    },
  };
}

function matches(values: Values, condition: ResolvedFilterCondition): boolean {
  const raw = values[condition.field];
  const actual = raw !== null && typeof raw === 'object' && 'id' in raw ? (raw as RelatedRecord).id : (raw as JsonValue | undefined);
  const expected = condition.value;
  switch (condition.op) {
    case '=':
      return actual === expected;
    case '!=':
      return actual !== expected;
    case '<':
      return (actual as number) < (expected as number);
    case '>':
      return (actual as number) > (expected as number);
    case '<=':
      return (actual as number) <= (expected as number);
    case '>=':
      return (actual as number) >= (expected as number);
    case 'in':
      return Array.isArray(expected) && expected.includes(actual as JsonValue);
    case 'not in':
      return Array.isArray(expected) && !expected.includes(actual as JsonValue);
    case 'like':
      return String(actual ?? '').includes(String(expected));
    case 'ilike':
      return String(actual ?? '').toLowerCase().includes(String(expected).toLowerCase());
  }
}
