import type { ActionStep, Page } from '@fieldia/core';
import type { DesignerWords } from './designer-words';
import { en } from './locales/en';
import { containers } from './page-tree';
import { shownTitle } from './saved-forms';
import { formulaInWords } from './rules-formula';
import { setValueInWords } from './rules-words';
import { eachStep, everyPlace, fieldsNamed, fieldsRead, pressOf, showTargets, type StepsPlace } from './steps-places';

/**
 * Steps as a person reads them: "Open Customer in a panel, then put its
 * answer in Customer", "Set Price to Quantity × 12.5 when Quantity > 0",
 * "Ask: Send the order?", "Run the app’s action check_stock". Fields by their
 * labels, formulas in words, a page opened by its title where the app's saved
 * pages give one. The steps editor, the Rules view, the marks on the canvas
 * and the checks all read steps through here.
 */

/** A saved page by its id, when the app's saved pages have it: its title and its fields' labels say what a step opens. */
export type SavedPageOf = (id: string) => Page | null | undefined;

const labelOf = (page: Page, name: string) => page.fields[name]?.label || name;

/** A step in words, without the steps it runs once a page it opened is saved. */
export function stepSentence(page: Page, step: ActionStep, words: DesignerWords = en, saved: SavedPageOf = () => undefined): string {
  const w = words.steps;
  const field = (name: string) => labelOf(page, name);
  const formula = (source: string) => formulaInWords(page, source, words);
  let said: string;
  switch (step.do) {
    case 'open': {
      // The condition before what comes back, so it reads as the page's: "Open Customer in a panel when VIP is Yes, then …".
      const other = saved(step.page);
      const opened = w.open(shownTitle(other, page.language) || w.unknownPage(step.page), step.as ?? 'dialog');
      const record = step.record ? w.onRecord(formula(step.record)) : '';
      const values = Object.keys(step.values ?? {}).map((name) => other?.fields[name]?.label || name);
      const into = Object.keys(step.into ?? {}).map(field);
      const head = `${opened}${record}${values.length ? w.startingWith(values) : ''}`;
      return `${whenOf(page, head, step.when, words)}${into.length ? w.thenPut(into) : ''}`;
    }
    case 'set':
      said = w.set(field(step.field), setValueInWords(page, page.fields[step.field], step.value, words));
      break;
    case 'clear':
      said = w.clear(field(step.field));
      break;
    case 'addLine':
      said = w.addLine(field(step.field));
      break;
    case 'check':
      said = step.fields?.length ? w.checkFields(step.fields.map(field)) : w.checkAll;
      break;
    case 'save':
      said = page.data.kind === 'responses' ? w.send : w.save;
      break;
    case 'reset':
      said = w.reset;
      break;
    case 'goTo':
      said = w.goTo(showTargets(page).find((t) => t.id === step.target)?.label || step.target);
      break;
    case 'say':
      said = step.tone && step.tone !== 'info' ? w.sayTone(step.message, step.tone) : w.say(step.message);
      break;
    case 'ask':
      said = w.ask(step.message);
      break;
    case 'call': {
      const params = Object.keys(step.params ?? {}).length;
      said = params ? w.callWith(step.action, params) : w.call(step.action);
      break;
    }
    case 'close':
      said = w.close;
      break;
  }
  return whenOf(page, said, step.when, words);
}

/** A sentence with when it runs: always, never, or when a condition holds. */
function whenOf(page: Page, sentence: string, when: ActionStep['when'], words: DesignerWords): string {
  if (when === undefined || when === true) return sentence;
  if (when === false) return words.steps.never(sentence);
  return words.steps.when(sentence, formulaInWords(page, when, words));
}

/** A list of steps, one sentence a line, the steps run once an opened page is saved under it. */
export function stepsLines(page: Page, steps: readonly ActionStep[], words: DesignerWords = en, saved?: SavedPageOf): string[] {
  return eachStep(steps).map(({ step, path }) => {
    let line = stepSentence(page, step, words, saved);
    for (let depth = 1; depth < path.length; depth++) line = words.steps.nested(line);
    return line;
  });
}

/** A place's name as a person knows it: a button's words, a field's label, a moment, a tab shown. */
export function placeName(page: Page, place: StepsPlace, words: DesignerWords = en): string {
  const w = words.steps;
  if ('press' in place) return pressOf(page, place.press)?.label ?? place.press;
  if ('change' in place) return labelOf(page, place.change);
  if ('moment' in place) return w.momentNames[place.moment];
  return w.whenShown(showTargets(page).find((t) => t.id === place.show)?.label || place.show);
}

/** Where a place's steps are, among the Rules view's groups. */
export type StepsGroup = 'clicked' | 'changes' | 'moments';

/** Steps in one place, as the Rules view lists them. */
export interface StepsEntry {
  place: StepsPlace;
  group: StepsGroup;
  /** The part it is set on, to pick: a button, a field's place on the page; null for the page's own moments. */
  part: string | null;
  name: string;
  /** One sentence a step. */
  lines: string[];
  /** The fields its steps name or read. */
  reads: string[];
  /** The app's own names in its lines — its actions, a page known only by its id — to keep apart as code. */
  codes: string[];
}

/** Every list of steps on the page, in reading order, said. */
export function pageSteps(page: Page, words: DesignerWords = en, saved?: SavedPageOf): StepsEntry[] {
  return everyPlace(page).map(({ place, steps }) => {
    const group: StepsGroup = 'press' in place ? 'clicked' : 'change' in place ? 'changes' : 'moments';
    const part = 'press' in place ? place.press : 'change' in place ? fieldPlace(page, place.change) : null;
    const reads = [...new Set(eachStep(steps).flatMap(({ step }) => [...fieldsNamed(step), ...fieldsRead(step)]))];
    const codes = [...new Set(eachStep(steps).flatMap(({ step }) => (step.do === 'call' ? [step.action] : step.do === 'open' && !saved?.(step.page) ? [step.page] : [])))];
    return { place, group, part, name: placeName(page, place, words), lines: stepsLines(page, steps, words, saved), reads, codes };
  });
}

/** Words with the app's names in them kept apart as code: each name, where it stands as a word, in a `code` of its own. */
export function withCode(doc: Document, text: string, codes: readonly string[]): Node[] {
  const names = codes.filter(Boolean).sort((a, b) => b.length - a.length);
  if (!names.length) return [doc.createTextNode(text)];
  const escaped = names.map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const pattern = new RegExp(`(?<![\\w-])(${escaped.join('|')})(?![\\w-])`, 'g');
  const out: Node[] = [];
  let at = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > at) out.push(doc.createTextNode(text.slice(at, match.index)));
    const code = doc.createElement('code');
    code.className = 'fd-do-code';
    code.textContent = match[0];
    out.push(code);
    at = match.index + match[0].length;
  }
  if (at < text.length) out.push(doc.createTextNode(text.slice(at)));
  return out;
}

/** Where a field is on the page, by its part's id: the first place it shows; null when it is not on it. */
export function fieldPlace(page: Page, name: string): string | null {
  for (const holder of containers(page)) for (const node of holder.children) if (node.type === 'field' && node.field === name) return node.id;
  return null;
}
