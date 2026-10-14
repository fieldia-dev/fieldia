import type { FilterCondition, Fields, Option, PropertyDefinition } from '../format/field';
import type { JsonValue } from '../format/json';
import type { FileValue, RecordId, RelatedRecord, Values } from './values';
import type { RunStop } from './run';

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
  /** The choices of one of the app's lists, for a selection with `optionsFrom`. */
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
  /** Every value of the form, for a list that changes with another field (`dependsOn`). */
  values: Values;
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

export interface GroupRequest {
  model: string;
  field: string;
  filter: ResolvedFilter[];
}

/** The records under one value of a field: a link's by its id, and those with none as a group of their own (value null). */
export interface Group {
  value: JsonValue;
  label: string;
  count: number;
}

/** How a field is totalled: added up, averaged, its least or its most, or how many records hold a value in it. */
export type TotalKind = 'sum' | 'avg' | 'min' | 'max' | 'count';

export interface TotalsRequest {
  model: string;
  /** The list's search, as `list` gets it. For the ticked rows alone, add `{ field: 'id', op: 'in', value: ids }`. */
  filter: ResolvedFilter[];
  /** What to total, by field: `{ amount: ['sum'], hours: ['sum', 'avg'] }`. */
  totals: Record<string, TotalKind[]>;
  /** Total under each value of this field as well, grouped as `groups` groups it: a Group By heading's sums. */
  groupBy?: string;
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
}

export interface TotalsGroup extends Group {
  totals: Totals;
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
}

export interface SubmitResult {
  id?: RecordId;
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
