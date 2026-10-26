import type { Locator, Page } from '@playwright/test';
import type { Hand } from '../hand';

/** The helpers several of the sales demos' replays share (e2e/how-to/sales/<demo>.ts). */

/** A box of the form by its label, read as a person reads it. */
export const box = (scope: Page | Locator, name: string) => scope.getByRole('textbox', { name, exact: true });

/** The first map on the page, and one of the map's own buttons. */
export const theMap = (page: Page) => page.locator('.fd-map-box').first();
export const mapTool = (page: Page, name: string) => theMap(page).getByRole('button', { name, exact: true });

/** Today on Berlin's calendar, some days on, as a day's button names it: "Wednesday 28 October 2026". */
export function berlinDay(daysOn: number): { label: string; weekday: number } {
  const [y, m, d] = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date()).split('-').map(Number);
  const day = new Date(Date.UTC(y, m - 1, d + daysOn, 12));
  return { label: new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(day).replace(',', ''), weekday: day.getUTCDay() };
}

/** A link's box (a many2one) by its layout id: some of a name typed in it, then its option pressed. */
export async function pickIn({ page, press, type, see }: Hand, id: string, typed: string, option: string) {
  const box = page.locator(`[data-node="${id}"]`).getByRole('combobox');
  await type(box, typed, { clear: true });
  await press(page.locator(`[data-node="${id}"]`).getByRole('option', { name: option, exact: true }));
  await see(box).toHaveValue(option);
}

/** A toast at the foot of the screen, by its words. */
export const toast = (page: Page, words: string | RegExp) => page.locator('.fd-say', { hasText: words });

/**
 * An option of a list the browser draws itself (a `<select>`), picked as a person picks it: on a desktop pressed, its
 * words typed (its list goes to the one they start), Enter. A phone opens its system picker, which Playwright cannot
 * turn: the option is taken as that picker leaves it.
 */
export async function chooseFrom({ page, phone, press, keys }: Hand, list: Locator, label: string) {
  if (phone) {
    await list.scrollIntoViewIfNeeded();
    await list.selectOption({ label });
    return;
  }
  await press(list);
  await page.keyboard.type(label, { delay: 15 });
  await keys('Enter');
}
