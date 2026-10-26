import { expect } from '../../fixtures';
import type { DemoReplay } from '../hand';

/** The customer-toast demo's how-to steps, replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  steps: [
    {
      says: 'Change a field and press Save: watch the corner of the page.',
      async run({ page, press, type, see }) {
        await type(page.getByRole('textbox', { name: 'Website' }), 'niletraders.example');
        await press(page.getByRole('button', { name: 'Save', exact: true }));
        const toast = page.locator('.fd-toast');
        await see(toast.locator('.fd-status')).toHaveText('Saved');
        await see(toast).toBeInViewport();
        // In the corner: at the window's foot and its end.
        const box = (await toast.boundingBox())!;
        const view = page.viewportSize()!;
        expect(view.width - (box.x + box.width)).toBeLessThan(40);
        expect(view.height - (box.y + box.height)).toBeLessThan(40);
        // And gone again, on its own.
        await see(toast).toBeHidden({ timeout: 8000 });
      },
    },
  ],
};
