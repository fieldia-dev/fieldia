import { fill } from '@fieldia/core';
import { drawIcon } from '@fieldia/widgets';
import type { ChatterContext } from './chatter';
import type { Activity, ActivityType, Person } from './source';

/** A day as `YYYY-MM-DD`, in the person's own time zone. */
export function isoDay(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Days after `day`, as `YYYY-MM-DD`. */
function daysAfter(day: Date, days: number): string {
  const next = new Date(day);
  next.setDate(next.getDate() + days);
  return isoDay(next);
}

/** Whether an activity is late, due today, or ahead. */
export function dueState(due: string, today: string): 'overdue' | 'today' | 'planned' {
  return due < today ? 'overdue' : due === today ? 'today' : 'planned';
}

/**
 * The record's activities: what is to be done, by whom and by when, overdue
 * first. Each can be marked done, with what came of it, or cancelled; a form
 * schedules a new one. Every part the source cannot do is left out.
 */
export function activitiesPart(context: ChatterContext, afterChange: () => Promise<void>) {
  const { el, labels, source, doc, icons, locale } = context;
  if (!source.activities) return { button: null, element: null, load: async () => undefined };
  const list = el('ul', { class: 'fd-activity-list' });
  const element = el('section', { class: 'fd-activities', 'aria-label': labels.activities }, list);
  const dayFormat = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG-u-nu-latn' : locale, { dateStyle: 'medium' });
  const canSchedule = !!(source.schedule && source.activityTypes && source.people);

  // ---- the list ----------------------------------------------------------------

  function item(activity: Activity, today: string): HTMLElement {
    const when = dueState(activity.due, today);
    const icon = drawIcon(doc, activity.type.icon ?? 'clock', icons);
    const dueText = when === 'overdue' ? labels.overdue : when === 'today' ? labels.today : fill(labels.dueOn, { date: dayFormat.format(new Date(`${activity.due}T12:00:00`)) });
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
    const activities = [...(await source.activities(record))].sort((a, b) => a.due.localeCompare(b.due));
    if (context.record() !== record) return;
    const today = isoDay(context.now());
    list.replaceChildren(...activities.map((activity) => item(activity, today)));
    element.hidden = !activities.length && form.hidden;
  }

  // ---- scheduling --------------------------------------------------------------

  const type = el('select', { class: 'fd-input', name: 'type', 'aria-label': labels.activityType });
  const summary = el('input', { class: 'fd-input', name: 'summary', 'aria-label': labels.summary, placeholder: labels.summary });
  const due = el('input', { class: 'fd-input', type: 'date', name: 'due', 'aria-label': labels.dueDate });
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
    due.value = daysAfter(context.now(), chosen?.daysUntilDue ?? 0);
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
    await source.schedule(record, { typeId: chosenType.id, summary: summary.value.trim() || undefined, due: due.value, assigneeId: person.id });
    form.hidden = true;
    await load();
  });
  element.prepend(form);

  return { button, element, load };
}
