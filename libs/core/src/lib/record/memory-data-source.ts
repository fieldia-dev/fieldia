import type { Field, Fields, Option, PropertyDefinition } from '../format/field';
import { foldForSearch } from './input-rules';
import type { JsonValue } from '../format/json';
import type {
  DataSource,
  Group,
  GroupInterval,
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
  ArchiveRequest,
  RecordRequest,
  ListedRecord,
  LoadedRecord,
  RecordPermissions,
  RecordVersion,
  TotalKind,
  Totals,
  TotalsRequest,
  TotalsResult,
  UploadFile,
  UploadRequest,
  UploadedFile,
  WriteManyRequest,
  CreateManyRequest,
  CreateManyResult,
  WriteManyResult,
  SlotsRequest,
  SlotsResult,
  DuplicatesRequest,
  DuplicatesResult,
  MergeRequest,
  NotDuplicatesRequest,
  MarkNotDuplicateRequest,
} from './data-source';
import { ConflictError, loadedRecord, newRecordSave, saveProblemOf, saveRefused } from './data-source';
import { distanceFrom, matchesFilter } from './filter';
import { spanStart } from './periods';
import { wait, type Scheduler } from './scheduler';
import { structuredCopy, type FileValue, type Line, type RecordId, type RelatedRecord, type Value, type Values } from './values';

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
   * A tree's records (areas, iterations) name the field holding their names
   * from the top down (`path`: a list of names, or names joined by "\") and
   * the one whose words go at the end of their row in a picker (`aside`):
   * `{ "work.iteration": { path: "path", aside: "dates" } }`. A search finds
   * such a record by its whole path too.
   */
  shows?: Record<string, { avatar?: string; color?: string; details?: string[]; folded?: string; path?: string; aside?: string }>;
  /**
   * The app's lists of choices, by name: the choices, or a function of the form's values giving them — a table line's
   * values for a line's choices, with the whole request (its `parent`, the record the line is on) after them.
   */
  lists?: Record<string, Option[] | ((values: Values, request: OptionsRequest) => Option[] | Promise<Option[]>)>;
  /**
   * Properties' definitions kept on linked records, by the list's name: a
   * function of the form's values giving them — those of the record the link
   * points to. A property added in place is kept with the record's own, by
   * the definitions the app gave for that record.
   */
  definitions?: Record<string, (values: Values) => PropertyDefinition[]>;
  /** Each record's attachments, its main one first, by `model:id`: what a sheet's attachment preview shows. */
  attachments?: Record<string, FileValue[]>;
  /** The words after a copy's name, as a backend's copy adds them: " (copy)" unless said. */
  copySuffix?: string;
  /**
   * Keep a version of each record, moved on by each save: a load gives it
   * (with `loadedRecord`), and a save that carries an older one is refused
   * with a `ConflictError`. `by` names whoever saves through this source;
   * `changeElsewhere` changes a record as someone else would.
   */
  versions?: boolean | { by?: string };
  /**
   * What the person may do with each record, by model: given with its load
   * and its row in a list, and kept to as a backend would — a save, a
   * delete, an archive or a copy it does not allow is refused, and hidden
   * fields' values are left out.
   */
  can?: Record<string, (values: Values, id: RecordId) => RecordPermissions | undefined>;
  /**
   * A store as slow, or as unreliable, as a real one, for demos and tests of
   * files stored as they are picked: `bytesPerSecond` paces each upload, its
   * progress told every tenth of a second; `fails` says which tries fail —
   * true for a failure partway that Retry may mend, words for the store
   * refusing the file as it is (its kind, its size). Each file's tries are
   * counted by its name and size, from 1.
   */
  storage?: { bytesPerSecond?: number; fails?: (file: UploadFile, attempt: number) => boolean | string | undefined };
  /** Answer after this long, so a demo shows its loading states (an upload's progress, in four steps). */
  delayMs?: number;
  scheduler?: Scheduler;
  /**
   * How `slots` answers: the free times of the days asked, worked out from the records the source keeps —
   * `scheduleSlots(schedules)` answers from booking schedules. Without it, `slots` refuses, as a source with no
   * schedule would.
   */
  slots?: (request: SlotsRequest, records: Readonly<Record<string, Record<string, Values>>>) => SlotsResult | Promise<SlotsResult>;
  /**
   * How `duplicates` answers: the records like the one typed, from those the source keeps — `alikeRecords()` finds the
   * same phone, email or id as people write them apart and a name close enough. Without it, `duplicates` finds none.
   * `merge` keeps one record with the values picked and takes the others away, links to them moved to it, either way.
   */
  duplicates?: (request: DuplicatesRequest, records: Readonly<Record<string, Record<string, Values>>>) => DuplicatesResult | Promise<DuplicatesResult>;
  /**
   * The records already said to be someone else for one another ("It's someone new"), by model: each pair of ids, as
   * `notDuplicatePairs` keeps them — `{ partner: [['41', '1']] }` — to start from what an earlier visit kept.
   */
  notDuplicatePairs?: Record<string, [RecordId, RecordId][]>;
  /**
   * What a response sent is answered with, as an app's server answers it: the id it gives the response — a booking's
   * reference, "B-1043" — and any values it adds, which an ending reads. `count` is how many responses the source keeps
   * now, this one among them. Without it, each response's id is that count: 1, 2, 3.
   */
  submitted?: (request: SubmitRequest, count: number) => SubmitResult;
}

/**
 * Every member of a data source but `exportRecords` and `importRecords`: a
 * memory source leaves an export and an import to the browser, as a source
 * without a server of its own does. A test or a demo gives it one by setting
 * it.
 */
export interface MemoryDataSource extends Required<Omit<DataSource, 'exportRecords' | 'importRecords'>>, Pick<DataSource, 'exportRecords' | 'importRecords'> {
  readonly records: Record<string, Record<string, Values>>;
  /**
   * The records said to be someone else for one another, by model: each pair of ids, in the order kept, through
   * `markNotDuplicate` (the record's, then the one found like it). `notDuplicates` answers from either side of a pair.
   */
  readonly notDuplicatePairs: Record<string, [RecordId, RecordId][]>;
  readonly responses: SubmitRequest[];
  readonly calls: { method: keyof DataSource; request: unknown }[];
  /**
   * Change a stored record as someone else would, from another screen: its
   * version moves on, named for them, so a page that opened it before is
   * told of a conflict when it saves. Gives the new version.
   */
  changeElsewhere(model: string, id: RecordId, values: Values, who: { by: string; at?: string }): RecordVersion;
}

/**
 * A data source that keeps everything in memory. It implements the whole
 * interface, the way a backend would, so tests and demos exercise the same
 * paths a real adapter takes.
 */
export function createMemoryDataSource(options: MemoryDataSourceOptions = {}): MemoryDataSource {
  const records = structuredCopy(options.records ?? {});
  const notDuplicatePairs = structuredCopy(options.notDuplicatePairs ?? {});
  const responses: SubmitRequest[] = [];
  const calls: MemoryDataSource['calls'] = [];
  /** Properties added in place, by the list and the definitions the app gave for the record they were added to. */
  const addedDefinitions = new Map<string, PropertyDefinition[]>();
  // A new line's id comes after every line id of the records given (kept from an earlier visit, say), never one of them.
  let lineIds = Math.max(1000, highestLineId(records));
  let fileIds = 0;
  /** Each file's tries at the store, by its name and size: what `storage.fails` is told. */
  const tries = new Map<string, number>();
  /** Each record's version, by `model:id`, given when first asked. */
  const versions = new Map<string, RecordVersion>();
  let stamps = 0;
  const versionOf = (model: string, id: RecordId): RecordVersion | undefined => {
    if (!options.versions) return undefined;
    const key = `${model}:${id}`;
    if (!versions.has(key)) versions.set(key, { token: String(++stamps) });
    return versions.get(key);
  };
  const moveOn = (model: string, id: RecordId, by: string | undefined, at = new Date().toISOString()): RecordVersion => {
    const version: RecordVersion = { token: String(++stamps), ...(by ? { by } : {}), at };
    versions.set(`${model}:${id}`, version);
    return version;
  };
  const me = typeof options.versions === 'object' ? options.versions.by : undefined;
  const permissions = (model: string, id: RecordId) => {
    const stored = table(model)[String(id)];
    return stored ? options.can?.[model]?.(structuredCopy(stored), id) : undefined;
  };
  /** A record as this person may read it: without the fields hidden from them. */
  const readable = (values: Values, can: RecordPermissions | undefined): Values => {
    for (const name of can?.hiddenFields ?? []) delete values[name];
    return values;
  };
  /** Refused, as a backend refuses what the person may not do. */
  const allowed = (can: RecordPermissions | undefined, what: 'edit' | 'delete' | 'archive' | 'duplicate') => {
    if (can?.[what] === false) throw saveRefused({ kind: 'rule', message: can.reason ?? `You may not ${what} this record` });
  };
  /** A version and permissions, where this source keeps them. */
  const told = (version: RecordVersion | undefined, can: RecordPermissions | undefined) => ({ ...(version ? { version } : {}), ...(can ? { can } : {}) });

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
    const path = how.path ? pathOf(values[how.path]) : null;
    if (path) out.path = path;
    const aside = how.aside ? values[how.aside] : null;
    if (typeof aside === 'string' && aside.trim()) out.aside = aside;
    return out;
  };
  /** A tree's record's names from the top down, joined as a picker shows them; nothing for a model that keeps none. */
  const pathWords = (model: string, id: RecordId): string => {
    const field = options.shows?.[model]?.path;
    return (field && pathOf(table(model)[String(id)]?.[field])?.join('\\')) || '';
  };
  const nextId = (model: string) => Math.max(0, ...Object.keys(table(model)).map(Number).filter(Number.isFinite)) + 1;
  const asId = (key: string): RecordId => (Number.isFinite(Number(key)) ? Number(key) : key);
  /** A record as a filter reads it: its values and its own `id`, which a field of its own named id comes before. */
  const withId = (key: string, values: Values): Values => ({ id: asId(key), ...values });
  /** The stored records a filter keeps. */
  const matchingRows = (model: string, filter: TotalsRequest['filter']): Values[] => Object.entries(table(model)).filter(([key, values]) => matchesFilter(withId(key, values), filter)).map(([, values]) => values);

  /** A save, as a backend makes one: refused where the person may not, or over a newer version; else stored, its version moved on. */
  function write(request: SaveRequest): SaveResult {
    if (request.id !== null && table(request.model)[String(request.id)]) {
      const can = permissions(request.model, request.id);
      allowed(can, 'edit');
      const locked = Object.keys(request.changes.values).filter((name) => can?.readonlyFields?.includes(name) || can?.hiddenFields?.includes(name));
      if (locked.length) throw saveRefused({ kind: 'fields', message: 'You may not change these fields', fields: Object.fromEntries(locked.map((name) => [name, 'You may not change this field'])) });
      const now = versionOf(request.model, request.id);
      // A save that says which version it was opened at is checked; one that says none is not.
      if (now && request.version && request.version.token !== now.token) {
        throw new ConflictError({ version: now, theirs: readable(structuredCopy(table(request.model)[String(request.id)]), can) });
      }
    }
    const id = request.id ?? nextId(request.model);
    const stored: Values = { ...(table(request.model)[String(id)] ?? {}), ...structuredCopy(request.changes.values) };
    for (const [name, ops] of Object.entries(request.changes.lines)) {
      stored[name] = applyLines((stored[name] as Line[] | undefined) ?? [], ops);
    }
    for (const [name, ops] of Object.entries(request.changes.links)) {
      stored[name] = applyLinks((stored[name] as RelatedRecord[] | undefined) ?? [], ops, relationOf(request.fields, name));
    }
    table(request.model)[String(id)] = stored;
    const version = options.versions ? moveOn(request.model, id, me) : undefined;
    const can = permissions(request.model, id);
    return { id, values: readable(structuredCopy(stored), can), ...told(version, can) };
  }

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
    notDuplicatePairs,
    responses,
    calls,

    changeElsewhere(model: string, id: RecordId, values: Values, who: { by: string; at?: string }): RecordVersion {
      const stored = table(model)[String(id)];
      if (!stored) throw new Error(`No ${model} record with id ${id}`);
      Object.assign(stored, structuredCopy(values));
      return moveOn(model, id, who.by, who.at);
    },

    async load(request: LoadRequest): Promise<Values | LoadedRecord> {
      calls.push({ method: 'load', request });
      await pause();
      const stored = table(request.model)[String(request.id)];
      if (!stored) throw new Error(`No ${request.model} record with id ${request.id}`);
      const can = permissions(request.model, request.id);
      const version = versionOf(request.model, request.id);
      const values = readable(structuredCopy(stored), can);
      // Its links, with what their models show besides their names.
      if (options.shows) {
        for (const [name, def] of Object.entries(request.fields)) {
          const value = values[name];
          if (def.type === 'many2one' && value && typeof value === 'object' && 'id' in value) values[name] = shown(def.relation, value as RelatedRecord);
          else if (def.type === 'many2many' && Array.isArray(value)) values[name] = (value as RelatedRecord[]).map((record) => shown(def.relation, record));
        }
      }
      // Bare values, as ever, from a source that keeps no versions and no permissions.
      return version || can ? loadedRecord(values, told(version, can)) : values;
    },

    async save(request: SaveRequest): Promise<SaveResult> {
      calls.push({ method: 'save', request });
      await pause();
      return write(request);
    },

    async writeMany(request: WriteManyRequest): Promise<WriteManyResult> {
      calls.push({ method: 'writeMany', request });
      await pause();
      const failed: WriteManyResult['failed'] = [];
      // Each as a save of these fields alone would be: refused where the person may not, or where it changed since it was listed.
      for (const id of request.ids) {
        try {
          if (!table(request.model)[String(id)]) throw new Error(`No ${request.model} record with id ${id}`);
          const version = request.versions?.[String(id)];
          write({ model: request.model, id, fields: request.fields, values: request.values, changes: { values: request.values, lines: {}, links: {} }, partial: true, ...(version ? { version } : {}) });
        } catch (error) {
          const problem = saveProblemOf(error);
          const message = Object.values(problem.fields ?? {})[0] ?? problem.message;
          failed.push({ id, message, problem });
        }
      }
      return { failed };
    },

    async createMany(request: CreateManyRequest): Promise<CreateManyResult> {
      calls.push({ method: 'createMany', request });
      await pause();
      // Each as a save of a new record would be: made, or refused with why.
      return {
        records: request.records.map((values) => {
          try {
            return { id: write(newRecordSave(request.model, request.fields, values)).id };
          } catch (error) {
            const problem = saveProblemOf(error);
            return { message: Object.values(problem.fields ?? {})[0] ?? problem.message, problem };
          }
        }),
      };
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
      // Found as a person writes it: in any case, with Arabic letters in any of their forms and digits in any script.
      const query = findable(request.query.trim());
      return Object.entries(table(request.model))
        .filter(([key, values]) => matchesFilter(withId(key, values), request.filter ?? []))
        .map(([key]) => ({ id: asId(key), label: labelOf(request.model, asId(key)) }))
        // By its name, or a tree's record by its whole path: "Portal\Sprint", "Portal / Sprint"; asked exactly, the name or path itself.
        .filter((record) =>
          request.exact
            ? findable(record.label) === query || findable(pathWords(request.model, record.id)) === query
            : findable(record.label).includes(query) || findable(pathWords(request.model, record.id)).includes(query)
        )
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
          // Nearest first: by how far each is, those with no place last.
          const compared = order.near
            ? compareValues(distanceFrom(a.values, order.field, order.near), distanceFrom(b.values, order.field, order.near))
            : compareValues(a.values[order.field], b.values[order.field]);
          // Empty last, whichever way the rest goes.
          if (compared.empty) return compared.result;
          if (compared.result) return order.desc ? -compared.result : compared.result;
        }
        return 0;
      });
      return {
        total: matching.length,
        records: matching.slice(request.offset, request.offset + request.limit).map(({ id, values }): ListedRecord => {
          const can = permissions(request.model, id);
          const shownValues = readable(Object.fromEntries(request.fields.map((field) => [field, structuredCopy(values[field] ?? null) as Value])), can);
          return { id, values: shownValues, ...told(versionOf(request.model, id), can) };
        }),
        ...(request.allIds ? { allIds: matching.map(({ id }) => id) } : {}),
      };
    },

    async groups(request: GroupRequest): Promise<Group[]> {
      calls.push({ method: 'groups', request });
      await pause();
      return groupRows(matchingRows(request.model, request.filter), request.field, request).map(({ rows: _rows, ...group }) => group);
    },

    async slots(request: SlotsRequest): Promise<SlotsResult> {
      calls.push({ method: 'slots', request });
      await pause();
      if (!options.slots) throw new Error(`No schedule "${request.schedule}"`);
      return options.slots(request, records);
    },

    async duplicates(request: DuplicatesRequest): Promise<DuplicatesResult> {
      calls.push({ method: 'duplicates', request });
      await pause();
      return options.duplicates ? options.duplicates(request, records) : { matches: [] };
    },

    async notDuplicates(request: NotDuplicatesRequest): Promise<RecordId[]> {
      calls.push({ method: 'notDuplicates', request });
      await pause();
      const id = String(request.recordId);
      // A pair either way round: each is someone else for the other.
      return (notDuplicatePairs[request.model] ?? []).flatMap(([a, b]) => (String(a) === id ? [b] : String(b) === id ? [a] : []));
    },

    async markNotDuplicate(request: MarkNotDuplicateRequest): Promise<void> {
      calls.push({ method: 'markNotDuplicate', request });
      await pause();
      const { recordId, matchId } = request;
      if (!table(request.model)[String(recordId)]) throw new Error(`No ${request.model} record with id ${recordId}`);
      const pairs = (notDuplicatePairs[request.model] ??= []);
      const same = (x: RecordId, y: RecordId) => String(x) === String(y);
      // Never a record and itself, and a pair kept once, whichever side said it.
      if (!same(recordId, matchId) && !pairs.some(([x, y]) => (same(x, recordId) && same(y, matchId)) || (same(x, matchId) && same(y, recordId)))) pairs.push([recordId, matchId]);
    },

    async merge(request: MergeRequest): Promise<void> {
      calls.push({ method: 'merge', request });
      await pause();
      const rows = table(request.model);
      const kept = rows[String(request.keepId)];
      if (!kept) throw new Error(`No ${request.model} record with id ${request.keepId}`);
      allowed(permissions(request.model, request.keepId), 'edit');
      for (const id of request.mergeIds) {
        if (!rows[String(id)]) throw new Error(`No ${request.model} record with id ${id}`);
        allowed(permissions(request.model, id), 'delete');
      }
      // Each link to a record merged is a link to the one kept: a link known by its id and its name, which no other model's record of that id shares.
      const gone = new Map(request.mergeIds.map((id) => [String(id), labelOf(request.model, id)]));
      Object.assign(kept, structuredCopy(request.values));
      for (const id of request.mergeIds) delete rows[String(id)];
      if (options.versions) moveOn(request.model, request.keepId, me);
      const to: RelatedRecord = { id: request.keepId, label: labelOf(request.model, request.keepId) };
      const moved = (value: unknown): unknown => {
        if (Array.isArray(value)) {
          const out = value.map(moved);
          // Links to both the kept and a merged record are one link.
          return out.filter((item, at) => !isLink(item) || out.findIndex((other) => isLink(other) && String(other.id) === String(item.id)) === at);
        }
        if (isLink(value)) return gone.get(String(value.id)) === value.label ? { ...value, ...to } : value;
        if (value && typeof value === 'object' && 'values' in value && 'key' in value) return { ...value, values: movedIn((value as Line).values) };
        return value;
      };
      const movedIn = (values: Values): Values => Object.fromEntries(Object.entries(values).map(([field, value]) => [field, moved(value) as Value]));
      for (const each of Object.values(records)) for (const [key, values] of Object.entries(each)) each[key] = movedIn(values);
    },

    async totals(request: TotalsRequest): Promise<TotalsResult> {
      calls.push({ method: 'totals', request });
      await pause();
      const rows = matchingRows(request.model, request.filter);
      const result: TotalsResult = { count: rows.length, ...totalsOver(rows, request) };
      if (request.groupBy) result.groups = groupRows(rows, request.groupBy, request).map(({ rows: under, ...group }) => ({ ...group, ...totalsOver(under, request) }));
      return result;
    },

    async upload(file: UploadFile, request: UploadRequest): Promise<UploadedFile> {
      calls.push({ method: 'upload', request: { ...request, file } });
      const stopped = () => Object.assign(new Error('The upload was stopped'), { name: 'AbortError' });
      // A store slow or failing as `storage` says: a refusal at once, a failure partway, the bytes paced as they go.
      const tried = `${file.name}:${file.size}`;
      tries.set(tried, (tries.get(tried) ?? 0) + 1);
      const failure = options.storage?.fails?.(file, tries.get(tried) as number);
      if (typeof failure === 'string') throw saveRefused({ kind: 'rule', message: failure });
      const pace = options.storage?.bytesPerSecond;
      if (pace) {
        const each = Math.max(1, Math.round(pace / 10));
        for (let sent = 0; sent < file.size; ) {
          await wait(100, options.scheduler);
          if (request.signal?.aborted) throw stopped();
          sent = Math.min(file.size, sent + each);
          if (failure && sent >= file.size / 2) throw new Error('The store stopped answering: the upload failed partway');
          request.onProgress?.(sent, file.size);
        }
      }
      // In four steps when it is slowed for a demo, so its progress shows.
      const steps = options.delayMs && !pace ? 4 : 1;
      for (let step = 1; step <= steps && !pace; step++) {
        if (options.delayMs) await wait(options.delayMs / steps, options.scheduler);
        if (request.signal?.aborted) throw stopped();
        request.onProgress?.(Math.round((file.size * step) / steps), file.size);
      }
      if (failure) throw new Error('The store stopped answering: the upload failed');
      // Kept as a data address, so a preview needs nothing else.
      const type = file.type || 'application/octet-stream';
      return { fileId: ++fileIds, url: `data:${type};base64,${base64(new Uint8Array(await file.arrayBuffer()))}`, name: file.name, size: file.size, type };
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
      return options.submitted ? options.submitted(structuredCopy(request), responses.length) : { id: responses.length };
    },

    async archive(request: ArchiveRequest): Promise<void> {
      calls.push({ method: 'archive', request });
      await pause();
      const stored = table(request.model)[String(request.id)];
      if (!stored) throw new Error(`No ${request.model} record with id ${request.id}`);
      allowed(permissions(request.model, request.id), 'archive');
      stored['active'] = !request.archive;
    },

    async copy(request: RecordRequest): Promise<SaveResult> {
      calls.push({ method: 'copy', request });
      await pause();
      const stored = table(request.model)[String(request.id)];
      if (!stored) throw new Error(`No ${request.model} record with id ${request.id}`);
      allowed(permissions(request.model, request.id), 'duplicate');
      const id = nextId(request.model);
      const copy = structuredCopy(stored);
      const name = options.labelField?.[request.model] ?? 'name';
      if (typeof copy[name] === 'string') copy[name] = `${copy[name]}${options.copySuffix ?? ' (copy)'}`;
      // Its lines are its own: new lines, with new ids.
      for (const [key, value] of Object.entries(copy)) {
        if (Array.isArray(value) && value.every((line) => line && typeof line === 'object' && 'key' in line && 'values' in line)) {
          copy[key] = (value as Line[]).map((line) => ({ ...line, id: ++lineIds }));
        }
      }
      table(request.model)[String(id)] = copy;
      const can = permissions(request.model, id);
      return { id, values: readable(structuredCopy(copy), can), ...told(versionOf(request.model, id), can) };
    },

    async delete(request: RecordRequest): Promise<void> {
      calls.push({ method: 'delete', request });
      await pause();
      if (!table(request.model)[String(request.id)]) throw new Error(`No ${request.model} record with id ${request.id}`);
      allowed(permissions(request.model, request.id), 'delete');
      delete table(request.model)[String(request.id)];
    },

    async attachments(request: RecordRequest): Promise<FileValue[]> {
      calls.push({ method: 'attachments', request });
      await pause();
      return structuredCopy(options.attachments?.[`${request.model}:${request.id}`] ?? []);
    },

    async options(request: OptionsRequest): Promise<Option[]> {
      calls.push({ method: 'options', request });
      await pause();
      const list = options.lists?.[request.list];
      if (!list) throw new Error(`No list "${request.list}"`);
      return structuredCopy(typeof list === 'function' ? await list(request.values, request) : list);
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

/** The highest numeric id of a line among the records given — their tables of lines, and lines inside lines — or 0. */
function highestLineId(records: Record<string, Record<string, Values>>): number {
  let highest = 0;
  const look = (value: unknown): void => {
    if (!Array.isArray(value)) return;
    for (const item of value) {
      if (!item || typeof item !== 'object' || !('key' in item) || !('values' in item)) continue;
      const id = (item as Line).id;
      if (typeof id === 'number' && id > highest) highest = id;
      for (const inner of Object.values((item as Line).values ?? {})) look(inner);
    }
  };
  for (const table of Object.values(records)) for (const values of Object.values(table)) for (const value of Object.values(values)) look(value);
  return highest;
}

/** A link: a record's id and its name. */
const isLink =(value: unknown): value is RelatedRecord => !!value && typeof value === 'object' && !Array.isArray(value) && 'id' in value && 'label' in value && !('values' in value);

/** Words as a search finds them: folded (foldForSearch), and a path's separators — \\ or /, with spaces round them or not — as one. */
const findable = (text: string) => foldForSearch(text).replace(/\s*[\\/]\s*/g, '\\');

/** A tree's record's names from the top down: a list of names, or names joined by a backslash; null for anything else. */
function pathOf(value: unknown): string[] | null {
  const names = Array.isArray(value) ? value : typeof value === 'string' ? value.split('\\') : null;
  const kept = names?.filter((name): name is string => typeof name === 'string' && name.trim() !== '');
  return kept?.length ? kept : null;
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

/**
 * Records under each value of a field: a link's by its record, a record of links (a many2many) under each of its
 * links, as a server groups tags; nothing as its own group, last; the rest by their labels. With `interval`, a date's
 * by the span it falls in, its first day the group's value and label, in time order.
 */
function groupRows(rows: Values[], field: string, by: GroupInterval = {}): (Group & { rows: Values[] })[] {
  const grouped = new Map<string, Group & { rows: Values[] }>();
  const isLink = (item: unknown): item is RelatedRecord => item !== null && typeof item === 'object' && !Array.isArray(item) && 'id' in item;
  for (const values of rows) {
    const held = values[field] ?? null;
    // Links: the record under each one; none, under nothing.
    const each = Array.isArray(held) && !by.interval && held.every(isLink) ? (held.length ? held : [null]) : [held];
    for (const raw of each) {
      const link = isLink(raw) ? raw : null;
      const value = (by.interval ? spanStart(raw, by.interval, by) : link ? link.id : raw) as JsonValue;
      const key = JSON.stringify(value);
      const label = by.interval ? (value ?? '') : link ? link.label : raw === null || raw === '' ? '' : String(raw);
      const group = grouped.get(key) ?? { value, label: String(label), count: 0, rows: [] };
      group.count++;
      group.rows.push(values);
      grouped.set(key, group);
    }
  }
  return [...grouped.values()].sort((a, b) => (a.value === null) === (b.value === null) ? a.label.localeCompare(b.label) : a.value === null ? 1 : -1);
}

/**
 * Each field's totals over these records: of its numbers, and a count of those holding any value. An amount whose
 * currency each record keeps (`currencies`) is totalled within one currency only: over records in more than one, its
 * sum, average, least and most are null, and the currency it is in is told beside.
 */
function totalsOver(rows: Values[], asked: TotalsRequest): { totals: Totals; currencies?: Record<string, JsonValue> } {
  const totals: Totals = {};
  const currencies: Record<string, JsonValue> = {};
  for (const [field, kinds] of Object.entries(asked.totals)) {
    const holding = rows.filter((values) => typeof values[field] === 'number' && Number.isFinite(values[field]));
    const numbers = holding.map((values) => values[field] as number);
    const sum = numbers.reduce((a, b) => a + b, 0);
    const of: Record<TotalKind, number | null> = {
      sum,
      avg: numbers.length ? sum / numbers.length : null,
      min: numbers.length ? numbers.reduce((a, b) => Math.min(a, b)) : null,
      max: numbers.length ? numbers.reduce((a, b) => Math.max(a, b)) : null,
      count: rows.filter((values) => !blankValue(values[field])).length,
    };
    const currencyField = asked.currencies?.[field];
    if (currencyField) {
      // A link by its id, a code as it is: the same currency twice is one.
      const held = new Map(holding.map((values) => {
        const currency = (values[currencyField] ?? null) as JsonValue;
        const id = currency !== null && typeof currency === 'object' && !Array.isArray(currency) && 'id' in currency ? currency['id'] : currency;
        return [JSON.stringify(id), currency];
      }));
      currencies[field] = held.size === 1 ? [...held.values()][0] : null;
      if (held.size > 1) for (const kind of ['sum', 'avg', 'min', 'max'] as const) of[kind] = null;
    }
    totals[field] = Object.fromEntries(kinds.map((kind) => [kind, of[kind]]));
  }
  return asked.currencies ? { totals, currencies } : { totals };
}

const blankValue = (v: unknown) => v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0);

/** Bytes as base64, by the host's `btoa` (a browser's, or Node's). */
function base64(bytes: Uint8Array): string {
  let text = '';
  for (let at = 0; at < bytes.length; at += 0x8000) text += String.fromCharCode(...bytes.subarray(at, at + 0x8000));
  return (globalThis as unknown as { btoa(text: string): string }).btoa(text);
}

