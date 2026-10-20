import type { FieldNode, LayoutNode, Page, PageEnding } from '@fieldia/core';
import { withAnswers } from './answer-picker';
import { iconButton, type ElementFactory } from './chrome';
import { choicesOf, conditionEditor } from './condition-editor';
import { conditionToHold } from './conditions';
import type { Designer } from './designer';
import { setHidden, setText } from './writes';

/** Every question of the page, in its order: what an ending's condition may test. */
function questionsOf(page: Page): FieldNode[] {
  const found: FieldNode[] = [];
  const walk = (nodes: readonly LayoutNode[]) => {
    for (const node of nodes) {
      if (node.type === 'field') found.push(node);
      const inner = (node as { children?: LayoutNode[] }).children;
      if (Array.isArray(inner)) walk(inner);
    }
  };
  walk(((page.layout as { children?: LayoutNode[] }).children ?? []) as LayoutNode[]);
  return found;
}

/** The ending shown otherwise: the one with no condition. */
const isDefault = (ending: PageEnding | undefined) => !!ending && (ending.when === undefined || ending.when === true);

/**
 * What a form of responses says once it is sent (`endings`), as a list of its endings in order — each with when it is
 * shown (its condition, tested on the answers as the questions' rules are), its title, its words and its button to
 * start again, its words with a button that puts an answer in them, and the reference the app gives (`{id}`) — and
 * "Add an ending", which goes before the one shown otherwise, tested on the first question it can test. On the
 * screen's panel (panel-page.ts) and under a survey's pages (survey-editor.ts); a record's page has none.
 */
export function endingsEditor(el: ElementFactory, designer: Designer): { element: HTMLElement; update(page: Page): void } {
  const w = designer.words.endings;
  const focused = (node: Element) => node.ownerDocument.activeElement === node;
  const list = el('ol', { class: 'fd-endings-list' });
  const plain = el('p', { class: 'fd-properties-hint' }, w.plainThanks);
  const add = el('button', { type: 'button', class: 'fd-button fd-endings-add' }, w.add);
  const needs = el('p', { class: 'fd-properties-hint', hidden: '' }, w.addNeedsQuestion);
  const element = el('div', { class: 'fd-endings', role: 'group', 'aria-label': w.heading }, el('p', { class: 'fd-properties-hint' }, w.hint), list, plain, add, needs);
  let page: Page = designer.getPage();

  /** The first rule a new ending may be shown by: the first question with answers to choose from, its first answer. */
  const firstRule = (): string | null => {
    const node = questionsOf(page).find((n) => choicesOf(page.fields[n.field], designer.words));
    const answer = node ? choicesOf(page.fields[node.field], designer.words)?.[0] : undefined;
    return node && answer ? conditionToHold({ join: 'all', rules: [{ field: node.field, op: 'is', value: answer.value }] }) : null;
  };
  add.addEventListener('click', () => {
    const endings = page.endings ?? [];
    const before = endings.length;
    // The first one, or one after endings all shown by a condition, is shown otherwise; any other is shown by one.
    const when = !endings.length || !endings.some(isDefault) ? null : firstRule();
    if (designer.setEnding(endings.length, { title: w.newTitle, ...(when ? { when } : {}) })) {
      // Its title, to type in: where it went among them.
      const at = when ? Math.max(0, before - 1) : before;
      queueMicrotask(() => list.querySelector<HTMLInputElement>(`[data-ending="${at}"] .fd-ending-title`)?.focus());
    }
  });

  /** One ending's card, drawn once for its place among them and patched from the page. */
  function card(index: number) {
    const n = index + 1;
    const name = el('span', { class: 'fd-ending-name' });
    const shown = el('span', { class: 'fd-ending-otherwise' }, w.otherwise);
    const up = iconButton(el, w.moveUp(n), '↑', () => designer.moveEnding(index, index - 1));
    const down = iconButton(el, w.moveDown(n), '↓', () => designer.moveEnding(index, index + 1));
    const remove = iconButton(el, w.remove(n), '×', () => designer.setEnding(index, null));
    const when = conditionEditor(el, designer, `#ending-${index}`, 'question', 'required', {
      lead: w.lead,
      label: w.conditionFor(n),
      // Taken away from one before others (Replace), it starts again on the first question it can test: only the last is shown otherwise.
      save: (condition) => designer.setEnding(index, { when: condition.rules.length ? conditionToHold(condition) : index < (page.endings?.length ?? 0) - 1 ? firstRule() : null }),
    });
    const title = el('input', { class: 'fd-input fd-ending-title', 'aria-label': w.titleFor(n), autocomplete: 'off' }) as HTMLInputElement;
    title.addEventListener('input', () => designer.setEnding(index, { title: title.value }, { typing: true }));
    const text = el('textarea', { class: 'fd-input fd-insp-area fd-ending-text', 'aria-label': w.textFor(n), rows: '3' }) as HTMLTextAreaElement;
    text.addEventListener('input', () => designer.setEnding(index, { text: text.value }, { typing: true }));
    const again = el('input', { class: 'fd-input fd-ending-again', 'aria-label': w.againFor(n), placeholder: w.againHint, autocomplete: 'off' }) as HTMLInputElement;
    again.addEventListener('input', () => designer.setEnding(index, { again: again.value || null }, { typing: true }));
    const none = el('input', { type: 'checkbox', class: 'fd-checkbox', 'aria-label': w.noAgainFor(n) }) as HTMLInputElement;
    none.addEventListener('change', () => designer.setEnding(index, { again: none.checked ? false : null }));
    const row = (words: string, ...controls: Node[]) => el('div', { class: 'fd-ending-row' }, el('span', { class: 'fd-prop-name' }, words), ...controls);
    const item = el(
      'li',
      { class: 'fd-ending', 'data-ending': String(index) },
      el('div', { class: 'fd-ending-head' }, name, shown, el('span', { class: 'fd-spacer' }), up, down, remove),
      when.element,
      row(w.title, withAnswers(el, designer, title, { sent: true })),
      row(w.text, withAnswers(el, designer, text, { sent: true }), el('p', { class: 'fd-properties-hint' }, w.textHint)),
      row(w.again, again, el('label', { class: 'fd-ending-none' }, none, el('span', {}, w.noAgain)))
    );
    return {
      item,
      update(current: Page) {
        const endings = current.endings ?? [];
        const ending = endings[index];
        const otherwise = isDefault(ending);
        setText(name, w.ending(n));
        setHidden(shown, !otherwise);
        // Shown otherwise, it stays last: nothing goes after it, and it goes after nothing it would hide.
        setHidden(up, index === 0 || otherwise);
        setHidden(down, otherwise || index >= endings.length - 1 || isDefault(endings[index + 1]));
        when.update(current, questionsOf(current), ending?.when);
        setHidden(when.element, otherwise);
        if (!focused(title)) title.value = ending?.title ?? '';
        if (!focused(text)) text.value = ending?.text ?? '';
        if (!focused(again)) again.value = typeof ending?.again === 'string' ? ending.again : '';
        none.checked = ending?.again === false;
        again.hidden = none.checked;
      },
    };
  }
  const cards: ReturnType<typeof card>[] = [];

  return {
    element,
    update(current) {
      page = current;
      const endings = current.endings ?? [];
      while (cards.length > endings.length) cards.pop()?.item.remove();
      while (cards.length < endings.length) {
        const made = card(cards.length);
        cards.push(made);
        list.append(made.item);
      }
      for (const one of cards) one.update(current);
      setHidden(list, !endings.length);
      setHidden(plain, endings.length > 0);
      // Another ending before the one shown otherwise needs a question to be chosen by: said, never a button that does nothing.
      const stuck = endings.some(isDefault) && !firstRule();
      setHidden(add, stuck);
      setHidden(needs, !stuck);
    },
  };
}
