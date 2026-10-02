import type { FilterCondition, Fields } from '../format/field';
import type { JsonValue } from '../format/json';
import type { RecordId, RelatedRecord, Values } from './values';

/**
 * How Fieldia reaches data. Fieldia knows no backend: an app implements this
 * interface for its own (a Flectra adapter, a REST client, a survey store),
 * and every method is optional so a page uses only what it needs.
 */
export interface DataSource {
  /** Read a record. Needed to edit an existing record. */
  load?(request: LoadRequest): Promise<Values>;
  /** Create (`id: null`) or update a record. Needed to save a record page. */
  save?(request: SaveRequest): Promise<SaveResult>;
  /** Recalculate after a value changes, the way a backend's onchange does. */
  onchange?(request: OnchangeRequest): Promise<OnchangeResult>;
  /** Find records a many2one, many2many or reference may point to. */
  search?(request: SearchRequest): Promise<RelatedRecord[]>;
  /** Make a record from just its name, for "Create 'xyz'" in a link field (a backend's name_create). */
  create?(request: CreateRequest): Promise<RelatedRecord>;
  /** Store one response to a `responses` page, such as a survey. */
  submit?(request: SubmitRequest): Promise<SubmitResult>;
}

export interface CreateRequest {
  model: string;
  /** What the person typed: the new record's name. */
  name: string;
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
}

export interface SaveResult {
  id: RecordId;
  /** The record as stored, when the source recalculated anything. */
  values?: Values;
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
  filter?: ResolvedFilterCondition[];
  limit?: number;
}

export type ResolvedFilterCondition = Omit<FilterCondition, 'valueFrom' | 'value'> & { value: JsonValue };

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
 * `network` in a banner with Retry, and `other` beside Save with Retry.
 */
export interface SaveProblem {
  kind: 'fields' | 'rule' | 'network' | 'other';
  message: string;
  /** For `fields`: a message for each field, by name. */
  fields?: Record<string, string>;
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
