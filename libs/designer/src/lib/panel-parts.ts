import type { LabelPlace } from '@fieldia/core';
import type { ElementFactory } from './chrome';
import type { Designer } from './designer';
import { SPANNED } from './layout-ops';
import { across, isSection, locate, nameOf, spanOf } from './layout-tree';
import { onTab, segmented, setting } from './panel-controls';
import { blockContent } from './panel-block';
import { aroundWords, widthSetting } from './panel-layout';
import { severalRequired } from './panel-several-required';
import type { PropertiesView } from './screen-properties';

/**
 * The views of a block between fields — words, a heading, a button, an
 * image, a line or room — and of several parts picked at once.
 */


export function blockProperties(el: ElementFactory, designer: Designer, id: string): PropertiesView {
  const w = designer.words.panel;
  const about = el('p', { class: 'fd-properties-hint' });
  const duplicate = el('button', { type: 'button', class: 'fd-button' }, w.duplicate);
  duplicate.addEventListener('click', () => designer.duplicate([id]));
  const remove = el('button', { type: 'button', class: 'fd-button fd-button-danger' }, w.delete);
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
      const said: Record<string, string> = w.about;
      about.textContent = node.type === 'text' && node.style === 'heading' ? w.about.heading : (said[node.type] ?? '');
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
  const words = designer.words;
  const w = words.panel;
  const names = el('p', { class: 'fd-properties-hint' });

  // ---- how wide each is: no wider than the narrowest place among them ----
  let drawn = 0;
  let width: ReturnType<typeof segmented<number>> | null = null;
  const widthBox = el('div', { class: 'fd-insp-width' });
  const widthHint = el('p', { class: 'fd-properties-hint fd-set-hint' });
  const widthRow = setting(el, 'layout', 'Width', widthBox, { hint: widthHint, words: w.width });

  // ---- where their labels sit ----
  const AROUND = 'around';
  const labels = segmented<string>(
    el,
    w.labels,
    [
      { value: AROUND, words: w.notSet, title: w.notSetTitle },
      { value: 'above', words: w.above },
      { value: 'beside', words: w.beside },
      { value: 'hidden', words: w.inBox, title: w.inBoxTitle },
    ],
    (value) => designer.setEach([...ids], { labels: value === AROUND || value === null ? null : (value as LabelPlace) })
  );
  const labelsRow = setting(el, 'layout', 'Labels', labels.element, { words: w.labels });
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
    act(w.groupThese, () => designer.wrap([...ids], 'group')),
    act(w.sideBySide, () => designer.wrap([...ids], 'side')),
    act(w.makeTabs, () => designer.wrap([...ids], 'tabs'))
  );
  const apart = el('p', { class: 'fd-properties-hint', hidden: '' }, w.apart);
  // gap lane: fields picked together, required together.
  const required = severalRequired(el, designer, ids);
  const element = el(
    'div',
    { class: 'fd-props' },
    onTab(el('div', { class: 'fd-prop' }, names), 'layout'),
    widthRow,
    labelsRow,
    onTab(el('div', { class: 'fd-prop' }, el('span', { class: 'fd-prop-name' }, w.together), together, apart), 'layout', 'Group these'),
    onTab(el('div', { class: 'fd-props-actions' }, act(w.duplicate, () => designer.duplicate([...ids])), act(w.delete, () => designer.remove([...ids]), true)), 'layout', 'Duplicate or delete'),
    ...required.rows
  );
  return {
    element,
    update(page) {
      const spots = ids.map((id) => locate(page, id));
      if (spots.some((at) => !at)) return;
      const parts = spots.map((at) => at!);
      required.update(page);
      names.textContent = words.parts.and(parts.map((at) => words.parts.quote(nameOf(page, at.node, words))));

      const cols = parts.every((at) => SPANNED.has(at.node.type)) ? Math.min(...parts.map((at) => across(page, at.parent))) : 0;
      if (cols !== drawn) {
        drawn = cols;
        width =
          cols > 1
            ? segmented(el, w.width, Array.from({ length: cols }, (_, i) => ({ value: i + 1, words: i + 1 === cols ? w.all(cols) : String(i + 1), label: i + 1 === cols ? w.allColumns(cols) : w.columnCount(i + 1) })), (n) => {
                if (n !== null) designer.setEach([...ids], { span: n });
              })
            : null;
        widthBox.replaceChildren(...(width ? [width.element] : []));
      }
      width?.set(shared(parts.map((at) => Math.min(spanOf(at.node), cols))));
      widthHint.textContent = cols > 1 ? w.eachPicked(parts.length) : w.widthNeedsGroup;

      labelsRow.hidden = !parts.every((at) => at.node.type === 'field' || isSection(at.node));
      // Where labels sit when none is set: as their groups say, or the page, alike for them all; or not set.
      const around = new Set(parts.map((at) => aroundWords(page, at.node.id, words)));
      notSet.textContent = around.size === 1 ? [...around][0] : w.notSet;
      labels.set(shared(parts.map((at) => (at.node as { labels?: string }).labels ?? AROUND)));

      // Only parts side by side in one list can be grouped where they are.
      const same = new Set(parts.map((at) => at.parent.id)).size === 1 && parts.every((at) => at.node.type !== 'tab');
      together.hidden = !same;
      apart.hidden = same;
    },
  };
}
