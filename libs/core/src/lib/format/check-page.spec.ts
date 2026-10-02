import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { checkPage } from './check-page';
import { validatePage } from './validate';

const EXAMPLES = join(__dirname, '..', '..', '..', '..', '..', 'examples', 'pages');
const example = (name: string): Record<string, any> => JSON.parse(readFileSync(join(EXAMPLES, `${name}.page.json`), 'utf8'));
const paths = (input: unknown) => {
  const result = checkPage(input);
  return result.ok ? [] : result.issues.map((issue) => issue.path);
};

describe('checkPage', () => {
  it('passes every example page, as the full check does, and hands the page back unchanged', () => {
    for (const name of readdirSync(EXAMPLES).filter((f) => f.endsWith('.page.json')).map((f) => f.replace('.page.json', ''))) {
      const page = example(name);
      const result = checkPage(page);
      expect(result.ok).toBe(true);
      expect(validatePage(page).ok).toBe(true);
      expect(result.ok && result.page).toBe(page);
    }
  });

  it('finds what the full check finds about names and conditions', () => {
    const page = example('customer');
    page['layout'].children[0].children[1].field = 'nickname';
    page['layout'].children[0].children[2].invisible = 'ghost_field';
    const light = checkPage(page);
    const full = validatePage(page);
    expect(light.ok).toBe(false);
    expect(!light.ok && light.issues).toEqual(!full.ok && full.issues);
  });

  it('says where a page’s outline is wrong', () => {
    expect(paths('not a page')).toEqual(['(page)']);
    const page = example('signup');
    page['fieldia'] = '9.9';
    page['data'] = { kind: 'record' };
    page['fields'].full_name = { type: 'shout', label: 'Full name' };
    page['layout'] = { type: 'grid', id: 'x', children: [] };
    expect(paths(page)).toEqual(['fieldia', 'data', 'fields.full_name', 'layout']);
  });

  it('reports a part it cannot read instead of throwing', () => {
    const page = example('signup');
    delete page['layout'].children[0].children;
    expect(() => checkPage(page)).not.toThrow();
    expect(checkPage(page).ok).toBe(false);
  });
});
