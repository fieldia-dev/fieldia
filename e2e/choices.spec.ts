import { expect, test, type Page } from '@playwright/test';
import { axeFindings } from './a11y-support';
import { expectNoSidewaysScroll, node, open, screen } from './support';

/**
 * The choice kinds' details, used as a person uses them: on the "Office move"
 * example — a yes or no as two buttons, a tick box that must be ticked, a
 * limit on boxes ticked, "None of these", columns, a dropdown that searches,
 * tags of one's own, pictures described, a ranking kept as shown and one of
 * the top few, and a matrix that becomes cards on a phone — at a desk, on a
 * phone and right to left; then each setting in the survey designer and the
 * screen editor, on the card and in Try it.
 */

const valueOf = (page: Page, field: string) => page.evaluate((name) => (window as any).fieldiaDemo.handle.form.getState().values[name], field);
const PHONE = { width: 390, height: 844 };

test.describe('the choice kinds in the viewer', () => {
  let problems: string[] = [];
  test.beforeEach(async ({ page }) => {
    ({ problems } = await open(page, 'plain', 'page=kinds&skin=outlined'));
  });
  test.afterEach(() => expect(problems).toEqual([]));

  test('a yes or no is two buttons, neither picked until one is, and “No” answers it', async ({ page }) => {
    const drive = node(page, 'q-drive');
    await drive.scrollIntoViewIfNeeded();
    const group = drive.getByRole('radiogroup', { name: 'Will you drive to the new building?' });
    const [yes, no] = [group.getByRole('radio', { name: 'Yes, I will' }), group.getByRole('radio', { name: 'No' })];
    await expect(yes).toHaveAttribute('aria-checked', 'false');
    await expect(no).toHaveAttribute('aria-checked', 'false');
    expect(await valueOf(page, 'drive')).toBeNull();
    // Required, it asks for an answer when the form is sent.
    await page.getByRole('button', { name: 'Submit', exact: true }).click();
    await expect(drive.locator('.fd-error')).toHaveText('Will you drive to the new building? is required');
    await no.click();
    expect(await valueOf(page, 'drive')).toBe(false);
    await expect(drive.locator('.fd-error')).toBeHidden();
    // One stop for Tab; the arrows go to the other and pick it.
    await page.keyboard.press('ArrowRight');
    await expect(yes).toBeFocused();
    expect(await valueOf(page, 'drive')).toBe(true);
    await screen(page, 'choices-yes-no', { viewport: true });
  });

  test('a tick box that must be ticked says so, and is answered once ticked', async ({ page }) => {
    await page.getByRole('button', { name: 'Submit', exact: true }).click();
    const guide = node(page, 'q-guide');
    await expect(guide.locator('.fd-error')).toHaveText('Tick this box to go on');
    await guide.scrollIntoViewIfNeeded();
    await screen(page, 'choices-tick-required', { viewport: true });
    await guide.getByRole('checkbox', { name: 'I have read the moving guide' }).check();
    await expect(guide.locator('.fd-error')).toBeHidden();
  });

  test('checkboxes in two columns take three at most, the rest waiting, and “None of these” goes alone', async ({ page }) => {
    const bring = node(page, 'q-bring');
    await bring.scrollIntoViewIfNeeded();
    const box = (name: string) => bring.getByRole('checkbox', { name, exact: true });
    // Two columns: the second option beside the first.
    const [first, second] = [await box('My screen').boundingBox(), await box('My chair').boundingBox()];
    expect(Math.abs((first?.y ?? 0) - (second?.y ?? 0))).toBeLessThan(4);
    expect(second?.x ?? 0).toBeGreaterThan(first?.x ?? 0);
    for (const name of ['My screen', 'Plants', 'Photos']) await box(name).check();
    await expect(box('My chair')).toBeDisabled();
    await expect(box('A lamp')).toBeDisabled();
    await expect(box('None of these')).toBeEnabled();
    await expect(bring.getByRole('status')).toHaveText('Up to 3');
    await screen(page, 'choices-checkboxes-limit', { viewport: true });
    await box('None of these').check();
    expect(await valueOf(page, 'bring')).toEqual(['nothing']);
    await expect(box('My screen')).not.toBeChecked();
    await expect(box('My chair')).toBeEnabled();
    await box('A lamp').check();
    expect(await valueOf(page, 'bring')).toEqual(['lamp']);
    await expect(box('None of these')).not.toBeChecked();
    await screen(page, 'choices-none-of-these', { viewport: true });
  });

  test('a long dropdown searches its list, by the keys and the mouse', async ({ page }) => {
    const floor = node(page, 'q-floor');
    const combo = floor.getByRole('combobox', { name: 'Which floor would you like to sit on?' });
    await combo.scrollIntoViewIfNeeded();
    await combo.click();
    await expect(combo).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.type('1');
    const list = floor.getByRole('listbox');
    await expect(list.getByRole('option')).toHaveCount(10);
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await expect(combo).toHaveAttribute('aria-activedescendant', /-list-1$/);
    await screen(page, 'choices-search-list', { viewport: true });
    await page.keyboard.press('Enter');
    expect(await valueOf(page, 'floor')).toBe('floor_10');
    await expect(combo).toHaveValue('Floor 10');
    await expect(combo).toHaveAttribute('aria-expanded', 'false');
    // Half typed and left, it shows the choice again.
    await combo.fill('Roo');
    await list.getByRole('option', { name: 'Roof terrace' }).click();
    expect(await valueOf(page, 'floor')).toBe('roof');
    await combo.fill('Gr');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Tab');
    await expect(combo).toHaveValue('Roof terrace');
  });

  test('tags take words of one’s own', async ({ page }) => {
    const needs = node(page, 'q-needs');
    const combo = needs.getByRole('combobox');
    await combo.scrollIntoViewIfNeeded();
    await combo.fill('Bike room');
    await expect(needs.getByRole('option')).toHaveText(['Create “Bike room”']);
    await page.keyboard.press('Enter');
    await combo.fill('Lock');
    await expect(needs.getByRole('option')).toHaveText(['Lockers', 'Create “Lock”']);
    await page.keyboard.press('Enter');
    expect(await valueOf(page, 'needs')).toEqual(['Bike room', 'lockers']);
    await expect(needs.locator('.fd-chip-label')).toHaveText(['Bike room', 'Lockers']);
    await screen(page, 'choices-tags-own', { viewport: true });
  });

  test('pictures are described, small ones are small, and the whole picture shows', async ({ page }) => {
    const desk = node(page, 'q-desk');
    await desk.scrollIntoViewIfNeeded();
    await expect(desk.locator('img').first()).toHaveAttribute('alt', 'A tall desk with a screen on it, the sun beside it');
    const kitchen = node(page, 'q-kitchen');
    const [big, small] = [await desk.locator('.fd-image-card').first().boundingBox(), await kitchen.locator('.fd-image-card').first().boundingBox()];
    expect(small?.width ?? 0).toBeLessThan((big?.width ?? 0) - 20);
    await expect(kitchen.locator('img').first()).toHaveCSS('object-fit', 'contain');
    await screen(page, 'choices-pictures', { viewport: true });
  });

  test('a ranking is answered as it is shown with “Keep this order”', async ({ page }) => {
    const ranking = node(page, 'q-priorities');
    await ranking.scrollIntoViewIfNeeded();
    const shown = await ranking.locator('.fd-rank-words').allTextContents();
    expect(await valueOf(page, 'priorities')).toEqual([]);
    await ranking.getByRole('button', { name: 'Keep this order' }).click();
    const labels = { daylight: 'Daylight', quiet: 'Quiet', kitchen: 'Near the kitchen', storage: 'Storage', screens: 'Two screens' } as Record<string, string>;
    expect(((await valueOf(page, 'priorities')) as string[]).map((v) => labels[v])).toEqual(shown);
    await expect(ranking.getByRole('button', { name: 'Keep this order' })).toBeHidden();
  });

  test('a ranking of the top three: picked from the rest, then put in order', async ({ page }) => {
    const miss = node(page, 'q-miss');
    await miss.scrollIntoViewIfNeeded();
    const pick = (name: string) => miss.locator('.fd-rank-pool').getByRole('button', { name, exact: true });
    for (const name of ['The park', 'The view', 'Parking']) await pick(name).click();
    await expect(pick('The station')).toBeDisabled();
    await expect(miss.locator('.fd-rank-words')).toHaveText(['The park', 'The view', 'Parking']);
    await miss.getByRole('button', { name: 'Move Parking up' }).click();
    expect(await valueOf(page, 'miss')).toEqual(['park', 'parking', 'view']);
    await screen(page, 'choices-ranking-top', { viewport: true });
    await miss.getByRole('button', { name: 'Remove The view' }).click();
    await expect(pick('The station')).toBeEnabled();
    expect(await valueOf(page, 'miss')).toEqual(['park', 'parking']);
  });

  test('a matrix takes several answers in a row', async ({ page }) => {
    const when = node(page, 'q-when');
    await when.scrollIntoViewIfNeeded();
    await when.getByRole('checkbox', { name: 'Kitchen: Mornings' }).check();
    await when.getByRole('checkbox', { name: 'Kitchen: Evenings' }).check();
    expect(await valueOf(page, 'when')).toEqual({ kitchen: ['morning', 'evening'] });
    await screen(page, 'choices-matrix', { viewport: true });
  });

  test('the new questions pass axe, answered and not', async ({ page }) => {
    expect(await axeFindings(page, 'unanswered')).toEqual([]);
    await node(page, 'q-drive').getByRole('radio', { name: 'No' }).click();
    for (const name of ['My screen', 'Plants', 'Photos']) await node(page, 'q-bring').getByRole('checkbox', { name, exact: true }).check();
    await node(page, 'q-floor').getByRole('combobox').click();
    await page.keyboard.type('Fl');
    await page.keyboard.press('ArrowDown');
    expect(await axeFindings(page, 'answered, a list open')).toEqual([]);
  });
});

test.describe('the choice kinds on a phone', () => {
  test.use({ viewport: PHONE });

  test('columns stack, a matrix’s rows become cards with their answers listed, nothing scrolls sideways', async ({ page }) => {
    const { problems } = await open(page, 'plain', 'page=kinds&skin=outlined');
    const bring = node(page, 'q-bring');
    await bring.scrollIntoViewIfNeeded();
    const [first, second] = [await bring.getByRole('checkbox', { name: 'My screen' }).boundingBox(), await bring.getByRole('checkbox', { name: 'My chair' }).boundingBox()];
    expect(second?.y ?? 0).toBeGreaterThan((first?.y ?? 0) + 10);
    const when = node(page, 'q-when');
    await when.scrollIntoViewIfNeeded();
    await expect(when.locator('thead')).toBeHidden();
    await expect(when.locator('tbody tr').first().locator('.fd-matrix-column')).toHaveText(['Mornings', 'Afternoons', 'Evenings']);
    // A card's words pick its answer.
    await when.locator('tbody tr', { hasText: 'Quiet room' }).getByText('Afternoons').click();
    expect(await valueOf(page, 'when')).toEqual({ quiet: ['afternoon'] });
    await expectNoSidewaysScroll(page);
    await screen(page, 'choices-phone-matrix', { viewport: true });
    await node(page, 'q-drive').scrollIntoViewIfNeeded();
    await screen(page, 'choices-phone-details', { viewport: true });
    expect(problems).toEqual([]);
  });
});

test.describe('the choice kinds right to left, in Arabic', () => {
  test('the buttons, the limit and the matrix read right to left', async ({ page }) => {
    const { problems } = await open(page, 'plain', 'page=kinds&skin=outlined&locale=ar&dir=rtl');
    const drive = node(page, 'q-drive');
    await drive.scrollIntoViewIfNeeded();
    const [yes, no] = [drive.getByRole('radio').first(), drive.getByRole('radio').last()];
    await expect(no).toHaveText('لا');
    // The first button on the right.
    expect((await yes.boundingBox())?.x ?? 0).toBeGreaterThan((await no.boundingBox())?.x ?? 0);
    await yes.click();
    await page.keyboard.press('ArrowLeft');
    await expect(no).toBeFocused();
    expect(await valueOf(page, 'drive')).toBe(false);
    const bring = node(page, 'q-bring');
    for (const name of ['My screen', 'Plants', 'Photos']) await bring.getByRole('checkbox', { name, exact: true }).check();
    await expect(bring.getByRole('status')).toHaveText('حتى 3');
    await screen(page, 'choices-ar-details', { viewport: true });
    await expectNoSidewaysScroll(page);
    expect(problems).toEqual([]);
  });
});

/** The survey designer: each setting on the picked question's card, and at work in Try it. */
test.describe('the choice kinds in the survey designer', () => {
  const picked = (page: Page) => page.locator('.fd-q-selected');
  const tried = (page: Page) => page.locator('.fd-try');
  let problems: string[] = [];
  test.beforeEach(async ({ page }) => {
    problems = [];
    page.on('pageerror', (error) => problems.push(error.message));
    page.on('console', (message) => message.type() === 'error' && problems.push(message.text()));
    await page.goto('/designer/');
    await expect(page.locator('.fd-designer')).toBeVisible();
  });
  test.afterEach(() => expect(problems).toEqual([]));
  async function add(page: Page, kind: string, label: string) {
    await page.locator(`.fd-toolbox [data-tool="kind:${kind}"]`).click();
    await expect(picked(page).locator('.fd-q-label')).toBeFocused();
    await page.keyboard.type(label);
  }
  async function options(page: Page, labels: string[]) {
    for (const [i, label] of labels.entries()) {
      if (i > 0) await picked(page).getByRole('button', { name: 'Add option' }).click();
      await picked(page).getByLabel(`Option ${i + 1}`, { exact: true }).fill(label);
    }
  }
  const tryIt = (page: Page) => page.getByRole('button', { name: 'Try it' }).click();
  const design = (page: Page) => page.getByRole('button', { name: 'Design', exact: true }).click();

  test('a yes or no: buttons with words of its own, required in Try it, or a switch', async ({ page }) => {
    await add(page, 'yes-no', 'Coming to the party?');
    await expect(picked(page).locator('.fd-q-answer').getByRole('radio')).toHaveText(['Yes', 'No']);
    await picked(page).getByLabel('Words for yes').fill('I’ll be there');
    await expect(picked(page).locator('.fd-q-answer').getByRole('radio').first()).toHaveText('I’ll be there');
    await picked(page).getByRole('switch', { name: 'Required' }).click();
    await screen(page, 'choices-designer-yes-no', { viewport: true });
    await tryIt(page);
    await tried(page).getByRole('button', { name: /Send|Submit|Finish/ }).click();
    await expect(tried(page).locator('.fd-error')).toHaveText('Coming to the party? is required');
    await tried(page).getByRole('radio', { name: 'No' }).click();
    await expect(tried(page).locator('.fd-error')).toBeHidden();
    await screen(page, 'choices-designer-yes-no-tried', { viewport: true });
    await design(page);
    await page.locator('.fd-q').first().click();
    await picked(page).getByLabel('Show as').selectOption('switch');
    await expect(picked(page).locator('.fd-q-answer').getByRole('switch')).toBeVisible();
  });

  test('a tick box made required must be ticked in Try it', async ({ page }) => {
    await add(page, 'tick', 'I agree to the terms');
    await picked(page).getByRole('switch', { name: 'Required' }).click();
    await tryIt(page);
    await tried(page).getByRole('button', { name: /Send|Submit|Finish/ }).click();
    await expect(tried(page).locator('.fd-error')).toHaveText('Tick this box to go on');
    await screen(page, 'choices-designer-tick-tried', { viewport: true });
    await tried(page).getByRole('checkbox', { name: 'I agree to the terms' }).check();
    await expect(tried(page).locator('.fd-error')).toBeHidden();
  });

  test('checkboxes: options moved by keys and by their grip, “None of these” and two columns, at work in Try it', async ({ page }) => {
    await add(page, 'checkboxes', 'What do you bring?');
    await options(page, ['Lamp', 'Chair', 'Plant']);
    // Alt+↑ moves the option the cursor is in; the cursor goes with it.
    await picked(page).getByLabel('Option 3', { exact: true }).focus();
    await page.keyboard.press('Alt+ArrowUp');
    await expect(picked(page).getByLabel('Option 2', { exact: true })).toHaveValue('Plant');
    await expect(picked(page).getByLabel('Option 2', { exact: true })).toBeFocused();
    // Dragged by its grip, at hand speed.
    const rows = picked(page).locator('.fd-q-options > .fd-q-option');
    await rows.first().hover();
    const grip = await rows.first().locator('.fd-q-option-grip').boundingBox();
    const last = await rows.last().boundingBox();
    if (!grip || !last) throw new Error('not on screen');
    await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
    await page.mouse.down();
    for (let i = 1; i <= 8; i++) await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2 + ((last.y + last.height - 4 - grip.y) * i) / 8, { steps: 2 });
    await page.mouse.up();
    await expect.poll(() => picked(page).locator('.fd-q-option input').evaluateAll((boxes) => boxes.map((b) => (b as HTMLInputElement).value))).toEqual(['Plant', 'Chair', 'Lamp']);
    await picked(page).getByRole('button', { name: 'add “None of these”' }).click();
    await expect(picked(page).locator('.fd-q-alone:not([hidden])')).toHaveCount(1);
    await expect(picked(page).locator('.fd-q-options > .fd-q-option').last().locator('.fd-q-alone')).toBeVisible();
    await picked(page).getByLabel('Lay out').selectOption('2');
    await screen(page, 'choices-designer-checkboxes', { viewport: true });
    await tryIt(page);
    const box = (name: string) => tried(page).getByRole('checkbox', { name, exact: true });
    const [a, b] = [await box('Plant').boundingBox(), await box('Chair').boundingBox()];
    expect(Math.abs((a?.y ?? 0) - (b?.y ?? 0))).toBeLessThan(4);
    await box('Plant').check();
    await box('None of these').check();
    await expect(box('Plant')).not.toBeChecked();
    await screen(page, 'choices-designer-checkboxes-tried', { viewport: true });
  });

  test('a dropdown that searches, and tags of one’s own, in Try it', async ({ page }) => {
    await add(page, 'dropdown', 'Which office?');
    await options(page, ['Cairo', 'Giza', 'Alexandria']);
    await picked(page).getByRole('switch', { name: 'Search the list' }).click();
    await add(page, 'tags', 'Your skills');
    await options(page, ['Writing', 'Drawing']);
    await picked(page).getByRole('switch', { name: 'Let people add their own' }).click();
    await screen(page, 'choices-designer-tags', { viewport: true });
    await tryIt(page);
    const office = tried(page).getByRole('combobox', { name: 'Which office?' });
    await office.fill('gi');
    await page.keyboard.press('Enter');
    await expect(office).toHaveValue('Giza');
    const skills = tried(page).getByRole('combobox', { name: 'Your skills' });
    await skills.fill('Juggling');
    await page.keyboard.press('Enter');
    await expect(tried(page).locator('.fd-chip-label')).toHaveText(['Juggling']);
    await screen(page, 'choices-designer-search-tried', { viewport: true });
  });

  test('pictures: an upload made 1200 px wide, described, their words hidden, in Try it', async ({ page }) => {
    await add(page, 'image-choice', 'Which desk?');
    await options(page, ['Standing desk']);
    const png = await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      canvas.width = 2400;
      canvas.height = 1600;
      const g = canvas.getContext('2d') as CanvasRenderingContext2D;
      g.fillStyle = '#2f5d8a';
      g.fillRect(0, 0, 2400, 1600);
      g.fillStyle = '#f5b14c';
      g.fillRect(400, 300, 900, 600);
      return canvas.toDataURL('image/png').split(',')[1];
    });
    await picked(page).locator('.fd-kind-picture input[type=file]').setInputFiles({ name: 'desk.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
    await expect(picked(page).locator('.fd-kind-thumb img')).toHaveCount(1);
    const width = await page.evaluate(async () => {
      const designer = (window as any).fieldiaDesigner.designer;
      const fields = designer.getPage().fields;
      const src = (Object.values(fields) as any[]).find((f) => f.label === 'Which desk?').options[0].image as string;
      const image = new Image();
      image.src = src;
      await image.decode();
      return image.naturalWidth;
    });
    expect(width).toBe(1200);
    await picked(page).getByLabel('What the picture for Standing desk shows').fill('A tall desk by a window');
    await picked(page).getByRole('switch', { name: 'Show labels' }).click();
    await picked(page).getByLabel('Picture size').selectOption('large');
    await screen(page, 'choices-designer-pictures', { viewport: true });
    await tryIt(page);
    await expect(tried(page).locator('.fd-image-card img')).toHaveAttribute('alt', 'A tall desk by a window');
    await expect(tried(page).getByRole('radio', { name: 'Standing desk' })).toBeVisible();
    await expect(tried(page).locator('.fd-image-card-words')).toHaveCSS('font-size', '0px');
    await screen(page, 'choices-designer-pictures-tried', { viewport: true });
  });

  test('a ranking of the top two, and a matrix with several answers per row and each column once, in Try it', async ({ page }) => {
    await add(page, 'ranking', 'Your top two');
    await picked(page).getByLabel('Rank only the top').fill('2');
    await picked(page).getByLabel('Rank only the top').press('Enter');
    await add(page, 'matrix', 'Rank the rooms');
    await picked(page).getByRole('switch', { name: 'One answer per column' }).click();
    await screen(page, 'choices-designer-matrix', { viewport: true });
    await tryIt(page);
    const pool = tried(page).locator('.fd-rank-pool');
    await pool.getByRole('button', { name: 'Option 2' }).click();
    await pool.getByRole('button', { name: 'Option 1' }).click();
    await expect(pool.getByRole('button', { name: 'Option 3' })).toBeDisabled();
    await expect(tried(page).locator('.fd-rank-words')).toHaveText(['Option 2', 'Option 1']);
    await tried(page).getByRole('radio', { name: 'Row 1: Column 1' }).check();
    await tried(page).getByRole('radio', { name: 'Row 2: Column 1' }).check();
    await expect(tried(page).getByRole('radio', { name: 'Row 1: Column 1' })).not.toBeChecked();
    await screen(page, 'choices-designer-ranking-matrix-tried', { viewport: true });
  });
});

/** The screen editor: the settings on the field's card and in the side panel, and Try it. */
test.describe('the choice kinds in the screen editor', () => {
  test('status steps people can pick, set on the card and seen in the panel', async ({ page }) => {
    const problems: string[] = [];
    page.on('pageerror', (error) => problems.push(error.message));
    await page.goto('/screen/');
    await page.locator('.fd-toolbox [data-tool="kind:status"]').click();
    const card = page.locator('.fd-canvas-field.fd-editing');
    await card.getByRole('switch', { name: 'People can pick a step' }).click();
    await expect(page.locator('.fd-properties').getByRole('switch', { name: 'People can pick a step' })).toHaveAttribute('aria-checked', 'true');
    await screen(page, 'choices-screen-status', { viewport: true });
    await page.getByRole('button', { name: 'Try it' }).click();
    const steps = page.locator('.fd-try .fd-statusbar').last();
    await steps.getByRole('button', { name: 'Confirmed' }).click();
    await expect(steps.getByRole('button', { name: 'Confirmed' })).toHaveAttribute('aria-current', 'step');
    expect(problems).toEqual([]);
  });

  test('a checkbox’s layout set in the side panel shows on the card', async ({ page }) => {
    await page.goto('/screen/');
    await page.locator('.fd-toolbox [data-tool="kind:checkboxes"]').click();
    await page.locator('.fd-properties').getByLabel('Lay out').selectOption('3');
    await expect(page.locator('.fd-canvas-field.fd-editing').getByLabel('Lay out')).toHaveValue('3');
    await screen(page, 'choices-screen-layout', { viewport: true });
  });
});
