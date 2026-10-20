import type { FieldNode, LayoutNode, Page, SelectionOption } from '@fieldia/core';
import type { ElementFactory } from './chrome';
import { choicesOf, conditionEditor } from './condition-editor';
import { conditionToHide } from './conditions';
import type { Designer } from './designer';
import { containers } from './page-tree';
import { setHidden } from './writes';

/**
 * An option's own condition, in its row of a choice's options: "Show when…" begins one on another question's answer
 * — "Garden" shown when the unit type is Villa — and an option with one shows it under its row, as a question's
 * "Show this question when" does, its rules taken away to show it always. Saved as the option's `invisible`. Its
 * rules are drawn once it has one, or one is begun: a row without stays a row.
 */
export interface OptionWhen {
  /** The button that begins a condition, for the row. */
  button: HTMLElement;
  /** The condition, under the row. */
  box: HTMLElement;
  update(page: Page, nodeId: string, index: number): void;
}

/** Every question of a page, in its order: those an option's condition may read. */
function questionsOf(page: Page): FieldNode[] {
  return containers(page).flatMap((container) => container.children.filter((node: LayoutNode): node is FieldNode => node.type === 'field'));
}

export function optionWhen(el: ElementFactory, designer: Designer): OptionWhen {
  const w = designer.words.options;
  let at: { nodeId: string; index: number } | null = null;
  let seen: { page: Page; others: FieldNode[]; invisible: SelectionOption['invisible'] } | null = null;
  const save = (invisible: string | null) => !!at && designer.setOptionDetails(at.nodeId, at.index, { invisible });
  const box = el('div', { class: 'fd-q-option-when-box', hidden: '' });
  let editor: ReturnType<typeof conditionEditor> | null = null;
  /** The rules' editor, made the first time it is needed. */
  const rules = () => {
    if (!editor) {
      editor = conditionEditor(el, designer, '', 'question', 'shows', {
        lead: w.showOptionWhen,
        label: w.whenOptionShows,
        save: (condition) => save(condition.rules.length ? conditionToHide(condition) : null),
      });
      box.append(editor.element);
    }
    if (seen) editor.update(seen.page, seen.others, seen.invisible);
    return editor;
  };
  const button = el('button', { type: 'button', class: 'fd-button fd-button-link fd-q-option-when' }, w.showWhen);
  button.addEventListener('click', () => rules().start());
  return {
    button,
    box,
    update(page, nodeId, index) {
      at = { nodeId, index };
      const questions = questionsOf(page);
      const own = page.fields[questions.find((node) => node.id === nodeId)?.field ?? ''];
      const option = own?.type === 'selection' ? (own.options[index] as SelectionOption | undefined) : undefined;
      const others = questions.filter((node) => node.id !== nodeId);
      seen = { page, others, invisible: option?.invisible };
      const has = option?.invisible !== undefined && option.invisible !== false;
      if (has || editor) rules();
      setHidden(box, !has);
      // Begun only where another question has answers to test.
      setHidden(button, has || !others.some((node) => choicesOf(page.fields[node.field], designer.words) !== null));
    },
  };
}
