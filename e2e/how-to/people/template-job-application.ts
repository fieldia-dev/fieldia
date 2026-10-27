import type { DemoReplay } from '../hand';
import { node, choose } from './support';

/** “Job application” (template-job-application): its how-to replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  steps: [
    {
      says: 'Press Next with the role empty: the step says what it needs',
      async run({ page, press, see }) {
        await press(page.getByRole('button', { name: 'Next' }));
        await see(page.getByText('Role is required')).toBeVisible();
        await see(page.getByText('Step 1 of 3')).toBeVisible();
        await see(page.getByRole('region', { name: 'The role' })).toBeVisible();
      },
    },
    {
      says: 'Fill in the three steps and send: Send my application finishes it.',
      async run(hand) {
        const { page, press, type, pick, see } = hand;
        await choose(hand, page.getByRole('combobox', { name: 'Role' }), 'Product designer');
        await see(page.getByText('Role is required')).toBeHidden();
        await press(page.getByRole('button', { name: 'Next' }));
        await see(page.getByRole('region', { name: 'About you' })).toBeVisible();
        await type(page.getByRole('textbox', { name: 'Full name' }), 'Laila Hassan');
        await type(page.getByRole('textbox', { name: 'Email' }), 'laila.hassan@example.com');
        await type(page.getByRole('textbox', { name: 'Phone' }), '+20 100 123 4567');
        await press(page.getByRole('button', { name: 'Next' }));
        await see(page.getByRole('region', { name: 'Experience' })).toBeVisible();
        await see(page.getByText('Step 3 of 3')).toBeVisible();
        await pick(page.getByText('Upload a file', { exact: true }), { name: 'Laila Hassan CV.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n% a CV\n') });
        await see(node(page, 'f-cv')).toContainText('Laila Hassan CV.pdf');
        await type(page.getByRole('textbox', { name: 'Years of experience' }), '6');
        await type(page.getByRole('textbox', { name: 'Why this role?' }), 'I design the forms people fill in at work.');
        await press(page.getByRole('button', { name: 'Send my application' }));
        await see(page.getByText('Thank you. Your answers were sent.')).toBeVisible();
        await see(page.getByRole('button', { name: 'Send my application' })).toBeHidden();
      },
    },
  ],
};
