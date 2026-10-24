import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { screen } from './support';

/**
 * What Fieldia keeps in the browser is a person's (audit R-H5, R-M9, S-M4, S-M5, S-L4), as a shared tablet at a clinic's
 * front desk meets it: Mona's draft is kept under her name — never her PIN — and Karim, signed in next on the same
 * browser, is offered nothing of hers; Mona, back, is offered hers; and at sign-out `drafts.clear` lets hers go.
 */

const CONSENT = {
  fieldia: '0.11',
  id: 'clinic-consent',
  title: 'Consent',
  data: { kind: 'responses' },
  fields: { patient: { type: 'char', label: 'Patient' }, pin: { type: 'char', label: 'PIN' }, national_id: { type: 'char', label: 'National ID', secret: true } },
  layout: {
    type: 'sections',
    id: 'root',
    children: [
      { type: 'field', id: 'f-p', field: 'patient' },
      { type: 'field', id: 'f-pin', field: 'pin', widget: 'password' },
      { type: 'field', id: 'f-id', field: 'national_id' },
    ],
  },
};

/** The one-tag demo's page replaced by the consent, kept in the browser's localStorage as the person signed in. */
async function signIn(page: Page, user: string | null) {
  await page.evaluate(
    ([shown, who]) => {
      const fieldia = (window as any).Fieldia;
      const demo = (window as any).fieldiaDemo;
      demo.handle.destroy();
      demo.handle = fieldia.mountViewer(document.getElementById('app'), {
        page: shown,
        dataSource: fieldia.createMemoryDataSource(),
        drafts: { store: localStorage, restore: 'ask', delayMs: 50 },
        ...(who ? { user: { id: who, name: who } } : {}),
        skin: 'outlined',
      });
    },
    [CONSENT, user] as const
  );
  await expect(page.locator('#app [data-node="f-p"] input')).toBeVisible();
}

const drafts = (page: Page) => page.evaluate(() => Object.entries(localStorage).filter(([key]) => key.startsWith('fieldia:draft:')));

test('a shared browser: Mona’s draft is hers — never her PIN — Karim is offered nothing of it, and sign-out lets it go', async ({ page }) => {
  await page.goto('/script/');
  await expect(page.locator('#app .fd-form')).toBeVisible();
  await signIn(page, 'mona');
  await page.locator('#app [data-node="f-p"] input').fill('Mona Adel');
  await page.locator('#app [data-node="f-pin"] input').fill('4321');
  await page.locator('#app [data-node="f-id"] input').fill('29001011234567');
  await expect.poll(async () => (await drafts(page)).length).toBe(1);
  const [[key, kept]] = await drafts(page);
  expect(key).toBe('fieldia:draft:u:mona:clinic-consent:new');
  expect(kept).toContain('Mona Adel');
  expect(kept).not.toContain('4321');
  expect(kept).not.toContain('29001011234567');
  // Karim signs in on the same browser: nothing of Mona's offered.
  await signIn(page, 'karim');
  await expect(page.locator('#app .fd-draft')).toBeHidden();
  await expect(page.locator('#app [data-node="f-p"] input')).toHaveValue('');
  await screen(page, 'kept-by-person-karim');
  // Mona, back: hers offered, restored without the PIN.
  await signIn(page, 'mona');
  await expect(page.locator('#app .fd-draft')).toBeVisible();
  await page.locator('#app .fd-draft').getByRole('button', { name: 'Restore' }).click();
  await expect(page.locator('#app [data-node="f-p"] input')).toHaveValue('Mona Adel');
  await expect(page.locator('#app [data-node="f-pin"] input')).toHaveValue('');
  // Sign-out: the form gone, hers let go.
  await page.evaluate(() => {
    (window as any).fieldiaDemo.handle.destroy();
    (window as any).Fieldia.drafts.clear({ user: 'mona' });
  });
  expect(await drafts(page)).toEqual([]);
});
