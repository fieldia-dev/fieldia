import type { Page } from '@fieldia/core';

/**
 * Your own parts, as an app uses them: a conference's badge. The name on it is
 * a field drawn by the app's own widget, which shows the badge as it is typed;
 * the printing desk under it is a slot the app fills, with a count of its own
 * that follows the form. Each framework's demo writes the two parts in its own
 * way (main.ts / main.tsx), from the words here, and they behave the same.
 */
export const customPage: Page = {
  fieldia: '0.1',
  id: 'badge',
  title: 'Your conference badge',
  description: 'The name is typed into a field the app draws itself, which shows the badge as it will be printed. The printing desk under it is the app’s own panel.',
  data: { kind: 'responses' },
  fields: {
    badge_name: { type: 'char', label: 'Name on the badge', required: true, help: 'As people should read it from across the room.' },
    badge_type: {
      type: 'selection',
      label: 'Badge',
      options: [
        { value: 'attendee', label: 'Attendee' },
        { value: 'speaker', label: 'Speaker' },
      ],
    },
  },
  layout: {
    type: 'sections',
    id: 'custom',
    children: [
      {
        type: 'section',
        id: 'parts',
        title: 'Your badge',
        children: [
          { type: 'field', id: 'f-badge-name', field: 'badge_name', widget: 'name-badge' },
          { type: 'field', id: 'f-badge-type', field: 'badge_type', widget: 'radio' },
        ],
      },
      { type: 'slot', id: 'note', name: 'note' },
    ],
  },
};

/** The badge, as the app's own widget shows it under its box: the name in capitals, as it is printed; nothing until typed. */
export const shout = (value: unknown) => String(value ?? '').trim().toUpperCase();
/** The printing desk's button: its own count, kept by the panel itself. */
export const clicked = (n: number) => (n === 0 ? 'Print the badge' : `Print again (${n} printed)`);
/** What the printing desk says, from the form's own values: it follows the name as it is typed. */
export const greeting = (name: unknown) => (String(name ?? '').trim() ? `Ready to print the badge for ${String(name).trim()}.` : 'Type a name to print its badge.');
