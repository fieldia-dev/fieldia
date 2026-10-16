import type { Field, Fields, Option, PropertyDefinition } from '../format/field';
import { foldForSearch } from './input-rules';
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
  SlotDay,
  SlotsRequest,
  SlotsResult,
} from './data-source';
import { ConflictError, loadedRecord, saveRefused } from './data-source';
import { distanceFrom, matchesFilter } from './filter';
import { wait, type Scheduler } from './scheduler';
import { instantsAt, wallOf } from './zones';
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
  /** The app's lists of choices, by name: the choices, or a function of the form's values giving them. */
  lists?: Record<string, Option[] | ((values: Values) => Option[] | Promise<Option[]>)>;
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
   * Booking schedules, by the name a field drawn as booking slots asks for (`options.schedule`, else the field's
   * name): what `slots` answers from.
   */
  schedules?: Record<string, MemorySchedule>;
  /** The clock, for the times already past that `slots` leaves out: the computer's own unless given. */
  now?: () => Date;
}

/**
 * A booking schedule, as `slots` answers from it: the hours it opens each day of the week on its zone's clock — the
 * days named as its zone names them, which a page in another zone places by their times — the
 * minutes a booking lasts and those kept free after one, its holidays, and the records its bookings are kept as — a
 * time one of them holds is not free, but to the record itself.
 */
export interface MemorySchedule {
  /** The zone its hours are on the clock of, by its IANA name: "Europe/Berlin". */
  timeZone: string;
  /** Its hours by the day of the week, ISO-numbered (1 Monday … 7 Sunday): each a from and a to, ["09:00", "13:00"]. A day not named is closed. */
  hours: { [day: number]: [string, string][] };
  /** The minutes a booking lasts: the page's (`options.length`), else 30. */
  length?: number;
  /** The minutes kept free after each booking: the page's (`options.between`), else none. */
  between?: number;
  /** The days it is closed for, by date, with their names: { "2026-12-25": "Christmas Day" }. */
  holidays?: Record<string, string>;
  /**
   * Its bookings: records of `model`, starting at `field` (the field booked unless said) and ending at `endField`
   * (else lasting `length`); with `same`, only those holding the form's value in each of these fields — a doctor's.
   */
  bookings?: { model: string; field?: string; endField?: string; same?: string[] };
}

export interface MemoryDataSource extends Required<DataSource> {
  readonly records: Record<string, Record<string, Values>>;
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
  const responses: SubmitRequest[] = [];
  const calls: MemoryDataSource['calls'] = [];
  /** Properties added in place, by the list and the definitions the app gave for the record they were added to. */
  const addedDefinitions = new Map<string, PropertyDefinition[]>();
  let lineIds = 1000;
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
        // By its name, or a tree's record by its whole path: "Portal\Sprint", "Portal / Sprint".
        .filter((record) => findable(record.label).includes(query) || findable(pathWords(request.model, record.id)).includes(query))
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
      return groupRows(matchingRows(request.model, request.filter), request.field).map(({ rows: _rows, ...group }) => group);
    },

    async slots(request: SlotsRequest): Promise<SlotsResult> {
      calls.push({ method: 'slots', request });
      await pause();
      const schedule = options.schedules?.[request.schedule];
      if (!schedule) throw new Error(`No schedule "${request.schedule}"`);
      return slotsOf(schedule, request, schedule.bookings ? bookedIn(schedule, request, table(schedule.bookings.model)) : [], (options.now?.() ?? new Date()).getTime());
    },

    async totals(request: TotalsRequest): Promise<TotalsResult> {
      calls.push({ method: 'totals', request });
      await pause();
      const rows = matchingRows(request.model, request.filter);
      const result: TotalsResult = { count: rows.length, totals: totalsOver(rows, request.totals) };
      if (request.groupBy) result.groups = groupRows(rows, request.groupBy).map(({ rows: under, ...group }) => ({ ...group, totals: totalsOver(under, request.totals) }));
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
      return { id: responses.length };
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

/** Records under each value of a field: a link's by its record, nothing as its own group, last; the rest by their labels. */
function groupRows(rows: Values[], field: string): (Group & { rows: Values[] })[] {
  const grouped = new Map<string, Group & { rows: Values[] }>();
  for (const values of rows) {
    const raw = values[field] ?? null;
    const link = raw !== null && typeof raw === 'object' && !Array.isArray(raw) && 'id' in raw ? (raw as RelatedRecord) : null;
    const value = (link ? link.id : raw) as JsonValue;
    const key = JSON.stringify(value);
    const group = grouped.get(key) ?? { value, label: link ? link.label : raw === null || raw === '' ? '' : String(raw), count: 0, rows: [] };
    group.count++;
    group.rows.push(values);
    grouped.set(key, group);
  }
  return [...grouped.values()].sort((a, b) => (a.value === null) === (b.value === null) ? a.label.localeCompare(b.label) : a.value === null ? 1 : -1);
}

/** Each field's totals over these records: of its numbers, and a count of those holding any value. */
function totalsOver(rows: Values[], asked: Record<string, TotalKind[]>): Totals {
  const totals: Totals = {};
  for (const [field, kinds] of Object.entries(asked)) {
    const numbers = rows.map((values) => values[field]).filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
    const sum = numbers.reduce((a, b) => a + b, 0);
    const of: Record<TotalKind, number | null> = {
      sum,
      avg: numbers.length ? sum / numbers.length : null,
      min: numbers.length ? numbers.reduce((a, b) => Math.min(a, b)) : null,
      max: numbers.length ? numbers.reduce((a, b) => Math.max(a, b)) : null,
      count: rows.filter((values) => !blankValue(values[field])).length,
    };
    totals[field] = Object.fromEntries(kinds.map((kind) => [kind, of[kind]]));
  }
  return totals;
}

const blankValue = (v: unknown) => v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0);

/** Bytes as base64, by the host's `btoa` (a browser's, or Node's). */
function base64(bytes: Uint8Array): string {
  let text = '';
  for (let at = 0; at < bytes.length; at += 0x8000) text += String.fromCharCode(...bytes.subarray(at, at + 0x8000));
  return (globalThis as unknown as { btoa(text: string): string }).btoa(text);
}

const MINUTE = 60000;
/** "09:30" as minutes into its day. */
const minutesOf = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
const sameValue = (a: unknown, b: unknown) => JSON.stringify(a && typeof a === 'object' && 'id' in a ? (a as RelatedRecord).id : a ?? null) === JSON.stringify(b && typeof b === 'object' && 'id' in b ? (b as RelatedRecord).id : b ?? null);

/** The spans a schedule's bookings hold, as instants from and to: the record booked aside, and only those of the same doctor when it says. */
function bookedIn(schedule: MemorySchedule, request: SlotsRequest, stored: Record<string, Values>): [number, number][] {
  const { field = request.field, endField, same = [] } = schedule.bookings ?? {};
  const length = (request.length ?? schedule.length ?? 30) * MINUTE;
  const spans: [number, number][] = [];
  for (const [key, values] of Object.entries(stored)) {
    if (request.recordId !== null && String(request.recordId) === key) continue;
    if (!same.every((name) => sameValue(values[name], request.values[name]))) continue;
    const start = Date.parse(String(values[field] ?? ''));
    if (Number.isNaN(start)) continue;
    const end = endField ? Date.parse(String(values[endField] ?? '')) : NaN;
    spans.push([start, Number.isNaN(end) ? start + length : end]);
  }
  return spans;
}

/**
 * The days asked of a schedule: each day's times from its hours, a booking's length apart (and the minutes kept free
 * after one), on the schedule's clock — a time the clocks skip that day left out, one they repeat taken the first
 * time — less those a booking holds and those past. Open with times left; full with none left; closed where it has
 * no hours, or every time has gone by; a holiday by its name.
 */
function slotsOf(schedule: MemorySchedule, request: SlotsRequest, booked: [number, number][], now: number): SlotsResult {
  const length = request.length ?? schedule.length ?? 30;
  const between = request.between ?? schedule.between ?? 0;
  const days: Record<string, SlotDay> = {};
  const first = wallOf(request.from);
  const last = wallOf(request.to);
  if (!first || !last) return { days, length };
  for (let at = Date.UTC(first.year, first.month - 1, first.day); at <= Date.UTC(last.year, last.month - 1, last.day); at += 86400000) {
    const date = new Date(at);
    const day = date.toISOString().slice(0, 10);
    const holiday = schedule.holidays?.[day];
    if (holiday) {
      days[day] = { state: 'holiday', note: holiday };
      continue;
    }
    const free: string[] = [];
    let any = false;
    for (const [from, to] of schedule.hours[date.getUTCDay() || 7] ?? []) {
      for (let minutes = minutesOf(from); minutes + length <= minutesOf(to); minutes += length + between) {
        const start = instantsAt({ year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate(), hour: Math.floor(minutes / 60), minute: minutes % 60 }, schedule.timeZone)[0];
        if (start === undefined || start <= now) continue;
        any = true;
        const end = start + length * MINUTE;
        // Taken where a booking, and the minutes kept free after it, meet this time and those kept free after it.
        if (booked.some(([from, until]) => start < until + between * MINUTE && from < end + between * MINUTE)) continue;
        free.push(new Date(start).toISOString());
      }
    }
    days[day] = free.length ? { state: 'open', free } : { state: any ? 'full' : 'closed' };
  }
  return { days, length };
}
