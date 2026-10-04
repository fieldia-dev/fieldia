import type { ElementFactory } from './chrome';
import type { Designer, DesignerState } from './designer';
import { blockIcon } from './canvas-icons';
import { designerIcon } from './icons';
import { locate } from './layout-tree';

/**
 * The bar for several picked, on the Advanced canvas: how many, and what can
 * be done with them together — put them in a group, side by side, or a tab
 * each; copy them; take them off the page; put them down. Grouping needs parts
 * that sit together, so for parts from different groups it is not offered,
 * and a line says why. A group, an arrangement or tabs picked on its own can
 * be ungrouped. The bar stays at the top of the canvas as it scrolls.
 */

export interface MultiBar {
  /** Sticks at the top of the canvas, taking no room. */
  element: HTMLElement;
  update(state: DesignerState, advanced: boolean): void;
}

export function multiBar(options: { el: ElementFactory; doc: Document; designer: Designer }): MultiBar {
  const { el, doc, designer } = options;
  const button = (words: string, icon: SVGSVGElement, act: () => void, label?: string) => {
    const b = el('button', { type: 'button', class: 'fd-multi-button', ...(label ? { 'aria-label': label, title: label } : {}) }, icon, ...(label ? [] : [words]));
    b.addEventListener('click', act);
    return b;
  };
  const picks = () => designer.getState().picked;
  const group = button('Group', blockIcon(doc, 'group'), () => designer.wrap(picks(), 'group'));
  const side = button('Side by side', blockIcon(doc, 'side'), () => designer.wrap(picks(), 'side'));
  const tabs = button('Tabs', blockIcon(doc, 'tabs'), () => designer.wrap(picks(), 'tabs'));
  const copy = button('', designerIcon(doc, 'duplicate'), () => designer.duplicate(picks()), 'Duplicate');
  const remove = button('', designerIcon(doc, 'delete'), () => designer.remove(picks()), 'Remove');
  const down = button('', designerIcon(doc, 'plus'), () => designer.select(null), 'Put down');
  down.classList.add('fd-multi-down');
  const ungroup = button('Ungroup', blockIcon(doc, 'group'), () => {
    const id = designer.getState().selected;
    if (id) designer.ungroup(id);
  });
  const count = el('b', { class: 'fd-multi-count' });
  const why = el('span', { class: 'fd-multi-why' }, 'Pick parts in the same group to group them');
  const bar = el('div', { class: 'fd-multi', role: 'toolbar', 'aria-label': 'What is picked', hidden: '' }, count, group, side, tabs, why, copy, remove, down, ungroup);
  const element = el('div', { class: 'fd-multi-dock' }, bar);

  return {
    element,
    update(state, advanced) {
      const page = state.page;
      const spots = state.picked.map((id) => locate(page, id));
      const several = advanced && state.picked.length > 1;
      const one = advanced && state.picked.length === 1 ? spots[0]?.node : null;
      const ungroupable = !!one && (one.type === 'section' || one.type === 'tabs');
      bar.hidden = !several && !ungroupable;
      // Parts that sit together, in one list (not tabs among their tabs), can be put in a group of their own.
      const together = several && spots.every((s) => s && s.list === spots[0]?.list) && spots[0]?.parent.type !== 'tabs';
      count.hidden = !several;
      count.textContent = `${state.picked.length} picked`;
      for (const b of [group, side, tabs]) b.hidden = !together;
      why.hidden = !several || together;
      for (const b of [copy, remove, down]) b.hidden = !several;
      ungroup.hidden = several || !ungroupable;
    },
  };
}
