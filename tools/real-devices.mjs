/**
 * A real iPhone and a real Android phone, checked by a person at each minor (docs/maintainers/real-devices.md): CI
 * drives phones as WebKit and Chromium at a phone's size with touch, never a real device — its Safari, its keyboard
 * over the page, its camera, its one-time codes, its own way of going offline. So a minor (0.x.0) is published only once
 * the real-device record names it: the day, both phones as they were, who checked, and that it passed. A patch holds
 * fixes alone and is not asked for one. The gate bites from 0.37.0 (`CHECKED_FROM`): 0.36.0, the minor the checklist came
 * in, was checked only by CI's phones (WebKit as an iPhone 14 with touch, Chromium at a phone's size), as no person could
 * check real phones for it.
 *
 * `node tools/release.mjs publish` and `tools/publish-packs.mjs` refuse a minor without it, in words that say what to do.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Where the checklist and its record are, from the workspace. */
export const DEVICES = 'docs/maintainers/real-devices.md';

/** The record's rows: `| 0.36.0 | 2026-11-02 | iPhone 15, iOS 26.0 | Pixel 8, Android 16, Chrome 141 | Ramy | passed |`. */
export function deviceRecord(text) {
  const at = text.indexOf('## The record');
  if (at === -1) return [];
  return text
    .slice(at)
    .split('\n')
    .filter((line) => /^\|\s*\d+\.\d+\.\d+\s*\|/.test(line))
    .map((line) => {
      const [version, date, iphone, android, by, result] = line.split('|').slice(1, -1).map((cell) => cell.trim());
      return { version, date, iphone, android, by, result };
    });
}

/**
 * The first minor that waits for a real iPhone and a real Android phone: 0.36.0, the minor the checklist came in, was
 * checked only by CI's phones — no person could check real ones for it.
 */
export const CHECKED_FROM = '0.37.0';

/** Whether version a comes before version b (x.y.z). */
const before = (a, b) => {
  const [x, y] = [a, b].map((one) => one.split('.').map(Number));
  for (let at = 0; at < 3; at++) if (x[at] !== y[at]) return x[at] < y[at];
  return false;
};

/** What a filled cell is: words, not a placeholder. */
const filled = (cell) => !!cell && !/^(—|-|–|tbd|todo|\.\.\.|…)$/i.test(cell);

/**
 * Why `version` may not be published as the record stands, or null: a minor from 0.37.0 on needs a row of its own,
 * dated, naming both phones and who checked them, that passed. A patch, and a minor before 0.37.0, is not asked.
 */
export function deviceCheckProblem(version, text) {
  const [, , patch] = version.split('.').map(Number);
  if (patch > 0 || before(version, CHECKED_FROM)) return null;
  const row = deviceRecord(text).find((one) => one.version === version);
  const todo = `run the checklist in ${DEVICES} on a real iPhone and a real Android phone, then add its row to the record`;
  if (!row) return `${version} is a minor, and no real iPhone and Android phone were checked for it: ${todo}`;
  const missing = [
    !/^\d{4}-\d{2}-\d{2}$/.test(row.date) && 'the day (YYYY-MM-DD)',
    !filled(row.iphone) && 'the iPhone',
    !filled(row.android) && 'the Android phone',
    !filled(row.by) && 'who checked',
  ].filter(Boolean);
  if (missing.length) return `the real-device record's row for ${version} does not say ${missing.join(', ')}: ${todo}`;
  if (!/^passed\b/i.test(row.result)) return `the real-device check of ${version} did not pass ("${row.result}"): fix what it found, check again, and record "passed"`;
  return null;
}

/** The problem, read from the workspace's own record. */
export const devicesProblem = (workspace, version) => deviceCheckProblem(version, readFileSync(join(workspace, DEVICES), 'utf8'));
