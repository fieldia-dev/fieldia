import type { RelatedRecord } from '@fieldia/core';

/**
 * What a link to a record shows of it besides its name, wherever it is drawn: in its box (the relations part's,
 * relations.ts) and as words at rest (read-text.ts), which the main script draws.
 */

/**
 * A linked record's picture, as Flectra's avatar widgets show one: its own,
 * or the initials of its name in a circle when it has none.
 */
export function linkAvatar(doc: Document, record: RelatedRecord | null | undefined, into?: HTMLElement): HTMLElement {
  const box = into ?? doc.createElement('span');
  box.className = 'fd-link-avatar';
  box.setAttribute('aria-hidden', 'true');
  if (!record) {
    box.hidden = true;
    box.replaceChildren();
    return box;
  }
  box.hidden = false;
  if (record.avatar) {
    const img = doc.createElement('img');
    img.src = record.avatar;
    img.alt = '';
    box.replaceChildren(img);
  } else {
    const words = record.label.trim().split(/\s+/).filter(Boolean);
    box.textContent = (words.length > 1 ? words[0][0] + words[words.length - 1][0] : (words[0]?.[0] ?? '')).toUpperCase();
  }
  return box;
}

/**
 * A linked record's lines under it — an address, a tax number — each a line
 * of its own that reads its own way: an address in English stays in its order
 * on a page read right to left, still lined up with the page.
 */
export function detailLines(box: HTMLElement, text: string): void {
  const doc = box.ownerDocument;
  box.replaceChildren(
    ...text.split('\n').map((line) => {
      const row = doc.createElement('div');
      row.textContent = line;
      return row;
    })
  );
}
