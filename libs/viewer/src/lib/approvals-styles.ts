import { installPartStyles, PART_RANK } from '@fieldia/widgets';

/**
 * The approvals part's look: the band over a record that says where its approval stands — a bar at its start and a
 * mark in the tone of its state (waiting amber, needed blue, approved green, rejected or not read red), its words, its
 * Approve and Reject at the end of its line, wrapping under them where the line is narrow — its levels in a row, each
 * with its mark, name and state, what stays open while it waits, and its history folded under a button. Reject's
 * question is the main sheet's dialog. On the form's tokens, so dark and the themes follow; logical sides, so right to
 * left follows. Put in the page the first time a page with `approval` is drawn (installPartStyles,
 * PART_RANK.approvals).
 */
const APPROVALS_CSS = /* css */ `
.fd-approval { --fd-approval-tone: var(--fd-warning); --fd-approval-soft: var(--fd-warning-soft); display: grid; gap: 8px; padding: 12px 14px; border: 1px solid var(--fd-border); border-inline-start: 4px solid var(--fd-approval-tone); border-radius: var(--fd-control-radius); background: var(--fd-approval-soft); color: var(--fd-text); font-size: 13.5px; }
.fd-approval[data-status="needed"] { --fd-approval-tone: var(--fd-info); --fd-approval-soft: var(--fd-info-soft); }
.fd-approval:is([data-status="approved"], [data-status="not-needed"]) { --fd-approval-tone: var(--fd-success); --fd-approval-soft: var(--fd-success-soft); }
.fd-approval:is([data-status="rejected"], [data-status="failed"]) { --fd-approval-tone: var(--fd-error); --fd-approval-soft: var(--fd-error-soft); }
.fd-approval[hidden], .fd-approval [hidden] { display: none; }
.fd-approval-head { display: flex; flex-wrap: wrap; align-items: flex-start; gap: 8px 12px; }
.fd-approval-mark { flex: none; width: 18px; height: 18px; margin-block-start: 1px; border-radius: 50%; display: inline-grid; place-items: center; background: var(--fd-approval-tone); color: var(--fd-surface); font-size: 12px; font-weight: 700; line-height: 1; }
.fd-approval-mark::before { content: "…"; }
.fd-approval[data-status="needed"] .fd-approval-mark::before { content: "i"; }
.fd-approval:is([data-status="approved"], [data-status="not-needed"]) .fd-approval-mark::before { content: "✓"; }
.fd-approval:is([data-status="rejected"], [data-status="failed"]) .fd-approval-mark::before { content: "✕"; }
.fd-approval-words { flex: 1 1 16em; min-width: 0; display: grid; gap: 2px; }
.fd-approval-title { margin: 0; font-size: 14.5px; font-weight: 650; line-height: 1.4; overflow-wrap: anywhere; }
.fd-approval-title:focus { outline: none; }
.fd-approval-why { margin: 0; color: var(--fd-muted); line-height: 1.45; }
.fd-approval-reason { margin: 2px 0 0; padding-inline-start: 10px; border-inline-start: 2px solid var(--fd-approval-tone); line-height: 1.45; overflow-wrap: anywhere; }
.fd-approval-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-inline-start: auto; }
.fd-approval-actions:empty { display: none; }
.fd-approval .fd-button[aria-busy="true"] { opacity: 0.7; cursor: progress; }
.fd-approval-levels { display: flex; flex-wrap: wrap; gap: 4px 18px; margin: 0; padding: 0; list-style: none; }
.fd-approval-level { display: inline-flex; align-items: baseline; gap: 6px; min-width: 0; }
.fd-approval-level-mark { flex: none; width: 1em; text-align: center; color: var(--fd-muted); }
.fd-approval-level-mark::before { content: "○"; }
.fd-approval-level[data-state="waiting"] .fd-approval-level-mark { color: var(--fd-warning); }
.fd-approval-level[data-state="waiting"] .fd-approval-level-mark::before { content: "●"; }
.fd-approval-level[data-state="approved"] .fd-approval-level-mark { color: var(--fd-success); }
.fd-approval-level[data-state="approved"] .fd-approval-level-mark::before { content: "✓"; }
.fd-approval-level[data-state="rejected"] .fd-approval-level-mark { color: var(--fd-error); }
.fd-approval-level[data-state="rejected"] .fd-approval-level-mark::before { content: "✕"; }
.fd-approval-level[data-state="skipped"] .fd-approval-level-mark::before { content: "–"; }
.fd-approval-level-name { font-weight: 600; }
.fd-approval-level-state { color: var(--fd-muted); overflow-wrap: anywhere; }
.fd-approval-open { margin: 0; color: var(--fd-muted); }
.fd-approval-said { margin: 0; color: var(--fd-error); }
.fd-approval-said:empty { display: none; }
.fd-approval-toggle { justify-self: start; display: inline-flex; align-items: center; gap: 6px; padding: 2px 0; border: none; background: none; color: var(--fd-accent); font: inherit; cursor: pointer; }
.fd-approval-toggle::before { content: ""; width: 6px; height: 6px; border-inline-end: 1.5px solid currentColor; border-block-end: 1.5px solid currentColor; rotate: -45deg; transition: rotate 0.15s; }
.fd-approval-toggle[aria-expanded="true"]::before { rotate: 45deg; }
.fd-approval-toggle:dir(rtl)::before { rotate: 45deg; }
.fd-approval-toggle:dir(rtl)[aria-expanded="true"]::before { rotate: -45deg; }
.fd-approval-toggle:hover { text-decoration: underline; }
.fd-approval-toggle:focus-visible { outline: 2px solid var(--fd-focus); outline-offset: 2px; border-radius: 4px; }
.fd-approval-history { display: grid; gap: 8px; margin: 0; padding: 8px 0 0; border-block-start: 1px solid var(--fd-border); list-style: none; }
.fd-approval-entry { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 2px 12px; }
.fd-approval-entry-what { overflow-wrap: anywhere; }
.fd-approval-entry-at { color: var(--fd-muted); white-space: nowrap; font-variant-numeric: tabular-nums; }
.fd-approval-entry-reason { grid-column: 1 / -1; color: var(--fd-text); padding-inline-start: 10px; border-inline-start: 2px solid var(--fd-border); overflow-wrap: anywhere; }
/* What a change changed, each field from what to what, under who changed it. */
.fd-approval-changes { grid-column: 1 / -1; margin: 0; padding-inline-start: 10px; border-inline-start: 2px solid var(--fd-border); list-style: none; color: var(--fd-text); overflow-wrap: anywhere; }
.fd-approval-reject { max-width: 460px; display: grid; gap: 10px; }
.fd-approval-reject-title { margin: 0; font-size: 17px; font-weight: 650; }
.fd-approval-reject-ask { margin: 0; color: var(--fd-muted); line-height: 1.45; }
.fd-approval-reject textarea { width: 100%; box-sizing: border-box; resize: vertical; }
.fd-approval-reject .fd-error { margin: 0; }
@media (max-width: 520px) { .fd-approval-actions { margin-inline-start: 0; flex: 1 1 100%; } .fd-approval-actions .fd-button { flex: 1 1 0; } .fd-approval-entry { grid-template-columns: minmax(0, 1fr); } }
@media (prefers-reduced-motion: reduce) { .fd-approval-toggle::before { transition: none; } }
`;

/** The approvals part's sheet in a document, once, in its place among Fieldia's (PART_RANK.approvals). */
export function installApprovalStyles(doc: Document): void {
  installPartStyles(doc, 'fieldia-approvals-styles', APPROVALS_CSS, PART_RANK.approvals);
}
