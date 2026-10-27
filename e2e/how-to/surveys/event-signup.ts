import { expect } from '../../fixtures';
import type { DemoReplay } from '../hand';
import { ending, node } from './support';

/** The event-signup demo's how-to steps, replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  steps: [
    {
      says: 'Look at the sessions: the morning workshop has 2 places left',
      async run({ page, see }) {
        const session = node(page, 'f-session');
        await see(session.getByRole('radio', { name: /^Morning workshop/ })).toHaveAccessibleName(/2 left$/);
        await see(session.getByRole('radio', { name: /^Afternoon workshop/ })).toHaveAccessibleName(/Full$/);
        await see(node(page, 'f-extras').getByRole('checkbox', { name: /^A parking place/ })).toHaveAccessibleName(/Full$/);
      },
    },
    {
      says: 'Pick the afternoon workshop: “… is full”, under the question',
      async run({ page, press, see }) {
        const session = node(page, 'f-session');
        await press(session.getByRole('radio', { name: /^Afternoon workshop/ }));
        await see(session).toContainText('Afternoon workshop: selling off-plan (14:00) is full');
        await see(session.getByRole('radio', { name: /^Afternoon workshop/ })).not.toBeChecked();
        await see(session.getByRole('radio', { checked: true })).toHaveCount(0);
      },
    },
    {
      says: 'Pick the morning workshop, press “Two people sign up for the morning workshop” over the form',
      async run({ page, press, type, see, demo }) {
        const session = node(page, 'f-session');
        await press(session.getByRole('radio', { name: /^Morning workshop/ }));
        await see(session.getByRole('radio', { name: /^Morning workshop/ })).toBeChecked();
        await press(page.getByRole('button', { name: 'Two people sign up for the morning workshop' }));
        await type(page.getByRole('textbox', { name: 'Full name' }), 'Mona Adel');
        await type(page.getByRole('textbox', { name: 'Email' }), 'mona.adel@example.com');
        await press(page.getByRole('button', { name: 'Submit', exact: true }));
        await see(session).toContainText('Morning workshop: pricing a launch (10:00) is full now: choose another');
        await see(session.getByRole('radio', { name: /^Morning workshop/ })).toHaveAccessibleName(/Full$/);
        await see(ending(page)).toBeHidden();
        expect(await demo<unknown[]>('dataSource.responses')).toHaveLength(0);
      },
    },
    {
      says: 'Pick the evening talk and Submit: the page says your place and the email your ticket goes to',
      async run({ page, phone, press, see, demo }) {
        await press(node(page, 'f-session').getByRole('radio', { name: /^Evening talk/ }));
        await press(page.getByRole('button', { name: 'Submit', exact: true }));
        await see(ending(page).locator('.fd-done-title')).toHaveText('You are signed up, Mona Adel');
        await see(ending(page).locator('.fd-done-words')).toHaveText(['Your place is kept for Evening talk and dinner (19:00).', 'Your ticket goes to mona.adel@example.com. Show it at the door, on your phone or printed.']);
        await see(page.getByRole('button', { name: 'Submit another response' })).toBeHidden();
        expect(await demo<unknown[]>('dataSource.responses')).toHaveLength(1);
        // Reloaded: one from each person, so it says you sent yours, in place of the questions.
        await page.reload();
        await see(page.locator('.dh-title')).toHaveText('An event’s sign-up, with places and a closing date');
        await see(page.getByRole('main')).toContainText('You have sent your answers to this form already.');
        await see(page.getByRole('textbox', { name: 'Full name' })).toBeHidden();
        // Start over, at the end of the line under the demo's name: under Options on a phone.
        if (phone) await press(page.getByRole('button', { name: 'Framework, look and links' }));
        await press(page.getByRole('button', { name: 'Start over' }));
        await see(page.getByRole('textbox', { name: 'Full name' })).toBeVisible();
        await see(page.getByRole('textbox', { name: 'Full name' })).toHaveValue('');
        await see(ending(page)).toBeHidden();
      },
    },
    {
      says: 'Open it before sign-ups open: it says when it opens, in place of its questions.',
      async run({ page, follow, see }) {
        await follow('Open it before sign-ups open');
        const closed = page.locator('.fd-closed');
        await see(closed.locator('.fd-closed-title')).toHaveText(/^This form opens on \d+ \w+ 20\d\d, 09:00.*\.$/);
        await see(page.getByRole('textbox', { name: 'Full name' })).toBeHidden();
        await see(page.getByRole('radio')).toHaveCount(0);
      },
    },
    {
      says: 'Open it after they close: it says when it closed, and who to write to.',
      async run({ page, follow, see }) {
        await follow('Open it after they close');
        const closed = page.locator('.fd-closed');
        await see(closed.locator('.fd-closed-title')).toHaveText(/^This form closed on .+18:00/);
        await see(closed.locator('.fd-closed-message')).toHaveText('Missed it? Write to events@dawarly.example and we will tell you about the next one.');
        await see(page.getByRole('button', { name: 'Submit', exact: true })).toBeHidden();
      },
    },
  ],
};
