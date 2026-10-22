import { fieldiaStyle } from '@fieldia/widgets';

/**
 * The views part's sheet (views-part.ts): a list's views kept on the app's server, in its search bar's menu — a view
 * shared with the team marked by its people and its words, muted after its name; why one was not saved, under its form.
 * Not ranked among the parts' sheets (PART_RANK): it is the list's, cut from it, as its cards' and its columns' are, and
 * goes right after the list's own sheet — it reshapes nothing a theme does, and a theme's menu still reshapes its rows.
 */
export const VIEW_STYLES = `
.fd-view-words { display: grid; flex: 1; gap: 1px; min-width: 0; }
.fd-view-name { overflow-wrap: anywhere; }
.fd-view-shared { display: flex; align-items: center; gap: 4px; min-width: 0; color: var(--fd-muted); font-size: 12px; }
.fd-view-shared svg { width: 14px; height: 14px; flex: none; }
.fd-view-whose { min-width: 0; overflow-wrap: anywhere; }
.fd-view-refused { margin: 0; color: var(--fd-error); font-size: 13px; }
`;

/** The views' sheet in a document, once, right after the list's own. */
export function installViewStyles(doc: Document): void {
  if (doc.getElementById('fd-list-views-styles')) return;
  const style = fieldiaStyle(doc, VIEW_STYLES, 'fd-list-views-styles');
  const list = doc.getElementById('fd-list-styles');
  if (list) list.after(style);
  else (doc.head ?? doc.documentElement).append(style);
}
