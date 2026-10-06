import type { Page } from '@fieldia/core';
import type { Designer } from './designer';
import { pressOf, showTargets, stepsAt, type StepsPlace } from './steps-places';
import { fieldPlace, pageSteps } from './steps-words';

/**
 * What the canvas says of a part that does something, and going to it. A
 * button that has steps wears a small mark after its words — drawn by its
 * look, so its words stay its own to type in — its steps said when pointed
 * at; a field whose change runs steps wears a mark among its rules' marks
 * (rules-marks.ts). Going to steps picks their part and brings its list
 * forward on the panel: a button's When clicked, a field's When it changes on
 * its Rules tab, the form's moments on the page's.
 */

/** Each button on the canvas that has steps: marked, its steps said; one that has none, not. */
export function pressMarks(container: HTMLElement, page: Page, designer: Designer): void {
  const lines = new Map(pageSteps(page, designer.words).filter((entry) => 'press' in entry.place).map((entry) => [(entry.place as { press: string }).press, entry.lines]));
  for (const part of container.querySelectorAll<HTMLElement>('.fd-canvas-block.fd-button[data-node], .fd-canvas-part[data-part]')) {
    const id = part.dataset['node'] ?? part.dataset['part'] ?? '';
    const said = lines.get(id);
    if (!said || !pressOf(page, id)) {
      if (part.hasAttribute('data-steps')) {
        part.removeAttribute('data-steps');
        if (part.dataset['stepsTitle'] === part.title) part.removeAttribute('title');
        delete part.dataset['stepsTitle'];
      }
      continue;
    }
    const title = `${designer.words.steps.whenClicked}:\n${said.join('\n')}`;
    const count = String(stepsAt(page, { press: id }).length);
    if (part.dataset['steps'] === count && part.title === title) continue;
    part.dataset['steps'] = count;
    // A counter says what its number is from; its steps come after.
    if (!part.title || part.dataset['stepsTitle'] === part.title) {
      part.title = title;
      part.dataset['stepsTitle'] = title;
    }
  }
}

/** The fields whose change runs steps, by the part each shows at, with their steps said: for the rules' marks. */
export function changeMarks(page: Page, designer: Designer): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const entry of pageSteps(page, designer.words)) {
    if (!('change' in entry.place)) continue;
    const part = fieldPlace(page, entry.place.change);
    if (part) out.set(part, entry.lines);
  }
  return out;
}

/** Go to a place's steps: its part picked, its list brought forward on the panel, the cursor on its first step. */
export function openSteps(root: HTMLElement, designer: Designer, place: StepsPlace): void {
  const page = designer.getPage();
  const part = 'press' in place ? place.press : 'change' in place ? fieldPlace(page, place.change) : null;
  designer.select(part);
  const panel = root.querySelector('.fd-properties');
  const tab = 'press' in place ? 'content' : 'rules';
  panel?.querySelector<HTMLButtonElement>(`[role="tab"][data-tab="${tab}"]`)?.click();
  const setting = 'press' in place ? 'When clicked' : 'change' in place ? 'When it changes' : 'When…';
  const row = panel?.querySelector<HTMLElement>(`[data-setting="${setting}"]`);
  if (!row) return;
  // A moment's own list, or a tab's: the one asked for.
  const lists = [...row.querySelectorAll<HTMLElement>('.fd-do')];
  const w = designer.words.steps;
  const label = 'moment' in place ? w.momentNames[place.moment] : 'show' in place ? w.whenShown(showTargets(page).find((t) => t.id === place.show)?.label || place.show) : null;
  const list = label === null ? lists[0] : lists.find((l) => l.getAttribute('aria-label') === label);
  const hand = (list ?? row).querySelector<HTMLElement>('.fd-do-say, .fd-do-add');
  hand?.focus();
  (list ?? row).scrollIntoView?.({ block: 'nearest' });
}
