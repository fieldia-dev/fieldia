import { type Locator, type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { axeFindings } from './a11y-support';
import { watch } from './designer-support';
import { expectNoSidewaysScroll, open, screen } from './support';

/**
 * Code fields as a person uses them, in both editors on the plain demo's code
 * page (demos/shared/code-page.ts): CodeMirror (`@fieldia/code`) and VS
 * Code's editor (`@fieldia/monaco`). Code typed reaches the form; keywords take
 * their colour as they are typed; Tab moves on and never traps; read-only code
 * cannot be typed in; light, dark and Arabic; each language's grammar loaded
 * only where a page shows it; and, given workers, Monaco's JSON service.
 */

/** The code colours (libs/code/src/lib/palette.ts), as the browser computes them. */
const KEYWORD = { light: 'rgb(207, 34, 46)', dark: 'rgb(255, 123, 114)' };
// Numbers in orange: JSON's key, string and number each a colour of its own (libs/code/src/lib/palette.ts).
const LITERAL = { light: 'rgb(149, 56, 0)', dark: 'rgb(255, 166, 87)' };
const CODE = 'page=code&skin=outlined';

const mod = process.platform === 'darwin' ? 'Meta' : 'Control';
const field = (page: Page, name: string) => page.locator(`[data-field="${name}"]`);
const values = (page: Page) => page.evaluate(() => (window as any).fieldiaDemo.handle.form.getState().values as Record<string, unknown>);
/** The field the focus is in, by its name. */
const focusedField = (page: Page) => page.evaluate(() => (document.activeElement?.closest('[data-field]') as HTMLElement | null)?.dataset['field'] ?? null);

/** The code page, its editors drawn: CodeMirror's at once, Monaco's once it has loaded. */
async function openCode(page: Page, query = '') {
  const opened = await open(page, 'plain', `${CODE}${query}`);
  await expect(page.locator('.cm-editor')).toHaveCount(7);
  await expect(page.locator('.monaco-editor')).toHaveCount(4);
  // Each editor measured where it stands, as a person scrolling to it sees it.
  for (const editor of await page.locator('.cm-editor, .monaco-editor').all()) await editor.scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollTo(0, 0));
  return opened;
}

/** The colour a word is drawn in, in an editor: the first piece of it whose text is that word. */
async function colourOf(editor: Locator, word: string): Promise<string> {
  await expect.poll(() => editor.evaluate((el, w) => [...el.querySelectorAll('span')].some((s) => s.textContent?.trim() === w && s.children.length === 0), word)).toBe(true);
  return editor.evaluate((el, w) => getComputedStyle([...el.querySelectorAll('span')].find((s) => s.textContent?.trim() === w && s.children.length === 0) as Element).color, word);
}
/** The colour of the words in an editor that are no keyword. */
const textColour = (editor: Locator) => editor.evaluate((el) => getComputedStyle(el.querySelector('.cm-content, .view-lines') as Element).color);

/**
 * Click into an editor and clear it, as a person does before typing anew. (Typed over a selection, a
 * bracket or quote in VS Code's editor goes round it: VS Code's own way.)
 */
async function selectAllIn(page: Page, input: Locator) {
  await input.click();
  await page.keyboard.press(`${mod}+A`);
  await page.keyboard.press('Delete');
}
const cm = (page: Page, name: string) => field(page, name).locator('.cm-content');
const monaco = (page: Page, name: string) => field(page, name).locator('.monaco-editor');

test('the Editor switch shows the same fields in either editor, or each where it fits, and says what stays', async ({ page }) => {
  await openCode(page);
  const editor = page.getByRole('navigation', { name: 'Editor' });
  await expect(editor.getByRole('link', { name: 'Both' })).toHaveAttribute('aria-current', 'page');
  // Every code field in VS Code's editor; the one-line condition stays in CodeMirror, and says why.
  await editor.getByRole('link', { name: 'VS Code' }).click();
  await expect(page).toHaveURL(/editor=monaco/);
  await expect(page.locator('.monaco-editor')).toHaveCount(10);
  await expect(page.locator('.cm-editor')).toHaveCount(1);
  await expect(field(page, 'condition').locator('.cm-editor')).toHaveCount(1);
  await expect(field(page, 'condition')).toContainText('VS Code’s editor takes code of several lines: this one-line condition stays in CodeMirror.');
  await expect(page.getByRole('navigation', { name: 'Editor' }).getByRole('link', { name: 'VS Code' })).toHaveAttribute('aria-current', 'page');
  // The same fields in CodeMirror, the record's values the same.
  await page.getByRole('navigation', { name: 'Editor' }).getByRole('link', { name: 'CodeMirror' }).click();
  await expect(page).toHaveURL(/editor=codemirror/);
  await expect(page.locator('.cm-editor')).toHaveCount(11);
  await expect(page.locator('.monaco-editor')).toHaveCount(0);
  expect((await values(page))['handler']).toContain('export async function handle');
  // The switch is the code demo's own: no other demo has it.
  await open(page, 'plain', 'page=customer&skin=outlined');
  await expect(page.getByRole('navigation', { name: 'Editor' })).toHaveCount(0);
});

test.describe('code in CodeMirror', () => {
  test('typed Python reaches the form, indented as Python is, its keywords coloured as they are typed', async ({ page }) => {
    const { problems } = await openCode(page);
    await selectAllIn(page, cm(page, 'script'));
    await page.keyboard.type('def total(rows):');
    await page.keyboard.press('Enter');
    await page.keyboard.type('return sum(rows)');
    await expect.poll(async () => (await values(page))['script']).toBe('def total(rows):\n    return sum(rows)');
    const editor = field(page, 'script').locator('.cm-editor');
    expect(await colourOf(editor, 'def')).toBe(KEYWORD.light);
    expect(await colourOf(editor, 'return')).toBe(KEYWORD.light);
    expect(await textColour(editor)).not.toBe(KEYWORD.light);
    // Each language its own: SQL's, CSS's, YAML's and JavaScript's words, coloured where they are.
    expect(await colourOf(field(page, 'query').locator('.cm-editor'), 'SELECT')).toBe(KEYWORD.light);
    expect(await colourOf(field(page, 'condition').locator('.cm-editor'), '100')).toBe(LITERAL.light);
    await screen(page, 'code-codemirror-typed', { viewport: true });
    expect(problems).toEqual([]);
  });

  test('a one-line field stays one line: Enter adds nothing, and its placeholder shows while it is empty', async ({ page }) => {
    await openCode(page);
    await selectAllIn(page, cm(page, 'condition'));
    await page.keyboard.press('Backspace');
    await expect(field(page, 'condition').locator('.cm-placeholder')).toHaveText('order.total > 100');
    await page.keyboard.type('a > 1');
    await page.keyboard.press('Enter');
    await page.keyboard.type(' && b');
    await expect.poll(async () => (await values(page))['condition']).toBe('a > 1 && b');
  });

  test('read-only code cannot be typed in, but can be reached and its text chosen', async ({ page }) => {
    await openCode(page);
    const before = (await values(page))['generated'];
    const content = cm(page, 'generated');
    await content.click();
    await page.keyboard.press('End');
    await page.keyboard.type('x = 1');
    await page.keyboard.press('Enter');
    expect((await values(page))['generated']).toBe(before);
    await expect(content).toHaveText(/ENABLED = True$/);
    await expect(content).toBeFocused();
  });
});

test.describe('code in VS Code’s editor', () => {
  test('typed TypeScript reaches the form, its keywords coloured as they are typed', async ({ page }) => {
    const { problems } = await openCode(page);
    await selectAllIn(page, monaco(page, 'handler').locator('.view-lines'));
    await page.keyboard.type('const total: number = 1;');
    await expect.poll(async () => (await values(page))['handler']).toBe('const total: number = 1;');
    const editor = monaco(page, 'handler');
    expect(await colourOf(editor, 'const')).toBe(KEYWORD.light);
    expect(await textColour(editor)).not.toBe(KEYWORD.light);
    await screen(page, 'code-monaco-typed', { viewport: true });
    expect(problems).toEqual([]);
  });

  test('JSON typed reaches the form as JSON; text that is not valid is said so, and the last good value stays', async ({ page }) => {
    await openCode(page);
    const input = monaco(page, 'payload').locator('.view-lines');
    await selectAllIn(page, input);
    await page.keyboard.type('{"orderId": 7');
    await expect.poll(async () => (await values(page))['payload']).toEqual({ orderId: 7 });
    await page.keyboard.type(', "total": ');
    await expect(field(page, 'payload').getByRole('alert')).toHaveText(/^Not valid JSON: line \d+, column \d+$/);
    await expect(field(page, 'payload').locator('textarea.inputarea')).toHaveAttribute('aria-invalid', 'true');
    expect((await values(page))['payload']).toEqual({ orderId: 7 });
    await page.keyboard.type('12');
    await expect(field(page, 'payload').getByRole('alert')).toBeHidden();
    await expect.poll(async () => (await values(page))['payload']).toEqual({ orderId: 7, total: 12 });
  });

  test('read-only code cannot be typed in', async ({ page }) => {
    await openCode(page);
    const before = (await values(page))['approved'];
    await monaco(page, 'approved').locator('.view-lines').click();
    await page.keyboard.press(`${mod}+End`);
    await page.keyboard.type('export const x = 1;');
    expect((await values(page))['approved']).toBe(before);
    await expect(monaco(page, 'approved').locator('.view-lines')).not.toContainText('export const x');
  });

  test('Ctrl+F opens VS Code’s find over the code, and Escape closes it', async ({ page }) => {
    await openCode(page);
    await monaco(page, 'handler').locator('.view-lines').click();
    await page.keyboard.press(`${mod}+F`);
    const find = monaco(page, 'handler').locator('.find-widget');
    await expect(find).toBeVisible();
    await page.keyboard.type('notify');
    await expect(find).toContainText('1 of 1');
    await screen(page, 'code-monaco-find', { viewport: true });
    await page.keyboard.press('Escape');
    await expect(find).not.toHaveClass(/\bvisible\b/);
    await expect(monaco(page, 'handler').locator('textarea.inputarea')).toBeFocused();
  });
});

test.describe('the keyboard in code', () => {
  test('Tab goes through every field in order, each editor and read-only code too, and Shift+Tab comes back', async ({ page }) => {
    await openCode(page);
    const order = ['name', 'query', 'script', 'styles', 'runner', 'condition', 'access', 'generated', 'handler', 'payload', 'notes', 'approved', 'owner'];
    const texts = await values(page);
    await page.getByLabel('Job name').focus();
    const reached = ['name'];
    for (let i = 1; i < order.length; i++) {
      await page.keyboard.press('Tab');
      reached.push((await focusedField(page)) ?? 'nothing');
    }
    expect(reached).toEqual(order);
    for (let i = order.length - 2; i >= 0; i--) {
      await page.keyboard.press('Shift+Tab');
      expect(await focusedField(page)).toBe(order[i]);
    }
    // Not a tab typed anywhere on the way.
    expect(await values(page)).toEqual(texts);
  });

  test('Ctrl+] indents the line in either editor, as Tab does not', async ({ page }) => {
    await openCode(page);
    await cm(page, 'styles').click();
    await page.keyboard.press(`${mod}+Home`);
    await page.keyboard.press(`${mod}+BracketRight`);
    await expect.poll(async () => String((await values(page))['styles']).split('\n')[0]).toBe('  .badge {');
    await monaco(page, 'notes').locator('.view-lines').click();
    await page.keyboard.press(`${mod}+Home`);
    await page.keyboard.press(`${mod}+BracketRight`);
    await expect.poll(async () => String((await values(page))['notes']).split('\n')[0]).toMatch(/^\s+# Release 2\.4$/);
  });

  test('each editor is a text box named by its field’s label, and a click on the label goes into it', async ({ page }) => {
    await openCode(page);
    const named = { 'Nightly query': 'query', 'Cleanup script': 'script', 'Run when': 'condition', 'Access settings': 'access', 'Generated code': 'generated', 'Webhook handler': 'handler', 'Sample payload': 'payload', 'Approved handler': 'approved' };
    for (const [label, name] of Object.entries(named)) {
      // The name assistive technology reads, as the browser works it out: not a label merely beside the box.
      const box = page.getByRole('textbox', { name: label, exact: true });
      await expect(box, label).toHaveCount(1);
      expect(await box.evaluate((el) => (el.closest('[data-field]') as HTMLElement).dataset['field']), label).toBe(name);
    }
    await field(page, 'script').locator('label').click();
    expect(await focusedField(page)).toBe('script');
    await field(page, 'handler').locator('label').click();
    await expect(monaco(page, 'handler').locator('textarea.inputarea')).toBeFocused();
  });
});

test.describe('code in the dark, and on an Arabic page', () => {
  test('dark: each editor on the dark surface, its keywords in the dark scheme’s colour', async ({ page }) => {
    const { problems } = await openCode(page, '&scheme=dark');
    const surface = 'rgb(31, 35, 41)';
    const cmEditor = field(page, 'script').locator('.cm-editor');
    expect(await cmEditor.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(surface);
    expect(await colourOf(cmEditor, 'def')).toBe(KEYWORD.dark);
    const handler = monaco(page, 'handler');
    await expect.poll(() => handler.evaluate((el) => getComputedStyle(el.querySelector('.monaco-editor-background') as Element).backgroundColor)).toBe(surface);
    expect(await colourOf(handler, 'export')).toBe(KEYWORD.dark);
    // Typed in the dark, as in the light.
    await selectAllIn(page, cm(page, 'query'));
    await page.keyboard.type('SELECT 1');
    await expect.poll(async () => (await values(page))['query']).toBe('SELECT 1');
    await field(page, 'script').scrollIntoViewIfNeeded();
    await screen(page, 'code-dark-codemirror', { viewport: true });
    await handler.scrollIntoViewIfNeeded();
    await screen(page, 'code-dark-monaco', { viewport: true });
    expect(problems).toEqual([]);
  });

  test('a page whose scheme turns dark gives Monaco its dark theme as it does', async ({ page }) => {
    await openCode(page);
    const handler = monaco(page, 'handler');
    expect(await colourOf(handler, 'export')).toBe(KEYWORD.light);
    await page.locator('.fd-form').first().evaluate((form) => form.setAttribute('data-scheme', 'dark'));
    await expect.poll(() => colourOf(handler, 'export')).toBe(KEYWORD.dark);
  });

  test('Arabic: the page reads right to left, the code left to right, its line numbers on the left; typing still works', async ({ page }) => {
    const { problems } = await openCode(page, '&dir=rtl&locale=ar');
    await expect(page.locator('.fd-form').first()).toHaveAttribute('dir', 'rtl');
    for (const name of ['query', 'script', 'generated']) {
      const editor = field(page, name).locator('.cm-editor');
      expect(await editor.evaluate((el) => getComputedStyle(el.querySelector('.cm-content') as Element).direction), name).toBe('ltr');
      const [gutter, content] = await editor.evaluate((el) => [el.querySelector('.cm-gutters')!.getBoundingClientRect().left, el.querySelector('.cm-content')!.getBoundingClientRect().left]);
      expect(gutter, name).toBeLessThan(content);
    }
    for (const name of ['handler', 'payload', 'notes']) {
      const editor = monaco(page, name);
      expect(await editor.evaluate((el) => getComputedStyle(el).direction), name).toBe('ltr');
      const [margin, lines] = await editor.evaluate((el) => [el.querySelector('.margin')!.getBoundingClientRect().left, el.querySelector('.view-lines')!.getBoundingClientRect().left]);
      expect(margin, name).toBeLessThan(lines);
    }
    // Named by its label, in Arabic.
    await page.getByLabel('برنامج التنظيف').click();
    await page.keyboard.press(`${mod}+A`);
    await page.keyboard.type('x = 1');
    await expect.poll(async () => (await values(page))['script']).toBe('x = 1');
    await page.getByLabel('معالج الإشعارات').focus();
    await page.keyboard.press(`${mod}+A`);
    await page.keyboard.type('let y = 2;');
    await expect.poll(async () => (await values(page))['handler']).toBe('let y = 2;');
    await field(page, 'script').scrollIntoViewIfNeeded();
    await screen(page, 'code-arabic-codemirror', { viewport: true });
    await monaco(page, 'handler').scrollIntoViewIfNeeded();
    await screen(page, 'code-arabic-monaco', { viewport: true });
    expect(problems).toEqual([]);
  });

  test('on a phone, long lines scroll inside their editor, never the page', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openCode(page);
    await expectNoSidewaysScroll(page);
    await screen(page, 'code-phone', { viewport: true });
  });
});

test.describe('the code page, checked by axe', () => {
  test.describe.configure({ timeout: 120_000 });
  for (const [state, query] of [['light', ''], ['dark', '&scheme=dark'], ['Arabic', '&dir=rtl&locale=ar']] as const) {
    test(`both editors, ${state}`, async ({ page }) => {
      await openCode(page, query);
      // An editor in use too: one with the focus, one with VS Code's find open.
      await monaco(page, 'notes').locator('.view-lines').click();
      await cm(page, 'script').click();
      expect(await axeFindings(page, `code page ${state}`)).toEqual([]);
    });
  }
});

test.describe('each language loaded only where a page shows it', () => {
  /** The demo's scripts the page has loaded, each with the packages it carries (the build names them in comments). */
  async function loaded(page: Page): Promise<string> {
    return page.evaluate(async () => {
      const scripts = performance.getEntriesByType('resource').map((entry) => entry.name).filter((url) => url.endsWith('.js'));
      const texts = await Promise.all(scripts.map((url) => fetch(url).then((response) => response.text())));
      return texts.join('\n');
    });
  }

  test('a page with no code field loads no grammar and no Monaco', async ({ page }) => {
    await open(page, 'plain', 'page=signup&skin=outlined');
    const code = await loaded(page);
    expect(code).toContain('@fieldia');
    expect(code).not.toMatch(/node_modules\/@codemirror\/lang-(?!json)/);
    expect(code).not.toContain('node_modules/monaco-editor/');
  });

  test('the code page loads the grammars of the languages it shows, and no other', async ({ page }) => {
    await openCode(page);
    const code = await loaded(page);
    for (const shown of ['lang-sql', 'lang-python', 'lang-css', 'lang-yaml', 'lang-javascript']) expect(code, shown).toContain(`node_modules/@codemirror/${shown}/`);
    for (const absent of ['lang-php', 'lang-rust', 'lang-java/', 'lang-go', 'lang-cpp', 'lang-markdown', 'legacy-modes']) expect(code, absent).not.toContain(`node_modules/@codemirror/${absent}`);
    expect(code).toContain('node_modules/monaco-editor/esm/vs/languages/definitions/typescript/');
    expect(code).toContain('node_modules/monaco-editor/esm/vs/languages/definitions/markdown/');
    for (const absent of ['python', 'sql', 'rust', 'php']) expect(code, absent).not.toContain(`node_modules/monaco-editor/esm/vs/languages/definitions/${absent}/`);
    // No language service without workers given.
    expect(code).not.toContain('node_modules/monaco-editor/esm/vs/languages/features/json/');
  });
});

test.describe('VS Code’s editor with the app’s workers', () => {
  test('JSON is checked as it is typed by Monaco’s own JSON worker', async ({ page }) => {
    const workers: string[] = [];
    page.on('worker', (worker) => workers.push(worker.url()));
    const { problems } = await openCode(page, '&workers=1');
    await selectAllIn(page, monaco(page, 'payload').locator('.view-lines'));
    await page.keyboard.type('{"orderId": 7, "total": ');
    await expect(monaco(page, 'payload').locator('.squiggly-error').first()).toBeAttached({ timeout: 15_000 });
    expect(workers.some((url) => url.endsWith('/workers/json.worker.js'))).toBe(true);
    await screen(page, 'code-monaco-json-worker', { viewport: true });
    expect(problems).toEqual([]);
  });
});

test.describe('code made in the screen editor', () => {
  /** The page's field nodes drawn by a widget, as the designer has made them. */
  const nodesDrawnBy = (page: Page, widget: string) =>
    page.evaluate((w) => {
      const found: { field: string; options?: Record<string, unknown> }[] = [];
      const walk = (node: any) => {
        if (node?.type === 'field' && node.widget === w) found.push({ field: node.field, options: node.options });
        for (const child of [...(node?.children ?? []), ...(node?.tabs ?? [])]) walk(child);
      };
      walk((window as any).fieldiaDesigner.designer.getPage().layout);
      return found;
    }, widget);

  for (const arabic of [false, true]) {
    test(`a Code field, its language picked${arabic ? ', in Arabic' : ''}, drawn in Try it in that language`, async ({ page }) => {
      const problems = watch(page);
      await page.goto(arabic ? '/screen/?locale=ar&dir=rtl' : '/screen/');
      await expect(page.locator('.fd-designer')).toBeVisible();
      // Each tile's name whole, on its two lines.
      for (const kind of ['code', 'vscode']) {
        const name = page.locator(`.fd-toolbox [data-tool="kind:${kind}"] .fd-tool-name`);
        await name.scrollIntoViewIfNeeded();
        expect(await name.evaluate((el) => el.scrollHeight - el.clientHeight), kind).toBeLessThanOrEqual(1);
      }
      await page.locator('.fd-toolbox [data-tool="kind:code"]').click();
      const list = page.locator(`.fd-canvas-field.fd-editing select[aria-label="${arabic ? 'اللغة' : 'Language'}"]`);
      await expect(list.locator('option').first()).toHaveText(arabic ? 'نص عادي' : 'Plain text');
      await list.selectOption('python');
      await expect.poll(() => nodesDrawnBy(page, 'code')).toEqual([expect.objectContaining({ options: { language: 'python' } })]);
      await screen(page, `code-designer${arabic ? '-arabic' : ''}`, { viewport: true });
      // Try it draws it as the app will: CodeMirror, coloured as Python, left to right.
      await page.locator('.fd-mode [data-mode="try"]').click();
      const editor = page.locator('.fd-try-frame .cm-editor');
      await expect(editor).toBeVisible();
      await editor.locator('.cm-content').click();
      await page.keyboard.type('def total(): pass');
      expect(await colourOf(editor, 'def')).toBe(KEYWORD.light);
      expect(await editor.evaluate((el) => getComputedStyle(el).direction)).toBe('ltr');
      await screen(page, `code-designer-try${arabic ? '-arabic' : ''}`, { viewport: true });
      expect(problems).toEqual([]);
    });
  }
});
