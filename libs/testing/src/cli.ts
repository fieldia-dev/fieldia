#!/usr/bin/env node
import { runCheck } from './lib/cli-run';

/**
 * `fieldia-check` — stored Fieldia pages checked as Fieldia reads them, for CI:
 *
 *   npx fieldia-check pages/ [more files or folders…] [--functions vat,fx] [--strict]
 *
 * Exits 1 when a page is refused (with `--strict`, when one has warnings too), 2 when it was asked wrongly.
 */
process.exitCode = runCheck(process.argv.slice(2));
