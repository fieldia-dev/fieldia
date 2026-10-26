import { expect } from '../../fixtures';
import type { DemoReplay } from '../hand';
import { viewSource } from './support';

/** The script demo's how-to steps, replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  steps: [
    {
      says: 'Fill in the form and send it.',
      async run({ page, press, type, see, demo }) {
        await type(page.getByRole('textbox', { name: 'Your name' }), 'Sara Hassan');
        await type(page.getByRole('textbox', { name: 'Phone' }), '+20 100 123 4567');
        await press(page.getByRole('radio', { name: 'Afternoon' }));
        await press(page.getByRole('button', { name: 'Submit' }));
        await see(page.getByText('Thank you. Your answers were sent.')).toBeVisible();
        expect((await demo<{ values: Record<string, unknown> }[]>('dataSource.responses'))[0].values).toEqual({ name: 'Sara Hassan', phone: '+20 100 123 4567', when: 'afternoon' });
      },
    },
    {
      says: 'Read the page’s source: one script tag, a page as JSON, and one call.',
      notOnPhone: 'a phone’s browser has no View Source',
      async run({ page, see }) {
        const source = await viewSource(page);
        const lines = source.locator('body');
        // Fieldia in one script tag; the page as JSON; one call that shows it.
        await see(lines).toContainText('<script src="fieldia.js"></script>');
        await see(lines).toContainText('const page = {');
        await see(lines).toContainText("fieldia: '0.13',");
        await see(lines).toContainText("Fieldia.mountViewer(document.getElementById('app'), { page, dataSource");
        const text = (await lines.textContent())!;
        expect(text.match(/<script src="[^"]*fieldia[^"]*"/g)).toEqual(['<script src="fieldia.js"']);
        expect(text.match(/Fieldia\.mountViewer\(/g)).toHaveLength(1);
        await source.close();
      },
    },
  ],
};
