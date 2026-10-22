import { ADDRESS_PARTS, type Field, type FieldNode, type Option, type Page, type SelectionOption } from '@fieldia/core';
import { kindOfField } from './kinds';
import { findNode } from './page-tree';
import { Refusal } from './refusal';
import type { DesignerWords } from './designer-words';

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
  /** A choice's option hidden while this condition holds (its `invisible`); `null` shows it always. */
  invisible?: string | null;
  /** How many may choose it, its places left shown once the app counts them; `null` takes them away. */
  seats?: number | null;
  /** A second line under its words; empty or `null` takes it away. */
  caption?: string | null;
  /** An icon beside its words, by name; empty or `null` takes it away. */
  icon?: string | null;
  /** Its colour, as #rrggbb; `null` takes it away. */
  color?: string | null;
  /** A right answer of a quiz's question (`correct`); false or `null` takes it away. */
  correct?: boolean | null;
}

/** A quiz's question's own settings (its field's `quiz`): each `null` (or empty) takes that one away, the setting going with the last. */
export interface QuizQuestionPatch {
  /** What a right answer earns. */
  points?: number | null;
  /** The answers a question typed takes: words, or numbers for a number. */
  answers?: (string | number)[] | null;
  /** Said under it in the results when right, and when wrong. */
  right?: string | null;
  wrong?: string | null;
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
  function question(draft: Page, id: string, owned: (w: DesignerWords, label: string) => string): { node: FieldNode; field: Field } {
    const found = findNode(draft, id);
    if (!found || found.node.type !== 'field') throw new Refusal((w) => w.refusals.noQuestion(id));
    const node = found.node;
    const field = draft.fields[node.field];
    if (fromModel(node.field)) throw new Refusal((w) => owned(w, field.label));
    return { node, field };
  }

  return {
    setOptionDetails(id: string, index: number, details: OptionDetails): boolean {
      return apply(
        (draft) => {
          const { field } = question(draft, id, (w, label) => w.refusals.optionsFromModel(label));
          // A matrix's columns are its options: each may be worth points, as a choice's options are.
          if (field.type === 'matrix' && details.image !== undefined) throw new Refusal((w) => w.refusals.matrixNoPictures);
          if (field.type !== 'selection' && field.type !== 'matrix') throw new Refusal((w) => w.refusals.onlyOptionsPictures);
          const option = (field.type === 'matrix' ? field.columns : field.options)[index];
          if (!option) throw new Refusal((w) => w.refusals.noOption(index + 1));
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
          if (details.invisible !== undefined) {
            if (field.type !== 'selection') throw new Refusal((w) => w.refusals.onlyChoiceOptionWhen);
            if (details.invisible === null || !details.invisible.trim()) delete (option as SelectionOption).invisible;
            else (option as SelectionOption).invisible = details.invisible.trim();
          }
          if (details.score !== undefined) {
            if (details.score === null) delete option.score;
            else if (!Number.isFinite(details.score)) throw new Refusal((w) => w.refusals.pointsNumber);
            else option.score = details.score;
          }
          // What a choice's option says beside its words: a second line, an icon, a colour.
          for (const key of ['caption', 'icon', 'color'] as const) {
            const value = details[key];
            if (value === undefined) continue;
            if (field.type !== 'selection') throw new Refusal((w) => w.refusals.looksForChoices);
            if (key === 'color' && value !== null && !/^#[0-9a-fA-F]{6}$/.test(value)) throw new Refusal((w) => w.refusals.colourHex);
            if (value === null || !value.trim()) delete (option as Option)[key];
            else (option as Option)[key] = key === 'caption' ? value : value.trim();
          }
          // A right answer: a choice's option; a matrix's columns are marked by their points.
          if (details.correct !== undefined) {
            if (field.type !== 'selection') throw new Refusal((w) => w.refusals.rightAnswersForChoices);
            if (details.correct) (option as Option).correct = true;
            else delete (option as Option).correct;
          }
          // A choice's places: a matrix's columns are no choice of seats.
          if (details.seats !== undefined) {
            if (field.type !== 'selection') throw new Refusal((w) => w.refusals.seatsForChoices);
            if (details.seats === null) delete (option as Option).seats;
            else if (!Number.isInteger(details.seats) || details.seats < 0) throw new Refusal((w) => w.refusals.seatsNumber);
            else (option as Option).seats = details.seats;
          }
        },
        // Typing a picture's address or points is one undo step.
        `option:${id}:${index}:${Object.keys(details).join(',')}`
      );
    },

    setQuizQuestion(id: string, patch: QuizQuestionPatch): boolean {
      return apply(
        (draft) => {
          const { field } = question(draft, id, (w, label) => w.refusals.optionsFromModel(label));
          const typed = field.type === 'char' || field.type === 'integer' || field.type === 'float';
          if (field.type !== 'selection' && !typed) throw new Refusal((w) => w.refusals.answersForTyped);
          const quiz: { points?: number; answers?: (string | number)[]; feedback?: { right?: string; wrong?: string } } = JSON.parse(JSON.stringify((field as { quiz?: object }).quiz ?? {}));
          if (patch.points !== undefined) {
            if (patch.points === null) delete quiz.points;
            else if (!Number.isFinite(patch.points) || patch.points <= 0) throw new Refusal((w) => w.refusals.pointsNumber);
            else quiz.points = patch.points;
          }
          if (patch.answers !== undefined) {
            const answers = (patch.answers ?? []).filter((answer) => (typeof answer === 'number' ? Number.isFinite(answer) : answer.trim() !== ''));
            if (answers.length && !typed) throw new Refusal((w) => w.refusals.answersForTyped);
            if (answers.length && field.type !== 'char' && answers.some((answer) => typeof answer !== 'number')) throw new Refusal((w) => w.refusals.answersNumbers);
            if (answers.length) quiz.answers = answers.map((answer) => (typeof answer === 'string' ? answer.trim() : answer));
            else delete quiz.answers;
          }
          for (const side of ['right', 'wrong'] as const) {
            const words = patch[side];
            if (words === undefined) continue;
            const feedback = { ...(quiz.feedback ?? {}) };
            if (words === null || !words.trim()) delete feedback[side];
            else feedback[side] = words;
            if (Object.keys(feedback).length) quiz.feedback = feedback;
            else delete quiz.feedback;
          }
          if (Object.keys(quiz).length) (field as { quiz?: object }).quiz = quiz;
          else delete (field as { quiz?: object }).quiz;
        },
        `quiz:${id}:${Object.keys(patch).join(',')}`
      );
    },

    setMatrixItems(id: string, which: 'rows' | 'columns', labels: string[]): boolean {
      return apply(
        (draft) => {
          const { field } = question(draft, id, (w, label) => (which === 'rows' ? w.refusals.rowsFromModel(label) : w.refusals.matrixColumnsFromModel(label)));
          if (field.type !== 'matrix') throw new Refusal((w) => w.refusals.onlyMatrix);
          const items = relabel(field[which], labels, which === 'rows' ? 'row' : 'column');
          if (!items.length) throw new Refusal((w) => (which === 'rows' ? w.refusals.matrixNeedsRow : w.refusals.matrixNeedsColumn));
          field[which] = items;
        },
        `matrix:${id}:${which}:${labels.length}`
      );
    },

    setAddressParts(id: string, parts: string[]): boolean {
      return apply((draft) => {
        const found = findNode(draft, id);
        if (!found || found.node.type !== 'field' || found.node.widget !== 'address') throw new Refusal((w) => w.refusals.onlyAddressParts);
        const node = found.node;
        const known = ADDRESS_PARTS.filter((part) => parts.includes(part));
        if (!known.length) throw new Refusal((w) => w.refusals.addressOnePart);
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
        const { node, field } = question(draft, id, (w, label) => w.refusals.answersFromModel(label));
        // A matrix: several columns in a row, or one.
        if (field.type !== 'matrix' && (field.type !== 'selection' || kindOfField(field, node) !== 'image-choice')) throw new Refusal((w) => w.refusals.onlySeveral);
        if (on) field.multiple = true;
        else delete field.multiple;
      });
    },
  };
}

export type KindCommands = ReturnType<typeof kindCommands>;
