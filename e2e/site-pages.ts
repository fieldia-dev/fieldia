import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Every page of fieldia.dev, by its path, read from the site's own pages
 * (site/pages/*.mjs, each naming its `path`): a page added there is
 * checked by the site's tests and by axe at once, never left off a list.
 */
export function sitePages(): string[] {
  const dir = join(__dirname, '../site/pages');
  const paths = readdirSync(dir)
    .filter((file) => file.endsWith('.mjs'))
    .map((file) => /^\s*path: '([^']+)'/m.exec(readFileSync(join(dir, file), 'utf8'))?.[1])
    .filter((path): path is string => !!path);
  // The front page first, then the rest in a stable order.
  return paths.sort((a, b) => (a === '/' ? -1 : b === '/' ? 1 : a.localeCompare(b)));
}
