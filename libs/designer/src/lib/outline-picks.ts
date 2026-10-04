/**
 * Several picked from the outline, as a list of files is picked: Shift-click
 * or Shift with the arrows picks every row from where the pick began to the
 * row reached; ⌘- or Ctrl-click adds one, or lets it go.
 */

/** The rows on show from `anchor` to `to`, `to` last; `to` alone when `anchor` is not on show. */
export function rangeOf(rows: readonly { id: string }[], anchor: string | null, to: string): string[] {
  const from = rows.findIndex((r) => r.id === anchor);
  const end = rows.findIndex((r) => r.id === to);
  if (from === -1 || end === -1) return [to];
  const step = end >= from ? 1 : -1;
  const ids: string[] = [];
  for (let at = from; at !== end + step; at += step) ids.push(rows[at].id);
  return ids;
}
