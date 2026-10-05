import { expect, test, type Locator, type Page } from '@playwright/test';
import { axeFindings } from './a11y-support';
import { inAdvanced, watch } from './designer-support';
import { expectNoSidewaysScroll, screen } from './support';

/**
 * Each kind of part's own look, as SurveyJS and Vueform theme each kind of
 * component, used as a person uses it: in the survey designer's Look sheet,
 * text boxes given a cream background and round corners and the buttons a
 * purple, the cards wearing them as they are set, Try it's form wearing them,
 * Undo taking the colour back; on the screen designer's canvas as its Look
 * tab is set. A colour that would leave words unreadable is drawn lighter or
 * darker, never shipped as it is: axe finds nothing, in either skin, light,
 * dark and the reader's own, right to left, and at a phone's width.
 */

const CREAM = '#fff7e6';
const PURPLE = '#6941c6';
/** A look for every kind, as the viewer demo takes it. */
const PARTS = {
  inputs: { background: CREAM, border: '#c4320a', corners: 'round', textSize: 'large', accent: '#c4320a' },
  choices: { accent: '#1f7a4d', background: '#f0f7ff', border: '#1677ff', corners: 'round' },
  groups: { background: '#fbfaf7', border: '#d6cfc2', corners: 'round' },
  buttons: { accent: PURPLE, corners: 'round', textSize: 'large' },
  tables: { background: '#eef2f7', border: '#9aa3ad', textSize: 'small' },
};
/** Colours no word can be read on or in, as a person might still pick them. */
const UNREADABLE = {
  inputs: { background: '#777777' },
  choices: { accent: '#ffd60a', background: '#1f7a4d' },
  groups: { background: '#002855' },
  buttons: { accent: '#ffd60a' },
  tables: { background: '#c4320a' },
};

const rgb = (hex: string) => `rgb(${[1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16)).join(', ')})`;
/** How well two computed colours read on each other, as WCAG measures it. */
function contrast(a: string, b: string): number {
  const lum = (colour: string) => {
    const [r, g, bl] = (colour.match(/[\d.]+/g) ?? []).slice(0, 3).map((c) => {
      const s = Number(c) / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [light, dark] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}
/** What the browser draws for each property named. */
const drawn = (locator: Locator, ...names: string[]) =>
  locator.evaluate((element, names) => Object.fromEntries(names.map((name) => [name, getComputedStyle(element).getPropertyValue(name)])), names) as Promise<Record<string, string>>;

/** A screenshot to look at. */
async function shot(page: Page, name: string, options: { viewport?: boolean } = {}) {
  await page.waitForTimeout(150);
  await screen(page, `look-parts-${name}`, { viewport: options.viewport ?? true });
}

/** “Each kind of part”, wherever it is: the screen designer's Look tab or the survey's Look sheet. */
function kindsOf(scope: Locator) {
  const row = scope.locator('[data-setting="Each kind of part"]');
  const kind = (words: string) => row.getByRole('group', { name: words, exact: true });
  return {
    row,
    kind,
    pick: (words: string) => row.getByRole('group', { name: 'Kind of part' }).getByRole('button', { name: words, exact: true }).click(),
    // Each by its name in full: “Text boxes’ background”, “Buttons’ colour”.
    colour: (kindWords: string, name: string) => kind(kindWords).getByLabel(`${kindWords}’ ${name.toLowerCase()}`, { exact: true }),
    press: (kindWords: string, name: string, choice: string) => kind(kindWords).getByRole('group', { name: `${kindWords}’ ${name.toLowerCase()}`, exact: true }).getByRole('button', { name: choice, exact: true }).click(),
  };
}

test.describe('in the survey designer', () => {
  test('text boxes and buttons set in the Look sheet: worn by the cards, by Try it’s form, and Undo takes the colour back', async ({ page }) => {
    const problems = watch(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/designer/?start=survey');
    await page.locator('.fd-designer-bar').getByRole('button', { name: 'Look', exact: true }).click();
    const sheet = page.getByRole('dialog', { name: 'Look' });
    const parts = kindsOf(sheet);
    await parts.row.scrollIntoViewIfNeeded();
    await expect(parts.row.getByRole('group', { name: 'Kind of part' }).getByRole('button', { name: 'Text boxes' })).toHaveAttribute('aria-pressed', 'true');
    await parts.colour('Text boxes', 'Background').fill(CREAM);
    await parts.press('Text boxes', 'Corners', 'Round');
    // The cards wear it at once: a text answer's line on its cream ground, its corners round.
    const cards = page.locator('.fd-survey-canvas');
    await expect(cards).toHaveAttribute('data-inputs', 'bg radius');
    const line = cards.locator('.fd-q-preview-short').first();
    expect(await drawn(line, 'background-color', 'border-top-left-radius')).toEqual({ 'background-color': rgb(CREAM), 'border-top-left-radius': '12px' });
    const addQuestion = cards.locator('.fd-add-question').first();
    const chrome = await drawn(addQuestion, 'font-size', 'color');
    await parts.pick('Buttons');
    await parts.press('Buttons', 'Text size', 'Large');
    await parts.colour('Buttons', 'Colour').fill(PURPLE);
    await expect(cards).toHaveAttribute('data-buttons', 'size accent');
    await expect(parts.row.getByRole('group', { name: 'Kind of part' }).locator('[data-own]')).toHaveText(['Text boxes', 'Buttons']);
    // The designer's own buttons on the cards keep the page's look: the buttons' is the form's.
    expect(await drawn(addQuestion, 'font-size', 'color')).toEqual(chrome);
    await shot(page, '01-survey-sheet');

    // Try it: the form wears them, as people will see it.
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Try it', exact: true }).click();
    const form = page.locator('.fd-try-frame .fd-form');
    const box = form.locator('.fd-input:not([readonly])').first();
    await expect(box).toBeVisible();
    expect(await drawn(box, 'background-color', 'border-top-left-radius')).toEqual({ 'background-color': rgb(CREAM), 'border-top-left-radius': '12px' });
    const next = form.locator('.fd-button-primary').first();
    expect((await drawn(next, 'background-color'))['background-color']).toBe(rgb(PURPLE));
    expect(await axeFindings(page, 'Try it, cream boxes and purple buttons')).toEqual([]);
    await shot(page, '02-try-it');

    // Undo takes the colour back, and only it: Try it shows the page's own button again.
    await page.getByRole('button', { name: 'Design', exact: true }).click();
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect(cards).toHaveAttribute('data-buttons', 'size');
    await expect(cards).toHaveAttribute('data-inputs', 'bg radius');
    await page.getByRole('button', { name: 'Try it', exact: true }).click();
    expect((await drawn(form.locator('.fd-button-primary').first(), 'background-color'))['background-color']).not.toBe(rgb(PURPLE));
    expect(await drawn(form.locator('.fd-input:not([readonly])').first(), 'background-color')).toEqual({ 'background-color': rgb(CREAM) });
    await shot(page, '03-try-it-undone');
    expect(problems).toEqual([]);
  });

  test('a colour no word could be read on is drawn lighter or darker in Try it, and axe finds nothing, light and dark', async ({ page }) => {
    const problems = watch(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/designer/?start=survey');
    await page.locator('.fd-designer-bar').getByRole('button', { name: 'Look', exact: true }).click();
    const sheet = page.getByRole('dialog', { name: 'Look' });
    const parts = kindsOf(sheet);
    await parts.row.scrollIntoViewIfNeeded();
    await parts.colour('Text boxes', 'Background').fill(UNREADABLE.inputs.background);
    await parts.pick('Choices');
    await parts.colour('Choices', 'Accent').fill(UNREADABLE.choices.accent);
    await parts.colour('Choices', 'Background').fill(UNREADABLE.choices.background);
    await parts.pick('Buttons');
    await parts.colour('Buttons', 'Colour').fill(UNREADABLE.buttons.accent);
    // In the sheet, each as picked.
    await expect(parts.kind('Buttons').locator('.fd-part-colour-value')).toHaveText('#ffd60a');
    await shot(page, '04-unreadable-picked');
    for (const scheme of ['Light', 'Dark']) {
      await sheet.getByRole('group', { name: 'Colours', exact: true }).getByRole('button', { name: scheme, exact: true }).click();
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: 'Try it', exact: true }).click();
      const form = page.locator('.fd-try-frame .fd-form');
      const next = form.locator('.fd-button-primary').first();
      const button = await drawn(next, 'background-color', 'color');
      // Yellow is no colour for white words on a light page; on a dark one it reads already, written on in ink.
      if (scheme === 'Light') expect(button['background-color']).not.toBe(rgb(UNREADABLE.buttons.accent));
      expect(contrast(button['background-color'], button.color), scheme).toBeGreaterThanOrEqual(4.5);
      const box = await drawn(form.locator('.fd-input:not([readonly])').first(), 'background-color', 'color');
      expect(box['background-color'], scheme).not.toBe(rgb(UNREADABLE.inputs.background));
      expect(contrast(box['background-color'], box.color), scheme).toBeGreaterThanOrEqual(4.5);
      expect(await axeFindings(page, `Try it, unreadable colours, ${scheme}`)).toEqual([]);
      await shot(page, `05-unreadable-adjusted-${scheme.toLowerCase()}`);
      await page.getByRole('button', { name: 'Design', exact: true }).click();
      await page.locator('.fd-designer-bar').getByRole('button', { name: 'Look', exact: true }).click();
      await parts.row.scrollIntoViewIfNeeded();
    }
    expect(problems).toEqual([]);
  });

  test('right to left in Arabic, and at a phone’s width: Try it wears each kind’s look, nothing scrolls sideways', async ({ page }) => {
    const problems = watch(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/designer/?start=survey');
    await page.locator('.fd-designer-bar').getByRole('button', { name: 'Look', exact: true }).click();
    const parts = kindsOf(page.getByRole('dialog', { name: 'Look' }));
    await parts.row.scrollIntoViewIfNeeded();
    await parts.colour('Text boxes', 'Background').fill(CREAM);
    await parts.press('Text boxes', 'Corners', 'Round');
    await parts.pick('Buttons');
    await parts.colour('Buttons', 'Colour').fill(PURPLE);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Try it', exact: true }).click();
    await page.getByRole('group', { name: 'Language' }).getByRole('button', { name: 'العربية' }).click();
    const form = page.locator('.fd-try-frame .fd-form');
    await expect(form).toHaveAttribute('dir', 'rtl');
    expect(await drawn(form.locator('.fd-input:not([readonly])').first(), 'background-color', 'border-top-right-radius')).toEqual({ 'background-color': rgb(CREAM), 'border-top-right-radius': '12px' });
    expect((await drawn(form.locator('.fd-button-primary').first(), 'background-color'))['background-color']).toBe(rgb(PURPLE));
    expect(await axeFindings(page, 'Try it in Arabic')).toEqual([]);
    await shot(page, '06-try-it-rtl');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('group', { name: 'Width' }).getByRole('button', { name: 'Phone' }).click();
    await page.waitForTimeout(200);
    await expectNoSidewaysScroll(page);
    expect(await axeFindings(page, 'Try it in Arabic, on a phone')).toEqual([]);
    await form.locator('.fd-input:not([readonly])').nth(1).scrollIntoViewIfNeeded();
    await shot(page, '07-try-it-rtl-phone');
    expect(problems).toEqual([]);
  });
});

test.describe('in the screen designer', () => {
  async function lookTab(page: Page, width = 1440) {
    await page.setViewportSize({ width, height: 900 });
    await inAdvanced(page);
    await page.goto('/screen/');
    await expect(page.locator('.fd-canvas:not(.fd-list-canvas)')).toBeVisible();
    await page.evaluate(() => (window.fieldiaDesigner.designer as unknown as { select(id: null): void }).select(null));
    const tab = page.locator('.fd-properties').getByRole('tab', { name: 'Look', exact: true });
    await tab.scrollIntoViewIfNeeded();
    await tab.click();
    const parts = kindsOf(page.locator('.fd-properties'));
    await parts.row.scrollIntoViewIfNeeded();
    return parts;
  }

  test('the canvas wears text boxes’ and groups’ looks as they are set; “As the page” and Undo take them back', async ({ page }) => {
    const problems = watch(page);
    const parts = await lookTab(page);
    const canvas = page.locator('.fd-canvas:not(.fd-list-canvas)');
    const box = canvas.locator('.fd-input:not([readonly])').first();
    const before = await drawn(box, 'background-color', 'border-top-left-radius');
    await parts.colour('Text boxes', 'Background').fill(CREAM);
    await parts.colour('Text boxes', 'Border').fill('#c4320a');
    await parts.press('Text boxes', 'Corners', 'Round');
    await parts.press('Text boxes', 'Text size', 'Large');
    // A box's edge eases to its new colour.
    await page.waitForTimeout(250);
    expect(await drawn(box, 'background-color', 'border-top-color', 'border-top-left-radius', 'font-size')).toEqual({
      'background-color': rgb(CREAM),
      'border-top-color': rgb('#c4320a'),
      'border-top-left-radius': '12px',
      'font-size': '16px',
    });
    await parts.pick('Groups');
    await parts.colour('Groups', 'Background').fill('#002855');
    // Navy is no ground for the page's words: the group is drawn in a pale tint of it instead.
    const group = canvas.locator('.fd-sections > .fd-section').first();
    const ground = (await drawn(group, 'background-color'))['background-color'];
    expect(ground).not.toBe(rgb('#002855'));
    expect(contrast(ground, (await drawn(group.locator('.fd-label').first(), 'color')).color)).toBeGreaterThanOrEqual(4.5);
    await shot(page, '08-screen-canvas');
    expect(await axeFindings(page, 'screen designer, each kind of part set')).toEqual([]);

    // The groups back to the page's, by “As the page”; then Undo, a step at a time.
    await parts.kind('Groups').getByRole('button', { name: 'Groups as the page' }).click();
    expect((await drawn(group, 'background-color'))['background-color']).not.toBe(ground);
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    expect((await drawn(group, 'background-color'))['background-color']).toBe(ground);
    for (let i = 0; i < 5; i++) await page.getByRole('button', { name: 'Undo', exact: true }).click();
    expect(await drawn(box, 'background-color', 'border-top-left-radius')).toEqual(before);
    await expect(canvas).not.toHaveAttribute('data-inputs', /./);
    expect(problems).toEqual([]);
  });

  test('at a phone’s width: the section fits, every target 24px or more, nothing scrolls sideways', async ({ page }) => {
    const problems = watch(page);
    const parts = await lookTab(page, 390);
    await parts.colour('Text boxes', 'Background').fill(CREAM);
    await parts.pick('Choices');
    await parts.row.scrollIntoViewIfNeeded();
    await expectNoSidewaysScroll(page);
    const small = await parts.row.locator('button:visible, label:visible').evaluateAll((all) =>
      all.flatMap((target) => {
        const r = target.getBoundingClientRect();
        return r.width < 24 || r.height < 24 ? [`${target.textContent?.trim() || target.getAttribute('aria-label')} ${Math.round(r.width)}×${Math.round(r.height)}`] : [];
      })
    );
    expect(small).toEqual([]);
    await shot(page, '09-screen-phone');
    expect(problems).toEqual([]);
  });
});

test.describe('a form wearing each kind’s look', () => {
  const url = (query: string, parts: object = PARTS) => `/plain/?page=kinds&${query}&parts=${encodeURIComponent(JSON.stringify(parts))}`;

  for (const skin of ['outlined', 'underline'] as const) {
    for (const scheme of ['light', 'dark', 'auto'] as const) {
      test(`${skin}, ${scheme}: each kind wears its own, and axe finds nothing`, async ({ page }) => {
        await page.setViewportSize({ width: 1100, height: 900 });
        // Auto, as a reader whose system is dark sees it.
        if (scheme === 'auto') await page.emulateMedia({ colorScheme: 'dark' });
        await page.goto(url(`skin=${skin}&scheme=${scheme}`));
        const form = page.locator('.fd-form');
        await expect(form).toBeVisible();
        // Not a box that must be filled: the underline skin draws its line in the accent.
        const box = await drawn(form.locator('.fd-field:not(.fd-required) .fd-input:not([readonly])').first(), 'background-color', 'color', 'border-bottom-color', 'border-top-left-radius', 'font-size');
        expect(box['border-bottom-color']).toBe(rgb('#c4320a'));
        expect(box['border-top-left-radius']).toBe('12px');
        expect(box['font-size']).toBe('16px');
        // Light: the cream as given; dark (and auto in a dark system): a dark ground, never cream under light words.
        if (scheme === 'light') expect(box['background-color']).toBe(rgb(CREAM));
        else expect(box['background-color']).not.toBe(rgb(CREAM));
        expect(contrast(box['background-color'], box.color)).toBeGreaterThanOrEqual(4.5);
        const point = await drawn(form.locator('.fd-points:not(.fd-rating) button').first(), 'border-top-color', 'border-top-left-radius');
        expect(point).toEqual({ 'border-top-color': rgb('#1677ff'), 'border-top-left-radius': '12px' });
        const send = await drawn(form.locator('.fd-actions .fd-button-primary'), 'background-color', 'color', 'border-top-left-radius', 'font-size');
        expect([send['border-top-left-radius'], send['font-size']]).toEqual(['12px', '16px']);
        if (scheme === 'light') expect(send['background-color']).toBe(rgb(PURPLE));
        expect(contrast(send['background-color'], send.color)).toBeGreaterThanOrEqual(4.5);
        const card = await drawn(form.locator('.fd-sections > .fd-section').first(), 'border-top-color', 'border-top-left-radius', 'padding-top');
        expect([card['border-top-color'], card['border-top-left-radius']]).toEqual([rgb('#d6cfc2'), '16px']);
        // The underline skin draws no card round a group: given a ground and an edge, it becomes one.
        expect(parseFloat(card['padding-top'])).toBeGreaterThan(10);
        const head = await drawn(form.locator('.fd-matrix-table thead th').first(), 'border-bottom-color', 'font-size');
        expect(head).toEqual({ 'border-bottom-color': rgb('#9aa3ad'), 'font-size': '13px' });
        expect(await axeFindings(page, `kinds, ${skin}, ${scheme}`)).toEqual([]);
        await shot(page, `10-form-${skin}-${scheme}`, { viewport: false });
      });
    }
  }

  test('colours no word could be read on are adjusted, not shipped: axe finds nothing, light and dark', async ({ page }) => {
    for (const scheme of ['light', 'dark'] as const) {
      await page.goto(url(`skin=outlined&scheme=${scheme}`, UNREADABLE));
      const form = page.locator('.fd-form');
      await expect(form).toBeVisible();
      // Navy is no ground for dark words on a light page, and reads as it is on a dark one; orange is neither's.
      if (scheme === 'light') expect((await drawn(form.locator('.fd-sections > .fd-section').first(), 'background-color'))['background-color']).not.toBe(rgb(UNREADABLE.groups.background));
      expect((await drawn(form.locator('.fd-matrix-table thead th').first(), 'background-color'))['background-color']).not.toBe(rgb(UNREADABLE.tables.background));
      expect(await axeFindings(page, `unreadable colours, ${scheme}`)).toEqual([]);
      await shot(page, `11-form-unreadable-${scheme}`, { viewport: false });
    }
  });

  test('right to left in Arabic, at a phone’s width, in either skin: worn the same, nothing scrolls sideways', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const skin of ['outlined', 'underline'] as const) {
      await page.goto(url(`skin=${skin}&locale=ar&dir=rtl`));
      const form = page.locator('.fd-form');
      await expect(form).toHaveAttribute('dir', 'rtl');
      expect(await drawn(form.locator('.fd-input:not([readonly])').first(), 'background-color', 'border-top-right-radius')).toEqual({ 'background-color': rgb(CREAM), 'border-top-right-radius': '12px' });
      await expectNoSidewaysScroll(page);
      expect(await axeFindings(page, `kinds, Arabic, phone, ${skin}`)).toEqual([]);
      await shot(page, `12-form-rtl-phone-${skin}`, { viewport: false });
    }
  });
});
