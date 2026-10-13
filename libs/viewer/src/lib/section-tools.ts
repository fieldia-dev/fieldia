import type { SectionNode } from '@fieldia/core';
import { drawIcon } from '@fieldia/widgets';
import { installGroupStyles } from './group-styles';
import type { HeadKit } from './section-head';

/**
 * A group's heading as a work item draws it, with its tools at its end: ⤢ that
 * shows the group alone over the record's body, ^ and ⌄ that fold it, and the
 * tools of a field it holds alone. The head part's (head-part.ts).
 */

const fill = (template: string, values: Record<string, string>) => template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? '');

/**
 * The heading of a group with tools at its end. `show` folds and unfolds it;
 * the section is marked folded (`fd-section-folded`) and maximised
 * (`data-maximised`) for the stylesheet.
 */
export function sectionHeading(kit: HeadKit, node: SectionNode, section: HTMLElement, content: HTMLElement, description: HTMLElement | null, own: HTMLElement[]) {
  const { el, doc, labels } = kit;
  installGroupStyles(doc);
  const title = node.title ?? '';
  const tools = el('span', { class: 'fd-section-tools' });
  const legend = el('legend', { class: 'fd-section-title fd-section-head' }, el('span', { class: 'fd-section-name' }, ...kit.withIcon(node.icon, title)), tools);
  section.setAttribute('data-head', '');
  const icon = (name: string) => drawIcon(doc, name, kit.icons) ?? '';
  const tool = (name: string, words: string) => {
    const button = el('button', { type: 'button', class: 'fd-section-tool', 'data-tool': name, 'aria-label': words, title: words });
    return button;
  };

  // ⤢: the group alone over the record's body, until pressed again or Escape.
  let undo: (() => void) | null = null;
  const big = node.maximise ? tool('maximise', fill(labels.maximiseNamed, { name: title })) : null;
  const restore = () => {
    undo?.();
    undo = null;
    if (!big) return;
    big.setAttribute('aria-pressed', 'false');
    big.replaceChildren(icon('maximise'));
  };
  if (big) {
    big.setAttribute('aria-pressed', 'false');
    big.append(icon('maximise'));
    big.addEventListener('click', () => {
      if (undo) return restore();
      undo = maximise(section);
      big.setAttribute('aria-pressed', 'true');
      big.replaceChildren(icon('restore'));
      big.focus();
    });
    section.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape' || !undo || event.defaultPrevented) return;
      event.preventDefault();
      event.stopPropagation();
      restore();
      big.focus();
    });
    tools.append(big);
  }

  // ^ and ⌄: the group folded and unfolded from its heading's end.
  let open = node.collapsed !== true;
  const fold = node.collapsible ? tool('fold', '') : null;
  const show = (next: boolean) => {
    open = next;
    if (fold) {
      const words = fill(open ? labels.foldNamed : labels.unfoldNamed, { name: title });
      fold.setAttribute('aria-label', words);
      fold.title = words;
      fold.setAttribute('aria-expanded', String(open));
      fold.replaceChildren(icon(open ? 'chevron-up' : 'chevron-down'));
    }
    content.hidden = !open;
    if (description) description.hidden = !open;
    section.classList.toggle('fd-section-folded', !open);
    if (!open && undo) restore();
  };
  if (fold) {
    fold.setAttribute('aria-controls', content.id);
    fold.addEventListener('click', () => show(!open));
    tools.append(fold);
  }
  // The tools of the field it holds alone, last.
  tools.append(...own);
  show(open);
  return { legend, show, isOpen: () => open };
}

/**
 * The group alone over the record's body: every part beside it, and beside
 * each part round it up to the body, out of sight; the grids round it give it
 * their whole width. Returns how to put it all back.
 */
function maximise(section: HTMLElement): () => void {
  const host = section.closest<HTMLElement>('.fd-tabpanel') ?? section.closest<HTMLElement>('.fd-content') ?? section.closest<HTMLElement>('.fd-form');
  const unshown: HTMLElement[] = [];
  const grids: HTMLElement[] = [];
  let at: HTMLElement = section;
  while (at !== host && at.parentElement) {
    const parent: HTMLElement = at.parentElement;
    for (const sibling of [...parent.children] as HTMLElement[]) {
      if (sibling === at || sibling.tagName === 'LEGEND' || sibling.hasAttribute('data-unshown')) continue;
      sibling.setAttribute('data-unshown', '');
      unshown.push(sibling);
    }
    if (parent.classList.contains('fd-grid')) {
      parent.setAttribute('data-maximising', '');
      grids.push(parent);
    }
    at = parent;
  }
  section.setAttribute('data-maximised', '');
  section.scrollIntoView?.({ block: 'nearest' });
  return () => {
    for (const part of unshown) part.removeAttribute('data-unshown');
    for (const grid of grids) grid.removeAttribute('data-maximising');
    section.removeAttribute('data-maximised');
  };
}
