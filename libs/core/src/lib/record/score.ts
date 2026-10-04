import type { Option } from '../format/field';
import type { Page } from '../format/page';
import type { Values } from './values';

/**
 * A quiz's points. Each option may carry a `score`; the answers earn the
 * scores of the options chosen — the one of a single choice, every one of
 * several, the column chosen in each row of a matrix — out of the most they
 * could earn: the best option of a single choice, every option worth
 * something of several, the best column of each row. An answer in one's own
 * words, or none, earns nothing. Only questions with points count; a page
 * with none has no score.
 */

export interface Score {
  score: number;
  max: number;
}

/** Sums of tenths and the like without a computer's crumbs: 0.1 + 0.2 is 0.3. */
const tidy = (n: number) => Math.round(n * 1e9) / 1e9;

const pointsOf = (options: readonly Option[], value: unknown) => options.find((o) => o.value === value)?.score ?? 0;
const best = (options: readonly Option[]) => options.reduce((most, o) => Math.max(most, o.score ?? 0), 0);
const allWorth = (options: readonly Option[]) => options.reduce((sum, o) => sum + Math.max(0, o.score ?? 0), 0);
/** The points of the options a single or a several answer chose. */
const earned = (options: readonly Option[], answer: unknown, several: boolean) =>
  several ? (Array.isArray(answer) ? answer.reduce((sum: number, v) => sum + pointsOf(options, v), 0) : 0) : pointsOf(options, answer);

export function scoreOf(page: Page, values: Values): Score | null {
  let score = 0;
  let max = 0;
  let scored = false;
  for (const [name, field] of Object.entries(page.fields)) {
    if (field.type === 'selection' && field.options.some((o) => o.score !== undefined)) {
      scored = true;
      const several = field.multiple === true;
      score += earned(field.options, values[name], several);
      max += several ? allWorth(field.options) : best(field.options);
    } else if (field.type === 'matrix' && field.columns.some((c) => c.score !== undefined)) {
      scored = true;
      const several = field.multiple === true;
      const answers = values[name];
      const byRow = answers && typeof answers === 'object' && !Array.isArray(answers) ? (answers as Record<string, unknown>) : {};
      for (const row of field.rows) {
        score += earned(field.columns, byRow[String(row.value)], several);
        max += several ? allWorth(field.columns) : best(field.columns);
      }
    }
  }
  return scored ? { score: tidy(score), max: tidy(max) } : null;
}
