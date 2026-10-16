/** The page format version this build reads and writes. */
export const FORMAT_VERSION = '0.3' as const;

/**
 * Every format Fieldia has had, oldest first; the last is FORMAT_VERSION. A page in an older one is brought up to date
 * by `upgradePage`, step by step (`PAGE_UPGRADES`), wherever it is read: `checkPage`, `validatePage`, the viewer, the
 * designer. A release that changes what a page may say adds its version here (see the format's docs, "Versions").
 */
export const FORMAT_VERSIONS = ['0.1', '0.2', '0.3'] as const satisfies readonly string[];

/** A format Fieldia has had: a page may say any of them, and is read in the current one. */
export type FormatVersion = (typeof FORMAT_VERSIONS)[number];

/** `major.minor` as two numbers, or null when it is not a version at all. */
function parts(version: unknown): [number, number] | null {
  const match = typeof version === 'string' ? /^(\d+)\.(\d+)$/.exec(version) : null;
  return match ? [Number(match[1]), Number(match[2])] : null;
}

/** Which of two format versions is newer: below 0 when `a` is older, 0 when they are the same, null when either is not a version. */
export function compareFormats(a: unknown, b: unknown): number | null {
  const [x, y] = [parts(a), parts(b)];
  if (!x || !y) return null;
  return x[0] - y[0] || x[1] - y[1];
}

/**
 * What is wrong with a page's `fieldia`, in words, or null when it is the current format. A page newer than this
 * build says to update Fieldia; an older one, that `upgradePage` brings it up to date (the checks do that themselves).
 */
export function formatProblem(version: unknown, versions: readonly string[] = FORMAT_VERSIONS): string | null {
  const current = versions[versions.length - 1];
  if (version === current) return null;
  const compared = compareFormats(version, current);
  if (compared === null) return `"fieldia" says which format the page is written in: "${current}" for this Fieldia`;
  if (compared > 0) return `this page is in format ${version as string}, newer than this Fieldia reads (${current}): update Fieldia to show it`;
  if (versions.includes(version as string)) return `this page is in format ${version as string}: upgradePage(page) brings it to ${current}`;
  return `format ${version as string} is not one Fieldia has had: this Fieldia reads ${current}`;
}
