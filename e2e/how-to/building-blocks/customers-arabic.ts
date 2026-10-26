import { expect } from '../../fixtures';
import type { Locator } from '@playwright/test';
import type { DemoReplay } from '../hand';

/** Where a text's first character and its last are drawn: a number written left to right starts at the left. */
const endsOf = (element: Locator) =>
  element.evaluate((node) => {
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    const texts: Text[] = [];
    for (let at = walker.nextNode(); at; at = walker.nextNode()) if ((at as Text).data.trim()) texts.push(at as Text);
    const range = document.createRange();
    const x = (text: Text, i: number) => (range.setStart(text, i), range.setEnd(text, i + 1), range.getBoundingClientRect().x);
    const [first, last] = [texts[0], texts[texts.length - 1]];
    const lead = first.data.search(/\S/);
    const tail = last.data.trimEnd().length - 1;
    return { first: x(first, lead), last: x(last, tail) };
  });

/** The customers-arabic demo's how-to steps, replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  steps: [
    {
      says: 'Look at the phone numbers: they read left to right on a right-to-left page.',
      async run({ page, see }) {
        await see(page.locator('.fd-list-records, .fd-list').first()).toBeVisible();
        const number = page.locator('.fd-list-row').first().locator('bdi').filter({ hasText: '+20 2 2735 1100', visible: true });
        await see(number).toHaveText('+20 2 2735 1100');
        await see(number).toHaveCSS('direction', 'ltr');
        // Its plus at its left, its last digit at its right.
        const ends = await endsOf(number);
        expect(ends.first).toBeLessThan(ends.last);
        await see(page.locator('.fd-form, .fd-list').first()).toHaveAttribute('dir', 'rtl');
      },
    },
    {
      says: 'Open the search menu: its groups run right to left.',
      async run({ page, phone, press, see }) {
        await press(page.getByRole('button', { name: 'خيارات البحث' }));
        const groups = page.locator('.fd-search-group');
        await see(groups.first()).toBeVisible();
        await see(groups.first()).toContainText('عوامل التصفية');
        const boxes = await groups.evaluateAll((all) => all.map((one) => one.getBoundingClientRect().toJSON() as DOMRect));
        if (phone) {
          // One over another on a phone: each starts at the right, as the page reads.
          const menu = (await groups.first().evaluate((one) => one.parentElement!.getBoundingClientRect().toJSON())) as DOMRect;
          for (const box of boxes) expect(Math.abs(box.x + box.width - (menu.x + menu.width))).toBeLessThan(24);
          // Its name at its right edge, written right to left.
          const name = groups.first().getByText('عوامل التصفية', { exact: true });
          await see(name).toBeVisible();
          const [named, group] = [(await name.boundingBox())!, boxes[0]];
          expect(Math.abs(named.x + named.width - (group.x + group.width))).toBeLessThan(24);
        } else {
          // Side by side: the first at the right, each next one to its left.
          for (let i = 1; i < boxes.length; i++) expect(boxes[i].x).toBeLessThan(boxes[i - 1].x);
        }
      },
    },
    {
      says: 'Page through the list: the arrows point the way the page reads.',
      async run({ page, phone, press, keys, see }) {
        if (!phone) await keys('Escape');
        else await press(page.getByRole('heading', { name: 'Customers' }));
        const pager = page.getByRole('button', { name: 'الصفحة التالية' }).locator('..');
        const [back, next] = [page.getByRole('button', { name: 'الصفحة السابقة' }), page.getByRole('button', { name: 'الصفحة التالية' })];
        await see(pager).toContainText('1–8 من 12');
        // The next page's arrow on the left, the way the page reads; drawn right to left, its › turned to point there.
        const [b, n] = [(await back.boundingBox())!, (await next.boundingBox())!];
        expect(n.x).toBeLessThan(b.x);
        await see(next).toHaveCSS('direction', 'rtl');
        await press(next);
        await see(pager).toContainText('9–12 من 12');
        await see(next).toBeDisabled();
        await see(back).toBeEnabled();
        await press(back);
        await see(pager).toContainText('1–8 من 12');
      },
    },
  ],
};
