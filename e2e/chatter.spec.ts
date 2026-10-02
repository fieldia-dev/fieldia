import { expect, test, type Page } from '@playwright/test';
import { node, open, screen } from './support';
import { VARIANTS } from './variants';

/** The chatter beside the customer sheet, in every framework. */
const chatter = (page: Page) => page.locator('.fd-slot[data-slot="chatter"] .fd-chatter');
const posted = (page: Page) => page.evaluate(() => (window as any).fieldiaDemo.chatter.posted as { kind: string; body: string; parentId?: number; mentions?: { name: string }[]; attachments?: { name: string }[] }[]);

for (const variant of VARIANTS) {
  test.describe(`${variant} · chatter`, () => {
    test('sits beside the sheet without stretching it, and lays its parts out to read', async ({ page }) => {
      await open(page, variant, 'page=customer&skin=underline');
      await expect(chatter(page).locator('.fd-activity')).toHaveCount(3);
      // The sheet keeps its own height: a badge stays a badge, the title follows close behind.
      const badge = (await node(page, 'b-key-account').boundingBox())!;
      expect(badge.height, 'the badge is stretched').toBeLessThan(40);
      // An activity's summary has room to read: never broken word by word.
      const summary = (await chatter(page).locator('.fd-activity-summary').nth(1).boundingBox())!;
      expect(summary.width, 'the summary is squeezed').toBeGreaterThan(150);
      await screen(page, `${variant}-chatter`, { viewport: true });
    });
  });
}
