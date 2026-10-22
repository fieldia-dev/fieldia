import type { Page, Values } from '@fieldia/core';

/** A property enquiry, as a site's server and the browser both read it (server.ts draws its first paint, main.ts mounts over it). */
export const page: Page = {
  fieldia: '0.10',
  id: 'enquiry',
  title: 'Property enquiry',
  description: 'Drawn by the server first, then made live in the browser — what you type meanwhile is kept.',
  data: { kind: 'record', model: 'crm.enquiry' },
  fields: {
    name: { type: 'char', label: 'Client', required: true },
    email: { type: 'char', label: 'Email' },
    phone: { type: 'char', label: 'Phone' },
    kind: { type: 'selection', label: 'Looking for', options: [{ value: 'villa', label: 'Villa' }, { value: 'apartment', label: 'Apartment' }, { value: 'office', label: 'Office' }] },
    bedrooms: { type: 'integer', label: 'Bedrooms', min: 1, max: 9 },
    budget: { type: 'monetary', label: 'Budget', currency: 'EGP' },
    move_in: { type: 'date', label: 'Move-in day' },
    garden: { type: 'boolean', label: 'Needs a garden' },
    notes: { type: 'text', label: 'Notes' },
  },
  layout: {
    type: 'sections',
    id: 'sections',
    children: [
      {
        type: 'section',
        id: 'who',
        title: 'Who is asking',
        columns: 2,
        children: [
          { type: 'field', id: 'f-name', field: 'name' },
          { type: 'field', id: 'f-email', field: 'email', widget: 'email' },
          { type: 'field', id: 'f-phone', field: 'phone' },
        ],
      },
      {
        type: 'section',
        id: 'what',
        title: 'What they need',
        columns: 2,
        children: [
          { type: 'field', id: 'f-kind', field: 'kind' },
          { type: 'field', id: 'f-bedrooms', field: 'bedrooms', invisible: "kind == 'office'" },
          { type: 'field', id: 'f-budget', field: 'budget' },
          { type: 'field', id: 'f-move-in', field: 'move_in' },
          { type: 'field', id: 'f-garden', field: 'garden', invisible: "kind != 'villa'" },
          { type: 'field', id: 'f-notes', field: 'notes', colspan: 2 },
        ],
      },
    ],
  },
};

/** The record the server loaded, and the browser's data source answers with. */
export const record: Values = { name: 'Nile Traders', email: '', phone: '+20 2 2735 0000', kind: 'villa', bedrooms: 4, budget: 15000000, move_in: '2026-12-01', garden: true, notes: 'Near a school, please.' };
