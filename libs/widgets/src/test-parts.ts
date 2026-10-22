import { formApprovalsPart, formLimitsPart, functionsPart, optionRulesPart } from '@fieldia/core';
import { quietPart, themesPart } from './lib/look-parts';
import { businessPart, choicePart, codesPart, datePart, pinsPart, monthsPart, typedPart, evidencePart, filesPart, languagesPart, linesPart, pathPart, recordPart, phonePart, photosPart, relationsPart, scanPart, schedulePart, slotsPart, surveyPart, textPart } from './lib/widget-parts';

/**
 * The widgets' parts (parts.ts), and the form's, in before each file's tests, as a page has them
 * once they have come: their widgets drawn whole at once. A `*-lazy.spec.ts`
 * file starts without them, to test what a page does before they come.
 */
if (!/-lazy\.spec\.ts$/.test(expect.getState().testPath ?? '')) beforeAll(() => Promise.all([textPart.load(), pathPart.load(), choicePart.load(), datePart.load(), monthsPart.load(), typedPart.load(), linesPart.load(), businessPart.load(), filesPart.load(), evidencePart.load(), photosPart.load(), recordPart.load(), codesPart.load(), pinsPart.load(), surveyPart.load(), phonePart.load(), slotsPart.load(), schedulePart.load(), relationsPart.load(), languagesPart.load(), scanPart.load(), themesPart.load(), quietPart.load(), functionsPart.load(), formLimitsPart.load(), optionRulesPart.load(), formApprovalsPart.load()]));
