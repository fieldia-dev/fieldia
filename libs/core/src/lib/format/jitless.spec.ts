import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const EXAMPLES = join(__dirname, '..', '..', '..', '..', '..', 'examples', 'pages');

/**
 * A strict Content-Security-Policy refuses code made from text (no 'unsafe-eval'), and reports even a refusal that is
 * caught: Fieldia's format schemas — made, checking every example page, written as a JSON Schema — never ask for it.
 */
describe('the format schemas under a strict policy', () => {
  const real = globalThis.Function;
  let made: string[] = [];
  beforeEach(() => {
    made = [];
    // Every `new Function(…)` and `Function(…)` counted, as a policy would refuse each.
    globalThis.Function = new Proxy(real, {
      construct(target, args) {
        made.push(String(args[args.length - 1] ?? ''));
        return Reflect.construct(target, args);
      },
      apply(target, self, args) {
        made.push(String(args[args.length - 1] ?? ''));
        return Reflect.apply(target, self, args);
      },
    });
  });
  afterEach(() => {
    globalThis.Function = real;
  });

  it('makes no code from text as it loads, checks pages and writes the JSON Schema', async () => {
    let core!: typeof import('../../../src/index');
    let zod!: typeof import('zod');
    await jest.isolateModulesAsync(async () => {
      zod = await import('zod');
      core = await import('../../../src/index');
    });
    for (const file of readdirSync(EXAMPLES).filter((name) => name.endsWith('.json'))) core.validatePage(JSON.parse(readFileSync(join(EXAMPLES, file), 'utf8')));
    core.validatePage({ fieldia: '0.12', id: 'x', title: 'X', fields: { a: { type: 'char', label: 'A' } }, layout: { type: 'sections', id: 'r', children: [{ type: 'field', id: 'a', field: 'a' }] } });
    expect(core.pageJsonSchema()['$schema']).toBeTruthy();
    expect(made).toEqual([]);
    // zod's own setting given back once Fieldia's schemas are made: an app's schemas are as the app set them.
    await Promise.resolve();
    expect(zod.config().jitless).toBeFalsy();
    // An app's own object schema asks zod's question again, as zod does where no policy forbids it: what this test counts.
    zod.z.object({ name: zod.z.string() });
    expect(made).toEqual(['']);
  });
});
