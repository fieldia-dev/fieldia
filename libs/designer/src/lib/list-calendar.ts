import type { CalendarView, Field, ListCalendar, ListNode, Page } from '@fieldia/core';
import type { ElementFactory } from './chrome';
import type { Designer } from './designer';

/**
 * A list's calendar in its panel, as its map is: whether there is one, when
 * each record starts and ends, its words, its colour, a column for each
 * person or room, the views offered and the one shown first, how the list
 * opens, the week's first day, the hours and a slot's minutes.
 */

const TIMES = new Set(['date', 'datetime']);
/** Fields a record's words can come from. */
const SAYABLE = new Set(['char', 'text', 'selection', 'many2one', 'integer', 'float', 'monetary', 'date', 'datetime']);
/** Fields a colour can come from: values that repeat. */
const COLOURS = new Set(['many2one', 'selection', 'char', 'integer', 'boolean']);
/** Fields a column for each can come from. */
const COLUMNS = new Set(['many2one', 'selection', 'char', 'integer']);
const VIEWS: CalendarView[] = ['day', 'week', 'month', 'agenda'];
const SLOTS = [15, 30, 60] as const;

const listOf = (page: Page) => page.layout as ListNode;
const focused = (node: Element) => node.ownerDocument.activeElement === node;

export function calendarSection(el: ElementFactory, designer: Designer) {
  const w = designer.words.list.calendar;
  const prop = (text: string, control: HTMLElement) => el('label', { class: 'fd-prop' }, el('span', { class: 'fd-prop-name' }, text), control);
  const select = (label: string) => el('select', { class: 'fd-input fd-select', 'aria-label': label }) as HTMLSelectElement;
  const on = el('input', { type: 'checkbox' }) as HTMLInputElement;
  const onRow = el('label', { class: 'fd-q-required' }, on, el('span', {}, w.on));
  const noDate = el('p', { class: 'fd-properties-hint', 'data-why': 'no-date' }, w.noDate);
  const start = select(w.start);
  const end = select(w.end);
  const words = select(w.words);
  const colour = select(w.colour);
  const resource = select(w.resource);
  const viewTicks = VIEWS.map((view) => ({ view, box: el('input', { type: 'checkbox' }) as HTMLInputElement }));
  const views = el('div', { class: 'fd-map-tools', role: 'group', 'aria-label': w.views }, ...viewTicks.map(({ view, box }) => el('label', { class: 'fd-q-required' }, box, el('span', {}, w.viewNames[view]))));
  const oneView = el('p', { class: 'fd-properties-hint', role: 'status', 'data-why': 'views', hidden: '' }, w.oneView);
  const first = select(w.first);
  const opens = select(w.opens);
  opens.append(...(['list', 'calendar'] as const).map((value) => el('option', { value }, w.opensChoices[value])));
  const firstDay = select(w.firstDay);
  firstDay.append(el('option', { value: '' }, w.languageDay), ...w.days.map((day, i) => el('option', { value: String(i) }, day)));
  const from = el('input', { class: 'fd-input', type: 'number', min: '0', max: '23', placeholder: '8', 'aria-label': w.from }) as HTMLInputElement;
  const to = el('input', { class: 'fd-input', type: 'number', min: '1', max: '24', placeholder: '20', 'aria-label': w.to }) as HTMLInputElement;
  const slot = select(w.slot);
  slot.append(...SLOTS.map((minutes) => el('option', { value: String(minutes) }, w.slots[minutes])));
  const details = el(
    'div',
    { class: 'fd-props' },
    prop(w.start, start),
    prop(w.end, end),
    prop(w.words, words),
    prop(w.colour, colour),
    prop(w.resource, resource),
    el('div', { class: 'fd-prop' }, el('span', { class: 'fd-prop-name' }, w.views), views, oneView),
    prop(w.first, first),
    prop(w.opens, opens),
    prop(w.firstDay, firstDay),
    prop(w.from, from),
    prop(w.to, to),
    prop(w.slot, slot),
    el('p', { class: 'fd-properties-hint' }, w.note)
  );
  const element = el('div', { class: 'fd-prop', 'data-part': 'calendar' }, el('span', { class: 'fd-prop-name' }, w.title), onRow, noDate, details);

  /** The page's fields first, then the model's not on it yet, of the kinds asked. */
  const fieldsOf = (page: Page, kinds: ReadonlySet<string>) =>
    [...Object.entries(page.fields).map(([name, field]) => ({ name, field })), ...designer.modelFields()].filter(({ field }) => kinds.has(field.type));
  const fill = (box: HTMLSelectElement, choices: { name: string; field: Field }[], none?: string) =>
    box.replaceChildren(...(none === undefined ? [] : [el('option', { value: '' }, none)]), ...choices.map(({ name, field }) => el('option', { value: name }, field.label)));
  const current = (): ListCalendar | undefined => listOf(designer.getPage()).calendar;
  /** The calendar with a change, its empty parts left out. */
  const change = (edit: (calendar: ListCalendar) => void) => {
    const calendar = JSON.parse(JSON.stringify(current() ?? {})) as ListCalendar;
    edit(calendar);
    for (const key of Object.keys(calendar) as (keyof ListCalendar)[]) if (calendar[key] === '' || calendar[key] === undefined) delete calendar[key];
    return designer.setListOptions({ calendar });
  };

  /** A new calendar: the first date and time (or date), an end of its kind named so or the next of it, and the list's first words. */
  function firstCalendar(page: Page): ListCalendar | null {
    const times = fieldsOf(page, TIMES);
    const begin = times.find(({ field }) => field.type === 'datetime') ?? times[0];
    if (!begin) return null;
    const sameKind = times.filter(({ name, field }) => name !== begin.name && field.type === begin.field.type);
    const until = sameKind.find(({ name, field }) => /end|stop|until|to$|finish/i.test(`${name} ${field.label}`)) ?? sameKind[0];
    const list = listOf(page);
    const title = list.columns.find((name) => page.fields[name]?.type === 'char') ?? list.columns[0];
    return { start: begin.name, ...(until ? { end: until.name } : {}), title };
  }

  on.addEventListener('change', () => {
    const made = firstCalendar(designer.getPage());
    designer.setListOptions({ calendar: on.checked && made ? made : null });
  });
  start.addEventListener('change', () =>
    change((calendar) => {
      calendar.start = start.value;
      // An end of another kind goes with the old start.
      const kind = designer.getPage().fields[start.value]?.type ?? designer.modelFields().find((f) => f.name === start.value)?.field.type;
      const endKind = calendar.end ? (designer.getPage().fields[calendar.end]?.type ?? designer.modelFields().find((f) => f.name === calendar.end)?.field.type) : kind;
      if (endKind !== kind) delete calendar.end;
    })
  );
  end.addEventListener('change', () => change((calendar) => (calendar.end = end.value || undefined)));
  words.addEventListener('change', () => change((calendar) => (calendar.title = words.value)));
  colour.addEventListener('change', () => change((calendar) => (calendar.colour = colour.value || undefined)));
  resource.addEventListener('change', () => change((calendar) => (calendar.resource = resource.value || undefined)));
  for (const { box } of viewTicks)
    box.addEventListener('change', () => {
      const picked = viewTicks.filter((t) => t.box.checked).map((t) => t.view);
      // One at least: the last one stays ticked, and says why.
      oneView.hidden = picked.length > 0;
      if (!picked.length) return void (box.checked = true);
      change((calendar) => {
        calendar.views = picked.length === VIEWS.length ? undefined : picked;
        if (calendar.view && !picked.includes(calendar.view)) delete calendar.view;
      });
    });
  first.addEventListener('change', () =>
    change((calendar) => {
      const offered = calendar.views ?? VIEWS;
      calendar.view = first.value === offered[0] ? undefined : (first.value as CalendarView);
    })
  );
  opens.addEventListener('change', () => change((calendar) => (calendar.opens = opens.value === 'calendar' ? 'calendar' : undefined)));
  firstDay.addEventListener('change', () => change((calendar) => (calendar.firstDay = firstDay.value === '' ? undefined : Number(firstDay.value))));
  const hours = () =>
    change((calendar) => {
      const [a, b] = [from.value.trim(), to.value.trim()];
      // Both, or neither: the page's own 8 to 20.
      if (!a && !b) return void delete calendar.hours;
      calendar.hours = { start: Math.round(Number(a || 8)), end: Math.round(Number(b || 20)) };
    });
  from.addEventListener('change', hours);
  to.addEventListener('change', hours);
  slot.addEventListener('change', () => change((calendar) => (calendar.slot = slot.value === '30' ? undefined : (Number(slot.value) as ListCalendar['slot']))));

  return {
    element,
    update(page: Page) {
      const calendar = listOf(page).calendar;
      const canHave = fieldsOf(page, TIMES).length > 0;
      on.checked = !!calendar;
      onRow.hidden = !calendar && !canHave;
      noDate.hidden = !!calendar || canHave;
      details.hidden = !calendar;
      if (!calendar) return;
      const kindOf = (name: string | undefined) => (name ? (page.fields[name]?.type ?? designer.modelFields().find((f) => f.name === name)?.field.type) : undefined);
      const startKind = kindOf(calendar.start);
      fill(start, fieldsOf(page, TIMES));
      start.value = calendar.start;
      fill(end, fieldsOf(page, TIMES).filter(({ field }) => field.type === startKind), w.noEnd);
      end.value = calendar.end ?? '';
      fill(words, fieldsOf(page, SAYABLE));
      words.value = calendar.title;
      fill(colour, fieldsOf(page, COLOURS), w.nothing);
      colour.value = calendar.colour ?? '';
      fill(resource, fieldsOf(page, COLUMNS), w.nothing);
      resource.value = calendar.resource ?? '';
      const offered = calendar.views ?? VIEWS;
      for (const { view, box } of viewTicks) box.checked = offered.includes(view);
      first.replaceChildren(...offered.map((view) => el('option', { value: view }, w.viewNames[view])));
      first.value = calendar.view ?? offered[0];
      opens.value = calendar.opens ?? 'list';
      firstDay.value = calendar.firstDay === undefined ? '' : String(calendar.firstDay);
      if (!focused(from)) from.value = calendar.hours ? String(calendar.hours.start) : '';
      if (!focused(to)) to.value = calendar.hours ? String(calendar.hours.end) : '';
      slot.value = String(calendar.slot ?? 30);
    },
  };
}
