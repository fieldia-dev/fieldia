import type { Page, PageIssue } from '@fieldia/core';
import type { DesignerWords } from './designer-words';
import { en } from './locales/en';
import type { PageCheck } from './page-checks';
import { shownFields } from './page-tree';
import { eachStep, fieldsNamed, fieldsRead, stepsAt, type StepPath, type StepsPlace } from './steps-places';
import { pageSteps, placeName, stepSentence } from './steps-words';

/**
 * What would trip people up in what the page's parts do, each with a fix
 * where there is an obvious one: a step that names or reads a field no
 * longer on the page, a field's change steps once the field has gone, and —
 * on a page written by hand — each problem the page's own check finds in its
 * steps, said by the part and the step it is in. The page's own check is not
 * said again for what these say.
 */

/** Take a step away, or all of a place's. */
export type StepFix = { kind: 'remove-step'; place: StepsPlace; path: StepPath } | { kind: 'remove-steps'; place: StepsPlace };

/** What a fix needs of the designer. */
export interface StepFixer {
  removeStep(place: StepsPlace, path: StepPath): boolean;
  setSteps(place: StepsPlace, steps: []): boolean;
}

export function fixStepCheck(designer: StepFixer, fix: StepFix): boolean {
  return fix.kind === 'remove-step' ? designer.removeStep(fix.place, fix.path) : designer.setSteps(fix.place, []);
}

/** A step's place among its list as a person counts it: "2", "2.1" for the first step once the second's page is saved. */
const numbered = (path: StepPath) => path.map((i) => i + 1).join('.');

/** Whether a step can be taken away: not a button's only one. */
const removable = (page: Page, place: StepsPlace, path: StepPath) => !('press' in place) || path.length > 1 || stepsAt(page, place).length > 1;

/** Where each list of steps is in the page, as the page's own check names it, and the place it is. */
function placePaths(page: Page): { at: string; place: StepsPlace }[] {
  const out: { at: string; place: StepsPlace }[] = [];
  const walk = (node: { id?: string; type?: string; children?: unknown[] }, path: string) => {
    if (node.type === 'button' && node.id) out.push({ at: path, place: { press: node.id } });
    node.children?.forEach((child, i) => walk(child as typeof node, `${path}.children[${i}]`));
  };
  const root = page.layout as unknown as { buttons?: { id: string }[]; statButtons?: { id: string }[]; actions?: { id: string }[]; children?: unknown[] };
  walk(root as { children?: unknown[] }, 'layout');
  for (const key of ['buttons', 'statButtons', 'actions'] as const) root[key]?.forEach((part, i) => out.push({ at: `layout.${key}[${i}]`, place: { press: part.id } }));
  for (const moment of ['open', 'beforeSave', 'afterSave'] as const) out.push({ at: `on.${moment}`, place: { moment } });
  for (const field of Object.keys(page.on?.change ?? {})) out.push({ at: `on.change.${field}`, place: { change: field } });
  for (const id of Object.keys(page.on?.show ?? {})) out.push({ at: `on.show.${id}`, place: { show: id } });
  return out;
}

/** The step a path names within a place's path: `[1].then[0].field` is step 2.1. */
function stepPathIn(rest: string): StepPath {
  const path: StepPath = [];
  const each = /^(?:\.steps)?\[(\d+)\]|^\.then\[(\d+)\]/;
  for (let left = rest, match = each.exec(left); match; left = left.slice(match[0].length), match = each.exec(left)) path.push(Number(match[1] ?? match[2]));
  return path;
}

export function stepChecks(page: Page, issues: readonly PageIssue[], words: DesignerWords = en): { checks: PageCheck[]; covers(path: string): boolean } {
  const w = words.steps;
  const checks: PageCheck[] = [];
  const covered: string[] = [];
  const partOf = (place: StepsPlace) => ('press' in place ? place.press : null);

  // A page written by hand: the page's own check, said by part and step.
  const places = placePaths(page).sort((a, b) => b.at.length - a.at.length);
  for (const issue of issues) {
    const found = places.find(({ at }) => issue.path === at || issue.path.startsWith(`${at}.`) || issue.path.startsWith(`${at}[`));
    if (!found) continue;
    const path = stepPathIn(issue.path.slice(found.at.length));
    const name = placeName(page, found.place, words);
    covered.push(issue.path);
    checks.push({
      at: partOf(found.place),
      severity: 'must',
      text: path.length ? w.stepWrong(name, numbered(path), issue.message) : w.placeWrong(name, issue.message),
      ...(path.length && removable(page, found.place, path)
        ? { fix: { label: w.removeTheStep, action: { kind: 'remove-step', place: found.place, path } as StepFix } }
        : !path.length && !('press' in found.place)
          ? { fix: { label: w.removeTheSteps, action: { kind: 'remove-steps', place: found.place } as StepFix } }
          : {}),
    });
  }
  if (issues.length) return { checks, covers: (path) => covered.includes(path) };

  // A page the designer keeps: what its steps name that is no longer on it.
  const shown = shownFields(page);
  const label = (name: string) => page.fields[name]?.label || name;
  const severity = (gone: string[]) => (page.data.kind === 'responses' || gone.some((name) => !page.fields[name]) ? 'must' : 'should');
  for (const entry of pageSteps(page, words)) {
    if ('change' in entry.place && !shown.has(entry.place.change)) {
      checks.push({ at: null, severity: severity([entry.place.change]), text: w.changeGone(label(entry.place.change)), fix: { label: w.removeTheSteps, action: { kind: 'remove-steps', place: entry.place } as StepFix } });
      continue;
    }
    for (const { step, path } of eachStep(stepsAt(page, entry.place))) {
      const gone = [...new Set([...fieldsNamed(step), ...fieldsRead(step)])].filter((name) => !shown.has(name));
      if (!gone.length) continue;
      checks.push({
        at: entry.part,
        severity: severity(gone),
        text: w.namesGone(entry.name, stepSentence(page, step, words), gone.map(label)),
        ...(removable(page, entry.place, path) ? { fix: { label: w.removeTheStep, action: { kind: 'remove-step', place: entry.place, path } as StepFix } } : {}),
      });
    }
  }
  return { checks, covers: (path) => covered.includes(path) };
}

/** What changed in what the page's parts do, from one version to the next, in words: a list each, by its part. */
export function stepChanges(before: Page, after: Page, words: DesignerWords = en): string[] {
  const w = words.steps;
  const lists = (page: Page) => new Map(pageSteps(page, words).map((entry) => [JSON.stringify(entry.place), { entry, steps: JSON.stringify(stepsAt(page, entry.place)) }]));
  const [was, now] = [lists(before), lists(after)];
  const out: string[] = [];
  for (const key of new Set([...was.keys(), ...now.keys()])) {
    const [a, b] = [was.get(key), now.get(key)];
    if (a?.steps === b?.steps) continue;
    const entry = (b ?? a)?.entry;
    if (!entry) continue;
    out.push('moment' in entry.place || 'show' in entry.place ? w.changedMoment(entry.name) : w.changedSteps(entry.name));
  }
  return out;
}
