/**
 * The outbox part (parts.ts in @fieldia/widgets): an offline outbox on screen — what waits on this device, Send now, a
 * send refused once it went (outbox.ts) — with its stylesheet (outbox-styles.ts). Asked for with the page's other parts
 * where the page says `outbox` (@fieldia/core's `formJoins`), in one script with the form's side of it.
 */
export { draw, watchOutbox } from './outbox';
export { installOutboxStyles } from './outbox-styles';
