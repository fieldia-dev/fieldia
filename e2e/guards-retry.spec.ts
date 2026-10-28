import type { Page, Route } from '@playwright/test';
import { expect, test } from './fixtures';
import { node, screen } from './support';

/**
 * A part that guards a send, refused by the network where an app's bundler made it a module of its own — the owner's
 * walk of 0.35, on the demos' unit enquiry (`/plain/?page=unit-enquiry`): Retry under the refusal never asked for the
 * part again (a browser keeps a failed `import()` failed for the page's life), and Reload, which the words asked for,
 * emptied the form. Now (0.35.1): where the browser names the module that failed (Chromium, Firefox), the words say try
 * again and Retry asks for it anew, at an address of its own; where it names none (WebKit) the words ask for a reload,
 * no Retry is offered, and what was typed comes back with the reload. And the code check that could not come is said
 * under the mobile at once, not only at Submit.
 */

const ENQUIRY = '/plain/?page=unit-enquiry&skin=outlined&utm_source=whatsapp&utm_campaign=autumn-launch&agent=mona&unit=B-12';

/** The part's own files — its form's side and its page's — refused while `held.on`, as a dropped line refuses them. */
async function refuse(page: Page, part: 'pay' | 'verify') {
  const held = { on: true, asked: [] as string[] };
  await page.route(new RegExp(`/${part}-part-[A-Z0-9]+\\.js`), (route: Route) => {
    held.asked.push(route.request().url().split('/').pop() as string);
    return held.on ? route.abort('connectionfailed') : route.continue();
  });
  return held;
}

/** The enquiry typed as the walk typed it: a name, the mobile confirmed by the code the demo's app sent, Reserve the unit now and a message. */
async function typeEnquiry(page: Page) {
  await page.goto(ENQUIRY);
  await node(page, 'f-name').locator('input').fill('Hana Mostafa');
  const phone = node(page, 'f-phone');
  await phone.locator('input').first().fill('010 1234 5678');
  await phone.locator('input').first().press('Tab');
  await phone.getByRole('button', { name: 'Send a code by WhatsApp' }).click();
  const code = await page.evaluate(() => {
    const codes = (window as any).fieldiaDemo.dataSource.codes as { code: string }[];
    return codes[codes.length - 1].code;
  });
  await phone.getByRole('textbox', { name: /Code sent to/ }).fill(code);
  await expect(phone.locator('.fd-verify-done')).toBeVisible();
  await node(page, 'f-visit').getByRole('radio', { name: 'Reserve the unit now' }).check();
  await node(page, 'f-message').locator('textarea').fill('Is the price final?');
}

const status = (page: Page) => page.locator('.fd-actions .fd-status');
/**
 * The page's own notice of a part that could not come ("…shown plainly. Reload the page and try again."): never for one
 * that says so where it is sent or typed in, with its own Retry — the 0.36 walk's banner over a working Pay button.
 */
const notice = (page: Page) => page.locator('.fd-parts-unloaded');
const retry = (page: Page) => page.locator('.fd-actions .fd-status-box .fd-retry');

test('the payment step refused: Retry asks for it anew where the browser can, and the answers go once it comes', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit', 'WebKit names no module that failed: its words ask for a reload (below)');
  const held = await refuse(page, 'pay');
  await typeEnquiry(page);
  await page.getByRole('button', { name: 'Submit' }).click();
  await expect(status(page)).toHaveText('The payment step could not load, so nothing was sent. Try again.');
  await expect(retry(page)).toBeVisible();
  await expect(notice(page)).toBeHidden();
  await screen(page, 'guards-retry-pay-refused');
  // The network back: Retry asks for the part again — a request the browser makes, at an address of its own.
  held.on = false;
  const before = held.asked.length;
  await retry(page).click();
  await expect(page.getByRole('button', { name: /^Pay EGP 10,000\.00$/ })).toBeVisible();
  await expect(notice(page)).toBeHidden();
  expect(held.asked.slice(before).every((file) => /\?fd-again=\d+$/.test(file))).toBe(true);
  expect(held.asked.length).toBeGreaterThan(before);
  await page.getByRole('button', { name: /^Pay EGP 10,000\.00$/ }).click();
  await page.getByRole('button', { name: 'Pay with this card' }).click();
  await expect(page.locator('.fd-done-title')).toHaveText('B-12 is held for you, Hana Mostafa');
});

test('the payment step refused where the browser names no module: the words ask for a reload, which brings the typing back', async ({ page, browserName }) => {
  test.skip(browserName !== 'webkit', 'Chromium and Firefox name the module: Retry asks for it anew (above)');
  await refuse(page, 'pay');
  await typeEnquiry(page);
  await page.getByRole('button', { name: 'Submit' }).click();
  await expect(status(page)).toHaveText('The payment step could not load, so nothing was sent. Reload the page and try again.');
  // No Retry that cannot work, and the send's words alone: nothing on the page is shown plainly.
  await expect(retry(page)).toBeHidden();
  await expect(notice(page)).toBeHidden();
  await page.reload();
  await expect(node(page, 'f-name').locator('input')).toHaveValue('Hana Mostafa');
  await expect(node(page, 'f-message').locator('textarea')).toHaveValue('Is the price final?');
  await expect(node(page, 'f-visit').getByRole('radio', { name: 'Reserve the unit now' })).toBeChecked();
  await screen(page, 'guards-retry-pay-reloaded');
});

test('the code check refused: the mobile says so at once, and once it comes, Send a code is there', async ({ page, browserName }) => {
  const held = await refuse(page, 'verify');
  await page.goto(ENQUIRY);
  await node(page, 'f-phone').locator('input').first().fill('010 1234 5678');
  const said = page.locator('[data-node="f-phone"] .fd-join-missing');
  const again = browserName === 'webkit' ? 'Reload the page and try again.' : 'Try again.';
  await expect(said).toContainText(`The code check could not load, so nothing was sent. ${again}`);
  await expect(notice(page)).toBeHidden();
  await screen(page, 'guards-retry-verify-at-once');
  if (browserName === 'webkit') return;
  held.on = false;
  await said.getByRole('button', { name: 'Retry' }).click();
  await expect(page.getByRole('button', { name: /Send a code/ }).first()).toBeVisible();
  await expect(said).toHaveCount(0);
});
