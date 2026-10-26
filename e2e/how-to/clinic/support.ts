import type { Locator } from '@playwright/test';
import type { Hand } from '../hand';

/** What several of the clinic demos’ replays share (e2e/how-to/clinic/<demo id>.ts). */

/**
 * An option of a list of the browser's own (a <select>) picked as a person picks it. On a desktop: pressed, its words
 * typed (the list goes to the one they start), Enter. On the phone the list opens the system's own picker, which
 * Playwright cannot turn: the option picked as the picker leaves it — an option already shown is left as it is (the
 * picker sends no change), another is chosen.
 */
export async function choose({ page, phone, press, keys }: Hand, list: Locator, label: string) {
  if (phone) {
    await list.scrollIntoViewIfNeeded();
    if ((await list.locator('option:checked').innerText()).trim() !== label) await list.selectOption({ label });
    return;
  }
  await press(list);
  await page.keyboard.type(label, { delay: 15 });
  await keys('Enter');
}

/** Minutes after midnight as the clinic’s pages write a time: "09:15". */
export const hhmm = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

/**
 * The window narrowed to a phone's width, as a person drags its edge in (on the phone, already so): the page then
 * in sight, not the demos' menu, which a desktop's width opened beside it, left over it.
 */
export async function narrow({ page, phone, see }: Hand) {
  if (!phone) await page.setViewportSize({ width: 390, height: 844 });
  await see(page.getByRole('complementary', { name: 'All demos' }), 'the demos’ menu, open beside the page at a desktop’s width, is left over it once the window is narrowed').not.toBeInViewport();
}

