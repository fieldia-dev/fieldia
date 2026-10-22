import type { Page } from '../format/page';
import { lazyPart, type Part } from '../parts';
import type * as SurveyFlowModule from './surveyflow-part';

/** The survey flow's form code (surveyflow-part.ts). */
export type FormSurveyPart = typeof SurveyFlowModule;

/**
 * A survey's flow, the form's code of it — a quiz's results marked as its answers go, the order drawn for each
 * respondent, a page's time limits (survey-kit.ts) — loaded by a form whose page has any (`surveyFlow`), and before such
 * a page is drawn: in the one-tag script, one script with the viewer's (fieldia.surveyflow.js).
 */
export const formSurveyPart: Part<FormSurveyPart> = lazyPart('surveyflow', () => import('./surveyflow-part'));

/**
 * Whether a page goes through a survey's flow: a quiz, a review before sending, one question at a time, a time limit, or
 * a part that draws its order or some of its questions. What each of them asks is the part's to tell.
 */
export const surveyFlow = (page: Page): boolean => !!(page.quiz || page.review || page.flow || page.timeLimit) || /"order":"random"|"(draw|timeLimit)":/.test(JSON.stringify(page.layout));
