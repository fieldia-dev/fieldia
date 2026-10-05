import { expect, test, type Locator, type Page } from '@playwright/test';
import { axeFindings } from './a11y-support';
import { addField, editing, inAdvanced, tile, watch } from './designer-support';
import { expectNoSidewaysScroll, node, open, screen } from './support';

/**
 * The structures' details, used as a person uses them: a signature's ink,
 * undo, words and upload; an address's second line, country list, the
 * country it starts on and the parts it must have; a repeating group's cards
 * moved and copied; a picture's width, place and caption — on the "Office
 * move" example — and a table of lines moved, counted and asked about before
 * a line goes, links to records searched in full and opened, and a heading in
 * rich text — on the "Every field" example; at a desk, on a phone and right
 * to left. Then each setting in the screen designer and the survey designer:
 * on the card, in the side panel, and in Try it.
 */

const valueOf = (page: Page, field: string) => page.evaluate((name) => (window as any).fieldiaDemo.handle.form.getState().values[name], field);
const PHONE = { width: 390, height: 844 };
async function box(locator: Locator) {
  const found = await locator.boundingBox();
  if (!found) throw new Error('not on screen');
  return found;
}

test.describe('the structures on “Office move”', () => {
  let problems: string[] = [];
  test.beforeEach(async ({ page }) => {
    ({ problems } = await open(page, 'plain', 'page=kinds&skin=outlined'));
  });
  test.afterEach(() => expect(problems).toEqual([]));

  test('a signature: drawn, a stroke undone, its words under it; typed, its name kept; or a picture uploaded', async ({ page }) => {
    const sign = node(page, 'q-signature');
    const pad = sign.locator('canvas');
    await pad.scrollIntoViewIfNeeded();
    await expect(sign.locator('.fd-signature-footer')).toHaveText('I agree to move on the day above');
    const at = await box(pad);
    for (const [from, to] of [[0.15, 0.4], [0.5, 0.8]]) {
      await page.mouse.move(at.x + at.width * from, at.y + at.height * 0.6);
      await page.mouse.down();
      await page.mouse.move(at.x + at.width * to, at.y + at.height * 0.35, { steps: 8 });
      await page.mouse.up();
    }
    const undo = sign.getByRole('button', { name: 'Undo' });
    await undo.click();
    expect(await valueOf(page, 'signature')).toMatchObject({ type: 'image/png' });
    await screen(page, 'structures-signature-undo', { viewport: true });
    await undo.click();
    expect(await valueOf(page, 'signature')).toBeNull();
    await expect(undo).toBeHidden();
    await sign.getByLabel('Or type your name').fill('Sara Hassan');
    expect(await valueOf(page, 'signature')).toMatchObject({ type: 'image/png', text: 'Sara Hassan' });
    await screen(page, 'structures-signature-typed', { viewport: true });
    await sign.getByRole('button', { name: 'Clear' }).click();
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkaPhfDwAEgQHA1qB6WQAAAABJRU5ErkJggg==', 'base64');
    const chooser = page.waitForEvent('filechooser');
    await sign.getByRole('button', { name: 'Upload a picture' }).click();
    await (await chooser).setFiles({ name: 'my-signature.png', mimeType: 'image/png', buffer: png });
    await expect(sign.locator('img.fd-signature-image')).toBeVisible();
    expect(await valueOf(page, 'signature')).toMatchObject({ name: 'my-signature.png', type: 'image/png' });
    await screen(page, 'structures-signature-uploaded', { viewport: true });
    expect(await axeFindings(page, 'a signature uploaded')).toEqual([]);
  });

  test('an address: a second line, the parts it must have marked and asked for, the country it starts on, from a list', async ({ page }) => {
    const address = node(page, 'q-address');
    await address.scrollIntoViewIfNeeded();
    const country = address.getByLabel('Country');
    await expect(country).toHaveValue('EG');
    await expect(country.locator('option:checked')).toHaveText('Egypt');
    await expect(address.locator('.fd-address-part.fd-required label')).toHaveText(['Street address', 'City']);
    await address.getByLabel('Street address').fill('12 Nile Street');
    await address.getByLabel('Address line 2').fill('Floor 4');
    await page.getByRole('button', { name: 'Submit' }).click();
    await expect(address.locator('.fd-error')).toHaveText('City is required');
    await address.evaluate((element) => element.scrollIntoView({ block: 'center' }));
    await expect(address.getByLabel('City')).toHaveAttribute('aria-invalid', 'true');
    await expect(address.getByLabel('Street address')).toHaveAttribute('aria-invalid', 'false');
    await screen(page, 'structures-address-asks', { viewport: true });
    await address.getByLabel('City').fill('Cairo');
    await country.selectOption({ label: 'Jordan' });
    await expect(address.locator('.fd-error')).toBeHidden();
    expect(await valueOf(page, 'badge_address')).toEqual({ street: '12 Nile Street', line2: 'Floor 4', city: 'Cairo', country: 'JO' });
    await address.evaluate((element) => element.scrollIntoView({ block: 'center' }));
    await screen(page, 'structures-address', { viewport: true });
    expect(await axeFindings(page, 'an address answered')).toEqual([]);
  });

  test('a repeating group: a card moved up, and another copied right after it, its answers too', async ({ page }) => {
    const group = node(page, 'q-movers');
    await group.scrollIntoViewIfNeeded();
    const add = group.getByRole('button', { name: 'Add a person' });
    for (const [name, role] of [['Omar', 'Designer'], ['Laila', 'Engineer']]) {
      await add.click();
      await page.keyboard.type(name);
      await page.keyboard.press('Tab');
      await page.keyboard.type(role);
    }
    const up = group.getByRole('button', { name: 'Move Person 2 up' });
    await up.click();
    expect((await valueOf(page, 'movers')).map((l: any) => l.values.name)).toEqual(['Laila', 'Omar']);
    await expect(group.locator('.fd-repeat > .fd-announce')).toHaveText('Person 2 moved to place 1 of 2');
    // Now first, it cannot go up: the way down has the focus.
    await expect(group.getByRole('button', { name: 'Move Person 1 down' })).toBeFocused();
    await group.getByRole('button', { name: 'Copy Person 2' }).click();
    await expect(group.getByRole('group', { name: 'Person 3' }).getByLabel('Name')).toBeFocused();
    expect((await valueOf(page, 'movers')).map((l: any) => [l.values.name, l.values.role])).toEqual([['Laila', 'Engineer'], ['Omar', 'Designer'], ['Omar', 'Designer']]);
    await screen(page, 'structures-cards', { viewport: true });
    expect(await axeFindings(page, 'cards to move and copy')).toEqual([]);
  });

  test('a picture as wide and where its page says, its caption under it', async ({ page }) => {
    const plan = node(page, 'q-plan');
    await plan.scrollIntoViewIfNeeded();
    const picture = plan.getByRole('img', { name: /A plan of the new floor/ });
    expect((await box(picture)).width).toBeCloseTo(320, -1);
    // In the centre of its row.
    const row = await box(plan);
    const shown = await box(picture);
    expect(Math.abs(shown.x + shown.width / 2 - (row.x + row.width / 2))).toBeLessThan(3);
    await expect(plan.locator('figcaption')).toHaveText('The new floor, seen from above');
    await screen(page, 'structures-picture', { viewport: true });
  });

  test('fits a phone: the address in one column, the cards, the picture no wider than the row', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await expectNoSidewaysScroll(page);
    const address = node(page, 'q-address');
    await address.scrollIntoViewIfNeeded();
    const [street, city] = [await box(address.getByLabel('Street address')), await box(address.getByLabel('City'))];
    expect(city.y).toBeGreaterThan(street.y);
    await screen(page, 'structures-phone-address', { viewport: true });
    const group = node(page, 'q-movers');
    await group.getByRole('button', { name: 'Add a person' }).click();
    await group.getByRole('button', { name: 'Add a person' }).click();
    await group.scrollIntoViewIfNeeded();
    await expectNoSidewaysScroll(page);
    await screen(page, 'structures-phone-cards', { viewport: true });
    const plan = node(page, 'q-plan');
    await plan.scrollIntoViewIfNeeded();
    expect((await box(plan.locator('img'))).width).toBeLessThanOrEqual((await box(plan)).width);
    await screen(page, 'structures-phone-picture', { viewport: true });
    await node(page, 'q-signature').scrollIntoViewIfNeeded();
    await screen(page, 'structures-phone-signature', { viewport: true });
  });
});

test.describe('the structures right to left, in Arabic', () => {
  test('an address names its parts and its countries in Arabic, and asks for a part in Arabic', async ({ page }) => {
    const { problems } = await open(page, 'plain', 'page=kinds&skin=outlined&locale=ar');
    const address = node(page, 'q-address');
    await address.scrollIntoViewIfNeeded();
    await expect(address.getByLabel('الدولة').locator('option:checked')).toHaveText('مصر');
    await address.getByLabel('عنوان الشارع').fill('١٢ شارع النيل');
    await page.locator('.fd-actions button.fd-button-primary').click();
    await expect(address.locator('.fd-error')).toHaveText('المدينة مطلوب');
    // The second part of a row sits to the left of the first.
    const [city, postcode] = [await box(address.getByLabel('المدينة')), await box(address.getByLabel('الرمز البريدي'))];
    expect(postcode.x).toBeLessThan(city.x);
    await address.evaluate((element) => element.scrollIntoView({ block: 'center' }));
    await screen(page, 'structures-rtl-address', { viewport: true });
    const group = node(page, 'q-movers');
    await group.locator('.fd-repeat-add').click();
    await group.locator('.fd-repeat-add').click();
    await group.scrollIntoViewIfNeeded();
    await screen(page, 'structures-rtl-cards', { viewport: true });
    expect(problems).toEqual([]);
  });

  test('a table of lines keeps its grip at the start, on the right', async ({ page }) => {
    const { problems } = await open(page, 'plain', 'page=fields&skin=outlined&locale=ar');
    const lines = node(page, 'f-milestones');
    await lines.scrollIntoViewIfNeeded();
    const row = lines.locator('tbody tr').first();
    const [grip, name] = [await box(row.locator('.fd-line-grip')), await box(row.locator('input').first())];
    expect(grip.x).toBeGreaterThan(name.x);
    await screen(page, 'structures-rtl-lines', { viewport: true });
    expect(problems).toEqual([]);
  });
});

test.describe('the structures on “Every field”', () => {
  let problems: string[] = [];
  test.beforeEach(async ({ page }) => {
    ({ problems } = await open(page, 'plain', 'page=fields&skin=outlined'));
  });
  test.afterEach(() => expect(problems).toEqual([]));

  const names = async (page: Page) => (await valueOf(page, 'milestone_ids')).map((l: any) => l.values.name);

  test('a table of lines: moved by Alt and the arrows and by its grip, asked about before a line goes, empty in words of its own', async ({ page }) => {
    const lines = node(page, 'f-milestones');
    await lines.scrollIntoViewIfNeeded();
    await expect(lines.getByRole('button', { name: '+ Add a milestone' })).toBeVisible();
    // Alt+↓ in a cell moves its line; the cursor goes with it.
    const first = lines.locator('tbody tr').first().getByLabel('Milestone');
    await first.click();
    await page.keyboard.press('Alt+ArrowDown');
    expect(await names(page)).toEqual(['Design sign-off', 'Site survey']);
    await expect(lines.locator('tbody tr').nth(1).getByLabel('Milestone')).toBeFocused();
    await expect(lines.locator('.fd-lines > [role=status]')).toHaveText('Site survey moved to place 2 of 2');
    // Dragged by its grip, at hand speed.
    const grip = await box(lines.locator('tbody tr').nth(1).locator('.fd-line-grip'));
    const top = await box(lines.locator('tbody tr').first());
    await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
    await page.mouse.down();
    for (let i = 1; i <= 6; i++) await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2 - ((grip.y - top.y + 10) * i) / 6);
    await page.mouse.up();
    expect(await names(page)).toEqual(['Site survey', 'Design sign-off']);
    await screen(page, 'structures-lines-moved', { viewport: true });
    // A line with something in it: asked first; Keep keeps it.
    await lines.locator('tbody tr').first().getByRole('button', { name: 'Delete line' }).click();
    const ask = lines.locator('.fd-file-confirm');
    await expect(ask).toContainText('Remove line 1?');
    await expect(ask.getByRole('button', { name: 'Keep' })).toBeFocused();
    await screen(page, 'structures-lines-ask', { viewport: true });
    await page.keyboard.press('Escape');
    await expect(ask).toBeHidden();
    expect(await names(page)).toHaveLength(2);
    for (let i = 0; i < 2; i++) {
      await lines.locator('tbody tr').first().getByRole('button', { name: 'Delete line' }).click();
      await ask.getByRole('button', { name: 'Remove' }).click();
    }
    expect(await valueOf(page, 'milestone_ids')).toEqual([]);
    await expect(lines.locator('.fd-lines-empty')).toHaveText('No milestones yet: add the first.');
    await screen(page, 'structures-lines-empty', { viewport: true });
    expect(await axeFindings(page, 'a table emptied')).toEqual([]);
  });

  test('links to records: Search more… when the list has no room, and each one opened from its tag', async ({ page }) => {
    const partners = node(page, 'f-partners');
    await partners.scrollIntoViewIfNeeded();
    await partners.getByRole('combobox').click();
    const list = partners.getByRole('listbox');
    await expect(list.getByRole('option')).toHaveCount(9);
    await expect(list.getByRole('option').last()).toHaveText('Search more…');
    await screen(page, 'structures-links-list', { viewport: true });
    await list.getByRole('option', { name: 'Search more…' }).click();
    const search = page.getByRole('dialog', { name: 'Also billed to' });
    await search.getByRole('searchbox').fill('zam');
    await search.getByRole('option', { name: 'Zamalek Studio' }).click();
    await expect(search).toBeHidden();
    await expect(partners.locator('.fd-chip-label')).toHaveText(['Amira Clinics', 'Zamalek Studio']);
    await partners.getByRole('button', { name: 'Open Amira Clinics' }).click();
    const record = page.getByRole('dialog', { name: 'Amira Clinics' });
    await expect(record.locator('[data-node="#title"] input')).toHaveValue('Amira Clinics');
    await screen(page, 'structures-links-open', { viewport: true });
    await record.locator('[data-node="#title"] input').fill('Amira Clinics Group');
    await record.getByRole('button', { name: 'Save & Close' }).click();
    await expect(partners.locator('.fd-chip-label')).toHaveText(['Amira Clinics Group', 'Zamalek Studio']);
    expect(await valueOf(page, 'partner_ids')).toEqual([{ id: 20, label: 'Amira Clinics Group' }, { id: 30, label: 'Zamalek Studio' }]);
    expect(await axeFindings(page, 'links with tags to open')).toEqual([]);
  });

  test('rich text: a heading in one press, and words again in the next', async ({ page }) => {
    const brief = node(page, 'f-brief');
    await brief.scrollIntoViewIfNeeded();
    const text = brief.locator('[contenteditable]');
    await text.locator('p').first().click();
    const heading = brief.getByRole('button', { name: 'Heading' });
    await heading.click();
    await expect.poll(() => valueOf(page, 'brief')).toMatch(/^<h2>Calm, daylight-first/);
    await expect(heading).toHaveAttribute('aria-pressed', 'true');
    await screen(page, 'structures-rich-text-heading', { viewport: true });
    await heading.click();
    await expect.poll(() => valueOf(page, 'brief')).toMatch(/^<p>Calm, daylight-first/);
  });
});

/** The screen designer: each setting set on the field's card, the side panel showing the same, then Try it. */
test.describe('the structures’ settings in the screen designer', () => {
  let problems: string[] = [];
  const card = (page: Page) => editing(page).card;
  const setting = (page: Page, name: string) => card(page).getByLabel(name, { exact: true });
  const panel = (page: Page) => page.locator('.fd-properties');
  test.beforeEach(async ({ page }) => {
    problems = watch(page);
    await page.goto('/screen/?start=blank');
    await expect(page.locator('.fd-toolbox')).toBeVisible();
  });
  test.afterEach(() => expect(problems).toEqual([]));

  test('a signature’s ink, pen and words and its upload; an address’s parts, those it must have, its country', async ({ page }) => {
    await addField(page, 'signature', 'Sign it off');
    await card(page).getByRole('button', { name: 'Blue', exact: true }).click();
    await setting(page, 'Pen width').selectOption('5');
    await setting(page, 'Words on the pad').fill('Sign as in your passport');
    await setting(page, 'Words under it').fill('I agree this is my signature');
    await card(page).getByRole('switch', { name: 'People can upload a picture of it' }).click();
    await expect(card(page).locator('.fd-signature-hint')).toHaveText('Sign as in your passport');
    await expect(card(page).locator('.fd-signature-footer')).toHaveText('I agree this is my signature');
    await expect(card(page).getByRole('button', { name: 'Upload a picture' })).toBeVisible();
    // The side panel has the same settings, showing what the card set.
    await expect(panel(page).getByLabel('Words under it', { exact: true })).toHaveValue('I agree this is my signature');
    await expect(panel(page).getByRole('button', { name: 'Blue', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await screen(page, 'structures-designer-signature', { viewport: true });
    expect(await axeFindings(page, 'a signature’s settings, on its card and in the panel')).toEqual([]);

    await addField(page, 'address', 'Home address');
    const parts = card(page).getByRole('group', { name: 'Parts of the address' });
    await parts.getByRole('button', { name: 'Line 2' }).click();
    const must = card(page).getByRole('group', { name: 'Parts that must be filled' });
    await must.getByRole('button', { name: 'Street' }).click();
    await must.getByRole('button', { name: 'City' }).click();
    await setting(page, 'Starts on').selectOption('EG');
    await expect(card(page).getByLabel('Address line 2')).toBeVisible();
    await expect(card(page).getByLabel('Country')).toHaveValue('EG');
    await expect(panel(page).getByLabel('Starts on', { exact: true })).toHaveValue('EG');
    await panel(page).getByRole('group', { name: 'Parts that must be filled' }).getByRole('button', { name: 'City' }).click();
    await expect(must.getByRole('button', { name: 'City' })).toHaveAttribute('aria-pressed', 'false');
    await must.getByRole('button', { name: 'City' }).click();
    await screen(page, 'structures-designer-address', { viewport: true });
    expect(await axeFindings(page, 'an address’s settings, on its card and in the panel')).toEqual([]);

    await page.getByRole('button', { name: 'Try it' }).click();
    const tried = page.locator('.fd-try');
    await expect(tried.locator('.fd-signature-footer')).toHaveText('I agree this is my signature');
    await tried.getByLabel('Street address').fill('12 Nile Street');
    await tried.getByRole('button', { name: /Save|Submit|Send/ }).first().click();
    await expect(tried.getByText('City is required').first()).toBeVisible();
    await screen(page, 'structures-designer-try-signature-address', { viewport: true });
  });

  test('a table of lines: least and most, its words, asking first, totals and columns to hide; links’ new records and filter; rich text’s toolbar', async ({ page }) => {
    await addField(page, 'lines', 'Milestones');
    await setting(page, 'At least').fill('1');
    await setting(page, 'At most').fill('3');
    await setting(page, 'At most').press('Tab');
    await setting(page, 'Button words').fill('Add a milestone');
    await setting(page, 'When empty').fill('No milestones yet');
    await card(page).getByRole('switch', { name: 'Ask before removing a line' }).click();
    await card(page).getByRole('button', { name: 'Add up Quantity' }).click();
    await setting(page, 'Description: shown').selectOption('show');
    await expect(panel(page).getByRole('button', { name: 'Add up Quantity' })).toHaveAttribute('aria-pressed', 'true');
    await expect(panel(page).getByLabel('Description: shown', { exact: true })).toHaveValue('show');
    await screen(page, 'structures-designer-lines', { viewport: true });
    expect(await axeFindings(page, 'a table’s settings, on its card and in the panel')).toEqual([]);
    // Its settings stand in for the table while it is picked; let go, the card shows the table as it will be used.
    await page.keyboard.press('Escape');
    const lines = page.locator('.fd-canvas-field', { has: page.locator('.fd-lines') });
    await expect(lines.locator('.fd-lines-add')).toHaveText('+ Add a milestone');
    await expect(lines.locator('tbody tr')).toHaveCount(1);
    await screen(page, 'structures-designer-lines-card', { viewport: true });

    await addField(page, 'links', 'Tags');
    await card(page).getByRole('switch', { name: 'People can create new ones' }).click();
    await setting(page, 'Only where').fill('active');
    await setting(page, 'has the value').fill('true');
    await setting(page, 'has the value').press('Tab');
    const built = () => page.evaluate(() => (window as any).fieldiaDesigner.designer.getPage().fields as Record<string, any>);
    const tags = Object.values(await built()).find((f) => f.label === 'Tags');
    expect(tags.filter).toEqual([{ field: 'active', op: '=', value: true }]);
    await expect(panel(page).getByLabel('Only where', { exact: true })).toHaveValue('active');
    await screen(page, 'structures-designer-links', { viewport: true });
    expect(await axeFindings(page, 'a link’s settings')).toEqual([]);

    await addField(page, 'rich-text', 'Notes');
    await expect(card(page).locator('.fd-richtext-bar')).toBeVisible();
    await card(page).getByRole('switch', { name: 'Formatting toolbar' }).click();
    await expect(card(page).locator('.fd-richtext-bar')).toHaveCount(0);
    await expect(panel(page).getByRole('switch', { name: 'Formatting toolbar' })).toHaveAttribute('aria-checked', 'false');
    await screen(page, 'structures-designer-rich-text', { viewport: true });

    await page.getByRole('button', { name: 'Try it' }).click();
    const tried = page.locator('.fd-try');
    const table = tried.locator('.fd-lines');
    await expect(table.locator('tbody tr')).toHaveCount(1);
    await table.locator('tbody tr').first().getByLabel('Description').fill('Survey');
    await table.locator('tbody tr').first().getByLabel('Quantity').fill('4');
    await table.getByRole('button', { name: '+ Add a milestone' }).click();
    await table.getByRole('button', { name: '+ Add a milestone' }).click();
    await expect(table.getByRole('button', { name: '+ Add a milestone' })).toBeHidden();
    await expect(table.locator('tfoot')).toContainText('4');
    await table.locator('tbody tr').first().getByRole('button', { name: 'Delete line' }).click();
    await expect(table.locator('.fd-file-confirm')).toContainText('Remove line 1?');
    await expect(tried.locator('.fd-richtext-bar')).toHaveCount(0);
    await screen(page, 'structures-designer-try-lines', { viewport: true });
  });
});

test.describe('a picture’s settings in the screen designer', () => {
  test('its width, place, link and caption in its panel, a description asked for, and Try it drawing them', async ({ page }) => {
    const problems = watch(page);
    await inAdvanced(page);
    await page.goto('/screen/?start=blank');
    await tile(page, 'block:image').click();
    const panel = page.locator('.fd-properties');
    await panel.getByRole('tab', { name: 'Content' }).click().catch(() => undefined);
    const description = panel.getByLabel('Description', { exact: true });
    await expect(description).toHaveAttribute('aria-invalid', 'true');
    const svg = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 4 3'%3E%3Crect width='4' height='3' fill='%232f5d8a'/%3E%3C/svg%3E";
    await panel.getByLabel('Picture address', { exact: true }).fill(svg);
    await description.fill('A plan of the floor');
    await panel.getByRole('group', { name: 'Width' }).getByRole('button', { name: 'Medium' }).click();
    await panel.getByRole('group', { name: 'Place' }).getByRole('button', { name: 'Centre' }).click();
    await panel.getByLabel('Link', { exact: true }).fill('https://example.com/plan');
    await panel.getByLabel('Link', { exact: true }).press('Tab');
    await panel.getByLabel('Caption', { exact: true }).fill('The new floor');
    await expect(description).toHaveAttribute('aria-invalid', 'false');
    // Medium is 320 pixels, never wider than its row.
    const block = page.locator('img.fd-canvas-block');
    await expect(block).toHaveCSS('--fd-image-width', '320px');
    const wide = (await box(block)).width;
    expect(wide).toBeLessThanOrEqual(321);
    expect(wide).toBeGreaterThan(200);
    await screen(page, 'structures-designer-picture', { viewport: true });
    expect(await axeFindings(page, 'a picture’s panel')).toEqual([]);
    await page.getByRole('button', { name: 'Try it' }).click();
    const figure = page.locator('.fd-try figure.fd-figure');
    await expect(figure.locator('figcaption')).toHaveText('The new floor');
    await expect(figure.getByRole('link', { name: 'A plan of the floor' })).toHaveAttribute('target', '_blank');
    await screen(page, 'structures-designer-try-picture', { viewport: true });
    expect(problems).toEqual([]);
  });
});

test.describe('the structures’ settings in the survey designer', () => {
  test('a signature’s words and an address’s parts on the picked question, and in Try it', async ({ page }) => {
    const problems = watch(page);
    await page.goto('/designer/');
    await expect(page.locator('.fd-designer')).toBeVisible();
    await tile(page, 'kind:signature').click();
    await page.keyboard.type('Sign it off');
    const picked = page.locator('.fd-q-selected');
    await picked.getByLabel('Words under it', { exact: true }).fill('I agree to the terms');
    await expect(picked.locator('.fd-q-preview-under')).toHaveText('I agree to the terms');
    await screen(page, 'structures-survey-signature', { viewport: true });
    await tile(page, 'kind:address').click();
    await page.keyboard.type('Where do you live?');
    await picked.getByRole('group', { name: 'Parts that must be filled' }).getByRole('button', { name: 'City' }).click();
    await picked.getByLabel('Starts on', { exact: true }).selectOption('FR');
    await screen(page, 'structures-survey-address', { viewport: true });
    await page.getByRole('button', { name: 'Try it' }).click();
    const tried = page.locator('.fd-try');
    await expect(tried.locator('.fd-signature-footer')).toHaveText('I agree to the terms');
    await expect(tried.getByLabel('Country')).toHaveValue('FR');
    expect(problems).toEqual([]);
  });
});
