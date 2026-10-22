import { lazyPart, type Part } from '../parts';
import type { FormJoin } from './joins';
import type * as LiveModule from './live-part';

/** The live part: a record's changes made elsewhere and who else has it open (live.ts), asked of the data source. */
export type RecordLivePart = typeof LiveModule;

/**
 * The record shown made live, one of the parts that join a form (joins.ts) — loaded as a form is made whose source has
 * `subscribe` or `presence`: never for an app whose source has neither.
 */
export const recordLivePart: Part<RecordLivePart> = lazyPart('live', () => import('./live-part'));

/** The form's record made live: `watch` as what is shown changes, `stop` as the form goes. */
export interface LiveRecord extends FormJoin {
  watch(): void;
  stop(): void;
}
