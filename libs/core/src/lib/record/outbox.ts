import type { Page } from '../format/page';
import { lazyPart, type Part } from '../parts';
import type { SaveProblem, SaveRequest, SubmitRequest } from './data-source';
import type * as OutboxModule from './outbox-part';

/** The outbox part's form code (outbox-form.ts): sends kept without signal, and sent when it comes back. */
export type FormOutboxPart = typeof OutboxModule;

/**
 * An offline outbox (`outbox` on a page), the form's side: a send that finds no network is kept on the device — its
 * answers and its photos' bytes — and sent in order when the signal comes back; loaded by a form whose page has one, a
 * send waiting for it: in the one-tag script, one script with the viewer's outbox part (fieldia.outbox.js), which keeps
 * the items in the browser's IndexedDB.
 */
export const formOutboxPart: Part<FormOutboxPart> = lazyPart('outbox', () => import('./outbox-part'));

/** Whether a page keeps its sends without signal. */
export const keepsOffline = (page: Page): boolean => page.outbox === true;

/** A send kept on the device until it can go: what it was, its answers, how far it got. */
export interface OutboxItem {
  /** Its own key, the same for every try: sent with it (`queued.key`), so a server can tell a second try from a new send. */
  key: string;
  pageId: string;
  /** A response's `submit`, or a record's `save`. */
  kind: 'submit' | 'save';
  /** The send as it would have gone, its files' bytes in its values where they were not stored yet. */
  request: SubmitRequest | SaveRequest;
  /** When it was kept, as ISO: its place in the order they go. */
  at: string;
  /** A new record's own key on the form that kept it: a later save of the same record while this waits takes its place. */
  record?: string;
  /** How many times it was tried. */
  tries: number;
  /** Refused when it was sent (not the network's doing): why, kept for the person to see, and nothing sent after it waits on it. */
  refused?: { message: string; problem?: SaveProblem };
  /** Who is sending it now, and until when: no other tab or page sends it meanwhile. */
  claim?: { by: string; until: number };
}

/**
 * Where an outbox keeps its items: the browser's IndexedDB in the viewer (the outbox part's), a memory store in tests
 * (`memoryOutbox`), or the app's own. Every call is the store's to make atomic: `claim` takes an item for one sender only.
 */
export interface OutboxStore {
  /** The items of a page, in the order they were kept. */
  list(pageId: string): Promise<OutboxItem[]>;
  put(item: OutboxItem): Promise<void>;
  delete(key: string): Promise<void>;
  /** Take an item to send it, unless another sender holds it still: whether it was taken. */
  claim(key: string, by: string, until: number): Promise<boolean>;
}
