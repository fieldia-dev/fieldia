import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';

/**
 * Typing while a box's part comes (0.23). An app that mounts without `loadParts` draws a box by its plain stand-in,
 * and the part's own box takes its place "keeping the value, what was typed and the focus" (CHANGELOG 0.23.0). These
 * type into the stand-in, let the part come, and type on, as a person on a slow line does: what was typed must be the
 * part's box's text, and the value what was typed — never a number made of keys the box rewrote under them, never
 * words dropped.
 */

type Fields = Record<string, Record<string, unknown>>;

/** The script demo, `part` held back, and an app's own boxes for `fields` drawn by createWidget: no loadParts. */
async function ownBoxes(page: Page, part: string, fields: Fields, values: Record<string, unknown>, widgets: Record<string, string | undefined>) {
  const problems: string[] = [];
  page.on('console', (message) => message.type() === 'error' && problems.push(`console: ${message.text()}`));
  page.on('pageerror', (error) => problems.push(`page error: ${error.message}`));
  let release: () => void = () => undefined;
  const held = new Promise<void>((done) => (release = done));
  await page.route(`**/fieldia.${part}.js`, async (route) => {
    await held;
    await route.continue();
  });
  await page.goto('/script/');
  await expect(page.locator('.fd-form')).toBeVisible();
  await page.evaluate(
    ({ fields, values, widgets }) => {
      const fieldia = (window as any).Fieldia;
      const shown = { fieldia: '0.1', id: 'own', data: { kind: 'responses' }, fields, layout: { type: 'sections', id: 's', children: [] } };
      const dataSource = fieldia.createMemoryDataSource({ records: { area: { 1: { name: 'Portal' }, 2: { name: 'Warehouse' } }, tag: { 1: { name: 'Alpha' }, 2: { name: 'Beta' } } } });
      const form = fieldia.createForm({ page: shown, values, dataSource });
      const host = document.createElement('div');
      host.id = 'own';
      document.body.prepend(host);
      const drawn = Object.entries(widgets).map(([name, widget]) => {
        const node = { type: 'field', id: `f-${name}`, field: name, widget };
        const made = fieldia.createWidget({ form, name, field: fields[name], node, id: `own-${name}`, document });
        host.append(made.element);
        return [name, made] as const;
      });
      const refresh = () => {
        for (const [name, made] of drawn) made.update({ value: form.getState().values[name], values: form.getState().values, readonly: false, required: false, invalid: false });
      };
      form.subscribe(refresh);
      refresh();
      (window as any).ownForm = form;
    },
    { fields, values, widgets }
  );
  return { problems, release };
}

const stateOf = (page: Page) =>
  page.evaluate(() => {
    const state = (window as any).ownForm.getState();
    return { values: state.values as Record<string, unknown>, unread: state.unread as Record<string, { text: string } | undefined> };
  });

test.describe('typing while a box’s part comes', () => {
  test('a per cent typed "2.5" across its part’s coming is 2.5 %, never 25 %', async ({ page }) => {
    const { problems, release } = await ownBoxes(page, 'business', { share: { type: 'float', label: 'Share' } }, { share: null }, { share: 'percentage' });
    const plain = page.locator('#own-share');
    await plain.click();
    await page.keyboard.type('2.');
    release();
    const box = page.locator('#own input.fd-percentage');
    await expect(box).toBeFocused();
    // What was typed is the part's box's text: "2.", not "2".
    await expect(box).toHaveValue('2.');
    await page.keyboard.type('5');
    await page.keyboard.press('Tab');
    expect((await stateOf(page)).values['share']).toBe(0.025);
    expect(problems).toEqual([]);
  });

  test('hours typed "1.5" across their part’s coming are an hour and a half, the box never rewritten under the keys', async ({ page }) => {
    const { problems, release } = await ownBoxes(page, 'business', { spent: { type: 'float', label: 'Hours' } }, { spent: null }, { spent: 'duration' });
    await page.locator('#own-spent').click();
    await page.keyboard.type('1.');
    release();
    const box = page.locator('#own input.fd-duration');
    await expect(box).toBeFocused();
    await expect(box).toHaveValue('1.');
    await page.keyboard.type('5');
    await page.keyboard.press('Tab');
    const state = await stateOf(page);
    expect(state.unread['spent']).toBeUndefined();
    expect(state.values['spent']).toBe(1.5);
    expect(problems).toEqual([]);
  });

  test('a time typed "14" then ":30" across its part’s coming is 14:30, never "14:00:30"', async ({ page }) => {
    const { problems, release } = await ownBoxes(page, 'date', { at: { type: 'char', label: 'Arrival' } }, { at: null }, { at: 'time' });
    await page.locator('#own-at').click();
    await page.keyboard.type('14');
    release();
    const box = page.locator('#own input[data-kind="time"]');
    await expect(box).toBeFocused();
    await expect(box).toHaveValue('14');
    await page.keyboard.type(':30');
    await page.keyboard.press('Tab');
    const state = await stateOf(page);
    expect(state.unread['at']).toBeUndefined();
    expect(state.values['at']).toBe('14:30');
    expect(problems).toEqual([]);
  });

  test('a path’s words typed before its part came are still in its box after, and read when it is left', async ({ page }) => {
    const { problems, release } = await ownBoxes(page, 'path', { area: { type: 'many2one', label: 'Area', relation: 'area' } }, { area: null }, { area: 'path' });
    await page.locator('#own-area').click();
    await page.keyboard.type('Ware');
    release();
    const box = page.locator('#own input.fd-path-input');
    await expect(box).toBeFocused();
    await expect(box).toHaveValue('Ware');
    await page.keyboard.type('house');
    await page.keyboard.press('Tab');
    await expect.poll(async () => ((await stateOf(page)).values['area'] as { label?: string } | null)?.label).toBe('Warehouse');
    expect(problems).toEqual([]);
  });

  test('a decimal slider typed "2.5" across its part’s coming is 2.5, or says why not — never 2 in silence', async ({ page }) => {
    const { problems, release } = await ownBoxes(page, 'survey', { level: { type: 'float', label: 'Level', min: 0, max: 10 } }, { level: null }, { level: 'slider' });
    await page.locator('#own-level').click();
    await page.keyboard.type('2.');
    release();
    await expect(page.locator('#own input[type="range"]')).toBeAttached();
    await page.keyboard.type('5');
    await page.keyboard.press('Tab');
    const state = await stateOf(page);
    expect(state.values['level'] === 2.5 || state.unread['level']?.text === '2.5').toBe(true);
    expect(problems).toEqual([]);
  });
});

test.describe('text left unread in a box whose part takes its place', () => {
  test('a whole-number slider left with "1.5" before its part came is still marked once the slider takes its place', async ({ page }) => {
    const { problems, release } = await ownBoxes(page, 'survey', { days: { type: 'integer', label: 'Days', min: 0, max: 5 } }, { days: 3 }, { days: 'slider' });
    const plain = page.locator('#own-days');
    await plain.click();
    await plain.press('Control+A');
    await page.keyboard.type('1.5');
    await page.keyboard.press('Tab');
    // The number box keeps it, marked: a save is refused with "Days must be a whole number".
    await expect(plain).toHaveAttribute('aria-invalid', 'true');
    expect((await stateOf(page)).unread['days']?.text).toBe('1.5');
    release();
    const slider = page.locator('#own input[type="range"]');
    await expect(slider).toBeAttached();
    // The text still stops a save: the slider says so, never a plain 3 with nothing wrong to be seen.
    expect((await stateOf(page)).unread['days']?.text).toBe('1.5');
    await expect(slider).toHaveAttribute('aria-invalid', 'true');
    expect(problems).toEqual([]);
  });
});

// Firefox and WebKit, where taking a focused box out of the page sends it no change: each launched here, as the
// firefox and webkit projects run a smoke list alone.
for (const browserName of ['firefox', 'webkit'] as const) {
  test.describe(`${browserName}: typing while a box’s part comes`, () => {
    for (const [kind, typed, value] of [
      ['date', '15/10/2026', '2026-10-15'],
      ['datetime', '15/10/2026 14:30', null],
    ] as const) {
      test(`a ${kind} typed over its value before the date part came is the value once the box is left — never the old one`, async ({ playwright, baseURL }) => {
        const browser = await playwright[browserName].launch();
        try {
          const page = await browser.newPage({ baseURL });
          const { problems, release } = await ownBoxes(page, 'date', { day: { type: kind, label: 'Day' } }, { day: kind === 'date' ? '2026-01-01' : '2026-01-01T09:00:00.000Z' }, { day: undefined });
          const plain = page.locator('#own-day');
          await plain.click();
          await plain.press('Control+A');
          await page.keyboard.type(typed);
          release();
          const box = page.locator(`#own input[data-kind="${kind}"]`);
          await expect(box).toBeFocused();
          // The part's box shows what was typed, not the value it was handed.
          await expect(box).toHaveValue(typed);
          await page.keyboard.press('Tab');
          const expected = value ?? (await page.evaluate(() => new Date(2026, 9, 15, 14, 30).toISOString()));
          expect((await stateOf(page)).values['day']).toBe(expected);
          expect(problems).toEqual([]);
        } finally {
          await browser.close();
        }
      });
    }

    test('words typed in a links field before its part came are read or kept unread, never dropped in silence', async ({ playwright, baseURL }) => {
      const browser = await playwright[browserName].launch();
      try {
        const page = await browser.newPage({ baseURL });
        const { problems, release } = await ownBoxes(page, 'text', { tags: { type: 'many2many', label: 'Tags', relation: 'tag' } }, { tags: [] }, { tags: 'links' });
        await page.locator('#own-tags').click();
        await page.keyboard.type('Alpha');
        release();
        await expect(page.locator('#own .fd-links-box')).toBeAttached();
        // The words named a tag: it is the field's (as Chromium reads them), or they wait, unread, with why.
        await expect
          .poll(async () => {
            const state = await stateOf(page);
            const linked = (state.values['tags'] as { label: string }[]).map((tag) => tag.label);
            return linked.includes('Alpha') || state.unread['tags']?.text === 'Alpha';
          })
          .toBe(true);
        expect(problems).toEqual([]);
      } finally {
        await browser.close();
      }
    });
  });
}
