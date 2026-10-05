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

/** How a group folds, in the words the Publish dialog and the canvas say it. */
export const FOLD_WORDS: Record<Fold, string> = { no: 'no longer folds', open: 'folds by its title, starting open', folded: 'folds by its title, starting folded' };

/** Why a group cannot fold: it has no title to fold by. */
export const FOLDS_BY_TITLE = 'A group folds by its title: give it a title first';

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
