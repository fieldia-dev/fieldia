import type { ExpressionEnv } from '../expression/functions';
import type { Page } from '../format/page';
import { lazyPart, type Part } from '../parts';
import type { SaveRequest, SubmitRequest, UploadFile } from './data-source';
import type { Form, FormOptions, FormState } from './form';
import type { Messages } from './messages';
import type { FormOutbox } from './outbox-form';
import type { FormPayment } from './payment-form';
import type { FormVerify } from './verify-form';
import type { Values } from './values';

/**
 * Parts that join a form where its page asks — an offline outbox (`outbox`), the fields its link fills (`prefill`),
 * proof of an email or a phone by a code (a field's `options.verify`), a payment the answers wait for (`payment`). The
 * form knows only that its page asks for one, and gives each one hook into its send (`FormJoin`); what each does —
 * what it checks, what a send carries, its state and its words — is in its own part.
 */

/** What a send through the parts that join a form is: a response's, a record's save, or a file's upload. */
export type SendKind = 'submit' | 'save' | 'upload';

/** What a send through them carries: the request, or for an upload the file. */
export type Sent = SubmitRequest | SaveRequest | UploadFile;

/** What a part that joins a form is given of it. */
export interface JoinHost {
  readonly form: Form;
  readonly page: Page;
  readonly options: FormOptions;
  /** The form's messages, in the page's language. */
  readonly messages: Messages;
  /** Set the form's state: the part's own (`verified`, `paid`, `outbox`), or the errors it finds. */
  set(patch: Partial<FormState>): void;
  /** The record as conditions read it now, and what else they read. */
  reading(): { context: Record<string, unknown>; env: ExpressionEnv };
  /**
   * The values a send would carry now: a response's answers with what the parts add to them (the hidden fields a link
   * filled), a record's values as its save sends them — what an app's checkout is handed (`PayRequest.values`).
   */
  sending(): Values;
}

/** A part's side of a form, made for it (`join`): the one hook it has into the form's send. */
export interface FormJoin {
  /**
   * Before anything is sent, the form's own checks run: the problems they found, by field, to add to (a field not proved
   * by a code) — or false, to send nothing (a payment not taken). Asked only where every part before it let the send go.
   */
  before?(problems: Record<string, string>): void | false | Promise<void | false>;
  /**
   * The send itself, through it: what it carries added (proofs, a payment, hidden fields), or kept on the device where
   * the network fails it (an outbox) — null then. Each part's around the next one's, the first in `formJoins` innermost.
   */
  around?<T>(kind: SendKind, sent: Sent, go: (sent: Sent) => Promise<T>): Promise<T | null>;
  /** What it adds to a response's answers before they go — and to the values `sending` tells: a link's hidden fields. */
  values?(answers: Values): void;
  /** Started again, or another record opened: what the one before had is let go. */
  reset?(): void;
}

/** What each part's side of a form gives besides, by its name (`form.joined`). */
export interface FormJoins {
  outbox: FormOutbox;
  prefill: FormJoin;
  verify: FormVerify;
  pay: FormPayment;
}

/** A part that joins a form: its side of it, made for it. */
export interface JoinPart {
  join(host: JoinHost): FormJoin;
}

/**
 * The parts, in the order a send goes through them — the outbox innermost, so what it keeps is the request as it would
 * have gone — each with what in a page asks for it. In the one-tag script each is a script of its own, with the
 * viewer's part of the same name (fieldia.<name>.js).
 */
const JOINS: [Part<JoinPart>, (page: Page) => unknown][] = [
  [lazyPart('outbox', () => import('./outbox-part')), (page) => page.outbox],
  [lazyPart('prefill', () => import('./prefill-part')), (page) => page.prefill],
  [lazyPart('verify', () => import('./verify-part')), (page) => /"verify":(?!false)/.test(JSON.stringify(page.layout))],
  [lazyPart('pay', () => import('./pay-part')), (page) => page.payment],
];

/** The parts that join a form of this page — what its form waits for at a send, and the viewer draws with it — or all of them. */
export const formJoins = (page?: Page): Part<JoinPart>[] => JOINS.filter(([, asks]) => !page || asks(page)).map(([part]) => part);
