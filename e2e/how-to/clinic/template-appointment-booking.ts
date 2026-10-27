import type { Page } from '@playwright/test';
import { expect } from '../../fixtures';
import type { DemoReplay } from '../hand';

/** The booking's Day and time: its month's days (this month's alone), and the free times of the day picked. */
const bookingDays = (page: Page) => page.locator('[data-node="f-when"] .fd-slots-days button:not(.fd-outside)');
const bookingTimes = (page: Page) => page.locator('[data-node="f-when"] .fd-slots-chip');
const bookingSettled = (page: Page) => expect(page.locator('[data-node="f-when"] .fd-slots-days')).not.toHaveAttribute('aria-busy', 'true');
/** The day and time a booking is made for, as its ending writes them: "26 Oct 2026, 10:00". */
const booked: { day?: string; label?: string; time?: string } = {};

/** The template-appointment-booking demo’s how-to steps, replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  steps: [
    {
      says: 'Pick a service, then a day and one of its free times',
      async run({ page, press, type, see }) {
        await press(page.getByRole('radio', { name: 'First consultation, 30 min' }));
        await bookingSettled(page);
        // The days gone by are not offered: pressed, no time.
        const gone = bookingDays(page).and(page.locator('[data-state="past"]'));
        if (new Date().getDate() > 1) {
          await see(gone.first()).toBeVisible();
          for (const label of await gone.evaluateAll((days) => days.map((d) => d.getAttribute('aria-label') ?? ''))) expect(label).not.toMatch(/free time/);
          await press(gone.last());
          await see(bookingTimes(page)).toHaveCount(0);
        }
        // A day fully booked offers none of its times either.
        const full = bookingDays(page).and(page.locator('[aria-label$=", Fully booked"]'));
        if (await full.count()) {
          await press(full.first());
          await see(bookingTimes(page)).toHaveCount(0);
        }
        // The first day with free times, and its first time.
        const open = bookingDays(page).and(page.locator('[aria-label$=" free times"]')).first();
        booked.label = (await open.getAttribute('aria-label'))!;
        // Its day as each engine's Intl writes it: Chromium 156 with a comma after the weekday.
        const [, d, m, y] = booked.label.match(/^\w+,? (\d+) (\w+) (\d{4})/)!;
        booked.day = `${d} ${m.slice(0, 3)} ${y}`;
        await press(open);
        await see(bookingTimes(page).first()).toBeVisible();
        const first = bookingTimes(page).first();
        booked.time = (await first.innerText()).trim();
        await press(first);
        await see(first).toHaveAttribute('aria-pressed', 'true');
        await type(page.getByRole('textbox', { name: '*Your name' }), 'Sara Hassan');
        await type(page.getByRole('textbox', { name: '*Phone' }), '+20 100 123 4567');
        await type(page.getByRole('textbox', { name: '*Email' }), 'sara@example.com');
        await see(page.getByRole('textbox', { name: '*Email' })).toHaveValue('sara@example.com');
      },
    },
    {
      says: 'Turn the reminder off and on: a switch',
      async run({ page, press, see }) {
        const reminder = page.getByRole('switch', { name: 'Text me a reminder the day before' });
        await see(reminder).toBeChecked();
        await see(page.getByRole('checkbox', { name: 'Text me a reminder the day before' })).toHaveCount(0);
        await press(reminder);
        await see(reminder).not.toBeChecked();
        await press(reminder);
        await see(reminder).toBeChecked();
      },
    },
    {
      says: "Book it: the page says your booking's reference, B-1043",
      async run({ page, press, see }) {
        await press(page.getByRole('radio', { name: 'Video call' }));
        await press(page.getByRole('button', { name: 'Submit' }));
        const ending = page.locator('.fd-done');
        await see(ending.locator('.fd-done-title')).toHaveText('You are booked, Sara Hassan');
        await see(ending.locator('.fd-done-words')).toHaveText([
          'Your booking is B-1043: First consultation, 30 min, by video call.',
          `We call you on ${booked.day}, ${booked.time}: the link to join comes to sara@example.com an hour before.`,
        ]);
      },
    },
    {
      says: 'Press Book another and pick the same service and day',
      async run({ page, press, see }) {
        await press(page.getByRole('button', { name: 'Book another' }));
        await see(page.locator('.fd-done')).toBeHidden();
        await press(page.getByRole('radio', { name: 'First consultation, 30 min' }));
        await bookingSettled(page);
        const [, d] = booked.label!.match(/^\w+,? (\d+) /)!;
        await press(bookingDays(page).filter({ hasText: new RegExp(`^${d}$`) }));
        await see(bookingTimes(page).first()).toBeVisible();
        await see(bookingTimes(page).filter({ hasText: new RegExp(`^${booked.time}$`) })).toHaveCount(0);
      },
    },
  ],
};
