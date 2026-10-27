import { expect, test } from './fixtures';

/**
 * Braces a page quotes, as people meet them (0.35.2): a step studio's words written with `Fieldia.literalWords` —
 * `{list}`, `{method:value}`, an Arabic `{{customer}}` — in a field's label and help, a choice, a button's question, an
 * ending and the page's head on paper, each shown exactly as written, never as a value or with its backslash, in the
 * one-tag script, in each engine.
 */

const WORDS = {
  label: 'Written from its settings: {list}',
  help: '{method:value} as it is stored',
  choice: '… {{customer}} في القالب',
  confirm: 'Send "{added:member} added · {failed} failed"?',
  title: 'Sent: {list} is kept',
  text: '={{ $json.customer }} \\{x}',
  header: 'Values for the {placeholders} in the action’s address',
};

test('a page’s words written with literalWords show exactly as written, wherever they are drawn', async ({ page }) => {
  await page.goto('/script/');
  await page.waitForFunction(() => 'Fieldia' in window);
  await page.evaluate(async (words) => {
    const W = window as any;
    const literal = W.Fieldia.literalWords as (text: string) => string;
    const host = document.createElement('div');
    host.id = 'literal';
    document.body.prepend(host);
    // The browser's own print dialog stays shut: the page is laid out for paper all the same.
    window.print = () => undefined;
    const handle = W.Fieldia.mountViewer(host, {
      page: {
        fieldia: '0.13',
        id: 'step-studio',
        data: { kind: 'responses' },
        print: { header: literal(words.header) },
        fields: {
          list: { type: 'char', label: literal(words.label), help: literal(words.help) },
          kind: { type: 'selection', label: 'Kind', options: [{ value: 'a', label: literal(words.choice) }] },
        },
        layout: {
          type: 'sections',
          id: 'r',
          children: [
            { type: 'field', id: 'f-list', field: 'list' },
            { type: 'field', id: 'f-kind', field: 'kind', widget: 'radio' },
            { type: 'button', id: 'b-send', label: 'Send', confirm: literal(words.confirm), steps: [{ do: 'say', message: 'Sent' }] },
          ],
        },
        endings: [{ title: literal(words.title), text: literal(words.text), again: false }],
      },
      dataSource: W.Fieldia.createMemoryDataSource({ submitted: () => ({ id: 'R-1' }) }),
    });
    W.literalHandle = handle;
    await handle.drawn;
  }, WORDS);
  const form = page.locator('#literal');
  await expect(form.locator('[data-node="f-list"] .fd-label')).toHaveText(WORDS.label);
  await expect(form.locator('[data-node="f-list"] .fd-help')).toHaveText(WORDS.help);
  await expect(form.locator('[data-node="f-kind"]').getByLabel(WORDS.choice)).toBeVisible();
  // The button's question, asked in a dialog, then not answered.
  await form.locator('[data-node="b-send"]').click();
  const dialog = page.getByRole('dialog').or(page.getByRole('alertdialog'));
  await expect(dialog).toContainText(WORDS.confirm);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  // On paper: the page's own head.
  await page.evaluate(() => (window as any).literalHandle.print());
  await expect(form.locator('.fd-print-head .fd-print-line').first()).toHaveText(WORDS.header);
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  // Sent: its ending.
  await form.locator('[data-node="f-list"] input').fill('Customers');
  await form.getByRole('button', { name: 'Submit' }).click();
  await expect(form.locator('.fd-done-title')).toHaveText(WORDS.title);
  await expect(form.locator('.fd-done-words')).toHaveText(WORDS.text);
  // Nowhere as they were written, with their backslashes.
  const written = await page.evaluate((words) => Object.values(words).map((text) => (window as any).Fieldia.literalWords(text) as string), WORDS);
  const read = (await form.textContent()) ?? '';
  expect(written.filter((text) => read.includes(text))).toEqual([]);
});
