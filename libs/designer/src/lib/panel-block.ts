import type { ImageNode, Page, TextNode } from '@fieldia/core';
import type { ElementFactory } from './chrome';
import type { Designer } from './designer';
import { locate } from './layout-tree';
import { segmented, setting } from './panel-controls';

/**
 * A block's own settings, on the Content tab: a picture's address and the
 * words read out for it, its width, its place in its row, a link and a
 * caption; how words read (a heading, words, or a note), and a button's words. Words and a button's label are typed on the canvas too;
 * here they are named, so they are found and reached by keyboard.
 */

export interface BlockContent {
  rows: HTMLElement[];
  update(page: Page): void;
}

const focused = (node: Element) => node.ownerDocument.activeElement === node;

export function blockContent(el: ElementFactory, designer: Designer, id: string): BlockContent | null {
  const kind = locate(designer.getPage(), id)?.node.type;
  const w = designer.words.panel;
  if (kind === 'image') {
    const src = el('input', { class: 'fd-input', 'aria-label': w.pictureAddress, placeholder: 'https://…', inputmode: 'url', autocomplete: 'off' }) as HTMLInputElement;
    src.addEventListener('input', () => designer.updateBlock(id, { src: src.value }));
    const alt = el('input', { class: 'fd-input', 'aria-label': w.description, placeholder: w.pictureShows, autocomplete: 'off' }) as HTMLInputElement;
    alt.addEventListener('input', () => designer.updateBlock(id, { alt: alt.value }));
    // How wide — its own width, a size, the whole row, or pixels — and where it sits in its row.
    const width = segmented<string>(
      el,
      w.width,
      [
        { value: 'auto', words: w.own, label: w.ownWidth },
        { value: 'small', words: w.sizeS, label: w.small },
        { value: 'medium', words: w.sizeM, label: w.medium },
        { value: 'large', words: w.sizeL, label: w.large },
        { value: 'full', words: w.full, label: w.fullRow },
      ],
      (value) => value && designer.updateBlock(id, { width: value === 'auto' ? null : (value as ImageNode['width']) })
    );
    const pixels = el('input', { type: 'number', class: 'fd-input', 'aria-label': w.widthInPixels, min: '16', max: '4000', step: '1', inputmode: 'numeric', placeholder: w.px }) as HTMLInputElement;
    pixels.addEventListener('change', () => designer.updateBlock(id, { width: pixels.value.trim() ? Number(pixels.value) : null }));
    const place = segmented<string>(
      el,
      w.place,
      [
        { value: 'start', words: w.start, title: w.atStart },
        { value: 'center', words: w.centre },
        { value: 'end', words: w.end, title: w.atEnd },
      ],
      (value) => value && designer.updateBlock(id, { align: value === 'start' ? null : (value as ImageNode['align']) })
    );
    const href = el('input', { class: 'fd-input', 'aria-label': w.link, placeholder: 'https://…', inputmode: 'url', autocomplete: 'off' }) as HTMLInputElement;
    // Kept once typed and left: an address half typed is not one yet.
    href.addEventListener('change', () => designer.updateBlock(id, { href: href.value }));
    const caption = el('input', { class: 'fd-input', 'aria-label': w.caption, placeholder: w.wordsUnderPicture, autocomplete: 'off' }) as HTMLInputElement;
    caption.addEventListener('input', () => designer.updateBlock(id, { caption: caption.value }));
    return {
      rows: [
        setting(el, 'content', 'Picture address', src, { words: w.pictureAddress }),
        setting(el, 'content', 'Description', alt, { hint: w.descriptionHint, words: w.description }),
        setting(el, 'content', 'Width', [width.element, pixels], { words: w.width }),
        setting(el, 'content', 'Place', place.element, { words: w.place }),
        setting(el, 'content', 'Link', href, { hint: w.opensNewTab, words: w.link }),
        setting(el, 'content', 'Caption', caption, { words: w.caption }),
      ],
      update(page) {
        const node = locate(page, id)?.node;
        if (node?.type !== 'image') return;
        if (!focused(src)) src.value = node.src;
        if (!focused(alt)) alt.value = node.alt;
        alt.setAttribute('aria-invalid', String(!node.alt.trim()));
        width.set(typeof node.width === 'number' ? null : (node.width ?? 'auto'));
        if (!focused(pixels)) pixels.value = typeof node.width === 'number' ? String(node.width) : '';
        place.set(node.align ?? 'start');
        if (!focused(href)) href.value = node.href ?? '';
        if (!focused(caption)) caption.value = node.caption ?? '';
      },
    };
  }
  if (kind === 'text') {
    const style = segmented<NonNullable<TextNode['style']>>(
      el,
      w.readsAs,
      [
        { value: 'heading', words: w.heading },
        { value: 'paragraph', words: w.words },
        { value: 'note', words: w.note, title: w.noteTitle },
      ],
      (value) => value && designer.updateBlock(id, { style: value })
    );
    return {
      rows: [setting(el, 'content', 'Reads as', style.element, { words: w.readsAs })],
      update(page) {
        const node = locate(page, id)?.node;
        if (node?.type === 'text') style.set(node.style ?? 'paragraph');
      },
    };
  }
  if (kind === 'button') {
    const words = el('input', { class: 'fd-input', 'aria-label': w.buttonWords, autocomplete: 'off' }) as HTMLInputElement;
    words.addEventListener('input', () => designer.updateBlock(id, { label: words.value }));
    return {
      rows: [setting(el, 'content', 'Button words', words, { words: w.buttonWords })],
      update(page) {
        const node = locate(page, id)?.node;
        if (node?.type === 'button' && !focused(words)) words.value = node.label;
      },
    };
  }
  return null;
}
