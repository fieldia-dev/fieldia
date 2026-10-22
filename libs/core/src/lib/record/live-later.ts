import type { Fields } from '../format/field';
import type { Page } from '../format/page';
import { lazyPart, type Part } from '../parts';
import type { SaveConflict } from './data-source';
import type { FormConflict, FormEvents, FormOptions, FormState } from './form';
import type { Stopped } from './run';
import type { Messages } from './messages';
import type * as LiveModule from './live-part';
import type { Value, Values } from './values';

/** The live part: a record's changes made elsewhere and who else has it open (live.ts), asked of the data source. */
export type RecordLivePart = typeof LiveModule;

/**
 * The record shown made live, loaded as a form is made whose source has `subscribe` or `presence`: never for an app whose
 * source has neither.
 */
export const recordLivePart: Part<RecordLivePart> = lazyPart('live', () => import('./live-part'));

/**
 * What the parts that work inside a form take of it — the live part, the undo part's press — made once for each form
 * (form.ts): its page, its options and words, and its own ways with its state.
 */
export interface FormInner {
  page: Page;
  fields: Fields;
  options: FormOptions;
  messages: Messages;
  state(): FormState;
  set(patch: Partial<FormState>): void;
  /** The record as loaded or last saved. */
  baseline(): Values;
  same(name: string, one: Value | undefined, other: Value | undefined): boolean;
  conflictOf(conflict: SaveConflict): FormConflict;
  /** Values the record holds where it is kept: no change to save. */
  store(values: Values): void;
  /** The saves on their way, settled. */
  settled(): Promise<void>;
  track<T>(work: Promise<T>): Promise<T>;
  shownNow(): () => boolean;
  generation(): number;
  emit<E extends keyof FormEvents>(event: E, payload: FormEvents[E]): void;
  /** Why a run stops whose record was replaced. */
  replaced(): Stopped;
}

/** The form's record made live: `watch` as what is shown changes, `stop` as the form goes. */
export interface LiveRecord {
  watch(): void;
  stop(): void;
}

