import type { FilterCondition, Fields, Option, PropertyDefinition } from '../format/field';
import type { JsonValue } from '../format/json';
import type { FileValue, RecordId, RelatedRecord, Values } from './values';
import type { RunStop } from './run';
import type { DateInterval } from './periods';

/**
 * How Fieldia reaches data. Fieldia knows no backend: an app implements this
 * interface for its own (a Flectra adapter, a REST client, a survey store),
 * and every method is optional so a page uses only what it needs.
 */
export interface DataSource {
  /**
   * Read a record. Needed to edit an existing record. Its values, or
   * `loadedRecord(values, { version, can })` to tell also its version — so a
   * save can tell that someone else changed it since — and what this person
   * may do with it. `loadedRecordOf` reads either the same way.
   */
  load?(request: LoadRequest): Promise<Values | LoadedRecord>;
  /**
   * Create (`id: null`) or update a record. Needed to save a record page. A
   * source that keeps versions compares `request.version` with the record's
   * and throws a `ConflictError` when someone else saved it since.
   */
  save?(request: SaveRequest): Promise<SaveResult>;
  /** Recalculate after a value changes, the way a backend's onchange does. */
  onchange?(request: OnchangeRequest): Promise<OnchangeResult>;
  /** Find records a many2one, many2many or reference may point to. */
  search?(request: SearchRequest): Promise<RelatedRecord[]>;
  /** Make a record from just its name, for "Create 'xyz'" in a link field (a backend's name_create). */
  create?(request: CreateRequest): Promise<RelatedRecord>;
  /** Store one response to a `responses` page, such as a survey. */
  submit?(request: SubmitRequest): Promise<SubmitResult>;
  /** Records for a list: filtered, sorted and one page of them, with how many there are in all; with `allIds`, the ids of every one that matches. */
  list?(request: ListRequest): Promise<ListResult>;
  /** How many records fall under each value of a field, for a list's Group By. */
  groups?(request: GroupRequest): Promise<Group[]>;
  /** The choices of one of the app's lists, for a selection with `optionsFrom` — a page's field, or a table's line by its values. */
  options?(request: OptionsRequest): Promise<Option[]>;
  /** The definitions of a properties field with `definitionsFrom`: those the linked record keeps. */
  definitions?(request: OptionsRequest): Promise<PropertyDefinition[]>;
  /** Keep a properties field's definitions, a property added in place among them, on the record they come from. */
  saveDefinitions?(request: OptionsRequest & { definitions: PropertyDefinition[] }): Promise<void>;
  /** Archive a record, or bring it back (`archive: false`): Flectra's `active` set false or true. For the `archive` and `unarchive` steps. */
  archive?(request: ArchiveRequest): Promise<void>;
  /** Copy a record, as a backend's copy does: the copy's id, and its values when the source has them. For the `duplicate` step. */
  copy?(request: RecordRequest): Promise<SaveResult>;
  /** Delete a record. For the `delete` step. */
  delete?(request: RecordRequest): Promise<void>;
  /**
   * The record's attachments, its main one first, for a sheet's attachment
   * preview: each a file with its `url` (or its `data`) and its media type.
   */
  attachments?(request: RecordRequest): Promise<FileValue[]>;
  /**
   * Totals over the records a search finds — each field's sum, average,
   * least, most or count — over them all and, with `groupBy`, under each
   * value of a field: the row under a list and the sums on its Group By
   * headings. Without it, a list shows no totals.
   */
  totals?(request: TotalsRequest): Promise<TotalsResult>;
  /**
   * Store one file where the app keeps files, as soon as it is picked, for a
   * file or picture field: the record then keeps only its link. Without it,
   * a file travels inside the record as base64, as it always has. To fail,
   * throw: the field offers Retry, except after `saveRefused({ kind: 'rule',
   * message })`, which says the store refuses this file (its kind, its
   * size) and is shown as it is.
   */
  upload?(file: UploadFile, request: UploadRequest): Promise<UploadedFile>;
  /**
   * The times free to book, for a date and time drawn as booking slots
   * (`"widget": "slots"`): each day asked — the days of a month, in the
   * field's time zone — with its state (open, full, closed, a holiday) and
   * the times a booking may start on it; asked again for the day of a time
   * picked, so a time someone else took meanwhile is said, never booked.
   * Without it, such a field is the plain date and time box.
   */
  slots?(request: SlotsRequest): Promise<SlotsResult>;
  /**
   * Change many records at once, the same value in each field given: a
   * list's bulk edit, of the rows ticked or of every record the search
   * finds. Answer with those not changed and why; every other one is taken
   * as changed. Without it, the list saves each in turn (`save`, `partial`).
   * Refuse a record this person may not change, or one changed since the
   * version it was listed at (`versions`), as a save would.
   */
  writeMany?(request: WriteManyRequest): Promise<WriteManyResult>;
  /**
   * Write a list's export on the server, in place of the browser: for
   * exports too big for a browser, or files the server words its own way.
   * Answer with the file — its bytes (`data`: a Blob fits) or its address
   * (`url`) — for the browser to save; with `{ message }` when the server
   * hands it over its own way (an email on its way), the list saying it; or
   * with `false` to let the list write it in the browser after all, as it
   * does without this (a small export, say).
   */
  exportRecords?(request: ExportRequest): Promise<ExportedFile | { message: string } | false>;
  /**
   * Make many records at once, each with its own values: a list's Import of
   * a file's rows, a thousand at a time. Answer for each record asked for,
   * in its order: the id it was made with, or why it was not made, in the
   * person's words. Without it, the list saves each in turn (`save` with no
   * id).
   */
  createMany?(request: CreateManyRequest): Promise<CreateManyResult>;
  /**
   * Take a list's Import on the server, in place of the browser: a file too
   * big for one, or a server that imports its own way. Asked once the person
   * has matched the file's columns to the page's fields, before a row is
   * checked: answer `{ message }` when the server takes the file (the list
   * says it: "Your file is being imported: you will get an email"), or
   * `false` to let the browser import it after all, as it does without this.
   */
  importRecords?(request: ImportRequest): Promise<{ message: string } | false>;
  /**
   * Records like the one typed, for a page's possible duplicates (`duplicates`): asked a moment after a person stops
   * typing in a field it names, as a saved record is opened, and as a record is saved — with the fields it names that
   * hold a value. Answer with the records that have the same phone, email or id, or a name close enough, each with
   * the fields it matched on; never the record itself. Without it, nothing is asked and nothing shows.
   */
  duplicates?(request: DuplicatesRequest): Promise<DuplicatesResult>;
  /**
   * Merge records into one, as a person chose on a possible duplicate's Merge: `keepId` kept, holding the values
   * picked for each field, and `mergeIds` gone. Moving what was theirs — messages, activities, the records that link
   * to them — to the one kept is the source's work; the page says it will happen. Refuse with `saveRefused` (a `rule`,
   * with why) and nothing changes. Without it, possible duplicates offer no Merge.
   */
  merge?(request: MergeRequest): Promise<MergeResult | void>;
  /**
   * The records a person said are someone else for this one ("It's someone new"), by id: asked as a saved record is
   * shown, before its possible duplicates are said, so one let be on another device stays let be here. A pair: answer
   * from either side where you keep them so. With `markNotDuplicate`, these are kept on your server; without both,
   * in the person's browser (the viewer's `preferences`), as before. To fail, throw: what the browser kept is read.
   */
  notDuplicates?(request: NotDuplicatesRequest): Promise<RecordId[]>;
  /**
   * Keep that a record found is someone else for this one: the person pressed "It's someone new" on a saved record,
   * or saved a new one after pressing it (once for each). Never said as its duplicate again, on any device. Refused
   * (thrown), the browser keeps it instead, as without this.
   */
  markNotDuplicate?(request: MarkNotDuplicateRequest): Promise<void>;
}

/** Whose possible duplicates were let be: what `notDuplicates` is asked. */
export interface NotDuplicatesRequest {
  model: string;
  /** The record shown, saved. */
  recordId: RecordId;
}

/** A record found, said to be someone else for this one: what `markNotDuplicate` is asked. */
export interface MarkNotDuplicateRequest {
  model: string;
  /** The record shown, saved. */
  recordId: RecordId;
  /** The record found like it, which is someone else. */
  matchId: RecordId;
}

/** Many records made at once, each with its own values: a list's Import. */
export interface CreateManyRequest {
  model: string;
  /** Each record's values, in the file's order: what its row fills in, and the page's defaults for the rest. Links as `{ id, label }`. */
  records: Values[];
  /** The fields' definitions, as a save gets them. */
  fields: Fields;
}

export interface CreateManyResult {
  /**
   * One answer for each record asked for, in the same order: the id it was made with, or why it was not made — and,
   * where the source has it, the problem as a save would throw it (a field's own words). A record left unanswered is
   * taken as not made.
   */
  records: ({ id: RecordId } | { message: string; problem?: SaveProblem })[];
}

/** A file a list's Import hands to the server, its columns matched to the page's fields. */
export interface ImportRequest {
  model: string;
  /** The file as the person picked it: a browser's File fits. */
  file: UploadFile;
  /** Each column of the file, in its order — its header's words, and the field it fills, null where it is left out. */
  columns: { header: string; field: string | null }[];
  /** How many rows it holds under its header. */
  rows: number;
  /** The fields' definitions, as a save gets them. */
  fields: Fields;
  /** The page's language and the order it writes dates in, so a server reads the cells as the page would. */
  locale: string;
  dateOrder: 'dmy' | 'mdy' | 'ymd';
}

/** Records like the one typed: what `duplicates` is asked. */
export interface DuplicatesRequest {
  model: string;
  /** The record typed, never its own duplicate; null while it is new. */
  recordId: RecordId | null;
  /** Every value of the form, as typed: a phone kept as E.164 where the page reads phones the world over. */
  values: Values;
  /** The fields to compare it by, by name: those the page names (`duplicates.fields`) that hold a value now. */
  fields: string[];
}

/** A record like the one typed. */
export interface DuplicateMatch {
  id: RecordId;
  /** Its name, as people know it: "Nile Traders". */
  name: string;
  /**
   * What it matched on: the names of the fields asked that it holds the same (`phone`, `email`), or a name close to
   * the one typed (the name's field). Each is said under that field's box; words of the source's own ("the same
   * address") are said as they are.
   */
  why: string[];
  /** How alike, from 0 to 1, where the source tells: the likest first. */
  score?: number;
}

export interface DuplicatesResult {
  matches: DuplicateMatch[];
}

/** Records merged into one: what `merge` is asked. */
export interface MergeRequest {
  model: string;
  /** The record kept. */
  keepId: RecordId;
  /** The records merged into it, then gone. */
  mergeIds: RecordId[];
  /** The kept record's values, as picked on the merge's screen for each field the records held apart. */
  values: Values;
  /** The page's fields, so the source knows each link's model, as a save does. */
  fields: Fields;
}

/** What a merge may tell: words of the source's own about it, said once it is done ("4 messages moved"). */
export interface MergeResult {
  message?: string;
}

/** The same value written in a field of each record: a list's bulk edit. */
export interface WriteManyRequest {
  model: string;
  ids: RecordId[];
  /** The fields written and their value, the same in each record: `{ state: 'active' }`. */
  values: Values;
  /** Those fields' definitions, as a save gets them. */
  fields: Fields;
  /** The version each record was listed at, by its id, where the list knew it: one changed since is refused, as a save over someone else's. */
  versions?: Record<string, RecordVersion>;
}

export interface WriteManyResult {
  /** Each record not changed, with why in the person's words — and, where the source has it, the problem as a save would throw it (a conflict's who and when). */
  failed: { id: RecordId; message: string; problem?: SaveProblem }[];
}

/** A list's records to put in a file: those ticked, or every one its search finds. */
export interface ExportRequest {
  model: string;
  format: 'xlsx' | 'csv';
  /** The list's columns, in its order, each with its header's words. */
  columns: { field: string; label: string }[];
  /** The records ticked, by id; left out, every record `filter` finds. */
  ids?: RecordId[];
  /** The list's search, as `list` gets it. */
  filter: ResolvedFilter[];
  /** The list's order now. */
  sort: SortOrder[];
  /** How many records go. */
  count: number;
  /** The file's name, as the list would give it: "Customers 2026-10-16.xlsx". */
  name: string;
  /** The page's language, for values written as people there read them. */
  locale: string;
}

/** A file for the browser to save: its bytes, or where to fetch them. */
export interface ExportedFile {
  name: string;
  /** Its media type, when `data` does not say it. */
  type?: string;
  /** Its bytes: a Blob, an ArrayBuffer, a typed array, or text. */
  data?: ExportBytes | ArrayBuffer | ArrayBufferView | string;
  /** Where the browser fetches it, in place of `data`. */
  url?: string;
}

/** A Blob, as far as an export reads one: core names no DOM types. */
export interface ExportBytes {
  readonly size: number;
  readonly type: string;
  arrayBuffer(): Promise<ArrayBuffer>;
}

/**
 * Which state of a record a page opened, as its source keeps it: an etag, a
 * write date, a revision number — Fieldia only hands `token` back — with who
 * changed the record last and when, for the words a conflict shows ("Mona
 * changed this at 10:42").
 */
export interface RecordVersion {
  token: string;
  /** Who changed it last, by the name people know them by. */
  by?: string;
  /** When, as an ISO date and time: `2026-10-13T10:42:00Z`. */
  at?: string;
}

/**
 * What this person may do with one record. Each is allowed unless it says
 * `false`, so a source that tells nothing keeps today's behaviour. The page
 * hides what is not allowed — never shows it disabled — and says why.
 */
export interface RecordPermissions {
  /** False: the form is read-only for this person, and Save is hidden. */
  edit?: boolean;
  /** False: Delete is hidden, and the `delete` step's buttons. */
  delete?: boolean;
  /** False: Archive and Unarchive are hidden, and those steps' buttons. */
  archive?: boolean;
  /** False: Duplicate is hidden, and the `duplicate` step's buttons. */
  duplicate?: boolean;
  /** Fields this person may see but not change on this record, by name. */
  readonlyFields?: string[];
  /** Fields this person may not see on this record, by name: hidden, and the source leaves their values out. */
  hiddenFields?: string[];
  /** Why not everything is allowed, in the person's language, for the page to say: "Only Mona, the lead's agent, can change it." */
  reason?: string;
}

/**
 * A record as `load` gives it to tell more than its values. A field cannot
 * be named `$loaded`, so the mark keeps it apart from bare values.
 */
export interface LoadedRecord {
  $loaded: true;
  values: Values;
  /** The version it was read at: each save carries it back. */
  version?: RecordVersion;
  /** What this person may do with it. */
  can?: RecordPermissions;
}

/** What `load` returns to tell a record's version, or what this person may do with it, beside its values. */
export function loadedRecord(values: Values, more: { version?: RecordVersion; can?: RecordPermissions } = {}): LoadedRecord {
  return { $loaded: true, values, ...(more.version ? { version: more.version } : {}), ...(more.can ? { can: more.can } : {}) };
}

/** What a load gave, in one shape: bare values, as every source gave them before, are a record with nothing more to tell. */
export function loadedRecordOf(loaded: Values | LoadedRecord): LoadedRecord {
  const marked = loaded as Partial<LoadedRecord>;
  return marked.$loaded === true && marked.values !== null && typeof marked.values === 'object' ? (loaded as LoadedRecord) : { $loaded: true, values: loaded as Values };
}

/** One stored record, by its model and id. */
export interface RecordRequest {
  model: string;
  id: RecordId;
  /** The page's fields, so the source knows what the page shows of it. */
  fields: Fields;
}

export interface ArchiveRequest extends RecordRequest {
  /** True to archive it, false to bring it back. */
  archive: boolean;
}

export interface OptionsRequest {
  /** The list's name, from the field's `optionsFrom.list`. */
  list: string;
  /**
   * Every value of the form, for a list that changes with another field (`dependsOn`). For a table's line, the line's
   * values: its connection, for its tools.
   */
  values: Values;
  /**
   * For a table's line — or a form editing one in a dialog — the values of the record it is on, which a line's list
   * may change with (`parent.` in its `dependsOn`). Left out for a page's own field.
   */
  parent?: Values;
}

export interface CreateRequest {
  model: string;
  /** What the person typed: the new record's name. */
  name: string;
  /** What else it starts with, from the link's `createValues`: links as `{ id, label }`. */
  values?: Values;
}

export interface LoadRequest {
  model: string;
  id: RecordId;
  /** The page's fields, so the source reads exactly what the page shows. */
  fields: Fields;
}

export interface SaveRequest {
  model: string;
  id: RecordId | null;
  /** The page's fields, so the source knows each relation's model. */
  fields: Fields;
  /** Only what changed since the record was loaded or last saved. */
  changes: RecordChanges;
  /** Every value, for sources that save whole records. */
  values: Values;
  /**
   * True when the save carries some of the record's fields, not all of it:
   * `values` then holds the fields in `changes` alone and `fields` names
   * them alone — a save from outside a form, which never had the rest, as a
   * calendar's move and its Undo. A source that saves whole records writes
   * these over the record as stored and keeps every other field.
   */
  partial?: boolean;
  /**
   * The version the record was opened at — from its load, or from the last
   * save — for a source that refuses a save over someone else's. None for a
   * new record, nor from a source that tells no versions. "Keep mine" after
   * a conflict saves again with the conflict's `version`: these changes over
   * the record as it is now.
   */
  version?: RecordVersion;
}

export interface SaveResult {
  id: RecordId;
  /** The record as stored, when the source recalculated anything. */
  values?: Values;
  /** Its version now, for the next save to carry. */
  version?: RecordVersion;
  /** What the person may do with it now, when the save changed that (a stage that locks it). */
  can?: RecordPermissions;
}

export interface OnchangeRequest {
  model: string;
  id: RecordId | null;
  /** The field that changed. */
  changed: string;
  values: Values;
}

export interface OnchangeResult {
  /** New values for other fields. */
  values?: Values;
  /** Something to tell the person editing, without blocking them. */
  warning?: string;
}

export interface SearchRequest {
  /** The related model, from the field's `relation`. */
  model: string;
  query: string;
  /** The field's filter, with every `valueFrom` already replaced by its value. */
  filter?: ResolvedFilter[];
  limit?: number;
  /**
   * Only the records named exactly `query`, in any case — not every one whose
   * name holds it. A box asks so for a name typed when a search's first
   * answers, cut at their limit, did not hold it ("Nile" after ten "Blue
   * Nile"s), and to tell whether more than one record has that name. A source
   * that does not know it searches as ever: the box looks for the name among
   * what comes.
   */
  exact?: boolean;
}

export type ResolvedFilterCondition = Omit<FilterCondition, 'valueFrom' | 'value'> & { value: JsonValue };

export interface SortOrder {
  field: string;
  desc?: boolean;
  /**
   * Nearest this place first, for a list's "Nearest first": the field is a
   * place (a GeoJSON point), or a latitude when `longitude` names its pair.
   * A data source that cannot sort by distance leaves the order as it is.
   */
  near?: { lat: number; lng: number; longitude?: string };
}

export interface ListRequest {
  model: string;
  /** The fields the list shows. */
  fields: string[];
  /** What the search bar and the open groups ask for; an `any` group is an OR. */
  filter: ResolvedFilter[];
  /** By the first, then the next: a link by its label, empty values last. */
  sort: SortOrder[];
  offset: number;
  limit: number;
  /**
   * Give also the id of every record that matches, in this order, in
   * `ListResult.allIds`: for "Select all 1,284 that match", export and bulk
   * edit. A source that leaves it out is paged through instead.
   */
  allIds?: boolean;
}

export interface ListResult {
  records: ListedRecord[];
  /** How many records match in all, for the pager. */
  total: number;
  /** With `allIds`: every matching record's id. Fewer than `total` means the source stopped short, and the page says so. */
  allIds?: RecordId[];
}

/** One row of a list. */
export interface ListedRecord {
  id: RecordId;
  values: Values;
  /** Its version, for a bulk edit that saves it to carry. */
  version?: RecordVersion;
  /** What the person may do with it: its row's buttons and a bulk edit keep to it. */
  can?: RecordPermissions;
}

/**
 * How a date's records are grouped: by the day, week, month, quarter or year
 * each falls in rather than by its exact value. Each group's `value` is then
 * the first day of its span — "2026-03-01" for March 2026, "2026-03-09" for
 * the week from 9 March — the page writing its words ("March 2026", "Week 11,
 * 2026"); the groups in time order, those with no date last. `spanStart`
 * counts a value's span as a source should.
 */
export interface GroupInterval {
  /** For a date or a date and time field: group by the span each record falls in. */
  interval?: DateInterval;
  /** With `interval: "week"`: the day a week starts on, 0 Sunday to 6 Saturday — the page's language's. */
  weekStart?: number;
  /** With `interval`, for a date and time field: the time zone its days are told in (IANA: "Africa/Cairo") — the page's. */
  timeZone?: string;
}

export interface GroupRequest extends GroupInterval {
  model: string;
  field: string;
  filter: ResolvedFilter[];
}

/**
 * The records under one value of a field: a link's by its id, a record of links (a many2many) under each of its links
 * — tags counted as a server groups them, a list's filter counting each — and those with none as a group of their own
 * (value null).
 */
export interface Group {
  value: JsonValue;
  label: string;
  count: number;
}

/** How a field is totalled: added up, averaged, its least or its most, or how many records hold a value in it. */
export type TotalKind = 'sum' | 'avg' | 'min' | 'max' | 'count';

export interface TotalsRequest extends GroupInterval {
  model: string;
  /** The list's search, as `list` gets it. For the ticked rows alone, add `{ field: 'id', op: 'in', value: ids }`. */
  filter: ResolvedFilter[];
  /** What to total, by field: `{ amount: ['sum'], hours: ['sum', 'avg'] }`. */
  totals: Record<string, TotalKind[]>;
  /** Total under each value of this field as well, grouped as `groups` groups it (by `interval`, for a date): a Group By heading's sums. */
  groupBy?: string;
  /**
   * The field holding each amount's currency, by the money field, where each
   * record keeps its own: `{ amount: 'currency_id' }`. Such an amount is
   * totalled within one currency only: over records in more than one, its
   * sum, average, least and most are null — no honest number — and the
   * result names the currency of those it could total (`currencies`).
   */
  currencies?: Record<string, string>;
}

/**
 * Each field's totals, by field and then by kind: `totals.amount.sum`. The
 * sum and the count of nothing are 0, the others null. A total the source
 * cannot make honestly — amounts in more than one currency — is null, and
 * the page shows none.
 */
export type Totals = Record<string, Partial<Record<TotalKind, number | null>>>;

export interface TotalsResult {
  /** How many records match. */
  count: number;
  totals: Totals;
  /** With `groupBy`: each value's totals, in the order `groups` gives them. */
  groups?: TotalsGroup[];
  /**
   * With `currencies` asked: the currency each money field's totals are in,
   * by field, as its currency field holds it (a link as `{ id, label }`, a
   * code as "EGP"); null where its records hold more than one, or none. A
   * page writes an amount's total only in a currency it knows: the field's
   * own, or the one named here.
   */
  currencies?: Record<string, JsonValue>;
}

export interface TotalsGroup extends Group {
  totals: Totals;
  /** The currency of each money field's totals under this value, as `TotalsResult.currencies` says it. */
  currencies?: Record<string, JsonValue>;
}

/**
 * A file to store: what an upload reads of a browser's `File`. Core names no
 * DOM types; an adapter may type its parameter `File` and hand it to `fetch`
 * or a storage SDK as it is.
 */
export interface UploadFile {
  readonly name: string;
  readonly size: number;
  readonly type: string;
  arrayBuffer(): Promise<ArrayBuffer>;
}

/** An `AbortSignal`, as far as an upload listens to it. */
export interface UploadSignal {
  readonly aborted: boolean;
  addEventListener(type: 'abort', listener: () => void): void;
  removeEventListener(type: 'abort', listener: () => void): void;
}

export interface UploadRequest {
  /** The page's model: for a saved form placed in a record, the record's. */
  model: string;
  /**
   * The file or picture field the file is for. In a saved form placed in a
   * record, whose answers the record keeps under the part's name, the field's
   * place in them: `consent.doc`, as a line's table is `consent.items`.
   */
  field: string;
  /** The record it is for; null while that record is new — its first save links the file to it. */
  recordId: RecordId | null;
  /** For a field on a line of a table: the table's field, the line's key and, once saved, its id. */
  line?: { field: string; key: string; id?: RecordId };
  /** Aborts when the person takes the file away or leaves before it is stored: stop, and reject with an error named `AbortError`. */
  signal?: UploadSignal;
  /** How far it has got, bytes sent of the bytes in all, for its progress bar; without a call the bar moves with no number. */
  onProgress?: (sent: number, total: number) => void;
}

/** A stored file, as the field keeps it — a `FileValue` with its link instead of its bytes. */
export interface UploadedFile {
  url: string;
  name: string;
  size: number;
  type: string;
  /** Its id, where the source keeps files as records of their own (Flectra's attachments): a save links it by this. */
  fileId?: RecordId;
}

/**
 * A filter as a search receives it: each `valueFrom` already replaced by its
 * value. An adapter must keep the groups: `any` is an OR, `all` an AND.
 */
export type ResolvedFilter = ResolvedFilterCondition | { any: ResolvedFilter[] } | { all: ResolvedFilter[] };

export interface SubmitRequest {
  pageId: string;
  /** The answers to the questions that were shown. Skipped steps are left out. */
  values: Values;
  /** On a page with a bot check (`botCheck`): what it saw, for the app to decide on. The page never refuses a send for it. */
  bot?: BotReport;
}

/**
 * What a page's bot check saw as its answers were sent. A person never fills the hidden box and takes longer than a
 * few seconds; a send that is either is likely a bot's — or a person's whose browser filled every box at once, which is
 * why the app decides: keep it aside, ask the captcha's service, or refuse it.
 */
export interface BotReport {
  /** The hidden box was filled: no person sees it, reaches it with Tab or hears it read out. */
  honeypot: boolean;
  /** Sent sooner than the page's `minSeconds` after it was shown, or started again. */
  tooFast: boolean;
  /** Seconds from the page shown (or started again) to this send, to a tenth. */
  seconds: number;
  /** The captcha's token, on a page with one (`botCheck.captcha`), for the app to check with its service: null when none came. */
  captcha?: string | null;
}

export interface SubmitResult {
  /** The id the app gave the response: a booking's reference ("B-1043"), a ticket's number. An ending's words say it as `{id}`. */
  id?: RecordId;
  /**
   * Values the app worked out as it kept the response, by the page's fields — a reference field it filled in, the time
   * it confirmed — laid over the answers sent where an ending reads them (its `when` and its `{field}`s). The form's
   * answers themselves stay as they were sent.
   */
  values?: Values;
}

/**
 * What changed, using the operation names Odoo gives its x2many commands, so
 * an adapter maps them one to one.
 */
export interface RecordChanges {
  /** Changed values of every field that is not one2many or many2many. */
  values: Values;
  /** one2many changes, per field. */
  lines: Record<string, LineOp[]>;
  /** many2many changes, per field. */
  links: Record<string, LinkOp[]>;
}

export type LineOp =
  | { op: 'create'; key: string; values: Values }
  | { op: 'update'; id: RecordId; values: Values }
  | { op: 'delete'; id: RecordId };

export type LinkOp =
  | { op: 'link'; id: RecordId }
  | { op: 'unlink'; id: RecordId }
  | { op: 'set'; ids: RecordId[] }
  | { op: 'clear' };

/**
 * Why a save was refused, so each kind is shown where it belongs: `fields`
 * under those fields, a `rule` (a backend's business rule) in a dialog,
 * `network` in a banner with Retry, `other` beside Save with Retry, and a
 * `conflict` with Reload and Keep mine.
 */
export interface SaveProblem {
  /** `stopped`: a step of the page's `beforeSave` stopped it, with `reason` — no data source was asked. */
  kind: 'fields' | 'rule' | 'network' | 'other' | 'stopped' | 'conflict';
  message: string;
  /** For `fields`: a message for each field, by name. */
  fields?: Record<string, string>;
  /** For `stopped`: why the step stopped. */
  reason?: RunStop;
  /** For `conflict`: who changed the record, when, and what it holds now. */
  conflict?: SaveConflict;
}

/** Someone else saved the record after this page opened it. */
export interface SaveConflict {
  /** The version the record has now, with who changed it and when. Saving with it is "Keep mine". */
  version: RecordVersion;
  /**
   * The record as the other person left it, when the source has it: what
   * Reload shows without asking again, and what a source that saves whole
   * records keeps of theirs under Keep mine — their values, with this
   * person's changes over them.
   */
  theirs?: Values;
}

/**
 * What a source's save throws when the record changed after the page opened
 * it: `saveProblemOf` reads it as a `conflict`, and the page names who
 * changed it and when (`conflict.version.by`, `.at`) and offers Reload or
 * Keep mine.
 */
export class ConflictError extends Error {
  readonly conflict: SaveConflict;
  readonly problem: SaveProblem;
  constructor(conflict: SaveConflict, message = 'Someone else changed this record after it was opened') {
    super(message);
    this.name = 'ConflictError';
    this.conflict = conflict;
    this.problem = { kind: 'conflict', message, conflict };
  }
}

/** An error for a data source's save to throw when the backend refuses it. */
export function saveRefused(problem: SaveProblem): Error & { problem: SaveProblem } {
  return Object.assign(new Error(problem.message), { problem });
}

/** What a failed save tells: its own problem, a failed fetch as the network, anything else as it is. */
export function saveProblemOf(error: unknown): SaveProblem {
  const carried = (error as { problem?: SaveProblem } | null)?.problem;
  if (carried && typeof carried.kind === 'string') return carried;
  const message = error instanceof Error ? error.message : String(error);
  if (error instanceof TypeError && /fetch|network|load failed/i.test(message)) return { kind: 'network', message };
  return { kind: 'other', message };
}

/** What a booking's free times are asked with: the days, the zone they are in, and what the page knows of the booking. */
export interface SlotsRequest {
  /** The page's model, for a record page; empty for a responses page. */
  model: string;
  /** The date and time field booked. */
  field: string;
  /** The record booked, so its own booking counts as free for it; null for a new one. */
  recordId: RecordId | null;
  /** The schedule the field's node names (`options.schedule`): a doctor's, a showroom's. The field's name unless it names one. */
  schedule: string;
  /** The first and the last day asked, both included, as 2026-10-01: days in `timeZone`. */
  from: string;
  to: string;
  /** The zone the days are in, by its IANA name: the field's, its page's, or the browser's. */
  timeZone: string;
  /** The minutes a booking lasts, and those kept free between two, as the page says (`options.length`, `options.between`). */
  length?: number;
  between?: number;
  /** Every value of the form: the doctor, the service, the car to drive. */
  values: Values;
}

/** What a day is for booking: times free on it, all taken, not open, or a holiday. */
export type SlotDayState = 'open' | 'full' | 'closed' | 'holiday';

/** One day of a booking's: its state and the times a booking may start on it. */
export interface SlotDay {
  state: SlotDayState;
  /** The times free, as instants (ISO 8601, in UTC or with their offset: 2026-10-15T09:30:00+03:00), earliest first. */
  free?: string[];
  /** Words for the day, in the person's language: a holiday's name, why it is closed. */
  note?: string;
}

/** The days asked, each by its date (2026-10-15): a day left out is closed. */
export interface SlotsResult {
  days: Record<string, SlotDay>;
  /** The minutes a booking lasts, when the source knows better than the page: the service's own length. */
  length?: number;
}

/**
 * A new record's save, made from its values alone — as a list's Import saves a row where the source has no
 * `createMany`, and a memory source makes each of `createMany`'s: every value in `values`, the links of a many2many
 * as one `set`, the rest as changes.
 */
export function newRecordSave(model: string, fields: Fields, values: Values): SaveRequest {
  const changes: RecordChanges = { values: {}, lines: {}, links: {} };
  for (const [name, value] of Object.entries(values)) {
    if (fields[name]?.type === 'many2many') changes.links[name] = [{ op: 'set', ids: Array.isArray(value) ? (value as RelatedRecord[]).map((record) => record.id) : [] }];
    else changes.values[name] = value;
  }
  return { model, id: null, fields, changes, values };
}
