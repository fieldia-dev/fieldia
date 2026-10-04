import type { Page } from '@fieldia/core';
import { elementFactory } from './chrome';
import type { Designer } from './designer';
import { designerIcon } from './icons';
import { openRules } from './rules-open';
import { pageRules, type RuleKind } from './rules-words';

/**
 * Small marks on the canvas for a part with a rule: shown only sometimes,
 * worked out, or with answer rules. Pointed at or focused, a mark says its
 * rule as a sentence; clicked, it opens the part's rules. Drawn after the
 * canvas, onto the parts it drew — a field or a group of the screen editor,
 * a question's card or a page of the survey designer — and kept as they are
 * while their rules stay the same.
 */

type MarkKind = 'sometimes' | 'worked-out' | 'answer';

interface Mark {
  kind: MarkKind;
  rule: RuleKind;
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

const WORDS: Record<MarkKind, string> = { sometimes: 'only sometimes', 'worked-out': 'worked out', answer: '' };
const NAMES: Record<MarkKind, string> = { sometimes: 'Shown only sometimes', 'worked-out': 'Worked out', answer: 'Answer rules' };

/** Each part's marks, in a mark's order: when it shows, what it holds, what it asks of an answer. */
function marksOf(page: Page): Map<string, Mark[]> {
  const out = new Map<string, Mark[]>();
  for (const rule of pageRules(page)) {
    const kind: MarkKind | null = rule.kind === 'shows' ? 'sometimes' : rule.kind === 'compute' ? 'worked-out' : rule.kind === 'answer' ? 'answer' : null;
    if (!kind || !rule.part) continue;
    const marks = out.get(rule.part) ?? [];
    const mark = marks.find((m) => m.kind === kind);
    if (mark) mark.sentences.push(rule.sentence);
    else marks.push({ kind, rule: rule.kind, words: WORDS[kind], sentences: [rule.sentence] });
    out.set(rule.part, marks);
  }
  for (const marks of out.values()) {
    marks.sort((a, b) => Object.keys(WORDS).indexOf(a.kind) - Object.keys(WORDS).indexOf(b.kind));
    for (const mark of marks) if (mark.kind === 'answer') mark.words = mark.sentences.length === 1 ? '1 rule' : `${mark.sentences.length} rules`;
  }
  return out;
}

let tips = 0;

/** Draw the marks of every part with a rule in `container`, and take away those of parts that have none now. */
export function ruleMarks(container: HTMLElement, page: Page, designer: Designer): void {
  const doc = container.ownerDocument;
  const el = elementFactory(doc);
  const marks = marksOf(page);
  const root = (container.closest('.fd-designer') as HTMLElement | null) ?? container;
  for (const place of PLACES) {
    for (const part of container.querySelectorAll<HTMLElement>(place.parts)) {
      const id = part.dataset['node'] as string;
      const own = marks.get(id) ?? [];
      const into = place.into ? part.querySelector<HTMLElement>(place.into) : part;
      if (!into) continue;
      let holder = [...into.children].find((c) => c.classList.contains('fd-rule-marks')) as HTMLElement | undefined;
      if (!own.length) {
        holder?.remove();
        continue;
      }
      const key = JSON.stringify(own);
      if (holder?.dataset['marks'] === key) continue;
      if (!holder) {
        holder = el('span', { class: 'fd-rule-marks' });
        into.append(holder);
      }
      holder.dataset['marks'] = key;
      holder.replaceChildren(
        ...own.map((mark) => {
          const tipId = `fd-rule-tip-${++tips}`;
          const icon = mark.kind === 'worked-out' ? el('span', { class: 'fd-rule-mark-fx', 'aria-hidden': 'true' }, 'ƒx') : designerIcon(doc, mark.kind === 'sometimes' ? 'when' : 'check');
          const button = el(
            'button',
            { type: 'button', class: 'fd-rule-mark', 'data-mark': mark.kind, 'aria-label': `${NAMES[mark.kind]}: open the rules`, 'aria-describedby': tipId },
            icon,
            el('span', { class: 'fd-rule-mark-words' }, mark.words),
            el('span', { class: 'fd-rule-tip', role: 'tooltip', id: tipId }, mark.sentences.join('\n'))
          );
          button.addEventListener('click', (event) => {
            event.stopPropagation();
            openRules(root, designer, { part: id, kind: mark.rule });
          });
          return button;
        })
      );
    }
  }
}
