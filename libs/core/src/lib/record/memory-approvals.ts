import type { ApprovalEntry, ApprovalLevel, ApprovalLevelState, Approvals, ApprovalsRequest, DecideRequest, RecordVersion } from './data-source';
import { saveRefused } from './data-source';
import { structuredCopy, type RecordId, type Values } from './values';

/**
 * The way a record is approved, as a memory source's `approvals` option works it out from the record: its levels in
 * order — or all at once (`together`) — each with who may approve it there and whether any one of them or all must;
 * whether it is sent for approval now (`asked`: a draft is not); why, in words; and what the record holds once every
 * level approved it, or once one rejected it (its state moved on).
 */
export interface MemoryApprovalRoute {
  levels: { id: string; name: string; approvers: { id?: RecordId; name: string }[]; needs?: 'any' | 'all' }[];
  together?: boolean;
  /** Sent for approval now: its levels are asked. Until then they wait for it, and the record "needs approval". */
  asked: boolean;
  why?: string;
  /** Values the record takes once every level approved it: `{ state: 'purchase' }`. */
  approved?: Values;
  /** Values it takes once a level rejected it: `{ state: 'rejected' }`. */
  rejected?: Values;
}

/** What the memory source's approvals work on: its options, its records, and a record's version moved on. */
export interface MemoryApprovalsUse {
  routes: Record<string, (values: Values, id: RecordId) => MemoryApprovalRoute | null | undefined> | undefined;
  history: Record<string, ApprovalEntry[]> | undefined;
  table(model: string): Record<string, Values>;
  moved(model: string, id: RecordId, by: string): RecordVersion | undefined;
  now(): string;
}

type Person = ApprovalsRequest['user'];

/** The same person: by their ids where both have one, else by their names. */
const same = (approver: { id?: RecordId; name: string }, person: Person): boolean =>
  !!person && (approver.id !== undefined && person.id !== null && person.id !== undefined ? String(approver.id) === String(person.id) : !!person.name && approver.name === person.name);

/**
 * A memory source's approvals, as an approval engine keeps them: each decision kept, oldest first — a round of asking
 * starting each time the record is sent for approval again (`requested`) — and where each level stands worked out from
 * the route and the round: in turn unless the route says together; met by one approver, or by every one where it needs
 * all; a rejection ending the round. A decision is refused where the level is not waiting, the person is none of its
 * approvers or decided already, or a rejection says no reason; the last approval writes the route's `approved` values on
 * the record, a rejection its `rejected` ones.
 */
export function memoryApprovals(use: MemoryApprovalsUse): { approvals(request: ApprovalsRequest): Approvals; decide(request: DecideRequest): Approvals } {
  const histories: Record<string, ApprovalEntry[]> = structuredCopy(use.history ?? {});
  /** Whether each record was sent for approval when last asked: sent again since, a round starts. */
  const sent = new Map<string, boolean>();

  function routed(model: string, id: RecordId, person: Person): Approvals {
    const values = use.table(model)[String(id)];
    if (!values) throw new Error(`No ${model} record with id ${id}`);
    const route = use.routes?.[model]?.(structuredCopy(values), id) ?? null;
    const key = `${model}:${id}`;
    const history = (histories[key] ??= []);
    if (!route?.levels.length) return { levels: [], history: structuredCopy(history) };
    if (route.asked && sent.get(key) === false) history.push({ decision: 'requested', by: person?.name || 'Someone', at: use.now() });
    sent.set(key, route.asked);
    const round = history.slice(history.map((entry) => entry.decision).lastIndexOf('requested') + 1);
    const ended = round.some((entry) => entry.decision === 'rejected');
    let before = true;
    const levels: ApprovalLevel[] = route.levels.map((level) => {
      const approvers = level.approvers.map((approver) => {
        const said = round.find((entry) => entry.level === level.id && entry.by === approver.name && entry.decision !== 'requested');
        return { ...approver, ...(said ? { decision: said.decision as 'approved' | 'rejected', at: said.at } : {}) };
      });
      const needs = level.needs ?? 'any';
      const approved = needs === 'all' ? approvers.every((one) => one.decision === 'approved') : approvers.some((one) => one.decision === 'approved');
      const state: ApprovalLevelState = approvers.some((one) => one.decision === 'rejected') ? 'rejected' : approved ? 'approved' : route.asked && !ended && (route.together || before) ? 'waiting' : 'later';
      if (state !== 'approved') before = false;
      return { id: level.id, name: level.name, approvers, needs, state };
    });
    const mine = levels.filter((level) => level.state === 'waiting' && level.approvers.some((one) => !one.decision && same(one, person))).map((level) => level.id);
    return { levels, ...(route.together ? { together: true } : {}), history: structuredCopy(history), mine, ...(route.why ? { why: route.why } : {}) };
  }

  return {
    approvals: (request) => routed(request.model, request.recordId, request.user),
    decide(request) {
      const { model, recordId } = request;
      const now = routed(model, recordId, request.user);
      const level = now.levels.find((one) => one.id === request.level);
      if (!level || level.state !== 'waiting') throw saveRefused({ kind: 'rule', message: `${level?.name ?? request.level} is not waiting for a decision` });
      const approver = level.approvers.find((one) => same(one, request.user));
      if (!approver || approver.decision) throw saveRefused({ kind: 'rule', message: `${request.user?.name || 'This person'} may not decide for ${level.name} now` });
      const reason = request.reason?.trim();
      if (request.decision === 'rejected' && !reason) throw saveRefused({ kind: 'rule', message: 'A rejection says why' });
      (histories[`${model}:${recordId}`] ??= []).push({ decision: request.decision, level: level.id, by: approver.name, at: use.now(), ...(reason ? { reason } : {}) });
      const after = routed(model, recordId, request.user);
      const asked = after.levels.filter((one) => one.state !== 'skipped');
      const route = use.routes?.[model]?.(structuredCopy(use.table(model)[String(recordId)]), recordId);
      // The last approval moves the record on, as a rejection does: its state, as the route says.
      const ending = asked.some((one) => one.state === 'rejected') ? route?.rejected : asked.length && asked.every((one) => one.state === 'approved') ? route?.approved : undefined;
      if (!ending) return after;
      Object.assign(use.table(model)[String(recordId)], structuredCopy(ending));
      use.moved(model, recordId, approver.name);
      return routed(model, recordId, request.user);
    },
  };
}
