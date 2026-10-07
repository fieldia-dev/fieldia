import type { ActionRequest, ActionResult, FormUser, MemoryDataSourceOptions, Page } from '@fieldia/core';

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
  /** Properties' definitions a linked record keeps, by the list's name (a properties field's definitionsFrom). */
  definitions?: MemoryDataSourceOptions['definitions'];
  /** What a link shows of a model's records besides their names, by model: a picture, a colour, lines under it. */
  shows?: MemoryDataSourceOptions['shows'];
  /** Which value names a record of a model in search results, when not `name`. */
  labelField?: MemoryDataSourceOptions['labelField'];
  /** The app's answer to one of its own actions: undefined when this lane does not know the action. */
  action?: (request: ActionRequest, locale?: string) => ActionResult | undefined | Promise<ActionResult | undefined>;
  /**
   * What the app tells the viewer as a page opens, by the `?page=` name: the
   * person using it and the roles (Flectra's groups) they hold, the records
   * round this one for the pager, and the trail back to their list.
   */
  around?: Record<string, RealAround>;
}

/** The person, the pager's records and the breadcrumbs an app gives a real page. */
export interface RealAround {
  user?: FormUser;
  records?: (string | number)[];
  breadcrumbs?: { label: string; href?: string }[];
}

export const emptyLane = (): RealLane => ({ pages: {} });
