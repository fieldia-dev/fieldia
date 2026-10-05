import { ADDRESS_PARTS, type Field, type FieldNode, type Option, type Page } from '@fieldia/core';
import { kindOfField } from './kinds';
import { findNode } from './page-tree';
import { Refusal } from './refusal';

/**
 * The edits the newer kinds of question need beyond words and options: a
 * picture and points for an option, a matrix's rows and columns, the parts
 * an address asks for, and whether pictures take one answer or several.
 * Each goes through the designer's `apply`, so it is validated, undone and
 * saved as every other edit is.
 */

export interface OptionDetails {
  /** A picture's address or data: URI; empty or `null` takes it away. */
  image?: string | null;
  /** Points for a quiz; `null` takes them away. */
  score?: number | null;
  /** What the picture shows, for people who cannot see it; empty or `null` takes it away. */
  alt?: string | null;
  /** Kept in place when the options are shuffled; `null` or false lets it move. */
  fixed?: boolean | null;
}

export interface KindCommandsDeps {
  apply(edit: (draft: Page) => void, merge?: string | null): boolean;
  /** Whether a field is the backend's, whose definition the page does not change. */
  fromModel(name: string): boolean;
}

/** An address's parts, in their order; it asks for the street, city, postcode and country unless it says. */
export { ADDRESS_PARTS };
export const USUAL_ADDRESS = ['street', 'city', 'postcode', 'country'];

/**
 * Labels as options, keeping what answers already use: the same words keep
 * their option, words changed in place keep the value there, and a new one
 * is numbered after the others (`row_3`). Pictures and points stay with the
 * option they belong to.
 */
export function relabel(old: readonly Option[], labels: string[], prefix: string): Option[] {
  const clean = labels.map((label) => label.trim()).filter(Boolean);
  const claimed = new Set<number>();
  // First the same words, wherever they were.
  const kept: (Option | undefined)[] = clean.map((label) => {
    const at = old.findIndex((o, k) => !claimed.has(k) && o.label === label);
    if (at === -1) return undefined;
    claimed.add(at);
    return old[at];
  });
  // Then words changed in place.
  clean.forEach((_, i) => {
    if (kept[i] || i >= old.length || claimed.has(i)) return;
    claimed.add(i);
    kept[i] = old[i];
  });
  const used = new Set(kept.filter((o): o is Option => !!o).map((o) => o.value));
  let next = 1;
  return clean.map((label, i) => {
    const was = kept[i];
    if (was) return { ...was, label };
    while (used.has(`${prefix}_${next}`)) next++;
    const value = `${prefix}_${next}`;
    used.add(value);
    return { value, label };
  });
}

export function kindCommands({ apply, fromModel }: KindCommandsDeps) {
  /** The question's node and its field, when the field is the page's own to change. */
  function question(draft: Page, id: string, owned: (label: string) => string): { node: FieldNode; field: Field } {
    const found = findNode(draft, id);
    if (!found || found.node.type !== 'field') throw new Refusal(`There is no question "${id}"`);
    const node = found.node;
    const field = draft.fields[node.field];
    if (fromModel(node.field)) throw new Refusal(owned(field.label));
    return { node, field };
  }

  return {
    setOptionDetails(id: string, index: number, details: OptionDetails): boolean {
      return apply(
        (draft) => {
          const { field } = question(draft, id, (label) => `The options of ${label} come from the model`);
          // A matrix's columns are its options: each may be worth points, as a choice's options are.
          if (field.type === 'matrix' && details.image !== undefined) throw new Refusal('A matrix’s columns have no pictures');
          if (field.type !== 'selection' && field.type !== 'matrix') throw new Refusal('Only a question with options has pictures and points');
          const option = (field.type === 'matrix' ? field.columns : field.options)[index];
          if (!option) throw new Refusal(`There is no option ${index + 1}`);
          if (details.image !== undefined) {
            if (details.image === null || !details.image.trim()) delete option.image;
            else option.image = details.image.trim();
          }
          if (details.alt !== undefined) {
            if (details.alt === null || !details.alt.trim()) delete option.alt;
            else option.alt = details.alt;
          }
          if (details.fixed !== undefined) {
            if (details.fixed) option.fixed = true;
            else delete option.fixed;
          }
          if (details.score !== undefined) {
            if (details.score === null) delete option.score;
            else if (!Number.isFinite(details.score)) throw new Refusal('Points are a number, such as 1 or 0.5');
            else option.score = details.score;
          }
        },
        // Typing a picture's address or points is one undo step.
        `option:${id}:${index}:${Object.keys(details).join(',')}`
      );
    },

    setMatrixItems(id: string, which: 'rows' | 'columns', labels: string[]): boolean {
      return apply(
        (draft) => {
          const { field } = question(draft, id, (label) => `The ${which} of ${label} come from the model`);
          if (field.type !== 'matrix') throw new Refusal('Only a matrix has rows and columns');
          const items = relabel(field[which], labels, which === 'rows' ? 'row' : 'column');
          if (!items.length) throw new Refusal(`A matrix needs a ${which === 'rows' ? 'row' : 'column'}`);
          field[which] = items;
        },
        `matrix:${id}:${which}:${labels.length}`
      );
    },

    setAddressParts(id: string, parts: string[]): boolean {
      return apply((draft) => {
        const found = findNode(draft, id);
        if (!found || found.node.type !== 'field' || found.node.widget !== 'address') throw new Refusal('Only an address has parts');
        const node = found.node;
        const known = ADDRESS_PARTS.filter((part) => parts.includes(part));
        if (!known.length) throw new Refusal('An address asks for one part at least');
        // The usual four, in their order, is what an address asks for anyway.
        const options = { ...(node.options ?? {}) };
        if (known.join() === USUAL_ADDRESS.join()) delete options['parts'];
        else options['parts'] = known;
        if (Object.keys(options).length) node.options = options;
        else delete node.options;
      });
    },

    setSeveral(id: string, on: boolean): boolean {
      return apply((draft) => {
        const { node, field } = question(draft, id, (label) => `How many answers ${label} takes comes from the model`);
        // A matrix: several columns in a row, or one.
        if (field.type !== 'matrix' && (field.type !== 'selection' || kindOfField(field, node) !== 'image-choice')) throw new Refusal('Only pictures to choose from and a matrix take one answer or several');
        if (on) field.multiple = true;
        else delete field.multiple;
      });
    },
  };
}

export type KindCommands = ReturnType<typeof kindCommands>;
