import { expect } from '../../fixtures';
import type { DemoReplay } from '../hand';
import { atTheTop } from './support';

/** The code demo's how-to steps, replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  steps: [
    {
      says: 'Press VS Code at the top: every field is drawn in VS Code’s editor.',
      async run(hand) {
        const { page, see, seePage } = hand;
        await atTheTop(hand, 'Editor', 'VS Code');
        await seePage().toHaveURL(/editor=monaco/);
        await see(page.locator('.monaco-editor')).toHaveCount(11);
        await see(page.locator('.cm-editor')).toHaveCount(0);
        await see(page.getByRole('textbox', { name: 'Cleanup script' })).toBeVisible();
        await atTheTop(hand, 'Editor', 'CodeMirror');
        await seePage().toHaveURL(/editor=codemirror/);
        await see(page.locator('.cm-editor')).toHaveCount(11);
        await see(page.locator('.monaco-editor')).toHaveCount(0);
        await see(page.getByRole('textbox', { name: 'Webhook handler' })).toBeVisible();
      },
    },
    {
      says: 'Type in the cleanup script: Python’s keywords take their colour as you type.',
      async run({ page, press, keys, see }) {
        const script = page.locator('[data-field="script"] .cm-editor');
        const last = script.locator('.cm-line').last();
        await see(last).toHaveText('    return len(orders)');
        // At the end of its last line, past its words, and a new line.
        const line = (await last.boundingBox())!;
        await press(last, { position: { x: line.width - 4, y: line.height / 2 } });
        await keys('Enter');
        await page.keyboard.type('yield orders', { delay: 15 });
        // Python's keyword in the keywords' red as it is typed; the words after it in the text's own colour.
        const typed = script.locator('.cm-line').last();
        await see(typed).toHaveText(/yield orders$/);
        await see(typed.getByText('yield', { exact: true })).toHaveCSS('color', 'rgb(207, 34, 46)');
        await see(script.locator('.cm-line').filter({ hasText: 'return len(orders)' }).getByText('return', { exact: true })).toHaveCSS('color', 'rgb(207, 34, 46)');
      },
    },
    {
      says: 'Press Tab in any editor: the focus moves on to the next field',
      notOnPhone: 'a phone’s keyboard has no Tab key',
      async run({ page, keys, see }) {
        const script = page.getByRole('textbox', { name: 'Cleanup script' });
        await see(script).toBeFocused();
        const before = await script.textContent();
        await keys('Tab');
        await see(page.getByRole('textbox', { name: 'Badge styles' })).toBeFocused();
        await see(script).toHaveText(before!);
        await keys('Tab');
        await see(page.getByRole('textbox', { name: 'Runner settings' })).toBeFocused();
      },
    },
    {
      says: 'Break the sample payload’s JSON: it says so, and keeps the last good value.',
      async run({ page, press, see }) {
        const payload = page.locator('[data-field="payload"]');
        const before = await page.evaluate(() => JSON.stringify((window as any).fieldiaDemo.handle.form.getState().values.payload));
        const last = payload.locator('.cm-line').last();
        const line = (await last.boundingBox())!;
        await press(last, { position: { x: line.width - 4, y: line.height / 2 } });
        await page.keyboard.type(',', { delay: 15 });
        await see(payload.getByRole('alert')).toHaveText(/^Not valid JSON: line \d+, column \d+$/);
        expect(await page.evaluate(() => JSON.stringify((window as any).fieldiaDemo.handle.form.getState().values.payload))).toBe(before);
      },
    },
    {
      says: 'Press Both at the top, then click in the webhook handler and press Ctrl+F',
      notOnPhone: 'a phone has no Ctrl key',
      async run(hand) {
        const { page, press, keys, mod, see, seePage } = hand;
        // Each field where it fits again: the handler back in VS Code's editor.
        await atTheTop(hand, 'Editor', 'Both');
        await seePage().toHaveURL(/editor=both/);
        await see(page.locator('.monaco-editor')).toHaveCount(4);
        const handler = page.locator('[data-field="handler"]');
        // In the code, where its lines are drawn.
        await press(handler.locator('.monaco-editor .view-lines'));
        await see(handler.getByRole('textbox', { name: 'Webhook handler' })).toBeFocused();
        await keys(`${mod}+F`);
        await see(handler.locator('.monaco-editor .find-widget')).toBeVisible();
        await page.keyboard.type('notify', { delay: 15 });
        await see(handler.locator('.find-widget')).toContainText('1 of 1');
      },
    },
  ],
};
