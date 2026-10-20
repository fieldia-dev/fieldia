import { dayIn, instantsAt, scheduleSlots, wallOf, type MemorySchedule, type SlotsRequest, type SlotsResult, type Values } from '@fieldia/core';
import { demoNow } from './calendar';

/**
 * The clinic behind the appointment-booking template (examples/templates/appointment-booking.page.json), as its server
 * answers `slots` for the template's "appointments" schedule: open Monday to Friday 09:00 to 13:00 and 14:00 to 17:00,
 * Saturday 09:00 to 12:00, each service its own length — a first consultation 30 minutes, a follow-up 20, a full
 * review an hour — on the reader's own clock, as the template names no zone; less the times gone by (on the demos'
 * clock, `?now=`) and those booked: a few round now, the same each visit, a day ahead fully booked, and each booking
 * sent from the template, kept as the clinic's server keeps it — so a day gone by is never offered, nor a time booked.
 */

/** The clinic's bookings, as its server keeps them: each one's start (`when`) and end, its service and who is coming. */
export const APPOINTMENTS = 'appointment.booking';
/** Each service's minutes, by its value in the template. */
const LENGTHS: Record<string, number> = { consultation: 30, follow_up: 20, review: 60 };
const WEEKDAY: [string, string][] = [['09:00', '13:00'], ['14:00', '17:00']];
const HOURS: MemorySchedule['hours'] = { 1: WEEKDAY, 2: WEEKDAY, 3: WEEKDAY, 4: WEEKDAY, 5: WEEKDAY, 6: [['09:00', '12:00']] };
const PATIENTS = ['Nour Hamed', 'Yara Fathy', 'Hany Lotfy', 'Dina Samir', 'Tarek Aziz', 'Laila Mostafa'];
const MINUTE = 60000;

/** The reader's own zone: the template names none, so its times are on the reader's clock. */
const ownZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
const lengthOf = (service: unknown) => LENGTHS[String(service ?? '')] ?? 30;
/** The clinic's schedule on a zone's clock, its bookings those kept here. */
const schedule = (zone: string): MemorySchedule => ({ timeZone: zone, hours: HOURS, bookings: { model: APPOINTMENTS, field: 'when', endField: 'ends' } });

/** The clinic's free times for the days asked, as long as the service picked lasts (30 minutes before one is). */
export function appointmentSlots(request: SlotsRequest, records: Readonly<Record<string, Record<string, Values>>>): SlotsResult | Promise<SlotsResult> {
  return scheduleSlots({ appointments: schedule(request.timeZone) }, { now: demoNow })({ ...request, length: lengthOf(request.values['service']) }, records);
}

/** A day some days on from another, as 2026-10-15. */
function dayAfter(day: string, days: number): string {
  const wall = wallOf(day) as { year: number; month: number; day: number };
  return new Date(Date.UTC(wall.year, wall.month - 1, wall.day + days)).toISOString().slice(0, 10);
}

/** Five weeks of the clinic's bookings round now, on the reader's clock: two most days, and the next Tuesday full. */
export function appointmentRecords(now = demoNow(), zone = ownZone()): Record<string, Record<number, Values>> {
  const today = dayIn(now, zone);
  const booked: Record<number, Values> = {};
  let id = 1;
  const book = (day: string, time: string, service: string) => {
    const wall = wallOf(day) as { year: number; month: number; day: number };
    const start = instantsAt({ ...wall, hour: Number(time.slice(0, 2)), minute: Number(time.slice(3, 5)) }, zone)[0];
    if (start === undefined) return;
    booked[id] = { name: PATIENTS[id % PATIENTS.length], service, when: new Date(start).toISOString(), ends: new Date(start + lengthOf(service) * MINUTE).toISOString() };
    id++;
  };
  for (let n = 0; n < 35; n++) {
    const day = dayAfter(today, n);
    const weekday = new Date(`${day}T12:00:00Z`).getUTCDay() || 7;
    if (!HOURS[weekday]) continue;
    // The next Tuesday: every hour taken.
    if (weekday === 2 && n > 0 && n <= 7) {
      for (const time of ['09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00']) book(day, time, 'review');
      continue;
    }
    // An afternoon consultation each day, and a full review at noon every other day: the mornings free to book.
    if (weekday !== 6) book(day, `${14 + (n % 3)}:00`, 'consultation');
    if (n % 2 === 0) book(day, weekday === 6 ? '11:00' : '12:00', 'review');
  }
  return { [APPOINTMENTS]: booked };
}

/** A booking sent from the template, kept with the clinic's bookings as its server keeps it: its time is no one else's now. */
export function keepAppointment(records: Record<string, Record<string, Values>>, values: Values): void {
  const at = Date.parse(String(values['when'] ?? ''));
  if (Number.isNaN(at)) return;
  const table = (records[APPOINTMENTS] ??= {});
  const id = Object.keys(table).reduce((top, key) => Math.max(top, Number(key) || 0), 0) + 1;
  table[String(id)] = { name: values['name'] ?? null, service: values['service'] ?? null, when: new Date(at).toISOString(), ends: new Date(at + lengthOf(values['service']) * MINUTE).toISOString() };
}
