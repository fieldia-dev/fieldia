import { optionRulesPart } from './lib/format/choice-options';
import { functionsPart } from './lib/expression/functions';
import { formLimitsPart } from './lib/record/taking';
import { formApprovalsPart } from './lib/record/approving';
import { formLanguagesPart } from './lib/record/languages';
import { formUploadsPart } from './lib/record/uploads';
import { formSurveyPart } from './lib/record/survey';
import { formJoins } from './lib/record/joins';

/**
 * The form's parts (lib/parts.ts) in before each file's tests, as a page has them once they have come: a formula's
 * every function, a page's limits, its options by condition, a record's approvals, a text's languages, the uploads' work, a survey's code, and the parts that join a form — its link's fields, its
 * codes asked, its payment, its outbox — at once. A `*-lazy.spec.ts` file starts without them, to test what a form does
 * before they come.
 */
if (!/-lazy\.spec\.ts$/.test(expect.getState().testPath ?? '')) beforeAll(() => Promise.all([functionsPart.load(), formLimitsPart.load(), optionRulesPart.load(), formApprovalsPart.load(), formLanguagesPart.load(), formUploadsPart.load(), formSurveyPart.load(), ...formJoins().map((part) => part.load())]));
