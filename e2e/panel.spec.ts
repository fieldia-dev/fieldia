import { expect, test, type Page } from '@playwright/test';
import { cardOf, doubleLines, layout, watch } from './designer-support';
import { expectNoSidewaysScroll, screen } from './support';

/**
 * The panel beside the canvas, used as a person uses it: a field picked and
 * its tabs gone through by mouse and by keyboard; a setting searched for and
 * gone to; ⌘K for the accent, changed and worn by the canvas; a group's
 * columns on each size of screen, looked at in Try it at three widths;
 * several fields picked and made wider at once; the survey designer's Look;
 * and all of it at a phone's width.
 */

const panel = (page: Page) => page.locator('.fd-properties');
const tab = (page: Page, name: string) => panel(page).getByRole('tab', { name, exact: true });
const choice = (page: Page, group: string, words: string) => panel(page).getByRole('group', { name: group, exact: true }).getByRole('button', { name: words, exact: true });

/** A screenshot to look at, with no line drawn twice. */
async function check(page: Page, name: string) {
  await page.waitForTimeout(200);
  await screen(page, `panel-${name}`, { viewport: true });
  expect(await doubleLines(page), name).toEqual([]);
}

test.describe('the panel', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  test('a field picked: its tabs, by mouse and by keyboard, kept for the next field', async ({ page }) => {
    const problems = watch(page);
    await page.goto('/screen/');
    await (await cardOf(page, 'Customer')).click();
    await expect(panel(page).locator('.fd-panel-title')).toHaveText('Short answer');
    await expect(panel(page).locator('.fd-insp-name')).toHaveText('Customer');
    await expect(panel(page).getByRole('tab')).toHaveText(['Content', 'Layout', 'Rules', 'Data']);
    await expect(panel(page).getByRole('textbox', { name: 'Label' })).toHaveValue('Customer');
    await check(page, 'field-content');

    await tab(page, 'Layout').click();
    await expect(tab(page, 'Layout')).toHaveAttribute('aria-selected', 'true');
    await expect(panel(page).getByRole('group', { name: 'Width', exact: true })).toBeVisible();
    await expect(panel(page).getByRole('textbox', { name: 'Label' })).toBeHidden();
    await check(page, 'field-layout');

    // The keyboard: along the tabs, round the end, and to the ends.
    await tab(page, 'Layout').focus();
    await page.keyboard.press('ArrowRight');
    await expect(tab(page, 'Rules')).toBeFocused();
    await expect(tab(page, 'Rules')).toHaveAttribute('aria-selected', 'true');
    await expect(panel(page).getByRole('checkbox', { name: 'Required' })).toBeVisible();
    await check(page, 'field-rules');
    await page.keyboard.press('End');
    await expect(tab(page, 'Data')).toHaveAttribute('aria-selected', 'true');
    await expect(panel(page).locator('[data-setting="Field name"] code')).toBeVisible();
    await check(page, 'field-data');
    await page.keyboard.press('ArrowRight');
    await expect(tab(page, 'Content')).toBeFocused();
    await page.keyboard.press('End');
    await page.keyboard.press('Home');
    await expect(tab(page, 'Content')).toHaveAttribute('aria-selected', 'true');

    // Another field picked keeps the tab the last one was left on.
    await tab(page, 'Rules').click();
    await (await cardOf(page, 'Visit date')).click();
    await expect(panel(page).locator('.fd-insp-name')).toHaveText('Visit date');
    await expect(tab(page, 'Rules')).toHaveAttribute('aria-selected', 'true');
    expect(problems).toEqual([]);
  });

  test('“labels” searched for, and gone to', async ({ page }) => {
    const problems = watch(page);
    await page.goto('/screen/');
    await (await cardOf(page, 'Customer')).click();
    const search = panel(page).getByRole('combobox', { name: 'Search settings' });
    await search.click();
    await page.keyboard.type('labels');
    const found = panel(page).getByRole('listbox', { name: 'Settings found' });
    await expect(found.getByRole('group', { name: 'Layout' }).getByRole('option')).toHaveText([/^Labels/]);
    await expect(panel(page).getByRole('tablist')).toBeHidden();
    await check(page, 'search-labels');
    await page.keyboard.press('Enter');
    await expect(tab(page, 'Layout')).toHaveAttribute('aria-selected', 'true');
    await expect(choice(page, 'Labels', 'As group')).toBeFocused();
    await expect(search).toHaveValue('');
    // Nothing called that: said so.
    await search.fill('zebra');
    await expect(panel(page).getByText('No setting called “zebra”.')).toBeVisible();
    await check(page, 'search-none');
    expect(problems).toEqual([]);
  });

  test('⌘K “accent”, changed, and worn by the canvas', async ({ page }) => {
    const problems = watch(page);
    await page.goto('/screen/');
    await (await cardOf(page, 'Customer')).click();
    await page.keyboard.press('Escape');
    await page.keyboard.press('ControlOrMeta+k');
    await page.keyboard.type('accent');
    await expect(page.locator('.fd-find-option').first()).toContainText('Accent colour');
    await check(page, 'find-accent');
    await page.keyboard.press('Enter');
    await expect(tab(page, 'Look')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('[data-setting="Accent colour"] :focus')).toHaveCount(1);
    await choice(page, 'Accent colour', 'Green').click();
    const canvas = page.locator('.fd-canvas:not(.fd-list-canvas)');
    await expect(canvas).toHaveAttribute('data-accent', '');
    await expect.poll(() => canvas.evaluate((c) => getComputedStyle(c).getPropertyValue('--fd-accent').trim())).toBe('#1f7a4d');
    // The rest of the look, worn at once.
    await choice(page, 'Spacing', 'Compact').click();
    await choice(page, 'Corners', 'Round').click();
    await expect(canvas).toHaveAttribute('data-density', 'compact');
    await expect.poll(() => canvas.evaluate((c) => getComputedStyle(c).getPropertyValue('--fd-gap-y').trim())).toBe('10px');
    await check(page, 'look-green');
    await choice(page, 'Colours', 'Dark').click();
    await expect.poll(() => canvas.evaluate((c) => getComputedStyle(c).backgroundColor)).toBe('rgb(22, 25, 30)');
    await check(page, 'look-dark');
    expect(problems).toEqual([]);
  });

  test('a group’s columns on each size of screen, looked at in Try it at three widths', async ({ page }) => {
    const problems = watch(page);
    await page.goto('/screen/');
    await page.locator('.fd-canvas-section-title').first().click();
    await tab(page, 'Layout').click();
    await choice(page, 'Columns on a desktop', '3 columns').click();
    await choice(page, 'Columns on a tablet', '2 columns').click();
    await choice(page, 'Columns on a phone', '1 column').click();
    await expect(choice(page, 'Columns on a tablet', '3 columns')).toBeVisible();
    await expect(choice(page, 'Columns on a tablet', '4 columns')).toBeHidden();
    await check(page, 'group-layout');
    // The canvas, at a desktop's width, shows the desktop's three.
    const across = (grid: string) => page.locator(grid).first().evaluate((g) => getComputedStyle(g).gridTemplateColumns.split(' ').length);
    expect(await across('.fd-canvas [data-node="section-1"] .fd-grid')).toBe(3);
    await page.getByRole('button', { name: 'Try it' }).click();
    const tried = '.fd-try [data-node="section-1"] > .fd-grid';
    expect(await across(tried)).toBe(3);
    await page.locator('.fd-try').getByRole('button', { name: 'Tablet' }).click();
    await expect.poll(() => across(tried)).toBe(2);
    await screen(page, 'panel-try-tablet', { viewport: true });
    await page.locator('.fd-try').getByRole('button', { name: 'Phone' }).click();
    await expect.poll(() => across(tried)).toBe(1);
    await screen(page, 'panel-try-phone', { viewport: true });
    expect(problems).toEqual([]);
  });

  test('several fields picked, made wider at once, and undone at once', async ({ page }) => {
    const problems = watch(page);
    await page.goto('/screen/');
    await (await cardOf(page, 'Customer')).click();
    // Picking a second one on the canvas with Shift is the canvas's: here the designer picks it as Shift-click does.
    await page.evaluate(() => {
      const designer = window.fieldiaDesigner.designer as unknown as { getPage(): { layout: { children: { children: { id: string }[] }[] } }; pick(id: string, options: { add: boolean }): void };
      designer.pick(designer.getPage().layout.children[0].children[1].id, { add: true });
    });
    await expect(panel(page).locator('.fd-panel-title')).toHaveText('Several');
    await expect(panel(page).locator('.fd-insp-name')).toHaveText('2 parts picked');
    await expect(panel(page).getByRole('tab')).toHaveText(['Layout']);
    await check(page, 'several');
    await choice(page, 'Width', 'All 2 columns').click();
    await expect.poll(async () => (await layout(page))[0]).toEqual(['Customer:2', 'Visit date:2', 'Notes:2']);
    await page.keyboard.press('ControlOrMeta+z');
    await expect.poll(async () => (await layout(page))[0]).toEqual(['Customer:1', 'Visit date:1', 'Notes:2']);
    expect(problems).toEqual([]);
  });

  test('the survey designer’s Look, worn by the cards', async ({ page }) => {
    const problems = watch(page);
    await page.goto('/designer/?start=survey');
    const look = page.locator('.fd-designer-bar').getByRole('button', { name: 'Look', exact: true });
    await look.click();
    const sheet = page.getByRole('dialog', { name: 'Look' });
    await expect(sheet).toBeVisible();
    await sheet.getByRole('group', { name: 'Accent colour' }).getByRole('button', { name: 'Purple' }).click();
    await sheet.getByRole('group', { name: 'Font' }).getByRole('button', { name: 'Serif' }).click();
    const cards = page.locator('.fd-survey-canvas');
    await expect(cards).toHaveAttribute('data-font', 'serif');
    await expect.poll(() => page.locator('.fd-survey-head').evaluate((h) => getComputedStyle(h).fontFamily)).toContain('Source Serif 4');
    await check(page, 'survey-look');
    await page.keyboard.press('Escape');
    await expect(sheet).toHaveCount(0);
    await expect(look).toBeFocused();
    await screen(page, 'panel-survey-look-closed', { viewport: true });
    expect(problems).toEqual([]);
  });

  test('at a phone’s width: the panel under the canvas, its tabs and search in reach', async ({ page }) => {
    const problems = watch(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/screen/');
    await (await cardOf(page, 'Customer')).click();
    await panel(page).scrollIntoViewIfNeeded();
    await expect(panel(page).getByRole('tab')).toHaveText(['Content', 'Layout', 'Rules', 'Data']);
    await tab(page, 'Layout').click();
    await panel(page).scrollIntoViewIfNeeded();
    await check(page, 'phone-layout');
    await expectNoSidewaysScroll(page);
    await page.goto('/designer/?start=survey');
    await page.locator('.fd-designer-bar').getByRole('button', { name: 'Look', exact: true }).click();
    await check(page, 'phone-survey-look');
    await expectNoSidewaysScroll(page);
    expect(problems).toEqual([]);
  });
});
