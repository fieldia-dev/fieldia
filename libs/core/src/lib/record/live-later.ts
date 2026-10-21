import type { Fields } from '../format/field';
import type { Page } from '../format/page';
import { lazyPart, type Part } from '../parts';
import type { DataSource, SaveConflict } from './data-source';
import type { FormConflict, FormEvents, FormState, FormUser } from './form';
import type { Messages } from './messages';
import type * as LiveModule from './live-part';
import type { Value, Values } from './values';

/** The live part: a record's changes made elsewhere and who else has it open (live.ts), asked of the data source. */
export type RecordLivePart = typeof LiveModule;

/**
 * The record shown made live, loaded the first time a form of a record whose source has `subscribe` or `presence` shows
 * one with an id: never for an app whose source has neither.
 */
export const recordLivePart: Part<RecordLivePart> = lazyPart('live', () => import('./live-part'));

/** What the live part needs of the form it makes live. */
export interface LiveContext {
  page: Page;
  fields: Fields;
  source: DataSource;
  user?: FormUser;
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
  /** Whether the person's work would be lost by laying values over the record (`unsavedWork`). */
  atRisk(): boolean;
  arrived(event: FormEvents['arrived']): void;
  say(message: string): void;
  messages: Messages;
}

/** The form's record made live: `watch` as what is shown changes, `stop` as the form goes. */
export interface LiveRecord {
  watch(): void;
  stop(): void;
}

