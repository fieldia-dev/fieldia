import type { Field, FieldNode, Page } from '@fieldia/core';
import type { Designer } from './designer';

/**
 * Kinds of field an app adds to the designer's own — an IBAN, a product
 * code, a member number. Each is what a built-in kind is: the field a new
 * one starts as and the widget that draws it, with an icon for the toolbox,
 * settings of its own on the picked field, and how a closed card reads. A
 * field made as one is known again by its widget, so an app's kind must be
 * told apart from Fieldia's and from the app's others: these checks refuse
 * one that could not be, saying why.
 */

export interface AppKind {
  /** Its own id: never one of Fieldia's kinds. */
  id: string;
  label: string;
  /** The field a new one starts as. */
  field(label: string): Field;
  /** Its picture in the toolbox and the menus: SVG markup on a 24-unit grid, drawn in the text's colour, such as `<path d="…"/>`. */
  icon?: string;
  /** The toolbox group it is listed under: "Your kinds" unless it says. A group the toolbox has already takes it at its end. */
  group?: string;
  /** The widget that draws it, given to the editors and the viewer in `widgets` under `type.widget`. Its id when it says none. */
  widget?: string;
  /** Whether it can show a field that already holds data, such as one of the model's. Unless it says, a field of the type its own field has. */
  fits?(field: Field): boolean;
  /** Settings of its own: on the picked field, and on the Content tab of the screen editor's panel. */
  settings?(context: AppKindContext): AppKindSettings;
  /** How a closed survey card reads before anyone answers: words on a dotted line, or a drawing. Its real widget when it says none. */
  preview?: string | ((context: AppKindPreviewContext) => HTMLElement | null);
}

/** What an app's kind's settings are given. */
export interface AppKindContext {
  document: Document;
  /** The picked field's id on the page. */
  id: string;
  designer: Designer;
  /** Keep settings on the field's place on the page, where its widget reads them (`node.options`); `null` or empty takes one away. A run of typing in one is one undo step. */
  set(patch: Record<string, string | number | boolean | null>): boolean;
}

/** An app's kind's settings, drawn once and kept up to date. */
export interface AppKindSettings {
  element: HTMLElement;
  /** Show the field as it is now: called after every edit. */
  refresh(page: Page, node: FieldNode): void;
}

/** What draws a closed card of an app's kind. */
export interface AppKindPreviewContext {
  document: Document;
  page: Page;
  node: FieldNode;
}

/** The group an app's kind is listed under when it names none. */
export const APP_GROUP = 'Your kinds';

/** The widget an app's kind is drawn by: the one it names, or its id. */
export const widgetOf = (kind: AppKind): string => kind.widget?.trim() || kind.id;

/** A kind already known, as these checks need it: its id, its label and the widget that draws it. */
export interface KnownKind {
  id: string;
  label: string;
  widget?: string;
}

/**
 * Check an app's kinds against Fieldia's (`builtIn`) and the app's kinds
 * registered before (`others`, which these replace when they share an id).
 * Throws, saying why, for one that cannot be told apart.
 */
export function checkAppKinds(kinds: readonly AppKind[], builtIn: readonly KnownKind[], others: readonly KnownKind[] = []): void {
  const ids = new Set<string>();
  for (const kind of kinds) {
    if (!kind || typeof kind.id !== 'string' || !kind.id.trim() || typeof kind.label !== 'string' || !kind.label.trim() || typeof kind.field !== 'function') {
      throw new Error('An app’s kind needs an id, a label and a field');
    }
    if (builtIn.some((k) => k.id === kind.id)) throw new Error(`The kind “${kind.id}” is one of Fieldia’s own: give the app’s kind an id of its own`);
    if (ids.has(kind.id)) throw new Error(`Two of the app’s kinds have the id “${kind.id}”`);
    ids.add(kind.id);
    const widget = widgetOf(kind);
    const fieldia = builtIn.find((k) => k.widget === widget);
    if (fieldia) throw new Error(`The kind “${kind.id}” is drawn by “${widget}”, as Fieldia’s ${fieldia.label} is: give it a widget of its own`);
  }
  // Two drawn by one widget would be read back as the same kind.
  const drawn = [...others.filter((k) => !ids.has(k.id)), ...kinds.map((k) => ({ id: k.id, label: k.label, widget: widgetOf(k) }))];
  drawn.forEach((kind, i) => {
    const twin = drawn.slice(0, i).find((k) => k.widget === kind.widget);
    if (twin) throw new Error(`“${twin.id}” and “${kind.id}” are both drawn by the widget “${kind.widget}”: give each a widget of its own`);
  });
}
