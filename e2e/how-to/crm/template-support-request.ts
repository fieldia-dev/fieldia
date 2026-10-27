import { png } from '../../files-support';
import type { DemoReplay } from '../hand';

/** The template-support-request demo’s how-to steps, replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  steps: [
    {
      says: 'Choose Something is broken: Steps to make it',
      async run({ page, press, see }) {
        const steps = page.getByRole('textbox', { name: 'Steps to make it happen again' });
        await see(steps).toBeHidden();
        await press(page.getByRole('radio', { name: 'Something is broken' }));
        await see(page.getByRole('radio', { name: 'Something is broken' })).toBeChecked();
        await see(steps).toBeVisible();
      },
    },
    {
      says: 'Set how urgent it is with the stars, and attach',
      async run({ page, press, pick, see }) {
        const urgency = page.getByRole('radiogroup', { name: 'How urgent is it?' });
        await press(urgency.getByRole('radio', { name: 'Urgent' }));
        await see(urgency.getByRole('radio', { name: 'Urgent' })).toBeChecked();
        const file = page.locator('[data-node="f-file"]');
        await pick(file.locator('.fd-file-pick').getByText('Upload a file'), { name: 'screenshot.png', mimeType: 'image/png', buffer: png(640, 400) });
        await see(file.locator('.fd-files')).toContainText('screenshot.png');
      },
    },
  ],
};
