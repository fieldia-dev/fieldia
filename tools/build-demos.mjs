/**
 * Build the demos into dist/demos, straight from source (tsconfig paths), so
 * a demo always shows the code in this checkout. Each framework variant mounts
 * the same example pages; the browser gates in e2e/ drive all of them.
 */
import { build } from 'esbuild';
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const WORKSPACE = resolve(new URL('..', import.meta.url).pathname);
const OUT = join(WORKSPACE, 'dist/demos');
const variants = process.argv.slice(2).length ? process.argv.slice(2) : ['plain'];

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
for (const file of ['demo.css', 'demo-nav.js']) cpSync(join(WORKSPACE, 'demos', file), join(OUT, file));

for (const variant of variants) {
  const entry = join(WORKSPACE, 'demos', variant, variant === 'plain' ? 'main.ts' : 'main.tsx');
  await build({
    entryPoints: [entry.endsWith('.tsx') ? entry : entry],
    bundle: true,
    format: 'iife',
    target: 'es2022',
    sourcemap: true,
    outfile: join(OUT, variant, 'main.js'),
    tsconfig: join(WORKSPACE, 'tsconfig.base.json'),
    logLevel: 'warning',
    define: { 'process.env.NODE_ENV': '"production"' },
  });
  cpSync(join(WORKSPACE, 'demos', variant, 'index.html'), join(OUT, variant, 'index.html'));
  console.log(`demo ${variant}: ${join('dist/demos', variant)}`);
}
mkdirSync(dirname(OUT), { recursive: true });
