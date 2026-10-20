import type { StoredDraft } from './data-source';

/**
 * Drafts: what is typed kept to be offered again, in the browser's store (`drafts.store`) or on the app's server (the
 * data source's `saveDraft` and `loadDraft`), the store keeping only its key then. A draft keeps the answers, the
 * wizard's step and the optional steps passed over, and text typed that does not read yet, as it was typed.
 */

/** A draft as the browser's store keeps it: the draft itself, or — kept on the app's server — its key. */
export type KeptDraft = StoredDraft | { savedAt: string; key: string };

/** A draft read back from the browser's store, of this Fieldia or an older one (answers alone); null for none, or words that are none. */
export function draftRead(raw: string | null): KeptDraft | null {
  if (!raw) return null;
  try {
    const read = JSON.parse(raw) as Record<string, unknown> | null;
    if (!read || typeof read !== 'object' || typeof read['savedAt'] !== 'string') return null;
    if (typeof read['key'] === 'string') return { savedAt: read['savedAt'], key: read['key'] };
    return read['values'] && typeof read['values'] === 'object' && !Array.isArray(read['values']) ? (read as unknown as StoredDraft) : null;
  } catch {
    return null;
  }
}

/**
 * The step a draft opens at: its own where it applies still, else the nearest before it that does — never one after
 * it, whose questions were not reached — and the first that applies for a draft that names none (or one the page
 * no longer has). Null for a page with no steps.
 */
export function resumeStep(steps: readonly string[], applies: readonly string[], step: string | null | undefined): string | null {
  if (!steps.length) return null;
  const at = step ? steps.indexOf(step) : -1;
  for (let i = at; i >= 0; i--) if (applies.includes(steps[i])) return steps[i];
  return applies[0] ?? steps[0];
}
