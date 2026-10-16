import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { node, open, screen } from './support';

/**
 * The first tap on Submit counts. A box left for a press elsewhere shows its
 * own problem once that press has ended, never as the finger comes down: on
 * a phone, "mona@" left for Submit would otherwise say "Enter an email
 * address" at once, Submit would drop by the message's height before the
 * finger lifted, and the tap would end on nothing — no check, no word. Now
 * the tap lands on Submit, and Submit checks the whole form: the email, and
 * what is still required. The same with a mouse; with the keys (Tab) the
 * message shows as the box is left, as before.
 */

const errors = (page: Page) => page.locator('.fd-field .fd-error:not([hidden])');

async function typeNameAndEmail(page: Page, tap: boolean) {
  const name = node(page, 'f-name').locator('input');
  const email = node(page, 'f-email').locator('input');
  if (tap) await name.tap();
  else await name.click();
  await page.keyboard.type('Mona Adel');
  if (tap) await email.tap();
  else await email.click();
  await page.keyboard.type('mona@');
  await expect(email).toBeFocused();
}

test.describe('a press that leaves a box', () => {
  test('on a phone, the first tap on Submit checks the whole form', async ({ browser, browserName }) => {
    test.skip(browserName === 'firefox', 'Firefox in Playwright has no isMobile');
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const page = await context.newPage();
    const { problems } = await open(page, 'plain', 'page=template-contact-us&theme=apple');
    await typeNameAndEmail(page, true);
    const submit = page.getByRole('button', { name: 'Submit' });
    await submit.scrollIntoViewIfNeeded();
    const before = (await submit.boundingBox())!;
    await page.touchscreen.tap(before.x + before.width / 2, before.y + before.height / 2);
    // One tap: the email's problem, and Submit's own check — what is still required — all said.
    await expect(node(page, 'f-email').locator('.fd-error')).toHaveText('Enter an email address, like name@example.com');
    await expect(node(page, 'f-topic').locator('.fd-error')).toBeVisible();
    await expect(node(page, 'f-message').locator('.fd-error')).toBeVisible();
    expect(await errors(page).count()).toBeGreaterThanOrEqual(3);
    await screen(page, 'pressed-error-phone-first-tap', { viewport: true });
    expect(problems).toEqual([]);
    await context.close();
  });

  test('with a mouse, the first click on Submit checks the whole form', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const { problems } = await open(page, 'plain', 'page=template-contact-us&theme=apple');
    await typeNameAndEmail(page, false);
    const submit = page.getByRole('button', { name: 'Submit' });
    await submit.scrollIntoViewIfNeeded();
    const at = (await submit.boundingBox())!;
    await page.mouse.click(at.x + at.width / 2, at.y + at.height / 2);
    await expect(node(page, 'f-email').locator('.fd-error')).toHaveText('Enter an email address, like name@example.com');
    await expect(node(page, 'f-topic').locator('.fd-error')).toBeVisible();
    await expect(node(page, 'f-message').locator('.fd-error')).toBeVisible();
    expect(problems).toEqual([]);
  });

  test('left by Tab, the box says its problem at once, as before', async ({ page }) => {
    await open(page, 'plain', 'page=template-contact-us&theme=apple');
    await typeNameAndEmail(page, false);
    await page.keyboard.press('Tab');
    await expect(node(page, 'f-email').locator('.fd-error')).toHaveText('Enter an email address, like name@example.com');
    // Nothing else is checked yet: that waits for Submit.
    await expect(node(page, 'f-topic').locator('.fd-error')).toBeHidden();
  });

  test('a press on the page’s background shows the message once it is lifted', async ({ page }) => {
    await open(page, 'plain', 'page=template-contact-us&theme=apple');
    await typeNameAndEmail(page, false);
    const heading = page.getByRole('heading', { name: 'Contact us' }).first();
    const at = (await heading.boundingBox())!;
    await page.mouse.move(at.x + 4, at.y + 4);
    await page.mouse.down();
    await expect(node(page, 'f-email').locator('input')).not.toBeFocused();
    await page.mouse.up();
    await expect(node(page, 'f-email').locator('.fd-error')).toHaveText('Enter an email address, like name@example.com');
  });
});
