import { checkPageFiles, pageFiles, resultLines } from './check-pages';

const USAGE = 'usage: fieldia-check <pages or folders…> [--functions name,name] [--strict]';

/**
 * `fieldia-check`'s work, given its arguments and where its lines go: 0 when every page is valid, 1 when one is
 * refused (with `--strict`, when one has warnings too), 2 when it was asked wrongly.
 */
export function runCheck(args: readonly string[], say: (line: string) => void = console.log, complain: (line: string) => void = console.error): number {
  const paths: string[] = [];
  const functions: string[] = [];
  let strict = false;
  let help = false;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--strict') strict = true;
    else if (arg === '--functions') functions.push(...(args[++i] ?? '').split(',').map((name) => name.trim()).filter(Boolean));
    else if (arg === '--help' || arg === '-h') help = true;
    else paths.push(arg);
  }
  if (help || !paths.length) {
    say(USAGE);
    return help ? 0 : 2;
  }
  try {
    const results = checkPageFiles(pageFiles(paths), { functions });
    for (const line of resultLines(results)) say(line);
    return results.some((result) => !result.ok || (strict && result.warnings.length)) ? 1 : 0;
  } catch (error) {
    complain(`fieldia-check: ${(error as Error).message}`);
    return 2;
  }
}
