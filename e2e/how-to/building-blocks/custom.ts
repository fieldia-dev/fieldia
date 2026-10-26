import type { DemoReplay } from '../hand';
import { node, atTheTop } from './support';

/** The custom demo's how-to steps, replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  steps: [
    {
      says: 'Type a name: the app’s own field shows the badge as it will be printed, as you type.',
      async run({ page, press, see }) {
        const badge = node(page, 'f-badge-name').locator('output');
        await see(badge).toBeHidden();
        await press(page.getByRole('textbox', { name: 'Name on the badge' }));
        await page.keyboard.type('Sa', { delay: 15 });
        await see(badge).toHaveText('SA');
        await page.keyboard.type('ra Hassan', { delay: 15 });
        await see(badge).toHaveText('SARA HASSAN');
        await see(badge).toBeVisible();
      },
    },
    {
      says: 'Press Print the badge in the desk below: its count is the desk’s own',
      async run({ page, press, type, see }) {
        const desk = node(page, 'note');
        await see(desk.locator('.demo-hello')).toHaveText('Ready to print the badge for Sara Hassan.');
        await press(desk.getByRole('button', { name: 'Print the badge' }));
        await see(desk.getByRole('button', { name: 'Print again (1 printed)' })).toBeVisible();
        // The form changes — another name, a speaker's badge — and the desk keeps its count; its words follow the name.
        await type(page.getByRole('textbox', { name: 'Name on the badge' }), 'Sam Adel', { clear: true });
        await press(page.getByRole('radio', { name: 'Speaker' }));
        await see(desk.locator('.demo-hello')).toHaveText('Ready to print the badge for Sam Adel.');
        await see(desk.getByRole('button', { name: 'Print again (1 printed)' })).toBeVisible();
      },
    },
    {
      says: 'Clear the name and press Submit: the app’s own field is checked like any other',
      async run({ page, press, see }) {
        const name = page.getByRole('textbox', { name: 'Name on the badge' });
        await press(name);
        // Emptied as a person empties a box: every letter taken back.
        for (let i = 0; i < 'Sam Adel'.length; i++) await page.keyboard.press('Backspace');
        await see(name).toHaveValue('');
        await press(page.getByRole('button', { name: 'Submit' }));
        await see(node(page, 'f-badge-name').locator('.fd-error')).toHaveText('Name on the badge is required');
        await see(page.locator('.fd-form').first()).toBeVisible();
      },
    },
    {
      says: 'Switch framework at the top: the same parts are written as React, Vue and Angular components.',
      async run(hand) {
        const { page, press, see, seePage } = hand;
        for (const [framework, folder] of [['React', 'react'], ['Vue', 'vue'], ['Angular', 'angular']]) {
          await atTheTop(hand, 'Framework', framework);
          await seePage().toHaveURL(new RegExp(`/${folder}/\\?page=custom`));
          const name = page.getByRole('textbox', { name: 'Name on the badge' });
          await see(name).toBeVisible();
          await press(name);
          await page.keyboard.type('Mona', { delay: 15 });
          await see(node(page, 'f-badge-name').locator('output')).toHaveText('MONA');
          const desk = node(page, 'note');
          await see(desk.locator('.demo-hello')).toHaveText('Ready to print the badge for Mona.');
          await press(desk.getByRole('button', { name: 'Print the badge' }));
          await see(desk.getByRole('button', { name: 'Print again (1 printed)' })).toBeVisible();
        }
      },
    },
  ],
};
