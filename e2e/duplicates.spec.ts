import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { expectNoSidewaysScroll, node, open, screen } from './support';
import { axeFindings } from './a11y-support';

/**
 * Possible duplicates and Merge, as a person meets them on a customer's card (its page says `"duplicates": { "fields":
 * ["name", "phone", "email", "vat"] }`, and names its records customers, its labels small inside a sentence): a new
 * customer typed with a phone or an email already kept is said, under the box, a moment after the typing rests — "A
 * customer with this phone already exists: Nile Traders" — with Open it (asked about first, then the customer kept in
 * its place), "It's a new customer", and, on a saved customer, Merge…: the two side by side, a value picked for each
 * field, and one of them kept. Save is never in the way.
 */

const WIDE = { width: 1280, height: 900 };
const PHONE = { width: 390, height: 844 };
const stored = (page: Page, id: number) => page.evaluate((i) => (window as any).fieldiaDemo.dataSource.records['partner'][i] ?? null, id);
const shownId = (page: Page) => page.evaluate(() => (window as any).fieldiaDemo.handle.form.getState().recordId);
const note = (page: Page, id: string) => node(page, id).locator('.fd-duplicates');
const title = (page: Page) => page.locator('[data-node="#title"] textarea');
const discard = (page: Page) => page.getByRole('alertdialog').getByRole('button', { name: 'Discard' });
const merge = (page: Page) => page.getByRole('dialog', { name: 'Merge two customers' });

let problems: string[] = [];
test.afterEach(() => expect(problems).toEqual([]));

test.describe('a customer typed twice', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(WIDE);
    ({ problems } = await open(page, 'plain', 'page=customer-card&record=new&skin=underline'));
  });

  test('a phone already kept is said under its box once the typing rests, and Save still saves', async ({ page }) => {
    await title(page).fill('Nile Trading House');
    const phone = node(page, 'f-phone').locator('.fd-phone-input');
    await phone.click();
    await phone.pressSequentially('02 2345 6789');
    await phone.press('Tab');
    await expect(note(page, 'f-phone')).toHaveText(/A customer with this phone already exists: Nile Traders/);
    await expect(note(page, 'f-phone').getByRole('button')).toHaveText(['Open it', 'It’s a new customer']);
    // Said once, politely, to a screen reader.
    await expect(page.locator('.fd-duplicates-said')).toHaveText('A customer with this phone already exists: Nile Traders');
    await screen(page, 'duplicates-phone');
    // A duplicate is said; Save saves. Saved, it may be merged.
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect.poll(() => shownId(page)).toBe(41);
    await expect.poll(async () => (await stored(page, 41))?.phone).toBe('+20223456789');
    await expect(note(page, 'f-phone').getByRole('button')).toHaveText(['Open it', 'It’s a new customer', 'Merge…']);
  });

  test('Open it asks before what is typed goes, then shows the customer kept', async ({ page }) => {
    const email = node(page, 'f-email').locator('input');
    await email.fill('orders@deltafoods.example');
    await expect(note(page, 'f-email')).toHaveText(/A customer with this email already exists: Delta Foods/);
    await note(page, 'f-email').getByRole('button', { name: 'Open it' }).click();
    // Cancel keeps the person with their work.
    await page.getByRole('alertdialog').getByRole('button', { name: 'Cancel' }).click();
    await expect(email).toHaveValue('orders@deltafoods.example');
    await note(page, 'f-email').getByRole('button', { name: 'Open it' }).click();
    await discard(page).click();
    await expect(title(page)).toHaveValue('Delta Foods');
    expect(await shownId(page)).toBe(23);
  });

  test('It’s a new customer lets one go, and a name like one kept is said as like it', async ({ page }) => {
    await node(page, 'f-email').locator('input').fill('orders@niletraders.example');
    const rows = note(page, 'f-email').locator('.fd-duplicate');
    await expect(rows).toHaveCount(2);
    await expect(rows.locator('.fd-duplicate-words')).toHaveText(['A customer with this email already exists: Nile Traders', 'A customer with this email already exists: Nile Traders Co.']);
    await rows.first().getByRole('button', { name: 'It’s a new customer' }).click();
    await expect(rows).toHaveCount(1);
    await expect(rows.first().getByRole('button', { name: 'Open it' })).toBeFocused();
    await title(page).fill('Nile Trader');
    await expect(note(page, 'f-email').locator('.fd-duplicate-words')).toHaveText(['A customer with this email and a name like this already exists: Nile Traders', 'A customer with this email and a name like this already exists: Nile Traders Co.']);
    await screen(page, 'duplicates-name');
  });

  test('Merge shows the two side by side, a value picked for each field, and keeps one', async ({ page }) => {
    await node(page, 'f-email').locator('input').fill('orders@niletraders.example');
    await note(page, 'f-email').locator('.fd-duplicate').nth(1).getByRole('button', { name: 'Open it' }).click();
    await discard(page).click();
    await expect(title(page)).toHaveValue('Nile Traders Co.');
    // Opened, it is asked of at once: like Nile Traders, by its email and its name.
    await expect(note(page, 'f-email')).toHaveText(/A customer with this email and a name like this already exists: Nile Traders/);
    await note(page, 'f-email').getByRole('button', { name: 'Merge…' }).click();
    const screenBox = merge(page);
    await expect(screenBox).toBeVisible();
    await expect(screenBox.locator('thead th')).toHaveText(['Keep Nile Traders Co.This customer', 'Keep Nile Traders']);
    // Nile Traders kept: its values picked, but where it holds nothing — a tax id, a website, a city — Co.'s.
    // Its email written another way is a row of its own: which writing to keep is the person's.
    await expect(screenBox.locator('tbody th')).toHaveText(['Name', 'Phone', 'Email', 'Tax ID', 'Website', 'City']);
    await expect(screenBox.getByRole('radio', { name: 'Tax ID 312-645-987' })).toBeChecked();
    await expect(screenBox.getByRole('radio', { name: 'Phone +20 2 2345 6789' })).toBeChecked();
    await expect(screenBox.locator('.fd-merge-same')).toHaveText('The same in both: country.');
    await expect(screenBox.locator('.fd-merge-what')).toHaveText(/Nile Traders keeps the values picked and the rest of its own\. The messages, activities and links of Nile Traders Co\. move to Nile Traders, and Nile Traders Co\. is taken away\./);
    await expect(screenBox.getByRole('radio', { name: 'Keep Nile Traders', exact: true })).toBeFocused();
    await screen(page, 'duplicates-merge', { viewport: true });
    // Its name as Co. writes it, by a press; Merge.
    await screenBox.getByRole('radio', { name: 'Name Nile Traders Co.' }).click();
    await expect(screenBox.getByRole('radio', { name: 'Name Nile Traders Co.' })).toBeChecked();
    await expect(screenBox.locator('.fd-merge-what')).toHaveText(/^Nile Traders keeps the values picked/);
    await screenBox.getByRole('button', { name: 'Merge', exact: true }).click();
    await expect(screenBox).toBeHidden();
    await expect(page.locator('.fd-say')).toHaveText(/^Merged into Nile Traders Co\.(?!\.)/);
    await expect.poll(() => shownId(page)).toBe(1);
    await expect(title(page)).toHaveValue('Nile Traders Co.');
    await expect(node(page, 'f-vat').locator('input')).toHaveValue('312-645-987');
    expect(await stored(page, 40)).toBeNull();
    await expect(page.locator('.fd-duplicates')).toHaveCount(0);
    await screen(page, 'duplicates-merged');
  });

  test('Escape and Cancel leave both as they were, the focus back on Merge…', async ({ page }) => {
    await node(page, 'f-email').locator('input').fill('orders@niletraders.example');
    await note(page, 'f-email').locator('.fd-duplicate').nth(1).getByRole('button', { name: 'Open it' }).click();
    await discard(page).click();
    const ways = note(page, 'f-email').getByRole('button', { name: 'Merge…' });
    await ways.click();
    await expect(merge(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(merge(page)).toBeHidden();
    await expect(ways).toBeFocused();
    await ways.press('Enter');
    await merge(page).getByRole('button', { name: 'Cancel' }).click();
    await expect(merge(page)).toBeHidden();
    expect(await stored(page, 40)).not.toBeNull();
    expect(await shownId(page)).toBe(40);
  });
});

test.describe('on a phone', () => {
  test('the note and the merge fit, nothing scrolling sideways', async ({ page }) => {
    await page.setViewportSize(PHONE);
    ({ problems } = await open(page, 'plain', 'page=customer-card&record=40&skin=underline'));
    await expect(note(page, 'f-email')).toBeVisible();
    await expectNoSidewaysScroll(page);
    await screen(page, 'duplicates-phone-note', { viewport: true });
    await note(page, 'f-email').getByRole('button', { name: 'Merge…' }).click();
    await expect(merge(page)).toBeVisible();
    await expectNoSidewaysScroll(page);
    const box = await merge(page).boundingBox();
    expect(box && box.x >= 0 && box.x + box.width <= PHONE.width).toBe(true);
    await screen(page, 'duplicates-phone-merge', { viewport: true });
  });
});

test.describe('in the dark', () => {
  test('the note and the merge keep to the page’s dark tokens', async ({ page }) => {
    await page.setViewportSize(WIDE);
    ({ problems } = await open(page, 'plain', 'page=customer-card&record=40&skin=underline&scheme=dark'));
    await expect(note(page, 'f-email')).toBeVisible();
    // The note's words stand off its ground: light words on a dark warning, never dark on dark.
    const [words, ground] = await note(page, 'f-email').evaluate((box) => [getComputedStyle(box).color, getComputedStyle(box).backgroundColor]);
    expect(words).not.toBe(ground);
    await screen(page, 'duplicates-dark-note', { viewport: true });
    await note(page, 'f-email').getByRole('button', { name: 'Merge…' }).click();
    await expect(merge(page)).toBeVisible();
    await screen(page, 'duplicates-dark-merge', { viewport: true });
  });
});

test.describe('read by a screen reader', () => {
  for (const scheme of ['light', 'dark']) {
    test(`the note and the merge's screen pass axe, ${scheme}`, async ({ page }) => {
      await page.setViewportSize(WIDE);
      ({ problems } = await open(page, 'plain', `page=customer-card&record=40&skin=underline&scheme=${scheme}`));
      await expect(note(page, 'f-email')).toBeVisible();
      expect(await axeFindings(page, 'the note')).toEqual([]);
      await note(page, 'f-email').getByRole('button', { name: 'Merge…' }).click();
      await expect(merge(page)).toBeVisible();
      expect(await axeFindings(page, "the merge's screen")).toEqual([]);
    });
  }
});
