import type { Field, LineField } from './field';

/** An option's places are counted for a page's own choice: never a table's line's, which `limits` is not asked of. */
export function checkSeats(def: Field | LineField, path: string, lines: string | undefined, report: (path: string, message: string) => void): void {
  if (!lines || def.type !== 'selection') return;
  def.options?.forEach((option, i) => {
    if (option.seats !== undefined) report(`${path}.options[${i}].seats`, `places are counted for the page’s own choices: a line of "${lines}" is not asked of the data source’s limits`);
  });
}
