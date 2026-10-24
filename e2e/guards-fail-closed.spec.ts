import { type Page, type Route } from '@playwright/test';
import { expect, test } from './fixtures';
import { screen } from './support';

/**
 * A part that guards a send fails closed (audit R-H1): from the one tag, each part a script of its own beside
 * fieldia.js. Where one that guards the send — a payment, a code check, a time limit's clock, a link's hidden fields,
 * options by condition, a text's languages, a page's limits, a record's approvals — cannot come (offline), or comes as
 * another version's (a cached fieldia.js beside a fresh part), the page is drawn all the same and keeps what is typed,
 * and Submit sends nothing: it asks for the part once more, then says which could not load, with Retry — which, the
 * part come by then, sends through it.
 */

const name = { type: 'char', label: 'Your name', required: true };
const responses = (more: Record<string, unknown>, fields: Record<string, unknown> = {}, nodes: object[] = []) => ({
  fieldia: '0.11',
  id: 'enquiry',
  title: 'Enquiry',
  data: { kind: 'responses' },
  fields: { name, ...fields },
  layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'f-name', field: 'name' }, ...nodes] },
  ...more,
});

const CASES: { part: string; page: object; words: string; url?: string }[] = [
  { part: 'pay', page: responses({ payment: { label: 'Reservation fee', amount: 500, currency: 'EGP' } }), words: 'The payment step could not load, so nothing was sent. Try again.' },
  {
    part: 'verify',
    page: responses({}, { phone: { type: 'char', label: 'Mobile' } }, [{ type: 'field', id: 'f-phone', field: 'phone', widget: 'phone', options: { verify: true } }]),
    words: 'The code check could not load, so nothing was sent. Try again.',
  },
  { part: 'surveyflow', page: responses({ timeLimit: { minutes: 10 } }), words: 'The time limit could not load, so nothing was sent. Try again.' },
  { part: 'prefill', page: responses({ prefill: { fromUrl: ['agent_code'] } }, { agent_code: { type: 'char', label: 'Agent' } }), words: 'The answers from the link could not load, so nothing was sent. Try again.' },
  {
    part: 'options',
    page: responses({}, { extras: { type: 'selection', label: 'Extras', multiple: true, options: [{ value: 'garden', label: 'Garden', invisible: "name != 'villa'" }, { value: 'lift', label: 'Lift' }] } }, [
      { type: 'field', id: 'f-extras', field: 'extras' },
    ]),
    words: 'The check of the choices could not load, so nothing was sent. Try again.',
  },
  { part: 'limits', page: responses({ limits: { closes: '2099-11-20' } }), words: 'The check of whether this form takes answers could not load, so nothing was sent. Try again.' },
];

/** A part's script answered as the network would: never, or as another version's part. */
const offline = (route: Route) => route.abort('internetdisconnected');
const anotherVersion = (part: string) => (route: Route) => route.fulfill({ contentType: 'text/javascript', body: `(self.FieldiaParts ??= []).push(['${part}', '0.0.1', () => ({})]);` });

/** The one-tag demo's page replaced by this one, on a memory source that pays, sends codes and keeps responses. */
async function mount(page: Page, shown: object) {
  await page.goto('/script/');
  await expect(page.locator('#app .fd-form')).toBeVisible();
  await page.evaluate((one) => {
    const fieldia = (window as any).Fieldia;
    const demo = (window as any).fieldiaDemo;
    demo.handle.destroy();
    demo.dataSource = fieldia.createMemoryDataSource();
    demo.handle = fieldia.mountViewer(document.getElementById('app'), { page: one, dataSource: demo.dataSource, skin: 'outlined' });
  }, shown);
  await expect(page.locator('#app [data-node="f-name"] input')).toBeVisible();
}

const sent = (page: Page) => page.evaluate(() => (window as any).fieldiaDemo.dataSource.responses.length as number);
const status = (page: Page) => page.locator('#app .fd-status');

test.describe('a part that guards a send, from the one tag', () => {
  for (const one of CASES) {
    test(`${one.part}: never come — the page drawn, the typing kept, nothing sent, said with Retry`, async ({ page }) => {
      const asked: string[] = [];
      page.on('request', (request) => {
        if (request.url().endsWith(`/fieldia.${one.part}.js`)) asked.push(request.url());
      });
      await page.route(`**/fieldia.${one.part}.js`, offline);
      await mount(page, one.page);
      const box = page.locator('#app [data-node="f-name"] input');
      await box.fill('Hana Fouad');
      await page.getByRole('button', { name: 'Submit', exact: true }).click();
      await expect(status(page)).toHaveText(one.words);
      await expect(page.locator('#app .fd-status-box .fd-retry')).toBeVisible();
      await expect(box).toHaveValue('Hana Fouad');
      expect(await sent(page)).toBe(0);
      // Asked for as the page was drawn, and once more as Submit was pressed.
      expect(asked.length).toBeGreaterThanOrEqual(2);
      if (one.part === 'pay') await screen(page, 'guards-pay-never-came');
    });
  }

  test("approvals: never come — a record's Save saves nothing, said with Retry", async ({ page }) => {
    await page.route('**/fieldia.approvals.js', offline);
    await page.goto('/script/');
    await expect(page.locator('#app .fd-form')).toBeVisible();
    await page.evaluate(() => {
      const fieldia = (window as any).Fieldia;
      const demo = (window as any).fieldiaDemo;
      demo.handle.destroy();
      demo.dataSource = fieldia.createMemoryDataSource({
        records: { 'purchase.order': { 1: { name: 'Nile Office Supply' } } },
        approvals: { 'purchase.order': () => ({ levels: [{ id: 'finance', name: 'Finance', approvers: [{ id: 21, name: 'Mona Adel' }] }], asked: false }) },
      });
      const shown = { fieldia: '0.11', id: 'po', title: 'Purchase order', data: { kind: 'record', model: 'purchase.order' }, approval: {}, fields: { name: { type: 'char', label: 'Vendor' } }, layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'f-name', field: 'name' }] } };
      demo.handle = fieldia.mountViewer(document.getElementById('app'), { page: shown, dataSource: demo.dataSource, recordId: 1, skin: 'outlined' });
    });
    const box = page.locator('#app [data-node="f-name"] input');
    await expect(box).toHaveValue('Nile Office Supply');
    await box.fill('Nile Office Supply Co');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(status(page)).toHaveText('The approvals could not load, so nothing was saved. Try again.');
    await expect(box).toHaveValue('Nile Office Supply Co');
    const saves = await page.evaluate(() => (window as any).fieldiaDemo.dataSource.calls.filter((call: { method: string }) => call.method === 'save').length);
    expect(saves).toBe(0);
  });

  test('a part of another version is refused as never come: nothing is sent', async ({ page }) => {
    await page.route('**/fieldia.pay.js', anotherVersion('pay'));
    await mount(page, CASES[0].page);
    await page.locator('#app [data-node="f-name"] input').fill('Hana Fouad');
    await page.getByRole('button', { name: 'Submit', exact: true }).click();
    await expect(status(page)).toHaveText('The payment step could not load, so nothing was sent. Try again.');
    expect(await sent(page)).toBe(0);
  });

  test('Retry, the part come by then, sends through it: the fee taken and carried', async ({ page }) => {
    let failing = true;
    await page.route('**/fieldia.pay.js', (route) => (failing ? offline(route) : route.continue()));
    await mount(page, CASES[0].page);
    await page.locator('#app [data-node="f-name"] input').fill('Hana Fouad');
    await page.getByRole('button', { name: 'Submit', exact: true }).click();
    await expect(status(page)).toHaveText('The payment step could not load, so nothing was sent. Try again.');
    failing = false;
    await page.locator('#app .fd-status-box .fd-retry').click();
    // The page was drawn without its payment step: the source's own pay takes the fee, and the answers carry it.
    await expect(page.locator('#app .fd-done')).toBeVisible();
    const response = await page.evaluate(() => (window as any).fieldiaDemo.dataSource.responses[0]);
    expect(response.payment).toMatchObject({ amount: 500, currency: 'EGP' });
  });
});
