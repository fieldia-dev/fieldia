import { optionRulesPart } from './lib/format/choice-options';
import { functionsPart } from './lib/expression/functions';
import { formLimitsPart } from './lib/record/taking';
import { prefillPart } from './lib/record/prefill';
import { formVerifyPart } from './lib/record/verify';
import { formPayPart } from './lib/record/payment';

/**
 * The form's parts (lib/parts.ts) in before each file's tests, as a page has them once they have come: a formula's
 * every function, a page's limits, its options by condition, its link's fields, its codes asked, its payment, at once. A `*-lazy.spec.ts` file starts without them, to test what a form does before they come.
 */
if (!/-lazy\.spec\.ts$/.test(expect.getState().testPath ?? '')) beforeAll(() => Promise.all([functionsPart.load(), formLimitsPart.load(), optionRulesPart.load(), prefillPart.load(), formVerifyPart.load(), formPayPart.load()]));
