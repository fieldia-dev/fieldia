import type { Page } from '@fieldia/core';

/**
 * A page made to prove that a host app can plug in its own parts: the
 * "shout" field and the "note" slot are written once per framework, each in
 * that framework's own way, and behave the same everywhere.
 */
export const customPage: Page = {
  fieldia: '0.1',
  id: 'custom-parts',
  title: 'Your own parts',
  description: 'A field and a panel written in the host framework, inside a Fieldia form.',
  data: { kind: 'responses' },
  fields: {
    nickname: { type: 'char', label: 'Nickname', required: true },
    mood: {
      type: 'selection',
      label: 'Mood',
      options: [
        { value: 'calm', label: 'Calm' },
        { value: 'busy', label: 'Busy' },
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
        title: 'Custom field',
        children: [
          { type: 'field', id: 'f-nickname', field: 'nickname', widget: 'shout' },
          { type: 'field', id: 'f-mood', field: 'mood', widget: 'radio' },
        ],
      },
      { type: 'slot', id: 'note', name: 'note' },
    ],
  },
};

/** What the shout field shows under its input. */
export const shout = (value: unknown) => `${String(value ?? '').toUpperCase()}!`;
/** What the note slot says. */
export const clicked = (n: number) => `Clicked ${n} ${n === 1 ? 'time' : 'times'}`;
export const greeting = (nickname: unknown) => (nickname ? `Hello, ${String(nickname)}` : 'Hello');
