import { join } from 'node:path';
import * as ts from 'typescript';

/**
 * Rule 1: `@fieldia/core` never touches the DOM.
 *
 * The compiler does the enforcing — `document` does not exist in the libs this
 * package compiles against, so a stray reference fails the build rather than
 * review. This spec keeps anyone from quietly widening those libs, in either
 * output format, to make an error go away.
 */
const PROJECT_ROOT = join(__dirname, '..', '..');

function resolvedOptions(configName: string): ts.CompilerOptions {
  const { config, error } = ts.readConfigFile(join(PROJECT_ROOT, configName), ts.sys.readFile);
  if (error) throw new Error(ts.flattenDiagnosticMessageText(error.messageText, '\n'));
  return ts.parseJsonConfigFileContent(config, ts.sys, PROJECT_ROOT).options;
}

describe('@fieldia/core is headless', () => {
  it.each(['tsconfig.lib.json', 'tsconfig.lib.esm.json'])('%s compiles without the DOM', (name) => {
    const options = resolvedOptions(name);
    expect(options.lib?.length).toBeGreaterThan(0);
    expect(options.lib?.filter((lib) => /dom/i.test(lib))).toEqual([]);
    expect(options.types).toEqual([]);
  });
});
