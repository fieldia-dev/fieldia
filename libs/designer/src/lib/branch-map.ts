import type { Page, StepNode, WizardNode } from '@fieldia/core';
import { choicesOf } from './condition-editor';
import { readCondition } from './conditions';
import type { DesignerWords } from './designer-words';
import { en } from './locales/en';

/**
 * A survey's pages and where each answer leads. People go through the pages
 * in order, and a page with a rule only when its rule holds — so every page
 * sits in its own column on one line, and a page shown only for some answers
 * branches off the line, labelled with those answers, and back onto it. The
 * line running past it is everyone else.
 */

export interface BranchNode {
  id: string;
  label: string;
  column: number;
  /** 0 on the line; 1 off it, shown only for some answers. */
  lane: 0 | 1;
  /** For whom, in words: "Do you use it? is Yes". */
  when?: string;
  /** The same, short enough for the branch: "Yes", "not Manager", "2 rules". */
  answer?: string;
}

export interface BranchMap {
  nodes: BranchNode[];
}

/** A step's rule in words, in full and short. */
function whenWords(page: Page, step: StepNode, words: DesignerWords): { when: string; answer: string } | undefined {
  const w = words.rulesUi;
  const condition = readCondition(step.invisible);
  if (!condition) return undefined;
  if (condition === 'custom') return { when: w.byHandRule, answer: w.byHandShort };
  const answerOf = (rule: (typeof condition.rules)[number]) => choicesOf(page.fields[rule.field], words)?.find((c) => c.value === rule.value)?.label ?? String(rule.value);
  const tests = condition.rules.map((rule) => words.rules.test(page.fields[rule.field]?.label ?? rule.field, rule.op === 'is' ? words.rules.is : words.rules.isNot, answerOf(rule)));
  const [only] = condition.rules;
  return {
    when: condition.join === 'all' ? words.rules.allOf(tests) : words.rules.anyOf(tests),
    answer: condition.rules.length === 1 ? (only.op === 'is' ? answerOf(only) : w.notAnswer(answerOf(only))) : w.ruleCount(condition.rules.length),
  };
}

export function branchMap(page: Page, words: DesignerWords = en): BranchMap {
  const steps = page.layout.type === 'wizard' ? (page.layout as WizardNode).children : [];
  return {
    nodes: steps.map((step, column) => {
      const when = whenWords(page, step, words);
      return { id: step.id, label: step.label || words.rules.untitledPage, column, lane: when ? 1 : 0, ...(when ?? {}) };
    }),
  };
}

// ---- drawn ---------------------------------------------------------------------------------------

const W = 148;
const H = 44;
const GAP = 44;
const PAD = 12;
/** Between the line and a page off it: room for the answers it is for. */
const BAND = 30;
const SVG = 'http://www.w3.org/2000/svg';

const short = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

/** The map as an SVG, each page a group to pick. */
export function drawBranchMap(doc: Document, map: BranchMap, picked: string | null, onPick: (id: string) => void, words: DesignerWords = en): SVGSVGElement {
  const w = words.rulesUi;
  const make = <K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}, text?: string) => {
    const node = doc.createElementNS(SVG, tag);
    for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, String(value));
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const n = map.nodes.length;
  const branched = map.nodes.some((node) => node.lane === 1);
  const width = PAD * 2 + n * W + Math.max(0, n - 1) * GAP;
  const height = PAD * 2 + H + (branched ? BAND + H : 0);
  const line = PAD + H / 2;
  const below = PAD + H + BAND + H / 2;
  const left = (column: number) => PAD + column * (W + GAP);

  // A group, not an image: its pages are buttons, and an image's insides are hidden from a screen reader.
  const svg = make('svg', { viewBox: `0 0 ${width} ${height}`, role: 'group', class: 'fd-branch-svg', 'aria-label': w.mapLabel(n) });
  // As wide as the card, never wider than drawn; past a quarter smaller it scrolls instead.
  svg.setAttribute('style', `width: 100%; max-width: ${width}px; min-width: ${Math.round(width * 0.75)}px`);
  const defs = make('defs');
  const marker = make('marker', { id: 'fd-branch-arrow', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' });
  marker.append(make('path', { d: 'M0 0L10 5L0 10z', class: 'fd-branch-head' }));
  defs.append(marker);
  svg.append(defs);

  // The line, page to page on it: past the pages off it, for everyone else.
  const onLine = map.nodes.filter((node) => node.lane === 0);
  onLine.forEach((node, i) => {
    if (i === 0) return;
    const from = onLine[i - 1];
    svg.append(make('path', { d: `M${left(from.column) + W} ${line} H${left(node.column) - 2}`, class: 'fd-branch-edge', 'marker-end': 'url(#fd-branch-arrow)' }));
  });
  // A page off the line: out to it, labelled with the answers it is for, and back.
  for (const node of map.nodes) {
    if (node.lane === 0) continue;
    const x = left(node.column);
    const out = x - GAP / 2;
    const back = x + W + GAP / 2;
    svg.append(
      make('path', { d: `M${out} ${line} C ${out} ${below}, ${out} ${below}, ${x - 2} ${below}`, class: 'fd-branch-edge fd-branch-off', 'marker-end': 'url(#fd-branch-arrow)' }),
      make('path', { d: `M${x + W} ${below} C ${back} ${below}, ${back} ${below}, ${back} ${line}`, class: 'fd-branch-edge fd-branch-off' })
    );
    // The words in full on hover, the drawing kept short.
    // Said by the page's own button ("…, only when …"), so hidden here to be heard once.
    const label = make('g', { class: 'fd-branch-label', 'aria-hidden': 'true' });
    label.append(make('title', {}, w.onlyWhenTip(node.when ?? '')), make('text', { x: x - GAP / 2 + 6, y: PAD + H + BAND - 9, class: 'fd-branch-when' }, short(node.answer ?? '', 22)));
    svg.append(label);
    // The line runs on past it; with nothing on it yet there, drawn all the same.
    if (!onLine.some((o) => o.column < node.column) || !onLine.some((o) => o.column > node.column)) svg.append(make('path', { d: `M${out} ${line} H${back}`, class: 'fd-branch-edge' }));
  }
  for (const node of map.nodes) {
    const x = left(node.column);
    const y = node.lane === 0 ? PAD : PAD + H + BAND;
    const group = make('g', { 'data-pick': node.id, class: `fd-branch-page${node.id === picked ? ' fd-picked' : ''}`, tabindex: 0, role: 'button', 'aria-label': node.when ? w.pageOnlyWhen(node.label, node.when) : node.label });
    group.append(make('rect', { x, y, width: W, height: H, rx: 8, class: 'fd-branch-box' }), make('text', { x: x + W / 2, y: y + H / 2 + 5, 'text-anchor': 'middle', class: 'fd-branch-title' }, short(node.label, 20)));
    group.addEventListener('click', () => onPick(node.id));
    group.addEventListener('keydown', (event) => {
      if ((event as KeyboardEvent).key === 'Enter' || (event as KeyboardEvent).key === ' ') {
        event.preventDefault();
        onPick(node.id);
      }
    });
    svg.append(group);
  }
  return svg;
}
