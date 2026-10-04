import { expect, test, type Page } from '@playwright/test';
import { DEMOS } from '../demos/catalog.mjs';
import { ALLOWED, axeFindings } from './a11y-support';
import { inAdvanced } from './designer-support';
import { node, screen } from './support';

/**
 * The accessibility sweep: axe, against WCAG 2.2 A and AA, on every demo of
 * the gallery in both skins, in the dark scheme and right to left in Arabic;
 * on the states a person reaches — errors after a failed send, a dialog
 * open, a list's search open — and on the designers: every view, dialog and
 * sheet, a part picked with each tab of the panel, and the empty state, in
 * Simple and Advanced, at a desktop's width and a phone's; and fieldia.dev's
 * own pages. Every page must come back with nothing found.
 */

interface Demo {
  id: string;
  app?: string;
  query: string;
}

/** Each demo's addresses: the plain framework, in each skin, dark, and in Arabic right to left. */
function addresses(): string[] {
  const urls = new Set<string>();
  for (const demo of DEMOS as Demo[]) {
    if (demo.app) {
      urls.add(`/${demo.app}/`);
      continue;
    }
    const own = new URLSearchParams(demo.query);
    for (const skin of ['outlined', 'underline']) {
      const query = new URLSearchParams(own);
      query.set('skin', skin);
      urls.add(`/plain/?${query}`);
    }
    urls.add(`/plain/?${own}&scheme=dark`);
    if (own.get('dir') !== 'rtl') urls.add(`/plain/?${own}&locale=ar&dir=rtl`);
  }
  return [...urls];
}

/** Open a demo and wait for its form, and for what loads after it (a list's rows, a page's choices, from a source that answers after a moment). */
async function visit(page: Page, url: string) {
  await page.goto(url);
  await expect(page.locator('.fd-form').first()).toBeVisible();
  await page.waitForTimeout(800);
}

// axe reads every element's colours: on a busy machine a page takes a while.
test.describe.configure({ timeout: 120_000 });

test.describe('axe on every demo of the gallery', () => {
  for (const url of addresses()) {
    test(url, async ({ page }) => {
      await visit(page, url);
      expect(await axeFindings(page, url)).toEqual([]);
    });
  }
});

test.describe('axe on what a person reaches', () => {
  for (const look of ['skin=outlined', 'skin=underline', 'skin=outlined&scheme=dark', 'skin=outlined&locale=ar&dir=rtl']) {
    test(`errors after a failed send · ${look}`, async ({ page }) => {
      await visit(page, `/plain/?page=signup&${look}`);
      await page.locator('.fd-form button[type="submit"]:visible').last().click();
      await expect(page.locator('.fd-error:visible').first()).toBeVisible();
      await screen(page, `a11y-errors-${look.replace(/\W+/g, '-')}`, { viewport: true });
      expect(await axeFindings(page, `signup errors ${look}`)).toEqual([]);
    });
  }

  test('answer rules that stop the form, and one that only warns', async ({ page }) => {
    await visit(page, '/plain/?page=rules&skin=outlined');
    await node(page, 'f-email').locator('input').fill('someone@elsewhere.example');
    await node(page, 'f-email').locator('input').blur();
    await page.getByRole('button', { name: 'Submit' }).click();
    await expect(page.locator('.fd-error:visible').first()).toBeVisible();
    expect(await axeFindings(page, 'rules refused')).toEqual([]);
  });

  test('a record that will not save, in Arabic', async ({ page }) => {
    await visit(page, '/plain/?page=customer&skin=underline&locale=ar&dir=rtl');
    await node(page, '#title').locator('input').fill('');
    await page.locator('.fd-form button[type="submit"]:visible').first().click();
    await expect(page.locator('.fd-error:visible').first()).toBeVisible();
    expect(await axeFindings(page, 'customer refused, Arabic')).toEqual([]);
  });

  for (const look of ['skin=outlined', 'skin=underline&scheme=dark']) {
    test(`dialogs open · ${look}`, async ({ page }) => {
      await visit(page, `/plain/?page=fields&${look}`);
      // A linked record, opened over the page.
      await node(page, 'f-client').getByRole('button', { name: 'Open Nile Traders' }).click();
      await expect(page.getByRole('dialog', { name: 'Nile Traders' })).toBeVisible();
      await screen(page, `a11y-dialog-record-${look.replace(/\W+/g, '-')}`, { viewport: true });
      const findings = await axeFindings(page, `record dialog ${look}`);
      await page.keyboard.press('Escape');
      // Search more…, over the page.
      await node(page, 'f-client').getByRole('combobox').click();
      await node(page, 'f-client').getByRole('option', { name: 'Search more…' }).click();
      await expect(page.getByRole('dialog', { name: 'Client' })).toBeVisible();
      findings.push(...(await axeFindings(page, `search more ${look}`)));
      expect(findings).toEqual([]);
    });
  }

  test('a line of an order, open in its dialog', async ({ page }) => {
    await visit(page, '/plain/?page=order&skin=underline');
    await node(page, 'f-lines').locator('.ag-row[row-index="1"] .ag-cell[col-id="__open"]').getByRole('button', { name: 'Open line' }).click();
    await expect(page.getByRole('dialog', { name: 'Order lines' })).toBeVisible();
    expect(await axeFindings(page, 'order line dialog')).toEqual([]);
  });

  for (const look of ['skin=underline', 'skin=outlined&scheme=dark', 'skin=underline&locale=ar&dir=rtl']) {
    test(`a list with its search open · ${look}`, async ({ page }) => {
      await visit(page, `/plain/?page=customers&${look}`);
      const box = page.locator('.fd-search-input');
      await box.pressSequentially('egy');
      await expect(page.getByRole('listbox').getByRole('option').first()).toBeVisible();
      const findings = await axeFindings(page, `search suggestions ${look}`);
      await box.press('Enter');
      await page.locator('.fd-search-toggle').click();
      await expect(page.locator('.fd-search-panel')).toBeVisible();
      await screen(page, `a11y-list-search-${look.replace(/\W+/g, '-')}`, { viewport: true });
      findings.push(...(await axeFindings(page, `search menu ${look}`)));
      expect(findings).toEqual([]);
    });
  }
});

// ---- the designers ----------------------------------------------------------------

const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };
const bar = (page: Page, name: string) => page.locator('.fd-designer-bar').getByRole('button', { name, exact: true });

interface Run {
  name: string;
  url: string;
  /** How a part is picked on its canvas. */
  part: string;
  survey?: boolean;
  /** What to add first, for a page that starts empty. */
  prepare?: (page: Page) => Promise<void>;
}
const RUNS: Run[] = [
  { name: 'survey designer', url: '/designer/?start=survey', part: '.fd-q-closed', survey: true },
  { name: 'screen editor', url: '/screen/', part: '.fd-canvas-field' },
  {
    name: 'record sheet',
    url: '/screen/?start=sheet',
    part: '.fd-canvas-field',
    // A blank sheet: a field of the model, status steps and a button over the card, as a person adds them.
    prepare: async (page) => {
      await page.locator('.fd-toolbox [data-tool="model:email"]').click();
      await page.getByRole('button', { name: 'Add status steps' }).click();
      await page.getByRole('button', { name: 'Add a button' }).click();
      await page.keyboard.press('Escape');
    },
  },
  { name: 'list', url: '/screen/?start=list', part: '.fd-list-table th[data-node]' },
  { name: 'laid-out page', url: '/screen/?start=layout', part: '.fd-canvas-field' },
];

/**
 * axe on each place a person goes in a designer: the rail's tabs, a part
 * picked with each tab of its panel, the views, and each dialog and sheet.
 * At the top of the page each time: what scrolls under the sticky bar is not
 * covered for a person, who scrolls it out.
 */
async function walk(page: Page, run: Run, tag: string): Promise<string[]> {
  const found: string[] = [];
  const look = async (state: string, shot = false) => {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(150);
    if (shot) await screen(page, `a11y-${tag}-${state}`.replace(/\W+/g, '-'), { viewport: true });
    found.push(...(await axeFindings(page, `${tag} · ${state}`)));
  };
  await page.goto(run.url);
  await expect(page.locator('.fd-designer-bar')).toBeVisible();
  await run.prepare?.(page);
  await look('start', true);
  const rail = page.locator('.fd-rail');
  for (const name of ['Outline', 'Data']) {
    const tab = rail.getByRole('tab', { name, exact: true });
    if (!(await tab.isVisible())) continue;
    await tab.click();
    await look(`rail ${name}`);
  }
  await rail.getByRole('tab', { name: 'Add', exact: true }).click();
  await page.locator(run.part).first().click();
  await look('picked', true);
  const panelTabs = page.locator('.fd-properties [role="tab"]');
  for (const name of await panelTabs.allTextContents()) {
    await page.locator('.fd-properties').getByRole('tab', { name, exact: true }).click();
    await look(`picked, ${name} tab`);
  }
  for (const view of ['Try it', 'JSON', 'Translations', 'Rules']) {
    await bar(page, view).click();
    await page.waitForTimeout(250);
    await look(`${view} view`, true);
    await bar(page, 'Design').click();
  }
  const dialogs: [string, () => Promise<unknown>][] = [
    ['find anything', () => page.keyboard.press('ControlOrMeta+k')],
    ['checks', () => page.locator('.fd-checks-button').click()],
    ['publish', () => bar(page, 'Publish').click()],
    ['shortcuts', () => page.keyboard.type('?')],
    ['versions', () => page.locator('.fd-designer-status').click()],
    ...(run.survey ? ([['look', () => bar(page, 'Look').click()]] as [string, () => Promise<unknown>][]) : []),
  ];
  for (const [name, open] of dialogs) {
    await page.locator('body').click({ position: { x: 2, y: 2 } });
    await open();
    await page.waitForTimeout(200);
    await look(name, true);
    await page.keyboard.press('Escape');
  }
  return found;
}

test.describe('axe on the designers', () => {
  for (const run of RUNS) {
    for (const mode of run.survey ? ['the one mode'] : ['Simple', 'Advanced']) {
      for (const [size, viewport] of [['desktop', DESKTOP], ['phone', PHONE]] as const) {
        const tag = `${run.name} · ${mode} · ${size}`;
        test(tag, async ({ page }) => {
          test.setTimeout(300_000);
          await page.setViewportSize(viewport);
          if (mode === 'Advanced') await inAdvanced(page);
          expect(await walk(page, run, tag)).toEqual([]);
        });
      }
    }
  }

  for (const [name, url] of [['survey', '/designer/'], ['screen', '/screen/?start=blank']]) {
    for (const [size, viewport] of [['desktop', DESKTOP], ['phone', PHONE]] as const) {
      test(`a blank ${name}: templates to start from · ${size}`, async ({ page }) => {
        await page.setViewportSize(viewport);
        await page.goto(url);
        await expect(page.locator('.fd-designer-bar')).toBeVisible();
        await screen(page, `a11y-blank-${name}-${size}`, { viewport: true });
        expect(await axeFindings(page, `blank ${name} · ${size}`)).toEqual([]);
      });
    }
  }
});

// ---- fieldia.dev ---------------------------------------------------------------------

/** The site, served on its own port: its docs, the galleries, and the accessibility statement. */
const SITE = `http://127.0.0.1:${process.env['FIELDIA_SITE_PORT'] ?? 4322}`;
const SITE_PAGES = ['/', '/start/', '/pages/', '/fields/', '/data/', '/behaviour/', '/lists/', '/chatter/', '/look/', '/demos/', '/designer/', '/accessibility/'];

test.describe('axe on fieldia.dev', () => {
  for (const path of SITE_PAGES) {
    test(path, async ({ page }) => {
      await page.goto(SITE + path);
      await expect(page.locator('h1').first()).toBeVisible();
      expect(await axeFindings(page, `fieldia.dev${path}`)).toEqual([]);
    });
  }
});

test('the allow-list stays short, and says why for each', () => {
  expect(ALLOWED.length).toBeLessThanOrEqual(3);
  for (const entry of ALLOWED) expect(entry.why.length, `${entry.rule} needs a reason`).toBeGreaterThan(20);
});
