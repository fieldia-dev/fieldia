import { expect, test, type Page } from '@playwright/test';
import { screen } from './support';

/** The designer's editors as React, Vue and Angular components, each in a real app of its framework. */
function watch(page: Page) {
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(error.message));
  page.on('console', (message) => message.type() === 'error' && problems.push(message.text()));
  return problems;
}

for (const framework of ['react', 'vue', 'angular']) {
  test.describe(`designer in ${framework}`, () => {
    test('builds a survey: a question typed in shows in the preview', async ({ page }) => {
      const problems = watch(page);
      await page.goto(`/designer-${framework}/`);
      await expect(page.locator('.fd-designer')).toBeVisible();
      await page.locator('.fd-design-step').first().getByRole('button', { name: 'Add question' }).click();
      await expect(page.locator('.fd-q-label').first()).toBeFocused();
      await page.keyboard.type('Will you come back?');
      const preview = page.locator('.fd-designer-preview');
      await expect(preview.locator('.fd-designer-preview-host')).not.toHaveAttribute('aria-busy', 'true');
      await expect(preview.getByText('Will you come back?')).toBeVisible();
      await screen(page, `designer-${framework}`, { viewport: true });
      expect(problems).toEqual([]);
    });

    test('builds a screen: a field from the palette lands on the canvas', async ({ page }) => {
      const problems = watch(page);
      await page.goto(`/designer-${framework}/?editor=screen`);
      await expect(page.locator('.fd-screen-designer')).toBeVisible();
      await page.locator('.fd-palette-item[data-kind="short-answer"]').click();
      await expect(page.getByRole('textbox', { name: 'Label' })).toBeFocused();
      await page.keyboard.type('Customer');
      await expect(page.locator('.fd-canvas-field .fd-label', { hasText: /^Customer$/ })).toBeVisible();
      await screen(page, `designer-${framework}-screen`, { viewport: true });
      expect(problems).toEqual([]);
    });
  });
}
