import { expect } from '../../fixtures';
import type { DemoReplay } from '../hand';
import { yourTab } from './support';

/** The viewer-role demo's how-to steps, replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  steps: [
    {
      says: 'Read the line over the lead: why Omar may only read it',
      async run({ page, see }) {
        const tab = page.getByRole('region', { name: 'Omar’s tab' });
        const note = tab.locator('.fd-read-only-note');
        await see(note).toHaveText('Omar is a viewer: he can read leads, but not change them.');
        await see(note).toHaveAttribute('role', 'status');
        // Over the lead: above its first field.
        const [line, lead] = [(await note.boundingBox())!, (await tab.getByRole('textbox', { name: 'Lead' }).boundingBox())!];
        expect(line.y).toBeLessThan(lead.y);
      },
    },
    {
      says: 'Click a field: nothing can be typed. Ctrl+Enter saves nothing.',
      async run({ page, phone, press, keys, mod, see, demo }) {
        const tab = page.getByRole('region', { name: 'Omar’s tab' });
        const field = tab.getByRole('textbox', { name: 'Phone' });
        await press(field);
        await page.keyboard.type('999', { delay: 15 });
        await see(field).toHaveValue('+20 100 123 4567');
        await see(field).toHaveAttribute('readonly', '');
        // A phone has no Ctrl key: there, the tap and the typing alone.
        if (!phone) {
          await keys(`${mod}+Enter`);
          await see(tab.getByRole('alertdialog')).toHaveCount(0);
          await see(tab.getByRole('button', { name: 'Save', exact: true })).toHaveCount(0);
          expect((await demo<{ method: string }[]>('dataSource.calls')).filter((call) => call.method === 'save')).toEqual([]);
        }
      },
    },
    {
      says: 'Open the gear: Brochure alone, as nothing else is Omar’s to do.',
      async run({ page, press, see }) {
        const tab = page.getByRole('region', { name: 'Omar’s tab' });
        await press(tab.getByRole('button', { name: 'Actions' }));
        await see(tab.getByRole('menu').getByRole('menuitem')).toHaveText(['Brochure']);
      },
    },
    {
      says: 'Press Agent at the top: the same lead as Sara sees it, open to change.',
      async run({ page, press, type, see, seePage }) {
        await press(page.getByRole('navigation', { name: 'Open as' }).getByRole('link', { name: 'Agent' }));
        await seePage().not.toHaveURL(/role=viewer/);
        const tab = yourTab(page);
        await see(tab.getByRole('heading', { name: 'Your tab · Sara, the agent' })).toBeVisible();
        await see(tab.getByRole('textbox', { name: 'Lead' })).toHaveValue('Villa in Sheikh Zayed');
        await see(tab.getByText(/viewer/)).toHaveCount(0);
        const phone = tab.getByRole('textbox', { name: 'Phone' });
        await see(phone).not.toHaveAttribute('readonly', '');
        await type(phone, '+20 100 123 9999', { clear: true });
        await see(phone).toHaveValue('+20 100 123 9999');
        await see(tab.getByRole('button', { name: 'Save', exact: true })).toBeVisible();
      },
    },
  ],
};
