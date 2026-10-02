import { expect, test } from '@playwright/test';
import { expectNoSidewaysScroll, open, screen } from './support';
import { VARIANTS } from './variants';

for (const variant of VARIANTS) {
for (const pageName of ['signup', 'survey', 'customer', 'custom']) {
  for (const skin of ['underline', 'outlined']) {
    test(`${variant}: ${pageName} renders in the ${skin} skin without errors`, async ({ page }) => {
      const { problems } = await open(page, variant, `page=${pageName}&skin=${skin}`);
      await expect(page.locator('.fd-form')).toHaveAttribute('data-fd-skin', skin);
      if (pageName === 'customer') await expect(page.locator('.fd-title input')).toHaveValue('Nile Traders');
      await expectNoSidewaysScroll(page);
      await screen(page, `${variant}-${pageName}-${skin}`);
      expect(problems).toEqual([]);
    });
  }
}

for (const [width, label] of [
  [390, 'phone'],
  [820, 'tablet'],
] as const) {
  for (const pageName of ['signup', 'customer']) {
    test(`${variant}: ${pageName} fits a ${label} (${width}px)`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await open(page, variant, `page=${pageName}&skin=outlined`);
      if (pageName === 'customer') await expect(page.locator('.fd-title input')).toHaveValue('Nile Traders');
      await expectNoSidewaysScroll(page);
      await screen(page, `${variant}-${pageName}-${label}`);
    });
  }
}
}
