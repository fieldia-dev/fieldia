import { expect, test, type Locator, type Page } from '@playwright/test';
import { expectNoSidewaysScroll, node, open, screen } from './support';
import { VARIANTS } from './variants';

/**
 * The newer kinds of question, used as a person uses them — with the mouse,
 * the keyboard and a finger's drag — on the "Office move" example, in English
 * and in Arabic right to left; then each added in the survey designer, its
 * card and its settings, and a quiz's score in Try it.
 */

const valueOf = (page: Page, field: string) => page.evaluate((name) => (window as any).fieldiaDemo.handle.form.getState().values[name], field);
const said = (scope: Locator) => scope.locator('[aria-live=polite]');

/** Press, move in steps at hand speed, release. */
async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }, steps = 8) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) await page.mouse.move(from.x + ((to.x - from.x) * i) / steps, from.y + ((to.y - from.y) * i) / steps, { steps: 2 });
  await page.mouse.up();
}
async function centre(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error('not on screen');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2, box };
}

test.describe('the new kinds in the viewer', () => {
  let problems: string[] = [];
  test.beforeEach(async ({ page }) => {
    ({ problems } = await open(page, 'plain', 'page=kinds&skin=outlined'));
  });
  test.afterEach(() => expect(problems).toEqual([]));

  test('a signature is drawn with the mouse, typed as a name, and cleared', async ({ page }) => {
    const pad = node(page, 'q-signature').locator('canvas');
    await pad.scrollIntoViewIfNeeded();
    const { box } = await centre(pad);
    await page.mouse.move(box.x + 30, box.y + box.height * 0.7);
    await page.mouse.down();
    for (const [x, y] of [[0.2, 0.35], [0.3, 0.75], [0.42, 0.3], [0.55, 0.7], [0.7, 0.4], [0.85, 0.6]]) await page.mouse.move(box.x + box.width * x, box.y + box.height * y, { steps: 6 });
    await page.mouse.up();
    const drawn = await valueOf(page, 'signature');
    expect(drawn).toMatchObject({ name: 'signature.png', type: 'image/png' });
    expect(drawn.data.length).toBeGreaterThan(200);
    await expect(node(page, 'q-signature').locator('.fd-signature-hint')).toBeHidden();
    await screen(page, 'kinds-signature-drawn', { viewport: true });

    await node(page, 'q-signature').getByRole('button', { name: 'Clear' }).click();
    expect(await valueOf(page, 'signature')).toBeNull();
    await expect(node(page, 'q-signature').getByLabel('Or type your name')).toBeFocused();
    await page.keyboard.type('Sara Hassan');
    expect((await valueOf(page, 'signature')).data.length).toBeGreaterThan(200);
    await screen(page, 'kinds-signature-typed', { viewport: true });
  });

  test('a slider moves with a click and the keys, its value beside it', async ({ page }) => {
    const days = node(page, 'q-days');
    const range = days.getByRole('slider');
    await expect(days).toHaveClass(/fd-field/);
    await expect(days.locator('output')).toHaveText('–');
    const { box } = await centre(range);
    await page.mouse.click(box.x + box.width * 0.82, box.y + box.height / 2);
    expect(await valueOf(page, 'office_days')).toBe(4);
    await expect(days.locator('output')).toHaveText('4');
    await page.keyboard.press('ArrowLeft');
    expect(await valueOf(page, 'office_days')).toBe(3);
    await page.keyboard.press('End');
    expect(await valueOf(page, 'office_days')).toBe(5);
    // Halves on the decimal one.
    const commute = node(page, 'q-commute').getByRole('slider');
    await commute.focus();
    await page.keyboard.press('Home');
    await page.keyboard.press('ArrowRight');
    expect(await valueOf(page, 'commute')).toBe(0.5);
    await expect(node(page, 'q-commute').locator('output')).toHaveText('0.5');
    await days.getByRole('button', { name: 'Clear selection' }).click();
    expect(await valueOf(page, 'office_days')).toBeNull();
    await screen(page, 'kinds-sliders', { viewport: true });
  });

  test('tags are found as one types, added with Enter or a click, and taken away', async ({ page }) => {
    const rooms = node(page, 'q-rooms');
    const box = rooms.getByRole('combobox');
    await box.click();
    await expect(rooms.getByRole('option')).toHaveCount(6);
    await page.keyboard.type('qui');
    await expect(rooms.getByRole('option')).toHaveText(['Quiet room']);
    await page.keyboard.press('Enter');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await rooms.getByRole('option', { name: 'Roof garden' }).click();
    expect(await valueOf(page, 'rooms')).toEqual(['quiet', 'meeting', 'roof']);
    await screen(page, 'kinds-tags', { viewport: true });
    await rooms.getByRole('button', { name: 'Remove Meeting rooms' }).click();
    await box.focus();
    await page.keyboard.press('Backspace');
    expect(await valueOf(page, 'rooms')).toEqual(['quiet']);
  });

  test('pictures are picked with a click, then with the arrows; several are ticked', async ({ page }) => {
    const desk = node(page, 'q-desk');
    await desk.scrollIntoViewIfNeeded();
    await desk.getByRole('radio', { name: 'Corner desk' }).click();
    expect(await valueOf(page, 'desk')).toBe('corner');
    await page.keyboard.press('ArrowRight');
    expect(await valueOf(page, 'desk')).toBe('bench');
    await expect(desk.getByRole('radio', { name: 'Shared bench' })).toBeFocused();
    // One stop for Tab: the one picked.
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await expect(desk.getByRole('radio', { name: 'Shared bench' })).toBeFocused();
    const kitchen = node(page, 'q-kitchen');
    await kitchen.getByRole('checkbox', { name: 'A big fridge' }).click();
    await kitchen.getByRole('checkbox', { name: 'Coffee machine' }).click();
    expect(await valueOf(page, 'kitchen')).toEqual(['coffee', 'fridge']);
    await screen(page, 'kinds-image-choice', { viewport: true });
  });

  test('a ranking is put in order by dragging, by its buttons and by Alt and the arrows, each move said', async ({ page }) => {
    const ranking = node(page, 'q-priorities');
    await ranking.scrollIntoViewIfNeeded();
    const words = ranking.locator('.fd-rank-words');
    const start = await words.allTextContents();
    expect([...start].sort()).toEqual(['Daylight', 'Near the kitchen', 'Quiet', 'Storage', 'Two screens']);
    // The first line dragged by its grip, at hand speed, to below the third.
    const grip = await centre(ranking.locator('.fd-rank-grip').first());
    const third = await centre(ranking.locator('.fd-rank-item').nth(2));
    await drag(page, grip, { x: grip.x, y: third.box.y + third.box.height * 0.8 });
    const dragged = [start[1], start[2], start[0], start[3], start[4]];
    await expect(words).toHaveText(dragged);
    expect(await valueOf(page, 'priorities')).toHaveLength(5);
    await expect(said(ranking)).toHaveText(`${start[0]} moved to place 3 of 5`);
    // Its button, then Alt+↑ from the keyboard.
    await ranking.getByRole('button', { name: `Move ${start[0]} up` }).click();
    await expect(words).toHaveText([start[1], start[0], start[2], start[3], start[4]]);
    await page.keyboard.press('Alt+ArrowUp');
    await expect(words).toHaveText([start[0], start[1], start[2], start[3], start[4]]);
    await expect(said(ranking)).toHaveText(`${start[0]} moved to place 1 of 5`);
    await expect(ranking.getByRole('button', { name: `Move ${start[0]} down` })).toBeFocused();
    await screen(page, 'kinds-ranking', { viewport: true });
  });

  test('an address is typed in its parts', async ({ page }) => {
    const address = node(page, 'q-address');
    await address.getByLabel('Street address').fill('12 Nile Street');
    await address.getByLabel('City').fill('Cairo');
    await address.getByLabel('Postcode').fill('11511');
    // The country it starts on, kept with what was typed.
    await expect(address.getByLabel('Country')).toHaveValue('EG');
    expect(await valueOf(page, 'badge_address')).toEqual({ street: '12 Nile Street', city: 'Cairo', postcode: '11511', country: 'EG' });
    await screen(page, 'kinds-address', { viewport: true });
  });

  test('a repeating group adds cards up to its most, the cursor in each new one, and removes them', async ({ page }) => {
    const group = node(page, 'q-movers');
    await group.scrollIntoViewIfNeeded();
    const add = group.getByRole('button', { name: 'Add a person' });
    await add.click();
    await expect(group.getByRole('group', { name: 'Person 1' }).getByLabel('Name')).toBeFocused();
    await page.keyboard.type('Omar');
    await page.keyboard.press('Tab');
    await page.keyboard.type('Designer');
    for (let i = 0; i < 3; i++) await add.click();
    await expect(group.locator('.fd-repeat-card')).toHaveCount(4);
    await expect(add).toBeHidden();
    await screen(page, 'kinds-cards', { viewport: true });
    await group.getByRole('button', { name: 'Remove Person 2' }).click();
    await expect(said(group)).toHaveText('Person 2 removed');
    await expect(group.getByRole('group', { name: 'Person 2' }).getByLabel('Name')).toBeFocused();
    await expect(add).toBeVisible();
    const lines = await valueOf(page, 'movers');
    expect(lines.map((l: any) => l.values.name)).toEqual(['Omar', null, null]);
  });

  test('the whole page is sent with every kind’s answer', async ({ page }) => {
    await node(page, 'q-name').locator('input').fill('Sara Hassan');
    await node(page, 'q-days').getByRole('slider').focus();
    await page.keyboard.press('End');
    await node(page, 'q-desk').getByRole('radio', { name: 'Quiet booth' }).click();
    await node(page, 'q-kitchen-floor').getByRole('radio', { name: 'The third floor' }).click();
    await node(page, 'q-signature').getByLabel('Or type your name').fill('Sara Hassan');
    // The choices' required questions: a yes or no, and a tick box that must be ticked.
    await node(page, 'q-drive').getByRole('radio', { name: 'No' }).click();
    await node(page, 'q-guide').getByRole('checkbox').check();
    await screen(page, 'kinds-page-filled');
    await page.getByRole('button', { name: 'Submit' }).click();
    await expect(page.locator('.fd-done')).toBeVisible();
    const sent = await page.evaluate(() => (window as any).fieldiaDemo.dataSource.responses[0].values);
    expect(sent).toMatchObject({ name: 'Sara Hassan', office_days: 5, desk: 'booth', kitchen_floor: 'third', signature: { type: 'image/png' }, drive: false, guide: true });
  });

  test('fits a phone', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await expectNoSidewaysScroll(page);
    await screen(page, 'kinds-phone');
  });
});

/** Every framework draws the same widgets: the page renders in each, with nothing said in the console. */
for (const variant of VARIANTS) {
  test(`${variant}: the office move page renders every new kind`, async ({ page }) => {
    const { problems } = await open(page, variant, 'page=kinds&skin=outlined');
    for (const selector of ['.fd-signature', '.fd-slider', '.fd-choice-tags', '.fd-image-choices', '.fd-ranking', '.fd-address', '.fd-repeat']) await expect(page.locator(selector).first()).toBeVisible();
    await expectNoSidewaysScroll(page);
    expect(problems).toEqual([]);
  });
}

test.describe('the new kinds right to left, in Arabic', () => {
  let problems: string[] = [];
  test.beforeEach(async ({ page }) => {
    ({ problems } = await open(page, 'plain', 'page=kinds&skin=outlined&locale=ar&dir=rtl'));
  });
  test.afterEach(() => expect(problems).toEqual([]));

  test('a slider runs from the right, its ends mirrored, and its arrows follow the page', async ({ page }) => {
    const days = node(page, 'q-days');
    const ends = days.locator('.fd-slider-ends span');
    const [low, high] = [await centre(ends.first()), await centre(ends.last())];
    // 0 on the right, 5 on the left.
    expect(low.x).toBeGreaterThan(high.x);
    const { box } = await centre(days.getByRole('slider'));
    // Near the left end is near the top of the range.
    await page.mouse.click(box.x + box.width * 0.15, box.y + box.height / 2);
    expect(await valueOf(page, 'office_days')).toBe(4);
    await expect(days.getByRole('slider')).toHaveAttribute('aria-valuetext', '4');
    await screen(page, 'kinds-ar-slider', { viewport: true });
  });

  test('pictures go forward to the left with the arrows', async ({ page }) => {
    const desk = node(page, 'q-desk');
    await desk.scrollIntoViewIfNeeded();
    const first = await centre(desk.getByRole('radio', { name: 'Standing desk' }));
    const second = await centre(desk.getByRole('radio', { name: 'Corner desk' }));
    expect(first.x).toBeGreaterThan(second.x);
    await desk.getByRole('radio', { name: 'Standing desk' }).click();
    await page.keyboard.press('ArrowLeft');
    expect(await valueOf(page, 'desk')).toBe('corner');
    await expect(desk.getByRole('button', { name: 'محو التحديد' })).toBeVisible();
    await screen(page, 'kinds-ar-image-choice', { viewport: true });
  });

  test('a ranking speaks Arabic, and moves by Alt and the arrows', async ({ page }) => {
    const ranking = node(page, 'q-priorities');
    await ranking.scrollIntoViewIfNeeded();
    const words = ranking.locator('.fd-rank-words');
    const start = await words.allTextContents();
    await ranking.getByRole('button', { name: `نقل ${start[0]} لأسفل` }).click();
    await expect(words.nth(1)).toHaveText(start[0]);
    await page.keyboard.press('Alt+ArrowDown');
    await expect(words.nth(2)).toHaveText(start[0]);
    await expect(said(ranking)).toHaveText(`أصبح ${start[0]} في المرتبة 3 من 5`);
    // The numbers and grips sit on the right, the buttons on the left.
    const place = await centre(ranking.locator('.fd-rank-place').first());
    const tools = await centre(ranking.locator('.fd-rank-tools').first());
    expect(place.x).toBeGreaterThan(tools.x);
    await screen(page, 'kinds-ar-ranking', { viewport: true });
  });

  test('the whole page reads right to left', async ({ page }) => {
    await expectNoSidewaysScroll(page);
    await screen(page, 'kinds-ar-page');
  });
});

/** The designer: each new kind added from the toolbox, its card open and closed, and its settings at work. */
test.describe('the new kinds in the survey designer', () => {
  const picked = (page: Page) => page.locator('.fd-q-selected');
  let problems: string[] = [];
  test.beforeEach(async ({ page }) => {
    problems = [];
    page.on('pageerror', (error) => problems.push(error.message));
    page.on('console', (message) => message.type() === 'error' && problems.push(message.text()));
    await page.goto('/designer/');
    await expect(page.locator('.fd-designer')).toBeVisible();
  });
  test.afterEach(() => expect(problems).toEqual([]));

  const KINDS: [string, string, string][] = [
    ['signature', 'Signature', '.fd-q-preview-signature'],
    ['slider', 'Slider', '.fd-slider'],
    ['tags', 'Tags', '.fd-q-preview-tags'],
    ['image-choice', 'Image choice', '.fd-image-choices'],
    ['ranking', 'Ranking', '.fd-ranking'],
    ['matrix', 'Matrix', '.fd-matrix'],
    ['address', 'Address', '.fd-q-preview-lines'],
    ['repeating', 'Repeating group', '.fd-q-preview-cards'],
  ];

  test('adds each new kind from the toolbox, open to edit, then shown as people will see it', async ({ page }) => {
    for (const [id, name] of KINDS) {
      await page.locator(`.fd-toolbox [data-tool="kind:${id}"]`).click();
      await expect(picked(page).locator('.fd-q-kind')).toHaveAttribute('aria-label', `Kind of question: ${name}`);
      await expect(picked(page).locator('.fd-q-label')).toBeFocused();
      await page.keyboard.type(`${name} question`);
      await screen(page, `kinds-designer-open-${id}`, { viewport: true });
    }
    await page.keyboard.press('Escape');
    await expect(picked(page)).toHaveCount(0);
    const cards = page.locator('.fd-q');
    for (const [i, [id, , preview]] of KINDS.entries()) {
      await expect(cards.nth(i).locator(`.fd-q-answer ${preview}`)).toBeVisible();
      await cards.nth(i).scrollIntoViewIfNeeded();
      await screen(page, `kinds-designer-closed-${id}`, { viewport: true });
    }
    await screen(page, 'kinds-designer-all');
  });

  test('sets a matrix’s rows, a picture for an option, an address’s parts and a slider’s range', async ({ page }) => {
    const tool = (id: string) => page.locator(`.fd-toolbox [data-tool="kind:${id}"]`).click();
    await tool('matrix');
    await picked(page).getByLabel('Row 1', { exact: true }).fill('Food');
    await picked(page).getByRole('button', { name: 'Add column' }).click();
    await expect(picked(page).getByLabel('Column 3', { exact: true })).toBeFocused();
    await page.keyboard.type('Great');
    await screen(page, 'kinds-designer-matrix-settings', { viewport: true });

    await tool('image-choice');
    await picked(page).getByLabel('Option 1', { exact: true }).fill('Standing desk');
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 3"><rect width="4" height="3" fill="#2f5d8a"/></svg>');
    await picked(page).locator('.fd-kind-picture input[type=file]').setInputFiles({ name: 'desk.svg', mimeType: 'image/svg+xml', buffer: svg });
    await expect(picked(page).locator('.fd-kind-thumb img')).toHaveCount(1);
    await picked(page).getByRole('switch', { name: 'Several answers' }).click();
    await expect(picked(page).getByRole('switch', { name: 'Several answers' })).toHaveAttribute('aria-checked', 'true');
    await screen(page, 'kinds-designer-picture-settings', { viewport: true });

    await tool('address');
    await picked(page).getByRole('group', { name: 'Parts of the address' }).getByRole('button', { name: 'Country' }).click();
    await expect(picked(page).locator('.fd-q-answer .fd-q-preview-part')).toHaveText(['Street address', 'City', 'Postcode']);

    await tool('slider');
    await picked(page).getByLabel('To', { exact: true }).fill('5');
    await picked(page).getByLabel('To', { exact: true }).press('Enter');
    await expect(picked(page).locator('.fd-slider-ends span').last()).toHaveText('5');
    await screen(page, 'kinds-designer-slider-settings', { viewport: true });
  });

  test('makes a quiz, shuffles its options, and Try it says the score once sent', async ({ page }) => {
    await page.locator('.fd-toolbox [data-tool="kind:multiple-choice"]').click();
    await page.keyboard.type('Which floor is the kitchen on?');
    await picked(page).getByLabel('Option 1', { exact: true }).fill('Ground');
    await picked(page).getByRole('button', { name: 'Add option' }).click();
    await picked(page).getByLabel('Option 2', { exact: true }).fill('Third');
    await picked(page).getByRole('button', { name: 'Give points: make it a quiz' }).click();
    await picked(page).getByLabel('Points for Third').fill('2');
    await picked(page).getByRole('switch', { name: 'Shuffle option order' }).click();
    await expect(picked(page).getByRole('switch', { name: 'Shuffle option order' })).toHaveAttribute('aria-checked', 'true');
    await screen(page, 'kinds-designer-quiz-settings', { viewport: true });
    await page.getByRole('button', { name: 'Try it' }).click();
    const trial = page.locator('.fd-try');
    await trial.getByRole('radio', { name: 'Third' }).check();
    await trial.getByRole('button', { name: /Send|Submit|Finish/ }).click();
    await expect(trial.locator('.fd-try-score')).toHaveText('Score: 2 of 2');
    await screen(page, 'kinds-designer-quiz-score', { viewport: true });
  });
});
