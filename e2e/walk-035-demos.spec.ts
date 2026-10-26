import { expect, test } from './fixtures';
import { DEMOS, demoHref } from '../demos/catalog.mjs';
import { type Page } from '@playwright/test';
import { node, screen } from './support';

const shownStep = (page: Page) => page.locator('.fd-step:not([hidden]) .fd-step-title');

/**
 * The gallery as the owner's walk of 0.35 met it, where what was wrong was the demo's own page rather than Fieldia's:
 * a contact's Email that took anything, an audit entry that opened as boxes to change, the embed page about unit B-12
 * whose form left its Unit empty, the long intake that emptied on a reload, and a demo's place left empty under its
 * frame while its own script came.
 */

test('a contact’s Email is checked as an email: "@SUM(A1:A9)" is never taken', async ({ page }) => {
  await page.goto('/plain/?page=contact&skin=underline&record=7');
  const email = node(page, 'contact-email').locator('input');
  await expect(email).toHaveValue(/@.*\.example$/);
  const was = await email.inputValue();
  await email.fill('@SUM(A1:A9)');
  await email.press('Tab');
  // Said under it; Save refused while it stands, the contact's email as it was.
  await expect(node(page, 'contact-email')).toContainText('Enter an email address, like name@example.com');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(email).toHaveAttribute('aria-invalid', 'true');
  expect(await page.evaluate(() => (window as any).fieldiaDemo.dataSource.records['crm.contact'][7].email)).toBe(was);
  await screen(page, 'walk-035-contact-email-refused');
});

test('an entry of the activity log reads as words, never as boxes to change', async ({ page }) => {
  await page.goto('/plain/?page=activity-entry&skin=underline&record=708');
  const did = page.locator('[data-node="action"]');
  await expect(did).toContainText(/Created|Updated|Sent|Archived/);
  const form = page.locator('#app .fd-form');
  for (const role of ['textbox', 'combobox', 'listbox', 'spinbutton', 'checkbox'] as const) await expect(form.getByRole(role)).toHaveCount(0);
  await screen(page, 'walk-035-activity-entry');
});

test('the embed page about unit B-12 opens its form with the unit filled, in either language', async ({ page }) => {
  const demo = DEMOS.find((d) => d.app === 'embed')!;
  expect(demo.howTo.join(' ')).toMatch(/B-12/);
  await page.goto(`/${demoHref(demo)}`);
  const unit = page.locator('fieldia-form [data-node="f-unit"] input');
  await expect(unit).toHaveValue('B-12');
  const arabic = /\]\((\?locale=ar[^)]*)\)/.exec(demo.howTo.join(' '))?.[1];
  expect(arabic).toContain('unit=B-12');
  await page.goto(`/embed/${arabic}`);
  await expect(unit).toHaveValue('B-12');
});

test('the long intake offers its answers back after a reload, at the step reached', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/plain/?page=clinic-intake&skin=outlined');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await node(page, 'f-name').locator('input').fill('Mona Adel');
  const birth = node(page, 'f-birth').locator('input');
  await birth.fill('03/02/1990');
  await birth.press('Tab');
  await node(page, 'f-phone').locator('input').fill('01001234567');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(shownStep(page)).toHaveText('Your visit');
  await node(page, 'f-reason').locator('textarea').fill('A cough that will not go.');
  // Kept as typed, past its short pause (on the clinic's server, the intake's Continue later's; the browser keeping its key).
  await expect.poll(() => page.evaluate(() => Object.values(localStorage).filter((kept) => kept.includes('A cough')).length)).toBe(1);
  await page.reload();
  const offer = page.locator('#app .fd-draft:visible');
  await expect(offer).toContainText('You have unsaved answers from');
  await screen(page, 'walk-035-intake-offered-back');
  await offer.getByRole('button', { name: 'Restore' }).click();
  await expect(shownStep(page)).toHaveText('Your visit');
  await expect(node(page, 'f-reason').locator('textarea')).toHaveValue('A cough that will not go.');
  await expect(offer).toHaveCount(0);
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(node(page, 'f-name').locator('input')).toHaveValue('Mona Adel');
});

test('a demo’s place under its frame holds a quiet shape while its own script comes, gone as the demo draws', async ({ page }) => {
  // The demo's script held, as on a slow network: the frame drawn, the place waiting.
  let release: () => void = () => undefined;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route(/\/plain\/main\.js$/, async (route) => {
    await held;
    await route.continue();
  });
  await page.goto('/plain/?page=customers&skin=underline', { waitUntil: 'commit' });
  const place = page.locator('#app');
  await expect(place).toBeAttached();
  const shape = () => place.evaluate((app) => ({ content: getComputedStyle(app, '::before').content, visibility: getComputedStyle(app, '::before').visibility, height: parseFloat(getComputedStyle(app, '::before').height) }));
  // Never at once — a quick page never shows it — and there past half a second.
  expect((await shape()).visibility).toBe('hidden');
  await expect.poll(async () => (await shape()).visibility, { timeout: 5000 }).toBe('visible');
  expect((await shape()).height).toBeGreaterThan(100);
  release();
  await expect(page.locator('.fd-list-row').first()).toBeVisible();
  expect((await shape()).content).toBe('none');
});
