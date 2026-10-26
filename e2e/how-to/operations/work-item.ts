import { expect } from '../../fixtures';
import type { DemoReplay } from '../hand';

/** The work-item demo's how-to steps, replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  steps: [
    {
      says: 'Point at Area: a light box and its chevron appear, and nothing moves',
      async run({ page, press, hover, see, phone }) {
        const area = page.locator('[data-node="f-area"] select');
        const clear = 'rgba(0, 0, 0, 0)';
        await see(area).toHaveCSS('border-top-color', clear);
        if (!phone) {
          const where = () => Promise.all([area, page.locator('[data-node="f-iteration"] select'), page.locator('[data-node="f-area"] .fd-label')].map((part) => part.boundingBox()));
          const before = await where();
          await hover(area);
          await see(area).not.toHaveCSS('border-top-color', clear);
          await see(area).toHaveCSS('background-image', /linear-gradient/);
          expect(await where()).toEqual(before);
          await see(area).not.toBeFocused();
        }
        // Clicked (tapped, on the phone, which has no pointer to point with): its options, the browser's own list.
        await press(area);
        await see(area).toBeFocused();
        if (!phone) await expect.poll(() => area.evaluate((box) => box.matches(':open'))).toBe(true);
        await see(area).toHaveValue(/./);
      },
    },
    {
      says: 'Click State and pick Active from its dots: Reason, locked while',
      async run({ page, press, keys, see, phone }) {
        // Area's list, left open by the step before, closed (a phone's picker closes as the next tap lands).
        if (!phone && (await page.locator('[data-node="f-area"] select').evaluate((box) => box === document.activeElement))) await keys('Escape');
        const reason = page.locator('[data-node="f-reason"]');
        await see(reason.locator('button.fd-lock')).toBeVisible();
        await see(reason.locator('select')).toBeDisabled();
        await press(page.locator('[data-node="f-state"] .fd-dot-button'));
        const menu = page.getByRole('menu', { name: 'State' });
        await see(menu).toBeVisible();
        await see(menu.getByRole('menuitemradio', { name: 'Resolved' })).toHaveAttribute('aria-checked', 'true');
        await press(menu.getByRole('menuitemradio', { name: 'Active' }));
        await see(menu).toBeHidden();
        await see(page.locator('[data-node="f-state"] .fd-dot-label')).toHaveText('Active');
        await see(reason.locator('button.fd-lock')).toBeHidden();
        await see(reason.locator('select')).toBeEnabled();
      },
    },
    {
      says: 'Point at the lock by Reason while the bug is Resolved: it says why',
      async run({ page, press, hover, see, phone }) {
        // Resolved again, as the step has it.
        await press(page.locator('[data-node="f-state"] .fd-dot-button'));
        await press(page.getByRole('menu', { name: 'State' }).getByRole('menuitemradio', { name: 'Resolved' }));
        const reason = page.locator('[data-node="f-reason"]');
        const lock = reason.locator('button.fd-lock');
        const why = reason.getByRole('tooltip');
        await see(lock).toBeVisible();
        await see(why).toBeHidden();
        // Pointed at; on the phone, which has no pointer, the lock tapped.
        if (phone) await press(lock);
        else await hover(lock);
        await see(why).toBeVisible();
        await see(why).toHaveText('Set by the workflow when the bug is resolved');
      },
    },
    {
      says: 'Press Tab through the header: each field shows its editor with',
      notOnPhone: 'a phone has no Tab key: a tap opens each field’s editor there',
      async run({ page, press, type, keys, see }) {
        const ring = / 0px 0px 0px 1px$/;
        const title = page.locator('[data-node="f-title"] input');
        await press(title);
        await see(title).toHaveCSS('box-shadow', ring);
        await keys('Tab');
        await see(page.locator('[data-node="f-state"] .fd-dot-button')).toBeFocused();
        await see(page.locator('[data-node="f-state"] .fd-dot-box')).toHaveCSS('box-shadow', ring);
        for (const id of ['f-area', 'f-reason', 'f-iteration']) {
          await keys('Tab');
          if (id === 'f-reason') {
            // Locked while the bug is resolved: its lock takes the focus, and says why.
            await see(page.locator('[data-node="f-reason"] button.fd-lock')).toBeFocused();
            await see(page.locator('[data-node="f-reason"]').getByRole('tooltip')).toBeVisible();
            continue;
          }
          const box = page.locator(`[data-node="${id}"] select`);
          await see(box).toBeFocused();
          await see(box).toHaveCSS('box-shadow', ring);
          await see(box).not.toHaveCSS('border-top-color', 'rgba(0, 0, 0, 0)');
        }
        await keys('Tab');
        const assigned = page.locator('[data-node="f-assigned"] input');
        await see(assigned).toBeFocused();
        await see(assigned).toHaveCSS('box-shadow', ring);
        // Escape puts back what the field held.
        const held = await title.inputValue();
        await type(title, ' — again');
        await see(title).toHaveValue(`${held} — again`);
        await keys('Escape');
        await see(title).toHaveValue(held);
      },
    },
    {
      says: 'Pick Underline or Outlined above the form: every field is a box',
      async run({ page, press, see, phone }) {
        const look = async (name: string) => {
          if (phone) await press(page.getByRole('button', { name: 'Framework, look and links' }));
          await press(page.getByRole('navigation', { name: 'Look' }).getByRole('link', { name }));
        };
        const form = page.locator('.fd-form').first();
        const header = ['f-state', 'f-area', 'f-iteration', 'f-priority'].map((id) => page.locator(`[data-node="${id}"]`));
        await look('Outlined');
        await see(form).toHaveAttribute('data-fd-skin', 'outlined');
        for (const field of header) await see(field).not.toHaveAttribute('data-quiet');
        await see(page.locator('[data-node="f-area"] select')).not.toHaveCSS('border-top-color', 'rgba(0, 0, 0, 0)');
        await look('Quiet');
        await see(form).toHaveAttribute('data-fd-skin', 'quiet');
        for (const field of header) await see(field).toHaveAttribute('data-quiet', '');
        await see(page.locator('[data-node="f-area"] select')).toHaveCSS('border-top-color', 'rgba(0, 0, 0, 0)');
      },
    },
  ],
};
