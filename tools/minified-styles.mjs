/**
 * Fieldia's stylesheets ship as text inside the code — one template literal in each style module — which a code
 * minifier leaves alone. Here that text is minified as CSS, with esbuild's own CSS minifier, the same way everywhere it
 * is built: the one-tag script (tools/script-bundle.mjs), the packages as npm ships them (tools/dual-build.mjs, which
 * keeps each line as a line break, so the source maps hold) and the demos the browser gates test (tools/build-demos.mjs)
 * — what the gates test is what ships.
 */
import { transform } from 'esbuild';

/** A style module's file name: `styles.ts`, `styles-inputs.ts`, `list-styles.ts` (and the built `.js`, `.mjs`). */
export const STYLE_MODULE = /^(([a-z-]+-)?styles|styles-[a-z-]+)\.(ts|m?js)$/;
/** The packages whose style modules hold one stylesheet each, minified. */
export const STYLED_PACKAGES = ['widgets', 'viewer', 'designer'];

/**
 * A style module's source with its stylesheet minified; `lines`: each line it took kept as a line break at its end.
 * Throws where it holds none, or where the minified text could not sit in a template literal.
 */
export async function minifyStylesheet(source, where, { lines = false } = {}) {
  const literal = /(= (?:\/\* css \*\/ )?`)([^`]*)(`;)/;
  const found = literal.exec(source);
  if (!found) throw new Error(`no stylesheet found in ${where}`);
  const { code } = await transform(found[2], { loader: 'css', minify: true, charset: 'utf8', logLevel: 'error' });
  // Text that could end the literal, or be read as part of it, would break the code.
  if (/[`\\]|\$\{/.test(code)) throw new Error(`the minified stylesheet of ${where} cannot sit in a template literal`);
  const breaks = lines ? '\n'.repeat((found[2].match(/\n/g) ?? []).length) : '';
  return source.replace(literal, (_, open, _css, close) => open + code.trim() + breaks + close);
}

/** An esbuild plugin minifying the stylesheet of each style module of `packages` it loads from the workspace's source. */
export const minifiedStyles = (packages = ['widgets', 'viewer']) => ({
  name: 'minified-styles',
  setup(builder) {
    const filter = new RegExp(`libs/(${packages.join('|')})/src/lib/(([a-z-]+-)?styles|styles-[a-z-]+)\\.ts$`);
    builder.onLoad({ filter }, async ({ path }) => {
      const { readFileSync } = await import('node:fs');
      return { contents: await minifyStylesheet(readFileSync(path, 'utf8'), path), loader: 'ts' };
    });
  },
});
