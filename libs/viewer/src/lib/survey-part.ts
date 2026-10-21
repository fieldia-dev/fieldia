/**
 * The viewer's survey part (viewer-parts.ts, `surveyFlowPart`): what a survey shows besides its questions — a quiz's
 * results under the thanks (quiz-results.ts) — with its sheet (flow-styles.ts). Loaded with the page's other parts,
 * before it is drawn, where the page has a `quiz`; in the one-tag script, one script with the survey kinds' widgets and
 * the form's survey code (fieldia.survey.js).
 */
export { drawQuizResults, showQuiz } from './quiz-results';
export { installFlowStyles } from './flow-styles';
