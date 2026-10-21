/**
 * The viewer's survey part (viewer-parts.ts, `surveyFlowPart`): what a survey shows besides its questions — a quiz's
 * results under the thanks (quiz-results.ts), a review of the answers before they are sent (survey-flow.ts) — with its
 * sheet (flow-styles.ts). Loaded with the page's other parts, before it is drawn, where the page has a `quiz` or a
 * `review`; in the one-tag script, one script with the survey kinds' widgets and
 * the form's survey code (fieldia.survey.js).
 */
export { drawQuizResults, showQuiz } from './quiz-results';
export { installFlowStyles } from './flow-styles';
export { surveyFlow, flows } from './survey-flow';
export { oneAtATime } from './flow-one';
export { timeKeeper } from './flow-timer';
