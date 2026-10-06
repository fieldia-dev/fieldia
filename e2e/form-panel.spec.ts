import { expect, test, type Locator, type Page } from '@playwright/test';
import { axeFindings } from './a11y-support';
import { expectNoSidewaysScroll, node, open, screen } from './support';

/**
 * A page in a side panel (`openFormPanel`), used as a person uses it: a call
 * logged from the bar over "Every field" in the plain demo — typed in and
 * saved, left with Discard and with Escape (which asks first when something
 * changed), a link's Create and edit… opening a dialog over it, right to left
 * in Arabic, at a phone's width, in the dark scheme, swept by axe; and, from
 * the one-tag script, two panels stacked.
 */

const WIDE = { width: 1280, height: 800 };
const opener = (page: Page) => page.getByRole('button', { name: 'Log a call in a side panel' });
const results = (page: Page) => page.evaluate(() => (window as any).fieldiaDemo.panelResults as { saved: boolean; recordId: unknown; values: Record<string, unknown> }[]);
const subject = (panel: Locator) => panel.locator('[data-node="call-name"] input');
/** Wait for the panel to finish sliding in, so what is measured is where it settles. */
const slidIn = (panel: Locator) => panel.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)).then(() => undefined));

async function openPanel(page: Page, query: string, name = 'Log a call') {
  await open(page, 'plain', query);
  await opener(page).click();
  const panel = page.getByRole('dialog', { name });
  await expect(panel).toBeVisible();
  await slidIn(panel);
  return panel;
}

for (const skin of ['outlined', 'underline']) {
  test(`${skin}: the call opens at the end edge, full height, the page dimmed behind; typed in and saved, it hands back the record`, async ({ page }) => {
    await page.setViewportSize(WIDE);
    const panel = await openPanel(page, `page=fields&skin=${skin}`);
    await expect(subject(panel)).toBeFocused();
    expect(await panel.getAttribute('data-fd-skin')).toBe(skin);
    // At the right edge, its whole height, medium wide.
    const box = (await panel.boundingBox())!;
    expect(Math.round(box.x + box.width)).toBe(WIDE.width);
    expect(Math.round(box.width)).toBe(560);
    expect([Math.round(box.y), Math.round(box.height)]).toEqual([0, WIDE.height]);
    // The page behind is dimmed, and still in sight: a see-through shade, not a wall.
    const shade = await panel.evaluate((el) => getComputedStyle(el.parentElement!).backgroundColor);
    expect(shade).toMatch(/^rgba\(\d+, \d+, \d+, 0\.\d+\)$/);
    // Its own head and foot: the title and ×, then Discard and Save & Close.
    await expect(panel.locator('.fd-form-dialog-head')).toContainText('Log a call');
    await expect(panel.locator('.fd-form-dialog-foot').getByRole('button')).toHaveText(['Discard', 'Save & Close']);
    await subject(panel).fill('Prices for the spring order');
    await node(page, 'call-outcome').getByText('Interested', { exact: true }).click();
    await panel.locator('[data-node="call-note"] textarea').fill('Wants the new chairs by March.');
    await screen(page, `panel-call-${skin}`, { viewport: true });
    await panel.getByRole('button', { name: 'Save & Close' }).click();
    await expect(panel).toBeHidden();
    await expect(opener(page)).toBeFocused();
    const [result] = await results(page);
    expect(result).toEqual({ saved: true, recordId: expect.any(Number), values: expect.objectContaining({ name: 'Prices for the spring order', outcome: 'interested' }) });
    const saved = await page.evaluate((id) => (window as any).fieldiaDemo.dataSource.records.call[id], result.recordId as number);
    expect(saved).toEqual(expect.objectContaining({ name: 'Prices for the spring order', note: 'Wants the new chairs by March.' }));
    await expect(page.locator('.demo-panel-result')).toHaveText(`Saved call ${result.recordId}: Prices for the spring order`);
  });
}

test('a required subject left empty keeps the panel open, at the problem', async ({ page }) => {
  await page.setViewportSize(WIDE);
  const panel = await openPanel(page, 'page=fields&skin=outlined');
  await panel.getByRole('button', { name: 'Save & Close' }).click();
  await expect(subject(panel)).toBeFocused();
  await expect(panel).toBeVisible();
  expect(await results(page)).toEqual([]);
});

test('Discard closes it keeping nothing, without asking; Escape with nothing typed closes it at once', async ({ page }) => {
  await page.setViewportSize(WIDE);
  const panel = await openPanel(page, 'page=fields&skin=outlined');
  await subject(panel).fill('Not this one');
  await panel.getByRole('button', { name: 'Discard' }).click();
  await expect(panel).toBeHidden();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await expect(opener(page)).toBeFocused();
  await opener(page).click();
  await expect(panel).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  await expect(opener(page)).toBeFocused();
  expect((await results(page)).map((r) => r.saved)).toEqual([false, false]);
  expect(await page.evaluate(() => Object.keys((window as any).fieldiaDemo.dataSource.records.call ?? {}).length)).toBe(0);
  await expect(page.locator('.demo-panel-result')).toHaveText('Closed without saving');
});

test('Escape with something typed asks first: Cancel or Escape keeps it, Discard drops it', async ({ page }) => {
  await page.setViewportSize(WIDE);
  const panel = await openPanel(page, 'page=fields&skin=outlined');
  await subject(panel).fill('Half written');
  await page.keyboard.press('Escape');
  const question = page.getByRole('alertdialog', { name: 'Discard your changes?' });
  await expect(question).toBeVisible();
  await expect(question.getByRole('button', { name: 'Cancel' })).toBeFocused();
  // Tab goes round its two answers, never back into the panel under it.
  await page.keyboard.press('Tab');
  await expect(question.getByRole('button', { name: 'Discard' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(question.getByRole('button', { name: 'Cancel' })).toBeFocused();
  await screen(page, 'panel-asks', { viewport: true });
  expect(await axeFindings(page, 'panel asks')).toEqual([]);
  await page.keyboard.press('Enter');
  await expect(question).toBeHidden();
  await expect(panel).toBeVisible();
  await expect(subject(panel)).toBeFocused();
  await expect(subject(panel)).toHaveValue('Half written');
  // Escape on the question is its Cancel.
  await page.keyboard.press('Escape');
  await expect(question).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(question).toBeHidden();
  await expect(panel).toBeVisible();
  // × asks too; Discard leaves.
  await panel.getByRole('button', { name: 'Close', exact: true }).click();
  await question.getByRole('button', { name: 'Discard' }).click();
  await expect(panel).toBeHidden();
  await expect(opener(page)).toBeFocused();
  expect((await results(page)).map((r) => r.saved)).toEqual([false]);
});

test('Tab stays inside the panel, both ways round', async ({ page }) => {
  await page.setViewportSize(WIDE);
  const panel = await openPanel(page, 'page=fields&skin=outlined');
  const save = panel.getByRole('button', { name: 'Save & Close' });
  await save.focus();
  await page.keyboard.press('Tab');
  await expect(panel.getByRole('button', { name: 'Close', exact: true })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(save).toBeFocused();
});

test('a link’s Create and edit… inside the panel opens a dialog above it, and the new customer comes back to the link', async ({ page }) => {
  await page.setViewportSize(WIDE);
  const panel = await openPanel(page, 'page=fields&skin=outlined');
  await subject(panel).fill('First order');
  const customer = panel.locator('[data-node="call-partner"]').getByRole('combobox');
  await customer.fill('Hilton Cairo');
  await panel.locator('[data-node="call-partner"]').getByRole('option', { name: 'Create and edit…' }).click();
  const dialog = page.getByRole('dialog', { name: 'Customer' });
  await expect(dialog.locator('[data-node="#title"] input')).toHaveValue('Hilton Cairo');
  expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);
  // Above the panel: what is under the middle of the dialog is the dialog, and the panel lies under the dialog's shade.
  const over = await dialog.evaluate((el) => {
    const box = el.getBoundingClientRect();
    const panelBox = document.querySelector('.fd-form-panel')!.getBoundingClientRect();
    const atDialog = document.elementFromPoint(box.x + box.width / 2, box.y + 20);
    const atPanel = document.elementFromPoint(panelBox.right - 10, panelBox.bottom - 10);
    return { dialog: el.contains(atDialog), panelShaded: !!atPanel?.closest('.fd-form-dialog-backdrop:not(.fd-form-panel-backdrop)') };
  });
  expect(over).toEqual({ dialog: true, panelShaded: true });
  await dialog.locator('[data-node="f-email"] input').fill('events@hiltoncairo.example');
  await screen(page, 'panel-with-dialog', { viewport: true });
  // Escape in the dialog closes the dialog alone.
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(panel).toBeVisible();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await customer.fill('');
  await customer.fill('Hilton Cairo');
  await panel.locator('[data-node="call-partner"]').getByRole('option', { name: 'Create and edit…' }).click();
  await expect(dialog).toBeVisible();
  await dialog.locator('[data-node="f-email"] input').fill('events@hiltoncairo.example');
  await dialog.getByRole('button', { name: 'Save & Close' }).click();
  await expect(dialog).toBeHidden();
  await expect(panel).toBeVisible();
  await expect(customer).toHaveValue('Hilton Cairo');
  await expect(customer).toBeFocused();
  await panel.getByRole('button', { name: 'Save & Close' }).click();
  await expect(panel).toBeHidden();
  const [result] = await results(page);
  expect(result.values['partner_id']).toEqual({ id: expect.any(Number), label: 'Hilton Cairo' });
});

test('right to left in Arabic: at the left edge, in Arabic, its question too', async ({ page }) => {
  await page.setViewportSize(WIDE);
  const panel = await openPanel(page, 'page=fields&skin=outlined&locale=ar&dir=rtl', 'تسجيل مكالمة');
  const box = (await panel.boundingBox())!;
  expect([Math.round(box.x), Math.round(box.height)]).toEqual([0, WIDE.height]);
  await expect(panel.locator('[data-node="call-name"] .fd-label')).toHaveText('الموضوع');
  await expect(panel.locator('.fd-form-dialog-foot').getByRole('button')).toHaveText(['تجاهل', 'حفظ وإغلاق']);
  // The head runs right to left: the title at the right, × at the left.
  const [title, close] = [(await panel.locator('.fd-form-dialog-title').boundingBox())!, (await panel.getByRole('button', { name: 'إغلاق', exact: true }).boundingBox())!];
  expect(close.x).toBeLessThan(title.x);
  await subject(panel).fill('أسعار طلبية الربيع');
  await screen(page, 'panel-arabic', { viewport: true });
  expect(await axeFindings(page, 'panel arabic')).toEqual([]);
  await page.keyboard.press('Escape');
  const question = page.getByRole('alertdialog', { name: 'هل تريد تجاهل تعديلاتك؟' });
  await expect(question).toBeVisible();
  await expect(question.getByRole('button')).toHaveText(['إلغاء', 'تجاهل']);
  await question.getByRole('button', { name: 'تجاهل' }).click();
  await expect(panel).toBeHidden();
});

test('at a phone’s width it is a full-screen sheet, with nothing to scroll sideways', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const panel = await openPanel(page, 'page=fields&skin=outlined');
  const box = (await panel.boundingBox())!;
  expect([box.x, box.y, box.width, box.height].map(Math.round)).toEqual([0, 0, 390, 844]);
  await expectNoSidewaysScroll(page);
  // Its foot is on the screen, under the fields that scroll.
  const foot = (await panel.locator('.fd-form-dialog-foot').boundingBox())!;
  expect(Math.round(foot.y + foot.height)).toBe(844);
  const overflow = await panel.evaluate((el) => {
    const body = el.querySelector('.fd-form-dialog-body')!;
    return body.scrollWidth - body.clientWidth;
  });
  expect(overflow, 'the panel scrolls sideways').toBeLessThanOrEqual(0);
  await subject(panel).fill('Prices for the spring order');
  await screen(page, 'panel-phone', { viewport: true });
  expect(await axeFindings(page, 'panel phone')).toEqual([]);
});

test('in the dark scheme: its box, its page and its buttons dark, and axe finds nothing', async ({ page }) => {
  await page.setViewportSize(WIDE);
  const panel = await openPanel(page, 'page=fields&skin=outlined&scheme=dark');
  const colours = await panel.evaluate((el) => {
    const input = el.querySelector('input.fd-input') as HTMLElement;
    const primary = el.querySelector('.fd-form-dialog-foot .fd-button-primary') as HTMLElement;
    return {
      scheme: getComputedStyle(el).colorScheme,
      ground: getComputedStyle(el).backgroundColor,
      text: getComputedStyle(input).color,
      primary: getComputedStyle(primary).backgroundColor,
    };
  });
  expect(colours).toEqual({ scheme: 'dark', ground: 'rgb(22, 25, 30)', text: 'rgb(232, 234, 237)', primary: 'rgb(90, 162, 255)' });
  await subject(panel).fill('Prices for the spring order');
  await screen(page, 'panel-dark', { viewport: true });
  expect(await axeFindings(page, 'panel dark')).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('alertdialog')).toBeVisible();
  // The question wears the panel's scheme too.
  expect(await page.getByRole('alertdialog').evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgb(31, 35, 41)');
  await screen(page, 'panel-dark-asks', { viewport: true });
  expect(await axeFindings(page, 'panel dark asks')).toEqual([]);
});

test('axe finds nothing on the panel, nor with a dialog over it', async ({ page }) => {
  await page.setViewportSize(WIDE);
  const panel = await openPanel(page, 'page=fields&skin=underline');
  expect(await axeFindings(page, 'panel')).toEqual([]);
  await panel.locator('[data-node="call-partner"]').getByRole('combobox').fill('Hilton Cairo');
  await panel.locator('[data-node="call-partner"]').getByRole('option', { name: 'Create and edit…' }).click();
  await expect(page.getByRole('dialog', { name: 'Customer' })).toBeVisible();
  expect(await axeFindings(page, 'dialog over the panel')).toEqual([]);
});

/** Where the panel's slide starts: its animation held at the first frame, then let finish. */
const slideStart = (panel: Locator) =>
  panel.evaluate((el) => {
    const slides = el.getAnimations();
    if (slides.length !== 1 || (slides[0] as CSSAnimation).animationName !== 'fd-slide') return null;
    slides[0].pause();
    slides[0].currentTime = 0;
    const { x, y } = el.getBoundingClientRect();
    slides[0].finish();
    return { x: Math.round(x), y: Math.round(y) };
  });

test('it slides in only when motion is welcome: from the right, from the left right to left, from below on a phone', async ({ page }) => {
  await page.setViewportSize(WIDE);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page, 'plain', 'page=fields&skin=outlined');
  await opener(page).click();
  let panel = page.getByRole('dialog', { name: 'Log a call' });
  await expect(panel).toBeVisible();
  expect(await panel.evaluate((el) => el.getAnimations().length)).toBe(0);
  await page.keyboard.press('Escape');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  // Just past the right edge, as wide as itself.
  await opener(page).click();
  expect(await slideStart(panel)).toEqual({ x: WIDE.width, y: 0 });
  await page.keyboard.press('Escape');
  // Right to left: just past the left edge.
  await open(page, 'plain', 'page=fields&skin=outlined&locale=ar&dir=rtl');
  await opener(page).click();
  panel = page.getByRole('dialog', { name: 'تسجيل مكالمة' });
  expect(await slideStart(panel)).toEqual({ x: -560, y: 0 });
  await page.keyboard.press('Escape');
  // A phone: from below the screen, in Arabic too.
  await page.setViewportSize({ width: 390, height: 844 });
  await opener(page).click();
  expect(await slideStart(panel)).toEqual({ x: 0, y: 844 });
});

test('from the one-tag script: a panel opened from a panel stacks over it, the older one stepped back, and the focus comes back through both', async ({ page }) => {
  await page.setViewportSize(WIDE);
  await page.goto('/script/');
  await expect(page.locator('.fd-form')).toBeVisible();
  const first = page.getByRole('dialog', { name: 'Ask for a call back' });
  const second = page.getByRole('dialog', { name: 'Best time' });
  await page.evaluate(() => {
    const { Fieldia, fieldiaDemo } = window as any;
    const opener = document.createElement('button');
    opener.textContent = 'Open the panel';
    document.body.append(opener);
    opener.focus();
    (window as any).firstDone = Fieldia.openFormPanel({ page: fieldiaDemo.page, title: 'Ask for a call back', mode: 'values', skin: 'outlined', width: 'wide' });
  });
  await expect(first).toBeVisible();
  await slidIn(first);
  await first.locator('[data-node="name"] input').focus();
  await page.evaluate(() => {
    const { Fieldia, fieldiaDemo } = window as any;
    (window as any).secondDone = Fieldia.openFormPanel({ page: { ...fieldiaDemo.page, title: 'Best time' }, title: 'Best time', mode: 'values', skin: 'outlined', width: 'narrow' });
  });
  await expect(second).toBeVisible();
  await slidIn(second);
  await first.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
  expect(await first.getAttribute('data-behind')).toBe('');
  const [older, newer] = [(await first.boundingBox())!, (await second.boundingBox())!];
  // The older one steps back from the edge, still in sight beside the newer, narrower one.
  expect(Math.round(older.x + older.width)).toBe(WIDE.width - 48);
  expect(Math.round(newer.x + newer.width)).toBe(WIDE.width);
  expect(Math.round(newer.width)).toBe(420);
  await expect(second.getByRole('button', { name: 'Done' })).toBeVisible();
  await screen(page, 'panel-stacked', { viewport: true });
  await page.keyboard.press('Escape');
  await expect(second).toBeHidden();
  await expect(first.locator('[data-node="name"] input')).toBeFocused();
  expect(await first.getAttribute('data-behind')).toBeNull();
  await page.keyboard.press('Escape');
  await expect(first).toBeHidden();
  await expect(page.getByRole('button', { name: 'Open the panel' })).toBeFocused();
});
