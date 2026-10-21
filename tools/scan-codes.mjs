/**
 * Make the codes the scan demos are tried with (demos/samples/codes-to-scan.html): each patient's card as its QR code,
 * each injectable's box as the GS1 DataMatrix its maker prints (its GTIN, expiry, lot and serial number), and the
 * shelf's products as their EAN-13 barcodes — from the demos' own records (demos/shared/scan.ts), drawn by the codes the
 * browser tests read (libs/widgets/src/lib/test-codes.ts). A person opens the page on another screen, or prints it, and
 * holds it up to the camera.
 *
 *   node tools/scan-codes.mjs
 */
import { build } from 'esbuild';
import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { createRequire } from 'node:module';

const WORKSPACE = resolve(new URL('..', import.meta.url).pathname);
const OUT = join(WORKSPACE, 'demos/samples/codes-to-scan.html');

const { outputFiles } = await build({
  stdin: {
    contents: [`export { codeSvg } from './libs/widgets/src/lib/test-codes';`, `export { INJECTABLES, PATIENTS, SHELF } from './demos/shared/scan';`].join('\n'),
    resolveDir: WORKSPACE,
    loader: 'ts',
  },
  bundle: true,
  write: false,
  platform: 'node',
  format: 'cjs',
  external: ['@zxing/library'],
  tsconfig: join(WORKSPACE, 'tsconfig.base.json'),
  logLevel: 'error',
});
const module = { exports: {} };
runInNewContext(outputFiles[0].text, { module, exports: module.exports, require: createRequire(join(WORKSPACE, 'package.json')) });
const { codeSvg, INJECTABLES, PATIENTS, SHELF } = module.exports;

const esc = (text) => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const card = (svg, title, lines) => `<figure>${svg}<figcaption><strong>${esc(title)}</strong>${lines.map((line) => `<span>${esc(line)}</span>`).join('')}</figcaption></figure>`;
const GS = '\u001d';
const day = (yymmdd) => `20${yymmdd.slice(0, 2)}-${yymmdd.slice(2, 4)}${yymmdd.slice(4) === '00' ? '' : `-${yymmdd.slice(4)}`}`;

const patients = Object.values(PATIENTS).map((p) => card(codeSvg('qr_code', p.card, { size: 180 }), p.name, [`Patient card ${p.card}`]));
const boxes = Object.values(INJECTABLES).map((p) =>
  card(codeSvg('data_matrix', `01${p.gtin}17${p.box.expiry}10${p.box.lot}${GS}21${p.box.serial}`, { gs1: true, size: 180 }), p.name, [`GTIN ${p.gtin}`, `Lot ${p.box.lot} · Expiry ${day(p.box.expiry)}`, `Serial ${p.box.serial}`])
);
const shelf = Object.values(SHELF).map((p) => card(codeSvg('ean_13', p.barcode, { size: 260 }), p.name, [p.barcode]));
// A code that names no record: the sheet says so, and reads on.
const stranger = card(codeSvg('ean_13', '4006381333931', { size: 260 }), 'A product the shop does not sell', ['4006381333931']);

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Codes to scan — Fieldia’s demos</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 24px; color: #1b1f24; background: #fff; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  h2 { font-size: 17px; margin: 28px 0 8px; }
  p { margin: 0 0 8px; max-width: 70ch; }
  .codes { display: flex; flex-wrap: wrap; gap: 20px; }
  figure { margin: 0; padding: 12px; border: 1px solid #d0d7de; border-radius: 8px; display: grid; gap: 8px; justify-items: center; background: #fff; }
  figure svg { display: block; max-width: 100%; height: auto; }
  figcaption { display: grid; gap: 2px; text-align: center; font-size: 13px; }
  @media print { body { margin: 0; } figure { break-inside: avoid; } }
</style>
</head>
<body>
<h1>Codes to scan</h1>
<p>Open this page on another screen, or print it, and hold a code up to the camera when a demo asks you to scan. The codes are the demos’ own: a patient’s card, an injectable’s box, a shelf’s products.</p>
<h2>Patients’ cards (QR codes)</h2>
<p>For the treatment demo: press Scan beside Patient.</p>
<div class="codes">${patients.join('')}</div>
<h2>Injectables’ boxes (GS1 DataMatrix)</h2>
<p>For the treatment demo: press Scan beside a line’s Lot. The product, the lot and the expiry come from the one code.</p>
<div class="codes">${boxes.join('')}</div>
<h2>A shelf’s products (EAN-13 barcodes)</h2>
<p>For the stock count demo: press Scan under the table and read each in turn — every read counts one.</p>
<div class="codes">${shelf.join('')}${stranger}</div>
</body>
</html>
`;
writeFileSync(OUT, html);
console.log(`codes to scan: ${OUT.replace(`${WORKSPACE}/`, '')} (${Math.round(html.length / 1024)} KB)`);
