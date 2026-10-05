import type { LabelPlace } from '@fieldia/core';
import type { ElementFactory } from './chrome';
import type { Designer } from './designer';
import { SPANNED } from './layout-ops';
import { across, andList, isSection, locate, nameOf, spanOf } from './layout-tree';
import { onTab, segmented, setting } from './panel-controls';
import { blockContent } from './panel-block';
import { aroundWords, widthSetting } from './panel-layout';
import { severalRequired } from './panel-several-required';
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
  form: 'A saved form, drawn as the form draws it. It is changed on its own page; here, which one, its version, its title and where its answers go.',
};

export function blockProperties(el: ElementFactory, designer: Designer, id: string): PropertiesView {
  const about = el('p', { class: 'fd-properties-hint' });
  const duplicate = el('button', { type: 'button', class: 'fd-button' }, 'Duplicate');
  duplicate.addEventListener('click', () => designer.duplicate([id]));
  const remove = el('button', { type: 'button', class: 'fd-button fd-button-danger' }, 'Delete');
  remove.addEventListener('click', () => designer.remove([id]));
  // A divider runs across the whole row: it has no width to set.
  const width = locate(designer.getPage(), id)?.node.type === 'divider' ? null : widthSetting(el, designer, id);
  // Its own settings: a picture's address and description, how words read, a button's words.
  const own = blockContent(el, designer, id);
  const element = el('div', { class: 'fd-props' }, about, ...(own?.rows ?? []), onTab(el('div', { class: 'fd-props-actions' }, duplicate, remove), 'content', 'Duplicate or delete'), ...(width?.rows ?? []));
  return {
    element,
    update(page) {
      const node = locate(page, id)?.node;
      if (!node) return;
      width?.update(page);
      own?.update(page);
      about.textContent = node.type === 'text' && node.style === 'heading' ? 'A heading between the fields.' : (ABOUT[node.type] ?? '');
    },
  };
}

/** The one value they all have, or none when they differ. */
const shared = <T>(values: T[]): T | null => (values.length && values.every((v) => v === values[0]) ? values[0] : null);

/**
 * Several parts picked: what they are; how wide each is and where their
 * labels sit, set on them all as one undo step, offered only when it applies
 * to every one of them; and grouping them, side by side or as tabs.
 */
export function severalProperties(el: ElementFactory, designer: Designer, ids: readonly string[]): PropertiesView {
  const names = el('p', { class: 'fd-properties-hint' });

  // ---- how wide each is: no wider than the narrowest place among them ----
  let drawn = 0;
  let width: ReturnType<typeof segmented<number>> | null = null;
  const widthBox = el('div', { class: 'fd-insp-width' });
  const widthHint = el('p', { class: 'fd-properties-hint fd-set-hint' });
  const widthRow = setting(el, 'layout', 'Width', widthBox, { hint: widthHint });

  // ---- where their labels sit ----
  const AROUND = 'around';
  const labels = segmented<string>(
    el,
    'Labels',
    [
      { value: AROUND, words: 'Not set', title: 'As the group or the page round each says' },
      { value: 'above', words: 'Above' },
      { value: 'beside', words: 'Beside' },
      { value: 'hidden', words: 'In box', title: 'Inside the box, as its placeholder; still read out by screen readers' },
    ],
    (value) => designer.setEach([...ids], { labels: value === AROUND || value === null ? null : (value as LabelPlace) })
  );
  const labelsRow = setting(el, 'layout', 'Labels', labels.element);
  const notSet = labels.element.querySelector(`[data-choice="${AROUND}"] .fd-seg-words`) as HTMLElement;

  // ---- together ----
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
  const apart = el('p', { class: 'fd-properties-hint', hidden: '' }, 'These sit in different places. Pick parts of one group to group them.');
  // gap lane: fields picked together, required together.
  const required = severalRequired(el, designer, ids);
  const element = el(
    'div',
    { class: 'fd-props' },
    onTab(el('div', { class: 'fd-prop' }, names), 'layout'),
    widthRow,
    labelsRow,
    onTab(el('div', { class: 'fd-prop' }, el('span', { class: 'fd-prop-name' }, 'Together'), together, apart), 'layout', 'Group these'),
    onTab(el('div', { class: 'fd-props-actions' }, act('Duplicate', () => designer.duplicate([...ids])), act('Delete', () => designer.remove([...ids]), true)), 'layout', 'Duplicate or delete'),
    ...required.rows
  );
  return {
    element,
    update(page) {
      const spots = ids.map((id) => locate(page, id));
      if (spots.some((at) => !at)) return;
      const parts = spots.map((at) => at!);
      required.update(page);
      names.textContent = andList(parts.map((at) => `“${nameOf(page, at.node)}”`));

      const cols = parts.every((at) => SPANNED.has(at.node.type)) ? Math.min(...parts.map((at) => across(page, at.parent))) : 0;
      if (cols !== drawn) {
        drawn = cols;
        width =
          cols > 1
            ? segmented(el, 'Width', Array.from({ length: cols }, (_, i) => ({ value: i + 1, words: i + 1 === cols ? `All ${cols}` : String(i + 1), label: i + 1 === cols ? `All ${cols} columns` : `${i + 1} column${i ? 's' : ''}` })), (n) => {
                if (n !== null) designer.setEach([...ids], { span: n });
              })
            : null;
        widthBox.replaceChildren(...(width ? [width.element] : []));
      }
      width?.set(shared(parts.map((at) => Math.min(spanOf(at.node), cols))));
      widthHint.textContent = cols > 1 ? `Each of the ${parts.length} picked, in the columns where it sits.` : 'A width needs every part picked in a group with columns.';

      labelsRow.hidden = !parts.every((at) => at.node.type === 'field' || isSection(at.node));
      // Where labels sit when none is set: as their groups say, or the page, alike for them all; or not set.
      const around = new Set(parts.map((at) => aroundWords(page, at.node.id)));
      notSet.textContent = around.size === 1 ? [...around][0] : 'Not set';
      labels.set(shared(parts.map((at) => (at.node as { labels?: string }).labels ?? AROUND)));

      // Only parts side by side in one list can be grouped where they are.
      const same = new Set(parts.map((at) => at.parent.id)).size === 1 && parts.every((at) => at.node.type !== 'tab');
      together.hidden = !same;
      apart.hidden = same;
    },
  };
}
