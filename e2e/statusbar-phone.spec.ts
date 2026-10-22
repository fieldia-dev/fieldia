import { type Page } from '@playwright/test';
import { axeFindings } from './a11y-support';
import { expect, test } from './fixtures';
import { open, screen } from './support';

/**
 * A record's status strip on a phone, where its steps are wider than the screen: the step the record is in scrolled
 * into view, no step cut mid-word at its start — at rest, it starts on a step — and each edge where more steps are
 * fading with a sign that the strip scrolls. The owner's walk of 0.29 met "submit" for "To submit", cut, and "Rejecte",
 * with no sign of more.
 */

test.use({ viewport: { width: 390, height: 844 } });

const strip = (page: Page) => page.locator('.fd-header .fd-statusbar');
/** Where each step stands against the strip's room: its start and end, the strip's start and end. */
const layout = (page: Page) =>
  strip(page).evaluate((list) => {
    const room = list.getBoundingClientRect();
    const rtl = getComputedStyle(list).direction === 'rtl';
    const steps = [...list.querySelectorAll(':scope > li')].map((li) => {
      const at = li.getBoundingClientRect();
      return { text: li.textContent ?? '', start: rtl ? room.right - at.right : at.left - room.left, end: rtl ? room.right - at.left : at.right - room.left, current: !!li.querySelector('[aria-current="step"]') };
    });
    const sign = (side: 'before' | 'after') => {
      const mark = list.parentElement?.querySelector<HTMLElement>(`.fd-statusbar-sign[data-side="${side}"]`);
      return !!mark && getComputedStyle(mark).display !== 'none' && mark.getBoundingClientRect().width > 0;
    };
    return { width: room.width, steps, before: sign('before'), after: sign('after') };
  });
/**
 * At rest, it starts on a step: the first at the strip's start, else one after the sign's room (24px) — the step
 * before it, cut, only under the sign's fade. (The arrows overlap 6px.)
 */
async function startsOnAStep(page: Page) {
  const { steps } = await layout(page);
  // The first step whole in sight: the first, at the strip's start; another, right after the sign's room — those
  // before it, past the start but for what the fade over the sign shows of them.
  const whole = steps.findIndex((step) => step.start >= -7);
  expect(whole).toBeGreaterThanOrEqual(0);
  const at = steps[whole].start;
  expect(whole === 0 ? at : at - 24, `${steps[whole].text} at its place`).toBeGreaterThanOrEqual(-7);
  expect(at, `${steps[whole].text} at its place`).toBeLessThanOrEqual(whole === 0 ? 1 : 24 + 7);
}

test('the expense’s strip shows Rejected, the step it is in, whole; it starts on a step, and a sign says more is before', async ({ page }) => {
  const { problems } = await open(page, 'plain', 'page=expense-approval&record=1&skin=outlined');
  await expect(strip(page).locator('[aria-current="step"]')).toHaveText('Rejected');
  await expect.poll(async () => {
    const { steps, width } = await layout(page);
    const current = steps.find((step) => step.current);
    return !!current && current.start >= -7 && current.end <= width + 1;
  }).toBe(true);
  await startsOnAStep(page);
  await expect.poll(async () => (await layout(page)).before).toBe(true);
  await screen(page, 'statusbar-phone-expense', { viewport: true });
  // Scrolled back by a finger: the first step whole, and a sign that more is after.
  await strip(page).evaluate((list) => list.scrollTo({ left: getComputedStyle(list).direction === 'rtl' ? list.scrollWidth : 0, behavior: 'instant' }));
  await expect.poll(async () => (await layout(page)).after).toBe(true);
  await expect.poll(async () => (await layout(page)).before).toBe(false);
  // Let go part of the way: at rest, it starts on a step, never mid-word.
  await strip(page).evaluate((list) => list.scrollBy({ left: 37, behavior: 'instant' }));
  await page.waitForTimeout(400);
  await startsOnAStep(page);
  expect(await axeFindings(page, 'a status strip on a phone', '.fd-header')).toEqual([]);
  expect(problems).toEqual([]);
});

test('the opportunity’s strip shows Proposition, a sign that more steps come after it; in the dark too', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  const { problems } = await open(page, 'plain', 'page=real-opportunity&record=7701&skin=underline&scheme=dark');
  await expect(strip(page).locator('[aria-current="step"]')).toContainText('Proposition');
  await expect.poll(async () => (await layout(page)).after).toBe(true);
  await startsOnAStep(page);
  await screen(page, 'statusbar-phone-opportunity-dark', { viewport: true });
  expect(problems).toEqual([]);
});

test('right to left, the strip’s start is its right: the step it is in in view, the sign on the side more steps are', async ({ page }) => {
  const { problems } = await open(page, 'plain', 'page=expense-approval&record=1&skin=outlined&locale=ar&dir=rtl');
  await expect.poll(async () => {
    const { steps, width } = await layout(page);
    const current = steps.find((step) => step.current);
    return !!current && current.start >= -7 && current.end <= width + 1;
  }).toBe(true);
  await startsOnAStep(page);
  await expect.poll(async () => (await layout(page)).before).toBe(true);
  await screen(page, 'statusbar-phone-rtl', { viewport: true });
  expect(problems).toEqual([]);
});
