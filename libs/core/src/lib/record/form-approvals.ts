import type { Page } from '../format/page';
import type { ApprovalDecision, ApprovalEntry, ApprovalLevel, ApprovalLevelState, Approvals, Approver, DataSource } from './data-source';
import { saveProblemOf } from './data-source';
import type { Form, FormState } from './form';
import type { ApprovalStatus, FormApproval } from './approving';
import { fill, type Messages } from './messages';
import { dayWords } from './day-words';
import type { DateOrder } from './input-rules';
import { isOwnZone, wallClock, wallDay, wallTime } from './zones';
import { uploadGoing } from './uploads';

/**
 * A record's approvals (the approvals part): asked of the data source's `approvals` as a saved record is shown — again
 * after each save, and once a decision is taken — kept in the form's state (`FormState.approval`), its decisions taken
 * through `decide`, and its fields locked while it waits but for those the page leaves open (`approval.open`). A form on
 * a page with `approval` makes this from the part as it comes (form.ts, `approvalsCode`); the viewer waits for the part
 * before it draws such a page, so nothing is typed in a field that would lock.
 */

/** What the approvals ask of the form they are made for: the form itself — its page, its state, the record shown, its typing read and its changes saved — and what it keeps to itself. */
export interface ApprovalsHost {
  readonly form: Form;
  readonly dataSource: DataSource | undefined;
  readonly messages: Messages;
  set(patch: Partial<FormState>): void;
  /** The record loaded again, after a decision: its approvals asked again with it. */
  reload(): Promise<void>;
}

/** A record's approvals, made for its form (`formApprovals`). */
export interface ApprovalsKit {
  /** Ask the source's `approvals` for the record shown and keep what it tells — the last answer kept while it asks again. */
  ask(): Promise<void>;
  /**
   * Decide at a level this person may decide now: approved, or rejected with why. What is typed is read and saved
   * first; the record is loaded again after. Rejects in words where it is not theirs, a rejection says no reason, the
   * save is refused, or the source refused the decision.
   */
  decide(level: string, decision: ApprovalDecision, reason?: string): Promise<void>;
  /** Whether a field — or a saved form placed on the page, by its name — is locked while the record waits for approval. */
  locks(name: string): boolean;
  /** What a field's lock says while the record waits for approval; null where it is not locked by one. */
  lockWords(name: string): string | null;
}

const STATES: readonly ApprovalLevelState[] = ['waiting', 'later', 'approved', 'rejected', 'skipped'];
const said = (value: unknown): value is string => typeof value === 'string' && value.trim() !== '';

/** A level as the source told it, kept to what can be said: its id, its name, its approvers by name, a state Fieldia knows. */
function levelOf(told: unknown): ApprovalLevel | null {
  const level = told as Partial<ApprovalLevel> | null;
  if (!level || !said(level.id) || !STATES.includes(level.state as ApprovalLevelState)) return null;
  const approvers: Approver[] = (Array.isArray(level.approvers) ? level.approvers : []).filter((one): one is Approver => !!one && said(one.name));
  return { id: level.id, name: said(level.name) ? level.name : level.id, approvers, needs: level.needs === 'all' ? 'all' : 'any', state: level.state as ApprovalLevelState };
}

/** Where a record stands as a whole, from its levels: a rejection ends it, a level waiting is waited for. */
export function approvalStatus(levels: readonly ApprovalLevel[]): ApprovalStatus {
  const asked = levels.filter((level) => level.state !== 'skipped');
  if (!asked.length) return 'none';
  if (asked.some((level) => level.state === 'rejected')) return 'rejected';
  if (asked.some((level) => level.state === 'waiting')) return 'waiting';
  if (asked.every((level) => level.state === 'approved')) return 'approved';
  return 'needed';
}

/** What the form keeps of a source's answer: the levels it can say, those this person may decide now — where the source takes decisions. */
export function approvalOf(told: Approvals | null | undefined, decides: boolean): FormApproval {
  const levels = (Array.isArray(told?.levels) ? told.levels : []).map(levelOf).filter((level): level is ApprovalLevel => level !== null);
  const history = (Array.isArray(told?.history) ? told.history : []).filter((entry): entry is ApprovalEntry => !!entry && said(entry.by) && said(entry.at) && ['approved', 'rejected', 'requested', 'notNeeded'].includes(entry.decision));
  const waiting = new Set(levels.filter((level) => level.state === 'waiting').map((level) => level.id));
  const mine = decides ? [...new Set((Array.isArray(told?.mine) ? told.mine : []).filter((id) => waiting.has(id)))] : [];
  return {
    state: 'told',
    status: approvalStatus(levels),
    levels,
    together: told?.together === true,
    history,
    mine,
    ...(said(told?.why) ? { why: told.why } : {}),
    deciding: null,
  };
}

/** Nothing told yet, for the record shown: asked. */
const asking: FormApproval = { state: 'asking', status: 'none', levels: [], together: false, history: [], mine: [], deciding: null };

/**
 * A moment of a record's approval history in words, as the page's date boxes write a day — in its order and language —
 * on its clock, the time after it: "18 Oct 2026, 10:42", with the zone's short name where it is not the browser's own.
 */
export function approvalWhen(at: string, messages: Messages, page: Page): string {
  const ms = Date.parse(at);
  if (Number.isNaN(ms)) return at;
  const own: unknown = page.look?.dateOrder;
  const order: DateOrder | undefined = own === 'dmy' || own === 'mdy' || own === 'ymd' ? own : messages.dateOrder;
  const zone = page.timeZone;
  const wall = wallTime(ms, zone);
  const words = `${dayWords(wallDay(wall), messages, order)}${order === 'ymd' ? ' ' : ', '}${wallClock(wall)}`;
  if (!zone || isOwnZone(zone)) return words;
  const name = new Intl.DateTimeFormat(messages.locale === 'en' ? 'en-GB' : messages.locale, { timeZone: zone, timeZoneName: 'short' }).formatToParts(ms).find((part) => part.type === 'timeZoneName')?.value;
  return name ? `${words} ${name}` : words;
}

/** A record's approvals: what the form keeps of them, and what it asks, decides and locks by them. */
export function formApprovals(host: ApprovalsHost): ApprovalsKit {
  const { form, messages } = host;
  const page = form.page;
  /** Counted at each ask: only the latest answer is kept, a save's and a load's asks crossing. */
  let asks = 0;
  /** A decision on its way, from the save before it to the record loaded after: a second press is the same press. */
  let deciding = false;
  const user = () => {
    const person = form.user();
    return person ? { user: { id: person.id, ...(person.name ? { name: person.name } : {}) } } : {};
  };
  const state = () => form.getState();
  const model = page.data.kind === 'record' ? page.data.model : '';
  const nameOf = (level: string) => state().approval?.levels.find((one) => one.id === level)?.name ?? level;

  /** What is typed read and the person's changes saved, before a decision: null once done, or why not, in words. */
  async function saveFirst(): Promise<string | null> {
    await form.settle();
    const now = state();
    if (!now.dirty.length && !Object.keys(now.unread).length && !(now.uploads ?? []).some(uploadGoing)) return null;
    if (await form.save()) return null;
    const after = state();
    return after.saveProblem?.message ?? after.error ?? Object.values(after.errors)[0] ?? '';
  }

  async function ask(): Promise<void> {
    const source = host.dataSource;
    const recordId = state().recordId;
    if (!source?.approvals || recordId == null || !model) {
      if (state().approval) host.set({ approval: null });
      return;
    }
    const shown = form.recordShown();
    const seq = ++asks;
    const before = state().approval;
    // Asked again for the record shown — after a save, a decision, a load — what it told stays meanwhile: what waits stays locked.
    host.set({ approval: before && before.state === 'told' ? { ...before, state: 'asking' } : asking });
    try {
      const told = await source.approvals({ model, recordId, ...user() });
      if (!shown() || seq !== asks) return;
      host.set({ approval: approvalOf(told, !!source.decide) });
    } catch (error) {
      if (!shown() || seq !== asks) return;
      // Not told: nothing locked by it, and the page says they could not be read.
      host.set({ approval: { ...asking, state: 'failed', error: saveProblemOf(error).message } });
    }
  }

  async function decide(level: string, decision: ApprovalDecision, reason?: string): Promise<void> {
    const source = host.dataSource;
    const recordId = state().recordId;
    if (!source?.decide || recordId == null || !model) throw new Error('The data source has no decide()');
    const now = state().approval;
    if (!now?.mine.includes(level)) throw new Error(fill(messages.approvalNotYours, { level: nameOf(level) }));
    const why = typeof reason === 'string' ? reason.trim() : '';
    if (decision === 'rejected' && !why) throw new Error(messages.approvalReasonNeeded);
    // One decision at a time: a second press while one is on its way — its save, its answer — is the same press.
    if (deciding || now.deciding) return;
    deciding = true;
    try {
      await decided(source.decide.bind(source), recordId, level, decision, why);
    } finally {
      deciding = false;
    }
  }

  async function decided(send: NonNullable<DataSource['decide']>, recordId: NonNullable<FormState['recordId']>, level: string, decision: ApprovalDecision, why: string): Promise<void> {
    const shown = form.recordShown();
    // Decided on the record as it is saved: what is typed read, and the person's changes saved, first.
    const refused = await saveFirst();
    if (refused !== null) throw new Error(refused);
    if (!shown()) return;
    const at = state().approval;
    if (!at) return;
    host.set({ approval: { ...at, deciding: { level, decision } } });
    try {
      const answer = await send({ model, recordId, level, decision, ...(why ? { reason: why } : {}), ...user() });
      if (!shown()) return;
      const after = state().approval;
      host.set({ approval: answer && Array.isArray(answer.levels) ? approvalOf(answer, true) : after ? { ...after, deciding: null } : null });
    } catch (error) {
      const after = state().approval;
      if (shown() && after) host.set({ approval: { ...after, deciding: null } });
      throw new Error(saveProblemOf(error).message, { cause: error });
    }
    // The decision may have moved the record on — its state, what may be changed: loaded again, its approvals with it.
    if (shown()) await host.reload();
  }

  function locks(name: string): boolean {
    const own = page.approval;
    return !!own && own.lock !== false && state().approval?.status === 'waiting' && !(own.open ?? []).includes(name);
  }

  return {
    ask,
    decide,
    locks,
    lockWords: (name) => (locks(name) ? messages.approvalLocked : null),
  };
}
