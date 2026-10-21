import type { Page } from '../format/page';
import { lazyPart, type Part } from '../parts';
import type * as SurveyModule from './survey-part';

/** The survey part's form code (survey-part.ts). */
export type FormSurveyPart = typeof SurveyModule;

/**
 * A form's survey code — a quiz's results worked out as its answers go, the order drawn for each respondent — loaded by
 * a form whose page needs it
 * (`surveyFlow`), and before such a page is drawn: in the one-tag script, one script with the survey kinds and the
 * viewer's survey part (fieldia.survey.js).
 */
export const formSurveyPart: Part<FormSurveyPart> = lazyPart('survey', () => import('./survey-part'));

/** Whether a page of responses draws its order, or some of its questions, for each respondent (`order: "random"`, `draw`). */
export const drawsOrder = (page: Page): boolean => page.data.kind === 'responses' && /"(order":"random|draw":)/.test(JSON.stringify(page.layout));

/** Whether a page's form needs the survey part's code: a quiz whose results the person sees, a draw. */
export const surveyFlow = (page: Page): boolean => !!page.quiz || drawsOrder(page);
