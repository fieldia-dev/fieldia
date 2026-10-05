import type { Field, FieldNode, Page } from '@fieldia/core';
import { kindOfField } from './kinds';
import { findNode } from './page-tree';
import { Refusal } from './refusal';

/**
 * The edits the choice kinds need beyond their options' words: an option
 * moved to another place, "None of these" added, a picture uploaded, answers
 * of one's own allowed, a matrix's column taken once, and a yes or no shown
 * as buttons or a switch. Each goes through the designer's `apply`, so it is
 * validated, undone and saved as every other edit is.
 */

export interface ChoiceCommandsDeps {
  apply(edit: (draft: Page) => void, merge?: string | null): boolean;
  /** Whether a field is the backend's, whose definition the page does not change. */
  fromModel(name: string): boolean;
}

/** The largest picture an option takes, as uploaded: 5 MB. */
export const LARGEST_PICTURE = 5 * 1024 * 1024;

export interface ChoiceCommands {
  /** An option moved from one place to another; its value, picture and points go with it. */
  moveOption(id: string, from: number, to: number): boolean;
  /** "None of these" after the options: it goes alone, clearing the others when picked. */
  addNoneOption(id: string, label?: string): boolean;
  /** A picture for an option from the person's computer, as a data: address, refused over 5 MB (`bytes` is the file's own size). */
  setOptionPicture(id: string, index: number, picture: { src: string; bytes: number }): boolean;
  /** Tags people may add of their own, besides the options. */
  setOwnAnswers(id: string, on: boolean): boolean;
  /** A matrix whose columns each go in one row only. */
  setOnePerColumn(id: string, on: boolean): boolean;
  /** A yes or no as two buttons, nothing picked until one is, or as a switch. */
  setYesNoLook(id: string, look: 'buttons' | 'switch'): boolean;
}

const megabytes = (bytes: number) => `${Math.round((bytes / 1024 / 1024) * 10) / 10} MB`;

export function choiceCommands({ apply, fromModel }: ChoiceCommandsDeps): ChoiceCommands {
  /** The question's node and its field, when the field is the page's own to change. */
  function question(draft: Page, id: string, owned: string): { node: FieldNode; field: Field } {
    const found = findNode(draft, id);
    if (!found || found.node.type !== 'field') throw new Refusal(`There is no question "${id}"`);
    const field = draft.fields[found.node.field];
    if (fromModel(found.node.field)) throw new Refusal(`${owned} of ${field.label} comes from the model`);
    return { node: found.node, field };
  }
  const choice = (draft: Page, id: string, owned: string) => {
    const { node, field } = question(draft, id, owned);
    if (field.type !== 'selection') throw new Refusal('Only a question with options has these');
    return { node, field };
  };

  return {
    moveOption(id, from, to) {
      return apply((draft) => {
        const { field } = choice(draft, id, 'The order of the options');
        if (!field.options[from] || to < 0 || to >= field.options.length) throw new Refusal('An option moves among the others');
        const [option] = field.options.splice(from, 1);
        field.options.splice(to, 0, option);
      });
    },

    addNoneOption(id, label = 'None of these') {
      return apply((draft) => {
        const { node, field } = choice(draft, id, 'The options');
        if (!field.multiple || kindOfField(field, node) !== 'checkboxes') throw new Refusal('Only checkboxes take “None of these”');
        if (field.options.some((o) => o.exclusive)) throw new Refusal(`${field.label} has an option that goes alone already`);
        const values = new Set(field.options.map((o) => String(o.value)));
        let value = 'none';
        for (let n = 2; values.has(value); n++) value = `none_${n}`;
        field.options.push({ value, label, exclusive: true });
      });
    },

    setOptionPicture(id, index, { src, bytes }) {
      return apply((draft) => {
        const { field } = choice(draft, id, 'The pictures');
        const option = field.options[index];
        if (!option) throw new Refusal(`There is no option ${index + 1}`);
        if (bytes > LARGEST_PICTURE) throw new Refusal(`A picture is 5 MB at most: this one is ${megabytes(bytes)}`);
        if (!src.startsWith('data:image/')) throw new Refusal('That file is not a picture');
        option.image = src;
      });
    },

    setOwnAnswers(id, on) {
      return apply((draft) => {
        const { node, field } = choice(draft, id, 'Whether people add their own');
        if (kindOfField(field, node) !== 'tags') throw new Refusal('Only tags take answers of one’s own');
        if (on) field.ownAnswers = true;
        else delete field.ownAnswers;
      });
    },

    setOnePerColumn(id, on) {
      return apply((draft) => {
        const { field } = question(draft, id, 'How the columns are taken');
        if (field.type !== 'matrix') throw new Refusal('Only a matrix has columns to take once');
        if (on) field.onePerColumn = true;
        else delete field.onePerColumn;
      });
    },

    setYesNoLook(id, look) {
      return apply((draft) => {
        const found = findNode(draft, id);
        if (!found || found.node.type !== 'field' || draft.fields[found.node.field].type !== 'boolean' || found.node.widget === 'tick') throw new Refusal('Only a yes or no shows as buttons or a switch');
        const node = found.node;
        const field = draft.fields[node.field];
        node.widget = look === 'buttons' ? 'buttons' : 'toggle';
        // Buttons start with neither picked: the page's own field starts empty, not "no".
        if (look === 'buttons' && field.default === undefined && !fromModel(node.field)) field.default = null;
        if (look === 'switch' && node.options) {
          delete node.options['yesLabel'];
          delete node.options['noLabel'];
          if (!Object.keys(node.options).length) delete node.options;
        }
      });
    },
  };
}
