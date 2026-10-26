import { expect } from '../../fixtures';
import type { DemoReplay } from '../hand';

/** The clinic-intake demo’s how-to steps, replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  steps: [
    {
      says: 'Fill in About you, press Next, and start on Your visit',
      async run({ page, press, type, keys, see }) {
        const step = page.locator('.fd-step:not([hidden]) .fd-step-title');
        await see(step).toHaveText('About you');
        await type(page.getByRole('textbox', { name: '*Full name' }), 'Karim Fathy');
        await type(page.getByRole('textbox', { name: '*Date of birth' }), '03/02/1990');
        await keys('Tab');
        await type(page.getByRole('textbox', { name: '*Mobile phone' }), '01001234567');
        await type(page.getByRole('textbox', { name: 'Email' }), 'karim@example.com');
        await press(page.getByRole('button', { name: 'Next', exact: true }));
        await see(step).toHaveText('Your visit');
        await see(page.getByText('Step 2 of 6')).toBeVisible();
        await type(page.locator('[data-node="f-reason"] textarea'), 'A cough that will not go.');
        await see(page.locator('[data-node="f-reason"] textarea')).toHaveValue('A cough that will not go.');
      },
    },
    {
      says: 'Press Continue later: your answers are saved',
      async run({ page, phone, press, see }) {
        await press(page.getByRole('button', { name: 'Continue later' }));
        await see(page.locator('.fd-later-title')).toHaveText('Your answers are saved');
        await see(page.locator('.fd-later-words')).toHaveText('To continue, open this link on this device or another:');
        await see(page.getByRole('textbox', { name: 'Link to continue' })).toHaveValue(/[?&]resume=draft-\d+/);
        // A desktop Chrome lets a page a person pressed write to the clipboard; the test's own Chromium refuses it
        // unless told it may, as a person's browser is.
        if (!phone) await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
        await press(page.getByRole('button', { name: 'Copy link' }));
        await see(page.getByRole('button', { name: 'Link copied' })).toBeVisible();
        await see(page.locator('.fd-announce')).toHaveText('Link copied');
      },
    },
    {
      says: 'Open the link in a new tab, as you would on your laptop',
      async run({ page, see }) {
        const link = await page.getByRole('textbox', { name: 'Link to continue' }).inputValue();
        const other = await page.context().newPage();
        const errors: string[] = [];
        other.on('pageerror', (error) => errors.push(error.message));
        other.on('console', (message) => message.type() === 'error' && errors.push(message.text()));
        await other.goto(link);
        await see(other.locator('.fd-step:not([hidden]) .fd-step-title')).toHaveText('Your visit');
        await see(other.locator('[data-node="f-reason"] textarea')).toHaveValue('A cough that will not go.');
        await other.getByRole('button', { name: 'Back', exact: true }).click();
        await see(other.getByRole('textbox', { name: '*Full name' })).toHaveValue('Karim Fathy');
        await see(other.getByRole('textbox', { name: '*Date of birth' })).toHaveValue('3 Feb 1990');
        await see(other.getByRole('textbox', { name: 'Email' })).toHaveValue('karim@example.com');
        expect(errors, 'the new tab’s console').toEqual([]);
        await other.close();
      },
    },
    {
      says: 'Continue Mona Adel’s intake, started on her phone',
      async run({ page, press, follow, see }) {
        await follow('Continue Mona Adel’s intake');
        const step = page.locator('.fd-step:not([hidden]) .fd-step-title');
        await see(step).toHaveText('Medical history');
        await press(page.getByRole('button', { name: 'Back', exact: true }));
        await see(step).toHaveText('Your visit');
        await see(page.locator('[data-node="f-reason"] textarea')).toHaveValue(/A check-up before starting/);
        await press(page.getByRole('button', { name: 'Back', exact: true }));
        await see(page.getByRole('textbox', { name: '*Full name' })).toHaveValue('Mona Adel');
      },
    },
    {
      says: 'Open a link to an intake that was sent already',
      async run({ page, follow, see }) {
        await follow('Open a link to an intake that was sent already');
        await see(page.locator('.fd-resume-missing')).toHaveText('These saved answers could not be found: they may have been sent already. The form starts empty.');
        await see(page.locator('.fd-step:not([hidden]) .fd-step-title')).toHaveText('About you');
        await see(page.getByRole('textbox', { name: '*Full name' })).toHaveValue('');
      },
    },
  ],
};
