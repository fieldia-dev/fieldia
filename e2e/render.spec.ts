import { expect, test } from '@playwright/test';
import { expectNoSidewaysScroll, open, screen } from './support';
import { VARIANTS } from './variants';

for (const variant of VARIANTS) {
for (const pageName of ['signup', 'survey', 'customer', 'fields', 'order', 'custom']) {
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
  for (const pageName of ['signup', 'customer', 'fields', 'order']) {
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

/** A field squeezed beside its label is as broken as one off the screen: every text box keeps room to type in. */
for (const skin of ['underline', 'outlined']) {
  for (const width of [600, 720, 820]) {
    test(`plain: every input keeps room to type in, ${skin} at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await open(page, 'plain', `page=signup&skin=${skin}`);
      const narrow = await page.locator('.fd-field input:not([type=checkbox]):not([type=radio]):not([type=file]), .fd-field select').evaluateAll((inputs) =>
        inputs
          .filter((input) => (input as HTMLElement).offsetParent !== null)
          .map((input) => ({ name: input.closest('.fd-field')?.querySelector('.fd-label')?.textContent, width: Math.round(input.getBoundingClientRect().width) }))
          .filter((input) => input.width < 160)
      );
      expect(narrow).toEqual([]);
    });
  }
}
