import type { Page } from './page';

/** What a page's outbox is checked with: the reference check's own report, and its word that the checks are owed. */
export interface OutboxTools {
  report(path: string, message: string): void;
  owe(part: string): void;
}

/**
 * A page's offline outbox (`outbox`): a form people send — a response, or a record's save — never a list of records. In
 * the one-tag script it comes with the outbox part, which a page with one asks for (later-checks.ts).
 */
export function checkOutbox(page: Page, tools: OutboxTools): void {
  if (page.outbox && page.layout.type === 'list') tools.report('outbox', 'an outbox keeps a form’s sends made without signal: a list of records sends none');
}
