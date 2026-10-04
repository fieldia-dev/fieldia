import type { Field, FieldNode, Page } from '@fieldia/core';
import { iconButton, type ElementFactory } from './chrome';
import { readCondition, readHolds, type Condition, type ConditionRule } from './conditions';
import type { Designer } from './designer';

/** The answers a condition can test: a choice of one, or yes or no. */
export function choicesOf(field: Field | undefined): { key: string; label: string; value: ConditionRule['value'] }[] | null {
  if (field?.type === 'selection' && !field.multiple) return field.options.map((o) => ({ key: String(o.value), label: o.label, value: o.value }));
  if (field?.type === 'boolean') return [{ key: 'true', label: 'Yes', value: true }, { key: 'false', label: 'No', value: false }];
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
  const lead = custom?.lead ?? (kind === 'shows' ? `Show this ${what}` : kind === 'required' ? 'Required' : 'Read-only');
  const match = el('select', { class: 'fd-input fd-select fd-when-match', 'aria-label': 'Match' }, el('option', { value: 'all' }, 'all of these'), el('option', { value: 'any' }, 'any of these'));
  const matchRow = el('div', { class: 'fd-when-match-row', hidden: '' }, el('span', {}, `${lead} when`), match, el('span', {}, 'hold'));
  const rows = el('div', { class: 'fd-when-rules' });
  const add = el('button', { type: 'button', class: 'fd-button fd-button-link fd-when-add' }, 'Add a condition');
  const customText = el('code', {});
  const replace = el('button', { type: 'button', class: 'fd-button fd-button-link' }, 'Replace');
  const customBox = el('div', { class: 'fd-when-custom', hidden: '' }, el('span', {}, `${kind === 'shows' ? 'Shown' : lead} when, as written by hand: `), customText, replace);
  // One rule for a field's required or read-only: said what it is for; several say it in their match row.
  const caption = el('span', { class: 'fd-when-lead', hidden: '' }, `${lead} when`);
  const element = el('div', { class: 'fd-when', role: 'group', 'aria-label': custom?.label ?? (kind === 'shows' ? `When this ${what} shows` : `When it is ${lead.toLowerCase()}`) }, caption, matchRow, rows, add, customBox);
  let available: FieldNode[] = [];
  let page: Page | null = null;

  /** The rules as the selects show them now. */
  function read(): Condition {
    const rules = [...rows.children].flatMap((row): ConditionRule[] => {
      const [field, answer] = [...row.querySelectorAll('select')] as HTMLSelectElement[];
      const choice = choicesOf(page?.fields[field.value])?.find((c) => c.key === answer.value.slice(answer.value.indexOf(':') + 1));
      return field.value && choice ? [{ field: field.value, op: answer.value.startsWith('not:') ? 'is not' : 'is', value: choice.value }] : [];
    });
    return { join: match.value as Condition['join'], rules };
  }
  const save = (condition: Condition) => (custom ? custom.save(condition) : kind === 'shows' ? designer.setCondition(targetId, condition) : designer.setRule(targetId, kind, condition));

  /** A first rule: the first question it can test, its first answer. */
  function start(field?: string) {
    const name = field ?? available[0]?.field;
    const first = name ? choicesOf(page?.fields[name])?.[0] : undefined;
    if (name && first) save({ join: 'all', rules: [...read().rules, { field: name, op: 'is', value: first.value }] });
  }

  function row(index: number): HTMLElement {
    const field = el('select', { class: 'fd-input fd-select fd-when-field', 'aria-label': index === 0 ? (kind === 'shows' ? lead : `${lead} when`) : `Condition ${index + 1}` });
    const answer = el('select', { class: 'fd-input fd-select fd-when-answer', 'aria-label': index === 0 ? 'When the answer is' : `Answer ${index + 1}` });
    const remove = iconButton(el, `Remove condition ${index + 1}`, '×', () => {
      const current = read();
      current.rules.splice(index, 1);
      save(current);
    });
    field.addEventListener('change', () => {
      const current = read();
      if (!field.value) return void save({ join: 'all', rules: [] });
      // A new question: its first answer.
      const first = choicesOf(page?.fields[field.value])?.[0];
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
      available = before.filter((n) => choicesOf(current.fields[n.field]) !== null);
      const held = kind === 'shows' ? readCondition(invisible) : readHolds(invisible);
      // Always required is the Required box's, not a rule's.
      const condition = held === 'always' ? null : held;
      customBox.hidden = condition !== 'custom';
      if (condition === 'custom') customText.textContent = String(invisible);
      const rules = condition && condition !== 'custom' ? condition.rules : [];
      // A page shows "Always" in its first row; a question shows nothing until it has a rule.
      const shown = what === 'page' && condition !== 'custom' ? Math.max(rules.length, 1) : rules.length;
      while (rows.children.length > shown) rows.lastElementChild?.remove();
      while (rows.children.length < shown) rows.append(row(rows.children.length));
      [...rows.children].forEach((r, i) => {
        const [field, answer] = [...r.querySelectorAll('select')] as HTMLSelectElement[];
        const rule = rules[i];
        const options = available.map((n) => el('option', { value: n.field }, current.fields[n.field].label));
        field.replaceChildren(...(i === 0 ? [el('option', { value: '' }, 'Always')] : []), ...options);
        field.value = rule?.field ?? '';
        const choices = rule ? choicesOf(current.fields[rule.field]) ?? [] : [];
        answer.replaceChildren(
          ...choices.map((c) => el('option', { value: `is:${c.key}` }, `is ${c.label}`)),
          ...choices.map((c) => el('option', { value: `not:${c.key}` }, `is not ${c.label}`))
        );
        answer.hidden = !rule;
        if (rule) answer.value = `${rule.op === 'is' ? 'is' : 'not'}:${String(rule.value)}`;
        (r.querySelector('button') as HTMLButtonElement).hidden = rules.length < 2;
      });
      matchRow.hidden = rules.length < 2;
      caption.hidden = kind === 'shows' || rules.length !== 1;
      match.value = condition && condition !== 'custom' ? condition.join : 'all';
      add.hidden = !rules.length;
      element.hidden = what !== 'page' && !rules.length && condition !== 'custom';
    },
  };
}
