import { AxeBuilder } from '@axe-core/playwright';
import type { Page } from '@playwright/test';

/**
 * The accessibility sweep's tools: axe run on the page as it stands, against
 * WCAG 2.2 at levels A and AA, and what it finds written as lines a person can
 * act on — the state, the rule, where, and axe's own words.
 */

/** WCAG 2.0, 2.1 and 2.2, levels A and AA, as axe tags its rules. */
export const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

/**
 * Findings that are not failures, each with why. Only a real false positive
 * goes here — never a rule turned off for a whole page — and the list must
 * stay short: a test fails if it grows past a handful.
 */
export const ALLOWED: readonly { rule: string; where: string; why: string }[] = [
  {
    rule: 'scrollable-region-focusable',
    where: 'class="fd-search-list"',
    why: 'Search more…’s list is worked from its search box: the arrow keys move the active option (aria-activedescendant) and scroll it into view, so every row is reached by keyboard. axe looks only for focus inside the list.',
  },
  {
    rule: 'scrollable-region-focusable',
    where: 'class="fd-path-callout"',
    why: 'A path picker’s tree is worked from its box: the arrow keys, Home and End move the active row (aria-activedescendant) and scroll it into view, so every row is reached by keyboard. axe looks only for focus inside the list.',
  },
];

/** `where` is matched against the element's selector and its opening tag. */
const allowed = (rule: string, where: string) => ALLOWED.some((a) => a.rule === rule && where.includes(a.where));

/**
 * A bar kept at the foot of the screen as the page scrolls — Try it's drawer, the + bar of a phone's designer: a target
 * partly under it where the page stands is scrolled clear by a person, and one reached by the keys is moved clear of it
 * (the designer's bottom-bar.ts). axe, looking at one scroll, counts such a target too small; it is too small only where
 * something other than such a bar covers it — or where, reached by the keys, it is still under the bar: that is
 * checked here, for each target so excused, on every page and in every state the sweep meets one (`reachedClear`).
 */
const FOOT_BARS = '.fd-try-drawer, .fd-q-rail, .fd-foot-bar';

/**
 * Where a target axe found under a bar at the foot is when the keys reach it: focused, as Tab focuses it — the
 * browser's own scroll on focus, then the bar's move of it (bottom-bar.ts, a frame later) — whether its centre is its
 * own (or its label's). Null when clear, or when no key reaches it (it takes no focus: a person scrolls to it); else
 * what lies over it. The focus and every scroll are put back as they were, so the sweep changes nothing of the page.
 */
async function reachedUnder(page: Page, selector: string): Promise<string | null> {
  return page.evaluate(async (selector) => {
    const target = document.querySelector<HTMLElement>(selector);
    if (!target) return null;
    const before = document.activeElement as HTMLElement | null;
    const scrolls: [Element, number, number][] = [];
    for (let at = target.parentElement; at; at = at.parentElement) scrolls.push([at, at.scrollTop, at.scrollLeft]);
    const pageAt = [scrollX, scrollY] as const;
    target.focus();
    if (document.activeElement !== target) return null;
    for (let frames = 0; frames < 3; frames++) await new Promise((done) => requestAnimationFrame(done));
    const box = target.getBoundingClientRect();
    const hit = document.elementFromPoint(Math.min(Math.max(box.left + box.width / 2, 0), innerWidth - 1), Math.min(Math.max(box.top + box.height / 2, 0), innerHeight - 1));
    const label = hit?.closest('label');
    const over = !hit || hit === target || target.contains(hit) || hit.contains(target) || (!!label && label === target.closest('label')) ? null : `${hit.tagName.toLowerCase()}.${[...hit.classList].slice(0, 2).join('.')}`;
    target.blur();
    if (before && before !== document.body) before.focus({ preventScroll: true });
    for (const [at, top, left] of scrolls) {
      at.scrollTop = top;
      at.scrollLeft = left;
    }
    scrollTo(...pageAt);
    return over;
  }, selector);
}

/** Wait two frames, so a transition caught half way does not read as low contrast. */
export const settle = (page: Page) => page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));

/**
 * What axe finds on the page now, one line each; empty when the page passes. `within`: only what a popover open over
 * the page holds — a target it covers for the moment it is open (a list's sort under a filter's menu) is no target too
 * small, and the page under it is swept closed.
 */
export async function axeFindings(page: Page, state: string, within?: string): Promise<string[]> {
  await settle(page);
  const builder = new AxeBuilder({ page }).withTags(WCAG_TAGS);
  const { violations } = await (within ? builder.include(within) : builder).analyze();
  // The targets axe finds too small only because a bar at the foot of the screen lies over them where the page stands,
  // and that the keys reach clear of it; one the keys leave under it is a finding, said so.
  const underFootBar = new Set<string>();
  const reachedUnderBar = new Map<string, string>();
  for (const v of violations.filter((v) => v.id === 'target-size')) {
    for (const n of v.nodes) {
      const covering = n.any.filter((c) => c.id === 'target-size').flatMap((c) => (c.relatedNodes ?? []).map((r) => r.target.join(' ')));
      const onlyFootBars = covering.length > 0 && (await page.evaluate(([selectors, bars]) => selectors.every((s) => !!document.querySelector(s)?.closest(bars)), [covering, FOOT_BARS] as const));
      if (!onlyFootBars) continue;
      const over = await reachedUnder(page, n.target.join(' '));
      if (over) reachedUnderBar.set(n.target.join(' '), over);
      else underFootBar.add(n.target.join(' '));
    }
  }
  return violations.flatMap((v) =>
    v.nodes
      .filter((n) => !allowed(v.id, `${n.target.join(' ')} ${n.html}`))
      .filter((n) => v.id !== 'target-size' || !underFootBar.has(n.target.join(' ')))
      .map((n) => {
        const under = v.id === 'target-size' ? reachedUnderBar.get(n.target.join(' ')) : undefined;
        const why = under ? `reached by the keys, still under ${under}, a bar at the foot of the screen` : ([...n.any, ...n.all, ...n.none][0]?.message ?? v.help);
        return `${state} · ${v.id} · ${n.target.join(' ')} · ${why}`;
      })
  );
}
