/**
 * The outbox part (parts.ts in @fieldia/widgets): an offline outbox on screen — what waits on this device, Send now, a
 * send refused once it went (outbox.ts) — with its stylesheet (outbox-styles.ts). Loaded through `outboxPart` with the
 * page's other parts where the page says `outbox`.
 */
export { watchOutbox } from './outbox';
export { installOutboxStyles } from './outbox-styles';
