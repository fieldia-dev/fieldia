import type { Field } from './field';
import type { Page } from './page';

/** What a page's survey settings are checked with: the reference check's own report. */
export interface FlowTools {
  report(path: string, message: string): void;
  /** Said where checks come in a part that has not come (the one-tag script's: later-checks.ts): they are owed. */
  owe(part: string): void;
}

/** Whether a field asks a quiz's question: a choice with right answers or points, or a question typed with the answers it takes. */
const quizQuestion = (field: Field): boolean =>
  field.type === 'selection' ? field.options.some((option) => option.correct === true || option.score !== undefined) : (field.type === 'char' || field.type === 'integer' || field.type === 'float') && !!field.quiz?.answers?.length;

/**
 * A page's survey settings: a quiz (`quiz`) on a page of responses; each question's own `quiz` — the answers a typed one takes (numbers for a number), feedback only where there is a
 * right answer to tell right from wrong, never on a line's field. In the one-tag script they come with the survey
 * part, which a page with any asks for: run once it came (later-checks.ts).
 */
export function checkSurveyFlow(page: Page, tools: FlowTools): void {
  const report = (path: string, message: string) => tools.report(path, message);
  // A quiz with no question to mark yet is one being made: it shows no results until one has right answers or points.
  if (page.quiz !== undefined && page.data.kind !== 'responses') report('quiz', 'a quiz’s results are for a page of responses, shown once its answers are sent');
  if (page.review !== undefined && page.review !== false && (page.data.kind !== 'responses' || page.layout.type === 'list')) report('review', 'a review before sending is for a page of responses: a record is saved as it is changed');
  if (page.flow !== undefined && (page.data.kind !== 'responses' || page.layout.type === 'list' || page.layout.type === 'sheet')) report('flow', 'one question at a time is for a page of responses in sections or steps: a record’s sheet shows its fields together');
  for (const [name, field] of Object.entries(page.fields)) {
    if (field.type === 'one2many') {
      for (const [column, sub] of Object.entries(field.fields)) if ((sub as { quiz?: unknown }).quiz !== undefined) report(`fields.${name}.fields.${column}.quiz`, 'a quiz’s question is a page’s own field, not a column of a table');
      continue;
    }
    const quiz = (field as { quiz?: { answers?: unknown[]; feedback?: unknown } }).quiz;
    if (quiz === undefined) continue;
    const at = `fields.${name}.quiz`;
    if (page.quiz === undefined) report(at, 'a question’s quiz is shown by the page’s: give the page "quiz": {} to show the results');
    if (field.type === 'selection' && quiz.answers !== undefined) report(`${at}.answers`, 'a choice’s right answers are its options marked "correct"');
    if ((field.type === 'integer' || field.type === 'float') && quiz.answers?.some((answer) => typeof answer !== 'number' || !Number.isFinite(answer))) report(`${at}.answers`, 'a number’s answers are numbers');
    if (quiz.feedback !== undefined && !quizQuestion(field)) report(`${at}.feedback`, 'feedback is said for a right or a wrong answer: give the question its right answers first');
    else if (quiz.feedback !== undefined && field.type === 'selection' && !field.options.some((option) => option.correct === true)) report(`${at}.feedback`, 'feedback is said for a right or a wrong answer: mark the right options "correct"');
  }
}
