import type { Form, Page } from '@fieldia/core';

/**
 * The address follows the record shown — a new one once it is saved, another opened by "Open it", the pager, a copy —
 * so Reload shows it again and Back comes back to it, as an app's router keeps it. Replaced, never pushed: Back's steps
 * stay the pages the demo went to. A new record's values (`values=`) go once it is saved; a list page shows no one
 * record, and its address stays as it is.
 */
export function addressFollowsRecord(form: Form, page: Page): () => void {
  if (page.data.kind !== 'record' || page.layout.type === 'list') return () => undefined;
  return form.subscribe((state) => {
    const params = new URLSearchParams(location.search);
    const now = state.recordId == null ? 'new' : String(state.recordId);
    // No record in the address opens the first one (shared/sample-data.ts: recordFromQuery).
    if ((params.get('record') ?? '1') === now) return;
    params.set('record', now);
    if (now !== 'new') params.delete('values');
    history.replaceState(history.state, '', `${location.pathname}?${params}${location.hash}`);
  });
}
