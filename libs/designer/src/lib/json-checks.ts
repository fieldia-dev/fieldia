import type { Page } from '@fieldia/core';
import { conditionToHide, conditionToHold, type Condition } from './conditions';
import { placeOf, pathTo, readJson, type Spot } from './json-text';
import { fixCheck, pageChecks, type CheckFixer, type PageCheck } from './page-checks';
import type { DesignerWords } from './designer-words';
import { en } from './locales/en';
import { readPage, type JsonProblem } from './page-json';

/**
 * What the JSON view lists under the text as it is typed: each problem on
 * its line — the text's own mistakes and the page's, which stop it being
 * applied, then what the checks before publishing find — and, where a check
 * has a fix, the fix, done in the text.
 */

export interface JsonRow extends JsonProblem {
  /** `error` stops the text being applied; `must` and `should` are the checks before publishing. */
  severity: 'error' | 'must' | 'should';
  /** A check's fix that changes the page: done in the text, not on the page being edited. */
  fix?: { label: string; check: PageCheck };
}

export interface JsonCheck {
  rows: JsonRow[];
  /** How many rows stop the text being applied. */
  errors: number;
}

type Node = { id?: unknown; field?: unknown; label?: unknown; invisible?: unknown; children?: unknown; [key: string]: unknown };

const isNode = (id: string) => (value: object) => (value as Node).id === id;

/** Where in the page a check points: the part it is about, and the key its fix would touch. */
function checkPath(value: unknown, check: PageCheck): string {
  // Only the layout's parts have ids: the first part with this one is the one meant.
  const path = check.at === null ? null : pathTo(value, isNode(check.at));
  if (check.at === null || path === null) return '(page)';
  const action = check.fix?.action;
  if (action?.kind === 'drop-rule') return `${path}.invisible`;
  // A rule's fix: the place the rule is written — on the part, or on the field it works out.
  if (action?.kind === 'remove-rule') {
    const field = findPart((value as Page).layout, check.at)?.part.field;
    const at = action.index === undefined ? '' : `.${action.index}`;
    switch (action.rule) {
      case 'shows':
        return `${path}.invisible`;
      case 'required':
      case 'readonly':
        return `${path}.${action.rule}`;
      case 'answer':
        return `${path}.validate${at}`;
      case 'compute':
        return typeof field === 'string' ? `fields.${field}.compute` : path;
      case 'set':
        return typeof field === 'string' ? `fields.${field}.setWhen${at}` : path;
    }
  }
  if (action?.kind !== 'go') return path;
  // A question's words are its own, or else its field's; its options are its field's.
  const node = findPart((value as Page).layout, check.at)?.part;
  if (action.part === 'label' && node?.label !== undefined) return `${path}.label`;
  return typeof node?.field === 'string' ? `fields.${node.field}.${action.part}` : path;
}

export function checkJson(text: string, words: DesignerWords = en): JsonCheck {
  const read = readPage(text, words);
  const rows: JsonRow[] = read.problems.map((problem) => ({ ...problem, severity: 'error' }));
  const errors = rows.length;
  if (!read.tree) return { rows, errors };
  let checks: PageCheck[] = [];
  try {
    checks = pageChecks(read.value as Page, { words });
  } catch {
    // A page too broken to look over: its errors say enough.
  }
  // The checks say the format's problems again, as words with a path: those are on their lines already.
  const said = new Set(read.problems.map((problem) => words.checks.invalid(problem.path ?? '', problem.message)));
  for (const check of checks) {
    if (check.at === null && said.has(check.text)) continue;
    const path = checkPath(read.value, check);
    const place = placeOf(text, read.tree as Spot, path);
    const fix = check.fix && check.fix.action.kind !== 'go' ? { label: check.fix.label, check } : undefined;
    // A problem the format found on this very line already says what is wrong: it takes the fix.
    const same = fix && rows.find((row) => row.severity === 'error' && row.line === place.line && !row.fix);
    if (same) same.fix = fix;
    else rows.push({ ...place, path, message: check.text, severity: check.severity, ...(fix ? { fix } : {}) });
  }
  rows.sort((a, b) => a.line - b.line || a.column - b.column);
  return { rows, errors };
}

/** The part with this id, anywhere in the layout, and the list it sits in. */
function findPart(value: unknown, id: string): { part: Node; list: unknown[] } | null {
  if (value === null || typeof value !== 'object') return null;
  for (const item of Array.isArray(value) ? value : Object.values(value)) {
    if (Array.isArray(value) && (item as Node | null)?.id === id) return { part: item as Node, list: value };
    const found = findPart(item, id);
    if (found) return found;
  }
  return null;
}

/** A check's fixes, done on a page read from text: nothing is checked until the text is read again. */
function textFixer(draft: Page): CheckFixer {
  /** The field a part on the page shows, to change what it is worked out from. */
  const fieldOf = (id: string) => {
    const name = findPart(draft.layout, id)?.part['field'];
    return typeof name === 'string' ? (draft.fields[name] as unknown as Record<string, unknown> | undefined) : undefined;
  };
  return {
    getPage: () => draft,
    removeNode(id) {
      const found = findPart(draft.layout, id);
      if (!found) return false;
      found.list.splice(found.list.indexOf(found.part), 1);
      return true;
    },
    setCondition(id, condition: Condition | null) {
      const found = findPart(draft.layout, id);
      if (!found) return false;
      if (condition?.rules.length) found.part.invisible = conditionToHide(condition);
      else delete found.part.invisible;
      return true;
    },
    setRule(id, which, condition: Condition | null) {
      const found = findPart(draft.layout, id);
      if (!found) return false;
      if (condition?.rules.length) found.part[which] = conditionToHold(condition);
      else delete found.part[which];
      return true;
    },
    setCompute(id, expression) {
      const field = fieldOf(id);
      if (!field) return false;
      if (expression === null) delete field['compute'];
      else field['compute'] = expression;
      return true;
    },
    setSetWhen(id, items) {
      const field = fieldOf(id);
      if (!field) return false;
      if (items?.length) field['setWhen'] = items;
      else delete field['setWhen'];
      return true;
    },
    removeAnswerRule(id, index) {
      const rules = findPart(draft.layout, id)?.part['validate'] as unknown[] | undefined;
      if (!rules?.[index]) return false;
      rules.splice(index, 1);
      if (!rules.length) delete (findPart(draft.layout, id) as { part: Node }).part['validate'];
      return true;
    },
    select: () => undefined,
  };
}

/** The text with a check's fix done in it, or null when it cannot be: text that is not JSON, or no fix. */
export function fixJson(text: string, check: PageCheck | null): string | null {
  const read = readJson(text);
  if (!read.ok || !check) return null;
  const draft = JSON.parse(JSON.stringify(read.value)) as Page;
  return fixCheck(textFixer(draft), check) ? JSON.stringify(draft, null, 2) : null;
}
