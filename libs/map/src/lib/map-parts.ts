import { lazyPart, wordsReady, type FormState, type ListMap, type Part } from '@fieldia/core';
import type { ListViewContext, ListViewFactory, ListViewPart, MapPart, MapPartContext, MapPartFactory } from '@fieldia/viewer';
import { startLoading, type Wait } from '@fieldia/widgets';
import type * as FormMapModule from './form-part';
import type * as ListMapModule from './view-part';
import type * as WidgetsModule from './widgets-part';
import { loadLeaflet } from './leaflet';
import type { MapSettings } from './settings';

/**
 * @fieldia/map's own code in parts, each fetched the first time a page shows what it draws (0.35), as the calendar's
 * view and Leaflet are: a list's map (`mapViewPart`), a form's map (`formMapPart`), and the place, area and address
 * fields (`mapWidgetsPart`). With the page come only what says there is a map and asks for its part — the providers,
 * the kinds the designer offers, the words — so a page with no map never carries a map's code. A field's part is asked
 * for with the page's own parts, and the page drawn once it has come (`mapWidgets`, through `partFactory`); a list's map
 * and a form's hold their place, waiting as the page says they wait the first time, with Leaflet asked for beside them,
 * and draw in it once their code has come. Each is a module of its own, so a bundler gives it a chunk of its own.
 */
export const mapViewPart: Part<typeof ListMapModule> = lazyPart('mapview', () => import('./view-part'));
export const formMapPart: Part<typeof FormMapModule> = lazyPart('formmap', () => import('./form-part'));
export const mapWidgetsPart: Part<typeof WidgetsModule> = lazyPart('mapwidgets', () => import('./widgets-part'));

/**
 * A list's records on a map, for the viewer's `listViews`: the list's own
 * search and its chosen records, shared with the table. A pin lights its row
 * and a row its pin; a pin opens a card with the record's picture, a few of
 * its fields, a box to choose it and a button to open it. Pins that crowd
 * become a bubble with their count. After the map is moved, "Search this
 * area" puts the area into the search bar, as the person's own search. A
 * source that gathers them itself (`clusters`) is asked for the view's
 * bubbles instead of loading the records: every record a search finds.
 * Its code comes the first time one is shown (`mapViewPart`).
 *
 *     mountViewer(host, { page, listViews: mapListViews({ provider }) })
 */
export function mapListViews(settings: MapSettings): Record<string, ListViewFactory> {
  return { map: (context) => (mapViewPart.loaded ? mapViewPart.loaded.listMap(settings, context) : lazyListMap(settings, context)) };
}

/**
 * A map on a form (`type: "map"`), for the viewer's `maps`: the record's
 * places as layers. A layer is the record's own place (a kitchen, a door, a
 * courier), a place for each of its lines (a round's stops), a route along
 * the roads between them, or the reader's own place. Pins are drawn as a
 * list's map draws them, and gathered as it gathers them when they crowd. A
 * place that moves glides to each new position —
 * along its route when it is on one — says when it was last seen once its
 * news is old, and is followed until the person moves the map. A route's
 * part already travelled fades, and its time and distance left are written
 * into the record's fields the page names. Areas are shaded by colour, one
 * chosen by a press; a reachable area follows its place; a fence runs the
 * page's steps when a place that moves goes into an area or out of it.
 *
 * Its code comes the first time one is shown (`formMapPart`).
 *
 *     mountViewer(host, { page, maps: mapParts({ provider }) })
 */
export function mapParts(settings: MapSettings): MapPartFactory {
  return (context) => (formMapPart.loaded ? formMapPart.loaded.formMap(settings, context) : lazyFormMap(settings, context));
}

/** How tall a list's map is, as it says: its own pixels, the room it is put in, else as the window allows. */
export const listMapHeight = (spec: ListMap): string => (spec.height === 'fill' ? '100%' : typeof spec.height === 'number' ? `${spec.height}px` : 'clamp(320px, 64vh, 640px)');

/**
 * A map's place while its code comes: as tall as the map will be, waiting the first time as the page says (a skeleton
 * block as big as the map unless said), Leaflet asked for beside its code — in the browser alone, as ever — and a code
 * that cannot come said there with the page's own words for a failure.
 */
function holding<P>(doc: Document, height: string, wait: { part: string; loading: ListViewContext['loading']; locale: string }, part: Part<unknown>, draw: (now: boolean) => P, show: (element: HTMLElement, drawn: P) => void) {
  const element = doc.createElement('div');
  element.className = 'fd-map-holder';
  element.style.minHeight = height === '100%' ? '' : height;
  if (height === '100%') element.style.height = '100%';
  const coming: Wait = startLoading(element, 'first', wait.loading, {
    part: wait.part,
    shape: {
      // As big as the map, as the map's own first wait draws it once its code came: never a bar across its top, then a
      // block (0.35.1, the walk on Slow 4G) — the map's stylesheet comes with its code, so it is sized here.
      show: () => {
        const block = Object.assign(doc.createElement('span'), { className: 'fd-sk fd-sk-block' });
        Object.assign(block.style, { margin: '0', blockSize: height === '100%' ? '100%' : height, borderRadius: 'var(--fd-control-radius, 6px)' });
        element.append(block);
      },
      hide: () => element.querySelector(':scope > .fd-sk-block')?.remove(),
    },
  });
  if (doc.defaultView) void loadLeaflet().catch(() => undefined);
  let gone = false;
  let drawn: P | null = null;
  // Its code, then its own words in the page's language: the part's tables are the maps' (labels.ts), asked for as it came.
  const ready = part.load().then(() => wordsReady(wait.locale)).then(
    () => {
      if (gone) return null;
      const now = coming.shown;
      coming.stop();
      drawn = draw(now);
      element.style.minHeight = '';
      show(element, drawn);
      return drawn;
    },
    (error: unknown) => {
      if (!gone) coming.fail(error);
      return null;
    }
  );
  return {
    element,
    ready,
    get drawn() {
      return drawn;
    },
    leave() {
      gone = true;
      coming.stop();
    },
  };
}

function lazyListMap(settings: MapSettings, context: ListViewContext): ListViewPart {
  const spec = context.node.map as ListMap;
  const held = holding(context.document, listMapHeight(spec), { part: `${context.node.id}-map`, loading: context.loading, locale: context.locale }, mapViewPart, (now) => (mapViewPart.loaded as typeof ListMapModule).listMap(settings, context, now), (element, part) => element.replaceChildren(part.element));
  return {
    element: held.element,
    reload: () => held.ready.then((part) => part?.reload()),
    highlight: (id) => held.drawn?.highlight(id),
    chosenChanged: () => held.drawn?.chosenChanged(),
    shown: () => void held.ready.then((part) => part?.shown()),
    destroy() {
      held.leave();
      held.drawn?.destroy();
    },
  };
}

function lazyFormMap(settings: MapSettings, context: MapPartContext): MapPart {
  let state: FormState | null = null;
  const held = holding(context.document, `${context.node.height ?? 360}px`, { part: context.node.id, loading: context.loading, locale: context.locale }, formMapPart, (now) => (formMapPart.loaded as typeof FormMapModule).formMap(settings, context, now), (element, part) => {
    element.replaceChildren(part.element);
    // The form as it is now, given meanwhile.
    if (state) part.update(state);
  });
  return {
    element: held.element,
    update(next) {
      state = next;
      held.drawn?.update(next);
    },
    destroy() {
      held.leave();
      held.drawn?.destroy?.();
    },
  };
}
