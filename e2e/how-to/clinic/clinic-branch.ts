import type { DemoReplay } from '../hand';

/** The clinic-branch demo’s how-to steps, replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  steps: [
    {
      says: 'Tick Friday open: it takes Thursday’s hours',
      async run({ page, press, see }) {
        const hours = page.getByRole('group', { name: 'Opening hours' });
        const words = hours.locator('.fd-hours-words');
        await see(words).toHaveText('Sat–Wed 10:00–14:00, 15:00–20:00 · Thu 10:00–16:00 · Fri closed');
        const friday = hours.getByRole('group', { name: 'Friday' });
        await press(friday.getByRole('checkbox', { name: 'Open on Friday' }));
        await see(friday.getByRole('textbox', { name: 'Friday: opens' })).toHaveValue('10:00');
        await see(friday.getByRole('textbox', { name: 'Friday: closes' })).toHaveValue('16:00');
        await see(words).toHaveText('Sat–Wed 10:00–14:00, 15:00–20:00 · Thu–Fri 10:00–16:00');
        await press(friday.getByRole('checkbox', { name: 'Open on Friday' }));
        await see(friday).toContainText('Closed');
        await see(words).toHaveText('Sat–Wed 10:00–14:00, 15:00–20:00 · Thu 10:00–16:00 · Fri closed');
      },
    },
    {
      says: 'On Monday, press Copy to all days',
      async run({ page, press, see }) {
        const hours = page.getByRole('group', { name: 'Opening hours' });
        await press(hours.getByRole('group', { name: 'Monday' }).getByRole('button', { name: 'Copy to all days' }));
        await see(hours.locator('.fd-hours-words')).toHaveText('Sat–Fri 10:00–14:00, 15:00–20:00');
        await see(hours.getByRole('status')).toHaveText('Monday’s hours copied to every day');
        // Thursday's one shift and Friday, closed, as Monday is now.
        for (const day of ['Thursday', 'Friday']) {
          const group = hours.getByRole('group', { name: day });
          await see(group.getByRole('checkbox', { name: `Open on ${day}` })).toBeChecked();
          await see(group.getByRole('textbox', { name: `${day}: opens` })).toHaveCount(2);
          await see(group.getByRole('textbox', { name: `${day}: closes` }).nth(1)).toHaveValue('20:00');
        }
      },
    },
    {
      says: 'On Saturday, press Add a break on a long shift',
      async run({ page, press, see }) {
        const hours = page.getByRole('group', { name: 'Opening hours' });
        const saturday = hours.getByRole('group', { name: 'Saturday' });
        await press(saturday.getByRole('button', { name: 'Add a break' }));
        // The longer shift, 15:00–20:00, split with an hour at its middle.
        await see(hours.locator('.fd-hours-words')).toHaveText('Sat 10:00–14:00, 15:00–17:00, 18:00–20:00 · Sun–Fri 10:00–14:00, 15:00–20:00');
        await see(saturday.getByRole('textbox', { name: 'Saturday: opens' })).toHaveCount(3);
        await see(saturday.getByRole('textbox', { name: 'Saturday: closes' }).nth(1)).toHaveValue('17:00');
        await see(saturday.getByRole('textbox', { name: 'Saturday: opens' }).nth(2)).toHaveValue('18:00');
      },
    },
    {
      says: 'Type 21:00 as a shift’s start before its end',
      async run({ page, type, keys, press, see }) {
        const hours = page.getByRole('group', { name: 'Opening hours' });
        const sunday = hours.getByRole('group', { name: 'Sunday' });
        await type(sunday.getByRole('textbox', { name: 'Sunday: opens' }).nth(1), '21:00', { clear: true });
        await keys('Tab');
        await see(sunday.locator('.fd-hours-error')).toHaveText('Sunday: 21:00–20:00 ends before it starts');
        await press(page.getByRole('button', { name: 'Save', exact: true }));
        await see(page.locator('.fd-announce')).toHaveText('Not saved. Check: Opening hours');
      },
    },
    {
      says: 'Pick a day under Booking: its times follow the hours',
      async run({ page, press, see }) {
        const booking = page.getByRole('group', { name: 'A visit, as patients book it' });
        // The next Saturday open for booking: its times are Saturday's, the break between 17:00 and 18:00 kept free. (A
        // day with its year as each engine's Intl writes it: Chromium 156 with a comma after the weekday.)
        const saturday = booking.getByRole('button', { name: /^Saturday,? \d+ \w+ \d{4}, 16 free times$/ }).first();
        await see(saturday).toBeVisible();
        await press(saturday);
        const times = booking.getByRole('group', { name: /^Free times on Saturday/ });
        await see(times.getByRole('button')).toHaveCount(16);
        await see(times.getByRole('button', { name: '16:30 to 17:00' })).toBeVisible();
        await see(times.getByRole('button', { name: '17:00 to 17:30' })).toHaveCount(0);
        await see(times.getByRole('button', { name: '18:00 to 18:30' })).toBeVisible();
        await see(times.getByRole('button', { name: '19:30 to 20:00' })).toBeVisible();
      },
    },
  ],
};
