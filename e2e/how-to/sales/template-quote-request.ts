import { expect } from '../../fixtures';
import type { DemoReplay } from '../hand';

/** The template-quote-request demo's how-to steps, replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  steps: [
    {
      says: 'Tick what you need, pick a budget and a date it is needed by',
      async run({ page, phone, press, type, keys, see }) {
        await press(page.getByRole('checkbox', { name: 'A website' }));
        await press(page.getByRole('checkbox', { name: 'Ongoing support' }));
        await see(page.getByRole('checkbox', { name: 'A website' })).toBeChecked();
        await see(page.getByRole('checkbox', { name: 'Ongoing support' })).toBeChecked();
        await see(page.getByRole('checkbox', { name: 'A mobile app' })).not.toBeChecked();
        await press(page.getByRole('radio', { name: '$10,000 – $50,000' }));
        await see(page.getByRole('radio', { name: '$10,000 – $50,000' })).toBeChecked();
        const needed = page.getByRole('textbox', { name: 'Needed by' });
        await type(needed, '15/12/2026');
        if (phone) await press(page.getByRole('textbox', { name: 'About the project' }));
        else await keys('Tab');
        await see(needed).toHaveValue('15 Dec 2026');
        await see(needed).toHaveAttribute('aria-invalid', 'false');
      },
    },
    {
      says: 'Attach a brief: a file next to the form\'s answers',
      async run({ page, pick, type, press, see, demo }) {
        await pick(page.locator('[data-node="f-attachment"]').getByText('Upload a file', { exact: true }), { name: 'Project brief.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n% a brief\n') });
        await see(page.getByText('Project brief.pdf')).toBeVisible();
        // Sent with the answers: the rest filled in, then Submit.
        await type(page.getByRole('textbox', { name: 'Company' }), 'Nile Traders');
        await type(page.getByRole('textbox', { name: 'Your name' }), 'Sara Adel');
        await type(page.getByRole('textbox', { name: 'Work email' }), 'sara@niletraders.example');
        await type(page.getByRole('textbox', { name: 'About the project' }), 'A shop in three languages.');
        await press(page.getByRole('button', { name: 'Submit' }));
        await see(page.locator('.fd-done')).toBeVisible();
        const sent = await demo<{ values: Record<string, unknown> }[]>('dataSource.responses');
        expect(sent).toHaveLength(1);
        expect(JSON.stringify(sent[0].values)).toContain('Project brief.pdf');
      },
    },
  ],
};
