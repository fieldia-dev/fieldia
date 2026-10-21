import { cardLines, DATE_PERIODS, foldDigits, type ButtonNode, type DatePeriod, type Field, type FilterCondition, type ListCell, type ListMap, type ListNode, type MapTool, type Page, type Pin, type TotalKind } from '@fieldia/core';
import type { ElementFactory } from './chrome';
import { recordsSettings } from './records-settings';
import type { Designer } from './designer';
import type { DesignerWords } from './designer-words';
import { storedAs } from './kinds';
import { FILTERABLE, RANGE_ONLY, RANGEABLE, ruleIsGood, widthIsGood } from './list-commands';
import { calendarSection } from './list-calendar';
import { ganttSection } from './list-gantt';
import { cardsSection } from './list-cards-settings';
import { rowsSection } from './list-rows-settings';
import { openMenu } from './menu';
import type { PropertiesView } from './screen-properties';
import { whenClicked } from './steps-panel';
import { settingNumber, type SettingNumberOptions } from './number-box';

/**
 * The panels of a list page: the list's own — the rows a page holds, its
 * order, where the search looks, its named filters and its groupings — a
 * column's, and a button's for the rows chosen.
 */

const prop = (el: ElementFactory, text: string, control: HTMLElement) => el('label', { class: 'fd-prop' }, el('span', { class: 'fd-prop-name' }, text), control);
const select = (el: ElementFactory, label: string, options: [string, string][]) =>
  el('select', { class: 'fd-input fd-select', 'aria-label': label }, ...options.map(([value, text]) => el('option', { value }, text))) as HTMLSelectElement;
const focused = (node: Element) => node.ownerDocument.activeElement === node;
const listOf = (page: Page) => page.layout as ListNode;

/** Fields no list can put in order. */
const UNSORTABLE = new Set(['one2many', 'many2many', 'binary', 'image', 'html', 'json', 'properties']);
/** Fields a list can be grouped by: those whose values repeat. */
const GROUPABLE = new Set(['selection', 'many2one', 'boolean', 'char', 'date', 'datetime', 'integer']);

/** The page's fields first, then the model's not on it yet. */
function everyField(page: Page, designer: Designer): { name: string; field: Field }[] {
  return [...Object.entries(page.fields).map(([name, field]) => ({ name, field })), ...designer.modelFields()];
}

// ---- a filter's one condition ----------------------------------------------------------------

/** A test of a filter's one condition: one a data source reads, or a period a date falls in. */
type Test = [FilterCondition['op'] | 'period', string];
/** A filter as its row edits it: one condition, or a period as one (`op: 'period'`, its value the period). */
type OneTest = { field: string; op: Test[0]; value?: FilterCondition['value'] };

function testsFor(field: Field, words: DesignerWords): Test[] {
  const t = words.list.tests;
  const filled: Test[] = [['set', t.filled], ['notset', t.empty]];
  switch (field.type) {
    case 'selection':
      return [['=', t.is], ['!=', t.isNot], ...filled];
    case 'boolean':
      return [['=', t.is]];
    case 'integer':
    case 'float':
    case 'monetary':
      return [['=', t.is], ['>', t.more], ['<', t.less], ['>=', t.atLeast], ['<=', t.atMost], ...filled];
    case 'date':
    case 'datetime':
      return [['=', t.is], ['>', t.after], ['<', t.before], ['period', t.period], ...filled];
    case 'char':
    case 'text':
      return [['ilike', t.contains], ['=', t.is], ['!=', t.isNot], ...filled];
    default:
      // A link or a file: whether there is one. The designer knows no record to compare with.
      return filled;
  }
}

function firstValue(field: Field): FilterCondition['value'] {
  if (field.type === 'selection') return field.options[0]?.value ?? '';
  if (field.type === 'boolean') return true;
  if (['integer', 'float', 'monetary'].includes(field.type)) return 0;
  if (field.type === 'date' || field.type === 'datetime') return new Date().toISOString().slice(0, 10);
  return '';
}

function filterRow(el: ElementFactory, designer: Designer, id: string) {
  const w = designer.words.list;
  const name = el('input', { class: 'fd-input', 'aria-label': w.filterName }) as HTMLInputElement;
  name.addEventListener('input', () => designer.updateListFilter(id, { label: name.value }));
  const which = el('select', { class: 'fd-input fd-select', 'aria-label': w.filterField }) as HTMLSelectElement;
  const test = el('select', { class: 'fd-input fd-select', 'aria-label': w.filterTest }) as HTMLSelectElement;
  const valueBox = el('span', { class: 'fd-list-filter-value' });
  const on = el('input', { type: 'checkbox', 'aria-label': w.onWhenOpens }) as HTMLInputElement;
  on.addEventListener('change', () => designer.updateListFilter(id, { on: on.checked }));
  const remove = el('button', { type: 'button', class: 'fd-button fd-button-link fd-button-danger' }, w.remove);
  remove.addEventListener('click', () => designer.removeListFilter(id));
  const byHand = el('p', { class: 'fd-properties-hint', hidden: '' }, w.byHand);
  const condition = el('div', { class: 'fd-list-filter-condition' }, which, test, valueBox);
  const element = el(
    'fieldset',
    { class: 'fd-list-filter', 'data-filter': id },
    name,
    condition,
    byHand,
    el('div', { class: 'fd-list-filter-foot' }, el('label', { class: 'fd-q-required' }, on, el('span', {}, w.onWhenOpens)), remove)
  );

  const page = () => designer.getPage();
  const fieldOf = (n: string) => page().fields[n] ?? designer.modelFields().find((m) => m.name === n)?.field;
  let valueKey = '';
  /** The filter's one test as its row shows it: its condition, or its period. */
  const current = (): OneTest => {
    const named = listOf(page()).filters?.find((f) => f.id === id);
    if (named?.period && !named.filter) return { field: named.period.field, op: 'period', value: named.period.is };
    return named?.filter?.[0] as FilterCondition;
  };
  /** Kept as the page keeps it: a period as a period, any other test as a condition. */
  const write = (next: OneTest) => {
    if (next.op === 'period') return designer.updateListFilter(id, { filter: null, period: { field: next.field, is: next.value as DatePeriod } });
    const condition = { ...next } as FilterCondition;
    if (condition.op === 'set' || condition.op === 'notset') delete condition.value;
    return designer.updateListFilter(id, { filter: [condition], period: null });
  };
  const save = (patch: Partial<OneTest>) => write({ ...current(), ...patch });
  /** A test's first value: a period's This month, else the field's own. */
  const valueFor = (op: Test[0], field: Field) => (op === 'period' ? 'thisMonth' : firstValue(field));
  which.addEventListener('change', () => {
    const field = fieldOf(which.value);
    if (!field) return;
    // A period stays one from one date to another; else the field's first test.
    const kept = current().op === 'period' && testsFor(field, designer.words).some(([op]) => op === 'period');
    const [op] = kept ? (['period'] as const) : testsFor(field, designer.words)[0];
    write(op === 'set' ? { field: which.value, op } : { field: which.value, op, value: kept ? current().value : valueFor(op, field) });
  });
  test.addEventListener('change', () => {
    const now = current();
    const field = fieldOf(now.field);
    const op = test.value as Test[0];
    // To a period or from one, the value starts again: a period's names are no day.
    const fresh = now.value === undefined || (op === 'period') !== (now.op === 'period');
    save({ op, ...(fresh && field ? { value: valueFor(op, field) } : {}) });
  });

  /** The value the filter holds now, as the page last drew it. */
  let heldValue: unknown;
  /** Its number box, drawn again when the page changes. */
  let numberShown: { refresh(): void } | null = null;
  function valueControl(field: Field, condition: OneTest): HTMLElement {
    numberShown = null;
    if (condition.op === 'period') {
      const box = select(el, w.filterValue, DATE_PERIODS.map((period) => [period, w.periods[period]]));
      box.value = String(condition.value);
      box.addEventListener('change', () => save({ value: box.value }));
      return box;
    }
    if (field.type === 'selection' || field.type === 'boolean') {
      const options: [string, string][] = field.type === 'boolean' ? [['true', w.yes], ['false', w.no]] : field.options.map((o) => [String(o.value), o.label]);
      const box = select(el, w.filterValue, options);
      box.value = String(condition.value);
      box.addEventListener('change', () => {
        const picked = field.type === 'boolean' ? box.value === 'true' : field.options.find((o) => String(o.value) === box.value)?.value;
        save({ value: picked });
      });
      return box;
    }
    if (['integer', 'float', 'monetary'].includes(field.type)) {
      // A number read as every box reads one, kept as it is left; a whole number for a whole-number field.
      const number = settingNumber(el, designer, {
        label: w.filterValue,
        integer: field.type === 'integer',
        saved: () => (typeof heldValue === 'number' ? heldValue : null),
        commit: (n) => save({ value: n }),
      });
      numberShown = number;
      number.refresh();
      return number.input;
    }
    const box = el('input', { class: 'fd-input', type: field.type === 'date' || field.type === 'datetime' ? 'date' : 'text', 'aria-label': w.filterValue }) as HTMLInputElement;
    box.value = String(condition.value ?? '');
    box.addEventListener('input', () => save({ value: box.value }));
    return box;
  }

  return {
    element,
    update(label: string, items: NonNullable<ListNode['filters']>[number], isOn: boolean) {
      if (!focused(name)) name.value = label;
      on.checked = isOn;
      remove.setAttribute('aria-label', w.removeFilter(label));
      // One condition, or a period alone: what this row edits. Anything more was written by hand.
      const one = !items.period && items.filter?.length === 1 && !('any' in items.filter[0]) && !('all' in items.filter[0]) ? (items.filter[0] as FilterCondition) : null;
      const single: OneTest | null = items.period && !items.filter ? { field: items.period.field, op: 'period', value: items.period.is } : one;
      const field = single ? fieldOf(single.field) : undefined;
      condition.hidden = !single || !field;
      byHand.hidden = !condition.hidden;
      if (!single || !field) return;
      const fields = everyField(page(), designer).filter(({ field: f }) => testsFor(f, designer.words).length > 0 && !['one2many', 'json'].includes(f.type));
      which.replaceChildren(...fields.map(({ name: n, field: f }) => el('option', { value: n }, f.label)));
      which.value = single.field;
      test.replaceChildren(...testsFor(field, designer.words).map(([op, words]) => el('option', { value: op }, words)));
      test.value = single.op;
      heldValue = single.value;
      const key = `${single.field}:${single.op}`;
      if (key !== valueKey) {
        valueKey = key;
        valueBox.replaceChildren(...(single.op === 'set' || single.op === 'notset' ? [] : [valueControl(field, single)]));
      }
      // A period's list follows the page: an undo puts the last period back.
      const periods = single.op === 'period' ? valueBox.querySelector('select') : null;
      if (periods && !focused(periods)) periods.value = String(single.value);
      numberShown?.refresh();
    },
    focus() {
      name.focus();
      name.select();
    },
  };
}

// ---- the records on a map ------------------------------------------------------------------------

const NUMBERS = new Set(['float', 'integer']);
const PICTURES = new Set(['image', 'binary']);
/** Fields a pin or a card can say in words. */
const SAYABLE = new Set(['char', 'text', 'selection', 'many2one', 'integer', 'float', 'monetary', 'date', 'datetime', 'boolean']);

const LIST_TOOLS = ['nearest', 'satellite', 'traffic', 'fullscreen', 'measure'] as const satisfies readonly MapTool[];
/** A field an area's key can be kept in. */
const KEYS = new Set(['char', 'selection', 'integer', 'many2one']);

/** A list's map: whether there is one, where each record is, its pins and its card, how the list opens, its tools, a heat map, and areas shaded by their records. */
function mapSection(el: ElementFactory, designer: Designer) {
  const w = designer.words.list;
  const on = el('input', { type: 'checkbox' }) as HTMLInputElement;
  const onRow = el('label', { class: 'fd-q-required' }, on, el('span', {}, w.onAMap));
  const noPlace = el('p', { class: 'fd-properties-hint' }, w.noPlace);
  const where = el('select', { class: 'fd-input fd-select', 'aria-label': w.where }) as HTMLSelectElement;
  const lat = el('select', { class: 'fd-input fd-select', 'aria-label': w.latitude }) as HTMLSelectElement;
  const lng = el('select', { class: 'fd-input fd-select', 'aria-label': w.longitude }) as HTMLSelectElement;
  const label = el('select', { class: 'fd-input fd-select', 'aria-label': w.pinShows }) as HTMLSelectElement;
  const look = select(el, w.pinLook, (['pin', 'label', 'icon', 'photo', 'dot'] as const).map((k) => [k, w.pinLooks[k]]));
  const photo = el('select', { class: 'fd-input fd-select', 'aria-label': w.pinPhoto }) as HTMLSelectElement;
  const icon = el('input', { class: 'fd-input', 'aria-label': w.pinIcon, placeholder: 'car' }) as HTMLInputElement;
  const iconFrom = el('select', { class: 'fd-input fd-select', 'aria-label': w.iconFrom }) as HTMLSelectElement;
  const turn = el('select', { class: 'fd-input fd-select', 'aria-label': w.turnedBy }) as HTMLSelectElement;
  const title = el('select', { class: 'fd-input fd-select', 'aria-label': w.cardTitle }) as HTMLSelectElement;
  const picture = el('select', { class: 'fd-input fd-select', 'aria-label': w.cardPicture }) as HTMLSelectElement;
  const cardFields = el('div', { class: 'fd-chips' });
  const addToCard = el('button', { type: 'button', class: 'fd-button' }, w.addToCard);
  const cardLink = el('select', { class: 'fd-input fd-select', 'aria-label': w.cardLink }) as HTMLSelectElement;
  const cardLabels = el('input', { type: 'checkbox' }) as HTMLInputElement;
  const cardLead = el('input', { type: 'checkbox' }) as HTMLInputElement;
  const cardChoose = el('input', { type: 'checkbox' }) as HTMLInputElement;
  const home = el('input', { class: 'fd-input', 'aria-label': w.homeCurrency, placeholder: 'EGP', maxlength: '3', autocomplete: 'off', spellcheck: 'false' }) as HTMLInputElement;
  const opens = select(el, w.opensAs, (['list', 'map', 'both'] as const).map((k) => [k, w.opensAsChoices[k]]));
  const bubbles = el('input', { type: 'checkbox' }) as HTMLInputElement;
  const toolTicks = LIST_TOOLS.map((tool) => ({ tool, box: el('input', { type: 'checkbox' }) as HTMLInputElement }));
  const tools = el('div', { class: 'fd-map-tools', role: 'group', 'aria-label': w.mapTools }, ...toolTicks.map(({ tool, box }) => el('label', { class: 'fd-q-required' }, box, el('span', {}, w.mapToolNames[tool]))));
  const heat = el('input', { type: 'checkbox' }) as HTMLInputElement;
  const weight = el('select', { class: 'fd-input fd-select', 'aria-label': w.heatWeight }) as HTMLSelectElement;
  const areas = el('select', { class: 'fd-input fd-select', 'aria-label': w.areas }) as HTMLSelectElement;
  const areaField = el('select', { class: 'fd-input fd-select', 'aria-label': w.areaField }) as HTMLSelectElement;
  const areaWhy = el('p', { class: 'fd-properties-hint', role: 'status', hidden: '' }, w.noAreaField);
  // How the map sits in its page: its height, the gestures it takes, the closest it zooms to show its records.
  const height = el('select', { class: 'fd-input fd-select', 'aria-label': w.mapHeight }) as HTMLSelectElement;
  const allGestures = el('input', { type: 'checkbox' }) as HTMLInputElement;
  // A whole number, 1 to 22, refused with its range rather than brought into it in silence; emptied, the usual 16.
  let zoomHeld: number | null = null;
  const fitZoom = settingNumber(el, designer, {
    label: w.fitZoom,
    attrs: { class: 'fd-input', placeholder: '16' },
    integer: true,
    min: 1,
    max: 22,
    optional: true,
    saved: () => zoomHeld,
    commit: (n) =>
      change((map) => {
        if (n === null) delete map.fitZoom;
        else map.fitZoom = n;
      }),
  });
  const rows = {
    lat: prop(el, w.latitude, lat),
    lng: prop(el, w.longitude, lng),
    photo: prop(el, w.pinPhoto, photo),
    icon: prop(el, w.pinIcon, icon),
    iconFrom: prop(el, w.iconFrom, iconFrom),
    turn: prop(el, w.turnedBy, turn),
    home: prop(el, w.homeCurrency, home),
    weight: prop(el, w.heatWeight, weight),
    areaField: prop(el, w.areaField, areaField),
    areas: prop(el, w.areas, areas),
  };
  const details = el(
    'div',
    { class: 'fd-props' },
    prop(el, w.where, where),
    rows.lat,
    rows.lng,
    prop(el, w.pinShows, label),
    prop(el, w.pinLook, look),
    rows.photo,
    rows.icon,
    rows.iconFrom,
    rows.turn,
    rows.home,
    prop(el, w.cardTitle, title),
    prop(el, w.cardPicture, picture),
    el('div', { class: 'fd-prop' }, el('span', { class: 'fd-prop-name' }, w.cardShows), cardFields, addToCard),
    el('label', { class: 'fd-q-required' }, cardLabels, el('span', {}, w.cardLabels)),
    el('label', { class: 'fd-q-required' }, cardLead, el('span', {}, w.cardLead)),
    prop(el, w.cardLink, cardLink),
    el('label', { class: 'fd-q-required' }, cardChoose, el('span', {}, w.cardChoose)),
    prop(el, w.opensAs, opens),
    el('label', { class: 'fd-q-required' }, bubbles, el('span', {}, w.bubbles)),
    el('div', { class: 'fd-prop' }, el('span', { class: 'fd-prop-name' }, w.mapTools), tools),
    el('label', { class: 'fd-q-required' }, heat, el('span', {}, w.heat)),
    rows.weight,
    rows.areas,
    rows.areaField,
    areaWhy,
    prop(el, w.mapHeight, height),
    el('label', { class: 'fd-q-required' }, allGestures, el('span', {}, w.allGestures)),
    prop(el, w.fitZoom, fitZoom.input),
    el('p', { class: 'fd-properties-hint' }, w.mapNote)
  );
  const element = el('div', { class: 'fd-prop', 'data-part': 'map' }, el('span', { class: 'fd-prop-name' }, w.map), onRow, noPlace, details);

  const fieldsOf = (page: Page, kinds: (field: Field) => boolean) => everyField(page, designer).filter(({ field }) => kinds(field));
  const fill = (box: HTMLSelectElement, choices: { name: string; field: Field }[], none?: string) =>
    box.replaceChildren(...(none === undefined ? [] : [el('option', { value: '' }, none)]), ...choices.map(({ name, field }) => el('option', { value: name }, field.label)));
  const current = (): ListMap | undefined => listOf(designer.getPage()).map;
  /** The map with a change, its empty parts left out. */
  const change = (edit: (map: ListMap) => void) => {
    const map = JSON.parse(JSON.stringify(current() ?? {})) as ListMap;
    edit(map);
    const pin = map.pin as Record<string, unknown> | undefined;
    if (pin) for (const key of Object.keys(pin)) if (pin[key] === '' || pin[key] === undefined) delete pin[key];
    if (pin && !Object.keys(pin).length) delete map.pin;
    const card = map.card as Record<string, unknown> | undefined;
    if (card) for (const key of Object.keys(card)) if (card[key] === '' || card[key] === undefined || (Array.isArray(card[key]) && !(card[key] as unknown[]).length)) delete card[key];
    // A pin's money look: its home currency alone, here.
    const money = pin?.['money'] as Record<string, unknown> | undefined;
    if (money) for (const key of Object.keys(money)) if (money[key] === '' || money[key] === undefined) delete money[key];
    if (pin && money && !Object.keys(money).length) delete pin['money'];
    if (pin && !Object.keys(pin).length) delete map.pin;
    if (card && !Object.keys(card).length) delete map.card;
    return designer.setListOptions({ map });
  };
  const pinOf = (map: ListMap): Pin => (map.pin ??= {});

  /** Where a new map puts its records: the first point, or the two numbers named for latitude and longitude. */
  function firstPlace(page: Page): ListMap | null {
    const point = fieldsOf(page, (f) => f.type === 'json')[0];
    return point ? { point: point.name } : firstLatLng(page);
  }
  function firstLatLng(page: Page): ListMap | null {
    const numbers = fieldsOf(page, (f) => NUMBERS.has(f.type));
    if (numbers.length < 2) return null;
    const latitude = numbers.find(({ name }) => /lat/i.test(name)) ?? numbers[0];
    const longitude = numbers.find(({ name }) => /lng|lon/i.test(name) && name !== latitude.name) ?? numbers.find(({ name }) => name !== latitude.name)!;
    return { latitude: latitude.name, longitude: longitude.name };
  }

  on.addEventListener('change', () => {
    const first = firstPlace(designer.getPage());
    designer.setListOptions({ map: on.checked && first ? { ...first, view: 'both' } : null });
  });
  where.addEventListener('change', () =>
    change((map) => {
      delete map.point;
      delete map.latitude;
      delete map.longitude;
      if (where.value === 'latlng') Object.assign(map, firstLatLng(designer.getPage()));
      else map.point = where.value.slice('point:'.length);
    })
  );
  lat.addEventListener('change', () => change((map) => (map.latitude = lat.value)));
  lng.addEventListener('change', () => change((map) => (map.longitude = lng.value)));
  label.addEventListener('change', () => change((map) => (pinOf(map).label = label.value)));
  look.addEventListener('change', () => change((map) => (pinOf(map).look = look.value as Pin['look'])));
  photo.addEventListener('change', () => change((map) => (pinOf(map).image = photo.value)));
  icon.addEventListener('change', () => change((map) => (pinOf(map).icon = icon.value.trim())));
  iconFrom.addEventListener('change', () => change((map) => (pinOf(map).iconField = iconFrom.value)));
  turn.addEventListener('change', () => change((map) => (pinOf(map).turn = turn.value)));
  title.addEventListener('change', () => change((map) => ((map.card ??= {}).title = title.value)));
  picture.addEventListener('change', () => change((map) => ((map.card ??= {}).image = picture.value)));
  cardLink.addEventListener('change', () => change((map) => ((map.card ??= {}).href = cardLink.value)));
  // On is the usual for labels and the box to choose, said by leaving them out; the first line leads only when asked.
  cardLabels.addEventListener('change', () => change((map) => ((map.card ??= {}).labels = cardLabels.checked ? undefined : false)));
  cardLead.addEventListener('change', () => change((map) => ((map.card ??= {}).lead = cardLead.checked || undefined)));
  cardChoose.addEventListener('change', () => change((map) => ((map.card ??= {}).choose = cardChoose.checked ? undefined : false)));
  home.addEventListener('input', () => {
    const code = home.value.trim().toUpperCase();
    // Three letters make a currency; until then nothing is saved, and empty takes it away.
    if (code && !/^[A-Z]{3}$/.test(code)) return;
    change((map) => (((pinOf(map).money ??= {}) as Record<string, unknown>)['home'] = code || undefined));
  });
  opens.addEventListener('change', () => change((map) => (map.view = opens.value as ListMap['view'])));
  bubbles.addEventListener('change', () =>
    change((map) => {
      if (bubbles.checked) delete map.cluster;
      else map.cluster = false;
    })
  );
  for (const { box } of toolTicks)
    box.addEventListener('change', () =>
      change((map) => {
        const picked = toolTicks.filter((t) => t.box.checked).map((t) => t.tool);
        if (picked.length) map.tools = picked;
        else delete map.tools;
      })
    );
  heat.addEventListener('change', () =>
    change((map) => {
      if (heat.checked) map.heat = true;
      else delete map.heat;
    })
  );
  weight.addEventListener('change', () => change((map) => (map.heat = weight.value ? { weight: weight.value } : true)));
  areas.addEventListener('change', () => {
    const set = designer.regionSets().find((s) => s.name === areas.value);
    change((map) => {
      if (!set) return void delete map.regions;
      // The records' field holding an area's key: the one picked before, or the first that can.
      const field = map.regions?.field ?? fieldsOf(designer.getPage(), (f) => KEYS.has(f.type))[0]?.name;
      if (!field) return void (areaWhy.hidden = false);
      map.regions = { from: set.name, key: set.key, ...(set.nameKey ? { name: set.nameKey } : {}), field };
    });
  });
  areaField.addEventListener('change', () => change((map) => map.regions && (map.regions.field = areaField.value)));
  height.addEventListener('change', () =>
    change((map) => {
      if (!height.value) delete map.height;
      else map.height = height.value === 'fill' ? 'fill' : Number(height.value);
    })
  );
  allGestures.addEventListener('change', () =>
    change((map) => {
      if (allGestures.checked) map.gestures = 'all';
      else delete map.gestures;
    })
  );
  addToCard.addEventListener('click', () => {
    const page = designer.getPage();
    const lines = current()?.card?.fields ?? [];
    const shown = new Set(cardLines({ fields: lines }).flatMap((parts) => parts.map((part) => part.field)));
    const choices = fieldsOf(page, (f) => SAYABLE.has(f.type)).filter(({ name }) => !shown.has(name));
    openMenu({
      el,
      anchor: addToCard,
      title: w.cardShows,
      items: choices.map(({ name, field }) => ({ id: name, label: field.label })),
      onPick: (name) => change((map) => ((map.card ??= {}).fields = [...lines, name])),
    });
  });

  return {
    element,
    update(page: Page) {
      const map = listOf(page).map;
      const place = firstPlace(page);
      on.checked = !!map;
      onRow.hidden = !map && !place;
      noPlace.hidden = !!map || !!place;
      details.hidden = !map;
      if (!map) return;
      const points = fieldsOf(page, (f) => f.type === 'json');
      const numbers = fieldsOf(page, (f) => NUMBERS.has(f.type));
      where.replaceChildren(...points.map(({ name, field }) => el('option', { value: `point:${name}` }, w.onePoint(field.label))), ...(numbers.length >= 2 ? [el('option', { value: 'latlng' }, w.latLng)] : []));
      where.value = map.point ? `point:${map.point}` : 'latlng';
      fill(lat, numbers);
      fill(lng, numbers);
      lat.value = map.latitude ?? '';
      lng.value = map.longitude ?? '';
      rows.lat.hidden = rows.lng.hidden = !!map.point;
      const pin = map.pin ?? {};
      fill(label, fieldsOf(page, (f) => SAYABLE.has(f.type)), w.nothing);
      label.value = pin.label ?? '';
      const shownLook = pin.look ?? (pin.label ? 'label' : pin.image ? 'photo' : pin.icon || pin.iconField ? 'icon' : 'pin');
      look.value = shownLook;
      fill(photo, fieldsOf(page, (f) => PICTURES.has(f.type)), w.nothing);
      photo.value = pin.image ?? '';
      rows.photo.hidden = shownLook !== 'photo';
      if (!focused(icon)) icon.value = pin.icon ?? '';
      fill(iconFrom, fieldsOf(page, (f) => f.type === 'char' || f.type === 'selection'), w.nothing);
      iconFrom.value = pin.iconField ?? '';
      fill(turn, numbers, w.nothing);
      turn.value = pin.turn ?? '';
      rows.icon.hidden = rows.iconFrom.hidden = rows.turn.hidden = shownLook !== 'icon';
      // A pin that says an amount: the currency it leaves unsaid.
      rows.home.hidden = page.fields[pin.label ?? '']?.type !== 'monetary';
      if (!focused(home)) home.value = pin.money?.home ?? '';
      fill(title, fieldsOf(page, (f) => SAYABLE.has(f.type)));
      title.value = map.card?.title ?? listOf(page).columns[0];
      fill(picture, fieldsOf(page, (f) => PICTURES.has(f.type)), w.nothing);
      picture.value = map.card?.image ?? '';
      const onCard = map.card?.fields ?? [];
      // Each line a chip: a field, or several on one line, named by their labels.
      cardFields.replaceChildren(
        ...cardLines({ fields: onCard }).map((parts, i) => {
          const named = parts.map((part) => page.fields[part.field]?.label ?? part.field).join(' · ');
          const remove = el('button', { type: 'button', class: 'fd-chip-remove', 'aria-label': w.takeOffCard(named) }, '×');
          remove.addEventListener('click', () => change((next) => ((next.card ??= {}).fields = onCard.filter((_, j) => j !== i))));
          return el('span', { class: 'fd-chip' }, named, remove);
        })
      );
      fill(cardLink, fieldsOf(page, (f) => f.type === 'char' || f.type === 'text'), w.nothing);
      cardLink.value = map.card?.href ?? '';
      cardLabels.checked = map.card?.labels !== false;
      cardLead.checked = !!map.card?.lead;
      cardChoose.checked = map.card?.choose !== false;
      opens.value = map.view ?? 'list';
      bubbles.checked = map.cluster !== false;
      for (const { tool, box } of toolTicks) box.checked = !!map.tools?.includes(tool);
      heat.checked = !!map.heat;
      fill(weight, fieldsOf(page, (f) => NUMBERS.has(f.type) || f.type === 'monetary'), w.eachOne);
      weight.value = typeof map.heat === 'object' ? (map.heat.weight ?? '') : '';
      rows.weight.hidden = !map.heat;
      // Areas by colour: the app's sets of borders, when it gives the designer some.
      const sets = designer.regionSets();
      areas.replaceChildren(el('option', { value: '' }, w.noAreas), ...sets.map((s) => el('option', { value: s.name }, s.name)), ...(map.regions && !sets.some((s) => s.name === map.regions?.from) ? [el('option', { value: map.regions.from }, map.regions.from)] : []));
      areas.value = map.regions?.from ?? '';
      rows.areas.hidden = !sets.length && !map.regions;
      fill(areaField, fieldsOf(page, (f) => KEYS.has(f.type)));
      areaField.value = map.regions?.field ?? '';
      rows.areaField.hidden = !map.regions;
      if (map.regions) areaWhy.hidden = true;
      // The heights offered, and one of the page's own as it is.
      const heights: [string, string][] = [['', w.mapHeights.window], ['fill', w.mapHeights.fill], ['320', w.mapHeights.small], ['480', w.mapHeights.medium], ['640', w.mapHeights.large]];
      const own = map.height === undefined ? '' : String(map.height);
      if (!heights.some(([value]) => value === own)) heights.push([own, w.pixels(Number(own))]);
      height.replaceChildren(...heights.map(([value, text]) => el('option', { value }, text)));
      height.value = own;
      allGestures.checked = map.gestures === 'all';
      zoomHeld = map.fitZoom ?? null;
      fitZoom.refresh();
    },
  };
}

// ---- the list --------------------------------------------------------------------------------

export function listProperties(el: ElementFactory, designer: Designer): PropertiesView {
  const w = designer.words.list;
  // A whole number, 1 to 500, kept as it is left: never the 60 that "600" passes on its way.
  let pageSize = 40;
  const size = settingNumber(el, designer, {
    label: w.rowsOnPage,
    attrs: { class: 'fd-input', placeholder: '40' },
    integer: true,
    min: 1,
    max: 500,
    saved: () => pageSize,
    commit: (n) => n !== null && designer.setListOptions({ pageSize: n }),
  });
  const sortBy = el('select', { class: 'fd-input fd-select', 'aria-label': w.sortedBy }) as HTMLSelectElement;
  const direction = select(el, w.direction, [['asc', w.ascending], ['desc', w.descending]]);
  const saveSort = () => designer.setListOptions({ sort: sortBy.value ? [{ field: sortBy.value, desc: direction.value === 'desc' }] : [] });
  sortBy.addEventListener('change', saveSort);
  direction.addEventListener('change', saveSort);
  const directionRow = prop(el, w.direction, direction);

  const searchBox = el('div', { class: 'fd-list-search-fields' });
  const filtersBox = el('div', { class: 'fd-list-filters' });
  const addFilter = el('button', { type: 'button', class: 'fd-button' }, w.addFilter);
  const rows = new Map<string, ReturnType<typeof filterRow>>();
  addFilter.addEventListener('click', () => {
    const page = designer.getPage();
    const created = designer.addListFilter(w.newFilter, [{ field: listOf(page).columns[0], op: 'set' }]);
    if (created) rows.get(created)?.focus();
  });
  const groupsBox = el('div', { class: 'fd-chips' });
  const addGroup = el('button', { type: 'button', class: 'fd-button' }, w.addGrouping);
  addGroup.addEventListener('click', () => {
    const page = designer.getPage();
    const taken = new Set(listOf(page).groupBy ?? []);
    const choices = everyField(page, designer).filter(({ name, field }) => !taken.has(name) && GROUPABLE.has(field.type));
    openMenu({
      el,
      anchor: addGroup,
      title: w.groupBy,
      items: choices.map(({ name, field }) => ({ id: name, label: field.label })),
      note: w.groupingNote(choices.length > 0),
      onPick: (name) => designer.setListOptions({ groupBy: [...taken, name] }),
    });
  });

  // A box to choose each row; the search bar, or a keyword and each field's values; rows under their parent.
  const choose = el('input', { type: 'checkbox', 'aria-label': w.choose }) as HTMLInputElement;
  // Refused, a box says what the page says: the panel may have been brought up to date already as the refusal was told.
  const pageList = () => listOf(designer.getPage());
  choose.addEventListener('change', () => {
    if (!designer.setListOptions({ choose: choose.checked })) choose.checked = pageList().choose !== false;
  });
  const chooseRow = el('div', { class: 'fd-prop', 'data-part': 'choose' }, el('label', { class: 'fd-q-required' }, choose, el('span', {}, w.choose)), el('p', { class: 'fd-properties-hint' }, w.chooseHint));
  const sorts = el('input', { type: 'checkbox', 'aria-label': w.sortable }) as HTMLInputElement;
  sorts.addEventListener('change', () => {
    if (!designer.setListOptions({ sortable: sorts.checked })) sorts.checked = pageList().sortable !== false;
  });
  const sortsRow = el('div', { class: 'fd-prop', 'data-part': 'sortable' }, el('label', { class: 'fd-q-required' }, sorts, el('span', {}, w.sortable)), el('p', { class: 'fd-properties-hint' }, w.sortableHint));
  // Export and Edit of many rows at once, each off unless asked.
  const exports = el('input', { type: 'checkbox', 'aria-label': w.exportRows }) as HTMLInputElement;
  exports.addEventListener('change', () => {
    if (!designer.setListOptions({ export: exports.checked })) exports.checked = pageList().export === true;
  });
  const exportRow = el('div', { class: 'fd-prop', 'data-part': 'export' }, el('label', { class: 'fd-q-required' }, exports, el('span', {}, w.exportRows)), el('p', { class: 'fd-properties-hint' }, w.exportHint));
  const bulk = el('input', { type: 'checkbox', 'aria-label': w.bulkEdit }) as HTMLInputElement;
  bulk.addEventListener('change', () => {
    if (!designer.setListOptions({ bulkEdit: bulk.checked })) bulk.checked = !!pageList().bulkEdit;
  });
  const bulkRow = el('div', { class: 'fd-prop', 'data-part': 'bulk-edit' }, el('label', { class: 'fd-q-required' }, bulk, el('span', {}, w.bulkEdit)), el('p', { class: 'fd-properties-hint' }, w.bulkEditHint));
  // Import from Excel and CSV, off unless asked, after Export and Edit.
  const imports = el('input', { type: 'checkbox', 'aria-label': w.importRows }) as HTMLInputElement;
  imports.addEventListener('change', () => {
    if (!designer.setListOptions({ import: imports.checked })) imports.checked = !!pageList().import;
  });
  const importRow = el('div', { class: 'fd-prop', 'data-part': 'import' }, el('label', { class: 'fd-q-required' }, imports, el('span', {}, w.importRows)), el('p', { class: 'fd-properties-hint' }, w.importHint));
  // Print every record the search finds, off unless asked, as Export is.
  const prints = el('input', { type: 'checkbox', 'aria-label': w.printRows }) as HTMLInputElement;
  prints.addEventListener('change', () => {
    if (!designer.setListOptions({ print: prints.checked })) prints.checked = pageList().print === true;
  });
  const printRow = el('div', { class: 'fd-prop', 'data-part': 'print' }, el('label', { class: 'fd-q-required' }, prints, el('span', {}, w.printRows)), el('p', { class: 'fd-properties-hint' }, w.printHint));
  const searchWay = select(el, w.searchWay, [['bar', w.searchWays.bar], ['fields', w.searchWays.fields]]);
  searchWay.addEventListener('change', () => designer.setListOptions({ search: searchWay.value as 'bar' | 'fields' }));
  const filterBox = el('div', { class: 'fd-list-filter-fields' });
  const filterFieldsRow = el(
    'div',
    { class: 'fd-prop', 'data-part': 'filter-fields' },
    el('span', { class: 'fd-prop-name' }, w.filterFields),
    filterBox,
    el('p', { class: 'fd-properties-hint' }, w.filterFieldsNote),
    el('p', { class: 'fd-properties-hint' }, w.filterLabelsNote),
    el('p', { class: 'fd-properties-hint' }, w.filterRangesNote)
  );
  // On a phone, the filter bar's fields in a sheet; and how many each filter finds, the filter bar's and the search bar's.
  const sheet = el('input', { type: 'checkbox', 'aria-label': w.filterSheet }) as HTMLInputElement;
  sheet.addEventListener('change', () => {
    if (!designer.setListOptions({ filterSheet: sheet.checked })) sheet.checked = pageList().filterSheet === true;
  });
  const sheetRow = el('div', { class: 'fd-prop', 'data-part': 'filter-sheet' }, el('label', { class: 'fd-q-required' }, sheet, el('span', {}, w.filterSheet)), el('p', { class: 'fd-properties-hint' }, w.filterSheetHint));
  const counts = el('input', { type: 'checkbox', 'aria-label': w.filterCounts }) as HTMLInputElement;
  counts.addEventListener('change', () => {
    if (!designer.setListOptions({ filterCounts: counts.checked })) counts.checked = pageList().filterCounts === true;
  });
  const countsRow = el('div', { class: 'fd-prop', 'data-part': 'filter-counts' }, el('label', { class: 'fd-q-required' }, counts, el('span', {}, w.filterCounts)), el('p', { class: 'fd-properties-hint' }, w.filterCountsHint));
  const parent = el('select', { class: 'fd-input fd-select', 'aria-label': w.parentField }) as HTMLSelectElement;
  parent.addEventListener('change', () => designer.setListOptions({ parentField: parent.value || null }));
  const parentWhy = el('p', { class: 'fd-properties-hint', hidden: '' }, w.noParentField);
  const parentRow = el('label', { class: 'fd-prop', 'data-part': 'parent' }, el('span', { class: 'fd-prop-name' }, w.parentField), parent, parentWhy);

  const onMap = mapSection(el, designer);
  const onCalendar = calendarSection(el, designer);
  const onGantt = ganttSection(el, designer);
  const asCards = cardsSection(el, designer);
  const rowRules = rowsSection(el, designer);
  // What the list's records are called in Fieldia's own sentences, first: the screen's own words (records-settings.ts).
  const records = recordsSettings(el, designer);
  const element = el(
    'div',
    { class: 'fd-props' },
    ...records.rows,
    prop(el, w.rowsOnPage, size.input),
    prop(el, w.sortedBy, sortBy),
    directionRow,
    chooseRow,
    sortsRow,
    exportRow,
    bulkRow,
    // What goes out — Export, Edit, Print — then what comes in.
    printRow,
    importRow,
    prop(el, w.searchWay, searchWay),
    filterFieldsRow,
    sheetRow,
    countsRow,
    parentRow,
    el('div', { class: 'fd-prop' }, el('span', { class: 'fd-prop-name' }, w.searchLooksIn), searchBox, el('p', { class: 'fd-properties-hint' }, w.noneTicked)),
    el('div', { class: 'fd-prop fd-prop-filters', 'data-part': 'filters' }, el('span', { class: 'fd-prop-name' }, w.filters), filtersBox, addFilter),
    el('div', { class: 'fd-prop' }, el('span', { class: 'fd-prop-name' }, w.groupBy), groupsBox, addGroup),
    rowRules.element,
    asCards.element,
    onMap.element,
    onCalendar.element,
    onGantt.element,
    el('p', { class: 'fd-properties-hint' }, w.rowOpens)
  );

  return {
    element,
    update(page) {
      records.update(page);
      const list = listOf(page);
      pageSize = list.pageSize ?? 40;
      size.refresh();
      const sortable = everyField(page, designer).filter(({ field }) => !UNSORTABLE.has(field.type));
      sortBy.replaceChildren(el('option', { value: '' }, w.appOrder), ...sortable.map(({ name, field }) => el('option', { value: name }, field.label)));
      const order = list.sort?.[0];
      sortBy.value = order?.field ?? '';
      direction.value = order?.desc ? 'desc' : 'asc';
      directionRow.hidden = !order;

      // Where the search looks: the columns, and any field named that is not one.
      const looked = new Set(list.searchFields ?? []);
      const names = [...new Set([...list.columns, ...looked])];
      searchBox.replaceChildren(
        ...names.map((name) => {
          const label = page.fields[name]?.label ?? name;
          const box = el('input', { type: 'checkbox', 'aria-label': w.searchLooksInField(label) }) as HTMLInputElement;
          box.checked = looked.has(name);
          box.addEventListener('change', () => designer.setListOptions({ searchFields: names.filter((n) => (n === name ? box.checked : looked.has(n))) }));
          return el('label', { class: 'fd-q-required' }, box, el('span', {}, label));
        })
      );

      const on = new Set(list.defaultFilters ?? []);
      const filters = list.filters ?? [];
      for (const id of [...rows.keys()]) if (!filters.some((f) => f.id === id)) rows.delete(id);
      const drawn = filters.map((filter) => {
        let row = rows.get(filter.id);
        if (!row) {
          row = filterRow(el, designer, filter.id);
          rows.set(filter.id, row);
        }
        row.update(filter.label, filter, on.has(filter.id));
        return row.element;
      });
      drawn.forEach((child, index) => {
        if (filtersBox.children[index] !== child) filtersBox.insertBefore(child, filtersBox.children[index] ?? null);
      });
      while (filtersBox.children.length > drawn.length) filtersBox.lastElementChild?.remove();

      choose.checked = list.choose !== false;
      sorts.checked = list.sortable !== false;
      exports.checked = list.export === true;
      bulk.checked = !!list.bulkEdit;
      imports.checked = !!list.import;
      prints.checked = list.print === true;
      searchWay.value = list.search ?? 'bar';
      // The filter bar's fields: those whose values it can list, ticked in the order the page keeps them.
      filterFieldsRow.hidden = list.search !== 'fields';
      sheetRow.hidden = list.search !== 'fields';
      sheet.checked = list.filterSheet === true;
      counts.checked = list.filterCounts === true;
      const offered = list.filterFields ?? [];
      const filterable = [...new Set([...offered, ...everyField(page, designer).filter(({ field }) => FILTERABLE.has(field.type)).map(({ name }) => name)])];
      /**
       * A number's or a date's filter: a whole number by its range or by its values, and a number's least values, a
       * press each ("1, 2, 3, 4"), kept while they are being typed in.
       */
      const rangeSettings = (name: string, label: string): HTMLElement[] => {
        const type = page.fields[name]?.type ?? '';
        if (!RANGEABLE.has(type)) return [];
        const parts: HTMLElement[] = [];
        const ranged = RANGE_ONLY.has(type) || !!list.filterRanges?.[name];
        if (type === 'integer') {
          const byRange = el('input', { type: 'checkbox', 'aria-label': w.filterByRange(label) }) as HTMLInputElement;
          byRange.checked = ranged;
          byRange.addEventListener('change', () => {
            if (!designer.setListOptions({ filterRange: { field: name, range: byRange.checked ? {} : null } })) byRange.checked = !!pageList().filterRanges?.[name];
          });
          parts.push(el('label', { class: 'fd-q-required' }, byRange, el('span', {}, w.filterByRange(label))));
        }
        if (ranged && type !== 'date' && type !== 'datetime') {
          const least = el('input', { class: 'fd-input fd-list-filter-least', 'data-field': name, inputmode: 'decimal', 'aria-label': w.filterAtLeastOf(label), title: w.filterAtLeastOf(label), placeholder: w.filterAtLeastExample }) as HTMLInputElement;
          least.value = (list.filterRanges?.[name]?.atLeast ?? []).join(', ');
          // Numbers in any digits, parted by commas, Arabic commas or spaces; a word that is no number is refused with why.
          least.addEventListener('change', () => {
            const numbers = foldDigits(least.value).replace(/\u066b/g, '.').split(/[\s,\u060c;]+/).filter(Boolean).map(Number);
            designer.setListOptions({ filterRange: { field: name, range: numbers.length ? { atLeast: numbers } : {} } });
          });
          parts.push(least);
        }
        return parts;
      };
      // Each one offered has a name of its own on the bar, its label unless one is written; kept while it is being typed in.
      const typing = filterBox.querySelector<HTMLInputElement>(':is(.fd-list-filter-name, .fd-list-filter-least):focus');
      if (!typing || !filterable.includes(typing.dataset['field'] ?? '')) {
        filterBox.replaceChildren(
          ...filterable.map((name) => {
            const label = page.fields[name]?.label ?? designer.modelFields().find((m) => m.name === name)?.field.label ?? name;
            const box = el('input', { type: 'checkbox', 'aria-label': w.filterFieldNamed(label) }) as HTMLInputElement;
            box.checked = offered.includes(name);
            box.addEventListener('change', () => designer.setListOptions({ filterFields: box.checked ? [...offered, name] : offered.filter((n) => n !== name) }));
            const choice = el('label', { class: 'fd-q-required' }, box, el('span', {}, label));
            if (!offered.includes(name)) return choice;
            const own = el('input', { class: 'fd-input fd-list-filter-name', 'data-field': name, 'aria-label': w.filterLabelOf(label), title: w.filterLabelOf(label), placeholder: label }) as HTMLInputElement;
            own.value = list.filterLabels?.[name] ?? '';
            own.addEventListener('change', () => designer.setListOptions({ filterLabel: { field: name, label: own.value } }));
            return el('div', { class: 'fd-list-filter-field' }, choice, own, ...rangeSettings(name, label));
          })
        );
      }
      // Rows under their parent: a link to the list's own records.
      const own = page.data.kind === 'record' ? page.data.model : '';
      const links = everyField(page, designer).filter(({ field }) => field.type === 'many2one' && field.relation === own);
      parent.replaceChildren(el('option', { value: '' }, w.noParent), ...links.map(({ name, field }) => el('option', { value: name }, field.label)));
      parent.value = list.parentField ?? '';
      parentWhy.hidden = links.length > 0;
      parentRow.hidden = !links.length && !list.parentField;

      const groups = list.groupBy ?? [];
      groupsBox.replaceChildren(
        ...groups.map((name) => {
          const label = page.fields[name]?.label ?? name;
          const remove = el('button', { type: 'button', class: 'fd-chip-remove', 'aria-label': w.removeGrouping(label) }, '×');
          remove.addEventListener('click', () => designer.setListOptions({ groupBy: groups.filter((g) => g !== name) }));
          return el('span', { class: 'fd-chip' }, label, remove);
        })
      );
      rowRules.update(page);
      asCards.update(page);
      onMap.update(page);
      onCalendar.update(page);
      onGantt.update(page);
    },
    focus() {
      const filters = element.querySelector<HTMLElement>('[data-part="filters"]');
      filters?.scrollIntoView?.({ block: 'nearest' });
    },
  };
}

// ---- a column -----------------------------------------------------------------------------------

export function columnProperties(el: ElementFactory, designer: Designer, name: string): PropertiesView {
  const w = designer.words.list;
  const about = el('p', { class: 'fd-properties-hint' });
  const order = select(el, w.orderBy, [['', w.notOrdered], ['asc', w.ascendingShort], ['desc', w.descendingShort]]);
  order.addEventListener('change', () => {
    const others = (listOf(designer.getPage()).sort ?? []).filter((s) => s.field !== name);
    designer.setListOptions({ sort: order.value ? [{ field: name, desc: order.value === 'desc' }, ...others] : others });
  });
  const orderRow = prop(el, w.orderBy, order);
  const left = el('button', { type: 'button', class: 'fd-button' }, w.moveLeft);
  const right = el('button', { type: 'button', class: 'fd-button' }, w.moveRight);
  const remove = el('button', { type: 'button', class: 'fd-button fd-button-danger' }, w.removeColumn);
  const at = () => listOf(designer.getPage()).columns.indexOf(name);
  left.addEventListener('click', () => designer.moveColumn(name, at() - 1));
  right.addEventListener('click', () => designer.moveColumn(name, at() + 1));
  remove.addEventListener('click', () => designer.removeColumn(name));
  const cells = cellSettings(el, designer, name);
  const element = el('div', { class: 'fd-props' }, about, orderRow, ...cells.rows, el('div', { class: 'fd-props-actions' }, left, right, remove));
  return {
    element,
    update(page) {
      const list = listOf(page);
      const field = page.fields[name];
      if (!field) return;
      about.textContent = w.columnAbout(field.label, storedAs(field, designer.words));
      orderRow.hidden = UNSORTABLE.has(field.type);
      const first = list.sort?.[0];
      order.value = first?.field === name ? (first.desc ? 'desc' : 'asc') : '';
      cells.update(page);
      const index = list.columns.indexOf(name);
      left.hidden = index <= 0;
      right.hidden = index === list.columns.length - 1;
      remove.hidden = list.columns.length === 1;
    },
  };
}

// ---- a column's cells ------------------------------------------------------------------------------

/** The ways a column of a kind can be drawn, beside its words. */
function cellWays(type: string | undefined): string[] {
  switch (type) {
    case 'selection':
      return ['dot', 'badge'];
    case 'many2one':
      return ['badge', 'avatar'];
    case 'many2many':
      return ['tags'];
    case 'char':
      return ['badge', 'avatar', 'image', 'phone'];
    case 'image':
      return ['image', 'avatar'];
    case 'integer':
    case 'float':
      return ['progressbar'];
    default:
      return [];
  }
}

/**
 * How a column draws its cells, as a work tracker's backlog does: a state's
 * dot in each value's colour, an icon before the words by another field's
 * value (a bug's, a task's), a width in characters, the side its words keep to.
 */
function cellSettings(el: ElementFactory, designer: Designer, name: string) {
  const w = designer.words.list;
  const cellNow = (): ListCell => ({ ...listOf(designer.getPage()).cells?.[name] });
  const save = (cell: ListCell) => {
    for (const key of Object.keys(cell) as (keyof ListCell)[]) if (cell[key] === undefined) delete cell[key];
    return designer.setListCell(name, Object.keys(cell).length ? cell : null);
  };
  const widget = select(el, w.cellWidget, []);
  // Another way of drawing it: the options of the one before go with it, but a pill's and a dot's colours, which are the same.
  widget.addEventListener('change', () => {
    const now = cellNow();
    const colours = (widget.value === 'dot' || widget.value === 'badge') && (now.widget === 'dot' || now.widget === 'badge');
    save({ ...now, widget: widget.value || undefined, options: colours ? now.options : undefined });
  });
  const widgetRow = prop(el, w.cellWidget, widget);
  const dots = el('div', { class: 'fd-list-cell-looks' });
  const dotsRow = el('div', { class: 'fd-prop', 'data-part': 'dots' }, dots);
  // A phone's call and WhatsApp links beside its number.
  const links = el('input', { type: 'checkbox', 'aria-label': w.phoneLinks }) as HTMLInputElement;
  links.addEventListener('change', () => {
    const { links: _was, ...rest } = cellNow().options ?? {};
    save({ ...cellNow(), options: links.checked ? { ...rest, links: true } : Object.keys(rest).length ? rest : undefined });
  });
  const linksRow = el('label', { class: 'fd-q-required', 'data-part': 'phone-links' }, links, el('span', {}, w.phoneLinks));
  // Whether people may hide it, from the Columns menu, and how it starts.
  const mayHide = select(el, w.mayHide, (['no', 'show', 'hide'] as const).map((k) => [k, w.mayHideChoices[k]]));
  mayHide.addEventListener('change', () => designer.setListOptions({ optionalColumn: { field: name, starts: mayHide.value === 'no' ? null : (mayHide.value as 'show' | 'hide') } }));
  const mayHideRow = el('div', { class: 'fd-prop', 'data-part': 'may-hide' }, el('span', { class: 'fd-prop-name' }, w.mayHide), mayHide, el('p', { class: 'fd-properties-hint' }, w.mayHideHint));
  const lead = el('select', { class: 'fd-input fd-select', 'aria-label': w.leadFrom }) as HTMLSelectElement;
  lead.addEventListener('change', () => save({ ...cellNow(), lead: lead.value ? { field: lead.value, looks: {} } : undefined }));
  const leadLooks = el('div', { class: 'fd-list-cell-looks' });
  const leadRow = el('div', { class: 'fd-prop', 'data-part': 'lead' }, el('span', { class: 'fd-prop-name' }, w.leadFrom), lead, leadLooks);
  // Its width, in characters of its words or in pixels for the whole column: a number and its unit.
  // A whole number: 1 to 200 characters, or 8 to 4000 pixels; kept as it is left, refused with its range; emptied, as its words need.
  const unit = select(el, w.cellWidthUnit, [['ch', w.cellWidthUnits.characters], ['px', w.cellWidthUnits.pixels]]);
  const widthIn = (n: number): ListCell['width'] => (unit.value === 'px' ? (`${n}px` as `${number}px`) : n);
  const sizing: SettingNumberOptions = {
    label: w.cellWidth,
    integer: true,
    min: 1,
    max: 200,
    optional: true,
    saved: () => {
      const now = cellNow().width;
      return now === undefined ? null : Number.parseInt(String(now), 10);
    },
    commit: (n) => save({ ...cellNow(), width: n === null ? undefined : widthIn(n) }),
  };
  const width = settingNumber(el, designer, sizing);
  const unitRange = () => {
    sizing.min = unit.value === 'px' ? 8 : 1;
    sizing.max = unit.value === 'px' ? 4000 : 200;
  };
  unit.addEventListener('change', () => {
    unitRange();
    // The same number in the other unit, when it is a width in that one too.
    const n = sizing.saved();
    if (typeof n === 'number' && widthIsGood(widthIn(n))) save({ ...cellNow(), width: widthIn(n) });
  });
  const widthRow = el('div', { class: 'fd-prop', 'data-part': 'width' }, el('span', { class: 'fd-prop-name' }, w.cellWidth), el('div', { class: 'fd-list-width' }, width.input, unit), el('p', { class: 'fd-properties-hint' }, w.cellWidthHint));
  const side = select(el, w.cellSide, [['', w.cellSides.auto], ['start', w.cellSides.start], ['end', w.cellSides.end]]);
  side.addEventListener('change', () => save({ ...cellNow(), align: (side.value || undefined) as ListCell['align'] }));
  // Its header's rule: at its end, none, or set in from its end by some pixels.
  const rule = select(el, w.cellRule, [['', w.cellRules.end], ['none', w.cellRules.none], ['in', w.cellRules.in]]);
  // Pixels in from the column's end, a whole number 0 to 400, kept as it is left: letters never become 0px.
  const ruleNow = () => {
    const now = cellNow().rule;
    return typeof now === 'string' ? Number.parseInt(now, 10) : null;
  };
  const ruleIn = settingNumber(el, designer, {
    label: w.cellRuleIn,
    integer: true,
    min: 0,
    max: 400,
    saved: ruleNow,
    commit: (n) => n !== null && ruleIsGood(`${n}px`) && save({ ...cellNow(), rule: `${n}px` as `${number}px` }),
  });
  rule.addEventListener('change', () => {
    if (rule.value === 'none') return void save({ ...cellNow(), rule: false });
    if (rule.value === '') return void save({ ...cellNow(), rule: undefined });
    save({ ...cellNow(), rule: `${ruleNow() ?? 0}px` as `${number}px` });
  });
  const ruleInRow = prop(el, w.cellRuleIn, ruleIn.input);
  const ruleRow = el('div', { class: 'fd-prop', 'data-part': 'rule' }, el('span', { class: 'fd-prop-name' }, w.cellRule), rule, el('p', { class: 'fd-properties-hint' }, w.cellRuleHint));
  // Its total, under the list, on Group By headings and for the rows ticked: a number's sum, average, lowest or highest, or any column's count.
  const total = select(el, w.cellTotal, []);
  total.addEventListener('change', () => save({ ...cellNow(), total: (total.value || undefined) as TotalKind | undefined }));
  const totalRow = el('div', { class: 'fd-prop', 'data-part': 'total' }, el('span', { class: 'fd-prop-name' }, w.cellTotal), total, el('p', { class: 'fd-properties-hint' }, w.cellTotalHint));

  /** A value's colour, and its icon for a lead: a row for each option of a choice. */
  const optionRows = (field: Field | undefined, row: (value: string, label: string) => HTMLElement[]) =>
    field?.type === 'selection' ? field.options.map((option) => el('div', { class: 'fd-list-cell-look' }, el('span', { class: 'fd-list-cell-look-name' }, option.label), ...row(String(option.value), option.label))) : [];

  return {
    rows: [widgetRow, dotsRow, linksRow, leadRow, widthRow, prop(el, w.cellSide, side), totalRow, ruleRow, ruleInRow, mayHideRow],
    update(page: Page) {
      const field = page.fields[name];
      const cell = page.layout.type === 'list' ? (page.layout.cells?.[name] ?? {}) : {};
      const kinds: TotalKind[] = field && ['integer', 'float', 'monetary'].includes(field.type) ? ['sum', 'avg', 'min', 'max', 'count'] : ['count'];
      total.replaceChildren(el('option', { value: '' }, w.cellTotals.none), ...kinds.map((kind) => el('option', { value: kind }, w.cellTotals[kind])));
      total.value = cell.total ?? '';
      // The ways its kind can be drawn: a choice's dot or pill, links' chips, a picture, a number's bar, a phone.
      const ways = cellWays(field?.type);
      widget.replaceChildren(...['', ...ways].map((way) => el('option', { value: way }, w.cellWidgets[(way || 'words') as keyof typeof w.cellWidgets])));
      widget.value = cell.widget && ways.includes(cell.widget) ? cell.widget : '';
      widgetRow.hidden = !ways.length;
      // Each state's dot or pill colour, when the column draws one.
      dotsRow.hidden = cell.widget !== 'dot' && cell.widget !== 'badge';
      linksRow.hidden = cell.widget !== 'phone';
      links.checked = cell.options?.['links'] === true;
      const list = page.layout.type === 'list' ? page.layout : undefined;
      mayHide.value = list?.optionalColumns?.[name] ?? 'no';
      const colours = (cell.options?.['colours'] ?? {}) as Record<string, string>;
      dots.replaceChildren(
        ...optionRows(field, (value, label) => {
          const colour = el('input', { type: 'color', class: 'fd-insp-colour', 'aria-label': cell.widget === 'badge' ? w.pillColour(label) : w.dotColour(label) }) as HTMLInputElement;
          colour.value = colours[value] ?? '#7e7e7e';
          colour.addEventListener('input', () => save({ ...cellNow(), options: { ...cellNow().options, colours: { ...((cellNow().options?.['colours'] ?? {}) as Record<string, string>), [value]: colour.value } } }));
          return [colour];
        })
      );
      // An icon before the words: by a choice's value, each with its icon and colour.
      const choices = everyField(page, designer).filter(({ field: f }) => f.type === 'selection');
      lead.replaceChildren(el('option', { value: '' }, w.noLead), ...choices.map(({ name: n, field: f }) => el('option', { value: n }, f.label)));
      lead.value = cell.lead?.field ?? '';
      const from = cell.lead ? page.fields[cell.lead.field] : undefined;
      leadLooks.replaceChildren(
        ...optionRows(from, (value, label) => {
          const look = cell.lead?.looks[value];
          const icon = el('input', { class: 'fd-input', 'aria-label': w.leadIcon(label), placeholder: 'bug' }) as HTMLInputElement;
          icon.value = look?.icon ?? '';
          const colour = el('input', { type: 'color', class: 'fd-insp-colour', 'aria-label': w.leadColour(label) }) as HTMLInputElement;
          colour.value = look?.colour ?? '#7e7e7e';
          const write = () => {
            const now = cellNow();
            if (!now.lead) return;
            const looks = { ...now.lead.looks };
            if (icon.value.trim()) looks[value] = { icon: icon.value.trim(), ...(look?.colour || colour.value !== '#7e7e7e' ? { colour: colour.value } : {}) };
            else delete looks[value];
            save({ ...now, lead: { field: now.lead.field, looks } });
          };
          icon.addEventListener('change', write);
          colour.addEventListener('input', write);
          return [icon, colour];
        })
      );
      const inPixels = typeof cell.width === 'string';
      if (!focused(unit) && cell.width !== undefined) unit.value = inPixels ? 'px' : 'ch';
      unitRange();
      width.refresh();
      side.value = cell.align ?? '';
      if (!focused(rule)) rule.value = cell.rule === false ? 'none' : cell.rule ? 'in' : '';
      ruleIn.refresh();
      ruleInRow.hidden = rule.value !== 'in';
    },
  };
}

// ---- a button for the rows chosen ----------------------------------------------------------------

export function listActionProperties(el: ElementFactory, designer: Designer, id: string): PropertiesView {
  const w = designer.words.list;
  const p = designer.words.panel;
  const words = el('input', { class: 'fd-input', 'aria-label': w.words }) as HTMLInputElement;
  words.addEventListener('input', () => designer.updateListAction(id, { label: words.value }));
  // steps lane: what it does when clicked, its app action one of the steps.
  const pressed = whenClicked(el, designer, id);
  const look = select(el, w.look, [['secondary', p.buttonLooks.secondary], ['primary', p.buttonLooks.primary], ['danger', p.buttonLooks.danger], ['link', p.buttonLooks.link]]);
  look.addEventListener('change', () => designer.updateListAction(id, { style: look.value as ButtonNode['style'] }));
  const asks = el('input', { class: 'fd-input', 'aria-label': p.asksFirst, placeholder: p.actsAtOnce }) as HTMLInputElement;
  asks.addEventListener('input', () => designer.updateListAction(id, { confirm: asks.value }));
  const remove = el('button', { type: 'button', class: 'fd-button fd-button-danger' }, w.delete);
  remove.addEventListener('click', () => designer.removeListAction(id));
  const element = el(
    'div',
    { class: 'fd-props' },
    prop(el, w.words, words),
    pressed.element,
    prop(el, w.look, look),
    prop(el, p.asksFirst, asks),
    el('div', { class: 'fd-props-actions' }, remove)
  );
  return {
    element,
    update(page) {
      const button = listOf(page).actions?.find((a) => a.id === id);
      if (!button) return;
      if (!focused(words)) words.value = button.label;
      pressed.update(page);
      look.value = button.style ?? 'secondary';
      if (!focused(asks)) asks.value = button.confirm ?? '';
    },
  };
}
