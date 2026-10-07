import type { ActionRequest, ActionResult, MemoryDataSourceOptions, Page } from '@fieldia/core';
import { lane as accounting } from './accounting';
import { lane as crm } from './crm';
import type { RealLane } from './lane';
import { lane as legal } from './legal';
import { lane as operations } from './operations';
import { lane as people } from './people';
import { lane as sales } from './sales';

const LANES: RealLane[] = [sales, accounting, crm, people, operations, legal];

/** Maps by model then key, put together: a later lane adds to a model, never replaces one. */
function byModel<T>(pick: (lane: RealLane) => Record<string, Record<string, T>> | undefined): Record<string, Record<string, T>> {
  const all: Record<string, Record<string, T>> = {};
  for (const lane of LANES) for (const [model, rows] of Object.entries(pick(lane) ?? {})) all[model] = { ...all[model], ...rows };
  return all;
}

/** Every lane's real pages, records and answers, as the demos take them. */
export const real = {
  pages: Object.assign({}, ...LANES.map((lane) => lane.pages)) as Record<string, Page>,
  opened: Object.assign({}, ...LANES.map((lane) => lane.opened ?? {})) as Record<string, Page>,
  related: Object.assign({}, ...LANES.map((lane) => lane.related ?? {})) as Record<string, Page>,
  records: byModel((lane) => lane.records) as NonNullable<MemoryDataSourceOptions['records']>,
  onchange: byModel((lane) => lane.onchange) as NonNullable<MemoryDataSourceOptions['onchange']>,
  warnings: byModel((lane) => lane.warnings) as NonNullable<MemoryDataSourceOptions['warnings']>,
  lists: Object.assign({}, ...LANES.map((lane) => lane.lists ?? {})) as NonNullable<MemoryDataSourceOptions['lists']>,
  labelField: Object.assign({}, ...LANES.map((lane) => lane.labelField ?? {})) as NonNullable<MemoryDataSourceOptions['labelField']>,
  shows: byModel((lane) => lane.shows as Record<string, Record<string, unknown>> | undefined) as NonNullable<MemoryDataSourceOptions['shows']>,
  definitions: Object.assign({}, ...LANES.map((lane) => lane.definitions ?? {})) as NonNullable<MemoryDataSourceOptions['definitions']>,
  attachments: Object.assign({}, ...LANES.map((lane) => lane.attachments ?? {})) as NonNullable<MemoryDataSourceOptions['attachments']>,
  users: Object.assign({}, ...LANES.map((lane) => lane.users ?? {})) as NonNullable<RealLane['users']>,
  navigation: Object.assign({}, ...LANES.map((lane) => lane.navigation ?? {})) as NonNullable<RealLane['navigation']>,
  /**
   * The first lane that knows the action answers it. A lane may answer later,
   * and "later, nothing" is not knowing it either: the next lane is asked.
   */
  async action(request: ActionRequest, locale?: string): Promise<ActionResult | undefined> {
    for (const lane of LANES) {
      const answer = await lane.action?.(request, locale);
      if (answer !== undefined) return answer;
    }
    return undefined;
  },
};
