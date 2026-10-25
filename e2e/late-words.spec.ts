import { type Locator, type Page, type Route } from '@playwright/test';
import { expect, test } from './fixtures';
import { mapReady, stubMaps } from './map-support';

/**
 * A page in Arabic whose Arabic is held (0.35): in the packages every language but English comes in chunks of its own —
 * core's, the widgets', the viewer's, the map's — and the quick way a change is worked out keeps a part drawn while
 * what it shows is the same, the words it shows among that (`wordsVersion`). Each Arabic chunk the demo asks for is held
 * here, never raced, and let go once the page waits for it: what then arrives is drawn in Arabic everywhere — every part
 * of the record, its related list's header and rows, the dialog a row opens; a list's header, its map and a pin's card —
 * exactly as the same page drawn with its Arabic at once, and with none of the English words the page shows in English.
 */

const NOW = 'now=2026-10-14T09:40';
const CUSTOMER = `page=customer-account&record=1&skin=underline&${NOW}`;
const HOMES = `page=map-homes&skin=outlined&${NOW}`;
const ARABIC = '&locale=ar&dir=rtl';

/** Every Arabic chunk the page asks for, held until `release()`. */
async function holdArabic(page: Page) {
  const held: Route[] = [];
  let open = false;
  await page.route(/\/chunks\/ar-[A-Z0-9]+\.js$/, (route) => (open ? route.continue() : void held.push(route)));
  return {
    held: () => held.length,
    release: async () => {
      open = true;
      for (const route of held.splice(0)) await route.continue();
    },
  };
}

/** Every word in a part a person or a screen reader meets: its text, and its words in attributes, once each, in order. */
const wordsIn = (part: Locator) =>
  part.evaluate((root) => {
    const found = new Set<string>();
    for (const element of [root, ...root.querySelectorAll('*')]) {
      // A wait's words to a screen reader are there as long as it waits, which differs from load to load: held apart.
      if (element.closest('.leaflet-tile-pane, .leaflet-control-attribution, svg, .fd-loading-said')) continue;
      for (const node of element.childNodes) if (node.nodeType === 3 && node.textContent?.trim()) found.add(node.textContent.trim());
      for (const name of ['aria-label', 'title', 'placeholder', 'aria-description', 'alt', 'aria-roledescription']) {
        const value = element.getAttribute(name)?.trim();
        if (value) found.add(value);
      }
    }
    return [...found].sort();
  });

/** What the page shows a person, part by part, as `drive` takes them through it. */
type Shown = Record<string, string[]>;

/**
 * The page drawn three ways, `drive` taking each through the same parts: in English; in Arabic, its Arabic at once; and
 * in Arabic, its Arabic held until the page waits for it, then let go. The third is the second, word for word, and
 * holds none of the words only the English shows (Fieldia's own: the page's words are the same in all three).
 */
async function threeWays(page: Page, query: string, drive: (page: Page) => Promise<Shown>) {
  await page.goto(`/plain/?${query}`);
  const english = await drive(page);
  await page.goto(`/plain/?${query}${ARABIC}`);
  const arabic = await drive(page);
  const arabicChunks = await holdArabic(page);
  // Not waiting for the load event: a chunk held is a request the page has not finished (Firefox waits for it).
  await page.goto(`/plain/?${query}${ARABIC}`, { waitUntil: 'commit' });
  // Held: the page waits, drawing none of its words in English meanwhile.
  await expect.poll(() => arabicChunks.held()).toBeGreaterThan(0);
  await expect(page.locator('.fd-form').first()).toHaveAttribute('aria-busy', 'true');
  await expect(page.locator('.fd-form button[type="submit"], .fd-form .fd-list-row')).toHaveCount(0);
  await arabicChunks.release();
  const late = await drive(page);
  // What its waits said to a screen reader meanwhile, in Arabic too (said while its Arabic was held, said again as it came).
  for (const said of await page.locator('.fd-loading-said').allTextContents()) expect(said, 'a wait said in English').not.toMatch(/[A-Za-z]/);
  for (const part of Object.keys(english)) {
    const englishOnly = english[part].filter((words) => !arabic[part].includes(words));
    expect(englishOnly.length, `${part}: Fieldia's own words, English beside Arabic`).toBeGreaterThan(0);
    expect(late[part], `${part}: drawn as with its Arabic at once`).toEqual(arabic[part]);
    expect(late[part].filter((words) => englishOnly.includes(words)), `${part}: an English word`).toEqual([]);
  }
}

test('a record, its related list and the dialog a row opens, its Arabic held and let go: Arabic everywhere', async ({ page }) => {
  await threeWays(page, CUSTOMER, async (page) => {
    const invoices = page.locator('[data-node="invoices"]');
    await expect(invoices.locator('.fd-list-row').first()).toBeVisible();
    // A key in the record's name, its other parts left as they were drawn: the quick way leaves them alone.
    const name = page.locator('.fd-form').first().locator('input.fd-input, textarea.fd-input').first();
    await name.click();
    await name.press('End');
    await name.pressSequentially(' x');
    const record = await wordsIn(page.locator('.fd-form').first());
    const header = await wordsIn(invoices.locator('thead'));
    await invoices.locator('.fd-list-row').first().locator('td').first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.locator('.fd-form')).toBeVisible();
    await expect(dialog.locator('.fd-form')).not.toHaveAttribute('aria-busy', 'true');
    const opened = await wordsIn(dialog);
    await dialog.press('Escape');
    await expect(dialog).toHaveCount(0);
    return { record, header, dialog: opened };
  });
});

test('a list of homes on its map and a pin’s card, its Arabic held and let go: Arabic everywhere', async ({ page }) => {
  await stubMaps(page);
  await threeWays(page, HOMES, async (page) => {
    const map = page.locator('.fd-map-list .fd-map-box');
    await mapReady(map);
    await expect(page.locator('.fd-list-row').first()).toBeVisible();
    const box = page.locator('.fd-search').getByRole('combobox');
    await box.pressSequentially('Zamalek');
    await box.press('Enter');
    await expect(page.locator('.fd-list-row')).toHaveCount(6);
    const header = await wordsIn(page.locator('.fd-list-table thead'));
    const list = await wordsIn(page.locator('.fd-list-records'));
    const pin = page.locator('.fd-map-list .fd-map-mark:not(.fd-map-ghost)[data-id]').first();
    await expect(pin).toBeVisible();
    await pin.click();
    const card = page.locator('.fd-map-list .fd-map-card');
    await expect(card).toBeVisible();
    await expect(page.locator('.fd-map-list .leaflet-popup')).toHaveCSS('opacity', '1');
    return { header, list, map: await wordsIn(page.locator('.fd-map-list')), card: await wordsIn(card) };
  });
});
