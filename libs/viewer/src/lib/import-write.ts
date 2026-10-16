import { newRecordSave, saveProblemOf, type DataSource, type Fields, type RecordId, type SaveProblem, type Values } from '@fieldia/core';

/**
 * The rows of a file that passed their check, written as new records (a
 * list's Import): by the source's `createMany`, a few hundred at a time, or
 * by a save of each as a new record, a few at once — how far it has got said
 * as it goes, and stopped between two of them when the person says Stop.
 * What the source refuses is named by its row, with why. Undo deletes the
 * records it made, through the source's `delete`, and names those it could
 * not.
 */

/** Records made by one `createMany` call. */
const CREATE_AT_ONCE = 500;
/** Records saved, or deleted, at once, one by one. */
const AT_ONCE = 4;

export interface ImportWrite {
  model: string;
  fields: Fields;
  dataSource: DataSource;
  /** Why a record the source left unanswered was not made, in the person's words. */
  notMade: string;
}

/** A row to write: its number in the file, and its record's values. */
export interface RowToWrite {
  number: number;
  values: Values;
}

/** What was written: the records made, by their rows; the rows the source refused, with why; whether Stop ended it. */
export interface Written {
  made: { number: number; id: RecordId }[];
  failed: { number: number; why: string }[];
  stopped: boolean;
}

/** Why the source refused a record, as a person reads it: a field's own words, else the source's. */
export const whyRefused = (problem: SaveProblem): string => Object.values(problem.fields ?? {})[0] ?? problem.message;

/** Whether the source can make records at all, one way or the other. */
export const canWrite = (source: DataSource | undefined): source is DataSource => !!(source?.createMany || source?.save);

/** The rows written as new records, in their order, `progress` told after each call or save. */
export async function writeRows(how: ImportWrite, rows: readonly RowToWrite[], progress: (done: number, total: number) => void, stopped: () => boolean = () => false): Promise<Written> {
  const { model, fields, dataSource: source } = how;
  const made: Written['made'] = [];
  const failed: Written['failed'] = [];
  let done = 0;
  const tell = () => progress(done, rows.length);
  tell();
  if (source.createMany) {
    for (let at = 0; at < rows.length && !stopped(); at += CREATE_AT_ONCE) {
      const some = rows.slice(at, at + CREATE_AT_ONCE);
      try {
        const answer = await source.createMany({ model, fields, records: some.map((row) => row.values) });
        some.forEach((row, i) => {
          const one = answer.records[i];
          if (one && 'id' in one) made.push({ number: row.number, id: one.id });
          else failed.push({ number: row.number, why: one ? (one.problem ? whyRefused(one.problem) : one.message) : how.notMade });
        });
      } catch (error) {
        // The whole call failed (the network): none of these was made.
        const why = whyRefused(saveProblemOf(error));
        for (const row of some) failed.push({ number: row.number, why });
      }
      done += some.length;
      tell();
    }
  } else if (source.save) {
    const save = source.save.bind(source);
    let next = 0;
    const one = async () => {
      while (next < rows.length && !stopped()) {
        const row = rows[next++];
        try {
          const answer = await save(newRecordSave(model, fields, row.values));
          made.push({ number: row.number, id: answer.id });
        } catch (error) {
          failed.push({ number: row.number, why: whyRefused(saveProblemOf(error)) });
        }
        done++;
        tell();
      }
    };
    await Promise.all(Array.from({ length: Math.min(AT_ONCE, rows.length) }, one));
  }
  // In the file's order, whichever save answered first.
  made.sort((a, b) => a.number - b.number);
  failed.sort((a, b) => a.number - b.number);
  return { made, failed, stopped: done < rows.length };
}

/** The records an import made, deleted again: how many went, and those that did not, with why. */
export async function deleteRecords(how: ImportWrite, ids: readonly RecordId[], progress: (done: number, total: number) => void): Promise<{ done: number; failed: { id: RecordId; why: string }[] }> {
  const { model, fields, dataSource: source } = how;
  const failed: { id: RecordId; why: string }[] = [];
  let done = 0;
  let next = 0;
  // Offered only where the source can delete.
  const remove = (source.delete as NonNullable<DataSource['delete']>).bind(source);
  const one = async () => {
    while (next < ids.length) {
      const id = ids[next++];
      try {
        await remove({ model, id, fields });
        done++;
      } catch (error) {
        failed.push({ id, why: whyRefused(saveProblemOf(error)) });
      }
      progress(done + failed.length, ids.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(AT_ONCE, ids.length) }, one));
  const place = new Map(ids.map((id, i) => [String(id), i]));
  failed.sort((a, b) => (place.get(String(a.id)) as number) - (place.get(String(b.id)) as number));
  return { done, failed };
}
