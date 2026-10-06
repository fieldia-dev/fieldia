import { validatePage, type Field, type FieldNode, type Page } from '@fieldia/core';
import { readCondition, type Condition } from './conditions';
import { kindById, kindOfField } from './kinds';
import { inputChanges } from './input-changes';
import { structureChanges } from './structure-changes';
import { holderName as placeName, layoutChanges, lookChanges, placements } from './layout-changes';
import { isWrapper } from './layout-tree';
import { containers, type Container } from './page-tree';
import { translationChanges } from './translations';
import { ruleChanges } from './rules-changes';
import { fixRuleCheck, ruleChecks, type RuleFix, type RuleFixer } from './rules-checks';
import { isDefaultOption, isUntitled, type DesignerWords } from './designer-words';
import { en } from './locales/en';
import { kindName } from './kinds';
import { formChecks, SAID_BY_FORM_CHECKS, type SavedFormsCache } from './saved-forms';
import { fixStepCheck, stepChanges, stepChecks, type StepFix, type StepFixer } from './steps-checks';

/**
 * Before a page is published: what people would trip over, each with a fix
 * where there is one, the ones that would stop them first; and what changed
 * since the last version, in words, for the Publish dialog.
 *
 * A required field a rule hides is not one of them: the form asks only the
 * fields on show, so it is required only when shown, as it should be.
 */

export type CheckFix = { kind: 'go'; id: string; part: 'label' | 'options' } | { kind: 'remove'; id: string } | { kind: 'drop-rule'; id: string; rule: number } | RuleFix | StepFix;

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
const holderName = (holder: Holder, words: DesignerWords = en) => holder.label || holder.title || words.parts.untitledSection;

/** Every element with its own `invisible`: fields, and the steps and sections that hold them. */
function withRules(page: Page, words: DesignerWords = en): { id: string; name: string; invisible: unknown }[] {
  return [
    ...parts(page).map((h) => ({ id: h.id, name: holderName(h, words), invisible: h.invisible })),
    ...placedFields(page).map((p) => ({ id: p.node.id, name: labelOf(p), invisible: p.node.invisible })),
  ];
}

/**
 * What people would trip over on the page. `valid` says the page is known to
 * pass `validatePage`, as each page the designer keeps is: it is not checked
 * against the format again, which on a big page is most of the time it takes.
 */
export function pageChecks(page: Page, options: { valid?: boolean; words?: DesignerWords; forms?: SavedFormsCache | null } = {}): PageCheck[] {
  const words = options.words ?? en;
  const w = words.checks;
  const found: PageCheck[] = [];
  const checked = options.valid ? null : validatePage(page);
  const rules = ruleChecks(page, words);
  // steps lane: what the page's parts do — on a page written by hand, the page's own check said by part and step.
  const doing = stepChecks(page, checked && !checked.ok ? checked.issues : [], words);
  // A page written by hand can be wrong in ways the designer would never let it be; what the rules' checks — and the saved forms', and the steps' — say in words is not said again.
  if (checked && !checked.ok) {
    for (const issue of checked.issues) if (!rules.covers(issue.path) && !doing.covers(issue.path) && !SAID_BY_FORM_CHECKS.test(issue.message)) found.push({ at: null, severity: 'must', text: w.invalid(issue.path, issue.message) });
  }
  found.push(...rules.checks, ...doing.checks);
  // embed lane: saved forms placed in the page that cannot be found, would hold it, or would mix their answers.
  found.push(...formChecks(page, options.forms ?? null, words));
  const survey = page.data.kind === 'responses';
  const placed = placedFields(page);
  if (survey && placed.length === 0) found.push({ at: null, severity: 'must', text: w.noQuestions });

  // What a question still lacks.
  for (const p of placed) {
    const label = labelOf(p);
    if (!label.trim() || isUntitled(label)) {
      found.push({ at: p.node.id, severity: 'should', text: w.noWords(survey, label.trim() || '…'), fix: { label: w.typeItsWords, action: { kind: 'go', id: p.node.id, part: 'label' } } });
    }
    if (p.field.type === 'selection' && p.field.options.length && p.field.options.every((o) => isDefaultOption(o.label))) {
      found.push({
        at: p.node.id,
        severity: 'should',
        text: w.defaultOptions(label, p.field.options.map((o) => o.label)),
        fix: { label: w.typeItsOptions, action: { kind: 'go', id: p.node.id, part: 'options' } },
      });
    }
  }

  // A picture with no description says nothing to those who cannot see it; one that is a link is a link with no name.
  for (const c of containers(page)) {
    for (const image of c.children) {
      if (image.type !== 'image' || image.alt.trim()) continue;
      found.push({
        at: image.id,
        severity: 'should',
        text: image.href ? w.linkedPicture : w.picture,
        fix: { label: w.describeIt, action: { kind: 'go', id: image.id, part: 'label' } },
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
      text: step ? w.emptyPage(holderName(h, words)) : w.emptySection(holderName(h, words)),
      ...(others ? { fix: { label: step ? w.deletePage : w.deleteSection, action: { kind: 'remove', id: h.id } as CheckFix } } : {}),
    });
  }

  // A rule waiting for an answer the question no longer offers.
  for (const target of withRules(page, words)) {
    const condition = readCondition(target.invisible);
    if (!condition || condition === 'custom') continue;
    condition.rules.forEach((rule, index) => {
      const tested = page.fields[rule.field];
      // A field the page does not have: the rules' own checks say so, with their fix.
      if (!tested) return;
      if (rule.op !== 'is' || tested?.type !== 'selection' || typeof rule.value !== 'string' || tested.options.some((o) => o.value === rule.value)) return;
      const never = condition.join === 'all';
      found.push({
        at: target.id,
        severity: never ? 'must' : 'should',
        text: never ? w.neverShows(target.name, tested.label, rule.value) : w.neverHolds(target.name, tested.label, rule.value),
        fix: { label: w.removeTheRule, action: { kind: 'drop-rule', id: target.id, rule: index } },
      });
    });
  }

  // Two reading the same on one page: a survey's page, or the whole screen.
  const seen = new Map<string, string>();
  const stepOf = survey ? stepsHolding(page) : null;
  const pageOf = (p: Placed) => stepOf?.get(p.node) ?? '';
  for (const p of placed) {
    const label = labelOf(p).trim();
    if (!label || isUntitled(label)) continue;
    const key = `${pageOf(p)}\n${label.toLowerCase()}`;
    if (!seen.has(key)) {
      seen.set(key, p.node.id);
      continue;
    }
    found.push({
      at: p.node.id,
      severity: 'should',
      text: survey ? w.twoQuestions(label) : w.twoFields(label),
      fix: { label: w.renameSecond, action: { kind: 'go', id: p.node.id, part: 'label' } },
    });
  }

  // What would stop people comes before what would only read wrong.
  return [...found.filter((c) => c.severity === 'must'), ...found.filter((c) => c.severity === 'should')];
}

/** What a check's fix needs of the designer. */
export interface CheckFixer extends RuleFixer, StepFixer {
  getPage(): Page;
  removeNode(id: string): boolean;
  setCondition(id: string, condition: Condition | null): boolean;
  select(id: string | null): void;
}

/** The survey's page each part is on, at any depth: found in one walk, not one for each question. */
function stepsHolding(page: Page): Map<unknown, string> {
  const on = new Map<unknown, string>();
  const walk = (holder: unknown, step: string) => {
    for (const child of (holder as { children?: unknown[] }).children ?? []) {
      if (!on.has(child)) on.set(child, step);
      walk(child, step);
    }
  };
  for (const c of containers(page)) if ((c as Holder).type === 'step') walk(c, c.id);
  return on;
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
  if (action.kind === 'remove-step' || action.kind === 'remove-steps') return fixStepCheck(designer, action);
  const target = withRules(designer.getPage()).find((t) => t.id === action.id);
  const condition = readCondition(target?.invisible);
  if (!condition || condition === 'custom') return false;
  const rules = condition.rules.filter((_, i) => i !== action.rule);
  return designer.setCondition(action.id, rules.length ? { join: condition.join, rules } : null);
}

// ---- what changed since the last version ------------------------------------------------------------

function firstVersion(page: Page, words: DesignerWords): string {
  const w = words.changes;
  const layout = page.layout;
  if (layout.type === 'list') return w.firstList(layout.columns.length);
  const fields = placedFields(page).length;
  if (page.data.kind === 'responses') return w.firstSurvey(fields, parts(page).filter((h) => h.type === 'step').length);
  return w.firstScreen(fields, parts(page).filter((h) => h.type === 'section').length);
}

const required = (p: Placed) => p.field.required === true || p.node.required === true;
const ruleOf = (invisible: unknown) => (invisible === undefined || invisible === null || invisible === '' || invisible === false ? null : JSON.stringify(invisible));

function whenItShows(name: string, before: unknown, after: unknown, survey: boolean, words: DesignerWords): string | null {
  const [was, now] = [ruleOf(before), ruleOf(after)];
  if (was === now) return null;
  if (!was) return words.changes.showsForSome(name, survey);
  if (!now) return words.changes.alwaysShows(name);
  return words.changes.whenShowsChanged(name);
}

/** Each change from one version of a page to the next, in words; nothing when nothing changed. */
export function pageChanges(before: Page | null, after: Page, words: DesignerWords = en): string[] {
  const w = words.changes;
  if (!before) return [firstVersion(after, words)];
  if (JSON.stringify(before) === JSON.stringify(after)) return [];
  const out: string[] = [];
  const survey = after.data.kind === 'responses';
  if ((before.title ?? '') !== (after.title ?? '')) out.push(w.title(before.title ?? '', after.title ?? ''));
  if ((before.description ?? '') !== (after.description ?? '')) out.push(w.description);
  out.push(...lookChanges(before, after, words));
  const layout = layoutChanges(before, after, words);
  const at = (id: string) => layout.placed.get(id) ?? '';

  // Pages, sections and tabs.
  const wasParts = new Map(parts(before).map((h) => [h.id, h]));
  const nowParts = new Map(parts(after).map((h) => [h.id, h]));
  const kindOf = (h: Holder) => (h.type === 'step' ? 'page' : h.type === 'tab' ? 'tab' : 'section');
  const named = (h: Holder) => holderName(h, words);
  for (const [id, h] of nowParts) if (!wasParts.has(id) && !layout.said.has(id)) out.push(w.addedPart(kindOf(h), named(h), at(id)));
  for (const [id, h] of wasParts) if (!nowParts.has(id) && !layout.said.has(id)) out.push(w.removedPart(kindOf(h), named(h)));
  for (const [id, h] of nowParts) {
    const was = wasParts.get(id);
    if (!was) continue;
    if (named(was) !== named(h)) out.push(w.renamedPart(kindOf(h), named(was), named(h)));
    const shows = whenItShows(named(h), was.invisible, h.invisible, survey, words);
    if (shows) out.push(shows);
  }

  // Questions and fields.
  const wasFields = new Map(placedFields(before).map((p) => [p.node.id, p]));
  const nowFields = placedFields(after);
  const nowIds = new Set(nowFields.map((p) => p.node.id));
  for (const p of nowFields) if (!wasFields.has(p.node.id)) out.push(w.added(labelOf(p), at(p.node.id)));
  for (const [id, p] of wasFields) if (!nowIds.has(id)) out.push(w.removed(labelOf(p)));
  for (const p of nowFields) {
    const was = wasFields.get(p.node.id);
    if (!was) continue;
    const name = labelOf(p);
    if (labelOf(was) !== name) out.push(w.renamed(labelOf(was), name));
    if ((was.field.help ?? '') !== (p.field.help ?? '') || (was.node as { help?: string }).help !== (p.node as { help?: string }).help) out.push(w.helpChanged(name));
    if (required(was) !== required(p)) out.push(required(p) ? w.nowRequired(name) : w.noLongerRequired(name));
    const [k0, k1] = [kindOfField(was.field, was.node), kindOfField(p.field, p.node)];
    if (k0 !== k1) out.push(k1 ? w.nowKind(name, kindName(kindById(k1), words)) : w.nowOwnWay(name));
    if (was.field.type === 'selection' && p.field.type === 'selection') {
      const old = new Set(was.field.options.map((o) => o.value));
      const now = new Set(p.field.options.map((o) => o.value));
      const added = p.field.options.filter((o) => !old.has(o.value));
      const gone = was.field.options.filter((o) => !now.has(o.value));
      for (const o of added) out.push(w.addedOption(name, o.label));
      for (const o of gone) out.push(w.removedOption(name, o.label));
      if (!added.length && !gone.length && JSON.stringify(was.field.options) !== JSON.stringify(p.field.options)) out.push(w.optionsChanged(name));
      if (!was.field.other !== !p.field.other) out.push(p.field.other ? w.takesOther(name) : w.noOther(name));
    }
    const settings = inputChanges(name, was, p, words);
    out.push(...settings.lines);
    out.push(...fileChanges(name, was, p, words));
    out.push(...structureChanges(name, was, p, words));
    // How it shows, beyond what the files' own words and the inputs' said.
    if (settings.unsaid.some((key) => !isFiles(p.field) || (key !== 'files' && key !== 'camera'))) out.push(w.showsChanged(name));
    const shows = whenItShows(name, was.node.invisible, p.node.invisible, survey, words);
    if (shows) out.push(shows);
    if (was.holder.id !== p.holder.id && !layout.said.has(p.node.id)) out.push(w.moved(name, placeName(after, p.holder, words)));
  }
  out.push(...layout.lines);
  // In the same group, but in another order, and not put beside another.
  const nowHolder = new Map(nowFields.map((p) => [p.node.id, p.holder.id]));
  for (const [id, order] of layout.after.order) {
    // The fields that were here and still are, in each version's order.
    const stayed = (ids: string[]) => ids.filter((n) => wasFields.get(n)?.holder.id === id && nowHolder.get(n) === id && !layout.said.has(n));
    if (stayed(layout.before.order.get(id) ?? []).join() === stayed(order).join()) continue;
    const where = placeName(after, layout.after.node.get(id) as Holder, words);
    out.push(survey ? w.reorderedQuestions(where) : w.reorderedFields(where));
  }

  out.push(...headerChanges(before, after, words), ...listChanges(before, after, words));
  out.push(...ruleChanges(before, after, words));
  out.push(...stepChanges(before, after, words));
  out.push(...translationChanges(before, after, words));
  // Something changed that has no words of its own here: say so rather than nothing.
  return out.length ? out : [w.other];
}

const isFiles = (field: Field) => field.type === 'binary' || field.type === 'image';

/** A file upload's or an image's: the files it takes, how many, how the chosen ones show, a phone's camera. */
function fileChanges(name: string, was: { field: Field; node: FieldNode }, now: { field: Field; node: FieldNode }, words: DesignerWords): string[] {
  const w = words.changes;
  const [a, b] = [was.field, now.field];
  if (a.type !== b.type || (b.type !== 'binary' && b.type !== 'image') || (a.type !== 'binary' && a.type !== 'image')) return [];
  const out: string[] = [];
  if (JSON.stringify(['accept' in a ? a.accept : 0, a.maxSize]) !== JSON.stringify(['accept' in b ? b.accept : 0, b.maxSize])) out.push(w.filesTaken(name));
  if (!a.multiple !== !b.multiple) out.push(b.multiple ? w.severalFiles(name) : w.oneFile(name));
  else if (b.multiple && (a.minFiles !== b.minFiles || a.maxFiles !== b.maxFiles)) {
    const [least, most] = [b.minFiles, b.maxFiles];
    out.push(least !== undefined && most !== undefined ? w.filesFromTo(name, least, most) : most !== undefined ? w.filesUpTo(name, most) : least !== undefined ? w.filesAtLeast(name, least) : w.filesAny(name));
  }
  const option = (q: { node: FieldNode }, key: string) => q.node.options?.[key];
  const shownAs = (q: { node: FieldNode; field: Field }) => option(q, 'files') ?? (q.field.type === 'image' ? 'thumbnails' : 'list');
  if (shownAs(was) !== shownAs(now)) out.push(w.filesShownAs(name, shownAs(now) === 'thumbnails'));
  const camera = (q: { node: FieldNode }) => (option(q, 'camera') ? (option(q, 'camera') === 'user' ? 'front' : 'rear') : null);
  if (camera(was) !== camera(now)) out.push(camera(now) ? w.camera(name, camera(now) === 'front') : w.noCamera(name));
  return out;
}

function headerChanges(before: Page, after: Page, words: DesignerWords): string[] {
  const w = words.changes;
  const [a, b] = [before.layout, after.layout];
  if (a.type !== 'sheet' || b.type !== 'sheet') return [];
  const out: string[] = [];
  const kinds = [['buttons', 'button'], ['statButtons', 'counter'], ['badges', 'badge']] as const;
  for (const [key, word] of kinds) {
    const was = new Map((a[key] ?? []).map((p) => [p.id, p.label]));
    const now = new Map((b[key] ?? []).map((p) => [p.id, p.label]));
    for (const [id, label] of now) if (!was.has(id)) out.push(w.addedHeader(word, label));
    for (const [id, label] of was) if (!now.has(id)) out.push(w.removedHeader(word, label));
    for (const [id, label] of now) if (was.has(id) && was.get(id) !== label) out.push(w.renamedHeader(word, was.get(id) as string, label));
  }
  if (a.statusbar?.field !== b.statusbar?.field) out.push(b.statusbar ? w.statusFrom(after.fields[b.statusbar.field]?.label ?? b.statusbar.field) : w.noStatus);
  return out;
}

function listChanges(before: Page, after: Page, words: DesignerWords): string[] {
  const w = words.changes;
  const [a, b] = [before.layout, after.layout];
  if (a.type !== 'list' || b.type !== 'list') return [];
  const out: string[] = [];
  const name = (page: Page, field: string) => page.fields[field]?.label ?? field;
  for (const c of b.columns) if (!a.columns.includes(c)) out.push(w.addedColumn(name(after, c)));
  for (const c of a.columns) if (!b.columns.includes(c)) out.push(w.removedColumn(name(before, c)));
  const kept = (cols: string[], other: string[]) => cols.filter((c) => other.includes(c)).join();
  if (kept(a.columns, b.columns) !== kept(b.columns, a.columns)) out.push(w.reorderedColumns);
  if ((a.pageSize ?? 40) !== (b.pageSize ?? 40)) out.push(w.rowsOnPage(a.pageSize ?? 40, b.pageSize ?? 40));
  if (JSON.stringify(a.sort ?? []) !== JSON.stringify(b.sort ?? [])) out.push(w.listOrder);
  if (JSON.stringify(a.searchFields ?? []) !== JSON.stringify(b.searchFields ?? [])) out.push(w.searchLooks);
  const wasFilters = new Map((a.filters ?? []).map((f) => [f.id, f.label]));
  const nowFilters = new Map((b.filters ?? []).map((f) => [f.id, f.label]));
  for (const [id, label] of nowFilters) if (!wasFilters.has(id)) out.push(w.addedFilter(label));
  for (const [id, label] of wasFilters) if (!nowFilters.has(id)) out.push(w.removedFilter(label));
  if (JSON.stringify(a.groupBy ?? []) !== JSON.stringify(b.groupBy ?? [])) out.push(w.groupings);
  const wasActions = new Map((a.actions ?? []).map((x) => [x.id, x.label]));
  const nowActions = new Map((b.actions ?? []).map((x) => [x.id, x.label]));
  for (const [id, label] of nowActions) if (!wasActions.has(id)) out.push(w.addedButton(label));
  for (const [id, label] of wasActions) if (!nowActions.has(id)) out.push(w.removedButton(label));
  return out;
}
