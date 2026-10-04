import type { ButtonNode, DividerNode, ImageNode, SlotNode, SpacerNode, TextNode } from '@fieldia/core';
import type { ElementFactory } from './chrome';
import type { Designer } from './designer';

/**
 * The blocks between fields on the canvas — words, a button, a line, room, a
 * picture, a slot the app fills — drawn as the viewer draws them, so they sit
 * in the grid exactly where they will. Picked, words and a button's label are
 * typed in where they stand; a run of typing is one undo step.
 */

export type BlockNode = TextNode | ButtonNode | DividerNode | SpacerNode | ImageNode | SlotNode;

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
        return el('div', { class: 'fd-block fd-spacer fd-canvas-block', 'data-node': id, 'aria-label': 'Empty room' });
      case 'image':
        return el('img', { class: 'fd-block fd-image fd-canvas-block', 'data-node': id, alt: '' });
      case 'slot':
        return el('div', { class: 'fd-slot fd-canvas-block', 'data-node': id });
    }
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
        if (element.getAttribute('src') !== node.src) element.setAttribute('src', node.src);
        element.setAttribute('alt', node.alt);
      } else if (node.type === 'slot') element.textContent = node.name;
      const span = node.type === 'divider' ? undefined : (node as { colspan?: number }).colspan;
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
