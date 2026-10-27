import { expect } from '../../fixtures';
import type { DemoReplay } from '../hand';

/** The template-patient-intake demo’s how-to steps, replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  steps: [
    {
      says: 'On Your health, turn on I have allergies',
      async run({ page, press, type, keys, see }) {
        // About you first, as the form asks: its required answers, then Next.
        await type(page.getByRole('textbox', { name: '*Full name' }), 'Mona Adel');
        await type(page.getByRole('textbox', { name: '*Date of birth' }), '12/04/1991');
        await keys('Tab');
        await type(page.getByRole('textbox', { name: '*Phone' }), '01001234567');
        await press(page.getByRole('button', { name: 'Next', exact: true }));
        const health = page.getByRole('region', { name: 'Your health' });
        await see(health).toBeVisible();
        await see(health.getByRole('textbox', { name: /Which allergies/ })).toHaveCount(0);
        const allergies = health.getByRole('switch', { name: 'I have allergies' });
        await press(allergies);
        await see(allergies).toBeChecked();
        const box = health.getByRole('textbox', { name: '*Which allergies, and what happens?' });
        await see(box).toBeVisible();
        await see(box).toHaveAttribute('aria-required', 'true');
        // Required: Next with it empty asks for it.
        await press(page.getByRole('button', { name: 'Next', exact: true }));
        await see(health.getByText('Please answer “Which allergies, and what happens?”')).toBeVisible();
        await type(box, 'Penicillin: a rash');
      },
    },
    {
      says: 'On Consent, sign with the mouse or a finger',
      notOnPhone: 'a finger’s signature is a touch drag, which Playwright’s WebKit has none of',
      async run({ page, press, see }) {
        await press(page.getByRole('button', { name: 'Next', exact: true }));
        const consent = page.getByRole('region', { name: 'Consent' });
        await see(consent).toBeVisible();
        const signature = consent.getByRole('group', { name: '*Signature' });
        const pad = signature.locator('canvas');
        await pad.scrollIntoViewIfNeeded();
        const box = (await pad.boundingBox())!;
        await page.mouse.move(box.x + 30, box.y + box.height * 0.7);
        await page.mouse.down();
        for (const [x, y] of [[0.2, 0.35], [0.3, 0.75], [0.42, 0.3], [0.55, 0.7], [0.7, 0.4], [0.85, 0.6]]) await page.mouse.move(box.x + box.width * x, box.y + box.height * y, { steps: 6 });
        await page.mouse.up();
        await see(signature.getByRole('button', { name: 'Clear' })).toBeVisible();
        await expect.poll(() => page.evaluate(() => (window as any).fieldiaDemo.handle.form.getState().values.signature)).toBeTruthy();
      },
    },
  ],
};
