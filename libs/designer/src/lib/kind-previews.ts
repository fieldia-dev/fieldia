import type { FieldNode, Page } from '@fieldia/core';
import { appKindPreview } from './app-kinds-ui';
import type { ElementFactory } from './chrome';
import { ADDRESS_PARTS, USUAL_ADDRESS } from './kind-commands';

/**
 * How the newer kinds read on a closed card, before anyone answers: a
 * signature as a line to sign on, an address as a dotted line for each part,
 * tags as the options to pick from, a repeating group as its first card and
 * the button that adds another. The others — a slider, pictures, a ranking,
 * a matrix — show their real answer box, so this gives none for them.
 */

const PART_WORDS: Record<(typeof ADDRESS_PARTS)[number], string> = { street: 'Street address', line2: 'Address line 2', city: 'City', region: 'State or region', postcode: 'Postcode', country: 'Country' };

export function kindPreview(el: ElementFactory, page: Page, node: FieldNode, kind: string | null): HTMLElement | null {
  const def = page.fields[node.field];
  const option = (key: string) => node.options?.[key];
  const line = (words: string) => el('div', { class: 'fd-q-preview-part' }, words);
  switch (kind) {
    case 'signature': {
      // The page's words on the pad, and those kept under it.
      const pad = el('div', { class: 'fd-q-preview fd-q-preview-signature' }, node.placeholder || 'Sign here');
      const under = option('footerLabel');
      return typeof under === 'string' && under ? el('div', { class: 'fd-q-preview-lines' }, pad, el('span', { class: 'fd-q-preview-under' }, under)) : pad;
    }
    case 'address': {
      const asked = option('parts');
      const parts = ADDRESS_PARTS.filter((p) => (Array.isArray(asked) ? asked : USUAL_ADDRESS).includes(p));
      return el('div', { class: 'fd-q-preview-lines' }, ...parts.map((part) => line(PART_WORDS[part])));
    }
    case 'tags':
      return def.type === 'selection' ? el('div', { class: 'fd-q-preview-tags' }, ...def.options.map((o) => el('span', { class: 'fd-q-preview-tag' }, o.label))) : null;
    case 'repeating': {
      if (def.type !== 'one2many') return null;
      const title = typeof option('itemLabel') === 'string' && option('itemLabel') ? `${option('itemLabel')} 1` : 'Entry 1';
      const add = typeof option('addLabel') === 'string' && option('addLabel') ? String(option('addLabel')) : 'Add another';
      const fields = Object.entries(def.fields).filter(([name]) => name !== def.sequenceField).map(([, f]) => f.label);
      return el(
        'div',
        { class: 'fd-q-preview-cards' },
        el('div', { class: 'fd-q-preview-card' }, el('span', { class: 'fd-q-preview-card-title' }, title), ...fields.map(line)),
        el('span', { class: 'fd-q-preview-add' }, `+ ${add}`)
      );
    }
    default:
      return appKindPreview(el, page, node, kind);
  }
}
