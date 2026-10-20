import type { Field, LineField } from './field';
import type { Page } from './page';
import { limitInstant } from '../record/taking';

type Report = (path: string, message: string) => void;

/**
 * A page's `limits`: on a page of responses, saying something — when it opens or closes, its most responses, one per
 * person — each day a day there is, closing after it opens. And `continueLater`: a page a person types in, never a
 * list of records.
 */
export function checkLimits(page: Page, report: Report): void {
  if (page.continueLater !== undefined && page.layout.type === 'list') report('continueLater', 'Continue later keeps a person’s answers as they type them: a list of records has none to keep');
  const limits = page.limits;
  if (limits === undefined) return;
  if (page.data.kind !== 'responses') report('limits', 'open and close dates and limits are for a page of responses — a sign-up, a survey, an offer; a choice’s places are its options’ seats on any page');
  if (limits.opens === undefined && limits.closes === undefined && limits.maxResponses === undefined && limits.onePerPerson !== true) report('limits', 'say when it opens or closes, the most responses it takes, or that it takes one from each person');
  const opens = limits.opens !== undefined ? limitInstant(limits.opens, page.timeZone) : null;
  const closes = limits.closes !== undefined ? limitInstant(limits.closes, page.timeZone, true) : null;
  for (const [key, written, at] of [['opens', limits.opens, opens], ['closes', limits.closes, closes]] as const) {
    if (written === undefined) continue;
    const day = written.slice(0, 10);
    const [y, m, d] = day.split('-').map(Number);
    const real = new Date(Date.UTC(y, m - 1, d));
    if (at === null || real.getUTCMonth() !== m - 1 || real.getUTCDate() !== d) report(`limits.${key}`, `${day} is no day of the calendar`);
  }
  if (opens !== null && closes !== null && closes <= opens) report('limits.closes', 'it closes before it opens: closes comes after opens');
}

/** An option's places are counted for a page's own choice: never a table's line's, which `limits` is not asked of. */
export function checkSeats(def: Field | LineField, path: string, lines: string | undefined, report: Report): void {
  if (!lines || def.type !== 'selection') return;
  def.options?.forEach((option, i) => {
    if (option.seats !== undefined) report(`${path}.options[${i}].seats`, `places are counted for the page’s own choices: a line of "${lines}" is not asked of the data source’s limits`);
  });
}
