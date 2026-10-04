import type { LabelPlace, Page } from '@fieldia/core';
import { isSection, locate } from './layout-tree';
import { setColspan, setFieldLabels, setSectionLook } from './layout-settings';
import { Refusal } from './refusal';

/**
 * Several parts picked, changed at once as one edit: how wide each is where
 * it sits, and where each one's labels sit. When one of them cannot take the
 * change, none of them changes, and the refusal says why.
 */

/** A change for every part picked; `labels: null` gives them back to what is round them. */
export interface EachChange {
  span?: number;
  labels?: LabelPlace | null;
}

const NOUNS: Record<string, string> = { divider: 'A divider', text: 'Words', button: 'A button', spacer: 'A spacer', image: 'An image', tabs: 'Tabs', tab: 'A tab', slot: 'The app’s own part' };

export function setEach(page: Page, ids: readonly string[], change: EachChange): void {
  if (!ids.length) throw new Refusal('Pick the parts to change first');
  for (const id of ids) {
    const at = locate(page, id);
    if (!at) throw new Refusal(`There is no part “${id}”`);
    if (change.span !== undefined) setColspan(page, id, change.span);
    if (change.labels === undefined) continue;
    if (at.node.type === 'field') setFieldLabels(page, id, change.labels);
    else if (isSection(at.node)) setSectionLook(page, id, { labels: change.labels });
    else throw new Refusal(`${NOUNS[at.node.type] ?? 'It'} has no labels to place`);
  }
}
