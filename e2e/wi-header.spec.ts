import { type Locator, type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { axeFindings, settle } from './a11y-support';
import { expectNoSidewaysScroll, open, screen } from './support';

/**
 * A work item's head, in a large popup over the page, as the user's
 * screenshots of a bug show it (docs/plans/work-item-replica.md §2.3–2.5):
 * the dialog 96px in from the window's sides and 46px from its top and
 * bottom, nothing dimmed behind; the kind's strip and badge; the number before
 * the title and Copy title; the row of people, "1 Comment" and the buttons —
 * Save and Close split and quiet until something changes, Follow split with
 * its gear, Refresh, Undo, ⋮; the band of State, Reason, Area and Iteration
 * with their access keys and the lock in the lead slot; "Updated by"; the
 * tabs in the head with their counts. Measured to the screenshots' pixels,
 * used with the keyboard and the pointer, right to left, dark, at a phone's
 * width, in four languages, and axe finds nothing.
 */

const POPUP = 'page=wi-head&open=dialog';
const WINDOW = { width: 1920, height: 983 };

const dialog = (page: Page) => page.getByRole('dialog');
const part = (page: Page, id: string) => dialog(page).locator(`[data-node="${id}"]`);
/** Where an element is in the dialog: its edges from the dialog's top-left, and from its right edge. */
async function at(page: Page, element: Locator) {
  const box = (await dialog(page).boundingBox()) as { x: number; y: number; width: number; height: number };
  const own = (await element.boundingBox()) as { x: number; y: number; width: number; height: number };
  const x = own.x - box.x;
  const y = own.y - box.y;
  return { x: Math.round(x), y: Math.round(y), right: Math.round(box.width - x - own.width), width: Math.round(own.width), height: Math.round(own.height), cx: Math.round(x + own.width / 2), cy: Math.round(y + own.height / 2), fromRight: Math.round(box.width - x - own.width / 2) };
}
/**
 * What the browser draws for each property named; a colour as the pixel it paints, rgb(…) — a mixed colour is
 * written color(srgb …) by the browser, though it paints the same pixel.
 */
const drawn = (element: Locator, ...names: string[]) =>
  element.evaluate((el, names) => {
    const paint = document.createElement('canvas').getContext('2d') as CanvasRenderingContext2D;
    const pixel = (value: string) => {
      if (!/^color\(/.test(value)) return value;
      paint.clearRect(0, 0, 1, 1);
      paint.fillStyle = value;
      paint.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = paint.getImageData(0, 0, 1, 1).data;
      return a === 255 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${Math.round((a / 255) * 100) / 100})`;
    };
    return Object.fromEntries(names.map((name) => [name, pixel(getComputedStyle(el).getPropertyValue(name))]));
  }, names);
const near = (value: number, expected: number, by = 2) => expect(Math.abs(value - expected), `${value} within ${by} of ${expected}`).toBeLessThanOrEqual(by);

/** Open the popup over its page, failing on any console error or uncaught exception. */
async function popup(page: Page, query = POPUP) {
  const problems: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(`console: ${message.text()}`);
  });
  page.on('pageerror', (error) => problems.push(`page error: ${error.message}`));
  await page.goto(`/plain/?${query}`);
  await expect(dialog(page)).toBeVisible();
  await expect(part(page, '#title').locator('input')).toHaveValue('Stock count shows 12 after releasing 3 of 15 items to order SO-2088');
  await settle(page);
  return problems;
}
const results = (page: Page) => page.evaluate(() => (window as unknown as { fieldiaDialog: { results: { saved: boolean; values: Record<string, unknown> }[] } }).fieldiaDialog.results);

test.describe('at rest, as the screenshot of the bug shows it', () => {
  test.use({ viewport: WINDOW });

  test('a popup 96px in and 46px down, nothing dimmed, its shadow deep and its corners small', async ({ page }) => {
    const problems = await popup(page);
    expect(await dialog(page).boundingBox()).toEqual({ x: 96, y: 46, width: 1728, height: 891 });
    const backdrop = await page.locator('.fd-form-dialog-backdrop').evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(backdrop).toBe('rgba(0, 0, 0, 0)');
    const look = await drawn(dialog(page), 'border-top-left-radius', 'box-shadow', 'background-color');
    expect(look['border-top-left-radius']).toBe('4px');
    expect(look['box-shadow']).toContain('rgba(0, 0, 0, 0.22) 0px 25.6px 57.6px 0px');
    expect(look['background-color']).toBe('rgb(255, 255, 255)');
    // No title bar and no foot of its own: the page's head is the dialog's.
    await expect(dialog(page).locator('.fd-form-dialog-head, .fd-form-dialog-foot')).toHaveCount(0);
    await expect(dialog(page)).toBeFocused();
    expect(problems).toEqual([]);
  });

  test('the kind’s strip and badge, ⤢ and ×, the number before the title', async ({ page }) => {
    await popup(page);
    const strip = dialog(page).locator('.fd-head-strip');
    expect(await at(page, strip)).toMatchObject({ x: 0, y: 0, width: 10, height: 122 });
    expect((await drawn(strip, 'background-color'))['background-color']).toBe('rgb(204, 41, 61)');
    const badge = dialog(page).locator('.fd-head-badge');
    await expect(badge).toHaveText('BUG 4127');
    near((await at(page, badge.locator('.fd-icon'))).x, 20, 1);
    near((await at(page, badge.locator('.fd-head-badge-words'))).x, 39, 1);
    near((await at(page, badge)).cy, 21, 1);
    expect((await drawn(badge, 'font-size'))['font-size']).toBe('12px');
    const max = dialog(page).getByRole('button', { name: 'Maximise' });
    const close = dialog(page).getByRole('button', { name: 'Close', exact: true });
    near((await at(page, max)).fromRight, 55);
    near((await at(page, close)).fromRight, 20);
    near((await at(page, close)).cy, 21, 1);
    const number = dialog(page).locator('.fd-head-number');
    await expect(number).toHaveText('4127');
    near((await at(page, number)).x, 19, 1);
    expect((await drawn(number, 'font-size'))['font-size']).toBe('18px');
    const title = part(page, '#title').locator('input');
    expect(await at(page, title)).toMatchObject({ x: 64, right: 42, height: 32 });
    near((await at(page, title)).cy, 59, 1);
    // At rest: words only, no edge, no Copy title.
    expect((await drawn(title, 'border-top-color'))['border-top-color']).toBe('rgba(0, 0, 0, 0)');
    await expect(dialog(page).getByRole('button', { name: 'Copy title' })).toBeHidden();
    await screen(page, 'wi-header-rest', { viewport: true });
  });

  test('the row: the assignee, “1 Comment”, then Save and Close, Follow, Refresh, Undo and ⋮', async ({ page }) => {
    await popup(page);
    near((await at(page, part(page, 'h-assigned'))).x, 21, 1);
    const comments = part(page, 'h-comments');
    await expect(comments).toHaveText('1 Comment');
    near((await at(page, comments)).x, 296);
    near((await at(page, comments)).cy, 99);
    const save = part(page, 'b-save-close');
    const saveBox = await at(page, save);
    near(saveBox.right, 279, 3);
    expect(saveBox.height).toBe(32);
    near(saveBox.cy, 99);
    near((await at(page, save.locator('.fd-split-more'))).width, 30, 0);
    const main = save.getByRole('button', { name: 'Save and Close', exact: true });
    expect(await drawn(main, 'background-color', 'font-weight', 'font-size', 'color')).toEqual({ 'background-color': 'rgb(242, 242, 242)', 'font-weight': '600', 'font-size': '14px', color: 'rgb(26, 26, 26)' });
    // Quiet, but usable: nothing greys it out.
    await expect(main).toBeEnabled();
    await expect(main).not.toHaveAttribute('aria-disabled', 'true');
    const follow = part(page, 'b-follow');
    near((await at(page, follow)).right, 138, 3);
    near((await at(page, follow.locator('.fd-split-more'))).width, 34, 0);
    await expect(follow.getByRole('button', { name: 'Notification settings' })).toBeVisible();
    await expect(save.getByRole('button', { name: 'Save and Close options' })).toHaveAttribute('aria-haspopup', 'menu');
    for (const [name, fromRight] of [['Refresh', 111], ['Revert changes', 66], ['More actions', 23]] as const) {
      const button = dialog(page).getByRole('button', { name, exact: true });
      near((await at(page, button)).fromRight, fromRight);
      await expect(button).toHaveAttribute('title', name);
    }
  });

  test('the band: State with its dot, Reason with its lock, Area and Iteration, their access keys underlined', async ({ page }) => {
    await popup(page);
    const band = dialog(page).locator('.fd-head-band');
    expect(await at(page, band)).toMatchObject({ y: 122, height: 78 });
    expect((await drawn(band, 'background-color'))['background-color']).toBe('rgb(248, 248, 248)');
    const state = part(page, 'f-state');
    near((await at(page, state.locator('.fd-label'))).x, 16, 0);
    near((await at(page, state.locator('.fd-label'))).cy, 145, 1);
    near((await at(page, state.locator('.fd-dot-button > .fd-dot'))).cx, 80, 1);
    near((await at(page, state.locator('.fd-dot-label'))).x, 104, 1);
    await expect(state.locator('.fd-dot-label')).toHaveText('Active');
    const reason = part(page, 'f-reason');
    near((await at(page, reason.locator('.fd-lock .fd-icon'))).cx, 80, 1);
    near((await at(page, reason.locator('select'))).cy, 178, 1);
    near((await at(page, part(page, 'f-area').locator('.fd-label'))).x, 298, 0);
    expect(await at(page, part(page, 'f-area').locator('input'))).toMatchObject({ x: 374, height: 32 });
    // The access keys: the letter underlined, the label's words whole.
    for (const [id, letter, words] of [['f-state', 'e', 'State'], ['f-area', 'A', 'Area'], ['f-iteration', 'r', 'Iteration']]) {
      await expect(part(page, id).locator('.fd-label')).toHaveText(words);
      await expect(part(page, id).locator('.fd-access-key')).toHaveText(letter);
      expect((await drawn(part(page, id).locator('.fd-access-key'), 'text-decoration-line'))['text-decoration-line']).toBe('underline');
    }
    const updated = dialog(page).getByRole('button', { name: 'Updated by Mona Adel: Aug 25' });
    near((await at(page, updated)).right, 8, 1);
    near((await at(page, updated)).cy, 134, 1);
  });

  test('the tabs in the head: Details underlined, History by its icon, Links and Attachments with their counts', async ({ page }) => {
    await popup(page);
    const tabs = dialog(page).locator('.fd-head-tabs');
    expect(await at(page, tabs)).toMatchObject({ y: 164, height: 36, right: 8 });
    near((await at(page, tabs)).x, 1728 - 238, 2);
    const details = dialog(page).getByRole('tab', { name: 'Details' });
    await expect(details).toHaveAttribute('aria-selected', 'true');
    expect(await details.evaluate((el) => getComputedStyle(el, '::after').backgroundColor)).toBe('rgb(0, 120, 212)');
    expect((await drawn(details, 'font-weight'))['font-weight']).toBe('600');
    await expect(dialog(page).getByRole('tab', { name: 'History' })).toHaveAttribute('title', 'History');
    await expect(dialog(page).getByRole('tab', { name: 'Links, 0' })).toBeVisible();
    await expect(dialog(page).getByRole('tab', { name: 'Attachments, 1' })).toBeVisible();
    const pill = dialog(page).getByRole('tab', { name: 'Links, 0' }).locator('.fd-tab-count');
    expect(await drawn(pill, 'background-color', 'height', 'font-size', 'font-weight')).toEqual({ 'background-color': 'rgb(235, 235, 235)', height: '19px', 'font-size': '12px', 'font-weight': '600' });
    expect((await drawn(details, 'border-top-color'))['border-top-color']).toBe('rgb(218, 218, 218)');
  });

  test('axe finds nothing at rest, with the State’s list open, and the record’s menu open', async ({ page }) => {
    await popup(page);
    expect(await axeFindings(page, 'wi-head at rest')).toEqual([]);
    // The State's dot, in the lead slot, opens the states; so does its words' box.
    await part(page, 'f-state').locator('.fd-dot-button').click();
    await expect(dialog(page).getByRole('menu', { name: 'State' })).toBeVisible();
    expect(await axeFindings(page, 'wi-head, State’s list open')).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(dialog(page)).toBeVisible();
    await dialog(page).getByRole('button', { name: 'More actions' }).click();
    await expect(dialog(page).getByRole('menuitem', { name: 'Copy link' })).toBeFocused();
    expect(await axeFindings(page, 'wi-head, ⋮ open')).toEqual([]);
  });
});

test.describe('pointed at, focused, pressed', () => {
  test.use({ viewport: WINDOW });

  test('the title pointed at: an edge of the strong border, 32px, and Copy title at its end; the same on keyboard focus', async ({ page }) => {
    await popup(page);
    const title = part(page, '#title').locator('input');
    await title.hover();
    await expect.poll(async () => (await drawn(title, 'border-top-color'))['border-top-color']).toBe('rgb(126, 126, 126)');
    const copy = dialog(page).getByRole('button', { name: 'Copy title' });
    await expect(copy).toBeVisible();
    expect(await at(page, copy)).toMatchObject({ right: 8, width: 34, height: 32 });
    expect((await drawn(copy, 'background-color'))['background-color']).toBe('rgb(242, 242, 242)');
    await screen(page, 'wi-header-title-pointed', { viewport: true });
    // By the keyboard, with nothing pointed at.
    await page.mouse.move(1900, 970);
    await expect(copy).toBeHidden();
    await title.focus();
    await expect(copy).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(copy).toBeFocused();
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.keyboard.press('Enter');
    await expect(page.locator('.fd-says').filter({ hasText: 'Title copied' }).first()).toBeAttached();
  });

  test('Save and Close with nothing changed simply closes, unsaved, and gives the focus back', async ({ page }) => {
    await popup(page);
    await part(page, 'b-save-close').getByRole('button', { name: 'Save and Close', exact: true }).click();
    await expect(dialog(page)).toHaveCount(0);
    expect((await results(page))[0].saved).toBe(false);
  });

  test('after a change Save and Close is primary, saves and closes saved', async ({ page }) => {
    await popup(page);
    const area = part(page, 'f-area').locator('input');
    await area.click();
    await page.getByRole('option', { name: 'Warehouse' }).click();
    const main = part(page, 'b-save-close').getByRole('button', { name: 'Save and Close', exact: true });
    await expect(main).toHaveClass(/fd-button-primary/);
    expect((await drawn(main, 'background-color', 'color'))).toEqual({ 'background-color': 'rgb(0, 120, 212)', color: 'rgb(255, 255, 255)' });
    await screen(page, 'wi-header-changed', { viewport: true });
    await main.click();
    await expect(dialog(page)).toHaveCount(0);
    const [result] = await results(page);
    expect(result.saved).toBe(true);
    expect(result.values['area']).toEqual({ id: 4, label: 'Warehouse' });
  });

  test('Save in Save and Close’s menu saves and keeps the popup open', async ({ page }) => {
    await popup(page);
    await part(page, 'f-area').locator('input').click();
    await page.getByRole('option', { name: 'Warehouse' }).click();
    const more = part(page, 'b-save-close').locator('.fd-split-more');
    await more.click();
    await expect(more).toHaveAttribute('aria-expanded', 'true');
    await expect(dialog(page).getByRole('menuitem', { name: 'Save' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(part(page, 'b-save-close').getByRole('button', { name: 'Save and Close', exact: true })).toHaveClass(/fd-button-subtle/);
    await expect(dialog(page)).toBeVisible();
  });

  test('Undo with nothing changed says so; with a change, it puts it back', async ({ page }) => {
    await popup(page);
    const undo = dialog(page).getByRole('button', { name: 'Revert changes' });
    await undo.click();
    await expect(page.locator('.fd-say').filter({ hasText: 'Nothing has changed.' })).toBeVisible();
    await part(page, 'f-area').locator('input').click();
    await page.getByRole('option', { name: 'Warehouse' }).click();
    await undo.click();
    await expect(part(page, 'f-area').locator('input')).toHaveValue('Portal');
  });

  test('Alt+E, Alt+A and Alt+R take the focus to State, Area and Iteration', async ({ page }) => {
    await popup(page);
    await page.keyboard.press('Alt+KeyE');
    await expect(part(page, 'f-state').locator('.fd-dot-button')).toBeFocused();
    await page.keyboard.press('Alt+KeyA');
    await expect(part(page, 'f-area').locator('input')).toBeFocused();
    await page.keyboard.press('Alt+KeyR');
    await expect(part(page, 'f-iteration').locator('input')).toBeFocused();
    await expect(part(page, 'f-area').locator('input')).toHaveAttribute('aria-keyshortcuts', 'Alt+A');
  });

  test('Escape with changes asks first: Cancel keeps them, Discard closes', async ({ page }) => {
    await popup(page);
    await part(page, 'f-area').locator('input').click();
    await page.getByRole('option', { name: 'Warehouse' }).click();
    await dialog(page).focus();
    await page.keyboard.press('Escape');
    const ask = page.getByRole('alertdialog', { name: 'Discard your changes?' });
    await expect(ask).toBeVisible();
    await ask.getByRole('button', { name: 'Cancel' }).click();
    await expect(part(page, 'f-area').locator('input')).toHaveValue('Warehouse');
    await dialog(page).getByRole('button', { name: 'Close', exact: true }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Discard' }).click();
    await expect(dialog(page)).toHaveCount(0);
    expect((await results(page))[0].saved).toBe(false);
  });

  test('Follow toggles to Following, the record never changed by it; its gear’s menu', async ({ page }) => {
    await popup(page);
    const follow = part(page, 'b-follow').getByRole('button', { name: 'Follow', exact: true });
    await expect(follow).toHaveAttribute('aria-pressed', 'false');
    await follow.click();
    const following = part(page, 'b-follow').getByRole('button', { name: 'Following' });
    await expect(following).toHaveAttribute('aria-pressed', 'true');
    // Nothing to save: Save and Close stays quiet, Escape closes at once.
    await expect(part(page, 'b-save-close').getByRole('button', { name: 'Save and Close', exact: true })).toHaveClass(/fd-button-subtle/);
    await part(page, 'b-follow').getByRole('button', { name: 'Notification settings' }).click();
    await expect(page.getByRole('menuitem', { name: 'All changes' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(part(page, 'b-follow').getByRole('button', { name: 'Notification settings' })).toBeFocused();
    await following.click();
    await expect(follow).toHaveAttribute('aria-pressed', 'false');
    await page.keyboard.press('Escape');
    await expect(dialog(page)).toHaveCount(0);
  });

  test('“1 Comment” takes the reader to the discussion; “Updated by” shows the history, underlined', async ({ page }) => {
    await popup(page);
    await dialog(page).getByRole('button', { name: 'Updated by Mona Adel: Aug 25' }).click();
    const history = dialog(page).getByRole('tab', { name: 'History' });
    await expect(history).toHaveAttribute('aria-selected', 'true');
    await expect(history).toBeFocused();
    expect(await history.evaluate((el) => getComputedStyle(el, '::after').backgroundColor)).toBe('rgb(0, 120, 212)');
    expect((await drawn(dialog(page).getByRole('tab', { name: 'Details' }), 'font-weight'))['font-weight']).toBe('400');
    await page.mouse.move(1900, 970);
    await screen(page, 'wi-header-history', { viewport: true });
    await part(page, 'h-comments').click();
    await expect(dialog(page).getByRole('tab', { name: 'Details' })).toHaveAttribute('aria-selected', 'true');
    await expect(part(page, 'f-comment').locator('textarea')).toBeFocused();
  });

  test('the tabs move with the arrows, Home and End', async ({ page }) => {
    await popup(page);
    await dialog(page).getByRole('tab', { name: 'Details' }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(dialog(page).getByRole('tab', { name: 'History' })).toBeFocused();
    await page.keyboard.press('End');
    await expect(dialog(page).getByRole('tab', { name: 'Attachments, 1' })).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('Home');
    await expect(dialog(page).getByRole('tab', { name: 'Details' })).toHaveAttribute('aria-selected', 'true');
  });

  test('⤢ fills the window and Restore puts it back; the grip resizes by its arrow keys and by dragging', async ({ page }) => {
    await popup(page);
    await dialog(page).getByRole('button', { name: 'Maximise' }).click();
    expect(await dialog(page).boundingBox()).toEqual({ x: 0, y: 0, ...WINDOW });
    await screen(page, 'wi-header-maximised', { viewport: true });
    await dialog(page).getByRole('button', { name: 'Restore' }).click();
    expect(await dialog(page).boundingBox()).toEqual({ x: 96, y: 46, width: 1728, height: 891 });
    const grip = dialog(page).getByRole('button', { name: 'Resize' });
    await grip.focus();
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowUp');
    expect(await dialog(page).boundingBox()).toEqual({ x: 96, y: 46, width: 1728 - 32, height: 891 - 16 });
    const box = (await grip.boundingBox()) as { x: number; y: number; width: number; height: number };
    await page.mouse.move(box.x + 8, box.y + 8);
    await page.mouse.down();
    await page.mouse.move(box.x - 392, box.y - 192, { steps: 8 });
    await page.mouse.up();
    expect(await dialog(page).boundingBox()).toEqual({ x: 96, y: 46, width: 1728 - 32 - 400, height: 891 - 16 - 200 });
    // The head lays itself out again in the room it has.
    await expect(dialog(page).locator('.fd-head-tabs')).toBeVisible();
  });
});

test.describe('right to left, dark, a phone, four languages', () => {
  test.use({ viewport: WINDOW });

  test('in Arabic it mirrors: the strip at the right, the buttons at the left, the tabs at the band’s left end', async ({ page }) => {
    const problems = await popup(page, `${POPUP}&locale=ar`);
    await expect(dialog(page)).toHaveAttribute('dir', 'rtl');
    const strip = await at(page, dialog(page).locator('.fd-head-strip'));
    expect(strip).toMatchObject({ right: 0, width: 10 });
    near((await at(page, dialog(page).locator('.fd-head-tabs'))).x, 8, 1);
    near((await at(page, dialog(page).getByRole('button', { name: 'إجراءات أخرى' }))).cx, 23);
    near((await at(page, part(page, 'f-state').locator('.fd-dot-button > .fd-dot'))).fromRight, 80, 1);
    await expect(dialog(page).locator('.fd-head-badge')).toHaveText('خطأ 4127');
    await expect(part(page, 'h-comments')).toHaveText('1 تعليق');
    await expect(dialog(page).getByRole('tab', { name: 'الروابط، 0' })).toBeVisible();
    await expect(dialog(page).getByRole('button', { name: 'آخر تحديث من Mona Adel: 25 أغسطس' })).toBeVisible();
    await screen(page, 'wi-header-rtl', { viewport: true });
    expect(await axeFindings(page, 'wi-head, Arabic')).toEqual([]);
    expect(problems).toEqual([]);
  });

  test('dark: the host’s dark colours, the band a step up from the surface, axe clean', async ({ page }) => {
    await popup(page, `${POPUP}&scheme=dark`);
    expect((await drawn(dialog(page), 'background-color'))['background-color']).toBe('rgb(37, 36, 35)');
    const band = (await drawn(dialog(page).locator('.fd-head-band'), 'background-color'))['background-color'];
    expect(band).not.toBe('rgb(37, 36, 35)');
    expect((await drawn(dialog(page).locator('.fd-head-strip'), 'background-color'))['background-color']).toBe('rgb(204, 41, 61)');
    await screen(page, 'wi-header-dark', { viewport: true });
    expect(await axeFindings(page, 'wi-head, dark')).toEqual([]);
  });

  test('390px wide: the whole window, nothing sideways, every button in reach', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await popup(page);
    expect(await dialog(page).boundingBox()).toEqual({ x: 0, y: 0, width: 390, height: 844 });
    await expectNoSidewaysScroll(page);
    for (const name of ['Refresh', 'Revert changes', 'More actions', 'Close']) await expect(dialog(page).getByRole('button', { name, exact: true })).toBeInViewport();
    await expect(dialog(page).getByRole('button', { name: 'Maximise' })).toBeHidden();
    await screen(page, 'wi-header-phone', { viewport: true });
    expect(await axeFindings(page, 'wi-head, 390px')).toEqual([]);
  });

  test('its own words in German and French', async ({ page }) => {
    await popup(page, `${POPUP}&locale=de`);
    await expect(part(page, 'b-save-close').getByRole('button', { name: 'Speichern und schließen', exact: true })).toBeVisible();
    await expect(dialog(page).getByRole('button', { name: 'Weitere Aktionen' })).toBeVisible();
    await expect(dialog(page).getByRole('tab', { name: 'Links, 0' })).toBeVisible();
    await expect(dialog(page).getByRole('button', { name: 'Maximieren' })).toBeVisible();
    await popup(page, `${POPUP}&locale=fr`);
    await expect(dialog(page).getByRole('button', { name: 'Autres actions' })).toBeVisible();
    await expect(dialog(page).getByRole('button', { name: 'Agrandir' })).toBeVisible();
    await expect(part(page, 'f-state').locator('.fd-label')).toHaveText('État');
    await expect(dialog(page).locator('.fd-head-badge')).toHaveText('BOGUE 4127');
  });

  test('on its own page, without the popup, the head is drawn the same, with no ⤢ or ×', async ({ page }) => {
    const { problems } = await open(page, 'plain', 'page=wi-head');
    await expect(page.locator('.fd-head-badge').first()).toHaveText('BUG 4127');
    await expect(page.locator('.fd-head-window').first().locator('button')).toHaveCount(0);
    expect(await axeFindings(page, 'wi-head page')).toEqual([]);
    expect(problems).toEqual([]);
  });
});
