/**
 * The approvals part (parts.ts in @fieldia/widgets): a record's approvals drawn over it — where it stands, its levels,
 * Approve and Reject for those who may decide, Reject's question, what stays open while it waits, and its history
 * (approvals.ts) — with their stylesheet (approvals-styles.ts). Loaded through `approvalsPart` with the page's other
 * parts — waited for before the page is drawn, with the form's own approvals part (@fieldia/core's), so a field that
 * locks while the record waits is drawn locked — where the page has `approval`.
 */
export { drawApprovals } from './approvals';
export { installApprovalStyles } from './approvals-styles';
