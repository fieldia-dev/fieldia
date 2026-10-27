import type { Page } from '@playwright/test';
import { expect } from '../../fixtures';
import type { DemoReplay } from '../hand';

/** The booking desk's calendar: the line under its bar that says what was done, and the calendar done drawing. */
const said = (page: Page) => page.locator('.fd-cal-said');
const settled = (page: Page) => expect(page.locator('.fd-cal-body')).not.toHaveAttribute('aria-busy', 'true');

/** The booking-week demo’s how-to steps, replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  steps: [
    {
      says: 'Drag a booking to another day: it keeps its length',
      notOnPhone: 'a drag: Playwright’s WebKit has no touch drag, and the phone opens on the agenda, whose rows move with Move to…',
      async run({ page, drag, see }) {
        await settled(page);
        // The first day's first booking (Saturday's, else the next day that has one), carried along its row to the day after.
        const columns = page.locator('.fd-cal-col');
        let from = 0;
        while (from < 5 && !(await columns.nth(from).locator('.fd-cal-event').count())) from++;
        const next = columns.nth(from + 1);
        const booking = columns.nth(from).locator('.fd-cal-event').first();
        const was = (await booking.getAttribute('aria-label'))!;
        // Named with the words it shows first (WCAG 2.5.3, 0.36): "10:30 Sara Lotfy Mona Adel, Saturday 24 October, 10:30 to
        // 12:00" — its hour, who and the agent, then its day and times.
        const [, hour, who, agent, , times] = /^(\d\d:\d\d(?: – \d\d:\d\d)?) (.+) (Laila Hassan|Omar Fathy|Mona Adel), (\w+ \d+ \w+), (\d\d:\d\d to \d\d:\d\d)$/.exec(was)!;
        const day = (await next.getAttribute('aria-label'))!;
        const box = (await booking.boundingBox())!;
        const to = (await next.boundingBox())!;
        await drag(booking, { x: to.x + to.width / 2, y: box.y + box.height / 2 });
        await see(said(page)).toContainText(new RegExp(`^Moved ${who} to ${day.slice(0, 3)},? ${day.split(' ')[1]} ${day.split(' ')[2].slice(0, 3)}, ${times.slice(0, 5)}\\.`));
        await see(said(page).getByRole('button', { name: 'Undo' })).toBeVisible();
        await settled(page);
        // Its length kept: the same start and end, on the day after.
        await see(next.locator('.fd-cal-event').filter({ hasText: who }).first()).toHaveAccessibleName(`${hour} ${who} ${agent}, ${day}, ${times}`);
      },
    },
    {
      says: 'Press a day’s name over its column: that day',
      async run({ page, press, phone, see }) {
        // The phone opens on the agenda, which has no columns: its Week shows the days' names over theirs.
        if (phone) await press(page.getByRole('button', { name: 'Week', exact: true }));
        await settled(page);
        const name = (await page.locator('.fd-cal-col').nth(3).getAttribute('aria-label'))!;
        // Its head named with the words it shows too (0.36): "Saturday 24 October, Sat 24"; the title with its year as each
        // engine's Intl writes it (Chromium 156: a comma after the weekday).
        await press(page.getByRole('button', { name: new RegExp(`^${name}, \\w+ \\d+$`) }));
        await see(page.locator('.fd-cal-title')).toHaveText(new RegExp(`^${name.replace(' ', ',? ')} \\d{4}$`));
        await see(page.getByRole('button', { name: 'Day', exact: true })).toHaveAttribute('aria-pressed', 'true');
        await settled(page);
        // A column for each agent.
        await see(page.locator('.fd-cal-col')).toHaveCount(3);
        for (const agent of ['Laila Hassan', 'Omar Fathy', 'Mona Adel']) await see(page.locator(`.fd-cal-col[aria-label="${name}, ${agent}"]`)).toBeVisible();
      },
    },
    {
      says: 'Press the arrows beside Today to step a week back or on',
      async run({ page, press, keys, phone, see }) {
        // Back to the week first: the day's arrows step a day.
        await press(page.getByRole('button', { name: 'Week', exact: true }));
        await settled(page);
        const title = page.locator('.fd-cal-title');
        const week = (await title.textContent())!;
        await press(page.getByRole('button', { name: 'Next week' }));
        await settled(page);
        await see(title).not.toHaveText(week);
        const next = (await title.textContent())!;
        await press(page.getByRole('button', { name: 'Previous week' }));
        await settled(page);
        await see(title).toHaveText(week);
        if (phone) return; // Page Up and Page Down are a keyboard's: a phone has none
        // From the keyboard: Tab on to the slots, then Page Down and Page Up.
        for (let i = 0; i < 30 && !(await page.locator('.fd-cal-slot:focus').count()); i++) await keys('Tab');
        await see(page.locator('.fd-cal-slot:focus')).toHaveCount(1);
        await keys('PageDown');
        await see(title).toHaveText(next);
        await see(page.locator('.fd-cal-slot:focus')).toHaveCount(1);
        await keys('PageUp');
        await see(title).toHaveText(week);
      },
    },
    {
      says: 'Drag down across an empty afternoon: a booking opens',
      notOnPhone: 'a drag: Playwright’s WebKit has no touch drag (a phone’s finger presses one slot for a new booking)',
      async run({ page, drag, see }) {
        await settled(page);
        // An afternoon free from 15:00 to 16:00 in some day's column.
        const free = page.locator('.fd-cal-col').filter({ has: page.locator('.fd-cal-slot[data-minutes="900"][aria-label$=", free"]') }).filter({ has: page.locator('.fd-cal-slot[data-minutes="930"][aria-label$=", free"]') }).first();
        const from = free.locator('.fd-cal-slot[data-minutes="900"]');
        const to = free.locator('.fd-cal-slot[data-minutes="930"]');
        await drag(from, to);
        const dialog = page.getByRole('dialog', { name: 'New' });
        await see(dialog).toBeVisible();
        await see(dialog.locator('[data-node="f-start"] input')).toHaveValue(/, 15:00$/);
        await see(dialog.locator('[data-node="f-stop"] input')).toHaveValue(/, 16:00$/);
      },
    },
  ],
};
