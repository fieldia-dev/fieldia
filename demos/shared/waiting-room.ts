import type { Page, Values } from '@fieldia/core';

/**
 * A clinic's waiting room this morning (waiting-room): the patients in the order they go in — each one's turn, ten
 * apart, as a front desk leaves room between them — with their treatment, their doctor, when they came in and whether
 * they are ready. The same patients on every visit.
 */
const PATIENTS: [name: string, treatment: string, doctor: string, arrived: string, state: string][] = [
  ['Omar Nabil', 'consultation', 'Dr Salma Hany', '09:05', 'ready'],
  ['Hana Wael', 'botox', 'Dr Karim Fathy', '09:10', 'ready'],
  ['Tamer Said', 'peel', 'Dr Salma Hany', '09:20', 'waiting'],
  ['Laila Mostafa', 'filler', 'Dr Karim Fathy', '09:25', 'waiting'],
  ['Ziad Kamal', 'laser', 'Dr Mona Adel', '09:30', 'late'],
  ['Mariam Ezz', 'consultation', 'Dr Mona Adel', '09:35', 'waiting'],
  ['Nour Hassan', 'botox', 'Dr Salma Hany', '09:40', 'waiting'],
  ['Rana Fouad', 'filler', 'Dr Karim Fathy', '09:50', 'waiting'],
];

export function waitingPatients(): Record<number, Values> {
  return Object.fromEntries(PATIENTS.map(([name, treatment, doctor, arrived, state], i) => [i + 1, { name, treatment, doctor, arrived, state, turn: (i + 1) * 10 }]));
}

/** A patient's own page, as a row of the waiting room opens it: who, for what, with whom, since when. */
export const waitingPatientPage: Page = {
  fieldia: '0.13',
  id: 'waiting-patient',
  title: 'Patient waiting',
  data: { kind: 'record', model: 'clinic.waiting' },
  fields: {
    name: { type: 'char', label: 'Patient', required: true },
    treatment: { type: 'selection', label: 'Treatment', options: [{ value: 'consultation', label: 'Consultation' }, { value: 'botox', label: 'Botox' }, { value: 'filler', label: 'Filler' }, { value: 'peel', label: 'Chemical peel' }, { value: 'laser', label: 'Laser session' }] },
    doctor: { type: 'char', label: 'Doctor' },
    arrived: { type: 'char', label: 'Arrived' },
    state: { type: 'selection', label: 'Status', options: [{ value: 'waiting', label: 'Waiting' }, { value: 'ready', label: 'Ready' }, { value: 'late', label: 'Running late' }] },
  },
  layout: {
    type: 'sheet',
    id: 'waiting-patient',
    title: { field: 'name' },
    statusbar: { field: 'state' },
    children: [{ type: 'section', id: 'visit', children: [{ type: 'field', id: 'treatment', field: 'treatment' }, { type: 'field', id: 'doctor', field: 'doctor' }, { type: 'field', id: 'arrived', field: 'arrived' }] }],
  },
};
