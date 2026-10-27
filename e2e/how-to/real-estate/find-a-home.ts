import { expect } from '../../fixtures';
import { follow } from './support-more';
import type { DemoReplay } from '../hand';

/** The find-a-home demo’s how-to steps, replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  steps: [
    {
      says: 'Type your name and press Enter: the next question',
      async run({ page, type, keys, see }) {
        const name = page.getByRole('textbox', { name: 'What is your name?' });
        await see(page.locator('.fd-flow-count')).toHaveText('Question 1 of 7');
        await type(name, 'Mona');
        await keys('Enter');
        // The next question alone on the screen, saying the name.
        await see(page.getByRole('radiogroup', { name: 'What are you looking for, Mona?' })).toBeVisible();
        await see(name).toBeHidden();
        await see(page.locator('.fd-flow-count')).toHaveText('Question 2 of 7');
      },
    },
    {
      says: 'Press B: “A villa” is picked, and the bedrooms come next',
      notOnPhone: 'a letter and Page Up: a phone has no keyboard while no box is typed in',
      async run({ page, keys, see }) {
        const kind = page.getByRole('radiogroup', { name: 'What are you looking for, Mona?' });
        await keys('b');
        await see(kind.getByRole('radio', { name: 'A villa' })).toBeChecked();
        // On by itself, a moment later.
        const bedrooms = page.getByRole('radiogroup', { name: 'How many bedrooms?' });
        await see(bedrooms).toBeVisible();
        await see(page.locator('.fd-flow-count')).toHaveText('Question 3 of 7');
        // Page Up goes back to the villa's question, its answer kept, and the bedrooms left unanswered (↑ on a focused
        // option moves among the options, as a radio's arrows do).
        await keys('PageUp');
        await see(kind).toBeVisible();
        await see(kind.getByRole('radio', { name: 'A villa' })).toBeChecked();
        await see(page.locator('.fd-flow-count')).toHaveText('Question 2 of 7');
        await see(bedrooms.getByRole('radio', { checked: true })).toHaveCount(0);
      },
    },
    {
      says: 'Pick “An office” instead: there are no bedrooms to ask',
      async run({ page, press, see }) {
        const kind = page.getByRole('radiogroup', { name: 'What are you looking for, Mona?' });
        await press(kind.getByText('An office'));
        await see(kind.getByRole('radio', { name: 'An office' })).toBeChecked();
        // On by itself, past the bedrooms: the areas, one question fewer in all.
        await see(page.getByRole('group', { name: 'Which areas suit you?' })).toBeVisible();
        await see(page.locator('.fd-flow-count')).toHaveText('Question 3 of 6');
        await see(page.getByRole('radiogroup', { name: 'How many bedrooms?' })).toHaveCount(0);
      },
    },
    {
      says: 'Tick two areas, then press OK: choosing several never goes on',
      async run({ page, press, see }) {
        const areas = page.getByRole('group', { name: 'Which areas suit you?' });
        await press(areas.getByText('New Cairo'));
        await press(areas.getByText('Maadi'));
        await see(areas.getByRole('checkbox', { name: 'New Cairo' })).toBeChecked();
        await see(areas.getByRole('checkbox', { name: 'Maadi' })).toBeChecked();
        // Still here, whatever the wait: two ticks went nowhere.
        await see(areas).toBeVisible();
        await see(page.locator('.fd-flow-count')).toHaveText('Question 3 of 6');
        await press(page.getByRole('button', { name: 'OK', exact: true }));
        await see(page.getByRole('radiogroup', { name: 'Your budget' })).toBeVisible();
        await see(page.locator('.fd-flow-count')).toHaveText('Question 4 of 6');
      },
    },
    {
      says: 'Answer the rest and press Submit: the ending thanks you by name',
      async run({ page, press, type, keys, see }) {
        await press(page.getByRole('radiogroup', { name: 'Your budget' }).getByText('EGP 5M to 10M'));
        const number = page.getByRole('textbox', { name: 'Which number should the agent call?' });
        await see(number).toBeVisible();
        await type(number, '0100 123 4567');
        await keys('Enter');
        const notes = page.getByRole('textbox', { name: 'Anything else we should know?' });
        await see(notes).toBeVisible();
        await type(notes, 'A garden, if we can.');
        await press(page.getByRole('button', { name: 'Submit' }));
        await see(page.locator('.fd-done-title')).toHaveText('Thank you, Mona');
      },
    },
    {
      says: 'See it in Arabic, right to left, or on a phone',
      async run(hand) {
        const { page, phone, see } = hand;
        await follow(hand, 'in Arabic, right to left');
        await see(page.locator('.fd-form').first()).toHaveAttribute('dir', 'rtl');
        await see(page.locator('.fd-flow-count')).toHaveText('السؤال 1 من 7');
        await see(page.getByRole('button', { name: 'موافق' })).toBeVisible();
        // On a phone: a window as narrow as one, nothing to scroll sideways (the phone's own is one already).
        if (!phone) await page.setViewportSize({ width: 390, height: 780 });
        await see(page.getByRole('textbox', { name: 'What is your name?' })).toBeInViewport();
        await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
      },
    },
  ],
};
