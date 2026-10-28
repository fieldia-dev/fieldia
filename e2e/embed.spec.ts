import { expect, test } from './fixtures';
import { screen } from './support';

/**
 * A form on another site, as a partner's page has it: `<fieldia-form>` with one script tag — its page fetched, its
 * form drawn in it, what happens told as events — and fieldia-embed.js's frame of the app's own form page, growing and
 * shrinking with the form, the link's campaign reaching its hidden fields, and what happens told to the page round it.
 */

let problems: string[] = [];
test.beforeEach(({ page }) => {
  problems = [];
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(`console: ${message.text()}`);
  });
  page.on('pageerror', (error) => problems.push(`page error: ${error.message}`));
});
test.afterEach(() => expect(problems).toEqual([]));

const told = (page: import('@playwright/test').Page) => page.locator('#told li');

/** The mobile typed and confirmed with the demo's code, which is always 246810. */
async function confirm(form: import('@playwright/test').Locator | import('@playwright/test').FrameLocator, number: string) {
  const phone = form.locator('[data-node="f-phone"]');
  await phone.locator('input').first().fill(number);
  await phone.locator('input').first().press('Tab');
  await phone.getByRole('button', { name: 'Send a code by WhatsApp' }).click();
  await phone.getByRole('textbox', { name: /Code sent to/ }).fill('246810');
  await expect(phone.locator('.fd-verify-done')).toBeVisible();
}

test('<fieldia-form> draws its page on a partner’s page and tells what happens', async ({ page }) => {
  await page.goto('/embed/?utm_source=newsletter&unit=B-12');
  const element = page.locator('fieldia-form');
  await expect(element.locator('.fd-form')).toBeVisible();
  await expect(told(page).first()).toHaveText('fieldia-ready {"page":"unit-enquiry"}');
  // Its page's link fills the unit from the partner's address.
  await expect(element.locator('[data-node="f-unit"] input')).toHaveValue('B-12');
  await element.locator('[data-node="f-name"] input').fill('Hana Fouad');
  await confirm(element, '010 1234 5678');
  await element.getByRole('radio', { name: 'Book a viewing' }).check();
  await element.getByRole('button', { name: 'Submit', exact: true }).click();
  await expect(element.locator('.fd-done-title')).toHaveText('Thank you, Hana Fouad');
  await expect(told(page).last()).toHaveText('fieldia-send {"id":"R-1201"}');
  const sent = await page.evaluate(() => (window as any).fieldiaDemo.dataSource.responses[0].values);
  expect(sent).toMatchObject({ unit: 'B-12', utm_source: 'newsletter' });
  await screen(page, 'embed-element');
});

test('opened with no unit in its address, the page names its own, B-12, as the gallery’s link does: its title, Try this and Unit', async ({ page }) => {
  // The 0.36 walk: /demos/embed/ alone had no title and no Try this (the frame finds a demo by its address) and its Unit
  // was empty under "Palm Valley, unit B-12".
  await page.addInitScript(() => Object.defineProperty(navigator, 'webdriver', { get: () => false }));
  await page.goto('/embed/');
  await expect(page.locator('.dh-title')).toHaveText('A form on another site: one tag');
  await expect(page.locator('fieldia-form [data-node="f-unit"] input')).toHaveValue('B-12');
  expect(new URL(page.url()).searchParams.get('unit')).toBe('B-12');
});

test('<fieldia-form> speaks its locale attribute’s language, right to left', async ({ page }) => {
  await page.goto('/embed/?locale=ar');
  await expect(page.locator('fieldia-form .fd-form')).toHaveAttribute('dir', 'rtl');
});

test('the embed script’s frame grows and shrinks with the form, and the link’s campaign reaches its hidden fields', async ({ page }) => {
  await page.goto('/embed/?as=frame&utm_source=newsletter&agent=mona&unit=B-12&token=secret');
  const frame = page.locator('iframe[data-fieldia-frame]');
  await expect(frame).toHaveAttribute('title', 'Ask about this unit');
  const src = new URL((await frame.getAttribute('src')) as string);
  expect(Object.fromEntries(src.searchParams)).toMatchObject({ utm_source: 'newsletter', agent: 'mona', unit: 'B-12' });
  expect(src.searchParams.has('token')).toBe(false);
  const inside = page.frameLocator('iframe[data-fieldia-frame]');
  await expect(inside.locator('.fd-form')).toBeVisible();
  await expect(told(page).first()).toHaveText('fieldia-ready {"page":"unit-enquiry"}');
  // The frame as tall as its form: no scrollbar inside it, its height its document's.
  const fits = async () => {
    const [height, content] = await Promise.all([frame.evaluate((one) => one.getBoundingClientRect().height), inside.locator('html').evaluate((html) => html.getBoundingClientRect().height)]);
    return Math.abs(height - content) <= 2;
  };
  await expect.poll(fits).toBe(true);
  const tall = await frame.evaluate((one) => one.getBoundingClientRect().height);
  expect(tall).toBeGreaterThan(600);
  await expect(inside.locator('[data-node="f-unit"] input')).toHaveValue('B-12');
  await inside.locator('[data-node="f-name"] input').fill('Omar Said');
  await confirm(inside, '012 2222 3333');
  await inside.getByRole('radio', { name: 'Book a viewing' }).check();
  await screen(page, 'embed-frame');
  await inside.getByRole('button', { name: 'Submit', exact: true }).click();
  await expect(inside.locator('.fd-done-title')).toHaveText('Thank you, Omar Said');
  await expect(told(page).last()).toHaveText('fieldia-send {"id":"R-1201"}');
  // Sent, the thanks is shorter than the form: the frame shrinks with it.
  await expect.poll(fits).toBe(true);
  expect(await frame.evaluate((one) => one.getBoundingClientRect().height)).toBeLessThan(tall);
  const sent = await page.frames().find((one) => one.url().includes('form.html'))?.evaluate(() => (window as any).fieldiaDemo.dataSource.responses[0].values);
  expect(sent).toMatchObject({ utm_source: 'newsletter', agent_code: 'mona', unit: 'B-12' });
});

test('a framed form tells only the sites its allowed-origins names: another site that frames it hears nothing (S-L1)', async ({ page, baseURL }) => {
  // The app's form page at its own site, and a partner's page at another: both served as the demos are.
  const app = new URL(baseURL as string);
  const forms = 'http://forms.test';
  const partner = 'http://partner.test/partner.html';
  let allowed: string | null = null;
  await page.route(`${forms}/**`, async (route) => {
    const answer = await route.fetch({ url: route.request().url().replace(forms, app.origin) });
    const body = await answer.body();
    // The app's page names the sites it tells, where the test says.
    const named = new URL(route.request().url()).pathname === '/embed/form.html' && allowed !== null ? body.toString().replace('<fieldia-form ', `<fieldia-form allowed-origins="${allowed}" `) : body;
    await route.fulfill({ response: answer, body: named });
  });
  await page.route(partner, (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: `<!doctype html><title>Partner</title><script>window.heard = []; addEventListener('message', (event) => event.data && event.data.fieldia && heard.push(event.data.fieldia));</script>
<body><script src="${forms}/embed/fieldia-embed.js" data-src="${forms}/embed/form.html" data-title="Ask about this unit"></script></body>`,
    })
  );
  const warned: string[] = [];
  page.on('console', (message) => message.type() === 'warning' && warned.push(message.text()));
  const heard = () => page.evaluate(() => (window as unknown as { heard: string[] }).heard);
  await page.goto(partner);
  const inside = page.frameLocator('iframe[data-fieldia-frame]');
  await expect(inside.locator('.fd-form')).toBeVisible();
  // Told nothing — not even its height — and the console says why.
  await expect.poll(() => warned.join('\n')).toContain('which its allowed-origins does not name');
  expect(await heard()).toEqual([]);

  // The app names the partner: told its height and what happens, as before.
  allowed = 'http://partner.test';
  await page.goto(partner);
  await expect.poll(heard).toContain('ready');
  expect(await heard()).toContain('height');
});
