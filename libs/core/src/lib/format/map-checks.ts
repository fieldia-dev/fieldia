import type { ActionStep } from './actions';
import type { Field, LineField } from './field';
import type { FieldNode, MapCard, MapNode, Pin } from './layout';
import type { Page } from './page';
import type { Scope } from './references';

/**
 * The checks of a map — a form's (`type: "map"`), and where a list's records are on one (`map`, list-checks.ts): its
 * layers, places, routes, reachable areas and fences, and the fields a pin and a card show — and of an address with
 * suggestions (`address-search`). A map is drawn by the app's
 * maps (@fieldia/map); in the one-tag script its checks come in a part of their own a page with a map asks for, run
 * once it came (later-checks.ts). The packages' checks run them at once.
 */
/** Whether a record holds a key of its own. */
const has = (record: object, key: string) => Object.prototype.hasOwnProperty.call(record, key);

export interface MapTools {
  readonly page: Page;
  need(name: string, path: string, scope?: Record<string, Field | LineField>): Field | LineField | undefined;
  report(path: string, message: string): void;
  checkModifiers(owner: object, path: string, keys?: readonly string[], scope?: Scope): void;
  checkSteps(steps: ActionStep[], path: string): void;
  /** Where the page's own expressions read. */
  here(): Scope;
  /** Said where checks come in a part that has not come (the one-tag script's): they are owed. */
  owe(part: string): void;
}

/**
 * Where a place is kept, and the fields its pin and its card show, each of a
 * type that can: a page's fields, or a line's when the place is a line's.
 */
export function checkPlace(at: { point?: string; latitude?: string; longitude?: string }, path: string, scope: Scope, pin: Pin | undefined, card: MapCard | undefined, tools: MapTools): void {
  const typed = (name: string | undefined, where: string, ok: (type: string) => boolean, says: string) => {
    if (name === undefined) return;
    const def = tools.need(name, where, scope.fields);
    if (def && !ok(def.type)) tools.report(where, `"${name}" is a ${def.type}; ${says}`);
  };
  const number = (type: string) => type === 'float' || type === 'integer';
  const picture = (type: string) => type === 'image' || type === 'binary';
  typed(at.point, `${path}.point`, (type) => type === 'json', 'a point is kept in a json field');
  typed(at.latitude, `${path}.latitude`, number, 'a latitude is a number field (float or integer)');
  typed(at.longitude, `${path}.longitude`, number, 'a longitude is a number field (float or integer)');
  if (pin) {
    typed(pin.image, `${path}.pin.image`, picture, "a pin's photo is an image or binary field");
    typed(pin.turn, `${path}.pin.turn`, number, 'a turn is a number field, in degrees');
    if (pin.iconField !== undefined) tools.need(pin.iconField, `${path}.pin.iconField`, scope.fields);
    if (pin.label !== undefined) tools.need(pin.label, `${path}.pin.label`, scope.fields);
    pin.tones?.forEach((tone, i) => tools.checkModifiers(tone, `${path}.pin.tones[${i}]`, ['when'], scope));
    pin.money?.per?.forEach((item, i) => tools.checkModifiers(item, `${path}.pin.money.per[${i}]`, ['when'], scope));
  }
  if (card) {
    if (card.title !== undefined) tools.need(card.title, `${path}.card.title`, scope.fields);
    typed(card.image, `${path}.card.image`, picture, "a card's picture is an image or binary field");
    // A line is a part, or several on one line; a part a field's name, or a field with its words.
    card.fields?.forEach((line, i) =>
      (Array.isArray(line) ? line : [line]).forEach((part, j) => {
        const at = `${path}.card.fields[${i}]${Array.isArray(line) ? `[${j}]` : ''}${typeof part === 'string' ? '' : '.field'}`;
        tools.need(typeof part === 'string' ? part : part.field, at, scope.fields);
      })
    );
    typed(card.href, `${path}.card.href`, (type) => type === 'char' || type === 'text', "a card's link is a text field holding a web address");
  }
}

/**
 * A form's map: each layer one kind — the record's place, a place for each
 * of its lines, a route between layers, or the reader's own place — its
 * fields where that kind keeps them, and a route's ends layers it can join.
 */
export function checkMap(node: MapNode, path: string, tools: MapTools): void {
  const layers = new Map<string, { lines: boolean; place: boolean }>();
  node.layers.forEach((layer, i) => {
    const at = `${path}.layers[${i}]`;
    if (layers.has(layer.id)) tools.report(`${at}.id`, `two layers are called "${layer.id}"`);
    const pair = layer.latitude !== undefined || layer.longitude !== undefined;
    const placed = layer.point !== undefined || pair;
    const kinds = [placed, !!layer.route, !!layer.myLocation, !!layer.regions, !!layer.reachable].filter(Boolean).length;
    if (kinds !== 1) tools.report(at, 'a layer is one of: a place (point, or latitude and longitude, for the record or for each of its lines), a route, myLocation, regions, or reachable');
    if (layer.regions?.choose !== undefined) tools.need(layer.regions.choose, `${at}.regions.choose`);
    if (layer.point !== undefined && pair) tools.report(at, 'a layer takes point, or latitude and longitude, not both');
    else if (layer.point === undefined && pair && (layer.latitude === undefined || layer.longitude === undefined)) tools.report(at, 'a layer needs both latitude and longitude');
    if (layer.lines !== undefined && !placed) tools.report(`${at}.lines`, "a layer of lines needs where each line is: point, or latitude and longitude, of the line's fields");
    if (layer.live && (!placed || layer.lines !== undefined)) tools.report(`${at}.live`, "live is for a layer of the record's own place: it moves as its fields change");
    tools.checkModifiers(layer, at, ['invisible']);
    layers.set(layer.id, { lines: layer.lines !== undefined, place: placed || !!layer.myLocation });
    if (!placed) return;
    if (layer.lines === undefined) return checkPlace(layer, at, tools.here(), layer.pin, layer.card, tools);
    const def = tools.need(layer.lines, `${at}.lines`);
    if (!def) return;
    if (def.type !== 'one2many') return tools.report(`${at}.lines`, `"${layer.lines}" is a ${def.type}; a layer of lines is a one2many field`);
    checkPlace(layer, at, { fields: def.fields as Record<string, LineField>, lines: layer.lines, parent: tools.page.fields }, layer.pin, layer.card, tools);
  });
  node.layers.forEach((layer, i) => {
    const route = layer.route;
    if (!route) return;
    const at = `${path}.layers[${i}].route`;
    const end = (id: string | undefined, key: 'from' | 'to') => {
      if (id === undefined) return;
      const found = layers.get(id);
      if (!found) tools.report(`${at}.${key}`, `no layer "${id}" on this map`);
      else if (!found.place || found.lines) tools.report(`${at}.${key}`, `a route's ${key} is a layer of one place, or the reader's own; "${id}" is not`);
    };
    end(route.from, 'from');
    end(route.to, 'to');
    if (route.through !== undefined) {
      const found = layers.get(route.through);
      if (!found) tools.report(`${at}.through`, `no layer "${route.through}" on this map`);
      else if (!found.lines) tools.report(`${at}.through`, `a route goes through a layer of lines; "${route.through}" is not one`);
    }
    if (route.to === undefined && route.through === undefined) tools.report(at, 'a route needs where it goes: to, or through');
    const written = (name: string | undefined, key: string, ok: (type: string) => boolean, says: string) => {
      if (name === undefined) return;
      const def = tools.need(name, `${at}.write.${key}`);
      if (def && !ok(def.type)) tools.report(`${at}.write.${key}`, `"${name}" is a ${def.type}; ${says}`);
    };
    const number = (type: string) => type === 'float' || type === 'integer';
    written(route.write?.seconds, 'seconds', number, 'seconds are a number field');
    written(route.write?.metres, 'metres', number, 'metres are a number field');
    written(route.write?.line, 'line', (type) => type === 'json', 'a line is kept in a json field');
  });
  node.layers.forEach((layer, i) => {
    if (!layer.reachable) return;
    const found = layers.get(layer.reachable.from);
    const at = `${path}.layers[${i}].reachable.from`;
    if (!found) tools.report(at, `no layer "${layer.reachable.from}" on this map`);
    else if (!found.place || found.lines) tools.report(at, `a reachable area is worked out from a layer of one place, or the reader's own; "${layer.reachable.from}" is not`);
  });
  node.fences?.forEach((fence, i) => {
    const at = `${path}.fences[${i}]`;
    const watched = node.layers.find((layer) => layer.id === fence.layer);
    if (!watched) tools.report(`${at}.layer`, `no layer "${fence.layer}" on this map`);
    else if (!watched.live && !watched.myLocation) tools.report(`${at}.layer`, `a fence watches a place that moves: a live layer, or the reader's own; "${fence.layer}" is not`);
    if (fence.area !== undefined) {
      const def = tools.need(fence.area, `${at}.area`);
      if (def && def.type !== 'json') tools.report(`${at}.area`, `"${fence.area}" is a ${def.type}; an area is kept in a json field`);
    }
    if (fence.within !== undefined && !node.layers.some((layer) => layer.id === fence.within && layer.reachable)) tools.report(`${at}.within`, `a fence is within a reachable area of this map; "${fence.within}" is not one`);
    tools.checkSteps(fence.steps, `${at}.steps`);
  });
}

/** An address with suggestions: a char field, its place kept as a place field keeps one, its parts in a json field. */
export function checkAddressSearch(node: FieldNode, def: Field | LineField | undefined, path: string, tools: MapTools): void {
  const options = node.options ?? {};
  const kind = (key: string) => {
    const name = options[key];
    return typeof name === 'string' && has(tools.page.fields, name) ? tools.page.fields[name].type : undefined;
  };
  if (def && def.type !== 'char') tools.report(`${path}.widget`, `address-search is for a char field; "${node.field}" is a ${def.type}`);
  const place = kind('placeField');
  if (place && place !== 'json' && place !== 'float') tools.report(`${path}.options.placeField`, `"${options['placeField']}" is a ${place}; a place is kept in a json field, or in a float field (its latitude) with longitudeField`);
  if (place === 'float' && options['longitudeField'] === undefined) tools.report(`${path}.options.placeField`, `"${options['placeField']}" keeps a latitude: name the float field for its longitude in longitudeField`);
  if (options['longitudeField'] !== undefined && place !== 'float') tools.report(`${path}.options.longitudeField`, 'longitudeField goes with a placeField that is a float field, its latitude');
  const longitude = kind('longitudeField');
  if (longitude && longitude !== 'float') tools.report(`${path}.options.longitudeField`, `"${options['longitudeField']}" is a ${longitude}; a longitude is kept in a float field`);
  const parts = kind('partsField');
  if (parts && parts !== 'json') tools.report(`${path}.options.partsField`, `"${options['partsField']}" is a ${parts}; an address's parts are kept in a json field`);
}
