import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { FILES } from './files-support';

/**
 * File and picture fields, files on their way, photos made smaller and a
 * signature's pad come in the files part, loaded the first time a page shows
 * one (files-part.ts in @fieldia/widgets).
 *
 * From one <script> tag: a page with no file asks for no file but fieldia.js;
 * a page with one asks for fieldia.files.js beside it, and is drawn whole once
 * it came — nothing of it before. An app that draws a field without waiting
 * for its part sees the names of the files its value holds meanwhile, read
 * only, and the part's own widget in their place once it comes, nothing
 * dropped. As an app's bundler builds it (the plain demo, each part a chunk):
 * a page with no file asks for no files chunk; one with a photo asks for it once.
 */

const LISTING = {
  fieldia: '0.10',
  id: 'listing',
  title: 'A listing',
  data: { kind: 'record', model: 'listing' },
  fields: {
    title: { type: 'char', label: 'Title' },
    photo: { type: 'image', label: 'Cover photo' },
    papers: { type: 'binary', label: 'Papers', multiple: true },
  },
  layout: {
    type: 'sections',
    id: 'root',
    children: [{ type: 'section', id: 's', children: [{ type: 'field', id: 'f-title', field: 'title' }, { type: 'field', id: 'f-photo', field: 'photo' }, { type: 'field', id: 'f-papers', field: 'papers' }] }],
  },
};
const HELD = {
  title: 'Flat 4, Zamalek',
  papers: [
    { name: 'Contract.pdf', type: 'application/pdf', size: 1200, url: 'data:application/pdf;base64,JVBERi0xLjQK' },
    { name: 'Floor plan.txt', type: 'text/plain', size: 5, data: 'aGVsbG8=' },
  ],
};

function watch(page: Page) {
  const problems: string[] = [];
  page.on('console', (message) => message.type() === 'error' && problems.push(`console: ${message.text()}`));
  page.on('pageerror', (error) => problems.push(`page error: ${error.message}`));
  return problems;
}

const held = (page: Page, field: string) => page.evaluate((name) => (window as any).fieldiaDemo.handle.form.getState().values[name], field);

test.describe('file and picture fields in a part of their own', () => {
  test('fieldia.files.js asked for the first time a page shows a file, the page drawn whole once it came, a file picked at once', async ({ page }) => {
    const problems = watch(page);
    const requested: string[] = [];
    page.on('request', (request) => requested.push(new URL(request.url()).pathname));
    // The demo's memory source's members come in a part of their own as it is first asked, and Ctrl+Z's as a form is
  // first entered (script.spec): the source's and every form's, not the page's.
    const scripts = () => requested.filter((path) => /\/fieldia(\.\w+)?\.js$/.test(path) && !/\/fieldia\.(memory|undo)\.js$/.test(path)).sort();
    await page.goto('/script/');
    await expect(page.locator('.fd-form')).toBeVisible();
    await page.waitForLoadState('networkidle');
    // A page with no file asked for no files part.
    expect(scripts()).toEqual(['/script/fieldia.js']);
    const drawnAtOnce = await page.evaluate(
      ([shown, values]) => {
        const fieldia = (window as any).Fieldia;
        const demo = (window as any).fieldiaDemo;
        demo.handle.destroy();
        const dataSource = fieldia.createMemoryDataSource({ records: { listing: { 1: values } } });
        demo.handle = fieldia.mountViewer(document.getElementById('app'), { page: shown, dataSource, recordId: 1, skin: 'outlined' });
        return !!document.querySelector('#app [data-node]');
      },
      [LISTING, HELD] as const,
    );
    // Nothing of it before its part came: no plain field to move, nothing to pick and lose.
    expect(drawnAtOnce).toBe(false);
    const papers = page.locator('[data-node="f-papers"]');
    await expect(papers.locator('.fd-file .fd-file-item')).toHaveCount(2);
    // The loading part beside the page's own: its skeleton while they come — asked for, never waited for.
    expect(scripts()).toEqual(['/script/fieldia.files.js', '/script/fieldia.js', '/script/fieldia.loading.js']);
    await expect(papers.locator('.fd-file-name')).toHaveText(['Contract.pdf', 'Floor plan.txt']);
    // Its sheet among Fieldia's, before the page's own looks.
    expect(await page.evaluate(() => [...document.head.querySelectorAll('style[id^="fieldia"]')].map((style) => style.id))).toEqual(['fieldia-styles', 'fieldia-files-styles', 'fieldia-styles-looks']);
    // Drawn by its sheet: the list's rows framed, the picker's tile dashed.
    expect(await papers.locator('.fd-file-open').first().evaluate((open) => getComputedStyle(open).borderTopStyle)).toBe('solid');
    const photo = page.locator('[data-node="f-photo"]');
    expect(await photo.locator('.fd-image-pick').evaluate((tile) => [getComputedStyle(tile).borderTopStyle, getComputedStyle(tile).width])).toEqual(['dashed', '96px']);

    // A photo picked and a paper added, at once: each in the value.
    await photo.locator('input[type=file]').setInputFiles(FILES.photo('Living room.png'));
    await expect(photo.locator('img.fd-file-thumb')).toHaveCount(1);
    // In the value once its upload ends, a moment after its picture shows.
    await expect.poll(async () => (await held(page, 'photo'))?.name).toBe('Living room.png');
    await papers.locator('input[type=file]').setInputFiles(FILES.notes());
    await expect(papers.locator('.fd-file-item')).toHaveCount(3);
    expect(((await held(page, 'papers')) as { name: string }[]).map((file) => file.name)).toEqual(['Contract.pdf', 'Floor plan.txt', 'Snag list.txt']);
    // Opened, in its dialog.
    await papers.getByRole('button', { name: /^Floor plan\.txt/ }).click();
    await expect(page.getByRole('dialog')).toContainText('hello');
    await page.keyboard.press('Escape');
    // Asked for once.
    expect(scripts()).toEqual(['/script/fieldia.files.js', '/script/fieldia.js', '/script/fieldia.loading.js']);
    expect(problems).toEqual([]);
  });

  test('drawn before its part came, by an app that did not wait: the names it holds, read only, then the part’s own widget with them all', async ({ page }) => {
    const problems = watch(page);
    // The part's script held on its way, so the page can be looked at before it comes.
    let release = () => undefined as void;
    const holding = new Promise<void>((done) => (release = done));
    await page.route('**/script/fieldia.files.js', async (route) => {
      await holding;
      await route.continue();
    });
    await page.goto('/script/');
    await expect(page.locator('.fd-form')).toBeVisible();
    await page.evaluate(
      ([shown, values]) => {
        const fieldia = (window as any).Fieldia;
        const demo = (window as any).fieldiaDemo;
        demo.handle.destroy();
        const app = document.getElementById('app') as HTMLElement;
        app.replaceChildren();
        // The app's own form and field, drawn at once: no viewer to wait for the part.
        const form = fieldia.createForm({ page: shown, dataSource: fieldia.createMemoryDataSource() });
        form.setValue('papers', values.papers);
        const widget = fieldia.createWidget({ form, name: 'papers', field: shown.fields.papers, node: shown.layout.children[0].children[2], id: 'papers', document });
        const host = document.createElement('div');
        host.className = 'fd-form';
        host.dataset['fdSkin'] = 'outlined';
        host.append(widget.element);
        app.append(host);
        const draw = () => widget.update({ value: form.getState().values.papers, values: form.getState().values, readonly: false, required: false, invalid: false });
        form.subscribe(draw);
        draw();
        (window as any).heldForm = form;
      },
      [LISTING, HELD] as const,
    );
    // Meanwhile: the files' names, words alone — nothing to pick with.
    const plain = page.locator('#app output[data-fd-plain="files"]');
    await expect(plain).toHaveText('Contract.pdf, Floor plan.txt');
    await expect(page.locator('#app input[type=file]')).toHaveCount(0);
    release();
    // The part's own widget in its place, with every file the value holds.
    await expect(page.locator('#app .fd-file .fd-file-item')).toHaveCount(2);
    await expect(plain).toHaveCount(0);
    await expect(page.locator('#app .fd-file-name')).toHaveText(['Contract.pdf', 'Floor plan.txt']);
    expect(await page.evaluate(() => ((window as any).heldForm.getState().values.papers as { name: string }[]).map((file) => file.name))).toEqual(['Contract.pdf', 'Floor plan.txt']);
    // And a file picked with it, at once.
    await page.locator('#app input[type=file]').setInputFiles(FILES.quote());
    await expect(page.locator('#app .fd-file-item')).toHaveCount(3);
    expect(problems).toEqual([]);
  });

  test('as an app’s bundler builds it: a page with no file asks for no files chunk; one with a photo asks for it, a photo picked at once', async ({ page }) => {
    const problems = watch(page);
    const asked: string[] = [];
    // The files part's chunks, named by their modules (files-part.ts) as the bundler names a chunk loaded on demand: the
    // widgets', and @fieldia/core's with the uploads' work (0.29), which the widgets' brings with it.
    page.on('request', (request) => {
      const url = new URL(request.url()).pathname;
      if (/\/chunks\/files-part-[^/]+\.js$/.test(url)) asked.push(url);
    });
    await page.goto('/plain/?page=signup&skin=outlined');
    await expect(page.locator('.fd-form [data-node]').first()).toBeVisible();
    await page.waitForLoadState('networkidle');
    expect(asked).toEqual([]);
    await page.goto('/plain/?page=customer&skin=outlined');
    const avatar = page.locator('.fd-avatar .fd-file');
    await expect(avatar.locator('.fd-image-pick')).toBeVisible();
    await page.waitForLoadState('networkidle');
    expect(asked).toHaveLength(2);
    await avatar.locator('input[type=file]').setInputFiles(FILES.photo('Portrait.png'));
    await expect(avatar.locator('img.fd-file-thumb')).toHaveCount(1);
    expect(problems).toEqual([]);
  });
});
