import type { Page } from '@playwright/test';

/**
 * Walking a page by Tab, as a keyboard user does, and reading what each stop
 * looks like. Used by a11y-keyboard.spec.ts for what axe cannot check: the
 * order, the focus ring, what the sticky bar covers, and traps.
 */

/** One stop on the walk: where focus landed, and what it looked like there. */
export interface Stop {
  /** A short name to read in a failure: tag, classes, label. */
  name: string;
  /** The element's place in the page, in document order. */
  order: number;
  /** Whether it shows that it has focus: an outline, a ring, a border or ground that changed, or a line drawn under it. */
  ringed: boolean;
  /** How much of it the sticky bar covers, 0 to 1; 0 when there is no bar or it is in the bar. */
  covered: number;
  /** In a code editor, which takes Tab to indent: Escape, then Tab, leaves it. */
  code: boolean;
}

/**
 * Mark every element's look at rest, before anything has focus, so a stop can
 * be compared with it: an outline, a box-shadow, a border colour and a ground.
 */
export async function markRest(page: Page): Promise<void> {
  await page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur();
    // The element's own ring, border and ground, and a line drawn by ::before or ::after (an underline that grows in).
    const look = (e: Element) => {
      const s = getComputedStyle(e);
      const drawn = ['::before', '::after'].map((at) => {
        const p = getComputedStyle(e, at);
        return p.content === 'none' ? '' : [p.transform, p.opacity, p.backgroundColor, p.borderColor].join(',');
      });
      return [s.outlineStyle, s.outlineWidth, s.outlineColor, s.boxShadow, s.borderColor, s.backgroundColor, ...drawn].join('|');
    };
    const rest = new WeakMap<Element, string>();
    for (const e of document.querySelectorAll('body *')) rest.set(e, look(e));
    (window as unknown as { __rest: WeakMap<Element, string>; __look: (e: Element) => string }).__rest = rest;
    (window as unknown as { __look: (e: Element) => string }).__look = look;
  });
}

/** Where focus is now, read as a stop. */
export function readStop(page: Page, bar: string | null): Promise<Stop | null> {
  return page.evaluate((barSelector) => {
    // Where a transition is going, not where it has got to: a ring that fades in is a ring.
    // Styles are worked out first, so a transition focus has just set off exists to be finished.
    for (let e: Element | null = document.activeElement; e; e = e.parentElement) void getComputedStyle(e).borderColor;
    for (const animation of document.getAnimations()) {
      try {
        animation.finish();
      } catch {
        // One that runs for ever has no end to jump to.
      }
    }
    let at = document.activeElement as HTMLElement | null;
    while (at?.shadowRoot?.activeElement) at = at.shadowRoot.activeElement as HTMLElement;
    if (!at || at === document.body) return null;
    const w = window as unknown as { __rest?: WeakMap<Element, string>; __look?: (e: Element) => string };
    const changed = (e: Element) => !!w.__rest?.has(e) && w.__rest.get(e) !== w.__look?.(e);
    // The ring may be drawn on the element, or on the box round it (a field's box, a CodeMirror editor).
    // Focus on a part the browser draws inside a box (a date box's calendar button): the box is not :focus, and the browser rings its part itself.
    let ringed = !at.matches(':focus');
    for (let e: Element | null = at, up = 0; e && up < 3 && !ringed; e = e.parentElement, up++) {
      const s = getComputedStyle(e);
      const outline = s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 1;
      ringed = (e === at && outline) || changed(e);
    }
    const all = [...document.querySelectorAll('*')];
    const label = at.getAttribute('aria-label') ?? at.getAttribute('title') ?? (at.textContent ?? '').trim().slice(0, 30);
    const classes = typeof at.className === 'string' ? at.className.trim().split(/\s+/).slice(0, 2).join('.') : '';
    // The sticky bar, when it is stuck over the page: how much of the stop it hides.
    let covered = 0;
    const barEl = barSelector ? document.querySelector(barSelector) : null;
    if (barEl && !barEl.contains(at)) {
      const b = barEl.getBoundingClientRect();
      const r = at.getBoundingClientRect();
      const overlap = Math.max(0, Math.min(r.bottom, b.bottom) - Math.max(r.top, b.top)) * Math.max(0, Math.min(r.right, b.right) - Math.max(r.left, b.left));
      covered = r.width * r.height > 0 ? overlap / (r.width * r.height) : 0;
    }
    return {
      name: `${at.tagName.toLowerCase()}${classes ? '.' + classes : ''}${at.getAttribute('role') ? `[role=${at.getAttribute('role')}]` : ''} "${label}"`,
      order: all.indexOf(at),
      ringed,
      covered,
      // The JSON view's box and a CodeMirror editor keep Tab for indenting.
      code: !!at.closest('.cm-editor, .fd-json textarea'),
    };
  }, bar);
}

/**
 * Press Tab (or Shift+Tab) from where focus is until it comes back round or
 * leaves the page, reading every stop. A code editor is left as its own help
 * says: Escape, then Tab. Stops when `limit` presses have gone by — a trap.
 */
export async function tabWalk(page: Page, options: { back?: boolean; limit?: number; bar?: string | null } = {}): Promise<{ stops: Stop[]; trapped: boolean }> {
  const stops: Stop[] = [];
  const limit = options.limit ?? 400;
  const seen = new Set<string>();
  for (let i = 0; i < limit; i++) {
    const before = await readStop(page, options.bar ?? null);
    if (before?.code) await page.keyboard.press('Escape');
    await page.keyboard.press(options.back ? 'Shift+Tab' : 'Tab');
    const stop = await readStop(page, options.bar ?? null);
    if (!stop) return { stops, trapped: false };
    const key = `${stop.order}:${stop.name}`;
    // Back where the walk began: round once.
    if (seen.has(key) && stops.length > 1 && key === `${stops[0].order}:${stops[0].name}`) return { stops, trapped: false };
    seen.add(key);
    stops.push(stop);
  }
  return { stops, trapped: true };
}

/**
 * What can be pressed or typed in on the page and is in the Tab order, or
 * belongs to a group the arrows move through (tabs, a radio group, a menu,
 * a toolbar, a tree), where one member stands for the group. Returns each as
 * the same short name a stop has, with its place.
 */
export function controls(page: Page, scope = 'body'): Promise<{ name: string; order: number; group: number | null }[]> {
  return page.evaluate((scopeSelector) => {
    const all = [...document.querySelectorAll('*')];
    const root = document.querySelector(scopeSelector) ?? document.body;
    const shown = (e: Element) => {
      if (e.closest('[hidden], [inert], [aria-hidden="true"]')) return false;
      const r = e.getBoundingClientRect();
      const s = getComputedStyle(e);
      return r.width > 0 && r.height > 0 && s.visibility !== 'hidden';
    };
    const selector = 'a[href], button, input:not([type="hidden"]), select, textarea, [tabindex], [role="button"], [role="tab"], [role="checkbox"], [role="switch"], [role="link"], [role="menuitem"], [role="treeitem"], [role="separator"][tabindex]';
    const groups = '[role="tablist"], [role="radiogroup"], [role="menu"], [role="toolbar"], [role="tree"], [role="listbox"], [role="grid"]';
    return [...root.querySelectorAll(selector)]
      .filter((e) => shown(e) && !(e as HTMLButtonElement).disabled && e.getAttribute('tabindex') !== '-1' || (e.getAttribute('tabindex') === '-1' && e.closest(groups) && shown(e)))
      .filter((e) => !(e as HTMLButtonElement).disabled)
      .map((e) => {
        const at = e as HTMLElement;
        const label = at.getAttribute('aria-label') ?? at.getAttribute('title') ?? (at.textContent ?? '').trim().slice(0, 30);
        const classes = typeof at.className === 'string' ? at.className.trim().split(/\s+/).slice(0, 2).join('.') : '';
        // Native radios of one name are one stop, as a radio group is.
        const group = at.closest(groups) ?? (at instanceof HTMLInputElement && at.type === 'radio' ? at.form?.querySelector(`[name="${at.name}"]`) ?? null : null);
        return {
          name: `${at.tagName.toLowerCase()}${classes ? '.' + classes : ''}${at.getAttribute('role') ? `[role=${at.getAttribute('role')}]` : ''} "${label}"`,
          order: all.indexOf(at),
          group: group ? all.indexOf(group) : null,
        };
      });
  }, scope);
}

// ---- the designer's page, read as the tests need it ----------------------------------

/** The ids of a container's children, in order, from the page being built. */
export const kids = (page: Page, id: string) =>
  page.evaluate((container) => {
    const find = (n: { id: string; children?: unknown[] }): { id: string; children?: unknown[] } | null =>
      n.id === container ? n : ((n.children ?? []) as { id: string; children?: unknown[] }[]).map(find).find(Boolean) ?? null;
    const root = (window as any).fieldiaDesigner.designer.getPage().layout;
    return ((find(root)?.children ?? []) as { id: string }[]).map((c) => c.id);
  }, id);
export const spanOf = (page: Page, id: string) =>
  page.evaluate((part) => {
    const find = (n: { id: string; colspan?: number; children?: unknown[] }): { colspan?: number } | null =>
      n.id === part ? n : ((n.children ?? []) as { id: string; children?: unknown[] }[]).map(find).find(Boolean) ?? null;
    return find((window as any).fieldiaDesigner.designer.getPage().layout)?.colspan ?? 1;
  }, id);
/** A field of the canvas, by its id. */
export const card = (page: Page, id: string) => page.locator(`.fd-canvas-body .fd-canvas-field[data-node="${id}"]`);
