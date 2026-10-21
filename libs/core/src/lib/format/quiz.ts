import * as z from 'zod';

/**
 * A quiz: a page of responses whose questions have right answers or points, and whose results the person sees
 * (`quiz` on a page). A choice's right answers are its options marked `correct`; a question typed — a word, a number —
 * names the answers it takes (`quiz.answers` on its field). Each right answer earns the question's points (`quiz.points`
 * on its field, else the page's, else 1); a choice whose options carry points (`score`) earns those, as before. Once
 * the answers are sent the person sees their score and each question's answer marked right or wrong, the right answer
 * to one they missed and the question's own feedback — or, with `results: "later"`, that their results come once their
 * answers are reviewed.
 *
 *   "quiz": { "results": "now", "points": 1 }
 *   "fields": { "reversible": { "type": "selection", "label": "Which filler can be dissolved?",
 *     "options": [{ "value": "ha", "label": "Hyaluronic acid", "correct": true }, { "value": "caha", "label": "Calcium hydroxylapatite" }],
 *     "quiz": { "feedback": { "right": "Yes: hyaluronidase dissolves it.", "wrong": "Only hyaluronic acid: hyaluronidase dissolves it." } } } }
 *
 * The right answers travel in the page, where a person who reads its JSON finds them. A test where that matters keeps
 * them out of the page and marks the answers on the app's server: its source answers the send with the results
 * (`SubmitResult.quiz`), and the page shows those.
 */
export interface PageQuiz {
  /** When the person sees their results: as the answers are sent (`now`, the default), or later, once the app has reviewed them. */
  results?: 'now' | 'later';
  /** What a right answer earns where its question says nothing: 1 unless said. */
  points?: number;
  /** Whether a question answered wrongly shows its right answer: true unless false. */
  rightAnswers?: boolean;
}

export const PageQuizSchema = z
  .strictObject({
    results: z.enum(['now', 'later']).optional(),
    points: z.number().positive().max(1000).optional(),
    rightAnswers: z.boolean().optional(),
  })
  .meta({ id: 'PageQuiz' });

/** What a question of a quiz says of itself (`quiz` on its field): its points, the answers it takes, its feedback. */
export interface QuizQuestion {
  /** What a right answer earns: the page's `quiz.points` (1 unless said) where left out. */
  points?: number;
  /**
   * A question typed rather than chosen — a word, a number — and the answers it takes: a word as written, whatever its
   * case and the spaces round it; a number as its value.
   */
  answers?: (string | number)[];
  /** Words shown under the question in the results: when its answer was right, and when it was wrong or missing. */
  feedback?: { right?: string; wrong?: string };
}

export const QuizQuestionSchema = z
  .strictObject({
    points: z.number().positive().max(1000).optional(),
    answers: z.array(z.union([z.string().regex(/\S/, 'an answer is words or a number'), z.number()])).min(1).max(50).optional(),
    feedback: z
      .strictObject({
        right: z.string().regex(/\S/, 'feedback is words').max(2000).optional(),
        wrong: z.string().regex(/\S/, 'feedback is words').max(2000).optional(),
      })
      .optional(),
  })
  .meta({ id: 'QuizQuestion' });
