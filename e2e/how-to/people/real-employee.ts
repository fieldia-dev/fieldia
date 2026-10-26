import type { DemoReplay } from '../hand';
import { choose } from './support';

/** “An employee’s file” (real-employee): its how-to replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  steps: [
    {
      says: 'Open Private Information and change Marital Status to Single',
      async run(hand) {
        const { page, press, see } = hand;
        await press(page.getByRole('tab', { name: 'Private Information' }));
        const spouse = page.getByRole('textbox', { name: 'Spouse Complete Name' });
        await see(spouse).toHaveValue('Tarek Mansour');
        await see(page.getByRole('textbox', { name: 'Spouse Birthdate' })).toBeVisible();
        await choose(hand, page.getByRole('combobox', { name: 'Marital Status' }), 'Single');
        await see(spouse).toBeHidden();
        await see(page.getByRole('textbox', { name: 'Spouse Birthdate' })).toBeHidden();
      },
    },
    {
      says: 'Pick another Department: the Manager follows it.',
      async run({ page, press, see }) {
        const manager = page.getByRole('combobox', { name: 'Manager' });
        await see(manager).toHaveValue('Dr. Rania Fouad');
        await press(page.getByRole('combobox', { name: 'Department' }));
        await press(page.getByRole('option', { name: 'Front Desk', exact: true }));
        await see(page.getByRole('combobox', { name: 'Department' })).toHaveValue('Front Desk');
        await see(manager).toHaveValue('Mona Khalil');
      },
    },
    {
      says: 'Change Private Country: a region of another country is cleared',
      async run({ page, press, see }) {
        await press(page.getByRole('tab', { name: 'Private Information' }));
        const state = page.getByRole('combobox', { name: 'Private State' });
        await see(state).toHaveValue('Cairo');
        await press(page.getByRole('combobox', { name: 'Private Country' }));
        await press(page.getByRole('option', { name: 'Saudi Arabia', exact: true }));
        await see(page.getByRole('combobox', { name: 'Private Country' })).toHaveValue('Saudi Arabia');
        await see(state).toHaveValue('');
        // Its list: Saudi Arabia's regions alone.
        await press(state);
        await see(page.getByRole('listbox').last().getByRole('option')).toHaveText(['Riyadh']);
        await press(page.getByRole('option', { name: 'Riyadh', exact: true }));
        await see(state).toHaveValue('Riyadh');
      },
    },
    {
      says: 'In HR Settings, Salma has no Badge ID yet, so Generate is offered',
      async run({ page, press, see }) {
        await press(page.getByRole('tab', { name: 'HR Settings' }));
        const badge = page.getByRole('textbox', { name: 'Badge ID' });
        const generate = page.getByRole('button', { name: 'Generate' });
        const print = page.getByRole('button', { name: 'Print Badge' });
        await see(badge).toHaveValue('');
        await see(generate).toBeVisible();
        await see(print).toBeHidden();
        await press(generate);
        await see(badge).toHaveValue(/^041\d{9}$/);
        // Print Badge where Generate was.
        await see(generate).toBeHidden();
        await see(print).toBeVisible();
      },
    },
    {
      says: 'Press Launch Plan, pick Onboarding: the plan summary lists who does what.',
      async run({ page, press, see }) {
        await press(page.getByRole('button', { name: 'Launch Plan' }));
        const dialog = page.getByRole('dialog', { name: 'Launch Plan' });
        await see(dialog).toBeVisible();
        const plan = dialog.locator('[data-node="f-plan"]').getByRole('combobox');
        await press(plan);
        await page.keyboard.type('Onb', { delay: 15 });
        await press(dialog.getByRole('option', { name: 'Onboarding', exact: true }));
        await see(plan).toHaveValue('Onboarding');
        await see(dialog.locator('[data-node="f-summary"]')).toContainText('Setup IT materials: Ahmed Tawfik');
      },
    },
  ],
};
