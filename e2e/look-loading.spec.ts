import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';

/**
 * The eight themes and the quiet look come in parts of their own, loaded the
 * first time a form wears them (look-parts.ts in @fieldia/widgets).
 *
 * From one <script> tag: a page with neither asks for no file but fieldia.js; a
 * page whose look names a theme asks for fieldia.themes.js beside it, and is
 * drawn whole once it came, wearing it; one whose look is the quiet skin asks
 * for fieldia.quiet.js the same way. A theme the app gives is worn as its part
 * comes: the page drawn at once in its skin's own look, no theme meanwhile. The
 * quiet skin the app gives draws its fields boxed until its part comes, every
 * value shown, and what is typed meanwhile is kept. As an app's bundler builds
 * it (the plain demo, each part a chunk): a page with neither asks for neither
 * chunk; a theme asks for the themes' once, a quiet group for the quiet look's.
 */

const CALL = {
  fieldia: '0.1',
  id: 'call',
  title: 'Ask for a call back',
  data: { kind: 'responses' },
  fields: { name: { type: 'char', label: 'Your name' }, phone: { type: 'char', label: 'Phone' } },
  layout: {
    type: 'sections',
    id: 'root',
    children: [{ type: 'section', id: 's', children: [{ type: 'field', id: 'f-name', field: 'name' }, { type: 'field', id: 'f-phone', field: 'phone' }] }],
  },
};
/** Material's purple, and the outlined skin's own blue, on a primary button as the browser paints them. */
const MATERIAL = 'rgb(103, 80, 164)';
const OUTLINED = 'rgb(19, 101, 217)';
const transparent = (colour: string) => colour === 'rgba(0, 0, 0, 0)' || colour === 'transparent';

function watch(page: Page) {
  const problems: string[] = [];
  page.on('console', (message) => message.type() === 'error' && problems.push(`console: ${message.text()}`));
  page.on('pageerror', (error) => problems.push(`page error: ${error.message}`));
  const requested: string[] = [];
  page.on('request', (request) => requested.push(new URL(request.url()).pathname));
  /** The scripts asked for: the main one and its parts — Ctrl+Z's aside, asked for as a form is first entered: every form's, not the look's. */
  const scripts = () => requested.filter((path) => /\/fieldia(\.[a-z]+)?\.js$/.test(path) && !path.endsWith('/fieldia.undo.js')).sort();
  return { problems, scripts };
}

/** The script demo's form replaced by `shown`, mounted with `more`: whether anything of it was drawn at once, and its theme and skin then. */
const mount = (page: Page, shown: unknown, more: Record<string, unknown> = {}) =>
  page.evaluate(
    ([shown, more]) => {
      const fieldia = (window as any).Fieldia;
      const demo = (window as any).fieldiaDemo;
      demo.handle.destroy();
      demo.dataSource = fieldia.createMemoryDataSource();
      demo.handle = fieldia.mountViewer(document.getElementById('app'), { page: shown, dataSource: demo.dataSource, ...more });
      const form = demo.handle.element as HTMLElement;
      return { drawn: !!document.querySelector('#app [data-node]'), theme: form.getAttribute('data-fd-theme'), skin: form.getAttribute('data-fd-skin') };
    },
    [shown, more] as const,
  );

/** A part's script held back until `release` is called: what a page does before it came. */
async function hold(page: Page, name: string) {
  let release = () => undefined as void;
  const held = new Promise<void>((done) => (release = done));
  await page.route(`**/script/fieldia.${name}.js`, async (route) => {
    await held;
    await route.continue();
  });
  return () => release();
}

const backgroundOf = (page: Page, name: string) => page.getByRole('button', { name, exact: true }).evaluate((b) => getComputedStyle(b).backgroundColor);
const edgeOf = (page: Page, id: string) => page.locator(`#app [data-node="${id}"] input`).evaluate((box) => getComputedStyle(box).borderTopColor);

test.describe('the themes and the quiet look in parts of their own, from one <script> tag', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/script/');
    await expect(page.locator('.fd-form')).toBeVisible();
    await page.waitForLoadState('networkidle');
  });

  test('a page whose look names a theme asks for fieldia.themes.js, drawn whole once it came, wearing it; another theme at once', async ({ page }) => {
    const { problems, scripts } = watch(page);
    await page.reload();
    await expect(page.locator('.fd-form')).toBeVisible();
    await page.waitForLoadState('networkidle');
    // A page with no theme and no quiet look asked for neither.
    expect(scripts()).toEqual(['/script/fieldia.js']);
    // Nothing of it before its part came: never drawn in the skin's look, then again in the theme's.
    expect(await mount(page, { ...CALL, look: { theme: 'material' } })).toEqual({ drawn: false, theme: null, skin: 'outlined' });
    const form = page.locator('#app .fd-form');
    await expect(form).toHaveAttribute('data-fd-theme', 'material');
    await expect(page.locator('#app [data-node="f-name"] input')).toBeVisible();
    expect(await backgroundOf(page, 'Submit')).toBe(MATERIAL);
    expect(scripts()).toEqual(['/script/fieldia.js', '/script/fieldia.themes.js']);
    // Another theme, the part in: at once, nothing more asked for.
    expect(await page.evaluate(() => {
      const handle = (window as any).fieldiaDemo.handle;
      handle.setTheme('google-forms');
      return handle.element.getAttribute('data-fd-theme');
    })).toBe('google-forms');
    expect(await backgroundOf(page, 'Submit')).toBe('rgb(103, 58, 183)');
    expect(scripts()).toEqual(['/script/fieldia.js', '/script/fieldia.themes.js']);
    expect(problems).toEqual([]);
  });

  test('a theme the app gives: the page drawn at once in its skin’s own look, the theme worn as its part comes', async ({ page }) => {
    const { problems, scripts } = watch(page);
    const release = await hold(page, 'themes');
    expect(await mount(page, CALL, { theme: 'material' })).toEqual({ drawn: true, theme: null, skin: 'outlined' });
    // Meanwhile the outlined skin's look, whole: its own blue on Submit, no theme's name over its tokens.
    await expect(page.locator('#app [data-node="f-name"] input')).toBeVisible();
    expect(await backgroundOf(page, 'Submit')).toBe(OUTLINED);
    await expect(page.locator('#app .fd-form')).not.toHaveAttribute('data-fd-theme', /.*/);
    release();
    await expect(page.locator('#app .fd-form')).toHaveAttribute('data-fd-theme', 'material');
    expect(await backgroundOf(page, 'Submit')).toBe(MATERIAL);
    expect(scripts()).toEqual(['/script/fieldia.themes.js']);
    expect(problems).toEqual([]);
  });

  test('a page whose look is the quiet skin asks for fieldia.quiet.js, drawn whole once it came, its values words at rest', async ({ page }) => {
    const { problems, scripts } = watch(page);
    expect(await mount(page, { ...CALL, look: { skin: 'quiet' } }, { values: { name: 'Omar Farouk' } })).toEqual({ drawn: false, theme: null, skin: 'quiet' });
    const box = page.locator('#app [data-node="f-name"] input');
    await expect(box).toHaveValue('Omar Farouk');
    await expect(page.locator('#app [data-node="f-name"]')).toHaveAttribute('data-quiet', '');
    expect(transparent(await edgeOf(page, 'f-name'))).toBe(true);
    expect(scripts()).toEqual(['/script/fieldia.quiet.js']);
    expect(problems).toEqual([]);
  });

  test('the quiet skin the app gives: boxed until its part came, a value typed meanwhile kept, then words at rest', async ({ page }) => {
    const { problems, scripts } = watch(page);
    const release = await hold(page, 'quiet');
    expect(await mount(page, CALL, { skin: 'quiet' })).toEqual({ drawn: true, theme: null, skin: 'quiet' });
    const box = page.locator('#app [data-node="f-name"] input');
    await expect(page.locator('#app [data-node="f-name"]')).toHaveAttribute('data-quiet', '');
    // Boxed meanwhile, as the outlined skin the quiet one is drawn on: its edge shows at rest, and it is typed in.
    expect(transparent(await edgeOf(page, 'f-phone'))).toBe(false);
    await box.click();
    await page.keyboard.type('Omar Farouk');
    release();
    await expect.poll(() => page.evaluate(() => !!document.getElementById('fieldia-quiet-styles'))).toBe(true);
    // The same box, what was typed in it kept, and the form holding it.
    await expect(box).toHaveValue('Omar Farouk');
    await expect(box).toBeFocused();
    expect(await page.evaluate(() => (window as any).fieldiaDemo.handle.form.getState().values.name)).toBe('Omar Farouk');
    // Its own look now: a box at rest is words, with no edge.
    await expect.poll(async () => transparent(await edgeOf(page, 'f-phone'))).toBe(true);
    expect(scripts()).toEqual(['/script/fieldia.quiet.js']);
    expect(problems).toEqual([]);
  });
});

test('as an app’s bundler builds it: a page with neither asks for neither chunk; a theme asks for the themes’, a quiet group for the quiet look’s', async ({ page }) => {
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(error.message));
  const chunks: string[] = [];
  // Each part's chunk, named by its module (themes-part.ts, quiet-part.ts) as the bundler names a chunk loaded on demand.
  page.on('request', (request) => {
    const found = /\/chunks\/(themes|quiet)-part-[^/]+\.js$/.exec(new URL(request.url()).pathname);
    if (found) chunks.push(found[1]);
  });
  await page.goto('/plain/?page=customer&skin=outlined');
  await expect(page.locator('.fd-form [data-node]').first()).toBeVisible();
  await page.waitForLoadState('networkidle');
  expect(chunks).toEqual([]);
  await page.goto('/plain/?page=signup&theme=material');
  await expect(page.locator('.fd-form').first()).toHaveAttribute('data-fd-theme', 'material');
  await page.waitForLoadState('networkidle');
  expect(chunks).toEqual(['themes']);
  // An outlined work item with a group of its own in the quiet look.
  await page.goto('/plain/?page=work-item-mixed&skin=outlined');
  await expect(page.locator('.fd-form .fd-field[data-quiet]').first()).toBeVisible();
  await page.waitForLoadState('networkidle');
  expect(chunks).toEqual(['themes', 'quiet']);
  expect(problems).toEqual([]);
});
