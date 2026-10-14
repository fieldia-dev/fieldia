import { calendarListViews } from '@fieldia/calendar';
import type { Page, Values } from '@fieldia/core';
import clinicCalendar from '../../examples/pages/clinic-calendar.page.json';
import clinicAppointment from '../../examples/pages/clinic-appointment.page.json';
import bookingWeek from '../../examples/pages/booking-week.page.json';
import booking from '../../examples/pages/booking.page.json';

/**
 * The calendar demos: a clinic's appointments by doctor, and the booking
 * desk's week. Their records are made round "now", so the calendar opens on
 * a busy day: the reader's own, or `?now=2026-10-14T09:40` as the browser
 * tests pin it.
 */

/** Now, as the demos read it: `?now=` (in the reader's own time) or the clock. */
export function demoNow(): Date {
  const given = new URLSearchParams(typeof location === 'undefined' ? '' : location.search).get('now');
  const pinned = given ? new Date(given) : null;
  return pinned && !Number.isNaN(pinned.getTime()) ? pinned : new Date();
}

/** A list's calendar, for the viewer's `listViews`: on the demos' clock. */
export const demoCalendarViews = calendarListViews({ now: demoNow });

/** The week's Saturday, as Egypt's week starts, at midnight. */
function saturdayOf(day: Date): Date {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate() - ((day.getDay() + 1) % 7));
}
const at = (from: Date, day: number, minutes: number) => new Date(from.getFullYear(), from.getMonth(), from.getDate() + day, 0, minutes).toISOString();
/** The same numbers every time: a demo that looks the same on each visit. */
function seeded(seed: number) {
  let n = seed;
  return () => {
    n = (n * 1103515245 + 12345) % 2147483648;
    return n / 2147483648;
  };
}

const DOCTORS = ['Dr Karim Fawzy', 'Dr Salma Nabil', 'Dr Hany Mostafa', 'Dr Nour Adel'];
const PATIENTS = ['Mona Adel', 'Omar Said', 'Laila Hany', 'Youssef Kamal', 'Nadia Farouk', 'Ahmed Tarek', 'Salma Ibrahim', 'Karim Mansour', 'Hoda Sami', 'Tamer Wael', 'Rania Fathy', 'Mostafa Gamal', 'Dina Magdy', 'Sherif Lotfy', 'Aya Hassan', 'Khaled Nabil'];
const SERVICES: [string, number][] = [['checkup', 30], ['followup', 15], ['scan', 45], ['procedure', 60]];

/** A fortnight of a clinic's visits round now, Saturday to Thursday, 9:00 to 18:00, a few for each doctor each day. */
export function clinicAppointments(now = demoNow()): Record<number, Values> {
  const random = seeded(7);
  const from = saturdayOf(now);
  const records: Record<number, Values> = {};
  let id = 1;
  for (let day = -7; day < 14; day++) {
    // The clinic is closed on Fridays.
    if ((day % 7 + 7) % 7 === 6) continue;
    DOCTORS.forEach((_, d) => {
      let minutes = 9 * 60 + Math.floor(random() * 4) * 15;
      const visits = 3 + Math.floor(random() * 4);
      for (let v = 0; v < visits && minutes < 17 * 60; v++) {
        const [service, length] = SERVICES[Math.floor(random() * SERVICES.length)];
        const past = day < 0 || (day === Math.round((now.getTime() - from.getTime()) / 86400000) && minutes < now.getHours() * 60);
        records[id] = {
          patient: PATIENTS[Math.floor(random() * PATIENTS.length)],
          phone: `+20 10 ${String(1000 + Math.floor(random() * 9000))} ${String(1000 + Math.floor(random() * 9000))}`,
          doctor: { id: d + 1, label: DOCTORS[d] },
          service,
          start: at(from, day, minutes),
          stop: at(from, day, minutes + length),
          state: past ? (random() < 0.15 ? 'no_show' : 'done') : 'booked',
        };
        id++;
        minutes += length + Math.floor(random() * 4) * 15;
      }
    });
  }
  // Two visits that meet, side by side, today: a scan running into the next patient's check-up.
  const today = Math.round((new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - from.getTime()) / 86400000);
  records[id++] = { patient: 'Walk-in: Samir Fouad', phone: null, doctor: { id: 1, label: DOCTORS[0] }, service: 'scan', start: at(from, today, 11 * 60 + 15), stop: at(from, today, 12 * 60), state: 'booked' };
  records[id++] = { patient: 'Yasmine Raafat', phone: '+20 12 5550 1234', doctor: null, service: 'checkup', start: at(from, today, 13 * 60), stop: at(from, today, 13 * 60 + 30), state: 'booked' };
  return records;
}

const AGENTS = ['Laila Hassan', 'Omar Fathy', 'Mona Adel'];
const CUSTOMERS = ['Hesham Ezzat', 'Ingy Samir', 'The Nabil family', 'Rami Khalil', 'Sara Lotfy', 'Adel & Dalia Fawzy', 'Peter Girgis', 'Noha El-Sayed', 'Wael Shaker', 'Marwa Hamdy', 'Tarek Amin', 'Lobna Said'];
const BOOKINGS: [string, number][] = [['viewing', 60], ['consult', 30], ['signing', 90], ['call', 30]];

/** The booking desk's bookings, a week before and two after now, Saturday to Thursday, 10:00 to 20:00. */
export function deskBookings(now = demoNow()): Record<number, Values> {
  const random = seeded(11);
  const from = saturdayOf(now);
  const records: Record<number, Values> = {};
  let id = 1;
  for (let day = -7; day < 14; day++) {
    if ((day % 7 + 7) % 7 === 6) continue;
    const count = 3 + Math.floor(random() * 4);
    for (let b = 0; b < count; b++) {
      const [service, length] = BOOKINGS[Math.floor(random() * BOOKINGS.length)];
      const minutes = 10 * 60 + Math.floor(random() * 18) * 30;
      const agent = Math.floor(random() * AGENTS.length);
      records[id++] = {
        customer: CUSTOMERS[Math.floor(random() * CUSTOMERS.length)],
        phone: `+20 11 ${String(1000 + Math.floor(random() * 9000))} ${String(1000 + Math.floor(random() * 9000))}`,
        service,
        host: { id: agent + 1, label: AGENTS[agent] },
        start: at(from, day, minutes),
        stop: at(from, day, minutes + length),
        state: day < 0 ? 'done' : random() < 0.2 ? 'hold' : 'confirmed',
      };
    }
  }
  return records;
}

/** What the demos' data source, pages and opened records need of the calendar demos. */
export const calendarDemo = {
  pages: {
    'clinic-calendar': clinicCalendar as Page,
    'clinic-appointment': clinicAppointment as Page,
    'booking-week': bookingWeek as Page,
    booking: booking as Page,
  } as Record<string, Page>,
  /** Each calendar's record page: what a record opens in. */
  recordPages: { 'clinic-calendar': 'clinic-appointment', 'booking-week': 'booking' } as Record<string, string>,
  /** The pages a new record opens in, in a dialog: by its model. */
  related: { 'clinic.visit': clinicAppointment as Page, 'desk.booking': booking as Page } as Record<string, Page>,
  records: () => ({
    'clinic.visit': clinicAppointments(),
    'clinic.doctor': Object.fromEntries(DOCTORS.map((name, i) => [i + 1, { name }])),
    'desk.booking': deskBookings(),
    'desk.staff': Object.fromEntries(AGENTS.map((name, i) => [i + 1, { name }])),
  }),
};
