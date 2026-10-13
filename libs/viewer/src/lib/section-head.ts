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
 * stylesheet's part). Each is a named button with a tooltip. The heading with
 * its tools is the head part's (section-tools.ts), loaded the first time a
 * page draws one; what is here every page has.
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
