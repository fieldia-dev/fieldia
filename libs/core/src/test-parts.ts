import { functionsPart } from './lib/expression/functions';

/**
 * The form's parts (lib/parts.ts) in before each file's tests, as a page has them once they have come: a formula's
 * every function at once. A `*-lazy.spec.ts` file starts without them, to test what a form does before they come.
 */
if (!/-lazy\.spec\.ts$/.test(expect.getState().testPath ?? '')) beforeAll(() => Promise.all([functionsPart.load()]));
