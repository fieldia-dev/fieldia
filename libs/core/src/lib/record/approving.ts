import type { Page } from '../format/page';
import { lazyPart, type Part } from '../parts';
import type * as ApprovalsModule from './approvals-part';
import type { ApprovalDecision, ApprovalEntry, ApprovalLevel } from './data-source';

/**
 * Approvals on a record (`approval` on a page): what the data source's `approvals` told of the record shown — the
 * levels it must pass, what was decided so far, the levels this person may decide — kept in the form's state
 * (`FormState.approval`), worked out by the approvals part (form-approvals.ts). A viewer says where it stands, offers
 * Approve and Reject, and locks the record while it waits.
 */

/**
 * Where a record stands as a whole: `none`, no approval asked of it (no levels, or not told yet); `needed`, levels to
 * pass and none asked yet (it is not sent for approval); `waiting`, a level waits now; `approved`, every level passed;
 * `rejected`, a level rejected it.
 */
export type ApprovalStatus = 'none' | 'needed' | 'waiting' | 'approved' | 'rejected';

/** What a form knows of its record's approvals now (`FormState.approval`). */
export interface FormApproval {
  /** `asking`: the record shown's are asked and not told yet; `told`; `failed`: they could not be read (`error`). */
  readonly state: 'asking' | 'told' | 'failed';
  readonly status: ApprovalStatus;
  /** The levels in their order, as the source told them. */
  readonly levels: readonly ApprovalLevel[];
  /** Asked all at once, not one after another. */
  readonly together: boolean;
  /** What happened, oldest first. */
  readonly history: readonly ApprovalEntry[];
  /** The levels this person may decide now, by id — where the source takes decisions (`decide`), each one waiting. */
  readonly mine: readonly string[];
  /** Why it needs approval, in the source's words. */
  readonly why?: string;
  /** A decision on its way: its level and what it decides. */
  readonly deciding?: { readonly level: string; readonly decision: ApprovalDecision } | null;
  /** Why they could not be read, where they could not (`failed`). */
  readonly error?: string;
}

/** The approvals part's form code (form-approvals.ts). */
export type FormApprovalsPart = typeof ApprovalsModule;

/**
 * A record's approvals — asked of the source, a decision taken, its fields locked while it waits — loaded before a page
 * with `approval` is drawn: in the one-tag script, one script with the viewer's approvals part (fieldia.approvals.js).
 */
export const formApprovalsPart: Part<FormApprovalsPart> = lazyPart('approvals', () => import('./approvals-part'));

/** Whether a page shows approvals on its record: a record's own page with `approval`. */
export const hasApprovals = (page: Page): boolean => !!page.approval && page.data.kind === 'record' && page.layout.type !== 'list';
