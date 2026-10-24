import type { ExpressionEnv } from '../expression/functions';
import type { Fields } from '../format/field';
import type { Page } from '../format/page';
import { lazyPart, type Part } from '../parts';
import { formApprovalsPart } from './approving';
import type { SaveConflict, SaveRequest, StoredDraft, SubmitRequest, UploadFile } from './data-source';
import type { ApprovalsKit } from './form-approvals';
import type { Form, FormConflict, FormEvents, FormOptions, FormState } from './form';
import { recordLivePart, type LiveRecord } from './live-later';
import type { Messages } from './messages';
import type { FormOutbox } from './outbox-form';
import type { FormPayment } from './payment-form';
import type { Stopped } from './run';
import type { Scheduler } from './scheduler';
import { formSurveyPart, surveyFlow } from './survey';
import type { SurveyKit } from './survey-kit';
import type { Value, Values } from './values';
import type { FormVerify } from './verify-form';

/**
 * Parts that join a form where its page (or its source) asks — an offline outbox (`outbox`), the fields its link fills
 * (`prefill`), proof of an email or a phone by a code (a field's `options.verify`), a payment the answers wait for
 * (`payment`), a survey's flow (a quiz, a draw, a time limit), a record's approvals (`approval`), a record made live
 * (the source's `subscribe` or `presence`). The form knows only that its page asks for one: it gives each the one kit
 * (`FormInner`) and asks each, through one hook (`FormJoin`), at its moments — a send, a draft, a step entered, the
 * record loaded, its state changed; what each does — what it checks, what a send carries, its state and its words — is
 * in its own part. A page's limits (form-limits.ts) take the same kit but are made at another moment: once the form
 * knows it keeps limits, which a list's choices coming with places may tell it long after it is made; and Undo
 * (press-undo.ts) as the person first changes the record.
 */

/** What a send through the parts that join a form is: a response's, a record's save, or a file's upload. */
export type SendKind = 'submit' | 'save' | 'upload';

/** What a send through them carries: the request, or for an upload the file. */
export type Sent = SubmitRequest | SaveRequest | UploadFile;

/**
 * The one kit a part that works inside a form is given of it, made once for each form (form.ts): the form, its page and
 * its options, its words and its clock, and its own ways with its state — what the parts that join it, its limits and
 * its Undo each take what they need of.
 */
export interface FormInner {
  readonly form: Form;
  readonly page: Page;
  readonly fields: Fields;
  readonly options: FormOptions;
  /** The form's messages, in the page's language. */
  readonly messages: Messages;
  readonly scheduler: Scheduler;
  state(): FormState;
  /** Set the form's state: a part's own (`verified`, `paid`, `outbox`, `order`…), or the errors it finds. */
  set(patch: Partial<FormState>): void;
  /** The record as conditions read it now, and what else they read. */
  reading(): { context: Record<string, unknown>; env: ExpressionEnv };
  /**
   * The values a send would carry now: a response's answers with what the parts add to them (the hidden fields a link
   * filled), a record's values as its save sends them — what an app's checkout is handed (`PayRequest.values`).
   */
  sending(): Values;
  /** The record as loaded or last saved. */
  baseline(): Values;
  same(name: string, one: Value | undefined, other: Value | undefined): boolean;
  conflictOf(conflict: SaveConflict): FormConflict;
  /** Values the record holds where it is kept: no change to save. */
  store(values: Values): void;
  /** The saves on their way, settled. */
  settled(): Promise<void>;
  track<T>(work: Promise<T>): Promise<T>;
  /** Whether what is asked now still lands on the record shown, when it answers. */
  shownNow(): () => boolean;
  /** The record shown's generation: another shown since, it is told so. */
  generation(): number;
  emit<E extends keyof FormEvents>(event: E, payload: FormEvents[E]): void;
  /** Why a run stops whose record was replaced. */
  replaced(): Stopped;
  /** Now, in ms, by the form's clock. */
  clock(): number;
  /** Whether the form has its state yet. */
  started(): boolean;
  /** Whether something listens to the form. */
  listened(): boolean;
  disposed(): boolean;
  /** Keep a draft soon, where the form keeps drafts. */
  keep(): void;
  /** The wizard's steps in the order drawn, or null: the page's own. */
  order(steps: string[] | null): void;
  /** Words said under a field until it changes from what it holds, as a refused save's are. */
  refuse(name: string, message: string): void;
  /** The record loaded again. */
  reload(): Promise<void>;
}

/** A part's side of a form, made for it (`join`): its hooks into the form, each at its moment, each left out where it has none. */
export interface FormJoin {
  /**
   * Before anything is sent, the form's own checks run: the problems they found, by field, to add to (a field not proved
   * by a code) — or false, to send nothing (a payment not taken). Asked only where every part before it let the send go.
   */
  before?(problems: Record<string, string>): void | false | Promise<void | false>;
  /**
   * The send itself, through it: what it carries added (proofs, a payment, a survey's draw and clocks), or kept on the
   * device where the network fails it (an outbox) — null then. Each part's around the next one's, the first in
   * `formJoins` innermost.
   */
  around?<T>(kind: SendKind, sent: Sent, go: (sent: Sent) => Promise<T>): Promise<T | null>;
  /** What it adds to a response's answers before they go — and to the values `sending` tells: a link's hidden fields. */
  values?(answers: Values): void;
  /** Started again, or another record opened: what the one before had is let go. */
  reset?(): void;
  /** A part of the page (a step, a group, a question, by its id) it leaves out: never shown, asked, required or sent. */
  hides?(id: string): boolean;
  /** A part of the page it locks: shown, never changed, its checks refusing nothing (a time run out). */
  locks?(id: string): boolean;
  /** A field — or a saved form placed on the page, by its name — it locks (a record waiting for approval). */
  locksField?(name: string): boolean;
  /** What a draft keeps of it, and a draft laid on the form: its draw, its clocks' starts. */
  kept?(): Partial<StoredDraft>;
  lay?(draft: StoredDraft): void;
  /** A wizard's step entered. */
  entered?(step: string): void;
  /** The record loaded, or saved: what it asks of the source again (a record's approvals). */
  loaded?(): void;
  /** The form's state changed: what it follows of it (the record shown, watched for changes made elsewhere). */
  changed?(): void;
  /** The form let go. */
  dispose?(): void;
}

/** What each part's side of a form gives besides, by its name (`form.joined`). */
export interface FormJoins {
  outbox: FormOutbox;
  prefill: FormJoin;
  verify: FormVerify;
  pay: FormPayment;
  surveyflow: SurveyKit;
  approvals: ApprovalsKit;
  live: LiveRecord;
}

/** A part that joins a form: its side of it, made for it. */
export interface JoinPart {
  join(host: FormInner): FormJoin;
}

/** A part that joins a form and guards no send: its absence lets a send go as it would have. */
const OPEN = 'open' as const;

/**
 * The words naming a part that guards a send (`joinGate`, and the form's own checking parts: its options by condition, its
 * texts in several languages, its limits): what a send that could not have it says it waited for.
 */
export type GuardWords = 'guardPay' | 'guardVerify' | 'guardTimeLimit' | 'guardPrefill' | 'guardApprovals' | 'guardOptions' | 'guardLanguages' | 'guardLimits';

/**
 * Whether a page's form proves an email or a phone by a code (a field's `options.verify`) — the verify part asked for. A
 * part that guards its send only where its source can send and check a code.
 */
const asksVerify = (page: Page) => /"verify":(?!false)/.test(JSON.stringify(page.layout));
/** Whether a page times its answers (`timeLimit` on the page or a step): the survey flow's clock guards its send. */
export const timesAnswers = (page: Page): boolean => /"timeLimit":/.test(JSON.stringify(page));

/**
 * The parts, in the order a send goes through them — the outbox innermost, so what it keeps is the request as it would
 * have gone — each with what in a page (or in the form's options, where they are known) asks for it, and, for one that
 * guards a send, the words naming it: such a part that could not come — offline, or refused as another version's — stops
 * the send (fail closed: form.ts asks for it once more as the send goes, then refuses in these words), never lets it go
 * unchecked. One that guards nothing says why (`OPEN`). In the one-tag script each is a script of its own, with the
 * viewer's part of the same name (fieldia.<name>.js).
 */
const JOINS: [Part<JoinPart>, (page: Page, options?: FormOptions) => unknown, ((page: Page, options?: FormOptions) => GuardWords | undefined) | typeof OPEN][] = [
  // Without it, a send that finds no network fails as any does, the answers kept in the form: nothing goes unchecked.
  [lazyPart('outbox', () => import('./outbox-part')), (page) => page.outbox, OPEN],
  // A link's hidden fields go with the answers: without them a send would go without what the link said.
  [lazyPart('prefill', () => import('./prefill-part')), (page) => page.prefill, () => 'guardPrefill'],
  [lazyPart('verify', () => import('./verify-part')), asksVerify, (_page, options) => (options?.dataSource?.sendCode && options.dataSource.checkCode ? 'guardVerify' : undefined)],
  [lazyPart('pay', () => import('./pay-part')), (page) => page.payment, (_page, options) => (options?.dataSource?.pay ? 'guardPay' : undefined)],
  // A quiz's marking, a review and a draw guard nothing (the answers given are those sent); a time limit's clock does.
  [formSurveyPart, surveyFlow, (page) => (timesAnswers(page) ? 'guardTimeLimit' : undefined)],
  // A record waiting for approval locks its fields: without its part, nothing would.
  [formApprovalsPart, (page, options) => page.approval && (!options || options.dataSource?.approvals), () => 'guardApprovals'],
  // Changes made elsewhere and who else is here: a save over someone else's is still refused by its version.
  [recordLivePart, (_page, options) => options?.dataSource?.subscribe || options?.dataSource?.presence, OPEN],
];

/**
 * The parts that join a form of this page — with its options, those its source asks for too — what its form waits for
 * at a send and the viewer draws with it; or all of them.
 */
export const formJoins = (page?: Page, options?: FormOptions): Part<JoinPart>[] => JOINS.filter(([, asks]) => !page || asks(page, options)).map(([part]) => part);

/** The words naming a part that joins this page's form, where it guards its send: undefined for one that guards nothing here. */
export function joinGate(part: Part<JoinPart>, page: Page, options?: FormOptions): GuardWords | undefined {
  const gate = JOINS.find(([one]) => one === part)?.[2];
  return gate && gate !== OPEN ? gate(page, options) : undefined;
}

/** Each part that joins a form, by its name, and whether it may guard a send (a test holds every part to saying so). */
export const joinGuards = (): { name: string; guards: boolean }[] => JOINS.map(([part, , gate]) => ({ name: part.name, guards: gate !== OPEN }));
