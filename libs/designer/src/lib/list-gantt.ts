import type { Field, GanttZoom, ListGantt, ListNode, Page } from '@fieldia/core';
import type { ElementFactory } from './chrome';
import type { Designer } from './designer';

/**
 * A list's Gantt timeline in its panel, beside its calendar: whether there
 * is one, when each record starts, and ends or how many days it lasts, its
 * words, its group, its colour, what it waits for, the scales offered and
 * the one shown first, and how the list opens.
 */

const TIMES = new Set(['date', 'datetime']);
/** Fields a bar's words can come from. */
const SAYABLE = new Set(['char', 'text', 'selection', 'many2one', 'integer', 'float', 'monetary', 'date', 'datetime']);
/** Fields a colour can come from: values that repeat. */
const COLOURS = new Set(['many2one', 'selection', 'char', 'integer', 'boolean']);
/** Fields a group can come from. */
const GROUPS = new Set(['many2one', 'selection', 'char', 'integer']);
/** Fields a number of days can come from. */
const LENGTHS = new Set(['integer', 'float']);
const ZOOMS: GanttZoom[] = ['day', 'week', 'month'];

const listOf = (page: Page) => page.layout as ListNode;

export function ganttSection(el: ElementFactory, designer: Designer) {
  const w = designer.words.list.gantt;
  const prop = (text: string, control: HTMLElement) => el('label', { class: 'fd-prop' }, el('span', { class: 'fd-prop-name' }, text), control);
  const select = (label: string) => el('select', { class: 'fd-input fd-select', 'aria-label': label }) as HTMLSelectElement;
  const on = el('input', { type: 'checkbox' }) as HTMLInputElement;
  const onRow = el('label', { class: 'fd-q-required' }, on, el('span', {}, w.on));
  const noDate = el('p', { class: 'fd-properties-hint', 'data-why': 'no-date' }, w.noDate);
  const start = select(w.start);
  const end = select(w.end);
  const duration = select(w.duration);
  const words = select(w.words);
  const group = select(w.group);
  const colour = select(w.colour);
  const waits = select(w.dependsOn);
  const noWaits = el('p', { class: 'fd-properties-hint', 'data-why': 'no-waits' }, w.noWaits);
  const zoomTicks = ZOOMS.map((zoom) => ({ zoom, box: el('input', { type: 'checkbox' }) as HTMLInputElement }));
  const zooms = el('div', { class: 'fd-map-tools', role: 'group', 'aria-label': w.zooms }, ...zoomTicks.map(({ zoom, box }) => el('label', { class: 'fd-q-required' }, box, el('span', {}, w.zoomNames[zoom]))));
  const oneZoom = el('p', { class: 'fd-properties-hint', role: 'status', 'data-why': 'zooms', hidden: '' }, w.oneZoom);
  const first = select(w.first);
  const opens = select(w.opens);
  opens.append(...(['list', 'gantt'] as const).map((value) => el('option', { value }, w.opensChoices[value])));
  const waitsRow = prop(w.dependsOn, waits);
  const details = el(
    'div',
    { class: 'fd-props' },
    prop(w.start, start),
    prop(w.end, end),
    prop(w.duration, duration),
    prop(w.words, words),
    prop(w.group, group),
    prop(w.colour, colour),
    waitsRow,
    noWaits,
    el('div', { class: 'fd-prop' }, el('span', { class: 'fd-prop-name' }, w.zooms), zooms, oneZoom),
    prop(w.first, first),
    prop(w.opens, opens),
    el('p', { class: 'fd-properties-hint' }, w.note)
  );
  const element = el('div', { class: 'fd-prop', 'data-part': 'gantt' }, el('span', { class: 'fd-prop-name' }, w.title), onRow, noDate, details);

  /** The page's fields first, then the model's not on it yet, of the kinds asked. */
  const fieldsOf = (page: Page, kinds: ReadonlySet<string>) =>
    [...Object.entries(page.fields).map(([name, field]) => ({ name, field })), ...designer.modelFields()].filter(({ field }) => kinds.has(field.type));
  const fill = (box: HTMLSelectElement, choices: { name: string; field: Field }[], none?: string) =>
    box.replaceChildren(...(none === undefined ? [] : [el('option', { value: '' }, none)]), ...choices.map(({ name, field }) => el('option', { value: name }, field.label)));
  const kindOf = (page: Page, name: string | undefined) => (name ? (page.fields[name]?.type ?? designer.modelFields().find((f) => f.name === name)?.field.type) : undefined);
  /** The links to the list's own records, of many: what a record may wait for. */
  const ownLinks = (page: Page) => {
    const model = page.data.kind === 'record' ? page.data.model : '';
    return fieldsOf(page, new Set(['many2many'])).filter(({ field }) => field.type === 'many2many' && field.relation === model);
  };
  const current = (): ListGantt | undefined => listOf(designer.getPage()).gantt;
  /** The timeline with a change, its empty parts left out. */
  const change = (edit: (gantt: ListGantt) => void) => {
    const gantt = JSON.parse(JSON.stringify(current() ?? {})) as ListGantt;
    edit(gantt);
    for (const key of Object.keys(gantt) as (keyof ListGantt)[]) if (gantt[key] === '' || gantt[key] === undefined) delete gantt[key];
    return designer.setListOptions({ gantt });
  };

  /** A new timeline: the first date (or date and time), an end of its kind named so — else a number of days — the list's first words, and what each waits for. */
  function firstGantt(page: Page): ListGantt | null {
    const times = fieldsOf(page, TIMES);
    const begin = times.find(({ field }) => field.type === 'date') ?? times[0];
    if (!begin) return null;
    const sameKind = times.filter(({ name, field }) => name !== begin.name && field.type === begin.field.type);
    const until = sameKind.find(({ name, field }) => /end|stop|until|to$|finish|deadline/i.test(`${name} ${field.label}`)) ?? sameKind[0];
    const days = until ? undefined : fieldsOf(page, LENGTHS).find(({ name, field }) => /day|duration|length|lasts/i.test(`${name} ${field.label}`));
    const list = listOf(page);
    const title = list.columns.find((name) => page.fields[name]?.type === 'char') ?? list.columns[0];
    const after = ownLinks(page)[0];
    return { start: begin.name, ...(until ? { end: until.name } : days ? { duration: days.name } : {}), title, ...(after ? { dependsOn: after.name } : {}) };
  }

  on.addEventListener('change', () => {
    const made = firstGantt(designer.getPage());
    designer.setListOptions({ gantt: on.checked && made ? made : null });
  });
  start.addEventListener('change', () =>
    change((gantt) => {
      gantt.start = start.value;
      // An end of another kind goes with the old start.
      const page = designer.getPage();
      if (gantt.end && kindOf(page, gantt.end) !== kindOf(page, start.value)) delete gantt.end;
    })
  );
  // An end or a number of days: one, never both.
  end.addEventListener('change', () =>
    change((gantt) => {
      gantt.end = end.value || undefined;
      if (gantt.end) delete gantt.duration;
    })
  );
  duration.addEventListener('change', () =>
    change((gantt) => {
      gantt.duration = duration.value || undefined;
      if (gantt.duration) delete gantt.end;
    })
  );
  words.addEventListener('change', () => change((gantt) => (gantt.title = words.value)));
  group.addEventListener('change', () => change((gantt) => (gantt.group = group.value || undefined)));
  colour.addEventListener('change', () => change((gantt) => (gantt.colour = colour.value || undefined)));
  waits.addEventListener('change', () => change((gantt) => (gantt.dependsOn = waits.value || undefined)));
  for (const { box } of zoomTicks)
    box.addEventListener('change', () => {
      const picked = zoomTicks.filter((t) => t.box.checked).map((t) => t.zoom);
      // One at least: the last one stays ticked, and says why.
      oneZoom.hidden = picked.length > 0;
      if (!picked.length) return void (box.checked = true);
      change((gantt) => {
        gantt.zooms = picked.length === ZOOMS.length ? undefined : picked;
        if (gantt.zoom && !picked.includes(gantt.zoom)) delete gantt.zoom;
      });
    });
  first.addEventListener('change', () =>
    change((gantt) => {
      const offered = gantt.zooms ?? ZOOMS;
      const own = offered.includes('week') ? 'week' : offered[0];
      gantt.zoom = first.value === own ? undefined : (first.value as GanttZoom);
    })
  );
  opens.addEventListener('change', () => change((gantt) => (gantt.opens = opens.value === 'gantt' ? 'gantt' : undefined)));

  return {
    element,
    update(page: Page) {
      const gantt = listOf(page).gantt;
      const canHave = fieldsOf(page, TIMES).length > 0;
      on.checked = !!gantt;
      onRow.hidden = !gantt && !canHave;
      noDate.hidden = !!gantt || canHave;
      details.hidden = !gantt;
      if (!gantt) return;
      const startKind = kindOf(page, gantt.start);
      fill(start, fieldsOf(page, TIMES));
      start.value = gantt.start;
      fill(end, fieldsOf(page, TIMES).filter(({ name, field }) => field.type === startKind && name !== gantt.start), w.noEnd);
      end.value = gantt.end ?? '';
      fill(duration, fieldsOf(page, LENGTHS), w.nothing);
      duration.value = gantt.duration ?? '';
      fill(words, fieldsOf(page, SAYABLE));
      words.value = gantt.title;
      fill(group, fieldsOf(page, GROUPS), w.nothing);
      group.value = gantt.group ?? '';
      fill(colour, fieldsOf(page, COLOURS), w.nothing);
      colour.value = gantt.colour ?? '';
      // What each waits for: a link to the list's own records, of many; with none, why.
      const links = ownLinks(page);
      fill(waits, links, w.nothing);
      waits.value = gantt.dependsOn ?? '';
      waitsRow.hidden = !links.length && !gantt.dependsOn;
      noWaits.hidden = !waitsRow.hidden;
      const offered = gantt.zooms ?? ZOOMS;
      for (const { zoom, box } of zoomTicks) box.checked = offered.includes(zoom);
      first.replaceChildren(...offered.map((zoom) => el('option', { value: zoom }, w.zoomNames[zoom])));
      first.value = gantt.zoom ?? (offered.includes('week') ? 'week' : offered[0]);
      opens.value = gantt.opens ?? 'list';
    },
  };
}
