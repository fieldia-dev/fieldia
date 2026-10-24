import type { Page } from '@fieldia/core';

/** The most fields a page's skeleton draws: a long page's first screen, never the whole of it. */
const MOST = 24;

/**
 * A page drawn as a skeleton from its layout (docs/plans/loading.md, `first`; the loading part's): while the page's own parts are still
 * coming, a shape of what will be there in its place — each group a card with its title's bar, each field its label's
 * bar over its box, as wide as its columns make it, a list's rows as bars; only the first tab or step. The page's words
 * are not drawn: they are said once the page is. Hidden from a screen reader, which hears the wait said once.
 */
export function pageSkeleton(doc: Document, page: Page): HTMLElement {
  const make = (className: string) => Object.assign(doc.createElement('div'), { className });
  const bar = (className = 'fd-sk') => Object.assign(doc.createElement('span'), { className });
  const holder = make('fd-sk-page');
  holder.setAttribute('aria-hidden', 'true');
  let fields = 0;
  const grid = (columns: unknown) => {
    const made = make('fd-sk-grid');
    const count = typeof columns === 'number' ? columns : typeof columns === 'object' && columns ? Number((columns as { wide?: number }).wide ?? 1) : 1;
    if (count > 1) made.style.setProperty('--fd-sk-cols', String(Math.min(count, 4)));
    return made;
  };
  /** Any part of a layout: a field, a group, tabs, a wizard's steps, a list. */
  type Part = { type: string; children?: Part[]; title?: string; columns?: unknown };
  const walk = (nodes: readonly Part[], into: HTMLElement) => {
    for (const one of nodes) {
      if (fields >= MOST) return;
      if (one.type === 'field') {
        fields++;
        const field = make('fd-sk-field');
        field.append(bar('fd-sk fd-sk-label'), bar('fd-sk fd-sk-box'));
        into.append(field);
      } else if (one.type === 'list' || one.type === 'related') {
        const rows = make('fd-sk-rows');
        for (let i = 0; i < 4; i++) rows.append(bar());
        into.append(rows);
        fields += 4;
      } else if (one.type === 'tabs' || one.type === 'wizard') {
        // The tab or step shown first: its strip's bar, then what it holds.
        into.append(bar('fd-sk fd-sk-tabs'));
        const first = one.children?.[0];
        if (first?.children) walk(first.children, into);
      } else if (Array.isArray(one.children)) {
        // A group: a card where it has a title, its own columns.
        const group = one.type === 'section' && one.title ? make('fd-sk-group') : null;
        if (group) group.append(bar('fd-sk fd-sk-title'));
        const inner = grid(one.columns);
        walk(one.children, inner);
        if (group) {
          group.append(inner);
          into.append(group);
        } else into.append(inner);
      }
    }
  };
  const layout = page.layout as Part;
  walk(layout.type === 'list' || layout.type === 'tabs' || layout.type === 'wizard' ? [layout] : (layout.children ?? []), holder);
  return holder;
}
