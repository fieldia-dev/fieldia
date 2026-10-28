import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { screen } from './support';

/**
 * Fieldia under a strict Content-Security-Policy, as a bank's or a government's site serves it (tools/serve.mjs, /csp/):
 * scripts and styles only with the response's nonce — no 'unsafe-inline', no 'unsafe-eval', nothing from elsewhere.
 * The packages built as an app builds them (demos/csp/main.ts: the app hands the viewer, or the designer, its nonce),
 * and the one-tag script, which takes its own tag's nonce (demos/csp/script.html). Each page is drawn, worked in a
 * little, and its parts let come; then nothing was refused: no <style> without the nonce, no style attribute, no code
 * made from text — and Fieldia's look is on. In every engine (playwright.config.ts's smoke set).
 */

interface Violation {
  directive: string;
  blocked: string;
  sample: string;
  source: string;
  line: number;
  target: string;
  /** The refused element's tag. */
  tag: string;
}

/**
 * The browser's own refusals, as the page learnt them from a select of its own made first (demos/csp/index.html): WebKit
 * 27.2 refuses the style inside each <select> it draws — on a page of nothing but a bare
 * <select> too ("WebKit refuses its own select's style", below, which fails once WebKit stops). Told by its words (the
 * policy's 'report-sample': "text-overflow:inherit"), at a select or, for one not yet placed, at the document. Fieldia
 * writes no style attribute (tools/csp-source.test.mjs), and every other refusal fails, in every engine: a style
 * attribute written on a select among them ("a style attribute written on a select", below). 0.36's excuse was any
 * style-src-attr refusal with no words, in WebKit, which was every one: no policy here asked for the words.
 */
const browsersOwn = (own: string[]) => (one: Violation) => one.directive === 'style-src-attr' && !!one.sample && own.includes(`${one.directive} ${one.sample}`) && (one.tag === 'SELECT' || one.tag === '');
/** What the browser refuses of its own, as the page learnt it: WebKit's select alone. */
const OWN = { webkit: ['style-src-attr text-overflow:inherit'], chromium: [], firefox: [] } as Record<string, string[]>;

/**
 * What the policy refused, every one reported: a violation of our own is caused last, once the page is drawn, and
 * waited for — the browser reports them in order, so what came before it has been reported by then.
 */
async function refused(page: Page): Promise<Violation[]> {
  // The page drawn, every part it draws from in (the viewer's `drawn`).
  await page.evaluate(() => (window as unknown as { fieldiaDemo?: { handle?: { drawn?: Promise<void> } } }).fieldiaDemo?.handle?.drawn);
  await page.evaluate(() => {
    const mark = document.createElement('i');
    mark.id = 'csp-sentinel';
    mark.setAttribute('style', 'outline: 0');
    document.body.append(mark);
  });
  await expect.poll(() => page.evaluate(() => (window as unknown as { cspViolations: Violation[] }).cspViolations.some((one) => one.target === 'csp-sentinel'))).toBe(true);
  const own = await page.evaluate(() => (window as unknown as { cspOwn: string[] }).cspOwn);
  expect(own, 'what the page learnt the browser refuses of its own').toEqual(OWN[page.context().browser()?.browserType().name() ?? ''] ?? []);
  return (await page.evaluate(() => (window as unknown as { cspViolations: Violation[] }).cspViolations.filter((one) => one.target !== 'csp-sentinel'))).filter((one) => !browsersOwn(own)(one));
}

/** Fieldia's look is on: its sheet came in (with the nonce), so its tokens are on the form. */
async function lookIsOn(page: Page) {
  await expect.poll(() => page.locator('.fd-form').first().evaluate((form) => getComputedStyle(form).getPropertyValue('--fd-accent').trim())).not.toBe('');
  // Every <style> on the page carries the nonce: none was refused.
  expect(await page.evaluate(() => [...document.querySelectorAll('style')].filter((sheet) => !sheet.nonce).map((sheet) => sheet.id || (sheet.textContent ?? '').slice(0, 60)))).toEqual([]);
}

function problemsOf(page: Page) {
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(`page error: ${error.message}`));
  page.on('console', (message) => {
    // What the policy refused is in the violations, each one, read by `refused` — its own sentinel's among them. Each
    // engine says it its own way: "Refused to apply inline style…", Chromium 156 "Applying inline style violates the
    // following Content Security Policy directive…".
    if (message.type() === 'error' && !/Refused to |Content[- ]Security[- ]Policy/.test(message.text())) problems.push(`console: ${message.text()}`);
  });
  return problems;
}

// A sign-up (a date's box, a phone, a bot check), a customer (a record's head, a statusbar, the chatter), an order (a
// table of lines), every field (formatted text, code, files…), a survey's kinds, a list (its filters and cards), a work
// item's text and discussion, and AG Grid's tables of lines.
for (const name of ['signup', 'customer', 'order', 'fields', 'survey', 'customers', 'wi-text', 'empty-grids']) {
  test(`${name} draws and works under a strict Content-Security-Policy, nothing refused`, async ({ page }) => {
    const problems = problemsOf(page);
    await page.goto(`/csp/?page=${name}`);
    await expect(page.locator('.fd-form').first()).toBeVisible();
    await lookIsOn(page);
    // A person types in the first box and leaves it, as the form reads what is typed.
    const box = page.locator('.fd-field input[type="text"]:visible, .fd-field input:not([type]):visible, .fd-field textarea:visible').first();
    if (await box.count()) {
      await box.click();
      await box.pressSequentially('Mona');
      await box.press('Tab');
    }
    expect(await refused(page)).toEqual([]);
    await screen(page, `csp-${name}`);
    expect(problems).toEqual([]);
  });
}

/**
 * The features of 0.29 and 0.31 that colour, size or place what they draw, each drawn and worked in a little under the
 * policy — every colour, width and place set through an element's style object, which a policy allows, never a style
 * attribute: an option's icon and colour dot and a link's suggestions with theirs (a lease), a QR code and a barcode (a
 * ticket), a list's Gantt timeline, a list's cells changed in place, a photo's crop and turn, and AI help's proposals
 * laid on their fields, the old struck through.
 */
const WORKED: [string, string, (page: Page) => Promise<void>][] = [
  ['an option’s colour dot and icon, and a link’s suggestions', 'lease&now=2026-10-21T09:00:00', async (page) => {
    await page.locator('[data-node="f-plan"] .fd-own-button').click();
    await expect(page.getByRole('listbox').getByRole('option')).toHaveCount(4);
    await page.keyboard.press('Escape');
    const agent = page.locator('[data-node="f-agent"] input');
    await agent.click();
    await agent.fill('al');
    await expect(page.locator('[data-node="f-agent"] .fd-option-dot').first()).toBeVisible();
    await page.keyboard.press('Escape');
  }],
  ['a QR code and a barcode', 'event-ticket&record=1', async (page) => {
    await expect(page.locator('[data-node="f-link"] svg[role="img"]')).toBeVisible();
    await expect(page.locator('[data-node="f-reference"] svg')).toBeVisible();
  }],
  ['a list’s Gantt timeline', 'fitout-plan&now=2026-10-14T09:40', async (page) => {
    await expect(page.locator('.fd-gantt-task').first()).toBeVisible();
    // Another scale: the timeline drawn again, its bars placed and sized anew.
    await page.locator('.fd-gantt-zooms button').last().click();
    await expect(page.locator('.fd-gantt-task').first()).toBeVisible();
  }],
  ['a list’s cells changed in place', 'service-prices', async (page) => {
    const price = page.locator('.fd-list-row td[data-edit][data-col="price"]').first();
    await price.click();
    await expect(price.locator('input')).toBeVisible();
    await price.locator('input').fill('2900');
    await page.keyboard.press('Tab');
  }],
  ['a photo set’s crop and turn', 'listing-photo-set', async (page) => {
    const tile = page.locator('.fd-photo').first();
    await tile.hover();
    await tile.getByRole('button', { name: /^Crop and turn / }).click();
    await expect(page.getByRole('dialog', { name: /^Crop and turn/ })).toBeVisible();
    await page.keyboard.press('ArrowLeft');
  }],
  ['AI help’s proposals on their fields', 'customer-from-email&record=new', async (page) => {
    await page.getByRole('button', { name: 'Fill from an e-mail' }).click();
    const dialog = page.getByRole('dialog', { name: 'Fill from an e-mail' });
    await dialog.getByRole('textbox', { name: 'Text to fill the form from' }).fill('Mona Adel\nSales Director, Nile Traders\nmona.adel@niletraders.example · +20 100 123 4567');
    await dialog.getByRole('button', { name: 'Propose values' }).click();
    await expect(page.locator('.fd-proposal').first()).toBeVisible();
  }],
  ['a formatted table’s header row turned off and on, its cells’ alignment kept', 'contract-fees', async (page) => {
    // Each cell made again as a header's or a plain one's (rich-table.ts): its alignment through its style object.
    const table = page.locator('[data-node="f-fees"] table');
    await table.locator('th', { hasText: 'Qty' }).click();
    for (const checked of ['false', 'true']) {
      await page.locator('[data-node="f-fees"]').getByRole('button', { name: 'Table', exact: true }).click();
      await page.getByRole('menu', { name: 'Table' }).getByRole('menuitemcheckbox', { name: 'Header row' }).click();
      await expect(table.locator(checked === 'true' ? 'th' : 'td', { hasText: 'Qty' })).toHaveCSS('text-align', 'right');
      await table.locator('td, th', { hasText: 'Qty' }).first().click();
    }
  }],
];
for (const [what, query, work] of WORKED) {
  test(`${what} draw and work under a strict Content-Security-Policy, nothing refused`, async ({ page }) => {
    const problems = problemsOf(page);
    await page.goto(`/csp/?page=${query}`);
    await expect(page.locator('.fd-form').first()).toBeVisible();
    await lookIsOn(page);
    await work(page);
    expect(await refused(page)).toEqual([]);
    await screen(page, `csp-${query.split('&')[0]}`);
    expect(problems).toEqual([]);
  });
}

test('a formatted text keeps its own looks — centred, a colour — under a strict policy, none refused', async ({ page }) => {
  await page.goto('/csp/?page=fields');
  await expect(page.locator('.fd-form').first()).toBeVisible();
  await page.evaluate(() =>
    (window as unknown as { fieldiaDemo: { handle: { form: { setValue(name: string, value: unknown): void } } } }).fieldiaDemo.handle.form.setValue(
      'brief',
      '<p style="text-align: center;">Calm <span style="color: rgb(19, 101, 217); font-size: 20px;">sea</span></p>'
    )
  );
  const words = page.locator('[data-field="brief"] p', { hasText: 'Calm' }).first();
  await expect(words).toHaveCSS('text-align', 'center');
  await expect(words.locator('span')).toHaveCSS('color', 'rgb(19, 101, 217)');
  await expect(words.locator('span')).toHaveCSS('font-size', '20px');
  expect(await refused(page)).toEqual([]);
  // The value as kept: its looks still in it.
  expect(await page.evaluate(() => (window as unknown as { fieldiaDemo: { handle: { form: { getState(): { values: Record<string, unknown> } } } } }).fieldiaDemo.handle.form.getState().values['brief'])).toContain('text-align: center');
});

test('the designer draws and works under a strict policy, its checks with no code made from text', async ({ page }) => {
  const problems = problemsOf(page);
  await page.goto('/csp/?page=customer&designer=1');
  await expect(page.locator('.fd-designer')).toBeVisible();
  await expect.poll(() => page.locator('.fd-designer').evaluate((root) => getComputedStyle(root).display)).not.toBe('inline');
  // A field picked on the canvas: its panel opens.
  await page.locator('.fd-designer [data-node]').first().click();
  expect(await refused(page)).toEqual([]);
  await screen(page, 'csp-designer');
  expect(problems).toEqual([]);
});

test("the one-tag script takes its own tag's nonce, for its styles and for each part it adds, none refused", async ({ page }) => {
  const problems = problemsOf(page);
  await page.goto('/csp/script.html');
  await expect(page.locator('.fd-form')).toBeVisible();
  await lookIsOn(page);
  // The parts came, by tags carrying the nonce: a table of lines, the formatted note's looks and its toolbar (the html
  // part), and the sheet's furniture (the sheet part) — a ribbon, a badge, an alert, a stat button.
  await expect(page.locator('[data-field="rooms"] table, [data-field="rooms"] .fd-line-card').first()).toBeVisible();
  const note = page.locator('[data-field="note"] p', { hasText: 'Bring the' }).first();
  await expect(note).toHaveCSS('text-align', 'center');
  await expect(note.locator('span')).toHaveCSS('color', 'rgb(19, 101, 217)');
  await expect(page.locator('[data-field="note"] .fd-richtext-bar')).toBeVisible();
  await expect(page.locator('.fd-ribbon', { hasText: 'New' })).toBeVisible();
  await expect(page.locator('.fd-alert', { hasText: 'Bring the floor plan.' })).toBeVisible();
  await page.locator('[data-field="name"] input, [data-field="name"] textarea').first().fill('Nile Traders Co.');
  // A button's steps and a page opened in a dialog: the acts part, by a tag carrying the nonce too.
  await page.getByRole('button', { name: 'Mark visited' }).click();
  await expect(page.locator('.fd-say', { hasText: 'Marked as visited' })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'North' })).toBeChecked();
  await page.locator('.fd-stat', { hasText: 'Rooms' }).click();
  const dialog = page.getByRole('dialog', { name: 'A room' });
  await expect(dialog).toBeVisible();
  await dialog.locator('[data-field="room"] input').fill('Kitchen');
  await dialog.getByRole('button', { name: 'Discard' }).click();
  await expect(dialog).toBeHidden();
  expect(await refused(page)).toEqual([]);
  await screen(page, 'csp-script');
  expect(problems).toEqual([]);
});

test("a formatted text's tools align its words under a strict policy, in the value and on the screen", async ({ page }) => {
  await page.goto('/csp/script.html');
  const text = page.locator('[data-field="note"] [contenteditable="true"]');
  await text.click();
  await text.press('End');
  await page.getByRole('button', { name: 'Align right', exact: true }).click();
  // Chromium's and Safari's own editing writes the alignment as a style attribute, which the policy refuses to apply
  // (and reports): Fieldia puts it on through the paragraph's style object, so it shows as it is kept.
  await expect(text.locator('p').first()).toHaveCSS('text-align', 'right');
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { fieldiaDemo: { handle: { form: { getState(): { values: Record<string, unknown> } } } } }).fieldiaDemo.handle.form.getState().values['note']))
    .toContain('text-align: right');
});

test("WebKit refuses its own select's style under a style-src policy, as the refusals left out above say", async ({ page, browserName }) => {
  test.skip(browserName !== 'webkit', "WebKit's alone: Chromium and Firefox refuse nothing on this page");
  await page.setContent(`<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'nonce-n' 'report-sample'"><body><script>
    window.refused = []; document.addEventListener('securitypolicyviolation', (event) => refused.push(event.violatedDirective + ' ' + event.sample));
    const select = document.createElement('select'); select.append(new Option('One')); document.body.append(select);
  </script></body>`);
  // Once WebKit refuses nothing here, or other words, `OWN` says so: every refusal is then a failure in WebKit too.
  await expect.poll(() => page.evaluate(() => (window as unknown as { refused: string[] }).refused)).toEqual(OWN['webkit']);
});


test('a style attribute written on a select is refused, and the gate says so, in every engine', async ({ page }) => {
  await page.goto('/csp/?page=signup');
  await expect(page.locator('.fd-form').first()).toBeVisible();
  // What a style attribute in Fieldia's code would do: refused by the policy, and never taken for the browser's own.
  await page.locator('select.fd-select').first().evaluate((select) => select.setAttribute('style', 'outline: 1px solid red'));
  expect((await refused(page)).map((one) => [one.directive, one.tag])).toEqual([['style-src-attr', 'SELECT']]);
});

/**
 * On a phone, as the 0.36 walk opened fieldia.dev/demos/csp/ in WebKit at an iPhone's size (its "Your role" select): the
 * form and the one-tag script refuse nothing, and the note over the form says so — the browser's own refusals apart.
 */
test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });
  /**
   * A sheet opened over the page wears the form's look — the tokens and accent the form's own style object holds —
   * through its own style object: a style attribute copied from the form is refused, and the sheet loses the look (0.36:
   * a phone's country list, a list's Filters and Import, a scanner's sheet). The app's tokens put on first.
   */
  const SHEETS: [string, string, (page: Page) => Promise<void>, string][] = [
    ['a phone’s country list', 'real-contact&record=7001', (page) => page.locator('[data-node="f-phone"] .fd-phone-country').click(), 'Country of Phone'],
    ['a list’s Filters', 'homes-search', (page) => page.locator('.fd-filter-sheet-open').click(), 'Filters'],
    ['a list’s Import', 'contacts', (page) => page.getByRole('button', { name: 'Import' }).click(), 'Import into Contacts'],
  ];
  for (const [what, query, opening, name] of SHEETS) {
    test(`${what} opens wearing the form's look, nothing refused`, async ({ page }) => {
      const problems = problemsOf(page);
      await page.goto(`/csp/?page=${query}`);
      await expect(page.locator('.fd-form').first()).toBeVisible();
      await page.evaluate(() => (window as unknown as { fieldiaDemo: { handle: { drawn: Promise<void>; setTokens(tokens: Record<string, string>): void } } }).fieldiaDemo.handle.drawn);
      await page.evaluate(() => (window as unknown as { fieldiaDemo: { handle: { setTokens(tokens: Record<string, string>): void } } }).fieldiaDemo.handle.setTokens({ accent: '#b42318' }));
      await opening(page);
      const sheet = page.getByRole('dialog', { name });
      await expect(sheet).toBeVisible();
      expect(await sheet.evaluate((box) => getComputedStyle(box).getPropertyValue('--fd-accent').trim())).toBe('#b42318');
      expect(await refused(page)).toEqual([]);
      expect(problems).toEqual([]);
    });
  }
  for (const [what, address] of [['the strict-policy demo', '/csp/'], ['the one-tag script', '/csp/script.html']]) {
    test(`${what} draws under the policy, nothing refused, and its note says so`, async ({ page }) => {
      const problems = problemsOf(page);
      await page.goto(address);
      await expect(page.locator('.fd-form').first()).toBeVisible();
      await lookIsOn(page);
      const box = page.locator('.fd-field input[type="text"]:visible, .fd-field textarea:visible').first();
      await box.tap();
      await box.pressSequentially('Mona');
      // The note first: the gate's own mark (`refused`) is a refusal it counts too.
      await page.evaluate(() => (window as unknown as { fieldiaDemo?: { handle?: { drawn?: Promise<void> } } }).fieldiaDemo?.handle?.drawn);
      await expect(page.locator('#csp-refused')).toHaveText('nothing');
      expect(await refused(page)).toEqual([]);
      expect(problems).toEqual([]);
    });
  }
});
