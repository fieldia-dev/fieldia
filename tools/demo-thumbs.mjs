/**
 * Take the gallery's thumbnails: each demo in the catalog, opened in a real
 * browser as the browser tests open it (so without the menu and the how-to
 * panel), and shot from just under its header: 600 × 360, the demo itself.
 *
 *   node tools/build-demos.mjs && node tools/demo-thumbs.mjs
 *
 * They are kept in demos/thumbs, beside the catalog; take them again after a
 * demo changes how it looks.
 */
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const WORKSPACE = resolve(new URL('..', import.meta.url).pathname);
const OUT = join(WORKSPACE, 'demos/thumbs');
const PORT = 4397;
const { DEMOS, demoHref } = await import(pathToFileURL(join(WORKSPACE, 'demos/catalog.mjs')).href);

const server = spawn('node', [join(WORKSPACE, 'tools/serve.mjs'), join(WORKSPACE, 'dist/demos'), String(PORT)], { stdio: 'ignore' });
try {
  await new Promise((done) => setTimeout(done, 600));
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  // Half the pixels: a 1200 × 720 page drawn into 600 × 360.
  const context = await browser.newContext({ viewport: { width: 1200, height: 720 + 200 }, deviceScaleFactor: 0.5 });
  const page = await context.newPage();
  for (const demo of DEMOS) {
    await page.goto(`http://localhost:${PORT}/${demoHref(demo)}`);
    await page.locator('.fd-form').first().waitFor();
    // Lists, links and grids fill in after their first answer; fonts settle.
    await page.waitForTimeout(900);
    const top = await page.locator('#app').evaluate((app) => app.getBoundingClientRect().top);
    const file = join(OUT, `${demo.id}.png`);
    await page.screenshot({ path: file, clip: { x: 0, y: top, width: 1200, height: 720 }, animations: 'disabled' });
    console.log(`thumb ${demo.id}: ${Math.round(statSync(file).size / 1024)} KB`);
  }
  await browser.close();
} finally {
  server.kill();
}
