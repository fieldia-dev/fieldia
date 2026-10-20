import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { type Locator, type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { expectNoSidewaysScroll, node, open, screen } from './support';
import { axeFindings } from './a11y-support';

/**
 * A clinic's consent to treatment, signed as a patient signs it (`options.signs` on its signature): the answers given,
 * the pad signed with the mouse, and under it who signed and when, and that the answers are as they were signed — the
 * fingerprint of the answers kept with the signature, made again from them. Signed, the answers are locked; Change
 * answers asks, then takes the signature away to sign again. An answer not yet given is said before anything is
 * signed. A consent kept is opened with its evidence; one changed in the clinic's system after it was signed says so.
 */

const WIDE = { width: 1280, height: 900 };
const PHONE = { width: 390, height: 844 };
const NOW = '2026-10-19T08:42:00.000Z';
test.use({ timezoneId: 'Africa/Cairo' });

const state = (page: Page) => page.evaluate(() => (window as any).fieldiaDemo.handle.form.getState());
const stored = (page: Page, id: number) => page.evaluate((i) => (window as any).fieldiaDemo.dataSource.records['clinic.consent'][i] ?? null, id);
const sign = (page: Page) => node(page, 'f-signature');
const evidence = (page: Page) => sign(page).locator('.fd-signature-evidence');
const sha = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex');

/** The pad signed at hand speed: a press, a few strokes' moves, a release. */
async function draw(page: Page, pad: Locator) {
  await pad.scrollIntoViewIfNeeded();
  const box = (await pad.boundingBox())!;
  await page.mouse.move(box.x + 30, box.y + box.height * 0.7);
  await page.mouse.down();
  for (const [x, y] of [[0.2, 0.35], [0.3, 0.75], [0.42, 0.3], [0.55, 0.7], [0.7, 0.4], [0.85, 0.6]]) await page.mouse.move(box.x + box.width * x, box.y + box.height * y, { steps: 6 });
  await page.mouse.up();
}

/** A new consent's answers, as the patient gives them. */
async function answer(page: Page, more: { treatment?: string } = {}) {
  await page.locator('[data-node="#title"] textarea').fill('Mona Adel');
  const birth = node(page, 'f-birth').locator('input');
  await birth.fill('12/04/1991');
  await birth.press('Tab');
  if (more.treatment !== '') await node(page, 'f-treatment').locator('select').selectOption({ label: more.treatment ?? 'Anti-wrinkle injections' });
  await node(page, 'f-areas').getByRole('checkbox', { name: 'Forehead' }).check();
  await node(page, 'f-risks').getByRole('checkbox').check();
}

let problems: string[] = [];
test.afterEach(() => expect(problems).toEqual([]));

test.describe('a consent signed, with its evidence', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(WIDE);
    ({ problems } = await open(page, 'plain', `page=clinic-consent&record=new&skin=outlined&now=${NOW}`));
  });

  test('signed on the pad: who and when said under it, the answers as signed, their fingerprint kept with it', async ({ page }) => {
    await answer(page);
    await draw(page, sign(page).locator('canvas'));
    await expect(evidence(page).locator('.fd-signature-who')).toHaveText('Signed by Mona Adel, 19 Oct 2026, 11:42');
    await expect(evidence(page).locator('.fd-signature-state')).toHaveText('✓The answers are as they were signed.');
    await screen(page, 'signature-evidence-signed');
    const signed = (await state(page)).values.signature.signed;
    expect(signed).toEqual({ format: 'fieldia-signature/1', by: 'Mona Adel', at: NOW, fields: ['patient', 'birth_date', 'treatment', 'areas', 'pregnant', 'allergies', 'risks_read', 'photos'], sha256: expect.any(String) });
    // The fingerprint is the documented text's SHA-256, as an app writes it again from the record it keeps.
    const text = `{"answers":{"allergies":null,"areas":["forehead"],"birth_date":"1991-04-12","patient":"Mona Adel","photos":false,"pregnant":false,"risks_read":true,"treatment":"botox"},"at":"${NOW}","by":"Mona Adel","field":"signature","format":"fieldia-signature/1","page":"clinic-consent"}`;
    expect(signed.sha256).toBe(sha(text));
    // Saved — its picture to the store — the evidence stays with the signature.
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect.poll(async () => (await state(page)).recordId).toBe(3);
    expect((await stored(page, 3)).signature).toMatchObject({ fileId: expect.any(Number), signed });
    await page.reload();
    await expect(evidence(page).locator('.fd-signature-state')).toHaveText('✓The answers are as they were signed.');
  });

  test('signed, the answers are locked, the lock saying how; Change answers asks, then takes the signature away', async ({ page }) => {
    await answer(page);
    await draw(page, sign(page).locator('canvas'));
    await expect(evidence(page)).toBeVisible();
    const treatment = node(page, 'f-treatment');
    await expect(treatment.locator('select')).toBeDisabled();
    await expect(node(page, 'f-areas').getByRole('checkbox', { name: 'Lips' })).toBeDisabled();
    // An answer the signature does not sign stays open.
    await expect(node(page, 'f-notes').locator('textarea')).toBeEditable();
    await treatment.locator('.fd-lock').first().hover();
    await expect(treatment.getByRole('tooltip')).toHaveText('Signed. To change it, press Change answers under the signature.');
    await screen(page, 'signature-evidence-locked', { viewport: true });
    // Asked first, in place: Keep keeps it.
    await sign(page).getByRole('button', { name: 'Change answers' }).click();
    const ask = sign(page).locator('.fd-signature-ask');
    await expect(ask).toContainText('Change your answers? The signature is taken away, and you sign again once they are right.');
    await expect(ask.getByRole('button', { name: 'Keep' })).toBeFocused();
    await screen(page, 'signature-evidence-ask', { viewport: true });
    await page.keyboard.press('Escape');
    await expect(ask).toBeHidden();
    await expect(treatment.locator('select')).toBeDisabled();
    await sign(page).getByRole('button', { name: 'Change answers' }).click();
    await ask.getByRole('button', { name: 'Change answers' }).click();
    await expect(sign(page).locator('.fd-signature-note')).toHaveText('Signature taken away: change your answers, then sign again.');
    await expect(evidence(page)).toBeHidden();
    expect((await state(page)).values.signature).toBeNull();
    // Open again: changed, and signed again.
    await treatment.locator('select').selectOption({ label: 'Chemical peel' });
    await draw(page, sign(page).locator('canvas'));
    await expect(evidence(page).locator('.fd-signature-state')).toHaveText('✓The answers are as they were signed.');
    expect((await state(page)).values.signature.signed.sha256).not.toBe('');
    await expect(treatment.locator('select')).toBeDisabled();
  });

  test('signed before an answer is given: it says which to put right, signs nothing, and keeps what was drawn', async ({ page }) => {
    await answer(page, { treatment: '' });
    await draw(page, sign(page).locator('canvas'));
    await expect(sign(page).locator('.fd-signature-note')).toHaveText('Not signed yet: first put right Treatment, then sign again.');
    expect((await state(page)).values.signature).toBeNull();
    await expect(sign(page).getByRole('button', { name: 'Clear' })).toBeVisible();
    await expect(node(page, 'f-treatment').locator('select')).toBeEnabled();
    await screen(page, 'signature-evidence-not-yet', { viewport: true });
    await node(page, 'f-treatment').locator('select').selectOption({ label: 'Dermal filler' });
    await draw(page, sign(page).locator('canvas'));
    await expect(evidence(page).locator('.fd-signature-who')).toHaveText('Signed by Mona Adel, 19 Oct 2026, 11:42');
    await expect(sign(page).locator('.fd-signature-note')).toBeHidden();
  });

  test('a name typed instead of drawn signs the same', async ({ page }) => {
    await answer(page);
    await sign(page).getByLabel('Or type your name').fill('Mona Adel');
    await expect(evidence(page).locator('.fd-signature-state')).toHaveText('✓The answers are as they were signed.');
    expect((await state(page)).values.signature).toMatchObject({ text: 'Mona Adel', signed: { by: 'Mona Adel' } });
  });

  test('on a phone: the evidence wraps under the signature, nothing scrolls sideways', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await answer(page);
    await draw(page, sign(page).locator('canvas'));
    await expect(evidence(page).locator('.fd-signature-state')).toBeVisible();
    await expectNoSidewaysScroll(page);
    await sign(page).scrollIntoViewIfNeeded();
    await screen(page, 'signature-evidence-phone', { viewport: true });
  });
});

test.describe('a consent signed, read by everyone', () => {
  for (const scheme of ['light', 'dark']) {
    test(`its evidence, a signed answer's lock, its question and a changed answer pass axe · ${scheme}`, async ({ page }) => {
      await page.setViewportSize(WIDE);
      ({ problems } = await open(page, 'plain', `page=clinic-consent&record=new&skin=outlined&scheme=${scheme}&now=${NOW}`));
      await answer(page);
      await draw(page, sign(page).locator('canvas'));
      await expect(evidence(page).locator('.fd-signature-state')).toBeVisible();
      expect(await axeFindings(page, 'signed')).toEqual([]);
      await sign(page).getByRole('button', { name: 'Change answers' }).click();
      expect(await axeFindings(page, 'asked')).toEqual([]);
      await page.goto(`/plain/?page=clinic-consent&record=2&skin=outlined&scheme=${scheme}`);
      await expect(evidence(page).locator('.fd-signature-state[data-changed]')).toBeVisible();
      expect(await axeFindings(page, 'changed after')).toEqual([]);
    });
  }
});

test.describe('a consent whose signing could not load', () => {
  /** What a blocked script tells the console: the test's own doing. */
  const blockedSaid = /evidence|Failed to load resource|dynamically imported module|module script failed|ERR_FAILED|could not be loaded/i;

  test('in an app of modules: says so under the signature, a reload — never a Try again that cannot work — and a save refuses it', async ({ page }) => {
    await page.setViewportSize(WIDE);
    // The signing's part refused, as offline or with its script blocked. An app bundled as modules (this demo): the
    // browser keeps a module it could not fetch for the page's life, so only a reload brings it — and that is said.
    await page.route(/\/evidence-part-[^/]*\.js(\?.*)?$/, (route) => route.abort());
    ({ problems } = await open(page, 'plain', `page=clinic-consent&record=new&skin=outlined&now=${NOW}`));
    await answer(page);
    await draw(page, sign(page).locator('canvas'));
    const note = sign(page).locator('.fd-signature-unloaded');
    await expect(note).toHaveText('Not signed yet: the signing could not load. Reload the page to sign.');
    await expect(note).toHaveAttribute('role', 'alert');
    await expect(note.getByRole('button')).toHaveCount(0);
    // The picture kept on the pad and in the field — never signed in silence.
    await expect(sign(page).locator('canvas')).toBeVisible();
    expect((await state(page)).values.signature).toMatchObject({ name: 'signature.png', type: 'image/png' });
    expect((await state(page)).values.signature.signed).toBeUndefined();
    // A save refuses it, saying why under it.
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(sign(page).locator('.fd-error')).toHaveText('Not signed yet: the signing could not load. Reload the page to sign.');
    expect((await state(page)).recordId).toBeNull();
    await sign(page).scrollIntoViewIfNeeded();
    await screen(page, 'signature-evidence-unloaded-reload', { viewport: true });
    problems = problems.filter((said) => !blockedSaid.test(said));
  });

  test('with one script tag, Try again loads the part once it can come: signed, and saved', async ({ page }) => {
    await page.setViewportSize(WIDE);
    problems = [];
    page.on('pageerror', (error) => problems.push(error.message));
    page.on('console', (message) => message.type() === 'error' && problems.push(message.text()));
    let blocked = true;
    await page.route(/\/fieldia\.evidence\.js(\?.*)?$/, (route) => (blocked ? route.abort() : route.continue()));
    // fieldia.js and its parts from beside it (the script demo's folder), the consent mounted on that page.
    await page.goto('/script/');
    await expect(page.locator('.fd-form').first()).toBeVisible();
    const consent = JSON.parse(readFileSync('examples/pages/clinic-consent.page.json', 'utf8'));
    await page.evaluate(
      ([given, now]) => {
        const host = document.createElement('div');
        host.id = 'consent';
        document.body.append(host);
        const fieldia = (window as any).Fieldia;
        (window as any).consent = fieldia.mountViewer(host, { page: given, dataSource: fieldia.createMemoryDataSource(), now: () => new Date(now as string) });
      },
      [consent, NOW]
    );
    const host = page.locator('#consent');
    const signature = host.locator('[data-node="f-signature"]');
    await expect(signature.locator('canvas')).toBeVisible();
    await answer(page);
    await draw(page, signature.locator('canvas'));
    const note = signature.locator('.fd-signature-unloaded');
    await expect(note).toHaveText('Not signed yet: the signing could not load. Try again');
    await signature.scrollIntoViewIfNeeded();
    await screen(page, 'signature-evidence-unloaded-try-again', { viewport: true });
    const shown = () => page.evaluate(() => (window as any).consent.form.getState());
    expect((await shown()).values.signature.signed).toBeUndefined();
    await host.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(signature.locator('.fd-error')).toHaveText('Not signed yet: the signing could not load.');
    // Back online: Try again asks for fieldia.evidence.js once more — a script tag of its own — and the picture is signed.
    blocked = false;
    await note.getByRole('button', { name: 'Try again' }).click();
    await expect(signature.locator('.fd-signature-state')).toHaveText('✓The answers are as they were signed.');
    await expect(note).toBeHidden();
    await expect(signature.locator('.fd-error')).toBeHidden();
    expect((await shown()).values.signature.signed).toMatchObject({ by: 'Mona Adel', at: NOW });
    await host.getByRole('button', { name: 'Save', exact: true }).click();
    await expect.poll(async () => (await shown()).recordId).not.toBeNull();
    problems = problems.filter((said) => !blockedSaid.test(said));
  });
});

test.describe('a consent kept', () => {
  test.beforeEach(async ({ page }) => page.setViewportSize(WIDE));

  test('opens with its evidence: signed on its day, its answers as signed, and locked', async ({ page }) => {
    ({ problems } = await open(page, 'plain', 'page=clinic-consent&record=1&skin=outlined'));
    await expect(evidence(page).locator('.fd-signature-who')).toHaveText('Signed by Mona Adel, 14 Oct 2026, 10:42');
    await expect(evidence(page).locator('.fd-signature-state')).toHaveText('✓The answers are as they were signed.');
    await expect(node(page, 'f-treatment').locator('select')).toBeDisabled();
    await expect(node(page, 'f-notes').locator('textarea')).toBeEditable();
  });

  test('says an answer changed after it was signed: Cheeks added in the clinic’s system', async ({ page }) => {
    ({ problems } = await open(page, 'plain', 'page=clinic-consent&record=2&skin=outlined'));
    const said = evidence(page).locator('.fd-signature-state');
    await expect(said).toHaveText('⚠An answer has changed since it was signed.');
    await expect(said).toHaveAttribute('data-changed', '');
    await sign(page).scrollIntoViewIfNeeded();
    await screen(page, 'signature-evidence-changed', { viewport: true });
    // Signed again, the answers as they are now are the ones signed.
    await sign(page).getByRole('button', { name: 'Change answers' }).click();
    await sign(page).locator('.fd-signature-ask').getByRole('button', { name: 'Change answers' }).click();
    await draw(page, sign(page).locator('canvas'));
    await expect(said).toHaveText('✓The answers are as they were signed.');
  });
});
