/**
 * The outbox part's form code (outbox.ts, `formOutboxPart`): sends kept on the device without signal and sent in order
 * when it comes back (outbox-form.ts). In the one-tag script it comes in one script with the viewer's outbox part, which
 * keeps them in IndexedDB and says them on screen (fieldia.outbox.js).
 */
export { formOutbox, indexedOutbox, memoryOutbox } from './outbox-form';
