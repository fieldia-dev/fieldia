import type { Field, ListDetail, ListNode, Page } from '@fieldia/core';
import { Refusal } from './refusal';

/** A list's rows a person works in, as `setListOptions` takes them. */
export interface ListWorkPatch {
  /** What a row opens to in place: its record's lines (`lines`, a table of lines of the page's) or the records pointing at it; null for nothing. */
  detail?: ListDetail | null;
}

/** The lines' fields a row opening to them shows at first: the plain ones a person reads, five of them, never their order or kind. */
export function detailColumns(lines: Field): string[] {
  if (lines.type !== 'one2many') return [];
  const kinds = lines.lineKinds?.field;
  return Object.entries(lines.fields)
    .filter(([name, def]) => name !== lines.sequenceField && name !== kinds && def.type !== 'one2many' && def.type !== 'binary' && def.type !== 'image' && def.type !== 'json' && def.type !== 'html')
    .slice(0, 5)
    .map(([name]) => name);
}

/**
 * A list's rows a person works in, set as asked: what a row opens to — a table of lines of the page's, whose columns are
 * its fields (refused in words otherwise), or the records pointing at it, whose model and fields the page check reads.
 */
export function setListWork(list: ListNode, options: ListWorkPatch, draft: Page, fieldFor: (draft: Page, name: string) => Field): void {
  if (options.detail === null) delete list.detail;
  else if (options.detail !== undefined) {
    const detail = options.detail;
    if (detail.lines !== undefined) {
      const def = fieldFor(draft, detail.lines);
      if (def.type !== 'one2many') throw new Refusal((w) => w.refusals.detailNotLines(def.label));
      for (const name of detail.columns) if (!def.fields[name]) throw new Refusal((w) => w.refusals.detailNoLineField(def.label, name));
    }
    list.detail = JSON.parse(JSON.stringify(detail)) as ListDetail;
  }
}
