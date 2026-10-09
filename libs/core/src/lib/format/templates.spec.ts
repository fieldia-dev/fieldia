import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { checkPage } from './check-page';
import { THEMES } from './themes';
import { validatePage } from './validate';

/**
 * The template library, examples/templates: ready pages people start from.
 * Each one is listed once, passes the full check of the format, has its name
 * and its purpose in words, and wears the theme its listing names.
 */
const TEMPLATES = join(__dirname, '..', '..', '..', '..', '..', 'examples', 'templates');
const index = (): { id: string; name: string; group: string; theme: string; blurb: string }[] => JSON.parse(readFileSync(join(TEMPLATES, 'index.json'), 'utf8'));

describe('the template library', () => {
  it('lists every template once, and no template it does not have', () => {
    const files = readdirSync(TEMPLATES).filter((f) => f.endsWith('.page.json')).map((f) => f.replace('.page.json', '')).sort();
    const listed = index().map((t) => t.id);
    expect(new Set(listed).size).toBe(listed.length);
    expect([...listed].sort()).toEqual(files);
    expect(files.length).toBeGreaterThanOrEqual(16);
  });

  it('passes the full check, says what each is for, and wears its theme', () => {
    for (const entry of index()) {
      const page = JSON.parse(readFileSync(join(TEMPLATES, `${entry.id}.page.json`), 'utf8'));
      const full = validatePage(page);
      expect([entry.id, full.ok ? [] : full.issues]).toEqual([entry.id, []]);
      expect(checkPage(page).ok).toBe(true);
      expect(page.id).toBe(entry.id);
      expect(page.title).toBeTruthy();
      expect(page.description?.length).toBeGreaterThan(20);
      expect(entry.blurb.length).toBeGreaterThan(20);
      expect(THEMES).toContain(entry.theme);
      expect([entry.id, page.look?.theme]).toEqual([entry.id, entry.theme]);
    }
  });

  it('shows every theme at least once', () => {
    expect(new Set(index().map((t) => t.theme))).toEqual(new Set(THEMES));
  });
});
