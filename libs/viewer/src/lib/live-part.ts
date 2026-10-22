/**
 * The live part's viewer half (the core's beside it: a record's changes made elsewhere): who else has the record open,
 * over it (live-presence.ts), with its sheet (live-styles.ts). Loaded the first time someone else has a record open.
 */
export { presenceStrip } from './live-presence';
export { installLiveStyles } from './live-styles';
