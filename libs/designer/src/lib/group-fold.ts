import type { Page, SectionNode } from '@fieldia/core';
import { isSection, nodeOf } from './layout-tree';
import { Refusal } from './refusal';

/**
 * A group that folds by its title, as the format's `collapsible` and
 * `collapsed` say it: not at all, starting open, or starting folded. A group
 * with no title has nothing to fold by, so it is refused one, and a group
 * that folds keeps its title.
 */

export type Fold = 'no' | 'open' | 'folded';

/** How a group folds now. */
export const foldOf = (section: SectionNode): Fold => (!section.collapsible ? 'no' : section.collapsed ? 'folded' : 'open');

export function setFold(page: Page, id: string, fold: Fold): void {
  const section = nodeOf(page, id);
  if (!isSection(section)) throw new Refusal((w) => w.layout.onlyGroupFolds);
  delete section.collapsed;
  if (fold === 'no') {
    delete section.collapsible;
    return;
  }
  if (!section.title?.trim()) throw new Refusal((w) => w.layout.foldsByTitle);
  section.collapsible = true;
  if (fold === 'folded') section.collapsed = true;
}
