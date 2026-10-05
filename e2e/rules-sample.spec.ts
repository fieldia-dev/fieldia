import { expect, test, type Locator, type Page } from '@playwright/test';
import { addField, cardOf, doubleLines, inAdvanced, watch } from './designer-support';
import { expectNoSidewaysScroll, screen } from './support';

/**
 * Try a value, beside a field's answer rules, used as a person uses it: a
 * rule added, a value typed in the field's own box and the form's verdict
 * read under it — Passes, a rule that stops sending, a warning that still
 * sends, in their colours — and read again at once as the rule is edited; a
 * rule across two dates tried with a box for the other date; a rule reading
 * a field worked out from others, named, with Try it; the words in Arabic,
 * right to left; a phone's width; and a survey question's card.
 */

const panel = (page: Page) => page.locator('.fd-properties');
const rulesTab = (page: Page) => panel(page).getByRole('tab', { name: 'Rules', exact: true });
const sampleIn = (scope: Locator) => scope.getByRole('group', { name: 'Try a value' });
const said = (sample: Locator) => sample.locator('.fd-answer-sample-result');

/** A screenshot to look at, with no line drawn twice. */
async function check(page: Page, name: string, options: { viewport?: boolean } = {}) {
  await page.waitForTimeout(150);
  await screen(page, `rules-sample-${name}`, { viewport: options.viewport ?? true });
  expect(await doubleLines(page), name).toEqual([]);
}

/** The page being built and whether there is an edit to undo: what typing in a sample must leave alone. */
const kept = (page: Page) =>
  page.evaluate(() => {
    const d = window.fieldiaDesigner.designer as unknown as { getPage(): unknown; getState(): { canUndo: boolean } };
    return { page: JSON.stringify(d.getPage()), canUndo: d.getState().canUndo };
  });

/** The colour a result is drawn in, and the colour its token names, for one level. */
const colours = (sample: Locator, level: 'error' | 'warning', token: string) =>
  sample.evaluate(
    (box, [level, token]) => {
      const probe = document.createElement('span');
      probe.style.color = `var(${token})`;
      box.append(probe);
      const named = getComputedStyle(probe).color;
      probe.remove();
      return { drawn: getComputedStyle(box.querySelector(`[data-level="${level}"]`) as Element).color, named };
    },
    [level, token] as const
  );

/** Every control in the sample is at least 24px each way. */
async function expectTargets(sample: Locator) {
  const small = await sample.evaluate((box) =>
    [...box.querySelectorAll<HTMLElement>('input, select, button, textarea')]
      .filter((control) => control.getClientRects().length > 0)
      .map((control) => ({ name: control.getAttribute('aria-label') ?? control.id ?? control.textContent, box: control.getBoundingClientRect() }))
      .filter(({ box }) => box.width < 24 || box.height < 24)
      .map(({ name, box }) => `${name} ${Math.round(box.width)}×${Math.round(box.height)}`)
  );
  expect(small, 'targets under 24px').toEqual([]);
}

/**
 * A date typed into a date box as its reader types it: day first where the
 * box shows days first, month first where it shows months first.
 */
async function typeDate(page: Page, box: Locator, iso: string) {
  const [year, month, day] = iso.split('-');
  // Clicked at its start, as a person does: the cursor is on its first part.
  const start = async () => box.click({ position: { x: 14, y: ((await box.boundingBox())?.height ?? 32) / 2 } });
  await start();
  await page.keyboard.type(`${day}${month}${year}`);
  if ((await box.inputValue()) !== iso) {
    await start();
    await page.keyboard.type(`${month}${day}${year}`);
  }
  await expect(box).toHaveValue(iso);
}

/** Customer picked, on the Rules tab, with a length rule added from Add a rule. */
async function customerWithLength(page: Page) {
  await (await cardOf(page, 'Customer')).click();
  await rulesTab(page).scrollIntoViewIfNeeded();
  await rulesTab(page).click();
  // No rules yet: no sample, Add a rule is the invitation.
  await expect(sampleIn(panel(page))).toBeHidden();
  await panel(page).getByRole('button', { name: 'Add a rule' }).click();
  await page.getByRole('menuitem', { name: 'A length' }).click();
  await expect(panel(page).getByRole('spinbutton', { name: 'Shortest' })).toBeFocused();
  return sampleIn(panel(page));
}

test.describe('try a value beside the answer rules', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await inAdvanced(page);
  });

  test('typed in the field’s own box: passes, stops, warns, and follows each edit of the rules', async ({ page }) => {
    const problems = watch(page);
    await page.goto('/screen/');
    const sample = await customerWithLength(page);
    await expect(sample).toBeVisible();
    await expect(said(sample)).toHaveText(['Type or pick an answer to see what the form says.']);
    await expect(sample.locator('[aria-live="polite"]')).toHaveCount(1);
    const before = await kept(page);

    // A letter: too short, and it does not send.
    const box = sample.getByLabel('Customer', { exact: true });
    await box.click();
    await page.keyboard.type('A');
    await expect(said(sample)).toHaveText(['×Customer must be at least 2 charactersStops sending']);
    await expect(box).toHaveAttribute('aria-invalid', 'true');
    await sample.scrollIntoViewIfNeeded();
    await check(page, 'stops');
    await page.keyboard.type('cme');
    await expect(said(sample)).toHaveText(['✓Passes']);
    await expect(box).toHaveAttribute('aria-invalid', 'false');
    await check(page, 'passes');

    // The rule edited: the verdict follows at once, the value stays.
    const shortest = panel(page).getByRole('spinbutton', { name: 'Shortest' });
    await shortest.click();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type('6');
    await expect(said(sample)).toHaveText(['×Customer must be at least 6 charactersStops sending']);
    await panel(page).getByRole('textbox', { name: 'Message when it does not fit' }).click();
    await page.keyboard.type('Write the full name');
    await expect(said(sample)).toHaveText(['×Write the full nameStops sending']);
    await expect(box).toHaveValue('Acme');

    // A second rule that only warns: both speak, each in its colour.
    await panel(page).getByRole('button', { name: 'Add a rule' }).click();
    await page.getByRole('menuitem', { name: 'An ending' }).click();
    await expect(panel(page).getByRole('textbox', { name: 'Ends with' })).toBeFocused();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type('Ltd');
    await panel(page).getByRole('button', { name: 'Only warns' }).click();
    await panel(page).getByRole('textbox', { name: 'Message when it does not fit' }).click();
    await page.keyboard.type('Add Ltd if it is a company');
    await expect(said(sample)).toHaveText(['×Write the full nameStops sending', '!Add Ltd if it is a companyStill sends']);
    const warning = await colours(sample, 'warning', '--fd-warning');
    const error = await colours(sample, 'error', '--fd-error');
    expect(warning.drawn).toBe(warning.named);
    expect(error.drawn).toBe(error.named);
    expect(warning.drawn).not.toBe(error.drawn);
    await sample.scrollIntoViewIfNeeded();
    await check(page, 'stops-and-warns');

    // Long enough and a company: only the warning goes, then nothing.
    await box.click();
    await page.keyboard.type(' Trading');
    await expect(said(sample)).toHaveText(['!Add Ltd if it is a companyStill sends']);
    await expect(box).toHaveAttribute('aria-invalid', 'false');
    await check(page, 'warns');
    await page.keyboard.type(' Ltd');
    await expect(said(sample)).toHaveText(['✓Passes']);

    // The first rule removed: the verdict is read again without it.
    await panel(page).getByRole('button', { name: 'Remove the rule “At least 6 letters”' }).click();
    await box.click();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type('Ab');
    await expect(said(sample)).toHaveText(['!Add Ltd if it is a companyStill sends']);

    // Typing in the sample kept nothing in the page and made no undo step.
    const typedOnly = await kept(page);
    await page.keyboard.type('c');
    expect(await kept(page)).toEqual(typedOnly);
    expect(before.canUndo).toBe(true);
    expect(problems).toEqual([]);
  });

  test('a rule across two dates, tried with a box for the other date', async ({ page }) => {
    const problems = watch(page);
    await page.goto('/screen/');
    await (await cardOf(page, 'Due by')).click();
    await rulesTab(page).click();
    await panel(page).getByRole('button', { name: 'Add a rule' }).click();
    await page.getByRole('menuitem', { name: 'A rule across fields' }).click();
    const holds = panel(page).getByRole('combobox', { name: 'Must hold' });
    await expect(holds).toBeFocused();
    await page.keyboard.type('due');
    await expect(panel(page).getByRole('listbox', { name: 'Fields' }).getByRole('option')).toHaveText([/^Due by/]);
    await page.keyboard.press('Enter');
    await page.keyboard.type(' > @visit');
    await expect(panel(page).getByRole('listbox', { name: 'Fields' }).getByRole('option')).toHaveText([/^Visit date/]);
    await page.keyboard.press('Enter');
    await expect(panel(page).locator('.fd-answer-rule-say')).toHaveText(['Must hold: Due by > Visit date']);
    await panel(page).getByRole('textbox', { name: 'Message when it does not fit' }).click();
    await page.keyboard.type('Due after the visit');

    const sample = sampleIn(panel(page));
    await expect(sample.locator('.fd-answer-sample-reads')).toHaveText('The rules also read');
    const due = sample.getByLabel('Due by', { exact: true });
    const visit = sample.getByLabel('Visit date', { exact: true });
    await typeDate(page, due, '2026-10-12');
    // The visit not filled in yet: the rule waits, as the form's does.
    await expect(said(sample)).toHaveText(['✓Passes']);
    await typeDate(page, visit, '2026-10-20');
    await expect(said(sample)).toHaveText(['×Due after the visitStops sending']);
    await sample.scrollIntoViewIfNeeded();
    await check(page, 'across');
    await typeDate(page, visit, '2026-10-01');
    await expect(said(sample)).toHaveText(['✓Passes']);
    expect(problems).toEqual([]);
  });

  test('a rule reading a field worked out from others names it, and offers Try it', async ({ page }) => {
    const problems = watch(page);
    await page.goto('/screen/');
    await addField(page, 'number', 'Price');
    await addField(page, 'number', 'Quantity');
    await addField(page, 'number', 'Total');
    await page.evaluate(() => {
      const d = window.fieldiaDesigner.designer as unknown as {
        getPage(): { layout: unknown; fields: Record<string, { label: string }> };
        setCompute(id: string, expression: string): boolean;
        addAnswerRule(id: string, rule: { holds: string; message: string }): boolean;
        select(id: string): void;
      };
      const nodes: { id: string; field: string }[] = [];
      const walk = (value: unknown): void => {
        if (Array.isArray(value)) return value.forEach(walk);
        if (!value || typeof value !== 'object') return;
        const part = value as { type?: string; id: string; field: string; children?: unknown };
        if (part.type === 'field') nodes.push(part);
        walk(part.children);
      };
      walk((d.getPage().layout as { children: unknown }).children);
      const fields = d.getPage().fields;
      const of = (label: string) => nodes.find((n) => fields[n.field].label === label) as { id: string; field: string };
      const [price, quantity, total] = [of('Price'), of('Quantity'), of('Total')];
      d.setCompute(total.id, `${price.field} * ${quantity.field}`);
      d.addAnswerRule(price.id, { holds: `${price.field} < ${total.field}`, message: 'Under the total' });
      d.select(price.id);
    });
    await rulesTab(page).click();
    const sample = sampleIn(panel(page));
    await expect(sample.getByLabel('Price', { exact: true })).toBeVisible();
    await expect(sample.getByLabel('Total', { exact: true })).toHaveCount(0);
    const elsewhere = sample.locator('.fd-answer-sample-elsewhere');
    await expect(elsewhere).toContainText('Also reads Total, worked out from other answers: try it with the whole form.');
    await sample.scrollIntoViewIfNeeded();
    await check(page, 'worked-out-elsewhere');
    await elsewhere.getByRole('button', { name: 'Try it' }).click();
    await expect(page.locator('.fd-try')).toBeVisible();
    expect(problems).toEqual([]);
  });

  test('in Arabic, right to left: the rule’s words as the page translates them', async ({ page }) => {
    const problems = watch(page);
    await page.goto('/screen/');
    const sample = await customerWithLength(page);
    await panel(page).getByRole('button', { name: 'Only warns' }).click();
    await panel(page).getByRole('textbox', { name: 'Message when it does not fit' }).click();
    await page.keyboard.type('Write the full name');
    await page.evaluate(() => {
      document.documentElement.dir = 'rtl';
      document.documentElement.lang = 'ar';
      const d = window.fieldiaDesigner.designer as unknown as { addLanguage(tag: string): boolean; setTranslation(tag: string, source: string, text: string): boolean };
      d.addLanguage('ar');
      d.setTranslation('ar', 'Customer', 'العميل');
      d.setTranslation('ar', 'Write the full name', 'اكتب الاسم كاملًا');
    });
    const words = sample.getByRole('combobox', { name: 'Words in' });
    await expect(words.locator('option')).toHaveText(['English, as written', 'Arabic']);
    await words.selectOption('ar');
    const box = sample.getByLabel('العميل', { exact: true });
    await box.click();
    await page.keyboard.type('م');
    await expect(said(sample)).toHaveText(['!اكتب الاسم كاملًاStill sends']);
    const message = sample.locator('.fd-answer-sample-message');
    await expect(message).toHaveAttribute('lang', 'ar');
    expect(await message.evaluate((m) => getComputedStyle(m).direction)).toBe('rtl');
    // The field's box runs right to left: its label at the right, over the box.
    const boxes = sample.locator('.fd-answer-sample-boxes').first();
    expect(await boxes.evaluate((b) => getComputedStyle(b).direction)).toBe('rtl');
    const [label, input] = await Promise.all([sample.locator('.fd-answer-sample-field .fd-label').first().boundingBox(), box.boundingBox()]);
    expect(Math.abs((label?.x ?? 0) + (label?.width ?? 0) - ((input?.x ?? 0) + (input?.width ?? 0)))).toBeLessThan(4);
    await sample.scrollIntoViewIfNeeded();
    await check(page, 'arabic-rtl');
    await expectNoSidewaysScroll(page);
    expect(problems).toEqual([]);
  });

  test('at a phone’s width', async ({ page }) => {
    const problems = watch(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/screen/');
    const sample = await customerWithLength(page);
    const box = sample.getByLabel('Customer', { exact: true });
    await box.scrollIntoViewIfNeeded();
    await box.click();
    await page.keyboard.type('A');
    await expect(said(sample)).toHaveText(['×Customer must be at least 2 charactersStops sending']);
    await sample.scrollIntoViewIfNeeded();
    await check(page, 'phone');
    await expectNoSidewaysScroll(page);
    await expectTargets(sample);
    expect(problems).toEqual([]);
  });

  test('in a survey question’s card', async ({ page }) => {
    const problems = watch(page);
    await page.goto('/designer/');
    await page.getByRole('button', { name: 'Add question' }).first().click();
    await page.keyboard.type('Your name');
    const card = page.locator('.fd-q-selected');
    await card.getByRole('button', { name: 'More options' }).click();
    await page.getByRole('menuitemcheckbox', { name: 'Answer rules' }).click();
    await expect(card.getByRole('button', { name: 'Add a rule' })).toBeFocused();
    await page.keyboard.press('Enter');
    await page.getByRole('menuitem', { name: 'A length' }).click();
    const sample = sampleIn(card);
    const box = sample.getByLabel('Your name', { exact: true });
    await box.click();
    await page.keyboard.type('A');
    await expect(said(sample)).toHaveText(['×Your name must be at least 2 charactersStops sending']);
    await expectTargets(sample);
    await sample.scrollIntoViewIfNeeded();
    await check(page, 'survey');
    await page.keyboard.type('mira');
    await expect(said(sample)).toHaveText(['✓Passes']);
    // Backspace in the sample edits the sample, never the question.
    await page.keyboard.press('Backspace');
    await expect(box).toHaveValue('Amir');
    await expect(card).toHaveCount(1);
    expect(problems).toEqual([]);
  });
});
