import { dayIn, dayWords, fill, instantsAt, isOwnZone, wallClock, wallDay, wallOf, wallTime, zoneOffset } from '@fieldia/core';
import { drawIcon, zoneName } from '@fieldia/widgets';
import type { ChatterContext } from './chatter';
import type { Activity, ActivityType, Person } from './source';

/** Days after a day, `YYYY-MM-DD`, as `YYYY-MM-DD`. */
function daysAfter(day: string, days: number): string {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, date + days)).toISOString().slice(0, 10);
}

/** When an activity is due, as read on the page's clock: its day, and its time and instant where it has an hour. */
export interface Due {
  day: string;
  /** `HH:MM` on the page's clock; null for a day alone. */
  time: string | null;
  /** The instant, in ms; null for a day alone. */
  at: number | null;
}

/**
 * An activity's `due` read on the page's clock (`zone`, the browser's own without one): a day alone; an instant
 * written with its offset (`2026-10-20T12:30:00Z`), as Fieldia keeps a date and time; or a day and a time on the
 * page's clock (`2026-10-20T15:30`). A time the clocks skip is the first minute after them.
 */
export function readDue(due: string, zone?: string): Due {
  if (/^\d{4}-\d{2}-\d{2}$/.test(due)) return { day: due, time: null, at: null };
  const instant = /T.*(Z|[+-]\d{2}:?\d{2})$/i.test(due) ? Date.parse(due) : NaN;
  if (Number.isFinite(instant)) {
    const wall = wallTime(instant, zone);
    return { day: wallDay(wall), time: wallClock(wall), at: instant };
  }
  const wall = wallOf(due);
  if (!wall) return { day: due.slice(0, 10), time: null, at: null };
  const local = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute);
  const at = instantsAt(wall, zone)[0] ?? local - zoneOffset(local + 86400000, zone) * 60000;
  return { day: wallDay(wall), time: wallClock(wall), at };
}

/** The instant a day and a time on the page's clock name, as Fieldia keeps a date and time: `2026-10-20T12:30:00.000Z`. */
export function dueInstant(day: string, time: string, zone?: string): string {
  return new Date(readDue(`${day}T${time}`, zone).at as number).toISOString();
}

/** Whether an activity is late — its day gone, or its hour passed —, due today, or ahead. */
export function dueState(due: Due, today: string, now: number): 'overdue' | 'today' | 'planned' {
  if (due.at !== null ? due.at < now : due.day < today) return 'overdue';
  return due.day === today ? 'today' : 'planned';
}

const RANK = { overdue: 0, today: 1, planned: 2 } as const;

/**
 * A moment as the page's date boxes write one, on its clock: "20 Oct 2026, 09:20", in the page's order and language
 * (`dayWords`) — with its zone's short name where it is not the browser's own, where `zoned` asks ("09:20 EEST").
 */
export function momentWords(context: Pick<ChatterContext, 'locale' | 'zone' | 'dateOrder'>, at: number, zoned = false): string {
  const wall = wallTime(at, context.zone);
  const order = context.dateOrder ?? 'dmy';
  return `${dayWords(wallDay(wall), { locale: context.locale, dateOrder: order })}${order === 'ymd' ? ' ' : ', '}${clockWords(context, at, zoned)}`;
}
/** A moment's time on the page's clock, "15:30" — "15:30 EEST" where `zoned` asks and the zone is not the browser's own. */
function clockWords(context: Pick<ChatterContext, 'locale' | 'zone'>, at: number, zoned: boolean): string {
  const time = wallClock(wallTime(at, context.zone));
  return zoned && context.zone && !isOwnZone(context.zone) ? `${time} ${zoneName(at, context.zone, context.locale)}` : time;
}

/**
 * The record's activities: what is to be done, by whom and by when, overdue
 * first. Each can be marked done, with what came of it, or cancelled; a form
 * schedules a new one. Every part the source cannot do is left out.
 */
export function activitiesPart(context: ChatterContext, afterChange: () => Promise<void>) {
  const { el, labels, source, doc, icons, locale, zone } = context;
  const dayText = (day: string) => dayWords(day, { locale, dateOrder: context.dateOrder ?? 'dmy' });
  if (!source.activities) return { button: null, element: null, load: async () => undefined };
  const list = el('ul', { class: 'fd-activity-list' });
  const element = el('section', { class: 'fd-activities', 'aria-label': labels.activities }, list);
  const canSchedule = !!(source.schedule && source.activityTypes && source.people);
  /** An hour on the page's clock, its zone named where it is not the browser's own: "15:30 EEST"; with its day, "20 Oct 2026, 15:30 EEST". */
  const timeText = (due: Due) => clockWords(context, due.at as number, true);
  const dayAndTime = (due: Due) => momentWords(context, due.at as number, true);

  /** When it is due, in words: "Overdue", "Today", "Due 22 Oct 2026" — and with an hour, "Overdue since 11:00", "Today at 15:30", "Due 22 Oct 2026, 09:00". */
  function dueWords(due: Due, when: 'overdue' | 'today' | 'planned', today: string): string {
    if (due.time === null) return when === 'overdue' ? labels.overdue : when === 'today' ? labels.today : fill(labels.dueOn, { date: dayText(due.day) });
    if (when === 'overdue') return fill(labels.overdueSince, { when: due.day === today ? timeText(due) : dayAndTime(due) });
    if (when === 'today') return fill(labels.todayAt, { time: timeText(due) });
    return fill(labels.dueOn, { date: dayAndTime(due) });
  }

  // ---- the list ----------------------------------------------------------------

  function item(activity: Activity, due: Due, today: string, now: number): HTMLElement {
    const when = dueState(due, today, now);
    const icon = drawIcon(doc, activity.type.icon ?? 'clock', icons);
    const dueText = dueWords(due, when, today);
    const row = el(
      'li',
      { class: 'fd-activity', 'data-when': when },
      el('span', { class: 'fd-activity-icon' }, ...(icon ? [icon] : [])),
      el(
        'div',
        { class: 'fd-activity-content' },
        el('span', { class: 'fd-activity-summary' }, activity.summary || activity.type.name),
        el('span', { class: 'fd-activity-meta' }, el('span', { class: 'fd-activity-due' }, dueText), ' · ', activity.assignee.name)
      )
    );
    const actions = el('div', { class: 'fd-activity-actions' });
    if (source.markDone) {
      const done = el('button', { type: 'button', class: 'fd-button fd-button-link' }, labels.markDone);
      const feedback = el('textarea', { class: 'fd-input', rows: '2', placeholder: labels.whatHappened, 'aria-label': labels.whatHappened });
      const confirm = el('button', { type: 'button', class: 'fd-button fd-button-primary' }, labels.done);
      const finishing = el('div', { class: 'fd-activity-finish', hidden: '' }, feedback, confirm);
      done.addEventListener('click', () => {
        finishing.hidden = !finishing.hidden;
        if (!finishing.hidden) feedback.focus();
      });
      confirm.addEventListener('click', async () => {
        const record = context.record();
        if (!record || !source.markDone) return;
        await source.markDone(record, activity.id, feedback.value.trim() || undefined);
        await load();
        await afterChange();
      });
      actions.append(done);
      row.append(actions, finishing);
    }
    if (source.cancel) {
      const cancel = el('button', { type: 'button', class: 'fd-button fd-button-link' }, labels.cancelActivity);
      cancel.addEventListener('click', async () => {
        const record = context.record();
        if (!record || !source.cancel) return;
        await source.cancel(record, activity.id);
        await load();
      });
      actions.append(cancel);
      if (!row.contains(actions)) row.append(actions);
    }
    return row;
  }

  async function load() {
    const record = context.record();
    if (!record || !source.activities) {
      element.hidden = true;
      return;
    }
    const still = context.shown();
    const found = await source.activities(record);
    if (!still()) return;
    // Late first, the longest late at the top; then today's, a day alone before those at an hour; then those ahead.
    const now = context.now().getTime();
    const today = dayIn(now, zone);
    const read = found.map((activity) => ({ activity, due: readDue(activity.due, zone) }));
    const rank = ({ due }: (typeof read)[number]) => RANK[dueState(due, today, now)];
    read.sort((a, b) => rank(a) - rank(b) || a.due.day.localeCompare(b.due.day) || (a.due.at ?? -Infinity) - (b.due.at ?? -Infinity));
    list.replaceChildren(...read.map(({ activity, due }) => item(activity, due, today, now)));
    element.hidden = !found.length && form.hidden;
  }

  // ---- scheduling --------------------------------------------------------------

  const type = el('select', { class: 'fd-input', name: 'type', 'aria-label': labels.activityType });
  const summary = el('input', { class: 'fd-input', name: 'summary', 'aria-label': labels.summary, placeholder: labels.summary });
  const due = el('input', { class: 'fd-input', type: 'date', name: 'due', 'aria-label': labels.dueDate });
  // An hour on the page's clock, if the activity has one: left empty, it is due on its day.
  const time = el('input', { class: 'fd-input', type: 'time', name: 'time', 'aria-label': labels.dueTime });
  const assignee = el('select', { class: 'fd-input', name: 'assignee', 'aria-label': labels.assignedTo });
  const schedule = el('button', { type: 'button', class: 'fd-button fd-button-primary' }, labels.schedule);
  const cancelForm = el('button', { type: 'button', class: 'fd-button' }, labels.cancel);
  const label = (text: string, control: HTMLElement) => el('label', { class: 'fd-activity-field' }, el('span', {}, text), control);
  const form = el(
    'div',
    { class: 'fd-activity-form', hidden: '' },
    label(labels.activityType, type),
    label(labels.summary, summary),
    label(labels.dueDate, due),
    label(labels.dueTime, time),
    label(labels.assignedTo, assignee),
    el('div', { class: 'fd-composer-actions' }, schedule, cancelForm)
  );
  let types: ActivityType[] = [];
  let people: Person[] = [];
  /** The due date follows the type until someone chooses one. */
  let dueChosen = false;
  const dueFromType = () => {
    if (dueChosen) return;
    const chosen = types.find((t) => String(t.id) === type.value);
    due.value = daysAfter(dayIn(context.now(), zone), chosen?.daysUntilDue ?? 0);
  };
  type.addEventListener('change', dueFromType);
  due.addEventListener('input', () => (dueChosen = true));
  due.addEventListener('change', () => (dueChosen = true));

  const button = canSchedule ? el('button', { type: 'button', class: 'fd-button' }, labels.scheduleActivity) : null;
  button?.addEventListener('click', async () => {
    if (!source.activityTypes || !source.people) return;
    [types, people] = await Promise.all([source.activityTypes(), source.people('')]);
    type.replaceChildren(...types.map((t) => el('option', { value: String(t.id) }, t.name)));
    assignee.replaceChildren(...people.map((p) => el('option', { value: String(p.id) }, p.name)));
    summary.value = '';
    time.value = '';
    dueChosen = false;
    dueFromType();
    form.hidden = false;
    element.hidden = false;
    type.focus();
  });
  cancelForm.addEventListener('click', () => {
    form.hidden = true;
    void load();
  });
  schedule.addEventListener('click', async () => {
    const record = context.record();
    const chosenType = types.find((t) => String(t.id) === type.value);
    const person = people.find((p) => String(p.id) === assignee.value);
    if (!record || !source.schedule || !chosenType || !person || !due.value) return;
    await source.schedule(record, { typeId: chosenType.id, summary: summary.value.trim() || undefined, due: time.value ? dueInstant(due.value, time.value, zone) : due.value, assigneeId: person.id });
    form.hidden = true;
    await load();
  });
  element.prepend(form);

  return { button, element, load };
}
