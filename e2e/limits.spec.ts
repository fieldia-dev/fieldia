import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { expectNoSidewaysScroll, node, open, screen } from './support';

/**
 * Opening, closing and limiting a form, as a person meets them on the founders' evening's sign-up (its page's `limits`:
 * open and close dates on Cairo's clock, 200 responses at most, one from each person; places for each session and
 * extra): each option's places left beside its words, a full one shown and refused when picked; a place someone else
 * took meanwhile said as the answers go, nothing sent; one response from each person; and a form not open yet, or
 * closed, saying so in place of its questions — before anything is typed.
 */

const WIDE = { width: 1280, height: 900 };
const PHONE = { width: 390, height: 844 };
const sent = (page: Page) => page.evaluate(() => (window as any).fieldiaDemo.dataSource.responses.length as number);
const session = (page: Page) => node(page, 'f-session');
const choice = (page: Page, name: RegExp) => session(page).getByRole('radio', { name });

let problems: string[] = [];
test.afterEach(() => expect(problems).toEqual([]));

for (const variant of ['plain', 'react']) {
  test.describe(`${variant === 'plain' ? '' : `${variant}: `}an event’s sign-up with places`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize(WIDE);
      ({ problems } = await open(page, variant, 'page=event-signup&skin=outlined'));
    });

    test('each option says its places left, a full one shown and refused when picked, said under the question', async ({ page }) => {
      await expect(session(page).locator('.fd-seats:not([hidden])')).toHaveText(['2 left', 'Full', '26 left']);
      await expect(node(page, 'f-extras').locator('.fd-seats:not([hidden])')).toHaveText(['1 left', 'Full']);
      // Shown, never turned off: picked, it is refused in words, and the choice stays as it was.
      await expect(choice(page, /Afternoon workshop/)).toBeEnabled();
      await choice(page, /Morning workshop/).check();
      await choice(page, /Afternoon workshop/).click();
      await expect(choice(page, /Morning workshop/)).toBeChecked();
      await expect(choice(page, /Afternoon workshop/)).not.toBeChecked();
      await expect(session(page)).toContainText('Afternoon workshop: selling off-plan (14:00) is full');
      await screen(page, 'limits-places');
    });

    test('a place someone else took meanwhile is said as the answers go, and nothing is sent', async ({ page }) => {
      await node(page, 'f-name').locator('input').fill('Mona Adel');
      await node(page, 'f-email').locator('input').fill('mona.adel@example.com');
      await choice(page, /Morning workshop/).check();
      await page.getByRole('button', { name: 'Two people sign up for the morning workshop' }).click();
      await page.getByRole('button', { name: 'Submit', exact: true }).click();
      await expect(session(page)).toContainText('Morning workshop: pricing a launch (10:00) is full now: choose another');
      await expect(session(page).locator('.fd-seats').first()).toHaveText('Full');
      expect(await sent(page)).toBe(0);
      await screen(page, 'limits-filled-meanwhile');
      // Another session: sent, Thank you, and no other response offered — one from each person.
      await choice(page, /Evening talk/).check();
      await page.getByRole('button', { name: 'Submit', exact: true }).click();
      await expect(page.locator('.fd-done')).toContainText('Thank you');
      expect(await sent(page)).toBe(1);
      await expect(page.getByRole('button', { name: 'Submit another response' })).toBeHidden();
    });
  });
}

test.describe('a sign-up not open yet, or closed', () => {
  test('before it opens: when, on Cairo’s clock, and the page’s words, in place of its questions', async ({ page }) => {
    await page.setViewportSize(WIDE);
    ({ problems } = await open(page, 'plain', 'page=event-signup&skin=outlined&now=2020-01-01T08:00:00Z'));
    const closed = page.locator('.fd-closed');
    await expect(closed).toBeVisible();
    await expect(closed.locator('.fd-closed-title')).toHaveText(/^This form opens on \d+ \w+ 20\d\d, 09:00.*\.$/);
    await expect(closed.locator('.fd-closed-message')).toHaveText('Missed it? Write to events@dawarly.example and we will tell you about the next one.');
    // Under the form's own title, in place of its questions.
    await expect(page.locator('.fd-page-title')).toHaveText('Founders’ evening: sign up');
    await expect(node(page, 'f-name')).toBeHidden();
    await expect(page.getByRole('radio')).toHaveCount(0);
    await screen(page, 'limits-not-open');
  });

  test('after it closed, on a phone too', async ({ page }) => {
    await page.setViewportSize(PHONE);
    ({ problems } = await open(page, 'plain', 'page=event-signup&skin=outlined&now=2099-01-01T08:00:00Z'));
    await expect(page.locator('.fd-closed-title')).toHaveText(/^This form closed on .+18:00/);
    await expect(node(page, 'f-session')).toBeHidden();
    await expect(page.getByRole('button', { name: 'Submit', exact: true })).toBeHidden();
    await expectNoSidewaysScroll(page);
    await screen(page, 'limits-closed-phone');
  });
});
