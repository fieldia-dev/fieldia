import type { Field, FieldNode, LabelPlace, Page } from '@fieldia/core';
import type { DesignerWords } from './designer-words';
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
  if (!ids.length) throw new Refusal((w) => w.layout.pickFirst);
  const noun = (type: string) => (w: DesignerWords) => (type === 'field' ? w.layout.it : (w.layout.nouns[type] ?? w.layout.it));
  for (const id of ids) {
    const at = locate(page, id);
    if (!at) throw new Refusal((w) => w.layout.noPart(id));
    if (change.span !== undefined) setColspan(page, id, change.span);
    if (change.required !== undefined) {
      if (at.node.type !== 'field') throw new Refusal((w) => w.layout.notAnswered(noun(at.node.type)(w)));
      setRequired(page, at.node, change.required, fromModel);
    }
    if (change.labels === undefined) continue;
    if (at.node.type === 'field') setFieldLabels(page, id, change.labels);
    else if (isSection(at.node)) setSectionLook(page, id, { labels: change.labels });
    else throw new Refusal((w) => w.layout.noLabels(noun(at.node.type)(w)));
  }
}
