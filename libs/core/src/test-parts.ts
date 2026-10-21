import { optionRulesPart } from './lib/format/choice-options';
import { functionsPart } from './lib/expression/functions';
import { formLimitsPart } from './lib/record/taking';
import { formSurveyPart } from './lib/record/survey';

/**
 * The form's parts (lib/parts.ts) in before each file's tests, as a page has them once they have come: a formula's
 * every function, a page's limits, its options by condition, a survey's code, at once. A `*-lazy.spec.ts` file starts without them, to test what a form does before they come.
 */
if (!/-lazy\.spec\.ts$/.test(expect.getState().testPath ?? '')) beforeAll(() => Promise.all([functionsPart.load(), formLimitsPart.load(), optionRulesPart.load(), formSurveyPart.load()]));
