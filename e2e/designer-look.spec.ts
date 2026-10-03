import { expect, test, type Page } from '@playwright/test';
import { doubleLines, watch } from './designer-support';
import { screen } from './support';

/** The designer's look, state by state: no line drawn twice, a box in a box. */

async function check(page: Page, name: string) {
  await page.waitForTimeout(200);
  await screen(page, `look-${name}`, { viewport: true });
  expect(await doubleLines(page), name).toEqual([]);
}

test.describe('designer look', () => {
  test('a screen: a field picked, its words typed in, a dropdown’s options, a section picked', async ({ page }) => {
    const problems = watch(page);
    await page.goto('/screen/');
    await page.locator('.fd-canvas-field').first().click();
    await check(page, 'screen-picked');
    await page.locator('.fd-canvas-field.fd-editing [data-inline="label"]').click();
    await check(page, 'screen-label-typing');
    await page.locator('.fd-toolbox [data-tool="kind:dropdown"]').click();
    await page.locator('.fd-canvas-field.fd-editing .fd-q-option input').first().click();
    await check(page, 'screen-option-typing');
    await page.locator('.fd-canvas-section-title').first().click();
    await check(page, 'screen-section-picked');
    expect(problems).toEqual([]);
  });

  test('a sheet: its header’s parts picked and named, the outline and the data', async ({ page }) => {
    const problems = watch(page);
    await page.goto('/screen/?start=sheet');
    await page.getByRole('button', { name: 'Add a button' }).click();
    await check(page, 'sheet-button-typing');
    await page.getByRole('button', { name: 'Add a badge' }).click();
    await check(page, 'sheet-badge-typing');
    await page.getByRole('tab', { name: 'Outline' }).click();
    await check(page, 'sheet-outline');
    await page.getByRole('tab', { name: 'Data' }).click();
    await check(page, 'sheet-data');
    expect(problems).toEqual([]);
  });

  test('a list: a column picked, a button named', async ({ page }) => {
    const problems = watch(page);
    await page.goto('/screen/?start=list');
    await page.locator('.fd-list-table th[data-node="email"]').click();
    await check(page, 'list-column');
    await page.getByRole('button', { name: 'Add a button' }).click();
    await check(page, 'list-button-typing');
    expect(problems).toEqual([]);
  });

  test('a survey: a card open, its options typed, the menus, Find, Checks and Publish', async ({ page }) => {
    const problems = watch(page);
    await page.goto('/designer/?start=survey');
    await page.locator('.fd-q').nth(1).click();
    await check(page, 'survey-open');
    await page.locator('.fd-q-selected .fd-q-label').click();
    await check(page, 'survey-label-typing');
    await page.keyboard.press('ControlOrMeta+k');
    await check(page, 'survey-find');
    await page.keyboard.press('Escape');
    await page.locator('.fd-designer-bar [data-checks]').click();
    await check(page, 'survey-checks');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Publish', exact: true }).click();
    await check(page, 'survey-publish');
    expect(problems).toEqual([]);
  });
});
