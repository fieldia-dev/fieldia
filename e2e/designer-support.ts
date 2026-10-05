import { expect, type Locator, type Page } from '@playwright/test';
import { screen } from './support';

/**
 * Finding things in the screen designer the way a person sees them. A card is
 * found by its field's label through the page being built: the card being
 * edited shows its label in a box, which text matching cannot read.
 */

/** The page being built, as far as these tests read it. */
export interface BuiltNode {
  type: string;
  id: string;
  field?: string;
  label?: string;
  colspan?: number;
  children?: BuiltNode[];
}
export interface BuiltPage {
  layout: { children: BuiltNode[] };
  fields: Record<string, { type: string; label: string; options?: { value: string | number; label: string }[] }>;
}

declare global {
  interface Window {
    fieldiaDesigner: { designer: { getPage(): BuiltPage; getState(): { selected: string | null } }; reopen(): Promise<void> };
  }
}

/** The ids of the fields on the page, by the label each shows. */
async function nodeIds(page: Page): Promise<Record<string, string>> {
  return page.evaluate(() => {
    const built = window.fieldiaDesigner.designer.getPage();
    const walk = (nodes: BuiltNode[]): BuiltNode[] => nodes.flatMap((n) => (n.type === 'field' ? [n] : n.children ? walk(n.children) : []));
    return Object.fromEntries(walk(built.layout.children).map((n) => [n.label ?? built.fields[n.field ?? '']?.label, n.id]));
  });
}

export async function cardOf(page: Page, label: string): Promise<Locator> {
  const ids = await nodeIds(page);
  return page.locator(`.fd-canvas-field[data-node="${ids[label] ?? '-none-'}"]`);
}

/** Each section's fields as "Label:width", read from the page being built. */
export function layout(page: Page): Promise<string[][]> {
  return page.evaluate(() => {
    const built = window.fieldiaDesigner.designer.getPage();
    const sections = (nodes: BuiltNode[]): BuiltNode[] => nodes.flatMap((n) => (n.type === 'section' ? [n] : n.children ? sections(n.children) : []));
    return sections(built.layout.children).map((s) => (s.children ?? []).map((n) => `${n.label ?? built.fields[n.field ?? '']?.label}:${n.colspan ?? 1}`));
  });
}

/** Press, move in steps at hand speed, release. */
export async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }, options: { release?: boolean } = {}) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  const steps = 12;
  for (let i = 1; i <= steps; i++) await page.mouse.move(from.x + ((to.x - from.x) * i) / steps, from.y + ((to.y - from.y) * i) / steps, { steps: 3 });
  if (options.release !== false) await page.mouse.up();
}

export function tile(page: Page, spec: string): Locator {
  return page.locator(`.fd-toolbox [data-tool="${spec}"]`);
}

/** The field being edited, and the box its label is typed in. */
export function editing(page: Page): { card: Locator; label: Locator; help: Locator } {
  const card = page.locator('.fd-canvas-field.fd-editing');
  return { card, label: card.locator('[data-inline="label"]'), help: card.locator('[data-inline="help"]') };
}

/** Add a kind from the toolbox and name it where it stands. */
export async function addField(page: Page, kind: string, label: string) {
  await tile(page, `kind:${kind}`).click();
  await expect(editing(page).label).toBeFocused();
  await page.keyboard.type(label);
  await expect(editing(page).label).toHaveValue(label);
}

/** Publish as a person does: Publish, then the dialog's own button for the next version. */
export async function publish(page: Page, version: number) {
  await page.getByRole('button', { name: 'Publish', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: `Publish version ${version}?` });
  await dialog.getByRole('button', { name: `Publish version ${version}` }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('.fd-designer-status')).toHaveText(`Published · version ${version}`);
}

/** Collect page errors and console errors, for an empty list at the end. */
export function watch(page: Page): string[] {
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(error.message));
  page.on('console', (message) => message.type() === 'error' && problems.push(message.text()));
  return problems;
}

/**
 * Lines drawn twice: an element's border, outline or ring within 10px of an
 * ancestor's, inside it, on two sides or more — a box in a box that reads as
 * a double border. Returns each as "child in parent". `scope` picks what is
 * looked at: the designer and its overlays unless said, `.fd-form *` for a form.
 */
export function doubleLines(page: Page, scope = '.fd-designer *, .fd-find, .fd-checks, .fd-menu, .fd-publish-dialog'): Promise<string[]> {
  return page.evaluate((scope) => {
    const shown = (e: Element) => {
      const r = e.getBoundingClientRect();
      const s = getComputedStyle(e);
      return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && !e.closest('[hidden]');
    };
    const seen = (width: string, style: string, colour: string) => parseFloat(width) > 0 && style !== 'none' && style !== 'hidden' && colour !== 'rgba(0, 0, 0, 0)' && colour !== 'transparent';
    /** Which sides draw a line, as a box: a border per side, or an outline or a ring all round. */
    const lines = (e: Element) => {
      const s = getComputedStyle(e);
      const around = seen(s.outlineWidth, s.outlineStyle, s.outlineColor) || /(^|,\s*)(rgba?\([^)]*\)\s+)?0px 0px 0px [1-9]/.test(s.boxShadow) || /inset/.test(s.boxShadow) && /0px 0px 0px [1-9]/.test(s.boxShadow);
      const offset = around && seen(s.outlineWidth, s.outlineStyle, s.outlineColor) ? parseFloat(s.outlineOffset) || 0 : 0;
      return {
        top: around || seen(s.borderTopWidth, s.borderTopStyle, s.borderTopColor),
        bottom: around || seen(s.borderBottomWidth, s.borderBottomStyle, s.borderBottomColor),
        left: around || seen(s.borderLeftWidth, s.borderLeftStyle, s.borderLeftColor),
        right: around || seen(s.borderRightWidth, s.borderRightStyle, s.borderRightColor),
        offset,
      };
    };
    const name = (e: Element) => `${e.tagName.toLowerCase()}${typeof e.className === 'string' && e.className.trim() ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : ''}`;
    const found: string[] = [];
    /** Floated over the page and lifted by a shadow — a bar over a picked field, a menu: an overlay, not a box in a box. */
    const floats = (e: Element) => {
      const s = getComputedStyle(e);
      return (s.position === 'absolute' || s.position === 'fixed') && /(^|,\s*)(rgba?\([^)]*\)\s+)?-?\d+(\.\d+)?px -?\d+(\.\d+)?px [1-9]/.test(s.boxShadow) && !/inset/.test(s.boxShadow);
    };
    for (const e of document.querySelectorAll(scope)) {
      if (!shown(e) || e.closest('svg') || floats(e)) continue;
      const own = lines(e);
      // Only a box drawn all round counts as a box in a box.
      if (!(own.top && own.bottom && own.left && own.right)) continue;
      const r = e.getBoundingClientRect();
      const box = { top: r.top - own.offset, bottom: r.bottom + own.offset, left: r.left - own.offset, right: r.right + own.offset };
      let up = e.parentElement;
      for (let level = 0; up && level < 4; level++, up = up.parentElement) {
        if (!shown(up)) continue;
        const outer = lines(up);
        const q = up.getBoundingClientRect();
        const o = { top: q.top - outer.offset, bottom: q.bottom + outer.offset, left: q.left - outer.offset, right: q.right + outer.offset };
        // Drawn outside its parent, as a bar over a field is, it is no box in a box.
        const inside = box.top >= o.top - 1 && box.bottom <= o.bottom + 1 && box.left >= o.left - 1 && box.right <= o.right + 1;
        if (!inside) continue;
        const near = [outer.top && box.top - o.top <= 10, outer.bottom && o.bottom - box.bottom <= 10, outer.left && box.left - o.left <= 10, outer.right && o.right - box.right <= 10].filter(Boolean).length;
        if (near >= 2) {
          found.push(`${name(e)} in ${name(up)}`);
          break;
        }
      }
    }
    return [...new Set(found)];
  }, scope);
}

/**
 * Drag as a person aims: towards where the target is now — the fields move
 * aside as the gap travels — looking again until it stays put. `aim` gives
 * the point to head for, read afresh each time.
 */
export async function dragToward(page: Page, from: { x: number; y: number }, aim: () => Promise<{ x: number; y: number }>, options: { release?: boolean } = {}) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  let at = from;
  for (let look = 0; look < 5; look++) {
    const to = await aim();
    const steps = Math.max(2, Math.ceil(Math.hypot(to.x - at.x, to.y - at.y) / 60));
    for (let i = 1; i <= steps; i++) await page.mouse.move(at.x + ((to.x - at.x) * i) / steps, at.y + ((to.y - at.y) * i) / steps);
    at = to;
    await page.waitForTimeout(60);
    const now = await aim();
    if (Math.hypot(now.x - to.x, now.y - to.y) < 4) break;
  }
  if (options.release !== false) await page.mouse.up();
}

/**
 * Open the designers in Advanced, as a person who chose it finds them again: the browser remembers.
 * Call before going to the page. A fresh browser opens Simple, which keeps the panel to what most forms need.
 */
export async function inAdvanced(page: Page): Promise<void> {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('fieldia.designer.mode', 'advanced');
    } catch {
      // A browser that keeps nothing opens Simple.
    }
  });
}

// ---- the Advanced canvas -------------------------------------------------------

/** Each part's box, against the box of what holds the page's parts: on the canvas without the ring a part is picked by. */
export function boxes(page: Page, root: string): Promise<Record<string, { x: number; y: number; w: number; h: number }>> {
  return page.evaluate((root) => {
    const holder = document.querySelector(root) as HTMLElement;
    const o = holder.getBoundingClientRect();
    const out: Record<string, { x: number; y: number; w: number; h: number }> = {};
    for (const part of holder.querySelectorAll<HTMLElement>('[data-node]:not([role="tab"])')) {
      const r = part.getBoundingClientRect();
      if (!r.width || part.closest('[hidden]')) continue;
      // A field on the canvas reaches into the gap round it, so a ring can show; its own box is inside that.
      const s = getComputedStyle(part);
      const inset = part.classList.contains('fd-canvas-field') ? { x: parseFloat(s.paddingLeft), y: parseFloat(s.paddingTop) } : { x: 0, y: 0 };
      out[part.dataset['node'] as string] = { x: Math.round(r.left - o.left + inset.x), y: Math.round(r.top - o.top + inset.y), w: Math.round(r.width - 2 * inset.x), h: Math.round(r.height - 2 * inset.y) };
    }
    return out;
  }, root);
}

/** Press, move at hand speed — 60 px or so a step — and read the chip before letting go (or not). */
export async function dropAt(page: Page, from: { x: number; y: number }, to: { x: number; y: number }, options: { release?: boolean; shot?: string } = {}) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  const steps = Math.max(3, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / 60));
  for (let i = 1; i <= steps; i++) await page.mouse.move(from.x + ((to.x - from.x) * i) / steps, from.y + ((to.y - from.y) * i) / steps);
  await page.mouse.move(to.x + 1, to.y);
  const chip = page.locator('.fd-drop-chip');
  const words = (await chip.locator('.fd-drop-where').textContent()) ?? '';
  const refused = await chip.evaluate((c) => c.classList.contains('fd-drop-refused'));
  if (options.shot) await screen(page, options.shot, { viewport: true });
  if (options.release !== false) await page.mouse.up();
  return { words, refused };
}

export const centre = (b: { x: number; y: number; width: number; height: number }) => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });

/**
 * Every part on the canvas whose edges miss the columns of the grid it sits
 * on — through arrangements on its tracks — measured by its own box (a field
 * reaches into the gap round it for its ring). Parts sharing one cell are
 * exempt; the cell they share is not. Says how many it looked at.
 */
export function misalignedOnCanvas(page: Page): Promise<{ checked: number; off: string[] }> {
  return page.evaluate(() => {
    const off: string[] = [];
    let checked = 0;
    const onTracks = (grid: Element | null) => !!grid?.parentElement?.matches('.fd-section[data-place="tracks"]');
    for (const part of document.querySelectorAll<HTMLElement>('.fd-canvas-body .fd-grid > [data-node]')) {
      const r = part.getBoundingClientRect();
      if (!r.width || part.closest('[hidden]')) continue;
      const s = getComputedStyle(part);
      const inset = part.classList.contains('fd-canvas-field') ? parseFloat(s.paddingLeft) : 0;
      const box = { left: r.left + inset, right: r.right - inset };
      const shared = part.parentElement?.closest('.fd-section[data-place="shared"]');
      if (shared && shared !== part) continue;
      let grid: Element | null = part.parentElement;
      while (onTracks(grid)) grid = grid?.parentElement?.parentElement?.closest('.fd-grid') ?? null;
      if (!grid) continue;
      const style = getComputedStyle(grid);
      const tracks = style.gridTemplateColumns.split(' ').map(parseFloat);
      const gap = parseFloat(style.columnGap) || 0;
      const g = grid.getBoundingClientRect();
      const rtl = style.direction === 'rtl';
      const lefts: number[] = [];
      const rights: number[] = [];
      let x = rtl ? g.right : g.left;
      for (const width of tracks) {
        const left = rtl ? x - width : x;
        lefts.push(left);
        rights.push(left + width);
        x += rtl ? -(width + gap) : width + gap;
      }
      const near = (value: number, list: number[]) => list.some((edge) => Math.abs(edge - value) <= 1.5);
      checked++;
      const startsOn = rtl ? near(box.right, rights) : near(box.left, lefts);
      const endsOn = part.matches('.fd-button') || (rtl ? near(box.left, lefts) : near(box.right, rights));
      if (!startsOn || !endsOn) off.push(`${part.dataset['node']} in ${grid.parentElement?.getAttribute('data-node')}`);
    }
    return { checked, off };
  });
}

