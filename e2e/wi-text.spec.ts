import { type Locator, type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { axeFindings, settle } from './a11y-support';
import { expectNoSidewaysScroll, node, open, screen } from './support';

/**
 * A work item's body, as the user's screenshots of a bug's edit popup show it
 * (Screenshot 2026-10-12 at 20.21.54 … 20.23.03): three columns of groups 50%,
 * 1fr and 1fr wide, 16px apart; headings with a rule 50px down and their tools
 * at the end; Repro Steps in Markdown, System Info in rich text with its
 * toolbar inside its box while worked in; the Discussion's comment box and
 * comment cards; help with links; Add link, as a search or a menu.
 *
 * The page (examples/pages/wi-text.page.json) is drawn where the screenshots'
 * popup has its body — x 96, y 397, 1727px wide less its scroll bar — in the
 * host's colours the plan measured, so positions are compared with the
 * screenshots' own pixels. Fonts differ from the Mac's, so words' widths do:
 * edges and boxes are compared, not glyphs.
 */

const PAGE = 'page=wi-text&skin=quiet';
/** The work item's colours (docs/plans/work-item-replica.md §2.2), as a host sets Fieldia's tokens. */
const DEVOPS = `.fd-form { --fd-text: #1a1a1a; --fd-muted: #7e7e7e; --fd-page: #ffffff; --fd-surface: #ffffff; --fd-fill: #f2f2f2; --fd-border: #eaeaea;
  --fd-border-strong: #7e7e7e; --fd-accent: #0078d4; --fd-accent-soft: #deecf9; --fd-focus: #0078d4; --fd-focus-ring: none; --fd-radius: 4px; --fd-control-radius: 2px;
  --fd-link: #005a9e; --fd-band: #f8f8f8; --fd-help: #f4f4f4;
  --fd-font: "Segoe UI", -apple-system, BlinkMacSystemFont, Roboto, "Helvetica Neue", Helvetica, Ubuntu, Arial, sans-serif; }`;
/** The page where the popup's body sits in the screenshots: from x 96 and y 397, 1727px wide less a 15px scroll bar, with 12px of room each side. */
const PLACE = `#demo-head { display: none !important; } html, body { background: #fff !important; }
#app { max-width: none !important; margin: 0 !important; padding: 397px 0 0 96px !important; width: 1809px; box-sizing: border-box; }
#app > .fd-form { padding: 0 12px; } .fd-form > .fd-content { padding: 0 !important; } .fd-page-head { display: none !important; }`;

async function visit(page: Page, query = PAGE, options: { place?: boolean; colours?: boolean } = {}) {
  const { problems, demo } = await open(page, 'plain', query);
  await expect(page.locator('.fd-discussion li.fd-comment-card')).toHaveCount(1);
  if (options.place ?? true) await page.addStyleTag({ content: PLACE });
  if (options.colours ?? true) await page.addStyleTag({ content: DEVOPS });
  await settle(page);
  return { problems, demo };
}

/** Where an element is on the page: its box's edges, rounded. */
const box = (element: Locator) =>
  element.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { left: Math.round(r.left), top: Math.round(r.top), right: Math.round(r.right), bottom: Math.round(r.bottom) };
  });
const drawn = (element: Locator, ...names: string[]) => element.evaluate((el, names) => Object.fromEntries(names.map((name) => [name, getComputedStyle(el).getPropertyValue(name)])), names);
const heading = (page: Page, id: string) => node(page, id).locator(':scope > legend');
const tool = (page: Page, id: string, name: string) => heading(page, id).getByRole('button', { name });
const stored = (page: Page, field: string) => page.evaluate((field) => (window as unknown as { fieldiaDemo: { handle: { form: { getState(): { values: Record<string, unknown> } } } } }).fieldiaDemo.handle.form.getState().values[field], field);

test.describe('at rest, as Screenshot 20.22.23', () => {
  test('three columns 845, 406 and 406 wide, 16px apart; headings 16px with their rule 50px down', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    const { problems } = await visit(page);
    const columns = await Promise.all(['col-1', 'col-2', 'col-3'].map((id) => box(node(page, id))));
    expect(columns.map((c) => [c.left, c.right])).toEqual([[108, 953], [969, 1375], [1391, 1797]]);
    for (const [id, top] of [['g-repro', 397], ['g-system', 513], ['g-discussion', 647], ['g-planning', 397], ['g-deployment', 397]] as const) {
      const legend = heading(page, id);
      expect((await box(legend)).top, id).toBe(top);
      expect((await box(legend)).bottom - (await box(legend)).top, id).toBe(51);
      expect(await drawn(legend, 'font-size', 'font-weight', 'border-bottom-color', 'border-bottom-width')).toEqual({ 'font-size': '16px', 'font-weight': '600', 'border-bottom-color': 'rgb(234, 234, 234)', 'border-bottom-width': '1px' });
    }
    // Fields 8px in from their heading, a 12px label over its box, 55px from one label to the next.
    const labels = await Promise.all(['f-category', 'f-resolved-reason', 'f-points'].map((id) => box(node(page, id).locator('.fd-label'))));
    expect(labels.map((l) => [l.left, l.top])).toEqual([[977, 452], [977, 507], [977, 562]]);
    expect(await drawn(node(page, 'f-category').locator('.fd-label'), 'font-size', 'color')).toEqual({ 'font-size': '12px', color: 'rgb(126, 126, 126)' });
    await screen(page, 'wi-text-rest', { viewport: true });
    expect(problems).toEqual([]);
  });

  test('Repro Steps reads as its link, opening in a tab of its own; System Info says what to add', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await visit(page);
    const view = node(page, 'f-repro').locator('.fd-md-view');
    expect(await box(view)).toEqual({ left: 118, top: 452, right: 943, bottom: 502 });
    const link = view.getByRole('link', { name: 'https://shop.example/orders/SO-2088?tab=history' });
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link.locator('xpath=following-sibling::*[1]')).toHaveAttribute('data-icon', 'external');
    expect((await drawn(link, 'color'))['color']).toBe('rgb(0, 90, 158)');
    const area = node(page, 'f-system').locator('.fd-text-area');
    await expect(area).toHaveAttribute('data-placeholder', 'Click to add System Info.');
    const hint = await area.evaluate((el) => { const s = getComputedStyle(el, '::before'); return [s.content, s.fontStyle, s.color]; });
    expect(hint).toEqual(['"Click to add System Info."', 'italic', 'rgb(126, 126, 126)']);
    // No edge at rest.
    expect((await drawn(node(page, 'f-system').locator('.fd-text-box'), 'border-top-color'))['border-top-color']).toBe('rgba(0, 0, 0, 0)');
  });

  test('the Discussion: a comment box on a card, then a card for the comment, 16px apart', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await visit(page);
    const composer = page.locator('.fd-composer-card');
    expect(await box(composer)).toEqual({ left: 108, top: 714, right: 953, bottom: 875 });
    expect(await box(composer.locator('.fd-text-box'))).toEqual({ left: 168, top: 744, right: 933, bottom: 838 });
    expect(await box(composer.locator('.fd-discussion-avatar'))).toEqual({ left: 132, top: 742, right: 156, bottom: 766 });
    await expect(composer.locator('.fd-text-area')).toHaveAttribute('data-placeholder', 'Add a comment. Use # to link a work item, @ to mention a person, or ! to link a pull request.');
    await expect(composer.getByRole('button', { name: 'switch to Markdown editor' })).toBeVisible();
    const card = page.locator('li.fd-comment-card');
    expect(await box(card)).toEqual({ left: 108, top: 891, right: 953, bottom: 1001 });
    await expect(card.locator('.fd-comment-author')).toHaveText('Karim Fathy');
    await expect(card.getByRole('link', { name: 'commented Jun 14' })).toHaveAttribute('href', '#comment-501');
    // Only comments: the bug's tracked change is its history's.
    await expect(page.locator('.fd-discussion')).not.toContainText('Active');
    expect((await drawn(card, 'box-shadow'))['box-shadow']).toContain('rgba(0, 0, 0, 0.13');
  });

  test('the right column: help with links, Add link as a search and as a menu, the empty link', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await visit(page);
    const help = node(page, 'x-deployment');
    const helpBox = await box(help);
    expect([helpBox.left, helpBox.top, helpBox.right]).toEqual([1399, 452, 1789]);
    expect(await drawn(help, 'padding-left', 'background-color', 'line-height')).toEqual({ 'padding-left': '50px', 'background-color': 'rgb(244, 244, 244)', 'line-height': '17px' });
    await expect(help.getByRole('link', { name: 'Releases' })).toHaveAttribute('href', 'https://example.com/releases');
    const dev = node(page, 'f-dev');
    const add = dev.getByRole('button', { name: 'Add link' });
    expect((await box(add)).bottom - (await box(add)).top).toBe(31);
    await expect(add).not.toHaveAttribute('aria-haspopup');
    const icon = dev.locator('.fd-links-help-icon');
    await expect(icon).toHaveAttribute('data-icon', 'branch');
    const iconBox = await box(icon);
    expect([iconBox.left - 1399, iconBox.right - iconBox.left, iconBox.bottom - iconBox.top]).toEqual([11, 28, 30]);
    const related = node(page, 'f-related');
    await expect(related.getByRole('button', { name: 'Add link' })).toHaveAttribute('aria-haspopup', 'menu');
    await expect(related.getByRole('button', { name: 'Add an existing work item as a parent' })).toBeVisible();
    expect((await box(related.locator('.fd-links-empty'))).bottom - (await box(related.locator('.fd-links-empty'))).top).toBe(37);
  });
});

test.describe('System Info, as Screenshots 20.22.25 and 20.22.28', () => {
  test('pointed at: a light box 10px in, and its heading’s ⤢ and ^; the same tools on keyboard focus', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await visit(page);
    const textBox = node(page, 'f-system').locator('.fd-text-box');
    const tools = heading(page, 'g-system').locator('.fd-section-tools');
    expect((await drawn(tools, 'opacity'))['opacity']).toBe('0');
    await textBox.hover();
    await expect.poll(async () => (await drawn(textBox, 'border-top-color'))['border-top-color']).toBe('rgb(234, 234, 234)');
    expect(await box(textBox)).toEqual({ left: 118, top: 569, right: 943, bottom: 619 });
    await expect.poll(async () => (await drawn(tools, 'opacity'))['opacity']).toBe('1');
    await expect(tool(page, 'g-system', 'Maximise System Info')).toHaveAttribute('title', 'Maximise System Info');
    await expect(tool(page, 'g-system', 'Collapse System Info')).toHaveAttribute('aria-expanded', 'true');
    await screen(page, 'wi-text-system-pointed', { viewport: true });
    // Nothing only by hover: Tab reaches the tools, and they show.
    await page.mouse.move(1900, 1070);
    await node(page, 'f-repro').getByRole('link').focus();
    await page.keyboard.press('Tab');
    await expect(tool(page, 'g-system', 'Maximise System Info')).toBeFocused();
    await expect.poll(async () => (await drawn(tools, 'opacity'))['opacity']).toBe('1');
  });

  test('worked in: the accent box with the twenty tools at its foot, each named, and the switch under it', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    const { problems } = await visit(page);
    const field = node(page, 'f-system');
    await field.locator('.fd-text-area').click();
    const textBox = field.locator('.fd-text-box');
    await expect.poll(async () => (await drawn(textBox, 'border-top-color'))['border-top-color']).toBe('rgb(0, 120, 212)');
    expect(await box(textBox)).toEqual({ left: 118, top: 569, right: 943, bottom: 693 });
    const bar = field.getByRole('toolbar', { name: 'Formatting' });
    const names = await bar.getByRole('button').evaluateAll((buttons) => buttons.filter((b) => !(b as HTMLElement).hidden).map((b) => [b.getAttribute('aria-label'), b.getAttribute('title')]));
    expect(names.map(([name]) => name)).toEqual([
      'Bold', 'Italic', 'Underline', 'Bulleted list', 'Numbered list', 'Highlight', 'Text colour', 'Emoji', 'Decrease indent', 'Increase indent',
      'Strikethrough', 'Text size', 'Code', 'Mention someone', 'Link work item', 'Link pull request', 'Clear formatting', 'Insert image', 'Link', 'Remove link',
    ]);
    expect(names.every(([name, title]) => name === title)).toBe(true);
    // At the box's foot, inside it; its first tool where the screenshot has it.
    const bold = await box(bar.getByRole('button', { name: 'Bold' }));
    expect([bold.left, bold.top, bold.bottom]).toEqual([125, 655, 687]);
    await expect(field.getByRole('button', { name: 'switch to Markdown editor' })).toBeVisible();
    await screen(page, 'wi-text-system-focused', { viewport: true });
    // The arrows move along the bar.
    await bar.getByRole('button', { name: 'Bold' }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(bar.getByRole('button', { name: 'Italic' })).toBeFocused();
    await page.keyboard.press('End');
    await expect(bar.getByRole('button', { name: 'Remove link' })).toBeFocused();
    // Remove link with no link under the cursor looks usable, and says why.
    await page.keyboard.press('Enter');
    await expect(field.locator('.fd-text-say')).toHaveText('Put the cursor in a link first.');
    expect(problems).toEqual([]);
  });

  test('writes in place: bold through the toolbar, a highlight from its list, stored as clean HTML', async ({ page }) => {
    await visit(page, PAGE, { place: false });
    const field = node(page, 'f-system');
    const area = field.locator('.fd-text-area');
    await area.click();
    await page.keyboard.type('Chrome 118 on the scanner');
    await page.keyboard.press('Control+A');
    await field.getByRole('button', { name: 'Bold' }).click();
    await expect(field.getByRole('button', { name: 'Bold' })).toHaveAttribute('aria-pressed', 'true');
    await field.getByRole('button', { name: 'Highlight' }).click();
    const menu = page.getByRole('menu', { name: 'Highlight' });
    await expect(menu.getByRole('menuitem')).toHaveText(['Yellow', 'Green', 'Cyan', 'Raspberry', 'Orange', 'No colour']);
    await page.keyboard.press('Enter');
    // The browser's highlight on the bold words, kept on a span inside them: the one place a stored text keeps a colour.
    await expect.poll(() => stored(page, 'system_info')).toBe('<b><span style="background-color: rgb(255, 255, 0);">Chrome 118 on the scanner</span></b>');
  });

  test('narrow, the tools with no room go under “…”, a menu of them', async ({ page }) => {
    await page.setViewportSize({ width: 700, height: 900 });
    await visit(page, PAGE, { place: false });
    const field = node(page, 'f-system');
    await field.locator('.fd-text-area').click();
    const more = field.getByRole('button', { name: 'More' });
    await expect(more).toBeVisible();
    const shown = await field.locator('.fd-text-tool:not([hidden])').count();
    expect(shown).toBeLessThan(21);
    await more.click();
    const menu = page.getByRole('menu', { name: 'More' });
    await expect(menu.getByRole('menuitem').last()).toHaveText('Remove link');
    await page.keyboard.press('Escape');
    await expect(more).toBeFocused();
    await expectNoSidewaysScroll(page);
  });
});

test.describe('Repro Steps in Markdown, as Screenshot 20.21.54', () => {
  test('a click on its words opens the card: the box, the hint, thirteen tools, Preview; Done keeps clean HTML', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    const { problems } = await visit(page);
    const field = node(page, 'f-repro');
    await field.locator('.fd-md-view').click({ position: { x: 760, y: 12 } });
    const card = field.locator('.fd-md-card');
    await expect(card).toBeVisible();
    const cardBox = await box(card);
    expect([cardBox.left, cardBox.top, cardBox.right]).toEqual([108, 464, 953]);
    const input = card.locator('textarea');
    await expect(input).toBeFocused();
    await expect(input).toHaveValue('https://shop.example/orders/SO-2088?tab=history');
    expect((await box(input)).bottom - (await box(input)).top).toBe(84);
    await expect(card.locator('.fd-md-hint')).toHaveText('Markdown supported. Paste or select files to insert.');
    expect(await card.getByRole('toolbar').getByRole('button').evaluateAll((b) => b.filter((x) => !(x as HTMLElement).hidden && !x.matches('[role=switch]')).map((x) => x.getAttribute('aria-label')))).toEqual([
      'Mention someone', 'Link work item', 'Link pull request', 'Attach a file', 'Highlight', 'Heading', 'Bold', 'Italic', 'Code', 'Link', 'Bulleted list', 'Numbered list', 'Checklist',
    ]);
    const preview = card.getByRole('switch', { name: 'Preview' });
    await expect(preview).toHaveAttribute('aria-checked', 'false');
    // Its heading's tools: ⤢, ^ and Done.
    expect(await heading(page, 'g-repro').locator('.fd-section-tools button:not([hidden])').evaluateAll((b) => b.map((x) => x.getAttribute('aria-label')))).toEqual(['Maximise Repro Steps', 'Collapse Repro Steps', 'Done']);
    await screen(page, 'wi-text-markdown', { viewport: true });
    await input.fill('**Steps**\n\n1. Open SO-2088\n2. Release 3 of 15 <items>\n\nSee https://shop.example/orders/SO-2088');
    await expect.poll(() => stored(page, 'repro_steps')).toBe(
      '<p><strong>Steps</strong></p><ol><li>Open SO-2088</li><li>Release 3 of 15 &lt;items&gt;</li></ol><p>See <a href="https://shop.example/orders/SO-2088">https://shop.example/orders/SO-2088</a></p>'
    );
    await preview.click();
    await expect(card.locator('.fd-md-preview strong')).toHaveText('Steps');
    await expect(input).toBeHidden();
    await tool(page, 'g-repro', 'Done').click();
    await expect(card).toBeHidden();
    await expect(field.locator('.fd-md-view ol li')).toHaveText(['Open SO-2088', 'Release 3 of 15 <items>']);
    expect(problems).toEqual([]);
  });

  test('Escape puts back what it held; Enter on its words opens it again', async ({ page }) => {
    await visit(page, PAGE, { place: false });
    const field = node(page, 'f-repro');
    await field.locator('.fd-md-view').focus();
    await page.keyboard.press('Enter');
    const input = field.locator('textarea');
    await expect(input).toBeFocused();
    await input.fill('something else');
    await expect.poll(() => stored(page, 'repro_steps')).toBe('<p>something else</p>');
    await page.keyboard.press('Escape');
    await expect(field.locator('.fd-md-card')).toBeHidden();
    await expect.poll(() => stored(page, 'repro_steps')).toBe('<p><a href="https://shop.example/orders/SO-2088?tab=history">https://shop.example/orders/SO-2088?tab=history</a></p>');
  });

  test('switching System Info to Markdown asks first when formatting would be lost', async ({ page }) => {
    await visit(page, PAGE, { place: false });
    const field = node(page, 'f-system');
    await field.locator('.fd-text-area').click();
    await page.keyboard.type('Scanner firmware');
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Control+U');
    await field.getByRole('button', { name: 'switch to Markdown editor' }).click();
    const ask = field.getByRole('group', { name: 'switch to Markdown editor' });
    await expect(ask).toContainText('Some formatting cannot be written in Markdown and will be lost. Switch anyway?');
    await ask.getByRole('button', { name: 'Cancel' }).click();
    await expect(field.locator('.fd-text-area')).toBeVisible();
    await field.getByRole('button', { name: 'switch to Markdown editor' }).click();
    await ask.getByRole('button', { name: 'Switch' }).click();
    await expect(field.locator('textarea')).toHaveValue('Scanner firmware');
    await expect(field.getByRole('button', { name: 'switch to rich text editor' })).toBeVisible();
  });
});

test.describe('the comment box, as Screenshot 20.22.36', () => {
  test('worked in: its toolbar with “…”, the switch, Cancel and Save; Save with nothing typed says why; Ctrl+Enter posts', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    const { problems } = await visit(page);
    const composer = page.locator('.fd-composer-card');
    await composer.locator('.fd-text-area').click();
    const textBox = composer.locator('.fd-text-box');
    await expect.poll(async () => (await drawn(textBox, 'border-top-color'))['border-top-color']).toBe('rgb(0, 120, 212)');
    expect(await box(textBox)).toEqual({ left: 168, top: 744, right: 933, bottom: 838 });
    // The screenshot's: link and Remove link have no room, and go under "…".
    await expect(composer.getByRole('button', { name: 'More' })).toBeVisible();
    await expect(composer.getByRole('button', { name: 'Link', exact: true })).toBeHidden();
    const [cancel, save] = [composer.getByRole('button', { name: 'Cancel' }), composer.getByRole('button', { name: 'Save' })];
    expect(await box(cancel)).toEqual(expect.objectContaining({ top: 863, bottom: 894 }));
    expect((await box(save)).right).toBe(933);
    await screen(page, 'wi-text-comment', { viewport: true });
    await save.click();
    await expect(composer.locator('.fd-discussion-problem')).toHaveText('Write a comment first.');
    await expect(save).toBeEnabled();
    await composer.locator('.fd-text-area').click();
    await page.keyboard.type('The night log is in: the count was taken before the release.');
    await page.keyboard.press('Control+Enter');
    await expect(page.locator('li.fd-comment-card')).toHaveCount(2);
    await expect(page.locator('li.fd-comment-card').first().locator('.fd-comment-author')).toHaveText('Salma Nabil');
    await expect(page.locator('li.fd-comment-card').first().locator('.fd-comment-body')).toHaveText('The night log is in: the count was taken before the release.');
    await expect(composer.locator('.fd-text-area')).toHaveText('');
    const counts = await page.evaluate(() => (window as unknown as { fieldiaWiText: { counts: number[] } }).fieldiaWiText.counts);
    expect(counts.at(-1)).toBe(2);
    expect(problems).toEqual([]);
  });

  test('Escape asks before typed words go', async ({ page }) => {
    await visit(page, PAGE, { place: false });
    const composer = page.locator('.fd-composer-card');
    await composer.locator('.fd-text-area').click();
    await page.keyboard.type('half a thought');
    await page.keyboard.press('Escape');
    const ask = composer.getByRole('group', { name: 'Discard your comment?' });
    await expect(ask).toBeVisible();
    await expect(ask.getByRole('button', { name: 'Keep writing' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(composer.locator('.fd-text-area')).toHaveText('half a thought');
  });
});

test.describe('Add link, as Screenshot 20.23.03', () => {
  test('its menu under the button, its end at the button’s, two 31px rows; Effort (Hours) folded with ⌄', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    const { problems } = await visit(page);
    const add = node(page, 'f-related').getByRole('button', { name: 'Add link' });
    await add.click();
    const menu = page.getByRole('menu', { name: 'Add link' });
    await expect(menu).toBeVisible();
    const [menuBox, addBox] = [await box(menu), await box(add)];
    expect(menuBox.right - menuBox.left).toBe(223);
    expect([menuBox.right, menuBox.top]).toEqual([addBox.right, addBox.bottom]);
    const items = menu.getByRole('menuitem');
    await expect(items).toHaveText(['Existing item', 'New item']);
    for (const item of await items.all()) expect((await box(item)).bottom - (await box(item)).top).toBe(31);
    expect((await drawn(add, 'background-color'))['background-color']).not.toBe('rgba(0, 0, 0, 0)');
    await expect(add).toHaveAttribute('aria-expanded', 'true');
    await expect(items.first()).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(items.last()).toBeFocused();
    expect((await drawn(items.last(), 'outline-style'))['outline-style']).toBe('solid');
    const effort = tool(page, 'g-effort', 'Expand Effort (Hours)');
    await expect(effort).toHaveAttribute('aria-expanded', 'false');
    expect((await drawn(heading(page, 'g-effort').locator('.fd-section-tools'), 'opacity'))['opacity']).toBe('1');
    await screen(page, 'wi-text-add-link', { viewport: true });
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(add).toBeFocused();
    // Folding from the keyboard.
    await effort.focus();
    await page.keyboard.press('Enter');
    await expect(tool(page, 'g-effort', 'Collapse Effort (Hours)')).toHaveAttribute('aria-expanded', 'true');
    await expect(node(page, 'f-estimate')).toBeVisible();
    expect(problems).toEqual([]);
  });

  test('Existing item searches and links what is picked; New item opens a new record', async ({ page }) => {
    await visit(page, PAGE, { place: false });
    const related = node(page, 'f-related');
    await related.getByRole('button', { name: 'Add link' }).click();
    await page.getByRole('menuitem', { name: 'Existing item' }).click();
    const dialog = page.getByRole('dialog', { name: 'Related Work' });
    await dialog.getByRole('searchbox').fill('scanner');
    await dialog.getByRole('option', { name: 'Warehouse scanner drops the last line of a pick list' }).click();
    await expect(related.locator('.fd-links-list li')).toHaveText(['Warehouse scanner drops the last line of a pick list']);
    await expect(related.getByRole('button', { name: 'Add an existing work item as a parent' })).toBeHidden();
    await related.getByRole('button', { name: 'Remove Warehouse scanner drops the last line of a pick list' }).click();
    await expect(related.locator('.fd-links-list li')).toHaveCount(0);
    await related.getByRole('button', { name: 'Add link' }).click();
    await page.getByRole('menuitem', { name: 'New item' }).click();
    const made = page.getByRole('dialog');
    await expect(made).toBeVisible();
    await expect(made.locator('[data-node="g-repro"]')).toBeVisible();
    await made.getByRole('button', { name: 'Close' }).first().click();
    await expect(made).toBeHidden();
    // Development's Add link searches at once.
    await node(page, 'f-dev').getByRole('button', { name: 'Add link' }).click();
    await expect(page.getByRole('dialog', { name: 'Development' })).toBeVisible();
  });
});

test.describe('a group alone over the body', () => {
  test('⤢ shows Discussion alone, wide; Escape puts the body back', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await visit(page);
    const big = tool(page, 'g-discussion', 'Maximise Discussion');
    await node(page, 'g-discussion').hover();
    await big.click();
    await expect(big).toHaveAttribute('aria-pressed', 'true');
    await expect(node(page, 'g-repro')).toBeHidden();
    await expect(node(page, 'col-2')).toBeHidden();
    const wide = await box(node(page, 'g-discussion'));
    expect(wide.right - wide.left).toBe(1689);
    await screen(page, 'wi-text-maximised', { viewport: true });
    await page.keyboard.press('Escape');
    await expect(big).toHaveAttribute('aria-pressed', 'false');
    await expect(node(page, 'g-repro')).toBeVisible();
    await expect(big).toBeFocused();
  });
});

test.describe('in every language, right to left, dark and on a phone', () => {
  test('Arabic, right to left: mirrored, its tools in Arabic, the arrows along the toolbar flipped', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const { problems } = await visit(page, `${PAGE}&locale=ar&dir=rtl`, { place: false, colours: false });
    await expect(heading(page, 'g-repro').locator('.fd-section-name')).toHaveText('خطوات إعادة الإنتاج');
    const [first, last] = [await box(node(page, 'col-1')), await box(node(page, 'col-3'))];
    expect(first.left).toBeGreaterThan(last.left);
    const field = node(page, 'f-system');
    await field.locator('.fd-text-area').click();
    const bold = field.getByRole('button', { name: 'غامق' });
    const italic = field.getByRole('button', { name: 'مائل' });
    expect((await box(bold)).left).toBeGreaterThan((await box(italic)).left);
    await bold.focus();
    await page.keyboard.press('ArrowLeft');
    await expect(italic).toBeFocused();
    await expect(page.locator('.fd-composer-card').getByRole('button', { name: 'التبديل إلى محرر Markdown' })).toBeVisible();
    await expect(page.locator('li.fd-comment-card .fd-comment-date')).toHaveText('علّق في 14 يونيو');
    await screen(page, 'wi-text-arabic', { viewport: true });
    expect(await axeFindings(page, 'Arabic, System Info worked in')).toEqual([]);
    expect(problems).toEqual([]);
  });

  test('German and French name the tools and the groups’ tools', async ({ page }) => {
    for (const [locale, bold, strike, big, add] of [
      ['de', 'Fett', 'Durchgestrichen', 'Reproduktionsschritte maximieren', 'Link hinzufügen'],
      ['fr', 'Gras', 'Barré', 'Agrandir Étapes de reproduction', 'Ajouter un lien'],
    ] as const) {
      await visit(page, `${PAGE}&locale=${locale}`, { place: false });
      await expect(tool(page, 'g-repro', big)).toBeAttached();
      await node(page, 'f-system').locator('.fd-text-area').click();
      await expect(node(page, 'f-system').getByRole('button', { name: bold, exact: true })).toBeVisible();
      await expect(node(page, 'f-system').getByRole('button', { name: strike })).toBeVisible();
      await expect(node(page, 'f-related').getByRole('button', { name: add })).toBeVisible();
    }
  });

  test('dark: its cards, boxes and menus on the dark ground, and axe finds nothing', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await visit(page, `${PAGE}&scheme=dark`, { place: false, colours: false });
    const card = page.locator('li.fd-comment-card');
    const ground = (await drawn(card, 'background-color'))['background-color'];
    expect(ground).not.toBe('rgb(255, 255, 255)');
    await node(page, 'f-related').getByRole('button', { name: 'Add link' }).click();
    const menu = page.getByRole('menu', { name: 'Add link' });
    expect((await drawn(menu, 'background-color'))['background-color']).toBe(ground);
    await screen(page, 'wi-text-dark', { viewport: true });
    expect(await axeFindings(page, 'dark, Add link open')).toEqual([]);
  });

  test('on a phone: one column, no sideways scroll, the toolbar’s tools under “…”', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await visit(page, PAGE, { place: false, colours: false });
    await expectNoSidewaysScroll(page);
    const [a, b] = [await box(node(page, 'col-1')), await box(node(page, 'col-2'))];
    expect(b.top).toBeGreaterThan(a.bottom - 1);
    await node(page, 'f-system').locator('.fd-text-area').click();
    await expect(node(page, 'f-system').getByRole('button', { name: 'More' })).toBeVisible();
    await expectNoSidewaysScroll(page);
    await screen(page, 'wi-text-phone');
  });
});

test.describe('axe, state by state', () => {
  test('finds nothing at rest, worked in, in Markdown, in the comment box and with the menu open', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await visit(page, PAGE, { place: false, colours: false });
    const found: string[] = [];
    found.push(...(await axeFindings(page, 'at rest')));
    await node(page, 'f-system').locator('.fd-text-area').click();
    found.push(...(await axeFindings(page, 'System Info worked in')));
    await node(page, 'f-repro').locator('.fd-md-view').click({ position: { x: 500, y: 10 } });
    found.push(...(await axeFindings(page, 'Repro Steps in Markdown')));
    await node(page, 'f-repro').getByRole('switch', { name: 'Preview' }).click();
    found.push(...(await axeFindings(page, 'Markdown preview')));
    await page.locator('.fd-composer-card .fd-text-area').click();
    found.push(...(await axeFindings(page, 'comment box worked in')));
    await node(page, 'f-related').getByRole('button', { name: 'Add link' }).click();
    found.push(...(await axeFindings(page, 'Add link open')));
    expect(found).toEqual([]);
  });
});
