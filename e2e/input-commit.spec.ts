import { type Locator, type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { mapOf, mapReady, stubMaps } from './map-support';
import { node, open, screen } from './support';

/**
 * Every way a value is committed reads what is still typed, typed as a person
 * types — keys one at a time, a real Ctrl+V, Enter, Ctrl+Enter — in English,
 * Arabic right to left and French, on the plain demo and once on React: a
 * place's coordinate that does not read stops the save (never a place saved
 * half new); a link's name still being looked up is waited for, and the record
 * it names is what is saved (never the one it was replacing), or the save is
 * refused with why; a paste made where keys wait after a refused one joins
 * them, so the save refuses all of it with its words. The sweep these check is
 * docs/plans/input-rules.md.
 */

// The clipboard is the browser's, one for every page a worker has open: these tests take turns with it.
test.describe.configure({ mode: 'default' });

const LOCALES = [
  ['en', ''],
  ['ar', '&locale=ar&dir=rtl'],
  ['fr', '&locale=fr'],
] as const;

const form = (page: Page) => page.evaluate(() => {
  const state = (window as any).fieldiaDemo.handle.form.getState();
  return { recordId: state.recordId, unread: state.unread, errors: state.errors, status: state.status };
});
const stored = (page: Page, model: string, field: string) =>
  page.evaluate(([m, f]) => {
    const demo = (window as any).fieldiaDemo;
    return demo.dataSource.records[m][demo.handle.form.getState().recordId ?? 1][f];
  }, [model, field] as const);
const labelOf = (value: unknown) => (value as { label?: string } | null)?.label ?? null;
const errorOf = (page: Page, id: string) => node(page, id).locator('.fd-error').first();
const saves = (page: Page) => page.evaluate(() => ((window as any).fieldiaDemo.dataSource.calls ?? []).filter((c: { method: string }) => c.method === 'save').length);

/** A box entered as a person enters it, its text all chosen so typing replaces it. */
async function enter(box: Locator) {
  await box.click();
  await box.press('Control+A');
}

/** Text put on the clipboard, then pasted with Ctrl+V. */
async function paste(page: Page, box: Locator, text: string) {
  await page.evaluate((t) => navigator.clipboard.writeText(t), text);
  await box.press('Control+V');
}

for (const [locale, query] of LOCALES) {
  test.describe(`${locale}: every save reads what is still typed`, () => {
    let problems: string[] = [];
    test.beforeEach(async ({ context }) => {
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    });
    test.afterEach(() => expect(problems).toEqual([]));

    test('a coordinate that does not read stops Ctrl+Enter and Save: the place is never saved half new', async ({ page }) => {
      await stubMaps(page);
      ({ problems } = await open(page, 'plain', `page=map-home&skin=outlined${query}`));
      await mapReady(mapOf(page, 'f-place'));
      const [lat, lng] = [node(page, 'f-place').locator('.fd-map-coords input').nth(0), node(page, 'f-place').locator('.fd-map-coords input').nth(1)];
      const before = { lat: await stored(page, 'home', 'lat'), lng: await stored(page, 'home', 'lng') };
      await enter(lat);
      await lat.pressSequentially(locale === 'fr' ? '31,2' : '31.2');
      await enter(lng);
      // The "x" is refused, the "5" after it held with it: "29.9x5" is what was typed, and it is no coordinate.
      await lng.pressSequentially(locale === 'fr' ? '29,9x5' : '29.9x5');
      await lng.press('Control+Enter');
      await expect.poll(async () => (await form(page)).unread['lat']?.text ?? '').toContain('x5');
      expect({ lat: await stored(page, 'home', 'lat'), lng: await stored(page, 'home', 'lng') }).toEqual(before);
      await expect(errorOf(page, 'f-place')).not.toHaveText('');
      await expect(lng).toHaveValue(locale === 'fr' ? '29,9x5' : '29.9x5');
      await screen(page, `input-commit-coordinate-${locale}`, { viewport: true });
      // The Save button, pressed: refused again, with the same words; nothing saved.
      await page.locator('.fd-form button[type="submit"].fd-button-primary').first().click();
      await expect.poll(async () => (await form(page)).status).not.toBe('saving');
      expect({ lat: await stored(page, 'home', 'lat'), lng: await stored(page, 'home', 'lng') }).toEqual(before);
      // Put right, both coordinates are saved together.
      await enter(lng);
      await lng.pressSequentially(locale === 'fr' ? '29,95' : '29.95');
      await lng.press('Control+Enter');
      await expect.poll(() => stored(page, 'home', 'lng')).toBe(29.95);
      expect(await stored(page, 'home', 'lat')).toBe(31.2);
    });

    test('Ctrl+Enter while a link’s name is still looked up saves the record it names; a name of none is refused', async ({ page }) => {
      ({ problems } = await open(page, 'plain', `page=fields&skin=outlined${query}`));
      const client = node(page, 'f-client').locator('input[role="combobox"]');
      expect(labelOf(await stored(page, 'project', 'client_id'))).toBe('Nile Traders');
      await enter(client);
      await client.pressSequentially('Bayt Interiors');
      // Pressed straight after the last key: the list for these words may not have come.
      await client.press('Control+Enter');
      await expect.poll(async () => labelOf(await stored(page, 'project', 'client_id'))).toBe('Bayt Interiors');
      await expect(client).toHaveValue('Bayt Interiors');

      await enter(client);
      await client.pressSequentially('Narnia');
      await client.press('Control+Enter');
      await expect.poll(async () => (await form(page)).errors['client_id'] ?? '').toContain('Narnia');
      expect(labelOf(await stored(page, 'project', 'client_id'))).toBe('Bayt Interiors');
      await expect(client).toHaveValue('Narnia');
      await expect(errorOf(page, 'f-client')).toContainText('Narnia');
      await screen(page, `input-commit-link-${locale}`, { viewport: true });

      // Enter picks the only match, as in 0.20, and Ctrl+Enter then saves it.
      await enter(client);
      await client.pressSequentially('zamalek');
      await client.press('Enter');
      await expect(client).toHaveValue('Zamalek Studio');
      await client.press('Control+Enter');
      await expect.poll(async () => labelOf(await stored(page, 'project', 'client_id'))).toBe('Zamalek Studio');
    });

    test('a paste where keys wait after a refused one joins them: Ctrl+Enter refuses all of it, with why', async ({ page }) => {
      ({ problems } = await open(page, 'plain', `page=fields&skin=outlined${query}`));
      const before = { email: await stored(page, 'project', 'email'), phone: await stored(page, 'project', 'phone'), seats: await stored(page, 'project', 'seats') };
      const count = await saves(page);
      for (const [id, field, typed, pasted, whole] of [
        ['f-email', 'email', 'ahmed ', 'ali@example.com', 'ahmed ali@example.com'],
        ['f-phone', 'phone', '0100 5o', '55 1234', '0100 5o55 1234'],
        ['f-seats', 'seats', '1x', '5', '1x5'],
      ] as const) {
        const box = node(page, id).locator(id === 'f-seats' ? 'input.fd-number-input' : 'input').first();
        await enter(box);
        await box.pressSequentially(typed);
        await paste(page, box, pasted);
        // Said again, with the same words as the refused key.
        await expect(node(page, id).locator('.fd-refusal-hint:not([hidden])')).toHaveCount(1);
        await box.press('Control+Enter');
        // All of it is what was typed: a text box's value, which its check refuses; a number's text, kept unread.
        await expect.poll(async () => (await form(page)).errors[field] ?? '', `${id} refused`).not.toBe('');
        if (field === 'seats') expect((await form(page)).unread[field]?.text).toBe(whole);
        await expect(box).toHaveValue(whole);
        await expect(errorOf(page, id)).not.toHaveText('');
        expect(await stored(page, 'project', field)).toBe(before[field]);
        // Put back as it was, so the next box's save is refused by its own text only.
        await enter(box);
        await box.press('Escape');
        await box.fill('');
        await box.blur();
        await page.evaluate(([f, v]) => {
          const demo = (window as any).fieldiaDemo;
          demo.handle.form.setUnread(f, null);
          demo.handle.form.setValue(f, v);
        }, [field, before[field]] as const);
      }
      expect(await saves(page)).toBe(count);
    });
  });
}

test.describe('react: every save reads what is still typed', () => {
  let problems: string[] = [];
  test.afterEach(() => expect(problems).toEqual([]));

  test('Ctrl+Enter while a link’s name is still looked up saves the record it names', async ({ page }) => {
    ({ problems } = await open(page, 'react', 'page=fields&skin=outlined'));
    const client = node(page, 'f-client').locator('input[role="combobox"]');
    await enter(client);
    await client.pressSequentially('Bayt Interiors');
    await client.press('Control+Enter');
    await expect.poll(async () => labelOf(await stored(page, 'project', 'client_id'))).toBe('Bayt Interiors');
    await enter(client);
    await client.pressSequentially('Narnia');
    await client.press('Control+Enter');
    await expect.poll(async () => (await form(page)).errors['client_id'] ?? '').toContain('Narnia');
    expect(labelOf(await stored(page, 'project', 'client_id'))).toBe('Bayt Interiors');
    await screen(page, 'input-commit-react', { viewport: true });
  });
});
