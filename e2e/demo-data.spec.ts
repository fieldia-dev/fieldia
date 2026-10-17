import { expect, test } from './fixtures';

/**
 * The demos' sample records drawn as their kind is: a value written as HTML — a customer's notes, as Flectra keeps a
 * partner's — is in a field every page of its model calls `html`, never one drawn as words (`char`, `text`), where a
 * visitor would read its markup ("<p>Pays within 30 days…</p>"). A field a code editor draws holds code, its own words.
 */

/** Markup as a value carries it: an opening or closing tag. */
const MARKUP = String.raw`<\/?[a-z][a-z0-9]*(\s[^<>]*)?\/?>`;

test('no demo page draws a sample record’s markup as words', async ({ page }) => {
  await page.goto('/plain/?page=customer&skin=underline');
  await expect(page.locator('.fd-form').first()).toBeVisible();
  await expect.poll(() => page.evaluate(() => Object.keys((window as any).fieldiaDemo?.pages ?? {}).length)).toBeGreaterThan(40);
  const found = await page.evaluate((markup) => {
    const tag = new RegExp(markup, 'i');
    const { pages, dataSource } = (window as any).fieldiaDemo as { pages: Record<string, any>; dataSource: { records: Record<string, Record<string, Record<string, unknown>>> } };
    const wrong: string[] = [];
    let checked = 0;
    /** The fields a page draws in a code editor, wherever its nodes are. */
    const coded = (node: unknown, found = new Set<string>()): Set<string> => {
      if (Array.isArray(node)) node.forEach((one) => coded(one, found));
      else if (node && typeof node === 'object') {
        const part = node as Record<string, unknown>;
        if (part['type'] === 'field' && ['code', 'monaco'].includes(String(part['widget']))) found.add(String(part['field']));
        Object.values(part).forEach((one) => coded(one, found));
      }
      return found;
    };
    for (const [name, shown] of Object.entries(pages)) {
      if (shown.data?.kind !== 'record') continue;
      const records = dataSource.records[shown.data.model] ?? {};
      const code = coded(shown.layout);
      for (const [field, def] of Object.entries(shown.fields as Record<string, { type: string }>)) {
        if ((def.type !== 'char' && def.type !== 'text') || code.has(field)) continue;
        for (const [id, values] of Object.entries(records)) {
          const value = values[field];
          if (typeof value !== 'string') continue;
          checked++;
          if (tag.test(value)) wrong.push(`${name}: ${shown.data.model} ${id}'s ${field} is ${def.type}, holding ${value.slice(0, 40)}`);
        }
      }
    }
    return { wrong, checked };
  }, MARKUP);
  expect(found.checked, 'values of words checked').toBeGreaterThan(200);
  expect(found.wrong).toEqual([]);
});

test('the customer’s notes read as words on its account’s page, never their markup', async ({ page }) => {
  await page.goto('/plain/?page=customer-account&record=1&skin=underline');
  await page.getByRole('tab', { name: 'Notes' }).click();
  const notes = page.locator('[data-node="f-notes"]');
  await expect(notes).toContainText('Pays within 30 days. Prefers deliveries on Sundays.');
  await expect(notes).not.toContainText('<p>');
  await expect(notes.locator('textarea')).toHaveCount(0);
});
