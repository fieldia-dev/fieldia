/**
 * The outbox part's form code (joins.ts): its side of a form — sends kept on the device without signal and sent in
 * order when it comes back (outbox-form.ts). In the one-tag script it comes in one script with the viewer's outbox
 * part, which says them on screen (fieldia.outbox.js).
 */
export { join, indexedOutbox, memoryOutbox } from './outbox-form';
