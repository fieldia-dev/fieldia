import { expect, test } from '@playwright/test';
import { expectNoSidewaysScroll, open, screen } from './support';

for (const pageName of ['signup', 'survey', 'customer']) {
  for (const skin of ['underline', 'outlined']) {
    test(`${pageName} renders in the ${skin} skin without errors`, async ({ page }) => {
      const { problems } = await open(page, 'plain', `page=${pageName}&skin=${skin}`);
      await expect(page.locator('.fd-form')).toHaveAttribute('data-fd-skin', skin);
      if (pageName === 'customer') await expect(page.locator('.fd-title input')).toHaveValue('Nile Traders');
      await expectNoSidewaysScroll(page);
      await screen(page, `plain-${pageName}-${skin}`);
      expect(problems).toEqual([]);
    });
  }
}

for (const [width, label] of [
  [390, 'phone'],
  [820, 'tablet'],
] as const) {
  for (const pageName of ['signup', 'customer']) {
    test(`${pageName} fits a ${label} (${width}px)`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await open(page, 'plain', `page=${pageName}&skin=outlined`);
      if (pageName === 'customer') await expect(page.locator('.fd-title input')).toHaveValue('Nile Traders');
      await expectNoSidewaysScroll(page);
      await screen(page, `plain-${pageName}-${label}`);
    });
  }
}
