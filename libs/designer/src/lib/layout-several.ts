import type { Field, FieldNode, LabelPlace, Page } from '@fieldia/core';
import { isSection, locate } from './layout-tree';
import { setColspan, setFieldLabels, setSectionLook } from './layout-settings';
import { Refusal } from './refusal';

/**
 * Several parts picked, changed at once as one edit: how wide each is where
 * it sits, where each one's labels sit, and whether fields are required.
 * When one of them cannot take the change, none of them changes, and the
 * refusal says why.
 */

/** A change for every part picked; `labels: null` gives them back to what is round them. */
export interface EachChange {
  span?: number;
  labels?: LabelPlace | null;
  /** Required always, or not: a rule for when each is required goes. A field the model requires stays required. */
  required?: boolean;
}

const NOUNS: Record<string, string> = { section: 'A group', divider: 'A divider', text: 'Words', button: 'A button', spacer: 'A spacer', image: 'An image', tabs: 'Tabs', tab: 'A tab', slot: 'The app’s own part' };

/**
 * A field required always, or not, as its own Required does: a rule for when
 * it is required goes; a field of the model is required on its place on the
 * page, and one the model requires stays so.
 */
function setRequired(page: Page, node: FieldNode, on: boolean, fromModel: (name: string) => boolean): void {
  delete node.required;
  if (fromModel(node.field)) {
    if (on) node.required = true;
    return;
  }
  const field = page.fields[node.field] as Field & { required?: boolean };
  if (on) field.required = true;
  else delete field.required;
}

export function setEach(page: Page, ids: readonly string[], change: EachChange, fromModel: (name: string) => boolean = () => false): void {
  if (!ids.length) throw new Refusal('Pick the parts to change first');
  for (const id of ids) {
    const at = locate(page, id);
    if (!at) throw new Refusal(`There is no part “${id}”`);
    if (change.span !== undefined) setColspan(page, id, change.span);
    if (change.required !== undefined) {
      if (at.node.type !== 'field') throw new Refusal(`${NOUNS[at.node.type] ?? 'It'} is not answered: only fields are required`);
      setRequired(page, at.node, change.required, fromModel);
    }
    if (change.labels === undefined) continue;
    if (at.node.type === 'field') setFieldLabels(page, id, change.labels);
    else if (isSection(at.node)) setSectionLook(page, id, { labels: change.labels });
    else throw new Refusal(`${NOUNS[at.node.type] ?? 'It'} has no labels to place`);
  }
}
