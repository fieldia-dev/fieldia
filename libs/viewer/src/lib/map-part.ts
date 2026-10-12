import type { Form, FormState, Locale, MapNode, Page } from '@fieldia/core';
import type { IconSet } from '@fieldia/widgets';

/**
 * A map on a form (`type: "map"`), as the app's maps draw it: @fieldia/map's
 * `mapParts`. The viewer gives it its node, the form and the page's
 * language, and hands it each new state of the form: a position changed, a
 * line added, a route's numbers written.
 */
export interface MapPartContext {
  node: MapNode;
  page: Page;
  form: Form;
  document: Document;
  locale: Locale;
  icons?: IconSet;
}

export interface MapPart {
  element: HTMLElement;
  /** The form changed: the record's places, lines and values as they now are. */
  update(state: FormState): void;
  destroy?(): void;
}

export type MapPartFactory = (context: MapPartContext) => MapPart;
