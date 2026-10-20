import type { SheetNode } from './layout';
import type { HeadTools } from './head-checks';

/**
 * A record's head (`SheetHead`): its kind and number, the band's and the row's fields, its links and buttons, and when
 * it was updated. In the one-tag script they come with the head part, which a sheet with a head asks for: run once it
 * came (later-checks.ts).
 */

const NUMBER = new Set(['integer', 'float', 'monetary']);
/** What a record's number can be: a number, or words such as "BUG-12". */
const NUMBERED = new Set(['integer', 'float', 'char']);
const DATED = new Set(['date', 'datetime']);

/** A sheet's head, each part of it checked with the reference check's tools. */
export function checkSheetHead(sheet: SheetNode, path: string, tools: HeadTools): void {
  const head = sheet.head as NonNullable<SheetNode['head']>;
  const at = `${path}.head`;
  const kind = head.kind;
  if (kind) {
    const def = kind.field !== undefined ? tools.need(kind.field, `${at}.kind.field`) : undefined;
    if (def && def.type !== 'selection' && def.type !== 'many2one') tools.report(`${at}.kind.field`, `"${kind.field}" is a ${def.type}; a kind is a selection or a many2one`);
    if (def?.type === 'selection') {
      const values = new Set(def.options.map((option) => String(option.value)));
      for (const value of Object.keys(kind.looks ?? {})) if (!values.has(value)) tools.report(`${at}.kind.looks.${value}`, `"${value}" is not an option of "${kind.field}"`);
    }
    if (kind.looks && kind.field === undefined) tools.report(`${at}.kind.looks`, 'a look for each kind needs the field that holds the kind');
    if (kind.numberField !== undefined) {
      const number = tools.need(kind.numberField, `${at}.kind.numberField`);
      if (number && !NUMBERED.has(number.type)) tools.report(`${at}.kind.numberField`, `"${kind.numberField}" is a ${number.type}; a record's number is a number or words`);
    }
  }
  head.meta?.forEach((part, i) => {
    const here = `${at}.meta[${i}]`;
    if (part.type === 'field') return tools.walkNode(part, here);
    tools.claim(part.id, here);
    tools.checkModifiers(part, here);
    const def = tools.need(part.field, `${here}.field`);
    if (def && !NUMBER.has(def.type)) tools.report(`${here}.field`, `"${part.field}" is a ${def.type}; a link's words follow a number`);
    if (part.target !== undefined && !tools.isPart(part.target)) tools.report(`${here}.target`, `no part "${part.target}" on this page`);
    if (part.steps) tools.checkSteps(part.steps, `${here}.steps`);
  });
  head.actions?.forEach((button, i) => {
    const here = `${at}.actions[${i}]`;
    tools.claim(button.id, here);
    tools.checkModifiers(button, here);
    tools.checkPress(button, here);
  });
  const band = head.band;
  band?.children.forEach((child, i) => tools.walkNode(child, `${at}.band.children[${i}]`));
  const updated = head.updated;
  if (updated) {
    tools.need(updated.byField, `${at}.updated.byField`);
    const date = tools.need(updated.atField, `${at}.updated.atField`);
    if (date && !DATED.has(date.type)) tools.report(`${at}.updated.atField`, `"${updated.atField}" is a ${date.type}; when it was updated is a date or a datetime`);
    if (updated.opens !== undefined && !tools.isPlace(updated.opens)) tools.report(`${at}.updated.opens`, `no tab "${updated.opens}" on this page`);
  }
}
