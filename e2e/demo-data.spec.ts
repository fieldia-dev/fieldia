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
  await expect.poll(() => page.evaluate(() => ((window as any).fieldiaDemo?.pageNames ?? []).length)).toBeGreaterThan(40);
  const found = await page.evaluate(async (markup) => {
    const tag = new RegExp(markup, 'i');
    // Every page fetched: each demo page's JSON is a file of its own, which the demo fetches as it opens it.
    const { allPages, dataSource } = (window as any).fieldiaDemo as { allPages(): Promise<Record<string, any>>; dataSource: { records: Record<string, Record<string, Record<string, unknown>>> } };
    const pages = await allPages();
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

/**
 * What a value of each kind is, as Fieldia keeps it: a date its day ("2026-10-06"), a date and time its instant with a
 * time ("2026-10-06T09:30"), a number a number, a link `{ id, label }` — its id and its name. Null is any kind's.
 */
test('every demo page’s field holds its kind in its model’s sample records: a date a day, a date and time a time, a number a number, a link its id and name', async ({ page }) => {
  await page.goto('/plain/?page=customer&skin=underline');
  await expect(page.locator('.fd-form').first()).toBeVisible();
  await expect.poll(() => page.evaluate(() => ((window as any).fieldiaDemo?.pageNames ?? []).length)).toBeGreaterThan(40);
  const found = await page.evaluate(async () => {
    // Every page fetched: each demo page's JSON is a file of its own, which the demo fetches as it opens it.
    const { allPages, dataSource } = (window as any).fieldiaDemo as { allPages(): Promise<Record<string, any>>; dataSource: { records: Record<string, Record<string, Record<string, unknown>>> } };
    const pages = await allPages();
    const DAY = /^\d{4}-\d{2}-\d{2}$/;
    const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
    /** Why a value is not of its kind, or null where it is. */
    const misfit = (type: string, value: unknown): string | null => {
      if (value === null || value === undefined) return null;
      if (type === 'date') return typeof value === 'string' && DAY.test(value) ? null : 'a date holds a day';
      if (type === 'datetime') return typeof value === 'string' && INSTANT.test(value) ? null : 'a date and time holds a time';
      if (type === 'integer' || type === 'float' || type === 'monetary') return typeof value === 'number' && Number.isFinite(value) ? null : 'a number holds a number';
      if (type === 'many2one') {
        const link = value as { id?: unknown; label?: unknown };
        return typeof value === 'object' && !Array.isArray(value) && (typeof link.id === 'number' || typeof link.id === 'string') && typeof link.label === 'string' ? null : 'a link holds its id and name';
      }
      return null;
    };
    const KINDS = new Set(['date', 'datetime', 'integer', 'float', 'monetary', 'many2one']);
    const wrong = new Set<string>();
    let checked = 0;
    /** A record's values against its fields — a table's lines against theirs. */
    const check = (where: string, fields: Record<string, { type: string; fields?: Record<string, { type: string }> }>, values: Record<string, unknown>) => {
      for (const [field, def] of Object.entries(fields)) {
        const value = values[field];
        if (def.type === 'one2many' && def.fields && Array.isArray(value)) {
          for (const line of value as { values?: Record<string, unknown> }[]) if (line?.values) check(`${where}'s ${field} line`, def.fields, line.values);
          continue;
        }
        if (!KINDS.has(def.type) || value === undefined) continue;
        checked++;
        const why = misfit(def.type, value);
        if (why) wrong.add(`${where}'s ${field} (${def.type}): ${why}, not ${JSON.stringify(value).slice(0, 40)}`);
      }
    };
    for (const [name, shown] of Object.entries(pages)) {
      if (shown.data?.kind !== 'record') continue;
      for (const [id, values] of Object.entries(dataSource.records[shown.data.model] ?? {})) check(`${name}: ${shown.data.model} ${id}`, shown.fields, values);
    }
    return { wrong: [...wrong], checked };
  });
  expect(found.checked, 'values checked').toBeGreaterThan(500);
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
