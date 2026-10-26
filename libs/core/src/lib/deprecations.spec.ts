import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deprecated, DEPRECATIONS } from './deprecations';
import { checkPage } from './format/check-page';
import { validatePage } from './format/validate';
import { createForm } from './record/form';
import type { Page } from './format/page';

/**
 * A deprecation said once in a page, in the console, by what uses it (docs/maintainers/release-train.md): never twice,
 * and never by a page or a form that uses only what stays. tools/release-train.test.mjs holds every call to the list.
 */
const EXAMPLES = join(__dirname, '..', '..', '..', '..', 'examples', 'pages');
const SAID = Symbol.for('fieldia.deprecations.said');

describe('deprecated', () => {
  let warn: jest.SpyInstance;
  beforeEach(() => {
    delete (globalThis as { [SAID]?: Set<string> })[SAID];
    warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => warn.mockRestore());

  it('says a deprecated use once in a page, with what changes, when, and where to read more', () => {
    expect(deprecated('test.old-way', 'the old way is going: write the new way', '0.99')).toBe(true);
    expect(deprecated('test.old-way', 'the old way is going: write the new way', '0.99')).toBe(false);
    expect(deprecated('test.old-way', 'said again', '0.99')).toBe(false);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toBe('Fieldia: the old way is going: write the new way — deprecated, it changes in 0.99 (test.old-way; https://fieldia.dev/promises/#deprecations).');
    // Another deprecation is said in its turn, once.
    expect(deprecated('test.other-way', 'another way is going', '0.99')).toBe(true);
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it('once in a page however many copies of Fieldia it carries: what was said is kept on the page itself', () => {
    deprecated('test.shared', 'one copy said it', '0.99');
    expect((globalThis as { [SAID]?: Set<string> })[SAID]?.has('test.shared')).toBe(true);
    // A second copy of the module reads the same set.
    jest.isolateModules(() => {
      const again = jest.requireActual<typeof import('./deprecations')>('./deprecations');
      expect(again.deprecated('test.shared', 'another copy', '0.99')).toBe(false);
    });
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('a page that uses only what stays is never told of a deprecation: every example checked, validated and made a form', () => {
    const names = readdirSync(EXAMPLES).filter((name) => name.endsWith('.page.json'));
    expect(names.length).toBeGreaterThan(100);
    let made = 0;
    for (const name of names) {
      const page = JSON.parse(readFileSync(join(EXAMPLES, name), 'utf8')) as Page;
      validatePage(page);
      // A page whose formulas call an app's own functions is made a form by that app alone.
      if (!checkPage(page).ok) continue;
      createForm({ page }).dispose();
      made++;
    }
    expect(made).toBeGreaterThan(100);
    const told = warn.mock.calls.map((call) => String(call[0])).filter((words) => words.includes('deprecated'));
    expect(told).toEqual([]);
  });

  it('the list is plain data, and each entry warns a minor before it changes', () => {
    expect(JSON.parse(JSON.stringify(DEPRECATIONS))).toEqual(DEPRECATIONS);
    for (const entry of DEPRECATIONS) expect(Number(entry.changesIn.split('.')[1])).toBeGreaterThan(Number(entry.since.split('.')[1]));
  });
});
