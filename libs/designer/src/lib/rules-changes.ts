import type { AnswerRule, FieldNode, Page } from '@fieldia/core';
import { containers } from './page-tree';
import { formulaInWords } from './rules-formula';
import { answerRuleMust, setValueInWords } from './rules-words';

/**
 * The rules' part of what changed since the last version, in words for the
 * Publish dialog: "“Total” is worked out from Price × Quantity", "“Email”: a
 * rule — Must end with @acme.com (only warns)". Field by field, in reading
 * order; a field taken off the page is said to be removed elsewhere.
 */

/** Each field's place on the page, in reading order. */
function fieldNodes(page: Page): FieldNode[] {
  return containers(page).flatMap((c) => c.children.filter((n): n is FieldNode => n.type === 'field'));
}

/** What is in `a` and not in `b`, as many times as it is. */
function without(a: AnswerRule[], b: AnswerRule[]): AnswerRule[] {
  const left = b.map((rule) => JSON.stringify(rule));
  return a.filter((rule) => {
    const at = left.indexOf(JSON.stringify(rule));
    if (at === -1) return true;
    left.splice(at, 1);
    return false;
  });
}

function answerRuleChanges(before: Page, after: Page, was: AnswerRule[], now: AnswerRule[], name: string): string[] {
  if (JSON.stringify(was) === JSON.stringify(now)) return [];
  // One rule changed where it stands: said as changed, not as one gone and one added.
  if (was.length === now.length) {
    const changed = now.filter((rule, i) => JSON.stringify(rule) !== JSON.stringify(was[i]));
    if (changed.length === 1) return [`“${name}”: a rule changed — ${answerRuleMust(after, changed[0])}`];
  }
  return [
    ...without(was, now).map((rule) => `“${name}”: removed the rule — ${answerRuleMust(before, rule)}`),
    ...without(now, was).map((rule) => `“${name}”: a rule — ${answerRuleMust(after, rule)}`),
  ];
}

export function ruleChanges(before: Page, after: Page): string[] {
  const out: string[] = [];
  const wasNodes = new Map(fieldNodes(before).map((n) => [n.id, n]));
  const said = new Set<string>();
  for (const node of fieldNodes(after)) {
    const def = after.fields[node.field];
    const name = node.label ?? def?.label ?? node.field;
    out.push(...answerRuleChanges(before, after, wasNodes.get(node.id)?.validate ?? [], node.validate ?? [], name));
    // A field's own rules once, where it first shows.
    if (said.has(node.field) || !def) continue;
    said.add(node.field);
    const was = before.fields[node.field];
    if ((was?.compute ?? '') !== (def.compute ?? '')) out.push(def.compute ? `“${name}” is worked out from ${formulaInWords(after, def.compute)}` : `“${name}” is no longer worked out`);
    if (JSON.stringify(was?.setWhen ?? []) !== JSON.stringify(def.setWhen ?? [])) {
      const items = def.setWhen ?? [];
      out.push(items.length ? items.map((item) => `“${name}” is set to ${setValueInWords(after, def, item.value)} when ${formulaInWords(after, item.when)}`).join('; ') : `“${name}” is no longer set by a rule`);
    }
  }
  return out;
}
