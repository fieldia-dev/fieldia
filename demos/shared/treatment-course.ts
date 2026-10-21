import { dayIn, scheduleSlots, type MemoryDataSource, type Page, type RecordTemplate, type SlotsRequest, type SlotsResult, type Values } from '@fieldia/core';
import treatmentCourse from '../../examples/pages/treatment-course.page.json';
import clinicBranch from '../../examples/pages/clinic-branch.page.json';
import { demoNow } from './calendar';

/**
 * A clinic's treatment course (examples/pages/treatment-course.page.json): its sessions as a repeat rule said in words,
 * templates the clinic saved ("Botox package", "Laser course: 6 sessions"), Start course and Mark done that offer Undo
 * a few seconds, Ctrl+Z through what was typed — and, over it, someone else at the front desk opening the course and
 * changing its price, which arrives in it live. And a branch's opening hours (examples/pages/clinic-branch.page.json),
 * which the times a patient may book follow as they are changed.
 */
export const treatmentCoursePage = treatmentCourse as Page;
export const clinicBranchPage = clinicBranch as Page;

const DAY = 86400000;
/** Cairo's day `offset` days from the demos' clock: the courses follow it, so a visit any day finds them current. */
const cairoDay = (offset: number) => dayIn(demoNow().getTime() + offset * DAY, 'Africa/Cairo');

/** The courses kept, by id: one in progress, one planned. */
export function sampleCourses(): Record<string, Values> {
  return {
    1: { patient: 'Mona Adel', state: 'running', treatment: 'botox', doctor: 'Dr. Yasmin Farid', first_session: cairoDay(-14), sessions: 'FREQ=WEEKLY;INTERVAL=2;BYDAY=TU;COUNT=3', price: 9500, notes: 'Forehead and frown lines. Review two weeks after each session.' },
    2: { patient: 'Hana Fouad', state: 'planned', treatment: 'laser', doctor: 'Dr. Karim Nabil', first_session: cairoDay(3), sessions: 'FREQ=MONTHLY;BYDAY=1SA;COUNT=6', price: 14400, notes: 'Lower legs. Skin type III.' },
  };
}

/** The templates the clinic saved, as its server keeps them. */
export const COURSE_TEMPLATES: Record<string, RecordTemplate[]> = {
  'treatment-course': [
    { id: 'botox-package', name: 'Botox package', values: { treatment: 'botox', sessions: 'FREQ=WEEKLY;INTERVAL=2;COUNT=3', price: 9500, notes: 'Review two weeks after each session.' } },
    { id: 'laser-course', name: 'Laser course: 6 sessions', values: { treatment: 'laser', sessions: 'FREQ=MONTHLY;COUNT=6', price: 14400, notes: 'Shave the day before. No sun for two weeks.' } },
  ],
};

/** The branches kept: Zamalek's, open six days, with a lunch break, and closed on Fridays. */
export function sampleBranches(): Record<string, Values> {
  const day = [['10:00', '14:00'], ['15:00', '20:00']];
  return { 1: { name: 'Zamalek branch', phone: '+20 2 2735 1100', hours: { '6': day, '7': day, '1': day, '2': day, '3': day, '4': [['10:00', '16:00']] } } };
}

/** The times a patient may book at a branch: from its opening hours as the form holds them now, 30 minutes a visit. */
export function branchSlots(request: SlotsRequest, records: Readonly<Record<string, Record<string, Values>>>): SlotsResult | Promise<SlotsResult> {
  const hours = (request.values['hours'] ?? {}) as Record<number, [string, string][]>;
  return scheduleSlots({ branch: { timeZone: 'Africa/Cairo', hours, length: 30 } }, { now: demoNow })(request, records);
}

/**
 * A bar over the course: Mona at the front desk opens it, then changes its price. With nothing changed here, the new
 * price arrives in it and is said; after a change here, it waits as the conflict a save would meet.
 */
export function frontDeskBar(dataSource: MemoryDataSource): HTMLElement {
  const bar = document.createElement('div');
  bar.className = 'demo-bar demo-panel-bar demo-meanwhile-bar fd-theme';
  const said = document.createElement('span');
  said.className = 'demo-meanwhile-said';
  said.setAttribute('role', 'status');
  said.textContent = 'Someone else at the front desk, on another screen.';
  const id = new URLSearchParams(location.search).get('record') ?? '1';
  const button = (words: string, act: () => string) => {
    const one = document.createElement('button');
    one.type = 'button';
    one.className = 'fd-button';
    one.textContent = words;
    one.addEventListener('click', () => (said.textContent = act()));
    return one;
  };
  const opens = button('Mona opens this course', () => {
    dataSource.arrive?.('clinic.course', id, { id: 9, name: 'Mona Adel' });
    opens.hidden = true;
    edits.hidden = false;
    return 'Mona Adel has this course open too: her initials are over it.';
  });
  const edits = button('Mona changes the price', () => {
    const now = Number(dataSource.records['clinic.course']?.[id]?.['price'] ?? 0);
    dataSource.arrive?.('clinic.course', id, { id: 9, name: 'Mona Adel', editing: true });
    dataSource.changeElsewhere('clinic.course', id, { price: now + 500 }, { by: 'Mona Adel' });
    dataSource.arrive?.('clinic.course', id, { id: 9, name: 'Mona Adel' });
    return 'Mona Adel saved the course with 500 more on its price.';
  });
  edits.hidden = true;
  bar.append(opens, edits, said);
  return bar;
}
