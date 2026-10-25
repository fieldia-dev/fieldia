import { optionRulesPart } from './lib/format/choice-options';
import { functionsPart } from './lib/expression/functions';
import { formLimitsPart } from './lib/record/taking';
import { formApprovalsPart } from './lib/record/approving';
import { formLanguagesPart } from './lib/record/languages';
import { formUploadsPart } from './lib/record/uploads';
import { formSurveyPart } from './lib/record/survey';
import { formJoins } from './lib/record/joins';
import { recordLivePart } from './lib/record/live-later';
import { pressUndoPart } from './lib/record/undo-later';
import { wordsReady } from './lib/record/words-chunks';

/**
 * The form's parts (lib/parts.ts) in before each file's tests, as a page has them once they have come: a formula's
 * every function, a page's limits, its options by condition, a record made live, a press said with Undo, a record's approvals, a text's languages, the uploads' work, a survey's code, and the parts that join a form — its link's fields, its
 * codes asked, its payment, its outbox — at once. A `*-lazy.spec.ts` file starts without them, to test what a form does
 * before they come.
 * Arabic's, German's and French's words, which come in chunks of their own (`wordsReady`), are in too, as on a page
 * shown in one once they have come.
 */
if (!/-lazy\.spec\.ts$/.test(expect.getState().testPath ?? '')) beforeAll(() => Promise.all([functionsPart.load(), formLimitsPart.load(), optionRulesPart.load(), formApprovalsPart.load(), formLanguagesPart.load(), formUploadsPart.load(), formSurveyPart.load(), ...formJoins().map((part) => part.load()), recordLivePart.load(), pressUndoPart.load(), ...['ar', 'de', 'fr'].map(wordsReady)]));
