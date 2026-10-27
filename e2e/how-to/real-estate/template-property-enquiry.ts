import { node } from './support-more';
import type { DemoReplay } from '../hand';

/** The template-property-enquiry demo’s how-to steps, replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  steps: [
    {
      says: 'Choose Rent: Budget gives way to Monthly rent up to',
      async run({ page, press, see }) {
        await see(page.getByRole('textbox', { name: 'Budget' })).toBeVisible();
        await press(page.getByRole('radio', { name: 'Rent' }));
        await see(page.getByRole('radio', { name: 'Rent' })).toBeChecked();
        await see(page.getByRole('textbox', { name: 'Budget' })).toBeHidden();
        await see(page.getByRole('textbox', { name: 'Monthly rent up to' })).toBeVisible();
      },
    },
    {
      says: 'Slide Bedrooms, then turn on I would like to arrange a viewing',
      async run({ page, press, drag, phone, see }) {
        const bedrooms = page.getByRole('slider', { name: 'Bedrooms' });
        await see(bedrooms).toHaveValue('2');
        // Slid from its knob at 2 to four of its six; on the phone a finger put down there (Playwright's WebKit has no
        // touch drag), which a slider takes as a short slide.
        await bedrooms.scrollIntoViewIfNeeded();
        const box = (await bedrooms.boundingBox())!;
        if (phone) await press(bedrooms, { position: { x: box.width * 0.62, y: box.height / 2 } });
        else await drag(bedrooms, { x: box.x + box.width * 0.62, y: box.y + box.height / 2 });
        await see(bedrooms).toHaveValue('4');
        await see(node(page, 'f-bedrooms').locator('output')).toHaveText('4');
        const viewing = page.getByRole('switch', { name: 'I would like to arrange a viewing' });
        await press(viewing);
        await see(viewing).toBeChecked();
        await see(page.getByRole('textbox', { name: 'A good day for a viewing' })).toBeVisible();
      },
    },
  ],
};
