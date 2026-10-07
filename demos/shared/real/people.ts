import type { ActionRequest, ActionResult, Page, RelatedRecord, Values } from '@fieldia/core';
import clinicAppointment from '../../../examples/pages/real-clinic-appointment.page.json';
import timeOff from '../../../examples/pages/real-time-off.page.json';
import timeOffCancel from '../../../examples/pages/real-time-off-cancel.page.json';
import employeePage from '../../../examples/pages/real-employee.page.json';
import employeePlan from '../../../examples/pages/real-employee-plan.page.json';
import maintenanceRequest from '../../../examples/pages/real-maintenance-request.page.json';
import type { RealLane } from './lane';

/**
 * The people lane: Sherkety ERP's clinic, HR and maintenance screens, rebuilt
 * from their Flectra views, all about one Cairo aesthetic clinic — Glow
 * Aesthetic Clinic, Zamalek — its patients, its staff, their time off and its
 * equipment. Ids start at 4000 so they never meet another lane's records of a
 * shared model (res.partner, res.users, res.company).
 */

// ---------------------------------------------------------------------------
// Time, as the server keeps it: local days and minutes, from today.
// ---------------------------------------------------------------------------

const pad = (n: number) => String(n).padStart(2, '0');
const dayOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const minuteOf = (d: Date) => `${dayOf(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
/** A day counted from today, as `YYYY-MM-DD`. */
function day(offset = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return dayOf(d);
}
/** A moment on a day counted from today, as `YYYY-MM-DDTHH:MM`. */
const at = (offset: number, time: string) => `${day(offset)}T${time}`;
/** Now, to the minute. */
const now = () => minuteOf(new Date());
/** A date and time some minutes later. */
function addMinutes(when: string, minutes: number): string {
  const d = new Date(when);
  d.setMinutes(d.getMinutes() + Math.round(minutes));
  return minuteOf(d);
}
const minutesBetween = (from: string, to: string) => Math.max(0, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60000));

const link = (id: number, label: string): RelatedRecord => ({ id, label });
const idOf = (value: unknown) => (value && typeof value === 'object' && 'id' in value ? Number((value as RelatedRecord).id) : null);
/** An answer comes after a moment, as a server's does. */
const later = <T>(answer: () => T, ms = 250) => new Promise<T>((resolve) => setTimeout(() => resolve(answer()), ms));

// ---------------------------------------------------------------------------
// Glow Aesthetic Clinic: clinic.appointment (clinic_aesthetic + clinic_finance + clinic_kpi)
// ---------------------------------------------------------------------------

const BRANCH = link(4201, 'Glow Aesthetic Clinic, Zamalek');
const DR_RANIA = link(4101, 'Dr. Rania Fouad');
const DR_KARIM = link(4102, 'Dr. Karim Hegazy');

/** The patients: whether each is new, and their no-show history, which the risk score reads. */
const PATIENTS: Record<number, { name: string; phone: string; isNew: boolean; past: number; noShows: number }> = {
  4001: { name: 'Nour El-Sherif', phone: '+20 100 234 5678', isNew: true, past: 0, noShows: 0 },
  4002: { name: 'Yasmin Abdelrahman', phone: '+20 122 876 1203', isNew: false, past: 9, noShows: 1 },
  4003: { name: 'Hana Mostafa', phone: '+20 111 450 9921', isNew: false, past: 4, noShows: 2 },
  4004: { name: 'Dina Farag', phone: '+20 155 301 7740', isNew: false, past: 12, noShows: 0 },
  4005: { name: 'Mariam Selim', phone: '+20 101 667 2310', isNew: true, past: 0, noShows: 0 },
};

/** The treatments, with how long each is booked for (product default_duration). */
const SERVICES: Record<number, { name: string; minutes: number; treatment: boolean }> = {
  4301: { name: 'Botox, full face', minutes: 30, treatment: true },
  4302: { name: 'Lip filler (1 ml)', minutes: 45, treatment: true },
  4303: { name: 'HydraFacial Signature', minutes: 60, treatment: true },
  4304: { name: 'Laser hair removal, full legs', minutes: 60, treatment: true },
  4305: { name: 'Chemical peel', minutes: 30, treatment: true },
  4306: { name: 'Numbing cream 30 g (retail)', minutes: 0, treatment: false },
};

/** The patient-flow stages (clinic.queue.stage), in order. */
const STAGES: Record<number, { name: string; waiting?: boolean; numbing?: boolean; checkout?: boolean }> = {
  4501: { name: 'Checked In', waiting: true },
  4502: { name: 'Consultation' },
  4503: { name: 'Photos & Consent' },
  4504: { name: 'Numbing', numbing: true },
  4505: { name: 'With Provider' },
  4506: { name: 'Recovery' },
  4507: { name: 'Checkout', checkout: true },
};
const stage = (id: number) => link(id, STAGES[id].name);
/** How long numbing cream sits before the provider begins (res.company clinic_numbing_minutes). */
const NUMBING_MINUTES = 30;

/** clinic_kpi's deterministic no-show risk: its own weights and bands. */
function noShowRisk(values: Values): { no_show_risk_score: number; no_show_risk_band: string } {
  const patient = PATIENTS[idOf(values['patient_id']) ?? 0];
  if (!patient) return { no_show_risk_score: 0, no_show_risk_band: 'low' };
  const rate = patient.past ? patient.noShows / patient.past : 0;
  const start = typeof values['start'] === 'string' ? new Date(values['start']) : null;
  const leadDays = start ? Math.max(0, (start.getTime() - Date.now()) / 86400000) + 6 : 0;
  let score = Math.min(rate, 1) * 40 + (Math.min(leadDays, 30) / 30) * 25;
  if (!(Number(values['deposit_amount']) > 0)) score += 15;
  if (patient.isNew) score += 12;
  score += Math.min(patient.noShows, 4) * 2;
  const rounded = Math.round(Math.min(Math.max(score, 0), 100));
  return { no_show_risk_score: rounded, no_show_risk_band: rounded >= 60 ? 'high' : rounded >= 30 ? 'medium' : 'low' };
}

/** What the server works out on an appointment, whatever changed: the end, the room, the stage's state, the risk. */
function recalculateAppointment(values: Values): Values {
  const start = values['start'] as string | null;
  const duration = Number(values['duration']) || 0;
  const rooms = ((values['resource_ids'] as RelatedRecord[] | null) ?? []).map((r) => r.label).join(', ');
  const stageId = idOf(values['stage_id']);
  const flow = stageId ? STAGES[stageId] : undefined;
  const state = values['state'] as string;
  const out: Values = {
    stop: start ? addMinutes(start, duration) : null,
    queue_room: rooms || null,
    stage_is_numbing: Boolean(flow?.numbing),
    ...noShowRisk(values),
  };
  // A stage change keeps the clinical status in step (clinic.appointment.write): waiting = arrived, past reception = in progress.
  if (flow && !['done', 'no_show', 'cancelled'].includes(state)) out['state'] = flow.waiting ? 'arrived' : 'in_progress';
  return out;
}

const appointmentRules: Record<string, (values: Values) => Values> = {
  // _compute_duration: the service's default duration, then the end.
  service_id: (values) => {
    const service = SERVICES[idOf(values['service_id']) ?? 0];
    const duration = service ? service.minutes || 30 : 30;
    return { ...recalculateAppointment({ ...values, duration }), duration };
  },
  start: recalculateAppointment,
  duration: recalculateAppointment,
  resource_ids: recalculateAppointment,
  patient_id: recalculateAppointment,
  deposit_amount: recalculateAppointment,
  stage_id: (values) => {
    const flow = STAGES[idOf(values['stage_id']) ?? 0];
    return { ...recalculateAppointment(values), ...(flow?.numbing ? { numbing_ready_time: addMinutes(now(), NUMBING_MINUTES) } : {}) };
  },
};

const appointments: Record<string, Values> = {
  4001: {
    name: 'APT-00412',
    state: 'booked',
    patient_id: link(4001, 'Nour El-Sherif'),
    company_id: BRANCH,
    provider_id: DR_RANIA,
    service_id: link(4302, 'Lip filler (1 ml)'),
    resource_ids: [link(4401, 'Room 1')],
    start: at(0, '11:30'),
    duration: 45,
    stop: at(0, '12:15'),
    deposit_amount: 0,
    deposit_payment_id: null,
    deposit_forfeited: false,
    no_show_fee_invoice_id: null,
    no_show_risk_score: 0,
    no_show_risk_band: 'low',
    no_show_mitigation: null,
    is_walk_in: false,
    stage_id: null,
    stage_is_numbing: false,
    arrival_time: null,
    seen_time: null,
    wait_minutes: 0,
    queue_room: 'Room 1',
    numbing_ready_time: null,
    cancel_reason_id: null,
    session_id: null,
  },
  4002: {
    name: 'APT-00409',
    state: 'in_progress',
    patient_id: link(4002, 'Yasmin Abdelrahman'),
    company_id: BRANCH,
    provider_id: DR_KARIM,
    service_id: link(4304, 'Laser hair removal, full legs'),
    resource_ids: [link(4402, 'Room 2'), link(4404, 'Laser Device')],
    start: at(0, '10:00'),
    duration: 60,
    stop: at(0, '11:00'),
    deposit_amount: 500,
    deposit_payment_id: link(4801, 'PBNK1/2026/00038'),
    deposit_forfeited: false,
    no_show_fee_invoice_id: null,
    no_show_risk_score: 0,
    no_show_risk_band: 'low',
    is_walk_in: false,
    stage_id: stage(4504),
    stage_is_numbing: true,
    arrival_time: at(0, '09:52'),
    seen_time: at(0, '10:07'),
    wait_minutes: 15,
    queue_room: 'Room 2, Laser Device',
    numbing_ready_time: at(0, '10:37'),
    cancel_reason_id: null,
    session_id: link(4701, 'S-00417'),
  },
  4003: {
    name: 'APT-00398',
    state: 'cancelled',
    patient_id: link(4003, 'Hana Mostafa'),
    company_id: BRANCH,
    provider_id: DR_RANIA,
    service_id: link(4301, 'Botox, full face'),
    resource_ids: [link(4401, 'Room 1')],
    start: at(-1, '16:00'),
    duration: 30,
    stop: at(-1, '16:30'),
    deposit_amount: 0,
    deposit_payment_id: null,
    deposit_forfeited: false,
    no_show_fee_invoice_id: link(4851, 'INV/2026/01187'),
    is_walk_in: false,
    stage_id: null,
    stage_is_numbing: false,
    wait_minutes: 0,
    queue_room: 'Room 1',
    cancel_reason_id: link(4602, 'Travel'),
    session_id: null,
  },
};
// Each stored appointment starts with its risk as the server stored it.
for (const values of Object.values(appointments)) Object.assign(values, noShowRisk(values));

/** The resources each auto-assign category gives a booking with none (rooms; devices by the service). */
function autoAssign(values: Values): RelatedRecord[] {
  const chosen = [link(4401, 'Room 1')];
  const service = idOf(values['service_id']);
  if (service === 4303) chosen.push(link(4403, 'HydraBay'));
  if (service === 4304) chosen.push(link(4404, 'Laser Device'));
  return chosen;
}

let sessionNumber = 418;
let paymentNumber = 42;

/** The clinic's answers: clinic.appointment's methods behind its header buttons. */
function clinicAction(request: ActionRequest): ActionResult | Promise<ActionResult> | undefined {
  const values = request.values;
  switch (request.action) {
    case 'clinic_auto_assign_resources': {
      // action_confirm: _auto_assign_resources, one free resource per auto-assign category, when it has none.
      const current = (values['resource_ids'] as RelatedRecord[] | null) ?? [];
      return current.length ? {} : { values: { resource_ids: autoAssign(values) } };
    }
    case 'clinic_check_in':
      // action_check_in: arrived now, in the default flow stage.
      return { values: { state: 'arrived', arrival_time: now(), stage_id: stage(4501), stage_is_numbing: false }, say: { message: `${(values['patient_id'] as RelatedRecord | null)?.label ?? 'The patient'} is in the waiting room.`, tone: 'success' } };
    case 'clinic_take_to_room': {
      // action_start: into the first in-room stage; seen now stops the wait clock.
      const seen = (values['seen_time'] as string | null) ?? now();
      const arrival = values['arrival_time'] as string | null;
      return { values: { state: 'in_progress', seen_time: seen, stage_id: stage(4502), wait_minutes: arrival ? minutesBetween(arrival, seen) : 0 } };
    }
    case 'clinic_open_session':
      // action_create_session: a treatment session made once, the patient now in the room. Flectra then opens its charting form.
      return later(() => {
        const existing = values['session_id'] as RelatedRecord | null;
        const session = existing ?? link(4700 + sessionNumber, `S-${String(sessionNumber++).padStart(5, '0')}`);
        const state = values['state'] as string;
        const seen = (values['seen_time'] as string | null) ?? now();
        const arrival = values['arrival_time'] as string | null;
        return {
          values: {
            session_id: session,
            ...(['booked', 'confirmed', 'arrived'].includes(state) ? { state: 'in_progress', seen_time: seen, wait_minutes: arrival ? minutesBetween(arrival, seen) : 0 } : {}),
          },
          say: { message: `Treatment session ${session.label} is open, with its consent forms.`, tone: 'success' },
        };
      });
    case 'clinic_no_show_charge':
      // clinic_finance _apply_no_show_charge: forfeit a paid deposit, else raise the no-show fee invoice.
      if (values['deposit_payment_id']) return { values: { deposit_forfeited: true }, say: { message: 'The deposit is forfeited and kept as clinic income.', tone: 'warning' } };
      return { values: { no_show_fee_invoice_id: link(4852, 'INV/2026/01203') }, say: { message: 'A no-show fee invoice of 350.00 EGP was raised.', tone: 'warning' } };
    case 'clinic_cancel': {
      // action_cancel: refused without a reason; a late cancellation is charged as a no-show.
      if (!values['cancel_reason_id']) return { stop: 'Set a cancellation reason before cancelling.' };
      const start = values['start'] as string | null;
      const late = start ? new Date(start).getTime() - Date.now() < 24 * 3600000 : false;
      const charge: Values = late ? (values['deposit_payment_id'] ? { deposit_forfeited: true } : { no_show_fee_invoice_id: link(4852, 'INV/2026/01203') }) : {};
      return { values: { state: 'cancelled', ...charge }, ...(late ? { say: { message: 'Cancelled inside the 24-hour window: the cancellation is charged.', tone: 'warning' as const } } : {}) };
    }
    case 'clinic_register_deposit':
      // clinic_finance action_register_deposit: a posted customer payment in the deposit journal.
      if (!(Number(values['deposit_amount']) > 0)) return { stop: 'Set a positive deposit amount before registering it.' };
      return later(() => ({
        values: { deposit_payment_id: link(4800 + paymentNumber, `PBNK1/2026/${String(paymentNumber++).padStart(5, '0')}`) },
        say: { message: `Deposit of ${Number(values['deposit_amount']).toLocaleString('en', { minimumFractionDigits: 2 })} EGP registered.`, tone: 'success' },
      }));
    case 'clinic_ai_mitigation':
      // clinic_kpi action_ai_mitigation: one line, in Egyptian Arabic, from the clinic AI service.
      return later(
        () => ({ values: { no_show_mitigation: 'ابعتي لينك دفع عربون ٣٠٠ جنيه دلوقتي، وتذكير واتساب قبل الميعاد بساعتين.' } }),
        600
      );
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// The clinic's staff: hr.employee, and their time off (hr.leave)
// ---------------------------------------------------------------------------

const DEPARTMENTS: Record<number, string> = { 4141: 'Medical', 4142: 'Nursing', 4143: 'Front Desk', 4144: 'Operations', 4145: 'Facilities' };
const dept = (id: number) => link(id, DEPARTMENTS[id]);
/** Each department's manager, which a new employee's manager follows (_compute_parent_id). */
const DEPARTMENT_MANAGER: Record<number, number> = { 4141: 4123, 4142: 4122, 4143: 4125, 4144: 4126, 4145: 4125 };

const JOBS: Record<number, string> = {
  4151: 'Medical Director',
  4152: 'Dermatologist',
  4153: 'Senior Aesthetic Nurse',
  4154: 'Aesthetic Nurse',
  4155: 'Front Desk Coordinator',
  4156: 'Operations Manager',
  4157: 'Managing Director',
  4158: 'Biomedical Technician',
};

/** The staff, as a list shows them: who they are, where they work, who they answer to. */
const STAFF: Record<number, { name: string; job: number; dept: number; parent?: number; user?: number; email: string }> = {
  4121: { name: 'Omar Said', job: 4155, dept: 4143, parent: 4125, user: 4104, email: 'omar.said@glowclinic.example' },
  4122: { name: 'Salma Adel', job: 4153, dept: 4142, parent: 4123, user: 4103, email: 'salma.adel@glowclinic.example' },
  4123: { name: 'Dr. Rania Fouad', job: 4151, dept: 4141, parent: 4126, user: 4101, email: 'rania.fouad@glowclinic.example' },
  4124: { name: 'Dr. Karim Hegazy', job: 4152, dept: 4141, parent: 4123, user: 4102, email: 'karim.hegazy@glowclinic.example' },
  4125: { name: 'Mona Khalil', job: 4156, dept: 4144, parent: 4126, user: 4107, email: 'mona.khalil@glowclinic.example' },
  4126: { name: 'Laila Hamdy', job: 4157, dept: 4144, user: 4108, email: 'laila.hamdy@glowclinic.example' },
  4127: { name: 'Ahmed Tawfik', job: 4158, dept: 4145, parent: 4125, user: 4105, email: 'ahmed.tawfik@glowclinic.example' },
  4128: { name: 'Reem Gamal', job: 4154, dept: 4142, parent: 4122, email: 'reem.gamal@glowclinic.example' },
  4129: { name: 'Aya Mahmoud', job: 4154, dept: 4142, parent: 4122, email: 'aya.mahmoud@glowclinic.example' },
};
const employee = (id: number) => link(id, STAFF[id].name);
/** The person using the demo: the Operations Manager, who approves time off. */
const ME = 4125;

/** The time off types (hr.leave.type) and this year's allocations, as the server reads them. */
const LEAVE_TYPES: Record<
  number,
  { name: string; unit: 'day' | 'half_day' | 'hour'; validation: string; allocation: 'yes' | 'no'; valid: boolean; remaining: number; total: number; document?: boolean; negative?: boolean; overtime?: boolean }
> = {
  4161: { name: 'Paid Time Off', unit: 'day', validation: 'both', allocation: 'yes', valid: true, remaining: 12.5, total: 21 },
  4162: { name: 'Sick Time Off', unit: 'day', validation: 'hr', allocation: 'no', valid: true, remaining: 0, total: 0, document: true },
  4163: { name: 'Compensatory Days', unit: 'hour', validation: 'manager', allocation: 'yes', valid: true, remaining: 14, total: 16, overtime: true },
  4164: { name: 'Casual Leave', unit: 'half_day', validation: 'manager', allocation: 'yes', valid: true, remaining: 4, total: 6 },
  4165: { name: 'Unpaid', unit: 'hour', validation: 'both', allocation: 'no', valid: true, remaining: 0, total: 0 },
  // Allocated to nobody this year: the type's domain keeps it off the list.
  4166: { name: 'Hajj Leave', unit: 'day', validation: 'both', allocation: 'yes', valid: false, remaining: 0, total: 0 },
};
const leaveType = (id: number) => link(id, leaveTypeLabel(id));
function leaveTypeLabel(id: number): string {
  const type = LEAVE_TYPES[id];
  if (type.allocation === 'no') return type.name;
  const unit = type.unit === 'hour' ? 'hours' : 'days';
  return `${type.name} (${type.remaining} remaining out of ${type.total} ${unit})`;
}

/** Egypt's working week, Sunday to Thursday (the resource calendar "Standard 40 hours/week, Sun–Thu"). */
const WORKDAY = (d: Date) => d.getDay() <= 4;
function workingDays(from: string, to: string): number {
  let count = 0;
  for (const d = new Date(`${from}T12:00`); d <= new Date(`${to}T12:00`); d.setDate(d.getDate() + 1)) if (WORKDAY(d)) count++;
  return count;
}
/** A day counted from today that falls on a weekday (0 Sunday … 6 Saturday), at least `ahead` days on. */
function nextWeekday(weekday: number, ahead: number): number {
  const d = new Date();
  let offset = ahead;
  d.setDate(d.getDate() + ahead);
  while (d.getDay() !== weekday) {
    d.setDate(d.getDate() + 1);
    offset++;
  }
  return offset;
}
const usDate = (iso: string) => {
  const [y, m, d] = iso.split('-');
  return `${m}/${d}/${y}`;
};
const hoursText = (hours: number, bare: boolean) => `${bare ? '' : '('}${Number(hours.toFixed(2))} Hours${bare ? '' : ')'}`;

/** This year's time off already taken, for the stats beside a request (hr_leave_stats). */
const TAKEN: { employee: number; type: number; days: number; from: string; to: string }[] = [
  { employee: 4122, type: 4161, days: 5, from: '2026-04-19', to: '2026-04-23' },
  { employee: 4122, type: 4162, days: 1, from: '2026-02-10', to: '2026-02-10' },
  { employee: 4122, type: 4164, days: 1.5, from: '2026-07-14', to: '2026-07-15' },
  { employee: 4128, type: 4161, days: 4, from: '2026-10-18', to: '2026-10-21' },
  { employee: 4129, type: 4164, days: 1, from: '2026-10-13', to: '2026-10-13' },
  { employee: 4121, type: 4163, days: 1, from: '2026-08-03', to: '2026-08-03' },
  { employee: 4127, type: 4162, days: 2, from: '2026-09-27', to: '2026-09-28' },
];

function leaveStats(values: Values): string | null {
  const who = idOf(values['employee_id']) ?? idOf(((values['employee_ids'] as RelatedRecord[] | null) ?? [])[0]);
  if (!who) return null;
  const year = new Date().getFullYear();
  const mine = new Map<number, number>();
  for (const t of TAKEN.filter((t) => t.employee === who)) mine.set(t.type, (mine.get(t.type) ?? 0) + t.days);
  const department = STAFF[who].dept;
  const theirs = TAKEN.filter((t) => STAFF[t.employee].dept === department);
  // Lines, not a table: an html field keeps text structure only.
  const lines = (cells: string[]) => `<ul>${cells.map((cell) => `<li>${cell}</li>`).join('')}</ul>`;
  return (
    `<h4>${STAFF[who].name} in ${year}</h4>` +
    (mine.size ? lines([...mine].map(([type, days]) => `${LEAVE_TYPES[type].name}: ${days} day(s)`)) : '<p>None</p>') +
    `<h4>${DEPARTMENTS[department]}</h4>` +
    (theirs.length
      ? lines(theirs.map((t) => (t.employee === who ? `<b>${STAFF[t.employee].name}: ${t.days} day(s)</b>, ${usDate(t.from)} - ${usDate(t.to)}` : `${STAFF[t.employee].name}: ${t.days} day(s), ${usDate(t.from)} - ${usDate(t.to)}`)))
      : '<p>None</p>')
  );
}

/** What the server works out on a time off request, whatever changed: its dates, duration, name and the stats beside it. */
function recalculateLeave(values: Values): Values {
  const typeId = idOf(values['holiday_status_id']);
  const type = typeId ? LEAVE_TYPES[typeId] : undefined;
  const half = Boolean(values['request_unit_half']);
  const custom = Boolean(values['request_unit_hours']);
  const from = values['request_date_from'] as string | null;
  // Half a day or some hours fall on one day: the end follows the start (_compute_date_from_to).
  const to = half || custom ? from : (values['request_date_to'] as string | null);
  let days = 0;
  let hours = 0;
  let start: string | null = null;
  let end: string | null = null;
  if (from && to) {
    if (half) {
      const morning = values['request_date_from_period'] !== 'pm';
      [days, hours, start, end] = [0.5, 4, `${from}T${morning ? '08:00' : '13:00'}`, `${from}T${morning ? '12:00' : '17:00'}`];
    } else if (custom) {
      const h1 = Number(values['request_hour_from'] ?? 8);
      const h2 = Number(values['request_hour_to'] ?? 17);
      hours = Math.max(0, h2 - h1);
      days = hours / 8;
      const clock = (h: number) => `${pad(Math.floor(h))}:${h % 1 ? '30' : '00'}`;
      [start, end] = [`${from}T${clock(h1)}`, `${from}T${clock(h2)}`];
    } else {
      days = workingDays(from, to);
      hours = days * 8;
      [start, end] = [`${from}T08:00`, `${to}T17:00`];
    }
  }
  const holidayType = values['holiday_type'] as string;
  const employees = (values['employee_ids'] as RelatedRecord[] | null) ?? [];
  const single = employees.length === 1 ? employees[0] : null;
  const target =
    holidayType === 'company' ? (values['mode_company_id'] as RelatedRecord | null)?.label
    : holidayType === 'department' ? (values['department_id'] as RelatedRecord | null)?.label
    : holidayType === 'category' ? (values['category_id'] as RelatedRecord | null)?.label
    : employees.map((e) => e.label).join(', ');
  let display: string | null = null;
  if (type && from) {
    display =
      type.unit === 'hour'
        ? `${target} on ${type.name}: ${hours.toFixed(2)} hours on ${usDate(from)}`
        : `${target} on ${type.name}: ${days.toFixed(2)} days (${usDate(from)}${days > 1 && to ? ` - ${usDate(to)}` : ''})`;
  }
  const who = single ? Number(single.id) : null;
  return {
    request_date_to: to,
    date_from: start,
    date_to: end,
    number_of_days_display: days,
    number_of_hours_display: hours,
    number_of_hours_text: hoursText(hours, half || custom),
    leave_type_request_unit: type?.unit ?? 'day',
    leave_type_support_document: Boolean(type?.document),
    validation_type: type?.validation ?? 'hr',
    overtime_deductible: Boolean(type?.overtime),
    leave_type_increases_duration: false,
    display_name: display,
    employee_id: holidayType === 'employee' && single ? single : null,
    multi_employee: employees.length > 1,
    ...(holidayType === 'employee' && who ? { department_id: dept(STAFF[who].dept), employee_overtime: who === 4121 ? 6.5 : 0 } : {}),
    leave_stats: leaveStats({ ...values, employee_id: single }),
  };
}

const leaveRules: Record<string, (values: Values) => Values> = {
  // A new type: Half Day and Custom Hours start over (_compute_request_unit_half, _hours).
  holiday_status_id: (values) => ({ ...recalculateLeave({ ...values, request_unit_half: false, request_unit_hours: false }), request_unit_half: false, request_unit_hours: false }),
  // One or the other: ticking Half Day unticks Custom Hours, and the reverse.
  request_unit_half: (values) => ({ ...recalculateLeave({ ...values, request_unit_hours: values['request_unit_half'] ? false : values['request_unit_hours'] }), ...(values['request_unit_half'] ? { request_unit_hours: false } : {}) }),
  request_unit_hours: (values) => ({ ...recalculateLeave({ ...values, request_unit_half: values['request_unit_hours'] ? false : values['request_unit_half'] }), ...(values['request_unit_hours'] ? { request_unit_half: false } : {}) }),
  ...Object.fromEntries(
    ['request_date_from', 'request_date_to', 'request_date_from_period', 'request_hour_from', 'request_hour_to', 'employee_ids', 'holiday_type', 'department_id', 'mode_company_id', 'category_id'].map((name) => [name, recalculateLeave])
  ),
};

/** A stored request, worked out as the server stored it. */
function leave(values: Values): Values {
  const base: Values = {
    active: true,
    can_reset: true,
    can_approve: true,
    can_cancel: false,
    has_mandatory_day: false,
    tz_mismatch: false,
    tz: 'Africa/Cairo',
    holiday_type: 'employee',
    is_user_only_responsible: false,
    request_unit_half: false,
    request_unit_hours: false,
    request_date_from_period: 'am',
    request_hour_from: null,
    request_hour_to: null,
    employee_company_id: BRANCH,
    mode_company_id: null,
    category_id: null,
    first_approver_id: null,
    second_approver_id: null,
    supported_attachment_ids: [],
    ...values,
  };
  return { ...base, ...recalculateLeave(base) };
}

const sundayAhead = nextWeekday(0, 5);
const wednesdayAhead = nextWeekday(3, 5);

/** A doctor's note, as a scanned PDF. */
const doctorsNote =
  'JVBERi0xLjQKMSAwIG9iago8PC9UeXBlL0NhdGFsb2cvUGFnZXMgMiAwIFI+PgplbmRvYmoKMiAwIG9iago8PC9UeXBlL1BhZ2VzL0tpZHNbMyAwIFJdL0NvdW50IDE+PgplbmRvYmoKMyAwIG9iago8PC9UeXBlL1BhZ2UvUGFyZW50IDIgMCBSL01lZGlhQm94WzAgMCA1OTUgODQyXS9Db250ZW50cyA0IDAgUi9SZXNvdXJjZXM8PC9Gb250PDwvRjEgNSAwIFI+Pj4+Pj4KZW5kb2JqCjQgMCBvYmoKPDwvTGVuZ3RoIDIxMj4+c3RyZWFtCkJUIC9GMSAxNiBUZiA3MiA3NjAgVGQgMjAgVEwgKE1lZGljYWwgY2VydGlmaWNhdGUpIFRqIFQqIChQYXRpZW50OiBBaG1lZCBUYXdmaWspIFRqIFQqIChEaWFnbm9zaXM6IGluZmx1ZW56YSkgVGogVCogKFJlc3QgYWR2aXNlZDogMjcgYW5kIDI4IFNlcHRlbWJlciAyMDI2KSBUaiBUKiAoRHIuIEhlc2hhbSBBbGksIFphbWFsZWsgTWVkaWNhbCBDZW50cmUpIFRqIFQqIEVUCmVuZHN0cmVhbQplbmRvYmoKNSAwIG9iago8PC9UeXBlL0ZvbnQvU3VidHlwZS9UeXBlMS9CYXNlRm9udC9IZWx2ZXRpY2E+PgplbmRvYmoKeHJlZgowIDYKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDA5IDAwMDAwIG4gCjAwMDAwMDAwNTQgMDAwMDAgbiAKMDAwMDAwMDEwNSAwMDAwMCBuIAowMDAwMDAwMjE3IDAwMDAwIG4gCjAwMDAwMDA0NzcgMDAwMDAgbiAKdHJhaWxlcgo8PC9TaXplIDYvUm9vdCAxIDAgUj4+CnN0YXJ0eHJlZgo1NDAKJSVFT0YK';

const leaves: Record<string, Values> = {
  4171: leave({
    state: 'confirm',
    holiday_status_id: leaveType(4161),
    employee_ids: [employee(4122)],
    department_id: dept(4142),
    user_id: link(4103, 'Salma Adel'),
    request_date_from: day(sundayAhead),
    request_date_to: day(sundayAhead + 2),
    name: 'Family wedding in Mansoura',
  }),
  4172: leave({
    state: 'draft',
    holiday_status_id: leaveType(4163),
    employee_ids: [employee(4121)],
    department_id: dept(4143),
    user_id: link(4104, 'Omar Said'),
    request_date_from: day(wednesdayAhead),
    request_date_to: day(wednesdayAhead + 1),
    name: 'Covering the Friday open day, 3 October',
  }),
  4173: leave({
    state: 'validate',
    holiday_status_id: leaveType(4162),
    employee_ids: [employee(4127)],
    department_id: dept(4145),
    user_id: link(4105, 'Ahmed Tawfik'),
    request_date_from: '2026-09-27',
    request_date_to: '2026-09-28',
    name: 'Flu',
    first_approver_id: employee(4125),
    supported_attachment_ids: [{ name: "Doctor's note, Dr. Hesham Ali.pdf", type: 'application/pdf', size: 720, data: doctorsNote }],
  }),
  4174: leave({
    state: 'validate',
    can_cancel: true,
    holiday_status_id: leaveType(4161),
    employee_ids: [employee(4125)],
    department_id: dept(4144),
    user_id: link(4107, 'Mona Khalil'),
    request_date_from: day(nextWeekday(0, 30)),
    request_date_to: day(nextWeekday(0, 30) + 4),
    name: 'Sahel, before the season ends',
    first_approver_id: employee(4126),
    second_approver_id: employee(4126),
  }),
};

/** The time off answers: hr.leave's methods behind Approve, Validate, Refuse and Cancel. */
function leaveAction(request: ActionRequest): ActionResult | undefined {
  const values = request.values;
  const who = ((values['employee_ids'] as RelatedRecord[] | null) ?? []).map((e) => e.label).join(', ') || 'The employee';
  const type = LEAVE_TYPES[idOf(values['holiday_status_id']) ?? 0]?.name ?? 'time off';
  switch (request.action) {
    case 'leave_approved':
      // action_approve / action_validate: the approver is me; with two approvals the first one waits for the Time Off Officer.
      if (values['state'] === 'validate1') return { values: { first_approver_id: employee(ME) }, say: { message: `First approval given. ${STAFF[4126].name}, the Time Off Officer, gives the second.`, tone: 'success' } };
      return {
        values: values['first_approver_id'] ? { second_approver_id: employee(ME) } : { first_approver_id: employee(ME) },
        say: { message: `Approved: ${who}, ${type}.`, tone: 'success' },
      };
    case 'leave_refused':
      // action_refuse: refused by me, and the employee is told in the chatter.
      return { values: values['state'] === 'validate1' ? { first_approver_id: employee(ME) } : { second_approver_id: employee(ME) }, say: { message: `Refused. ${who} is told.`, tone: 'warning' } };
    case 'leave_cancelled':
      // hr.holidays.cancel.leave action_cancel_leave: archived, the reason posted.
      return { values: { active: false }, say: { message: 'The time off is cancelled; the reason is posted on it.', tone: 'info' } };
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// One of the staff in full: hr.employee (hr + hr_holidays + hr_skills + hr_org_chart + hr_maintenance)
// ---------------------------------------------------------------------------

/** A portrait as a picture: a drawn head and shoulders on the clinic's colour. */
const portrait = (initials: string, colour: string) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><rect width="256" height="256" fill="${colour}"/><circle cx="128" cy="102" r="50" fill="#f3dccb"/><path d="M40 256c6-62 44-92 88-92s82 30 88 92z" fill="#ffffff"/><path d="M78 98c0-40 22-62 50-62s52 20 52 60c-10-18-30-30-52-30s-40 14-50 32z" fill="#3b2a24"/><text x="128" y="236" font-family="sans-serif" font-size="30" font-weight="700" fill="${colour}" text-anchor="middle">${initials}</text></svg>`;
  const data = btoa(svg);
  return { name: `${initials.toLowerCase()}.svg`, type: 'image/svg+xml', size: svg.length, data };
};

const COUNTRIES: Record<number, string> = { 4281: 'Egypt', 4282: 'Saudi Arabia', 4283: 'Jordan', 4284: 'Sudan' };
const country = (id: number) => link(id, COUNTRIES[id]);
const REGIONS: Record<number, { name: string; country: number }> = {
  4291: { name: 'Cairo', country: 4281 },
  4292: { name: 'Giza', country: 4281 },
  4293: { name: 'Dakahlia', country: 4281 },
  4294: { name: 'Alexandria', country: 4281 },
  4295: { name: 'Riyadh', country: 4282 },
  4296: { name: 'Amman', country: 4283 },
};
const WORK_ADDRESSES: Record<number, string> = { 4011: 'Glow Aesthetic Clinic, Zamalek', 4012: 'Glow Aesthetic Clinic, New Cairo' };
const WORK_LOCATIONS: Record<number, { name: string; address: number }> = {
  4261: { name: 'Zamalek, treatment floor', address: 4011 },
  4262: { name: 'Zamalek, reception', address: 4011 },
  4263: { name: 'New Cairo, Building B', address: 4012 },
};

const salma: Values = {
  active: true,
  name: 'Salma Adel',
  job_title: 'Senior Aesthetic Nurse',
  image_1920: portrait('SA', '#9a3412'),
  category_ids: [link(4181, 'Clinical'), link(4182, 'Injector certified'), link(4185, 'Arabic & English')],
  show_hr_icon_display: true,
  hr_icon_display: 'presence_present',
  show_leaves: true,
  is_absent: false,
  leave_date_to: null,
  allocation_summary: '12.5/21 Days',
  current_leave_id: 4171,
  equipment_count: 2,
  mobile_phone: '+20 100 912 4471',
  work_phone: '+20 2 2735 8800',
  work_email: 'salma.adel@glowclinic.example',
  company_id: BRANCH,
  company_ids: [BRANCH, link(4202, 'Glow Aesthetic Clinic, New Cairo')],
  department_id: dept(4142),
  job_id: link(4153, JOBS[4153]),
  parent_id: employee(4123),
  coach_id: employee(4123),
  employee_properties: { uniform_size: 'm', locker: 14, licence: 'ENS-118204', bls_expiry: '2027-03-31' },
  resume_line_ids: [
    { key: 'r1', id: 1, values: { line_type_id: link(4191, 'Experience'), name: 'Glow Aesthetic Clinic', description: 'Senior aesthetic nurse: injectables assistance, laser sessions, patient aftercare.', date_start: '2022-03-01', date_end: null, display_type: 'classic' } },
    { key: 'r2', id: 2, values: { line_type_id: link(4191, 'Experience'), name: 'Kasr Al Ainy Hospital, Dermatology', description: 'Staff nurse, outpatient dermatology clinic.', date_start: '2017-09-01', date_end: '2022-02-28', display_type: 'classic' } },
    { key: 'r3', id: 3, values: { line_type_id: link(4192, 'Education'), name: 'Cairo University, Faculty of Nursing', description: 'Bachelor of Nursing Science.', date_start: '2013-09-01', date_end: '2017-06-30', display_type: 'classic' } },
    { key: 'r4', id: 4, values: { line_type_id: link(4193, 'Internal Certification'), name: 'Laser safety officer', description: 'Class 4 lasers, Candela GentleMax Pro.', date_start: '2024-05-12', date_end: null, display_type: 'classic' } },
  ],
  employee_skill_ids: [
    { key: 's1', id: 1, values: { skill_id: link(4211, 'Dermal filler assistance'), skill_level_id: link(4221, 'Advanced'), level_progress: 80, skill_type_id: link(4231, 'Clinical') } },
    { key: 's2', id: 2, values: { skill_id: link(4212, 'Laser hair removal'), skill_level_id: link(4222, 'Expert'), level_progress: 100, skill_type_id: link(4231, 'Clinical') } },
    { key: 's3', id: 3, values: { skill_id: link(4213, 'English'), skill_level_id: link(4223, 'C1'), level_progress: 85, skill_type_id: link(4232, 'Languages') } },
  ],
  address_id: link(4011, WORK_ADDRESSES[4011]),
  work_location_id: link(4261, WORK_LOCATIONS[4261].name),
  leave_manager_id: link(4107, 'Mona Khalil'),
  departure_reason_id: null,
  departure_description: null,
  departure_date: null,
  resource_calendar_id: link(4271, 'Standard 40 hours/week, Sunday to Thursday'),
  tz: 'Africa/Cairo',
  child_ids: [
    { key: 'c1', id: 4128, values: { name: 'Reem Gamal', job_title: 'Aesthetic Nurse' } },
    { key: 'c2', id: 4129, values: { name: 'Aya Mahmoud', job_title: 'Aesthetic Nurse' } },
  ],
  private_street: '14 Shagaret El Dor Street',
  private_street2: 'Apartment 7',
  private_city: 'Zamalek',
  private_state_id: link(4291, 'Cairo'),
  private_zip: '11211',
  private_country_id: country(4281),
  private_email: 'salma.adel.85@gmail.example',
  private_phone: '+20 122 404 1187',
  bank_account_id: link(4241, 'EG38 0019 0005 0000 0000 2631 8000 2 (CIB)'),
  lang: 'en_US',
  km_home_work: 3,
  private_car_plate: 'ن ص ع 4821',
  marital: 'married',
  spouse_complete_name: 'Tarek Mansour',
  spouse_birthdate: '1990-11-02',
  children: 1,
  emergency_contact: 'Tarek Mansour',
  emergency_phone: '+20 100 553 2209',
  certificate: 'bachelor',
  study_field: 'Nursing',
  study_school: 'Cairo University',
  visa_no: null,
  permit_no: null,
  visa_expire: null,
  work_permit_expiration_date: null,
  has_work_permit: null,
  country_id: country(4281),
  identification_id: '29103150104562',
  ssnid: '7731045',
  passport_id: 'A27741903',
  gender: 'female',
  birthday: '1991-03-15',
  place_of_birth: 'Mansoura',
  country_of_birth: country(4281),
  employee_type: 'employee',
  user_id: link(4103, 'Salma Adel'),
  pin: '4471',
  barcode: null,
};

/** Who a new department's people answer to, and the coach that follows the manager (_compute_parent_id, _compute_coach). */
const employeeRules: Record<string, (values: Values) => Values> = {
  department_id: (values): Values => {
    const manager = DEPARTMENT_MANAGER[idOf(values['department_id']) ?? 0];
    if (!manager) return {};
    return { parent_id: employee(manager), ...(values['coach_id'] ? {} : { coach_id: employee(manager) }) };
  },
  parent_id: (values): Values => (values['coach_id'] || !values['parent_id'] ? {} : { coach_id: values['parent_id'] }),
  job_id: (values): Values => {
    const job = idOf(values['job_id']);
    return job ? { job_title: JOBS[job] } : {};
  },
  private_country_id: (values): Values => {
    const state = REGIONS[idOf(values['private_state_id']) ?? 0];
    return state && state.country !== idOf(values['private_country_id']) ? { private_state_id: null } : {};
  },
  address_id: (values): Values => {
    const location = WORK_LOCATIONS[idOf(values['work_location_id']) ?? 0];
    return location && location.address !== idOf(values['address_id']) ? { work_location_id: null } : {};
  },
  // _onchange_timezone: the working hours' timezone, when it has none.
  resource_calendar_id: (values): Values => (values['tz'] ? {} : { tz: 'Africa/Cairo' }),
};

/** The plans an employee can be put on (mail.activity.plan), and the activities each schedules. */
const PLANS: Record<number, { name: string; model: string; onDemand: boolean; steps: [string, string][] }> = {
  4251: {
    name: 'Onboarding',
    model: 'hr.employee',
    onDemand: false,
    steps: [
      ['Setup IT materials', 'Ahmed Tawfik'],
      ['Clinic induction and infection-control briefing', 'Mona Khalil'],
      ['Plan training on the laser and HydraFacial devices', 'Manager'],
      ['Organize knowledge transfer inside the team', 'Coach'],
    ],
  },
  4252: {
    name: 'Offboarding',
    model: 'hr.employee',
    onDemand: true,
    steps: [
      ['Organize knowledge transfer inside the team', 'Manager'],
      ['Take back the badge, keys and uniform', 'Assigned on demand'],
      ['Close access to the patient records', 'Ahmed Tawfik'],
    ],
  },
  4253: { name: 'Patient recall', model: 'res.partner', onDemand: false, steps: [] },
};

const planRules: Record<string, (values: Values) => Values> = {
  plan_id: (values) => {
    const plan = PLANS[idOf(values['plan_id']) ?? 0];
    if (!plan) return { plan_assignation_summary: null, plan_has_user_on_demand: false };
    const due = (values['plan_date_deadline'] as string | null) ?? day(0);
    return {
      plan_has_user_on_demand: plan.onDemand,
      plan_assignation_summary: `<ul>${plan.steps.map(([what, who]) => `<li>${what}: ${who}, due ${usDate(due)}</li>`).join('')}</ul>`,
    };
  },
};

function employeeAction(request: ActionRequest): ActionResult | undefined {
  const values = request.values;
  switch (request.action) {
    case 'employee_plan_launched':
      return { say: { message: `The plan is launched: its activities are scheduled on ${String(values['name'] ?? 'the employee')}.`, tone: 'success' } };
    case 'employee_generate_barcode':
      // generate_random_barcode: 041 and nine random digits.
      return { values: { barcode: `041${Array.from({ length: 9 }, () => Math.floor(Math.random() * 10)).join('')}` } };
    case 'employee_print_badge':
      return { say: { message: `Badge ${String(values['barcode'])} sent to print.`, tone: 'info' } };
    case 'employee_equipment':
      return { say: { message: 'Equipment: DermLite DL5 dermatoscope; iPad mini for patient photos.', tone: 'info' } };
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// The clinic's equipment: maintenance.request (maintenance + hr_maintenance)
// ---------------------------------------------------------------------------

/** The stages of a request, in order: the last two close it (maintenance.stage done). */
const MAINTENANCE_STAGES: Record<number, { name: string; done: boolean }> = {
  4331: { name: 'New Request', done: false },
  4332: { name: 'In Progress', done: false },
  4333: { name: 'Repaired', done: true },
  4334: { name: 'Scrap', done: true },
};
const maintenanceStage = (id: number) => link(id, MAINTENANCE_STAGES[id].name);
const EQUIPMENT_CATEGORIES: Record<number, string> = { 4351: 'Medical devices', 4352: 'Air conditioning', 4353: 'Office equipment' };
const TEAMS: Record<number, string> = { 4361: 'Biomedical', 4362: 'Facilities' };
/** The equipment, each with its category, its team and the technician who looks after it. */
const EQUIPMENT: Record<number, { name: string; category: number; team: number; technician: [number, string] }> = {
  4341: { name: 'Candela GentleMax Pro laser', category: 4351, team: 4361, technician: [4105, 'Ahmed Tawfik'] },
  4342: { name: 'HydraFacial MD Elite', category: 4351, team: 4361, technician: [4105, 'Ahmed Tawfik'] },
  4343: { name: 'Daikin split AC, treatment room 2', category: 4352, team: 4362, technician: [4106, 'Mahmoud Ezzat'] },
  4344: { name: 'HP LaserJet Pro M404, reception', category: 4353, team: 4362, technician: [4106, 'Mahmoud Ezzat'] },
};

const serviceManual =
  'JVBERi0xLjQKMSAwIG9iago8PC9UeXBlL0NhdGFsb2cvUGFnZXMgMiAwIFI+PgplbmRvYmoKMiAwIG9iago8PC9UeXBlL1BhZ2VzL0tpZHNbMyAwIFJdL0NvdW50IDE+PgplbmRvYmoKMyAwIG9iago8PC9UeXBlL1BhZ2UvUGFyZW50IDIgMCBSL01lZGlhQm94WzAgMCA1OTUgODQyXS9Db250ZW50cyA0IDAgUi9SZXNvdXJjZXM8PC9Gb250PDwvRjEgNSAwIFI+Pj4+Pj4KZW5kb2JqCjQgMCBvYmoKPDwvTGVuZ3RoIDM0MT4+c3RyZWFtCkJUIC9GMSAxNiBUZiA3MiA3NjAgVGQgMjAgVEwgKEdlbnRsZU1heCBQcm86IGhhbmQtcGllY2UgY29vbGluZyAoRTEyKSkgVGogVCogKDEuIFN3aXRjaCB0aGUgc3lzdGVtIG9mZiBhbmQgd2FpdCAxMCBtaW51dGVzLikgVGogVCogKDIuIENoZWNrIHRoZSBjb29sYW50IGxldmVsIGluIHRoZSByZXNlcnZvaXIuKSBUaiBUKiAoMy4gSW5zcGVjdCB0aGUgRENEIGNhbmlzdGVyIGFuZCBpdHMgaG9zZS4pIFRqIFQqICg0LiBSdW4gdGhlIGNvb2xpbmcgc2VsZi10ZXN0IGZyb20gU2VydmljZSBtb2RlLikgVGogVCogKDUuIElmIEUxMiByZXR1cm5zLCBjYWxsIENhbmRlbGEgc3VwcG9ydC4pIFRqIFQqIEVUCmVuZHN0cmVhbQplbmRvYmoKNSAwIG9iago8PC9UeXBlL0ZvbnQvU3VidHlwZS9UeXBlMS9CYXNlRm9udC9IZWx2ZXRpY2E+PgplbmRvYmoKeHJlZgowIDYKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDA5IDAwMDAwIG4gCjAwMDAwMDAwNTQgMDAwMDAgbiAKMDAwMDAwMDEwNSAwMDAwMCBuIAowMDAwMDAwMjE3IDAwMDAwIG4gCjAwMDAwMDA2MDYgMDAwMDAgbiAKdHJhaWxlcgo8PC9TaXplIDYvUm9vdCAxIDAgUj4+CnN0YXJ0eHJlZgo2NjkKJSVFT0YK';

const maintenanceRules: Record<string, (values: Values) => Values> = {
  // _compute_maintenance_team_id, _compute_user_id: the equipment's team and technician; the category is related.
  equipment_id: (values): Values => {
    const equipment = EQUIPMENT[idOf(values['equipment_id']) ?? 0];
    if (!equipment) return { category_id: null };
    return {
      category_id: link(equipment.category, EQUIPMENT_CATEGORIES[equipment.category]),
      maintenance_team_id: link(equipment.team, TEAMS[equipment.team]),
      user_id: link(...equipment.technician),
    };
  },
  // _compute_recurring_maintenance: only preventive maintenance repeats.
  maintenance_type: (values): Values => (values['maintenance_type'] === 'preventive' ? {} : { recurring_maintenance: false }),
  // write(): a new stage starts the kanban state over, and a closing stage stamps the close date.
  stage_id: (values): Values => {
    const done = MAINTENANCE_STAGES[idOf(values['stage_id']) ?? 0]?.done ?? false;
    return { done, close_date: done ? day(0) : null, kanban_state: 'normal' };
  },
};

const requestBase: Values = {
  company_id: BRANCH,
  archive: false,
  done: false,
  close_date: null,
  kanban_state: 'normal',
  recurring_maintenance: false,
  repeat_interval: 1,
  repeat_unit: 'week',
  repeat_type: 'forever',
  repeat_until: null,
  instruction_type: 'text',
  instruction_pdf: null,
  instruction_google_slide: null,
  instruction_text: null,
};

const maintenanceRequests: Record<string, Values> = {
  4371: {
    ...requestBase,
    name: 'Laser hand-piece cooling error E12',
    stage_id: maintenanceStage(4332),
    kanban_state: 'blocked',
    employee_id: employee(4122),
    equipment_id: link(4341, EQUIPMENT[4341].name),
    category_id: link(4351, EQUIPMENT_CATEGORIES[4351]),
    request_date: day(-1),
    maintenance_type: 'corrective',
    maintenance_team_id: link(4361, TEAMS[4361]),
    user_id: link(4105, 'Ahmed Tawfik'),
    schedule_date: at(0, '16:00'),
    duration: 2.5,
    priority: 3,
    description:
      '<p>Error <b>E12</b> (hand-piece cooling) after the third patient this morning. Two laser sessions moved to Room 1’s HydraFacial; the 18:00 laser bookings are on hold until the self-test passes.</p><p>Waiting for a DCD canister from Candela’s Cairo agent.</p>',
    instruction_type: 'pdf',
    instruction_pdf: { name: 'GentleMax Pro service manual, cooling.pdf', type: 'application/pdf', size: 849, data: serviceManual },
  },
  4372: {
    ...requestBase,
    name: 'Quarterly filter cleaning and gas check',
    stage_id: maintenanceStage(4331),
    employee_id: employee(4125),
    equipment_id: link(4343, EQUIPMENT[4343].name),
    category_id: link(4352, EQUIPMENT_CATEGORIES[4352]),
    request_date: day(-3),
    maintenance_type: 'preventive',
    maintenance_team_id: link(4362, TEAMS[4362]),
    user_id: link(4106, 'Mahmoud Ezzat'),
    schedule_date: at(4, '08:00'),
    duration: 1,
    priority: 1,
    recurring_maintenance: true,
    repeat_interval: 3,
    repeat_unit: 'month',
    repeat_type: 'forever',
    instruction_type: 'google_slide',
    instruction_google_slide: 'https://docs.google.com/presentation/d/1glowclinic-ac-filters/edit',
  },
  4373: {
    ...requestBase,
    name: 'Paper jam in tray 2',
    stage_id: maintenanceStage(4331),
    archive: true,
    employee_id: employee(4121),
    equipment_id: link(4344, EQUIPMENT[4344].name),
    category_id: link(4353, EQUIPMENT_CATEGORIES[4353]),
    request_date: day(-6),
    maintenance_type: 'corrective',
    maintenance_team_id: link(4362, TEAMS[4362]),
    user_id: link(4106, 'Mahmoud Ezzat'),
    duration: 0.25,
    priority: null,
    instruction_text: '<p>Open the rear door, pull the sheet straight out, never upwards.</p>',
  },
};

function maintenanceAction(request: ActionRequest): ActionResult | undefined {
  // reset_equipment_request: back into the pipe, in the first stage.
  if (request.action === 'maintenance_first_stage') return { values: { stage_id: maintenanceStage(4331), done: false, close_date: null }, say: { message: 'The request is open again, in New Request.', tone: 'info' } };
  return undefined;
}

// ---------------------------------------------------------------------------
// The lane
// ---------------------------------------------------------------------------

const named = (rows: Record<number, string>, extra: (id: number) => Values = () => ({})) =>
  Object.fromEntries(Object.entries(rows).map(([id, name]) => [id, { name, ...extra(Number(id)) }]));

/** A face for a link or a tag (image_128), drawn on a colour of its own. */
const FACE_COLOURS = ['#9a3412', '#1d4ed8', '#047857', '#7c3aed', '#b45309', '#be185d', '#0e7490', '#4d7c0f', '#6d28d9'];
const face = (id: number, name: string) => {
  const initials = name.replace(/^Dr\. /, '').split(' ').map((word) => word[0]).join('').slice(0, 2);
  return `data:image/svg+xml;base64,${portrait(initials, FACE_COLOURS[id % FACE_COLOURS.length]).data}`;
};

/** The person using the demo — Mona Khalil, the Operations Manager — and the groups Flectra gives her. */
const MANAGER = { id: 4107, name: 'Mona Khalil', roles: ['hr_holidays.group_hr_holidays_user'] };

export const lane: RealLane = {
  pages: {
    'real-clinic-appointment': clinicAppointment as Page,
    'real-time-off': timeOff as Page,
    'real-employee': employeePage as Page,
    'real-maintenance-request': maintenanceRequest as Page,
  },
  opened: {
    'real-time-off-cancel': timeOffCancel as Page,
    'real-employee-plan': employeePlan as Page,
    // A stat button opens a request in the employee's place.
    'real-time-off': timeOff as Page,
  },
  labelField: { 'hr.leave.type': 'display_name' },
  users: {
    'real-clinic-appointment': MANAGER,
    'real-time-off': MANAGER,
    'real-employee': MANAGER,
    'real-maintenance-request': MANAGER,
  },
  // The list each record was opened from, and the way back to it.
  navigation: {
    'real-clinic-appointment': { records: [4001, 4002, 4003], breadcrumbs: [{ label: 'Appointments', href: '#appointments' }] },
    'real-time-off': { records: [4171, 4172, 4173, 4174], breadcrumbs: [{ label: 'Time Off', href: '#time-off' }] },
  },
  // What links show besides a name: the staff's faces.
  shows: { 'hr.employee': { avatar: 'image_128' } },
  // The doctor's note, beside the sick leave it supports (o_attachment_preview).
  attachments: { 'hr.leave:4173': [{ name: "Doctor's note, Dr. Hesham Ali.pdf", type: 'application/pdf', size: 720, data: doctorsNote }] },
  records: {
    'clinic.appointment': appointments,
    'hr.leave': leaves,
    'hr.leave.type': Object.fromEntries(
      Object.entries(LEAVE_TYPES).map(([id, t]) => [
        id,
        { name: t.name, display_name: leaveTypeLabel(Number(id)), requires_allocation: t.allocation, has_valid_allocation: t.valid, allows_negative: Boolean(t.negative), virtual_remaining_leaves: t.remaining },
      ])
    ),
    'hr.employee': {
      ...Object.fromEntries(
        Object.entries(STAFF).map(([id, s]) => [
          id,
          { active: true, name: s.name, image_128: face(Number(id), s.name), job_title: JOBS[s.job], job_id: link(s.job, JOBS[s.job]), department_id: dept(s.dept), work_email: s.email, parent_id: s.parent ? employee(s.parent) : null, company_id: BRANCH, employee_type: 'employee', marital: 'single', tz: 'Africa/Cairo' },
        ])
      ),
      4122: { ...salma, image_128: face(4122, salma['name'] as string) },
    },
    'hr.department': named(DEPARTMENTS),
    'hr.job': named(JOBS),
    'hr.employee.category': named({ 4181: 'Clinical', 4182: 'Injector certified', 4183: 'Laser certified', 4184: 'Part-time', 4185: 'Arabic & English' }),
    'res.partner': {
      ...Object.fromEntries(Object.entries(PATIENTS).map(([id, p]) => [id, { name: p.name, phone: p.phone, is_patient: true }])),
      ...named(WORK_ADDRESSES, () => ({ is_patient: false })),
    },
    'res.company': named({ 4201: 'Glow Aesthetic Clinic, Zamalek', 4202: 'Glow Aesthetic Clinic, New Cairo' }),
    'res.users': named({ 4101: 'Dr. Rania Fouad', 4102: 'Dr. Karim Hegazy', 4103: 'Salma Adel', 4104: 'Omar Said', 4105: 'Ahmed Tawfik', 4106: 'Mahmoud Ezzat', 4107: 'Mona Khalil', 4108: 'Laila Hamdy' }),
    'product.product': Object.fromEntries(Object.entries(SERVICES).map(([id, s]) => [id, { name: s.name, is_treatment: s.treatment }])),
    'clinic.resource': named({ 4401: 'Room 1', 4402: 'Room 2', 4403: 'HydraBay', 4404: 'Laser Device' }),
    'clinic.queue.stage': named(Object.fromEntries(Object.entries(STAGES).map(([id, s]) => [id, s.name]))),
    'clinic.cancel.reason': named({ 4601: 'Patient request', 4602: 'Travel', 4603: 'Illness', 4604: 'Clinic reschedule', 4605: 'No reason given' }),
    'clinic.treatment.session': named({ 4701: 'S-00417' }),
    'account.payment': named({ 4801: 'PBNK1/2026/00038' }),
    'account.move': named({ 4851: 'INV/2026/01187' }),
    'res.country': named(COUNTRIES),
    'res.country.state': Object.fromEntries(Object.entries(REGIONS).map(([id, r]) => [id, { name: r.name, country_id: country(r.country) }])),
    'hr.work.location': Object.fromEntries(Object.entries(WORK_LOCATIONS).map(([id, l]) => [id, { name: l.name, address_id: link(l.address, WORK_ADDRESSES[l.address]) }])),
    'resource.calendar': named({ 4271: 'Standard 40 hours/week, Sunday to Thursday', 4272: 'Part-time 24 hours/week' }),
    'res.partner.bank': named({ 4241: 'EG38 0019 0005 0000 0000 2631 8000 2 (CIB)' }),
    'hr.departure.reason': named({ 4243: 'Fired', 4244: 'Resigned', 4245: 'Retired' }),
    'hr.resume.line.type': named({ 4191: 'Experience', 4192: 'Education', 4193: 'Internal Certification', 4194: 'Training' }),
    'hr.skill': named({ 4211: 'Dermal filler assistance', 4212: 'Laser hair removal', 4213: 'English', 4214: 'Chemical peels', 4215: 'Patient photography' }),
    'hr.skill.level': named({ 4221: 'Advanced', 4222: 'Expert', 4223: 'C1', 4224: 'Beginner', 4225: 'Intermediate' }),
    'hr.skill.type': named({ 4231: 'Clinical', 4232: 'Languages' }),
    'maintenance.request': maintenanceRequests,
    'maintenance.stage': Object.fromEntries(Object.entries(MAINTENANCE_STAGES).map(([id, st]) => [id, { name: st.name, done: st.done }])),
    'maintenance.equipment': Object.fromEntries(Object.entries(EQUIPMENT).map(([id, e]) => [id, { name: e.name, category_id: link(e.category, EQUIPMENT_CATEGORIES[e.category]) }])),
    'maintenance.equipment.category': named(EQUIPMENT_CATEGORIES),
    'maintenance.team': named(TEAMS),
    'mail.activity.plan': Object.fromEntries(Object.entries(PLANS).map(([id, p]) => [id, { name: p.name, res_model: p.model }])),
  },
  onchange: {
    'clinic.appointment': appointmentRules,
    'hr.leave': leaveRules,
    'hr.employee': employeeRules,
    'mail.activity.schedule': planRules,
    'maintenance.request': maintenanceRules,
  },
  action: (request) => clinicAction(request) ?? leaveAction(request) ?? employeeAction(request) ?? maintenanceAction(request),
};
