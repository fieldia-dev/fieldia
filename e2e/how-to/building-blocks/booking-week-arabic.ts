import { expect } from '../../fixtures';
import type { DemoReplay } from '../hand';

/** The months as an Arabic page names them, January first. */
const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
/** The first day of a calendar's range, read from its Arabic title: "24–30 أكتوبر، 2026", "26 أكتوبر – 1 نوفمبر، 2026". */
function startOf(title: string) {
  const day = Number(/^\s*(\d+)/.exec(title)![1]);
  const month = MONTHS_AR.findIndex((name) => title.indexOf(name) >= 0 && MONTHS_AR.every((other) => other === name || title.indexOf(other) < 0 || title.indexOf(name) < title.indexOf(other)));
  const year = Number(/(\d{4})/.exec(title)![1]);
  return new Date(year, month, day);
}

/** The booking-week-arabic demo's how-to steps, replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  steps: [
    {
      says: 'Press the left arrow by Today: the next week, as the page reads.',
      async run({ page, press, see }) {
        const nav = page.getByRole('group', { name: 'التنقل في التقويم' });
        const title = page.locator('.fd-cal-title');
        const before = (await title.textContent())!;
        // The two arrows beside Today: the one on the left, pointing left, is the next week's.
        const arrows = [nav.getByRole('button', { name: 'الأسبوع السابق' }), nav.getByRole('button', { name: 'الأسبوع التالي' })];
        const [back, next] = [(await arrows[0].boundingBox())!, (await arrows[1].boundingBox())!];
        expect(next.x).toBeLessThan(back.x);
        await press(arrows[1]);
        // A week later: its first day seven days after the one shown before, named in Arabic.
        const start = startOf(before);
        start.setDate(start.getDate() + 7);
        await see(title).toHaveText(new RegExp(`^${start.getDate()}\\D.*${MONTHS_AR[start.getMonth()]}`));
      },
    },
    {
      says: 'Tab to a booking and press M: Move to… in Arabic.',
      notOnPhone: 'a phone has no Tab key and no M to press; its rows have their own Move button',
      async run({ page, keys, see }) {
        const focused = () => page.evaluate(() => !!document.activeElement?.closest('.fd-cal-event'));
        for (let i = 0; i < 30 && !(await focused()); i++) await keys('Tab');
        const booking = page.locator('.fd-cal-event:focus');
        await see(booking).toBeFocused();
        const name = (await booking.locator('.fd-cal-event-title').textContent())!;
        await keys('m');
        const dialog = page.getByRole('dialog', { name: `نقل ${name}` });
        await see(dialog).toBeVisible();
        await see(dialog.getByRole('button', { name: 'نقل', exact: true })).toBeVisible();
        await see(dialog.getByText('Move', { exact: false })).toHaveCount(0);
        await keys('Escape');
        await see(dialog).toBeHidden();
        await see(booking).toBeFocused();
      },
    },
  ],
};
