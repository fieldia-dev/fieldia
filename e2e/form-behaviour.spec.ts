import { expect, test } from '@playwright/test';
import { node, open, screen } from './support';
import { VARIANTS } from './variants';

/** Behaviour around the fields: the ✓ of a field filled in right. */
for (const variant of VARIANTS) {
  test.describe(`${variant} · form behaviour`, () => {
    test('a ✓ appears by a field filled in right when the page asks, and goes when it goes wrong', async ({ page }) => {
      await open(page, variant, 'page=signup&skin=outlined&showValid=1');
      const name = node(page, 'f-name');
      const email = node(page, 'f-email');
      await expect(name.locator('.fd-valid-mark')).toBeHidden();
      await name.locator('input').fill('Sara Hassan');
      await expect(name.locator('.fd-valid-mark')).toBeVisible();
      await email.locator('input').fill('sara@');
      await expect(email.locator('.fd-valid-mark')).toBeHidden();
      await email.locator('input').fill('sara@example.com');
      await expect(email.locator('.fd-valid-mark')).toBeVisible();
      // On the label's own line, right after its words.
      const label = (await name.locator('.fd-label').boundingBox())!;
      const mark = (await name.locator('.fd-valid-mark').boundingBox())!;
      expect(Math.abs(mark.y + mark.height / 2 - (label.y + label.height / 2))).toBeLessThan(4);
      expect(mark.x).toBeGreaterThan(label.x);
      await screen(page, `${variant}-valid-marks`, { viewport: true });
      await name.locator('input').fill('');
      await expect(name.locator('.fd-valid-mark')).toBeHidden();
    });

    test('no ✓ unless the page asks', async ({ page }) => {
      await open(page, variant, 'page=signup&skin=outlined');
      await node(page, 'f-name').locator('input').fill('Sara Hassan');
      await expect(node(page, 'f-name').locator('.fd-valid-mark')).toHaveCount(0);
    });
  });
}
