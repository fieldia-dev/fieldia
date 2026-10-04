import type { Page, TextNode } from '@fieldia/core';
import type { ElementFactory } from './chrome';
import type { Designer } from './designer';
import { locate } from './layout-tree';
import { segmented, setting } from './panel-controls';

/**
 * A block's own settings, on the Content tab: a picture's address and the
 * words read out for it, how words read (a heading, words, or a note), and a
 * button's words. Words and a button's label are typed on the canvas too;
 * here they are named, so they are found and reached by keyboard.
 */

export interface BlockContent {
  rows: HTMLElement[];
  update(page: Page): void;
}

const focused = (node: Element) => node.ownerDocument.activeElement === node;

export function blockContent(el: ElementFactory, designer: Designer, id: string): BlockContent | null {
  const kind = locate(designer.getPage(), id)?.node.type;
  if (kind === 'image') {
    const src = el('input', { class: 'fd-input', 'aria-label': 'Picture address', placeholder: 'https://…', inputmode: 'url', autocomplete: 'off' }) as HTMLInputElement;
    src.addEventListener('input', () => designer.updateBlock(id, { src: src.value }));
    const alt = el('input', { class: 'fd-input', 'aria-label': 'Description', placeholder: 'What the picture shows', autocomplete: 'off' }) as HTMLInputElement;
    alt.addEventListener('input', () => designer.updateBlock(id, { alt: alt.value }));
    return {
      rows: [
        setting(el, 'content', 'Picture address', src),
        setting(el, 'content', 'Description', alt, { hint: 'Read out to those who cannot see it, and shown if the picture does not load.' }),
      ],
      update(page) {
        const node = locate(page, id)?.node;
        if (node?.type !== 'image') return;
        if (!focused(src)) src.value = node.src;
        if (!focused(alt)) alt.value = node.alt;
      },
    };
  }
  if (kind === 'text') {
    const style = segmented<NonNullable<TextNode['style']>>(
      el,
      'Reads as',
      [
        { value: 'heading', words: 'Heading' },
        { value: 'paragraph', words: 'Words' },
        { value: 'note', words: 'Note', title: 'Set apart in a soft panel' },
      ],
      (value) => value && designer.updateBlock(id, { style: value })
    );
    return {
      rows: [setting(el, 'content', 'Reads as', style.element)],
      update(page) {
        const node = locate(page, id)?.node;
        if (node?.type === 'text') style.set(node.style ?? 'paragraph');
      },
    };
  }
  if (kind === 'button') {
    const words = el('input', { class: 'fd-input', 'aria-label': 'Button words', autocomplete: 'off' }) as HTMLInputElement;
    words.addEventListener('input', () => designer.updateBlock(id, { label: words.value }));
    return {
      rows: [setting(el, 'content', 'Button words', words)],
      update(page) {
        const node = locate(page, id)?.node;
        if (node?.type === 'button' && !focused(words)) words.value = node.label;
      },
    };
  }
  return null;
}
