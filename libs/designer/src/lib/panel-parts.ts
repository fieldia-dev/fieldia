import type { ElementFactory } from './chrome';
import type { Designer } from './designer';
import { andList, locate, nameOf } from './layout-tree';
import { onTab } from './panel-controls';
import { widthSetting } from './panel-layout';
import type { PropertiesView } from './screen-properties';

/**
 * The views of a block between fields — words, a heading, a button, an
 * image, a line or room — and of several parts picked at once.
 */

const ABOUT: Record<string, string> = {
  divider: 'A line across the whole row.',
  spacer: 'Empty room: in a grid it keeps a cell empty.',
  image: 'A picture on the page.',
  button: 'A button people press.',
  text: 'Words on the page, between the fields.',
  slot: 'A place the app fills with its own part.',
};

export function blockProperties(el: ElementFactory, designer: Designer, id: string): PropertiesView {
  const about = el('p', { class: 'fd-properties-hint' });
  const duplicate = el('button', { type: 'button', class: 'fd-button' }, 'Duplicate');
  duplicate.addEventListener('click', () => designer.duplicate([id]));
  const remove = el('button', { type: 'button', class: 'fd-button fd-button-danger' }, 'Delete');
  remove.addEventListener('click', () => designer.remove([id]));
  // A divider runs across the whole row: it has no width to set.
  const width = locate(designer.getPage(), id)?.node.type === 'divider' ? null : widthSetting(el, designer, id);
  const element = el('div', { class: 'fd-props' }, about, onTab(el('div', { class: 'fd-props-actions' }, duplicate, remove), 'content', 'Duplicate or delete'), ...(width?.rows ?? []));
  return {
    element,
    update(page) {
      const node = locate(page, id)?.node;
      if (!node) return;
      width?.update(page);
      about.textContent = node.type === 'text' && node.style === 'heading' ? 'A heading between the fields.' : (ABOUT[node.type] ?? '');
    },
  };
}

/** Several parts picked: what they are, and what can be done with them all at once. */
export function severalProperties(el: ElementFactory, designer: Designer, ids: readonly string[]): PropertiesView {
  const names = el('p', { class: 'fd-properties-hint' });
  const act = (words: string, run: () => void, danger = false) => {
    const button = el('button', { type: 'button', class: `fd-button${danger ? ' fd-button-danger' : ''}` }, words);
    button.addEventListener('click', run);
    return button;
  };
  const together = el(
    'div',
    { class: 'fd-props-actions' },
    act('Group these', () => designer.wrap([...ids], 'group')),
    act('Side by side', () => designer.wrap([...ids], 'side')),
    act('Make tabs', () => designer.wrap([...ids], 'tabs'))
  );
  const apart = el('p', { class: 'fd-properties-hint', hidden: '' }, 'These sit in different places. Pick parts from one group to group them.');
  const element = el(
    'div',
    { class: 'fd-props' },
    onTab(el('div', { class: 'fd-prop' }, names), 'layout', 'Picked'),
    onTab(el('div', { class: 'fd-prop' }, together, apart), 'layout', 'Group these'),
    onTab(el('div', { class: 'fd-props-actions' }, act('Duplicate', () => designer.duplicate([...ids])), act('Delete', () => designer.remove([...ids]), true)), 'layout', 'Duplicate or delete')
  );
  return {
    element,
    update(page) {
      names.textContent = andList(ids.map((id) => `“${nameOf(page, locate(page, id)?.node ?? null)}”`));
      // Only parts side by side in one list can be grouped where they are.
      const parents = new Set(ids.map((id) => locate(page, id)?.parent.id));
      const same = parents.size === 1 && ids.every((id) => locate(page, id)?.node.type !== 'tab');
      together.hidden = !same;
      apart.hidden = same;
    },
  };
}
