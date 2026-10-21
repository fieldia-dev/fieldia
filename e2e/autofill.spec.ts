import { chromium, type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { node, open, screen } from './support';

/**
 * The sign-up as a public form: every box tells the browser what it may fill it in with and a phone which keyboard to
 * show; what the browser fills in is the person's own, read as typed; and a bot check — a box no person sees, the
 * time the answers took, the app's captcha in its slot — told to the app with each response, never refused on the
 * page. Each engine's autofill is the one it sends: Chrome and Safari write a box whole with no key, then send input and
 * change; Firefox sends a beforeinput that cannot be stopped first.
 */

type Values = Record<string, unknown>;
const values = (page: Page) => page.evaluate(() => (window as any).fieldiaDemo.handle.form.getState().values as Values);
/** A field's own box: a phone's number box, past its country's list (the sign-up reads phones the world over). */
const box = (page: Page, id: string) => node(page, id).locator('.fd-phone-input, input:not(.fd-phone-select *), textarea, select:not(.fd-phone-select)').first();
const responses = (page: Page) => page.evaluate(() => (window as any).fieldiaDemo.dataSource.responses as { values: Values; bot?: Record<string, unknown> }[]);

/** What the browser does as a person picks a saved address in one box: each box it fills, written whole, as this engine writes it. */
async function autofill(page: Page, fills: Record<string, string>) {
  const engine = test.info().project.name;
  await page.evaluate(
    ([fills, engine]) => {
      for (const [id, text] of Object.entries(fills)) {
        // A phone's number box, not its country's list before it.
        const target = (document.querySelector(`[data-node="${id}"] .fd-phone-input`) ?? document.querySelector(`[data-node="${id}"] input, [data-node="${id}"] select`)) as HTMLInputElement;
        if (engine === 'firefox') target.dispatchEvent(new InputEvent('beforeinput', { inputType: 'insertReplacementText', data: text, cancelable: false, bubbles: true }));
        target.value = text;
        target.dispatchEvent(engine === 'firefox' ? new InputEvent('input', { inputType: 'insertReplacementText', data: text, bubbles: true }) : new InputEvent('input', { bubbles: true }));
        target.dispatchEvent(new Event('change', { bubbles: true }));
      }
    },
    [fills, engine] as const
  );
}

test.describe('the sign-up, filled in by the browser', () => {
  test('every box says what it holds, and the keyboard a phone shows', async ({ page }) => {
    await open(page, 'plain', 'page=signup&skin=outlined');
    await expect(box(page, 'f-name')).toHaveAttribute('autocomplete', 'name');
    await expect(box(page, 'f-email')).toHaveAttribute('autocomplete', 'email');
    await expect(box(page, 'f-email')).toHaveAttribute('inputmode', 'email');
    await expect(box(page, 'f-company')).toHaveAttribute('autocomplete', 'organization');
    await expect(box(page, 'f-phone')).toHaveAttribute('type', 'tel');
    await expect(box(page, 'f-phone')).toHaveAttribute('autocomplete', 'mobile tel');
    await expect(box(page, 'f-team')).toHaveAttribute('inputmode', 'numeric');
    await expect(box(page, 'f-rate')).toHaveAttribute('inputmode', 'decimal');
    // A box whose purpose only the page could name, and did not: the browser offers nothing there.
    await expect(box(page, 'f-other-role')).toHaveAttribute('autocomplete', 'off');
  });

  test('what the browser fills in from one pick is the person’s: read as typed, said where it does not fit, and sent', async ({ page }) => {
    const { demo } = await open(page, 'plain', 'page=signup&skin=outlined');
    // Picked in the name's box: the browser fills the others too, while the person is still in the name's.
    await box(page, 'f-name').click();
    await autofill(page, { 'f-name': 'Sara Hassan', 'f-email': ' sara@example.com', 'f-company': 'Nile Trading', 'f-phone': '+20 100 123 4567', 'f-rate': 'about 40' });
    // The phone read the world over: kept as one number, +201001234567, whatever way it was written.
    await expect.poll(() => values(page)).toMatchObject({ full_name: 'Sara Hassan', email: 'sara@example.com', company: 'Nile Trading', phone: '+201001234567', hourly_rate: null });
    await expect(box(page, 'f-email')).toHaveValue('sara@example.com');
    // A rate the box cannot read stays as filled in, and its field says why at once, as one typed in and left.
    await expect(box(page, 'f-rate')).toHaveValue('about 40');
    await expect(node(page, 'f-rate').locator(':scope > .fd-error')).toContainText('about 40');
    await screen(page, 'autofill-signup-filled');
    await box(page, 'f-rate').fill('40');
    await box(page, 'f-role').selectOption({ label: 'Designer' });
    await page.getByRole('button', { name: 'Submit' }).click();
    await expect(page.locator('.fd-done')).toBeVisible();
    const sent = await demo<{ values: Values }[]>('dataSource.responses');
    expect(sent[0].values).toMatchObject({ full_name: 'Sara Hassan', email: 'sara@example.com', company: 'Nile Trading', phone: '+201001234567', hourly_rate: 40, role: 'designer' });
  });
});

test.describe('Chrome’s own autofill', () => {
  // Chrome itself, not a stand-in: its full build fills a form through DevTools' Autofill.trigger (a card's details),
  // as it does when a person picks a saved card — a keydown, the box written whole, input and change, no beforeinput.
  test('fills a card in: each box read as typed, the person’s change, and sent', async ({ browserName }) => {
    test.skip(browserName !== 'chromium', 'Chrome’s own autofill is Chrome’s');
    const browser = await chromium.launch({ channel: 'chromium' });
    try {
      const page = await browser.newPage({ baseURL: test.info().project.use.baseURL });
      await page.goto('/script/');
      await page.waitForFunction(() => 'Fieldia' in window);
      await page.evaluate(() => {
        const W = window as any;
        document.body.replaceChildren();
        const host = document.createElement('div');
        document.body.append(host);
        const months = Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1).padStart(2, '0'), label: String(i + 1).padStart(2, '0') }));
        const own = (id: string, field: string, autocomplete: string) => ({ type: 'field', id, field, autocomplete });
        const page = {
          fieldia: '0.9',
          id: 'pay',
          title: 'Pay for the workshop',
          data: { kind: 'responses' },
          fields: {
            holder: { type: 'char', label: 'Name on the card', required: true },
            number: { type: 'char', label: 'Card number', required: true },
            month: { type: 'selection', label: 'Month', options: months },
            year: { type: 'char', label: 'Year', size: 4 },
            csc: { type: 'char', label: 'Security code', size: 4 },
          },
          layout: { type: 'sections', id: 'r', children: [{ type: 'section', id: 's', columns: 2, children: [own('f-number', 'number', 'cc-number'), own('f-holder', 'holder', 'cc-name'), own('f-month', 'month', 'cc-exp-month'), own('f-year', 'year', 'cc-exp-year'), own('f-csc', 'csc', 'cc-csc')] }] },
        };
        W.source = W.Fieldia.createMemoryDataSource();
        W.handle = W.Fieldia.mountViewer(host, { page, dataSource: W.source, skin: 'outlined' });
      });
      await expect(page.locator('[data-node="f-number"] input')).toHaveAttribute('inputmode', 'numeric');
      // The person picks a saved card in the number's box.
      await page.locator('[data-node="f-number"] input').click();
      const cdp = await page.context().newCDPSession(page);
      const { root } = await cdp.send('DOM.getDocument', { depth: -1 });
      const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: '[data-node="f-number"] input' });
      const { node: picked } = await cdp.send('DOM.describeNode', { nodeId });
      await cdp.send('Autofill.trigger', { fieldId: picked.backendNodeId, card: { number: '4444333322221111', name: 'Sara Hassan', expiryMonth: '04', expiryYear: '2030', cvc: '123' } } as never);
      const state = () => page.evaluate(() => {
        const now = (window as any).handle.form.getState();
        return { values: now.values, dirty: now.dirty };
      });
      await expect.poll(state).toEqual({ values: { holder: 'Sara Hassan', number: '4444333322221111', month: '04', year: '2030', csc: '123' }, dirty: ['holder', 'number', 'month', 'year', 'csc'] });
      await expect(page.locator('[data-node="f-holder"] input')).toHaveValue('Sara Hassan');
      await page.screenshot({ path: 'test-results/screens/autofill-chrome-card.png', animations: 'disabled' });
      await page.getByRole('button', { name: 'Submit' }).click();
      await expect(page.locator('.fd-done')).toBeVisible();
      expect(await page.evaluate(() => (window as any).source.responses[0].values)).toEqual({ holder: 'Sara Hassan', number: '4444333322221111', month: '04', year: '2030', csc: '123' });
    } finally {
      await browser.close();
    }
  });
});

test.describe('the sign-up’s bot check', () => {
  test('a box no person sees, reaches with Tab or hears read out', async ({ page }) => {
    await open(page, 'plain', 'page=signup&skin=outlined');
    const trap = page.locator('.fd-trap input');
    await expect(trap).toHaveCount(1);
    await expect(page.locator('.fd-trap')).toHaveAttribute('aria-hidden', 'true');
    await expect(page.locator('.fd-trap')).toHaveAttribute('inert', '');
    // Not in what a screen reader reads out.
    await expect(page.getByRole('textbox', { name: 'Leave this box empty' })).toHaveCount(0);
    // Nothing shows of it: a pixel, clipped away, the page drawn as it was.
    expect(await page.locator('.fd-trap').evaluate((el) => [el.getBoundingClientRect().width * el.getBoundingClientRect().height, getComputedStyle(el).overflow, getComputedStyle(el).opacity])).toEqual([1, 'hidden', '0']);
    // Never reached: not by Tab from the answers round it, nor by anything that would focus it.
    expect(await trap.evaluate((el: HTMLInputElement) => (el.focus(), document.activeElement === el))).toBe(false);
    await box(page, 'f-newsletter').focus();
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press('Tab');
      expect(await page.evaluate(() => !!document.activeElement?.closest('.fd-trap'))).toBe(false);
    }
  });

  test('a person, a bot that fills every box and one too fast: each sent, and the app told which', async ({ page }) => {
    // The clock the test moves: the time the answers took is the time it says, whatever this machine's load.
    const at = (seconds: number) => new Date(Date.UTC(2026, 9, 16, 9, 0, seconds));
    await page.clock.install({ time: at(0) });
    const { demo } = await open(page, 'plain', 'page=signup&skin=outlined');
    const fill = async () => {
      await box(page, 'f-name').fill('Sara Hassan');
      await box(page, 'f-email').fill('sara@example.com');
      await box(page, 'f-role').selectOption({ label: 'Designer' });
    };
    // A person: the captcha's stand-in ticked, the answers taking their time.
    await fill();
    await page.getByLabel('I am a person').check();
    await expect(page.locator('.demo-captcha-said')).toHaveText('Checked');
    await page.clock.setFixedTime(at(60));
    await screen(page, 'bot-check-signup');
    await page.getByRole('button', { name: 'Submit' }).click();
    await expect(page.locator('.fd-done')).toBeVisible();
    // Too fast, the captcha not ticked: sent all the same.
    await page.getByRole('button', { name: 'Submit another response' }).click();
    await fill();
    await page.getByRole('button', { name: 'Submit' }).click();
    await expect(page.locator('.fd-done')).toBeVisible();
    // A bot that writes every box it finds, the hidden one too, without a key.
    await page.getByRole('button', { name: 'Submit another response' }).click();
    await page.clock.setFixedTime(at(70));
    await fill();
    await page.locator('.fd-trap input').evaluate((el: HTMLInputElement) => (el.value = 'https://spam.example'));
    await page.getByRole('button', { name: 'Submit' }).click();
    await expect(page.locator('.fd-done')).toBeVisible();
    const bots = (await demo<{ bot: Record<string, unknown> }[]>('dataSource.responses')).map((response) => response.bot);
    expect(bots).toEqual([
      { honeypot: false, tooFast: false, seconds: expect.any(Number), captcha: expect.stringMatching(/^demo\./) },
      { honeypot: false, tooFast: true, seconds: 0, captcha: null },
      { honeypot: true, tooFast: false, seconds: 10, captcha: null },
    ]);
    // Under the form, what the app was told with each, in words — the report itself under Details.
    const told = page.locator('.demo-bot-log li');
    await expect(told).toHaveCount(3);
    await expect(told.locator('> p')).toHaveText([
      /^Looks like a person: sent [\d.]+ s after the page opened; the captcha was ticked\.$/,
      'Looks like a bot: sent 0 s after the page opened, sooner than a person can; the captcha was not ticked.',
      'Looks like a bot: a hidden field was filled, which no person sees; sent 10 s after the page opened; the captcha was not ticked.',
    ]);
    await expect(told.nth(2).locator('code')).toBeHidden();
    await told.nth(2).getByText('Details').click();
    await expect(told.nth(2).locator('code')).toBeVisible();
    await expect(told.nth(2).locator('code')).toContainText('"honeypot":true');
    await screen(page, 'bot-check-told');
  });
});
