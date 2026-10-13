import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { axeFindings, settle } from './a11y-support';
import { expectNoSidewaysScroll, node, open, screen } from './support';

/**
 * The work item's pickers, used as a person uses them and measured against
 * the work tracker's own screens (docs/plans/work-item-replica.md §2.7, §2.9):
 * Area and Iteration as path pickers — suggestions, then the tree with each
 * sprint's dates, a list exactly as wide as its box — State's list with a
 * tick and no dots, Planning's choices in Fieldia's own list, tags added from
 * "Add Tag", and "No one selected". In the work tracker's own colours (a
 * host's tokens), right to left, dark, in four languages, at a phone's
 * width — and axe finds nothing.
 */

const PAGE = 'page=wi-picker';
/**
 * The work tracker's colours, as a host gives them (§6.3) — but for its muted grey: #7e7e7e reads at 4.05:1 on
 * white, under WCAG AA's 4.5, so the replica's is the nearest grey that reads at 4.5, #767676.
 */
const TOKENS = {
  text: '#1a1a1a', muted: '#767676', page: '#ffffff', surface: '#ffffff', fill: '#f2f2f2', border: '#eaeaea', 'border-strong': '#7e7e7e',
  accent: '#0078d4', 'accent-soft': '#deecf9', focus: '#0078d4', 'focus-ring': 'none', radius: '4px', 'control-radius': '2px',
  font: '"Segoe UI", -apple-system, BlinkMacSystemFont, Roboto, "Helvetica Neue", Helvetica, Ubuntu, Arial, sans-serif',
};
const DARK = { ...TOKENS, text: '#f3f2f1', muted: '#a19f9d', page: '#252423', surface: '#252423', fill: '#3b3a39', border: '#3b3a39', 'border-strong': '#8a8886', accent: '#2899f5', 'accent-soft': '#0e2d4a', focus: '#2899f5' };
const rgb = (hex: string) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`;

/** Where an element is in the window, to the pixel. */
const box = (element: Locator) => element.evaluate((el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height), right: Math.round(r.right), bottom: Math.round(r.bottom) }; });
const drawn = (element: Locator, name: string) => element.evaluate((el, name) => getComputedStyle(el).getPropertyValue(name), name);

async function visit(page: Page, query = '', options: { dark?: boolean; recent?: unknown[] } = {}) {
  await page.addInitScript((recent) => {
    // The person's latest picks of an iteration, as the browser keeps them for the viewer: kept from one visit to the next.
    if (!localStorage.getItem('fieldia:recent:wi.iteration')) localStorage.setItem('fieldia:recent:wi.iteration', JSON.stringify(recent));
  }, options.recent ?? [3, 5, 1, 6, 7]);
  const { problems } = await open(page, 'plain', `${PAGE}${query}`);
  await expect(node(page, 'f-severity').locator('.fd-own-words')).not.toBeEmpty();
  await page.evaluate((tokens) => (window as unknown as { fieldiaDemo: { handle: { setTokens(t: object): void } } }).fieldiaDemo.handle.setTokens(tokens), options.dark ? DARK : TOKENS);
  await settle(page);
  return problems;
}
const callout = (page: Page) => page.locator('.fd-path-callout:popover-open');
const treeRows = (page: Page) => callout(page).locator('[role=treeitem]');
const activeRow = (page: Page) => callout(page).locator('[role=treeitem][data-active]');

test.use({ viewport: { width: 1920, height: 1080 } });

test.describe('a path picker, as the work tracker’s Area and Iteration', () => {
  test('Area open: its box ringed in the accent, its list as wide, "Suggestions" in 600, the value highlighted and framed, a divider, the tree', async ({ page }) => {
    const problems = await visit(page);
    const input = node(page, 'f-area').locator('input');
    await expect(input).toHaveValue('Portal');
    await input.click();
    await expect(callout(page)).toBeVisible();
    // The box: two pixels of the accent, as the work tracker's focused box.
    await expect.poll(() => drawn(input, 'border-top-color')).toBe(rgb('#0078d4'));
    await expect.poll(() => drawn(input, 'box-shadow')).toContain(rgb('#0078d4'));
    // The list: right under the box, exactly as wide, with a callout's shadow.
    const [field, list] = [await box(input), await box(callout(page))];
    expect(list.x).toBe(field.x);
    expect(list.width).toBe(field.width);
    expect(list.y).toBe(field.bottom);
    expect(await drawn(callout(page), 'box-shadow')).toContain('rgba(0, 0, 0, 0.13');
    // "Suggestions" in 600, 43px in; the value's row in the selection colour, its words framed in the accent.
    const heading = callout(page).locator('.fd-path-heading');
    await expect(heading).toHaveText('Suggestions');
    expect(await drawn(heading, 'font-weight')).toBe('600');
    expect(await drawn(heading, 'padding-inline-start')).toBe('43px');
    await expect(activeRow(page)).toHaveCount(1);
    await expect(activeRow(page).locator('.fd-path-words')).toHaveText('Portal');
    expect(await drawn(activeRow(page), 'background-color')).toBe(rgb('#deecf9'));
    const frame = activeRow(page).locator('.fd-path-name');
    expect(await drawn(frame, 'outline-color')).toBe(rgb('#0078d4'));
    expect(await drawn(frame, 'outline-width')).toBe('1px');
    // Rows 24px tall, 26px apart; the frame 8px in from the list's edges.
    const [first, frameBox] = [await box(activeRow(page)), await box(frame)];
    expect(first.height).toBe(24);
    expect(frameBox.x - list.x).toBe(8);
    expect(list.right - frameBox.right).toBe(8);
    // The divider, then the tree's roots.
    await expect(callout(page).locator('.fd-path-divider')).toBeVisible();
    expect(await drawn(callout(page).locator('.fd-path-divider'), 'background-color')).toBe(rgb('#eaeaea'));
    await expect(treeRows(page).locator('.fd-path-words')).toHaveText(['Portal', 'Portal', 'Warehouse']);
    await screen(page, 'wi-picker-area-open', { viewport: true });
    expect(await axeFindings(page, 'area open')).toEqual([]);
    expect(problems).toEqual([]);
  });

  test('Iteration open: suggestions with their dates at the row’s end, the two-cell frame, the tree unfolded to the value with its children 16px in, at most 278px, scrolling', async ({ page }) => {
    await visit(page);
    const input = node(page, 'f-iteration').locator('input');
    await expect(input).toHaveValue('Portal\\Sprint 14');
    expect(await input.getAttribute('aria-haspopup')).toBe('tree');
    await input.click();
    await expect(callout(page)).toBeVisible();
    await expect(input).toHaveAttribute('aria-expanded', 'true');
    // The person's latest picks in the order picked, the value among them highlighted where it is.
    const suggested = callout(page).locator('[role=group] [role=treeitem]');
    await expect(suggested.locator('.fd-path-words')).toHaveText(['Portal\\Sprint 12', 'Portal\\Sprint 14', 'Portal', 'Portal\\Tasks and Activities', 'Portal\\Invoices']);
    await expect(suggested.locator('.fd-path-aside')).toHaveText(['3/25/2026 - 4/16/2026', '4/12/2027 - 5/25/2027', '7/16/2026 - 8/28/2026', '12/29/2027 - 2/9/2028']);
    await expect(activeRow(page).locator('.fd-path-words')).toHaveText('Portal\\Sprint 14');
    // Two frames: round the name, and round the dates, which end 12px before the frame's end.
    const [name, aside] = [await box(activeRow(page).locator('.fd-path-name')), await box(activeRow(page).locator('.fd-path-aside'))];
    expect(aside.x).toBe(name.right);
    expect(await drawn(activeRow(page).locator('.fd-path-aside'), 'outline-color')).toBe(rgb('#0078d4'));
    const dates = await box(activeRow(page).locator('.fd-path-aside > span'));
    expect(aside.right - dates.right).toBe(12);
    // The tree: "Portal" open, its children 16px further in, each with its dates; branches say whether they are open.
    const portal = callout(page).locator('[role=tree] > [role=treeitem]').first();
    await expect(portal).toHaveAttribute('aria-expanded', 'true');
    await expect(portal).toHaveAttribute('aria-level', '1');
    const child = callout(page).locator('[role=tree] > [role=treeitem][aria-level="2"]').first();
    await expect(child.locator('.fd-path-words')).toHaveText('Test Plan');
    const [rootWords, childWords] = [await box(portal.locator('.fd-path-words')), await box(child.locator('.fd-path-words'))];
    expect(childWords.x - rootWords.x).toBe(16);
    await expect(portal.locator('.fd-path-twist')).toHaveAccessibleName('Collapse Portal');
    // At most 278px, and the rest scrolled to.
    const list = await box(callout(page));
    expect(list.height).toBe(278);
    expect(await callout(page).evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
    await screen(page, 'wi-picker-iteration-open', { viewport: true });
    expect(await axeFindings(page, 'iteration open')).toEqual([]);
  });

  test('typing finds by the whole path; Enter picks, and the pick leads the suggestions the next time; Escape puts back', async ({ page }) => {
    await visit(page);
    const input = node(page, 'f-iteration').locator('input');
    await input.click();
    await input.fill('sprint 1');
    await expect(treeRows(page).locator('.fd-path-words')).toHaveText(['Portal\\Sprint 12', 'Portal\\Sprint 13', 'Portal\\Sprint 14']);
    await expect(callout(page).locator('[role=group]')).toHaveCount(0);
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(input).toHaveValue('Portal\\Sprint 13');
    await expect(callout(page)).toHaveCount(0);
    // Kept for the person: the pick first next time, here and after the page is opened again.
    await input.click();
    await expect(callout(page).locator('[role=group] [role=treeitem] .fd-path-words').first()).toHaveText('Portal\\Sprint 13');
    await page.keyboard.press('Escape');
    await page.reload();
    await expect(node(page, 'f-severity').locator('.fd-own-words')).not.toBeEmpty();
    await node(page, 'f-iteration').locator('input').click();
    await expect(callout(page).locator('[role=group] [role=treeitem] .fd-path-words').first()).toHaveText('Portal\\Sprint 13');
    // Escape puts back what the box showed, and closes.
    await page.keyboard.type('war');
    await page.keyboard.press('Escape');
    await expect(callout(page)).toHaveCount(0);
    await expect(node(page, 'f-iteration').locator('input')).toHaveValue('Portal\\Sprint 14');
  });

  test('walks the tree by keys, the other way round right to left: ← opens a branch, → goes back up', async ({ page }) => {
    await visit(page, '&locale=ar&dir=rtl');
    const input = node(page, 'f-iteration').locator('input');
    await input.click();
    await expect(callout(page).locator('.fd-path-heading')).toHaveText('اقتراحات');
    await page.keyboard.press('End');
    await expect(activeRow(page).locator('.fd-path-words')).toHaveText('Week 16 Fixes');
    await page.keyboard.press('ArrowLeft');
    await expect(activeRow(page)).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('ArrowLeft');
    await expect(activeRow(page).locator('.fd-path-words')).toHaveText('Night shift');
    await page.keyboard.press('ArrowRight');
    await expect(activeRow(page).locator('.fd-path-words')).toHaveText('Week 16 Fixes');
    // Mirrored: the list's frame at the right, the dates at the left end, read in their own order.
    const [field, list] = [await box(input), await box(callout(page))];
    expect(list.right).toBe(field.right);
    const sprint = callout(page).locator('[role=group] [role=treeitem]').first();
    expect((await box(sprint.locator('.fd-path-aside'))).x).toBeLessThan((await box(sprint.locator('.fd-path-name'))).x);
    await expect(sprint.locator('.fd-path-aside')).toHaveText('3/25/2026 - 4/16/2026');
    await screen(page, 'wi-picker-iteration-rtl', { viewport: true });
    expect(await axeFindings(page, 'iteration right to left')).toEqual([]);
  });
});

test.describe('State, and Planning’s choices, in Fieldia’s own list', () => {
  test('State open: the list at its box’s start and as wide, 30px rows, a tick by Active and no dots; Resolved turns the dot orange', async ({ page }) => {
    await visit(page);
    const state = node(page, 'f-state');
    await expect(state.locator('.fd-dot-label')).toHaveText('Active');
    expect(await drawn(state.locator('.fd-dot'), 'background-color')).toBe(rgb('#007acc'));
    await state.locator('.fd-dot-box').click();
    const menu = page.locator('.fd-dot-menu:not([hidden])');
    await expect(menu).toBeVisible();
    const [field, list] = [await box(state.locator('.fd-dot-box')), await box(menu)];
    expect(list.x).toBe(field.x);
    expect(list.width).toBe(field.width);
    expect(list.y).toBe(field.bottom);
    await expect(menu.locator('.fd-dot')).toHaveCount(0);
    const rows = menu.locator('[role=menuitemradio]');
    await expect(rows.locator('.fd-pick-words')).toHaveText(['New', 'Active', 'Resolved', 'Closed']);
    const [first, second] = [await box(rows.nth(0)), await box(rows.nth(1))];
    expect(second.y - first.y).toBe(30);
    expect(first.y - list.y).toBe(8);
    // A tick by the one picked alone; it is the row reached, in the selection colour, its words framed.
    expect(await rows.locator('.fd-pick-tick').evaluateAll((ticks) => ticks.map((t) => getComputedStyle(t).visibility))).toEqual(['hidden', 'visible', 'hidden', 'hidden']);
    await expect(rows.nth(1)).toBeFocused();
    expect(await drawn(rows.nth(1), 'background-color')).toBe(rgb('#deecf9'));
    expect(await drawn(rows.nth(1).locator('.fd-pick-words'), 'outline-color')).toBe(rgb('#0078d4'));
    expect((await box(rows.nth(1).locator('.fd-pick-words'))).x - list.x).toBe(26);
    await screen(page, 'wi-picker-state-open', { viewport: true });
    expect(await axeFindings(page, 'state open')).toEqual([]);
    // Typed: R goes to Resolved; Enter picks it, and the dot takes its colour.
    await page.keyboard.press('r');
    await expect(rows.nth(2)).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(state.locator('.fd-dot-label')).toHaveText('Resolved');
    expect(await drawn(state.locator('.fd-dot'), 'background-color')).toBe(rgb('#ff9d00'));
    await expect(state.locator('.fd-dot-button')).toBeFocused();
  });

  test('in a field with a lead slot before its value (data-lead, as a work item’s band gives), the dot sits in it and the list starts at the box', async ({ page }) => {
    await visit(page);
    const state = node(page, 'f-state');
    await state.evaluate((field) => field.setAttribute('data-lead', ''));
    const [field, dot, words] = [await box(state.locator('.fd-dot-box')), await box(state.locator('.fd-dot')), await box(state.locator('.fd-dot-label'))];
    // A 10px dot centred 12px before the box; the words where every value's start.
    expect([dot.width, dot.height]).toEqual([10, 10]);
    expect(Math.abs(field.x - (dot.x + dot.width / 2) - 12)).toBeLessThanOrEqual(1);
    expect(words.x - field.x).toBeGreaterThanOrEqual(8);
    expect(words.x - field.x).toBeLessThanOrEqual(12);
    // A press on the words opens the list, at the box's start.
    await state.locator('.fd-dot-label').click();
    const menu = page.locator('.fd-dot-menu:not([hidden])');
    expect((await box(menu)).x).toBe(field.x);
    await screen(page, 'wi-picker-state-lead', { viewport: true });
  });

  test('Planning: Priority and Severity read as words; clicked, Fieldia’s own list with a tick; the keys pick and Escape keeps', async ({ page }) => {
    await visit(page);
    await expect(node(page, 'f-priority').locator('.fd-own-words')).toHaveText('1');
    await expect(node(page, 'f-severity').locator('.fd-own-words')).toHaveText('3 - Medium');
    await expect(page.locator('[data-node="f-severity"] select')).toHaveCount(0);
    // At rest no box: the words alone.
    const severity = node(page, 'f-severity').locator('.fd-own-box');
    expect(await drawn(severity, 'border-top-color')).toBe('rgba(0, 0, 0, 0)');
    await severity.click();
    const list = page.locator('.fd-own-list:not([hidden])');
    await expect(list).toBeFocused();
    await expect(list.locator('[role=option][aria-selected="true"] .fd-pick-words')).toHaveText('3 - Medium');
    await expect(node(page, 'f-severity').getByRole('button', { name: 'Severity 3 - Medium' })).toHaveAttribute('aria-expanded', 'true');
    await screen(page, 'wi-picker-severity-open', { viewport: true });
    expect(await axeFindings(page, 'severity open')).toEqual([]);
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('Enter');
    await expect(node(page, 'f-severity').locator('.fd-own-words')).toHaveText('2 - High');
    // Escape closes, the value kept.
    await page.keyboard.press('ArrowDown');
    await expect(list).toBeVisible();
    await page.keyboard.press('End');
    await page.keyboard.press('Escape');
    await expect(list).toHaveCount(0);
    await expect(node(page, 'f-severity').locator('.fd-own-words')).toHaveText('2 - High');
  });
});

test.describe('the meta row: No one selected, and Add Tag', () => {
  test('a person’s outline and "No one selected" in the muted colour; "Add Tag" in a light fill, 19px tall, 600', async ({ page }) => {
    const problems = await visit(page);
    const assigned = node(page, 'f-assigned');
    await expect(assigned.locator('.fd-link-nobody')).toBeVisible();
    await expect(assigned.locator('input')).toHaveAttribute('placeholder', 'No one selected');
    expect(await assigned.locator('input').evaluate((el) => getComputedStyle(el, '::placeholder').color)).toBe(rgb('#767676'));
    expect(await drawn(assigned.locator('.fd-link-nobody'), 'color')).toBe(rgb('#767676'));
    const add = node(page, 'f-tags').getByRole('button', { name: 'Add Tag' });
    expect(await drawn(add, 'background-color')).toBe(rgb('#f2f2f2'));
    expect(await drawn(add, 'font-weight')).toBe('600');
    expect(await drawn(add, 'font-size')).toBe('14px');
    expect((await box(add)).height).toBe(19);
    await screen(page, 'wi-picker-meta', { viewport: true });
    expect(await axeFindings(page, 'at rest')).toEqual([]);
    expect(problems).toEqual([]);
  });

  test('Add Tag turns into the tag box; Enter adds a chip and the button comes back; picking a person shows their picture', async ({ page }) => {
    await visit(page);
    const tags = node(page, 'f-tags');
    await tags.getByRole('button', { name: 'Add Tag' }).click();
    const input = tags.locator('input[role=combobox]');
    await expect(input).toBeFocused();
    await expect(tags.getByRole('button', { name: 'Add Tag' })).toBeHidden();
    await input.fill('Stock');
    await page.keyboard.press('Enter');
    await expect(tags.locator('.fd-chip-label')).toHaveText(['Stock']);
    await expect(tags.getByRole('button', { name: 'Add Tag' })).toBeFocused();
    await expect(input).toBeHidden();
    // Escape from the box brings the button back, the tags as they are.
    await page.keyboard.press('Enter');
    await expect(input).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(tags.getByRole('button', { name: 'Add Tag' })).toBeFocused();
    await expect(tags.locator('.fd-chip-label')).toHaveText(['Stock']);
    // Someone picked: their initials in place of the outline.
    const assigned = node(page, 'f-assigned');
    await assigned.locator('input').click();
    await page.keyboard.type('Mona');
    await page.getByRole('option', { name: 'Mona Adel' }).click();
    await expect(assigned.locator('.fd-link-nobody')).toBeHidden();
    await expect(assigned.locator('.fd-link-avatar')).toHaveText('MA');
  });
});

test.describe('the pickers in every language, dark, and at a phone’s width', () => {
  test('say their own words in Arabic, German and French', async ({ page }) => {
    for (const [locale, suggestions, add] of [['ar', 'اقتراحات', 'إضافة وسم'], ['de', 'Vorschläge', 'Tag hinzufügen'], ['fr', 'Suggestions', 'Ajouter une balise']] as const) {
      await visit(page, `&locale=${locale}${locale === 'ar' ? '&dir=rtl' : ''}`);
      await expect(node(page, 'f-tags').locator('.fd-tags-adder')).toHaveText(add);
      await node(page, 'f-area').locator('input').click();
      await expect(callout(page).locator('.fd-path-heading')).toHaveText(suggestions);
      await page.keyboard.press('Escape');
    }
    await node(page, 'f-iteration').locator('input').click();
    await expect(callout(page).locator('.fd-path-twist').first()).toHaveAccessibleName('Réduire Portal');
  });

  test('draw dark in the dark tokens, and axe finds nothing', async ({ page }) => {
    await visit(page, '&scheme=dark', { dark: true });
    await node(page, 'f-iteration').locator('input').click();
    expect(await drawn(callout(page), 'background-color')).toBe(rgb('#252423'));
    expect(await drawn(activeRow(page), 'background-color')).toBe(rgb('#0e2d4a'));
    expect(await drawn(callout(page).locator('.fd-path-heading'), 'color')).toBe(rgb('#f3f2f1'));
    await screen(page, 'wi-picker-iteration-dark', { viewport: true });
    expect(await axeFindings(page, 'iteration open, dark')).toEqual([]);
    await page.keyboard.press('Escape');
    await node(page, 'f-state').locator('.fd-dot-box').click();
    expect(await drawn(page.locator('.fd-dot-menu:not([hidden])'), 'background-color')).toBe(rgb('#252423'));
    expect(await axeFindings(page, 'state open, dark')).toEqual([]);
  });

  test('fit a phone: no sideways scroll, and the list as wide as its box', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await visit(page);
    await expectNoSidewaysScroll(page);
    const input = node(page, 'f-iteration').locator('input');
    await input.click();
    const [field, list] = [await box(input), await box(callout(page))];
    expect(list.width).toBe(field.width);
    expect(list.right).toBeLessThanOrEqual(390);
    await expectNoSidewaysScroll(page);
    await screen(page, 'wi-picker-phone', { viewport: true });
  });
});
