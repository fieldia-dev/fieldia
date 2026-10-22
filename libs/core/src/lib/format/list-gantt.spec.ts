import { pageWords, translatePage, validatePage, type ListNode, type Page } from '../../index';

/**
 * A list's records on a Gantt timeline (`gantt` on a list node, drawn by
 * @fieldia/gantt): when each starts, and ends or how many days it lasts, its
 * words, its group, its colour, the records it waits for, the scales offered
 * and the week's first day. The page says it all by field names, so a
 * missing field or one of the wrong kind is refused here, before anything
 * draws.
 */

const fields = {
  name: { type: 'char', label: 'Task' },
  start: { type: 'date', label: 'Starts' },
  finish: { type: 'date', label: 'Ends' },
  begins: { type: 'datetime', label: 'Begins at' },
  days: { type: 'integer', label: 'Days' },
  weeks: { type: 'float', label: 'Weeks' },
  trade: { type: 'many2one', label: 'Trade', relation: 'fitout.trade' },
  phase: { type: 'selection', label: 'Phase', options: [{ value: 'strip', label: 'Strip-out' }] },
  after: { type: 'many2many', label: 'Waits for', relation: 'fitout.task' },
  tags: { type: 'many2many', label: 'Tags', relation: 'fitout.tag' },
  cost: { type: 'monetary', label: 'Cost', currency: 'EGP' },
  notes: { type: 'html', label: 'Notes' },
};

const page = (gantt: Record<string, unknown>, more: Record<string, unknown> = {}) => ({
  fieldia: '0.1',
  id: 'tasks',
  data: { kind: 'record', model: 'fitout.task' },
  fields,
  layout: { type: 'list', id: 'list', columns: ['name', 'start'], gantt, ...more },
});
const problems = (input: unknown) => {
  const r = validatePage(input);
  return r.ok ? [] : r.issues.map((i) => `${i.path}: ${i.message}`);
};

describe('a list on a Gantt timeline', () => {
  it('takes a start, an end or a duration, its words, a group, a colour, what each waits for, the scales and the first day', () => {
    expect(
      problems(page({ start: 'start', end: 'finish', title: 'name', group: 'trade', colour: 'phase', dependsOn: 'after', zooms: ['day', 'week', 'month'], zoom: 'week', opens: 'gantt', firstDay: 6 }))
    ).toEqual([]);
    // The least it needs: when each starts, and its words.
    expect(problems(page({ start: 'start', title: 'name' }))).toEqual([]);
    // How many days each lasts, rather than its end; a date and time to start from.
    expect(problems(page({ start: 'begins', duration: 'days', title: 'name', group: 'phase' }))).toEqual([]);
    expect(problems(page({ start: 'start', duration: 'weeks', title: 'name', zooms: ['month'] }))).toEqual([]);
  });

  it('refuses what is not a timeline: a scale it does not know, none, a day of the week past Saturday, opening on a map', () => {
    expect(problems(page({ start: 'start', title: 'name', zooms: ['year'] }))).not.toEqual([]);
    expect(problems(page({ start: 'start', title: 'name', zooms: [] }))).not.toEqual([]);
    expect(problems(page({ start: 'start', title: 'name', zoom: 'quarter' }))).not.toEqual([]);
    expect(problems(page({ start: 'start', title: 'name', firstDay: 7 }))).not.toEqual([]);
    expect(problems(page({ start: 'start', title: 'name', opens: 'map' }))).not.toEqual([]);
    expect(problems(page({ start: 'start', title: 'name', hours: { start: 8, end: 20 } }))).not.toEqual([]);
    // Its words are not left to chance.
    expect(problems(page({ start: 'start' }))).not.toEqual([]);
  });

  it('refuses a field the page lacks, and one of the wrong kind, saying which', () => {
    expect(problems(page({ start: 'when', title: 'who' }))).toEqual(['layout.gantt.start: no field "when"', 'layout.gantt.title: no field "who"']);
    expect(problems(page({ start: 'name', title: 'name' }))).toEqual(['layout.gantt.start: "name" is a char; a bar\'s start is a date, or a date and time']);
    expect(problems(page({ start: 'begins', end: 'finish', title: 'name' }))).toEqual(['layout.gantt.end: "finish" is a date; an end is the same kind of field as its start, a datetime']);
    expect(problems(page({ start: 'start', duration: 'cost', title: 'name' }))).toEqual(['layout.gantt.duration: "cost" is a monetary; how long a bar lasts is a number of days']);
    expect(problems(page({ start: 'start', title: 'name', group: 'cost' }))).toEqual(['layout.gantt.group: "cost" is a monetary; a group comes from a link, a choice, text or a whole number']);
    expect(problems(page({ start: 'start', title: 'name', colour: 'notes' }))).toEqual(['layout.gantt.colour: "notes" is a html; a colour comes from a link, a choice, text, a whole number or a yes or no']);
    expect(problems(page({ start: 'start', title: 'notes' }))).toEqual(['layout.gantt.title: "notes" is a html; a bar\'s words are a field that can be said']);
    expect(problems(page({ start: 'start', title: 'name', dependsOn: 'trade' }))).toEqual(['layout.gantt.dependsOn: "trade" is a many2one; what a bar waits for is a many2many of the list\'s own records']);
    expect(problems(page({ start: 'start', title: 'name', dependsOn: 'nothing' }))).toEqual(['layout.gantt.dependsOn: no field "nothing"']);
  });

  it('says what does not add up: an end and a duration both, records of another list waited for, a scale opened on that is not offered, the same scale twice', () => {
    expect(problems(page({ start: 'start', end: 'finish', duration: 'days', title: 'name' }))).toEqual(['layout.gantt.duration: a bar ends at its end or lasts its duration: say one']);
    expect(problems(page({ start: 'start', title: 'name', dependsOn: 'tags' }))).toEqual(['layout.gantt.dependsOn: "tags" links to fitout.tag; a bar waits for records of this list, fitout.task']);
    expect(problems(page({ start: 'start', title: 'name', zooms: ['week', 'month'], zoom: 'day' }))).toEqual(['layout.gantt.zoom: "day" is not one of its scales (week, month)']);
    expect(problems(page({ start: 'start', title: 'name', zooms: ['week', 'week'] }))).toEqual(['layout.gantt.zooms[1]: "week" is offered twice']);
  });

  it('names fields, never words: a translation leaves it as it is', () => {
    const named = page({ start: 'start', end: 'finish', title: 'name', group: 'trade', colour: 'phase', dependsOn: 'after' }) as unknown as Page;
    const after = translatePage(named, (words) => `«${words}»`);
    expect((after.layout as ListNode).gantt).toEqual((named.layout as ListNode).gantt);
    expect(validatePage(after).ok).toBe(true);
    expect(pageWords(named)).not.toContain('name');
  });

  it('opens one way: on its map, its calendar, its gallery or its timeline, not two', () => {
    expect(problems(page({ start: 'start', title: 'name', opens: 'gantt' }, { map: { latitude: 'days', longitude: 'days', view: 'map' } }))).toContain(
      'layout.gantt.opens: the list opens on its map (map.view) and on its timeline: say one'
    );
    expect(problems(page({ start: 'start', title: 'name', opens: 'gantt' }, { calendar: { start: 'start', title: 'name', opens: 'calendar' } }))).toEqual([
      'layout.gantt.opens: the list opens on its calendar and on its timeline: say one',
    ]);
    expect(problems(page({ start: 'start', title: 'name', opens: 'gantt' }, { gallery: { opens: 'gallery' } }))).toEqual(['layout.gallery.opens: the list opens on its timeline and on its gallery: say one']);
    // The table first, the calendar and the timeline a press away: fine.
    expect(problems(page({ start: 'start', title: 'name' }, { calendar: { start: 'start', title: 'name', opens: 'calendar' } }))).toEqual([]);
  });
});
