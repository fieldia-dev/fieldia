import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { open } from './support';

/**
 * Found by the 0.23 input-rules check (date and time). A date and time typed is made an instant with
 * `new Date(y, m, d, h, mi)` (date-text.ts instantOf). A local time the clocks skip — the hour lost when summer time
 * begins — does not exist, and JavaScript moves it an hour on: "24/04/2026 00:30" in Cairo (summer time from 00:00 that
 * Friday) is kept as 01:30, "29/03/2026 02:30" in Berlin and "08/03/2026 02:30" in New York as 03:30. Nothing says so;
 * the box shows the other time once left. The rules: never change a value silently; what can never be valid is refused
 * with why (as 31/02 and "14:3" are). (A time the clocks pass twice, "25/10/2026 02:30" in Berlin, is taken as the
 * first of the two in silence too — as "85" would be given a century.)
 */

const stateOf = (page: Page) => page.evaluate(() => (window as any).fieldiaDemo.handle.form.getState() as { values: Record<string, unknown>; unread: Record<string, { text: string } | undefined> });

for (const [timezoneId, typed] of [
  ['Africa/Cairo', '24/04/2026 00:30'],
  ['Europe/Berlin', '29/03/2026 02:30'],
  ['America/New_York', '08/03/2026 02:30'],
] as const) {
  test.describe(`in ${timezoneId}`, () => {
    test.use({ timezoneId });
    test(`"${typed}", a time the clocks skip, is kept unread with why — never kept as an hour later`, async ({ page }) => {
      const { problems } = await open(page, 'plain', 'page=fields&skin=outlined');
      const box = page.locator('[data-node="f-kickoff"] input.fd-input');
      const before = (await stateOf(page)).values['kickoff'];
      await box.click();
      await box.press('Control+A');
      await box.pressSequentially(typed);
      await box.press('Tab');
      const after = await stateOf(page);
      expect({ unread: after.unread?.['kickoff']?.text ?? null, kept: after.values['kickoff'], shown: await box.inputValue() }).toEqual({ unread: typed, kept: before, shown: typed });
      expect(problems).toEqual([]);
    });
  });
}
