import type { Field, MapLayer, MapNode, Page, Pin } from '@fieldia/core';
import type { ElementFactory } from './chrome';
import type { Designer } from './designer';
import { locate } from './layout-tree';
import { openMenu } from './menu';
import type { BlockContent } from './panel-block';
import { segmented, setting } from './panel-controls';

/**
 * A map's own settings, on the Content tab: its name and height, and its
 * layers — the record's places, a place for each of its lines, routes
 * between them, the reader's own place — each with the fields it reads, as a
 * list's map is set. The map itself is drawn in Try it.
 */

type LayerKind = 'place' | 'lines' | 'route' | 'me';
const kindOf = (layer: MapLayer): LayerKind => (layer.route ? 'route' : layer.myLocation ? 'me' : layer.lines ? 'lines' : 'place');

const NUMBERS = new Set(['float', 'integer']);
const PICTURES = new Set(['image', 'binary']);
const SAYABLE = new Set(['char', 'text', 'selection', 'many2one', 'integer', 'float', 'monetary', 'date', 'datetime', 'boolean']);
const HEIGHTS = { small: 280, medium: 360, large: 480 } as const;

type Named = { name: string; field: Field };
const focused = (node: Element) => node.ownerDocument.activeElement === node;

export function mapContent(el: ElementFactory, designer: Designer, id: string): BlockContent {
  const w = designer.words.mapPart;
  const name = el('input', { class: 'fd-input', 'aria-label': w.name, autocomplete: 'off' }) as HTMLInputElement;
  name.addEventListener('input', () => designer.updateMap(id, { label: name.value }));
  const height = segmented<keyof typeof HEIGHTS>(
    el,
    w.height,
    (['small', 'medium', 'large'] as const).map((value) => ({ value, words: w.heights[value] })),
    (value) => value && designer.updateMap(id, { height: value === 'medium' ? null : HEIGHTS[value] })
  );
  const layersBox = el('div', { class: 'fd-map-layers' });
  const add = el('button', { type: 'button', class: 'fd-button' }, w.addLayer);
  const why = el('p', { class: 'fd-properties-hint', role: 'status', hidden: '' });

  const nodeOf = (page: Page) => locate(page, id)?.node as MapNode | undefined;
  /** The page's fields, then the model's not on it yet. */
  const fieldsOf = (page: Page, ok: (field: Field) => boolean): Named[] =>
    [...Object.entries(page.fields).map(([name, field]) => ({ name, field })), ...designer.modelFields()].filter(({ field }) => ok(field));
  /** A field of lines' own fields. */
  const lineFieldsOf = (page: Page, lines: string | undefined, ok: (field: Field) => boolean): Named[] => {
    const def = lines ? fieldsOf(page, (f) => f.type === 'one2many').find((f) => f.name === lines)?.field : undefined;
    const own = (def as { fields?: Record<string, Field> } | undefined)?.fields ?? {};
    return Object.entries(own).map(([name, field]) => ({ name, field })).filter(({ field }) => ok(field));
  };
  /** Where a place may be kept among these fields: a point first, else two numbers named for latitude and longitude. */
  const placeIn = (fields: Named[]): Pick<MapLayer, 'point' | 'latitude' | 'longitude'> | null => {
    const point = fields.find(({ field }) => field.type === 'json');
    if (point) return { point: point.name };
    const numbers = fields.filter(({ field }) => NUMBERS.has(field.type));
    if (numbers.length < 2) return null;
    const latitude = numbers.find(({ name }) => /lat/i.test(name)) ?? numbers[0];
    const longitude = numbers.find(({ name }) => /lng|lon/i.test(name) && name !== latitude.name) ?? numbers.find(({ name }) => name !== latitude.name)!;
    return { latitude: latitude.name, longitude: longitude.name };
  };

  /** The layers with one changed, its empty parts left out. */
  function change(layerId: string, edit: (layer: MapLayer) => void) {
    const node = nodeOf(designer.getPage());
    if (!node) return;
    const layers = JSON.parse(JSON.stringify(node.layers)) as MapLayer[];
    const layer = layers.find((l) => l.id === layerId);
    if (!layer) return;
    edit(layer);
    tidy(layer);
    designer.updateMap(id, { layers });
  }
  const tidy = (layer: MapLayer) => {
    const drop = (holder: Record<string, unknown> | undefined) => {
      if (!holder) return;
      for (const key of Object.keys(holder)) if (holder[key] === '' || holder[key] === undefined || holder[key] === false) delete holder[key];
    };
    drop(layer.pin as Record<string, unknown>);
    if (layer.pin && !Object.keys(layer.pin).length) delete layer.pin;
    drop(layer.card as Record<string, unknown>);
    if (layer.card && !Object.keys(layer.card).length) delete layer.card;
    drop(layer.route?.write as Record<string, unknown>);
    if (layer.route?.write && !Object.keys(layer.route.write).length) delete layer.route.write;
    if (!layer.label?.trim()) delete layer.label;
  };

  // ---- adding a layer ------------------------------------------------------------------

  function addLayer(kind: LayerKind) {
    const page = designer.getPage();
    const node = nodeOf(page);
    if (!node) return;
    const taken = new Set(node.layers.map((l) => l.id));
    const fresh = (base: string) => {
      let next = base;
      for (let n = 2; taken.has(next); n++) next = `${base}${n}`;
      return next;
    };
    let layer: MapLayer | null = null;
    if (kind === 'place') {
      const at = placeIn(fieldsOf(page, () => true));
      if (at) layer = { id: fresh('place'), label: w.kinds.place, ...at };
      else say(w.noPlace);
    } else if (kind === 'lines') {
      const lines = fieldsOf(page, (f) => f.type === 'one2many').find(({ name }) => placeIn(lineFieldsOf(page, name, () => true)));
      if (lines) layer = { id: fresh('lines'), label: w.kinds.lines, lines: lines.name, ...placeIn(lineFieldsOf(page, lines.name, () => true))! };
      else say(w.noLines);
    } else if (kind === 'route') {
      const ends = node.layers.filter((l) => kindOf(l) === 'place' || kindOf(l) === 'me');
      const places = node.layers.filter((l) => kindOf(l) === 'place');
      const from = ends[0];
      const to = places.find((l) => l.id !== from?.id);
      if (from && to) layer = { id: fresh('route'), label: w.kinds.route, route: { from: from.id, to: to.id } };
      else say(w.noRoute);
    } else if (node.layers.some((l) => l.myLocation)) say(w.oneMe);
    else layer = { id: fresh('me'), label: designer.words.defaults.you, myLocation: true };
    if (layer) {
      say('');
      designer.updateMap(id, { layers: [...node.layers, layer] });
    }
  }
  function say(words: string) {
    why.textContent = words;
    why.hidden = !words;
  }
  add.addEventListener('click', () =>
    openMenu({
      el,
      anchor: add,
      title: w.addLayer,
      items: (['place', 'lines', 'route', 'me'] as const).map((kind) => ({ id: kind, label: w.kinds[kind] })),
      onPick: (kind) => addLayer(kind as LayerKind),
    })
  );

  // ---- each layer's editor -----------------------------------------------------------------

  interface LayerView {
    kind: LayerKind;
    element: HTMLElement;
    update(page: Page, layer: MapLayer, node: MapNode): void;
  }
  const views = new Map<string, LayerView>();

  const control = <T extends HTMLElement>(tag: 'input' | 'select', label: string, attrs: Record<string, string> = {}) =>
    el(tag, { class: tag === 'select' ? 'fd-input fd-select' : 'fd-input', 'aria-label': label, ...attrs }) as unknown as T;
  const fill = (box: HTMLSelectElement, choices: { value: string; label: string }[], none?: string) =>
    box.replaceChildren(...(none === undefined ? [] : [el('option', { value: '' }, none)]), ...choices.map((c) => el('option', { value: c.value }, c.label)));
  const asChoices = (fields: Named[]) => fields.map(({ name, field }) => ({ value: name, label: field.label }));
  const row = (label: string, ...controls: HTMLElement[]) => el('label', { class: 'fd-prop' }, el('span', { class: 'fd-prop-name' }, label), ...controls);
  const tick = (label: string) => {
    const box = el('input', { type: 'checkbox' }) as HTMLInputElement;
    return { box, row: el('label', { class: 'fd-q-required' }, box, el('span', {}, label)) };
  };

  function layerView(layerId: string, kind: LayerKind): LayerView {
    const words = control<HTMLInputElement>('input', w.words, { autocomplete: 'off' });
    words.addEventListener('input', () => change(layerId, (l) => (l.label = words.value)));
    const remove = el('button', { type: 'button', class: 'fd-button fd-button-link fd-button-danger' }, '×');
    remove.addEventListener('click', () => {
      const node = nodeOf(designer.getPage());
      if (node) designer.updateMap(id, { layers: node.layers.filter((l) => l.id !== layerId) });
    });
    const head = el('div', { class: 'fd-map-layer-head' }, el('strong', {}, w.kinds[kind]), remove);
    const body = el('div', { class: 'fd-props' }, row(w.words, words));
    const element = el('div', { class: 'fd-map-layer', 'data-layer': layerId, 'data-kind': kind }, head, body);
    const updates: ((page: Page, layer: MapLayer, node: MapNode) => void)[] = [
      (_page, layer) => {
        if (!focused(words)) words.value = layer.label ?? '';
        remove.setAttribute('aria-label', w.remove(layer.label || layer.id));
      },
    ];

    if (kind === 'place' || kind === 'lines') {
      const scope = (page: Page, layer: MapLayer, ok: (f: Field) => boolean) => (kind === 'lines' ? lineFieldsOf(page, layer.lines, ok) : fieldsOf(page, ok));
      if (kind === 'lines') {
        const lines = control<HTMLSelectElement>('select', w.lines);
        lines.addEventListener('change', () => {
          const page = designer.getPage();
          change(layerId, (l) => {
            delete l.point;
            delete l.latitude;
            delete l.longitude;
            l.lines = lines.value;
            Object.assign(l, placeIn(lineFieldsOf(page, lines.value, () => true)) ?? {});
          });
        });
        body.append(row(w.lines, lines));
        updates.push((page, layer) => {
          fill(lines, asChoices(fieldsOf(page, (f) => f.type === 'one2many')));
          lines.value = layer.lines ?? '';
        });
      }
      const where = control<HTMLSelectElement>('select', w.where);
      const lat = control<HTMLSelectElement>('select', w.latitude);
      const lng = control<HTMLSelectElement>('select', w.longitude);
      const latRow = row(w.latitude, lat);
      const lngRow = row(w.longitude, lng);
      where.addEventListener('change', () => {
        const page = designer.getPage();
        change(layerId, (l) => {
          delete l.point;
          delete l.latitude;
          delete l.longitude;
          if (where.value === 'latlng') Object.assign(l, placeIn(scope(page, l, (f) => NUMBERS.has(f.type))) ?? {});
          else l.point = where.value.slice('point:'.length);
        });
      });
      lat.addEventListener('change', () => change(layerId, (l) => (l.latitude = lat.value)));
      lng.addEventListener('change', () => change(layerId, (l) => (l.longitude = lng.value)));
      const label = control<HTMLSelectElement>('select', w.pinShows);
      label.addEventListener('change', () => change(layerId, (l) => ((l.pin ??= {}).label = label.value)));
      const look = control<HTMLSelectElement>('select', w.pinLook);
      fill(look, (['pin', 'label', 'icon', 'photo', 'dot'] as const).map((value) => ({ value, label: w.pinLooks[value] })));
      look.addEventListener('change', () => change(layerId, (l) => ((l.pin ??= {}).look = look.value as Pin['look'])));
      const photo = control<HTMLSelectElement>('select', w.photo);
      photo.addEventListener('change', () => change(layerId, (l) => ((l.pin ??= {}).image = photo.value)));
      const icon = control<HTMLInputElement>('input', w.icon, { placeholder: 'car', autocomplete: 'off' });
      icon.addEventListener('change', () => change(layerId, (l) => ((l.pin ??= {}).icon = icon.value.trim())));
      const turn = control<HTMLSelectElement>('select', w.turnedBy);
      turn.addEventListener('change', () => change(layerId, (l) => ((l.pin ??= {}).turn = turn.value)));
      const title = control<HTMLSelectElement>('select', w.cardTitle);
      title.addEventListener('change', () => change(layerId, (l) => ((l.card ??= {}).title = title.value)));
      const rows = { photo: row(w.photo, photo), icon: row(w.icon, icon), turn: row(w.turnedBy, turn) };
      body.append(row(w.where, where), latRow, lngRow, row(w.pinShows, label), row(w.pinLook, look), rows.photo, rows.icon, rows.turn, row(w.cardTitle, title));
      updates.push((page, layer) => {
        const points = scope(page, layer, (f) => f.type === 'json');
        const numbers = scope(page, layer, (f) => NUMBERS.has(f.type));
        fill(where, [...points.map(({ name, field }) => ({ value: `point:${name}`, label: w.onePoint(field.label) })), ...(numbers.length >= 2 ? [{ value: 'latlng', label: w.latLng }] : [])]);
        where.value = layer.point ? `point:${layer.point}` : 'latlng';
        fill(lat, asChoices(numbers));
        fill(lng, asChoices(numbers));
        lat.value = layer.latitude ?? '';
        lng.value = layer.longitude ?? '';
        latRow.hidden = lngRow.hidden = !!layer.point;
        const pin = layer.pin ?? {};
        const sayable = asChoices(scope(page, layer, (f) => SAYABLE.has(f.type)));
        fill(label, sayable, w.nothing);
        label.value = pin.label ?? '';
        const shownLook = pin.look ?? (pin.label ? 'label' : pin.image ? 'photo' : pin.icon || pin.iconField ? 'icon' : 'pin');
        look.value = shownLook;
        fill(photo, asChoices(scope(page, layer, (f) => PICTURES.has(f.type))), w.nothing);
        photo.value = pin.image ?? '';
        rows.photo.hidden = shownLook !== 'photo';
        if (!focused(icon)) icon.value = pin.icon ?? '';
        fill(turn, asChoices(numbers), w.nothing);
        turn.value = pin.turn ?? '';
        rows.icon.hidden = rows.turn.hidden = shownLook !== 'icon';
        fill(title, sayable, w.nothing);
        title.value = layer.card?.title ?? '';
      });
      if (kind === 'place') {
        const moves = tick(w.moves);
        const follow = tick(w.follow);
        const stale = control<HTMLInputElement>('input', w.staleAfter, { type: 'number', min: '5', max: '86400', step: '1', placeholder: '—' });
        const staleRow = row(w.staleAfter, stale);
        moves.box.addEventListener('change', () =>
          change(layerId, (l) => {
            if (moves.box.checked) l.live = {};
            else delete l.live;
          })
        );
        follow.box.addEventListener('change', () => change(layerId, (l) => ((l.live ??= {}).follow = follow.box.checked || undefined)));
        stale.addEventListener('change', () =>
          change(layerId, (l) => {
            l.live ??= {};
            if (stale.value.trim()) l.live.staleAfter = Number(stale.value);
            else delete l.live.staleAfter;
          })
        );
        body.append(moves.row, follow.row, staleRow);
        updates.push((_page, layer) => {
          moves.box.checked = !!layer.live;
          follow.box.checked = !!layer.live?.follow;
          follow.row.hidden = staleRow.hidden = !layer.live;
          if (!focused(stale)) stale.value = layer.live?.staleAfter === undefined ? '' : String(layer.live.staleAfter);
        });
      }
    }

    if (kind === 'route') {
      const from = control<HTMLSelectElement>('select', w.from);
      const to = control<HTMLSelectElement>('select', w.to);
      const through = control<HTMLSelectElement>('select', w.through);
      const mode = control<HTMLSelectElement>('select', w.mode);
      fill(mode, (['car', 'bike', 'foot'] as const).map((value) => ({ value, label: w.modes[value] })));
      const progress = tick(w.progress);
      const seconds = control<HTMLSelectElement>('select', w.writeSeconds);
      const metres = control<HTMLSelectElement>('select', w.writeMetres);
      const line = control<HTMLSelectElement>('select', w.writeLine);
      const route = (l: MapLayer) => (l.route ??= { from: '' });
      from.addEventListener('change', () => change(layerId, (l) => (route(l).from = from.value)));
      to.addEventListener('change', () => change(layerId, (l) => (route(l).to = to.value || undefined)));
      through.addEventListener('change', () => change(layerId, (l) => (route(l).through = through.value || undefined)));
      mode.addEventListener('change', () => change(layerId, (l) => (route(l).mode = mode.value === 'car' ? undefined : (mode.value as 'bike' | 'foot'))));
      progress.box.addEventListener('change', () => change(layerId, (l) => (route(l).progress = progress.box.checked || undefined)));
      const write = (key: 'seconds' | 'metres' | 'line', box: HTMLSelectElement) => box.addEventListener('change', () => change(layerId, (l) => ((route(l).write ??= {})[key] = box.value)));
      write('seconds', seconds);
      write('metres', metres);
      write('line', line);
      body.append(row(w.from, from), row(w.to, to), row(w.through, through), row(w.mode, mode), progress.row, row(w.writeSeconds, seconds), row(w.writeMetres, metres), row(w.writeLine, line));
      updates.push((page, layer, node) => {
        const r = layer.route ?? { from: '' };
        const ends = node.layers.filter((l) => l.id !== layerId && (kindOf(l) === 'place' || kindOf(l) === 'me'));
        const label = (l: MapLayer) => ({ value: l.id, label: l.label || l.id });
        fill(from, ends.map(label));
        from.value = r.from;
        fill(to, ends.map(label), w.none);
        to.value = r.to ?? '';
        fill(through, node.layers.filter((l) => kindOf(l) === 'lines').map(label), w.none);
        through.value = r.through ?? '';
        mode.value = r.mode ?? 'car';
        progress.box.checked = !!r.progress;
        fill(seconds, asChoices(fieldsOf(page, (f) => NUMBERS.has(f.type))), w.none);
        seconds.value = r.write?.seconds ?? '';
        fill(metres, asChoices(fieldsOf(page, (f) => NUMBERS.has(f.type))), w.none);
        metres.value = r.write?.metres ?? '';
        fill(line, asChoices(fieldsOf(page, (f) => f.type === 'json')), w.none);
        line.value = r.write?.line ?? '';
      });
    }

    return {
      kind,
      element,
      update(page, layer, node) {
        for (const update of updates) update(page, layer, node);
      },
    };
  }

  return {
    rows: [
      setting(el, 'content', 'Name', name, { words: w.name }),
      setting(el, 'content', 'Height', height.element, { words: w.height }),
      setting(el, 'content', 'Layers', [layersBox, add, why], { words: w.layers, hint: w.note }),
    ],
    update(page) {
      const node = nodeOf(page);
      if (!node) return;
      if (!focused(name)) name.value = node.label ?? '';
      height.set(node.height === HEIGHTS.small ? 'small' : node.height === HEIGHTS.large ? 'large' : 'medium');
      // Each layer's editor kept while its layer stays the same kind: typing in it keeps the focus.
      for (const layerId of [...views.keys()]) if (!node.layers.some((l) => l.id === layerId)) views.delete(layerId);
      const drawn = node.layers.map((layer) => {
        let view = views.get(layer.id);
        if (!view || view.kind !== kindOf(layer)) views.set(layer.id, (view = layerView(layer.id, kindOf(layer))));
        view.update(page, layer, node);
        return view.element;
      });
      layersBox.replaceChildren(...drawn);
    },
  };
}
