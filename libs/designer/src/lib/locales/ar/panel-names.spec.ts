import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { panel } from './panel';
import { panel as es } from '../es/panel';
import { panel as fa } from '../fa/panel';
import { panel as tr } from '../tr/panel';
import { panel as ur } from '../ur/panel';

/**
 * Every setting the panels draw has its Arabic name: the panel, and Find
 * anything with it, show a name with none in English. The unreviewed
 * languages (Spanish, Persian, Turkish, Urdu) name every one too.
 */
describe('the settings’ Arabic names', () => {
  const lib = join(__dirname, '..', '..');
  const names = new Set<string>();
  for (const file of readdirSync(lib).filter((f) => f.endsWith('.ts') && !f.endsWith('.spec.ts'))) {
    const source = readFileSync(join(lib, file), 'utf8');
    for (const [, name] of source.matchAll(/\bsetting\(el, '[a-z]+', '([^']+)'/g)) names.add(name);
    // Settings named from a table of their own (a wait's moments: `NAMES[moment]`).
    for (const [, table] of source.matchAll(/const NAMES: Record<[A-Za-z]+, string> = \{([^}]+)\}/g)) {
      for (const [, name] of table.matchAll(/: '([^']+)'/g)) names.add(name);
    }
  }

  it('cover every setting a panel draws', () => {
    expect(names.size).toBeGreaterThan(20);
    expect(names.has('Loading: drawn the first time')).toBe(true);
    expect([...names].filter((name) => panel.settingName(name) === name)).toEqual([]);
  });

  it.each([['es', es], ['fa', fa], ['tr', tr], ['ur', ur]])('are in %s for every setting too', (_, words) => {
    expect([...names].filter((name) => words.settingName(name) === name)).toEqual([]);
  });
});
