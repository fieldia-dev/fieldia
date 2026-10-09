import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { panel } from './panel';

/**
 * Every setting the panels draw has its Arabic name: the panel, and Find
 * anything with it, show a name with none in English.
 */
describe('the settings’ Arabic names', () => {
  it('cover every setting a panel draws', () => {
    const lib = join(__dirname, '..', '..');
    const names = new Set<string>();
    for (const file of readdirSync(lib).filter((f) => f.endsWith('.ts') && !f.endsWith('.spec.ts'))) {
      for (const [, name] of readFileSync(join(lib, file), 'utf8').matchAll(/\bsetting\(el, '[a-z]+', '([^']+)'/g)) names.add(name);
    }
    expect(names.size).toBeGreaterThan(20);
    expect([...names].filter((name) => panel.settingName(name) === name)).toEqual([]);
  });
});
