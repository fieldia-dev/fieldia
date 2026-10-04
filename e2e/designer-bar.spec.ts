import { expect, test, type Page } from '@playwright/test';
import { screen } from './support';

/**
 * The designer's bar holds the page's title, where it stands, Find, Undo,
 * the ways to look at the page, Checks and Publish, in two rows by design —
 * the page and what to do with it on top, the ways to look at it beneath —
 * never a button left alone on a line, whatever the font is.
 */

const middle = async (page: Page, selector: string) => {
  const box = (await page.locator(`.fd-designer-bar ${selector}`).first().boundingBox())!;
  return { top: box.y, bottom: box.y + box.height, centre: box.y + box.height / 2, right: box.x + box.width };
};

for (const [name, path] of [['screen editor', '/screen/'], ['survey designer', '/designer/?start=survey']] as const) {
  test(`${name}: the bar keeps its actions on one row, and the ways to look at the page on one of their own`, async ({ page }) => {
    for (const width of [1600, 1280, 1024]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(path);
      await expect(page.locator('.fd-designer-bar')).toBeVisible();
      const title = await middle(page, '.fd-designer-title');
      const views = await middle(page, '.fd-mode:not(.fd-mode-switch)');
      for (const action of ['[data-checks]', '.fd-button-primary']) {
        expect(Math.abs((await middle(page, action)).centre - title.centre), `${width}px: ${action} beside the title`).toBeLessThanOrEqual(6);
      }
      const bar = (await page.locator('.fd-designer-bar').boundingBox())!;
      const parts = await page.locator('.fd-designer-bar > *').evaluateAll((all) => all.map((p) => p.getBoundingClientRect()).filter((r) => r.width > 0).map((r) => r.right));
      expect(Math.max(...parts), `${width}px: nothing past the bar`).toBeLessThanOrEqual(bar.x + bar.width + 0.5);
      expect(views.top, `${width}px: the views beneath`).toBeGreaterThan(title.bottom);
      await screen(page, `designer-bar-${name.split(' ')[0]}-${width}`, { viewport: true });
    }
  });
}

test('at a phone’s width: the views three to a row, none alone, and a question’s words the width of its card', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/designer/?start=survey');
  const tops = await page.locator('.fd-designer-bar .fd-mode:not(.fd-mode-switch) [data-mode]').evaluateAll((all) => all.map((b) => Math.round(b.getBoundingClientRect().top)));
  const rows = new Map<number, number>();
  for (const top of tops) rows.set(top, (rows.get(top) ?? 0) + 1);
  expect([...rows.values()].every((n) => n >= 2), `views per row: ${[...rows.values()]}`).toBe(true);
  await page.locator('.fd-q').nth(1).click();
  const card = page.locator('.fd-q-selected');
  const words = (await card.locator('.fd-q-head > :first-child').boundingBox())!;
  const kind = (await card.locator('.fd-q-kind').boundingBox())!;
  const own = (await card.boundingBox())!;
  // The words over the kind, each the card's width less its room.
  expect(kind.y).toBeGreaterThanOrEqual(words.y + words.height - 1);
  expect(words.width).toBeGreaterThan(own.width - 80);
  await screen(page, 'designer-survey-phone-card', { viewport: true });
});

test('the rail and the panel stop under the bar as the page scrolls, however tall the bar is', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 700 });
  await page.goto('/screen/?start=layout');
  await expect(page.locator('.fd-designer')).toBeVisible();
  // Mid-page: at the very end, a section that ends pushes what sticks in it up with it, as sticking does.
  await page.mouse.wheel(0, 500);
  await page.waitForTimeout(300);
  const bar = (await page.locator('.fd-designer-bar').boundingBox())!;
  for (const part of ['.fd-rail', '.fd-properties']) {
    const box = (await page.locator(part).first().boundingBox())!;
    expect(box.y, `${part} under the bar`).toBeGreaterThanOrEqual(bar.y + bar.height);
  }
  await screen(page, 'designer-bar-scrolled', { viewport: true });
});
