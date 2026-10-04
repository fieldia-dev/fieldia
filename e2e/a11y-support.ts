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
];

/** `where` is matched against the element's selector and its opening tag. */
const allowed = (rule: string, where: string) => ALLOWED.some((a) => a.rule === rule && where.includes(a.where));

/** Wait two frames, so a transition caught half way does not read as low contrast. */
export const settle = (page: Page) => page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));

/** What axe finds on the page now, one line each; empty when the page passes. */
export async function axeFindings(page: Page, state: string): Promise<string[]> {
  await settle(page);
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  return violations.flatMap((v) =>
    v.nodes
      .filter((n) => !allowed(v.id, `${n.target.join(' ')} ${n.html}`))
      .map((n) => {
        const why = [...n.any, ...n.all, ...n.none][0]?.message ?? v.help;
        return `${state} · ${v.id} · ${n.target.join(' ')} · ${why}`;
      })
  );
}
