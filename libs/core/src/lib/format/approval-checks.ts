import type { Field } from './field';
import type { Page } from './page';

/** What a page's approvals are checked with: the reference check's own report, its fields, and its word that they are owed (`owe`). */
export interface ApprovalTools {
  report(path: string, message: string): void;
  /** The field of this name, or reported missing at `path`. */
  need(name: string, path: string): Field | undefined;
  /** Said where checks come in a part that has not come (the one-tag script's: later-checks.ts): they are owed. */
  owe(part: string): void;
}

/**
 * A page's `approval`: on a record's own page — a page of responses keeps no record to approve, and a list approves
 * none of its rows — the fields it leaves open each one of the page's, named once. In the one-tag script it comes with
 * the approvals part, which a page with approvals asks for: run once it came (later-checks.ts).
 */
export function checkApproval(page: Page, tools: ApprovalTools): void {
  const approval = page.approval;
  if (approval === undefined) return;
  if (page.data.kind !== 'record') tools.report('approval', 'approvals are asked of a record: a page of responses keeps none to approve');
  else if (page.layout.type === 'list') tools.report('approval', 'approvals are said on a record’s own page, not on a list of records');
  const open: unknown[] = Array.isArray(approval.open) ? approval.open : [];
  open.forEach((name, i) => {
    const at = `approval.open[${i}]`;
    if (typeof name !== 'string') return;
    if (open.indexOf(name) !== i) return tools.report(at, `"${name}" is named twice`);
    tools.need(name, at);
  });
  if (approval.lock === false && open.length) tools.report('approval.open', 'nothing is locked while it waits (lock is false): no field needs to stay open');
}
