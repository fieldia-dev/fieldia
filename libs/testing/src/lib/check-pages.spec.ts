import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkPageFiles, pageFiles, resultLines } from './check-pages';
import { runCheck } from './cli-run';

/**
 * `fieldia-check`: stored pages checked as Fieldia reads them — every example page of this repository valid, a broken
 * one refused with where and why, the app's own functions named, and the command's exit as CI reads it.
 */

const EXAMPLES = join(__dirname, '..', '..', '..', '..', 'examples', 'pages');

const good = {
  fieldia: '0.10',
  id: 'visit',
  title: 'Visit',
  data: { kind: 'responses' },
  fields: { name: { type: 'char', label: 'Name' }, total: { type: 'float', label: 'Total', compute: 'vat(10)' } },
  layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'f-name', field: 'name' }, { type: 'field', id: 'f-total', field: 'total' }] },
};

describe('fieldia-check', () => {
  let folder = '';
  beforeEach(() => {
    folder = mkdtempSync(join(tmpdir(), 'fieldia-check-'));
  });
  afterEach(() => rmSync(folder, { recursive: true, force: true }));

  it("finds every page in a folder and the folders in it, and every one of the repository's examples is valid", () => {
    const files = pageFiles([EXAMPLES]);
    expect(files.length).toBeGreaterThan(50);
    // The listing's price per m² is worked out by the app's own function, which the demos give it.
    const refused = checkPageFiles(files, { functions: ['districtPrice'] }).filter((result) => !result.ok);
    expect(refused).toEqual([]);
  });

  it('refuses a broken page, saying where and why, and a file that is not JSON', () => {
    mkdirSync(join(folder, 'more'));
    writeFileSync(join(folder, 'broken.page.json'), JSON.stringify({ ...good, layout: { ...good.layout, children: [{ type: 'field', id: 'f-x', field: 'nowhere' }] } }));
    writeFileSync(join(folder, 'more', 'cut.json'), '{ "fieldia": ');
    writeFileSync(join(folder, 'notes.txt'), 'not a page');
    const results = checkPageFiles(pageFiles([folder]), { functions: ['vat'] });
    expect(results.map((result) => [result.file.slice(folder.length + 1), result.ok])).toEqual([
      ['broken.page.json', false],
      ['more/cut.json', false],
    ]);
    expect(results[0].problems.map((problem) => problem.message).join(' ')).toContain('nowhere');
    expect(results[1].problems[0].message).toMatch(/^not JSON/);
    const lines = resultLines(results);
    expect(lines[0]).toBe(`✗ ${join(folder, 'broken.page.json')}`);
    expect(lines.at(-1)).toBe('2 pages checked: 2 refused.');
  });

  it("knows the app's own functions only when told their names", () => {
    writeFileSync(join(folder, 'visit.json'), JSON.stringify(good));
    expect(checkPageFiles([join(folder, 'visit.json')])[0].ok).toBe(false);
    expect(checkPageFiles([join(folder, 'visit.json')], { functions: ['vat'] })[0].ok).toBe(true);
  });

  it('says each page and exits 1 when one is refused, 0 when all are valid, 2 when asked wrongly, as CI reads it', () => {
    writeFileSync(join(folder, 'visit.json'), JSON.stringify(good));
    const run = (...args: string[]) => {
      const said: string[] = [];
      const code = runCheck(args, (line) => said.push(line), (line) => said.push(line));
      return { code, said };
    };
    expect(run(folder, '--functions', 'vat')).toEqual({ code: 0, said: [`✓ ${join(folder, 'visit.json')}`, '1 page checked: all valid.'] });
    expect(run(folder).code).toBe(1);
    expect(run().code).toBe(2);
    expect(run('--help').code).toBe(0);
    expect(run(join(folder, 'missing')).said[0]).toMatch(/^fieldia-check: ENOENT/);
  });
});
