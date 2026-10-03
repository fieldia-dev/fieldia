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
    test('builds a survey: a question typed in shows when it is tried', async ({ page }) => {
      const problems = watch(page);
      await page.goto(`/designer-${framework}/`);
      await expect(page.locator('.fd-designer')).toBeVisible();
      await page.locator('.fd-design-step').first().getByRole('button', { name: 'Add question' }).click();
      await expect(page.locator('.fd-q-label').first()).toBeFocused();
      await page.keyboard.type('Will you come back?');
      await page.getByRole('button', { name: 'Try it' }).click();
      await expect(page.locator('.fd-try').getByText('Will you come back?')).toBeVisible();
      await screen(page, `designer-${framework}`, { viewport: true });
      expect(problems).toEqual([]);
    });

    test('builds a screen: a field from the toolbox lands on the canvas, named where it stands', async ({ page }) => {
      const problems = watch(page);
      await page.goto(`/designer-${framework}/?editor=screen`);
      await expect(page.locator('.fd-screen-designer')).toBeVisible();
      await page.locator('.fd-toolbox [data-tool="kind:short-answer"]').click();
      const label = page.locator('.fd-canvas-field.fd-editing [data-inline="label"]');
      await expect(label).toBeFocused();
      await page.keyboard.type('Customer');
      await expect(label).toHaveValue('Customer');
      await page.keyboard.press('Escape');
      await expect(page.locator('.fd-canvas-field .fd-label', { hasText: /^Customer$/ })).toBeVisible();
      await screen(page, `designer-${framework}-screen`, { viewport: true });
      expect(problems).toEqual([]);
    });
  });
}
