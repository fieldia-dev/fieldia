import { validatePage, type Field, type FieldNode, type Page } from '@fieldia/core';
import { readCondition, type Condition } from './conditions';
import { kindById, kindOfField } from './kinds';
import { holderName as placeName, layoutChanges, lookChanges, placements } from './layout-changes';
import { isWrapper } from './layout-tree';
import { containers, type Container } from './page-tree';
import { translationChanges } from './translations';
import { ruleChanges } from './rules-changes';
import { fixRuleCheck, ruleChecks, type RuleFix, type RuleFixer } from './rules-checks';

/**
 * Before a page is published: what people would trip over, each with a fix
 * where there is one, the ones that would stop them first; and what changed
 * since the last version, in words, for the Publish dialog.
 *
 * A required field a rule hides is not one of them: the form asks only the
 * fields on show, so it is required only when shown, as it should be.
 */

export type CheckFix = { kind: 'go'; id: string; part: 'label' | 'options' } | { kind: 'remove'; id: string } | { kind: 'drop-rule'; id: string; rule: number } | RuleFix;

export interface PageCheck {
  /** The element it is about, or null for the page. */
  at: string | null;
  /** `must`: it would stop people, or hide what was meant to show. `should`: it only reads wrong. */
  severity: 'must' | 'should';
  text: string;
  fix?: { label: string; action: CheckFix };
}

/** A container's own: a step's label, a section's title, a tab's label. */
type Holder = Container & { type?: string; label?: string; title?: string; invisible?: unknown };

interface Placed {
  node: FieldNode;
  field: Field;
  holder: Holder;
}

const DEFAULT_OPTION = /^Option \d+$/;
const UNTITLED = /^Untitled (question|field)$/;

/** "a", "a and b", "a, b and c". */
function andList(words: string[]): string {
  return words.length < 2 ? (words[0] ?? '') : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;
}

/** Each field on the page, with the group that holds it (an arrangement is no group), in reading order. */
function placedFields(page: Page): Placed[] {
  const named = placements(page).holder;
  return containers(page).flatMap((holder) =>
    holder.children
      .filter((n): n is FieldNode => n.type === 'field' && !!page.fields[n.field])
      .map((node) => ({ node, field: page.fields[node.field], holder: (named.get(node.id) ?? holder) as Holder }))
  );
}

/** The steps, sections and tabs a person sees as parts of the page — not the page itself, nor an arrangement. */
function parts(page: Page): Holder[] {
  return containers(page).filter((c) => c.id !== page.layout.id && !isWrapper(c)) as Holder[];
}

const labelOf = (placed: { node: FieldNode; field: Field }) => (placed.node as FieldNode & { label?: string }).label ?? placed.field.label;
const holderName = (holder: Holder) => holder.label ?? holder.title ?? 'Untitled section';

/** Every element with its own `invisible`: fields, and the steps and sections that hold them. */
function withRules(page: Page): { id: string; name: string; invisible: unknown }[] {
  return [
    ...parts(page).map((h) => ({ id: h.id, name: holderName(h), invisible: h.invisible })),
    ...placedFields(page).map((p) => ({ id: p.node.id, name: labelOf(p), invisible: p.node.invisible })),
  ];
}

export function pageChecks(page: Page): PageCheck[] {
  const found: PageCheck[] = [];
  const checked = validatePage(page);
  const rules = ruleChecks(page);
  // A page written by hand can be wrong in ways the designer would never let it be; what the rules' checks say in words is not said again.
  if (!checked.ok) for (const issue of checked.issues) if (!rules.covers(issue.path)) found.push({ at: null, severity: 'must', text: issue.path ? `${issue.path}: ${issue.message}` : issue.message });
  found.push(...rules.checks);
  const survey = page.data.kind === 'responses';
  const noun = survey ? 'question' : 'field';
  const placed = placedFields(page);
  if (survey && placed.length === 0) found.push({ at: null, severity: 'must', text: 'The survey has no questions yet, so there is nothing to answer.' });

  // What a question still lacks.
  for (const p of placed) {
    const label = labelOf(p);
    if (!label.trim() || UNTITLED.test(label)) {
      found.push({ at: p.node.id, severity: 'should', text: `A ${noun} has no words yet: people would read “${label.trim() || '…'}”.`, fix: { label: 'Type its words', action: { kind: 'go', id: p.node.id, part: 'label' } } });
    }
    if (p.field.type === 'selection' && p.field.options.length && p.field.options.every((o) => DEFAULT_OPTION.test(o.label))) {
      found.push({
        at: p.node.id,
        severity: 'should',
        text: `“${label}” still offers ${andList(p.field.options.map((o) => o.label))} as its options.`,
        fix: { label: 'Type its options', action: { kind: 'go', id: p.node.id, part: 'options' } },
      });
    }
  }

  // Pages and sections with nothing in them.
  const holders = parts(page).filter((h) => h.type === 'step' || h.type === 'section');
  const steps = holders.filter((h) => h.type === 'step');
  const sections = holders.filter((h) => h.type === 'section');
  // An empty survey is said once, above, not page by page.
  for (const h of survey && placed.length === 0 ? [] : holders) {
    if (h.children.length) continue;
    const step = h.type === 'step';
    const others = (step ? steps : sections).length > 1;
    found.push({
      at: h.id,
      severity: 'should',
      text: step ? `“${holderName(h)}” has no questions: people would see an empty page.` : `“${holderName(h)}” has no fields: it would show as an empty box.`,
      ...(others ? { fix: { label: step ? 'Delete the page' : 'Delete the section', action: { kind: 'remove', id: h.id } as CheckFix } } : {}),
    });
  }

  // A rule waiting for an answer the question no longer offers.
  for (const target of withRules(page)) {
    const condition = readCondition(target.invisible);
    if (!condition || condition === 'custom') continue;
    condition.rules.forEach((rule, index) => {
      const tested = page.fields[rule.field];
      if (rule.op !== 'is' || tested?.type !== 'selection' || typeof rule.value !== 'string' || tested.options.some((o) => o.value === rule.value)) return;
      const never = condition.join === 'all';
      found.push({
        at: target.id,
        severity: never ? 'must' : 'should',
        text: never
          ? `“${target.name}” shows only when ${tested.label} is “${rule.value}”, which ${tested.label} no longer offers, so it never shows.`
          : `“${target.name}”: the rule “${tested.label} is ${rule.value}” can never hold, as ${tested.label} no longer offers it.`,
        fix: { label: 'Remove that rule', action: { kind: 'drop-rule', id: target.id, rule: index } },
      });
    });
  }

  // Two reading the same on one page: a survey's page, or the whole screen.
  const seen = new Map<string, string>();
  const pageOf = (p: Placed) => (survey ? (containers(page).find((c) => (c as Holder).type === 'step' && c.children.some((n) => n === p.node || containsNode(n, p.node)))?.id ?? '') : '');
  for (const p of placed) {
    const label = labelOf(p).trim();
    if (!label || UNTITLED.test(label)) continue;
    const key = `${pageOf(p)}\n${label.toLowerCase()}`;
    if (!seen.has(key)) {
      seen.set(key, p.node.id);
      continue;
    }
    found.push({
      at: p.node.id,
      severity: 'should',
      text: survey ? `Two questions read “${label}”: people may not tell them apart.` : `Two fields read “${label}”: people may not tell them apart.`,
      fix: { label: 'Rename the second', action: { kind: 'go', id: p.node.id, part: 'label' } },
    });
  }

  // What would stop people comes before what would only read wrong.
  return [...found.filter((c) => c.severity === 'must'), ...found.filter((c) => c.severity === 'should')];
}

/** What a check's fix needs of the designer. */
export interface CheckFixer extends RuleFixer {
  getPage(): Page;
  removeNode(id: string): boolean;
  setCondition(id: string, condition: Condition | null): boolean;
  select(id: string | null): void;
}

/** Whether a part holds another, at any depth. */
function containsNode(holder: unknown, node: FieldNode): boolean {
  const children = (holder as { children?: unknown[] }).children;
  return !!children?.some((child) => child === node || containsNode(child, node));
}

/** Do what a check's fix says. Going to an element only picks it: the editor puts the cursor where the fix says. */
export function fixCheck(designer: CheckFixer, check: PageCheck): boolean {
  const action = check.fix?.action;
  if (!action) return false;
  if (action.kind === 'go') {
    designer.select(action.id);
    return true;
  }
  if (action.kind === 'remove') return designer.removeNode(action.id);
  if (action.kind === 'remove-rule') return fixRuleCheck(designer, action);
  const target = withRules(designer.getPage()).find((t) => t.id === action.id);
  const condition = readCondition(target?.invisible);
  if (!condition || condition === 'custom') return false;
  const rules = condition.rules.filter((_, i) => i !== action.rule);
  return designer.setCondition(action.id, rules.length ? { join: condition.join, rules } : null);
}

// ---- what changed since the last version ------------------------------------------------------------

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;

function firstVersion(page: Page): string {
  const layout = page.layout;
  if (layout.type === 'list') return `The first version: ${plural(layout.columns.length, 'column')}`;
  const fields = placedFields(page).length;
  if (page.data.kind === 'responses') return `The first version: ${plural(fields, 'question')} on ${plural(parts(page).filter((h) => h.type === 'step').length, 'page')}`;
  return `The first version: ${plural(fields, 'field')} in ${plural(parts(page).filter((h) => h.type === 'section').length, 'section')}`;
}

const required = (p: Placed) => p.field.required === true || p.node.required === true;
const ruleOf = (invisible: unknown) => (invisible === undefined || invisible === null || invisible === '' || invisible === false ? null : JSON.stringify(invisible));

function whenItShows(name: string, before: unknown, after: unknown, noun: string): string | null {
  const [was, now] = [ruleOf(before), ruleOf(after)];
  if (was === now) return null;
  if (!was) return `“${name}” now shows only for some ${noun}`;
  if (!now) return `“${name}” now always shows`;
  return `“${name}”: when it shows changed`;
}

/** Each change from one version of a page to the next, in words; nothing when nothing changed. */
export function pageChanges(before: Page | null, after: Page): string[] {
  if (!before) return [firstVersion(after)];
  if (JSON.stringify(before) === JSON.stringify(after)) return [];
  const out: string[] = [];
  const survey = after.data.kind === 'responses';
  const answers = survey ? 'answers' : 'records';
  if ((before.title ?? '') !== (after.title ?? '')) out.push(`Title: “${before.title ?? ''}” → “${after.title ?? ''}”`);
  if ((before.description ?? '') !== (after.description ?? '')) out.push('The description changed');
  out.push(...lookChanges(before, after));
  const layout = layoutChanges(before, after);
  const at = (id: string) => (layout.placed.has(id) ? ` ${layout.placed.get(id)}` : '');

  // Pages, sections and tabs.
  const wasParts = new Map(parts(before).map((h) => [h.id, h]));
  const nowParts = new Map(parts(after).map((h) => [h.id, h]));
  const kindOf = (h: Holder) => (h.type === 'step' ? 'page' : h.type === 'tab' ? 'tab' : 'section');
  for (const [id, h] of nowParts) if (!wasParts.has(id) && !layout.said.has(id)) out.push(`Added the ${kindOf(h)} “${holderName(h)}”${at(id)}`);
  for (const [id, h] of wasParts) if (!nowParts.has(id) && !layout.said.has(id)) out.push(`Removed the ${kindOf(h)} “${holderName(h)}”`);
  for (const [id, h] of nowParts) {
    const was = wasParts.get(id);
    if (!was) continue;
    if (holderName(was) !== holderName(h)) out.push(`Renamed the ${kindOf(h)} “${holderName(was)}” to “${holderName(h)}”`);
    const shows = whenItShows(holderName(h), was.invisible, h.invisible, answers);
    if (shows) out.push(shows);
  }

  // Questions and fields.
  const wasFields = new Map(placedFields(before).map((p) => [p.node.id, p]));
  const nowFields = placedFields(after);
  const nowIds = new Set(nowFields.map((p) => p.node.id));
  for (const p of nowFields) if (!wasFields.has(p.node.id)) out.push(`Added “${labelOf(p)}”${at(p.node.id)}`);
  for (const [id, p] of wasFields) if (!nowIds.has(id)) out.push(`Removed “${labelOf(p)}”`);
  for (const p of nowFields) {
    const was = wasFields.get(p.node.id);
    if (!was) continue;
    const name = labelOf(p);
    if (labelOf(was) !== name) out.push(`Renamed “${labelOf(was)}” to “${name}”`);
    if ((was.field.help ?? '') !== (p.field.help ?? '') || (was.node as { help?: string }).help !== (p.node as { help?: string }).help) out.push(`“${name}”: its help changed`);
    if (required(was) !== required(p)) out.push(required(p) ? `“${name}” is now required` : `“${name}” is no longer required`);
    const [k0, k1] = [kindOfField(was.field, was.node), kindOfField(p.field, p.node)];
    if (k0 !== k1) out.push(`“${name}” is now ${k1 ? kindById(k1).label : 'shown its own way'}`);
    if (was.field.type === 'selection' && p.field.type === 'selection') {
      const old = new Set(was.field.options.map((o) => o.value));
      const now = new Set(p.field.options.map((o) => o.value));
      const added = p.field.options.filter((o) => !old.has(o.value));
      const gone = was.field.options.filter((o) => !now.has(o.value));
      for (const o of added) out.push(`“${name}”: added the option “${o.label}”`);
      for (const o of gone) out.push(`“${name}”: removed the option “${o.label}”`);
      if (!added.length && !gone.length && JSON.stringify(was.field.options) !== JSON.stringify(p.field.options)) out.push(`“${name}”: its options changed`);
      if (!was.field.other !== !p.field.other) out.push(p.field.other ? `“${name}”: takes an answer of its own (“Other”)` : `“${name}”: no longer takes an answer of its own`);
    }
    if (JSON.stringify(was.node.options ?? {}) !== JSON.stringify(p.node.options ?? {})) out.push(`“${name}”: how it shows changed`);
    if (was.field.type === 'binary' && p.field.type === 'binary' && JSON.stringify([was.field.accept, was.field.maxSize]) !== JSON.stringify([p.field.accept, p.field.maxSize])) out.push(`“${name}”: the files it takes changed`);
    const shows = whenItShows(name, was.node.invisible, p.node.invisible, answers);
    if (shows) out.push(shows);
    if (was.holder.id !== p.holder.id && !layout.said.has(p.node.id)) out.push(`Moved “${name}” to “${placeName(after, p.holder)}”`);
  }
  out.push(...layout.lines);
  // In the same group, but in another order, and not put beside another.
  const nowHolder = new Map(nowFields.map((p) => [p.node.id, p.holder.id]));
  for (const [id, order] of layout.after.order) {
    // The fields that were here and still are, in each version's order.
    const stayed = (ids: string[]) => ids.filter((n) => wasFields.get(n)?.holder.id === id && nowHolder.get(n) === id && !layout.said.has(n));
    if (stayed(layout.before.order.get(id) ?? []).join() === stayed(order).join()) continue;
    const where = placeName(after, layout.after.node.get(id) as Holder);
    out.push(survey ? `Reordered the questions on “${where}”` : `Reordered the fields in “${where}”`);
  }

  out.push(...headerChanges(before, after), ...listChanges(before, after));
  out.push(...ruleChanges(before, after));
  out.push(...translationChanges(before, after));
  // Something changed that has no words of its own here: say so rather than nothing.
  return out.length ? out : ['Other changes to the page’s settings'];
}

function headerChanges(before: Page, after: Page): string[] {
  const [a, b] = [before.layout, after.layout];
  if (a.type !== 'sheet' || b.type !== 'sheet') return [];
  const out: string[] = [];
  const kinds = [['buttons', 'button'], ['statButtons', 'counter'], ['badges', 'badge']] as const;
  for (const [key, word] of kinds) {
    const was = new Map((a[key] ?? []).map((p) => [p.id, p.label]));
    const now = new Map((b[key] ?? []).map((p) => [p.id, p.label]));
    for (const [id, label] of now) if (!was.has(id)) out.push(`Added the ${word} “${label}”`);
    for (const [id, label] of was) if (!now.has(id)) out.push(`Removed the ${word} “${label}”`);
    for (const [id, label] of now) if (was.has(id) && was.get(id) !== label) out.push(`Renamed the ${word} “${was.get(id)}” to “${label}”`);
  }
  if (a.statusbar?.field !== b.statusbar?.field) out.push(b.statusbar ? `Status steps from “${after.fields[b.statusbar.field]?.label ?? b.statusbar.field}”` : 'Removed the status steps');
  return out;
}

function listChanges(before: Page, after: Page): string[] {
  const [a, b] = [before.layout, after.layout];
  if (a.type !== 'list' || b.type !== 'list') return [];
  const out: string[] = [];
  const name = (page: Page, field: string) => page.fields[field]?.label ?? field;
  for (const c of b.columns) if (!a.columns.includes(c)) out.push(`Added the column “${name(after, c)}”`);
  for (const c of a.columns) if (!b.columns.includes(c)) out.push(`Removed the column “${name(before, c)}”`);
  const kept = (cols: string[], other: string[]) => cols.filter((c) => other.includes(c)).join();
  if (kept(a.columns, b.columns) !== kept(b.columns, a.columns)) out.push('Reordered the columns');
  if ((a.pageSize ?? 40) !== (b.pageSize ?? 40)) out.push(`Rows on a page: ${a.pageSize ?? 40} → ${b.pageSize ?? 40}`);
  if (JSON.stringify(a.sort ?? []) !== JSON.stringify(b.sort ?? [])) out.push('The order of the list changed');
  if (JSON.stringify(a.searchFields ?? []) !== JSON.stringify(b.searchFields ?? [])) out.push('Where the search looks changed');
  const wasFilters = new Map((a.filters ?? []).map((f) => [f.id, f.label]));
  const nowFilters = new Map((b.filters ?? []).map((f) => [f.id, f.label]));
  for (const [id, label] of nowFilters) if (!wasFilters.has(id)) out.push(`Added the filter “${label}”`);
  for (const [id, label] of wasFilters) if (!nowFilters.has(id)) out.push(`Removed the filter “${label}”`);
  if (JSON.stringify(a.groupBy ?? []) !== JSON.stringify(b.groupBy ?? [])) out.push('The groupings changed');
  const wasActions = new Map((a.actions ?? []).map((x) => [x.id, x.label]));
  const nowActions = new Map((b.actions ?? []).map((x) => [x.id, x.label]));
  for (const [id, label] of nowActions) if (!wasActions.has(id)) out.push(`Added the button “${label}”`);
  for (const [id, label] of wasActions) if (!nowActions.has(id)) out.push(`Removed the button “${label}”`);
  return out;
}
