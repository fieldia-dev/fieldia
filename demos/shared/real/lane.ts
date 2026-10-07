import type { ActionRequest, ActionResult, FormUser, MemoryDataSourceOptions, Page, RecordId } from '@fieldia/core';

/**
 * One lane of the real pages: Sherkety ERP's own screens, rebuilt in Fieldia
 * with their real fields, layout, buttons and sample records. Each lane keeps
 * its pages, records and the app's answers in its own file; index.ts puts the
 * lanes together for every framework's demo.
 */
export interface RealLane {
  /** The pages the gallery shows, by the `?page=` name. */
  pages: Record<string, Page>;
  /** Pages a step opens, by their id. */
  opened?: Record<string, Page>;
  /** A link's record page, by its model: Create and edit…, and the ↗. */
  related?: Record<string, Page>;
  /** Sample records by model, then by id. */
  records?: MemoryDataSourceOptions['records'];
  /** What the server works out as fields change, by model then field. */
  onchange?: MemoryDataSourceOptions['onchange'];
  warnings?: MemoryDataSourceOptions['warnings'];
  lists?: MemoryDataSourceOptions['lists'];
  /** Which value names a record of a model in search results, when not `name`. */
  labelField?: MemoryDataSourceOptions['labelField'];
  /** What a link shows of a model's records besides their names: a picture, a colour, lines, a folded stage. */
  shows?: MemoryDataSourceOptions['shows'];
  /** Properties' definitions kept on linked records, by the list's name. */
  definitions?: MemoryDataSourceOptions['definitions'];
  /** Each record's attachments, its main one first, by `model:id`. */
  attachments?: MemoryDataSourceOptions['attachments'];
  /** The person using a page, by page id, and the roles they hold — Flectra's groups: the one its view was read for. */
  users?: Record<string, FormUser>;
  /** Around a page's record, by page id: the records of the list it was opened from, and the trail to it. */
  navigation?: Record<string, { records: RecordId[]; breadcrumbs: { label: string; href?: string }[] }>;
  /** The app's answer to one of its own actions: undefined when this lane does not know the action. */
  action?: (request: ActionRequest, locale?: string) => ActionResult | undefined | Promise<ActionResult | undefined>;
}

export const emptyLane = (): RealLane => ({ pages: {} });
