import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';

/**
 * The key screens compared with stored images (the audit's R-M13: no visual check existed; "the radios looked like the
 * browser's" in 0.32 came from the owner, not a gate). A few screens, each a look a person meets first — a record in
 * light and dark, in each of the three looks, on a phone, right to left, a list, a form in steps — drawn in the
 * plain demo and compared, pixel by pixel within a small tolerance, with its image in e2e/screens-baseline/.
 *
 * Only in the Playwright container (the `screens` project, its own CI job, docs/maintainers/screens.md): the same
 * browser build and the same fonts wherever it runs, so a difference is Fieldia's, never a machine's. The clock is
 * held (what is "today", "overdue", "2 hours ago"), the zone and language named, motion off, the caret hidden; only
 * the demo is shot, never the frame round it, whose header follows the catalogue's words.
 *
 * A difference fails the job, with the expected, actual and diff images in its artifact. Look at them: a change meant
 * is stored again (`node tools/screens.mjs --update`, the new images reviewed in the pull request); one not meant is a defect. A
 * diff that comes and goes is investigated — a page that never settles, a font that comes late — never tolerated away.
 */

/** The moment every screen is drawn at: a Wednesday morning in Cairo. */
const NOW = new Date('2026-10-14T09:30:00+03:00');

test.beforeEach(async ({ page }) => {
  test.skip(!process.env['FIELDIA_SCREENS'] && !process.env['CI'], 'compared only in the Playwright container: node tools/screens.mjs (docs/maintainers/screens.md)');
  // In CI, only in the container: a job that runs this spec elsewhere compares another machine's fonts, and fails.
  expect(process.env['FIELDIA_SCREENS'], 'the screens are compared in the Playwright container alone (FIELDIA_SCREENS=container)').toBe('container');
  await page.clock.setFixedTime(NOW);
});

/** A demo opened and settled: its form drawn, every font in, nothing still loading, its pointer out of the way. */
async function opened(page: Page, query: string, settled = '.fd-form') {
  await page.goto(`/plain/?${query}`);
  await expect(page.locator(settled).first()).toBeVisible();
  await expect(page.locator('#app .fd-loader, #app .fd-skeleton, #app [aria-busy="true"]')).toHaveCount(0);
  await page.evaluate(() => document.fonts.ready);
  await page.mouse.move(0, 0);
  return page.locator('#app');
}

const SCREENS: { name: string; query: string; phone?: boolean; settled?: string }[] = [
  { name: 'record-underline-light', query: 'page=customer&skin=underline&scheme=light' },
  { name: 'record-underline-dark', query: 'page=customer&skin=underline&scheme=dark' },
  { name: 'record-outlined-light', query: 'page=customer&skin=outlined&scheme=light' },
  { name: 'record-quiet-light', query: 'page=customer&skin=quiet&scheme=light' },
  { name: 'record-phone', query: 'page=customer&skin=underline&scheme=light', phone: true },
  { name: 'record-arabic-rtl', query: 'page=customer&skin=underline&scheme=light&locale=ar&dir=rtl' },
  { name: 'list-light', query: 'page=customers&skin=underline&scheme=light', settled: '.fd-list-row' },
  { name: 'survey-outlined-phone-dark', query: 'page=survey&skin=outlined&scheme=dark', phone: true },
];

for (const screen of SCREENS.filter((one) => !one.phone)) {
  test(`${screen.name} looks as it did`, async ({ page }) => {
    const app = await opened(page, screen.query, screen.settled);
    await expect(app).toHaveScreenshot(`${screen.name}.png`);
  });
}

test.describe('on a phone', () => {
  // A phone's width, touch and no hover, as a phone's own rules read them; one pixel to a point, to keep the images small.
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  for (const screen of SCREENS.filter((one) => one.phone)) {
    test(`${screen.name} looks as it did`, async ({ page }) => {
      const app = await opened(page, screen.query, screen.settled);
      await expect(app).toHaveScreenshot(`${screen.name}.png`);
    });
  }
});
