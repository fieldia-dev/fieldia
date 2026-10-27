import { DEFAULT_CHANGES } from './default-changes';
import { checkPage } from './check-page';
import { validatePage } from './validate';
import { lowestFormat } from './stamp';
import { compareFormats, FORMAT_VERSIONS } from './version';

/**
 * Each default that changed between formats is listed with the setting that keeps the old way (the audit's R-M8),
 * and that setting is the format's: a page that says it reads in both checks, needs the format the default changed in
 * at the most — the setting was there by then — and the list is in the order the formats came.
 */
describe('the defaults that changed between formats', () => {
  it.each(DEFAULT_CHANGES.map((change) => [change.format, change] as const))('format %s: what keeps the old way is a setting a page reads', (_, change) => {
    expect(FORMAT_VERSIONS).toContain(change.format);
    expect(change.now.length).toBeGreaterThan(20);
    expect(change.before.length).toBeGreaterThan(5);
    if (change.keep === null) return expect(change.example).toBeNull();
    expect(change.example).not.toBeNull();
    expect(validatePage(change.example).ok).toBe(true);
    expect(checkPage(change.example).ok).toBe(true);
    expect(compareFormats(lowestFormat(change.example), change.format)).toBeLessThanOrEqual(0);
  });

  it('come in the order of the formats', () => {
    const formats = DEFAULT_CHANGES.map((change) => change.format);
    expect([...formats].sort((a, b) => compareFormats(a, b) ?? 0)).toEqual(formats);
  });
});
