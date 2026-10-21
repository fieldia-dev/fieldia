import type { LayoutNode, StepNode } from '../format/layout';
import type { Page } from '../format/page';

/**
 * Questions and steps in an order drawn for each respondent (`order: "random"` on a wizard, a step or a group), and N
 * of a step's or a group's questions drawn of M (`draw`): the survey part's. The draw is seeded, so the same seed draws
 * the same order in every engine — the form keeps it (`state.order`), in its drafts too, so a person who comes back
 * finds their questions where they left them.
 */

/** For each part drawn, its parts' ids in the order shown: those not drawn left out. */
export type DrawnOrder = Record<string, string[]>;

/** A string's hash as four 32-bit numbers (cyrb128): a seed's words made into the generator's start. */
function hashed(seed: string): [number, number, number, number] {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;
  for (let i = 0; i < seed.length; i++) {
    const k = seed.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  return [(h1 ^ h2 ^ h3 ^ h4) >>> 0, (h2 ^ h1) >>> 0, (h3 ^ h1) >>> 0, (h4 ^ h1) >>> 0];
}

/** Numbers from 0 to 1 drawn from a seed (sfc32): the same seed, the same numbers, everywhere. */
export function seeded(seed: string): () => number {
  let [a, b, c, d] = hashed(seed);
  return () => {
    a >>>= 0;
    b >>>= 0;
    c >>>= 0;
    d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}

/** A list in an order drawn (Fisher–Yates). */
function shuffled<T>(items: readonly T[], next: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Whether a part is one a draw moves or leaves out: a question — a field, a saved form, a group of them — not fixed in its place. */
const drawable = (node: LayoutNode): boolean => (node.type === 'field' || node.type === 'form' || node.type === 'section') && (node as { fixed?: boolean }).fixed !== true;

/**
 * The parts of one part in their order drawn: those a draw moves change places among themselves — the rest (words,
 * pictures, a part fixed in its place) keep theirs — and `draw` of them, at most, are kept, the rest left out.
 */
function drawnParts<C extends { id: string }>(children: readonly C[], movable: (child: C) => boolean, random: boolean, draw: number | undefined, next: () => number): string[] {
  const moving = children.filter(movable);
  let kept = moving;
  if (draw !== undefined && draw < moving.length) {
    // Which of them are asked, drawn; in their own order unless the order is drawn too.
    const picked = new Set(shuffled(moving, next).slice(0, draw));
    kept = moving.filter((child) => picked.has(child));
  }
  const placed = random ? shuffled(kept, next) : kept;
  // The places of those that move, in turn: the first filled with those placed, the rest left out with those not drawn.
  let at = 0;
  const out: string[] = [];
  for (const child of children) {
    if (!movable(child)) out.push(child.id);
    else if (at < placed.length) out.push(placed[at++].id);
  }
  return out;
}

/**
 * The order a page's parts are shown in for one seed: each wizard whose steps are in random order, each step and group
 * whose questions are or which draws some of them — by its id, its parts' ids in the order shown, those not drawn left
 * out. Empty for a page that draws nothing.
 */
export function drawOrder(page: Page, seed: string): DrawnOrder {
  const next = seeded(`${page.id}\u0000${seed}`);
  const order: DrawnOrder = {};
  const visit = (node: LayoutNode | StepNode) => {
    const own = node as { id: string; order?: 'random'; draw?: number; children?: (LayoutNode | StepNode)[] };
    const children = Array.isArray(own.children) ? own.children : [];
    if ((own.order === 'random' || own.draw !== undefined) && children.length) {
      const steps = node.type === ('wizard' as string);
      order[own.id] = drawnParts(children as { id: string }[], steps ? (child) => (child as { fixed?: boolean }).fixed !== true : (child) => drawable(child as unknown as LayoutNode), own.order === 'random', steps ? undefined : own.draw, next);
    }
    for (const child of children) visit(child);
  };
  const root = page.layout as unknown as LayoutNode;
  visit(root);
  return order;
}

/** The fields asked, in the order they were shown: the page's parts walked in their drawn order, those whose answers were sent. */
export function askedInOrder(page: Page, order: DrawnOrder | null, values: Record<string, unknown>): string[] {
  const out: string[] = [];
  const visit = (node: { id?: string; type?: string; field?: string; name?: string; children?: unknown[] }) => {
    if (node.type === 'field' && node.field && node.field in values && !out.includes(node.field)) out.push(node.field);
    const children = Array.isArray(node.children) ? (node.children as { id?: string }[]) : [];
    const drawn = node.id ? order?.[node.id] : undefined;
    const shown = drawn ? drawn.map((id) => children.find((child) => child.id === id)).filter((child): child is { id?: string } => !!child) : children;
    for (const child of shown) visit(child as typeof node);
  };
  visit(page.layout as unknown as Parameters<typeof visit>[0]);
  // A saved form's answers, and any other sent, after: by name.
  for (const name of Object.keys(values)) if (!out.includes(name)) out.push(name);
  return out;
}
