import { expect, test } from '@playwright/test';
import { lane as accounting } from '../demos/shared/real/accounting';
import { lane as crm } from '../demos/shared/real/crm';
import { lane as legal } from '../demos/shared/real/legal';
import type { RealLane } from '../demos/shared/real/lane';
import { lane as operations } from '../demos/shared/real/operations';
import { lane as people } from '../demos/shared/real/people';
import { lane as sales } from '../demos/shared/real/sales';

/**
 * The real pages' lanes share one demo app: a record, a page or a related
 * page two lanes give under one name would be replaced by the later lane's,
 * and one lane's page would quietly show the other's names.
 */
const LANES: Record<string, RealLane> = { sales, accounting, crm, people, operations, legal };

test('no two lanes give the same record, page or related page differently', () => {
  const clashes: string[] = [];
  const records = new Map<string, { lane: string; row: string }>();
  for (const [name, lane] of Object.entries(LANES)) {
    for (const [model, rows] of Object.entries(lane.records ?? {})) {
      for (const [id, row] of Object.entries(rows)) {
        const key = `${model} #${id}`;
        const first = records.get(key);
        if (first && first.row !== JSON.stringify(row)) clashes.push(`${key}: ${first.lane} and ${name}`);
        else if (!first) records.set(key, { lane: name, row: JSON.stringify(row) });
      }
    }
    for (const kind of ['pages', 'opened', 'related'] as const) {
      for (const key of Object.keys(lane[kind] ?? {})) {
        const other = Object.entries(LANES).find(([n, l]) => n !== name && Object.keys(l[kind] ?? {}).includes(key) && n < name);
        if (other) clashes.push(`${kind} ${key}: ${other[0]} and ${name}`);
      }
    }
  }
  expect(clashes).toEqual([]);
});
