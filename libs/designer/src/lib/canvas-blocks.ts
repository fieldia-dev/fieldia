import { PICTURE_URL, safeUrl, type ButtonNode, type DividerNode, type ImageNode, type MapNode, type RelatedNode, type SlotNode, type SpacerNode, type TextNode } from '@fieldia/core';
import { installListStyles, VIEWER_LABELS } from '@fieldia/viewer';
import type { ElementFactory } from './chrome';
import type { Designer } from './designer';

/**
 * The blocks between fields on the canvas — words, a button, a line, room, a
 * picture, a slot the app fills, a map (its name and layers: the map itself
 * is in Try it), a related list (its heading and columns: its records are in
 * Try it) — drawn as the viewer draws them, so they sit
 * in the grid exactly where they will. Picked, words and a button's label are
 * typed in where they stand; a run of typing is one undo step.
 */

export type BlockNode = TextNode | ButtonNode | DividerNode | SpacerNode | ImageNode | SlotNode | MapNode | RelatedNode;

export interface BlockViews {
  /** The block's element, made or patched; `picked` opens its words to typing. */
  draw(node: BlockNode, picked: boolean): HTMLElement;
  /** Let go of the views of blocks no longer drawn. */
  keep(ids: Set<string>): void;
}

/** The element a block is drawn as, and what it is called by: a kind changed means a new element. */
function shapeOf(node: BlockNode): string {
  if (node.type === 'text') return `text:${node.style ?? 'paragraph'}`;
  if (node.type === 'button') return `button:${node.style ?? 'secondary'}`;
  return node.type;
}

export function blockViews(options: { el: ElementFactory; doc: Document; designer: Designer }): BlockViews {
  const { el, doc, designer } = options;
  const views = new Map<string, { element: HTMLElement; shape: string }>();

  function make(node: BlockNode): HTMLElement {
    const id = node.id;
    switch (node.type) {
      case 'text': {
        const style = node.style ?? 'paragraph';
        const element = el(style === 'heading' ? 'h3' : 'p', { class: `fd-text-${style} fd-canvas-block`, 'data-node': id });
        element.addEventListener('input', () => designer.updateBlock(id, { text: element.textContent ?? '' }));
        return element;
      }
      case 'button': {
        // Not a real button: on the canvas it is picked and its words typed in, not pressed.
        const element = el('span', { class: `fd-button fd-button-${node.style ?? 'secondary'} fd-canvas-block`, 'data-node': id });
        element.addEventListener('input', () => designer.updateBlock(id, { label: element.textContent ?? '' }));
        return element;
      }
      case 'divider':
        return el('hr', { class: 'fd-divider fd-canvas-block', 'data-node': id });
      case 'spacer':
        return el('div', { class: 'fd-block fd-spacer fd-canvas-block', 'data-node': id, 'aria-label': designer.words.canvas.emptyRoom });
      case 'image':
        return el('img', { class: 'fd-block fd-image fd-canvas-block', 'data-node': id, alt: '' });
      case 'slot':
        return el('div', { class: 'fd-slot fd-canvas-block', 'data-node': id });
      case 'map':
        return el('div', { class: 'fd-map-preview fd-canvas-block', 'data-node': id });
      case 'related':
        // The list's own look, which the form draws it with.
        void installListStyles(doc);
        return el('div', { class: 'fd-related fd-canvas-block', 'data-node': id });
    }
  }

  /** A related list as the form draws it: its title and count, View all and New, its columns over two rows to come. */
  function related(element: HTMLElement, node: RelatedNode) {
    const labels = VIEWER_LABELS.en;
    const w = designer.words.relatedPart;
    const head = el('div', { class: 'fd-related-head' });
    if (node.title) head.append(el('span', { class: 'fd-related-title' }, el('bdi', {}, node.title), el('span', { class: 'fd-related-count', 'aria-hidden': 'true' }, '0')));
    const tools = el('span', { class: 'fd-related-tools' });
    if (node.viewAll) tools.append(el('span', { class: 'fd-button fd-button-link' }, labels.relatedAll));
    if (node.create !== false) tools.append(el('span', { class: 'fd-button fd-button-secondary' }, labels.relatedNew));
    head.append(tools);
    const header = el('tr', {}, ...node.columns.map((name) => el('th', { scope: 'col' }, el('span', { class: 'fd-list-head' }, node.fields[name]?.label ?? name))));
    const row = () => el('tr', { class: 'fd-list-row' }, ...node.columns.map(() => el('td', {}, '\u00a0')));
    const table = el('table', { class: 'fd-list-table' }, el('thead', {}, header), el('tbody', {}, row(), row()));
    const list = el('div', { class: 'fd-list', 'data-in-record': '' }, el('div', { class: 'fd-list-scroll' }, table));
    element.replaceChildren(head, list, el('p', { class: 'fd-related-preview-note' }, w.previewNote));
  }

  /** Words typed in where they stand: kept as they are while the cursor is in them. */
  function words(element: HTMLElement, text: string, picked: boolean) {
    if (picked) element.setAttribute('contenteditable', 'plaintext-only');
    else element.removeAttribute('contenteditable');
    if (doc.activeElement !== element && element.textContent !== text) element.textContent = text;
  }

  return {
    draw(node, picked) {
      let view = views.get(node.id);
      if (view && view.shape !== shapeOf(node)) {
        view.element.remove();
        view = undefined;
      }
      if (!view) views.set(node.id, (view = { element: make(node), shape: shapeOf(node) }));
      const element = view.element;
      if (node.type === 'text') words(element, node.text, picked);
      else if (node.type === 'button') words(element, node.label, picked);
      else if (node.type === 'image') {
        if (element.getAttribute('src') !== node.src) element.setAttribute('src', safeUrl(node.src, PICTURE_URL) ?? '');
        element.setAttribute('alt', node.alt);
        // As wide, and where in its row, as the form draws it.
        const width = typeof node.width === 'number' ? `${node.width}px` : node.width ? { small: '160px', medium: '320px', large: '480px', full: '100%' }[node.width] : '';
        element.style.setProperty('--fd-image-width', width || null);
        element.style.justifySelf = node.align ?? '';
      } else if (node.type === 'slot') element.textContent = node.name;
      else if (node.type === 'map') {
        const w = designer.words.canvas;
        element.replaceChildren(el('strong', {}, node.label || w.map), el('span', {}, w.mapLayers(node.layers.map((layer) => layer.id))));
        element.style.minHeight = `${Math.round((node.height ?? 360) / 2)}px`;
      } else if (node.type === 'related') related(element, node);
      const span = node.type === 'divider' ? undefined : node.type === 'map' || node.type === 'related' ? (node.colspan ?? 12) : (node as { colspan?: number }).colspan;
      if (span) element.style.setProperty('--fd-span', String(span));
      else element.style.removeProperty('--fd-span');
      element.classList.toggle('fd-hidden-sometimes', node.invisible !== undefined);
      return element;
    },
    keep(ids) {
      for (const [id, view] of views) {
        if (ids.has(id)) continue;
        view.element.remove();
        views.delete(id);
      }
    },
  };
}
