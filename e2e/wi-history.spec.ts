import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { axeFindings } from './a11y-support';
import { expectNoSidewaysScroll, open, screen } from './support';

/**
 * A bug's History tab (@fieldia/chatter's historySlot), on its own page:
 * the State Graph, the changes grouped by age, the one chosen beside them
 * with its before and after — as a work item's History tab draws them, worked
 * by keyboard as by pointer, in four languages, right to left and dark.
 */
const QUERY = 'page=wi-history';
const history = (page: Page) => page.locator('.fd-slot[data-slot="history"] .fd-history');
const rows = (page: Page) => history(page).getByRole('option');
const detail = (page: Page) => history(page).locator('.fd-history-detail');

/** The tokens a work tracker's host wears (the plan's measured colours), as the backlog demo gives them. */
const TRACKER = {
  text: '#1a1a1a', muted: '#7e7e7e', page: '#ffffff', surface: '#ffffff', fill: '#f2f2f2', border: '#eaeaea', 'border-strong': '#7e7e7e',
  accent: '#0078d4', 'accent-soft': '#deecf9', focus: '#0078d4', 'focus-ring': 'none', radius: '4px', 'control-radius': '2px',
};

async function showHistory(page: Page, query = QUERY) {
  const opened = await open(page, 'plain', query);
  await page.getByRole('tab', { name: /History|السجل|Verlauf|Historique/ }).click();
  await expect(rows(page).first()).toBeVisible();
  return opened;
}
const box = async (page: Page, selector: string, at = 0) => (await history(page).locator(selector).nth(at).boundingBox())!;
const colour = (page: Page, selector: string, property: string) => history(page).locator(selector).first().evaluate((el, name) => getComputedStyle(el).getPropertyValue(name), property);
/** The colour as painted, `#rrggbb`: a mixed colour (color-mix) is said as the screen shows it. */
const painted = (locator: ReturnType<Page['locator']>, property = 'background-color') =>
  locator.first().evaluate((el, name) => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const pen = canvas.getContext('2d') as CanvasRenderingContext2D;
    pen.fillStyle = getComputedStyle(el).getPropertyValue(name);
    pen.fillRect(0, 0, 1, 1);
    return '#' + [...pen.getImageData(0, 0, 1, 1).data.slice(0, 3)].map((v) => v.toString(16).padStart(2, '0')).join('');
  }, property);

test.describe('wi-history', () => {
  test('draws the State Graph, the list by age and the change chosen as a work item’s History tab does', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    const { problems } = await showHistory(page);
    await page.evaluate((tokens) => {
      const demo = (window as any).fieldiaDemo;
      demo.handle.setTokens(tokens);
      const form = document.querySelector('.fd-form') as HTMLElement;
      form.style.setProperty('--fd-band', '#f8f8f8');
      form.style.setProperty('--fd-history-ink', '#000');
    }, TRACKER);

    // The State Graph: each move in time order, why above its arrow, who and when under it, then the state it came to.
    const steps = history(page).locator('.fd-history-step');
    await expect(steps.locator('.fd-history-reason')).toHaveText(['New', 'Approved', 'Investigation Complete', 'Approved']);
    await expect(steps.locator('.fd-history-state')).toHaveText(['New', 'Active', 'New', 'Active']);
    await expect(steps.locator('.fd-history-who')).toHaveText(['MAMona Adel', 'MAMona Adel', 'Karim Fathy', 'Karim Fathy']);
    await expect(steps.locator('time')).toHaveText(['Jun 10', 'Jun 11', 'Jun 14', 'Jul 8']);
    expect(await colour(page, '.fd-history-arrow', 'color')).toBe('rgb(43, 136, 216)');
    expect(await colour(page, '.fd-history-state', 'background-color')).toBe('rgb(222, 236, 249)');
    expect(await steps.nth(1).locator('.fd-history-state .fd-history-dot').evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgb(0, 122, 204)');
    const arrow = await box(page, '.fd-history-arrow');
    const chip = await box(page, '.fd-history-state');
    expect(arrow.width).toBeGreaterThanOrEqual(84);
    expect(chip.height).toBe(33);
    expect(Math.round(chip.x - (arrow.x + arrow.width))).toBe(10);

    // The list: one group, Older, its heading 33px on the band; 51px rows with 32px pictures; the date at the end.
    await expect(history(page).locator('.fd-history-group-head')).toHaveText(['Older']);
    expect(await painted(history(page).locator('.fd-history-group-head'))).toBe('#f8f8f8');
    expect((await box(page, '.fd-history-group-head')).height).toBe(34);
    expect((await box(page, '[role=option]')).height).toBe(51);
    expect((await box(page, '[role=option] .fd-history-avatar')).width).toBe(32);
    await expect(rows(page).first().locator('.fd-history-summary')).toHaveText('Mona Adel changed Stack Rank to 1999964430');
    await expect(rows(page).first().locator('time')).toHaveText('8/25/2026');
    const moved = rows(page).filter({ hasText: 'Karim Fathy changed State from New to Active and made field changes' });
    await expect(moved.locator('.fd-history-summary .fd-history-dot')).toHaveCount(2);
    await expect(moved.locator('.fd-history-end-dot')).toHaveCount(1);

    // The change chosen: who, what, when; each field with its new value, green, and the one it replaced, struck.
    await rows(page).filter({ hasText: 'Stack Rank to 1999979534' }).click();
    await expect(rows(page).filter({ hasText: 'Stack Rank to 1999979534' })).toHaveAttribute('aria-selected', 'true');
    expect(await painted(rows(page).filter({ hasText: 'Stack Rank to 1999979534' }))).toBe('#eaeaea');
    await expect(detail(page).locator('.fd-history-detail-name')).toHaveText('Mona Adel');
    await expect(detail(page).locator('header time')).toHaveText(/^Wed 7\/22\/2026 12:59\sPM$/);
    await expect(detail(page).locator('dt')).toHaveText(['Stack Rank']);
    await expect(detail(page).locator('.fd-history-new')).toHaveText('1999979534');
    await expect(detail(page).locator('.fd-history-old s')).toHaveText('1999987060');
    expect(await painted(history(page).locator('.fd-history-new'))).toBe('#dff6dd');
    expect(await painted(history(page).locator('.fd-history-old'))).toBe('#eaeaea');
    expect(await painted(history(page).locator('.fd-history-detail'), 'border-inline-start-color')).toBe('#9e9e9e');
    expect(await colour(page, '.fd-history-old s', 'text-decoration-line')).toBe('line-through');
    expect((await box(page, '.fd-history-detail .fd-history-avatar')).width).toBe(40);

    // The list and the change side by side, filling the window to its foot, the list scrolling on its own.
    const list = await box(page, '.fd-history-list');
    const shown = await box(page, '.fd-history-detail');
    expect(Math.abs(shown.x - (list.x + list.width))).toBeLessThanOrEqual(1);
    expect(Math.round(list.y + list.height)).toBe(1080 - 38);
    expect(await history(page).locator('.fd-history-list').evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
    await page.mouse.move(1, 1);
    await screen(page, 'wi-history-tracker', { viewport: true });
    expect(problems).toEqual([]);
  });

  test('moves and chooses with the keys, the change following; folds a group by its heading', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await showHistory(page);
    await rows(page).first().focus();
    for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowDown');
    await expect(rows(page).nth(4)).toBeFocused();
    await expect(rows(page).nth(4)).toHaveAttribute('aria-selected', 'true');
    await expect(detail(page).locator('header')).toContainText('Mona Adel changed Stack Rank to 1999979534');
    await page.keyboard.press('End');
    await expect(rows(page).last()).toBeFocused();
    await expect(detail(page).locator('header')).toContainText('Mona Adel created the work item');
    await expect(detail(page).locator('dt')).toHaveText(['Title', 'State', 'Reason', 'Area Path', 'Iteration Path']);
    await page.keyboard.press('Home');
    await expect(rows(page).first()).toBeFocused();
    // Up from the first row: its group's heading; Enter folds the group, Space opens it again.
    await page.keyboard.press('ArrowUp');
    const head = history(page).locator('.fd-history-group-head');
    await expect(head).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(head).toHaveAttribute('aria-expanded', 'false');
    await expect(rows(page)).toHaveCount(0);
    await page.keyboard.press('Space');
    await expect(head).toHaveAttribute('aria-expanded', 'true');
    await expect(rows(page)).toHaveCount(12);
    // Tab leaves the list from the one row in its Tab order.
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Tab');
    await expect(rows(page).first()).not.toBeFocused();
  });

  test('filters comments or field changes by its menu, worked by keyboard', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await showHistory(page);
    await expect(rows(page).filter({ hasText: 'Karim Fathy commented' })).toHaveCount(1);
    const filter = history(page).getByRole('button', { name: 'Filter' });
    await filter.focus();
    await page.keyboard.press('ArrowDown');
    const menu = history(page).getByRole('menu', { name: 'Filter' });
    await expect(menu).toBeVisible();
    await expect(menu.getByRole('menuitemcheckbox', { name: 'Field changes' })).toBeFocused();
    await screen(page, 'wi-history-filter', { viewport: true });
    expect(await axeFindings(page, 'history filter open')).toEqual([]);
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Space');
    await expect(menu.getByRole('menuitemcheckbox', { name: 'Comments' })).toHaveAttribute('aria-checked', 'false');
    await expect(rows(page).filter({ hasText: 'commented' })).toHaveCount(0);
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('Space');
    await expect(history(page).locator('.fd-history-none')).toHaveText('No changes yet');
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(filter).toBeFocused();
    // Only the comments: ticked again from the menu by pointer.
    await filter.click();
    await menu.getByRole('menuitemcheckbox', { name: 'Comments' }).click();
    await expect(rows(page)).toHaveText([/Karim Fathy commented/]);
    await expect(detail(page).locator('.fd-history-comment')).toContainText('the scanner there is offline until Sunday');
    await page.mouse.click(5, 300);
    await expect(menu).toBeHidden();
  });

  test('folds and maximises the State Graph from its heading', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await showHistory(page);
    const maximise = history(page).getByRole('button', { name: 'Maximise State Graph' });
    await expect(maximise).toHaveAttribute('title', 'Maximise State Graph');
    await maximise.click();
    const states = history(page).locator('.fd-history-states');
    const whole = (await states.boundingBox())!;
    expect([whole.x, whole.y, whole.width, whole.height]).toEqual([0, 0, 1440, 900]);
    await expect(history(page).getByRole('button', { name: 'Restore State Graph' })).toBeFocused();
    expect(await axeFindings(page, 'state graph maximised')).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(maximise).toBeFocused();
    expect((await states.boundingBox())!.width).toBeLessThan(1440);
    await history(page).getByRole('button', { name: 'Collapse State Graph' }).click();
    await expect(history(page).locator('.fd-history-graph')).toBeHidden();
    await expect(history(page).getByRole('button', { name: 'Expand State Graph' })).toHaveAttribute('aria-expanded', 'false');
  });

  test('puts the change under the list on a narrow screen, with nothing to scroll sideways', async ({ page }) => {
    for (const width of [700, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await showHistory(page);
      const list = await box(page, '.fd-history-list');
      const shown = await box(page, '.fd-history-detail');
      expect(shown.y, `at ${width}px`).toBeGreaterThanOrEqual(list.y + list.height - 1);
      expect(Math.round(shown.x)).toBe(Math.round(list.x));
      await expectNoSidewaysScroll(page);
      await screen(page, `wi-history-${width}`);
    }
  });

  test('reads right to left in Arabic, and in German and French, each clean for axe', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await showHistory(page, `${QUERY}&locale=ar&dir=rtl`);
    await expect(history(page).locator('.fd-history-states h3')).toHaveText('مخطط الحالات');
    await expect(history(page).locator('.fd-history-group-head')).toHaveText('أقدم');
    await expect(rows(page).first().locator('time')).toHaveText(/^25\D+8\D+2026$/);
    // The arrows point the way the words run; the change sits to the left of the list.
    expect(await colour(page, '.fd-history-arrow', 'transform')).toBe('matrix(-1, 0, 0, 1, 0, 0)');
    expect((await box(page, '.fd-history-detail')).x).toBeLessThan((await box(page, '.fd-history-list')).x);
    await screen(page, 'wi-history-arabic', { viewport: true });
    expect(await axeFindings(page, 'history arabic')).toEqual([]);
    for (const [locale, title, older] of [
      ['de', 'Statusverlauf', 'Älter'],
      ['fr', 'Graphique des états', 'Plus ancien'],
    ]) {
      await showHistory(page, `${QUERY}&locale=${locale}`);
      await expect(history(page).locator('.fd-history-states h3')).toHaveText(title);
      await expect(history(page).locator('.fd-history-group-head')).toHaveText(older);
      expect(await axeFindings(page, `history ${locale}`)).toEqual([]);
    }
  });

  test('wears the dark scheme, clean for axe; and the light one too', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await showHistory(page, `${QUERY}&scheme=dark`);
    expect(await colour(page, '.fd-history-arrow', 'color')).toBe('rgb(71, 158, 245)');
    // The new value's green and the replaced one's grey, mixed on the dark surface.
    expect(await painted(history(page).locator('.fd-history-new'))).not.toBe('#dff6dd');
    expect(await painted(history(page).locator('.fd-history-old'))).not.toBe('#eaeaea');
    await rows(page).nth(4).click();
    await screen(page, 'wi-history-dark', { viewport: true });
    expect(await axeFindings(page, 'history dark')).toEqual([]);
    await showHistory(page);
    await rows(page).nth(4).click();
    await screen(page, 'wi-history-light', { viewport: true });
    expect(await axeFindings(page, 'history light')).toEqual([]);
  });
});
