import { createWidget, lazyPart, partFactory, type WidgetFactory } from '@fieldia/widgets';

/**
 * The widgets of a package only some pages use — ag-Grid's table of lines, CodeMirror's code box — fetched the first
 * time a page draws one, as an app's bundler leaves a screen's code to the screens that show it: a page of customers
 * never fetches a grid. Each is a part (`lazyPart`, `partFactory`): the viewer asks for it with the page's own parts
 * before it draws the page (`partsFor`), so the widget is drawn whole at once; one made before it came, by something
 * that did not wait for it, is Fieldia's own for its field until it comes. `names` are the widgets the package gives,
 * by `type.widget`.
 */
export function lazyWidgets<M>(name: string, load: () => Promise<M>, names: readonly string[], widgetsOf: (module: M) => Record<string, WidgetFactory>): Record<string, WidgetFactory> {
  const part = lazyPart(name, load);
  const plain: WidgetFactory = (context) => createWidget(context, {});
  return Object.fromEntries(names.map((widget) => [widget, partFactory(part, (module) => widgetsOf(module)[widget] ?? plain, plain)]));
}

/** A table of lines in ag-Grid (`"widget": "grid"` on a one2many): @fieldia/grid, with ag-Grid itself. */
export const gridWidgets = lazyWidgets('grid', () => import('@fieldia/grid'), ['one2many.grid'], (module) => module.gridWidgets);

/** Code in CodeMirror (`"widget": "code"` on a json, text or char field): @fieldia/code, with CodeMirror. */
export const codeWidgets = lazyWidgets('code', () => import('@fieldia/code'), ['json.code', 'text.code', 'char.code'], (module) => module.codeWidgets);
