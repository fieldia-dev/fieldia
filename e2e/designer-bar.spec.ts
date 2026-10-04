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
