import type { Field, Page } from '@fieldia/core';
import { prefixOf, namer } from './layout-ops';
import { find, isWrapper, listOf, type Holder, type Part } from './layout-tree';
import { remapReferences } from './clipboard-names';
import { partsInOrder, putNewParts } from './outline-moves';
import { Refusal } from './refusal';

/**
 * Copying parts and pasting them, in one designer or another, through the
 * system clipboard. What is copied is JSON: the parts picked (a group with
 * everything in it) and the definitions of their fields. A paste goes after
 * the part picked last, or into the group, tab or page picked, or at the end;
 * its parts get ids of their own, and each field keeps its name unless the
 * page (or the backend's model) has that name already, when it takes a free
 * one. Rules and worked-out values inside read the pasted fields' names; one
 * that reads a field the page has not got is left off (clipboard-names.ts).
 */

/** What a copy of Fieldia parts says it is. */
export const FIELDIA_PARTS = 'fieldia-parts';
/** The clipboard's type for them; a copy carries the same JSON as plain text too. */
export const FIELDIA_MIME = 'application/vnd.fieldia.parts+json';

export interface CopiedParts {
  fieldia: typeof FIELDIA_PARTS;
  version: 1;
  parts: Part[];
  fields: Record<string, Field>;
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

/** The fields a part shows, however deep. */
function fieldsOf(part: Part, into: string[] = []): string[] {
  if (part.type === 'field' && !into.includes(part.field)) into.push(part.field);
  for (const child of listOf(part) ?? []) fieldsOf(child, into);
  return into;
}

/** The parts as JSON for the clipboard; null when none of them is a part of the page. */
export function copyParts(page: Page, ids: string[]): string | null {
  const spots = partsInOrder(page, ids);
  if (!spots.length) return null;
  const parts = spots.map((s) => clone(s.node));
  const fields: Record<string, Field> = {};
  for (const name of parts.flatMap((p) => fieldsOf(p))) if (page.fields[name]) fields[name] = clone(page.fields[name]);
  const copied: CopiedParts = { fieldia: FIELDIA_PARTS, version: 1, parts, fields };
  return JSON.stringify(copied);
}

/** Fieldia parts read from the clipboard's words; null when they are not. */
export function readParts(text: string): CopiedParts | null {
  let read: unknown;
  try {
    read = JSON.parse(text);
  } catch {
    return null;
  }
  const copied = read as Partial<CopiedParts> | null;
  if (!copied || copied.fieldia !== FIELDIA_PARTS || !Array.isArray(copied.parts) || !copied.parts.length || typeof copied.fields !== 'object' || !copied.fields) return null;
  if (!copied.parts.every((p) => !!p && typeof p.id === 'string' && typeof p.type === 'string')) return null;
  return copied as CopiedParts;
}

/** Where a paste goes: into the group, tab or page picked last, after the part picked last, or at the end. */
function pasteWhere(page: Page, picked: string[], copied: CopiedParts): { parent: string; index: number } {
  const root = page.layout as Holder;
  const steps = root.type === 'wizard' ? (root.children as Holder[]) : null;
  const target = partsInOrder(page, picked).pop() ?? null;
  const kind = copied.parts[0].type as string;
  if (kind === 'tab') {
    if (target?.node.type === 'tab') return { parent: target.parent.id, index: target.index + 1 };
    if (target?.node.type === 'tabs') return { parent: target.node.id, index: target.node.children.length };
  }
  if (steps && kind === 'step') {
    // Pages go among the pages: after the page picked, or the page of the question picked.
    const step = target ? steps.findIndex((s) => s.id === target.node.id || !!find(s, target.node.id)) : -1;
    return { parent: root.id, index: step === -1 ? steps.length : step + 1 };
  }
  if (!target) {
    const last = steps?.[steps.length - 1];
    return last ? { parent: last.id, index: last.children.length } : { parent: root.id, index: root.children.length };
  }
  const node = target.node as Part | Holder;
  const holds = (node.type === 'section' && !isWrapper(node)) || node.type === 'tab' || (node.type as string) === 'step';
  if (holds) return { parent: node.id, index: (node as Holder).children.length };
  return { parent: target.parent.id, index: target.index + 1 };
}

/** A name for a pasted field: its own, unless taken; else the first free of name_2, name_3… */
function freeName(name: string, taken: (name: string) => boolean): string {
  if (!taken(name)) return name;
  const base = name.replace(/_\d+$/, '') || name;
  for (let n = 2; ; n++) if (!taken(`${base}_${n}`)) return `${base}_${n}`;
}

/** Paste the parts the clipboard's words hold where `pasteWhere` says. Returns them, and how many rules were left off. */
export function pasteParts(page: Page, text: string, picked: string[], context: { model: Record<string, Field> }): { ids: string[]; dropped: number } {
  const copied = readParts(text);
  if (!copied) throw new Refusal('There are no Fieldia parts to paste: copy parts in a Fieldia designer first');
  if (page.layout.type === 'list') throw new Refusal('A list takes columns, not parts: paste them on a screen or a survey');
  const pages = copied.parts.filter((p) => (p.type as string) === 'step').length;
  if (pages && pages !== copied.parts.length) throw new Refusal('Paste pages or questions, not both at once');
  if (pages && page.layout.type !== 'wizard') throw new Refusal('A survey’s pages go in a survey');
  const where = pasteWhere(page, picked, copied);
  // Each field under its own name, or a free one: never one the page or the backend's model has.
  const names = new Map<string, string>();
  const taken = (name: string) => name in page.fields || Object.prototype.hasOwnProperty.call(context.model, name) || [...names.values()].includes(name);
  for (const name of Object.keys(copied.fields)) names.set(name, freeName(name, taken));
  const fields: Record<string, Field> = {};
  for (const [name, def] of Object.entries(copied.fields)) fields[names.get(name) as string] = clone(def);
  Object.assign(page.fields, fields);
  // Ids of their own, and the fields under their names.
  const name = namer(page);
  const renew = (part: Part): Part => {
    part.id = name(prefixOf(part));
    if (part.type === 'field') part.field = names.get(part.field) ?? part.field;
    for (const child of listOf(part) ?? []) renew(child);
    return part;
  };
  const parts = clone(copied.parts).map(renew);
  const dropped = remapReferences(parts, fields, names, (field) => field in page.fields);
  return { ids: putNewParts(page, parts, where.parent, where.index), dropped };
}
