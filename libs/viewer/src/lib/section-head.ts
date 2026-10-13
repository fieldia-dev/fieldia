import type { SectionNode, TextNode } from '@fieldia/core';
import { drawIcon, linkedWords, type IconSet, type Widget, type WidgetLabels } from '@fieldia/widgets';

/**
 * A group drawn as a work item draws one: its heading's words, then its tools
 * at the heading's end — ⤢ that shows the group alone over the record's body,
 * ^ and ⌄ that fold it, and the tools of a field it holds alone (a Markdown
 * text's Edit and Done) — its columns of their own widths and gap, and help
 * in a light box with links in its words.
 *
 * The tools show while the group is pointed at or worked in, always while it
 * is folded or maximised, and always where nothing can point (the
 * stylesheet's part). Each is a named button with a tooltip.
 */

const fieldTools = new WeakMap<HTMLElement, HTMLElement[]>();

/** A field's own tools, kept by its wrapper for the group round it to take. */
export function keepTools(wrapper: HTMLElement, widget: Widget): void {
  if (widget.tools?.length) fieldTools.set(wrapper, widget.tools);
}

/** Whether a group draws the work item's heading: its fold control at the end, or a ⤢. */
export const workHeading = (node: SectionNode) => !!node.title && node.style !== 'inline' && (node.foldAt === 'end' || node.maximise === true);

/**
 * The tools of the one field a group holds, its label out of sight, for the
 * group's heading: the field says what the group is, so its tools are the
 * group's too.
 */
export function loneFieldTools(node: SectionNode, content: HTMLElement): HTMLElement[] {
  if (!node.title || node.children.length !== 1 || node.children[0].type !== 'field') return [];
  const wrapper = content.firstElementChild as HTMLElement | null;
  if (!wrapper || wrapper.getAttribute('data-labels') !== 'hidden') return [];
  return fieldTools.get(wrapper) ?? [];
}

/** A group's own column widths and the room between them, worn by its grid (from a tablet's width up). */
export function applyTracks(grid: HTMLElement, node: SectionNode): void {
  if (node.tracks?.length) {
    grid.setAttribute('data-tracks', '');
    // A share of what is left never pushes past it: a long word wraps instead.
    grid.style.setProperty('--fd-track-list', node.tracks.map((track) => (track.endsWith('fr') ? `minmax(0, ${track})` : track)).join(' '));
  }
  if (node.gap !== undefined) grid.style.columnGap = `${node.gap}px`;
}

export interface HeadKit {
  doc: Document;
  labels: WidgetLabels;
  icons?: IconSet;
  /** The words with the icon a page names before them. */
  withIcon(name: string | undefined, text: string): (Node | string)[];
  el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs?: Record<string, string | undefined>, ...children: (Node | string)[]): HTMLElementTagNameMap[K];
}

const fill = (template: string, values: Record<string, string>) => template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? '');

/**
 * The heading of a group with tools at its end. `show` folds and unfolds it;
 * the section is marked folded (`fd-section-folded`) and maximised
 * (`data-maximised`) for the stylesheet.
 */
export function sectionHeading(kit: HeadKit, node: SectionNode, section: HTMLElement, content: HTMLElement, description: HTMLElement | null, own: HTMLElement[]) {
  const { el, doc, labels } = kit;
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

/** Words with `[words](address)` links among them, each text part of a text's words. */
export function wordsWithLinks(doc: Document, nodes: (Node | string)[]): (Node | string)[] {
  return nodes.flatMap((node) => (typeof node === 'string' ? linkedWords(doc, node) : [node]));
}

/** A text's help box: room for an icon at its start, the words in a paragraph beside it. */
export function helpBox(kit: HeadKit, node: TextNode, words: (Node | string)[]): HTMLElement {
  const icon = node.icon ? drawIcon(kit.doc, node.icon, kit.icons) : null;
  icon?.classList.add('fd-help-box-icon');
  return kit.el('div', { class: 'fd-help-box fd-text-help', 'data-node': node.id }, ...(icon ? [icon] : []), kit.el('p', {}, ...words));
}
