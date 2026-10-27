import { expect } from '../../fixtures';
import type { DemoReplay } from '../hand';

/** The treatment-course demo’s how-to steps, replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  steps: [
    {
      says: 'Under Sessions, type 1 in Every, tick Thursday too',
      async run({ page, press, type, keys, see }) {
        const sessions = page.locator('[data-node="f-sessions"]');
        const words = sessions.locator('.fd-repeat-words');
        await see(words).toHaveText('Every 2 weeks on Tuesday, 3 times');
        // Each box's number replaced as a person replaces it: chosen whole, deleted, the new one typed. The words are
        // checked softly — the steps after this one go on usefully whatever the rule reads — so the replay fails on
        // them and still replays the rest.
        await type(sessions.getByRole('textbox', { name: 'Every' }), '1', { clear: true });
        await keys('Tab');
        await expect.soft(sessions.getByRole('textbox', { name: 'Every' }), 'Every, emptied and typed in').toHaveValue('1');
        await expect.soft(words, 'the words once Every is 1').toHaveText('Every week on Tuesday, 3 times');
        await press(sessions.getByRole('button', { name: 'Thursday' }));
        await see(sessions.getByRole('button', { name: 'Thursday' })).toHaveAttribute('aria-pressed', 'true');
        const times = sessions.getByRole('textbox', { name: 'times', exact: true });
        await type(times, '6', { clear: true });
        await keys('Tab');
        await expect.soft(sessions.getByRole('combobox', { name: 'Ends' }).locator('option:checked'), 'Ends, its times emptied and typed in').toHaveText('After');
        await expect.soft(words, 'the step’s words').toHaveText('Every week on Tuesday and Thursday, 6 times');
        await see(sessions.getByRole('button', { name: 'Thursday' })).toHaveAttribute('aria-pressed', 'true');
      },
    },
    {
      says: 'Change the notes, then the price, then press Ctrl+Z',
      notOnPhone: 'Ctrl+Z and Ctrl+Shift+Z are keys a phone has none of',
      async run({ page, type, keys, mod, see }) {
        const notes = page.getByRole('textbox', { name: 'Notes' });
        const price = page.getByRole('textbox', { name: 'Course price' });
        const before = 'Forehead and frown lines. Review two weeks after each session.';
        await see(notes).toHaveValue(before);
        await type(notes, 'Moved to Thursdays.', { clear: true });
        await type(price, '11000', { clear: true });
        await see(price).toHaveValue('11000');
        await keys(`${mod}+Z`);
        await see(price).toHaveValue(/^9,?500\.00$/);
        await see(notes).toHaveValue('Moved to Thursdays.');
        await keys(`${mod}+Z`);
        await see(notes).toHaveValue(before);
        await see(price).toHaveValue(/^9,?500\.00$/);
        await keys(`${mod}+Shift+Z`);
        await see(notes).toHaveValue('Moved to Thursdays.');
        await keys(`${mod}+Shift+Z`);
        // Made again: the price as it was typed.
        await see(price).toHaveValue(/^11,?000\.00$/);
        await see(notes).toHaveValue('Moved to Thursdays.');
      },
    },
    {
      says: 'Press Mark done: “Course marked done”, with Undo',
      async run({ page, press, see }) {
        await press(page.getByRole('button', { name: 'Mark done' }));
        const toast = page.locator('.fd-say').filter({ hasText: 'Course marked done' });
        await see(toast).toBeVisible();
        await see(page.locator('.fd-statusbar [aria-current="step"]')).toHaveText('Done');
        await press(toast.getByRole('button', { name: 'Undo' }));
        await see(page.locator('.fd-say > span')).toHaveText(['Undone.']);
        await see(page.locator('.fd-statusbar [aria-current="step"]')).toHaveText('In progress');
        await see(page.getByRole('button', { name: 'Mark done' })).toBeVisible();
      },
    },
    {
      says: 'Press Mona opens this course over it',
      async run({ page, phone, press, type, see }) {
        await press(page.getByRole('button', { name: 'Mona opens this course' }));
        await see(page.locator('.fd-presence')).toContainText('Also here: Mona Adel');
        await see(page.locator('.fd-presence')).toContainText('MA');
        await press(page.getByRole('button', { name: 'Mona changes the price' }));
        await see(page.locator('.fd-say').filter({ hasText: 'Mona Adel changed Course price.' })).toBeVisible();
        // Her 500 more on the price the course was saved at: 9,500 on a phone, 11,000 once step 2 made it again (desktop).
        await see(page.getByRole('textbox', { name: 'Course price' })).toHaveValue(phone ? '10,000.00' : '11,500.00');
        // Typed in the notes first: her next change waits as a conflict.
        const notes = page.getByRole('textbox', { name: 'Notes' });
        await type(notes, 'Thursdays from next week.', { clear: true });
        await press(page.getByRole('button', { name: 'Mona changes the price' }));
        const conflict = page.locator('.fd-conflict');
        await see(conflict).toContainText('Mona Adel changed this course');
        await see(conflict.getByRole('button', { name: 'Reload' })).toBeVisible();
        await see(conflict.getByRole('button', { name: 'Keep mine' })).toBeVisible();
        await see(notes).toHaveValue('Thursdays from next week.');
      },
    },
    {
      says: 'Templates ▸ Save as template… keeps the course by a name',
      async run({ page, press, type, follow, see }) {
        await press(page.getByRole('button', { name: 'Templates' }));
        await press(page.getByRole('menuitem', { name: 'Save as template…' }));
        const dialog = page.getByRole('dialog', { name: 'Save as template…' });
        await type(dialog.getByRole('textbox', { name: 'Template name' }), 'Botox, Thursdays');
        await press(dialog.getByRole('button', { name: 'Save template' }));
        await see(page.locator('.fd-say').filter({ hasText: 'Template “Botox, Thursdays” saved.' })).toBeVisible();
        await follow('Start a new course');
        await see(page.getByRole('textbox', { name: 'Patient', exact: true })).toHaveValue('');
        await press(page.getByRole('button', { name: 'Templates' }));
        // The one kept by its name is there to start from, beside the clinic's.
        await see(page.getByRole('menuitem', { name: 'Botox, Thursdays' })).toBeVisible();
        await press(page.getByRole('menuitem', { name: 'Botox package' }));
        await see(page.locator('.fd-say').filter({ hasText: 'Started from “Botox package”.' })).toBeVisible();
        await see(page.getByRole('combobox', { name: 'Treatment' }).locator('option:checked')).toHaveText('Botox');
        await see(page.locator('[data-node="f-sessions"] .fd-repeat-words')).toHaveText('Every 2 weeks, 3 times');
        await see(page.getByRole('textbox', { name: 'Course price' })).toHaveValue('9,500.00');
        await see(page.getByRole('textbox', { name: 'Notes' })).toHaveValue('Review two weeks after each session.');
      },
    },
  ],
};
