import type { ActionRequest, ActionResult, MemoryDataSourceOptions, Page } from '@fieldia/core';

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
  /** The app's answer to one of its own actions: undefined when this lane does not know the action. */
  action?: (request: ActionRequest, locale?: string) => ActionResult | undefined | Promise<ActionResult | undefined>;
}

export const emptyLane = (): RealLane => ({ pages: {} });
