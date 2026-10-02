/**
 * Build the demos into dist/demos, straight from source (tsconfig paths), so
 * a demo always shows the code in this checkout. Each framework variant mounts
 * the same example pages; the browser gates in e2e/ drive all of them.
 */
import { build } from 'esbuild';
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';

const WORKSPACE = resolve(new URL('..', import.meta.url).pathname);
const OUT = join(WORKSPACE, 'dist/demos');
const variants = process.argv.slice(2).length ? process.argv.slice(2) : ['plain', 'react', 'vue', 'angular', 'designer', 'screen', 'script'];

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
for (const file of ['demo.css', 'demo-nav.js']) cpSync(join(WORKSPACE, 'demos', file), join(OUT, file));

const SCRIPT_BUNDLE = join(WORKSPACE, 'dist/libs/viewer/bundle/fieldia.js');

for (const variant of variants) {
  if (variant === 'script') {
    // No build step on purpose: the page as written, beside the viewer's script bundle.
    if (!existsSync(SCRIPT_BUNDLE)) throw new Error('demos/script needs the script bundle: run `npx nx build viewer` first');
    cpSync(join(WORKSPACE, 'demos/script'), join(OUT, 'script'), { recursive: true });
    cpSync(SCRIPT_BUNDLE, join(OUT, 'script/fieldia.js'));
    console.log(`demo script: ${join('dist/demos', 'script')}`);
    continue;
  }
  const entry = ['main.ts', 'main.tsx'].map((file) => join(WORKSPACE, 'demos', variant, file)).find(existsSync);
  if (!entry) throw new Error(`demos/${variant} has no main.ts or main.tsx`);
  // A demo may use its own tsconfig — the Angular one consumes the BUILT
  // @fieldia/angular package, so the gates exercise what would be published.
  const ownConfig = join(WORKSPACE, 'demos', variant, 'tsconfig.json');
  if (variant === 'angular' && !existsSync(join(WORKSPACE, 'dist/libs/angular/src/index.js'))) {
    throw new Error('demos/angular needs the built package: run `npx nx build angular` first');
  }
  await build({
    entryPoints: [entry],
    jsx: 'automatic',
    bundle: true,
    format: 'iife',
    target: 'es2022',
    sourcemap: true,
    outfile: join(OUT, variant, 'main.js'),
    tsconfig: existsSync(ownConfig) ? ownConfig : join(WORKSPACE, 'tsconfig.base.json'),
    logLevel: 'warning',
    define: {
      'process.env.NODE_ENV': '"production"',
      // Vue's bundler build reads these compile-time flags.
      __VUE_OPTIONS_API__: 'true',
      __VUE_PROD_DEVTOOLS__: 'false',
      __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false',
    },
  });
  cpSync(join(WORKSPACE, 'demos', variant, 'index.html'), join(OUT, variant, 'index.html'));
  console.log(`demo ${variant}: ${join('dist/demos', variant)}`);
}
