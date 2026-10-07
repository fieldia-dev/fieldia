import type { AnswerRule, FieldNode, Page } from '@fieldia/core';
import type { ElementFactory } from './chrome';
import { choicesOf, conditionEditor } from './condition-editor';
import { conditionToHold } from './conditions';
import type { Designer } from './designer';
import { openMenu } from './menu';
import { allSections, findNode } from './page-tree';
import { segmented } from './panel-controls';
import { ruleRefusal, type AnswerRulePatch } from './rules-commands';
import { formulaBox } from './rules-formula-box';
import { formulaProblem, sampleHolds } from './rules-formula';
import { answerSample, type SampleOptions } from './rules-sample';
import { answerRuleSentence, kindsFitting, NAMED_PATTERNS, ruleAsks } from './rules-words';

/**
 * The rules an answer must keep, as a list of sentences — "At least 2
 * letters", "Ends with @acme.com — only warns" — each opening in place to
 * its settings: what it asks, the message when it does not fit, whether it
 * stops sending or only warns, and only when. "Add a rule" offers only the
 * kinds that fit what the field holds; a rule removed leaves Undo at hand.
 * What is typed is checked here first, and kept only when it reads, so a
 * half-typed rule says what is wrong under it and the page keeps the last
 * good one. A rule across fields begins as an empty formula, kept on the
 * page once what is typed reads. Under the rules, Try a value: the field by
 * its own widget, and what the form says of what is typed there.
 */

export interface AnswerRulesEditor {
  element: HTMLElement;
  update(page: Page): void;
  /** Put the cursor on the first rule, or on Add a rule. */
  focus(): void;
  /** Let go of the sample's widgets. */
  destroy(): void;
}

/** The groups of asks a rule's settings show, in order. */
type Group = 'length' | 'pattern' | 'ending' | 'range' | 'count' | 'date' | 'distinct' | 'across';

function groupsOf(rule: AnswerRule): Group[] {
  const asks = new Set(ruleAsks(rule));
  const groups: Group[] = [];
  if (asks.has('minLength') || asks.has('maxLength')) groups.push('length');
  if (asks.has('pattern')) groups.push('pattern');
  if (asks.has('endsWith')) groups.push('ending');
  if (asks.has('min') || asks.has('max')) groups.push('range');
  if (asks.has('atLeast') || asks.has('atMost')) groups.push('count');
  if (asks.has('date')) groups.push('date');
  if (asks.has('distinct')) groups.push('distinct');
  if (asks.has('holds')) groups.push('across');
  return groups;
}

let made = 0;

/** A number typed, or null for an empty box. */
const numberOf = (box: HTMLInputElement) => (box.value.trim() === '' ? null : Number(box.value));

export function answerRulesEditor(el: ElementFactory, designer: Designer, id: string, sampling: SampleOptions = {}): AnswerRulesEditor {
  const words = designer.words;
  const w = words.rulesUi;
  const base = `fd-answer-rules-${++made}`;
  const focused = (node: Element) => node.ownerDocument.activeElement === node;
  const list = el('ul', { class: 'fd-answer-rules', 'aria-label': w.answerRules });
  const add = el('button', { type: 'button', class: 'fd-button fd-button-link fd-answer-rules-add', 'aria-haspopup': 'menu', 'aria-expanded': 'false' }, w.addARule);
  const undo = el('button', { type: 'button', class: 'fd-button fd-button-link' }, w.undo);
  const statusWords = el('span', {});
  const status = el('p', { class: 'fd-answer-rules-status', role: 'status', hidden: '' }, statusWords, undo);
  const hint = el('p', { class: 'fd-properties-hint fd-set-hint' }, w.checkedAsTyped);
  const sample = answerSample(el, id, sampling, words);
  const element = el('div', { class: 'fd-prop fd-answer-rules-box', 'data-tab': 'rules', 'data-setting': 'Answer rules' }, el('span', { class: 'fd-prop-name' }, w.answerRules), list, add, status, hint, sample.element);

  let page = designer.getPage();
  let views: RuleView[] = [];
  /** The page just after a rule was removed: Undo stands while it is the page. */
  let removedAt: Page | null = null;
  /** The rule to open once it is drawn: one just added. */
  let openNext: number | null = null;
  /** A rule across fields begun with Add a rule, not kept until its formula reads. */
  let drafting: AnswerRule | null = null;

  const node = (): FieldNode | null => {
    const found = findNode(page, id)?.node;
    return found?.type === 'field' ? found : null;
  };

  add.addEventListener('click', () => {
    const own = node();
    if (!own) return;
    const kinds = kindsFitting(page.fields[own.field]);
    openMenu({
      el,
      anchor: add,
      title: w.addARule,
      actions: true,
      items: kinds.map((kind) => ({ id: kind.id, label: words.rules.kinds[kind.id] })),
      onPick(kindId) {
        const kind = kinds.find((k) => k.id === kindId);
        if (!kind) return;
        openNext = node()?.validate?.length ?? 0;
        if (!kind.start) {
          // Kept once it reads: a formula typed, or a column chosen.
          drafting = kind.id === 'distinct' ? { distinct: '' } : { holds: '' };
          draw();
          views[openNext]?.focusFirst();
          openNext = null;
          return;
        }
        if (!designer.addAnswerRule(id, kind.start)) openNext = null;
        else views[openNext ?? 0]?.focusFirst();
        openNext = null;
      },
    });
  });
  undo.addEventListener('click', () => {
    designer.undo();
    status.hidden = true;
    add.focus();
  });

  // ---- one rule --------------------------------------------------------------------------------
  interface RuleView {
    element: HTMLLIElement;
    key: string;
    update(rule: AnswerRule): void;
    open(on: boolean): void;
    focusFirst(): void;
  }

  function ruleView(index: number, rule: AnswerRule): RuleView {
    const bodyId = `${base}-${index}`;
    const say = el('button', { type: 'button', class: 'fd-answer-rule-say', 'aria-expanded': 'false', 'aria-controls': bodyId });
    const remove = el('button', { type: 'button', class: 'fd-icon-button fd-answer-rule-remove' }, '×');
    const problem = el('p', { class: 'fd-answer-rule-problem', role: 'alert', hidden: '' });
    const body = el('div', { class: 'fd-answer-rule-body', id: bodyId, hidden: '' });
    const element = el('li', { class: 'fd-answer-rule', 'data-index': String(index) }, el('div', { class: 'fd-answer-rule-head' }, say, remove), body);
    let current = rule;

    /** Change the rule: kept when it reads, else what is wrong said under it. One begun and not yet kept is added. */
    const change = (patch: AnswerRulePatch) => {
      const own = node();
      if (!own) return;
      const next = { ...current, ...patch } as AnswerRule;
      for (const key of Object.keys(next) as (keyof AnswerRule)[]) if (next[key] === null || (key === 'message' && next[key] === '')) delete next[key];
      const wrong = ruleRefusal(page, own, next, words);
      problem.textContent = wrong ?? '';
      problem.hidden = !wrong;
      if (wrong) return;
      if (index < (own.validate?.length ?? 0)) designer.updateAnswerRule(id, index, patch);
      else {
        // Kept now: drawn from the page from here on, so it is no longer drafted.
        const begun = drafting;
        drafting = null;
        if (!designer.addAnswerRule(id, next)) drafting = begun;
      }
    };
    const box = (label: string, attrs: Record<string, string>, read: (input: HTMLInputElement) => AnswerRulePatch) => {
      const input = el('input', { class: 'fd-input', 'aria-label': label, ...attrs }) as HTMLInputElement;
      const made = { input, read, row: el('label', { class: 'fd-answer-rule-field' }, el('span', { class: 'fd-answer-rule-word' }, label), input) };
      input.addEventListener('input', () => change(made.read(input)));
      return made;
    };
    /**
     * Two ends of one ask, such as the shortest and the longest. Typing in one
     * also takes what the other box shows, when it was not kept: 18 at least
     * while at most still says 10 is wrong until at most is cleared, and then
     * both are kept.
     */
    const pair = (a: ReturnType<typeof box>, b: ReturnType<typeof box>, keys: [keyof AnswerRule, keyof AnswerRule]) => {
      const both = (own: HTMLInputElement, key: keyof AnswerRule, other: HTMLInputElement, otherKey: keyof AnswerRule) => (): AnswerRulePatch => {
        const shown = numberOf(other);
        return shown === (current[otherKey] ?? null) ? { [key]: numberOf(own) } : { [key]: numberOf(own), [otherKey]: shown };
      };
      a.read = both(a.input, keys[0], b.input, keys[1]);
      b.read = both(b.input, keys[1], a.input, keys[0]);
      return el('div', { class: 'fd-answer-rule-pair' }, a.row, b.row);
    };

    // What it asks, by kind.
    const shortest = box(w.shortest, { type: 'number', min: '0', placeholder: w.any, inputmode: 'numeric' }, (i) => ({ minLength: numberOf(i) }));
    const longest = box(w.longest, { type: 'number', min: '1', placeholder: w.any, inputmode: 'numeric' }, (i) => ({ maxLength: numberOf(i) }));
    const ending = box(w.endsWith, { placeholder: '@company.com', autocomplete: 'off' }, (i) => ({ endsWith: i.value || null }));
    const atLeast = box(w.atLeast, { type: 'number', placeholder: w.any }, (i) => ({ min: numberOf(i) }));
    const atMost = box(w.atMost, { type: 'number', placeholder: w.any }, (i) => ({ max: numberOf(i) }));
    const tickLeast = box(w.tickAtLeast, { type: 'number', min: '0', placeholder: w.any }, (i) => ({ atLeast: numberOf(i) }));
    const tickMost = box(w.tickAtMost, { type: 'number', min: '1', placeholder: w.any }, (i) => ({ atMost: numberOf(i) }));
    const looks = el('select', { class: 'fd-input fd-select', 'aria-label': w.looksLike }, ...NAMED_PATTERNS.map((p) => el('option', { value: p.pattern }, words.rules.patterns[p.id])), el('option', { value: '' }, w.myPattern)) as HTMLSelectElement;
    const pattern = box(w.pattern, { class: 'fd-input fd-answer-rule-code', spellcheck: 'false', autocomplete: 'off', placeholder: '[A-Z]{2}\\d+' }, (i) => ({ pattern: i.value || null }));
    looks.addEventListener('change', () => {
      pattern.row.hidden = looks.value !== '';
      if (looks.value) change({ pattern: looks.value });
      else pattern.input.focus();
    });
    // A rule across fields: a formula, the page's fields suggested by their labels, tried on made-up values.
    const holds = formulaBox(el, {
      words,
      label: w.mustHold,
      placeholder: w.mustHoldPlaceholder,
      check: (on, source) => formulaProblem(on, source, words),
      commit: (source) => source && change({ holds: source }),
      said: (on, source) => {
        const said = sampleHolds(on, source, words);
        holds.result.toggleAttribute('data-fails', said.endsWith(words.rules.doesNotHold) || said === words.rules.neverHolds);
        return said;
      },
    });
    // No value twice in a column: the table's columns, by their labels.
    const ownDef = (() => {
      const own = node();
      const def = own ? page.fields[own.field] : undefined;
      return def?.type === 'one2many' ? def : null;
    })();
    const column = el(
      'select',
      { class: 'fd-input fd-select', 'aria-label': words.tables.column },
      el('option', { value: '' }, w.choose),
      ...Object.entries(ownDef?.fields ?? {}).filter(([name]) => name !== ownDef?.sequenceField && name !== ownDef?.lineKinds?.field).map(([name, f]) => el('option', { value: name }, f.label))
    ) as HTMLSelectElement;
    column.addEventListener('change', () => column.value && change({ distinct: column.value }));
    const when = segmented(el, w.allowedDates, [{ value: 'past', words: w.inThePast }, { value: 'future', words: w.inTheFuture }], (value) => value && change({ date: value }));
    const groups: Record<Group, HTMLElement> = {
      length: pair(shortest, longest, ['minLength', 'maxLength']),
      pattern: el('div', { class: 'fd-answer-rule-pattern' }, el('label', { class: 'fd-answer-rule-field' }, el('span', { class: 'fd-answer-rule-word' }, w.looksLike), looks), pattern.row),
      ending: ending.row,
      range: pair(atLeast, atMost, ['min', 'max']),
      count: pair(tickLeast, tickMost, ['atLeast', 'atMost']),
      date: el('div', { class: 'fd-answer-rule-field' }, el('span', { class: 'fd-answer-rule-word' }, w.allowed), when.element),
      distinct: el('label', { class: 'fd-answer-rule-field' }, el('span', { class: 'fd-answer-rule-word' }, words.tables.column), column),
      across: el('div', { class: 'fd-answer-rule-field fd-answer-rule-across' }, el('span', { class: 'fd-answer-rule-word' }, w.mustHold), holds.element, holds.problem, holds.result),
    };
    const shown = groupsOf(rule);
    // When it is broken: the form will not send, or only says so.
    const level = segmented(el, w.whenItDoesNotFit, [{ value: 'error', words: w.stopsSending }, { value: 'warning', words: w.onlyWarns }], (value) => value && change({ level: value === 'warning' ? 'warning' : null }));
    const message = box(w.message, { placeholder: w.messagePlaceholder, autocomplete: 'off' }, (i) => ({ message: i.value || null }));
    // Only when: a condition on other answers, as a field's "Required" takes one.
    const only = conditionEditor(el, designer, id, 'question', 'required', {
      lead: w.only,
      label: w.whenChecked,
      save: (condition) => {
        change({ when: condition.rules.length ? conditionToHold(condition) : null });
        return true;
      },
    });
    const onlyStart = el('button', { type: 'button', class: 'fd-button fd-button-link fd-q-when', 'aria-label': w.checkedOnlyWhen }, w.onlyWhen);
    onlyStart.addEventListener('click', () => {
      only.start();
      (body.querySelector('.fd-when select') as HTMLElement | null)?.focus();
    });
    body.append(
      ...shown.map((g) => groups[g]),
      el('div', { class: 'fd-answer-rule-field' }, el('span', { class: 'fd-answer-rule-word' }, w.whenItDoesNotFit), level.element),
      message.row,
      only.element,
      onlyStart,
      problem
    );

    say.addEventListener('click', () => open(say.getAttribute('aria-expanded') !== 'true'));
    remove.addEventListener('click', () => {
      if (index >= (node()?.validate?.length ?? 0)) {
        // Begun and never kept: it goes, and the page is as it was.
        drafting = null;
        draw();
        add.focus();
        return;
      }
      const sentence = answerRuleSentence(page, current, words);
      if (!designer.removeAnswerRule(id, index)) return;
      removedAt = designer.getPage();
      statusWords.textContent = w.removed(sentence);
      status.hidden = false;
      undo.focus();
    });
    // Escape closes the rule and goes back to its sentence.
    body.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      event.preventDefault();
      open(false);
      say.focus();
    });

    function open(on: boolean) {
      // One rule open at a time: the list stays short in a narrow panel.
      if (on) for (const other of views) if (other.element !== element) other.open(false);
      say.setAttribute('aria-expanded', String(on));
      body.hidden = !on;
      element.classList.toggle('fd-answer-rule-open', on);
    }

    function update(next: AnswerRule) {
      current = next;
      const sentence = answerRuleSentence(page, next, words);
      const kept = index < (node()?.validate?.length ?? 0);
      say.textContent = sentence;
      remove.setAttribute('aria-label', kept ? w.removeRule(sentence) : w.removeNewRule);
      remove.title = w.removeTheRule;
      const set = (input: HTMLInputElement, value: unknown) => {
        if (!focused(input)) input.value = value === undefined || value === null ? '' : String(value);
      };
      set(shortest.input, next.minLength);
      set(longest.input, next.maxLength);
      set(ending.input, next.endsWith);
      set(atLeast.input, next.min);
      set(atMost.input, next.max);
      set(tickLeast.input, next.atLeast);
      set(tickMost.input, next.atMost);
      const named = NAMED_PATTERNS.some((p) => p.pattern === next.pattern);
      if (!focused(looks) && !(looks.value === '' && focused(pattern.input))) looks.value = named ? (next.pattern as string) : '';
      pattern.row.hidden = looks.value !== '';
      set(pattern.input, next.pattern);
      when.set(next.date);
      if (!focused(column)) column.value = next.distinct ?? '';
      level.set(next.level === 'warning' ? 'warning' : 'error');
      set(message.input, next.message);
      holds.update(page, next.holds ?? '');
      const own = node();
      const others = allSections(page).flatMap((s) => s.children.filter((n): n is FieldNode => n.type === 'field' && n.id !== id && choicesOf(page.fields[n.field]) !== null));
      only.update(page, others, next.when);
      onlyStart.hidden = !only.element.hidden || !only.canStart() || !own;
    }

    update(rule);
    return {
      element,
      key: shown.join(','),
      update,
      open,
      focusFirst() {
        open(true);
        (body.querySelector('input:not([type="hidden"]), select, button') as HTMLElement | null)?.focus();
      },
    };
  }

  /** The rules as the page has them now, and one begun after them. */
  function draw() {
    const own = node();
    if (!own) return;
    const def = page.fields[own.field];
    const rules: AnswerRule[] = [...(own.validate ?? []), ...(drafting ? [drafting] : [])];
    const fits = def ? kindsFitting(def).length > 0 : false;
    element.hidden = !fits && !rules.length;
    add.hidden = !fits || !!drafting;
    // A rule whose asks changed is drawn again; the rest are patched, so the box being typed in keeps its cursor.
    views = rules.map((rule, i) => {
      const was = views[i];
      const key = groupsOf(rule).join(',');
      if (was && was.key === key) {
        was.update(rule);
        return was;
      }
      const view = ruleView(i, rule);
      if (was) view.open(was.element.classList.contains('fd-answer-rule-open'));
      return view;
    });
    // Moved only where out of place: a box taken out of the page loses its cursor.
    views.forEach((view, i) => {
      if (list.children[i] !== view.element) list.insertBefore(view.element, list.children[i] ?? null);
    });
    while (list.children.length > views.length) list.lastElementChild?.remove();
    list.hidden = !rules.length;
    if (removedAt && page !== removedAt) {
      removedAt = null;
      status.hidden = true;
    }
    if (openNext !== null) views[openNext]?.open(true);
  }

  return {
    element,
    update(next) {
      page = next;
      draw();
      sample.update(next);
    },
    focus() {
      const first = list.querySelector<HTMLElement>('.fd-answer-rule-say');
      (first && !list.hidden ? first : add).focus();
    },
    destroy: () => sample.destroy(),
  };
}
