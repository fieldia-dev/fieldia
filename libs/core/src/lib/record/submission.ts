import type { JsonValue } from '../format/json';
import type { FieldNode } from '../format/layout';
import type { Page } from '../format/page';
import { upgradePage } from '../format/upgrade';
import { hasOptionRules, optionRulesPart } from '../format/choice-options';
import { callsPartFunctions, functionsPart } from '../expression/functions';
import type { AppFunctions } from '../expression/app-functions';
import type { DataSource, PaidPayment, PaymentDue, VerifiedValue } from './data-source';
import { createForm, type FormUser } from './form';
import { formLanguagesPart, hasLanguages } from './languages';
import { MESSAGES, type Messages } from './messages';
import { formJoins } from './joins';
import { formSurveyPart, surveyFlow } from './survey';
import type { RecordId, Values } from './values';

/**
 * The browser's checks are a convenience; the app's server is the final gate. A page's rules run in the person's
 * browser — required, patterns, sizes, options, a code proved, a payment taken — and a request made by hand passes none
 * of them. `checkSubmission` runs the same page's checks where the answers arrive, on the server, from the page as the
 * server keeps it (never one the browser sent): what a send's `values` must pass before it is stored.
 */

/** What came with the answers, and how the server reads them. */
export interface SubmissionContext {
  /** The proofs of codes the send carried (`SubmitRequest.verified`): a value is proved only where the app's own proof says so. */
  verified?: Record<string, VerifiedValue>;
  /** The payment the send carried (`SubmitRequest.payment`): checked against what the page asks for these answers. */
  payment?: PaidPayment;
  /** The order drawn for this respondent (`SubmitRequest.order`): a question not drawn is not asked, nor required. */
  order?: Record<string, string[]>;
  /** The person, as the server knows them (never as the browser says): conditions read `user`. */
  user?: FormUser;
  /** The record the answers save, on a record's page: conditions read `id`. */
  recordId?: RecordId | null;
  /** The app's own functions, as the browser's form was given them. */
  functions?: AppFunctions;
  /** The app's values conditions read as `context.name`. */
  context?: Readonly<Record<string, JsonValue>>;
  /** The server's clock. */
  now?: () => Date;
  /** The messages in the person's language: English unless given. */
  messages?: Messages;
  /** The most the answers may take, as JSON, in bytes: 1 MB unless said. */
  maxBytes?: number;
}

/** What `checkSubmission` found. */
export interface SubmissionCheck {
  /** Whether the answers may be stored: no field's problem and no other. */
  ok: boolean;
  /** Each field's problem, by its path, in the page's words — what the browser would have said under it. */
  errors: Record<string, string>;
  /** What is wrong besides: answers too large, a field the page has not, a payment missing or short. */
  problems: string[];
  /**
   * The answers as the page's own rules leave them — values it works out (computed) worked out here, never taken from
   * the browser — over every field of the page: what to store.
   */
  values: Values;
  /** What the page asks to be paid for these answers, worked out here: what a checkout charges. Null where nothing is due. */
  due: Omit<PaymentDue, 'key'> | null;
}

const MB = 1024 * 1024;

/** How many bytes a text takes in UTF-8, as it travels. */
function utf8Length(text: string): number {
  let bytes = 0;
  for (let at = 0; at < text.length; at++) {
    const unit = text.charCodeAt(at);
    if (unit < 0x80) bytes += 1;
    else if (unit < 0x800) bytes += 2;
    else if (unit >= 0xd800 && unit < 0xdc00 && at + 1 < text.length) {
      bytes += 4;
      at++;
    } else bytes += 3;
  }
  return bytes;
}

/** The field nodes of a layout, at any depth. */
const fieldNodes = (node: { type: string; children?: unknown }): FieldNode[] => [...(node.type === 'field' ? [node as FieldNode] : []), ...(Array.isArray(node.children) ? (node.children as { type: string }[]).flatMap(fieldNodes) : [])];

/**
 * Check a page's answers where they arrive, as the browser checked them: each field required, its pattern, its length
 * and its files' sizes, its options — on the fields the page shows for these answers, its conditions read as the
 * browser read them — every email and phone that asks for a code proved (`verified`, each value the one proved, with
 * the app's proof: check the proof itself, it is yours), the payment the page asks for these answers worked out here and
 * paid in full (`payment`: check its reference with your provider), and the answers no larger than `maxBytes`. The page
 * is the server's own copy. Async: the parts the page's checks need (its functions, options by condition, languages, a
 * survey's flow) are loaded first; one that cannot be is a problem, never a check skipped.
 */
export async function checkSubmission(input: Page, sent: Readonly<Values>, context: SubmissionContext = {}): Promise<SubmissionCheck> {
  const page = upgradePage(input);
  const messages = context.messages ?? MESSAGES.en;
  const problems: string[] = [];
  const empty: SubmissionCheck = { ok: false, errors: {}, problems, values: {}, due: null };
  if (!sent || typeof sent !== 'object' || Array.isArray(sent)) return { ...empty, problems: ['The answers are not an object of values by field'] };
  const bytes = utf8Length(JSON.stringify(sent));
  const most = context.maxBytes ?? MB;
  if (bytes > most) return { ...empty, problems: [`The answers take ${bytes} bytes, more than the ${most} they may`] };
  for (const name of Object.keys(sent)) if (!Object.prototype.hasOwnProperty.call(page.fields, name)) problems.push(`"${name}" is no field of this page`);
  // Every field of the page: one the answers left out is empty, never its default — the browser sent what it held.
  const values: Values = Object.fromEntries(Object.keys(page.fields).map((name) => [name, Object.prototype.hasOwnProperty.call(sent, name) ? (sent[name] ?? null) : null]));
  // A source that could send and check codes, and take a payment, so a field asking for a code is checked here as it was
  // there, and what the page asks to be paid is worked out by the pay part's own reading of it: none is ever called.
  const refuse = () => Promise.reject(new Error('Never asked where answers are checked'));
  const source: DataSource = { sendCode: refuse, checkCode: refuse, pay: refuse };
  const parts = [
    ...formJoins(page, { page, dataSource: source }).filter((part) => part.name === 'pay' || part.name === 'verify'),
    ...(callsPartFunctions(page) ? [functionsPart] : []),
    ...(hasOptionRules(page) ? [optionRulesPart] : []),
    ...(hasLanguages(page) ? [formLanguagesPart] : []),
    ...(surveyFlow(page) ? [formSurveyPart] : []),
  ];
  for (const part of parts) {
    if (part.loaded !== undefined) continue;
    try {
      await part.load();
    } catch (error) {
      return { ...empty, problems: [...problems, `The answers could not be checked: ${part.name} could not load (${(error as Error).message})`] };
    }
  }
  const form = createForm({
    page,
    dataSource: source,
    values,
    ...(context.recordId !== undefined ? { recordId: context.recordId } : {}),
    ...(context.user ? { user: context.user } : {}),
    ...(context.functions ? { functions: context.functions } : {}),
    ...(context.context ? { context: context.context } : {}),
    ...(context.now ? { now: context.now } : {}),
    messages,
  });
  try {
    await form.settled();
    // The questions drawn for this respondent: those left out are not asked.
    if (context.order) form.joined('surveyflow')?.lay?.({ values: {}, savedAt: '', order: context.order });
    form.validate();
    const state = form.getState();
    const errors: Record<string, string> = { ...state.errors };
    // Every email and phone shown that asks for a code: proved, its value the one proved, with a proof.
    const shown = form.shownFields();
    for (const node of fieldNodes(page.layout)) {
      const verify = node.options?.['verify'];
      if (verify === undefined || verify === false || !shown.includes(node.field) || form.node(node.id).invisible) continue;
      const value = state.values[node.field];
      if (typeof value !== 'string' || !value.trim()) continue;
      const proved = context.verified?.[node.field];
      if (proved?.value !== value || typeof proved.proof !== 'string' || !proved.proof) {
        errors[node.field] ??= messages.notVerified.replace('{label}', form.words(node.label ?? page.fields[node.field]?.label ?? node.field));
      }
    }
    // The payment the page asks for these answers, worked out here: paid in full, in its currency.
    const owed = form.joined('pay')?.due() ?? null;
    let due: SubmissionCheck['due'] = null;
    if (owed) {
      const { key: _key, ...rest } = owed;
      due = rest;
      const paid = context.payment;
      if (!paid) problems.push(`${owed.label ?? 'A payment'} of ${owed.amount} ${owed.currency} is due, and the answers carry none`);
      else if (paid.currency !== owed.currency || !(paid.amount >= owed.amount)) problems.push(`${owed.amount} ${owed.currency} is due, and the answers carry ${paid.amount} ${paid.currency}`);
    }
    return { ok: !Object.keys(errors).length && !problems.length, errors, problems, values: { ...state.values }, due };
  } finally {
    form.dispose();
  }
}
