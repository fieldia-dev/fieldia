import { formApprovalsPart, formLimitsPart, functionsPart, optionRulesPart } from '@fieldia/core';
import { quietPart, themesPart } from './lib/look-parts';
import { businessPart, choicePart, datePart, evidencePart, filesPart, linesPart, pathPart, phonePart, relationsPart, slotsPart, surveyPart, textPart } from './lib/widget-parts';

/**
 * The widgets' parts (parts.ts), and the form's, in before each file's tests, as a page has them
 * once they have come: their widgets drawn whole at once. A `*-lazy.spec.ts`
 * file starts without them, to test what a page does before they come.
 */
if (!/-lazy\.spec\.ts$/.test(expect.getState().testPath ?? '')) beforeAll(() => Promise.all([textPart.load(), pathPart.load(), choicePart.load(), datePart.load(), linesPart.load(), businessPart.load(), filesPart.load(), evidencePart.load(), surveyPart.load(), phonePart.load(), slotsPart.load(), relationsPart.load(), themesPart.load(), quietPart.load(), functionsPart.load(), formLimitsPart.load(), optionRulesPart.load(), formApprovalsPart.load()]));
