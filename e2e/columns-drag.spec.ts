import { type Browser, type CDPSession, type Locator, type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { open, screen } from './support';

/**
 * A column moved by dragging its header, at a hand's speed, in each engine: in a list whose columns people shape (the
 * contacts) — its ghost under the pointer, the other columns sliding aside, a line where it goes; let go, there and
 * kept, said to a screen reader, nothing sorted; a press that does not move sorts as before, Escape puts a drag back,
 * right to left mirrored — and in a table of lines drawn as a grid (the sales order), alike: Escape puts it back, a
 * drag out of the grid never hides it, its new place said and kept. On a phone held sideways, a finger: a swipe on a
 * header scrolls, a tap is a tap, and a finger resting a moment lifts the column (Chromium, whose touches the test
 * sends through its own protocol).
 */

const rows = (page: Page) => page.locator('.fd-list-table tbody tr.fd-list-row');
/** The headers a person sees, in order. */
const heads = (page: Page) => page.locator('.fd-list-table thead th[data-col]:visible');
const header = (page: Page, column: string) => page.locator(`.fd-list-table thead th[data-col="${column}"]`);
/** What the list says to a screen reader of a column moved. */
const said = (page: Page) => page.locator('.fd-list > .fd-sr-only[role="status"]');
const CONTACTS = ['Name', 'Company', 'Country', 'Status', 'Owner', 'Last order', 'Lifetime value', 'Newsletter'];

async function contacts(page: Page, more = '') {
  const opened = await open(page, 'plain', `page=contacts&skin=underline${more}`);
  await expect(rows(page)).toHaveCount(10);
  return opened;
}
async function boxOf(target: Locator) {
  const box = await target.boundingBox();
  if (!box) throw new Error('not on screen');
  return box;
}
/** Where an element's side is across the screen. */
const edgeOf = async (target: Locator, side: 'left' | 'right') => {
  const box = await boxOf(target);
  return side === 'left' ? box.x : box.x + box.width;
};
/** Wait until an element stops moving, so a drag takes hold where it is, not where it was. */
async function holdsStill(target: Locator) {
  let last = '';
  await expect
    .poll(async () => {
      const now = JSON.stringify(await target.boundingBox());
      const still = now === last;
      last = now;
      return still;
    })
    .toBe(true);
}
/** A hand's drag along the header's row: pressed at `from`, moved in steps to `to`. Let go by the caller. */
async function carry(page: Page, from: { x: number; y: number }, to: number) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to, from.y, { steps: 24 });
}

test.describe('a list’s column moved by dragging its header', () => {
  test('follows a hand’s drag — its ghost, the columns sliding aside, a line where it goes — and let go, it is there, kept for the next visit, said, nothing sorted', async ({ page }) => {
    const { problems } = await contacts(page);
    await expect(heads(page)).toHaveText(CONTACTS);
    await holdsStill(header(page, 'company'));
    const company = await boxOf(header(page, 'company'));
    const status = await boxOf(header(page, 'state'));
    const to = status.x + status.width * 0.75;
    await carry(page, { x: company.x + company.width / 2, y: company.y + company.height / 2 }, to);
    // Its ghost under the pointer, as it was held.
    const ghost = page.locator('.fd-list-ghost');
    await expect(ghost).toHaveText('Company');
    const held = await boxOf(ghost);
    expect(held.x).toBeCloseTo(to - company.width / 2, 0);
    expect(held.y).toBeCloseTo(company.y, 0);
    // Country and Status slid back to where Company began; Company's own cells stand in the place it takes, a line at its start.
    await expect.poll(async () => Math.round((await boxOf(header(page, 'country_id'))).x)).toBe(Math.round(company.x));
    await expect(rows(page).first().locator('td[data-col="company"]')).toHaveAttribute('data-lifted', '');
    // Right after Status as it slid, the line at its start.
    await expect.poll(async () => Math.abs((await boxOf(header(page, 'company'))).x - (await edgeOf(header(page, 'state'), 'right')))).toBeLessThanOrEqual(1);
    const line = page.locator('.fd-list-drop');
    await expect(line).toBeVisible();
    expect(Math.abs((await boxOf(line)).x + 1 - (await boxOf(header(page, 'company'))).x)).toBeLessThanOrEqual(1.5);
    await screen(page, 'list-columns-dragging', { viewport: true });
    await page.mouse.up();
    await expect(heads(page)).toHaveText(['Name', 'Country', 'Status', 'Company', 'Owner', 'Last order', 'Lifetime value', 'Newsletter']);
    await expect(page.locator('.fd-list-ghost, .fd-list-drop')).toHaveCount(0);
    await expect(page.locator('.fd-list-table [data-lifted]')).toHaveCount(0);
    // Each row's cells under their headers.
    const first = rows(page).first();
    expect(await first.locator('td[data-col]:visible').evaluateAll((cells) => cells.map((cell) => cell.getAttribute('data-col')))).toEqual(['name', 'country_id', 'state', 'company', 'owner_id', 'last_order', 'lifetime_value', 'newsletter']);
    expect(Math.round((await boxOf(first.locator('td[data-col="company"]'))).x)).toBe(Math.round((await boxOf(header(page, 'company'))).x));
    await expect(said(page)).toHaveText('Company moved to place 4 of 8');
    // The press was a drag: Name is still the order, Company no sort.
    await expect(header(page, 'company')).not.toHaveAttribute('aria-sort', /./);
    await expect(header(page, 'name')).toHaveAttribute('aria-sort', 'ascending');
    await screen(page, 'list-columns-dropped', { viewport: true });
    await page.reload();
    await expect(rows(page)).toHaveCount(10);
    await expect(heads(page)).toHaveText(['Name', 'Country', 'Status', 'Company', 'Owner', 'Last order', 'Lifetime value', 'Newsletter']);
    expect(problems).toEqual([]);
  });

  test('sorts on a press that does not move; Escape puts a drag back and keeps nothing; the grip still sizes', async ({ page }) => {
    const { problems } = await contacts(page);
    await holdsStill(header(page, 'company'));
    const company = await boxOf(header(page, 'company'));
    const at = { x: company.x + company.width / 2, y: company.y + company.height / 2 };
    // A press with a hand's tremble, a pixel or two: a sort.
    await page.mouse.move(at.x, at.y);
    await page.mouse.down();
    await page.mouse.move(at.x + 2, at.y + 1, { steps: 3 });
    await page.mouse.up();
    await expect(header(page, 'company')).toHaveAttribute('aria-sort', 'ascending');
    await expect(page.locator('.fd-list-ghost')).toHaveCount(0);
    // A drag, then Escape before it is let go: everything back, nothing kept, the press no sort.
    await holdsStill(header(page, 'company'));
    const sorted = await boxOf(header(page, 'company'));
    const owner = await boxOf(header(page, 'owner_id'));
    await carry(page, { x: sorted.x + sorted.width / 2, y: at.y }, owner.x + owner.width * 0.75);
    await expect(page.locator('.fd-list-ghost')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.fd-list-ghost')).toHaveCount(0);
    await page.mouse.up();
    await expect(heads(page)).toHaveText(CONTACTS);
    await expect.poll(async () => Math.round((await boxOf(header(page, 'country_id'))).x)).toBe(Math.round(sorted.x + sorted.width));
    expect(await page.evaluate(() => Object.keys(localStorage).filter((key) => key.endsWith('.columns')))).toEqual([]);
    await expect(header(page, 'company')).toHaveAttribute('aria-sort', 'ascending');
    // The header's edge still sizes its column, never moves it.
    const grip = header(page, 'company').locator('.fd-list-grip');
    const edge = await boxOf(grip);
    await carry(page, { x: edge.x + edge.width / 2, y: edge.y + edge.height / 2 }, edge.x + edge.width / 2 + 80);
    await expect(page.locator('.fd-list-ghost')).toHaveCount(0);
    await page.mouse.up();
    await expect.poll(async () => Math.round((await boxOf(header(page, 'company'))).width)).toBeGreaterThan(Math.round(sorted.width) + 60);
    await expect(heads(page)).toHaveText(CONTACTS);
    expect(problems).toEqual([]);
  });

  test('right to left, mirrored: carried leftwards, it goes after the columns it passed', async ({ page }) => {
    const { problems } = await contacts(page, '&locale=ar');
    await holdsStill(header(page, 'company'));
    const company = await boxOf(header(page, 'company'));
    const status = await boxOf(header(page, 'state'));
    // Status stands to Company's left: past its middle, leftwards.
    expect(status.x).toBeLessThan(company.x);
    await carry(page, { x: company.x + company.width / 2, y: company.y + company.height / 2 }, status.x + status.width * 0.25);
    // Country slid right into Company's place, Company to Status's left, the line at its start: its right edge.
    await expect.poll(async () => Math.abs((await edgeOf(header(page, 'country_id'), 'right')) - (company.x + company.width))).toBeLessThanOrEqual(1);
    await expect.poll(async () => Math.abs((await edgeOf(header(page, 'company'), 'right')) - (await boxOf(header(page, 'state'))).x)).toBeLessThanOrEqual(1);
    const line = await boxOf(page.locator('.fd-list-drop'));
    expect(Math.abs(line.x + 1 - (await edgeOf(header(page, 'company'), 'right')))).toBeLessThanOrEqual(1.5);
    await screen(page, 'list-columns-dragging-rtl', { viewport: true });
    await page.mouse.up();
    await expect(heads(page)).toHaveText(['Name', 'Country', 'Status', 'Company', 'Owner', 'Last order', 'Lifetime value', 'Newsletter']);
    await expect(header(page, 'company')).not.toHaveAttribute('aria-sort', /./);
    expect(problems).toEqual([]);
  });

  test('moves the first column too: the column that comes first is the one held in view', async ({ page }) => {
    const { problems } = await contacts(page);
    await holdsStill(header(page, 'name'));
    const name = await boxOf(header(page, 'name'));
    const company = await boxOf(header(page, 'company'));
    await carry(page, { x: name.x + name.width / 2, y: name.y + name.height / 2 }, company.x + company.width * 0.75);
    await page.mouse.up();
    await expect(heads(page)).toHaveText(['Company', 'Name', 'Country', 'Status', 'Owner', 'Last order', 'Lifetime value', 'Newsletter']);
    await expect(page.locator('.fd-list-table thead th[data-pin]')).toHaveAttribute('data-col', 'company');
    await expect(rows(page).first().locator('td[data-pin]')).toHaveAttribute('data-col', 'company');
    expect(problems).toEqual([]);
  });
});

// ---- a table wider than its card, scrolled sideways (Phone and Email shown, on a narrower window) ----

const NARROW = { width: 820, height: 700 };
const WIDE = ['Name', 'Company', 'Country', 'Status', 'Owner', 'Last order', 'Lifetime value', 'Newsletter', 'Phone', 'Email'];
/** The Columns menu's button and the menu, in any of the page's languages. */
const columnsButton = (page: Page) => page.locator('.fd-list-columns-button');
const columnsMenu = (page: Page) => page.locator('.fd-list-columns-menu[role="dialog"]');
const tableScroll = (page: Page) => page.locator('.fd-list-scroll');
const scrolledBy = (page: Page) => tableScroll(page).evaluate((element) => Math.round(element.scrollLeft));
const scrolledMost = (page: Page) => tableScroll(page).evaluate((element) => element.scrollWidth - element.clientWidth);
/** Phone and Email shown from the Columns menu, the menu closed with Escape: the table wider than its card. */
async function widen(page: Page) {
  await columnsButton(page).click();
  const menu = columnsMenu(page);
  await menu.getByLabel('Phone', { exact: true }).check();
  await menu.getByLabel('Email', { exact: true }).check();
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(heads(page)).toHaveText(WIDE);
  expect(await scrolledMost(page)).toBeGreaterThan(300);
}
/** The table scrolled sideways by a wheel over it, as far as `to` goes ('start' or 'end'); right to left, leftwards to its end. */
async function wheelTo(page: Page, to: 'start' | 'end', rtl = false) {
  const card = await boxOf(tableScroll(page));
  await page.mouse.move(card.x + card.width / 2, card.y + card.height / 2);
  const most = await scrolledMost(page);
  // Within a pixel: right to left an engine may stop half a pixel short of its most.
  await expect
    .poll(async () => {
      await page.mouse.wheel((to === 'end') !== rtl ? 400 : -400, 0);
      return Math.abs(Math.abs(await scrolledBy(page)) - (to === 'end' ? most : 0)) <= 1;
    })
    .toBe(true);
}
/** Whether the Columns menu's button is in sight: what is under its middle is the button, no column drawn over it. */
const buttonSeen = (page: Page) =>
  columnsButton(page).evaluate((button) => {
    const box = button.getBoundingClientRect();
    return !!document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)?.closest('.fd-list-columns-button');
  });
/** The rule at the start of the Columns menu's cell, parting it from the columns under it: none where none is. */
const tailRule = (page: Page) => page.locator('.fd-list-table thead th.fd-list-tail').evaluate((cell) => getComputedStyle(cell).boxShadow);
/** The middle of what is seen of a header, the card's sides cutting it. */
async function seenMiddle(page: Page, target: Locator) {
  const box = await boxOf(target);
  const card = await boxOf(tableScroll(page));
  return { x: (Math.max(box.x, card.x) + Math.min(box.x + box.width, card.x + card.width)) / 2, y: box.y + box.height / 2 };
}

test.describe('a table scrolled sideways', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(NARROW);
  });

  test('Escape out of the Columns menu gives its button the focus and leaves the table where it was scrolled', async ({ page }) => {
    const { problems } = await contacts(page);
    // The columns shown widen the table past its card; the button, held at the header's end, is pressed where it is.
    await expect(columnsButton(page)).toHaveAccessibleName('Columns');
    await columnsButton(page).click();
    const menu = page.getByRole('dialog', { name: 'Columns' });
    await menu.getByLabel('Phone', { exact: true }).check();
    await menu.getByLabel('Email', { exact: true }).check();
    await expect(heads(page)).toHaveText(WIDE);
    const before = await scrolledBy(page);
    expect(before).toBeLessThan((await scrolledMost(page)) - 100);
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(columnsButton(page)).toBeFocused();
    expect(await scrolledBy(page)).toBe(before);
    // The names, held in view, and the columns beside them as they were.
    await expect(header(page, 'name')).toBeInViewport();
    expect(problems).toEqual([]);
  });

  test('a column carried to the card’s end scrolls the table there, and let go, it is the last', async ({ page }) => {
    const { problems } = await contacts(page);
    await widen(page);
    await wheelTo(page, 'start');
    await holdsStill(header(page, 'company'));
    const company = await boxOf(header(page, 'company'));
    const card = await boxOf(tableScroll(page));
    await carry(page, { x: company.x + company.width / 2, y: company.y + company.height / 2 }, card.x + card.width - 8);
    await expect(page.locator('.fd-list-ghost')).toHaveText('Company');
    // Held there, the table scrolls on to its end, the line at the end of the last column.
    const most = await scrolledMost(page);
    await expect.poll(() => scrolledBy(page)).toBe(most);
    await expect.poll(async () => Math.abs((await boxOf(page.locator('.fd-list-drop'))).x + 1 - (await edgeOf(header(page, 'email'), 'right')))).toBeLessThanOrEqual(1.5);
    await screen(page, 'list-columns-dragging-scrolled-end', { viewport: true });
    await page.mouse.up();
    await expect(heads(page)).toHaveText(['Name', 'Country', 'Status', 'Owner', 'Last order', 'Lifetime value', 'Newsletter', 'Phone', 'Email', 'Company']);
    await expect(said(page)).toHaveText('Company moved to place 10 of 10');
    expect(problems).toEqual([]);
  });

  test('right to left, a column carried to the card’s end — its left — scrolls the table there, and let go, it is the last', async ({ page }) => {
    const { problems } = await contacts(page, '&locale=ar');
    await widen(page);
    // Back to its start, at the right, by a wheel over it.
    const over = await boxOf(tableScroll(page));
    await page.mouse.move(over.x + over.width / 2, over.y + over.height / 2);
    await expect
      .poll(async () => {
        await page.mouse.wheel(400, 0);
        return scrolledBy(page);
      })
      .toBe(0);
    await holdsStill(header(page, 'company'));
    const company = await boxOf(header(page, 'company'));
    const card = await boxOf(tableScroll(page));
    await carry(page, { x: company.x + company.width / 2, y: company.y + company.height / 2 }, card.x + 8);
    await expect(page.locator('.fd-list-ghost')).toHaveText('Company');
    // Right to left the table scrolls leftwards: scrollLeft runs from 0 below it, to minus its most.
    const most = await scrolledMost(page);
    await expect.poll(() => scrolledBy(page)).toBe(-most);
    await expect.poll(async () => Math.abs((await boxOf(page.locator('.fd-list-drop'))).x + 1 - (await boxOf(header(page, 'email'))).x)).toBeLessThanOrEqual(1.5);
    await screen(page, 'list-columns-dragging-scrolled-end-rtl', { viewport: true });
    await page.mouse.up();
    await expect(heads(page)).toHaveText(['Name', 'Country', 'Status', 'Owner', 'Last order', 'Lifetime value', 'Newsletter', 'Phone', 'Email', 'Company']);
    expect(problems).toEqual([]);
  });

  for (const rtl of [false, true]) {
    const way = rtl ? 'right to left' : 'left to right';

    test(`${way}: the Columns button stays in sight at the header’s end as the table scrolls, a rule parting it from the columns under it`, async ({ page }) => {
      const { problems } = await contacts(page, rtl ? '&locale=ar' : '');
      // Wider than its card from the first: the page's own columns.
      await expect(heads(page)).toHaveText(CONTACTS);
      expect(await scrolledMost(page)).toBeGreaterThan(100);
      expect(await scrolledBy(page)).toBe(0);
      await expect.poll(() => buttonSeen(page)).toBe(true);
      await expect(tableScroll(page)).toHaveAttribute('data-more', '');
      expect(await tailRule(page)).not.toBe('none');
      // On its side of the card: the right, right to left the left.
      const card = await boxOf(tableScroll(page));
      const cell = await boxOf(page.locator('.fd-list-table thead th.fd-list-tail'));
      expect(Math.abs(rtl ? cell.x - card.x : card.x + card.width - (cell.x + cell.width))).toBeLessThanOrEqual(2);
      await screen(page, `list-columns-button-held${rtl ? '-rtl' : ''}`, { viewport: true });
      // Partway, by a wheel: still in sight.
      await page.mouse.move(card.x + card.width / 2, card.y + card.height / 2);
      await page.mouse.wheel(rtl ? -120 : 120, 0);
      await expect.poll(async () => Math.abs(await scrolledBy(page))).toBeGreaterThan(0);
      await expect.poll(() => buttonSeen(page)).toBe(true);
      // At the end: still in sight, nothing past it, no rule.
      await wheelTo(page, 'end', rtl);
      await expect.poll(() => buttonSeen(page)).toBe(true);
      await expect(tableScroll(page)).not.toHaveAttribute('data-more', /.*/);
      expect(await tailRule(page)).toBe('none');
      // Back at the start, pressed: its menu opens, the table not scrolled to it.
      await wheelTo(page, 'start', rtl);
      await expect.poll(() => buttonSeen(page)).toBe(true);
      await columnsButton(page).click();
      await expect(columnsMenu(page)).toBeVisible();
      expect(await scrolledBy(page)).toBe(0);
      expect(problems).toEqual([]);
    });

    test(`${way}: beside the held Columns cell, the last column’s edge still sizes it and its header still drags`, async ({ page }) => {
      const { problems } = await contacts(page, rtl ? '&locale=ar' : '');
      await wheelTo(page, 'end', rtl);
      await holdsStill(header(page, 'newsletter'));
      const before = await boxOf(header(page, 'newsletter'));
      // Its grip, at its end, against the Columns cell: dragged outwards at a hand's speed.
      const grip = await boxOf(header(page, 'newsletter').locator('.fd-list-grip'));
      await carry(page, { x: grip.x + grip.width / 2, y: grip.y + grip.height / 2 }, grip.x + grip.width / 2 + (rtl ? -60 : 60));
      await expect(page.locator('.fd-list-ghost')).toHaveCount(0);
      await page.mouse.up();
      await expect.poll(async () => Math.round((await boxOf(header(page, 'newsletter'))).width)).toBeGreaterThan(Math.round(before.width) + 40);
      // The table grew: at its end again, the header carried back past Lifetime value's middle.
      await wheelTo(page, 'end', rtl);
      await holdsStill(header(page, 'newsletter'));
      const value = await boxOf(header(page, 'lifetime_value'));
      const from = await seenMiddle(page, header(page, 'newsletter'));
      await carry(page, from, rtl ? value.x + value.width * 0.75 : value.x + value.width * 0.25);
      await expect(page.locator('.fd-list-ghost')).toHaveText('Newsletter');
      await page.mouse.up();
      await expect(heads(page)).toHaveText(['Name', 'Company', 'Country', 'Status', 'Owner', 'Last order', 'Newsletter', 'Lifetime value']);
      await expect.poll(() => buttonSeen(page)).toBe(true);
      expect(problems).toEqual([]);
    });
  }

  test('a column carried over the first column, held in view, scrolls the table back to its start, and goes right after it', async ({ page }) => {
    const { problems } = await contacts(page);
    await widen(page);
    await wheelTo(page, 'end');
    await holdsStill(header(page, 'email'));
    // Name is held at the card's start, over the columns scrolled under it.
    const name = await boxOf(header(page, 'name'));
    expect(await edgeOf(header(page, 'company'), 'right')).toBeLessThan(name.x + name.width);
    await expect(header(page, 'name')).toBeInViewport();
    const from = await seenMiddle(page, header(page, 'email'));
    await carry(page, from, name.x + name.width * 0.75);
    await expect(page.locator('.fd-list-ghost')).toHaveText('Email');
    // Held over Name's end half, the table scrolls back to its start; the line stands at Name's end.
    await expect.poll(() => scrolledBy(page)).toBe(0);
    await expect.poll(async () => Math.abs((await boxOf(page.locator('.fd-list-drop'))).x + 1 - (await edgeOf(header(page, 'name'), 'right')))).toBeLessThanOrEqual(1.5);
    await screen(page, 'list-columns-dragging-scrolled-start', { viewport: true });
    await page.mouse.up();
    await expect(heads(page)).toHaveText(['Name', 'Email', 'Company', 'Country', 'Status', 'Owner', 'Last order', 'Lifetime value', 'Newsletter', 'Phone']);
    await expect(page.locator('.fd-list-table thead th[data-pin]')).toHaveAttribute('data-col', 'name');
    await expect(said(page)).toHaveText('Email moved to place 2 of 10');
    expect(problems).toEqual([]);
  });
});

// ---- a finger, on a phone held sideways (the list a table there, wider than a phone's cards) ----

/** A finger on the screen, through Chromium's own protocol: pressed, moved, lifted. */
function finger(cdp: CDPSession) {
  const at = (x: number, y: number) => [{ x: Math.round(x), y: Math.round(y) }];
  return {
    down: (x: number, y: number) => cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: at(x, y) }),
    move: (x: number, y: number) => cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: at(x, y) }),
    up: () => cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }),
  };
}
async function sideways(browser: Browser, query: string) {
  const context = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  const opened = await open(page, 'plain', query);
  return { page, ...opened, hand: finger(await context.newCDPSession(page)), close: () => context.close() };
}

test.describe('a column moved by a finger', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'a finger’s touches are sent through Chromium’s own protocol');

  test('in a list: a tap sorts, a finger resting a moment lifts the column and it follows, a swipe on a header scrolls the table', async ({ browser }) => {
    const { page, problems, hand, close } = await sideways(browser, 'page=contacts&skin=underline');
    await expect(rows(page)).toHaveCount(10);
    await expect(page.locator('.fd-list')).not.toHaveAttribute('data-as', /./);
    await header(page, 'company').scrollIntoViewIfNeeded();
    await holdsStill(header(page, 'company'));
    let company = await boxOf(header(page, 'company'));
    const y = company.y + company.height / 2;
    // A tap: a sort, the rows asked again and drawn.
    await page.touchscreen.tap(company.x + company.width / 2, y);
    await expect(header(page, 'company')).toHaveAttribute('aria-sort', 'ascending');
    await expect(page.locator('.fd-list-table')).not.toHaveAttribute('aria-busy', /.*/);
    // Resting: the column lifts, then follows the finger past Status.
    await holdsStill(header(page, 'company'));
    company = await boxOf(header(page, 'company'));
    const status = await boxOf(header(page, 'state'));
    await hand.down(company.x + company.width / 2, y);
    await expect(page.locator('.fd-list')).toHaveAttribute('data-moving', '');
    await expect(page.locator('.fd-list-ghost')).toHaveText('Company');
    const to = status.x + status.width * 0.8;
    for (let step = 1; step <= 16; step++) await hand.move(company.x + company.width / 2 + ((to - company.x - company.width / 2) * step) / 16, y);
    await expect.poll(async () => Math.round((await boxOf(header(page, 'country_id'))).x)).toBe(Math.round(company.x));
    await screen(page, 'list-columns-finger', { viewport: true });
    await hand.up();
    const moved = ['Name', 'Country', 'Status', 'Company', 'Owner', 'Last order', 'Lifetime value', 'Newsletter'];
    await expect(heads(page)).toHaveText(moved);
    await expect(said(page)).toHaveText('Company moved to place 4 of 8');
    // The touch was the drag's: still the tap's sort, not turned the other way.
    await expect(header(page, 'company')).toHaveAttribute('aria-sort', 'ascending');
    // A swipe leftwards on a header: the table scrolls, nothing lifts or moves.
    await holdsStill(header(page, 'state'));
    const state = await boxOf(header(page, 'state'));
    const scroll = page.locator('.fd-list-scroll');
    await hand.down(state.x + state.width / 2, y);
    for (let step = 1; step <= 12; step++) await hand.move(state.x + state.width / 2 - step * 10, y);
    await hand.up();
    await expect.poll(() => scroll.evaluate((element) => element.scrollLeft)).toBeGreaterThan(40);
    await expect(page.locator('.fd-list[data-moving]')).toHaveCount(0);
    await expect(heads(page)).toHaveText(moved);
    expect(problems).toEqual([]);
    await close();
  });

  test('in a grid: a finger resting a moment lifts the column and it follows, a swipe on a header scrolls the page', async ({ browser }) => {
    const { page, problems, hand, close } = await sideways(browser, 'page=order&skin=underline');
    const grid = page.locator('[data-node="f-lines"]');
    const cellHead = (column: string) => grid.locator(`.ag-header-cell[col-id="${column}"]`);
    await cellHead('price').scrollIntoViewIfNeeded();
    await holdsStill(cellHead('price'));
    const start = await gridOrder(grid);
    // Resting: lifted, then carried past Disc. % (AG Grid moved it at the first touch).
    const price = await boxOf(cellHead('price'));
    const discount = await boxOf(cellHead('discount'));
    const y = price.y + price.height / 2;
    await hand.down(price.x + price.width / 2, y);
    await expect(cellHead('price')).toHaveAttribute('data-lifted', '');
    const to = discount.x + discount.width * 0.8;
    for (let step = 1; step <= 16; step++) await hand.move(price.x + price.width / 2 + ((to - price.x - price.width / 2) * step) / 16, y);
    const moved = start.map((one) => (one === 'price' ? 'discount' : one === 'discount' ? 'price' : one));
    await expect.poll(() => gridOrder(grid)).toEqual(moved);
    await screen(page, 'grid-columns-finger', { viewport: true });
    await hand.up();
    await expect(cellHead('price')).not.toHaveAttribute('data-lifted', /.*/);
    await expect(grid.locator('.fd-sr-only[role="status"]')).toHaveText(`Unit price moved to place ${moved.indexOf('price') + 1} of ${moved.length}`);
    await expect.poll(() => keptOrder(page)).toContain('discount price');
    // A swipe up on a header: the page scrolls, no column moves (AG Grid's header took every touch).
    await holdsStill(cellHead('qty'));
    const qty = await boxOf(cellHead('qty'));
    const scrolled = await page.evaluate(() => window.scrollY);
    await hand.down(qty.x + qty.width / 2, qty.y + qty.height / 2);
    for (let step = 1; step <= 10; step++) await hand.move(qty.x + qty.width / 2, qty.y + qty.height / 2 - step * 8);
    await hand.up();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(scrolled + 20);
    expect(await gridOrder(grid)).toEqual(moved);
    expect(problems).toEqual([]);
    await close();
  });
});

// ---- the grid, as a list ----

/** A grid's own columns in the order a person sees them (AG Grid moves header cells on screen, not in the markup). */
const gridOrder = (grid: Locator) =>
  grid.locator('.ag-header-cell[col-id]:not([col-id^="__"])').evaluateAll((cells) => cells.map((cell) => [cell.getAttribute('col-id'), cell.getBoundingClientRect().x] as const).sort((p, q) => p[1] - q[1]).map((p) => p[0] as string));
/** The columns the grid kept for the person, in order, or nothing kept. */
const keptOrder = (page: Page) =>
  page.evaluate(() => {
    const key = Object.keys(localStorage).find((one) => one.startsWith('fieldia:') && one.endsWith('.columns'));
    return key ? (JSON.parse(localStorage.getItem(key) as string) as { colId: string }[]).map((column) => column.colId).join(' ') : '';
  });

test.describe('a grid’s column moved by dragging its header, as a list’s', () => {
  test('Escape puts it back, keeping nothing; a drag out of the grid never hides it; let go in its place, it is said and kept', async ({ page }) => {
    const { problems } = await open(page, 'plain', 'page=order&skin=underline');
    const grid = page.locator('[data-node="f-lines"]');
    const cellHead = (column: string) => grid.locator(`.ag-header-cell[col-id="${column}"]`);
    await expect(grid.locator('.ag-row[row-index="5"] .ag-cell[col-id="subtotal"]')).toHaveText('E£ 4,560.00');
    await holdsStill(cellHead('price'));
    const start = await gridOrder(grid);
    expect(start.indexOf('price')).toBe(start.indexOf('qty') + 1);
    expect(await keptOrder(page)).toBe('');
    const price = await boxOf(cellHead('price'));
    const qty = await boxOf(cellHead('qty'));
    const at = { x: price.x + price.width / 2, y: price.y + price.height / 2 };
    // Carried before Quantity, then Escape: back where it was, nothing kept.
    await carry(page, at, qty.x + 10);
    await expect.poll(() => gridOrder(grid)).not.toEqual(start);
    await expect(cellHead('price')).toHaveClass(/ag-header-cell-moving/);
    await screen(page, 'grid-columns-dragging');
    await page.keyboard.press('Escape');
    await page.mouse.up();
    await expect.poll(() => gridOrder(grid)).toEqual(start);
    expect(await keptOrder(page)).toBe('');
    // Carried up out of the grid and let go there: still shown, where it was seen.
    await holdsStill(cellHead('discount'));
    const discount = await boxOf(cellHead('discount'));
    await page.mouse.move(discount.x + discount.width / 2, discount.y + discount.height / 2);
    await page.mouse.down();
    await page.mouse.move(discount.x + discount.width / 2, discount.y - 260, { steps: 24 });
    await page.mouse.up();
    await expect(cellHead('discount')).toBeVisible();
    await expect.poll(() => gridOrder(grid)).toEqual(start);
    // Carried before Quantity and let go: there, said and kept.
    await holdsStill(cellHead('price'));
    await carry(page, at, qty.x + 10);
    await page.mouse.up();
    await expect.poll(() => gridOrder(grid)).toEqual(start.map((one) => (one === 'qty' ? 'price' : one === 'price' ? 'qty' : one)));
    await expect(grid.locator('.fd-sr-only[role="status"]')).toHaveText(`Unit price moved to place ${start.indexOf('qty') + 1} of ${start.length}`);
    await expect.poll(() => keptOrder(page)).toContain('price qty');
    expect(problems).toEqual([]);
  });
});
