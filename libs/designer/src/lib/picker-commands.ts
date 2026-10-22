import type { FieldNode, Page } from '@fieldia/core';
import { findNode } from './page-tree';
import { Refusal } from './refusal';

/**
 * The edits the work tracker's pickers need beyond a widget's plain
 * settings: a link drawn as a path picker, links as a tree to tick, and a state's exact colour for
 * each of its values. Each goes through the designer's `apply`, so it is
 * validated, undone and saved as every other edit is.
 */

export interface PickerCommands {
  /** A link to a record of a tree drawn as its path, "Portal\Sprint 14", with suggestions and the tree; off, a link as before. */
  setPathPicker(id: string, on: boolean): boolean;
  /** Links to several records of a tree drawn as a tree to tick, a branch ticking all under it; off, its tags as before. */
  setCheckTree(id: string, on: boolean): boolean;
  /** A state's dot in an exact colour (#rrggbb) for one value, over its tone; `null` gives it its tone again. */
  setDotColour(id: string, value: string | number, colour: string | null): boolean;
}

const COLOUR = /^#[0-9a-fA-F]{6}$/;

/** A field node's options with some taken away, and none left when none are. */
function without(node: FieldNode, keys: string[]) {
  if (!node.options) return;
  const options = { ...node.options } as Record<string, unknown>;
  for (const key of keys) delete options[key];
  if (Object.keys(options).length) node.options = options as FieldNode['options'];
  else delete node.options;
}

export function pickerCommands({ apply }: { apply(edit: (draft: Page) => void, merge?: string | null): boolean }): PickerCommands {
  return {
    setCheckTree(id, on) {
      return apply((draft) => {
        const found = findNode(draft, id);
        const field = found?.node.type === 'field' ? draft.fields[found.node.field] : undefined;
        if (!found || found.node.type !== 'field' || field?.type !== 'many2many' || (found.node.widget && found.node.widget !== 'tree')) throw new Refusal((w) => w.refusals.onlyLinksTree);
        if (on) found.node.widget = 'tree';
        else {
          delete found.node.widget;
          without(found.node, ['keeps', 'search']);
        }
      });
    },

    setPathPicker(id, on) {
      return apply((draft) => {
        const found = findNode(draft, id);
        const field = found?.node.type === 'field' ? draft.fields[found.node.field] : undefined;
        if (!found || found.node.type !== 'field' || field?.type !== 'many2one' || (found.node.widget && found.node.widget !== 'path')) throw new Refusal((w) => w.refusals.onlyLinkPath);
        if (on) found.node.widget = 'path';
        else {
          delete found.node.widget;
          without(found.node, ['separator', 'suggestions', 'tree']);
        }
      });
    },

    setDotColour(id, value, colour) {
      return apply((draft) => {
        const found = findNode(draft, id);
        if (!found || found.node.type !== 'field' || found.node.widget !== 'dot') throw new Refusal((w) => w.refusals.onlyStateDotColours);
        if (colour !== null && !COLOUR.test(colour)) throw new Refusal((w) => w.refusals.colourAsHex);
        const node = found.node;
        const colours = { ...((node.options?.['colours'] as Record<string, string> | undefined) ?? {}) };
        if (colour) colours[String(value)] = colour.toLowerCase();
        else delete colours[String(value)];
        const options = { ...(node.options ?? {}) } as Record<string, unknown>;
        if (Object.keys(colours).length) options['colours'] = colours;
        else delete options['colours'];
        if (Object.keys(options).length) node.options = options as FieldNode['options'];
        else delete node.options;
      }, `dot-colour:${id}:${value}`);
    },
  };
}
