import { saveProblemOf, type DataSource, type ListNode, type Page, type RecordId, type RecordVersion, type Tone, type Values } from '@fieldia/core';
import type { El } from './dom';
import type { ViewerLabels } from './labels';
import type { KnownRecord } from './list-bulk';
import type { Row } from './list-groups';

/** How near the window's edge a row carried scrolls the page, and how far a frame. */
const EDGE = 48;
const STEP = 14;

export interface RankContext {
  page: Page;
  node: ListNode;
  model: string;
  dataSource: DataSource | undefined;
  doc: Document;
  el: El;
  labels: ViewerLabels;
  fill: (template: string, values: Record<string, string | number>) => string;
  number: (n: number) => string;
  /** Whether the rows may be moved now: the list in its ranked order (the field, ascending), not under its groups. */
  ranked: () => boolean;
  /** The records' rows on show, in their order. */
  rows: () => HTMLTableRowElement[];
  /** A row's record. */
  recordOf: (tr: Element) => Row | undefined;
  /** Each record's version and what the person may do with it, as the rows told. */
  known: (id: RecordId) => KnownRecord | undefined;
  /** Where the page of rows starts among every record the search finds, and how many it finds: a place said in all. */
  offset: () => number;
  total: () => number;
  /** Said over the page: why an order was not kept. */
  say?: (message: string, tone: Tone) => void;
  /** Ask for the records again: the order the source keeps, after one it refused. */
  reload: () => Promise<void>;
}

/** A list's rows re-ranked by hand (`ListNode.sequenceField`), wired into its rows. */
export interface RankRows {
  /** A row drawn: its grip at its start, to carry it; `name`, its record's, as its place is said. */
  wire(tr: HTMLTableRowElement, record: Row, name: string): void;
  /** The rows drawn again, or the list's order changed: the grips shown only while it is ranked. */
  drawn(): void;
  /** Alt with an arrow on a row: moved a place up or down; false where it moves nothing. */
  key(tr: HTMLElement, event: KeyboardEvent): boolean;
  /** What is said aloud as a row moves: put in the list, there before anything is said in it. */
  voice: HTMLElement;
}

/**
 * The ranks the records on show take once one is moved to `to`: each id with its new rank where it changes, the fewest
 * changed. Between its neighbours, where their ranks leave room, it takes one between them and nothing else changes;
 * else one after the record before it, and each after it one more than the one before while they would fall behind.
 * At the top of the first page, one less than the record after it. `ranks` are the records' in their new order.
 */
export function newRanks(ranks: readonly { id: RecordId; rank: number }[], to: number, firstPage: boolean): { id: RecordId; rank: number }[] {
  const next = ranks.map((one) => ({ ...one }));
  const moved = next[to];
  const before = next[to - 1];
  const after = next[to + 1];
  const changed: { id: RecordId; rank: number }[] = [];
  if (!before) {
    if (!after) return [];
    // At the top: before the record after it — one less on the first page, where nothing comes before.
    const rank = firstPage ? after.rank - 1 : after.rank;
    if (moved.rank === rank && firstPage) return [];
    moved.rank = rank;
  } else if (after && after.rank - before.rank >= 2) {
    // Room between them: halfway, and nothing else changes.
    const rank = before.rank + Math.floor((after.rank - before.rank) / 2);
    return moved.rank === rank ? [] : [{ id: moved.id, rank }];
  } else moved.rank = before.rank + 1;
  changed.push({ id: moved.id, rank: moved.rank });
  for (let at = to + 1; at < next.length; at++) {
    if (next[at].rank > next[at - 1].rank) break;
    next[at].rank = next[at - 1].rank + 1;
    changed.push({ id: next[at].id, rank: next[at].rank });
  }
  return changed;
}

/**
 * Rows re-ranked by hand where the list keeps its records' rank (`sequenceField`): a grip at each row's start carries
 * the row to another place — the other rows sliding aside, the page scrolled near its edge, Escape putting it back —
 * and Alt with an arrow moves the row with the keyboard a place up or down; its new place said aloud ("Omar Nabil moved
 * to place 3 of 12"). The records whose rank changes are written — each its own rank — through the source's
 * `writeMany`, else `save`, the fewest it takes; refused, the list says why and asks for its records again. Shown
 * while the list is in that order (its rank, ascending, no group); a record the person may not change has no grip.
 * Null where the source can write neither, or the page names no whole-number field: hidden, never disabled.
 */
export function rankRows(context: RankContext): RankRows | null {
  const { node, page, el, labels, fill, doc, number } = context;
  const field = node.sequenceField;
  const def = field ? page.fields[field] : undefined;
  const source = context.dataSource;
  if (!field || def?.type !== 'integer' || !(source?.writeMany || source?.save)) return null;
  const voice = el('span', { class: 'fd-sr-only', role: 'status', 'aria-live': 'polite' });
  /** Moves are written one after the other, in the order they were made. */
  let writing: Promise<void> = Promise.resolve();
  const rankOf = (tr: Element) => {
    const value = context.recordOf(tr)?.values[field];
    return typeof value === 'number' ? value : 0;
  };
  const mayMove = (record: Row) => context.known(record.id)?.can?.edit !== false;

  /** One record's rank written, as a save of that one field would write it; refused, thrown with why. */
  async function write(id: RecordId, rank: number) {
    const values: Values = { [field as string]: rank };
    const version: RecordVersion | undefined = context.known(id)?.version;
    if (source?.writeMany) {
      const answer = await source.writeMany({ model: context.model, ids: [id], values, fields: { [field as string]: def as NonNullable<typeof def> }, ...(version ? { versions: { [String(id)]: version } } : {}) });
      const refused = answer.failed.find((one) => String(one.id) === String(id));
      if (refused) throw new Error(refused.message);
      return;
    }
    await source?.save?.({ model: context.model, id, fields: { [field as string]: def as NonNullable<typeof def> }, changes: { values, lines: {}, links: {} }, values, partial: true, ...(version ? { version } : {}) });
  }

  /** The row now at place `to` among those on show: its new rank and those it moved along written, its place said. */
  function moved(tr: HTMLTableRowElement, to: number) {
    const rows = context.rows();
    const ranks = rows.map((row) => ({ id: (context.recordOf(row) as Row).id, rank: rankOf(row) }));
    const changes = newRanks(ranks, to, context.offset() === 0);
    // Taken as theirs at once, as the row stands in its place: what the next move reads.
    for (const change of changes) {
      const row = rows.find((one) => String(context.recordOf(one)?.id) === String(change.id));
      const record = row ? context.recordOf(row) : undefined;
      if (record) record.values[field as string] = change.rank;
    }
    const name = tr.dataset['rankName'] ?? '';
    voice.textContent = fill(labels.rowMovedTo, { name, n: number(context.offset() + to + 1), total: number(Math.max(context.total(), rows.length)) });
    writing = writing.then(async () => {
      try {
        for (const change of changes) await write(change.id, change.rank);
      } catch (error) {
        const why = Object.values(saveProblemOf(error).fields ?? {})[0] ?? saveProblemOf(error).message;
        context.say?.(fill(labels.rankNotKept, { why: why.replace(/[.\s]+$/, '') }), 'danger');
        await context.reload();
      }
    });
  }

  /** Move a row to `to` among those on show, in the table. */
  function place(tr: HTMLTableRowElement, to: number) {
    const rows = context.rows();
    const from = rows.indexOf(tr);
    if (from < 0 || to < 0 || to >= rows.length || to === from) return false;
    const target = rows[to];
    // What opened under a row goes with it (a row opened in place).
    const under = tr.nextElementSibling?.hasAttribute('data-aside') ? tr.nextElementSibling : null;
    const targetEnd = to > from ? (target.nextElementSibling?.hasAttribute('data-aside') ? target.nextElementSibling : target) : null;
    if (to > from) targetEnd?.after(tr);
    else target.before(tr);
    if (under) tr.after(under);
    moved(tr, to);
    return true;
  }

  /** A row carried by its grip: following the pointer, the others sliding aside; let go, in its place; Escape, back. */
  function lift(tr: HTMLTableRowElement, pointerY: number) {
    const rows = context.rows();
    const from = rows.indexOf(tr);
    const others = rows.filter((row) => row !== tr);
    const scrollY = () => doc.defaultView?.scrollY ?? 0;
    const startY = pointerY + scrollY();
    const box = tr.getBoundingClientRect();
    const top = box.top + scrollY();
    const middles = others.map((row) => {
      const at = row.getBoundingClientRect();
      return at.top + scrollY() + at.height / 2;
    });
    let to = from;
    let lifted = false;
    let lastY = pointerY;
    let frame = 0;
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      settle();
    };
    function settle() {
      for (const row of rows) row.style.transform = '';
      tr.removeAttribute('data-lifted');
      tr.closest('tbody')?.removeAttribute('data-ranking');
      doc.removeEventListener('keydown', escape, true);
      if (frame) doc.defaultView?.cancelAnimationFrame(frame);
      frame = 0;
      lifted = false;
    }
    function follow(y: number) {
      lastY = y;
      const by = y + scrollY() - startY;
      if (!lifted) {
        // A press that hardly moves is not a carry.
        if (Math.abs(by) < 4) return;
        lifted = true;
        tr.setAttribute('data-lifted', '');
        tr.closest('tbody')?.setAttribute('data-ranking', '');
        doc.addEventListener('keydown', escape, true);
      }
      tr.style.transform = `translateY(${by}px)`;
      // Its place: after every other row whose middle its own has passed.
      const middle = top + box.height / 2 + by;
      to = middles.filter((at) => at < middle).length;
      others.forEach((row, i) => {
        row.style.transform = i >= from && i < to ? `translateY(${-box.height}px)` : i < from && i >= to ? `translateY(${box.height}px)` : '';
      });
      // Near the window's top or bottom, the page scrolls under it.
      const view = doc.defaultView;
      if (!view || frame) return;
      const edge = y < EDGE ? -STEP : y > view.innerHeight - EDGE ? STEP : 0;
      if (!edge) return;
      frame = view.requestAnimationFrame(() => {
        frame = 0;
        if (!lifted) return;
        view.scrollBy(0, edge);
        follow(lastY);
      });
    }
    return {
      follow,
      drop() {
        const carried = lifted && to !== from;
        settle();
        if (carried) place(tr, to);
      },
      settle,
    };
  }

  return {
    voice,
    wire(tr, record, name) {
      if (!mayMove(record)) return;
      tr.dataset['rankName'] = name;
      tr.setAttribute('aria-keyshortcuts', 'Alt+ArrowUp Alt+ArrowDown');
      const grip = () => {
        const made = el('span', { class: 'fd-list-rank', 'aria-hidden': 'true', title: labels.rowMoveHint });
        let carry: ReturnType<typeof lift> | null = null;
        made.addEventListener('pointerdown', (event) => {
          if (event.button !== 0 || !context.ranked()) return;
          event.preventDefault();
          event.stopPropagation();
          made.setPointerCapture?.(event.pointerId);
          carry = lift(tr, event.clientY);
        });
        made.addEventListener('pointermove', (event) => carry?.follow(event.clientY));
        made.addEventListener('pointerup', () => {
          carry?.drop();
          carry = null;
        });
        made.addEventListener('pointercancel', () => {
          carry?.settle();
          carry = null;
        });
        // The grip's own press, never the row's: it opens nothing.
        made.addEventListener('click', (event) => event.stopPropagation());
        return made;
      };
      // At the row's start, before its name; and at its card's, where the row is a card on a phone.
      tr.querySelector<HTMLElement>(':scope > td[data-col]')?.prepend(grip());
      tr.querySelector<HTMLElement>(':scope > td.fd-list-card')?.prepend(grip());
    },
    drawn() {
      const on = context.ranked();
      for (const tr of context.rows()) {
        const record = context.recordOf(tr);
        if (!record || !mayMove(record)) continue;
        tr.toggleAttribute('data-ranks', on);
        if (on) tr.setAttribute('aria-keyshortcuts', 'Alt+ArrowUp Alt+ArrowDown');
        else tr.removeAttribute('aria-keyshortcuts');
      }
    },
    key(tr, event) {
      if (!event.altKey || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') || !context.ranked() || !tr.hasAttribute('data-ranks')) return false;
      const rows = context.rows();
      const from = rows.indexOf(tr as HTMLTableRowElement);
      place(tr as HTMLTableRowElement, from + (event.key === 'ArrowUp' ? -1 : 1));
      (tr as HTMLElement).focus();
      return true;
    },
  };
}
