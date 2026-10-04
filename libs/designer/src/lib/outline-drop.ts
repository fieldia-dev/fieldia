import type { OutlineRow } from './outline-rows';

/**
 * Where a row let go over the outline lands, as the approved mockup has it:
 * the top of a row puts it before that row, the bottom after, the middle of
 * a group, a tab or a page into it, at its end. Between rows of different
 * depths — under the last part of a group — how far in the pointer is says
 * which depth it lands at, as Designable's tree does: the drop line is drawn
 * that far in. Of the depths the gap allows, the one nearest the pointer's
 * that takes the part is chosen. No DOM: the outline measures, this decides.
 */

export interface DropSpot {
  /** What it goes into, and before the part now at `index` there (the parts moved counted where they are). */
  parent: string;
  index: number;
  /** How deep it lands: how far in the line is drawn. */
  level: number;
  /** The gap the line is drawn in: before the row at `gap` on show (or after the last); -1 when it goes into a row. */
  gap: number;
  /** The row it goes into, washed rather than lined. */
  into?: string;
}

/** The share of a row's height, from the top and from the bottom, that puts a part before or after a row that holds parts. */
const EDGE = 0.3;

/**
 * Where a part goes, let go over the row at `over` of the rows on show, at
 * `fraction` of its height, the pointer `wanted` levels in. `root` is the
 * page's own list; `takes` says whether a parent takes what is moved.
 */
export function dropSpot(rows: readonly OutlineRow[], root: string, over: number, fraction: number, wanted: number, folded: ReadonlySet<string>, takes: (parent: string) => boolean): DropSpot | null {
  const row = rows[over];
  if (!row) return null;
  if (row.holds && fraction >= EDGE && fraction <= 1 - EDGE && takes(row.id)) {
    return { parent: row.id, index: row.children, level: row.level + 1, gap: -1, into: row.id };
  }
  // Its top half puts it before the row, its bottom half after.
  return inGap(rows, root, over + (fraction >= 0.5 ? 1 : 0), wanted, folded, takes);
}

/** A part let go in the gap before the row at `gap`, at the depth nearest `wanted` that takes it. */
function inGap(rows: readonly OutlineRow[], root: string, gap: number, wanted: number, folded: ReadonlySet<string>, takes: (parent: string) => boolean): DropSpot {
  const prev = rows[gap - 1];
  const next = rows[gap];
  // Under a row that holds parts, open (or holding none yet), it can go in as its first part.
  const deepest = prev ? prev.level + (prev.holds && (prev.children === 0 || !folded.has(prev.id)) ? 1 : 0) : 0;
  const shallowest = Math.min(next ? next.level : 0, deepest);
  const asked = Math.max(shallowest, Math.min(deepest, wanted));
  const spot = (level: number): DropSpot => {
    let parent = root;
    for (let at = gap - 1; level > 0 && at >= 0; at--) {
      if (rows[at].level === level - 1) {
        parent = rows[at].id;
        break;
      }
    }
    const own = level === 0 ? null : parent;
    const index = rows.slice(0, Math.max(0, gap)).filter((r) => r.parent === own && r.movable).length;
    return { parent, index, level, gap };
  };
  // The depth asked for, then the ones next to it, nearer first.
  for (let step = 0; step <= deepest - shallowest; step++) {
    for (const level of [asked - step, asked + step]) {
      if (level < shallowest || level > deepest) continue;
      const found = spot(level);
      if (takes(found.parent)) return found;
    }
  }
  return spot(asked);
}
