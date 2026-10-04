import type { Designer } from './designer';
import type { RuleKind } from './rules-words';

/**
 * Going to a rule: its part picked, and its rules brought forward — in the
 * screen editor the panel's Rules tab, the rule's own setting in hand (an
 * answer rule opened); in the survey editor the question's open card, or the
 * page's, with the cursor on the rule. Shared by the rules overview and the
 * marks on the canvas, so both go to the same place.
 */

export interface RuleTarget {
  part: string;
  kind?: RuleKind;
  /** Which answer rule, or which value set by a rule. */
  index?: number;
}

/** The setting each kind of rule is under, on the panel's Rules tab. */
const SETTING: Record<RuleKind, string> = {
  shows: 'When it shows',
  required: 'Required',
  readonly: 'Read-only',
  compute: 'Worked out from',
  set: 'Set when',
  answer: 'Answer rules',
};

const shown = (element: Element) => !element.closest('[hidden]');
const first = (scope: Element | null | undefined, selector: string) => [...(scope?.querySelectorAll<HTMLElement>(selector) ?? [])].find(shown) ?? null;

/** A rule in a list of them — an answer rule, a value set — opened, its sentence in hand. */
function openListed(scope: Element | null, index: number): HTMLElement | null {
  const says = [...(scope?.querySelectorAll<HTMLElement>('.fd-answer-rule-say') ?? [])];
  const say = says[index] ?? says[0];
  if (!say) return null;
  if (say.getAttribute('aria-expanded') !== 'true') say.click();
  return say;
}

/** Where the cursor goes for a kind of rule, within what shows a part's rules. */
function target(scope: Element, kind: RuleKind | undefined, index: number): HTMLElement | null {
  if (!kind) return null;
  const setting = scope.querySelector(`[data-setting="${SETTING[kind]}"]`);
  if (kind === 'answer' || kind === 'set') return openListed(setting, index);
  if (kind === 'compute') return first(setting, 'input');
  // A condition: its first list, or the switch or link that starts one.
  const condition = kind === 'shows' ? (setting ?? scope.querySelector('.fd-step-when, .fd-when')) : setting;
  return first(condition, 'select') ?? first(condition, 'input, button, [role="switch"]');
}

export function openRules(root: HTMLElement, designer: Designer, to: RuleTarget): void {
  designer.select(to.part);
  // The screen editor: the panel's Rules tab.
  const tab = root.querySelector<HTMLButtonElement>('.fd-properties [role="tab"][data-tab="rules"]');
  tab?.click();
  // Or the survey editor: the question's open card, or the page's card.
  const scope = tab ? root.querySelector('.fd-properties [data-panel="rules"]') : root.querySelector(`.fd-q-selected[data-node="${to.part}"], .fd-design-step[data-node="${to.part}"]`);
  if (!scope) return;
  const hand = target(scope, to.kind, to.index ?? 0) ?? (to.kind === 'required' ? first(scope, '[role="switch"][aria-label="Required"], input[aria-label="Required"]') : null);
  (hand ?? (tab as HTMLElement | null))?.focus();
  (hand ?? scope).scrollIntoView?.({ block: 'nearest' });
}
