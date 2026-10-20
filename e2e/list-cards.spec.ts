import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { expectNoSidewaysScroll, open, screen } from './support';

/**
 * Record lists people read anywhere and shape themselves (the plain demo):
 * the contacts' columns shown, hidden, ordered and sized from the Columns
 * menu and a header's edge, kept for the person, the first column in view as
 * the table scrolls sideways; homes for sale as a gallery, each card its row —
 * ticked, its own button pressed, under its Group By heading; and, on a phone,
 * contacts and invoices as cards, an invoice's amount and status on its card
 * and the list's total in sight (the owner's walk of 0.24, finding 7).
 */

const PHONE = { width: 390, height: 844 };
const rows = (page: Page) => page.locator('.fd-list-table tbody tr.fd-list-row');
/** The headers a person sees, in order. */
const heads = (page: Page) => page.locator('.fd-list-table thead th[data-col]:visible');
const columnsButton = (page: Page) => page.getByRole('button', { name: 'Columns' });
const columnsMenu = (page: Page) => page.getByRole('dialog', { name: 'Columns' });

async function contacts(page: Page) {
  const opened = await open(page, 'plain', 'page=contacts&skin=underline');
  await expect(rows(page)).toHaveCount(10);
  return opened;
}

test.describe('columns people shape', () => {
  test('shows, hides and orders the contacts’ columns from the Columns menu, kept for the next visit, and Reset puts back the page’s', async ({ page }) => {
    const { problems } = await contacts(page);
    await expect(heads(page)).toHaveText(['Name', 'Company', 'Country', 'Status', 'Owner', 'Last order', 'Lifetime value', 'Newsletter']);
    await columnsButton(page).click();
    await expect(columnsMenu(page)).toBeVisible();
    await expect(columnsButton(page)).toHaveAttribute('aria-expanded', 'true');
    // The focus on the first box a person may tick.
    await expect(columnsMenu(page).getByLabel('Company', { exact: true })).toBeFocused();
    await columnsMenu(page).getByLabel('Phone', { exact: true }).check();
    await expect(heads(page)).toHaveText(['Name', 'Company', 'Country', 'Status', 'Owner', 'Last order', 'Lifetime value', 'Newsletter', 'Phone']);
    // Phone up beside Name, with Alt and the arrow, as a person at the keyboard does.
    await columnsMenu(page).getByLabel('Phone', { exact: true }).focus();
    for (let i = 0; i < 7; i++) await page.keyboard.press('Alt+ArrowUp');
    await expect(columnsMenu(page).getByLabel('Phone', { exact: true })).toBeFocused();
    await expect(heads(page)).toHaveText(['Name', 'Phone', 'Company', 'Country', 'Status', 'Owner', 'Last order', 'Lifetime value', 'Newsletter']);
    // Its number written as people read it, a call and a WhatsApp link beside it.
    const phone = rows(page).first().locator('td[data-col="phone"]');
    await expect(phone.getByRole('link', { name: /^Call \+/ })).toHaveAttribute('href', /^tel:\+\d+$/);
    await expect(phone.getByRole('link', { name: /on WhatsApp$/ })).toHaveAttribute('href', /^https:\/\/wa\.me\/\d+$/);
    await columnsMenu(page).getByLabel('Country', { exact: true }).uncheck();
    await expect(heads(page)).toHaveText(['Name', 'Phone', 'Company', 'Status', 'Owner', 'Last order', 'Lifetime value', 'Newsletter']);
    await screen(page, 'list-columns-menu', { viewport: true });
    await page.keyboard.press('Escape');
    await expect(columnsMenu(page)).toBeHidden();
    await expect(columnsButton(page)).toBeFocused();
    // Kept for the person: the next visit opens as they left it.
    await page.reload();
    await expect(rows(page)).toHaveCount(10);
    await expect(heads(page)).toHaveText(['Name', 'Phone', 'Company', 'Status', 'Owner', 'Last order', 'Lifetime value', 'Newsletter']);
    await columnsButton(page).click();
    await columnsMenu(page).getByRole('button', { name: 'Reset columns' }).click();
    await expect(heads(page)).toHaveText(['Name', 'Company', 'Country', 'Status', 'Owner', 'Last order', 'Lifetime value', 'Newsletter']);
    await expect(columnsMenu(page)).toBeHidden();
    expect(problems).toEqual([]);
  });

  test('bolds the contacts owned by the person signed in, Mona Adel, and no other', async ({ page }) => {
    const { problems } = await contacts(page);
    const owners = await rows(page).locator('td[data-col="owner_id"]').allTextContents();
    expect(owners.filter((owner) => owner === 'Mona Adel').length, 'the first page holds some of hers').toBeGreaterThan(0);
    for (const [i, owner] of owners.entries()) {
      if (owner === 'Mona Adel') await expect(rows(page).nth(i)).toHaveAttribute('data-bold', '');
      else await expect(rows(page).nth(i)).not.toHaveAttribute('data-bold', /.*/);
    }
    expect(await rows(page).filter({ hasText: 'Mona Adel' }).first().locator('td[data-col="name"]').evaluate((cell) => getComputedStyle(cell).fontWeight)).toBe('600');
    // What the bold means, said over the rows (the walk of 0.25: nothing said so) and read out as a key.
    const key = page.getByRole('list', { name: 'Key to the rows' });
    await expect(key).toBeVisible();
    await expect(key.getByRole('listitem')).toHaveText(['AaYour own contacts']);
    expect(await key.locator('.fd-list-key-mark').evaluate((mark) => Number(getComputedStyle(mark).fontWeight))).toBeGreaterThanOrEqual(700);
    await screen(page, 'list-rows-key', { viewport: true });
    expect(problems).toEqual([]);
  });

  test('a list whose rows’ looks say no words has no key over them, as 0.25 drew it', async ({ page }) => {
    const { problems } = await open(page, 'plain', 'page=customer-account&record=1&skin=underline');
    await expect(page.locator('[data-node="invoices"] .fd-list-row').first()).toBeVisible();
    await expect(page.locator('.fd-list-key')).toHaveCount(0);
    expect(problems).toEqual([]);
  });

  test('sizes a column by dragging its header’s edge at a hand’s speed, and by its grip’s arrow keys, kept for the next visit', async ({ page }) => {
    const { problems } = await contacts(page);
    const company = page.locator('.fd-list-table thead th[data-col="company"]');
    const before = (await company.boundingBox())!;
    const grip = company.locator('.fd-list-grip');
    const at = (await grip.boundingBox())!;
    await page.mouse.move(at.x + at.width / 2, at.y + at.height / 2);
    await page.mouse.down();
    // A hand's drag: a few dozen steps, not one jump.
    await page.mouse.move(at.x + at.width / 2 + 120, at.y + at.height / 2, { steps: 24 });
    await page.mouse.up();
    await expect.poll(async () => Math.round((await company.boundingBox())!.width)).toBeGreaterThan(Math.round(before.width) + 100);
    const dragged = Math.round((await company.boundingBox())!.width);
    // Its cells are as wide as its header.
    expect(Math.round((await rows(page).first().locator('td[data-col="company"]').boundingBox())!.width)).toBe(dragged);
    // The header's press is not a sort when its edge is let go.
    await expect(company).not.toHaveAttribute('aria-sort', /./);
    await grip.focus();
    await expect(grip).toHaveAttribute('aria-valuenow', String(dragged));
    await page.keyboard.press('ArrowLeft');
    await expect.poll(async () => Math.round((await company.boundingBox())!.width)).toBe(dragged - 16);
    await page.reload();
    await expect(rows(page)).toHaveCount(10);
    await expect.poll(async () => Math.round((await page.locator('.fd-list-table thead th[data-col="company"]').boundingBox())!.width)).toBe(dragged - 16);
    expect(problems).toEqual([]);
  });

  test('keeps the names in view, and the header over the rows, as the table scrolls sideways', async ({ page }) => {
    await page.setViewportSize({ width: 820, height: 700 });
    const { problems } = await contacts(page);
    await columnsButton(page).click();
    await columnsMenu(page).getByLabel('Phone', { exact: true }).check();
    await columnsMenu(page).getByLabel('Email', { exact: true }).check();
    await page.keyboard.press('Escape');
    const scroll = page.locator('.fd-list-scroll');
    const name = rows(page).first().locator('td[data-col="name"]');
    const left = (await name.boundingBox())!.x;
    await scroll.evaluate((element) => element.scrollBy({ left: 600 }));
    await expect.poll(() => scroll.evaluate((element) => element.scrollLeft)).toBeGreaterThan(300);
    expect((await name.boundingBox())!.x).toBeCloseTo(left, 0);
    await expect(name).toBeInViewport();
    await expect(scroll).toHaveAttribute('data-scrolled', '');
    // The page itself never scrolls sideways: the table does, in its card.
    await expectNoSidewaysScroll(page);
    await screen(page, 'list-columns-scrolled', { viewport: true });
    expect(problems).toEqual([]);
  });
});

test.describe('homes as a gallery', () => {
  const cards = (page: Page) => page.locator('.fd-list[data-as="gallery"] tbody tr.fd-list-row');

  test('opens on its cards: each its photo, its title, its offer as a pill, its price leading, a viewing booked from it alone', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const { problems, demo } = await open(page, 'plain', 'page=homes-gallery&skin=underline');
    await expect(cards(page)).toHaveCount(12);
    await expect(page.getByRole('group', { name: 'Show as' }).getByRole('button', { name: 'Gallery' })).toHaveAttribute('aria-pressed', 'true');
    const first = cards(page).first();
    await expect(first.locator('.fd-list-card-photo img')).toBeVisible();
    await expect(first.locator('.fd-list-card-title')).toHaveText(/-bedroom .+ in /);
    await expect(first.locator('.fd-list-card-head .fd-value-badge')).toHaveText(/^For (sale|rent)$/);
    await expect(first.locator('.fd-list-card-lines dd').first()).toHaveText(/^[\d,]+\s(EGP|USD)(\/month)?$/);
    // Four cards to a line on a wide screen, each as tall as the next.
    const boxes = await Promise.all([0, 1, 2, 3, 4].map(async (i) => (await cards(page).nth(i).boundingBox())!));
    expect(new Set(boxes.slice(0, 4).map((box) => Math.round(box.y))).size).toBe(1);
    expect(boxes[4].y).toBeGreaterThan(boxes[0].y + boxes[0].height);
    const id = await cards(page).nth(1).getAttribute('data-id');
    await cards(page).nth(1).getByRole('button', { name: 'Book a viewing' }).click();
    await expect.poll(() => demo<{ action: string; recordIds?: unknown[] }[]>('requests').then((requests) => requests.at(-1))).toEqual(expect.objectContaining({ action: 'book_viewing', recordIds: [Number(id)] }));
    // The press was the button's: no home opened. What the app was given, said: the demo has no app to book it.
    await expect(page).toHaveURL(/page=homes-gallery/);
    const home = await cards(page).nth(1).locator('.fd-list-card-title').textContent();
    await expect(page.locator('.fd-say')).toHaveText([`The app was asked to book a viewing for ${home}.×`]);
    await screen(page, 'list-gallery', { viewport: true });
    expect(problems).toEqual([]);
  });

  test('ticks cards as rows are ticked, the list’s buttons for them, and moves between cards with the arrow keys', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const { problems, demo } = await open(page, 'plain', 'page=homes-gallery&skin=underline');
    await expect(cards(page)).toHaveCount(12);
    const ids = await Promise.all([0, 2].map((i) => cards(page).nth(i).getAttribute('data-id')));
    for (const i of [0, 2]) await cards(page).nth(i).getByRole('checkbox').check();
    await expect(page.locator('.fd-list-count')).toHaveText('2 selected');
    await expect(cards(page).nth(0)).toHaveAttribute('aria-selected', 'true');
    await page.getByRole('button', { name: 'Share with a buyer' }).click();
    await expect.poll(() => demo<{ action: string; recordIds?: unknown[] }[]>('requests').then((requests) => requests.at(-1)?.recordIds)).toEqual(ids.map(Number));
    const homes = await Promise.all([0, 2].map((i) => cards(page).nth(i).locator('.fd-list-card-title').textContent()));
    await expect(page.locator('.fd-say')).toHaveText([`The app was asked to share 2 properties with a buyer: ${homes[0]} and ${homes[1]}.×`]);
    // The keys: along the line, and to the card under.
    await cards(page).nth(0).focus();
    await page.keyboard.press('ArrowRight');
    await expect(cards(page).nth(1)).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(cards(page).nth(5)).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await expect(cards(page).nth(1)).toBeFocused();
    expect(problems).toEqual([]);
  });

  test('says what the app was asked as a person says it: one home, or several counted by the page’s word for them', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const { problems } = await open(page, 'plain', 'page=homes-gallery&skin=underline');
    await expect(cards(page)).toHaveCount(12);
    const said = page.locator('.fd-say');
    const title = (i: number) => cards(page).nth(i).locator('.fd-list-card-title').textContent();
    // One home: named where the button's words put it — shared with a buyer, never "share with a buyer for …".
    await cards(page).nth(0).getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Share with a buyer' }).click();
    await expect(said).toHaveText([`The app was asked to share ${await title(0)} with a buyer.×`]);
    await said.getByRole('button', { name: 'Dismiss' }).click();
    await expect(said).toHaveCount(0);
    // Every home on the page: counted in the page's own word for them, two named and the rest counted.
    await page.getByText('Select all', { exact: true }).click();
    await expect(page.locator('.fd-list-count')).toHaveText('12 selected');
    await page.getByRole('button', { name: 'Share with a buyer' }).click();
    await expect(said).toHaveText([`The app was asked to share 12 properties with a buyer: ${await title(0)}, ${await title(1)} and 10 more.×`]);
    await screen(page, 'list-gallery-shared-many', { viewport: true });
    expect(problems).toEqual([]);
  });

  test('groups its cards under Group By headings, and is a table a press away', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const { problems } = await open(page, 'plain', 'page=homes-gallery&skin=underline');
    await expect(cards(page)).toHaveCount(12);
    await page.locator('.fd-search-toggle').click();
    await page.getByLabel('Group By').getByRole('button', { name: 'District' }).click();
    await page.keyboard.press('Escape');
    const dokki = page.locator('.fd-group-toggle', { hasText: 'Dokki' });
    await dokki.click();
    await expect(cards(page).first()).toBeVisible();
    // The heading across the whole line of cards.
    const heading = (await page.locator('.fd-list-group').first().boundingBox())!;
    const list = (await page.locator('.fd-list-table tbody').boundingBox())!;
    expect(Math.round(heading.width)).toBe(Math.round(list.width));
    await screen(page, 'list-gallery-grouped', { viewport: true });
    await page.getByRole('group', { name: 'Show as' }).getByRole('button', { name: 'List' }).click();
    await expect(page.locator('.fd-list')).not.toHaveAttribute('data-as', /./);
    await expect(page.locator('.fd-list-table thead th[data-col="photo"]')).toBeVisible();
    await expect(rows(page).first().locator('td[data-col="photo"] img.fd-list-thumb')).toBeVisible();
    expect(problems).toEqual([]);
  });
});

test.describe('lists on a phone', () => {
  test.use({ viewport: PHONE });

  test('the contacts are cards: their initials, their status as a pill, a phone to call, ticked as rows are, nothing off the screen', async ({ page }) => {
    const { problems } = await contacts(page);
    await expect(page.locator('.fd-list')).toHaveAttribute('data-as', 'cards');
    const card = rows(page).first();
    await expect(card.locator('.fd-list-card-title')).toBeVisible();
    await expect(card.locator('.fd-list-card-photo[data-empty] .fd-list-card-initials')).toHaveAttribute('data-initials', /^\p{Lu}\p{Lu}$/u);
    await expect(card.locator('.fd-list-card-head .fd-value-badge')).toBeVisible();
    // Her own contacts bold on their cards too, as in the table.
    const hers = rows(page).filter({ has: page.locator('.fd-list-card dd', { hasText: /^Mona Adel$/ }) }).first();
    await expect(hers).toHaveAttribute('data-bold', '');
    expect(await hers.locator('.fd-list-card-title').evaluate((title) => Number(getComputedStyle(title).fontWeight))).toBeGreaterThanOrEqual(700);
    // The table's columns are not drawn; its card is, in full, inside the screen.
    await expect(card.locator('td[data-col="company"]')).toBeHidden();
    const box = (await card.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(PHONE.width);
    await expectNoSidewaysScroll(page);
    const call = page.locator('.fd-list-card').getByRole('link', { name: /^Call \+/ }).first();
    await expect(call).toBeInViewport();
    await expect(call).toHaveAttribute('href', /^tel:\+\d+$/);
    await page.getByText('Select all', { exact: true }).click();
    await expect(page.locator('.fd-list-count')).toHaveText('10 selected');
    await expect(page.getByRole('button', { name: 'Select all 1,284 contacts that match' })).toBeVisible();
    await screen(page, 'list-cards-phone', { viewport: true });
    expect(problems).toEqual([]);
  });

  for (const [skin, scheme] of [
    ['underline', 'dark'],
    ['outlined', 'light'],
    ['quiet', 'dark'],
  ] as const) {
    test(`${skin}, ${scheme}: an amount, a day and a phone number on a card never break inside; the call links wrap as one (the walk of 0.25)`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      const { problems } = await open(page, 'plain', `page=contacts&skin=${skin}&scheme=${scheme}`);
      await expect(page.locator('.fd-list')).toHaveAttribute('data-as', 'cards');
      // Every whole value on one line, the bold card's "E£ 473,734.00" too (0.25: "E£ 473,734." over "00").
      const values = page.locator('.fd-list-card-lines > div[data-whole] dd > bdi');
      await expect(values.first()).toBeVisible();
      const broken = await values.evaluateAll((all) =>
        all.filter((value) => value.textContent?.trim()).filter((value) => { const lines = new Set([...value.getClientRects()].map((rect) => Math.round(rect.top))); return lines.size > 1; }).map((value) => value.textContent)
      );
      expect(broken).toEqual([]);
      const amount = page.locator('.fd-list-card-lines [data-field="lifetime_value"] dd > bdi', { hasText: '473,734.00' }).first();
      await expect(amount).toBeVisible();
      // The links together: both on one line, never one over the other.
      const links = page.locator('.fd-list-card .fd-list-links').first();
      const tops = await links.locator('a').evaluateAll((all) => all.map((a) => Math.round(a.getBoundingClientRect().top)));
      expect(new Set(tops).size).toBe(1);
      await expectNoSidewaysScroll(page);
      await amount.scrollIntoViewIfNeeded();
      await screen(page, `list-cards-whole-${skin}-${scheme}`, { viewport: true });
      expect(problems).toEqual([]);
    });
  }

  test('a lead’s card gives each field of a line its own label beside its own value, and keeps a name whole', async ({ page }) => {
    // The owner's walk of 0.27: "Next follow-up · Agent 30 Sept 2026 · Mona / Adel".
    const { problems } = await open(page, 'plain', 'page=leads-queue&skin=underline&now=2026-10-14T09:40');
    const card = page.locator('.fd-list-card').first();
    await expect(card).toBeVisible();
    const line = card.locator('.fd-list-card-lines > div').first();
    const pairs = line.locator('dl > div');
    await expect(pairs).toHaveCount(2);
    await expect(pairs.nth(0).locator('dt')).toHaveText('Next follow-up');
    await expect(pairs.nth(0).locator('dd')).toHaveText(/^\d{1,2} \w+ 2026$/);
    await expect(pairs.nth(1).locator('dt')).toHaveText('Agent');
    await expect(pairs.nth(1).locator('dd')).toHaveText('Mona Adel');
    // The agent's name on one line: it moved whole under the follow-up rather than break, as it fits there.
    for (const dd of await page.locator('.fd-list-card-lines dl > div:has(dt:text-is("Agent")) dd').all()) {
      const lines = await dd.evaluate((box) => Math.round(box.getBoundingClientRect().height / parseFloat(getComputedStyle(box).lineHeight || '20')));
      expect(lines, await dd.textContent() ?? '').toBe(1);
    }
    await expectNoSidewaysScroll(page);
    await screen(page, 'list-cards-leads-phone', { viewport: true });
    expect(problems).toEqual([]);
  });

  test('an invoice’s card shows its amount and its status, and the list’s total is in sight from the first screen as it scrolls', async ({ page }) => {
    const { problems } = await open(page, 'plain', 'page=invoices&skin=underline');
    await expect(rows(page)).toHaveCount(10);
    await expect(page.locator('.fd-list')).toHaveAttribute('data-as', 'cards');
    const card = rows(page).first();
    await expect(card.locator('.fd-list-card-head .fd-value-badge')).toHaveText(/^(Draft|Sent|Paid)$/);
    const amount = card.locator('.fd-list-card-lines > div[data-field="amount"] dd');
    await expect(amount).toHaveText(/^(EGP|USD)\s[\d,]+\.\d\d$/);
    await expect(amount).toBeInViewport();
    // The total, with what it adds up, on the first screen: never "Total" with nothing beside it.
    const total = page.locator('.fd-list-totals tr[data-total="all"]');
    await expect(total).toBeInViewport();
    await expect(total).toContainText('Total');
    await expect(total.locator('td[data-field="amount"]')).toHaveText(/^EGP\s[\d,]+\.\d\d$/);
    // Said with what it adds up, as a card's line is (Firefox tells the rule, the others its words).
    await expect(total.locator('td[data-field="amount"]')).toHaveAttribute('data-label', 'Amount');
    expect(await total.locator('td[data-field="amount"]').evaluate((cell) => getComputedStyle(cell, '::before').content)).toMatch(/^("Amount"|attr\(data-label\))$/);
    await screen(page, 'list-cards-invoices-phone', { viewport: true });
    // Still in sight under the cards as they scroll.
    await page.mouse.move(195, 500);
    await page.mouse.wheel(0, 1200);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(600);
    await expect(total).toBeInViewport();
    await expectNoSidewaysScroll(page);
    await screen(page, 'list-cards-invoices-phone-scrolled', { viewport: true });
    expect(problems).toEqual([]);
  });

  test('a total that cannot be said honestly says why in words on a phone', async ({ page }) => {
    const { problems } = await open(page, 'plain', 'page=invoices&skin=underline');
    await expect(rows(page)).toHaveCount(10);
    // Every invoice, in pounds and in dollars: no honest sum of the two.
    await page.getByRole('button', { name: 'Remove This year' }).click();
    const amount = page.locator('.fd-list-totals tr[data-total="all"] td[data-field="amount"]');
    await expect(amount).toHaveAttribute('title', 'In more than one currency: no total');
    await expect(amount).toBeVisible();
    // In sight after its name, where a pointer cannot point at it: the table's words, the same on cards and headings.
    await expect(amount).toHaveText('Several currencies');
    await expect(amount.locator('.fd-list-total-mixed')).toBeInViewport();
    await screen(page, 'list-cards-invoices-mixed-phone', { viewport: true });
    expect(problems).toEqual([]);
  });
});
