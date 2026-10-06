import type { Page } from '@fieldia/core';
import { elementFactory } from './chrome';
import type { Designer } from './designer';
import { designerIcon } from './icons';
import { openRules } from './rules-open';
import { pageRules, type RuleKind } from './rules-words';
import { changeMarks, openSteps } from './steps-marks';
import { findNode } from './page-tree';

/**
 * Small marks on the canvas for a part with a rule: shown only sometimes,
 * worked out, or with answer rules. Pointed at or focused, a mark says its
 * rule as a sentence; clicked, it opens the part's rules. Drawn after the
 * canvas, onto the parts it drew — a field or a group of the screen editor,
 * a question's card or a page of the survey designer — and kept as they are
 * while their rules stay the same.
 */

type MarkKind = 'sometimes' | 'worked-out' | 'answer' | 'steps';

interface Mark {
  kind: MarkKind;
  /** The kind of rule it opens; none for steps, which open their own list. */
  rule?: RuleKind;
  words: string;
  sentences: string[];
}

/** Where a part's marks go, in what the canvas drew for it; parts open for editing show their rules in full. */
const PLACES: { parts: string; into?: string }[] = [
  { parts: '.fd-canvas-field[data-node]:not(.fd-editing)' },
  { parts: '.fd-canvas-section[data-node]' },
  { parts: '.fd-q-closed[data-node]', into: '.fd-q-title' },
  { parts: '.fd-design-step[data-node]', into: '.fd-step-head-row' },
];

/** The marks in the order they stand. */
const ORDER: MarkKind[] = ['sometimes', 'worked-out', 'answer', 'steps'];

/** Each part's marks, in a mark's order: when it shows, what it holds, what it asks of an answer. */
function marksOf(page: Page, designer: Designer): Map<string, Mark[]> {
  const words = designer.words;
  const w = words.rulesUi;
  const out = new Map<string, Mark[]>();
  for (const rule of pageRules(page, words)) {
    const kind: MarkKind | null = rule.kind === 'shows' ? 'sometimes' : rule.kind === 'compute' ? 'worked-out' : rule.kind === 'answer' ? 'answer' : null;
    if (!kind || !rule.part) continue;
    const marks = out.get(rule.part) ?? [];
    const mark = marks.find((m) => m.kind === kind);
    if (mark) mark.sentences.push(rule.sentence);
    else marks.push({ kind, rule: rule.kind, words: kind === 'answer' ? '' : w.marks[kind], sentences: [rule.sentence] });
    out.set(rule.part, marks);
  }
  // steps lane: a field whose change does something.
  for (const [part, lines] of changeMarks(page, designer)) {
    const marks = out.get(part) ?? [];
    marks.push({ kind: 'steps', words: words.steps.count(lines.filter((line) => !line.startsWith(words.steps.nested(''))).length), sentences: [`${words.steps.whenItChanges}:`, ...lines] });
    out.set(part, marks);
  }
  for (const marks of out.values()) {
    marks.sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind));
    for (const mark of marks) if (mark.kind === 'answer') mark.words = w.markCount(mark.sentences.length);
  }
  return out;
}

let tips = 0;
/** Each page's marks, worked out once for it: a page an edit made is a new page. */
const marksFor = new WeakMap<Page, Map<string, Mark[]>>();

/** Draw the marks of every part with a rule in `container`, and take away those of parts that have none now. */
export function ruleMarks(container: HTMLElement, page: Page, designer: Designer): void {
  const doc = container.ownerDocument;
  const el = elementFactory(doc);
  let marks = marksFor.get(page);
  if (!marks) marksFor.set(page, (marks = marksOf(page, designer)));
  const root = (container.closest('.fd-designer') as HTMLElement | null) ?? container;
  for (const place of PLACES) {
    for (const part of container.querySelectorAll<HTMLElement>(place.parts)) {
      const id = part.dataset['node'] as string;
      const own = marks.get(id) ?? [];
      const into = place.into ? part.querySelector<HTMLElement>(place.into) : part;
      if (!into) continue;
      let holder = [...into.children].find((c) => c.classList.contains('fd-rule-marks')) as HTMLElement | undefined;
      // A part that is a button itself (a field or a question not picked) holds no other button (ARIA): its marks
      // are words, said with it, and its rules its description; Enter picks it, and its panel opens the rules.
      const inButton = part.getAttribute('role') === 'button';
      if (!own.length) {
        holder?.remove();
        if (inButton) part.removeAttribute('aria-describedby');
        continue;
      }
      const key = JSON.stringify(own);
      if (holder?.dataset['marks'] === key) continue;
      if (!holder) {
        holder = el('span', { class: 'fd-rule-marks' });
        into.append(holder);
      }
      holder.dataset['marks'] = key;
      const tipIds: string[] = [];
      holder.replaceChildren(
        ...own.map((mark) => {
          const tipId = `fd-rule-tip-${++tips}`;
          tipIds.push(tipId);
          const icon = mark.kind === 'worked-out' ? el('span', { class: 'fd-rule-mark-fx', 'aria-hidden': 'true' }, 'ƒx') : designerIcon(doc, mark.kind === 'sometimes' ? 'when' : mark.kind === 'steps' ? 'bolt' : 'check');
          const words = el('span', { class: 'fd-rule-mark-words' }, mark.words);
          const tip = el('span', { class: 'fd-rule-tip', role: 'tooltip', id: tipId }, mark.sentences.join('\n'));
          const button = inButton
            ? el('span', { class: 'fd-rule-mark', 'data-mark': mark.kind }, icon, words, tip)
            : el('button', { type: 'button', class: 'fd-rule-mark', 'data-mark': mark.kind, 'aria-label': mark.kind === 'steps' ? designer.words.steps.openTheSteps(designer.words.steps.markName) : designer.words.rulesUi.openTheRules(designer.words.rulesUi.markNames[mark.kind]), 'aria-describedby': tipId }, icon, words, tip);
          button.addEventListener('click', (event) => {
            event.stopPropagation();
            const node = findNode(designer.getPage(), id)?.node;
            if (mark.kind === 'steps' && node?.type === 'field') openSteps(root, designer, { change: node.field });
            else openRules(root, designer, { part: id, kind: mark.rule });
          });
          return button;
        })
      );
      if (inButton) part.setAttribute('aria-describedby', tipIds.join(' '));
    }
  }
}
