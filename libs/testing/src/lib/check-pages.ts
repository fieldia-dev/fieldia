import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
import { validatePage, type PageIssue } from '@fieldia/core';

/**
 * Stored pages checked as Fieldia reads them: every `.json` file named, or found in a folder named (and the folders
 * in it), through `validatePage` — the format's shape, every reference, every expression — and its warnings. One line
 * of CI keeps the pages an app keeps (in its repository, exported from its database) valid after an upgrade:
 *
 *   npx fieldia-check pages/            # or: npx fieldia-check pages/*.page.json --functions vat,fx
 */
export interface PageCheckResult {
  file: string;
  ok: boolean;
  /** What makes the page one Fieldia refuses: where, and why. */
  problems: PageIssue[];
  /** What it draws but may not mean (a function given a kind of value it does not take). */
  warnings: PageIssue[];
}

/** The `.json` files a list of files and folders names, in order, each once. */
export function pageFiles(paths: readonly string[]): string[] {
  const found: string[] = [];
  const walk = (path: string) => {
    if (statSync(path).isDirectory()) {
      for (const entry of readdirSync(path).sort()) if (entry !== 'node_modules' && !entry.startsWith('.')) walk(join(path, entry));
    } else if (extname(path) === '.json' && !found.includes(path)) found.push(path);
  };
  for (const path of paths) walk(path);
  return found;
}

/** Each file read and checked. `functions`: the names of the app's own functions its pages may call. */
export function checkPageFiles(files: readonly string[], options: { functions?: readonly string[] } = {}): PageCheckResult[] {
  const functions = Object.fromEntries((options.functions ?? []).map((name) => [name, () => null]));
  return files.map((file) => {
    let page: unknown;
    try {
      page = JSON.parse(readFileSync(file, 'utf8'));
    } catch (error) {
      return { file, ok: false, problems: [{ path: '(file)', message: `not JSON: ${(error as Error).message}` }], warnings: [] };
    }
    const checked = validatePage(page, { functions });
    return { file, ok: checked.ok, problems: checked.ok ? [] : checked.issues, warnings: checked.warnings ?? [] };
  });
}

/** The results as lines a person reads: each page's mark, then what is wrong with it, indented. */
export function resultLines(results: readonly PageCheckResult[]): string[] {
  const lines: string[] = [];
  for (const result of results) {
    lines.push(`${result.ok ? '✓' : '✗'} ${result.file}`);
    for (const problem of result.problems) lines.push(`    ${problem.path}: ${problem.message}`);
    for (const warning of result.warnings) lines.push(`    warning — ${warning.path}: ${warning.message}`);
  }
  const refused = results.filter((result) => !result.ok).length;
  const warned = results.filter((result) => result.warnings.length).length;
  lines.push(`${results.length} page${results.length === 1 ? '' : 's'} checked: ${refused ? `${refused} refused` : 'all valid'}${warned ? `, ${warned} with warnings` : ''}.`);
  return lines;
}
