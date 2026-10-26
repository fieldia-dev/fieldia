import type { Locator } from '@playwright/test';
import type { DemoReplay, Hand } from '../hand';
import { node } from './support';

/** A day as a calendar's button names it: "Friday 30 October 2026". */
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const dayName = (day: Date) => `${DAYS[day.getDay()]} ${day.getDate()} ${MONTHS[day.getMonth()]} ${day.getFullYear()}`;
/** Today, `ahead` days on — then on to the first day that is one of `weekdays` (0 Sunday … 6 Saturday). */
function dayAhead(ahead: number, weekdays: number[]): Date {
  const day = new Date();
  day.setHours(12, 0, 0, 0);
  day.setDate(day.getDate() + ahead);
  while (!weekdays.includes(day.getDay())) day.setDate(day.getDate() + 1);
  return day;
}
/** A day pressed in an open calendar, its months paged forward with › until the day is drawn. */
async function pickDay({ press, see }: Hand, calendar: Locator, day: Date) {
  const button = calendar.getByRole('button', { name: dayName(day), exact: true });
  for (let page = 0; page < 6 && !(await button.count()); page++) await press(calendar.getByRole('button', { name: 'Next month' }));
  await see(button).toBeVisible();
  await press(button);
}

/** The ranking's lines, in their order, by their words. */
const rankWords = (ranking: Locator) => ranking.locator('.fd-rank-words');

/** The kinds demo's how-to steps, replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  steps: [
    {
      says: 'Drag a slider, or move it with the arrow keys: its value shows beside it.',
      notOnPhone: 'a slider is dragged by a finger (Playwright’s WebKit has no touch drag) or moved by the arrow keys, which a phone has none of',
      async run({ page, drag, keys, see }) {
        const days = node(page, 'q-days');
        const slider = days.getByRole('slider');
        await see(days.locator('output')).toHaveText('Not answered');
        await slider.scrollIntoViewIfNeeded();
        const track = (await slider.boundingBox())!;
        // Its knob, a ring at the start while unanswered, carried most of the way along.
        await drag(days.locator('.fd-slider-ring'), { x: track.x + track.width * 0.82, y: track.y + track.height / 2 });
        await see(days.locator('output')).toHaveText('4');
        await see(slider).toHaveValue('4');
        await keys('ArrowLeft');
        await see(days.locator('output')).toHaveText('3');
        await see(slider).toHaveValue('3');
      },
    },
    {
      says: 'On Moving day, pick a Friday, or a day three months away',
      async run(hand) {
        const { page, press, see } = hand;
        const move = node(page, 'q-move-day');
        const box = move.getByRole('textbox', { name: 'Which day shall we move your things?' });
        await press(move.getByRole('button', { name: 'Choose a date' }));
        const calendar = move.getByRole('dialog');
        await see(calendar).toBeVisible();
        await pickDay(hand, calendar, dayAhead(1, [5]));
        await see(calendar.getByRole('status')).toHaveText('“Which day shall we move your things?” can’t be on a Friday or Saturday');
        await see(box).toHaveValue('');
        // A working day, three months on: past the two months it takes.
        await pickDay(hand, calendar, dayAhead(91, [0, 1, 2, 3, 4]));
        await see(calendar.getByRole('status')).toHaveText(/^“Which day shall we move your things\?” can’t be after \d+ \w+ \d{4}$/);
        await see(box).toHaveValue('');
        // Put away by the button that opened it.
        await press(move.getByRole('button', { name: 'Choose a date' }));
        await see(calendar).toBeHidden();
      },
    },
    {
      says: 'Type a phone number with too few digits and leave it',
      async run({ page, press, type, see }) {
        const mobile = node(page, 'q-mobile');
        await type(mobile.getByRole('textbox', { name: 'A mobile number we can call on the day' }), '0100 12');
        await press(page.getByRole('textbox', { name: 'Roughly how heavy are your boxes?' }));
        await see(mobile).toContainText('Enter a phone number, like +20 100 123 4567');
      },
    },
    {
      says: 'Pick a desk by its picture, then put what matters most in order',
      async run({ page, phone, press, drag, keys, see }) {
        const desk = node(page, 'q-desk');
        await press(desk.getByRole('radio', { name: /Corner desk$/ }));
        await see(desk.getByRole('radio', { name: /Corner desk$/ })).toBeChecked();
        const ranking = node(page, 'q-priorities');
        await ranking.scrollIntoViewIfNeeded();
        // Shown in an order of its own each time: read as it stands.
        const start = await rankWords(ranking).allTextContents();
        const said = ranking.locator('.fd-announce');
        if (phone) {
          // A finger: Playwright's WebKit has no touch drag, and a phone no Alt key — each line's ↑ and ↓ are its way.
          await press(ranking.getByRole('button', { name: `Move ${start[2]} up` }));
          await see(rankWords(ranking)).toHaveText([start[0], start[2], start[1], start[3], start[4]]);
          await see(said).toHaveText(`${start[2]} moved to place 2 of 5`);
          return;
        }
        // Alt and the arrows: Tab on from the desk to the ranking's first line, then Alt+↓.
        for (let tab = 0; tab < 8 && !(await ranking.locator('button:focus').count()); tab++) await keys('Tab');
        await see(ranking.getByRole('button', { name: `Move ${start[0]} down` })).toBeFocused();
        await keys('Alt+ArrowDown');
        await see(rankWords(ranking)).toHaveText([start[1], start[0], start[2], start[3], start[4]]);
        await see(said).toHaveText(`${start[0]} moved to place 2 of 5`);
        // Dragging: the first line carried by its grip to below the third.
        const third = (await ranking.locator('.fd-rank-item').nth(2).boundingBox())!;
        const grip = ranking.locator('.fd-rank-grip').first();
        const from = (await grip.boundingBox())!;
        await drag(grip, { x: from.x + from.width / 2, y: third.y + third.height * 0.8 });
        await see(rankWords(ranking)).toHaveText([start[0], start[2], start[1], start[3], start[4]]);
        await see(said).toHaveText(`${start[1]} moved to place 3 of 5`);
      },
    },
    {
      says: 'Add a person who moves with you: each one is a small card of its own.',
      async run({ page, press, see }) {
        const movers = node(page, 'q-movers');
        const add = movers.getByRole('button', { name: 'Add a person' });
        await press(add);
        const first = movers.getByRole('group', { name: 'Person 1' });
        await see(first.getByRole('textbox', { name: 'Name' })).toBeFocused();
        await page.keyboard.type('Omar', { delay: 15 });
        await press(add);
        const second = movers.getByRole('group', { name: 'Person 2' });
        await see(second.getByRole('textbox', { name: 'Name' })).toBeFocused();
        await page.keyboard.type('Laila', { delay: 15 });
        await see(movers.locator('.fd-repeat-card')).toHaveCount(2);
        await see(first.getByRole('textbox', { name: 'Name' })).toHaveValue('Omar');
        await see(second.getByRole('textbox', { name: 'Name' })).toHaveValue('Laila');
      },
    },
    {
      says: 'Sign with the mouse or a finger, or type your name instead.',
      async run({ page, phone, press, drag, type, see }) {
        const signature = node(page, 'q-signature');
        const typed = signature.getByRole('textbox', { name: 'Or type your name' });
        const clear = signature.getByRole('button', { name: 'Clear' });
        if (!phone) {
          // Signed with the mouse: a stroke across the pad.
          const pad = signature.locator('canvas');
          await pad.scrollIntoViewIfNeeded();
          const box = (await pad.boundingBox())!;
          await drag(pad, { x: box.x + box.width * 0.85, y: box.y + box.height * 0.3 });
          await see(signature.locator('.fd-signature-hint')).toBeHidden();
          await see(clear).toBeVisible();
          await see(typed).toHaveValue('');
          // Or the name typed instead: cleared first, the cursor then waiting in its box.
          await press(clear);
          await see(typed).toBeFocused();
        }
        // A finger's stroke is a touch drag, which Playwright's WebKit has none of: the phone types the name.
        await type(typed, 'Sara Hassan');
        await see(typed).toHaveValue('Sara Hassan');
        await see(signature.locator('.fd-signature-hint')).toBeHidden();
        await see(clear).toBeVisible();
      },
    },
  ],
};
