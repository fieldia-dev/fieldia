import type { Field, FieldNode, Page, Tone } from '@fieldia/core';
import { kindOfField } from './kinds';
import { findNode } from './page-tree';
import { Refusal } from './refusal';
import type { DesignerWords } from './designer-words';

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
  /** The designer's words, for an option it writes. */
  words: DesignerWords;
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
  /** One choice of a list drawn as a coloured badge, as Flectra's widget="badge", or back as a dropdown. */
  setBadge(id: string, on: boolean): boolean;
  /** A badge's colour for one option's value; `null` leaves it grey. */
  setBadgeTone(id: string, value: string | number, tone: Tone | null): boolean;
}

const megabytes = (bytes: number) => Math.round((bytes / 1024 / 1024) * 10) / 10;

/** What the model keeps of a field, in words: "The options of Status come from the model". */
type Owned = (w: DesignerWords, label: string) => string;

export function choiceCommands({ apply, fromModel, words }: ChoiceCommandsDeps): ChoiceCommands {
  /** The question's node and its field, when the field is the page's own to change. */
  function question(draft: Page, id: string, owned: Owned): { node: FieldNode; field: Field } {
    const found = findNode(draft, id);
    if (!found || found.node.type !== 'field') throw new Refusal((w) => w.refusals.noQuestion(id));
    const field = draft.fields[found.node.field];
    if (fromModel(found.node.field)) throw new Refusal((w) => owned(w, field.label));
    return { node: found.node, field };
  }
  const choice = (draft: Page, id: string, owned: Owned) => {
    const { node, field } = question(draft, id, owned);
    if (field.type !== 'selection') throw new Refusal((w) => w.refusals.onlyOptions);
    return { node, field };
  };

  return {
    moveOption(id, from, to) {
      return apply((draft) => {
        const { field } = choice(draft, id, (w, label) => w.refusals.orderFromModel(label));
        if (!field.options[from] || to < 0 || to >= field.options.length) throw new Refusal((w) => w.refusals.optionMoves);
        const [option] = field.options.splice(from, 1);
        field.options.splice(to, 0, option);
      });
    },

    addNoneOption(id, label = words.defaults.noneOfThese) {
      return apply((draft) => {
        const { node, field } = choice(draft, id, (w, label) => w.refusals.theOptionsFromModel(label));
        if (!field.multiple || kindOfField(field, node) !== 'checkboxes') throw new Refusal((w) => w.refusals.onlyCheckboxesNone);
        if (field.options.some((o) => o.exclusive)) throw new Refusal((w) => w.refusals.goesAloneAlready(field.label));
        const values = new Set(field.options.map((o) => String(o.value)));
        let value = 'none';
        for (let n = 2; values.has(value); n++) value = `none_${n}`;
        field.options.push({ value, label, exclusive: true });
      });
    },

    setOptionPicture(id, index, { src, bytes }) {
      return apply((draft) => {
        const { field } = choice(draft, id, (w, label) => w.refusals.picturesFromModel(label));
        const option = field.options[index];
        if (!option) throw new Refusal((w) => w.refusals.noOption(index + 1));
        if (bytes > LARGEST_PICTURE) throw new Refusal((w) => w.refusals.pictureTooBig(w.refusals.megabytes(megabytes(bytes))));
        if (!src.startsWith('data:image/')) throw new Refusal((w) => w.refusals.notAPicture);
        option.image = src;
      });
    },

    setOwnAnswers(id, on) {
      return apply((draft) => {
        const { node, field } = choice(draft, id, (w, label) => w.refusals.ownAnswersFromModel(label));
        if (kindOfField(field, node) !== 'tags') throw new Refusal((w) => w.refusals.onlyTagsOwn);
        if (on) field.ownAnswers = true;
        else delete field.ownAnswers;
      });
    },

    setOnePerColumn(id, on) {
      return apply((draft) => {
        const { field } = question(draft, id, (w, label) => w.refusals.columnsTakenFromModel(label));
        if (field.type !== 'matrix') throw new Refusal((w) => w.refusals.onlyMatrixOnce);
        if (on) field.onePerColumn = true;
        else delete field.onePerColumn;
      });
    },

    setYesNoLook(id, look) {
      return apply((draft) => {
        const found = findNode(draft, id);
        if (!found || found.node.type !== 'field' || draft.fields[found.node.field].type !== 'boolean' || found.node.widget === 'tick') throw new Refusal((w) => w.refusals.onlyYesNoLook);
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

    setBadge(id, on) {
      return apply((draft) => {
        const found = findNode(draft, id);
        const field = found?.node.type === 'field' ? draft.fields[found.node.field] : undefined;
        if (!found || found.node.type !== 'field' || field?.type !== 'selection' || field.multiple || (found.node.widget && found.node.widget !== 'badge')) throw new Refusal((w) => w.refusals.onlyOneChoiceBadge);
        const node = found.node;
        if (on) node.widget = 'badge';
        else {
          delete node.widget;
          if (node.options) {
            delete node.options['tones'];
            if (!Object.keys(node.options).length) delete node.options;
          }
        }
      });
    },

    setBadgeTone(id, value, tone) {
      return apply((draft) => {
        const found = findNode(draft, id);
        if (!found || found.node.type !== 'field' || found.node.widget !== 'badge') throw new Refusal((w) => w.refusals.onlyOneChoiceBadge);
        const node = found.node;
        const tones = { ...((node.options?.['tones'] as Record<string, string> | undefined) ?? {}) };
        if (tone) tones[String(value)] = tone;
        else delete tones[String(value)];
        const options = { ...(node.options ?? {}) } as Record<string, unknown>;
        if (Object.keys(tones).length) options['tones'] = tones;
        else delete options['tones'];
        if (Object.keys(options).length) node.options = options as FieldNode['options'];
        else delete node.options;
      });
    },
  };
}
