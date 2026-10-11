import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Copies Leaflet's stylesheet into @fieldia/map, which installs its styles
 * from code as every Fieldia package does. Run after upgrading Leaflet; a unit
 * test fails while the copy and the installed stylesheet differ.
 *
 *   node tools/leaflet-css.mjs
 */
const WORKSPACE = join(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(join(WORKSPACE, 'node_modules/leaflet/dist/leaflet.css'), 'utf8');
const { version } = JSON.parse(readFileSync(join(WORKSPACE, 'node_modules/leaflet/package.json'), 'utf8'));
const license = readFileSync(join(WORKSPACE, 'node_modules/leaflet/LICENSE'), 'utf8').trim();
const out = join(WORKSPACE, 'libs/map/src/lib/leaflet-css.ts');
writeFileSync(
  out,
  `// Leaflet ${version}'s stylesheet, copied by tools/leaflet-css.mjs under Leaflet's licence:\n//\n` +
    license.split(/\r?\n/).map((line) => `// ${line}`.trimEnd()).join('\n') +
    `\n\n` +
    `export const LEAFLET_VERSION = ${JSON.stringify(version)};\n` +
    `export const LEAFLET_CSS = ${JSON.stringify(css)};\n`
);
console.log(`wrote ${out} (Leaflet ${version}, ${css.length} characters)`);
