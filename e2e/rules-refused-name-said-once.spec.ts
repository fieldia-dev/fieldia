import { type Locator, type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { mapOf, mapReady, stubMaps } from './map-support';
import { node, open } from './support';

/**
 * A name typed in a box that picks by name, naming nothing, is said ONCE under its field (amlak-20's report, 25 Nov,
 * @fieldia/viewer 0.36.1): a pick list of half-hour times that takes typing ("At"), "08:15" typed and Save pressed
 * showed two sentences for one problem — the box's own refusal hint, "At: nothing is called “08:15”; pick one from the
 * list. At still holds 08:30", and the field's error, "At: nothing is called “08:15”; pick one from the list".
 *
 * As the box is left and as Save is pressed, in a choice typed by name, a link, a path and a grid's product cell: the
 * elements in sight that hold the words are counted — exactly one, the fuller sentence where the box says what the
 * field still holds — the box marked invalid and described by words that are in sight; the save refused, the words
 * still typed, the value kept. And the boxes that say a refusal in a note of their own, which the field's error said
 * again: a place's coordinate past the poles, JSON that breaks in either code editor.
 */

/** Half-hour times, 07:00 to 20:00: a list long enough to search, as the report's "At". */
const TIMES = Array.from({ length: 27 }, (_, i) => {
  const at = `${String(7 + Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`;
  return { value: at, label: at };
});
const BRIEFING = {
  fieldia: '0.13',
  id: 'briefing',
  title: 'My morning',
  data: { kind: 'record', model: 'briefing' },
  fields: {
    name: { type: 'char', label: 'Name' },
    at: { type: 'selection', label: 'At', required: true, options: TIMES },
  },
  layout: { type: 'sheet', id: 'root', children: [{ type: 'field', id: 'f-name', field: 'name' }, { type: 'field', id: 'f-at', field: 'at' }] },
};

/** The report's page, mounted by the one-tag script: one record holding 08:30. */
async function briefing(page: Page) {
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(`page error: ${error.message}`));
  await page.goto('/script/');
  await expect(page.locator('#app .fd-form')).toBeVisible();
  await page.evaluate((shown) => {
    const fieldia = (window as any).Fieldia;
    const demo = ((window as any).fieldiaDemo ??= {});
    demo.handle?.destroy?.();
    demo.dataSource = fieldia.createMemoryDataSource({ records: { briefing: { 1: { name: 'Hany', at: '08:30' } } } });
    demo.handle = fieldia.mountViewer(document.getElementById('app'), { page: shown, dataSource: demo.dataSource, recordId: 1, skin: 'outlined' });
  }, BRIEFING);
  return problems;
}

/**
 * The places a person sees `words` in: each piece of text holding them whose element is drawn — not hidden, not clipped
 * to a pixel for a screen reader alone (`fd-sr-only`), not a tooltip's title — as "where: the words".
 */
function inSight(page: Page, words: string): Promise<string[]> {
  return page.evaluate((said) => {
    const plain = (text: string) => text.replace(/[\u2066-\u2069]/g, '');
    const seen = (element: Element) => {
      for (let at: Element | null = element; at && at !== document.body; at = at.parentElement) {
        // A tooltip (AG Grid's, a cell's problem as the pointer rests on it) is a title's: shown on pointing, not in sight.
        if ((at as HTMLElement).hidden || at.getAttribute('aria-hidden') === 'true' || at.getAttribute('role') === 'tooltip' || at.classList.contains('ag-tooltip')) return false;
        const style = getComputedStyle(at);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
        const box = at.getBoundingClientRect();
        if (style.display !== 'contents' && style.overflow !== 'visible' && (box.width < 2 || box.height < 2)) return false;
      }
      return true;
    };
    const found: string[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let text = walker.nextNode(); text; text = walker.nextNode()) {
      const element = text.parentElement;
      if (!element || !plain(text.nodeValue ?? '').includes(said) || !seen(element)) continue;
      found.push(`${element.className || element.tagName}: ${plain(text.nodeValue ?? '')}`);
    }
    return found;
  }, words);
}

/** What the box's aria-describedby names that holds `words`, and whether each is in sight. */
function describedWith(box: Locator, words: string): Promise<{ id: string; seen: boolean }[]> {
  return box.evaluate((input, said) => {
    const ids = (input.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean);
    return ids
      .map((id) => input.ownerDocument.getElementById(id))
      .filter((element): element is HTMLElement => !!element && (element.textContent ?? '').replace(/[\u2066-\u2069]/g, '').includes(said))
      .map((element) => ({ id: element.id, seen: !element.hidden && !element.closest('[hidden]') && element.getBoundingClientRect().height > 1 }));
  }, words);
}

/**
 * Exactly one element in sight says it — with `whole`, the fuller sentence — and, given its `box`, the box is marked
 * invalid and described by those words, in sight: never by an element out of sight.
 */
async function saidOnce(page: Page, words: string, { box, whole }: { box?: Locator; whole?: string } = {}) {
  await expect.poll(() => inSight(page, words), `“${words}” said once in sight`).toHaveLength(1);
  if (whole) expect((await inSight(page, words))[0]).toContain(whole);
  // A press's words wait for the press to end (press.ts): once they settled, still one.
  await page.waitForTimeout(150);
  expect(await inSight(page, words)).toHaveLength(1);
  if (!box) return;
  await expect(box).toHaveAttribute('aria-invalid', 'true');
  expect(await describedWith(box, words)).toEqual([{ id: expect.any(String), seen: true }]);
}

/** Something else changed first, so the Save button shows. */
async function changeTheName(page: Page) {
  const name = node(page, 'f-name').locator('input').first();
  await name.click();
  await name.press('End');
  await name.pressSequentially(' x');
  await name.press('Tab');
}

test.describe('a name typed that names nothing, said once', () => {
  test('a choice typed by name: left, then Saved — one sentence, with what the field still holds', async ({ page }) => {
    const problems = await briefing(page);
    await changeTheName(page);
    const box = node(page, 'f-at').locator('input[role="combobox"]');
    await expect(box).toHaveValue('08:30');
    await box.click();
    await box.press('Control+A');
    await box.pressSequentially('08:15');
    // Left by a press elsewhere, as a person leaves it for Save (the box is the page's last: Tab would leave the page).
    await node(page, 'f-name').locator('input').click();
    const words = 'At: nothing is called “08:15”; pick one from the list';
    await saidOnce(page, words, { box, whole: `${words}. At still holds 08:30` });

    await page.locator('#app .fd-form button[type="submit"].fd-button-primary').first().click();
    await expect.poll(() => page.evaluate(() => (window as any).fieldiaDemo.handle.form.getState().errors['at'] ?? '')).toContain('08:15');
    await saidOnce(page, words, { box, whole: `${words}. At still holds 08:30` });
    await expect(box).toHaveValue('08:15');
    expect(await page.evaluate(() => (window as any).fieldiaDemo.handle.form.getState().values['at'])).toBe('08:30');
    expect(await page.evaluate(() => (window as any).fieldiaDemo.dataSource.records.briefing[1].at)).toBe('08:30');
    expect(problems).toEqual([]);
  });

  test('a choice typed by name, then Save pressed straight from it — the report’s own steps: one sentence', async ({ page }) => {
    const problems = await briefing(page);
    await changeTheName(page);
    const box = node(page, 'f-at').locator('input[role="combobox"]');
    await box.click();
    await box.press('Control+A');
    await box.pressSequentially('08:15');
    // The box is left as the press on Save comes down; what leaving says waits for the press to end (press.ts).
    await page.locator('#app .fd-form button[type="submit"].fd-button-primary').first().click();
    await expect.poll(() => page.evaluate(() => (window as any).fieldiaDemo.handle.form.getState().errors['at'] ?? '')).toContain('08:15');
    const words = 'At: nothing is called “08:15”; pick one from the list';
    await saidOnce(page, words, { box, whole: `${words}. At still holds 08:30` });
    await expect(box).toHaveValue('08:15');
    expect(await page.evaluate(() => (window as any).fieldiaDemo.dataSource.records.briefing[1].at)).toBe('08:30');
    expect(problems).toEqual([]);
  });

  test('a choice typed by name, Saved straight from the box: one sentence', async ({ page }) => {
    const problems = await briefing(page);
    const box = node(page, 'f-at').locator('input[role="combobox"]');
    await box.click();
    await box.press('Control+A');
    await box.pressSequentially('08:15');
    await box.press('Control+Enter');
    const words = 'At: nothing is called “08:15”; pick one from the list';
    await expect.poll(() => page.evaluate(() => (window as any).fieldiaDemo.handle.form.getState().errors['at'] ?? '')).toContain('08:15');
    await saidOnce(page, words, { box });
    await expect(box).toHaveValue('08:15');
    expect(problems).toEqual([]);
  });

  test('a link: left, then Saved — one sentence', async ({ page }) => {
    const { problems } = await open(page, 'plain', 'page=fields&skin=outlined');
    await changeTheName(page);
    const box = node(page, 'f-client').locator('input[role="combobox"]');
    await box.click();
    await box.press('Control+A');
    await box.pressSequentially('Narnia');
    await box.press('Tab');
    const words = 'Client: nothing is called “Narnia” yet; pick one or create it';
    await saidOnce(page, words, { box, whole: `${words}. Client still holds Nile Traders` });
    await page.locator('.fd-form button[type="submit"].fd-button-primary').first().click();
    await expect.poll(() => page.evaluate(() => (window as any).fieldiaDemo.handle.form.getState().errors['client_id'] ?? '')).toContain('Narnia');
    await saidOnce(page, words, { box });
    await expect(box).toHaveValue('Narnia');
    expect(problems).toEqual([]);
  });

  test('a path: left, then Saved — one sentence, with what the field still holds', async ({ page }) => {
    const { problems } = await open(page, 'plain', 'page=wi-picker');
    const box = node(page, 'f-iteration').locator('input').first();
    await expect(box).toHaveValue('Portal\\Sprint 14');
    await box.click();
    await box.press('Control+A');
    await box.pressSequentially('Sprint 99');
    await box.press('Tab');
    const words = 'Iteration: nothing is called “Sprint 99”; pick one from the list';
    await saidOnce(page, words, { box, whole: `${words}. Iteration still holds Portal\\Sprint 14` });
    await page.keyboard.press('Control+Enter');
    await expect.poll(() => page.evaluate(() => (window as any).fieldiaDemo.handle.form.getState().errors['iteration'] ?? '')).toContain('Sprint 99');
    await saidOnce(page, words, { box });
    await expect(box).toHaveValue('Sprint 99');
    expect(problems).toEqual([]);
  });

  for (const how of ['Saved from its box', 'left, then Saved'] as const) test(`a grid’s product cell, ${how}: one sentence`, async ({ page }) => {
    const { problems } = await open(page, 'plain', 'page=order&skin=outlined');
    const grid = node(page, 'f-lines');
    const cell = (row: number, column: string) => grid.locator(`.ag-row[row-index="${row}"] .ag-cell[col-id="${column}"]`);
    // Another line's description changed first, so the Save button shows.
    await cell(2, 'name').dblclick();
    const description = grid.locator('.fd-grid-editor input').first();
    await description.press('End');
    await description.pressSequentially('!');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Escape');
    await cell(1, 'product_id').dblclick();
    const box = grid.locator('.fd-grid-editor input[role="combobox"]');
    await expect(box).toBeFocused();
    await box.press('Control+A');
    await box.pressSequentially('Narnia');
    const words = 'nothing is called “Narnia”';
    if (how === 'left, then Saved') {
      // Left, its editor closes, and the hint with it: the cell is marked (its title, its words for a screen reader);
      // what is in sight is never said twice.
      await box.press('Tab');
      await page.waitForTimeout(300);
      expect((await inSight(page, words)).length).toBeLessThanOrEqual(1);
    }
    await page.locator('.fd-form button[type="submit"].fd-button-primary').first().click();
    await expect.poll(() => page.evaluate(() => Object.entries((window as any).fieldiaDemo.handle.form.getState().errors as Record<string, string>).find(([path]) => path.endsWith('.product_id'))?.[1] ?? '')).toContain('Narnia');
    // Said once, in the grid's own list of its lines' problems: its editor closed as Save was pressed.
    await saidOnce(page, words);
    expect(problems).toEqual([]);
  });

  /** The app's own save, as the code page has no Save button in sight until a value changes. */
  const save = (page: Page) => page.evaluate(() => (window as any).fieldiaDemo.handle.form.save());

  for (const editor of ['codemirror', 'monaco'] as const)
    test(`JSON that breaks in ${editor === 'monaco' ? 'VS Code’s editor' : 'CodeMirror'}: left, then saved — one sentence`, async ({ page, browserName }) => {
      // VS Code's editor is driven in Chromium alone, as its own gates are (code-editors.spec.ts is outside the smoke set).
      test.skip(editor === 'monaco' && browserName !== 'chromium', 'VS Code’s editor is driven in Chromium');
      const { problems } = await open(page, 'plain', `page=code&skin=outlined&editor=${editor}`);
      if (editor === 'monaco') await expect(page.locator('.monaco-editor')).toHaveCount(11);
      const field = page.locator('[data-field="payload"]');
      await field.locator(editor === 'monaco' ? '.monaco-editor .view-lines' : '.cm-content').click();
      await page.keyboard.press('ControlOrMeta+A');
      await page.keyboard.press('Delete');
      await page.keyboard.type('{"a": ');
      const box = field.locator(editor === 'monaco' ? 'textarea.inputarea' : '.cm-content');
      // Said once typing pauses, then the editor left.
      await expect(field.getByRole('alert')).toHaveText(/^Not valid JSON: line 1, column \d+$/);
      await page.locator('h1').first().click();
      const words = 'Not valid JSON: line 1, column';
      await expect.poll(() => page.evaluate(() => (window as any).fieldiaDemo.handle.form.getState().errors['payload'] ?? '')).toContain(words);
      await saidOnce(page, words, { box });
      expect(await save(page)).toBe(false);
      await saidOnce(page, words, { box });
      expect(problems).toEqual([]);
    });

  test('a place’s latitude past the poles: left, then saved — one sentence', async ({ page }) => {
    await stubMaps(page);
    const { problems } = await open(page, 'plain', 'page=map-delivery&skin=outlined');
    await mapReady(mapOf(page, 'deliver_to'));
    const [latitude, longitude] = [page.locator('[data-node="deliver_to"] .fd-map-coords input').first(), page.locator('[data-node="deliver_to"] .fd-map-coords input').nth(1)];
    await latitude.click();
    await latitude.press('ControlOrMeta+A');
    await latitude.pressSequentially('95');
    await longitude.click();
    await longitude.press('ControlOrMeta+A');
    await longitude.pressSequentially('31');
    await longitude.press('Tab');
    const words = 'Latitude: a number from -90 to 90';
    await expect.poll(() => inSight(page, words)).not.toEqual([]);
    // The box the field's label names — its address's search — is the one the field's words describe.
    const named = node(page, 'deliver_to').locator('input[role="combobox"]');
    await saidOnce(page, words, { box: named });
    await page.locator('.fd-form button[type="submit"].fd-button-primary').first().click();
    await expect.poll(() => page.evaluate(() => Object.keys((window as any).fieldiaDemo.handle.form.getState().errors).length)).toBeGreaterThan(0);
    await saidOnce(page, words, { box: named });
    expect(problems).toEqual([]);
  });
});
