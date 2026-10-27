import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL, URL } from 'node:url';

/**
 * One of @fieldia/core's own lists of plain data, read from its source as the docs are built — so a page of the docs
 * never drifts from it: the module run as Node runs TypeScript, its types left out (it imports nothing).
 */
export async function coreData(file) {
  const dir = mkdtempSync(join(tmpdir(), 'fieldia-data-'));
  const copy = join(dir, 'data.mts');
  writeFileSync(copy, readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'));
  try {
    return await import(pathToFileURL(copy).href);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
