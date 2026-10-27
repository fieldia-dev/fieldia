import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { inBar, watch } from './designer-support';
import { expectNoSidewaysScroll, screen } from './support';

/** The bar's Find anything, named holding the keys it shows. */
const FIND = /^Find anything, (Ctrl K|⌘K)$/;

/**
 * The designers on a phone, as the walk of 0.29 met them (390×844, WebKit): the survey designer's bar was about 210px
 * tall and stayed on screen, the whole toolbox came first — the first question some 2,100px down — and a page's title
 * was cut to "Your ex". Now the bar is one row that keeps to its height — the title, Publish and More, the rest under
 * More — the toolbox waits behind the + of the bar at the foot and comes up in a sheet, so the form starts near the
 * top, and a title's box wraps its words, its buttons under it where there is no room. The screen designer the same.
 * At a phone's 390px and a small one's 360px, light, in every engine.
 */

const PHONES = [
  { width: 390, height: 844 },
  { width: 360, height: 780 },
];
const bar = (page: Page) => page.locator('.fd-designer-bar');
const height = async (page: Page, selector: string) => (await page.locator(selector).first().boundingBox())!.height;

/** Whether a box shows all its words: nothing scrolled out of sight across or down. */
const whole = (page: Page, selector: string) =>
  page.locator(selector).first().evaluate((box) => (box as HTMLElement).scrollWidth <= box.clientWidth + 1 && (box as HTMLElement).scrollHeight <= box.clientHeight + 1);

for (const phone of PHONES) {
  test.describe(`at ${phone.width}px`, () => {
    test.beforeEach(async ({ page }) => page.setViewportSize(phone));

    test('the survey designer: one row of bar, the form near the top, the toolbox behind the +, every title whole', async ({ page }) => {
      const problems = watch(page);
      // The walk's way in: the Designer page's "A survey, the Google Forms way".
      await page.goto('/designer/?start=survey');
      await expect(page.locator('.fd-q').first()).toBeVisible();
      // One row: the title, Publish and More; nothing else of the bar is on show.
      expect(await height(page, '.fd-designer-bar')).toBeLessThanOrEqual(76);
      for (const name of ['Publish', 'More']) await expect(bar(page).getByRole('button', { name, exact: true })).toBeInViewport();
      for (const name of ['Try it', 'Checks', 'Find anything']) await expect(bar(page).getByRole('button', { name, exact: false }).first()).toBeHidden();
      expect(await whole(page, '.fd-designer-title')).toBe(true);
      // No toolbox above the form: the first question in the first screen, not 2,100px down.
      await expect(page.locator('.fd-rail')).toBeHidden();
      const first = (await page.locator('.fd-q').first().boundingBox())!;
      expect(first.y).toBeLessThan(phone.height);
      await expectNoSidewaysScroll(page);
      await screen(page, `designer-phone-${phone.width}-survey`, { viewport: true });

      // Scrolled, the bar that stays is that one row.
      await page.mouse.wheel(0, 1500);
      await expect.poll(async () => (await bar(page).boundingBox())!.y).toBeLessThanOrEqual(1);
      expect(await height(page, '.fd-designer-bar')).toBeLessThanOrEqual(76);

      // The page's title the walk saw cut: whole, its buttons under it where the row has no room.
      const step = page.locator('.fd-design-step').filter({ has: page.locator('.fd-step-title') }).nth(2);
      await expect(step.locator('.fd-step-title')).toHaveValue('Your experience');
      await step.locator('.fd-step-title').scrollIntoViewIfNeeded();
      expect(await step.locator('.fd-step-title').evaluate((box) => box.scrollWidth <= box.clientWidth + 1 && box.scrollHeight <= box.clientHeight + 1)).toBe(true);
      const title = (await step.locator('.fd-step-title-box').boundingBox())!;
      const tools = (await step.locator('.fd-step-tools').boundingBox())!;
      expect(tools.x >= title.x + title.width - 1 || tools.y >= title.y + title.height - 1, 'beside the title, or under it').toBe(true);
      // The form's own heading and description: wrapped, never cut.
      for (const box of ['.fd-survey-head-title', '.fd-survey-head-description']) expect(await whole(page, box), box).toBe(true);
      await screen(page, `designer-phone-${phone.width}-page-title`, { viewport: true });

      // Its endings, under the pages: each card as wide as the column, nothing of it past its edge.
      await page.getByRole('button', { name: 'Add an ending' }).click();
      const ending = page.locator('.fd-ending').first();
      await ending.scrollIntoViewIfNeeded();
      const edge = await ending.evaluate((card) => card.getBoundingClientRect().right);
      const past = await ending.locator('*').evaluateAll((all, right) => all.filter((e) => e.getClientRects().length > 0 && e.getBoundingClientRect().right > right + 1).map((e) => `${e.tagName.toLowerCase()}.${e.className}`), edge);
      expect(past).toEqual([]);
      await expectNoSidewaysScroll(page);
      await screen(page, `designer-phone-${phone.width}-endings`, { viewport: true });

      // The + at the foot opens the toolbox as a sheet over the page; a kind picked is added, the sheet gone.
      await page.locator('.fd-q-closed').filter({ hasText: 'How would you rate it?' }).click();
      const plus = page.locator('.fd-q-rail').getByRole('button', { name: 'Open the toolbox' });
      await expect(plus).toBeInViewport();
      await plus.click();
      const sheet = page.getByRole('dialog', { name: 'Add, outline and data' });
      await expect(sheet).toBeVisible();
      await expect(plus).toHaveAttribute('aria-expanded', 'true');
      await expect(sheet.getByRole('tab', { name: 'Add' })).toBeFocused();
      await expectNoSidewaysScroll(page);
      await screen(page, `designer-phone-${phone.width}-toolbox`, { viewport: true });
      const before = await page.locator('.fd-q').count();
      await sheet.getByRole('button', { name: /^Dropdown/ }).click();
      await expect(sheet).toBeHidden();
      await expect(page.locator('.fd-q')).toHaveCount(before + 1);
      await expect(page.locator('.fd-q-selected .fd-q-kind')).toContainText('Dropdown');
      await expect(page.locator('.fd-q-selected .fd-q-label')).toBeFocused();
      await page.keyboard.type('Which plan are you on?');
      await expect(page.locator('.fd-q-selected .fd-q-label')).toHaveValue('Which plan are you on?');
      // Escape puts it away, the keys back on the +.
      await plus.click();
      await expect(sheet).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(sheet).toBeHidden();
      await expect(plus).toBeFocused();
      await expect(plus).toHaveAttribute('aria-expanded', 'false');

      // The rest of the bar, under More: a view picked puts it away.
      await (await inBar(page, 'Try it')).click();
      await expect(page.locator('.fd-try')).toBeVisible();
      await expect(bar(page).getByRole('button', { name: 'Try it' })).toBeHidden();
      await expect(bar(page).getByRole('button', { name: 'More', exact: true })).toHaveAttribute('aria-expanded', 'false');
      await (await inBar(page, 'Design')).click();
      await expect(page.locator('.fd-q').first()).toBeVisible();
      expect(problems).toEqual([]);
    });

    test('the bar’s More: everything else of the bar, the keys going in and back out, a press elsewhere putting it away', async ({ page }) => {
      await page.goto('/designer/?start=survey');
      const more = bar(page).getByRole('button', { name: 'More', exact: true });
      await more.click();
      await expect(more).toHaveAttribute('aria-expanded', 'true');
      // Find anything named holding the keys it shows (WCAG 2.5.3): "Find anything, Ctrl K".
      for (const name of [FIND, 'Design', 'Try it', 'JSON', 'Translations', 'Rules', 'Look']) await expect(bar(page).getByRole('button', { name, exact: true })).toBeInViewport();
      await expect(bar(page).locator('[data-checks]')).toBeInViewport();
      await expect(bar(page).locator('.fd-designer-status')).toBeFocused();
      await expectNoSidewaysScroll(page);
      await screen(page, `designer-phone-${phone.width}-more`, { viewport: true });
      // Escape: put away, the keys on More.
      await page.keyboard.press('Escape');
      await expect(bar(page).getByRole('button', { name: 'Try it' })).toBeHidden();
      await expect(more).toBeFocused();
      // A press beside it, on the page, puts it away.
      await more.click();
      await expect(bar(page).getByRole('button', { name: 'Try it' })).toBeVisible();
      await page.mouse.click(6, phone.height - 200);
      await expect(bar(page).getByRole('button', { name: 'Try it' })).toBeHidden();
      // Checks opened from it: its popover over it, the bar's parts kept until it is done.
      await (await inBar(page, FIND)).click();
      await expect(page.getByRole('dialog', { name: 'Find anything' })).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(bar(page).getByRole('button', { name: FIND })).toBeFocused();
    });

    test('the screen designer: one row of bar, the screen near the top, the toolbox behind the + at the foot', async ({ page }) => {
      const problems = watch(page);
      await page.goto('/screen/');
      await expect(page.locator('.fd-canvas-field').first()).toBeVisible();
      expect(await height(page, '.fd-designer-bar')).toBeLessThanOrEqual(76);
      for (const name of ['Simple', 'Try it', 'Checks']) await expect(bar(page).getByRole('button', { name, exact: false }).first()).toBeHidden();
      await expect(page.locator('.fd-rail')).toBeHidden();
      expect((await page.locator('.fd-canvas-field').first().boundingBox())!.y).toBeLessThan(phone.height / 2);
      const plus = page.locator('.fd-foot-bar').getByRole('button', { name: 'Open the toolbox' });
      await expect(plus).toBeInViewport();
      // At the foot of the screen, wherever it is scrolled to.
      const foot = (await plus.boundingBox())!;
      expect(foot.y + foot.height).toBeGreaterThan(phone.height - 80);
      await expectNoSidewaysScroll(page);
      await screen(page, `designer-phone-${phone.width}-screen`, { viewport: true });
      await plus.click();
      const sheet = page.getByRole('dialog', { name: 'Add, outline and data' });
      await expect(sheet).toBeVisible();
      await sheet.getByRole('button', { name: /^Email/ }).click();
      await expect(sheet).toBeHidden();
      const label = page.locator('.fd-canvas-field.fd-editing [data-inline="label"]');
      await expect(label).toBeFocused();
      // Typed where it stands, clear of the bar at the foot.
      await page.keyboard.type('Contact email');
      await expect(label).toHaveValue('Contact email');
      const typed = (await label.boundingBox())!;
      expect(typed.y + typed.height).toBeLessThanOrEqual((await plus.boundingBox())!.y);
      // The rest of the bar under More, Simple and Advanced among it.
      await (await inBar(page, 'Advanced')).click();
      await expect(page.locator('.fd-screen-designer')).toHaveAttribute('data-mode', 'advanced');
      expect(problems).toEqual([]);
    });
  });
}

test('wider than a phone, the bar is as it was: no More, the views on their own row; and the toolbox beside the page', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/designer/?start=survey');
  await expect(bar(page).getByRole('button', { name: 'More', exact: true })).toBeHidden();
  await expect(bar(page).getByRole('button', { name: 'Try it' })).toBeVisible();
  await expect(page.locator('.fd-rail')).toBeVisible();
  await expect(page.locator('.fd-q-rail').getByRole('button', { name: 'Open the toolbox' })).toBeHidden();
  await expect(page.locator('.fd-q-rail').getByRole('button', { name: 'Add a question after this one' })).toBeVisible();
  await page.goto('/screen/');
  await expect(page.locator('.fd-rail')).toBeVisible();
  await expect(page.locator('.fd-foot-bar')).toBeHidden();
});
