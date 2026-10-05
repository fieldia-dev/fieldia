import type { Field, FieldNode, Page } from '@fieldia/core';
import { iconButton, type ElementFactory } from './chrome';
import { readCondition, readHolds, type Condition, type ConditionRule } from './conditions';
import type { Designer } from './designer';
import { setHidden, setText } from './writes';
import type { DesignerWords } from './designer-words';
import { en } from './locales/en';

/** The answers a condition can test: a choice of one, or yes or no. */
export function choicesOf(field: Field | undefined, words: DesignerWords = en): { key: string; label: string; value: ConditionRule['value'] }[] | null {
  if (field?.type === 'selection' && !field.multiple) return field.options.map((o) => ({ key: String(o.value), label: o.label, value: o.value }));
  if (field?.type === 'boolean') return [{ key: 'true', label: words.rules.yes, value: true }, { key: 'false', label: words.rules.no, value: false }];
  return null;
}

/**
 * When a page or a question shows: "Always", or rules on the answers to
 * questions before it — "is Yes", "is not Manager" — all of them or any of
 * them. A condition written by hand is shown as it is, with Replace. The
 * same, for when a field is required or read-only (`kind`).
 */
export function conditionEditor(
  el: ElementFactory,
  designer: Designer,
  targetId: string,
  what: 'page' | 'question' | 'group',
  kind: 'shows' | 'required' | 'readonly' = 'shows',
  /** A rule kept elsewhere, such as when an answer rule holds: its own words, and where it is saved. Read as it holds. */
  custom?: { lead: string; label: string; save(condition: Condition): boolean }
) {
  const words = designer.words;
  const w = words.rulesUi;
  const lead = custom?.lead ?? (kind === 'shows' ? w.show[what] : kind === 'required' ? w.required : w.readonly);
  const match = el('select', { class: 'fd-input fd-select fd-when-match', 'aria-label': w.match }, el('option', { value: 'all' }, w.allOfThese), el('option', { value: 'any' }, w.anyOfThese));
  const matchRow = el('div', { class: 'fd-when-match-row', hidden: '' }, el('span', {}, w.matchBefore(lead)), match, el('span', {}, w.matchAfter));
  const rows = el('div', { class: 'fd-when-rules' });
  const add = el('button', { type: 'button', class: 'fd-button fd-button-link fd-when-add' }, w.addACondition);
  const customText = el('code', {});
  const replace = el('button', { type: 'button', class: 'fd-button fd-button-link' }, w.replace);
  const customBox = el('div', { class: 'fd-when-custom', hidden: '' }, el('span', {}, kind === 'shows' ? w.shownByHand : w.byHand(lead)), customText, replace);
  // One rule for a field's required or read-only: said what it is for; several say it in their match row.
  const caption = el('span', { class: 'fd-when-lead', hidden: '' }, w.whenLead(lead));
  const element = el('div', { class: 'fd-when', role: 'group', 'aria-label': custom?.label ?? (kind === 'shows' ? w.whenShows[what] : w.whenItIs[kind]) }, caption, matchRow, rows, add, customBox);
  let available: FieldNode[] = [];
  let page: Page | null = null;
  /** What each row's lists were drawn from: the questions it offers, and the field its answers are of. Drawn again only when one changes. */
  const drawn = new WeakMap<Element, { offered: unknown[]; first: boolean; answersOf: Field | undefined }>();
  const same = (a: unknown[], b: unknown[]) => a.length === b.length && a.every((item, i) => item === b[i]);

  /** The rules as the selects show them now. */
  function read(): Condition {
    const rules = [...rows.children].flatMap((row): ConditionRule[] => {
      const [field, answer] = [...row.querySelectorAll('select')] as HTMLSelectElement[];
      const choice = choicesOf(page?.fields[field.value], words)?.find((c) => c.key === answer.value.slice(answer.value.indexOf(':') + 1));
      return field.value && choice ? [{ field: field.value, op: answer.value.startsWith('not:') ? 'is not' : 'is', value: choice.value }] : [];
    });
    return { join: match.value as Condition['join'], rules };
  }
  const save = (condition: Condition) => (custom ? custom.save(condition) : kind === 'shows' ? designer.setCondition(targetId, condition) : designer.setRule(targetId, kind, condition));

  /** A first rule: the first question it can test, its first answer. */
  function start(field?: string) {
    const name = field ?? available[0]?.field;
    const first = name ? choicesOf(page?.fields[name], words)?.[0] : undefined;
    if (name && first) save({ join: 'all', rules: [...read().rules, { field: name, op: 'is', value: first.value }] });
  }

  function row(index: number): HTMLElement {
    const field = el('select', { class: 'fd-input fd-select fd-when-field', 'aria-label': index === 0 ? (kind === 'shows' ? lead : w.whenLead(lead)) : w.condition(index + 1) });
    const answer = el('select', { class: 'fd-input fd-select fd-when-answer', 'aria-label': index === 0 ? w.whenTheAnswerIs : w.answer(index + 1) });
    const remove = iconButton(el, w.removeCondition(index + 1), '×', () => {
      const current = read();
      current.rules.splice(index, 1);
      save(current);
    });
    field.addEventListener('change', () => {
      const current = read();
      if (!field.value) return void save({ join: 'all', rules: [] });
      // A new question: its first answer.
      const first = choicesOf(page?.fields[field.value], words)?.[0];
      if (!first) return;
      current.rules[index] = { field: field.value, op: 'is', value: first.value };
      save(current);
    });
    answer.addEventListener('change', () => save(read()));
    return el('div', { class: 'fd-when-rule' }, field, answer, remove);
  }

  add.addEventListener('click', () => start(available.find((n) => !read().rules.some((r) => r.field === n.field))?.field));
  match.addEventListener('change', () => save(read()));
  replace.addEventListener('click', () => save({ join: 'all', rules: [] }));

  return {
    element,
    /** Begin with a first rule, for a question that had none. */
    start: () => start(),
    /** Whether there is something to test: a question before it with answers to choose from. */
    canStart: () => available.length > 0,
    update(current: Page, before: FieldNode[], invisible: unknown) {
      page = current;
      available = before.filter((n) => choicesOf(current.fields[n.field], words) !== null);
      const held = kind === 'shows' ? readCondition(invisible) : readHolds(invisible);
      // Always required is the Required box's, not a rule's.
      const condition = held === 'always' ? null : held;
      setHidden(customBox, condition !== 'custom');
      if (condition === 'custom') setText(customText, String(invisible));
      const rules = condition && condition !== 'custom' ? condition.rules : [];
      // A page shows "Always" in its first row; a question shows nothing until it has a rule.
      const shown = what === 'page' && condition !== 'custom' ? Math.max(rules.length, 1) : rules.length;
      while (rows.children.length > shown) rows.lastElementChild?.remove();
      while (rows.children.length < shown) rows.append(row(rows.children.length));
      // The questions offered, and what they are: the same objects while an edit leaves them alone.
      const offered = available.flatMap((n) => [n, current.fields[n.field]]);
      [...rows.children].forEach((r, i) => {
        const [field, answer] = [...r.querySelectorAll('select')] as HTMLSelectElement[];
        const rule = rules[i];
        const answersOf = rule ? current.fields[rule.field] : undefined;
        const was = drawn.get(r);
        if (!was || !same(was.offered, offered) || was.first !== (i === 0)) {
          const options = available.map((n) => el('option', { value: n.field }, current.fields[n.field].label));
          field.replaceChildren(...(i === 0 ? [el('option', { value: '' }, w.always)] : []), ...options);
        }
        field.value = rule?.field ?? '';
        if (!was || was.answersOf !== answersOf) {
          const choices = rule ? choicesOf(answersOf, words) ?? [] : [];
          answer.replaceChildren(
            ...choices.map((c) => el('option', { value: `is:${c.key}` }, w.answerIs(c.label))),
            ...choices.map((c) => el('option', { value: `not:${c.key}` }, w.answerIsNot(c.label)))
          );
        }
        drawn.set(r, { offered, first: i === 0, answersOf });
        setHidden(answer, !rule);
        if (rule) answer.value = `${rule.op === 'is' ? 'is' : 'not'}:${String(rule.value)}`;
        setHidden(r.querySelector('button') as HTMLButtonElement, rules.length < 2);
      });
      setHidden(matchRow, rules.length < 2);
      setHidden(caption, kind === 'shows' || rules.length !== 1);
      match.value = condition && condition !== 'custom' ? condition.join : 'all';
      setHidden(add, !rules.length);
      setHidden(element, what !== 'page' && !rules.length && condition !== 'custom');
    },
  };
}
