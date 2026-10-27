import type { Page } from '@playwright/test';
import type { DemoReplay, Hand } from '../hand';
import { berlinDay } from './support';

/** The booking's month and times (the slots field), a day of the month shown, its time chips and what it says. */
const slots = (page: Page) => page.locator('[data-node="f-start"]');
const days = (page: Page) => slots(page).locator('.fd-slots-days button:not(.fd-outside)');
const chips = (page: Page) => slots(page).locator('.fd-slots-chip');
/** A car chosen as a person chooses one: some of its name typed in Car, then its option pressed. */
async function chooseCar({ page, press, type, see }: Hand, typed: string, name: string) {
  const car = page.locator('[data-node="f-car"]').getByRole('combobox');
  await type(car, typed, { clear: true });
  await press(page.getByRole('option', { name }));
  await see(car).toHaveValue(name);
  await see(slots(page).locator('.fd-slots-days')).not.toHaveAttribute('aria-busy', 'true');
}

/** The days after today this month that have free times, by their buttons' names. */
async function openDaysAhead(page: Page): Promise<string[]> {
  const labels = await days(page).evaluateAll((buttons) => buttons.map((b) => [b.getAttribute('aria-label') ?? '', b.getAttribute('data-state'), b.getAttribute('aria-current')] as const));
  const today = labels.findIndex(([, , current]) => current === 'date');
  return labels.filter(([, state], i) => i > today && state === 'open').map(([label]) => label);
}

/** The test-drive demo's how-to steps, replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  timeout: 90_000,
  steps: [
    {
      says: 'Pick a car, then a day: its free times show beside the month. Another car has times of its own',
      async run(hand) {
        const { page, press, see } = hand;
        await see(slots(page).locator('.fd-slots-heading')).toBeVisible();
        await chooseCar(hand, 'hatch', 'City hatchback, electric');
        // The first day after today with times free; the month after, at a month's end.
        if (!(await openDaysAhead(page)).length) await press(slots(page).getByRole('button', { name: 'Next month' }));
        const day = (await openDaysAhead(page))[0];
        await press(days(page).and(page.getByRole('button', { name: day, exact: true })));
        const [weekday, date, month] = day.split(' ');
        await see(slots(page).locator('.fd-slots-heading')).toHaveText(`Free times on ${weekday} ${date} ${month}`);
        await see(chips(page).first()).toBeVisible();
        const hatchback = await chips(page).allTextContents();
        await chooseCar(hand, 'estate', 'Family estate, hybrid');
        await see(slots(page).locator('.fd-slots-heading')).toHaveText(`Free times on ${weekday} ${date} ${month}`);
        await see(chips(page).first()).toBeVisible();
        await see(chips(page)).not.toHaveText(hatchback);
      },
    },
    {
      says: 'Without a mouse: Tab to the month, move with the arrows (Page Up and Page Down by month)',
      notOnPhone: 'a phone has no Tab, arrows, Page Up or Page Down: its finger picks a day and a time, as in step 1',
      async run({ page, keys, see }) {
        const heading = slots(page).locator('.fd-slots-heading');
        const picked = (await heading.textContent())!.replace('Free times on ', '');
        // From Car (where the last step left the keys): its clear button, the month's two arrows, then its day.
        await see(page.locator('[data-node="f-car"]').getByRole('combobox')).toBeFocused();
        await keys('Tab', 'Tab', 'Tab', 'Tab');
        const focused = days(page).and(page.locator(':focus'));
        await see(focused).toHaveAttribute('aria-label', new RegExp(`^${picked}`));
        await keys('ArrowRight');
        await see(focused).not.toHaveAttribute('aria-label', new RegExp(`^${picked}`));
        const next = (await focused.getAttribute('aria-label'))!.split(' ').slice(0, 3).join(' ');
        await see(heading).toContainText(next);
        await keys('ArrowLeft');
        await see(heading).toHaveText(`Free times on ${picked}`);
        const month = (await slots(page).locator('.fd-calendar-title').textContent())!;
        await keys('PageDown');
        await see(slots(page).locator('.fd-calendar-title')).not.toHaveText(month);
        await see(heading).not.toContainText(picked);
        await keys('PageUp');
        await see(slots(page).locator('.fd-calendar-title')).toHaveText(month);
        await see(heading).toHaveText(`Free times on ${picked}`);
        // Enter goes to the times, the arrows move among them, Enter books one.
        await keys('Enter');
        await see(chips(page).first()).toBeFocused();
        await keys('ArrowRight');
        await see(chips(page).nth(1)).toBeFocused();
        const time = (await chips(page).nth(1).textContent())!;
        await keys('Enter');
        await see(chips(page).nth(1)).toHaveAttribute('aria-pressed', 'true');
        await see(slots(page).locator('.fd-slots-chosen')).toHaveText(new RegExp(`^${picked.split(' ')[0]} ${picked.split(' ')[1]} ${picked.split(' ')[2]} \\d{4}, ${time} to \\d\\d:\\d\\d (CEST|CET)$`));
        await see(page.locator('[data-node="f-stop"] input')).not.toHaveValue('');
      },
    },
    {
      says: 'The next Wednesday is fully booked for the hatchback: hatched, with no times',
      async run(hand) {
        const { page, press, see } = hand;
        await chooseCar(hand, 'hatch', 'City hatchback, electric');
        const wednesday = [1, 2, 3, 4, 5, 6, 7].map(berlinDay).find((day) => day.weekday === 3)!;
        // In the month after, when the next Wednesday is in it.
        const day = page.getByRole('button', { name: new RegExp(`^${wednesday.label},`) });
        if (!(await day.count())) await press(slots(page).getByRole('button', { name: 'Next month' }));
        await see(day).toHaveAttribute('data-state', 'full');
        await see(day).toHaveAttribute('aria-label', `${wednesday.label}, Fully booked`);
        await see(day).toHaveCSS('background-image', /repeating-linear-gradient/);
        await press(day);
        const [weekday, date, month] = wednesday.label.split(' ');
        await see(slots(page).locator('.fd-slots-heading')).toHaveText(`No free times on ${weekday} ${date} ${month}`);
        await see(chips(page)).toHaveCount(0);
      },
    },
    {
      says: 'Press Someone else books 10:00 over the form: on another screen, Tom books that time first',
      async run({ page, press, see }) {
        const bar = page.locator('.demo-meanwhile-bar');
        // A day with the hatchback's 10:00 free (and not the time booked in step 2): the first after today that has it.
        const ten = chips(page).filter({ hasText: '10:00' });
        for (const day of await openDaysAhead(page)) {
          await press(days(page).and(page.getByRole('button', { name: day, exact: true })));
          await see(chips(page).first()).toBeVisible();
          if ((await ten.count()) && (await ten.getAttribute('aria-pressed')) === 'false') break;
        }
        await see(ten).toHaveAttribute('aria-pressed', 'false');
        const someone = bar.getByRole('button', { name: 'Someone else books 10:00' });
        await press(someone);
        await see(bar).toContainText('Tom Schulz booked 10:00 on another screen, just now. Yours still shows it: press 10:00 and see.');
        // This screen was not told: its 10:00 still there, pressed now.
        await press(chips(page).filter({ hasText: '10:00' }));
        await see(slots(page).locator('.fd-slots-said')).toHaveText('10:00 was just booked by someone else. Pick another time.');
        await see(chips(page).filter({ hasText: '10:00' })).toHaveCount(0);
        // Nothing booked on this day: no time of it pressed.
        await see(chips(page).and(page.locator('[aria-pressed="true"]'))).toHaveCount(0);
        await see(bar).toContainText('Tom Schulz booked 10:00 first, on another screen: this page said so, and booked nothing.');
      },
    },
    {
      says: 'Type a time in Call back at: it is on Berlin’s clock, CEST or CET beside it',
      async run({ page, phone, press, type, keys, see }) {
        const callBack = page.locator('[data-node="f-call-back"]');
        const box = callBack.getByRole('textbox');
        const leave = async () => (phone ? press(page.getByRole('textbox', { name: 'Notes' })) : keys('Tab'));
        await type(box, '20/10/2026 16:30');
        await leave();
        await see(box).toHaveValue('20 Oct 2026, 16:30');
        await see(callBack.locator('.fd-zone')).toHaveText('CEST');
        await type(box, '02/11/2026 16:30', { clear: true });
        await leave();
        await see(box).toHaveValue('2 Nov 2026, 16:30');
        await see(callBack.locator('.fd-zone')).toHaveText('CET');
        // 02:30 comes twice the night the clocks go back: the box asks which, the text kept.
        await type(box, '25/10/2026 02:30', { clear: true });
        await leave();
        await see(callBack.locator('.fd-error').first()).toHaveText('Call back at: 02:30 comes twice on 25 Oct 2026 in Central European Time, as the clocks go back; write 02:30 +02:00 or 02:30 +01:00');
        await see(box).toHaveValue('25/10/2026 02:30');
        // Answered: the second, in winter time.
        await press(box);
        await keys('End');
        await page.keyboard.type(' +01:00', { delay: 15 });
        await leave();
        await see(box).toHaveValue('25 Oct 2026, 02:30');
        await see(callBack.locator('.fd-zone')).toHaveText('CET');
        await see(callBack.locator('.fd-error')).toBeHidden();
      },
    },
    {
      says: 'Open the Code drawer: the demo’s schedule, and the slots() your server gives',
      async run({ page, phone, press, see }) {
        if (phone) await press(page.getByRole('button', { name: 'Framework, look and links' }));
        await press(page.getByRole('button', { name: '‹/› Code' }));
        const drawer = page.getByRole('region', { name: 'Code' });
        await see(drawer).toBeVisible();
        await press(drawer.getByRole('tab', { name: 'JavaScript' }));
        await see(drawer.locator('code')).toContainText('schedules: {');
        await see(drawer.locator('code')).toContainText("timeZone: 'Europe/Berlin'");
        await see(drawer.locator('code')).toContainText('length: 45');
        await press(drawer.getByRole('tab', { name: 'Your source' }));
        await see(drawer.locator('code')).toContainText('async slots({ schedule, from, to, timeZone, recordId, values })');
      },
    },
  ],
};
