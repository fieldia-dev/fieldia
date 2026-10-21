import type { Field, Option } from '../format/field';
import type { Page } from '../format/page';
import type { Value, Values } from './values';

/**
 * A quiz's results (`quiz` on a page): each question asked marked — right or wrong where it has right answers, its
 * points of its most — and the score of them all. The form works them out as the answers are sent (`state.sent.quiz`),
 * unless the app's source answered the send with its own (`SubmitResult.quiz`): a test that keeps its right answers out
 * of the page marks them on its server.
 */
export interface QuizResults {
  /** The points earned, of the most the questions asked could earn. */
  score: number;
  max: number;
  /** Each question asked that earns points or has right answers, in the order it was asked. */
  questions: QuizMark[];
}

/** One question's mark. */
export interface QuizMark {
  field: string;
  /** Its points, of its most. */
  points: number;
  max: number;
  /** Right or wrong where the question has right answers; null for one of points alone (its options' `score`). */
  right: boolean | null;
  /** Whether it was answered at all. */
  answered: boolean;
  /** The right answer, as a value of the field (a list of them for several), where the page shows it: for one answered wrongly or not at all. */
  rightAnswer?: Value;
  /** The question's own words for its answer: its feedback when right, or when wrong. */
  feedback?: string;
}

/** Sums of tenths and the like without a computer's crumbs: 0.1 + 0.2 is 0.3. */
const tidy = (n: number) => Math.round(n * 1e9) / 1e9;
const empty = (value: unknown) => value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0);
/** A word as a person may write it: its case and the spaces round and inside it aside. */
const plain = (value: unknown) => String(value).trim().replace(/\s+/g, ' ').toLocaleLowerCase();

/** What a question's quiz says, by its kind: its right answers and points, or null for a question that is none. */
function quizOf(def: Field | undefined): { options: readonly Option[] | null; answers: readonly (string | number)[] | null; several: boolean } | null {
  if (!def) return null;
  if (def.type === 'selection') {
    const marked = def.options.some((option) => option.correct === true || option.score !== undefined);
    return marked ? { options: def.options, answers: null, several: def.multiple === true } : null;
  }
  if ((def.type === 'char' || def.type === 'integer' || def.type === 'float') && def.quiz?.answers?.length) return { options: null, answers: def.quiz.answers, several: false };
  return null;
}

/** Whether a typed answer is one the question takes: a number by its value, words whatever their case and spaces. */
function takes(answers: readonly (string | number)[], value: unknown, numeric: boolean): boolean {
  if (empty(value)) return false;
  if (numeric) return answers.some((answer) => Number(answer) === Number(value));
  return answers.some((answer) => plain(answer) === plain(value));
}

/**
 * A quiz's results for the answers sent, in the order the questions were asked (`asked`, the fields whose answers were
 * sent: a question not shown, its step skipped, is none). Null where no question asked earns points or has right
 * answers.
 */
export function quizResults(page: Page, values: Values, asked: readonly string[] = Object.keys(values)): QuizResults | null {
  const each = page.quiz?.points ?? 1;
  const showRight = page.quiz?.rightAnswers !== false;
  const questions: QuizMark[] = [];
  for (const field of asked) {
    const def = page.fields[field];
    const quiz = quizOf(def);
    if (!quiz || !def) continue;
    const answer = values[field];
    const answered = !empty(answer);
    const worth = (def as { quiz?: { points?: number } }).quiz?.points ?? each;
    let points = 0;
    let max = 0;
    let right: boolean | null = null;
    let rightAnswer: Value | undefined;
    if (quiz.options) {
      const chosen: unknown[] = quiz.several ? (Array.isArray(answer) ? answer : []) : answered ? [answer] : [];
      const scored = quiz.options.some((option) => option.score !== undefined);
      const correct = quiz.options.filter((option) => option.correct === true);
      if (correct.length) {
        // Several: right when exactly the right ones are chosen; one: right when the one chosen is a right one.
        right = quiz.several ? chosen.length === correct.length && correct.every((option) => chosen.includes(option.value)) : chosen.length === 1 && correct.some((option) => option.value === chosen[0]);
        rightAnswer = quiz.several ? correct.map((option) => option.value) : correct[0].value;
      }
      if (scored) {
        // Points by the options chosen, as `scoreOf` counts them: the best of one, every one worth something of several.
        points = chosen.reduce((sum: number, value) => sum + (quiz.options?.find((option) => option.value === value)?.score ?? 0), 0);
        max = quiz.several ? quiz.options.reduce((sum, option) => sum + Math.max(0, option.score ?? 0), 0) : quiz.options.reduce((most, option) => Math.max(most, option.score ?? 0), 0);
      } else {
        points = right ? worth : 0;
        max = worth;
      }
    } else if (quiz.answers) {
      right = takes(quiz.answers, answer, def.type !== 'char');
      points = right ? worth : 0;
      max = worth;
      rightAnswer = quiz.answers[0];
    }
    const feedback = right === null ? undefined : (def as { quiz?: { feedback?: { right?: string; wrong?: string } } }).quiz?.feedback?.[right ? 'right' : 'wrong'];
    questions.push({
      field,
      points: tidy(points),
      max: tidy(max),
      right,
      answered,
      ...(right === false && showRight && rightAnswer !== undefined ? { rightAnswer } : {}),
      ...(feedback ? { feedback } : {}),
    });
  }
  if (!questions.length) return null;
  return { score: tidy(questions.reduce((sum, mark) => sum + mark.points, 0)), max: tidy(questions.reduce((sum, mark) => sum + mark.max, 0)), questions };
}
