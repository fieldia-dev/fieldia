/**
 * Take the feature pages' pictures from the real demos, each opened as the
 * site embeds it (`embed=1`: the demo alone, no frame), and kept in site/img.
 *
 *   node tools/build-demos.mjs && node tools/feature-shots.mjs
 *
 * Take them again after a demo changes how it looks.
 */
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const WORKSPACE = resolve(new URL('..', import.meta.url).pathname);
const PORT = 4398;
const OUT = join(WORKSPACE, 'site/img');

/** Each picture: its file, the demo, the screen's width, and what to do before taking it. */
const SHOTS = [
  { file: 'records/sheet-head.png', query: 'page=customer&skin=underline', width: 1280, height: 560 },
  { file: 'records/grid.png', query: 'page=order&skin=underline', width: 1280, node: '[data-node="f-lines"]', before: async (page) => {
      const qty = page.locator('[data-node="f-lines"] .ag-row[row-index="1"] .ag-cell[col-id="qty"]').first();
      await qty.click();
    } },
  { file: 'records/tabs.png', query: 'page=real-legal-case&record=42&skin=underline', width: 1280, height: 760 },
  { file: 'records/chatter.png', query: 'page=customer&skin=underline', width: 1600, node: '.fd-sheet-layout > .fd-side' },
  // The PDF viewer paints its page a moment after the frame loads.
  { file: 'records/pdf.png', query: 'page=vendor-bill&skin=underline', width: 1440, height: 820, settle: 3000, scale: 1 },
];

const server = spawn('node', [join(WORKSPACE, 'tools/serve.mjs'), join(WORKSPACE, 'dist/demos'), String(PORT)], { stdio: 'ignore' });
try {
  await new Promise((done) => setTimeout(done, 600));
  // The newer headless mode: it draws a PDF in its frame, as a person's browser does.
  const browser = await chromium.launch({ channel: 'chromium' });
  for (const shot of SHOTS) {
    mkdirSync(join(OUT, shot.file, '..'), { recursive: true });
    // Sharp at 1.5; the PDF viewer zooms its page by the screen's density, so those shots are at 1.
    const page = await browser.newPage({ viewport: { width: shot.width, height: shot.height ?? 900 }, deviceScaleFactor: shot.scale ?? 1.5 });
    await page.goto(`http://127.0.0.1:${PORT}/plain/?${shot.query}&embed=1`);
    await page.locator('.fd-form').first().waitFor();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(shot.settle ?? 500);
    if (shot.before) await shot.before(page);
    const path = join(OUT, shot.file);
    if (shot.node) await page.locator(shot.node).first().screenshot({ path, animations: 'disabled' });
    else await page.screenshot({ path, animations: 'disabled' });
    console.log(`shot ${shot.file}`);
    await page.close();
  }
  await browser.close();
} finally {
  server.kill();
}
